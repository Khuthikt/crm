<?php
// Resets crm_db_test to the deterministic baseline fixture set.
// Usage: CRM_DB_NAME=crm_db_test php reseed.php
require __DIR__ . '/../../bootstrap/seed.php';
$fixtures = seed_run();
echo json_encode($fixtures, JSON_PRETTY_PRINT) . "\n";
