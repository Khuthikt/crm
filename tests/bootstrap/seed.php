<?php
/**
 * Seeds crm_db_test with a deterministic baseline fixture set.
 * Run once at the start of the PHPUnit process (see bootstrap.php).
 * NEVER point this at the production database — it truncates every table.
 */

require_once __DIR__ . '/../../includes/db.php';

if (DB_NAME !== 'crm_db_test') {
    fwrite(STDERR, "Refusing to seed — CRM_DB_NAME is '" . DB_NAME . "', expected 'crm_db_test'.\n");
    exit(1);
}

const TEST_PASSWORD = 'TestPass123!';

function seed_reset(): void {
    $pdo = DB::get();
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $tables = [
        'activity_log', 'notifications', 'contact_documents', 'lease_repairs',
        'invoice_lines', 'invoices', 'invoice_schedules', 'invoice_customers',
        'leases', 'deals', 'listing_photos', 'listings', 'contacts',
        'tenant_settings', 'sessions', 'users', 'tenants',
    ];
    foreach ($tables as $t) {
        $pdo->exec("TRUNCATE TABLE `$t`");
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
}

function seed_run(): array {
    seed_reset();
    $hash = password_hash(TEST_PASSWORD, PASSWORD_BCRYPT, ['cost' => 12]);

    // ── Tenant A (primary test tenant, active) ──────────────
    $tenantA = DB::insert(
        'INSERT INTO tenants (name, slug, email, status, plan) VALUES (?,?,?,?,?)',
        ['QA Test Properties', 'qa-test-properties', 'qa@example.test', 'active', 'professional']
    );

    // ── Tenant B (isolation check — separate active tenant) ─
    $tenantB = DB::insert(
        'INSERT INTO tenants (name, slug, email, status, plan) VALUES (?,?,?,?,?)',
        ['QA Other Properties', 'qa-other-properties', 'other@example.test', 'active', 'starter']
    );

    // ── Tenant C (suspended — login must be blocked) ────────
    $tenantC = DB::insert(
        'INSERT INTO tenants (name, slug, email, status, plan) VALUES (?,?,?,?,?)',
        ['QA Suspended Properties', 'qa-suspended-properties', 'suspended@example.test', 'suspended', 'starter']
    );

    $users = [];

    $users['platform'] = DB::insert(
        'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
        [null, 'QA Platform Admin', 'qa.platform@example.test', 'qa.platform', $hash, 'platform_superadmin']
    );

    $users['super_admin'] = DB::insert(
        'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
        [$tenantA, 'QA Super Admin', 'qa.superadmin@example.test', 'qa.superadmin', $hash, 'super_admin']
    );

    $users['admin'] = DB::insert(
        'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
        [$tenantA, 'QA Admin', 'qa.admin@example.test', 'qa.admin', $hash, 'admin']
    );

    $users['finance_admin'] = DB::insert(
        'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
        [$tenantA, 'QA Finance Admin', 'qa.finance@example.test', 'qa.finance', $hash, 'finance_admin']
    );

    $users['agent'] = DB::insert(
        'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
        [$tenantA, 'QA Agent', 'qa.agent@example.test', 'qa.agent', $hash, 'agent']
    );

    $users['agent2'] = DB::insert(
        'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
        [$tenantA, 'QA Agent Two', 'qa.agent2@example.test', 'qa.agent2', $hash, 'agent']
    );

    $users['inactive'] = DB::insert(
        'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active) VALUES (?,?,?,?,?,?,0)',
        [$tenantA, 'QA Deactivated User', 'qa.inactive@example.test', 'qa.inactive', $hash, 'agent']
    );

    $users['tenantB_super_admin'] = DB::insert(
        'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
        [$tenantB, 'QA B Super Admin', 'qa.b.superadmin@example.test', 'qa.b.superadmin', $hash, 'super_admin']
    );

    $users['suspended_tenant_admin'] = DB::insert(
        'INSERT INTO users (tenant_id, name, email, username, password_hash, role, is_active) VALUES (?,?,?,?,?,?,1)',
        [$tenantC, 'QA Suspended Tenant Admin', 'qa.suspended@example.test', 'qa.suspended', $hash, 'super_admin']
    );

    // ── Contacts ─────────────────────────────────────────────
    $contactAgentOwned = DB::insert(
        "INSERT INTO contacts (tenant_id, assigned_to, name, phone, email, type, status, created_by)
         VALUES (?,?,?,?,?,?,?,?)",
        [$tenantA, $users['agent'], 'Agent Owned Tenant', '0821111111', 'agent.owned@example.test', 'Tenant', 'active', $users['agent']]
    );

    $contactOther = DB::insert(
        "INSERT INTO contacts (tenant_id, assigned_to, name, phone, email, type, status, created_by)
         VALUES (?,?,?,?,?,?,?,?)",
        [$tenantA, $users['agent2'], 'Other Agent Contact', '0822222222', 'other.agent@example.test', 'Tenant', 'active', $users['agent2']]
    );

    $landlordContact = DB::insert(
        "INSERT INTO contacts (tenant_id, assigned_to, name, phone, email, type, status, created_by)
         VALUES (?,?,?,?,?,?,?,?)",
        [$tenantA, $users['admin'], 'QA Landlord', '0823333333', 'landlord@example.test', 'Landlord', 'active', $users['admin']]
    );

    $contactTenantB = DB::insert(
        "INSERT INTO contacts (tenant_id, name, type, status, created_by) VALUES (?,?,?,?,?)",
        [$tenantB, 'Tenant B Contact', 'Tenant', 'active', $users['tenantB_super_admin']]
    );

    // ── Leases ───────────────────────────────────────────────
    $activeLease = DB::insert(
        'INSERT INTO leases (tenant_id, ref, contact_id, tenant_name, landlord_id, landlord_name, property, unit, start_date, end_date, monthly_rent, deposit, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [$tenantA, 'LSE-0001', $contactAgentOwned, 'Agent Owned Tenant', $landlordContact, 'QA Landlord', '12 Main Road', 'Unit 4', '2026-01-01', '2026-12-31', 12000.00, 12000.00, 'active', $users['admin']]
    );

    $expiringSoonLease = DB::insert(
        'INSERT INTO leases (tenant_id, ref, contact_id, tenant_name, landlord_id, landlord_name, property, unit, start_date, end_date, monthly_rent, deposit, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [$tenantA, 'LSE-0002', $contactOther, 'Other Agent Contact', $landlordContact, 'QA Landlord', '8 Oak Street', 'Unit 1', '2025-09-01', date('Y-m-d', strtotime('+20 days')), 9500.00, 9500.00, 'active', $users['admin']]
    );

    // Past end_date but status is still 'active' in the DB — leases/index.php
    // only flips status to 'expired' as a side effect of GET /leases, so a
    // freshly-seeded row like this simulates "nobody has loaded the list yet".
    $alreadyExpiredLease = DB::insert(
        'INSERT INTO leases (tenant_id, ref, contact_id, tenant_name, landlord_id, landlord_name, property, unit, start_date, end_date, monthly_rent, deposit, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [$tenantA, 'LSE-0003', $contactOther, 'Lapsed Tenant', $landlordContact, 'QA Landlord', '3 Pine Ave', 'Unit 2', '2024-01-01', date('Y-m-d', strtotime('-5 days')), 7000.00, 7000.00, 'active', $users['admin']]
    );

    // Explicitly in 'expired' status (the end state after auto-expiry has run).
    $expiredStatusLease = DB::insert(
        'INSERT INTO leases (tenant_id, ref, contact_id, tenant_name, landlord_id, landlord_name, property, unit, start_date, end_date, monthly_rent, deposit, status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [$tenantA, 'LSE-0004', $contactOther, 'Expired Status Tenant', $landlordContact, 'QA Landlord', '9 Elm Close', 'Unit 3', '2023-01-01', date('Y-m-d', strtotime('-30 days')), 6500.00, 6500.00, 'expired', $users['admin']]
    );

    return [
        'tenant_a' => $tenantA,
        'tenant_b' => $tenantB,
        'tenant_c_suspended' => $tenantC,
        'users' => $users,
        'contacts' => [
            'agent_owned' => $contactAgentOwned,
            'other_agent' => $contactOther,
            'landlord' => $landlordContact,
            'tenant_b' => $contactTenantB,
        ],
        'leases' => [
            'active' => $activeLease,
            'expiring_soon' => $expiringSoonLease,
            'already_expired' => $alreadyExpiredLease,
            'expired_status' => $expiredStatusLease,
        ],
        'password' => TEST_PASSWORD,
    ];
}
