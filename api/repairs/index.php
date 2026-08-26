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

switch ($method) {
    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);
        if (!($body['lease_id'] ?? null) || !($body['description'] ?? null))
            Response::error('lease_id and description required');
        $newId = DB::insert(
            'INSERT INTO lease_repairs (tenant_id, lease_id, description, cost, repair_date, status, notes, created_by)
             VALUES (?,?,?,?,?,?,?,?)',
            [
                $tenantId,
                (int)$body['lease_id'],
                $body['description'],
                (float)($body['cost'] ?? 0),
                ($body['repair_date'] ?? '') ?: null,
                $body['status'] ?? 'pending',
                $body['notes'] ?? null,
                $user['user_id'] ?? $user['id'] ?? null,
            ]
        );
        Response::success(DB::queryOne('SELECT * FROM lease_repairs WHERE id = ?', [$newId]), 'Repair logged');
        break;

    case 'PUT':
        if (!$id) Response::error('Repair ID required');
        $body = json_decode(file_get_contents('php://input'), true);
        $r = DB::queryOne('SELECT * FROM lease_repairs WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$r) Response::notFound();
        DB::execute(
            'UPDATE lease_repairs SET description=?, cost=?, repair_date=?, status=?, notes=? WHERE id=? AND tenant_id=?',
            [
                $body['description'] ?? $r['description'],
                (float)($body['cost'] ?? $r['cost']),
                ($body['repair_date'] ?? '') ?: $r['repair_date'],
                $body['status'] ?? $r['status'],
                $body['notes'] ?? $r['notes'],
                $id, $tenantId
            ]
        );
        Response::success(null, 'Repair updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('Repair ID required');
        DB::execute('DELETE FROM lease_repairs WHERE id=? AND tenant_id=?', [$id, $tenantId]);
        Response::success(null, 'Repair deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
