<?php
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/mailer.php';
require_once __DIR__ . '/../includes/crypto.php';
require_once __DIR__ . '/../includes/ics.php';

// Find all unsent reminders due now or in the past
$reminders = DB::query(
    "SELECT r.*, c.name as contact_name, u.email as user_email, u.name as user_name
      FROM contact_reminders r
      LEFT JOIN contacts c ON c.id = r.contact_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.is_sent = 0 AND r.remind_at <= NOW()",
    []
);

foreach ($reminders as $r) {
    // Get tenant SMTP settings
    $rows = DB::query(
        'SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?',
        [$r['tenant_id']]
    );
    $settings = [];
    foreach ($rows as $row) $settings[$row['setting_key']] = $row['setting_value'];

    if (empty($settings['smtp_host']) || empty($settings['smtp_user'])) continue;
    if (empty($r['user_email'])) { DB::execute('UPDATE contact_reminders SET is_sent = 1 WHERE id = ?', [$r['id']]); echo "Skipped reminder {$r['id']} — no user email
"; continue; }

    $subject = '[Reminder] ' . $r['type'] . ' — ' . $r['contact_name'];
    $content = "
        <h3 style='margin:0 0 16px'>Reminder: {$r['type']}</h3>
        <p><strong>Contact:</strong> {$r['contact_name']}</p>
        <p><strong>Scheduled:</strong> {$r['remind_at']}</p>
        " . ($r['note'] ? "<p><strong>Note:</strong> {$r['note']}</p>" : '') . "
        <p style='margin-top:24px;color:#666;font-size:12px'>This reminder was set in your Property CRM.</p>
    ";
    $html = Mailer::htmlWrap($content, $settings['smtp_name'] ?? 'Property CRM');
    $sent = Mailer::send($settings, $r['user_email'], $r['user_name'], $subject, $html);

    if ($sent) {
        DB::execute('UPDATE contact_reminders SET is_sent = 1 WHERE id = ?', [$r['id']]);
        echo "Sent reminder {$r['id']} to {$r['user_email']}\n";
    } else {
        echo "Failed reminder {$r['id']} to {$r['user_email']}\n";
    }
}
echo "Done\n";
