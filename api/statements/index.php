<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
$tenantId = (int)$user['tenant_id'];
$leaseId  = isset($_GET['lease_id']) ? (int)$_GET['lease_id'] : null;
$type     = $_GET['type'] ?? 'landlord'; // 'landlord' or 'debtor'

if (!$leaseId) Response::error('lease_id required');

$lease = DB::queryOne(
    'SELECT l.*, c.name AS tenant_contact_name, c.phone AS tenant_phone, c.email AS tenant_email
       FROM leases l
  LEFT JOIN contacts c ON c.id = l.contact_id
      WHERE l.id = ? AND l.tenant_id = ?',
    [$leaseId, $tenantId]
);
if (!$lease) Response::notFound('Lease not found');

$invoices = DB::query(
    'SELECT * FROM invoices WHERE lease_id = ? AND tenant_id = ? ORDER BY due_date DESC',
    [$leaseId, $tenantId]
);

$settings = [];
$rows = DB::query('SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?', [$tenantId]);
foreach ($rows as $r) $settings[$r['setting_key']] = $r['setting_value'];

$data = json_encode([
    'type'           => $type,
    'lease'          => $lease,
    'invoices'       => $invoices,
    'settings'       => $settings,
    'tenant_contact' => [
        'name'  => $lease['tenant_name'] ?? $lease['tenant_contact_name'] ?? '—',
        'phone' => $lease['tenant_phone'] ?? '',
        'email' => $lease['tenant_email'] ?? '',
    ],
    'landlord' => [
        'name'  => $lease['landlord_name'] ?? '—',
        'phone' => '',
        'email' => '',
    ],
]);

$escaped = escapeshellarg($data);
$script  = __DIR__ . '/generate_statement.py';
$output  = tempnam(sys_get_temp_dir(), 'stmt_') . '.pdf';
$outEsc  = escapeshellarg($output);

$result = shell_exec("python3 $script $escaped $outEsc 2>&1");

if (!file_exists($output) || filesize($output) === 0) {
    Response::error('Statement generation failed: ' . $result, 500);
}

$filename = ($type === 'landlord' ? 'Landlord' : 'Debtor') . '_Statement_' . $lease['ref'] . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="' . $filename . '"');
header('Content-Length: ' . filesize($output));
readfile($output);
unlink($output);
exit;
