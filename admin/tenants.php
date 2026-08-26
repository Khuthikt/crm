<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/response.php';

$user = Auth::user();
if (!$user) { header('Location: /index.php?p=login'); exit; }
Auth::requireRole($user, ['platform_superadmin']);

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

// Read body once for all POST requests
$rawBody = file_get_contents('php://input');
$bodyData = json_decode($rawBody, true) ?? [];
$action = $_GET['action'] ?? $bodyData['action'] ?? '';

// ── IMPERSONATE TENANT ───────────────────────────────────────
if ($method === 'POST' && $action === 'impersonate') {
    $body = $bodyData;
    $tenantId = (int)($body['tenant_id'] ?? 0);
    $tenantAdmin = DB::queryOne(
        "SELECT u.*, t.name AS tenant_name FROM users u 
         JOIN tenants t ON t.id = u.tenant_id
         WHERE u.tenant_id = ? AND u.role = 'super_admin' AND u.is_active = 1 LIMIT 1",
        [$tenantId]
    );
    if (!$tenantAdmin) Response::error('No super admin found for this tenant');
    // Store original platform admin session token for return
    $originalToken = $_COOKIE[SESSION_COOKIE] ?? '';
    // Create impersonation session
    $token = bin2hex(random_bytes(32));
    DB::execute(
        'INSERT INTO sessions (user_id, token, created_at) VALUES (?, ?, NOW())',
        [$tenantAdmin['id'], $token]
    );
    // Store original token in new session so we can return
    DB::execute(
        'UPDATE sessions SET impersonating_from = ? WHERE token = ?',
        [$originalToken, $token]
    );
    setcookie(SESSION_COOKIE, $token, time() + 3600, '/');
    Response::success(['tenant_name' => $tenantAdmin['tenant_name']], 'Now viewing as ' . $tenantAdmin['tenant_name']);
    exit;
}

// ── EXIT IMPERSONATION ───────────────────────────────────────
if ($method === 'POST' && $action === 'exit_impersonate') {
    $currentToken = $_COOKIE[SESSION_COOKIE] ?? '';
    $session = DB::queryOne('SELECT impersonating_from FROM sessions WHERE token = ?', [$currentToken]);
    $originalToken = $session['impersonating_from'] ?? '';
    // Delete impersonation session
    DB::execute('DELETE FROM sessions WHERE token = ?', [$currentToken]);
    if ($originalToken) {
        setcookie(SESSION_COOKIE, $originalToken, time() + 86400, '/');
        Response::success(['redirect' => true], 'Returned to platform admin');
    } else {
        setcookie(SESSION_COOKIE, '', time() - 3600, '/');
        Response::success(['redirect' => false], 'Session ended');
        exit;
    }
}

// ── RESET TENANT SUPER ADMIN PASSWORD ───────────────────────
if ($method === 'POST' && $action === 'reset_password') {
    $body = $bodyData;
    $tenantId = (int)($body['tenant_id'] ?? 0);
    $password = $body['password'] ?? '';
    if (!$password || strlen($password) < 6) Response::error('Password must be at least 6 characters');
    $hash = password_hash($password, PASSWORD_DEFAULT);
    DB::execute(
        "UPDATE users SET password_hash = ? WHERE tenant_id = ? AND role = 'super_admin'",
        [$hash, $tenantId]
    );
    Response::success(null, 'Password reset successfully');
    exit;
}

// ── CREATE USER FOR TENANT ───────────────────────────────────
if ($method === 'POST' && $action === 'create_user') {
    $body = $bodyData;
    $tenantId = (int)($body['tenant_id'] ?? 0);
    if (!$tenantId || !($body['name'] ?? '') || !($body['username'] ?? '') || !($body['password'] ?? '')) {
        Response::error('name, username, and password are required');
    }
    $exists = DB::queryOne('SELECT id FROM users WHERE username = ?', [$body['username']]);
    if ($exists) Response::error('Username already taken');
    $hash = password_hash($body['password'], PASSWORD_DEFAULT);
    $newId = DB::insert(
        'INSERT INTO users (tenant_id, name, username, email, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
        [$tenantId, $body['name'], $body['username'], $body['email'] ?? null, $hash, $body['role'] ?? 'agent']
    );
    Response::success(DB::queryOne('SELECT id, name, username, role FROM users WHERE id = ?', [$newId]), 'User created');
    exit;
}

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

if ($method === 'POST' && $action === '') {
    // Create a new tenant + their first super admin
    $body = $bodyData;

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
    $body = $bodyData;
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
