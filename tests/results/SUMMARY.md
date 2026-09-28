# Muga Properties CRM — QA Test Suite Results

**Run date:** 25 August 2026
**Framework:** PHPUnit 9.6.36 (PHP 8.1.2)
**Result:** 92 tests, 342 assertions, **1 failure**, 0 errors

Raw artifacts in this folder:
- `console-output.txt` — full console run (--testdox)
- `testdox.html` — human-readable HTML report
- `junit.xml` — machine-readable JUnit XML (for CI ingestion)

---

## How this was tested

The app has no framework/router beyond a hand-rolled `index.php` front
controller, and every endpoint calls `exit()` after emitting its JSON
response. That rules out in-process testing (the first endpoint call would
kill the PHPUnit process). Instead, the suite:

1. Seeds an **isolated database** (`crm_db_test`) — schema cloned from the
   real `crm_db` structure (structure only, zero rows copied) — with a
   deterministic fixture set (5 roles × 1 tenant, plus a second tenant for
   isolation checks, plus a suspended tenant).
2. Boots a throwaway `php -S` server against the actual app code with
   `CRM_DB_*` env vars pointed at `crm_db_test`.
3. Drives every test over real HTTP (cURL) against that server, exactly as
   the browser frontend would.
4. Tears the server down when the run finishes.

**Production data was never touched.** `crm_db` (491 real contacts, 7 real
users) was read once (`SHOW TABLES`, structure-only `mysqldump --no-data`)
to build the test schema, and never written to.

One infrastructure change was made to the app itself, in
`includes/config.php`: DB credentials now read from `CRM_DB_*` environment
variables with the existing hard-coded values kept as the fallback default.
With no env vars set (i.e. under the real web server), behaviour is
byte-for-byte identical to before — this only exists so the test harness
can point at `crm_db_test` instead of production. `composer.json` /
`vendor/phpunit` / `phpunit.xml` / `tests/` are all new and additive.

---

## Coverage delivered

| Area | File | Tests |
|---|---|---|
| Login — all 5 roles (username + email) | `LoginTest.php` | 13 |
| RBAC — module access & data scoping | `RbacTest.php` | 19 |
| Contact create/read/update/delete | `ContactCrudTest.php` | 7 |
| Invoice generation (VAT, totals, guards) | `InvoiceTest.php` | 7 |
| Lease creation & expiry warnings | `LeaseTest.php` | 10 |
| Negative & security (bad creds, 403s, empty fields, SQLi) | `NegativeSecurityTest.php` | 30 |
| Confirmed bugs (regression pins) | `KnownIssuesTest.php` | 3 |
| Schema drift vs. `database.sql` | `SchemaIntegrityTest.php` | 2 |
| Harness sanity check | `SmokeTest.php` | 1 |

### A note on "landlord" as a login role
The task asked for login coverage of admin, agent, and landlord. The
schema's `users.role` enum is `platform_superadmin`, `super_admin`,
`admin`, `finance_admin`, `agent` — there is **no landlord user role**.
"Landlord" only exists as a `contacts.type` value (a property owner
record), not a CRM account that authenticates. Login tests cover all five
real roles instead; landlord-as-contact is covered under Contact CRUD and
lease `landlord_id` linkage.

---

## The one failing test — real bug, not a test bug

**`ContactCrudTest::testAgentCreatedContactIsAutoAssignedToThemselves`**

`api/contacts/index.php` has two `case 'POST':` blocks in one switch
statement. The first block (the only one PHP ever reaches — it always
exits via `Response::success()`) inserts `assigned_to` as `NULL` unless
the caller explicitly passes it. The second block, which defaults
`assigned_to` to the creating user, is dead code.

**Impact:** an agent who creates a new contact without manually setting
`assigned_to` cannot see that contact afterwards — the agent's own contact
list is filtered to `assigned_to = <their id>`, and the new row has
`assigned_to = NULL`. The contact silently disappears from the agent's
workflow immediately after creation.

**Fix:** delete the dead second `case 'POST':` block, or fold its
`assigned_to` default into the first block:
`$body['assigned_to'] ?? $user['user_id'] ?? $user['id']`.

