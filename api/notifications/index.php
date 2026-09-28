<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user     = Auth::user();
if (!$user) Response::unauthorized();
$tenantId = (int)$user['tenant_id'];
$userId   = (int)($user['user_id'] ?? $user['id'] ?? 0);
$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        // Get notifications for this user
        $rows = DB::query(
            'SELECT * FROM notifications
              WHERE tenant_id = ? AND (user_id = ? OR user_id IS NULL)
              ORDER BY created_at DESC LIMIT 50',
            [$tenantId, $userId]
        );
        Response::success($rows);
        break;

    case 'POST':
        // Handle both JSON and multipart form data (file uploads)
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (strpos($contentType, 'multipart/form-data') !== false) {
            $body   = $_POST;
        } else {
            $body   = json_decode(file_get_contents('php://input'), true);
        }
        $action = $body['action'] ?? '';

        if ($action === 'send_email') {
            require_once __DIR__ . '/../../includes/crypto.php';
            require_once __DIR__ . '/../../includes/mailer.php';
            $to      = trim($body['to'] ?? '');
            $subject = trim($body['subject'] ?? '');
            $msgBody = trim($body['body'] ?? '');
            if (!$to || !$subject || !$msgBody) Response::error('To, subject and body required');
            if (!filter_var($to, FILTER_VALIDATE_EMAIL)) Response::error('Invalid email address');
            $settings = Mailer::getEffectiveSettings($tenantId, $userId);
            // Build signature block
            $sigText = !empty($settings['email_signature']) ? $settings['email_signature'] : '';
            $sigImg  = !empty($settings['email_signature_img']) ? $settings['email_signature_img'] : '';
            $sigBlock = '';
            if ($sigText || $sigImg) {
                $sigBlock .= '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb">';
                if ($sigText) {
                    $sigBlock .= '<div style="font-size:13px;color:#444;line-height:1.6;white-space:pre-line">' . htmlspecialchars($sigText) . '</div>';
                }
                if ($sigImg) {
                    $sigBlock .= '<img src="' . htmlspecialchars($sigImg) . '" style="max-height:80px;max-width:300px;object-fit:contain;margin-top:12px;display:block">';
                }
                $sigBlock .= '</div>';
            }
            $html = Mailer::htmlWrap(nl2br(htmlspecialchars($msgBody)) . $sigBlock, $settings['smtp_name'] ?? 'Property CRM');

            // Handle file attachments
            $attachments = [];
            if (!empty($_FILES['attachments'])) {
                $files = $_FILES['attachments'];
                // Normalize single/multiple file upload
                $count = is_array($files['name']) ? count($files['name']) : 1;
                for ($fi = 0; $fi < $count; $fi++) {
                    $tmpPath = is_array($files['tmp_name']) ? $files['tmp_name'][$fi] : $files['tmp_name'];
                    $origName = is_array($files['name']) ? $files['name'][$fi] : $files['name'];
                    if ($tmpPath && is_uploaded_file($tmpPath)) {
                        $attachments[] = ['path' => $tmpPath, 'name' => $origName];
                    }
                }
            }

            if (!empty($attachments)) {
                // Send with multiple attachments using PHPMailer directly
                require_once __DIR__ . '/../../vendor/phpmailer/src/Exception.php';
                require_once __DIR__ . '/../../vendor/phpmailer/src/PHPMailer.php';
                require_once __DIR__ . '/../../vendor/phpmailer/src/SMTP.php';
                $mail = new PHPMailer\PHPMailer\PHPMailer(true);
                try {
                    $mail->CharSet = 'UTF-8';
                    $mail->isSMTP();
                    $mail->Host       = $settings['smtp_host'] ?? '';
                    $mail->SMTPAuth   = true;
                    $mail->Username   = $settings['smtp_user'] ?? '';
                    $mail->Password   = !empty($settings['smtp_pass']) ? \Crypto::decrypt($settings['smtp_pass']) : '';
                    $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                    $mail->Port       = (int)($settings['smtp_port'] ?? 587);
                    $mail->setFrom($settings['smtp_from'] ?? $settings['smtp_user'], $settings['smtp_name'] ?? 'Property CRM');
                    if (!empty($settings['agent_name']) && !empty($settings['agent_email'])) {
                        $mail->FromName = $settings['agent_name'] . ' via ' . ($settings['smtp_name'] ?? 'Property CRM');
                        $mail->addReplyTo($settings['agent_email'], $settings['agent_name']);
                    }
                    $mail->addAddress($to);
                    $mail->isHTML(true);
                    $mail->Subject = $subject;
                    $mail->Body    = $html;
                    $mail->AltBody = strip_tags($html);
                    foreach ($attachments as $att) {
                        $mail->addAttachment($att['path'], $att['name']);
                    }
                    $mail->send();
                    $sent = true;
                } catch (Exception $e) {
                    error_log('Mailer error: ' . $e->getMessage());
                    $sent = false;
                }
            } else {
                $sent = Mailer::send($settings, $to, $to, $subject, $html);
            }
            if ($sent) {
                // Log the email
                $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : null;
                DB::execute(
                    'INSERT INTO email_log (tenant_id, contact_id, user_id, to_email, subject, body)
                     VALUES (?,?,?,?,?,?)',
                    [$tenantId, $contactId, $userId, $to, $subject, $msgBody]
                );
                Response::success(null, 'Email sent');
            } else Response::error('Failed to send — check SMTP settings');
        }
        if ($action === 'mark_all_read') {
            DB::execute(
                'UPDATE notifications SET is_read = 1
                  WHERE tenant_id = ? AND (user_id = ? OR user_id IS NULL)',
                [$tenantId, $userId]
            );
            Response::success(null, 'All marked as read');
        }

        if ($action === 'create') {
            DB::execute(
                'INSERT INTO notifications
                 (tenant_id, user_id, type, message, entity_type, entity_id, is_read)
                 VALUES (?,?,?,?,?,?,0)',
                [
                    $tenantId,
                    $body['assigned_to'] ?? null,
                    $body['type'] ?? 'info',
                    ($body['title'] ?? '') . ($body['body'] ? ': ' . $body['body'] : ''),
                    $body['entity_type'] ?? null,
                    $body['entity_id'] ?? null,
                ]
            );
            Response::success(null, 'Notification created');
        }

        Response::error('Unknown action');
        break;

    case 'PUT':
        if (!$id) Response::error('ID required');
        DB::execute(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );
        Response::success(null, 'Marked as read');
        break;

    default:
        Response::error('Method not allowed', 405);
}
