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
$body     = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        $rows = DB::query('SELECT * FROM invoice_customers WHERE tenant_id = ? ORDER BY name', [$tenantId]);
        Response::success($rows);
        break;
    case 'POST':
        if (!($body['name'] ?? '')) Response::error('Name required');
        $newId = DB::insert(
            'INSERT INTO invoice_customers (tenant_id, type, name, email, phone, address, id_number, unit) VALUES (?,?,?,?,?,?,?,?)',
            [$tenantId, $body['type']??'Tenant', $body['name'], $body['email']??null, $body['phone']??null, $body['address']??null, $body['id_number']??null, $body['unit']??null]
        );
        Response::success(DB::queryOne('SELECT * FROM invoice_customers WHERE id=?',[$newId]), 'Customer created');
        break;
    case 'PUT':
        if (!$id) Response::error('ID required');
        DB::execute('UPDATE invoice_customers SET type=?,name=?,email=?,phone=?,address=?,id_number=?,unit=? WHERE id=? AND tenant_id=?',
            [$body['type']??'Tenant',$body['name'],$body['email']??null,$body['phone']??null,$body['address']??null,$body['id_number']??null,$body['unit']??null,$id,$tenantId]);
        Response::success(null, 'Customer updated');
        break;
    case 'DELETE':
        if (!$id) Response::error('ID required');
        DB::execute('DELETE FROM invoice_customers WHERE id=? AND tenant_id=?', [$id,$tenantId]);
        Response::success(null, 'Customer deleted');
        break;
}
