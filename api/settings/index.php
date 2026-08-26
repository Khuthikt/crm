<?php
error_reporting(0);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
$tenantId = (int)$user['tenant_id'];
if (!$tenantId) Response::error('No tenant assigned');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Get all settings for tenant
    $rows = DB::query(
        'SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?',
        [$tenantId]
    );
    $settings = [];
    foreach ($rows as $row) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }

    // Get bank accounts from tenants table
    $tenant = DB::queryOne('SELECT * FROM tenants WHERE id = ?', [$tenantId]);
    $banks  = [];
    if ($tenant && $tenant['bank_name']) {
        $banks[] = [
            'id'           => 1,
            'bank_company' => $tenant['bank_company'],
            'bank_name'    => $tenant['bank_name'],
            'bank_account' => $tenant['bank_account'],
            'bank_type'    => $tenant['bank_type'],
            'bank_branch'  => $tenant['bank_branch'],
            'bank_swift'   => $tenant['bank_swift'],
            'bank_category'=> 'Primary',
        ];
    }

    // Also get from tenant_settings bank_accounts key
    $banksJson = $settings['bank_accounts'] ?? '[]';
    $extraBanks = json_decode($banksJson, true) ?: [];
    $banks = array_merge($banks, $extraBanks);

    Response::success(['settings' => $settings, 'banks' => $banks]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $type = $body['type'] ?? '';

    switch ($type) {
        case 'company':
            $data = $body['data'] ?? [];
            foreach ($data as $key => $value) {
                $allowed = ['company_name','website','phone','email','address',
                           'vat_number','reg_number','logo_url','pipeline_stages',
                           'primary_colour','accent_colour'];
                if (!in_array($key, $allowed)) continue;
                DB::execute(
                    'INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
                     VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value = ?',
                    [$tenantId, $key, $value, $value]
                );
            }
            // Update tenant name if company_name provided
            if (isset($data['company_name'])) {
                DB::execute('UPDATE tenants SET name = ? WHERE id = ?',
                    [$data['company_name'], $tenantId]);
            }
            Response::success(null, 'Settings saved');
            break;

        case 'smtp':
            $data = $body['data'] ?? [];
            foreach (['smtp_host','smtp_port','smtp_user','smtp_from'] as $key) {
                if (isset($data[$key])) {
                    DB::execute(
                        'INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
                         VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value = ?',
                        [$tenantId, $key, $data[$key], $data[$key]]
                    );
                }
            }
            // Only save password if provided
            if (!empty($data['smtp_pass'])) {
                DB::execute(
                    'INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
                     VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value = ?',
                    [$tenantId, 'smtp_pass', $data['smtp_pass'], $data['smtp_pass']]
                );
            }
            Response::success(null, 'SMTP settings saved');
            break;

        case 'bank':
            $data    = $body['data']    ?? [];
            $bankId  = $body['bank_id'] ?? null;

            // Get existing banks
            $banksJson = DB::queryOne(
                'SELECT setting_value FROM tenant_settings WHERE tenant_id = ? AND setting_key = ?',
                [$tenantId, 'bank_accounts']
            );
            $banks = $banksJson ? json_decode($banksJson['setting_value'], true) : [];

            if ($bankId) {
                // Update existing
                foreach ($banks as &$b) {
                    if ($b['id'] == $bankId) {
                        $b = array_merge($b, $data);
                        break;
                    }
                }
            } else {
                // Add new
                $data['id'] = time();
                $banks[] = $data;
            }

            DB::execute(
                'INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
                 VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [$tenantId, 'bank_accounts', json_encode($banks), json_encode($banks)]
            );
            Response::success(null, 'Bank account saved');
            break;

        case 'delete_bank':
            $bankId    = $body['bank_id'] ?? null;
            $banksJson = DB::queryOne(
                'SELECT setting_value FROM tenant_settings WHERE tenant_id = ? AND setting_key = ?',
                [$tenantId, 'bank_accounts']
            );
            $banks = $banksJson ? json_decode($banksJson['setting_value'], true) : [];
            $banks = array_values(array_filter($banks, fn($b) => $b['id'] != $bankId));
            DB::execute(
                'INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
                 VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [$tenantId, 'bank_accounts', json_encode($banks), json_encode($banks)]
            );
            Response::success(null, 'Bank account deleted');
            break;

        default:
            Response::error('Unknown settings type');
    }
}
