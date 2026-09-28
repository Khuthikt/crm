<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/maintenance.php';
require_once __DIR__ . '/config.php';

class Auth {

    // ── Resolve current user from cookie/token ─────────────────
    public static function user(): ?array {
        $token = $_COOKIE[SESSION_COOKIE] ?? null;
        if (!$token) return null;

        $session = DB::queryOne(
            'SELECT s.*, u.id AS user_id_actual, u.name, u.email, u.username, u.avatar_url
               FROM sessions s
               JOIN users u ON u.id = s.user_id
              WHERE s.token = ? AND s.expires_at > NOW() AND u.is_active = 1',
            [$token]
        );
        if ($session) {
            // Refresh session expiry on every request (sliding window)
            $newExpiry = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);
            DB::execute('UPDATE sessions SET expires_at = ? WHERE token = ?', [$newExpiry, $token]);
        }
        return $session ?: null;
    }

    // ── Require login — redirect if not ────────────────────────
    public static function require(): array {
        $user = self::user();
        if (!$user) {
            header('Location: ' . APP_URL . '/index.php?p=login');
            exit;
        }
        return $user;
    }

    // ── Require a minimum role ──────────────────────────────────
    public static function requireRole(array $user, array $roles): void {
        if (!in_array($user['role'], $roles)) {
            Response::error('Access denied', 403);
        }
    }

    // ── Attempt login ───────────────────────────────────────────
    public static function auditLog(int $userId = null, int $tenantId = null, string $action = '', string $entityType = null, int $entityId = null, string $description = null): void {
        try {
            $userName = null;
            if ($userId) {
                $u = DB::queryOne('SELECT name FROM users WHERE id = ?', [$userId]);
                $userName = $u['name'] ?? null;
            }
            DB::execute(
                'INSERT INTO audit_log (tenant_id, user_id, user_name, action, entity_type, entity_id, description, ip_address) VALUES (?,?,?,?,?,?,?,?)',
                [$tenantId, $userId, $userName, $action, $entityType, $entityId, $description, $_SERVER['REMOTE_ADDR'] ?? null]
            );
        } catch (\Exception $e) { /* silent */ }
    }

    public static function login(string $username, string $password): array {
        $user = DB::queryOne(
            'SELECT u.*, t.name AS tenant_name, t.status AS tenant_status
               FROM users u
          LEFT JOIN tenants t ON t.id = u.tenant_id
              WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1',
            [$username, $username]
        );

        if (!$user || !password_verify($password, $user['password_hash'])) {
            return ['ok' => false, 'error' => 'Invalid username or password'];
        }

        // Check tenant is active (platform admins are always allowed)
        if ($user['tenant_id'] && $user['tenant_status'] !== 'active') {
            return ['ok' => false, 'error' => 'Your account is suspended. Contact support.'];
        }

        // Check user is not suspended
        if (($user['status'] ?? 'active') === 'suspended') {
            return ['ok' => false, 'error' => 'Your account has been suspended. Please contact your administrator.'];
        }

        // Log successful login
        DB::execute("INSERT INTO login_attempts (username, ip, success) VALUES (?,?,1)", [$username, $ip ?? null]);
        self::auditLog($user['id'], $user['tenant_id'] ?? null, 'login', 'user', $user['id'], "User logged in: {$user['name']}");
        // Create session
        $token = bin2hex(random_bytes(48));
        $expires = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);

        DB::execute(
            'INSERT INTO sessions (token, user_id, tenant_id, role, ip_address, user_agent, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $token,
                $user['id'],
                $user['tenant_id'],
                $user['role'],
                $_SERVER['REMOTE_ADDR'] ?? '',
                substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 300),
                $expires
            ]
        );

        // Update last login
        DB::execute('UPDATE users SET last_login = NOW() WHERE id = ?', [$user['id']]);

        // Set secure cookie
        setcookie(SESSION_COOKIE, $token, [
            'expires'  => time() + SESSION_LIFETIME,
            'path'     => '/',
            'secure'   => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        return ['ok' => true, 'user' => $user, 'token' => $token];
    }

    // ── Logout ──────────────────────────────────────────────────
    public static function logout(): void {
        $token = $_COOKIE[SESSION_COOKIE] ?? null;
        if ($token) {
            // Check if impersonating — if so restore original session
            $session = DB::queryOne('SELECT impersonating_from FROM sessions WHERE token = ?', [$token]);
            $original = $session['impersonating_from'] ?? '';
            DB::execute('DELETE FROM sessions WHERE token = ?', [$token]);
            if ($original) {
                // Restore platform admin session instead of logging out
                setcookie(SESSION_COOKIE, $original, time() + 86400, '/');
                return;
            }
        }
        setcookie(SESSION_COOKIE, '', time() - 3600, '/');
    }

    // ── Check if user can access a tenant's data ────────────────
    public static function canAccessTenant(array $user, int $tenantId): bool {
        if ($user['role'] === 'platform_superadmin') return true;
        return (int)$user['tenant_id'] === $tenantId;
    }

    // ── Role helpers ────────────────────────────────────────────
    public static function isPlatformAdmin(array $user): bool {
        return $user['role'] === 'platform_superadmin';
    }

    public static function isSuperAdmin(array $user): bool {
        return in_array($user['role'], ['platform_superadmin', 'super_admin']);
    }

    public static function isFinance(array $user): bool {
        return in_array($user['role'], ['platform_superadmin', 'super_admin', 'admin', 'finance_admin']);
    }

    public static function isAgent(array $user): bool {
        return $user['role'] === 'agent';
    }

    // ── Get tenant_id safely ────────────────────────────────────
    public static function tenantId(array $user): ?int {
        return $user['tenant_id'] ? (int)$user['tenant_id'] : null;
    }
}
