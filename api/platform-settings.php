<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
if ($user['role'] !== 'platform_superadmin') Response::error('Unauthorised', 403);

$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'GET') {
    $rows = DB::query('SELECT setting_key, setting_value FROM platform_settings ORDER BY setting_key');
    $settings = [];
    foreach ($rows as $r) $settings[$r['setting_key']] = $r['setting_value'];

    // Get system stats
    $stats = [
        'total_tenants'  => DB::queryOne('SELECT COUNT(*) AS c FROM tenants')['c'],
        'active_tenants' => DB::queryOne("SELECT COUNT(*) AS c FROM tenants WHERE status='active'")['c'],
        'total_users'    => DB::queryOne('SELECT COUNT(*) AS c FROM users WHERE is_active=1')['c'],
        'total_contacts' => DB::queryOne('SELECT COUNT(*) AS c FROM contacts')['c'],
        'total_invoices' => DB::queryOne('SELECT COUNT(*) AS c FROM invoices')['c'],
        'open_tickets'   => DB::queryOne("SELECT COUNT(*) AS c FROM support_tickets WHERE status='open'")['c'],
        'recent_tickets' => DB::query("SELECT st.*, t.name AS tenant_name FROM support_tickets st JOIN tenants t ON t.id = st.tenant_id ORDER BY st.created_at DESC LIMIT 5"),
        'health_latest'  => DB::query("SELECT h1.* FROM system_health h1 INNER JOIN (SELECT metric, MAX(checked_at) AS mc FROM system_health GROUP BY metric) h2 ON h1.metric=h2.metric AND h1.checked_at=h2.mc"),
        'tenants'        => DB::query("SELECT t.*, (SELECT COUNT(*) FROM users u WHERE u.tenant_id=t.id AND u.is_active=1) AS user_count, (SELECT COUNT(*) FROM contacts c WHERE c.tenant_id=t.id) AS contact_count FROM tenants t ORDER BY t.created_at DESC"),
    ];
    Response::success(['settings' => $settings, 'stats' => $stats]);
}

if ($method === 'POST') {
    $allowed = ['alert_email','hulisa_logo_url','hulisa_company_name','hulisa_email','hulisa_phone','hulisa_address','hulisa_vat_number','hulisa_reg_number','hulisa_primary_colour','hulisa_accent_colour','hulisa_bank_name','hulisa_bank_account','hulisa_bank_branch','hulisa_bank_type','hulisa_email_signature','health_disk_warning','health_disk_critical',
                'health_memory_warning','health_memory_critical',
                'health_api_warning','health_api_critical',
                'health_db_warning','health_db_critical',
                'session_timeout_hours','max_login_attempts',
                'smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','smtp_name','maintenance_mode','maintenance_message','maintenance_start','maintenance_end','system_version','system_update_notes','system_update_date'];
    foreach ($body as $key => $value) {
        if (!in_array($key, $allowed)) continue;
        DB::execute(
            'INSERT INTO platform_settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=?',
            [$key, $value, $value]
        );
    }
    Response::success(null, 'Platform settings saved');
}

if ($method === 'DELETE') {
    $action = $body['action'] ?? '';
    if ($action === 'clear_sessions') {
        $count = DB::execute("DELETE FROM sessions WHERE expires_at < NOW()");
        Response::success(['deleted' => $count], 'Expired sessions cleared');
    }
    Response::error('Unknown action');
}
