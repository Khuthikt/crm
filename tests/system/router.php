<?php
/**
 * Router for `php -S` used by the isolated test stack. PHP's built-in
 * server invokes the given script for EVERY request when one is supplied,
 * unlike Apache's ".htaccess" `RewriteCond %{REQUEST_FILENAME} !-f`, which
 * serves real files directly and only falls through to the front
 * controller for paths that don't exist on disk. Without this, static
 * assets (css/js) and any real file get swallowed by index.php's SPA
 * fallback. This mirrors both behaviours: existing files are served
 * as-is (except for the same sensitive paths .htaccess now blocks on
 * production), everything else goes to index.php.
 */
// The app lives in a /crm subdirectory of Apache's real DocumentRoot
// (/var/www/html) in production — URLs like /crm/assets/js/app.js map to
// /var/www/html/crm/assets/js/app.js on disk. Match that here so static
// asset resolution mirrors production instead of the app's own root.
$docRoot = '/var/www/html';
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

foreach (['/crm/tests/', '/crm/scripts/', '/crm/vendor/', '/crm/includes/'] as $blocked) {
    if (str_starts_with($uri, $blocked)) {
        http_response_code(403);
        echo 'Forbidden';
        return true;
    }
}
$ext = strtolower(pathinfo($uri, PATHINFO_EXTENSION));
if (in_array($ext, ['sql', 'md', 'log', 'lock', 'sh'], true) || basename($uri) === 'composer.json') {
    http_response_code(403);
    echo 'Forbidden';
    return true;
}

$file = realpath($docRoot . $uri);
if ($uri !== '/' && $file && is_file($file) && str_starts_with($file, $docRoot)) {
    return false; // let the built-in server serve/execute it directly
}

require '/var/www/html/crm/index.php';
