<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/response.php';
require_once __DIR__ . '/../includes/mailer.php';

$user = Auth::user();
if (!$user) Response::unauthorized();
if ($user['role'] !== 'platform_superadmin') Response::error('Unauthorised', 403);

$method = $_SERVER['REQUEST_METHOD'];
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$id     = (int)($_GET['id'] ?? 0);

switch ($method) {
    case 'GET':
        if ($id) {
            $inv = DB::queryOne(
                'SELECT pi.*, t.name AS tenant_name, t.billing_email, t.billing_contact
                   FROM platform_invoices pi
                   JOIN tenants t ON t.id = pi.tenant_id
                  WHERE pi.id = ?', [$id]
            );
            if (!$inv) Response::notFound();
            $inv['lines'] = DB::query('SELECT * FROM platform_invoice_lines WHERE invoice_id = ? ORDER BY id', [$id]);
            Response::success($inv);
        }
        $rows = DB::query(
            'SELECT pi.*, t.name AS tenant_name, t.billing_email
               FROM platform_invoices pi
               JOIN tenants t ON t.id = pi.tenant_id
              ORDER BY pi.created_at DESC'
        );
        Response::success($rows);
        break;

    case 'POST':
        $tenantId   = (int)($body['tenant_id'] ?? 0);
        $lines      = $body['lines'] ?? [];
        $vatApplied = !empty($body['vat_applied']) ? 1 : 0;
        $dueDate    = ($body['due_date'] ?? '') ?: null;
        if (!$tenantId || empty($lines)) Response::error('Tenant and line items are required');
        $subtotal = 0;
        foreach ($lines as $line) { $subtotal += round((float)($line['amount'] ?? 0), 2); }
        $vatAmt = $vatApplied ? round($subtotal * 0.15, 2) : 0;
        $total  = $subtotal + $vatAmt;
        $count  = DB::queryOne('SELECT COUNT(*) AS c FROM platform_invoices')['c'];
        $ref    = 'HINV-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);
        DB::begin();
        try {
            $newId = DB::insert(
                'INSERT INTO platform_invoices (tenant_id, ref, description, subtotal, vat_applied, vat_amount, total, due_date, notes)
                 VALUES (?,?,?,?,?,?,?,?,?)',
                [$tenantId, $ref, implode('; ', array_column($lines, 'description')), $subtotal, $vatApplied, $vatAmt, $total, $dueDate, $body['notes'] ?? null]
            );
            foreach ($lines as $line) {
                if (empty($line['description']) || !($line['amount'] ?? 0)) continue;
                DB::execute(
                    'INSERT INTO platform_invoice_lines (invoice_id, description, amount) VALUES (?,?,?)',
                    [$newId, $line['description'], round((float)$line['amount'], 2)]
                );
            }
            DB::commit();
            Response::success(['id' => $newId, 'ref' => $ref], 'Invoice created');
        } catch (\Exception $e) { DB::rollback(); Response::error('Failed: ' . $e->getMessage()); }
        break;

    case 'PUT':
        if (!$id) Response::error('ID required');
        $status   = $body['status'] ?? null;
        $paidDate = $status === 'paid' ? date('Y-m-d') : null;
        if ($status) {
            DB::execute('UPDATE platform_invoices SET status=?, paid_date=? WHERE id=?', [$status, $paidDate, $id]);
        }
        Response::success(null, 'Invoice updated');
        break;

    case 'DELETE':
        if (!$id) Response::error('ID required');
        DB::execute('DELETE FROM platform_invoices WHERE id=?', [$id]);
        Response::success(null, 'Invoice deleted');
        break;
}
