<?php
// ============================================================
//  CRM CONFIG — Edit these values for your environment
//  Local (XAMPP): use the LOCAL section
//  Live (Afrihost VPS): use the LIVE section
// ============================================================

// ── ENVIRONMENT ─────────────────────────────────────────────
// Change to 'production' when going live
define('APP_ENV', 'production');

// ── DATABASE ─────────────────────────────────────────────────
// LOCAL (XAMPP): user=root, pass=''
// LIVE (VPS):    user=crm_user, pass=your chosen password
define('DB_HOST',    getenv('CRM_DB_HOST') ?: 'localhost');
define('DB_NAME',    getenv('CRM_DB_NAME') ?: 'crm_db');
define('DB_USER',    getenv('CRM_DB_USER') ?: 'crm_user');       // Change to 'crm_user' on live server
define('DB_PASS',    getenv('CRM_DB_PASS') ?: 'your_db_password');           // Change to your password on live server
define('DB_CHARSET', 'utf8mb4');

// ── APP ──────────────────────────────────────────────────────
define('APP_NAME', 'Property CRM');
// LOCAL:  'http://localhost/crm'
// LIVE:   'https://crm.hulisa.co.za'  (your actual domain)
define('APP_URL', 'https://yourdomain.com');

// ── SESSION ──────────────────────────────────────────────────
define('SESSION_LIFETIME', 60 * 60 * 8);   // 8 hours
define('SESSION_COOKIE',   'crm_session');

// ── FILE STORAGE (Local Server) ──────────────────────────────
// Files are stored in the /uploads/ folder on the server
// LOCAL:  point to your XAMPP htdocs path
// LIVE:   point to your VPS web root path
define('UPLOAD_PATH', __DIR__ . '/../uploads/');   // Filesystem path (with trailing slash)
define('UPLOAD_URL',  APP_URL . '/uploads/');       // Public URL (with trailing slash)

// ── FILE LIMITS ───────────────────────────────────────────────
define('MAX_FILE_SIZE', 10 * 1024 * 1024);  // 10MB per file

define('ALLOWED_DOC_TYPES', [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

define('ALLOWED_IMG_TYPES', [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);

// ── EMAIL (SMTP via Brevo) ────────────────────────────────────
// Leave blank for now — configure when ready to send emails
define('SMTP_HOST',  'smtp-relay.brevo.com');
define('SMTP_PORT',  587);
define('SMTP_USER',  '');   // Your Brevo login email
define('SMTP_PASS',  '');   // Your Brevo SMTP key
define('SMTP_FROM',  'noreply@hulisa.co.za');
define('SMTP_NAME',  'Property CRM');

// ── ERROR REPORTING ───────────────────────────────────────────
if (APP_ENV === 'production') {
    error_reporting(0);
    ini_set('display_errors', 0);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}
