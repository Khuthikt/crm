<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/db.php';

$updated = DB::execute(
    "UPDATE leases SET status = 'expired'
      WHERE status = 'active' AND end_date < CURDATE()"
);
echo date('Y-m-d H:i:s') . " — $updated leases marked expired\n";
