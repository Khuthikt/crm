<?php
error_log("NOTIFY-TENANTS REACHED");

error_reporting(0);
require_once __DIR__ . "/../includes/auth.php";
require_once __DIR__ . "/../includes/db.php";
require_once __DIR__ . "/../includes/response.php";
require_once __DIR__ . "/../includes/mailer.php";

$user = Auth::user();
if (!$user || $user["role"] !== "platform_superadmin") Response::error("Unauthorised user role: " . ($user["role"]??null), 403);

$method = $_SERVER["REQUEST_METHOD"];
$body   = json_decode(file_get_contents("php://input"), true) ?? [];

if ($method === "POST") {
    $type    = $body["type"] ?? "general";
    $message = trim($body["message"] ?? "");
    $subject = $body["subject"] ?? "Message from Hulisa CRM";
    $tenantId = isset($body["tenant_id"]) ? (int)$body["tenant_id"] : null;

    if (!$message) Response::error("Message is required");

    // Get target tenants
    $tenants = $tenantId
        ? DB::query("SELECT id, name, email FROM tenants WHERE id = ? AND status = \'active\'", [$tenantId])
        : DB::query("SELECT id, name, email FROM tenants WHERE status = \'active\'", []);

    if (!$tenants) Response::error("No active tenants found");

    // Get platform SMTP
    $smtpRows = DB::query("SELECT setting_key, setting_value FROM platform_settings WHERE setting_key LIKE \'smtp%\'", []);
    $smtp = [];
    foreach ($smtpRows as $r) $smtp[$r["setting_key"]] = $r["setting_value"];

    $typeLabels = [
        "update"      => "System Update",
        "maintenance" => "Maintenance Notice",
        "general"     => "General Announcement",
        "billing"     => "Billing Notice",
    ];
    $typeLabel = $typeLabels[$type] ?? "Announcement";

    $sent = 0; $failed = 0;
    foreach ($tenants as $tenant) {
        if (empty($tenant["email"])) continue;
        $html = Mailer::htmlWrap(
            "<p>Dear <strong>" . htmlspecialchars($tenant["name"]) . "</strong>,</p>" .
            "<p>" . nl2br(htmlspecialchars($message)) . "</p>" .
            "<p style=\"margin-top:24px;color:#888;font-size:13px\">This message was sent by Hulisa Business Solutions.</p>",
            "Hulisa Property CRM"
        );
        if (!empty($smtp["smtp_host"])) {
            $ok = Mailer::send($smtp, $tenant["email"], $tenant["name"], "[Hulisa CRM] " . $subject, $html);
            $ok ? $sent++ : $failed++;
        }

        // Also create in-app notification for all users of this tenant
        $users = DB::query("SELECT id FROM users WHERE tenant_id = ? AND is_active = 1", [$tenant["id"]]);
        foreach ($users as $u) {
            DB::execute(
                "INSERT INTO notifications (tenant_id, user_id, type, message, is_read) VALUES (?,?,?,?,0)",
                [$tenant["id"], $u["id"], $type, "[" . $typeLabel . "] " . $message]
            );
        }
    }

    // Log announcement
    DB::execute(
        "INSERT INTO platform_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        ["last_announcement", json_encode(["type"=>$type,"message"=>$message,"sent"=>$sent,"date"=>date("Y-m-d H:i:s")]),
         json_encode(["type"=>$type,"message"=>$message,"sent"=>$sent,"date"=>date("Y-m-d H:i:s")])]
    );

    Response::success(["sent" => $sent, "failed" => $failed], "Announcement sent to {$sent} tenant(s)");
}

if ($method === "GET") {
    // Get announcement history from platform settings
    $last = DB::queryOne("SELECT setting_value FROM platform_settings WHERE setting_key = \'last_announcement\'", []);
    $tenants = DB::query("SELECT id, name FROM tenants WHERE status = \'active\' ORDER BY name", []);
    Response::success(["last_announcement" => $last ? json_decode($last["setting_value"], true) : null, "tenants" => $tenants]);
}

Response::error("Method not allowed", 405);
