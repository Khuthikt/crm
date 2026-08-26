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
    case 'GET':
        $rows = DB::query(
            'SELECT * FROM products WHERE tenant_id = ? ORDER BY name ASC',
            [$tenantId]
        );
        Response::success($rows);
        break;

    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);
        $name = trim($body['name'] ?? '');
        if (!$name) Response::error('Product name is required');
        $newId = DB::insert(
            'INSERT INTO products (tenant_id, name, description, price, is_active) VALUES (?,?,?,?,?)',
            [$tenantId, $name, $body['description'] ?? null,
             (float)($body['price'] ?? 0), (int)($body['is_active'] ?? 1)]
        );
        Response::success(DB::queryOne('SELECT * FROM products WHERE id = ?', [$newId]), 'Product created');
        break;

    case 'PUT':
        if (!$id) Response::error('Product ID required');
        $body = json_decode(file_get_contents('php://input'), true);
        $p = DB::queryOne('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$p) Response::notFound();
        DB::execute(
            'UPDATE products SET name=?, description=?, price=?, is_active=? WHERE id=? AND tenant_id=?',
            [
                $body['name'] ?? $p['name'],
                $body['description'] ?? $p['description'],
                (float)($body['price'] ?? $p['price']),
                (int)($body['is_active'] ?? $p['is_active']),
                $id, $tenantId
            ]
        );
        Response::success(null, 'Product updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('Product ID required');
        DB::execute('DELETE FROM products WHERE id=? AND tenant_id=?', [$id, $tenantId]);
        Response::success(null, 'Product deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
