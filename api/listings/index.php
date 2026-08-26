<?php
error_reporting(0);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = $user['tenant_id'] ? (int)$user['tenant_id'] : 0;
// Platform admin - use first tenant for testing or require tenant selection
if (!$tenantId && isset($_GET['tenant_id'])) {
    $tenantId = (int)$_GET['tenant_id'];
}
$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    case 'GET':
        if ($id) {
            $listing = DB::queryOne(
                'SELECT l.*, c.name AS owner_name, u.name AS agent_name, con.name AS linked_client_name
                   FROM listings l
              LEFT JOIN contacts c   ON c.id = l.owner_id
              LEFT JOIN users u      ON u.id = l.assigned_to
              LEFT JOIN contacts con ON con.id = l.contact_id
                  WHERE l.id = ? AND l.tenant_id = ?',
                [$id, $tenantId]
            );
            if (!$listing) Response::notFound('Listing not found');
            $listing['photos'] = DB::query(
                'SELECT * FROM listing_photos WHERE listing_id = ? ORDER BY sort_order ASC, is_primary DESC',
                [$id]
            );
            Response::success($listing);
        }
        $type   = $_GET['type']   ?? '';
        $status = $_GET['status'] ?? '';
        $search = '%' . trim($_GET['q'] ?? '') . '%';
        $minP   = $_GET['min_price'] ?? '';
        $maxP   = $_GET['max_price'] ?? '';
        $where  = 'l.tenant_id = ?';
        $params = [$tenantId];
        if ($type)   { $where .= ' AND l.listing_type = ?'; $params[] = $type; }
        if ($status) { $where .= ' AND l.status = ?';       $params[] = $status; }
        if ($minP)   { $where .= ' AND (l.price >= ? OR l.rental_price >= ?)'; $params[] = $minP; $params[] = $minP; }
        if ($maxP)   { $where .= ' AND (l.price <= ? OR l.rental_price <= ?)'; $params[] = $maxP; $params[] = $maxP; }
        $searchParams = array_merge($params, [$search, $search]);
        $searchWhere  = $where . ' AND (l.title LIKE ? OR l.address LIKE ?)';
        $rows = DB::query(
            "SELECT l.*, u.name AS agent_name,
                    ow.name AS owner_name,
                    cl.name AS linked_client_name,
                    (SELECT file_url FROM listing_photos p WHERE p.listing_id=l.id AND p.is_primary=1 LIMIT 1) AS primary_photo
               FROM listings l
          LEFT JOIN users u      ON u.id = l.assigned_to
          LEFT JOIN contacts ow  ON ow.id = l.owner_id
          LEFT JOIN contacts cl  ON cl.id = l.contact_id
              WHERE l.tenant_id = ?
           ORDER BY l.created_at DESC",
            [$tenantId]
        );
        Response::success($rows);
        break;

    case 'POST':
        $body  = json_decode(file_get_contents('php://input'), true);
        $title = trim($body['title'] ?? '');
        if (!$title) Response::error('Property title is required');
        $count = DB::queryOne('SELECT COUNT(*) AS c FROM listings WHERE tenant_id = ?', [$tenantId])['c'];
        $ref   = 'HUL-' . str_pad($count + 1, 3, '0', STR_PAD_LEFT);
        $uid   = $user['user_id'] ?? $user['id'] ?? null;
        $newId = DB::insert(
            'INSERT INTO listings
             (tenant_id, assigned_to, ref, title, type, listing_type, status,
              price, rental_price, address, complex, unit, city, province,
              bedrooms, bathrooms, garages, erf_size, floor_size,
              description, owner_id, contact_id, mandate_type, listed_date, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $tenantId, (($body['assigned_to'] ?? '') !== '' ? (int)$body['assigned_to'] : null), $ref, $title,
                $body['type'] ?? 'Residential', $body['listing_type'] ?? 'Sale',
                $body['status'] ?? 'Active',
                ($body['price'] ?? '') !== '' ? round((float)$body['price'], 2) : null,
                ($body['rental_price'] ?? '') !== '' ? round((float)$body['rental_price'], 2) : null,
                $body['address'] ?? null, $body['complex'] ?? null, $body['unit'] ?? null,
                $body['city'] ?? null, $body['province'] ?? null,
                ($body['bedrooms'] ?? '') !== '' ? (int)$body['bedrooms'] : null,
                ($body['bathrooms'] ?? '') !== '' ? (int)$body['bathrooms'] : null,
                ($body['garages'] ?? '') !== '' ? (int)$body['garages'] : null,
                $body['erf_size'] ?? null, $body['floor_size'] ?? null,
                $body['description'] ?? null,
                ($body['owner_id'] ?? '') !== '' ? (int)$body['owner_id'] : null,
                ($body['contact_id'] ?? '') !== '' ? (int)$body['contact_id'] : null,
                $body['mandate_type'] ?? 'Sole', date('Y-m-d'), $uid,
            ]
        );
        DB::execute(
            'INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description) VALUES (?,?,?,?,?,?)',
            [$tenantId, $uid, 'listing', $newId, 'created', "Listing $ref created: $title"]
        );
        Response::success(DB::queryOne('SELECT * FROM listings WHERE id = ?', [$newId]), 'Listing created');
        break;

    case 'PUT':
        if (!$id) Response::error('Listing ID required');
        $body    = json_decode(file_get_contents('php://input'), true);
        $listing = DB::queryOne('SELECT * FROM listings WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$listing) Response::notFound();
        DB::execute(
            'UPDATE listings SET assigned_to=?, title=?, type=?, listing_type=?, status=?,
             price=?, rental_price=?, address=?, complex=?, unit=?, city=?, province=?,
             bedrooms=?, bathrooms=?, garages=?, erf_size=?, floor_size=?,
             description=?, owner_id=?, contact_id=?, mandate_type=?
             WHERE id = ? AND tenant_id = ?',
            [
                (($body['assigned_to'] ?? '') !== '' ? (int)$body['assigned_to'] : $listing['assigned_to']),
                $body['title']       ?? $listing['title'],
                $body['type']        ?? $listing['type'],
                $body['listing_type']?? $listing['listing_type'],
                $body['status']      ?? $listing['status'],
                ($body['price']        ?? '') !== '' ? round((float)$body['price'], 2)        : $listing['price'],
                ($body['rental_price'] ?? '') !== '' ? round((float)$body['rental_price'], 2) : $listing['rental_price'],
                $body['address']     ?? $listing['address'],
                $body['complex']     ?? $listing['complex'],
                $body['unit']        ?? $listing['unit'],
                $body['city']        ?? $listing['city'],
                $body['province']    ?? $listing['province'],
                ($body['bedrooms']  ?? '') !== '' ? (int)$body['bedrooms']  : $listing['bedrooms'],
                ($body['bathrooms'] ?? '') !== '' ? (int)$body['bathrooms'] : $listing['bathrooms'],
                ($body['garages']   ?? '') !== '' ? (int)$body['garages']   : $listing['garages'],
                $body['erf_size']    ?? $listing['erf_size'],
                $body['floor_size']  ?? $listing['floor_size'],
                $body['description'] ?? $listing['description'],
                ($body['owner_id']   ?? '') !== '' ? (int)$body['owner_id']   : $listing['owner_id'],
                ($body['contact_id'] ?? '') !== '' ? (int)$body['contact_id'] : $listing['contact_id'],
                $body['mandate_type']?? $listing['mandate_type'],
                $id, $tenantId,
            ]
        );
        Response::success(DB::queryOne('SELECT * FROM listings WHERE id = ?', [$id]), 'Listing updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('Listing ID required');
        Auth::requireRole($user, ['platform_superadmin', 'super_admin', 'admin']);
        $listing = DB::queryOne('SELECT * FROM listings WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$listing) Response::notFound();
        DB::execute('DELETE FROM listings WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(null, 'Listing deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
