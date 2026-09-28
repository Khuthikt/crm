<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        if ($id) {
            $row = DB::queryOne('SELECT * FROM knowledge_base WHERE id = ?', [$id]);
            if (!$row) Response::notFound('Item not found');
            Response::success($row);
        }
        $module = $_GET['module'] ?? '';
        $where  = 'is_active = 1';
        $params = [];
        if ($module) { $where .= ' AND module = ?'; $params[] = $module; }
        $rows = DB::query(
            "SELECT * FROM knowledge_base WHERE {$where} ORDER BY module ASC, sort_order ASC, title ASC",
            $params
        );
        Response::success($rows);
        break;
    case 'POST':
        if ($user['role'] !== 'platform_superadmin') Response::error('Unauthorised', 403);
        $newId = DB::insert(
            'INSERT INTO knowledge_base (title, description, type, url, module, sort_order) VALUES (?,?,?,?,?,?)',
            [trim($body['title']??''), trim($body['description']??''), $body['type']??'link', trim($body['url']??''), trim($body['module']??'General'), (int)($body['sort_order']??0)]
        );
        Response::success(['id' => $newId], 'Item added');
        break;
    case 'PUT':
        if ($user['role'] !== 'platform_superadmin') Response::error('Unauthorised', 403);
        if (!$id) Response::error('ID required');
        DB::execute(
            'UPDATE knowledge_base SET title=?, description=?, type=?, url=?, module=?, sort_order=?, is_active=? WHERE id=?',
            [trim($body['title']??''), trim($body['description']??''), $body['type']??'link', trim($body['url']??''), trim($body['module']??'General'), (int)($body['sort_order']??0), (int)($body['is_active']??1), $id]
        );
        Response::success(null, 'Item updated');
        break;
    case 'DELETE':
        if ($user['role'] !== 'platform_superadmin') Response::error('Unauthorised', 403);
        if (!$id) Response::error('ID required');
        DB::execute('DELETE FROM knowledge_base WHERE id = ?', [$id]);
        Response::success(null, 'Item deleted');
        break;
    default:
        Response::error('Method not allowed', 405);
}
