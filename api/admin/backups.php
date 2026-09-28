<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user || $user["role"] !== "platform_superadmin") Response::error("Unauthorised", 403);

$action = $_GET["action"] ?? "list";

if ($action === "list") {
    $backupDir = "/var/backups/crm/db";
    $files = glob($backupDir . "/*.sql.gz") ?: [];
    rsort($files);
    $backups = array_map(function($f) {
        return [
            "filename" => basename($f),
            "size_hr"  => round(filesize($f) / 1048576, 2) . " MB",
            "date"     => date("Y-m-d H:i:s", filemtime($f)),
            "date_hr"  => date("d M Y", filemtime($f)),
        ];
    }, $files);
    $logFile = "/var/log/crm_backup.log";
    $lastLog = file_exists($logFile) ? shell_exec("tail -5 " . escapeshellarg($logFile)) : "No log found";
    Response::success(["backups" => $backups, "last_log" => trim($lastLog)]);
    exit;
}

if ($action === "trigger") {
    $output = shell_exec("bash /var/www/html/crm/scripts/backup.sh 2>&1");
    Response::success(["output" => $output], "Backup triggered");
    exit;
}

Response::error("Invalid action", 400);
