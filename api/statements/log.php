<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
$tenantId = (int)$user['tenant_id'];

$rows = DB::query(
    'SELECT s.*, l.ref as lease_ref, l.tenant_name, l.property
     FROM statement_log s
     LEFT JOIN leases l ON l.id = s.lease_id
     WHERE s.tenant_id = ?
     ORDER BY s.created_at DESC LIMIT 100',
    [$tenantId]
);
Response::success($rows);
