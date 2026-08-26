<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';
require_once __DIR__ . '/../../includes/config.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

// Handle DELETE
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $docId = (int)($_GET['doc_id'] ?? 0);
    if (!$docId) Response::error('doc_id required');
    $doc = DB::queryOne('SELECT * FROM contact_documents WHERE id = ? AND tenant_id = ?', [$docId, (int)$user['tenant_id']]);
    if (!$doc) Response::notFound('Document not found');
    DB::execute('DELETE FROM contact_documents WHERE id = ?', [$docId]);
    Response::success(null, 'Document deleted');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') Response::error('POST required', 405);

$tenantId = (int)$user['tenant_id'];
$type     = $_POST['type']      ?? '';   // 'contact_doc', 'listing_photo', 'lease_doc'
$entityId = isset($_POST['entity_id']) ? (int)$_POST['entity_id'] : null;
$docType  = $_POST['doc_type']  ?? 'Document';

if (!$type || !$entityId) Response::error('type and entity_id are required');
if (empty($_FILES['file'])) Response::error('No file uploaded');

$file     = $_FILES['file'];
$mimeType = mime_content_type($file['tmp_name']);
$isImage  = in_array($mimeType, ALLOWED_IMG_TYPES);
$isDoc    = in_array($mimeType, ALLOWED_DOC_TYPES);

if (!$isImage && !$isDoc) {
    Response::error('File type not allowed. Use PDF, Word, JPG, or PNG.');
}
if ($file['size'] > MAX_FILE_SIZE) {
    Response::error('File exceeds 10MB limit.');
}

// ── Build folder path: uploads/tenant_id/type/entity_id/ ───
$ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$safeExt = preg_replace('/[^a-z0-9]/', '', $ext);
$subDir  = UPLOAD_PATH . $tenantId . '/' . $type . '/' . $entityId . '/';

if (!is_dir($subDir)) {
    mkdir($subDir, 0755, true);
}

// Unique filename — never expose original name directly
$filename = bin2hex(random_bytes(12)) . '.' . $safeExt;
$fullPath = $subDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
    Response::error('File could not be saved. Check folder permissions.', 500);
}

// Public URL to access the file
$fileUrl = UPLOAD_URL . $tenantId . '/' . $type . '/' . $entityId . '/' . $filename;

