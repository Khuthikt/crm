<?php
// Run daily: 0 6 * * * php /var/www/html/crm/scripts/generate_scheduled_invoices.php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';

$today    = date('Y-m-d');
$dayOfMonth = (int)date('j');

// Get active schedules where today is the billing day
$schedules = DB::query(
    "SELECT s.*, l.ref AS lease_ref
       FROM invoice_schedules s
  LEFT JOIN leases l ON l.id = s.lease_id
      WHERE s.is_active = 1
        AND s.day_of_month = ?
        AND s.start_date <= ?
        AND (s.end_date IS NULL OR s.end_date >= ?)
        AND (s.last_generated IS NULL OR s.last_generated < DATE_FORMAT(NOW(), '%Y-%m-01'))",
    [$dayOfMonth, $today, $today]
);

$generated = 0;
foreach ($schedules as $sched) {
    // Generate next invoice ref
    $last = DB::queryOne(
        "SELECT ref FROM invoices WHERE tenant_id = ? ORDER BY id DESC LIMIT 1",
        [$sched['tenant_id']]
    );
    $num    = $last ? (int)substr($last['ref'], 4) + 1 : 1;
    $ref    = 'INV-' . str_pad($num, 4, '0', STR_PAD_LEFT);
    $vat    = $sched['vat_applied'] ? round($sched['amount'] * 0.15, 2) : 0;
    $total  = $sched['amount'] + $vat;
    $dueDate = date('Y-m-d', strtotime('+30 days'));

    $invId = DB::insert(
        'INSERT INTO invoices (tenant_id, lease_id, ref, invoice_type, subtotal, vat_applied, vat_amount, total, due_date, status, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,'unpaid',?,1)',
        [
            $sched['tenant_id'],
            $sched['lease_id'],
            $ref,
            $sched['invoice_type'],
            $sched['amount'],
            $sched['vat_applied'],
            $vat,
            $total,
            $dueDate,
            'Auto-generated from schedule',
        ]
    );

    // Add line item
    DB::insert(
        'INSERT INTO invoice_lines (tenant_id, invoice_id, description, quantity, unit_price, discount, subtotal)
         VALUES (?,?,?,1,?,0,?)',
        [$sched['tenant_id'], $invId, $sched['description'] ?: $sched['invoice_type'], $sched['amount'], $sched['amount']]
    );

    // Update last_generated
    DB::execute('UPDATE invoice_schedules SET last_generated = ? WHERE id = ?', [$today, $sched['id']]);
    $generated++;
}

echo "Generated $generated invoice(s) on $today
";
