<?php
error_reporting(0);
ini_set('display_errors', 0);
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = $user['tenant_id'] ? (int)$user['tenant_id'] : 0;
if (!$tenantId) Response::error('No tenant assigned to this account');

$method = $_SERVER['REQUEST_METHOD'];

// ── PREVIEW: POST with preview=1 ────────────────────────────
if ($method === 'POST' && ($_GET['action'] ?? '') === 'preview') {
    if (empty($_FILES['file'])) Response::error('No file uploaded');

    $file     = $_FILES['file'];
    $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $tmpPath  = $file['tmp_name'];

    $rows = [];

    if ($ext === 'csv') {
        $rows = parseCSV($tmpPath);
    } elseif (in_array($ext, ['xlsx', 'xls'])) {
        $rows = parseExcel($tmpPath);
    } else {
        Response::error('Only CSV or Excel files are supported');
    }

    if (!count($rows)) Response::error('No data found in file');

    // Return first 5 rows as preview
    $preview = array_slice($rows, 0, 5);
    $headers = array_keys($preview[0] ?? []);

    Response::success([
        'headers'    => $headers,
        'preview'    => $preview,
        'total_rows' => count($rows),
    ]);
}

// ── IMPORT: POST with action=import ─────────────────────────
if ($method === 'POST' && ($_GET['action'] ?? '') === 'import') {
    if (empty($_FILES['file'])) Response::error('No file uploaded');

    $file    = $_FILES['file'];
    $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $tmpPath = $file['tmp_name'];

    // Column mapping from POST
    $mapName    = $_POST['map_name']    ?? '';
    $mapPhone   = $_POST['map_phone']   ?? '';
    $mapEmail   = $_POST['map_email']   ?? '';
    $mapId      = $_POST['map_id']      ?? '';
    $mapType    = $_POST['map_type']    ?? '';
    $defaultType = $_POST['default_type'] ?? 'Lead';
    $estateName  = trim($_POST['estate_name'] ?? '');
    $mapErf      = $_POST['map_erf']   ?? '';
    $mapUnit     = $_POST['map_unit']  ?? '';
    $mapSize     = $_POST['map_size']  ?? '';
    $limitRows  = isset($_POST['limit']) ? (int)$_POST['limit'] : 0;

    if (!$mapName) Response::error('Name column mapping is required');

    $rows = [];
    if ($ext === 'csv') {
        $rows = parseCSV($tmpPath);
    } elseif (in_array($ext, ['xlsx', 'xls'])) {
        $rows = parseExcel($tmpPath);
    } else {
        Response::error('Only CSV or Excel files are supported');
    }

    if ($limitRows > 0) {
        $rows = array_slice($rows, 0, $limitRows);
    }

    $imported = 0;
    $skipped  = 0;
    $errors   = [];
    $userId   = $user['user_id'] ?? $user['id'] ?? null;

    DB::begin();
    try {
        foreach ($rows as $i => $row) {
            $name = trim($row[$mapName] ?? '');
            if (!$name || $name === 'NaN') { $skipped++; continue; }

            $phone   = cleanPhone($row[$mapPhone] ?? '');
            $email   = trim($row[$mapEmail] ?? '');
            $idNum   = trim($row[$mapId] ?? '');
            $type    = $mapType ? ($row[$mapType] ?? $defaultType) : $defaultType;
            $email   = ($email === 'NaN' || !filter_var($email, FILTER_VALIDATE_EMAIL)) ? null : $email;
            $idNum   = ($idNum === 'NaN' || strlen($idNum) < 5) ? null : $idNum;
            $phone   = ($phone === 'NaN' || strlen($phone) < 5) ? null : $phone;
            $erf     = $mapErf  ? trim($row[$mapErf]  ?? '') : null;
            $unit    = $mapUnit ? trim($row[$mapUnit]  ?? '') : null;
            $size    = $mapSize ? trim($row[$mapSize]  ?? '') : null;
            $erf     = ($erf  === 'NaN' || $erf  === '') ? null : $erf;
            $unit    = ($unit === 'NaN' || $unit === '0') ? null : $unit;
            $size    = ($size === 'NaN' || $size === '') ? null : $size;

            try {
                DB::execute(
                    'INSERT INTO contacts
                     (tenant_id, name, phone, email, id_number, type,
                      source, status, fica_status, created_by,
                      complex, unit, erf, size)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    [
                        $tenantId, $name, $phone, $email, $idNum,
                        $type, 'Import', 'active', 'pending', $userId,
                        $estateName ?: null, $unit, $erf, $size,
                    ]
                );
                $imported++;
            } catch (Exception $e) {
                $skipped++;
                if (count($errors) < 5) $errors[] = "Row " . ($i+2) . ": " . $e->getMessage();
            }
        }
        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        Response::error('Import failed: ' . $e->getMessage(), 500);
    }

    Response::success([
        'imported' => $imported,
        'skipped'  => $skipped,
        'errors'   => $errors,
    ], "$imported contacts imported successfully");
}

Response::error('Invalid action', 400);

// ── Helpers ──────────────────────────────────────────────────
function parseCSV(string $path): array {
    $rows    = [];
    $headers = [];
    if (($handle = fopen($path, 'r')) !== false) {
        $headers = fgetcsv($handle);
        while (($data = fgetcsv($handle)) !== false) {
            if (count($data) === count($headers)) {
                $rows[] = array_combine($headers, $data);
            }
        }
        fclose($handle);
    }
    return $rows;
}

function parseExcel(string $path): array {
    // Use Python to parse Excel since we don't have PhpSpreadsheet
    $escaped = escapeshellarg($path);
    $json = shell_exec("python3 -c \"
import pandas as pd, json, sys
try:
    df = pd.read_excel($escaped, dtype=str)
    df = df.where(pd.notnull(df), None)
    print(json.dumps(df.to_dict('records')))
except Exception as e:
    print(json.dumps({'error': str(e)}))
\"");

    $data = json_decode($json, true);
    if (isset($data['error'])) return [];
    return is_array($data) ? $data : [];
}

function cleanPhone(string $phone): string {
    // Remove decimals from numeric phone (e.g. 821234567.0 -> 0821234567)
    $phone = trim($phone);
    if (is_numeric($phone)) {
        $phone = rtrim(rtrim(number_format((float)$phone, 0, '.', ''), '0'), '.');
        // Add leading 0 if 9 digits
        if (strlen($phone) === 9) $phone = '0' . $phone;
    }
    return $phone;
}
