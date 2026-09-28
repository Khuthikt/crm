<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user || $user["role"] !== "platform_superadmin") Response::error("Unauthorised", 403);

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    $tenants = DB::query(
        "SELECT t.id, t.name, t.status, t.plan, t.monthly_fee, t.billing_email, t.billing_contact,
                (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.is_active = 1) AS user_count,
                (SELECT COUNT(*) FROM contacts c WHERE c.tenant_id = t.id) AS contact_count
         FROM tenants t ORDER BY t.monthly_fee DESC, t.name ASC", []
    );
    $total_mrr   = array_sum(array_column($tenants, "monthly_fee"));
    $active_count = count(array_filter($tenants, fn($t) => $t["status"] === "active"));
    Response::success([
        "tenants" => $tenants,
        "summary" => [
            "mrr"      => $total_mrr,
            "arr"      => $total_mrr * 12,
            "active"   => $active_count,
            "total"    => count($tenants),
            "avg_fee"  => $active_count > 0 ? round($total_mrr / $active_count, 2) : 0,
        ]
    ]);
    exit;
}

if ($method === "PUT") {
    $body = json_decode(file_get_contents("php://input"), true) ?? [];
    $id   = (int)($_GET["id"] ?? 0);
    if (!$id) Response::error("Tenant ID required");
    DB::execute(
        "UPDATE tenants SET monthly_fee=?, plan=?, billing_email=?, billing_contact=? WHERE id=?",
        [$body["monthly_fee"]??0, $body["plan"]??"standard", $body["billing_email"]??"", $body["billing_contact"]??"", $id]
    );
    Response::success(null, "Billing updated");
    exit;
}
Response::error("Method not allowed", 405);
