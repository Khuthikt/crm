<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/mailer.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
$tenantId = (int)$user['tenant_id'];
$body     = json_decode(file_get_contents('php://input'), true);
$invoiceId = (int)($body['invoice_id'] ?? 0);
$to        = trim($body['to'] ?? '');

if (!$invoiceId || !$to) Response::error('invoice_id and to are required');
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) Response::error('Invalid email address');

$inv   = DB::queryOne('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?', [$invoiceId, $tenantId]);
if (!$inv) Response::notFound('Invoice not found');

$lines   = DB::query('SELECT * FROM invoice_lines WHERE invoice_id = ?', [$invoiceId]);
$settings = Mailer::getEffectiveSettings($tenantId, $userId ?? null);
$banks    = json_decode($settings['bank_accounts'] ?? '[]', true) ?: [];
$compName = $settings['company_name'] ?? 'Property Management';

// Generate PDF
$data    = json_encode(['invoice'=>$inv,'lines'=>$lines,'settings'=>$settings,'banks'=>$banks]);
$escaped = escapeshellarg($data);
$pdfPath = tempnam(sys_get_temp_dir(), 'inv_') . '.pdf';
$pdfEsc  = escapeshellarg($pdfPath);
$script  = __DIR__ . '/generate_pdf.py';
shell_exec("python3 $script $escaped $pdfEsc 2>&1");

if (!file_exists($pdfPath)) Response::error('Failed to generate PDF');

// Build email
$toName  = $inv['tenant_name'] ?? 'Valued Client';
$subject = "Invoice {$inv['ref']} from {$compName}";
$content = "
<h2>Invoice {$inv['ref']}</h2>
<p>Dear {$toName},</p>
<p>Please find your invoice attached. Here is a summary:</p>
<table style='width:100%;border-collapse:collapse;margin:16px 0'>
  <tr style='background:#f5f5f5'><td style='padding:8px;border:1px solid #eee'><strong>Invoice Ref</strong></td><td style='padding:8px;border:1px solid #eee'>{$inv['ref']}</td></tr>
  <tr><td style='padding:8px;border:1px solid #eee'><strong>Amount Due</strong></td><td style='padding:8px;border:1px solid #eee;font-size:18px;color:#1DB8A0'><strong>R " . number_format($inv['total'], 2) . "</strong></td></tr>
  <tr style='background:#f5f5f5'><td style='padding:8px;border:1px solid #eee'><strong>Due Date</strong></td><td style='padding:8px;border:1px solid #eee'>{$inv['due_date']}</td></tr>
</table>";

if (!empty($banks)) {
    $b = $banks[0];
    $content .= "<h3>Payment Details</h3>
    <p>Bank: <strong>{$b['bank_name']}</strong><br>
    Account: <strong>{$b['bank_account']}</strong><br>
    Reference: <strong>{$inv['ref']}</strong></p>";
}
$content .= "<p>Thank you for your business.</p>";

// Add signature
$sigText = !empty($settings['email_signature']) ? $settings['email_signature'] : '';
$sigImg  = !empty($settings['email_signature_img']) ? $settings['email_signature_img'] : '';
if ($sigText || $sigImg) {
    $content .= '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb">';
    if ($sigText) $content .= '<div style="font-size:13px;color:#444;line-height:1.6;white-space:pre-line">' . htmlspecialchars($sigText) . '</div>';
    if ($sigImg)  $content .= '<img src="' . htmlspecialchars($sigImg) . '" style="max-height:80px;max-width:300px;object-fit:contain;margin-top:12px;display:block">';
    $content .= '</div>';
} else {
    $content .= "<p>Regards,<br><strong>{$compName}</strong></p>";
}

$logoUrl = $settings['logo_url'] ?? '';
$html = Mailer::htmlWrap($content, $compName, $logoUrl);
$sent = Mailer::send($settings, $to, $toName, $subject, $html, $pdfPath, "Invoice-{$inv['ref']}.pdf");

unlink($pdfPath);

if ($sent) {
    // Track email sent
    DB::execute(
        'UPDATE invoices SET emailed_at = NOW(), emailed_to = ? WHERE id = ?',
        [$to, $invoiceId]
    );
    Response::success(null, 'Invoice emailed to ' . $to);
} else {
    Response::error('Failed to send email. Check SMTP settings in Settings.');
}
