<?php

namespace Tests\Feature;

/**
 * Role-based access control: each role should only reach the modules
 * Auth::requireRole() grants it, and list endpoints should scope data
 * to what that role is allowed to see.
 */
class RbacTest extends TestCase
{
    // ── Finance module (invoices) — admin+ only ──────────────

    public function testAgentCannotListInvoices(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('GET', '/crm/api/invoices', null, $cookie);
        $this->assertSame(403, $res['status']);
        // Auth::requireRole() short-circuits with {"error":"..."} — note this
        // is a different shape to Response::error()'s {"success":false,"error":"..."},
        // which the rest of the API uses. See KnownIssuesTest for the inconsistency.
        $this->assertSame('Access denied', $res['json']['error']);
    }

    public function testFinanceAdminCanListInvoices(): void
    {
        $cookie = $this->loginAs('qa.finance');
        $res = $this->request('GET', '/crm/api/invoices', null, $cookie);
        $this->assertSame(200, $res['status']);
    }

    public function testAdminCanListInvoices(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('GET', '/crm/api/invoices', null, $cookie);
        $this->assertSame(200, $res['status']);
    }

    // ── Leases — create/edit restricted, delete more restricted ─

    public function testAgentCannotCreateLease(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('POST', '/crm/api/leases', [
            'tenant_name'  => 'Should Not Be Created',
            'start_date'   => '2026-01-01',
            'end_date'     => '2026-12-31',
            'monthly_rent' => 5000,
        ], $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testAgentCanReadLeaseList(): void
    {
        // GET /leases has no role restriction — every authenticated user can view.
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('GET', '/crm/api/leases', null, $cookie);
        $this->assertSame(200, $res['status']);
    }

    public function testAdminCannotDeleteLease(): void
    {
        // Lease DELETE is restricted to platform_superadmin/super_admin only.
        $cookie = $this->loginAs('qa.admin');
        $leaseId = $this->fixture('leases', 'expiring_soon');
        $res = $this->request('DELETE', '/crm/api/leases?id=' . $leaseId, null, $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testSuperAdminCanDeleteLease(): void
    {
        $cookie = $this->loginAs('qa.superadmin');
        $leaseId = $this->fixture('leases', 'already_expired');
        $res = $this->request('DELETE', '/crm/api/leases?id=' . $leaseId, null, $cookie);
        $this->assertSame(200, $res['status']);
    }

    // ── Contacts — delete restricted to admin+ ───────────────

    public function testAgentCannotDeleteContact(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $contactId = $this->fixture('contacts', 'agent_owned');
        $res = $this->request('DELETE', '/crm/api/contacts?id=' . $contactId, null, $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testAdminCanDeleteContact(): void
    {
        // Use a disposable contact so we don't destroy a fixture other tests need.
        $adminCookie = $this->loginAs('qa.admin');
        $create = $this->request('POST', '/crm/api/contacts', ['name' => 'Disposable Contact RBAC'], $adminCookie);
        $this->assertSame(200, $create['status']);
        $contactId = $create['json']['data']['id'];

        $res = $this->request('DELETE', '/crm/api/contacts?id=' . $contactId, null, $adminCookie);
        $this->assertSame(200, $res['status']);
    }

    // ── Users module — agents are locked to their own profile ───

    public function testAgentUsersListOnlyReturnsSelf(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('GET', '/crm/api/users', null, $cookie);
        $this->assertSame(200, $res['status']);
        $this->assertCount(1, $res['json']['data']);
        $this->assertSame('qa.agent', $res['json']['data'][0]['username']);
    }

    public function testAdminUsersListReturnsWholeTenantButNotOtherTenants(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('GET', '/crm/api/users', null, $cookie);
        $this->assertSame(200, $res['status']);

        $usernames = array_column($res['json']['data'], 'username');
        $this->assertContains('qa.agent', $usernames);
        $this->assertContains('qa.superadmin', $usernames);
        $this->assertNotContains('qa.b.superadmin', $usernames, 'Tenant A admin must not see Tenant B users');
    }

    public function testAgentCannotCreateUser(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('POST', '/crm/api/users', [
            'name' => 'Sneaky New User', 'email' => 'sneaky@example.test',
            'username' => 'sneaky.user', 'password' => 'Whatever123', 'role' => 'admin',
        ], $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testAdminCannotCreateSuperAdmin(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('POST', '/crm/api/users', [
            'name' => 'Escalation Attempt', 'email' => 'escalate@example.test',
            'username' => 'escalate.user', 'password' => 'Whatever123', 'role' => 'super_admin',
        ], $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testAgentCannotDeleteUser(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('DELETE', '/crm/api/users?id=' . $this->fixtureUserId('agent2'), null, $cookie);
        $this->assertSame(403, $res['status']);
    }

    // ── Platform admin routes — platform_superadmin only ─────

    public function testTenantAdminCannotAccessPlatformTenantsRoute(): void
    {
        $cookie = $this->loginAs('qa.superadmin');
        $res = $this->request('GET', '/crm/api/admin/tenants', null, $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testAgentCannotAccessPlatformTenantsRoute(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('GET', '/crm/api/admin/tenants', null, $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testPlatformSuperAdminCanListTenants(): void
    {
        $cookie = $this->loginAs('qa.platform');
        $res = $this->request('GET', '/crm/api/admin/tenants', null, $cookie);
        $this->assertSame(200, $res['status']);
        $this->assertTrue($res['json']['success']);
    }

    // ── Tenant data isolation ─────────────────────────────────

    public function testAdminCannotReadContactFromAnotherTenant(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $foreignContactId = $this->fixture('contacts', 'tenant_b');
        $res = $this->request('GET', '/crm/api/contacts?id=' . $foreignContactId, null, $cookie);
        $this->assertSame(404, $res['status'], 'Tenant A must not be able to read Tenant B\'s contact');
    }

    public function testAgentListOnlyShowsOwnAssignedContacts(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('GET', '/crm/api/contacts?limit=100', null, $cookie);
        $this->assertSame(200, $res['status']);
        foreach ($res['json']['data'] as $contact) {
            $this->assertSame($this->fixtureUserId('agent'), (int)$contact['assigned_to'],
                'Agent should only see contacts assigned to them');
        }
    }
}
