<?php

namespace Tests\Feature;

class ContactCrudTest extends TestCase
{
    public function testCreateContact(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('POST', '/crm/api/contacts', [
            'name'  => 'Jane CRUD Test',
            'email' => 'jane.crud@example.test',
            'phone' => '0831234567',
            'type'  => 'Buyer',
        ], $cookie);

        $this->assertSame(200, $res['status']);
        $this->assertTrue($res['json']['success']);
        $this->assertSame('Jane CRUD Test', $res['json']['data']['name']);
        $this->assertSame('Buyer', $res['json']['data']['type']);
        $this->assertArrayHasKey('id', $res['json']['data']);
    }

    public function testCreatedContactIsRetrievable(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $create = $this->request('POST', '/crm/api/contacts', ['name' => 'Retrievable Contact'], $cookie);
        $id = $create['json']['data']['id'];

        $get = $this->request('GET', '/crm/api/contacts?id=' . $id, null, $cookie);
        $this->assertSame(200, $get['status']);
        $this->assertSame('Retrievable Contact', $get['json']['data']['name']);
        $this->assertArrayHasKey('documents', $get['json']['data']);
    }

    public function testEditContact(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $create = $this->request('POST', '/crm/api/contacts', ['name' => 'Before Edit', 'phone' => '0820000000'], $cookie);
        $id = $create['json']['data']['id'];

        $update = $this->request('PUT', '/crm/api/contacts?id=' . $id, [
            'name'  => 'After Edit',
            'phone' => '0829999999',
            'type'  => 'Landlord',
        ], $cookie);

        $this->assertSame(200, $update['status']);
        $this->assertSame('After Edit', $update['json']['data']['name']);
        $this->assertSame('0829999999', $update['json']['data']['phone']);
        $this->assertSame('Landlord', $update['json']['data']['type']);
    }

    public function testDeleteContact(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $create = $this->request('POST', '/crm/api/contacts', ['name' => 'To Be Deleted'], $cookie);
        $id = $create['json']['data']['id'];

        $delete = $this->request('DELETE', '/crm/api/contacts?id=' . $id, null, $cookie);
        $this->assertSame(200, $delete['status']);

        $get = $this->request('GET', '/crm/api/contacts?id=' . $id, null, $cookie);
        $this->assertSame(404, $get['status'], 'Deleted contact should no longer be retrievable');
    }

    public function testEditNonExistentContactReturns404(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('PUT', '/crm/api/contacts?id=999999', ['name' => 'Ghost'], $cookie);
        $this->assertSame(404, $res['status']);
    }

    public function testDeleteNonExistentContactReturns404(): void
    {
        $cookie = $this->loginAs('qa.admin');
        $res = $this->request('DELETE', '/crm/api/contacts?id=999999', null, $cookie);
        $this->assertSame(404, $res['status']);
    }

    public function testAgentCreatedContactIsAutoAssignedToThemselves(): void
    {
        $cookie = $this->loginAs('qa.agent');
        $res = $this->request('POST', '/crm/api/contacts', ['name' => 'Agent Self Assigned'], $cookie);
        $this->assertSame(200, $res['status']);
        $this->assertSame($this->fixtureUserId('agent'), (int)$res['json']['data']['assigned_to']);
    }
}
