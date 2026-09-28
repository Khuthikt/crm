<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user || $user["role"] !== "platform_superadmin") Response::error("Unauthorised", 403);

$tenantId = isset($_GET["tenant_id"]) ? (int)$_GET["tenant_id"] : null;

$sql    = "SELECT u.id, u.name, u.email, u.username, u.role, u.status, u.is_active, u.last_login, u.created_at,
                  COALESCE(t.name, 'Platform') AS tenant_name, u.tenant_id
           FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
           WHERE u.role != 'platform_superadmin'";
$params = [];
if ($tenantId) { $sql .= " AND u.tenant_id = ?"; $params[] = $tenantId; }
$sql .= " ORDER BY t.name ASC, u.name ASC";

$users   = DB::query($sql, $params);
$tenants = DB::query("SELECT id, name FROM tenants ORDER BY name ASC", []);
Response::success(["users" => $users, "tenants" => $tenants]);
