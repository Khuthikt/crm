<?php

namespace Tests\Feature;

/**
 * Regression tests that pin down confirmed defects found while building
 * this suite. Each test documents CURRENT behaviour (bug included) so the
 * suite goes red the moment a fix changes that behaviour — at which point
 * the assertion should be flipped to the correct expectation and this
 * docblock trimmed down.
 */
class KnownIssuesTest extends TestCase
{
    /**
     * BUG (high severity): admin/tenants.php has a leftover debug line
     * (`if ($method==='POST'){Response::success(['action'=>$action,'body'=>$bodyData],'debug');exit;}`)
     * that fires before the impersonate / reset_password / create_user /
     * create_tenant branches are ever reached. Every POST to this endpoint
     * — including tenant creation, which is the platform admin's core
     * workflow — returns a debug echo instead of doing anything. The
     * feature is completely non-functional in this deployment.
     */
    public function testAdminTenantsCreateIsStuckReturningDebugPayloadInsteadOfCreatingATenant(): void
    {
        $cookie = $this->loginAs('qa.platform');

        $before = $this->request('GET', '/crm/api/admin/tenants', null, $cookie);
        $countBefore = count($before['json']['data']);

        $res = $this->request('POST', '/crm/api/admin/tenants', [
            'name'           => 'Should Never Exist Properties',
            'slug'           => 'should-never-exist',
            'admin_name'     => 'Ghost Admin',
            'admin_email'    => 'ghost@example.test',
            'admin_password' => 'GhostPass123!',
        ], $cookie);

        $this->assertSame(200, $res['status']);
        $this->assertSame('debug', $res['json']['message'],
            'admin/tenants.php short-circuits every POST with a debug response — see file line 17');

        $after = $this->request('GET', '/crm/api/admin/tenants', null, $cookie);
        $this->assertCount($countBefore, $after['json']['data'],
            'No tenant should have been created because the debug line exits before the create-tenant logic runs');
    }

    /**
     * BUG (medium severity): api/contacts/index.php has two `case 'POST':`
     * blocks in its switch statement. The first one always exits via
     * Response::success(), so the second block — which defaults
     * `assigned_to` to the creating user — is dead code. Net effect: a
     * newly created contact has assigned_to = NULL unless the caller
     * explicitly passes it. For an agent, that means a contact they just
     * created immediately disappears from their own contact list (which is
     * filtered to `assigned_to = <agent id>`).
     */
    public function testContactCreatedByAgentWithoutExplicitAssignedToIsInvisibleToThatAgent(): void
    {
        $cookie = $this->loginAs('qa.agent');

        $create = $this->request('POST', '/crm/api/contacts', ['name' => 'Orphaned By Dead Code'], $cookie);
        $this->assertSame(200, $create['status']);
        $this->assertNull($create['json']['data']['assigned_to'],
            'Confirms assigned_to is NULL — the duplicate case \'POST\' default never runs');

        $list = $this->request('GET', '/crm/api/contacts?limit=200', null, $cookie);
        $names = array_column($list['json']['data'], 'name');
        $this->assertNotContains('Orphaned By Dead Code', $names,
            'The agent cannot see the contact they just created');
    }

    /**
     * FINDING (informational): the response shape for a role-check
     * rejection differs depending on which code path rejects it.
     * Auth::requireRole() -> {"error": "..."} (no "success" key).
     * Response::error()/forbidden() -> {"success": false, "error": "..."}.
     * A frontend that always reads `.success` to decide error state will
     * silently treat an Auth::requireRole() 403 as success === undefined
     * rather than false — worth standardising on one shape.
     */
    public function testRequireRoleRejectionShapeDiffersFromResponseErrorShape(): void
    {
        $cookie = $this->loginAs('qa.agent');

        $viaRequireRole = $this->request('GET', '/crm/api/invoices', null, $cookie);
        $this->assertArrayNotHasKey('success', $viaRequireRole['json']);

        $viaResponseError = $this->request('POST', '/crm/api/contacts', ['name' => ''], $cookie);
        $this->assertArrayHasKey('success', $viaResponseError['json']);
        $this->assertFalse($viaResponseError['json']['success']);
    }
}
