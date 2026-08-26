<?php
require_once __DIR__ . '/../../includes/auth.php';
error_reporting(0); ini_set("display_errors", 0);
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user     = Auth::user();
if (!$user) Response::unauthorized();
Auth::requireRole($user, ['platform_superadmin','super_admin','admin','finance_admin']);

$tenantId = (int)$user['tenant_id'];
$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;

switch ($method) {

    case 'GET':
        if ($id) {
            $inv = DB::queryOne(
                'SELECT i.*, l.ref AS lease_ref, l.property AS lease_property,
                        l.tenant_name AS lease_tenant_name, l.unit AS lease_unit,
                        c.phone AS tenant_phone, c.email AS tenant_email,
                        c.street1 AS tenant_address, c.city AS tenant_city
                   FROM invoices i
              LEFT JOIN leases l ON l.id = i.lease_id
              LEFT JOIN contacts c ON c.id = l.contact_id
                  WHERE i.id = ? AND i.tenant_id = ?',
                [$id, $tenantId]
            );
            if (!$inv) Response::notFound('Invoice not found');

            $inv['lines'] = DB::query(
                'SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id ASC',
                [$id]
            );
            Response::success($inv);
        }

        // Auto-mark overdue
        DB::execute(
            "UPDATE invoices SET status = 'overdue'
              WHERE tenant_id = ? AND status = 'unpaid' AND due_date < CURDATE()",
            [$tenantId]
        );

        $status = $_GET['status'] ?? '';
        $params = [$tenantId];
        $where  = 'i.tenant_id = ?';
        if ($status) { $where .= ' AND i.status = ?'; $params[] = $status; }

        $rows = DB::query(
            "SELECT i.*, l.ref AS lease_ref
               FROM invoices i
          LEFT JOIN leases l ON l.id = i.lease_id
              WHERE $where
           ORDER BY i.created_at DESC",
            $params
        );
        Response::success($rows);
        break;

    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true);

        $leaseId = isset($body['lease_id']) ? (int)$body['lease_id'] : null;
        if (!$leaseId || !($body['due_date'] ?? null)) {
            Response::error('Lease and due date are required');
        }

        // Verify lease belongs to tenant and is active
        $lease = DB::queryOne(
            'SELECT * FROM leases WHERE id = ? AND tenant_id = ? AND status = ?',
            [$leaseId, $tenantId, 'active']
        );
        if (!$lease) Response::error('Lease not found or not active');

        $lines = $body['lines'] ?? [];
        if (!count($lines)) Response::error('At least one line item is required');

        $subtotal = 0;
        foreach ($lines as $line) {
            $subtotal += (float)$line['quantity'] * ((float)$line['unit_price'] - (float)($line['discount'] ?? 0));
        }

        $useVat  = (bool)($body['vat_applied'] ?? false);
        $vatAmt  = $useVat ? round($subtotal * 0.15, 2) : 0;
        $total   = $subtotal + $vatAmt;

        // Generate ref
        $count  = DB::queryOne('SELECT COUNT(*) AS c FROM invoices WHERE tenant_id = ?', [$tenantId])['c'];
        $ref    = 'INV-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);

        DB::begin();
        try {
            $invId = DB::insert(
                'INSERT INTO invoices
                 (tenant_id, ref, lease_id, contact_id, tenant_name, subtotal, discount,
                  vat_applied, vat_amount, total, due_date, status, notes, created_by)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [
                    $tenantId, $ref, $leaseId,
                    $lease['contact_id'],
                    $lease['tenant_name'],
                    $subtotal, (float)($body['discount'] ?? 0),
                    $useVat ? 1 : 0, $vatAmt, $total,
                    ($body['due_date'] ?? '') ?: null,
                    'unpaid',
                    $body['notes'] ?? null,
                    $user['user_id'] ?? $user['id'],
                ]
            );

            foreach ($lines as $line) {
                $lineSub = (float)$line['quantity'] * ((float)$line['unit_price'] - (float)($line['discount'] ?? 0));
                DB::execute(
                    'INSERT INTO invoice_lines
                     (tenant_id, invoice_id, description, quantity, unit_price, discount, subtotal)
                     VALUES (?,?,?,?,?,?,?)',
                    [
                        $tenantId, $invId,
                        $line['description'],
                        (float)$line['quantity'],
                        (float)$line['unit_price'],
                        (float)($line['discount'] ?? 0),
                        $lineSub,
                    ]
                );
            }

            DB::execute(
                'INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description)
                 VALUES (?,?,?,?,?,?)',
                [$tenantId, $user['user_id'] ?? $user['id'], 'invoice', $invId, 'created', "Invoice $ref created for {$lease['tenant_name']}"]
            );

            DB::commit();
        } catch (Exception $e) {
            DB::rollback();
            Response::error('Failed to create invoice: ' . $e->getMessage(), 500);
        }

        $inv = DB::queryOne('SELECT * FROM invoices WHERE id = ?', [$invId]);
        $inv['lines'] = DB::query('SELECT * FROM invoice_lines WHERE invoice_id = ?', [$invId]);
        Response::success($inv, 'Invoice created');
        break;

    case 'PUT':
        if (!$id) Response::error('Invoice ID required');
        $body = json_decode(file_get_contents('php://input'), true);

        $inv = DB::queryOne('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$inv) Response::notFound();

        // Mark paid
        if (isset($body['status']) && $body['status'] === 'paid') {
            DB::execute(
                "UPDATE invoices SET status = 'paid', paid_date = CURDATE() WHERE id = ? AND tenant_id = ?",
                [$id, $tenantId]
            );
            DB::execute(
                'INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description)
                 VALUES (?,?,?,?,?,?)',
                [$tenantId, $user['user_id'] ?? $user['id'], 'invoice', $id, 'paid', "Invoice {$inv['ref']} marked as paid"]
            );
            Response::success(null, 'Invoice marked as paid');
        }

        // Update due date / notes
        DB::execute(
            'UPDATE invoices SET due_date=?, notes=? WHERE id = ? AND tenant_id = ?',
            [$body['due_date'] ?? $inv['due_date'], $body['notes'] ?? $inv['notes'], $id, $tenantId]
        );
        Response::success(null, 'Invoice updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('Invoice ID required');
        Auth::requireRole($user, ['platform_superadmin','super_admin']);

        $inv = DB::queryOne('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        if (!$inv) Response::notFound();

        DB::execute('DELETE FROM invoices WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(null, 'Invoice deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
