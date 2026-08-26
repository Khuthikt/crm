<?php

namespace Tests\Feature;

use PDO;
use PHPUnit\Framework\TestCase as BaseTestCase;

/**
 * FINDING (high severity): database.sql — the schema file a fresh
 * install/disaster-recovery would run — is missing three tables that the
 * live application code requires: `login_attempts` (written on every
 * successful login by Auth::login()), `invoice_schedules`, and
 * `invoice_customers`. A database provisioned strictly from database.sql
 * would hard-fail on first login with an uncaught PDOException, because
 * PDO::ATTR_ERRMODE is EXCEPTION and there is no try/catch around that
 * insert in includes/auth.php.
 *
 * This does not touch crm_db or crm_db_test — it builds a disposable,
 * uniquely-named database strictly from the repo's database.sql, checks
 * it, then drops it.
 */
class SchemaIntegrityTest extends BaseTestCase
{
    private static string $tmpDb = 'crm_schema_check_tmp';

    public static function tearDownAfterClass(): void
    {
        self::mysql('DROP DATABASE IF EXISTS ' . self::$tmpDb . ';');
    }

    private static function mysql(string $sql): string
    {
        $cmd = 'mysql -u root -e ' . escapeshellarg($sql) . ' 2>&1';
        return shell_exec($cmd) ?? '';
    }

    public function testFreshInstallFromDatabaseSqlIsMissingTablesTheAppRequires(): void
    {
        if (shell_exec('which mysql')  === null) {
            $this->markTestSkipped('mysql client not available in this environment');
        }

        self::mysql('DROP DATABASE IF EXISTS ' . self::$tmpDb . ';');
        self::mysql('CREATE DATABASE ' . self::$tmpDb . ' CHARACTER SET utf8mb4;');

        $schemaFile = dirname(__DIR__, 2) . '/database.sql';
        $this->assertFileExists($schemaFile);

        $load = shell_exec('mysql -u root ' . self::$tmpDb . ' < ' . escapeshellarg($schemaFile) . ' 2>&1');
        $this->assertSame('', trim((string)$load), 'database.sql should load cleanly: ' . $load);

        $pdo = new PDO('mysql:host=localhost;dbname=' . self::$tmpDb . ';charset=utf8mb4', 'root', '');
        $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);

        $appRequires = ['login_attempts', 'invoice_schedules', 'invoice_customers'];
        $missing = array_values(array_diff($appRequires, $tables));

        $this->assertSame(
            $appRequires,
            $missing,
            'Expected all three tables to be missing from a fresh database.sql install. ' .
            'If this assertion fails because a table now exists, database.sql has been fixed — ' .
            'update this test to assert against the remaining gap (or delete it if fully resolved).'
        );
    }

    public function testLoginAttemptsInsertThrowsOnAFreshDatabaseSqlInstall(): void
    {
        if (shell_exec('which mysql') === null) {
            $this->markTestSkipped('mysql client not available in this environment');
        }

        $pdo = new PDO('mysql:host=localhost;dbname=' . self::$tmpDb . ';charset=utf8mb4', 'root', '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);

        $this->expectException(\PDOException::class);
        $this->expectExceptionMessageMatches("/login_attempts/");
        $pdo->prepare('INSERT INTO login_attempts (username, ip, success) VALUES (?,?,1)')
            ->execute(['probe', '127.0.0.1']);
    }
}
