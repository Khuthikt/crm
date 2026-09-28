<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/mailer.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
if ($user['role'] !== 'platform_superadmin') Response::error('Unauthorised', 403);

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$id   = (int)($body['invoice_id'] ?? 0);
$to   = trim($body['to'] ?? '');

if (!$id || !$to) Response::error('Invoice ID and recipient email required');

$inv = DB::queryOne(
    'SELECT pi.*, t.name AS tenant_name, t.billing_email, t.billing_contact
       FROM platform_invoices pi
       JOIN tenants t ON t.id = pi.tenant_id
      WHERE pi.id = ?', [$id]
);
if (!$inv) Response::notFound('Invoice not found');

$lines = DB::query('SELECT * FROM platform_invoice_lines WHERE invoice_id = ? ORDER BY id', [$id]);

// Get platform settings
$rows = DB::query('SELECT setting_key, setting_value FROM platform_settings');
$settings = [];
foreach ($rows as $r) $settings[$r['setting_key']] = $r['setting_value'];

// Generate PDF
$data   = json_encode(['invoice' => $inv, 'lines' => $lines, 'settings' => $settings]);
$tmpOut = tempnam(sys_get_temp_dir(), 'hinv_') . '.pdf';
$script = __DIR__ . '/platform-invoices-pdf.py';
shell_exec('python3 ' . escapeshellarg($script) . ' ' . escapeshellarg($data) . ' ' . escapeshellarg($tmpOut) . ' 2>&1');

if (!file_exists($tmpOut) || filesize($tmpOut) === 0) {
    Response::error('PDF generation failed');
}

$companyName = $settings['hulisa_company_name'] ?? 'Hulisa Business Solutions';
$primary     = $settings['hulisa_primary_colour'] ?? '#0A1A3B';
$accent      = $settings['hulisa_accent_colour'] ?? '#1DB8A0';
$signature   = $settings['hulisa_email_signature'] ?? 'Kind regards,<br>Hulisa Business Solutions';

$emailBody = "
<p>Dear {$inv['billing_contact']} {$inv['tenant_name']},</p>
<p>Please find attached invoice <strong>{$inv['ref']}</strong> for services rendered.</p>
<table style='width:100%;border-collapse:collapse;margin:16px 0'>
  <tr style='background:{$primary};color:#fff'>
    <td style='padding:8px 12px;font-weight:600'>Invoice</td>
    <td style='padding:8px 12px;font-weight:600'>Amount Due</td>
    <td style='padding:8px 12px;font-weight:600'>Due Date</td>
  </tr>
  <tr style='background:#f9f9f9'>
    <td style='padding:8px 12px'>{$inv['ref']}</td>
    <td style='padding:8px 12px;font-weight:600;color:{$accent}'>R " . number_format($inv['total'], 2) . "</td>
    <td style='padding:8px 12px'>{$inv['due_date']}</td>
  </tr>
</table>";

if (!empty($settings['hulisa_bank_name'])) {
    $emailBody .= "
<p><strong>Payment Details:</strong><br>
Bank: {$settings['hulisa_bank_name']}<br>
Account: {$settings['hulisa_bank_account']}<br>
Branch: {$settings['hulisa_bank_branch']}<br>
Reference: <strong>{$inv['ref']}</strong></p>";
}

$emailBody .= "<p>{$signature}</p>";

$html = Mailer::htmlWrap($emailBody, $companyName, $settings['hulisa_logo_url'] ?? '', $primary, $accent);

$sent = Mailer::send(
    $settings,
    $to,
    $inv['billing_contact'] ?? $inv['tenant_name'],
    "Invoice {$inv['ref']} from {$companyName}",
    $html,
    $tmpOut,
    $inv['ref'] . '.pdf'
);

unlink($tmpOut);

if ($sent) {
    Response::success(null, 'Invoice emailed to ' . $to);
} else {
    Response::error('Failed to send email');
}
