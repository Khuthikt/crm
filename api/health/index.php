<?php
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
if ($user['role'] !== 'platform_superadmin') Response::error('Unauthorised', 403);

$latest = DB::query(
    "SELECT h1.* FROM system_health h1
     INNER JOIN (
       SELECT metric, MAX(checked_at) AS max_checked
       FROM system_health GROUP BY metric
     ) h2 ON h1.metric = h2.metric AND h1.checked_at = h2.max_checked
     ORDER BY h1.metric ASC"
);

$history = DB::query(
    "SELECT metric, value, status, checked_at
     FROM system_health
     WHERE checked_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ORDER BY checked_at ASC"
);

$lastCheck = DB::queryOne("SELECT MAX(checked_at) AS t FROM system_health")['t'];

Response::success([
    'latest'     => $latest,
    'history'    => $history,
    'last_check' => $lastCheck,
]);
