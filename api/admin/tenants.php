<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) { header('Location: /index.php?p=login'); exit; }
Auth::requireRole($user, ['platform_superadmin']);

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

if ($method === 'GET' && !$id) {
    // List all tenants with user count and stats
    $tenants = DB::query(
        "SELECT t.*,
                (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.is_active = 1) AS user_count,
                (SELECT COUNT(*) FROM contacts c WHERE c.tenant_id = t.id) AS contact_count,
                (SELECT COUNT(*) FROM deals d WHERE d.tenant_id = t.id AND d.stage = 'closed') AS closed_deals
           FROM tenants t
          ORDER BY t.created_at DESC"
    );
    Response::success($tenants);
}

if ($method === 'POST') {
    // Create a new tenant + their first super admin
    $body = json_decode(file_get_contents('php://input'), true);

    $required = ['name','slug','admin_name','admin_email','admin_password'];
    foreach ($required as $f) {
        if (empty($body[$f])) Response::error("$f is required");
    }

    // Check slug unique
    $exists = DB::queryOne('SELECT id FROM tenants WHERE slug = ?', [$body['slug']]);
    if ($exists) Response::error('Slug already in use. Choose a different one.');

    DB::begin();
    try {
        $tenantId = DB::insert(
            'INSERT INTO tenants (name, slug, email, phone, status, plan)
             VALUES (?,?,?,?,?,?)',
            [
                $body['name'],
                strtolower($body['slug']),
                $body['email']  ?? null,
                $body['phone']  ?? null,
                $body['status'] ?? 'active',
                $body['plan']   ?? 'starter',
            ]
        );

        // Create the tenant's super admin user
        $username = strtolower(str_replace(' ', '.', $body['admin_name']));
        DB::insert(
            'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active)
             VALUES (?,?,?,?,?,?,1)',
            [
                $tenantId,
                $body['admin_name'],
                strtolower($body['admin_email']),
                $username,
                password_hash($body['admin_password'], PASSWORD_BCRYPT, ['cost' => 12]),
                'super_admin',
            ]
        );

        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        Response::error('Failed to create tenant: ' . $e->getMessage(), 500);
    }

    $tenant = DB::queryOne('SELECT * FROM tenants WHERE id = ?', [$tenantId]);
    Response::success($tenant, "Tenant '{$body['name']}' created successfully");
}

if ($method === 'PUT' && $id) {
    $body = json_decode(file_get_contents('php://input'), true);
    $tenant = DB::queryOne('SELECT * FROM tenants WHERE id = ?', [$id]);
    if (!$tenant) Response::notFound('Tenant not found');

    DB::execute(
        'UPDATE tenants SET name=?, email=?, phone=?, status=?, plan=? WHERE id = ?',
        [
            $body['name']   ?? $tenant['name'],
            $body['email']  ?? $tenant['email'],
            $body['phone']  ?? $tenant['phone'],
            $body['status'] ?? $tenant['status'],
            $body['plan']   ?? $tenant['plan'],
            $id,
        ]
    );

    Response::success(null, 'Tenant updated');
}

if ($method === 'DELETE' && $id) {
    $tenant = DB::queryOne('SELECT * FROM tenants WHERE id = ?', [$id]);
    if (!$tenant) Response::notFound();

    // Soft delete — suspend rather than destroy data
    DB::execute("UPDATE tenants SET status = 'suspended' WHERE id = ?", [$id]);
    DB::execute("UPDATE users SET is_active = 0 WHERE tenant_id = ?", [$id]);

    Response::success(null, "Tenant '{$tenant['name']}' suspended");
}
