<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user || $user["role"] !== "platform_superadmin") Response::error("Unauthorised", 403);

$tenantId = isset($_GET["tenant_id"]) ? (int)$_GET["tenant_id"] : null;
$limit    = min((int)($_GET["limit"] ?? 100), 500);

$sql    = "SELECT al.*, t.name AS tenant_name FROM audit_log al LEFT JOIN tenants t ON t.id = al.tenant_id";
$params = [];
if ($tenantId) { $sql .= " WHERE al.tenant_id = ?"; $params[] = $tenantId; }
$sql .= " ORDER BY al.created_at DESC LIMIT ?";
$params[] = $limit;

$logs    = DB::query($sql, $params);
$tenants = DB::query("SELECT id, name FROM tenants ORDER BY name", []);
Response::success(["logs" => $logs, "tenants" => $tenants]);
