<?php

namespace Tests\Feature;

class SmokeTest extends TestCase
{
    public function testServerIsUpAndLoginWorks(): void
    {
        $cookie = $this->loginAs('qa.superadmin');
        $this->assertNotEmpty($cookie);
    }
}
