<?php
require_once __DIR__ . '/db.php';

class Maintenance {
    public static function isActive(): bool {
        $row = DB::queryOne("SELECT setting_value FROM platform_settings WHERE setting_key='maintenance_mode'");
        return ($row['setting_value'] ?? '0') === '1';
    }

    public static function getMessage(): string {
        $row = DB::queryOne("SELECT setting_value FROM platform_settings WHERE setting_key='maintenance_message'");
        return $row['setting_value'] ?? 'The system is currently undergoing scheduled maintenance.';
    }

    public static function checkAndBlock(array $user): void {
        if (!self::isActive()) return;
        if (($user['role'] ?? '') === 'platform_superadmin') return;
        // Block all other users
        http_response_code(503);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error'   => 'maintenance',
            'message' => self::getMessage()
        ]);
        exit;
    }
}
