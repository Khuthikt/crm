<?php

namespace Tests\Feature;

/**
 * Login flow for every user role the app defines:
 * platform_superadmin, super_admin, admin, finance_admin, agent.
 *
 * Note: the schema has no "landlord" login role — landlords are a
 * `contacts.type` value (people who own property), not CRM users who
 * authenticate. See RbacTest for landlord-as-contact coverage.
 */
class LoginTest extends TestCase
{
    public function roleProvider(): array
    {
        return [
            'platform_superadmin' => ['qa.platform', 'platform_superadmin'],
            'super_admin'         => ['qa.superadmin', 'super_admin'],
            'admin'               => ['qa.admin', 'admin'],
            'finance_admin'       => ['qa.finance', 'finance_admin'],
            'agent'               => ['qa.agent', 'agent'],
        ];
    }

    /** @dataProvider roleProvider */
    public function testLoginSucceedsForEachRole(string $username, string $expectedRole): void
    {
        $res = $this->request('POST', '/crm/api/auth/login', [
            'username' => $username,
            'password' => $this->fixturePassword(),
        ]);

        $this->assertSame(200, $res['status']);
        $this->assertTrue($res['json']['success']);
        $this->assertSame($expectedRole, $res['json']['data']['user']['role']);
        $this->assertSame($username, $res['json']['data']['user']['username']);
        $this->assertNotNull($res['cookie'], 'Expected a crm_session cookie to be set');

        // Password hash must never be echoed back to the client.
        $this->assertArrayNotHasKey('password_hash', $res['json']['data']['user']);
    }

    /** @dataProvider roleProvider */
    public function testLoginByEmailAlsoWorks(string $username, string $expectedRole): void
    {
        $email = $username . '@example.test';
        $res = $this->request('POST', '/crm/api/auth/login', [
            'username' => $email,
            'password' => $this->fixturePassword(),
        ]);

        $this->assertSame(200, $res['status']);
        $this->assertSame($expectedRole, $res['json']['data']['user']['role']);
    }

    public function testSessionCookieGrantsAccessToProtectedRoute(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('GET', '/crm/api/contacts', null, $cookie);
        $this->assertSame(200, $res['status']);
        $this->assertTrue($res['json']['success']);
    }

    public function testLogoutInvalidatesSession(): void
    {
        $cookie = $this->loginAs('qa.agent');

        $before = $this->request('GET', '/crm/api/contacts', null, $cookie);
        $this->assertSame(200, $before['status']);

        $logout = $this->request('POST', '/crm/api/auth/logout', null, $cookie);
        $this->assertSame(200, $logout['status']);

        $after = $this->request('GET', '/crm/api/contacts', null, $cookie);
        $this->assertSame(401, $after['status'], 'Session should be dead after logout');
    }

    public function testRequestWithoutCookieIsUnauthorized(): void
    {
        $res = $this->request('GET', '/crm/api/contacts');
        $this->assertSame(401, $res['status']);
        $this->assertFalse($res['json']['success']);
    }
}
