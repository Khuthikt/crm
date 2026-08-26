<?php
// Auto-notification triggers — called after key actions
// Run daily: 0 7 * * * php /var/www/html/crm/scripts/auto_notifications.php

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';

$today = date('Y-m-d');
$in60  = date('Y-m-d', strtotime('+60 days'));
$in30  = date('Y-m-d', strtotime('+30 days'));
$in7   = date('Y-m-d', strtotime('+7 days'));

// Get all tenants
$tenants = DB::query('SELECT DISTINCT tenant_id FROM leases WHERE status = ?', ['active']);

foreach ($tenants as $tenant) {
    $tenantId = $tenant['tenant_id'];

    // Get users to notify (super_admin, admin, finance_admin)
    $managers = DB::query(
        "SELECT id FROM users WHERE tenant_id = ? AND role IN ('super_admin','admin','finance_admin') AND is_active = 1",
        [$tenantId]
    );

    // Find expiring leases at specific thresholds only (60, 30, 7 days)
    $expiring = DB::query(
        "SELECT l.*, 
                DATEDIFF(l.end_date, CURDATE()) as days_left
           FROM leases l
          WHERE l.tenant_id = ?
            AND l.status = 'active'
            AND DATEDIFF(l.end_date, CURDATE()) IN (60, 30, 14, 7, 3, 1)",
        [$tenantId]
    );

    foreach ($expiring as $lease) {
        $days = $lease['days_left'];
        $title = "Lease {$lease['ref']} expiring in {$days} days";
        $body  = "Tenant: {$lease['tenant_name']} · Property: {$lease['property']} · Expires: {$lease['end_date']}";

        // Notify all managers
        foreach ($managers as $mgr) {
            // Check if already notified today for this lease+days combo
            $exists = DB::queryOne(
                "SELECT id FROM notifications 
                  WHERE tenant_id=? AND user_id=? AND entity_type='lease' AND entity_id=? 
                    AND title=?",
                [$tenantId, $mgr['id'], $lease['id'], $title]
            );
            if ($exists) continue;

            DB::execute(
                'INSERT INTO notifications (tenant_id, user_id, type, title, message, entity_type, entity_id, is_read)
                 VALUES (?,?,?,?,?,?,?,0)',
                [$tenantId, $mgr['id'], 'lease_expiry', $title, $body, 'lease', $lease['id']]
            );
        }

        // Also notify assigned agent if any
        if ($lease['assigned_to']) {
            $exists = DB::queryOne(
                "SELECT id FROM notifications 
                  WHERE tenant_id=? AND user_id=? AND entity_type='lease' AND entity_id=? 
                    AND title=?",
                [$tenantId, $lease['assigned_to'], $lease['id'], $title]
            );
            if (!$exists) {
                DB::execute(
                    'INSERT INTO notifications (tenant_id, user_id, type, title, message, entity_type, entity_id, is_read)
                     VALUES (?,?,?,?,?,?,?,0)',
                    [$tenantId, $lease['assigned_to'], 'lease_expiry', $title, $body, 'lease', $lease['id']]
                );
            }
        }
    }
}

echo "Auto-notifications processed for " . count($tenants) . " tenant(s)
";
