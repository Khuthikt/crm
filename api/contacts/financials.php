<?php
error_reporting(0);
require_once __DIR__ . "/../../includes/auth.php";
require_once __DIR__ . "/../../includes/db.php";
require_once __DIR__ . "/../../includes/response.php";

$user = Auth::user();
if (!$user) Response::unauthorized();

$tenantId  = (int)$user["tenant_id"];
$contactId = (int)($_GET["contact_id"] ?? 0);
if (!$contactId) Response::error("contact_id required");

// Get invoices linked directly to contact OR via lease
$invoices = DB::query(
    "SELECT i.id, i.ref, i.status, i.total, i.due_date, i.paid_date,
            i.emailed_at, i.emailed_to, i.downloaded_at, i.created_at,
            l.property, l.unit
     FROM invoices i
     LEFT JOIN leases l ON l.id = i.lease_id
     WHERE i.tenant_id = ?
       AND (i.contact_id = ? OR l.contact_id = ?)
     ORDER BY i.created_at DESC",
    [$tenantId, $contactId, $contactId]
);

$total    = array_sum(array_column($invoices, "total"));
$paid     = array_sum(array_map(fn($i) => $i["status"]==="paid" ? $i["total"] : 0, $invoices));
$outstanding = $total - $paid;

Response::success([
    "invoices"    => $invoices,
    "summary"     => [
        "total_invoiced"  => $total,
        "total_paid"      => $paid,
        "outstanding"     => $outstanding,
        "invoice_count"   => count($invoices),
    ]
]);
