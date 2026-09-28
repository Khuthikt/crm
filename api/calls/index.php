<?php
error_reporting(0);
require_once __DIR__ . "/../../includes/auth.php";
require_once __DIR__ . "/../../includes/db.php";
require_once __DIR__ . "/../../includes/response.php";

$user = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = (int)$user["tenant_id"];
$userId   = (int)($user["user_id"] ?? $user["id"]);
$method   = $_SERVER["REQUEST_METHOD"];

if ($method === "POST") {
    $body      = json_decode(file_get_contents("php://input"), true);
    $contactId = (int)($body["contact_id"] ?? 0);
    $outcome   = $body["outcome"] ?? "answered";
    $notes     = trim($body["notes"] ?? "");
    $duration  = isset($body["duration"]) ? (int)$body["duration"] : null;
    if (!$contactId) Response::error("Contact ID required");
    $contact = DB::queryOne("SELECT id, name FROM contacts WHERE id = ? AND tenant_id = ?", [$contactId, $tenantId]);
    if (!$contact) Response::notFound("Contact not found");
    DB::execute(
        "INSERT INTO call_log (tenant_id, contact_id, user_id, outcome, notes, duration) VALUES (?,?,?,?,?,?)",
        [$tenantId, $contactId, $userId, $outcome, $notes ?: null, $duration]
    );
    $outcomeLabel = ["answered"=>"Answered","voicemail"=>"Voicemail","no_answer"=>"No Answer","callback"=>"Callback requested"][$outcome] ?? $outcome;
    $desc = "Call logged: {$outcomeLabel}" . ($notes ? " — {$notes}" : "");
    DB::execute(
        "INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description) VALUES (?,?,?,?,?,?)",
        [$tenantId, $userId, "contact", $contactId, "call", $desc]
    );
    Response::success(null, "Call logged");
} elseif ($method === "GET") {
    $contactId = (int)($_GET["contact_id"] ?? 0);
    if (!$contactId) Response::error("Contact ID required");
    $calls = DB::query(
        "SELECT cl.*, u.name as agent_name FROM call_log cl LEFT JOIN users u ON u.id = cl.user_id WHERE cl.tenant_id = ? AND cl.contact_id = ? ORDER BY cl.created_at DESC LIMIT 20",
        [$tenantId, $contactId]
    );
    Response::success($calls);
} else {
    Response::error("Method not allowed", 405);
}
