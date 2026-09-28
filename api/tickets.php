<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/mailer.php';

$user     = Auth::user();
if (!$user) Response::unauthorized();
$tenantId = (int)($user['tenant_id'] ?? 0);
$method   = $_SERVER['REQUEST_METHOD'];
$body     = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method) {
    case 'GET':
        // Platform admin sees all tickets, clients see their own
        if ($user['role'] === 'platform_superadmin') {
            $tickets = DB::query(
                "SELECT st.*, u.name AS created_by_name, t.name AS tenant_name
                   FROM support_tickets st
                   JOIN users u ON u.id = st.created_by
                   JOIN tenants t ON t.id = st.tenant_id
                  ORDER BY FIELD(st.status,'open','in_progress','resolved','closed'),
                           FIELD(st.priority,'critical','high','medium','low'),
                           st.created_at DESC"
            );
        } else {
            $tickets = DB::query(
                "SELECT st.*, u.name AS created_by_name
                   FROM support_tickets st
                   JOIN users u ON u.id = st.created_by
                  WHERE st.tenant_id = ?
                  ORDER BY st.created_at DESC",
                [$tenantId]
            );
        }
        Response::success($tickets);
        break;

    case 'POST':
        try {
        $subject  = trim($body['subject'] ?? '');
        $desc     = trim($body['description'] ?? '');
        $priority = $body['priority'] ?? 'medium';
        if (!$subject || !$desc) Response::error('Subject and description are required');

        $ticketId = DB::insert(
            'INSERT INTO support_tickets (tenant_id, created_by, subject, description, priority)
             VALUES (?,?,?,?,?)',
            [$tenantId, (int)($user['user_id'] ?? $user['id']), $subject, $desc, $priority]
        );
        $ref = 'TKT-' . str_pad($ticketId, 4, '0', STR_PAD_LEFT);

        // Email Hulisa — wrapped in try/catch so ticket saves even if email fails
        try {
        $smtpSettings = DB::query("SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = 1");
        $settings = [];
        foreach ($smtpSettings as $s) { $settings[$s['setting_key']] = $s['setting_value']; }
        $priorityColor = ['low'=>'#6B7280','medium'=>'#1DB8A0','high'=>'#D97706','critical'=>'#DC2626'];
        $emailBody = "
            <h2>New Support Ticket - {$ref}</h2>
            <table style='width:100%;border-collapse:collapse'>
              <tr><td style='padding:8px;font-weight:600;width:120px'>From</td><td style='padding:8px'>{$user['name']}</td></tr>
              <tr style='background:#f9f9f9'><td style='padding:8px;font-weight:600'>Priority</td><td style='padding:8px'><span style='color:{$priorityColor[$priority]};font-weight:600;text-transform:uppercase'>{$priority}</span></td></tr>
              <tr><td style='padding:8px;font-weight:600'>Subject</td><td style='padding:8px'>{$subject}</td></tr>
              <tr style='background:#f9f9f9'><td style='padding:8px;font-weight:600;vertical-align:top'>Description</td><td style='padding:8px'>" . nl2br(htmlspecialchars($desc)) . "</td></tr>
            </table>
            <p style='margin-top:20px;color:#6B7280;font-size:12px'>Ticket ID: {$ref} · Submitted: " . date('d M Y H:i') . "</p>
        ";
        Mailer::send($settings, 'khuthadzo@hulisa.co.za', 'Khuthadzo', "Support Ticket [{$ref}] - {$subject}", $emailBody);
        } catch (\Exception $e) { /* email failed — ticket still saved */ }

        Response::success(['id' => $ticketId, 'ref' => $ref], 'Ticket submitted successfully');
        } catch (\Throwable $e) { Response::error('Server error: ' . $e->getMessage()); }
        break;

    case 'PUT':
        // Platform admin can update status
        Auth::requireRole($user, ['platform_superadmin']);
        $id     = (int)($_GET['id'] ?? 0);
        $status = $body['status'] ?? '';
        if (!$id || !$status) Response::error('ID and status required');
        DB::execute('UPDATE support_tickets SET status = ? WHERE id = ?', [$status, $id]);
        Response::success(null, 'Ticket updated');
        break;
}
