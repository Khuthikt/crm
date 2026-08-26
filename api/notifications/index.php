<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user     = Auth::user();
if (!$user) Response::unauthorized();
$tenantId = (int)$user['tenant_id'];
$userId   = (int)($user['user_id'] ?? $user['id'] ?? 0);
$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        // Get notifications for this user
        $rows = DB::query(
            'SELECT * FROM notifications
              WHERE tenant_id = ? AND (user_id = ? OR user_id IS NULL)
              ORDER BY created_at DESC LIMIT 50',
            [$tenantId, $userId]
        );
        Response::success($rows);
        break;

    case 'POST':
        $body   = json_decode(file_get_contents('php://input'), true);
        $action = $body['action'] ?? '';

        if ($action === 'mark_all_read') {
            DB::execute(
                'UPDATE notifications SET is_read = 1
                  WHERE tenant_id = ? AND (user_id = ? OR user_id IS NULL)',
                [$tenantId, $userId]
            );
            Response::success(null, 'All marked as read');
        }

        if ($action === 'create') {
            DB::execute(
                'INSERT INTO notifications
                 (tenant_id, user_id, type, message, entity_type, entity_id, is_read)
                 VALUES (?,?,?,?,?,?,0)',
                [
                    $tenantId,
                    $body['assigned_to'] ?? null,
                    $body['type'] ?? 'info',
                    ($body['title'] ?? '') . ($body['body'] ? ': ' . $body['body'] : ''),
                    $body['entity_type'] ?? null,
                    $body['entity_id'] ?? null,
                ]
            );
            Response::success(null, 'Notification created');
        }

        Response::error('Unknown action');
        break;

    case 'PUT':
        if (!$id) Response::error('ID required');
        DB::execute(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );
        Response::success(null, 'Marked as read');
        break;

    default:
        Response::error('Method not allowed', 405);
}
