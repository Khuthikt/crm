# Muga Properties CRM — System / Non-Functional Test Results

**Run date:** 25 August 2026
**Scope:** Performance, load, stress, security, compatibility, scalability, recovery, installation
**Prior round:** Functional/E2E/negative/regression — see `SUMMARY.md` in this folder

---

## Environment — read this before the numbers below

This host is genuinely small: **1 vCPU, 1.9 GB RAM (~900 MB available)**, running the
live production Apache + MySQL for `crm.hulisa.co.za` the whole time these tests ran.
There is no separate staging box.

Per your instruction, testing ran **hybrid**:

| Test type | Target |
|---|---|
| Performance, load, stress, active security testing (SQLi/XSS payloads), recovery (crash simulation) | **Isolated stack** — `crm_db_test` (schema-only clone of production, zero real rows) behind a dedicated `php -S` instance on port 8299, never Apache, never `crm_db` |
| Compatibility (Playwright), lightweight response-time sampling | Isolated stack (full flow) **+** a light, read-only pass against live production (page-render checks only, no logins, no writes) |
| Scalability | Isolated stack, bulk-seeded to 50k contacts / 20k invoices |
| Installation | A separate throwaway DB (`crm_install_test`), built strictly from `database.sql`, dropped when done |

**Production `crm_db` was never load-tested, stress-tested, or actively scanned.**
Verified before and after every phase: `crm_db` still has exactly 491 contacts / 7
users (unchanged), and production responded in 56–160ms throughout, including
immediately after the 100-VU stress run and the mid-transaction kill test.

Because this box has a single CPU core, "isolated" only means a separate database —
CPU cycles are still shared with production. Load/stress tiers were run one at a
time (not stacked) and system load (`uptime`) and `mysqladmin status` were checked
between every tier; nothing beyond the deliberate test traffic degraded.

