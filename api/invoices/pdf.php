<?php
error_reporting(0);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = (int)$user['tenant_id'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;
if (!$id) Response::error('Invoice ID required');

// Get invoice
$inv = DB::queryOne(
    'SELECT i.*, l.ref AS lease_ref, l.property, l.unit,
            c.name AS tenant_contact_name, c.email AS tenant_email, c.phone AS tenant_phone
       FROM invoices i
  LEFT JOIN leases l  ON l.id = i.lease_id
  LEFT JOIN contacts c ON c.id = i.contact_id
      WHERE i.id = ? AND i.tenant_id = ?',
    [$id, $tenantId]
);
if (!$inv) Response::notFound('Invoice not found');

// Get line items
$lines = DB::query('SELECT * FROM invoice_lines WHERE invoice_id = ?', [$id]);

// Get tenant settings
$settings = [];
$rows = DB::query('SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?', [$tenantId]);
foreach ($rows as $r) $settings[$r['setting_key']] = $r['setting_value'];

// Get bank accounts
$banks = json_decode($settings['bank_accounts'] ?? '[]', true) ?: [];

// Generate PDF via Python
$data = json_encode([
    'invoice'  => $inv,
    'lines'    => $lines,
    'settings' => $settings,
    'banks'    => $banks,
]);

$escaped = escapeshellarg($data);
$script  = __DIR__ . '/generate_pdf.py';
$output  = tempnam(sys_get_temp_dir(), 'inv_') . '.pdf';
$outEsc  = escapeshellarg($output);

$result = shell_exec("python3 $script $escaped $outEsc 2>&1");

if (!file_exists($output) || filesize($output) === 0) {
    Response::error('PDF generation failed: ' . $result, 500);
}

// Stream PDF
header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="Invoice-' . $inv['ref'] . '.pdf"');
header('Content-Length: ' . filesize($output));
readfile($output);
unlink($output);
exit;
