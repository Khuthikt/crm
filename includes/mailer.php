<?php
require_once __DIR__ . '/../vendor/phpmailer/src/Exception.php';
require_once __DIR__ . '/../vendor/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/../vendor/phpmailer/src/SMTP.php';
require_once __DIR__ . '/crypto.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class Mailer {
    public static function send(array $settings, string $to, string $toName, string $subject, string $body, ?string $attachPath = null, ?string $attachName = null): bool {
        $mail = new PHPMailer(true);
        try {
            $mail->CharSet = 'UTF-8';
        $mail->Encoding = 'base64';
        $mail->isSMTP();
            $mail->Host       = $settings['smtp_host'] ?? 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = $settings['smtp_user'] ?? '';
            $mail->Password   = isset($settings['smtp_pass']) && !empty($settings['smtp_pass']) ? Crypto::decrypt($settings['smtp_pass']) : '';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = (int)($settings['smtp_port'] ?? 587);
            $mail->setFrom($settings['smtp_from'] ?? $settings['smtp_user'], $settings['smtp_name'] ?? 'Property CRM');
            // Set agent name in From and Reply-To if provided
            if (!empty($settings['agent_name']) && !empty($settings['agent_email'])) {
                $mail->FromName = $settings['agent_name'] . ' via ' . ($settings['smtp_name'] ?? 'Property CRM');
                $mail->addReplyTo($settings['agent_email'], $settings['agent_name']);
            }
            $mail->addAddress($to, $toName);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $body;
            $mail->AltBody = strip_tags($body);
            if ($attachPath && file_exists($attachPath)) {
                $mail->addAttachment($attachPath, $attachName ?: basename($attachPath));
            }
            $mail->send();
            return true;
        } catch (Exception $e) {
            error_log('Mailer error: ' . $e->getMessage());
            return false;
        }
    }

    public static function getSettings(int $tenantId): array {
        $rows = \DB::query('SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?', [$tenantId]);
        $s = [];
        foreach ($rows as $r) $s[$r['setting_key']] = $r['setting_value'];
        return $s;
    }

    /**
     * Get effective SMTP settings for a user.
     * Uses user's own SMTP if configured, falls back to tenant SMTP.
     */
    public static function getEffectiveSettings(int $tenantId, ?int $userId = null): array {
        // Get tenant settings as base
        $settings = self::getSettings($tenantId);

        if (!$userId) return $settings;

        // Get user's own SMTP settings
        $user = \DB::queryOne(
            'SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_encryption, smtp_from_name, email_signature, email_signature_img, name, email
             FROM users WHERE id = ? AND tenant_id = ?',
            [$userId, $tenantId]
        );

        if (!$user) return $settings;

        // Override signature with user's own if set
        if (!empty($user['email_signature'])) {
            $settings['email_signature'] = $user['email_signature'];
        }
        if (!empty($user['email_signature_img'])) {
            $settings['email_signature_img'] = $user['email_signature_img'];
        }

        // Set agent name and email for Reply-To
        $settings['agent_name']  = $user['smtp_from_name'] ?: $user['name'];
        $settings['agent_email'] = $user['email'];

        if (empty($user['smtp_host']) || empty($user['smtp_user'])) {
            return $settings; // No user SMTP — use tenant but with user signature
        }

        // Override with user's SMTP
        $settings['smtp_host'] = $user['smtp_host'];
        $settings['smtp_port'] = $user['smtp_port'] ?? 587;
        $settings['smtp_user'] = $user['smtp_user'];
        $settings['smtp_pass'] = $user['smtp_pass'] ?? '';
        $settings['smtp_from'] = $user['smtp_user'];
        $settings['smtp_name'] = $user['smtp_from_name'] ?: $user['name'];
        if (!empty($user['smtp_encryption'])) {
            $settings['smtp_encryption'] = $user['smtp_encryption'];
        }

        return $settings;
    }

    public static function htmlWrap(string $content, string $companyName = 'Property CRM', string $logoUrl = ''): string {
        return "<!DOCTYPE html>
<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>
<body style='font-family:Arial,sans-serif;font-size:14px;color:#111;margin:0;padding:0'>
  <div style='max-width:600px;margin:0 auto;padding:32px 24px'>
    {$content}
  </div>
</body></html>";
    }
}
