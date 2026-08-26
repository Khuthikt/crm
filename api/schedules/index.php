<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
$tenantId = (int)$user['tenant_id'];
$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;
$leaseId  = isset($_GET['lease_id']) ? (int)$_GET['lease_id'] : null;
$body     = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        $where  = 'tenant_id = ?';
        $params = [$tenantId];
        if ($leaseId) { $where .= ' AND lease_id = ?'; $params[] = $leaseId; }
        $rows = DB::query(
            "SELECT s.* FROM invoice_schedules s WHERE $where ORDER BY s.created_at DESC",
            $params
        );
        // Add lease ref to each row
        foreach ($rows as &$row) {
            $lease = DB::queryOne('SELECT ref, tenant_name FROM leases WHERE id = ?', [$row['lease_id']]);
            $row['lease_ref']    = $lease['ref'] ?? '—';
            $row['lease_tenant'] = $lease['tenant_name'] ?? '—';
        }
        Response::success($rows);
        break;

    case 'POST':
        if (!($body['lease_id'] ?? null)) Response::error('lease_id required');
        if (!($body['amount'] ?? null)) Response::error('amount required');
        $newId = DB::insert(
            'INSERT INTO invoice_schedules (tenant_id, lease_id, invoice_type, description, amount, vat_applied, day_of_month, start_date, end_date, is_active, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,1,?)',
            [
                $tenantId,
                (int)$body['lease_id'],
                $body['invoice_type'] ?? 'Monthly Rental',
                $body['description'] ?? null,
                (float)$body['amount'],
                (int)($body['vat_applied'] ?? 0),
                (int)($body['day_of_month'] ?? 1),
                $body['start_date'],
                ($body['end_date'] ?? '') ?: null,
                $user['user_id'] ?? $user['id'],
            ]
        );
        Response::success(DB::queryOne('SELECT * FROM invoice_schedules WHERE id = ?', [$newId]), 'Schedule created');
        break;

    case 'PUT':
        if (!$id) Response::error('ID required');
        $fields = []; $params = [];
        if (isset($body['is_active']))    { $fields[] = 'is_active = ?';    $params[] = (int)$body['is_active']; }
        if (isset($body['amount']))       { $fields[] = 'amount = ?';       $params[] = (float)$body['amount']; }
        if (isset($body['day_of_month'])) { $fields[] = 'day_of_month = ?'; $params[] = (int)$body['day_of_month']; }
        if (isset($body['end_date']))     { $fields[] = 'end_date = ?';     $params[] = $body['end_date'] ?: null; }
        if (!$fields) Response::error('Nothing to update');
        $params[] = $id; $params[] = $tenantId;
        DB::execute('UPDATE invoice_schedules SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?', $params);
        Response::success(null, 'Schedule updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('ID required');
        DB::execute('DELETE FROM invoice_schedules WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(null, 'Schedule deleted');
        break;
}
