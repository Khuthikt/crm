<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

$user = Auth::user();
if (!$user) Response::unauthorized();

$tenantId = (int)$user['tenant_id'];
$method   = $_SERVER['REQUEST_METHOD'];
$id       = isset($_GET['id']) ? (int)$_GET['id'] : null;

// ── Scope agents to their own assigned contacts ─────────────
function agentWhere(array $user): string {
    if ($user['role'] === 'agent') {
        return ' AND c.assigned_to = ' . (int)$user['user_id'] ?? $user['id'];
    }
    return '';
}

switch ($method) {
    // ── BULK DELETE via POST ─────────────────────────────────
    case 'POST':
        if (isset($_GET['bulk_delete'])) {
            Auth::requireRole($user, ['platform_superadmin', 'super_admin', 'admin']);
            $body = json_decode(file_get_contents('php://input'), true);
            $ids  = array_filter(array_map('intval', $body['ids'] ?? []));
            if (!count($ids)) Response::error('No IDs provided');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $params  = array_merge($ids, [$tenantId]);
            $deleted = DB::execute(
                "DELETE FROM contacts WHERE id IN ($placeholders) AND tenant_id = ?",
                $params
            );
            Response::success(['deleted' => $deleted], "$deleted contacts deleted");
        }
        if (isset($_GET['bulk_assign'])) {
            $body      = json_decode(file_get_contents('php://input'), true);
            $ids       = array_filter(array_map('intval', $body['ids'] ?? []));
            $agentId   = isset($body['assigned_to']) && $body['assigned_to'] !== '' ? (int)$body['assigned_to'] : null;
            if (!count($ids)) Response::error('No IDs provided');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $params = array_merge([$agentId], $ids, [$tenantId]);
            $updated = DB::execute(
                "UPDATE contacts SET assigned_to = ? WHERE id IN ($placeholders) AND tenant_id = ?",
                $params
            );
            Response::success(['updated' => $updated], "$updated contacts assigned");
        }
        if (isset($_GET['bulk_estate'])) {
            $body    = json_decode(file_get_contents('php://input'), true);
            $ids     = array_filter(array_map('intval', $body['ids'] ?? []));
            $complex = trim($body['complex'] ?? '');
            if (!count($ids) || !$complex) Response::error('IDs and estate name required');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $params = array_merge([$complex], $ids, [$tenantId]);
            $updated = DB::execute(
                "UPDATE contacts SET complex = ? WHERE id IN ($placeholders) AND tenant_id = ?",
                $params
            );
            Response::success(['updated' => $updated], "$updated contacts moved to $complex");
        }
        // Not bulk — create contact
        $body = json_decode(file_get_contents('php://input'), true);
        $name = trim($body['name'] ?? '');
        if (!$name) Response::error('Name is required');
        if (!empty($body['email']) && !filter_var($body['email'], FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address');
        }
        DB::begin();
        try {
        $newId = DB::insert(
            'INSERT INTO contacts
             (tenant_id, assigned_to, entity_type, title, name, alt_name, id_number,
              dob, phone, phone2, alt_phone, email, type, tag, source, status,
              complex, unit, street1, street2, city, province, postal,
              erf, portion, size, onsite_name, onsite_phone, fica_status, notes, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $tenantId,
                ($body['assigned_to'] ?? '') !== '' ? (int)$body['assigned_to'] : ($user['role'] === 'agent' ? (int)($user['user_id'] ?? $user['id']) : null),
                $body['entity_type'] ?? 'individual',
                $body['title'] ?? null,
                $name,
                $body['alt_name'] ?? null,
                $body['id_number'] ?? null,
                ($body['dob'] ?? '') ?: null,
                $body['phone'] ?? null,
                $body['phone2'] ?? null,
                $body['alt_phone'] ?? null,
                $body['email'] ?? null,
                $body['type'] ?? 'Lead',
                $body['tag'] ?? null,
                $body['source'] ?? 'Manual',
                $body['status'] ?? 'active',
                $body['complex'] ?? null,
                $body['unit'] ?? null,
                $body['street1'] ?? null,
                $body['street2'] ?? null,
                $body['city'] ?? null,
                $body['province'] ?? null,
                $body['postal'] ?? null,
                $body['erf'] ?? null,
                $body['portion'] ?? null,
                $body['size'] ?? null,
                $body['onsite_name'] ?? null,
                $body['onsite_phone'] ?? null,
                $body['fica_status'] ?? 'pending',
                $body['notes'] ?? null,
                $user['user_id'] ?? $user['id'],
            ]
        );
        DB::execute(
            'INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description) VALUES (?,?,?,?,?,?)',
            [$tenantId, $user['user_id'] ?? $user['id'], 'contact', $newId, 'created', "Contact '$name' created"]
        );
        DB::commit();
        Response::success(DB::queryOne('SELECT * FROM contacts WHERE id = ?', [$newId]), 'Contact created');
        } catch (\Exception $e) { DB::rollback(); Response::error('Failed to create contact: ' . $e->getMessage()); }
        break;

    // ── LIST ─────────────────────────────────────────────────
    case 'GET':
        if ($id) {
            // Single contact
            $contact = DB::queryOne(
                'SELECT c.*, u.name AS assigned_name
                   FROM contacts c
              LEFT JOIN users u ON u.id = c.assigned_to
                  WHERE c.id = ? AND c.tenant_id = ?',
                [$id, $tenantId]
            );
            if (!$contact) Response::notFound('Contact not found');
            // Documents
            $contact['documents'] = DB::query(
                'SELECT * FROM contact_documents WHERE contact_id = ? AND tenant_id = ? ORDER BY created_at DESC',
                [$id, $tenantId]
            );
            Response::success($contact);
        }

        // List with search + filter
        $search = '%' . trim($_GET['q'] ?? '') . '%';
        $type   = $_GET['type'] ?? '';
        $status = $_GET['status'] ?? 'active';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $limit  = min(2000, max(10, (int)($_GET['limit'] ?? 25)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));

        $where  = 'c.tenant_id = ?' . agentWhere($user);
        $params = [$tenantId];

        if ($type)   { $where .= ' AND c.type = ?';   $params[] = $type;   }
        if ($status) { $where .= ' AND c.status = ?'; $params[] = $status; }
        // Auto-filter agents to their assigned contacts
        if ($user['role'] === 'agent') {
            $agentId = (int)($user['user_id'] ?? $user['id']);
            $where .= ' AND c.assigned_to = ?';
            $params[] = $agentId;
        } elseif (isset($_GET['assigned_to']) && $_GET['assigned_to'] !== '') {
            $where .= ' AND c.assigned_to = ?';
            $params[] = (int)$_GET['assigned_to'];
        }

        $searchParams = array_merge($params, [$search, $search, $search]);
        $searchWhere  = $where . ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';

        $total = DB::queryOne(
            "SELECT COUNT(*) AS cnt FROM contacts c WHERE $searchWhere",
            $searchParams
        )['cnt'];

        $rows = DB::query(
            "SELECT c.*, u.name AS assigned_name,
                    (SELECT n.note FROM contact_notes n WHERE n.contact_id = c.id ORDER BY n.created_at DESC LIMIT 1) AS last_note
               FROM contacts c
          LEFT JOIN users u ON u.id = c.assigned_to
              WHERE $searchWhere
           ORDER BY c.name ASC
              LIMIT $limit OFFSET $offset",
            array_merge($searchParams, [])
        );

        Response::paginated($rows, (int)$total, $page, $limit);
        break;


    // ── UPDATE ────────────────────────────────────────────────
    case 'PUT':
        if (!$id) Response::error('Contact ID required');
        $body = json_decode(file_get_contents('php://input'), true);

        // Verify belongs to tenant — fetch all fields for fallback
        $existing = DB::queryOne(
            'SELECT * FROM contacts WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );
        if (!$existing) Response::notFound('Contact not found');

        DB::execute(
            'UPDATE contacts SET
             entity_type=?, title=?, name=?, alt_name=?, id_number=?, dob=?,
             phone=?, phone2=?, alt_phone=?, email=?, type=?, tag=?, source=?,
             status=?, complex=?, suburb=?, unit=?, street1=?, street2=?, city=?, province=?,
             postal=?, erf=?, portion=?, size=?, onsite_name=?, onsite_phone=?,
             fica_status=?, fica_notes=?, notes=?, assigned_to=?
             WHERE id = ? AND tenant_id = ?',
            [
                $body['entity_type'] ?? $existing['entity_type'] ?? 'individual',
                $body['title'] ?? $existing['title'] ?? null,
                trim($body['name'] ?? $existing['name']),
                $body['alt_name'] ?? $existing['alt_name'] ?? null,
                $body['id_number'] ?? $existing['id_number'] ?? null,
                ($body['dob'] ?? $existing['dob'] ?? '') ?: null,
                $body['phone'] ?? $existing['phone'] ?? null,
                $body['phone2'] ?? $existing['phone2'] ?? null,
                $body['alt_phone'] ?? $existing['alt_phone'] ?? null,
                $body['email'] ?? $existing['email'] ?? null,
                $body['type'] ?? $existing['type'] ?? 'Lead',
                $body['tag'] ?? $existing['tag'] ?? null,
                $body['source'] ?? $existing['source'] ?? 'Manual',
                $body['status'] ?? $existing['status'] ?? 'active',
                $body['complex'] ?? $existing['complex'] ?? null,
                $body['suburb'] ?? $existing['suburb'] ?? null,
                $body['unit'] ?? $existing['unit'] ?? null,
                $body['street1'] ?? $existing['street1'] ?? null,
                $body['street2'] ?? $existing['street2'] ?? null,
                $body['city'] ?? $existing['city'] ?? null,
                $body['province'] ?? $existing['province'] ?? null,
                $body['postal'] ?? $existing['postal'] ?? null,
                $body['erf'] ?? $existing['erf'] ?? null,
                $body['portion'] ?? $existing['portion'] ?? null,
                $body['size'] ?? $existing['size'] ?? null,
                $body['onsite_name'] ?? $existing['onsite_name'] ?? null,
                $body['onsite_phone'] ?? $existing['onsite_phone'] ?? null,
                $body['fica_status'] ?? $existing['fica_status'] ?? 'pending',
                $body['fica_notes'] ?? $existing['fica_notes'] ?? null,
                $body['notes'] ?? $existing['notes'] ?? null,
                array_key_exists('assigned_to', $body) ? ($body['assigned_to'] ?: null) : $existing['assigned_to'],
                $id,
                $tenantId,
            ]
        );

        DB::execute(
            'INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$tenantId, $user['user_id'] ?? $user['id'], 'contact', $id, 'updated', "Contact updated by {$user['name']}"]
        );

        $contact = DB::queryOne('SELECT * FROM contacts WHERE id = ?', [$id]);
        Response::success($contact, 'Contact updated');
        break;

    // ── DELETE ────────────────────────────────────────────────
    case 'DELETE':
        if (!$id) Response::error('Contact ID required');
        Auth::requireRole($user, ['platform_superadmin', 'super_admin', 'admin']);

        $existing = DB::queryOne(
            'SELECT id, name FROM contacts WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );
        if (!$existing) Response::notFound('Contact not found');

        DB::execute('DELETE FROM contacts WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);

        DB::execute(
            'INSERT INTO activity_log (tenant_id, user_id, entity_type, entity_id, action, description)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$tenantId, $user['user_id'] ?? $user['id'], 'contact', $id, 'deleted', "Contact '{$existing['name']}' deleted"]
        );

        Response::success(null, 'Contact deleted');
        break;

    default:
        Response::error('Method not allowed', 405);
}
