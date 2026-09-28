<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/mailer.php';
require_once __DIR__ . '/../../includes/crypto.php';

$user     = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = (int)$user['tenant_id'];
$userId   = (int)($user['user_id'] ?? $user['id']);
$userName = $user['name'] ?? 'Unknown';
$method   = $_SERVER['REQUEST_METHOD'];
$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {
    case 'GET':
        if ($id) {
            // Platform superadmin can access any tenant's ticket
            if ($user['role'] === 'platform_superadmin') {
                $ticket = DB::queryOne(
                    'SELECT t.*, u.name as user_name, u.email as user_email, ten.name as tenant_name
                     FROM support_tickets t
                     LEFT JOIN users u ON u.id = t.user_id
                     LEFT JOIN tenants ten ON ten.id = t.tenant_id
                     WHERE t.id = ?',
                    [$id]
                );
            } else {
                $ticket = DB::queryOne(
                    'SELECT t.*, u.name as user_name, u.email as user_email
                     FROM support_tickets t
                     LEFT JOIN users u ON u.id = t.user_id
                     WHERE t.id = ? AND t.tenant_id = ?',
                    [$id, $tenantId]
                );
            }
            if (!$ticket) Response::notFound('Ticket not found');
            $replies = DB::query(
                'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
                [$id]
            );
            $ticket['replies'] = $replies;
            Response::success($ticket);
        }
        // List tickets — platform superadmin sees all tenants
        if ($user['role'] === 'platform_superadmin') {
            $tickets = DB::query(
                'SELECT t.*, u.name as user_name, ten.name as tenant_name
                 FROM support_tickets t
                 LEFT JOIN users u ON u.id = t.user_id
                 LEFT JOIN tenants ten ON ten.id = t.tenant_id
                 ORDER BY t.created_at DESC',
                []
            );
        } else {
            $tickets = DB::query(
                'SELECT t.*, u.name as user_name FROM support_tickets t
                 LEFT JOIN users u ON u.id = t.user_id
                 WHERE t.tenant_id = ? ORDER BY t.created_at DESC',
                [$tenantId]
            );
        }
        Response::success($tickets);
        break;

    case 'POST':
        $action = $body['action'] ?? 'create';

        if ($action === 'reply') {
            // Add reply to ticket
            if (!$id) Response::error('Ticket ID required');
            $message = trim($body['message'] ?? '');
            if (!$message) Response::error('Message required');

            if ($user['role'] === 'platform_superadmin') {
                $ticket = DB::queryOne('SELECT * FROM support_tickets WHERE id = ?', [$id]);
            } else {
                $ticket = DB::queryOne('SELECT * FROM support_tickets WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
            }
            if (!$ticket) Response::notFound('Ticket not found');

            // Determine sender type — platform superadmin is 'support'
            $senderType = ($user['role'] === 'platform_superadmin') ? 'support' : 'user';
            $inputSenderType = $data['sender_type'] ?? $senderType;
            $finalSenderType = ($user['role'] === 'platform_superadmin') ? 'support' : 'user';

            DB::insert(
                'INSERT INTO ticket_replies (ticket_id, sender_type, sender_name, sender_email, message)
                 VALUES (?,?,?,?,?)',
                [$id, $finalSenderType, $userName, $user['email'] ?? '', $message]
            );

            // Email support
            $settings = [];
            $rows = DB::query('SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?', [$tenantId]);
            foreach ($rows as $r) $settings[$r['setting_key']] = $r['setting_value'];

            $html = Mailer::htmlWrap("
                <p><strong>Reply on Ticket {$ticket['ref']}: {$ticket['title']}</strong></p>
                <p><strong>From:</strong> {$userName}</p>
                <p><strong>Message:</strong><br>" . nl2br(htmlspecialchars($message)) . "</p>
                <hr>
                <p style='font-size:12px;color:#888'>Reply to this email to respond to the ticket.</p>
            ", $settings['smtp_name'] ?? 'Property CRM');

            Mailer::send($settings, 'support@hulisa.co.za', 'Hulisa Support', "Re: [{$ticket['ref']}] {$ticket['title']}", $html);
            Response::success(null, 'Reply sent');
        }

        // Create ticket
        $title    = trim($body['title'] ?? '');
        $desc     = trim($body['description'] ?? '');
        $category = $body['category'] ?? 'Question';
        $priority = $body['priority'] ?? 'Medium';
        $screenshot = $body['screenshot_url'] ?? null;

        if (!$title) Response::error('Title required');
        if (!$desc)  Response::error('Description required');

        // Generate ref
        $ref = 'TKT-' . strtoupper(substr(md5(uniqid()), 0, 6));

        $newId = DB::insert(
            'INSERT INTO support_tickets (tenant_id, user_id, ref, title, description, category, priority, screenshot_url)
             VALUES (?,?,?,?,?,?,?,?)',
            [$tenantId, $userId, $ref, $title, $desc, $category, $priority, $screenshot]
        );

        // Get tenant settings for SMTP
        $settings = [];
        $rows = DB::query('SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?', [$tenantId]);
        foreach ($rows as $r) $settings[$r['setting_key']] = $r['setting_value'];

        $tenantName = $settings['company_name'] ?? 'Tenant #' . $tenantId;
        $screenshotHtml = $screenshot ? "<p><strong>Screenshot:</strong><br><img src='{$screenshot}' style='max-width:100%;margin-top:8px'></p>" : '';

        // Email to support@hulisa.co.za
        $supportHtml = Mailer::htmlWrap("
            <h3 style='margin:0 0 16px'>New Support Ticket: {$ref}</h3>
            <p><strong>Tenant:</strong> {$tenantName}</p>
            <p><strong>Logged by:</strong> {$userName} ({$user['email']})</p>
            <p><strong>Category:</strong> {$category}</p>
            <p><strong>Priority:</strong> {$priority}</p>
            <p><strong>Title:</strong> {$title}</p>
            <p><strong>Description:</strong><br>" . nl2br(htmlspecialchars($desc)) . "</p>
            {$screenshotHtml}
            <hr>
            <p style='font-size:12px;color:#888'>Reply to this email to respond to the ticket.</p>
        ", 'Hulisa CRM Support');
        Mailer::send($settings, 'support@hulisa.co.za', 'Hulisa Support', "[{$ref}] {$title}", $supportHtml);

        // Confirmation email to user
        if (!empty($user['email'])) {
            $userHtml = Mailer::htmlWrap("
                <h3 style='margin:0 0 16px'>Your Support Ticket Has Been Received</h3>
                <p>Hi {$userName},</p>
                <p>We have received your support ticket and will get back to you shortly.</p>
                <table style='width:100%;border-collapse:collapse;margin-top:16px'>
                    <tr><td style='padding:8px;background:#f8f8f8;font-weight:600;width:30%'>Reference</td><td style='padding:8px'>{$ref}</td></tr>
                    <tr><td style='padding:8px;background:#f8f8f8;font-weight:600'>Title</td><td style='padding:8px'>{$title}</td></tr>
                    <tr><td style='padding:8px;background:#f8f8f8;font-weight:600'>Category</td><td style='padding:8px'>{$category}</td></tr>
                    <tr><td style='padding:8px;background:#f8f8f8;font-weight:600'>Priority</td><td style='padding:8px'>{$priority}</td></tr>
                    <tr><td style='padding:8px;background:#f8f8f8;font-weight:600'>Status</td><td style='padding:8px'>Open</td></tr>
                </table>
                <p style='margin-top:24px'>You can track your ticket in the Help &amp; Support section of your CRM.</p>
            ", $settings['smtp_name'] ?? 'Property CRM');
            Mailer::send($settings, $user['email'], $userName, "Support Ticket Received — {$ref}", $userHtml);
        }

        Response::success(['id' => $newId, 'ref' => $ref], 'Ticket submitted');
        break;

    case 'PUT':
        if (!$id) Response::error('ID required');
        $ticket = DB::queryOne('SELECT * FROM support_tickets WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$ticket) Response::notFound('Ticket not found');
        $status = $body['status'] ?? $ticket['status'];
        DB::execute('UPDATE support_tickets SET status = ? WHERE id = ?', [$status, $id]);
        Response::success(null, 'Ticket updated');
        break;

    default:
        Response::error('Method not allowed', 405);
}
