<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';
$user = Auth::user();
if (!$user) Response::unauthorized();
Response::success(['user_id' => $user['user_id'] ?? $user['id']]);
