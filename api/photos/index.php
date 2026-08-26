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
$listingId = isset($_GET['listing_id']) ? (int)$_GET['listing_id'] : null;

switch ($method) {
    case 'GET':
        if (!$listingId) Response::error('listing_id required');
        $photos = DB::query(
            'SELECT * FROM listing_photos WHERE listing_id = ? AND tenant_id = ? ORDER BY is_primary DESC, sort_order ASC, created_at ASC',
            [$listingId, $tenantId]
        );
        Response::success($photos);
        break;

    case 'PUT':
        // Set as primary or update sort order
        if (!$id) Response::error('Photo ID required');
        $body = json_decode(file_get_contents('php://input'), true);
        if (isset($body['sort_order'])) {
            DB::execute('UPDATE listing_photos SET sort_order = ? WHERE id = ? AND tenant_id = ?', 
                [(int)$body['sort_order'], $id, $tenantId]);
            Response::success(null, 'Sort order updated');
        }
        if (isset($body['is_primary']) && $body['is_primary']) {
            // Get listing_id first
            $photo = DB::queryOne('SELECT * FROM listing_photos WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
            if (!$photo) Response::notFound();
            DB::execute('UPDATE listing_photos SET is_primary = 0 WHERE listing_id = ? AND tenant_id = ?', [$photo['listing_id'], $tenantId]);
            DB::execute('UPDATE listing_photos SET is_primary = 1 WHERE id = ?', [$id]);
            DB::execute('UPDATE listings SET primary_photo = ? WHERE id = ?', [$photo['file_url'], $photo['listing_id']]);
        }
        Response::success(null, 'Photo updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('Photo ID required');
        $photo = DB::queryOne('SELECT * FROM listing_photos WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$photo) Response::notFound();
        // Delete file
        $filePath = str_replace(UPLOAD_URL, UPLOAD_PATH, $photo['file_url']);
        if (file_exists($filePath)) unlink($filePath);
        DB::execute('DELETE FROM listing_photos WHERE id = ?', [$id]);
        // If was primary, set next photo as primary
        if ($photo['is_primary']) {
            $next = DB::queryOne('SELECT * FROM listing_photos WHERE listing_id = ? AND tenant_id = ? LIMIT 1', [$photo['listing_id'], $tenantId]);
            if ($next) {
                DB::execute('UPDATE listing_photos SET is_primary = 1 WHERE id = ?', [$next['id']]);
                DB::execute('UPDATE listings SET primary_photo = ? WHERE id = ?', [$next['file_url'], $photo['listing_id']]);
            } else {
                DB::execute('UPDATE listings SET primary_photo = NULL WHERE id = ?', [$photo['listing_id']]);
            }
        }
        Response::success(null, 'Photo deleted');
        break;
}
