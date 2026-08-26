<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/response.php';

Auth::logout();
Response::success(null, 'Logged out');
