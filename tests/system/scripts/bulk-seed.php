<?php
// Bulk-seeds crm_db_test with a large volume of contacts/invoices to
// exercise scalability characteristics (unindexed LIKE search, COUNT(*),
// pagination) the way real data growth would over years of CRM use.
// Usage: CRM_DB_NAME=crm_db_test php bulk-seed.php <numContacts> <numInvoices>

require __DIR__ . '/../../../includes/db.php';

if (DB_NAME !== 'crm_db_test') {
    fwrite(STDERR, "Refusing to bulk-seed — CRM_DB_NAME must be 'crm_db_test'.\n");
    exit(1);
}

$numContacts = (int)($argv[1] ?? 50000);
$numInvoices = (int)($argv[2] ?? 20000);

$tenantId = (int)DB::queryOne("SELECT id FROM tenants WHERE slug = 'qa-test-properties'")['id'];
$agentId  = (int)DB::queryOne("SELECT id FROM users WHERE username = 'qa.agent'")['id'];
$leaseId  = (int)DB::queryOne("SELECT id FROM leases WHERE ref = 'LSE-0001' AND tenant_id = ?", [$tenantId])['id'];
$leaseTenantName = DB::queryOne("SELECT tenant_name FROM leases WHERE id = ?", [$leaseId])['tenant_name'];

$firstNames = ['James','Mary','Sipho','Thandiwe','Pieter','Anika','David','Nomvula','John','Zanele','Peter','Lerato'];
$lastNames  = ['Nkosi','Van der Merwe','Dlamini','Botha','Mokoena','Naidoo','Smith','Khumalo','Pretorius','Molefe'];
$types      = ['Lead','Tenant','Landlord','Buyer','Seller','Owner','Other'];

echo "Seeding $numContacts contacts...\n";
$t0 = microtime(true);
$batchSize = 1000;
$pdo = DB::get();
for ($batchStart = 0; $batchStart < $numContacts; $batchStart += $batchSize) {
    $rows = min($batchSize, $numContacts - $batchStart);
    $placeholders = [];
    $params = [];
    for ($i = 0; $i < $rows; $i++) {
        $n = $batchStart + $i;
        $name = $firstNames[$n % count($firstNames)] . ' ' . $lastNames[($n * 7) % count($lastNames)] . " #$n";
        $placeholders[] = '(?,?,?,?,?,?,?,?)';
        array_push($params,
            $tenantId,
            $agentId,
            $name,
            '082' . str_pad((string)($n % 10000000), 7, '0', STR_PAD_LEFT),
            'bulk' . $n . '@example.test',
            $types[$n % count($types)],
            'active',
            $agentId
        );
    }
    $sql = 'INSERT INTO contacts (tenant_id, assigned_to, name, phone, email, type, status, created_by) VALUES '
        . implode(',', $placeholders);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}
echo 'Contacts done in ' . round(microtime(true) - $t0, 2) . "s\n";

echo "Seeding $numInvoices invoices...\n";
$t0 = microtime(true);
for ($batchStart = 0; $batchStart < $numInvoices; $batchStart += $batchSize) {
    $rows = min($batchSize, $numInvoices - $batchStart);
    $placeholders = [];
    $params = [];
    for ($i = 0; $i < $rows; $i++) {
        $n = $batchStart + $i;
        $ref = 'INV-BULK-' . str_pad((string)$n, 6, '0', STR_PAD_LEFT);
        $subtotal = 1000 + ($n % 5000);
        $placeholders[] = '(?,?,?,?,?,?,?,?)';
        array_push($params,
            $tenantId, $ref, $leaseId, $leaseTenantName,
            $subtotal, $subtotal,
            date('Y-m-d', strtotime('-' . ($n % 400) . ' days')),
            ($n % 3 === 0) ? 'paid' : 'unpaid'
        );
    }
    $sql = 'INSERT INTO invoices (tenant_id, ref, lease_id, tenant_name, subtotal, total, due_date, status) VALUES '
        . implode(',', $placeholders);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}
echo 'Invoices done in ' . round(microtime(true) - $t0, 2) . "s\n";

$counts = DB::queryOne('SELECT (SELECT COUNT(*) FROM contacts WHERE tenant_id = ?) AS c, (SELECT COUNT(*) FROM invoices WHERE tenant_id = ?) AS i', [$tenantId, $tenantId]);
echo "Final counts — contacts: {$counts['c']}, invoices: {$counts['i']}\n";
