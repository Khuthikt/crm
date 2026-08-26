<?php
// Lease expiry notification script
// Run daily via cron: 0 8 * * * php /var/www/html/crm/scripts/lease_notifications.php

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/mailer.php';

$today = date('Y-m-d');
$in60  = date('Y-m-d', strtotime('+60 days'));
$in30  = date('Y-m-d', strtotime('+30 days'));
$in7   = date('Y-m-d', strtotime('+7 days'));

// Find expiring leases
$leases = DB::query(
    "SELECT l.*, t.name AS tenant_name, t.email AS tenant_email,
            ld.name AS landlord_name, ld.email AS landlord_email,
            ts.setting_value AS company_name
       FROM leases l
  LEFT JOIN contacts t  ON t.id = l.tenant_id
  LEFT JOIN contacts ld ON ld.id = l.landlord_id
  LEFT JOIN tenant_settings ts ON ts.tenant_id = l.tenant_id AND ts.setting_key = 'company_name'
      WHERE l.status = 'active'
        AND l.end_date BETWEEN ? AND ?
        AND l.tenant_id > 0",
    [$today, $in60]
);

$sent = 0;
foreach ($leases as $lease) {
    $daysLeft = (int)((strtotime($lease['end_date']) - time()) / 86400);
    
    // Only send at 60, 30, 7 days
    if (!in_array($lease['end_date'], [$in60, $in30, $in7])) continue;

    $subject = "Lease Expiry Notice — {$lease['ref']} expires in {$daysLeft} days";
    $body    = "Dear {$lease['landlord_name']},

"
             . "This is a reminder that lease {$lease['ref']} for {$lease['tenant_name']} "
             . "expires on {$lease['end_date']} ({$daysLeft} days remaining).

"
             . "Please arrange renewal or termination before the expiry date.

"
             . "Regards,
{$lease['company_name']}";

    // Log notification
    DB::execute(
        'INSERT INTO notifications (tenant_id, type, title, body, entity_type, entity_id)
         VALUES (?,?,?,?,?,?)',
        [$lease['tenant_id'], 'lease_expiry', $subject, $body, 'lease', $lease['id']]
    );
    
    // TODO: Send email via SMTP when configured
    $sent++;
    
    // Send email to tenant if email exists
    $settings = Mailer::getSettings($lease['tenant_id']);
    $compName = $settings['company_name'] ?? 'Property Management';
    if (!empty($lease['tenant_email'])) {
        $subject = "Lease Renewal Notice — {$lease['ref']}";
        $content = "
        <h2>Lease Expiry Notice</h2>
        <p>Dear {$lease['tenant_name']},</p>
        <p>Your lease <strong>{$lease['ref']}</strong> for <strong>{$lease['property']}</strong> 
        is expiring on <strong>{$lease['end_date']}</strong> ({$daysLeft} days remaining).</p>
        <p>Please contact us to arrange renewal or termination before the expiry date.</p>
        <p>Regards,<br><strong>{$compName}</strong></p>";
        Mailer::send($settings, $lease['tenant_email'], $lease['tenant_name'], $subject, Mailer::htmlWrap($content, $compName));
    }
}

echo "Processed {$sent} lease expiry notifications
";
