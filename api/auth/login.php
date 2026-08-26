<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$body = json_decode(file_get_contents('php://input'), true);
$username = trim($body['username'] ?? '');
$password  = $body['password'] ?? '';

if (!$username || !$password) {
    Response::error('Username and password are required');
}

$result = Auth::login($username, $password);

if (!$result['ok']) {
    Response::error($result['error'], 401);
}

$user = $result['user'];

Response::success([
    'user' => [
        'id'          => $user['id'],
        'name'        => $user['name'],
        'email'       => $user['email'],
        'username'    => $user['username'],
        'role'        => $user['role'],
        'tenant_id'   => $user['tenant_id'],
        'tenant_name' => $user['tenant_name'] ?? null,
        'avatar_url'  => $user['avatar_url'],
    ]
], 'Login successful');
