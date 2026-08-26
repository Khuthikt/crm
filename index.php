<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/auth.php';

// ── Route API requests ──────────────────────────────────────
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (str_starts_with($uri, '/crm/api/')) {
    header('Content-Type: application/json');
    $route = ltrim(str_replace('/crm/api/', '', $uri), '/');

    $apiRoutes = [
        'auth/login'    => '/api/auth/login.php',
        'auth/logout'   => '/api/auth/logout.php',
        'contacts'      => '/api/contacts/index.php',
        'deals'         => '/api/deals/index.php',
        'leases'        => '/api/leases/index.php',
        'invoices'      => '/api/invoices/index.php',
        'users'         => '/api/users/index.php',
        'dashboard'     => '/api/dashboard/index.php',
        'files/upload'  => '/api/files/upload.php',
        'admin/tenants' => '/admin/tenants.php',
        'listings'      => '/api/listings/index.php',
        'listings/index.php' => '/api/listings/index.php',
        'settings'           => '/api/settings/index.php',
        'settings/index.php' => '/api/settings/index.php',
        'invoices/pdf'       => '/api/invoices/pdf.php',
        'invoices/pdf.php'   => '/api/invoices/pdf.php',
        'invoices/email'     => '/api/invoices/email.php',
        'invoices/email.php' => '/api/invoices/email.php',
        'repairs'            => '/api/repairs/index.php',
        'repairs/index.php'  => '/api/repairs/index.php',
        'photos'             => '/api/photos/index.php',
        'platform'           => '/api/platform.php',
        'photos/index.php'   => '/api/photos/index.php',
        'statements'         => '/api/statements/index.php',
        'statements/index.php'=> '/api/statements/index.php',
        'schedules'          => '/api/schedules/index.php',
        'schedules/index.php'=> '/api/schedules/index.php',
        'customers'          => '/api/customers/index.php',
        'customers/index.php'=> '/api/customers/index.php',
        'notifications'            => '/api/notifications/index.php',
        'notifications/index.php'  => '/api/notifications/index.php',
        'products'           => '/api/products/index.php',
        'products/index.php' => '/api/products/index.php',
        'contacts/import' => '/api/contacts/import.php',
        'contacts/index.php' => '/api/contacts/index.php',
        'deals/index.php'    => '/api/deals/index.php',
        'leases/index.php'   => '/api/leases/index.php',
        'invoices/index.php' => '/api/invoices/index.php',
        'users/index.php'    => '/api/users/index.php',
        'dashboard/index.php'=> '/api/dashboard/index.php',
        'admin/tenants.php'  => '/admin/tenants.php',
        'contacts/import.php'=> '/api/contacts/import.php',
    ];

    $matched = rtrim($route, '/');
    header('X-Matched-Route: ' . $matched);
    if (isset($apiRoutes[$matched])) {
        if ($matched === 'admin/tenants.php' || $matched === 'admin/tenants') { error_log('ROUTING TO: ' . $apiRoutes[$matched] . ' METHOD: ' . $_SERVER['REQUEST_METHOD']); }
        require __DIR__ . $apiRoutes[$matched];
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'API endpoint not found']);
    }
    exit;
}

// ── Serve the frontend SPA ──────────────────────────────────
$user = Auth::user();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="icon" type="image/x-icon" href="/crm/favicon.ico">
  <link rel="icon" type="image/png" href="/crm/favicon.png">
  <title><?= APP_NAME ?></title>
<link rel="stylesheet" href="/crm/assets/css/main.css">
<link rel="stylesheet" href="/crm/assets/css/mobile.css">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>

<?php if (!$user): ?>
<!-- LOGIN -->
<div id="login-screen" class="login-screen">
  <div class="login-card">
    <div class="login-logo">
      <div class="login-logo-text" id="login-tenant-name">Property CRM</div>
      <div class="login-logo-sub">Sign in to your account</div>
    </div>
    <div class="form-group">
      <label class="form-label">Username or Email</label>
      <input class="form-input" id="login-username" type="text" placeholder="username or email"
             autocomplete="username" autofocus
             onkeydown="if(event.key==='Enter')document.getElementById('login-password').focus()">
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <div class="pw-wrap">
        <input class="form-input" id="login-password" type="password" placeholder="••••••••"
               autocomplete="current-password"
               onkeydown="if(event.key==='Enter')doLogin()">
        <span class="pw-toggle" onclick="togglePw()">
          <svg id="pw-eye" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </span>
      </div>
    </div>
    <div id="login-error" class="login-error"></div>
    <button class="btn btn-primary btn-full" onclick="doLogin()" id="login-btn">Sign In</button>
  </div>
</div>

