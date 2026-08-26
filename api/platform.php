<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

$rawBody = file_get_contents('php://input');
$body    = json_decode($rawBody, true) ?? [];
$action  = $body['action'] ?? $_GET['action'] ?? '';

// exit_impersonate allowed for any role (to restore platform admin)
if ($action !== 'exit_impersonate' && $user['role'] !== 'platform_superadmin') {
    Response::error('Unauthorised', 403);
}

if ($action === 'test') {
    Response::success(['method' => $_SERVER['REQUEST_METHOD'], 'action' => $action, 'body_len' => strlen($rawBody)], 'OK');
}

switch ($action) {
    case 'impersonate':
        try {
            $tenantId = (int)($body['tenant_id'] ?? 0);
            if (!$tenantId) Response::error('tenant_id required');
            $admin = DB::queryOne(
                "SELECT u.*, t.name AS tenant_name FROM users u 
                 JOIN tenants t ON t.id = u.tenant_id
                 WHERE u.tenant_id = ? AND u.role = 'super_admin' AND u.is_active = 1 LIMIT 1",
                [$tenantId]
            );
            if (!$admin) Response::error('No super admin found for this tenant');
            $currentToken = $_COOKIE[SESSION_COOKIE] ?? '';
            $newToken = bin2hex(random_bytes(32));
            DB::execute(
                'INSERT INTO sessions (token, user_id, tenant_id, role, expires_at, impersonating_from) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), ?)',
                [$newToken, $admin['id'], $admin['tenant_id'], $admin['role'], $currentToken]
            );
            // Set cookie server-side so HttpOnly is preserved
            setcookie(SESSION_COOKIE, $newToken, [
                'expires'  => time() + 3600,
                'path'     => '/',
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
            Response::success(['tenant_name' => $admin['tenant_name']], 'OK');
        } catch (\Exception $e) {
            Response::error('Impersonate failed: ' . $e->getMessage());
        }
        break;

    case 'exit_impersonate':
        $currentToken = $_COOKIE[SESSION_COOKIE] ?? '';
        $session = DB::queryOne('SELECT impersonating_from FROM sessions WHERE token = ?', [$currentToken]);
        $original = $session['impersonating_from'] ?? '';
        DB::execute('DELETE FROM sessions WHERE token = ?', [$currentToken]);
        if ($original) {
            setcookie(SESSION_COOKIE, $original, [
                'expires'  => time() + 86400,
                'path'     => '/',
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        } else {
            setcookie(SESSION_COOKIE, '', time() - 3600, '/');
        }
        Response::success(null, 'OK');
        break;

    case 'reset_password':
        $tenantId = (int)($body['tenant_id'] ?? 0);
        $password = $body['password'] ?? '';
        if (!$password || strlen($password) < 6) Response::error('Password must be at least 6 characters');
        DB::execute(
            "UPDATE users SET password_hash = ? WHERE tenant_id = ? AND role = 'super_admin'",
            [password_hash($password, PASSWORD_DEFAULT), $tenantId]
        );
        Response::success(null, 'Password reset successfully');
        break;

    case 'create_user':
        $tenantId = (int)($body['tenant_id'] ?? 0);
        if (!$tenantId || !($body['name'] ?? '') || !($body['username'] ?? '') || !($body['password'] ?? ''))
            Response::error('tenant_id, name, username and password are required');
        if (DB::queryOne('SELECT id FROM users WHERE username = ?', [$body['username']]))
            Response::error('Username already taken');
        $newId = DB::insert(
            'INSERT INTO users (tenant_id, name, username, email, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
            [$tenantId, $body['name'], $body['username'], $body['email'] ?? null,
             password_hash($body['password'], PASSWORD_DEFAULT), $body['role'] ?? 'agent']
        );
        Response::success(['id' => $newId], 'User created');
        break;

    default:
        Response::error('Unknown action: ' . $action);
}
