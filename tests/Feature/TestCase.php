<?php

namespace Tests\Feature;

use PHPUnit\Framework\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected static string $baseUrl;
    protected static array $fixtures;

    public static function setUpBeforeClass(): void
    {
        self::$baseUrl  = rtrim(getenv('CRM_BASE_URL') ?: 'http://127.0.0.1:8199', '/');
        self::$fixtures = $GLOBALS['__crm_fixtures'];
    }

    /** Fixture password shared by every seeded user. */
    protected function fixturePassword(): string
    {
        return self::$fixtures['password'];
    }

    protected function fixtureUserId(string $key): int
    {
        return self::$fixtures['users'][$key];
    }

    protected function fixture(string ...$path)
    {
        $node = self::$fixtures;
        foreach ($path as $p) {
            $node = $node[$p];
        }
        return $node;
    }

    /**
     * Perform a raw HTTP request against the live test server.
     *
     * @return array{status:int, json:?array, body:string, headers:array, cookie:?string}
     */
    protected function request(string $method, string $path, ?array $body = null, ?string $cookie = null): array
    {
        $ch = curl_init(self::$baseUrl . $path);
        $headers = ['Content-Type: application/json'];
        if ($cookie !== null) {
            $headers[] = 'Cookie: crm_session=' . $cookie;
        }

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 10,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }

        $raw = curl_exec($ch);
        if ($raw === false) {
            $this->fail('cURL error calling ' . $path . ': ' . curl_error($ch));
        }
        $status     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        $rawHeaders = substr($raw, 0, $headerSize);
        $rawBody    = substr($raw, $headerSize);

        $setCookie = null;
        if (preg_match('/^Set-Cookie:\s*crm_session=([^;]+);/mi', $rawHeaders, $m)) {
            $setCookie = $m[1];
        }

        $json = json_decode($rawBody, true);

        return [
            'status'  => $status,
            'json'    => is_array($json) ? $json : null,
            'body'    => $rawBody,
            'headers' => $rawHeaders,
            'cookie'  => $setCookie,
        ];
    }

    /** Log in as a seeded fixture user and return the session cookie token. */
    protected function loginAs(string $username): string
    {
        $res = $this->request('POST', '/crm/api/auth/login', [
            'username' => $username,
            'password' => $this->fixturePassword(),
        ]);
        $this->assertSame(200, $res['status'], 'Login failed for ' . $username . ': ' . $res['body']);
        $this->assertNotNull($res['cookie'], 'Login did not set a session cookie for ' . $username);
        return $res['cookie'];
    }
}
