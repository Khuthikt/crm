<?php

namespace Tests\Feature;

class NegativeSecurityTest extends TestCase
{
    // ── Wrong credentials ─────────────────────────────────────

    public function testLoginWithWrongPasswordFails(): void
    {
        $res = $this->request('POST', '/crm/api/auth/login', [
            'username' => 'qa.admin',
            'password' => 'DefinitelyWrongPassword',
        ]);
        $this->assertSame(401, $res['status']);
        $this->assertFalse($res['json']['success']);
        $this->assertSame('Invalid username or password', $res['json']['error']);
        $this->assertNull($res['cookie']);
    }

    public function testLoginWithUnknownUsernameFails(): void
    {
        $res = $this->request('POST', '/crm/api/auth/login', [
            'username' => 'nobody.here',
            'password' => 'Whatever123',
        ]);
        $this->assertSame(401, $res['status']);
        $this->assertSame('Invalid username or password', $res['json']['error']);
    }

    public function testLoginWithEmptyCredentialsIsRejected(): void
    {
        $res = $this->request('POST', '/crm/api/auth/login', ['username' => '', 'password' => '']);
        $this->assertSame(400, $res['status']);
        $this->assertFalse($res['json']['success']);
    }

    public function testLoginWithMissingPasswordFieldIsRejected(): void
    {
        $res = $this->request('POST', '/crm/api/auth/login', ['username' => 'qa.admin']);
        $this->assertSame(400, $res['status']);
    }

    public function testDeactivatedUserCannotLogIn(): void
    {
        $res = $this->request('POST', '/crm/api/auth/login', [
            'username' => 'qa.inactive',
            'password' => $this->fixturePassword(),
        ]);
        $this->assertSame(401, $res['status']);
        // is_active=0 is excluded at the SQL level, so this collapses into
        // the same generic message as "user doesn't exist" — it does not
        // leak that the account exists but is deactivated.
        $this->assertSame('Invalid username or password', $res['json']['error']);
    }

    public function testSuspendedTenantUserCannotLogIn(): void
    {
        $res = $this->request('POST', '/crm/api/auth/login', [
            'username' => 'qa.suspended',
            'password' => $this->fixturePassword(),
        ]);
        $this->assertSame(401, $res['status']);
        $this->assertStringContainsString('suspended', strtolower($res['json']['error']));
    }

    public function testInvalidSessionCookieIsUnauthorized(): void
    {
        $res = $this->request('GET', '/crm/api/contacts', null, 'this-token-does-not-exist-in-sessions-table');
        $this->assertSame(401, $res['status']);
    }

    // ── Admin routes accessed as agent → expect 403 ──────────

    public function testAgentAccessingPlatformAdminRouteGets403(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('GET', '/crm/api/admin/tenants', null, $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testAgentDeletingInvoiceGets403(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('DELETE', '/crm/api/invoices?id=1', null, $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testAgentCreatingUserGets403(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('POST', '/crm/api/users', [
            'name' => 'X', 'email' => 'x@example.test', 'username' => 'x.user',
            'password' => 'Whatever123', 'role' => 'agent',
        ], $cookie);
        $this->assertSame(403, $res['status']);
    }

    public function testAgentDeletingLeaseGets403(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('DELETE', '/crm/api/leases?id=' . $this->fixture('leases', 'active'), null, $cookie);
        $this->assertSame(403, $res['status']);
    }

    // ── Empty required fields → validation errors ────────────

    public function testCreateContactWithEmptyNameIsRejected(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('POST', '/crm/api/contacts', ['name' => '', 'email' => 'noname@example.test'], $cookie);
        $this->assertSame(400, $res['status']);
        $this->assertFalse($res['json']['success']);
    }

    public function testCreateContactWithNoNameFieldAtAllIsRejected(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('POST', '/crm/api/contacts', ['email' => 'noname@example.test'], $cookie);
        $this->assertSame(400, $res['status']);
    }

    public function testCreateUserWithMissingRequiredFieldsIsRejected(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('POST', '/crm/api/users', ['name' => 'Incomplete User'], $cookie);
        $this->assertSame(400, $res['status']);
    }

    public function testCreateUserWithShortPasswordIsRejected(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('POST', '/crm/api/users', [
            'name' => 'Short Pw', 'email' => 'shortpw@example.test',
            'username' => 'shortpw.user', 'password' => '1234', 'role' => 'agent',
        ], $cookie);
        $this->assertSame(400, $res['status']);
        $this->assertStringContainsString('8 characters', $res['json']['error']);
    }

    public function testCreateInvoiceWithoutDueDateIsRejected(): void
    {
        $cookie = $this->loginAs('qa.finance');
        $res = $this->request('POST', '/crm/api/invoices', [
            'lease_id' => $this->fixture('leases', 'active'),
            'lines' => [['description' => 'Rent', 'quantity' => 1, 'unit_price' => 1000]],
        ], $cookie);
        $this->assertSame(400, $res['status']);
    }

    public function testCreateLeaseWithEmptyBodyIsRejected(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('POST', '/crm/api/leases', [], $cookie);
        $this->assertSame(400, $res['status']);
    }

    // ── SQL injection payloads ────────────────────────────────

    public function sqlInjectionPayloadProvider(): array
    {
        return [
            'classic tautology'   => ["' OR '1'='1"],
            'drop table'          => ["Robert'); DROP TABLE contacts;--"],
            'union select'        => ["' UNION SELECT username, password_hash FROM users -- "],
            'comment truncation'  => ["admin'--"],
        ];
    }

    /** @dataProvider sqlInjectionPayloadProvider */
    public function testSqlInjectionInLoginUsernameDoesNotBypassAuth(string $payload): void
    {
        $res = $this->request('POST', '/crm/api/auth/login', [
            'username' => $payload,
            'password' => 'irrelevant',
        ]);
        $this->assertSame(401, $res['status'], 'Injection payload must not bypass authentication');
        $this->assertSame('Invalid username or password', $res['json']['error']);
    }

    /** @dataProvider sqlInjectionPayloadProvider */
    public function testSqlInjectionInContactNameIsStoredAsLiteralText(string $payload): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('POST', '/crm/api/contacts', ['name' => $payload], $cookie);

        $this->assertSame(200, $res['status'], 'Parameterised queries should store the payload as inert text, not execute it');
        $this->assertSame($payload, $res['json']['data']['name']);

        // Prove the schema survived: the contacts table must still be queryable.
        $stillWorks = $this->request('GET', '/crm/api/contacts?limit=10', null, $cookie);
        $this->assertSame(200, $stillWorks['status']);
    }

    /** @dataProvider sqlInjectionPayloadProvider */
    public function testSqlInjectionInSearchQueryDoesNotErrorOrLeak(string $payload): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('GET', '/crm/api/contacts?q=' . urlencode($payload), null, $cookie);

        $this->assertSame(200, $res['status'], 'Search must not 500 on injection payloads');
        $this->assertTrue($res['json']['success']);
    }

    public function testSqlInjectionInContactIdParameterIsIgnored(): void
    {
        $cookie = $this->loginAs('qa.admin');
        // ?id= is cast with (int) before use. PHP's (int) cast reads only the
        // leading numeric characters, so "99999999 OR 1=1" becomes 99999999 —
        // an id that doesn't exist — rather than executing the injected clause.
        $res = $this->request('GET', '/crm/api/contacts?id=' . urlencode("99999999 OR 1=1"), null, $cookie);
        $this->assertSame(404, $res['status'], 'The (int) cast should neutralise the payload, not return every contact');
    }
}
