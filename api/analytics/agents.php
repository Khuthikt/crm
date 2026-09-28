<?php
error_reporting(0);
require_once __DIR__ . "/../../includes/auth.php";
require_once __DIR__ . "/../../includes/db.php";
require_once __DIR__ . "/../../includes/response.php";

$user = Auth::user();
if (!$user) Response::unauthorized();
if (!in_array($user["role"], ["platform_superadmin","super_admin","admin"])) Response::error("Unauthorised", 403);

$tenantId = (int)$user["tenant_id"];
$period   = $_GET["period"] ?? "30";

$noteFilter  = $period === "all" ? "" : "AND n.created_at >= DATE_SUB(NOW(), INTERVAL {$period} DAY)";
$emailFilter = $period === "all" ? "" : "AND e.sent_at >= DATE_SUB(NOW(), INTERVAL {$period} DAY)";
$remFilter   = $period === "all" ? "" : "AND r.created_at >= DATE_SUB(NOW(), INTERVAL {$period} DAY)";
$dealFilter    = $period === "all" ? "" : "AND d.created_at >= DATE_SUB(NOW(), INTERVAL {$period} DAY)";
$listingFilter = $period === "all" ? "" : "AND l.created_at >= DATE_SUB(NOW(), INTERVAL {$period} DAY)";
$callFilter    = $period === "all" ? "" : "AND cl.created_at >= DATE_SUB(NOW(), INTERVAL {$period} DAY)";

try {
$agents = DB::query(
    "SELECT
        u.id, u.name, u.email, u.role, u.status, u.is_active, u.last_login,
        COUNT(DISTINCT c.id) as contacts_assigned,
        COUNT(DISTINCT n.id) as notes_logged,
        COUNT(DISTINCT e.id) as emails_sent,
        COUNT(DISTINCT r.id) as reminders_set,
        COUNT(DISTINCT d.id) as deals_active,
        COUNT(DISTINCT CASE WHEN d.stage = 'closed' THEN d.id END) as deals_closed,
        COALESCE(SUM(DISTINCT CASE WHEN d.stage = 'closed' THEN d.value END), 0) as revenue_closed,
        COUNT(DISTINCT l.id) as listings_added,
        COUNT(DISTINCT cl.id) as calls_made
     FROM users u
     LEFT JOIN contacts c ON c.assigned_to = u.id AND c.tenant_id = u.tenant_id
     LEFT JOIN contact_notes n ON n.user_id = u.id AND n.tenant_id = u.tenant_id $noteFilter
     LEFT JOIN email_log e ON e.user_id = u.id AND e.tenant_id = u.tenant_id $emailFilter
     LEFT JOIN contact_reminders r ON r.user_id = u.id $remFilter
     LEFT JOIN deals d ON d.assigned_to = u.id AND d.tenant_id = u.tenant_id $dealFilter
     LEFT JOIN listings l ON l.created_by = u.id AND l.tenant_id = u.tenant_id $listingFilter
     LEFT JOIN call_log cl ON cl.user_id = u.id AND cl.tenant_id = u.tenant_id $callFilter
     WHERE u.tenant_id = ? AND u.role NOT IN ('platform_superadmin')
     GROUP BY u.id, u.name, u.email, u.role, u.status, u.is_active, u.last_login
     ORDER BY contacts_assigned DESC, notes_logged DESC",
    [$tenantId]
);
} catch (Exception $e) {
    Response::error('Query failed: ' . $e->getMessage(), 500);
}

Response::success($agents);
