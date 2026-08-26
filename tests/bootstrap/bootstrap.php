<?php
/**
 * PHPUnit bootstrap: seeds the isolated test database and boots a
 * throwaway PHP built-in server so tests exercise the real HTTP/API
 * layer (endpoints call exit()/header(), so in-process require() is
 * not viable).
 */

require __DIR__ . '/../../vendor/autoload.php';
require __DIR__ . '/seed.php';

if (getenv('CRM_DB_NAME') !== 'crm_db_test') {
    fwrite(STDERR, "\nRefusing to run: CRM_DB_NAME must be 'crm_db_test' (see phpunit.xml). Aborting to protect production data.\n");
    exit(1);
}

$GLOBALS['__crm_fixtures'] = seed_run();

$docRoot = dirname(__DIR__, 2);
$baseUrl = getenv('CRM_BASE_URL') ?: 'http://127.0.0.1:8199';
$parts   = parse_url($baseUrl);
$host    = $parts['host'];
$port    = $parts['port'];

$env = [];
foreach ($_ENV + $_SERVER as $k => $v) {
    if (is_string($v)) $env[$k] = $v;
}
foreach (['CRM_DB_HOST', 'CRM_DB_NAME', 'CRM_DB_USER', 'CRM_DB_PASS'] as $k) {
    $val = getenv($k);
    if ($val !== false) $env[$k] = $val;
}

$logFile = sys_get_temp_dir() . '/crm_test_server.log';
$descriptors = [
    0 => ['pipe', 'r'],
    1 => ['file', $logFile, 'a'],
    2 => ['file', $logFile, 'a'],
];

$cmd = sprintf(
    'exec php -S %s:%d -t %s %s',
    escapeshellarg($host),
    $port,
    escapeshellarg($docRoot),
    escapeshellarg($docRoot . '/index.php')
);

$process = proc_open($cmd, $descriptors, $pipes, $docRoot, $env);
if (!is_resource($process)) {
    fwrite(STDERR, "Failed to start PHP built-in server for tests.\n");
    exit(1);
}

// Wait for the server to accept connections.
$ready = false;
for ($i = 0; $i < 100; $i++) {
    $sock = @fsockopen($host, $port, $errno, $errstr, 0.2);
    if ($sock) {
        fclose($sock);
        $ready = true;
        break;
    }
    usleep(100000);
}
if (!$ready) {
    fwrite(STDERR, "Test PHP server never became ready on $host:$port. Log:\n" . @file_get_contents($logFile) . "\n");
    exit(1);
}

register_shutdown_function(function () use ($process) {
    if (is_resource($process)) {
        proc_terminate($process, 15);
    }
});