// ── Save to database based on upload type ───────────────────
switch ($type) {

    case 'contact_doc':
        $contact = DB::queryOne(
            'SELECT id FROM contacts WHERE id = ? AND tenant_id = ?',
            [$entityId, $tenantId]
        );
        if (!$contact) {
            unlink($fullPath);
            Response::forbidden('Contact not found');
        }

        $docId = DB::insert(
            'INSERT INTO contact_documents
             (tenant_id, contact_id, doc_type, file_name, file_url, file_size, mime_type, uploaded_by)
             VALUES (?,?,?,?,?,?,?,?)',
            [$tenantId, $entityId, $docType, $file['name'], $fileUrl,
             $file['size'], $mimeType, $user['id']]
        );

        // Update FICA status
        $ficaTypes = ['ID Copy', 'Proof of Address', 'Bank Statement'];
        if (in_array($docType, $ficaTypes)) {
            $docCount = DB::queryOne(
                "SELECT COUNT(DISTINCT doc_type) AS c FROM contact_documents
                  WHERE contact_id = ? AND doc_type IN ('ID Copy','Proof of Address','Bank Statement')",
                [$entityId]
            )['c'];
            $ficaStatus = $docCount >= 3 ? 'complete' : 'partial';
            DB::execute(
                'UPDATE contacts SET fica_status = ? WHERE id = ?',
                [$ficaStatus, $entityId]
            );
        }

        DB::execute(
            'INSERT INTO activity_log
             (tenant_id, user_id, entity_type, entity_id, action, description)
             VALUES (?,?,?,?,?,?)',
            [$tenantId, $user['id'], 'contact', $entityId,
             'document_uploaded', "$docType uploaded: {$file['name']}"]
        );

        Response::success(
            ['id' => $docId, 'url' => $fileUrl, 'file_name' => $file['name']],
            'Document uploaded'
        );
        break;

    case 'listing_photo':
        $listing = DB::queryOne(
            'SELECT id FROM listings WHERE id = ? AND tenant_id = ?',
            [$entityId, $tenantId]
        );
        if (!$listing) {
            unlink($fullPath);
            Response::forbidden('Listing not found');
        }

        $existing = DB::queryOne(
            'SELECT COUNT(*) AS c FROM listing_photos WHERE listing_id = ?',
            [$entityId]
        )['c'];

        $photoId = DB::insert(
            'INSERT INTO listing_photos
             (tenant_id, listing_id, file_url, is_primary, uploaded_by)
             VALUES (?,?,?,?,?)',
            [$tenantId, $entityId, $fileUrl, ($existing === 0) ? 1 : 0, $user['id']]
        );

        Response::success(['id' => $photoId, 'url' => $fileUrl], 'Photo uploaded');
        break;

    case 'lease_doc':
        $lease = DB::queryOne(
            'SELECT id FROM leases WHERE id = ? AND tenant_id = ?',
            [$entityId, $tenantId]
        );
        if (!$lease) {
            unlink($fullPath);
            Response::forbidden('Lease not found');
        }

        DB::execute(
            'UPDATE leases SET lease_doc_url = ?, lease_doc_name = ?
              WHERE id = ? AND tenant_id = ?',
            [$fileUrl, $file['name'], $entityId, $tenantId]
        );
        // Also save to contact_documents for display
        DB::insert(
            'INSERT INTO contact_documents
             (tenant_id, contact_id, doc_type, file_name, file_url, file_size, mime_type, uploaded_by, entity_type, entity_id)
             VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$tenantId, null, $docType ?: 'Lease Agreement', $file['name'], $fileUrl,
             $file['size'], $mimeType, $user['user_id'] ?? $user['id'], 'lease', $entityId]
        );

        DB::execute(
            'INSERT INTO activity_log
             (tenant_id, user_id, entity_type, entity_id, action, description)
             VALUES (?,?,?,?,?,?)',
            [$tenantId, $user['id'], 'lease', $entityId,
             'document_uploaded', "Lease document uploaded: {$file['name']}"]
        );

        Response::success(
            ['url' => $fileUrl, 'file_name' => $file['name']],
            'Lease document uploaded'
        );
        break;

    case 'listing_photo':
        // Save listing photo
        $photoId = DB::insert(
            'INSERT INTO listing_photos (tenant_id, listing_id, file_name, file_url, file_size, sort_order, is_primary)
             VALUES (?,?,?,?,?,?,?)',
            [$tenantId, $entityId, $file['name'], $fileUrl, $file['size'], 0, 0]
        );
        // Set as primary if first photo
        $photoCount = DB::queryOne('SELECT COUNT(*) as cnt FROM listing_photos WHERE listing_id = ? AND tenant_id = ?', [$entityId, $tenantId]);
        if (($photoCount['cnt'] ?? 0) === 1) {
            DB::execute('UPDATE listing_photos SET is_primary = 1 WHERE id = ?', [$photoId]);
            DB::execute('UPDATE listings SET primary_photo = ? WHERE id = ?', [$fileUrl, $entityId]);
        }
        Response::success(['url' => $fileUrl, 'id' => $photoId], 'Photo uploaded');
        break;

    case 'logo':
        // Save logo URL to tenant settings
        DB::execute(
            "INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
             VALUES (?, 'logo_url', ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
            [$tenantId, $fileUrl]
        );
        Response::success(['url' => $fileUrl], 'Logo uploaded');
        break;

    case 'lease_doc':
    case 'contact_doc_upload':
    case 'id_document':
    case 'mandate':
    case 'other_doc':
        // Universal document upload
        $entityType = $type === 'lease_doc' ? 'lease' : 'contact';
        DB::insert(
            'INSERT INTO contact_documents
             (tenant_id, contact_id, doc_type, file_name, file_url, file_size, mime_type, uploaded_by, entity_type, entity_id)
             VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$tenantId, $entityType === 'contact' ? $entityId : null,
             $docType ?: 'Document', $file['name'], $fileUrl,
             $file['size'], $mimeType, $user['id'], $entityType, $entityId]
        );
        Response::success(['url' => $fileUrl, 'doc_type' => $docType], 'Document uploaded');
        break;

    default:
        Response::error('Unknown upload type');
}
