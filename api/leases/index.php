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
            $lease = DB::queryOne(
                'SELECT l.*, li.title AS listing_title
                   FROM leases l
              LEFT JOIN listings li ON li.id = l.listing_id
                  WHERE l.id = ? AND l.tenant_id = ?',
                [$id, $tenantId]
            );
            if (!$lease) Response::notFound('Lease not found');

            // Repairs
            $lease['repairs'] = DB::query(
                'SELECT * FROM lease_repairs WHERE lease_id = ? AND tenant_id = ? ORDER BY repair_date DESC',
                [$id, $tenantId]
            );
            // Invoices for this lease
            $lease['invoices'] = DB::query(
                'SELECT * FROM invoices WHERE lease_id = ? AND tenant_id = ? ORDER BY created_at DESC',
                [$id, $tenantId]
            );
            // Documents
            $lease['documents'] = DB::query(
                'SELECT * FROM contact_documents WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
                ['lease', $id]
            );
            Response::success($lease);
        }

        $status = $_GET['status'] ?? '';
        $params = [$tenantId];
        $where  = 'l.tenant_id = ?';
        if ($status) { $where .= ' AND l.status = ?'; $params[] = $status; }
        if (isset($_GET['contact_id']) && $_GET['contact_id'] !== '') {
            $where .= ' AND (l.tenant_id = ? OR l.landlord_id = ?)';
            $params[] = (int)$_GET['contact_id'];
            $params[] = (int)$_GET['contact_id'];
        }
        if (isset($_GET['assigned_to']) && $_GET['assigned_to'] !== '') {
            // Filter leases by agent's assigned contacts
            $where .= ' AND l.tenant_id IN (SELECT id FROM contacts WHERE assigned_to = ? AND tenant_id = ?)';
            $params[] = (int)$_GET['assigned_to'];
            $params[] = $tenantId;
        }

        $rows = DB::query(
            "SELECT l.*, li.title AS listing_title,
                    t.name AS tenant_contact, ld.name AS landlord_contact
               FROM leases l
          LEFT JOIN listings li ON li.id = l.listing_id
          LEFT JOIN contacts t  ON t.id = l.tenant_id
          LEFT JOIN contacts ld ON ld.id = l.landlord_id
              WHERE $where
           ORDER BY l.start_date DESC",
            $params
        );

        // Auto-expire overdue leases
        DB::execute(
            "UPDATE leases SET status = 'expired'
              WHERE tenant_id = ? AND status = 'active' AND end_date < CURDATE()",
            [$tenantId]
        );

        Response::success($rows);
        break;

    case 'POST':
        Auth::requireRole($user, ['platform_superadmin','super_admin','admin','finance_admin']);
        $body = json_decode(file_get_contents('php://input'), true);

        $required = ['tenant_name','start_date','end_date','monthly_rent'];
        foreach ($required as $f) {
            if (empty($body[$f])) Response::error("$f is required");
        }

        // Generate ref
        $count = DB::queryOne('SELECT COUNT(*) AS c FROM leases WHERE tenant_id = ?', [$tenantId])['c'];
        $ref   = 'LSE-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);

        DB::begin();
        try {
        $newId = DB::insert(
            'INSERT INTO leases
             (tenant_id, ref, listing_id, contact_id, tenant_name, landlord_name, landlord_id,
              property, unit, start_date, end_date, monthly_rent, deposit,
              escalation_pct, status, notes, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $tenantId,
                $ref,
                $body['listing_id']     ?? null,
                $body['contact_id']     ?? null,
                $body['tenant_name'],
                $body['landlord_name']  ?? null,
                $body['landlord_id']    ?? null,
                $body['property']       ?? null,
                $body['unit']           ?? null,
                ($body['start_date'] ?? '') ?: null,
                ($body['end_date'] ?? '') ?: null,
                (float)$body['monthly_rent'],
                (float)($body['deposit']       ?? 0),
                (float)($body['escalation_pct']?? 0),
                $body['status']         ?? 'active',
                $body['notes']          ?? null,
                $user['user_id'] ?? $user['id'],
            ]
        );

        DB::execute(
            'INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description)
             VALUES (?,?,?,?,?,?)',
            [$tenantId, $user['user_id'] ?? $user['id'], 'lease', $newId, 'created', "Lease $ref created for {$body['tenant_name']}"]
        );

        DB::commit();
        Response::success(DB::queryOne('SELECT * FROM leases WHERE id = ?', [$newId]), 'Lease created');
        } catch (\Exception $e) { DB::rollback(); Response::error('Failed to create lease: ' . $e->getMessage()); }
        break;

    case 'PUT':
        if (!$id) Response::error('Lease ID required');
        Auth::requireRole($user, ['platform_superadmin','super_admin','admin','finance_admin']);
        $body = json_decode(file_get_contents('php://input'), true);

        $lease = DB::queryOne('SELECT * FROM leases WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$lease) Response::notFound();

        DB::execute(
            'UPDATE leases SET
             listing_id=?, contact_id=?, tenant_name=?, landlord_name=?, landlord_id=?,
             property=?, unit=?, start_date=?, end_date=?, monthly_rent=?, deposit=?,
             escalation_pct=?, status=?, notes=?
             WHERE id = ? AND tenant_id = ?',
            [
                $body['listing_id']     ?? $lease['listing_id'],
                $body['contact_id']     ?? $lease['contact_id'],
                $body['tenant_name']    ?? $lease['tenant_name'],
                $body['landlord_name']  ?? $lease['landlord_name'],
                $body['landlord_id']    ?? $lease['landlord_id'],
                $body['property']       ?? $lease['property'],
                $body['unit']           ?? $lease['unit'],
                $body['start_date']     ?? $lease['start_date'],
                $body['end_date']       ?? $lease['end_date'],
                (float)($body['monthly_rent'] ?? $lease['monthly_rent']),
                (float)($body['deposit']      ?? $lease['deposit']),
                (float)($body['escalation_pct']?? $lease['escalation_pct']),
                $body['status']         ?? $lease['status'],
                $body['notes']          ?? $lease['notes'],
                $id,
                $tenantId,
            ]
        );

        Response::success(DB::queryOne('SELECT * FROM leases WHERE id = ?', [$id]), 'Lease updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('Lease ID required');
        Auth::requireRole($user, ['platform_superadmin','super_admin']);

        $lease = DB::queryOne('SELECT * FROM leases WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$lease) Response::notFound();

        DB::execute('DELETE FROM leases WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(null, 'Lease deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