<?php else: ?>
<!-- APP SHELL -->
<div id="app" class="app">

  <!-- Mobile hamburger -->
  <button class="hamburger" id="hamburger" onclick="toggleNav()">
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
      <path d="M3 12h18M3 6h18M3 18h18"/>
    </svg>
  </button>

  <!-- Overlay for mobile nav -->
  <div class="nav-overlay" id="nav-overlay" onclick="closeNav()"></div>

  <!-- Sidebar -->
  <nav id="sidebar">
    <div class="nav-logo">
      <div id="nav-logo-wrap">
        <img id="nav-logo-img" src="" alt="" style="display:none;max-height:40px;max-width:150px">
        <div id="nav-logo-text"><?= htmlspecialchars($user['tenant_name'] ?? APP_NAME) ?></div>
        <div class="nav-logo-sub">CRM</div>
      </div>
    </div>

    <div class="nav-links" id="nav-links">
      <?php
        $r = $user['role'] ?? 'agent';
        $isSuperAdmin = in_array($r, ['platform_superadmin','super_admin']);
        $isAdmin      = in_array($r, ['platform_superadmin','super_admin','admin']);
        $canInvoice   = in_array($r, ['platform_superadmin','super_admin','finance_admin']);
        $isAgent      = ($r === 'agent');
      ?>
      <?php if (!$isAgent): ?>
      <a href="#" class="nav-item active" data-view="dashboard"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Dashboard</a>
      <?php endif; ?>
      <a href="#" class="nav-item <?php echo $isAgent ? 'active' : ''; ?>" data-view="mywork"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>My Work</a>
      <?php if (!$isAgent): ?>
      <a href="#" class="nav-item" data-view="contacts"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Contacts</a>
      <a href="#" class="nav-item" data-view="search"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>Complex Search</a>
      <a href="#" class="nav-item" data-view="leaderboard"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/></svg>Leaderboard</a>
      <?php endif; ?>
      <a href="#" class="nav-item" data-view="deals"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Deals</a>
      <a href="#" class="nav-item" data-view="listings"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Listings</a>
      <a href="#" class="nav-item" data-view="leases"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Leases</a>
      <?php if ($canInvoice): ?>
      <a href="#" class="nav-item" data-view="invoices"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Invoices</a>
      <?php endif; ?>
      <?php if ($isAdmin): ?>
      <a href="#" class="nav-item" data-view="team"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>Team</a>
      <?php endif; ?>
      <?php if ($r === 'platform_superadmin'): ?>
      <a href="#" class="nav-item" data-view="platform-tenants"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>Tenants</a>
      <?php endif; ?>
      <?php if ($isSuperAdmin): ?>
      <a href="#" class="nav-item" data-view="settings"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>Settings</a>
      <?php endif; ?>
    <div class="nav-bottom">
      <div style="padding:8px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">Notifications</span>
        <div id="notif-bell" onclick="toggleNotifPanel()" title="Notifications" style="position:relative;cursor:pointer;padding:6px;color:var(--text-3);border-radius:6px;display:flex;align-items:center;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="width:18px;height:18px"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
          <div id="notif-badge" style="display:none;position:absolute;top:2px;right:2px;min-width:16px;height:16px;background:var(--red);color:#fff;border-radius:8px;font-size:10px;font-weight:700;align-items:center;justify-content:center;padding:0 3px">0</div>
        </div>
      </div>
      <div class="nav-user">
        <div class="nav-avatar"><?= strtoupper(substr($user['name'], 0, 2)) ?></div>
        <div class="nav-user-info">
          <div class="nav-user-name"><?= htmlspecialchars($user['name']) ?></div>
          <div class="nav-user-role"><?= htmlspecialchars(str_replace('_', ' ', $user['role'])) ?></div>
        </div>
        <button class="btn-ghost btn-sm" onclick="openChangePasswordModal()" title="Change password" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--text-3)"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="width:16px;height:16px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></button>
        <button class="btn-logout" onclick="doLogout()" title="Sign out">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </div>
    </div>
  </nav>

  <!-- Main content -->
  <?php
    $currentTok = $_COOKIE[SESSION_COOKIE] ?? '';
    $impSess = $currentTok ? DB::queryOne('SELECT impersonating_from FROM sessions WHERE token = ?', [$currentTok]) : null;
    if ($impSess && !empty($impSess['impersonating_from'])): ?>
  <div style="background:#1DB8A0;color:#fff;padding:6px 16px;display:flex;align-items:center;justify-content:space-between;font-size:12px;position:fixed;top:0;left:0;right:0;z-index:9999;height:32px">
    <span>&#128065; Viewing as <strong><?= htmlspecialchars($user['tenant_name'] ?? 'Tenant') ?></strong></span>
    <button onclick="exitImpersonation()" style="background:rgba(0,0,0,.2);border:none;color:#fff;padding:3px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">&#10005; Exit</button>
  </div>
  <div style="height:32px"></div>
  <?php endif; ?>
  <main id="main-content">
    <div id="page-content" class="page-content">
      <!-- Pages load here via JS -->
      <div class="loading-spinner" id="page-loader">
        <div class="spinner"></div>
      </div>
    </div>
  </main>

</div><!-- /app -->
<?php endif; ?>

<script>
  // Pass PHP auth state to JS
  const APP_USER  = <?= $user ? json_encode([
      'id'          => $user['user_id'],
      'name'        => $user['name'],
      'role'        => $user['role'],
      'tenant_id'   => $user['tenant_id'],
      'tenant_name' => $user['tenant_name'] ?? null,
  ]) : 'null' ?>;
  // Role helpers
  const CAN_INVOICE  = APP_USER && ['platform_superadmin','super_admin','finance_admin'].includes(APP_USER.role);
  const CAN_VERIFY   = APP_USER && ['platform_superadmin','super_admin','finance_admin'].includes(APP_USER.role);
  const CAN_DELETE   = APP_USER && ['platform_superadmin','super_admin','admin'].includes(APP_USER.role);
  const CAN_SETTINGS = APP_USER && ['platform_superadmin','super_admin'].includes(APP_USER.role);
  const IS_AGENT     = APP_USER && APP_USER.role === 'agent';
  const IS_ADMIN     = APP_USER && ['platform_superadmin','super_admin','admin'].includes(APP_USER.role);
  const APP_URL   = '<?= APP_URL ?>';
</script>
<script src="/crm/assets/js/app.js"></script>
</body>
</html>
