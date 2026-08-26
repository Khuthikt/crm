<?php

namespace Tests\Feature;

class LeaseTest extends TestCase
{
    public function testCreateLease(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('POST', '/crm/api/leases', [
            'tenant_name'  => 'New Lease Tenant',
            'property'     => '55 Test Avenue',
            'unit'         => 'Unit 9',
            'start_date'   => '2026-09-01',
            'end_date'     => '2027-08-31',
            'monthly_rent' => 8500,
            'deposit'      => 8500,
        ], $cookie);

        $this->assertSame(200, $res['status'], $res['body']);
        $lease = $res['json']['data'];
        $this->assertSame('New Lease Tenant', $lease['tenant_name']);
        $this->assertEquals(8500.00, (float)$lease['monthly_rent']);
        $this->assertStringStartsWith('LSE-', $lease['ref']);
        $this->assertSame('active', $lease['status'], 'New leases default to active status');
    }

    public function missingFieldProvider(): array
    {
        return [
            'missing tenant_name'  => ['tenant_name'],
            'missing start_date'   => ['start_date'],
            'missing end_date'     => ['end_date'],
            'missing monthly_rent' => ['monthly_rent'],
        ];
    }

    /** @dataProvider missingFieldProvider */
    public function testCreateLeaseRejectsMissingRequiredField(string $missingField): void
    {
        $cookie = $this->loginAs('qa.admin');
        $payload = [
            'tenant_name'  => 'Incomplete Lease',
            'start_date'   => '2026-09-01',
            'end_date'     => '2027-08-31',
            'monthly_rent' => 6000,
        ];
        unset($payload[$missingField]);

        $res = $this->request('POST', '/crm/api/leases', $payload, $cookie);
        $this->assertSame(400, $res['status']);
        $this->assertFalse($res['json']['success']);
    }

    public function testEditLease(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $leaseId = $this->fixture('leases', 'expiring_soon');

        $res = $this->request('PUT', '/crm/api/leases?id=' . $leaseId, [
            'monthly_rent' => 10500,
            'notes'        => 'Rent increased at renewal',
        ], $cookie);

        $this->assertSame(200, $res['status']);
        $this->assertEquals(10500.00, (float)$res['json']['data']['monthly_rent']);
        $this->assertSame('Rent increased at renewal', $res['json']['data']['notes']);
    }

    public function testListingLeasesAutoExpiresPastDueOnes(): void
    {
        // Seeded 'already_expired' lease has end_date in the past but is
        // still stored with status='active' until GET /leases runs its
        // auto-expire side effect.
        $cookie = $this->loginAs('qa.admin');
        $leaseId = $this->fixture('leases', 'already_expired');

        $before = $this->request('GET', '/crm/api/leases?id=' . $leaseId, null, $cookie);
        $this->assertSame('active', $before['json']['data']['status']);

        $list = $this->request('GET', '/crm/api/leases', null, $cookie);
        $this->assertSame(200, $list['status']);

        $after = $this->request('GET', '/crm/api/leases?id=' . $leaseId, null, $cookie);
        $this->assertSame('expired', $after['json']['data']['status'],
            'Lease past its end_date should be auto-expired once the list endpoint runs');
    }

    public function testDashboardExpiryWarningIncludesLeaseExpiringWithin60Days(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('GET', '/crm/api/dashboard', null, $cookie);
        $this->assertSame(200, $res['status']);

        $renewalRefs = array_column($res['json']['data']['renewals'], 'ref');
        $this->assertContains('LSE-0002', $renewalRefs, 'Lease expiring in 20 days should show as an upcoming renewal warning');
    }

    public function testDashboardExpiryWarningExcludesLeaseExpiringBeyond60Days(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('GET', '/crm/api/dashboard', null, $cookie);

        $renewalRefs = array_column($res['json']['data']['renewals'], 'ref');
        $this->assertNotContains('LSE-0001', $renewalRefs, 'Lease expiring in ~4 months should not yet be a renewal warning');
    }

    public function testDashboardExpiryWarningExcludesAlreadyExpiredLease(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('GET', '/crm/api/dashboard', null, $cookie);

        $renewalRefs = array_column($res['json']['data']['renewals'], 'ref');
        $this->assertNotContains('LSE-0004', $renewalRefs, 'Already-expired leases should not appear as upcoming renewals');
    }
}
