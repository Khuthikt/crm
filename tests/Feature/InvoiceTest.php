<?php

namespace Tests\Feature;

class InvoiceTest extends TestCase
{
    public function testGenerateInvoiceAgainstActiveLease(): void
    {
        $cookie = $this->loginAs('qa.finance');
        $leaseId = $this->fixture('leases', 'active');

        $res = $this->request('POST', '/crm/api/invoices', [
            'lease_id' => $leaseId,
            'due_date' => '2026-09-30',
            'vat_applied' => true,
            'lines' => [
                ['description' => 'Monthly rent', 'quantity' => 1, 'unit_price' => 12000],
                ['description' => 'Levy',         'quantity' => 1, 'unit_price' => 800, 'discount' => 100],
            ],
        ], $cookie);

        $this->assertSame(200, $res['status'], $res['body']);
        $inv = $res['json']['data'];

        // subtotal = 12000 + (800-100) = 12700; VAT 15% = 1905; total = 14605
        $this->assertEquals(12700.00, (float)$inv['subtotal']);
        $this->assertEquals(1905.00, (float)$inv['vat_amount']);
        $this->assertEquals(14605.00, (float)$inv['total']);
        $this->assertSame('unpaid', $inv['status']);
        $this->assertSame('LSE-0001', $this->leaseRef($cookie, $leaseId));
        $this->assertStringStartsWith('INV-', $inv['ref']);
        $this->assertCount(2, $inv['lines']);
    }

    public function testInvoiceWithoutVatHasZeroVatAmount(): void
    {
        $cookie = $this->loginAs('qa.finance');
        $leaseId = $this->fixture('leases', 'active');

        $res = $this->request('POST', '/crm/api/invoices', [
            'lease_id' => $leaseId,
            'due_date' => '2026-09-30',
            'vat_applied' => false,
            'lines' => [['description' => 'Monthly rent', 'quantity' => 1, 'unit_price' => 5000]],
        ], $cookie);

        $this->assertSame(200, $res['status']);
        $this->assertEquals(0.0, (float)$res['json']['data']['vat_amount']);
        $this->assertEquals(5000.00, (float)$res['json']['data']['total']);
    }

    public function testCannotGenerateInvoiceWithoutLineItems(): void
    {
        $cookie = $this->loginAs('qa.finance');
        $res = $this->request('POST', '/crm/api/invoices', [
            'lease_id' => $this->fixture('leases', 'active'),
            'due_date' => '2026-09-30',
            'lines' => [],
        ], $cookie);

        $this->assertSame(400, $res['status']);
        $this->assertFalse($res['json']['success']);
    }

    public function testCannotGenerateInvoiceAgainstExpiredLease(): void
    {
        $cookie = $this->loginAs('qa.finance');
        $res = $this->request('POST', '/crm/api/invoices', [
            'lease_id' => $this->fixture('leases', 'expired_status'),
            'due_date' => '2026-09-30',
            'lines' => [['description' => 'Rent', 'quantity' => 1, 'unit_price' => 1000]],
        ], $cookie);

        $this->assertSame(400, $res['status']);
        $this->assertStringContainsString('not active', strtolower($res['json']['error']));
    }

    /**
     * A lease whose end_date has passed is NOT rejected until something
     * has flipped its status to 'expired' — that only happens as a side
     * effect of GET /leases (see LeaseTest::testListingLeasesAutoExpiresPastDueOnes).
     * This documents that gap rather than hiding it.
     */
    public function testLeaseWithPastEndDateButStillActiveStatusCanStillBeInvoiced(): void
    {
        $cookie = $this->loginAs('qa.finance');
        $res = $this->request('POST', '/crm/api/invoices', [
            'lease_id' => $this->fixture('leases', 'already_expired'),
            'due_date' => '2026-09-30',
            'lines' => [['description' => 'Rent', 'quantity' => 1, 'unit_price' => 1000]],
        ], $cookie);

        $this->assertSame(200, $res['status'],
            'Known gap: invoices/index.php only checks status=active, not end_date, ' .
            'so a lapsed-but-not-yet-flipped lease can still be invoiced.');
    }

    public function testCannotGenerateInvoiceAgainstMissingLease(): void
    {
        $cookie = $this->loginAs('qa.finance');
        $res = $this->request('POST', '/crm/api/invoices', [
            'lease_id' => 999999,
            'due_date' => '2026-09-30',
            'lines' => [['description' => 'Rent', 'quantity' => 1, 'unit_price' => 1000]],
        ], $cookie);

        $this->assertSame(400, $res['status']);
    }

    public function testMarkInvoiceAsPaid(): void
    {
        $cookie = $this->loginAs('qa.finance');
        $create = $this->request('POST', '/crm/api/invoices', [
            'lease_id' => $this->fixture('leases', 'active'),
            'due_date' => '2026-09-30',
            'lines' => [['description' => 'Rent', 'quantity' => 1, 'unit_price' => 3000]],
        ], $cookie);
        $id = $create['json']['data']['id'];

        $pay = $this->request('PUT', '/crm/api/invoices?id=' . $id, ['status' => 'paid'], $cookie);
        $this->assertSame(200, $pay['status']);

        $get = $this->request('GET', '/crm/api/invoices?id=' . $id, null, $cookie);
        $this->assertSame('paid', $get['json']['data']['status']);
        $this->assertNotNull($get['json']['data']['paid_date']);
    }

    private function leaseRef(string $cookie, int $leaseId): string
    {
        $res = $this->request('GET', '/crm/api/leases?id=' . $leaseId, null, $cookie);
        return $res['json']['data']['ref'];
    }
}
