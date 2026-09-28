<?php
error_reporting(0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = (int)$user['tenant_id'];
$userId   = (int)($user['user_id'] ?? $user['id']);
$userName = $user['name'] ?? 'Unknown';
$method   = $_SERVER['REQUEST_METHOD'];
$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$contactId = isset($_GET['contact_id']) ? (int)$_GET['contact_id'] : null;

switch ($method) {
    case 'GET':
        // Get all notes across all contacts for this tenant
        if (isset($_GET['all']) && $_GET['all'] == '1') {
            $rows = DB::query(
                'SELECT n.*, c.name as contact_name FROM contact_notes n
                 INNER JOIN contacts c ON c.id = n.contact_id AND c.tenant_id = n.tenant_id
                 WHERE n.tenant_id = ? ORDER BY n.created_at DESC LIMIT 200',
                [$tenantId]
            );
            Response::success($rows);
        }
        if (!$contactId) Response::error('contact_id required');
        // Get notes
        $notes = DB::query(
            'SELECT id, user_name, note, created_at FROM contact_notes
             WHERE contact_id = ? AND tenant_id = ? ORDER BY created_at DESC',
            [$contactId, $tenantId]
        );
        // Get email log
        $emails = DB::query(
            'SELECT id, to_email, subject, sent_at FROM email_log
             WHERE contact_id = ? AND tenant_id = ? ORDER BY sent_at DESC',
            [$contactId, $tenantId]
        );
        // Get reminders
        $reminders = DB::query(
            'SELECT id, type, note, remind_at, is_sent FROM contact_reminders
             WHERE contact_id = ? AND tenant_id = ? ORDER BY remind_at DESC',
            [$contactId, $tenantId]
        );
        // Get call log
        $calls = DB::query(
            'SELECT cl.id, cl.outcome, cl.notes, cl.created_at, u.name as agent_name
             FROM call_log cl LEFT JOIN users u ON u.id = cl.user_id
             WHERE cl.contact_id = ? AND cl.tenant_id = ? ORDER BY cl.created_at DESC',
            [$contactId, $tenantId]
        );
        Response::success([
            'notes'     => $notes,
            'emails'    => $emails,
            'reminders' => $reminders,
            'calls'     => $calls,
        ]);
        break;

    case 'POST':
        $contactId = (int)($body['contact_id'] ?? 0);
        $note      = trim($body['note'] ?? '');
        if (!$contactId) Response::error('contact_id required');
        if (!$note)      Response::error('note required');
        $newId = DB::insert(
            'INSERT INTO contact_notes (tenant_id, contact_id, user_id, user_name, note)
             VALUES (?,?,?,?,?)',
            [$tenantId, $contactId, $userId, $userName, $note]
        );
        Response::success([
            'id'         => $newId,
            'user_name'  => $userName,
            'note'       => $note,
            'created_at' => date('Y-m-d H:i:s'),
        ], 'Note saved');
        break;

    case 'DELETE':
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$id) Response::error('id required');
        DB::execute(
            'DELETE FROM contact_notes WHERE id = ? AND tenant_id = ? AND user_id = ?',
            [$id, $tenantId, $userId]
        );
        Response::success(null, 'Note deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
