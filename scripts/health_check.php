<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';

$checks = [];

// ── 1. DB Response Time ─────────────────────────────────────
$start = microtime(true);
DB::queryOne('SELECT COUNT(*) AS c FROM contacts');
$dbMs = round((microtime(true) - $start) * 1000, 2);
$checks[] = [
    'metric'  => 'db_response_ms',
    'value'   => $dbMs,
    'status'  => $dbMs < 100 ? 'ok' : ($dbMs < 500 ? 'warning' : 'critical'),
    'message' => "DB query took {$dbMs}ms",
];

// ── 2. API Response Time ────────────────────────────────────
$start = microtime(true);
$ch = curl_init(APP_URL . '/api/dashboard/index.php');
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false]);
curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$apiMs = round((microtime(true) - $start) * 1000, 2);
curl_close($ch);
$checks[] = [
    'metric'  => 'api_response_ms',
    'value'   => $apiMs,
    'status'  => $apiMs < 500 ? 'ok' : ($apiMs < 2000 ? 'warning' : 'critical'),
    'message' => "API responded in {$apiMs}ms (HTTP {$httpCode})",
];

// ── 3. Disk Space ───────────────────────────────────────────
$free  = disk_free_space('/');
$total = disk_total_space('/');
$usedPct = round((($total - $free) / $total) * 100, 1);
$checks[] = [
    'metric'  => 'disk_used_pct',
    'value'   => $usedPct,
    'status'  => $usedPct < 75 ? 'ok' : ($usedPct < 90 ? 'warning' : 'critical'),
    'message' => "Disk {$usedPct}% used (" . round($free / 1073741824, 2) . "GB free)",
];

// ── 4. Memory Usage ─────────────────────────────────────────
$memInfo = file_get_contents('/proc/meminfo');
preg_match('/MemTotal:\s+(\d+)/', $memInfo, $total);
preg_match('/MemAvailable:\s+(\d+)/', $memInfo, $avail);
$memUsedPct = round((($total[1] - $avail[1]) / $total[1]) * 100, 1);
$checks[] = [
    'metric'  => 'memory_used_pct',
    'value'   => $memUsedPct,
    'status'  => $memUsedPct < 75 ? 'ok' : ($memUsedPct < 90 ? 'warning' : 'critical'),
    'message' => "Memory {$memUsedPct}% used",
];

// ── 5. PHP Error Log ────────────────────────────────────────
$errorLog = '/var/log/apache2/error.log';
$recentErrors = 0;
if (file_exists($errorLog)) {
    $lines = array_filter(explode("\n", shell_exec("tail -200 {$errorLog} 2>/dev/null")));
    foreach ($lines as $line) {
        // Only count real CRM errors — skip external probes (script not found)
        if ((strpos($line, '[php:error]') !== false || strpos($line, 'PHP Fatal') !== false)
            && strpos($line, 'not found or unable to stat') === false
            && strpos($line, '/var/www/html/crm/') !== false) {
            $recentErrors++;
        }
    }
}
$checks[] = [
    'metric'  => 'php_errors_1h',
    'value'   => $recentErrors,
    'status'  => $recentErrors === 0 ? 'ok' : ($recentErrors < 5 ? 'warning' : 'critical'),
    'message' => "{$recentErrors} PHP errors in CRM application (last 200 log lines)",
];

// ── 6. Active Sessions ──────────────────────────────────────
$activeSessions = DB::queryOne("SELECT COUNT(*) AS c FROM sessions WHERE expires_at > NOW()")['c'];
$checks[] = [
    'metric'  => 'active_sessions',
    'value'   => $activeSessions,
    'status'  => 'ok',
    'message' => "{$activeSessions} active sessions",
];

// ── 7. Overdue Invoices (informational only — not a health indicator) ──
$overdue = DB::queryOne("SELECT COUNT(*) AS c FROM invoices WHERE status = 'overdue'")['c'];
$checks[] = [
    'metric'  => 'overdue_invoices',
    'value'   => $overdue,
    'status'  => 'ok',
    'message' => "{$overdue} overdue invoices across all tenants (business metric — not a system issue)",
];

// ── Store results ───────────────────────────────────────────
$now = date('Y-m-d H:i:s');
foreach ($checks as $check) {
    DB::execute(
        'INSERT INTO system_health (checked_at, metric, value, status, message) VALUES (?,?,?,?,?)',
        [$now, $check['metric'], $check['value'], $check['status'], $check['message']]
    );
}

// ── Send alert email if any critical ───────────────────────
$criticals = array_filter($checks, fn($c) => $c['status'] === 'critical');
if ($criticals) {
    require_once __DIR__ . '/../includes/mailer.php';
    $alertBody = "<h2>&#9888;&#65039; CRM System Alert</h2><p>The following critical issues were detected at {$now}:</p><ul>";
    foreach ($criticals as $c) {
        $alertBody .= "<li><strong>{$c['metric']}</strong>: {$c['message']}</li>";
    }
    $alertBody .= "</ul>";
    // Get platform SMTP settings
    $alertSettings = DB::query('SELECT setting_key, setting_value FROM platform_settings WHERE setting_key LIKE \'smtp%\'', []);
    $smtp = [];
    foreach ($alertSettings as $r) $smtp[$r['setting_key']] = $r['setting_value'];
    if (!empty($smtp['smtp_host'])) {
        Mailer::send($smtp, 'khuthadzo@hulisa.co.za', 'Hulisa Admin', 'CRM System Alert — Action Required', $alertBody);
    }
}

// ── Clean old records (keep 7 days) ────────────────────────
DB::execute("DELETE FROM system_health WHERE checked_at < DATE_SUB(NOW(), INTERVAL 7 DAY)");

$critical_count = count(array_filter($checks, fn($c) => $c['status'] === 'critical'));
$warning_count  = count(array_filter($checks, fn($c) => $c['status'] === 'warning'));
echo date('Y-m-d H:i:s') . " — Health check done. {$critical_count} critical, {$warning_count} warnings.\n";
