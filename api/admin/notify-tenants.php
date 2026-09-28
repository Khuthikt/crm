<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/mailer.php';

$user = Auth::user();
if (!$user || $user["role"] !== "platform_superadmin") Response::error("Unauthorised", 403);

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    $last    = DB::queryOne("SELECT setting_value FROM platform_settings WHERE setting_key = 'last_announcement'", []);
    $tenants = DB::query("SELECT id, name FROM tenants WHERE status = 'active' ORDER BY name", []);
    Response::success(["last_announcement"=>$last?json_decode($last["setting_value"],true):null,"tenants"=>$tenants]);
    exit;
}

if ($method === "POST") {
    $body     = json_decode(file_get_contents("php://input"), true) ?? [];
    $type     = $body["type"] ?? "general";
    $message  = trim($body["message"] ?? "");
    $subject  = $body["subject"] ?? "Message from Hulisa CRM";
    $tenantId = isset($body["tenant_id"]) ? (int)$body["tenant_id"] : null;
    if (!$message) Response::error("Message is required");

    $tenants = $tenantId
        ? DB::query("SELECT id, name, email FROM tenants WHERE id = ? AND status = 'active'", [$tenantId])
        : DB::query("SELECT id, name, email FROM tenants WHERE status = 'active' ORDER BY name", []);

    $typeLabels = ["update"=>"System Update","maintenance"=>"Maintenance Notice","general"=>"General Announcement","billing"=>"Billing Notice"];
    $typeLabel  = $typeLabels[$type] ?? "Announcement";

    foreach ($tenants as $tenant) {
        $users = DB::query("SELECT id FROM users WHERE tenant_id = ? AND is_active = 1", [$tenant["id"]]);
        foreach ($users as $u) {
            DB::execute("INSERT INTO notifications (tenant_id, user_id, type, message, is_read) VALUES (?,?,?,?,0)",
                [$tenant["id"], $u["id"], $type, "[".$typeLabel."] ".$message]);
        }
    }

    DB::execute("INSERT INTO platform_settings (setting_key, setting_value) VALUES ('last_announcement',?) ON DUPLICATE KEY UPDATE setting_value=?",
        [json_encode(["type"=>$type,"message"=>$message,"sent"=>count($tenants),"date"=>date("Y-m-d H:i:s")]),
         json_encode(["type"=>$type,"message"=>$message,"sent"=>count($tenants),"date"=>date("Y-m-d H:i:s")])]);

    Response::success(["sent"=>count($tenants)],"Announcement sent to ".count($tenants)." tenant(s)");
    exit;
}
Response::error("Method not allowed", 405);
