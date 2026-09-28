<?php
require_once __DIR__ . '/../../includes/auth.php';
error_reporting(0); ini_set("display_errors", 0);
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
// Role check handled per method below

$tenantId = (int)$user['tenant_id'];
$method   = $_SERVER['REQUEST_METHOD'];
$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    case 'GET':
        // Agents can only see their own profile
        if ($user['role'] === 'agent') {
            $self = DB::queryOne('SELECT id, name, email, username, role FROM users WHERE id = ?', 
                [$user['user_id'] ?? $user['id']]);
            Response::success([$self]);
        }
        // Admins can only see their own tenant's users
        $rows = DB::query(
            "SELECT id, name, email, username, role, avatar_url, is_active, status,
                    smtp_host, smtp_port, smtp_user, smtp_encryption, smtp_from_name, email_signature, email_signature_img,
                    last_login, created_at
               FROM users WHERE tenant_id = ? ORDER BY name ASC",
            [$tenantId]
        );
        Response::success($rows);
        break;

    case 'POST':
        // Only admin+ can create users
        if (!in_array($user['role'], ['platform_superadmin','super_admin','admin'])) {
            Response::error('Unauthorised', 403);
        }
        // Admin cannot create super_admin
        $newRole = $body['role'] ?? 'agent';
        if ($user['role'] === 'admin' && in_array($newRole, ['super_admin','platform_superadmin'])) {
            Response::error('You cannot create a Super Admin account', 403);
        }

        $required = ['name','email','username','password','role'];
        foreach ($required as $f) {
            if (empty($body[$f])) Response::error("$f is required");
        }

        // Role restrictions — admins cannot create super_admins
        if ($user['role'] === 'admin' && $body['role'] === 'super_admin') {
            Response::forbidden('You cannot create a Super Admin');
        }

        // Check unique
        $exists = DB::queryOne(
            'SELECT id FROM users WHERE (email = ? OR username = ?) AND tenant_id = ?',
            [$body['email'], $body['username'], $tenantId]
        );
        if ($exists) Response::error('Email or username already exists');

        if (strlen($body['password']) < 8) {
            Response::error('Password must be at least 8 characters');
        }

        // Encrypt SMTP password if provided
        $smtpPass = '';
        if (!empty($body['smtp_pass'])) {
            require_once __DIR__ . '/../../includes/crypto.php';
            $smtpPass = Crypto::encrypt($body['smtp_pass']);
        }

        $newId = DB::insert(
            'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active,
                smtp_host, smtp_port, smtp_user, smtp_pass, smtp_encryption, smtp_from_name)
             VALUES (?,?,?,?,?,?,1,?,?,?,?,?,?)',
            [
                $tenantId,
                trim($body['name']),
                strtolower(trim($body['email'])),
                strtolower(trim($body['username'])),
                password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]),
                $body['role'],
                $body['smtp_host'] ?? null,
                $body['smtp_port'] ?? null,
                $body['smtp_user'] ?? null,
                $smtpPass ?: null,
                $body['smtp_encryption'] ?? null,
                $body['smtp_from_name'] ?? null,
            ]
        );

        $newUser = DB::queryOne(
            'SELECT id, name, email, username, role, is_active FROM users WHERE id = ?',
            [$newId]
        );
        Response::success($newUser, 'User created');
        break;

    case 'PUT':
        if (isset($body['new_password'])) {
            $newPw    = trim($body['new_password'] ?? '');
            $isAdmin  = $body['admin_reset'] ?? false;
            $targetId = $id ?? ($user['user_id'] ?? $user['id']);
            
            if (strlen($newPw) < 6) Response::error('Password must be at least 6 characters');
            
            if (!$isAdmin) {
                // Verify current password
                $currPw = $body['current_password'] ?? '';
                $dbUser = DB::queryOne('SELECT password_hash FROM users WHERE id = ?', [$targetId]);
                if (!$dbUser || !password_verify($currPw, $dbUser['password_hash'])) {
                    Response::error('Current password is incorrect');
                }
            } else {
                // Admin reset - check they have permission
                Auth::requireRole($user, ['platform_superadmin', 'super_admin', 'admin']);
            }
            
            DB::execute(
                'UPDATE users SET password_hash = ? WHERE id = ?',
                [password_hash($newPw, PASSWORD_BCRYPT), $targetId]
            );
            Response::success(null, 'Password updated');
            exit;
        }
        if (!$id) Response::error('User ID required');

        // Verify belongs to tenant
        $target = DB::queryOne(
            'SELECT * FROM users WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );
        if (!$target) Response::notFound('User not found');

        $passwordHash = $target['password_hash'];
        if (!empty($body['password'])) {
            if (strlen($body['password']) < 8) Response::error('Password must be at least 8 characters');
            $passwordHash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }

        // Encrypt SMTP password if provided
        $smtpPass = $target['smtp_pass'];
        if (!empty($body['smtp_pass'])) {
            require_once __DIR__ . '/../../includes/crypto.php';
            $smtpPass = Crypto::encrypt($body['smtp_pass']);
        }

        DB::execute(
            'UPDATE users SET name=?, email=?, role=?, is_active=?, status=?, password_hash=?,
                smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?, smtp_encryption=?, smtp_from_name=?
             WHERE id = ? AND tenant_id = ?',
            [
                $body['name']      ?? $target['name'],
                $body['email']     ?? $target['email'],
                $body['role']      ?? $target['role'],
                isset($body['is_active']) ? (int)$body['is_active'] : $target['is_active'],
                $body['status']    ?? $target['status'] ?? 'active',
                $passwordHash,
                $body['smtp_host']       ?? $target['smtp_host'],
                $body['smtp_port']       ?? $target['smtp_port'],
                $body['smtp_user']       ?? $target['smtp_user'],
                $smtpPass,
                $body['smtp_encryption'] ?? $target['smtp_encryption'],
                $body['smtp_from_name']  ?? $target['smtp_from_name'],
                $id, $tenantId,
            ]
        );

        Response::success(null, 'User updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('User ID required');
        Auth::requireRole($user, ['platform_superadmin','super_admin']);

        // Cannot delete yourself
        if ($id === (int)$user['user_id'] ?? $user['id']) Response::error('You cannot delete your own account');

        $target = DB::queryOne(
            'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );
        if (!$target) Response::notFound();

        DB::execute('DELETE FROM users WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(null, 'User deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
