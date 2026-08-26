<?php
require_once __DIR__ . '/../vendor/phpmailer/src/Exception.php';
require_once __DIR__ . '/../vendor/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/../vendor/phpmailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class Mailer {
    public static function send(array $settings, string $to, string $toName, string $subject, string $body, ?string $attachPath = null, ?string $attachName = null): bool {
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host       = $settings['smtp_host'] ?? 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = $settings['smtp_user'] ?? '';
            $mail->Password   = $settings['smtp_pass'] ?? '';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = (int)($settings['smtp_port'] ?? 587);
            $mail->setFrom($settings['smtp_from'] ?? $settings['smtp_user'], $settings['smtp_name'] ?? 'Property CRM');
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

    public static function htmlWrap(string $content, string $companyName = 'Property CRM', string $logoUrl = ''): string {
        $logoHtml = $logoUrl ? "<img src='{$logoUrl}' style='max-height:50px;max-width:160px;display:block' alt='{$companyName}'><br>" : '';
        return "<!DOCTYPE html>
<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>
<body style='font-family:Arial,sans-serif;color:#111;background:#f0f2f5;margin:0;padding:20px'>
  <div style='max-width:600px;margin:0 auto'>
    <div style='background:#0A1A3B;padding:24px 32px;border-radius:8px 8px 0 0'>
      {$logoHtml}
      <div style='color:#fff;font-size:20px;font-weight:700'>{$companyName}</div>
      <div style='color:#1DB8A0;font-size:12px;margin-top:4px'>Property Management</div>
    </div>
    <div style='background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none'>
      {$content}
    </div>
    <div style='background:#f8f8f8;padding:16px 32px;font-size:12px;color:#888;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;text-align:center'>
      This email was sent by {$companyName} · Powered by Hulisa CRM
    </div>
  </div>
</body></html>";
    }
}
