<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
if ($user['role'] !== 'platform_superadmin') Response::error('Unauthorised', 403);

$id = (int)($_GET['id'] ?? 0);
if (!$id) Response::error('Invoice ID required');

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

$data = json_encode([
    'invoice'  => $inv,
    'lines'    => $lines,
    'settings' => $settings,
]);

$tmpOut = tempnam(sys_get_temp_dir(), 'hinv_') . '.pdf';
$script = __DIR__ . '/platform-invoices-pdf.py';
$cmd    = 'python3 ' . escapeshellarg($script) . ' ' . escapeshellarg($data) . ' ' . escapeshellarg($tmpOut) . ' 2>&1';
$result = shell_exec($cmd);

if (!file_exists($tmpOut) || filesize($tmpOut) === 0) {
    Response::error('PDF generation failed: ' . $result);
}

$ref = $inv['ref'] ?? 'invoice';
header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="' . $ref . '.pdf"');
header('Content-Length: ' . filesize($tmpOut));
readfile($tmpOut);
unlink($tmpOut);
exit;
