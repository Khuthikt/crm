<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = (int)$user['tenant_id'];
$isAgent  = $user['role'] === 'agent';
$agentFilter = $isAgent ? ' AND assigned_to = ' . (int)$user['id'] : '';

// ── KPI cards ───────────────────────────────────────────────
$totalContacts = DB::queryOne(
    "SELECT COUNT(*) AS c FROM contacts WHERE tenant_id = ? AND status = 'active' $agentFilter",
    [$tenantId]
)['c'];

$activeListings = DB::queryOne(
    "SELECT COUNT(*) AS c FROM listings WHERE tenant_id = ? AND status = 'Active'",
    [$tenantId]
)['c'];

$activeLeases = DB::queryOne(
    "SELECT COUNT(*) AS c, COALESCE(SUM(monthly_rent),0) AS total_rent
       FROM leases WHERE tenant_id = ? AND status = 'active'",
    [$tenantId]
);

$overdueInvoices = DB::queryOne(
    "SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS total_owed
       FROM invoices WHERE tenant_id = ? AND status IN ('unpaid','overdue') AND due_date < CURDATE()",
    [$tenantId]
);

$pipelineValue = DB::queryOne(
    "SELECT COALESCE(SUM(value),0) AS total FROM deals
      WHERE tenant_id = ? AND stage NOT IN ('closed','lost') $agentFilter",
    [$tenantId]
);

$closedThisMonth = DB::queryOne(
    "SELECT COUNT(*) AS c, COALESCE(SUM(value),0) AS total
       FROM deals
      WHERE tenant_id = ? AND stage = 'closed'
        AND MONTH(actual_close) = MONTH(CURDATE())
        AND YEAR(actual_close)  = YEAR(CURDATE()) $agentFilter",
    [$tenantId]
);

// ── Pipeline breakdown ──────────────────────────────────────
$pipeline = DB::query(
    "SELECT stage, COUNT(*) AS count, COALESCE(SUM(value),0) AS total_value
       FROM deals
      WHERE tenant_id = ? AND stage NOT IN ('closed','lost') $agentFilter
      GROUP BY stage",
    [$tenantId]
);

// ── Agent leaderboard ───────────────────────────────────────
$leaderboard = DB::query(
    "SELECT u.name, COUNT(*) AS deals_closed, COALESCE(SUM(d.value),0) AS total_value
       FROM deals d
       JOIN users u ON u.id = d.assigned_to
      WHERE d.tenant_id = ? AND d.stage = 'closed'
        AND YEAR(d.actual_close) = YEAR(CURDATE())
      GROUP BY d.assigned_to, u.name
      ORDER BY total_value DESC
      LIMIT 10",
    [$tenantId]
);

// ── Recent activity ─────────────────────────────────────────
$activity = DB::query(
    "SELECT a.*, u.name AS user_name
       FROM activity_log a
  LEFT JOIN users u ON u.id = a.user_id
      WHERE a.tenant_id = ?
      ORDER BY a.created_at DESC
      LIMIT 15",
    [$tenantId]
);

// ── Upcoming lease renewals (next 60 days) ──────────────────
$renewals = DB::query(
    "SELECT id, ref, tenant_name, property, end_date, monthly_rent
       FROM leases
      WHERE tenant_id = ? AND status = 'active'
        AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
      ORDER BY end_date ASC",
    [$tenantId]
);

// ── Overdue invoices list ───────────────────────────────────
$overdueList = DB::query(
    "SELECT id, ref, tenant_name, total, due_date, status
       FROM invoices
      WHERE tenant_id = ? AND status IN ('unpaid','overdue') AND due_date < CURDATE()
      ORDER BY due_date ASC
      LIMIT 10",
    [$tenantId]
);

Response::success([
    'kpi' => [
        'total_contacts'       => (int)$totalContacts,
        'active_listings'      => (int)$activeListings,
        'active_leases'        => (int)$activeLeases['c'],
        'monthly_rent_roll'    => (float)$activeLeases['total_rent'],
        'overdue_invoices'     => (int)$overdueInvoices['c'],
        'total_owed'           => (float)$overdueInvoices['total_owed'],
        'pipeline_value'       => (float)$pipelineValue['total'],
        'closed_this_month'    => (int)$closedThisMonth['c'],
        'closed_value_month'   => (float)$closedThisMonth['total'],
    ],
    'pipeline'    => $pipeline,
    'leaderboard' => $leaderboard,
    'activity'    => $activity,
    'renewals'    => $renewals,
    'overdue_invoices' => $overdueList,
]);
