<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/mailer.php';
require_once __DIR__ . '/../../includes/crypto.php';
require_once __DIR__ . '/../../includes/ics.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = (int)$user['tenant_id'];
$userId   = (int)($user['user_id'] ?? $user['id']);
$method   = $_SERVER['REQUEST_METHOD'];
$body     = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'POST':
        $contactId = (int)($body['contact_id'] ?? 0);
        $remindAt  = trim($body['remind_at'] ?? '');
        $note      = trim($body['note'] ?? '');
        $type      = trim($body['type'] ?? 'Call');
        if (!$contactId) Response::error('contact_id required');
        if (!$remindAt)  Response::error('remind_at required');
        $newId = DB::insert(
            'INSERT INTO contact_reminders (tenant_id, contact_id, user_id, remind_at, note, type, is_sent) VALUES (?,?,?,?,?,?,0)',
            [$tenantId, $contactId, $userId, $remindAt, $note, $type]
        );
        // Get contact details for notification and calendar invite
        $contact = DB::queryOne('SELECT name, email FROM contacts WHERE id = ?', [$contactId]);
        $contactName  = $contact['name']  ?? 'Contact #' . $contactId;
        $contactEmail = $contact['email'] ?? '';

        // Send calendar invite to contact if they have an email
        if ($contactEmail) {
            $settings = Mailer::getEffectiveSettings($tenantId, $userId ?? null);
            if (!empty($settings['smtp_host'])) {
                $agentUser = DB::queryOne('SELECT name, email FROM users WHERE id = ?', [$userId]);
                $agentName  = $agentUser['name']  ?? 'Your Agent';
                $agentEmail = $agentUser['email'] ?? ($settings['smtp_from'] ?? '');

                $icsContent = ICS::generate(
                    'contact-reminder-' . $newId . '@hulisa.co.za',
                    $type . ' with ' . ($settings['smtp_name'] ?? 'Property Management'),
                    'You have a scheduled ' . $type . ' with ' . ($settings['smtp_name'] ?? 'your property agent') . ($note ? '. Note: ' . $note : ''),
                    $remindAt,
                    30,
                    $agentEmail,
                    $agentName,
                    $contactEmail,
                    $contactName
                );
                $icsPath = ICS::saveTemp($icsContent);

                $emailBody = Mailer::htmlWrap("
                    <h3 style='margin:0 0 16px'>Scheduled " . htmlspecialchars($type) . "</h3>
                    <p>Dear " . htmlspecialchars($contactName) . ",</p>
                    <p>This is to confirm a scheduled <strong>" . htmlspecialchars($type) . "</strong> with " . htmlspecialchars($settings['smtp_name'] ?? 'your property agent') . ".</p>
                    <table style='width:100%;border-collapse:collapse;margin:16px 0'>
                        <tr><td style='padding:8px;background:#f8f8f8;font-weight:600;width:30%'>Date & Time</td><td style='padding:8px'>" . date('d M Y H:i', strtotime($remindAt)) . "</td></tr>
                        <tr><td style='padding:8px;background:#f8f8f8;font-weight:600'>Type</td><td style='padding:8px'>" . htmlspecialchars($type) . "</td></tr>
                        " . ($note ? "<tr><td style='padding:8px;background:#f8f8f8;font-weight:600'>Note</td><td style='padding:8px'>" . htmlspecialchars($note) . "</td></tr>" : '') . "
                    </table>
                    <p>A calendar invite is attached. You can accept, decline, or propose a new time.</p>
                ", $settings['smtp_name'] ?? 'Property CRM');

                Mailer::send(
                    $settings,
                    $contactEmail,
                    $contactName,
                    'Scheduled ' . $type . ' — ' . ($settings['smtp_name'] ?? 'Property Management'),
                    $emailBody,
                    $icsPath,
                    'appointment.ics'
                );
                if (file_exists($icsPath)) unlink($icsPath);
            }
        }
        DB::execute(
            'INSERT INTO notifications (tenant_id, user_id, type, message, entity_type, entity_id, is_read)
             VALUES (?,?,?,?,?,?,0)',
            [$tenantId, $userId, 'reminder', $type . ' reminder set for ' . $contactName . ' at ' . $remindAt, 'contact', $contactId]
        );
        Response::success(['id' => $newId], 'Reminder scheduled');
        break;
    case 'GET':
        $rows = DB::query(
            'SELECT r.*, c.name as contact_name FROM contact_reminders r LEFT JOIN contacts c ON c.id = r.contact_id WHERE r.tenant_id = ? AND r.user_id = ? AND r.is_sent = 0 ORDER BY r.remind_at ASC',
            [$tenantId, $userId]
        );
        Response::success($rows);
        break;
    default:
        Response::error('Method not allowed', 405);
}