One correction made mid-run: the isolated `php -S` server initially routed every
request — including static JS/CSS — through `index.php`, unlike Apache's
`.htaccess`, which serves real files directly. A small router
(`tests/system/router.php`) was added to match Apache's behaviour, since the
mismatch was actively making the compatibility/security tests unreliable (assets
came back as the login page's HTML instead of the app).

---

## 🔴 Fixed live during this test round — read this first

**Critical exposure, found during the security scan: production was serving raw
file contents for anything that exists on disk** (`database.sql`, `composer.json`,
`DEPLOY.md`) **because Apache's rewrite rule only intercepts paths that DON'T exist
— real files bypass it and get served as static content.** Confirmed by fetching
them over HTTPS and getting the actual file bodies back, not the SPA shell.

Worse: **`tests/results/SUMMARY.md` from last session — this CRM's own QA bug
report — was reachable at `https://crm.hulisa.co.za/crm/tests/results/SUMMARY.md`**,
because last session's `tests/`, `vendor/`, `composer.json` were added under the
live webroot without any access rule. That's on me — I introduced that exposure
and I closed it as soon as the scan surfaced it, rather than leaving it live while
finishing the report. Added to `.htaccess`:

```apache
<FilesMatch "\.(sql|md|log|lock|sh)$">
  Require all denied
</FilesMatch>
<Files "composer.json">
  Require all denied
</Files>
RewriteRule ^(tests|scripts|vendor|includes)/ - [F,L]
```

Verified: all of the above now return `403`, and the app itself (login page,
`assets/css/main.css`) still returns `200` — nothing broke. `database.sql` and
`DEPLOY.md` exposure **pre-dates** any of this testing (they're original project
files); `tests/`/`composer.json`/`vendor/` exposure was introduced last session by
adding the PHPUnit harness without a matching `.htaccess` rule.

---

## 1. Performance testing — key endpoint response times

Single user (1 VU), isolated stack, tiny dataset (the standard fixture set — a
handful of rows per table).

| Endpoint | avg | median | p90 | p95 | max |
|---|---|---|---|---|---|
| Dashboard / Contacts / Invoices / Leases (combined) | 8ms | 5ms | 15ms | 19ms | 886ms |
| **Login** (`POST /auth/login`) | **680ms** | **661ms** | 793ms | 844ms | 1098ms |

**Finding:** the login endpoint is ~100× slower than every read endpoint, **even
with a single user and nobody else on the box.** This is `password_hash`/
`password_verify` at bcrypt cost 12 — deliberately slow by design (that's the
point of bcrypt), but cost 12 on a 1-vCPU box is expensive per hash. This is the
single biggest determinant of everything in the load/stress sections below.

---

## 2. Load testing — 10 / 50 / 100 concurrent users

**Read endpoints** (dashboard, contacts, invoices, leases — one shared logged-in
session, all VUs hitting them concurrently):

| VUs | avg | median | p90 | p95 | max | errors |
|---|---|---|---|---|---|---|
| 10 | 68ms | 46ms | 142ms | 173ms | 799ms | 0% |
| 50 | 308ms | 315ms | 465ms | 518ms | 1.35s | 0% |
| 100 | 661ms | 701ms | 932ms | 1.06s | 1.62s | 0% |

Zero failed requests at every tier — reads degrade gracefully, just slower
(throughput plateaus around 110–130 req/s regardless of VU count, meaning the box
saturates well before 100 concurrent users and everyone queues).

**Login endpoint** (each VU logs in independently — the realistic "everyone hits
sign-in at once" scenario, e.g. a Monday-morning login rush):

| VUs | avg | median | p90 | p95 | max | error rate |
|---|---|---|---|---|---|---|
| 10 | 4.86s | 4.86s | 5.61s | 6.02s | 10.06s | 0% |
| 50 | 19.9s | 21.65s | 29.73s | 29.90s | 30.28s | 0% (but nearly all requests sat right at the 30s ceiling) |
| 100 | 13.7s avg / 15s median (15s timeout enforced) | — | — | — | — | **80.3%** |

**Finding:** at only 10 concurrent login attempts, median wait is already ~5
seconds. At 50, it's ~22 seconds. This is a real business risk on a shared-hosting
box like this one — if 10+ people try to sign in around the same time, every one
of them sits on a spinner for several seconds to tens of seconds.

---

## 3. Stress testing — where it actually breaks

Pushed to 100 concurrent login attempts with a 15s per-request timeout:
**80.3% of requests timed out outright** (27/137 succeeded). The breaking point
sits **between 50 and 100 concurrent login attempts** on this hardware.

What actually fails: **CPU saturation from concurrent bcrypt hashing on a single
core**, not memory. `free -h` and `uptime` were checked throughout — available
memory never dropped below ~800MB and there was no swap thrashing or OOM signal;
`load average` on the 1-vCPU box peaked at **9.38** (i.e. ~9× oversubscribed) during
the worst tier. This is a clean, non-catastrophic CPU-bound failure mode — the
process didn't crash, it just couldn't keep up — which is a much better failure
mode than a hard crash, but still means real concurrent users would experience
this as "the site is down" once ~50+ people try to log in simultaneously.

**Recommendation:** this is very likely fine for Muga Properties' actual day-to-day
user count (a handful of staff), but if the tenant base or per-tenant headcount
grows, either (a) move off a 1-vCPU box, (b) lower bcrypt cost from 12 (trades
security margin for speed — not recommended as the first lever), or (c) add a
short-lived rate limiter / queue in front of login so it degrades as "please wait"
rather than a wall of 500/timeout responses.

---

## 4. Security vulnerability scan

No full OWASP ZAP install — its JVM alone typically wants 1–2GB of heap, which
risked destabilizing this 1.9GB production box. Instead: a targeted scan covering
the same categories, described below, run against the isolated stack (SQLi/XSS
payloads) plus safe read-only checks directly against production (file exposure,
headers, TLS, cookies — all single GETs, no mutation).

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Sensitive files (`database.sql`, `composer.json`, `DEPLOY.md`, and last session's own `tests/`) publicly downloadable | **Critical** | **Fixed** (see box above) |
| 2 | Stored XSS in the "Group by Estate" contacts view | **High** | Open — see below |
| 3 | Session cookie missing `Secure` flag | Medium | Open |
| 4 | No `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, or `Content-Security-Policy` headers | Medium | Open |
| 5 | SQL injection | — | **Not exploitable** — confirmed safe |
| 6 | Password hashing | — | Good practice (bcrypt, cost 12) |
| 7 | HTTPS enforcement | — | Good — HTTP redirects to HTTPS (301), valid cert (expires 12 Nov 2026) |

### #2 — Stored XSS, proven live with Playwright (High)

`assets/js/app.js` has **two different render paths for the same contact data**:

- The main Contacts table (`~line 302`) correctly wraps every field in the app's
  own `esc()` HTML-escaping helper.
- The **"Group by Estate" view** (click `Group by Estate` on the Contacts page →
  `toggleGroupByEstate()` → `renderEstateTable()`, `~line 3205-3229`) builds its
  rows with **raw template-literal interpolation and no escaping at all**:
  `` `<div ...>${c.name}</div>` ``, same for `c.phone` and `c.email`.

Proof (`tests/system/playwright/specs/xss.spec.js`, passing/red-confirms the bug):
created a contact via the same API any agent/admin uses, with name
`<img src=x onerror="window.__xss_proof='...'">`, then opened the Estate-grouped
view as a normal logged-in user in a real Chromium browser — **the payload
executed**, confirmed via the injected `window.__xss_proof` marker actually being
set.

**Impact:** any user who can create/edit a contact (which includes every agent)
can plant a payload that executes in the browser of anyone — including
super_admin/finance_admin — who opens the Estate-grouped contacts view.
Session cookies are `HttpOnly` (can't be read directly via `document.cookie`,
which limits the worst outcome), but the attacker still gets arbitrary
same-origin JS execution as the victim: they can drive `fetch()` calls with the
victim's live session, read/exfiltrate whatever the victim can see, or plant a
fake password-change/phishing overlay.

**Fix:** wrap `c.name`, `c.phone`, `c.email` (and check `c.unit`/`c.erf` on the
same lines) in `esc()` inside `renderEstateTable()`, matching what the main
contacts table already does correctly two views away.

### #3/#4 — Cookie & header hardening (Medium)

- `includes/auth.php`: `setcookie(..., ['secure' => false, ...])` — hardcoded
  `false` even though the app is only ever served over HTTPS in production
  (`APP_URL` is `https://...`). Should be `true`; the session cookie should never
  be eligible to travel over an unencrypted connection.
- Production response headers carry no `Strict-Transport-Security`,
  `X-Frame-Options`, `X-Content-Type-Options`, or `Content-Security-Policy`. None
  of these are exotic — they're a `.htaccess`/`Header set` addition, not an app
  change, and meaningfully reduce clickjacking/MIME-sniffing/downgrade risk.

### #5 — SQL injection (confirmed not exploitable)

Extensive payload testing (classic tautologies, `DROP TABLE`, `UNION SELECT`,
comment-truncation) against login, contact creation, and search — all handled
safely. The app uses `PDO` with `EMULATE_PREPARES => false` and parameterised
queries throughout the endpoints tested; payloads are stored/searched as inert
text, never executed as SQL. This matches the extensive SQLi coverage already in
`NegativeSecurityTest.php` from the prior functional round — reconfirmed here at
the system-test level with a fresh browser-driven pass.

---

## 5. Compatibility testing (Playwright: Chromium, Firefox, mobile viewport)

**Isolated stack — full login → dashboard → mobile nav flow:**

| Project | Login/dashboard render | Mobile nav |
|---|---|---|
| Chromium desktop | ✅ pass | n/a |
| Firefox desktop | ✅ pass | n/a |
| Mobile (Pixel 5 viewport, Chromium) | ✅ pass | ✅ pass (hamburger opens sidebar) |

No severe console errors (`Uncaught`/`TypeError`/`ReferenceError`) on any engine.

**Production — read-only render check (login screen only, no submission):**

| Project | Result |
|---|---|
| Chromium desktop | ✅ 200, renders, zero failed requests |
| Firefox desktop | ✅ 200, renders, zero failed requests |
| Mobile (Pixel 5) | ✅ 200, renders, login card fits viewport width |

Full Playwright HTML report: `tests/system/results/playwright-html/index.html`

---

## 6. Scalability testing — data growth

Bulk-seeded the isolated stack to **50,000 contacts / 20,000 invoices** (up from a
handful of fixture rows) and re-ran the same single-user baseline:

| Metric | Before (baseline) | After (50k/20k) | Change |
|---|---|---|---|
| Read endpoints — median latency | 5ms | 416ms | **~83× slower** |
| Read endpoints — p95 latency | 19ms | 910ms | **~48× slower** |
| `GET /crm/api/invoices` (single call) | — | **3.34s, 8.79MB response** | — |

**Two distinct causes, both worth fixing:**

1. **`GET /crm/api/invoices` has no pagination at all.** Unlike contacts (which
   caps at `limit=2000` and paginates properly), the invoices endpoint runs
   `SELECT ... FROM invoices WHERE tenant_id = ? ORDER BY created_at DESC` with no
   `LIMIT`, full stop. At 20,000 invoices that's an 8.8MB JSON payload on every
   single page load of the Invoices screen. This gets linearly worse forever —
   there's no ceiling.
2. **Contacts search can't use an index.** `WHERE tenant_id = ? AND status = ? AND
   (name LIKE '%term%' OR email LIKE '%term%' OR phone LIKE '%term%')` — the
   leading `%` wildcard on every OR'd column means MySQL can't use a B-tree index
   for the match itself; even the default (empty-search) page load pays this
   cost once the tenant has tens of thousands of contacts.

**Recommendation:** add proper `LIMIT`/`OFFSET` (or cursor) pagination to
`/crm/api/invoices` — this is the single highest-value fix here, since Muga's
invoice volume will only grow over time and this endpoint currently has no
ceiling. Search performance is a smaller near-term concern (fine at hundreds or
low thousands of contacts) but worth a `FULLTEXT` index or a search service if
the contact base scales into the tens of thousands.

---

## 7. Recovery testing — crash mid-transaction

Simulated an Apache/PHP crash by `SIGKILL`-ing the **entire isolated web server
process tree** mid-request, timed to land while a large (2,000 line-item) invoice
creation was actively inserting rows inside its transaction.

**Result: clean recovery, zero trace.** After the kill:
- No new row in `invoices` at all (not even a partial one).
- `0` orphaned rows in `invoice_lines`.
- `0` dangling transactions in `SHOW ENGINE INNODB STATUS` / `information_schema.innodb_trx`.
- Server restarted and immediately served correct 401/200 responses — no corrupt
  state, no manual recovery needed.

This is because `api/invoices/index.php` correctly wraps the multi-row insert in
`DB::begin()` / `DB::commit()` / `DB::rollback()`. When the PHP process died before
`commit()`, MySQL's InnoDB automatically rolled back the incomplete transaction on
connection loss — exactly the expected, correct behaviour. **This part of the app
is crash-safe.**

**Related gap, found by code review (not empirically triggered — the window is
sub-millisecond and not reliably reproducible by killing a process from the
outside):** lease creation, contact creation, and user creation each do a primary
`INSERT` followed by a *separate*, non-transactional `INSERT INTO activity_log`
(and lease/user endpoints also touch `sessions`/`notifications` in places). None
of these are wrapped in `DB::begin()`/`commit()`. A crash landing between the two
statements would leave a real lease/contact/user with **no corresponding audit-log
entry** — not data corruption, but a silent gap in the activity trail. Given how
much narrower this window is than the invoice case, this is a low-probability,
low-severity gap, but the fix is the same pattern already used correctly in
`invoices/index.php` — worth applying consistently.

---

## 8. Installation testing — fresh DB from `database.sql`

Provisioned a **throwaway database strictly from the repo's `database.sql`** (as
a real deployer/disaster-recovery scenario would), pointed a dedicated PHP server
at it, and walked the actual install flow over real HTTP. Dropped when finished —
never touched `crm_db` or `crm_db_test`.

**Step 1 — login page loads.** ✅ Fine, purely static/HTML.

**Step 2 — log in with the documented seed credentials** (`hulisa.admin` /
`Hulisa@2025`, per the comment in `database.sql`)**.** ❌ **Fails immediately** —
`401 Invalid username or password`. The seeded `password_hash` value is the
literal string `$2y$12$placeholder_change_on_deploy`, which isn't a real bcrypt
hash of anything. **Nobody can log in with the documented credentials on a fresh
install, full stop** — a deployer has to already know to manually generate and
`UPDATE` a real hash before the app is usable at all. There's no self-service
password reset flow to fall back on either.

**Step 3 — fix the hash, retry login.** ❌ **Still fails — now with a blank HTTP
500**, no error message at all (production has `display_errors` off). This is the
`login_attempts`-table-missing bug identified in last session's `SUMMARY.md`,
now reproduced end-to-end over real HTTP instead of a direct DB probe: the first
*successful* password check is followed by an unconditional, uncaught
`INSERT INTO login_attempts (...)`, and that table doesn't exist in
`database.sql` (`SHOW TABLES` after a fresh load: 16 tables, missing
`login_attempts`, `invoice_schedules`, `invoice_customers` — all three exist in
live `crm_db` but were apparently added directly to production without ever being
back-ported to the schema file).

**Step 4 — patch in the 3 missing tables (from production's actual structure),
retry.** ✅ **Full success** — login returns `200` with a valid session, the
dashboard loads with correct empty-state data, and the platform-admin route
(`/crm/api/admin/tenants`) works. This isolates the problem precisely: **once
those two gaps are closed, the rest of the schema and application logic is
sound** — this isn't a deep problem, just an out-of-date schema file plus
placeholder seed data that was never meant to be shipped as-is.

**Recommendation:**
1. Re-export `database.sql` from production's actual live structure (`mysqldump
   --no-data`) so a fresh install matches reality.
2. Either ship real, working seed credentials with a forced first-login password
   change, or drop the placeholder users entirely and document the manual
   `password_hash()` step explicitly in `DEPLOY.md` (which currently doesn't
   mention it).

---

## Tooling installed this session

- **k6 v2.2.0** — `/usr/local/bin/k6` (binary install, no package manager needed)
- **Playwright** (`@playwright/test`) + Chromium + Firefox — under
  `tests/system/playwright/` (own `package.json`, isolated from the app)
- OWASP ZAP — **not installed**, see Security section for why and what was done
  instead

## Where everything lives

```
tests/system/
├── router.php              # static-asset router for the isolated php -S stack
├── scripts/
│   ├── reseed.php           # resets crm_db_test to the clean fixture baseline
│   └── bulk-seed.php        # bulk-inserts N contacts/invoices for scalability testing
├── k6/
│   ├── login-load.js        # bcrypt-heavy auth load/stress scenario
│   └── api-read-load.js     # dashboard/contacts/invoices/leases read scenario
├── playwright/
│   ├── playwright.config.js # chromium-desktop / firefox-desktop / mobile-chrome
│   └── specs/
│       ├── compat-login.spec.js       # isolated-stack compatibility
│       ├── prod-readonly-compat.spec.js # production read-only compatibility
│       └── xss.spec.js                # live proof of the Estate-view XSS
└── results/                 # raw k6 JSON summaries + Playwright HTML/JSON report
```

**Re-running:**
```bash
# isolated stack (start before running k6/Playwright specs)
CRM_DB_HOST=localhost CRM_DB_NAME=crm_db_test CRM_DB_USER=crm_test_user \
  CRM_DB_PASS='CrmTest_2026!' PHP_CLI_SERVER_WORKERS=8 \
  php -S 127.0.0.1:8299 -t /var/www/html /var/www/html/crm/tests/system/router.php &

php tests/system/scripts/reseed.php   # reset fixture data first
k6 run tests/system/k6/api-read-load.js
cd tests/system/playwright && npx playwright test
```

`crm_db_test` has been reseeded back to its clean baseline (the 50k/20k bulk
scalability data was test-only and has been reset, not left lying around).