This test was left failing on purpose (not patched to match the bug) so it
stays red until the fix lands.

---

## Other confirmed issues found during testing

These are pinned as passing tests in `KnownIssuesTest.php` /
`SchemaIntegrityTest.php` — passing because they assert *current* (buggy)
behaviour, so they'll go red the moment someone fixes the underlying code
(a deliberate signal to update the assertion, not a false positive).

### 1. Critical — `admin/tenants.php` tenant management is completely dead
Line 17:
```php
$action = $_GET['action'] ?? $bodyData['action'] ?? ''; if($method==='POST'){Response::success(['action'=>$action,'body'=>$bodyData],'debug');exit;}
```
This debug line exits on **every** POST request before the real branches
(`impersonate`, `exit_impersonate`, `reset_password`, `create_user`,
create-tenant) ever run. Result: a platform admin cannot create a tenant,
impersonate a tenant, reset a tenant's password, or create a tenant user —
the entire tenant-management POST surface returns `{"message":"debug",...}`
and does nothing. Also note line 14 writes to `/tmp/crm_debug.txt` on
**every** request to this file (GET included), and references `$action`
before it's defined on that same line. This reads like debug code
accidentally left in production — recommend removing lines 14–17 and
restoring the `$action` assignment above the branches that use it.

### 2. High — `database.sql` is out of date vs. the live schema
Production `crm_db` has three tables that `database.sql` never creates:
`login_attempts`, `invoice_schedules`, `invoice_customers`. A database
provisioned from scratch using the shipped `database.sql` (disaster
recovery, staging, onboarding a new dev) would hard-fail on the **first
login attempt** — `Auth::login()` inserts into `login_attempts`
unconditionally, `PDO::ATTR_ERRMODE` is `EXCEPTION`, and there's no
try/catch around it. `scripts/generate_scheduled_invoices.php` would also
fail (`invoice_schedules` missing). Recommend re-exporting `database.sql`
from the live schema (structure only) so a fresh install actually works.

### 3. Medium — inconsistent error response shape on 403s
`Auth::requireRole()` short-circuits with `{"error": "..."}` (no `success`
key), while the rest of the API uses `Response::error()` /
`Response::forbidden()`, which returns `{"success": false, "error": "..."}`.
A frontend that checks `response.success === false` to detect an error
will not recognise an `Auth::requireRole()` rejection as a failure
(`success` is simply `undefined`). Recommend routing `requireRole()`
through `Response::forbidden()` instead of its own inline
`echo`/`http_response_code()`.

### 4. Low/behavioural — lease expiry is lazy, not scheduled
`leases/index.php`'s `GET` handler flips `status` from `active` to
`expired` as a side effect of listing leases
(`UPDATE leases SET status='expired' WHERE ... end_date < CURDATE()`).
There is no cron/script that does this proactively for leases whose page
is never loaded. Until something calls `GET /leases`, a lapsed lease still
reads as `active` and — confirmed by
`InvoiceTest::testLeaseWithPastEndDateButStillActiveStatusCanStillBeInvoiced`
— can still have new invoices generated against it. Not necessarily wrong
(may be intentional, since `scripts/lease_notifications.php` sends renewal
emails independently of this status field), but worth confirming this
matches the intended business process.

### 5. Low — undefined `$ip` in `Auth::login()`
`includes/auth.php`, `login_attempts` insert: `[$username, $ip]` — `$ip`
is never assigned before this line. Under the current config
(`error_reporting(0)`), this is silently coerced to `null` rather than
causing a fatal error, but every row in `login_attempts` is recording a
blank IP address, which undermines its usefulness for spotting brute-force
attempts. Likely meant to be `$_SERVER['REMOTE_ADDR']` (already computed a
few lines below for the `sessions` insert).

---

## Re-running the suite

```bash
cd /var/www/html/crm
vendor/bin/phpunit --testdox
```

Everything (DB seed, throwaway web server, teardown) is handled by
`tests/bootstrap/bootstrap.php` — no manual setup needed beyond
`composer install`. The suite refuses to run unless
`CRM_DB_NAME=crm_db_test` (enforced in both `bootstrap.php` and
`tests/bootstrap/seed.php`), as a guardrail against ever truncating
production data.
