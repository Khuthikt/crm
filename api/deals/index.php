<?php
require_once __DIR__ . '/../../includes/auth.php';
error_reporting(0); ini_set("display_errors", 0);
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user     = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = (int)$user['tenant_id'];
$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    case 'GET':
        if ($id) {
            $deal = DB::queryOne(
                'SELECT d.*, c.name AS contact_name, l.title AS listing_title,
                        u.name AS agent_name
                   FROM deals d
              LEFT JOIN contacts c  ON c.id = d.contact_id
              LEFT JOIN listings l  ON l.id = d.listing_id
              LEFT JOIN users u     ON u.id = d.assigned_to
                  WHERE d.id = ? AND d.tenant_id = ?',
                [$id, $tenantId]
            );
            if (!$deal) Response::notFound('Deal not found');
            Response::success($deal);
        }

        // Agent restriction
        $agentFilter = ($user['role'] === 'agent') ? ' AND d.assigned_to = ' . $user['user_id'] ?? $user['id'] : '';
        $stage       = $_GET['stage'] ?? '';
        $params      = [$tenantId];
        $stageWhere  = '';
        if ($stage) { $stageWhere = ' AND d.stage = ?'; $params[] = $stage; }

        $rows = DB::query(
            "SELECT d.*, c.name AS contact_name, l.title AS listing_title, u.name AS agent_name
               FROM deals d
          LEFT JOIN contacts c ON c.id = d.contact_id
          LEFT JOIN listings l ON l.id = d.listing_id
          LEFT JOIN users u    ON u.id = d.assigned_to
              WHERE d.tenant_id = ? $stageWhere $agentFilter
           ORDER BY d.updated_at DESC",
            $params
        );
        Response::success($rows);
        break;

    case 'POST':
        $body  = json_decode(file_get_contents('php://input'), true);
        $title = trim($body['title'] ?? '');
        if (!$title) Response::error('Deal title is required');

        $value      = (float)($body['value'] ?? 0);
        $commPct    = (float)($body['commission_pct'] ?? 0);
        $commAmt    = $commPct > 0 ? round($value * $commPct / 100, 2) : (float)($body['commission_amt'] ?? 0);

        $newId = DB::insert(
            'INSERT INTO deals
             (tenant_id, assigned_to, contact_id, listing_id, title, stage,
              value, commission_pct, commission_amt, probability, expected_close, notes, created_by,
              deal_type, rental_value, procurement_fee, admin_fee, management_pct, management_amt)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $tenantId,
                ($body['assigned_to'] ?? '') !== '' ? (int)$body['assigned_to'] : null,
                ($body['contact_id']  ?? '') !== '' ? (int)$body['contact_id']  : null,
                ($body['listing_id']  ?? '') !== '' ? (int)$body['listing_id']  : null,
                $title,
                $body['stage'] ?? 'lead',
                $value,
                $commPct,
                $commAmt,
                $body['probability'] ?? 0,
                ($body['expected_close'] ?? '') ?: null,
                $body['notes'] ?? null,
                $user['user_id'] ?? $user['id'],
                $body['deal_type'] ?? 'Lease',
                ($body['rental_value'] ?? '') !== '' ? (float)$body['rental_value'] : null,
                ($body['procurement_fee'] ?? '') !== '' ? (float)$body['procurement_fee'] : null,
                ($body['admin_fee'] ?? '') !== '' ? (float)$body['admin_fee'] : null,
                ($body['management_pct'] ?? '') !== '' ? (float)$body['management_pct'] : null,
                ($body['management_amt'] ?? '') !== '' ? (float)$body['management_amt'] : null,
            ]
        );

        DB::execute(
            'INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description)
             VALUES (?,?,?,?,?,?)',
            [$tenantId, $user['user_id'] ?? $user['id'], 'deal', $newId, 'created', "Deal '$title' created"]
        );

        Response::success(DB::queryOne('SELECT * FROM deals WHERE id = ?', [$newId]), 'Deal created');
        break;

    case 'PUT':
        if (!$id) Response::error('Deal ID required');
        $body = json_decode(file_get_contents('php://input'), true);

        $deal = DB::queryOne('SELECT * FROM deals WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$deal) Response::notFound('Deal not found');

        // Agents can only update their own deals
        if ($user['role'] === 'agent' && (int)$deal['assigned_to'] !== (int)($user['user_id'] ?? $user['id'])) {
            Response::forbidden();
        }

        $value   = (float)($body['value'] ?? $deal['value']);
        $commPct = (float)($body['commission_pct'] ?? $deal['commission_pct']);
        $commAmt = $commPct > 0 ? round($value * $commPct / 100, 2) : (float)($body['commission_amt'] ?? $deal['commission_amt']);

        // Set actual close date when closing a deal
        $actualClose = $deal['actual_close'];
        if (($body['stage'] ?? '') === 'closed' && !$actualClose) {
            $actualClose = date('Y-m-d');
        }

        DB::execute(
            'UPDATE deals SET
             assigned_to=?, contact_id=?, listing_id=?, title=?, stage=?,
             value=?, commission_pct=?, commission_amt=?, probability=?,
             expected_close=?, actual_close=?, lost_reason=?, notes=?,
             deal_type=?, rental_value=?, procurement_fee=?, admin_fee=?,
             management_pct=?, management_amt=?
             WHERE id = ? AND tenant_id = ?',
            [
                $body['assigned_to']   ?? $deal['assigned_to'],
                $body['contact_id']    ?? $deal['contact_id'],
                $body['listing_id']    ?? $deal['listing_id'],
                $body['title']         ?? $deal['title'],
                $body['stage']         ?? $deal['stage'],
                $value,
                $commPct,
                $commAmt,
                $body['probability']   ?? $deal['probability'],
                $body['expected_close']?? $deal['expected_close'],
                $actualClose,
                $body['lost_reason']   ?? $deal['lost_reason'],
                $body['notes']         ?? $deal['notes'],
                $body['deal_type']     ?? $deal['deal_type'] ?? 'Lease',
                ($body['rental_value'] ?? '') !== '' ? (float)$body['rental_value'] : $deal['rental_value'],
                ($body['procurement_fee'] ?? '') !== '' ? (float)$body['procurement_fee'] : $deal['procurement_fee'],
                ($body['admin_fee'] ?? '') !== '' ? (float)$body['admin_fee'] : $deal['admin_fee'],
                ($body['management_pct'] ?? '') !== '' ? (float)$body['management_pct'] : $deal['management_pct'],
                ($body['management_amt'] ?? '') !== '' ? (float)$body['management_amt'] : $deal['management_amt'],
                $id,
                $tenantId,
            ]
        );

        DB::execute(
            'INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description)
             VALUES (?,?,?,?,?,?)',
            [$tenantId, $user['user_id'] ?? $user['id'], 'deal', $id, 'updated', "Deal stage changed to " . ($body['stage'] ?? $deal['stage'])]
        );

        Response::success(DB::queryOne('SELECT * FROM deals WHERE id = ?', [$id]), 'Deal updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('Deal ID required');
        Auth::requireRole($user, ['platform_superadmin', 'super_admin', 'admin']);

        $deal = DB::queryOne('SELECT * FROM deals WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$deal) Response::notFound();

        DB::execute('DELETE FROM deals WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(null, 'Deal deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
