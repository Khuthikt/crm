/* ============================================================
   PROPERTY CRM — MAIN APP JS
   Full forms: Contacts, Deals, Leases, Invoices, Team, Tenants
   ============================================================ */

'use strict';
let selectedContacts = new Set();
let groupedByEstate  = false;
let allContacts      = [];
let currentEstate    = null;
let estateGroups     = {};

// ── API Helper ──────────────────────────────────────────────
const API = {
  async request(method, endpoint, data = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (data && method !== 'GET') opts.body = JSON.stringify(data);
    const url = `/crm/api/${endpoint}`;
    const res = await fetch(url, opts);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  },
  get:    (ep, params) => { const qs = params ? '?' + new URLSearchParams(params) : ''; return API.request('GET', ep + qs); },
  post:   (ep, data)   => API.request('POST', ep, data),
  put:    (ep, data)   => API.request('PUT', ep, data),
  delete: (ep)         => API.request('DELETE', ep),
};

// ── Toast ───────────────────────────────────────────────────
function toast(message, type = 'default') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Auth ────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('login-username')?.value?.trim();
  const password  = document.getElementById('login-password')?.value;
  const errEl     = document.getElementById('login-error');
  const btn       = document.getElementById('login-btn');
  if (!username || !password) { errEl.textContent = 'Please enter your username and password.'; return; }
  btn.textContent = 'Signing in…'; btn.disabled = true;
  try {
    await API.post('auth/login.php', { username, password });
    window.location.reload();
  } catch (err) {
    errEl.textContent = err.message || 'Login failed.';
    btn.textContent = 'Sign In'; btn.disabled = false;
  }
}

async function doLogout() {
  await fetch('/crm/api/auth/logout.php', { method: 'POST', credentials: 'same-origin' });
  window.location.href = '/crm/';
}

function togglePw() {
  const pw = document.getElementById('login-password');
  if (pw) pw.type = pw.type === 'password' ? 'text' : 'password';
}

// ── Mobile Nav ──────────────────────────────────────────────
function toggleNav() { document.getElementById('sidebar')?.classList.toggle('open'); document.getElementById('nav-overlay')?.classList.toggle('open'); }
function closeNav()  { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('nav-overlay')?.classList.remove('open'); }

// ── Modal ───────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── Router ──────────────────────────────────────────────────
const VIEWS = {
  dashboard:    loadDashboard,
  mywork:       loadMyWork,
  search:       loadComplexSearch,
  leaderboard:  loadLeaderboard,
  contacts:  loadContacts,
  deals:     loadDeals,
  listings:  loadListings,
  leases:    loadLeases,
  invoices:  loadInvoices,
  team:      loadTeam,
  settings:  loadSettings,
  'platform-tenants': loadPlatformTenants,
};

function navigate(view) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));
  closeNav();
  const loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';
  const fn = VIEWS[view];
  if (fn) {
    fn().catch(err => { console.error(err); toast(err.message || 'Failed to load page', 'error'); })
       .finally(() => { if (loader) loader.style.display = 'none'; });
  }
}

// ── Utilities ───────────────────────────────────────────────
function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n) { return 'R ' + Number(n||0).toLocaleString('en-ZA', { minimumFractionDigits: 2 }); }
function fmtN(n) { return Number(n||0).toLocaleString('en-ZA'); }
function timeAgo(d) {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

const FICA_BADGE    = { pending:'badge-gray', partial:'badge-amber', complete:'badge-green', expired:'badge-red' };
const STATUS_BADGE  = { active:'badge-green', expired:'badge-red', cancelled:'badge-gray', pending:'badge-amber', suspended:'badge-red', trial:'badge-amber' };
const INVOICE_BADGE = { unpaid:'badge-amber', paid:'badge-green', overdue:'badge-red', cancelled:'badge-gray' };
const DEAL_BADGE    = { lead:'badge-gray', qualified:'badge-blue', pending:'badge-amber', closed:'badge-green', withdrawn:'badge-red' };
const ROLE_BADGE    = { super_admin:'badge-purple', admin:'badge-blue', finance_admin:'badge-amber', agent:'badge-gray', platform_superadmin:'badge-purple' };

// ── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard() {
  const res  = await API.get('dashboard/index.php');
  const data = res.data;
  const kpi  = data.kpi;
  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Dashboard</div>
      <div class="topbar-actions"><span class="text-muted" style="font-size:12px">${new Date().toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span></div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Active Contacts</div><div class="kpi-value">${fmtN(kpi.total_contacts)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Active Listings</div><div class="kpi-value">${fmtN(kpi.active_listings)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Monthly Rent Roll</div><div class="kpi-value" style="font-size:18px">${fmt(kpi.monthly_rent_roll)}</div><div class="kpi-sub">${fmtN(kpi.active_leases)} active leases</div></div>
      <div class="kpi-card"><div class="kpi-label">Pipeline Value</div><div class="kpi-value" style="font-size:18px">${fmt(kpi.pipeline_value)}</div><div class="kpi-sub">${fmtN(kpi.closed_this_month)} closed this month</div></div>
    </div>
    ${kpi.overdue_invoices > 0 ? `<div class="card" style="border-color:var(--red-border);background:var(--red-light);margin-bottom:16px"><div class="card-body" style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between"><div><strong style="color:var(--red)">${fmtN(kpi.overdue_invoices)} overdue invoice${kpi.overdue_invoices!==1?'s':''}</strong><span style="color:var(--red);margin-left:8px;font-size:13px">— ${fmt(kpi.total_owed)} outstanding</span></div><button class="btn btn-sm btn-danger" onclick="navigate('invoices')">View Invoices</button></div></div>` : ''}
    ${data.renewals.length > 0 ? `<div class="card" style="margin-bottom:16px"><div class="card-header"><div class="card-title">⚠️ Lease Renewals Due (Next 60 Days)</div></div><div class="table-wrap"><table><thead><tr><th>Ref</th><th>Tenant</th><th>Property</th><th>End Date</th><th>Monthly Rent</th></tr></thead><tbody>${data.renewals.map(l=>`<tr><td>${l.ref}</td><td>${esc(l.tenant_name)}</td><td>${esc(l.property||'—')}</td><td><span class="badge badge-amber">${l.end_date}</span></td><td class="font-mono">${fmt(l.monthly_rent)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="grid-2">
      <div class="card"><div class="card-header"><div class="card-title">Agent Leaderboard (This Year)</div></div><div class="card-body">${data.leaderboard.length ? data.leaderboard.map((a,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="width:20px;text-align:center;font-weight:700;color:var(--text-3)">${i+1}</div><div class="avatar">${a.name.substring(0,2).toUpperCase()}</div><div style="flex:1"><div style="font-weight:500;font-size:13px">${esc(a.name)}</div><div style="font-size:11px;color:var(--text-3)">${a.deals_closed} deal${a.deals_closed!==1?'s':''} closed</div></div><div class="font-mono" style="font-size:12px;font-weight:600;color:var(--green)">${fmt(a.total_value)}</div></div>`).join('') : '<div class="text-muted" style="text-align:center;padding:20px">No closed deals yet</div>'}</div></div>
      <div class="card"><div class="card-header"><div class="card-title">Recent Activity</div></div><div class="card-body" style="max-height:300px;overflow-y:auto">${data.activity.length ? data.activity.map(a=>`<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="font-size:12px;flex:1;color:var(--text-2)">${esc(a.description||a.action)}</div><div style="font-size:11px;color:var(--text-3);white-space:nowrap">${timeAgo(a.created_at)}</div></div>`).join('') : '<div class="text-muted" style="text-align:center;padding:20px">No activity yet</div>'}</div></div>
    </div>`;
}

// ── CONTACTS ─────────────────────────────────────────────────
let editingContactId = null;

let contactsPage = 1;
const CONTACTS_PER_PAGE = 200;

async function loadContacts(forceRefresh = false) {
  if (allContacts.length && !forceRefresh) {
    renderContactsPage(allContacts);
    return;
  }
  // Show page with loading state immediately
  document.getElementById('page-content').innerHTML = `
    <div class="topbar"><div class="topbar-title">Contacts <span style="font-size:12px;color:var(--text-3);font-weight:400">(loading…)</span></div></div>
    <div style="display:flex;align-items:center;justify-content:center;padding:80px;color:var(--text-3)">
      <div style="text-align:center">
        <div style="font-size:32px;margin-bottom:12px">⏳</div>
        <div>Loading contacts…</div>
      </div>
    </div>`;
  const params = { limit: 2000, status: 'active' };
  if (IS_AGENT) params.assigned_to = APP_USER?.id;
  const res = await API.get('contacts/index.php', params);
  allContacts = res.data;
  renderContactsPage(allContacts);
}

async function loadRemainingContacts() {
  let offset = CONTACTS_PER_PAGE;
  let safety = 0;
  while (safety++ < 20) {
    const res = await API.get('contacts/index.php', { limit: CONTACTS_PER_PAGE, offset, status: 'active' });
    if (!res.data.length || res.data.length < CONTACTS_PER_PAGE) {
      if (res.data.length) allContacts = [...allContacts, ...res.data];
      break;
    }
    allContacts = [...allContacts, ...res.data];
    offset += CONTACTS_PER_PAGE;
  }
  // Deduplicate
  const seen = new Set();
  allContacts = allContacts.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  // Update count display
  const countEl = document.getElementById('contacts-count');
  if (countEl) countEl.textContent = '(' + allContacts.length + ')';
  // Refresh current view
  if (document.getElementById('contacts-view')) {
    if (groupedByEstate) renderEstateLayout();
    else {
      const tbody = document.getElementById('contacts-tbody');
      if (tbody) tbody.innerHTML = renderContactRows(allContacts);
    }
  }
}

function renderContactsPage(contacts) {
  selectedContacts.clear();
  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Contacts <span style="font-size:12px;color:var(--text-3);font-weight:400" id="contacts-count">(${contacts.length})</span></div>
      <div class="topbar-actions">
<select class="form-select" style="width:150px" onchange="sortContacts(this.value)" id="contacts-sort"><option value="name">A — Z</option><option value="recent">Recently Added</option><option value="updated">Recently Updated</option></select>
        <div class="search-wrap">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input class="form-input" id="contact-search" placeholder="Search name, phone, email, complex…" oninput="filterContacts(this.value)">
        </div>
        <select class="form-select" style="width:130px" onchange="filterContactsByType(this.value)">
          <option value="">All Types</option>
          <option value="Lead">Lead</option><option value="Tenant">Tenant</option>
          <option value="Landlord">Landlord</option><option value="Buyer">Buyer</option>
          <option value="Seller">Seller</option><option value="Owner">Owner</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="toggleGroupByEstate()" id="btn-group-estate">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="width:14px;height:14px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Group by Estate
        </button>
        <button class="btn btn-ghost btn-sm" id="btn-bulk-assign" style="display:none" onclick="openBulkAssignModal()">
          Assign Selected
        </button>
        <button class="btn btn-danger btn-sm" id="btn-bulk-delete" style="display:none" onclick="bulkDelete()">
          Delete Selected
        </button>
        <button class="btn btn-ghost btn-sm" onclick="exportContacts()">↓ Export</button>
        <button class="btn btn-ghost btn-sm" onclick="openImportModal()">↑ Import</button>
        <button class="btn btn-primary btn-sm" onclick="openContactModal()">+ Add Contact</button>
      </div>
    </div>

    <div id="bulk-info-bar" style="display:none;align-items:center;gap:8px;padding:10px 14px;background:var(--blue-light);border:1px solid var(--blue-border);border-radius:8px;margin-bottom:12px;font-size:13px">
      <span id="bulk-count-text" style="font-weight:500;color:var(--blue)"></span>
      <select id="bulk-type-select" class="form-select" style="width:130px">
        <option value="">Change type…</option>
        <option value="Lead">Lead</option><option value="Owner">Owner</option>
        <option value="Tenant">Tenant</option><option value="Landlord">Landlord</option>
        <option value="Buyer">Buyer</option><option value="Seller">Seller</option><option value="Other">Other</option>
      </select>
      <button class="btn btn-ghost btn-sm" onclick="bulkChangeType()">Apply</button>
      <button class="btn btn-ghost btn-sm" onclick="clearBulkSelection()">Clear</button>
    </div>

    <div id="contacts-view">
      ${isMobile() ? `
      <div id="contacts-mobile">${renderContactCards(contacts)}</div>` : `
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th style="width:36px"><input type="checkbox" id="select-all-cb" onclick="toggleSelectAll(this)"></th>
              <th>Name</th><th>Type</th><th>Phone</th><th>Email</th><th>Agent</th><th>FICA</th><th style="width:130px">Actions</th>
            </tr></thead>
            <tbody id="contacts-tbody">${renderContactRows(contacts)}</tbody>
          </table>
        </div>
      </div>`}
    </div>
    ${contactModalHTML()}${importModalHTML()}${bulkAssignModalHTML()}${quickViewModalHTML()}`;
  // Add floating top scrollbar that syncs with contacts table
  setTimeout(() => {
    const tableWrap = document.querySelector('#page-content .table-wrap');
    if (!tableWrap) return;
    const floatScroll = document.createElement('div');
    floatScroll.className = 'float-scroll';
    const inner = document.createElement('div');
    inner.className = 'float-scroll-inner';
    inner.style.width = tableWrap.scrollWidth + 'px';
    floatScroll.appendChild(inner);
    tableWrap.parentNode.insertBefore(floatScroll, tableWrap);
    floatScroll.addEventListener('scroll', () => tableWrap.scrollLeft = floatScroll.scrollLeft);
    tableWrap.addEventListener('scroll', () => floatScroll.scrollLeft = tableWrap.scrollLeft);
  }, 300);

  const hasEstates = contacts.some(c => c.complex);
  if (hasEstates) {
    groupedByEstate = true;
    currentEstate   = null;
    const btn = document.getElementById('btn-group-estate');
    if (btn) { btn.style.background='var(--accent)'; btn.style.color='#fff'; btn.textContent='≡ Flat View'; }
    renderEstateLayout();
  }

}


function renderContactRows(contacts) {
  if (!contacts.length) return `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-3)">No contacts found</td></tr>`;
  return contacts.map(c => `
    <tr>
      <td><input type="checkbox" class="contact-checkbox" value="${c.id}" onchange="toggleContact(this)"></td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar">${(c.name||'?').substring(0,2).toUpperCase()}</div>
          <div>
            <div class="td-name" style="cursor:pointer;color:var(--blue)" onclick="viewContact(${c.id})">${esc(c.name)}</div>
            ${c.alt_name?`<div class="td-sub">${esc(c.alt_name)}</div>`:''}
          </div>
        </div>
      </td>
      <td><span class="badge badge-gray">${c.type}</span></td>
      <td>${c.phone?`<a href="tel:${c.phone}" style="color:var(--blue)">${esc(c.phone)}</a>`:'—'}</td>
      <td>${c.email?`<a href="mailto:${c.email}" style="color:var(--blue);font-size:12px">${esc(c.email)}</a>`:'—'}</td>
      <td>${c.assigned_name ? `<span class="badge badge-blue" style="cursor:pointer" onclick="openAssignModal(${c.id},'${esc(c.name)}')" title="Click to reassign">${esc(c.assigned_name.split(' ')[0])}</span> <span style="cursor:pointer;color:var(--red);font-size:11px" onclick="unassignContact(${c.id},'${esc(c.name)}')" title="Unassign">✕</span>` : `<button class="btn btn-ghost btn-sm" onclick="openAssignModal(${c.id},'${esc(c.name)}')">Assign</button>`}</td>
      <td><span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span></td>
      <td><div class="flex-gap">
        <button class="btn btn-sm btn-ghost" onclick="openQuickView(${c.id}, allContacts.map(c=>c.id))">View</button>
        <button class="btn btn-sm btn-ghost" onclick="openContactModal(${c.id})">Edit</button>
        ${CAN_DELETE ? `<button class="btn btn-sm btn-danger" onclick="deleteContact(${c.id},'${esc(c.name)}')">Del</button>` : ""}
      </div></td>
    </tr>`).join('');
}


function renderContactCards(contacts) {
  if (!contacts.length) return `<div class="empty"><div class="empty-text">No contacts found</div></div>`;
  return `<div class="mobile-card-list">` + contacts.map(c => `
    <div class="mobile-card" onclick="viewContact(${c.id})">
      <div class="mobile-card-name">${esc(c.name)}</div>
      <div class="mobile-card-meta">${esc(c.phone||'')} ${c.email?'· '+c.email:''}</div>
      <div class="mobile-card-row"><span class="badge badge-gray">${c.type}</span><span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span></div>
    </div>`).join('') + `</div>`;
}

function filterContacts(q) {
  const filtered = allContacts.filter(c =>
    (c.name||'').toLowerCase().includes(q.toLowerCase()) ||
    (c.phone||'').includes(q) ||
    (c.email||'').toLowerCase().includes(q.toLowerCase())
  );
  if (groupedByEstate) {
    // When searching, rebuild all estate groups with filtered contacts
    // so results show across all estates
    if (q) {
      const tempGroups = buildEstateGroups(filtered);
      const bdy = document.getElementById('estate-mbody');
      const sidebar = document.getElementById('estate-sidebar-list');
      if (sidebar) {
        sidebar.innerHTML = Object.keys(tempGroups).map(estate =>
          `<div class="estate-item ${estate===currentEstate?'active':''}" onclick="selectEstate('${estate.replace(/'/g,"\\'")}')">
            <span class="ename">${estate}</span>
            <span class="ecnt">${tempGroups[estate].length}</span>
          </div>`
        ).join('');
      }
      if (bdy && currentEstate && tempGroups[currentEstate]) {
        bdy.innerHTML = '<div style="overflow-x:auto">' + renderEstateTable(tempGroups[currentEstate]) + '</div>';
      } else if (bdy) {
        // Show all filtered results flat
        bdy.innerHTML = '<div style="overflow-x:auto">' + renderEstateTable(filtered) + '</div>';
      }
    } else {
      // No search — restore normal estate view
      renderEstateLayout();
    }
  } else {
    const tbody = document.getElementById('contacts-tbody');
    if (tbody) tbody.innerHTML = renderContactRows(filtered);
    const mob = document.getElementById('contacts-mobile');
    if (mob) mob.innerHTML = renderContactCards(filtered);
  }
}

function filterContactsByType(type) {
  const filtered = type ? allContacts.filter(c => c.type === type) : allContacts;
  if (groupedByEstate && currentEstate) {
    // Filter within the current estate only
    const estateContacts = (estateGroups[currentEstate] || []).filter(c => !type || c.type === type);
    const bdy = document.getElementById('estate-mbody');
    if (bdy) bdy.innerHTML = '<div style="overflow-x:auto">' + renderEstateTable(estateContacts) + '</div>';
    // Update count in header
    const hdrCount = document.querySelector('#estate-mhdr .ecnt');
    if (hdrCount) hdrCount.textContent = estateContacts.length + ' contacts';
  } else if (groupedByEstate) {
    estateGroups = buildEstateGroups(filtered);
    renderEstateLayout();
  } else {
    const tbody = document.getElementById('contacts-tbody');
    if (tbody) tbody.innerHTML = renderContactRows(filtered);
    const mob = document.getElementById('contacts-mobile');
    if (mob) mob.innerHTML = renderContactCards(filtered);
  }
}

async function openContactModal(id = null) {
  editingContactId = id;
  if (!document.getElementById('modal-contact')) {
    const div = document.createElement('div');
    div.innerHTML = contactModalHTML();
    document.body.appendChild(div.firstElementChild);
  }
  const title = id ? 'Edit Contact' : 'New Contact';
  document.getElementById('contact-modal-title').textContent = title;

  if (id) {
    try {
      const res = await API.get(`contacts/index.php?id=${id}`);
      const c = res.data;
      document.getElementById('c-name').value     = c.name || '';
      document.getElementById('c-altname').value  = c.alt_name || '';
      document.getElementById('c-type').value     = c.type || 'Lead';
      document.getElementById('c-entity').value   = c.entity_type || 'individual';
      document.getElementById('c-phone').value    = c.phone || '';
      document.getElementById('c-phone2').value   = c.phone2 || '';
      document.getElementById('c-email').value    = c.email || '';
      document.getElementById('c-idnum').value    = c.id_number || '';
      document.getElementById('c-dob').value      = c.dob || '';
      document.getElementById('c-complex').value  = c.complex || '';
      document.getElementById('c-unit').value     = c.unit || '';
      document.getElementById('c-street1').value  = c.street1 || '';
      document.getElementById('c-city').value     = c.city || '';
      document.getElementById('c-province').value = c.province || '';
      document.getElementById('c-postal').value   = c.postal || '';
      document.getElementById('c-fica').value     = c.fica_status || 'pending';
      document.getElementById('c-notes').value    = c.notes || '';
      document.getElementById('c-source').value   = c.source || 'Manual';
      document.getElementById('c-tag').value      = c.tag || '';
    } catch(e) { toast('Failed to load contact', 'error'); return; }
  } else {
    document.getElementById('contact-form').reset();
  }
  openModal('modal-contact');
}

async function saveContact() {
  const g = id => document.getElementById(id)?.value || '';
  const data = {
    name:        g('c-name').trim(),
    alt_name:    g('c-altname'),
    type:        g('c-type'),
    entity_type: g('c-entity') || 'individual',
    phone:       g('c-phone'),
    phone2:      g('c-phone2'),
    email:       g('c-email'),
    id_number:   g('c-idnum'),
    dob:         g('c-dob'),
    complex:     g('c-complex'),
    unit:        g('c-unit'),
    street1:     g('c-street1'),
    city:        g('c-city'),
    province:    g('c-province'),
    postal:      g('c-postal'),
    fica_status: g('c-fica') || 'pending',
    notes:       g('c-notes'),
    source:      g('c-source') || 'Manual',
    tag:         g('c-tag'),
    status:      'active',
    assigned_to: (!editingContactId && IS_AGENT) ? APP_USER?.id : undefined,
  };
  if (!data.name) { toast('Name is required', 'error'); return; }
  try {
    if (editingContactId) {
      await API.put(`contacts/index.php?id=${editingContactId}`, data);
      toast('Contact updated', 'success');
    } else {
      await API.post('contacts/index.php', data);
      toast('Contact created', 'success');
    }
    closeModal('modal-contact');
    allContacts = [];
    await new Promise(r => setTimeout(r, 500));
    if (IS_AGENT) {
      await loadMyWork();
    } else {
      await loadContacts(true);
    }
  } catch(e) { 
    console.error('saveContact error:', e);
    toast(e.message || 'Failed to save contact', 'error'); 
  }
}

async function deleteContact(id, name) {
  if (!confirm(`Delete contact "${name}"? This cannot be undone.`)) return;
  try {
    await API.delete(`contacts/index.php?id=${id}`);
    toast('Contact deleted', 'success');
    // Remove from cache and refresh
    allContacts = allContacts.filter(c => c.id !== id);
    // Update count
    const countEl = document.getElementById('contacts-count');
    if (countEl) countEl.textContent = '(' + allContacts.length + ')';
    if (groupedByEstate) renderEstateLayout();
    else {
      const tbody = document.getElementById('contacts-tbody');
      if (tbody) tbody.innerHTML = renderContactRows(allContacts);
    }
  } catch(e) { toast(e.message, 'error'); }
}

function contactModalHTML() {
  return `
  <div class="modal-overlay" id="modal-contact">
    <div class="modal" style="max-width:680px">
      <div class="modal-header">
        <div class="modal-title" id="contact-modal-title">New Contact</div>
        <button class="modal-close" onclick="closeModal('modal-contact')">✕</button>
      </div>
      <div class="modal-body">
        <form id="contact-form">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Basic Info</div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="c-name" placeholder="Full name" required></div>
            <div class="form-group"><label class="form-label">Alt Name / Company</label><input class="form-input" id="c-altname" placeholder="Trading name or alias"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Type</label>
              <select class="form-select" id="c-type">
                <option value="Lead">Lead</option><option value="Tenant">Tenant</option><option value="Landlord">Landlord</option>
                <option value="Buyer">Buyer</option><option value="Seller">Seller</option><option value="Owner">Owner</option><option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">Entity</label>
              <select class="form-select" id="c-entity"><option value="individual">Individual</option><option value="company">Company</option></select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">ID Number</label><input class="form-input" id="c-idnum" placeholder="SA ID number"></div>
            <div class="form-group"><label class="form-label">Date of Birth</label><input class="form-input" type="date" id="c-dob"></div>
          </div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Contact Details</div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Phone *</label><input class="form-input" id="c-phone" placeholder="e.g. 082 000 1234"></div>
            <div class="form-group"><label class="form-label">Alt Phone</label><input class="form-input" id="c-phone2" placeholder="Secondary number"></div>
          </div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" id="c-email" placeholder="email@example.co.za"></div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Address</div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Complex / Estate</label><input class="form-input" id="c-complex" placeholder="Complex name"></div>
            <div class="form-group"><label class="form-label">Unit Number</label><input class="form-input" id="c-unit" placeholder="Unit / flat number"></div>
          </div>
          <div class="form-group"><label class="form-label">Street Address</label><input class="form-input" id="c-street1" placeholder="Street address"></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">City</label><input class="form-input" id="c-city" placeholder="City / suburb"></div>
            <div class="form-group"><label class="form-label">Postal Code</label><input class="form-input" id="c-postal" placeholder="Postal code"></div>
          </div>
          <div class="form-group"><label class="form-label">Province</label>
            <select class="form-select" id="c-province">
              <option value="">— Select Province —</option>
              <option>Gauteng</option><option>Western Cape</option><option>KwaZulu-Natal</option>
              <option>Eastern Cape</option><option>Limpopo</option><option>Mpumalanga</option>
              <option>North West</option><option>Free State</option><option>Northern Cape</option>
            </select>
          </div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Other</div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">FICA Status</label>
              <select class="form-select" id="c-fica">
                <option value="pending">Pending</option><option value="partial">Partial</option>
                <option value="complete">Complete</option><option value="expired">Expired</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">Source</label>
              <select class="form-select" id="c-source">
                <option value="Manual">Manual</option><option value="Referral">Referral</option>
                <option value="Website">Website</option><option value="Walk-in">Walk-in</option>
                <option value="Social Media">Social Media</option><option value="Portal">Portal</option>
              </select>
            </div>
          </div>
          <div class="form-group"><label class="form-label">Tag / Label</label><input class="form-input" id="c-tag" placeholder="e.g. VIP, Follow-up"></div>
          <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="c-notes" placeholder="Internal notes about this contact…"></textarea></div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-contact')">Cancel</button>
        <button class="btn btn-primary" onclick="saveContact()">Save Contact</button>
      </div>
    </div>
  </div>`;
}

// ── DEALS ────────────────────────────────────────────────────
let editingDealId = null;

async function loadDeals() {
  const params = {};
  if (IS_AGENT) params.assigned_to = APP_USER?.id;
  const res = await API.get('deals/index.php', params);
  allDeals = res.data;
  const filtered = dealTypeFilter === 'all' ? allDeals : allDeals.filter(d => (d.deal_type||'Lease') === dealTypeFilter);
  renderDealsPage(filtered);
}

let dealView = 'pipeline'; // 'pipeline' or 'reports'
let dealTypeFilter = 'all'; // 'all', 'Sale', 'Lease'
let allDeals = [];

function renderDealsPage(deals) {
  allDeals = deals;
  const stages = ['lead', 'qualified', 'pending'];
  const labels = { lead:'Lead', qualified:'Qualified', pending:'Pending', closed:'Closed', withdrawn:'Withdrawn' };
  const grouped = {};
  ['lead','qualified','pending','closed','withdrawn'].forEach(s => { grouped[s] = deals.filter(d => d.stage === s); });

  // Summary KPIs
  const totalValue    = deals.filter(d=>d.stage!=='lost'&&d.stage!=='withdrawn').reduce((s,d)=>s+parseFloat(d.value||0),0);
  const closedValue   = deals.filter(d=>d.stage==='closed').reduce((s,d)=>s+parseFloat(d.value||0),0);
  const closedCount   = deals.filter(d=>d.stage==='closed').length;
  const activeCount   = deals.filter(d=>!['closed','withdrawn'].includes(d.stage)).length;

  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Pipeline</div>
      <div class="topbar-actions">
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm ${dealView==='pipeline'?'active-filter':''}" onclick="setDealView('pipeline',this)">Pipeline</button>
          <button class="btn btn-ghost btn-sm ${dealView==='list'?'active-filter':''}" onclick="setDealView('list',this)">List</button>
          <button class="btn btn-ghost btn-sm ${dealView==='reports'?'active-filter':''}" onclick="setDealView('reports',this)">Reports</button>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm ${dealTypeFilter==='all'?'active-filter':''}" onclick="setDealType('all')">All</button>
          <button class="btn btn-ghost btn-sm ${dealTypeFilter==='Sale'?'active-filter':''}" onclick="setDealType('Sale')">Sale</button>
          <button class="btn btn-ghost btn-sm ${dealTypeFilter==='Lease'?'active-filter':''}" onclick="setDealType('Lease')">Lease</button>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="exportDeals()">↓ Export</button>
        <button class="btn btn-primary btn-sm" onclick="openDealModal()">+ Add Deal</button>
      </div>
    </div>

    <!-- KPI summary -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi-card"><div class="kpi-label">Active Deals</div><div class="kpi-value">${activeCount}</div></div>
      <div class="kpi-card"><div class="kpi-label">Pipeline Value</div><div class="kpi-value" style="font-size:18px">${fmt(totalValue)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Closed This Year</div><div class="kpi-value">${closedCount}</div></div>
      <div class="kpi-card"><div class="kpi-label">Closed Value</div><div class="kpi-value" style="font-size:18px;color:var(--green)">${fmt(closedValue)}</div></div>
    </div>

    <div id="deal-view-content"></div>
    ${dealModalHTML()}
  `;

  // Add active filter style
  if (!document.getElementById('deal-filter-style')) {
    const s = document.createElement('style');
    s.id = 'deal-filter-style';
    s.textContent = '.active-filter{background:var(--accent)!important;color:#fff!important;border-color:var(--accent)!important}';
    document.head.appendChild(s);
  }

  renderDealView(dealView, grouped, labels);
}

function setDealView(view, el) {
  dealView = view;
  document.querySelectorAll('.topbar-actions .btn-ghost').forEach(b => b.classList.remove('active-filter'));
  if (el) el.classList.add('active-filter');
  loadDeals();
}

function setDealType(type) {
  dealTypeFilter = type;
  const filtered = type === 'all' ? allDeals : allDeals.filter(d => (d.deal_type||'Lease') === type);
  const labels = { lead:'Lead', qualified:'Qualified', pending:'Pending', closed:'Closed', withdrawn:'Withdrawn' };
  const grouped = {};
  ['lead','qualified','pending','closed','withdrawn'].forEach(s => { grouped[s] = filtered.filter(d => d.stage === s); });
  const el = document.getElementById('deal-view-content');
  if (el) {
    if (dealView === 'pipeline') renderPipelineView(el, grouped, labels);
    else if (dealView === 'list') renderListView(el, filtered, labels);
    else renderReportsView(el);
  } else {
    renderDealsPage(filtered);
  }
}

function renderDealView(view, grouped, labels) {
  const el = document.getElementById('deal-view-content');
  if (!el) return;
  if (view === 'pipeline') renderPipelineView(el, grouped, labels);
  else if (view === 'list') renderListView(el, allDeals, labels);
  else renderReportsView(el);
}

function renderPipelineView(el, grouped, labels) {
  const stages = ['lead','qualified','pending'];
  el.innerHTML = `
    <div class="pipeline" id="pipeline-board">
      ${stages.map(stage => `
      <div class="pipeline-col">
        <div class="pipeline-col-header">
          <span class="pipeline-col-name">${labels[stage]}</span>
          <span class="pipeline-col-count">${grouped[stage].length}</span>
        </div>
        ${grouped[stage].length ? `<div style="font-size:11px;color:var(--text-3);margin-bottom:8px;font-family:monospace">${fmt(grouped[stage].reduce((s,d)=>s+parseFloat(d.value||0),0))}</div>` : ''}
        ${grouped[stage].map(d => `
        <div class="deal-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div class="deal-card-name" style="cursor:pointer;color:var(--blue)" onclick="openDealModal(${d.id})">${esc(d.title)}</div>
            <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px" onclick="openDealModal(${d.id})">Edit</button>
          </div>
          <div class="deal-card-sub">${esc(d.contact_name||'—')}</div>
          ${d.listing_title ? `<div class="deal-card-sub" style="font-size:11px;color:var(--text-3)">${esc(d.listing_title)}</div>` : ''}
          ${d.agent_name ? `<div class="deal-card-sub" style="font-size:11px">Agent: ${esc(d.agent_name.split(' ')[0])}</div>` : ''}
          <div class="deal-card-value">${fmt(d.value)}</div>
          <!-- Stage change buttons -->
          <div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
            ${['lead','qualified','pending','closed','withdrawn'].filter(s=>s!==d.stage).map(s =>
              `<button class="btn btn-sm btn-ghost" style="padding:2px 6px;font-size:10px" onclick="quickStageChange(${d.id},'${s}')">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`
            ).join('')}
          </div>
        </div>`).join('') || `<div class="text-muted" style="font-size:12px;padding:8px">No deals</div>`}
      </div>`).join('')}
    </div>

    <!-- Closed and Withdrawn -->
    <div class="grid-2" style="margin-top:16px">
      ${['closed','withdrawn'].map(stage => `
      <div class="card" ${stage==='withdrawn'?'style="grid-column:1/-1"':''}>
        <div class="card-header">
          <div class="card-title">${labels[stage]} (${grouped[stage].length})</div>
          ${stage==='closed'?`<span class="font-mono text-green" style="font-size:12px;font-weight:600">${fmt(grouped[stage].reduce((s,d)=>s+parseFloat(d.value||0),0))}</span>`:''}
        </div>
        ${grouped[stage].length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Deal</th><th>Contact</th><th>Agent</th><th>Value</th><th>Commission</th><th></th></tr></thead>
          <tbody>${grouped[stage].map(d=>`
          <tr>
            <td class="td-name">${esc(d.title)}</td>
            <td>${esc(d.contact_name||'—')}</td>
            <td>${d.agent_name?`<span class="badge badge-blue" style="font-size:10px">${esc(d.agent_name.split(' ')[0])}</span>`:'—'}</td>
            <td class="font-mono">${fmt(d.value)}</td>
            <td class="font-mono text-green">${fmt(d.commission_amt)}</td>
            <td><div class="flex-gap">
              <button class="btn btn-ghost btn-sm" onclick="openDealModal(${d.id})">Edit</button>
              <select class="form-select" style="width:110px;font-size:11px;padding:3px 6px" onchange="quickStageChange(${d.id},this.value);this.value=''">
                <option value="">Move to…</option>
                <option value="lead">Lead</option>
                <option value="qualified">Qualified</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div></td>
          </tr>`).join('')}</tbody>
        </table></div>` : `<div class="empty" style="padding:24px"><div class="empty-text">No ${stage} deals</div></div>`}
      </div>`).join('')}
    </div>`;
}

function renderListView(el, deals, labels) {
  const statusBadge = { lead:'badge-gray', qualified:'badge-blue', pending:'badge-amber', closed:'badge-green', withdrawn:'badge-red' };
  el.innerHTML = `
    <div class="card">
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
        ${['all','lead','qualified','pending','closed','withdrawn'].map(s =>
          `<button class="btn btn-ghost btn-sm" onclick="filterDealList('${s}')" id="dl-filter-${s}">${s==='all'?'All':labels[s]||s} (${s==='all'?deals.length:deals.filter(d=>d.stage===s).length})</button>`
        ).join('')}
      </div>
      <div class="table-wrap">
        <table id="deal-list-table">
          <thead><tr>
            <th>Deal Title</th><th>Contact</th><th>Stage</th>
            <th>Value</th><th>Commission</th><th>Agent</th>
            <th>Expected Close</th><th></th>
          </tr></thead>
          <tbody id="deal-list-tbody">
            ${renderDealListRows(deals)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderDealListRows(deals) {
  const statusBadge = { lead:'badge-gray', qualified:'badge-blue', pending:'badge-amber', closed:'badge-green', withdrawn:'badge-red' };
  if (!deals.length) return `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-3)">No deals found</td></tr>`;
  return deals.map(d => `
  <tr>
    <td class="td-name" style="cursor:pointer;color:var(--blue)" onclick="openDealModal(${d.id})">${esc(d.title)}</td>
    <td>${esc(d.contact_name||'—')}</td>
    <td><span class="badge ${statusBadge[d.stage]||'badge-gray'}">${d.stage}</span></td>
    <td class="font-mono">${fmt(d.value)}</td>
    <td class="font-mono text-green">${fmt(d.commission_amt)}</td>
    <td>${d.agent_name?`<span class="badge badge-blue" style="font-size:10px">${esc(d.agent_name.split(' ')[0])}</span>`:'—'}</td>
    <td>${d.expected_close||'—'}</td>
    <td><div class="flex-gap">
      <button class="btn btn-sm btn-ghost" onclick="openDealModal(${d.id})">Edit</button>
      <button class="btn btn-sm btn-danger" onclick="deleteDeal(${d.id},'${esc(d.title)}')">Del</button>
    </div></td>
  </tr>`).join('');
}

function filterDealList(stage) {
  const filtered = stage === 'all' ? allDeals : allDeals.filter(d => d.stage === stage);
  const tbody = document.getElementById('deal-list-tbody');
  if (tbody) tbody.innerHTML = renderDealListRows(filtered);
}

async function deleteDeal(id, title) {
  if (!confirm(`Delete deal "${title}"?`)) return;
  try {
    await API.delete(`deals/index.php?id=${id}`);
    toast('Deal deleted', 'success');
    loadDeals();
  } catch(e) { toast(e.message, 'error'); }
}

function renderReportsView(el) {
  const thisMonth = new Date().toISOString().slice(0,7);
  const closed = allDeals.filter(d => d.stage === 'closed');
  const byAgent = {};
  closed.forEach(d => {
    const name = d.agent_name || 'Unassigned';
    (byAgent[name] = byAgent[name] || []).push(d);
  });

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div class="card-title">Reports Filter</div>
        <div class="flex-gap">
          <select class="form-select" style="width:160px" id="report-period" onchange="filterDealReport()">
            <option value="all">All Time</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
            <option value="last_year">Last Year</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="exportDealsToCSV()">Export CSV</button>
        </div>
      </div>
    </div>

    <!-- Agent Leaderboard -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title">Agent Leaderboard (Closed Deals)</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Agent</th><th>Deals Closed</th><th>Total Value</th><th>Commission Earned</th></tr></thead>
          <tbody>
            ${Object.keys(byAgent).sort((a,b) =>
              byAgent[b].reduce((s,d)=>s+parseFloat(d.value||0),0) -
              byAgent[a].reduce((s,d)=>s+parseFloat(d.value||0),0)
            ).map((agent, i) => {
              const deals = byAgent[agent];
              const total = deals.reduce((s,d)=>s+parseFloat(d.value||0),0);
              const comm  = deals.reduce((s,d)=>s+parseFloat(d.commission_amt||0),0);
              return `<tr>
                <td style="font-weight:700;color:var(--text-3)">${i+1}</td>
                <td class="td-name">${esc(agent)}</td>
                <td>${deals.length}</td>
                <td class="font-mono">${fmt(total)}</td>
                <td class="font-mono text-green">${fmt(comm)}</td>
              </tr>`;
            }).join('') || `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-3)">No closed deals yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <!-- All closed deals table -->
    <div class="card">
      <div class="card-header"><div class="card-title">Closed Deals</div></div>
      <div class="table-wrap" id="report-deals-table">
        <table>
          <thead><tr><th>Deal</th><th>Contact</th><th>Agent</th><th>Type</th><th>Value</th><th>Commission</th><th>Closed Date</th></tr></thead>
          <tbody>
            ${closed.map(d => `<tr>
              <td class="td-name">${esc(d.title)}</td>
              <td>${esc(d.contact_name||'—')}</td>
              <td>${esc(d.agent_name||'—')}</td>
              <td><span class="badge badge-gray">${d.stage}</span></td>
              <td class="font-mono">${fmt(d.value)}</td>
              <td class="font-mono text-green">${fmt(d.commission_amt)}</td>
              <td>${d.actual_close||'—'}</td>
            </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-3)">No closed deals</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function filterDealReport() {
  // Filter logic based on period
  const period = document.getElementById('report-period')?.value || 'all';
  const now = new Date();
  let filtered = allDeals.filter(d => d.stage === 'closed');

  if (period === 'this_month') {
    filtered = filtered.filter(d => d.actual_close?.startsWith(now.toISOString().slice(0,7)));
  } else if (period === 'last_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
    filtered = filtered.filter(d => d.actual_close?.startsWith(lastMonth));
  } else if (period === 'this_year') {
    filtered = filtered.filter(d => d.actual_close?.startsWith(now.getFullYear().toString()));
  } else if (period === 'last_year') {
    filtered = filtered.filter(d => d.actual_close?.startsWith((now.getFullYear()-1).toString()));
  }

  const tbody = document.querySelector('#report-deals-table tbody');
  if (tbody) tbody.innerHTML = filtered.map(d => `<tr>
    <td class="td-name">${esc(d.title)}</td>
    <td>${esc(d.contact_name||'—')}</td>
    <td>${esc(d.agent_name||'—')}</td>
    <td><span class="badge badge-gray">${d.stage}</span></td>
    <td class="font-mono">${fmt(d.value)}</td>
    <td class="font-mono text-green">${fmt(d.commission_amt)}</td>
    <td>${d.actual_close||'—'}</td>
  </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-3)">No deals found</td></tr>`;
}

function exportDealsToCSV() {
  const closed = allDeals.filter(d => d.stage === 'closed');
  const rows = [
    ['Deal Title','Contact','Agent','Value','Commission','Closed Date'],
    ...closed.map(d => [d.title, d.contact_name||'', d.agent_name||'', d.value||0, d.commission_amt||0, d.actual_close||''])
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'deals_report.csv';
  a.click();
  toast('CSV exported', 'success');
}



async function openDealModal(id = null) {
  editingDealId = id;
  // Ensure modal is in DOM
  if (!document.getElementById('modal-deal')) {
    const div = document.createElement('div');
    div.innerHTML = dealModalHTML();
    document.body.appendChild(div.firstElementChild);
  }
  document.getElementById('deal-modal-title').textContent = id ? 'Edit Deal' : 'New Deal';

  // Load contacts and listings for dropdowns
  try {
    const requests = [
      allContacts.length ? Promise.resolve({data: allContacts}) : API.get('contacts/index.php', { limit: 2000, status: 'active' }),
      allListings.length ? Promise.resolve({data: allListings}) : API.get('listings/index.php'),
      IS_AGENT ? Promise.resolve({data: []}) : API.get('users/index.php')
    ];
    const [contactsRes, listingsRes, usersRes] = await Promise.all(requests);
    const contactOpts = '<option value="">— None —</option>' +
      contactsRes.data.map(c => `<option value="${c.id}">${esc(c.name)}${c.phone?' · '+c.phone:''}</option>`).join('');
    const listingOpts = '<option value="">— None —</option>' +
      listingsRes.data.map(l => `<option value="${l.id}">${esc(l.ref)} — ${esc(l.title)}</option>`).join('');
    const agentOpts = '<option value="">— Unassigned —</option>' +
      usersRes.data.filter(u=>['agent','admin','super_admin'].includes(u.role))
        .map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
    document.getElementById('d-contact').innerHTML = contactOpts;
    document.getElementById('d-listing').innerHTML = listingOpts;
    document.getElementById('d-agent').innerHTML   = agentOpts;
  } catch(e) {}

  if (id) {
    try {
      const res = await API.get(`deals/index.php?id=${id}`);
      const d = res.data;
      document.getElementById('d-title').value    = d.title || '';
      document.getElementById('d-stage').value    = d.stage || 'lead';
      if(document.getElementById('d-value')) document.getElementById('d-value').value = d.value || '';
      if(document.getElementById('d-rent')) document.getElementById('d-rent').value = d.rental_value || '';
      if(document.getElementById('d-procurement')) document.getElementById('d-procurement').value = d.procurement_fee || '';
      if(document.getElementById('d-comm-amt')) document.getElementById('d-comm-amt').value = d.commission_amt || '';
      if(document.getElementById('d-admin-fee')) document.getElementById('d-admin-fee').value = d.admin_fee || '';
      if(document.getElementById('d-mgmt-pct')) document.getElementById('d-mgmt-pct').value = d.management_pct || '';
      if(document.getElementById('d-mgmt-amt')) document.getElementById('d-mgmt-amt').value = d.management_amt || '';
      if(document.getElementById('d-type')) { document.getElementById('d-type').value = d.deal_type || 'Lease'; toggleDealType(d.deal_type || 'Lease'); }
      if(document.getElementById('d-contact-search') && d.contact_name) document.getElementById('d-contact-search').value = d.contact_name;
      document.getElementById('d-comm').value     = d.commission_pct || '';
      document.getElementById('d-close').value    = d.expected_close || '';
      document.getElementById('d-notes').value    = d.notes || '';
      document.getElementById('d-lost').value     = d.lost_reason || '';
      document.getElementById('d-contact').value  = d.contact_id || '';
      document.getElementById('d-listing').value  = d.listing_id || '';
      document.getElementById('d-agent').value    = d.assigned_to || '';
      document.getElementById('d-lost-row').style.display = d.stage === 'withdrawn' ? '' : 'none';
    } catch(e) { toast('Failed to load deal', 'error'); return; }
  } else {
    document.getElementById('deal-form').reset();
    document.getElementById('d-lost-row').style.display = 'none';
  }
  openModal('modal-deal');
}

async function saveDeal() {
  const dealType = document.getElementById('d-type')?.value || 'Lease';
  const rent     = parseFloat(document.getElementById('d-rent')?.value) || 0;
  const saleVal  = parseFloat(document.getElementById('d-value')?.value) || 0;
  const commAmt  = parseFloat(document.getElementById('d-comm-amt')?.value) ||
                   parseFloat(document.getElementById('d-sale-comm-amt')?.value) || 0;
  const data = {
    title:           document.getElementById('d-title')?.value?.trim(),
    stage:           document.getElementById('d-stage')?.value,
    deal_type:       dealType,
    value:           dealType === 'Sale' ? saleVal : rent,
    commission_pct:  parseFloat(document.getElementById('d-comm')?.value) || 0,
    commission_amt:  commAmt,
    probability:     0,
    expected_close:  document.getElementById('d-close')?.value || null,
    notes:           document.getElementById('d-notes')?.value || '',
    lost_reason:     document.getElementById('d-lost')?.value || '',
    contact_id:      document.getElementById('d-contact')?.value || null,
    listing_id:      document.getElementById('d-listing')?.value || null,
    assigned_to:     document.getElementById('d-agent')?.value || null,
    rental_value:    rent,
    procurement_fee: parseFloat(document.getElementById('d-procurement')?.value) || 0,
    admin_fee:       parseFloat(document.getElementById('d-admin-fee')?.value) || 0,
    management_pct:  parseFloat(document.getElementById('d-mgmt-pct')?.value) || 0,
    management_amt:  parseFloat(document.getElementById('d-mgmt-amt')?.value) || 0,
  };
  if (!data.title) { toast('Deal title is required', 'error'); return; }
  try {
    if (editingDealId) {
      await API.put(`deals/index.php?id=${editingDealId}`, data);
      toast('Deal updated', 'success');
    } else {
      await API.post('deals/index.php', data);
      toast('Deal created', 'success');
    }
    closeModal('modal-deal');
    loadDeals();
  } catch(e) { toast(e.message, 'error'); }
}

function dealModalHTML() {
  return `
  <div class="modal-overlay" id="modal-deal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="deal-modal-title">New Deal</div>
        <button class="modal-close" onclick="closeModal('modal-deal')">✕</button>
      </div>
      <div class="modal-body">
        <form id="deal-form">
          <div class="form-group"><label class="form-label">Deal Title *</label><input class="form-input" id="d-title" placeholder="e.g. 3 Bed House — Sandton"></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Stage</label>
              <select class="form-select" id="d-stage" onchange="document.getElementById('d-lost-row').style.display=this.value==='lost'?'':'none'">
                <option value="lead">Lead</option><option value="qualified">Qualified</option>
                <option value="pending">Pending</option><option value="closed">Closed</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">Deal Value (R)</label><input class="form-input" type="number" id="d-value" placeholder="0.00"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Commission %</label><input class="form-input" type="number" id="d-comm" placeholder="e.g. 7.5"></div>
            <div class="form-group"><label class="form-label">Probability %</label><input class="form-input" type="number" id="d-prob" placeholder="0–100"></div>
          </div>
          <div class="form-group"><label class="form-label">Expected Close Date</label><input class="form-input" type="date" id="d-close"></div>
          <div class="form-group" id="d-lost-row" style="display:none"><label class="form-label">Withdrawn Reason</label><input class="form-input" id="d-lost" placeholder="Why was this deal withdrawn?"></div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:12px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)">Links</div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Contact / Client</label>
              <select class="form-select" id="d-contact"><option value="">Loading…</option></select></div>
            <div class="form-group"><label class="form-label">Listing / Property</label>
              <select class="form-select" id="d-listing"><option value="">Loading…</option></select></div>
          </div>
          <div class="form-group"><label class="form-label">Assigned Agent</label>
            <select class="form-select" id="d-agent"><option value="">— Unassigned —</option></select></div>
          <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="d-notes" placeholder="Notes about this deal…"></textarea></div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-deal')">Cancel</button>
        <button class="btn btn-primary" onclick="saveDeal()">Save Deal</button>
      </div>
    </div>
  </div>`;
}

// ── LEASES ───────────────────────────────────────────────────
let editingLeaseId = null;

async function loadLeases() {
  const params = {};
  if (IS_AGENT) params.assigned_to = APP_USER?.id;
  const res = await API.get('leases/index.php', params);
  allLeases = res.data;
  renderLeasesPage(allLeases);
}

let allLeases = [];
let leaseStatusFilter = '';

function renderLeasesPage(leases) {
  const fmt = n => 'R ' + Number(n||0).toLocaleString('en-ZA', {minimumFractionDigits:2});
  const today = new Date();
  const in60  = new Date(); in60.setDate(today.getDate() + 60);
  const expiring = leases.filter(l => { const e = new Date(l.end_date); return l.status==='active' && e>=today && e<=in60; });
  const active   = leases.filter(l => l.status==='active');
  const rentRoll = active.reduce((s,l) => s+parseFloat(l.monthly_rent||0), 0);
  const expired  = leases.filter(l => l.status==='expired').length;

  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Leases</div>
      <div class="topbar-actions">
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="setLeaseFilter('')">All</button>
          <button class="btn btn-ghost btn-sm" onclick="setLeaseFilter('active')">Active</button>
          <button class="btn btn-ghost btn-sm" onclick="setLeaseFilter('expired')">Expired</button>
          <button class="btn btn-ghost btn-sm" onclick="setLeaseFilter('expiring')">Expiring Soon ${expiring.length?`<span style="background:var(--red);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:2px">${expiring.length}</span>`:''}</button>
        </div>
        <div class="search-wrap" style="width:180px">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input class="form-input" placeholder="Search tenant, property…" oninput="filterLeases(this.value)">
        </div>
        <button class="btn btn-ghost btn-sm" onclick="exportLeases()">↓ Export</button>
        <button class="btn btn-primary btn-sm" onclick="openLeaseModal()">+ New Lease</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi-card"><div class="kpi-label">Active Leases</div><div class="kpi-value">${active.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Monthly Rent Roll</div><div class="kpi-value" style="font-size:18px">${fmt(rentRoll)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Expiring Soon</div><div class="kpi-value" style="color:${expiring.length?'var(--amber)':'inherit'}">${expiring.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Expired</div><div class="kpi-value">${expired}</div></div>
    </div>
    ${expiring.length ? `<div class="card" style="border-color:var(--amber-border);background:var(--amber-light);margin-bottom:16px">
      <div class="card-header"><div class="card-title" style="color:var(--amber)">⚠️ Expiring in 60 Days</div></div>
      <div class="table-wrap"><table><thead><tr><th>Ref</th><th>Tenant</th><th>Property</th><th>End Date</th><th>Rent</th><th></th></tr></thead>
      <tbody>${expiring.map(l=>`<tr><td class="font-mono">${l.ref}</td><td>${esc(l.tenant_name)}</td><td>${esc(l.property||'—')}</td><td><span class="badge badge-amber">${l.end_date}</span></td><td class="font-mono">${fmt(l.monthly_rent)}</td><td><button class="btn btn-sm btn-ghost" onclick="viewLease(${l.id})">View</button></td></tr>`).join('')}</tbody>
      </table></div></div>` : ''}
    ${isMobile() ? `
    <div>${renderLeaseCards(leases)}</div>` : `
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ref</th><th>Tenant</th><th>Landlord</th><th>Property</th><th>Start</th><th>End</th><th>Monthly Rent</th><th>Deposit</th><th>Escalation</th><th>Status</th><th></th></tr></thead>
          <tbody id="leases-tbody">${renderLeaseRows(leases)}</tbody>
        </table>
      </div>
    </div>`}
    ${leaseModalHTML()}`;
}

function renderLeaseRows(leases) {
  const fmt = n => n ? 'R ' + Number(n).toLocaleString('en-ZA', {minimumFractionDigits:2}) : '—';
  if (!leases.length) return `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-3)">No leases found</td></tr>`;
  return leases.map(l => `<tr>
    <td class="font-mono" style="cursor:pointer;color:var(--blue)" onclick="viewLease(${l.id})">${esc(l.ref)}</td>
    <td class="td-name">${esc(l.tenant_name)}</td>
    <td style="font-size:12px;color:var(--text-2)">${esc(l.landlord_name||'—')}</td>
    <td>${esc(l.property||'—')} ${l.unit?'· Unit '+l.unit:''}</td>
    <td style="font-size:12px">${l.start_date||'—'}</td>
    <td style="font-size:12px">${l.end_date||'—'}</td>
    <td class="font-mono">${fmt(l.monthly_rent)}</td>
    <td class="font-mono">${fmt(l.deposit)}</td>
    <td style="font-size:12px">${l.escalation_pct ? l.escalation_pct+'%' : '—'}</td>
    <td><span class="badge ${STATUS_BADGE[l.status]||'badge-gray'}">${l.status}</span></td>
    <td><div class="flex-gap">
      <button class="btn btn-sm btn-ghost" onclick="viewLease(${l.id})">View</button>
      <button class="btn btn-sm btn-ghost" onclick="openLeaseModal(${l.id})">Edit</button>
    </div></td>
  </tr>`).join('');
}

function setLeaseFilter(status) {
  leaseStatusFilter = status;
  let filtered = allLeases;
  if (status === 'expiring') {
    const today = new Date(); const in60 = new Date(); in60.setDate(today.getDate()+60);
    filtered = allLeases.filter(l => { const e = new Date(l.end_date); return l.status==='active' && e>=today && e<=in60; });
  } else if (status) {
    filtered = allLeases.filter(l => l.status === status);
  }
  const tbody = document.getElementById('leases-tbody');
  if (tbody) tbody.innerHTML = renderLeaseRows(filtered);
}

function filterLeases(q) {
  const filtered = allLeases.filter(l =>
    (l.tenant_name||'').toLowerCase().includes(q.toLowerCase()) ||
    (l.property||'').toLowerCase().includes(q.toLowerCase()) ||
    (l.ref||'').toLowerCase().includes(q.toLowerCase())
  );
  const tbody = document.getElementById('leases-tbody');
  if (tbody) tbody.innerHTML = renderLeaseRows(filtered);
}

async function viewLease(id) {
  try {
    const res = await API.get(`leases/index.php?id=${id}`);
    renderLeaseDetail(res.data);
  } catch(e) { toast('Failed to load lease', 'error'); }
}

function renderLeaseDetail(l) {
  const fmt = n => n ? 'R ' + Number(n).toLocaleString('en-ZA', {minimumFractionDigits:2}) : 'R 0,00';
  const repairs  = l.repairs  || [];
  const invoices = l.invoices || [];
  repairLeaseId  = l.id;

  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-actions"><button class="btn btn-ghost btn-sm" onclick="loadLeases()">← Back</button></div>
      <div class="topbar-actions">
        <button class="btn btn-ghost btn-sm" onclick="openLeaseModal(${l.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="window.open('/crm/api/statements/index.php?lease_id=${l.id}&type=landlord','_blank')">Landlord Statement</button>
        <button class="btn btn-ghost btn-sm" onclick="window.open('/crm/api/statements/index.php?lease_id=${l.id}&type=debtor','_blank')">Debtors Statement</button>
        <button class="btn btn-primary btn-sm" onclick="openNewInvoiceForLease(${l.id})">+ Invoice</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:280px 1fr;gap:20px;align-items:start">
      <div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div><div class="card-title">${esc(l.ref)}</div><div style="font-size:12px;color:var(--text-3)">${esc(l.property||'')} ${l.unit?'· Unit '+l.unit:''}</div></div>
            <span class="badge ${STATUS_BADGE[l.status]||'badge-gray'}">${l.status}</span>
          </div>
          <div style="border-top:1px solid var(--border)">
            ${ldr('Tenant', esc(l.tenant_name))}
            ${ldr('Landlord', esc(l.landlord_name||'—'))}
            ${ldr('Start', l.start_date||'—')}
            ${ldr('End', l.end_date||'—')}
            ${ldr('Monthly Rent', fmt(l.monthly_rent))}
            ${ldr('Deposit', fmt(l.deposit))}
            ${ldr('Escalation', l.escalation_pct ? l.escalation_pct+'%' : '—')}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Lease Document</div></div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:8px">
              ${(l.documents||[]).map(d=>`
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px;background:var(--bg);border-radius:6px;border:1px solid var(--border);gap:8px">
                  <div style="font-size:12px;min-width:0;flex:1">
                    <div style="font-weight:500;color:var(--text-3);font-size:11px;text-transform:uppercase">${esc(d.doc_type)}</div>
                    <a href="${esc(d.file_url)}" target="_blank" title="${esc(d.file_name)}"
                       style="color:var(--blue);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:180px">
                      📄 ${esc(d.file_name)}
                    </a>
                  </div>
                  <button onclick="deleteLeaseDoc(${d.id},${l.id})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;flex-shrink:0" title="Delete document">✕</button>
                </div>`).join('') || '<div style="font-size:13px;color:var(--text-3)">No documents uploaded</div>'}
            </div>
            <div style="margin-top:12px">
              <select class="form-select" id="lease-doc-type" style="margin-bottom:8px">
                <option value="Lease Agreement">Lease Agreement</option>
                <option value="Mandate">Mandate</option>
                <option value="Offer to Purchase">Offer to Purchase</option>
                <option value="ID Copy">ID Copy</option>
                <option value="Proof of Income">Proof of Income</option>
                <option value="Other">Other</option>
              </select>
              <input type="file" id="lease-doc-input" style="display:none" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onchange="uploadLeaseDoc(this,${l.id})">
              <button class="btn btn-ghost btn-sm" style="width:100%" onclick="document.getElementById('lease-doc-input').click()">+ Upload Document</button>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="tabs">
          <div class="tab active" onclick="switchLeaseTab('repairs',this)">Repairs (${repairs.length})</div>
          <div class="tab" onclick="switchLeaseTab('invoices',this)">Invoices (${invoices.length})</div>
          <div class="tab" onclick="switchLeaseTab('notes',this)">Notes</div>
        </div>
        <div class="tab-panel active" id="lease-tab-repairs" style="padding:16px">
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
            <button class="btn btn-primary btn-sm" onclick="openRepairModal(${l.id})">+ Log Repair</button>
          </div>
          ${repairs.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Description</th><th>Cost</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>${repairs.map(r=>`<tr>
              <td>${esc(r.description)}</td><td class="font-mono">${fmt(r.cost)}</td><td>${r.repair_date||'—'}</td>
              <td><span class="badge ${r.status==='completed'?'badge-green':r.status==='in_progress'?'badge-amber':'badge-gray'}">${r.status}</span></td>
              <td><button class="btn btn-sm btn-ghost" onclick="updateRepairStatus(${r.id},'completed')">✓ Done</button></td>
            </tr>`).join('')}</tbody></table></div>` :
            '<div class="empty" style="padding:32px"><div class="empty-text">No repairs logged</div></div>'}
        </div>
        <div class="tab-panel" id="lease-tab-invoices" style="padding:16px">
          ${invoices.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Ref</th><th>Due Date</th><th>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>${invoices.map(i=>`<tr>
              <td class="font-mono">${i.ref}</td><td>${i.due_date}</td><td class="font-mono">${fmt(i.total)}</td>
              <td><span class="badge ${INVOICE_BADGE[i.status]||'badge-gray'}">${i.status}</span></td>
              <td>${i.status!=='paid'?`<button class="btn btn-sm btn-success" onclick="markInvoicePaid(${i.id})">Mark Paid</button>`:''}</td>
            </tr>`).join('')}</tbody></table></div>` :
            '<div class="empty" style="padding:32px"><div class="empty-text">No invoices</div></div>'}
        </div>
        <div class="tab-panel" id="lease-tab-notes" style="padding:16px">
          <div style="font-size:13px;color:var(--text-2);white-space:pre-wrap;margin-bottom:12px">${esc(l.notes||'No notes yet')}</div>
          <textarea class="form-textarea" id="lease-note-input" placeholder="Add a note…" style="width:100%;margin-bottom:8px"></textarea>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-primary btn-sm" onclick="saveLeaseNote(${l.id})">Save Note</button>
          </div>
        </div>
      </div>
    </div>
    ${leaseModalHTML()}
    <div class="modal-overlay" id="modal-repair">
      <div class="modal" style="max-width:440px">
        <div class="modal-header"><div class="modal-title">Log Repair</div><button class="modal-close" onclick="closeModal('modal-repair')">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Description *</label><input class="form-input" id="r-desc" placeholder="e.g. Geyser replacement"></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Cost (R)</label><input class="form-input" type="number" id="r-cost" placeholder="0"></div>
            <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="r-date"></div>
          </div>
          <div class="form-group"><label class="form-label">Status</label>
            <select class="form-select" id="r-status">
              <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
            </select></div>
          <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="r-notes"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-repair')">Cancel</button>
          <button class="btn btn-primary" onclick="saveRepair()">Save Repair</button>
        </div>
      </div>
    </div>`;
}

function ldr(label, value) {
  return `<div style="display:flex;justify-content:space-between;padding:9px 16px;border-bottom:1px solid var(--border);font-size:13px">
    <span style="color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:.06em">${label}</span>
    <span style="font-weight:500">${value}</span></div>`;
}

function switchLeaseTab(name, el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('lease-tab-'+name)?.classList.add('active');
}

let repairLeaseId = null;
function openRepairModal(leaseId) {
  repairLeaseId = leaseId;
  document.getElementById('r-desc').value  = '';
  document.getElementById('r-cost').value  = '';
  document.getElementById('r-date').value  = new Date().toISOString().split('T')[0];
  document.getElementById('r-notes').value = '';
  document.getElementById('r-status').value = 'pending';
  openModal('modal-repair');
}

async function saveRepair() {
  const desc = document.getElementById('r-desc')?.value?.trim();
  if (!desc) { toast('Description is required', 'error'); return; }
  try {
    await API.post('repairs/index.php', {
      lease_id: repairLeaseId,
      description: desc,
      cost: parseFloat(document.getElementById('r-cost').value) || 0,
      repair_date: document.getElementById('r-date').value,
      status: document.getElementById('r-status').value,
      notes: document.getElementById('r-notes').value,
    });
    toast('Repair logged', 'success');
    closeModal('modal-repair');
    viewLease(repairLeaseId);
  } catch(e) { toast(e.message, 'error'); }
}

async function updateRepairStatus(id, status) {
  try {
    await API.put(`repairs/index.php?id=${id}`, { status });
    toast('Repair updated', 'success');
    if (repairLeaseId) viewLease(repairLeaseId);
  } catch(e) { toast(e.message, 'error'); }
}

async function saveLeaseNote(leaseId) {
  const note = document.getElementById('lease-note-input')?.value?.trim();
  if (!note) return;
  try {
    await API.put(`leases/index.php?id=${leaseId}`, { notes: note });
    toast('Note saved', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function uploadLeaseDoc(input, leaseId) {
  const file = input.files[0]; if (!file) return;
  const docType = document.getElementById('lease-doc-type')?.value || 'Lease Agreement';
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'lease_doc');
    formData.append('doc_type', docType);
    formData.append('entity_id', leaseId);
    const res  = await fetch('/crm/api/files/upload.php', { method:'POST', credentials:'same-origin', body:formData });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    toast('Document uploaded', 'success');
    viewLease(leaseId);
  } catch(e) { toast(e.message, 'error'); }
  finally { input.value = ''; }
}

async function openLeaseModal(id = null) {
  editingLeaseId = id;
  if (!document.getElementById('modal-lease')) {
    const div = document.createElement('div');
    div.innerHTML = leaseModalHTML();
    document.body.appendChild(div.firstElementChild);
  }
  document.getElementById('lease-modal-title').textContent = id ? 'Edit Lease' : 'New Lease';
  if (id) {
    try {
      const res = await API.get(`leases/index.php?id=${id}`);
      const l = res.data;
      document.getElementById('l-tenant').value    = l.tenant_name || '';
      document.getElementById('l-landlord').value  = l.landlord_name || '';
      document.getElementById('l-property').value  = l.property || '';
      document.getElementById('l-unit').value      = l.unit || '';
      document.getElementById('l-start').value     = l.start_date || '';
      document.getElementById('l-end').value       = l.end_date || '';
      document.getElementById('l-rent').value      = l.monthly_rent || '';
      document.getElementById('l-deposit').value   = l.deposit || '';
      document.getElementById('l-escal').value     = l.escalation_pct || '';
      document.getElementById('l-status').value    = l.status || 'active';
      document.getElementById('l-notes').value     = l.notes || '';
    } catch(e) { toast('Failed to load lease', 'error'); return; }
  } else {
    document.getElementById('lease-form').reset();
    // Default dates
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date(new Date().setFullYear(new Date().getFullYear()+1)).toISOString().split('T')[0];
    document.getElementById('l-start').value = today;
    document.getElementById('l-end').value   = nextYear;
  }
  openModal('modal-lease');
}

async function saveLease() {
  const data = {
    tenant_name:    document.getElementById('l-tenant').value.trim(),
    landlord_name:  document.getElementById('l-landlord').value.trim(),
    property:       document.getElementById('l-property').value.trim(),
    unit:           document.getElementById('l-unit').value,
    start_date:     document.getElementById('l-start').value,
    end_date:       document.getElementById('l-end').value,
    monthly_rent:   parseFloat(document.getElementById('l-rent').value) || 0,
    deposit:        parseFloat(document.getElementById('l-deposit').value) || 0,
    escalation_pct: parseFloat(document.getElementById('l-escal').value) || 0,
    status:         document.getElementById('l-status').value,
    notes:          document.getElementById('l-notes').value,
  };
  if (!data.tenant_name || !data.start_date || !data.end_date || !data.monthly_rent) {
    toast('Tenant name, dates and monthly rent are required', 'error'); return;
  }
  try {
    if (editingLeaseId) {
      await API.put(`leases/index.php?id=${editingLeaseId}`, data);
      toast('Lease updated', 'success');
    } else {
      await API.post('leases/index.php', data);
      toast('Lease created', 'success');
    }
    closeModal('modal-lease');
    loadLeases();
  } catch(e) { toast(e.message, 'error'); }
}

function filterLeasesByStatus(status) { loadLeases(); }

function leaseModalHTML() {
  return `
  <div class="modal-overlay" id="modal-lease">
    <div class="modal" style="max-width:680px">
      <div class="modal-header">
        <div class="modal-title" id="lease-modal-title">New Lease</div>
        <button class="modal-close" onclick="closeModal('modal-lease')">✕</button>
      </div>
      <div class="modal-body">
        <form id="lease-form">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Parties</div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Tenant Name *</label><input class="form-input" id="l-tenant" placeholder="Renting tenant's name"></div>
            <div class="form-group"><label class="form-label">Landlord Name</label><input class="form-input" id="l-landlord" placeholder="Property owner's name"></div>
          </div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Property</div>
          <div class="form-group"><label class="form-label">Property Address *</label><input class="form-input" id="l-property" placeholder="Full property address"></div>
          <div class="form-group"><label class="form-label">Unit / Flat Number</label><input class="form-input" id="l-unit" placeholder="Unit number if applicable"></div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Lease Terms</div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Start Date *</label><input class="form-input" type="date" id="l-start"></div>
            <div class="form-group"><label class="form-label">End Date *</label><input class="form-input" type="date" id="l-end"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Monthly Rent (R) *</label><input class="form-input" type="number" id="l-rent" placeholder="0.00"></div>
            <div class="form-group"><label class="form-label">Deposit (R)</label><input class="form-input" type="number" id="l-deposit" placeholder="0.00"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Escalation %</label><input class="form-input" type="number" id="l-escal" placeholder="e.g. 8"></div>
            <div class="form-group"><label class="form-label">Status</label>
              <select class="form-select" id="l-status">
                <option value="active">Active</option><option value="pending">Pending</option>
                <option value="expired">Expired</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="l-notes" placeholder="Any additional lease notes…"></textarea></div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-lease')">Cancel</button>
        <button class="btn btn-primary" onclick="saveLease()">Save Lease</button>
      </div>
    </div>
  </div>`;
}

// ── INVOICES ─────────────────────────────────────────────────
let invoiceLines = [];


// ── INVOICES (FULL) ──────────────────────────────────────────
let invoiceSection  = 'invoices';
let invoiceMode     = 'one-time';
let invoiceFilter   = 'all';
let allInvoices     = [];
let allProducts     = [];
let allInvCustomers = [];

async function loadInvoices() {
  // Auto-mark overdue
  const res = await API.get('invoices/index.php');
  allInvoices = res.data;
  renderInvoicesPage();
}

function renderInvoicesPage() {
  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Invoices & Billing</div>
      <div class="topbar-actions" id="invoice-topbar-actions">
        <div style="display:flex;gap:4px" id="invoice-status-filter">
          <button class="btn btn-ghost btn-sm ${invoiceFilter==='all'?'active-filter':''}" onclick="setInvoiceFilter('all')">All</button>
          <button class="btn btn-ghost btn-sm ${invoiceFilter==='unpaid'?'active-filter':''}" onclick="setInvoiceFilter('unpaid')">Unpaid</button>
          <button class="btn btn-ghost btn-sm ${invoiceFilter==='overdue'?'active-filter':''}" onclick="setInvoiceFilter('overdue')">Overdue</button>
          <button class="btn btn-ghost btn-sm ${invoiceFilter==='paid'?'active-filter':''}" onclick="setInvoiceFilter('paid')">Paid</button>
        </div>
        <div class="search-wrap" style="width:160px">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input class="form-input" placeholder="Search…" oninput="filterInvoiceSearch(this.value)">
        </div>
        <button class="btn btn-ghost btn-sm" onclick="exportInvoicesToExcel()">Export CSV</button>
        <button class="btn btn-ghost btn-sm" onclick="viewInvoiceStatement()">Statement</button>
        <button class="btn btn-primary btn-sm" onclick="openNewInvoice()">+ New Invoice</button>
      </div>
    </div>

    <!-- Sub-navigation -->
    <div style="display:flex;border-bottom:2px solid var(--border);background:var(--surface);padding:0 0 0 4px;margin-bottom:16px;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
      <button class="inv-subnav" onclick="switchInvoiceSection('invoices',this)" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:${invoiceSection==='invoices'?'600':'500'};color:${invoiceSection==='invoices'?'var(--accent)':'var(--text-2)'};border-bottom:2px solid ${invoiceSection==='invoices'?'var(--accent)':'transparent'};margin-bottom:-2px">One-Time</button>
      <button class="inv-subnav" onclick="switchInvoiceSection('automated',this)" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:${invoiceSection==='automated'?'600':'500'};color:${invoiceSection==='automated'?'var(--accent)':'var(--text-2)'};border-bottom:2px solid ${invoiceSection==='automated'?'var(--accent)':'transparent'};margin-bottom:-2px">Monthly</button>
      <button class="inv-subnav" onclick="switchInvoiceSection('products',this)" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:${invoiceSection==='products'?'600':'500'};color:${invoiceSection==='products'?'var(--accent)':'var(--text-2)'};border-bottom:2px solid ${invoiceSection==='products'?'var(--accent)':'transparent'};margin-bottom:-2px">Products</button>
      <button class="inv-subnav" onclick="switchInvoiceSection('customers',this)" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:${invoiceSection==='customers'?'600':'500'};color:${invoiceSection==='customers'?'var(--accent)':'var(--text-2)'};border-bottom:2px solid ${invoiceSection==='customers'?'var(--accent)':'transparent'};margin-bottom:-2px">Customers</button>
      <button class="inv-subnav" onclick="switchInvoiceSection('bank',this)" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:${invoiceSection==='bank'?'600':'500'};color:${invoiceSection==='bank'?'var(--accent)':'var(--text-2)'};border-bottom:2px solid ${invoiceSection==='bank'?'var(--accent)':'transparent'};margin-bottom:-2px">Bank Accounts</button>
      <button class="inv-subnav" onclick="switchInvoiceSection('reports',this)" style="padding:10px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:${invoiceSection==='reports'?'600':'500'};color:${invoiceSection==='reports'?'var(--accent)':'var(--text-2)'};border-bottom:2px solid ${invoiceSection==='reports'?'var(--accent)':'transparent'};margin-bottom:-2px">Reports</button>
    </div>

    <div id="inv-section-content">
      <!-- loaded by switchInvoiceSection -->
    </div>

    ${invoiceModalHTML()}
  `;

  // Load default section
  renderInvoiceSection(invoiceSection);
}

function switchInvoiceSection(section, el) {
  invoiceSection = section;
  // Update nav styles
  document.querySelectorAll('.inv-subnav').forEach(b => {
    const active = b === el;
    b.style.fontWeight   = active ? '600' : '500';
    b.style.color        = active ? 'var(--accent)' : 'var(--text-2)';
    b.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
  });
  renderInvoiceSection(section);
}

function renderInvoiceSection(section) {
  const el = document.getElementById('inv-section-content');
  if (!el) return;

  switch(section) {
    case 'invoices':   renderInvoicesSection(el); break;
    case 'automated':  loadSchedules(el); break;
    case 'reports':    renderInvoiceReports(el); break;
    case 'products':   renderProductsSection(el); break;
    case 'customers':  renderCustomersSection(el); break;
    case 'bank':       renderBankSection(el); break;
  }
}

function setInvoiceFilter(f) {
  invoiceFilter = f;
  renderInvoiceSection('invoices');
}

function filterInvoiceSearch(q) {
  const filtered = allInvoices.filter(i =>
    (i.ref||'').toLowerCase().includes(q.toLowerCase()) ||
    (i.tenant_name||'').toLowerCase().includes(q.toLowerCase())
  );
  renderInvoicesTable(filtered);
}

// ── INVOICES SECTION ─────────────────────────────────────────
function renderInvoicesSection(el) {
  const filtered = invoiceFilter === 'all'
    ? allInvoices
    : allInvoices.filter(i => i.status === invoiceFilter);

  // KPI cards
  const total    = allInvoices.reduce((s,i) => s + parseFloat(i.total||0), 0);
  const unpaid   = allInvoices.filter(i=>i.status==='unpaid').reduce((s,i)=>s+parseFloat(i.total||0),0);
  const overdue  = allInvoices.filter(i=>i.status==='overdue').reduce((s,i)=>s+parseFloat(i.total||0),0);
  const paid     = allInvoices.filter(i=>i.status==='paid').reduce((s,i)=>s+parseFloat(i.total||0),0);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi-card"><div class="kpi-label">Total Invoiced</div><div class="kpi-value" style="font-size:18px">${fmt(total)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Unpaid</div><div class="kpi-value" style="font-size:18px;color:var(--amber)">${fmt(unpaid)}</div></div>
      <div class="kpi-card" style="${overdue>0?'border-color:var(--red-border);background:var(--red-light)':''}"><div class="kpi-label">Overdue</div><div class="kpi-value" style="font-size:18px;color:var(--red)">${fmt(overdue)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Paid</div><div class="kpi-value" style="font-size:18px;color:var(--green)">${fmt(paid)}</div></div>
    </div>
    <div class="card" id="invoices-table-card">
      <div class="table-wrap" id="invoices-table-wrap">
        ${renderInvoicesTableHTML(filtered)}
      </div>
    </div>`;
}

function renderInvoicesTableHTML(invoices) {
  if (!invoices.length) return `<div class="empty" style="padding:40px"><div class="empty-text">No invoices found</div></div>`;
  return `<table>
    <thead><tr>
      <th>Ref</th><th>Tenant</th><th>Type</th><th>Amount</th>
      <th>Due Date</th><th>Paid Date</th><th>Status</th><th>Notes</th><th></th>
    </tr></thead>
    <tbody>${invoices.map(i => `
    <tr>
      <td class="font-mono" style="cursor:pointer;color:var(--blue)" onclick="viewInvoiceDetail(${i.id})">${esc(i.ref)}</td>
      <td class="td-name">${esc(i.tenant_name||'—')}</td>
      <td style="font-size:12px;color:var(--text-2)">${esc(i.invoice_type||'Monthly Rental')}</td>
      <td class="font-mono" style="font-weight:600">${fmt(i.total)}</td>
      <td style="font-size:12px">${i.due_date||'—'}</td>
      <td style="font-size:12px;color:${i.paid_date?'var(--green)':'var(--text-3)'}">${i.paid_date||'—'}</td>
      <td><span class="badge ${INVOICE_BADGE[i.status]||'badge-gray'}">${i.status}</span></td>
      <td style="font-size:12px;color:var(--text-3);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.notes||'')}</td>
      <td><div class="flex-gap" style="gap:3px">
        <div style="display:flex;gap:3px;align-items:center">
          ${i.status!=='paid'?`<button class="btn btn-sm btn-ghost" style="border-color:var(--green);color:var(--green)" onclick="markInvoicePaid(${i.id})">Mark Paid</button>`:'<span class="badge badge-green">✓ Paid</span>'}
          <button class="btn btn-sm btn-ghost" onclick="viewInvoiceDetail(${i.id})">View</button>
          <select class="form-select" style="width:80px;font-size:11px;padding:3px 4px" onchange="handleInvoiceAction(${i.id},'${esc(i.tenant_name||'')}',this.value);this.value=''">
            <option value="">More…</option>
            <option value="edit">Edit</option>
            <option value="pdf">Download PDF</option>
            <option value="email">Send Email</option>
            <option value="statement">Statement</option>
            <option value="delete">Delete</option>
          </select>
        </div>
      </div></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function renderInvoicesTable(invoices) {
  const wrap = document.getElementById('invoices-table-wrap');
  if (wrap) wrap.innerHTML = renderInvoicesTableHTML(invoices);
}

async function printInvoice(id) {
  try {
    const url = `/crm/api/invoices/pdf.php?id=${id}`;
    window.open(url, '_blank');
  } catch(e) { toast(e.message, 'error'); }
}

// ── PRODUCTS SECTION ─────────────────────────────────────────
async function renderProductsSection(el) {
  try {
    const res = await API.get('products/index.php');
    allProducts = res.data;
  } catch(e) { allProducts = []; }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="search-wrap" style="width:200px">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input class="form-input" placeholder="Search products…" oninput="filterProducts(this.value)">
      </div>
      <button class="btn btn-primary btn-sm" onclick="openProductModal()">+ Add Product</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Product Name</th><th>Description</th><th>Price (R)</th><th>Status</th><th></th></tr></thead>
          <tbody id="products-tbody">
            ${renderProductRows(allProducts)}
          </tbody>
        </table>
      </div>
    </div>
    ${productModalHTML()}`;
}

function renderProductRows(products) {
  if (!products.length) return `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-3)">No products yet</td></tr>`;
  return products.map(p => `
  <tr>
    <td class="td-name">${esc(p.name)}</td>
    <td style="font-size:12px;color:var(--text-2)">${esc(p.description||'—')}</td>
    <td class="font-mono">${p.price ? fmt(p.price) : '—'}</td>
    <td><span class="badge ${p.is_active?'badge-green':'badge-gray'}">${p.is_active?'Active':'Inactive'}</span></td>
    <td><div class="flex-gap">
      <button class="btn btn-sm btn-ghost" onclick="openProductModal(${p.id})">Edit</button>
      <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">Delete</button>
    </div></td>
  </tr>`).join('');
}

function filterProducts(q) {
  const filtered = allProducts.filter(p =>
    (p.name||'').toLowerCase().includes(q.toLowerCase())
  );
  document.getElementById('products-tbody').innerHTML = renderProductRows(filtered);
}

let editingProductId = null;
async function openProductModal(id = null) {
  editingProductId = id;
  if (!document.getElementById('modal-product')) {
    const div = document.createElement('div');
    div.innerHTML = productModalHTML();
    document.body.appendChild(div.firstElementChild);
  }
  document.getElementById('product-modal-title').textContent = id ? 'Edit Product' : 'Add Product';
  if (id) {
    const p = allProducts.find(p => p.id === id);
    if (p) {
      document.getElementById('p-name').value  = p.name || '';
      document.getElementById('p-desc').value  = p.description || '';
      document.getElementById('p-price').value = p.price || '';
      document.getElementById('p-active').checked = !!p.is_active;
    }
  } else {
    document.getElementById('product-form').reset();
    document.getElementById('p-active').checked = true;
  }
  openModal('modal-product');
}

async function saveProduct() {
  const data = {
    name:        document.getElementById('p-name').value.trim(),
    description: document.getElementById('p-desc').value,
    price:       parseFloat(document.getElementById('p-price').value) || 0,
    is_active:   document.getElementById('p-active').checked ? 1 : 0,
  };
  if (!data.name) { toast('Product name is required', 'error'); return; }
  try {
    if (editingProductId) {
      await API.put(`products/index.php?id=${editingProductId}`, data);
      toast('Product updated', 'success');
    } else {
      await API.post('products/index.php', data);
      toast('Product created', 'success');
    }
    closeModal('modal-product');
    renderProductsSection(document.getElementById('inv-section-content'));
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await API.delete(`products/index.php?id=${id}`);
    toast('Product deleted', 'success');
    renderProductsSection(document.getElementById('inv-section-content'));
  } catch(e) { toast(e.message, 'error'); }
}

function productModalHTML() {
  return `
  <div class="modal-overlay" id="modal-product">
    <div class="modal" style="max-width:440px">
      <div class="modal-header">
        <div class="modal-title" id="product-modal-title">Add Product</div>
        <button class="modal-close" onclick="closeModal('modal-product')">✕</button>
      </div>
      <div class="modal-body">
        <form id="product-form">
          <div class="form-group"><label class="form-label">Product Name *</label>
            <input class="form-input" id="p-name" placeholder="e.g. Monthly Rental"></div>
          <div class="form-group"><label class="form-label">Description</label>
            <input class="form-input" id="p-desc" placeholder="Brief description"></div>
          <div class="form-group"><label class="form-label">Default Price (R)</label>
            <input class="form-input" type="number" id="p-price" placeholder="0.00"></div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
            <input type="checkbox" id="p-active" checked>
            <label for="p-active" style="font-size:13px">Active</label>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-product')">Cancel</button>
        <button class="btn btn-primary" onclick="saveProduct()">Save Product</button>
      </div>
    </div>
  </div>`;
}

// ── CUSTOMERS SECTION ─────────────────────────────────────────
async function renderCustomersSection(el) {
  const res = await API.get('customers/index.php');
  const customers = res.data || [];
  const typeColors = { Tenant:'var(--dark)', Landlord:'var(--amber)', Attorney:'var(--blue)', Other:'var(--green)' };

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:14px;font-weight:600">Customers (${customers.length})</div>
      <button class="btn btn-primary btn-sm" onclick="openCustomerModal()">+ Add Customer</button>
    </div>
    ${customers.length ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Type</th><th>Name</th><th>Email</th><th>Phone</th><th>Unit</th><th>ID Number</th><th></th></tr></thead>
      <tbody>${customers.map(c=>`<tr>
        <td><span class="badge" style="background:${typeColors[c.type]||'var(--gray)'};color:#fff">${c.type}</span></td>
        <td class="td-name">${esc(c.name)}</td>
        <td style="font-size:12px">${c.email||'—'}</td>
        <td style="font-size:12px">${c.phone||'—'}</td>
        <td style="font-size:12px">${c.unit||'—'}</td>
        <td style="font-size:12px">${c.id_number||'—'}</td>
        <td><div class="flex-gap">
          <button class="btn btn-sm btn-ghost" onclick="openCustomerModal(${c.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">Del</button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table></div>` : `
    <div class="empty" style="padding:60px">
      <div class="empty-text">No customers yet</div>
      <button class="btn btn-primary btn-sm" style="margin-top:16px" onclick="openCustomerModal()">+ Add Customer</button>
    </div>`}

`;
}

let editingCustomerId = null;

async function openCustomerModal(id = null) {
  editingCustomerId = id;
  if (!document.getElementById('modal-customer')) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="modal-overlay" id="modal-customer">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <div class="modal-title" id="customer-modal-title">Add Customer</div>
          <button class="modal-close" onclick="closeModal('modal-customer')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Type</label>
            <select class="form-select" id="cust-type">
              <option value="Tenant">Tenant</option>
              <option value="Landlord">Landlord</option>
              <option value="Attorney">Attorney</option>
              <option value="Other">Other</option>
            </select></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Name *</label>
              <input class="form-input" id="cust-name" placeholder="Enter Name"></div>
            <div class="form-group"><label class="form-label">Email</label>
              <input class="form-input" id="cust-email" placeholder="Email Address"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Phone Number</label>
              <input class="form-input" id="cust-phone" placeholder="Phone Number"></div>
            <div class="form-group"><label class="form-label">ID Number</label>
              <input class="form-input" id="cust-idnum" placeholder="ID Number"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Unit Number</label>
              <input class="form-input" id="cust-unit" placeholder="Unit Number"></div>
            <div class="form-group"><label class="form-label">Address</label>
              <input class="form-input" id="cust-address" placeholder="Address"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-customer')">Cancel</button>
          <button class="btn btn-primary" onclick="saveCustomer()" id="cust-save-btn">Create Customer</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  document.getElementById('customer-modal-title').textContent = id ? 'Edit Customer' : 'Add Customer';
  document.getElementById('cust-save-btn').textContent = id ? 'Update Customer' : 'Create Customer';

  if (id) {
    const res = await API.get('customers/index.php');
    const c = res.data.find(x => x.id === id);
    if (c) {
      document.getElementById('cust-type').value    = c.type;
      document.getElementById('cust-name').value    = c.name;
      document.getElementById('cust-email').value   = c.email||'';
      document.getElementById('cust-phone').value   = c.phone||'';
      document.getElementById('cust-idnum').value   = c.id_number||'';
      document.getElementById('cust-unit').value    = c.unit||'';
      document.getElementById('cust-address').value = c.address||'';
    }
  } else {
    ['cust-name','cust-email','cust-phone','cust-idnum','cust-unit','cust-address'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('cust-type').value = 'Tenant';
  }
  openModal('modal-customer');
}

async function saveCustomer() {
  const name = document.getElementById('cust-name')?.value?.trim();
  if (!name) { toast('Name is required', 'error'); return; }
  const data = {
    type:      document.getElementById('cust-type')?.value,
    name,
    email:     document.getElementById('cust-email')?.value||null,
    phone:     document.getElementById('cust-phone')?.value||null,
    id_number: document.getElementById('cust-idnum')?.value||null,
    unit:      document.getElementById('cust-unit')?.value||null,
    address:   document.getElementById('cust-address')?.value||null,
  };
  try {
    if (editingCustomerId) {
      await API.put(`customers/index.php?id=${editingCustomerId}`, data);
      toast('Customer updated', 'success');
    } else {
      await API.post('customers/index.php', data);
      toast('Customer created', 'success');
    }
    closeModal('modal-customer');
    editingCustomerId = null;
    switchInvoiceSection('customers', null);
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  try {
    await API.delete(`customers/index.php?id=${id}`);
    toast('Customer deleted', 'success');
    switchInvoiceSection('customers', null);
  } catch(e) { toast(e.message, 'error'); }
}


async function renderBankSection(el) {
  let banks = [];
  try {
    const res = await API.get('settings/index.php');
    banks = res.data.banks || [];
  } catch(e) {}

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:14px;font-weight:500">Bank Accounts</div>
      <button class="btn btn-primary btn-sm" onclick="navigate('settings')">Manage in Settings →</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Company Name</th><th>Bank</th><th>Account No</th><th>Type</th><th>Branch Code</th><th>Swift</th><th>Category</th></tr></thead>
          <tbody>
            ${banks.length ? banks.map(b => `
            <tr>
              <td class="td-name">${esc(b.bank_company||'—')}</td>
              <td>${esc(b.bank_name||'—')}</td>
              <td class="font-mono">${esc(b.bank_account||'—')}</td>
              <td>${esc(b.bank_type||'—')}</td>
              <td class="font-mono">${esc(b.bank_branch||'—')}</td>
              <td class="font-mono">${esc(b.bank_swift||'—')}</td>
              <td><span class="badge badge-blue">${b.bank_category||'Normal'}</span></td>
            </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-3)">No bank accounts — add them in Settings</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}



// ── TEAM ─────────────────────────────────────────────────────
let editingUserId = null;

async function loadTeam() {
  const res   = await API.get('users/index.php');
  const users = res.data;
  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Team</div>
      <div class="topbar-actions"><button class="btn btn-primary" onclick="openUserModal()">+ Add User</button></div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Username</th><th>Role</th><th>Status</th><th>Last Login</th><th></th></tr></thead>
          <tbody>
          ${users.map(u => `
          <tr>
            <td><div style="display:flex;align-items:center;gap:10px"><div class="avatar">${u.name.substring(0,2).toUpperCase()}</div><div class="td-name">${esc(u.name)}</div></div></td>
            <td>${esc(u.email)}</td>
            <td class="font-mono text-muted">${esc(u.username)}</td>
            <td><span class="badge ${ROLE_BADGE[u.role]||'badge-gray'}">${u.role.replace(/_/g,' ')}</span></td>
            <td><span class="badge ${u.is_active?'badge-green':'badge-red'}">${u.is_active?'Active':'Inactive'}</span></td>
            <td class="text-muted">${u.last_login ? timeAgo(u.last_login) : 'Never'}</td>
            <td>
              ${(APP_USER?.role === 'admin' && ['super_admin','platform_superadmin'].includes(u.role)) ? 
                '<span style="color:var(--text-3);font-size:12px">🔒 Protected</span>' :
                `<button class="btn btn-sm btn-ghost" onclick="openUserModal(${u.id})">Edit</button>
                 <button class="btn btn-sm btn-ghost" onclick="openChangePasswordModal(${u.id},'${esc(u.name)}')">Reset PW</button>
                 ${u.id !== APP_USER?.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id},'${esc(u.name)}')">Del</button>` : ''}`
              }
            </td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ${userModalHTML()}`;
}

async function openUserModal(id = null) {
  editingUserId = id;
  document.getElementById('user-modal-title').textContent = id ? 'Edit User' : 'Add User';
  document.getElementById('u-pw-label').textContent = id ? 'New Password (leave blank to keep current)' : 'Password *';
  document.getElementById('user-form').reset();
  if (id) {
    // Load user data and populate form
    try {
      const res = await API.get('users/index.php');
      const u = res.data.find(x => x.id === id);
      if (u) {
        openModal('modal-user');
        // Set values after modal is in DOM
        setTimeout(() => {
          document.getElementById('u-name').value     = u.name || '';
          document.getElementById('u-email').value    = u.email || '';
          document.getElementById('u-username').value = u.username || '';
          const roleEl = document.getElementById('u-role');
          if (roleEl) roleEl.value = u.role || 'agent';
          document.getElementById('u-active').checked = u.is_active == 1;
          document.getElementById('u-pw').value       = '';
        }, 50);
      }
    } catch(e) { toast('Failed to load user', 'error'); return; }
  } else {
    openModal('modal-user');
  }
}

async function saveUser() {
  const data = {
    name:       document.getElementById('u-name').value.trim(),
    email:      document.getElementById('u-email').value.trim(),
    username:   document.getElementById('u-username').value.trim(),
    role:       document.getElementById('u-role').value,
    is_active:  document.getElementById('u-active').checked ? 1 : 0,
    password:   document.getElementById('u-pw').value,
  };
  if (!data.name || !data.email || !data.username) { toast('Name, email and username are required', 'error'); return; }
  if (!editingUserId && !data.password) { toast('Password is required for new users', 'error'); return; }
  if (data.password && data.password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
  try {
    if (editingUserId) {
      await API.put(`users/index.php?id=${editingUserId}`, data);
      toast('User updated', 'success');
    } else {
      await API.post('users/index.php', data);
      toast('User created', 'success');
    }
    closeModal('modal-user');
    loadTeam();
  } catch(e) { toast(e.message, 'error'); }
}

function userModalHTML() {
  return `
  <div class="modal-overlay" id="modal-user">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="user-modal-title">Add User</div>
        <button class="modal-close" onclick="closeModal('modal-user')">✕</button>
      </div>
      <div class="modal-body">
        <form id="user-form">
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="u-name" placeholder="Full name"></div>
            <div class="form-group"><label class="form-label">Username *</label><input class="form-input" id="u-username" placeholder="e.g. sipho.dlamini"></div>
          </div>
          <div class="form-group"><label class="form-label">Email *</label><input class="form-input" type="email" id="u-email" placeholder="email@company.co.za"></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Role</label>
              <select class="form-select" id="u-role">
                <option value="agent">Agent</option>
                <option value="finance_admin">Finance Admin</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">Status</label>
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
                <input type="checkbox" id="u-active" checked>
                <label for="u-active" style="font-size:13px">Active</label>
              </div>
            </div>
          </div>
          <div class="form-group" id="u-pw-row">
            <label class="form-label" id="u-pw-label">Password *</label>
            <div style="position:relative"><input class="form-input" type="password" id="u-pw" placeholder="Min 8 characters" style="padding-right:36px"><button type="button" onclick="togglePwField('u-pw',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:var(--text-3)">👁</button></div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-user')">Cancel</button>
        <button class="btn btn-primary" onclick="saveUser()">Save User</button>
      </div>
    </div>
  </div>`;
}

// ── PLATFORM TENANTS ─────────────────────────────────────────
async function loadPlatformTenants() {
  const res = await API.get('admin/tenants.php');
  const tenants = res.data;
  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">
        <div style="font-size:10px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:.1em">Hulisa Platform Admin</div>
        All Tenants (${tenants.length})
      </div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="openModal('modal-new-tenant')">+ Add Tenant</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="kpi-card"><div class="kpi-label">Total Tenants</div><div class="kpi-value">${tenants.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Active</div><div class="kpi-value">${tenants.filter(t=>t.status==='active').length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Contacts</div><div class="kpi-value">${tenants.reduce((s,t)=>s+(parseInt(t.contact_count)||0),0).toLocaleString()}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Users</div><div class="kpi-value">${tenants.reduce((s,t)=>s+(parseInt(t.user_count)||0),0)}</div></div>
    </div>
    ${tenants.map(t => `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div>
          <div class="card-title" style="font-size:16px">${esc(t.name)}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px"><span class="font-mono">${t.slug}</span> &nbsp;·&nbsp; Created ${t.created_at?.split(' ')[0]||'—'}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="badge ${t.status==='active'?'badge-green':'badge-red'}">${t.status}</span>
          <button class="btn btn-primary btn-sm" onclick="viewAsTenant(${t.id},'${esc(t.name)}')">👁 View as Client</button>
          <button class="btn btn-ghost btn-sm" onclick="openManageTenantModal(${t.id},'${esc(t.name)}')">⚙ Manage</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--border)">
        <div style="padding:12px 16px;border-right:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase">Contacts</div>
          <div style="font-size:22px;font-weight:600">${parseInt(t.contact_count||0).toLocaleString()}</div>
        </div>
        <div style="padding:12px 16px;border-right:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase">Users</div>
          <div style="font-size:22px;font-weight:600">${t.user_count}</div>
        </div>
        <div style="padding:12px 16px;border-right:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase">Closed Deals</div>
          <div style="font-size:22px;font-weight:600">${t.closed_deals||0}</div>
        </div>
        <div style="padding:12px 16px">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase">Plan</div>
          <div style="font-size:14px;font-weight:600;color:var(--accent);margin-top:4px">${t.plan||'Standard'}</div>
        </div>
      </div>
    </div>`).join('')}
    ${newTenantModalHTML()}
    <div class="modal-overlay" id="modal-manage-tenant">
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <div class="modal-title" id="manage-tenant-title">Manage Tenant</div>
          <button class="modal-close" onclick="closeModal('modal-manage-tenant')">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-ghost" style="justify-content:flex-start;padding:14px;text-align:left" onclick="doResetTenantPw()">🔑&nbsp; Reset Super Admin Password</button>
          <button class="btn btn-ghost" style="justify-content:flex-start;padding:14px;text-align:left" onclick="doCreateTenantUser()">👤&nbsp; Create New User for this Tenant</button>
          <button class="btn btn-danger" style="justify-content:flex-start;padding:14px;text-align:left" onclick="doSuspendTenant()">🚫&nbsp; Suspend Tenant</button>
        </div>
        <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('modal-manage-tenant')">Close</button></div>
      </div>
    </div>
    <div class="modal-overlay" id="modal-create-tenant-user">
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <div class="modal-title">Create User</div>
          <button class="modal-close" onclick="closeModal('modal-create-tenant-user')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="ctu-name" placeholder="Full name"></div>
          <div class="form-group"><label class="form-label">Username *</label><input class="form-input" id="ctu-username" placeholder="username"></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="ctu-email" placeholder="email@example.com"></div>
          <div class="form-group"><label class="form-label">Password *</label><div style="position:relative"><input class="form-input" id="ctu-password" type="password" placeholder="Min 6 characters" style="padding-right:36px"><button type="button" onclick="togglePwField('ctu-password',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:var(--text-3)">👁</button></div></div>
          <div class="form-group"><label class="form-label">Role</label>
            <select class="form-select" id="ctu-role">
              <option value="agent">Agent</option>
              <option value="finance_admin">Finance Admin</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-create-tenant-user')">Cancel</button>
          <button class="btn btn-primary" onclick="saveTenantUser()">Create User</button>
        </div>
      </div>
    </div>`;
}

let managingTenantId = null;
let managingTenantName = '';

function openManageTenantModal(id, name) {
  managingTenantId = id;
  managingTenantName = name;
  document.getElementById('manage-tenant-title').textContent = 'Manage — ' + name;
  openModal('modal-manage-tenant');
}

async function viewAsTenant(tenantId, name) {
  if (!confirm('View the CRM as ' + name + '? You will be logged in as their Super Admin. A banner will appear at the top to exit.')) return;
  try {
    const res = await API.post('platform', { action: 'impersonate', tenant_id: tenantId });
    // Cookie set server-side — just reload
    toast('Now viewing as ' + name + '...', 'success');
    setTimeout(() => window.location.href = '/crm/', 1000);
  } catch(e) { toast(e.message, 'error'); }
}

async function doResetTenantPw() {
  const newPw = prompt('New password for ' + managingTenantName + ' Super Admin:');
  if (!newPw) return;
  if (newPw.length < 6) { toast('Password too short — minimum 6 characters', 'error'); return; }
  try {
    await API.post('platform', { action: 'reset_password', tenant_id: managingTenantId, password: newPw });
    toast('Password reset for ' + managingTenantName, 'success');
    closeModal('modal-manage-tenant');
  } catch(e) { toast(e.message, 'error'); }
}

function doCreateTenantUser() {
  closeModal('modal-manage-tenant');
  ['ctu-name','ctu-username','ctu-email','ctu-password'].forEach(function(id) {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  openModal('modal-create-tenant-user');
}

async function saveTenantUser() {
  const name     = document.getElementById('ctu-name')?.value?.trim();
  const username = document.getElementById('ctu-username')?.value?.trim();
  const password = document.getElementById('ctu-password')?.value;
  if (!name || !username || !password) { toast('Name, username and password are required', 'error'); return; }
  try {
    await API.post('platform', { action: 'create_user',
      tenant_id: managingTenantId, name, username,
      email: document.getElementById('ctu-email')?.value || null,
      password,
      role: document.getElementById('ctu-role')?.value || 'agent',
    });
    toast('User created for ' + managingTenantName, 'success');
    closeModal('modal-create-tenant-user');
  } catch(e) { toast(e.message, 'error'); }
}

async function doSuspendTenant() {
  if (!confirm('Suspend ' + managingTenantName + '? All their users will be locked out.')) return;
  try {
    await API.delete('admin/tenants.php?id=' + managingTenantId);
    toast(managingTenantName + ' suspended', 'success');
    closeModal('modal-manage-tenant');
    loadPlatformTenants();
  } catch(e) { toast(e.message, 'error'); }
}

async function exitImpersonation() {
  try {
    await API.post('platform', { action: 'exit_impersonate' });
    toast('Returning to platform admin...', 'success');
    setTimeout(() => window.location.reload(), 800);
  } catch(e) { toast(e.message, 'error'); }
}

async function saveNewTenant() {
  const data = {
    name:           document.getElementById('nt-name').value.trim(),
    slug:           document.getElementById('nt-slug').value.trim().toLowerCase().replace(/\s+/g,'-'),
    email:          document.getElementById('nt-email').value.trim(),
    admin_name:     document.getElementById('nt-admin-name').value.trim(),
    admin_email:    document.getElementById('nt-admin-email').value.trim(),
    admin_password: document.getElementById('nt-admin-pw').value,
    plan:           document.getElementById('nt-plan').value,
    status:         'active',
  };
  if (!data.name || !data.slug || !data.admin_name || !data.admin_email || !data.admin_password) {
    toast('All fields are required', 'error'); return;
  }
  try {
    await API.post('admin/tenants.php', data);
    toast(`Tenant "${data.name}" created`, 'success');
    closeModal('modal-new-tenant');
    loadPlatformTenants();
  } catch(e) { toast(e.message, 'error'); }
}

async function suspendTenant(id, name) {
  if (!confirm(`Suspend ${name}? All their users will be locked out.`)) return;
  try {
    await API.delete(`admin/tenants.php?id=${id}`);
    toast(`${name} suspended`, 'success');
    loadPlatformTenants();
  } catch(e) { toast(e.message, 'error'); }
}

function newTenantModalHTML() {
  return `
  <div class="modal-overlay" id="modal-new-tenant">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Add New Tenant</div>
        <button class="modal-close" onclick="closeModal('modal-new-tenant')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row-2">
          <div class="form-group"><label class="form-label">Business Name *</label><input class="form-input" id="nt-name" placeholder="e.g. Muga Properties" oninput="document.getElementById('nt-slug').value=this.value.toLowerCase().replace(/\\s+/g,'-')"></div>
          <div class="form-group"><label class="form-label">URL Slug *</label><input class="form-input" id="nt-slug" placeholder="e.g. muga-properties"></div>
        </div>
        <div class="form-group"><label class="form-label">Business Email</label><input class="form-input" id="nt-email" type="email" placeholder="admin@business.co.za"></div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Super Admin Account</div>
        <div class="form-row-2">
          <div class="form-group"><label class="form-label">Admin Name *</label><input class="form-input" id="nt-admin-name" placeholder="Full name"></div>
          <div class="form-group"><label class="form-label">Admin Email *</label><input class="form-input" id="nt-admin-email" type="email" placeholder="admin@business.co.za"></div>
        </div>
        <div class="form-row-2">
          <div class="form-group"><label class="form-label">Password *</label><div style="position:relative"><input class="form-input" id="nt-admin-pw" type="password" placeholder="Min 8 characters" style="padding-right:36px"><button type="button" onclick="togglePwField('nt-admin-pw',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:var(--text-3)">👁</button></div></div>
          <div class="form-group"><label class="form-label">Plan</label>
            <select class="form-select" id="nt-plan">
              <option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-new-tenant')">Cancel</button>
        <button class="btn btn-primary" onclick="saveNewTenant()">Create Tenant</button>
      </div>
    </div>
  </div>`;
}

// ── SETTINGS & LISTINGS (stubs) ───────────────────────────────

// ── SETTINGS ─────────────────────────────────────────────────
async function loadSettings() {
  // Load current settings from DB
  let settings = {};
  let banks = [];
  try {
    const res = await API.get('settings/index.php');
    settings = res.data.settings || {};
    banks    = res.data.banks    || [];
  } catch(e) {}

  document.getElementById('page-content').innerHTML = `
    <div class="topbar"><div class="topbar-title">Settings</div></div>
    <div style="max-width:700px">

      <!-- Company -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header" id="settings-section-company"><div class="card-title">Company</div></div>
        <div class="card-body">
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Company Name</label>
              <input class="form-input" id="s-company-name" value="${esc(settings.company_name||'')}"></div>
            <div class="form-group"><label class="form-label">Website</label>
              <input class="form-input" id="s-website" value="${esc(settings.website||'')}"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Phone</label>
              <input class="form-input" id="s-phone" value="${esc(settings.phone||'')}"></div>
            <div class="form-group"><label class="form-label">Email</label>
              <input class="form-input" id="s-email" value="${esc(settings.email||'')}"></div>
          </div>
          <div class="form-group"><label class="form-label">Address</label>
            <input class="form-input" id="s-address" value="${esc(settings.address||'')}"></div>
          <div class="form-group"><label class="form-label">VAT Number</label>
            <input class="form-input" id="s-vat" placeholder="e.g. 4123456789" value="${esc(settings.vat_number||'')}"></div>
          <div class="form-group"><label class="form-label">Company Registration No</label>
            <input class="form-input" id="s-reg" placeholder="e.g. 2020/123456/07" value="${esc(settings.reg_number||'')}"></div>
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <button class="btn btn-primary btn-sm" onclick="saveCompanySettings()">Save Changes</button>
          </div>
        </div>
      </div>

      <!-- Logo -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header" id="settings-section-branding"><div class="card-title">Logo & Brand Colours</div></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:20px">
            <div id="logo-preview" style="width:120px;height:60px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer" onclick="document.getElementById('logo-upload').click()">
              ${settings.logo_url
                ? `<img src="${esc(settings.logo_url)}" style="max-width:100%;max-height:100%;object-fit:contain">`
                : `<span style="font-size:12px;color:var(--text-3)">Click to upload</span>`}
            </div>
            <div>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('logo-upload').click()">Upload Logo</button>
              <input type="file" id="logo-upload" style="display:none" accept="image/*" onchange="uploadLogo(this)">
              <div style="font-size:12px;color:var(--text-3);margin-top:6px">PNG or JPG, max 2MB. Appears on invoices and login screen.</div>
            </div>
          </div>
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-size:13px;font-weight:600;margin-bottom:12px">Brand Colours</div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Primary Colour <span style="font-size:11px;color:var(--text-3)">(headers)</span></label>
                <div style="display:flex;gap:8px;align-items:center">
                  <input type="color" id="s-primary-colour" value="${settings.primary_colour||'#0A1A3B'}" style="width:48px;height:36px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px" oninput="document.getElementById('s-primary-colour-hex').value=this.value">
                  <input class="form-input" id="s-primary-colour-hex" value="${settings.primary_colour||'#0A1A3B'}" placeholder="#0A1A3B" style="width:110px" oninput="document.getElementById('s-primary-colour').value=this.value">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Accent Colour <span style="font-size:11px;color:var(--text-3)">(highlights)</span></label>
                <div style="display:flex;gap:8px;align-items:center">
                  <input type="color" id="s-accent-colour" value="${settings.accent_colour||'#1DB8A0'}" style="width:48px;height:36px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px" oninput="document.getElementById('s-accent-colour-hex').value=this.value">
                  <input class="form-input" id="s-accent-colour-hex" value="${settings.accent_colour||'#1DB8A0'}" placeholder="#1DB8A0" style="width:110px" oninput="document.getElementById('s-accent-colour').value=this.value">
                </div>
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;margin-top:8px">
              <button class="btn btn-primary btn-sm" onclick="saveBrandingSettings()">Save Branding</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bank Accounts -->
      <div class="card" style="margin-bottom:16px" id="settings-card-bank">
        <div class="card-header" id="settings-section-bank">
          <div class="card-title">Bank Accounts</div>
          <button class="btn btn-primary btn-sm" onclick="openBankModal()">+ Add Bank Account</button>
        </div>
        <div class="table-wrap">
          <table id="bank-table">
            <thead><tr>
              <th>Company Name</th><th>Bank</th><th>Account No</th>
              <th>Type</th><th>Branch Code</th><th>Swift</th><th>Category</th><th></th>
            </tr></thead>
            <tbody id="bank-tbody">
              ${banks.length ? banks.map(b => `
              <tr>
                <td class="td-name">${esc(b.bank_company||'—')}</td>
                <td>${esc(b.bank_name||'—')}</td>
                <td class="font-mono">${esc(b.bank_account||'—')}</td>
                <td>${esc(b.bank_type||'—')}</td>
                <td class="font-mono">${esc(b.bank_branch||'—')}</td>
                <td class="font-mono">${esc(b.bank_swift||'—')}</td>
                <td><span class="badge badge-blue">${b.bank_category||'Normal'}</span></td>
                <td><div class="flex-gap">
                  <button class="btn btn-ghost btn-sm" onclick="openBankModal(${b.id})">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteBank(${b.id})">Delete</button>
                </div></td>
              </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-3)">No bank accounts yet</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pipeline Stages -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Pipeline Stages</div></div>
        <div class="card-body">
          <div style="display:flex;flex-direction:column;gap:8px" id="pipeline-stages-list">
            ${(settings.pipeline_stages ? JSON.parse(settings.pipeline_stages) : ['Lead','Qualified','Pending','Closed']).map((s,i) => `
            <div style="display:flex;gap:8px" id="stage-row-${i}">
              <input class="form-input" style="flex:1" value="${esc(s)}" id="stage-${i}">
              <button class="btn btn-ghost btn-sm" onclick="removeStage(${i})">Remove</button>
            </div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:12px">
            <button class="btn btn-ghost btn-sm" onclick="addStage()">+ Add Stage</button>
            <button class="btn btn-primary btn-sm" onclick="savePipelineStages()">Save Stages</button>
          </div>
        </div>
      </div>

      <!-- SMTP Email -->
      <div class="card">
        <div class="card-header" id="settings-section-smtp"><div class="card-title">Email (SMTP)</div></div>
        <div class="card-body">
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">SMTP Host</label>
              <input class="form-input" id="s-smtp-host" value="${esc(settings.smtp_host||'smtp-relay.brevo.com')}"></div>
            <div class="form-group"><label class="form-label">SMTP Port</label>
              <input class="form-input" id="s-smtp-port" value="${esc(settings.smtp_port||'587')}"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">SMTP Username</label>
              <input class="form-input" id="s-smtp-user" value="${esc(settings.smtp_user||'')}"></div>
            <div class="form-group"><label class="form-label">SMTP Password</label>
              <input class="form-input" type="password" id="s-smtp-pass" placeholder="Leave blank to keep current"></div>
          </div>
          <div class="form-group"><label class="form-label">From Email</label>
            <input class="form-input" id="s-smtp-from" value="${esc(settings.smtp_from||'')}"></div>
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <button class="btn btn-primary btn-sm" onclick="saveSmtpSettings()">Save SMTP</button>
          </div>
        </div>
      </div>

    </div>
    ${bankModalHTML()}
  `;
}

async function saveBrandingSettings() {
  const data = {
    primary_colour: document.getElementById('s-primary-colour-hex')?.value || '#0A1A3B',
    accent_colour:  document.getElementById('s-accent-colour-hex')?.value || '#1DB8A0',
  };
  try {
    await API.post('settings/index.php', { type: 'company', data });
    toast('Brand colours saved', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function saveCompanySettings() {
  const data = {
    company_name:    document.getElementById('s-company-name').value,

    website:      document.getElementById('s-website').value,
    phone:        document.getElementById('s-phone').value,
    email:        document.getElementById('s-email').value,
    address:      document.getElementById('s-address').value,
    vat_number:   document.getElementById('s-vat').value,
    reg_number:   document.getElementById('s-reg').value,
  };
  try {
    await API.post('settings/index.php', { type: 'company', data });
    toast('Company settings saved', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function saveSmtpSettings() {
  const data = {
    smtp_host: document.getElementById('s-smtp-host').value,
    smtp_port: document.getElementById('s-smtp-port').value,
    smtp_user: document.getElementById('s-smtp-user').value,
    smtp_pass: document.getElementById('s-smtp-pass').value,
    smtp_from: document.getElementById('s-smtp-from').value,
  };
  try {
    await API.post('settings/index.php', { type: 'smtp', data });
    toast('SMTP settings saved', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Logo must be under 2MB', 'error'); return; }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'logo');
  formData.append('entity_id', APP_USER.tenant_id);
  try {
    const res = await fetch('/crm/api/files/upload.php', {
      method: 'POST', credentials: 'same-origin', body: formData
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    // Save logo URL to settings
    await API.post('settings/index.php', { type: 'company', data: { logo_url: json.data.url } });
    // Update preview
    document.getElementById('logo-preview').innerHTML = `<img src="${json.data.url}" style="max-width:100%;max-height:100%;object-fit:contain">`;
    toast('Logo uploaded', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

// Pipeline stages
function addStage() {
  const list  = document.getElementById('pipeline-stages-list');
  const count = list.children.length;
  const div   = document.createElement('div');
  div.id        = `stage-row-${count}`;
  div.style.display = 'flex';
  div.style.gap = '8px';
  div.innerHTML = `<input class="form-input" style="flex:1" id="stage-${count}" placeholder="Stage name">
    <button class="btn btn-ghost btn-sm" onclick="removeStage(${count})">Remove</button>`;
  list.appendChild(div);
}

function removeStage(i) {
  document.getElementById(`stage-row-${i}`)?.remove();
}

async function savePipelineStages() {
  const inputs = document.querySelectorAll('[id^="stage-"]');
  const stages = [...inputs].map(i => i.value.trim()).filter(Boolean);
  if (!stages.length) { toast('At least one stage required', 'error'); return; }
  try {
    await API.post('settings/index.php', { type: 'company', data: { pipeline_stages: JSON.stringify(stages) } });
    toast('Pipeline stages saved', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

// Bank accounts
let editingBankId = null;
let tenantBanks   = [];

async function openBankModal(id = null) {
  editingBankId = id;
  document.getElementById('bank-modal-title').textContent = id ? 'Edit Bank Account' : 'Add Bank Account';
  if (id) {
    const bank = tenantBanks.find(b => b.id === id);
    if (bank) {
      document.getElementById('b-company').value  = bank.bank_company || '';
      document.getElementById('b-bank').value     = bank.bank_name    || '';
      document.getElementById('b-account').value  = bank.bank_account || '';
      document.getElementById('b-type').value     = bank.bank_type    || 'Business Cheque';
      document.getElementById('b-branch').value   = bank.bank_branch  || '';
      document.getElementById('b-swift').value    = bank.bank_swift   || '';
      document.getElementById('b-category').value = bank.bank_category|| 'Normal';
    }
  } else {
    document.getElementById('bank-form').reset();
  }
  openModal('modal-bank');
}

async function saveBank() {
  const data = {
    bank_company:  document.getElementById('b-company').value.trim(),
    bank_name:     document.getElementById('b-bank').value.trim(),
    bank_account:  document.getElementById('b-account').value.trim(),
    bank_type:     document.getElementById('b-type').value,
    bank_branch:   document.getElementById('b-branch').value.trim(),
    bank_swift:    document.getElementById('b-swift').value.trim(),
    bank_category: document.getElementById('b-category').value,
  };
  if (!data.bank_name || !data.bank_account) {
    toast('Bank name and account number are required', 'error'); return;
  }
  try {
    await API.post('settings/index.php', { type: 'bank', data, bank_id: editingBankId });
    toast(editingBankId ? 'Bank account updated' : 'Bank account added', 'success');
    closeModal('modal-bank');
    loadSettings();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteBank(id) {
  if (!confirm('Delete this bank account?')) return;
  try {
    await API.post('settings/index.php', { type: 'delete_bank', bank_id: id });
    toast('Bank account deleted', 'success');
    loadSettings();
  } catch(e) { toast(e.message, 'error'); }
}

function bankModalHTML() {
  return `
  <div class="modal-overlay" id="modal-bank">
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <div class="modal-title" id="bank-modal-title">Add Bank Account</div>
        <button class="modal-close" onclick="closeModal('modal-bank')">✕</button>
      </div>
      <div class="modal-body">
        <form id="bank-form">
          <div class="form-group"><label class="form-label">Company Name *</label>
            <input class="form-input" id="b-company" placeholder="e.g. Muga Properties (Pty) Ltd"></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Bank Name *</label>
              <input class="form-input" id="b-bank" placeholder="e.g. FNB"></div>
            <div class="form-group"><label class="form-label">Account Number *</label>
              <input class="form-input" id="b-account" placeholder="e.g. 62000000000"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Account Type</label>
              <select class="form-select" id="b-type">
                <option>Business Cheque</option><option>Current</option>
                <option>Savings</option><option>Transmission</option>
              </select></div>
            <div class="form-group"><label class="form-label">Category</label>
              <select class="form-select" id="b-category">
                <option value="Normal">Normal</option>
                <option value="Trust">Trust</option>
                <option value="Primary">Primary</option>
              </select></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Branch Code</label>
              <input class="form-input" id="b-branch" placeholder="e.g. 250117"></div>
            <div class="form-group"><label class="form-label">Swift Code</label>
              <input class="form-input" id="b-swift" placeholder="e.g. FIRNZAJJ"></div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-bank')">Cancel</button>
        <button class="btn btn-primary" onclick="saveBank()">Save</button>
      </div>
    </div>
  </div>`;
}


// ── LISTINGS ─────────────────────────────────────────────────
let allListings = [];
let editingListingId = null;
let listingTypeFilter = 'all';
let listingStatusFilter = '';
let listingMinPrice = '';
let listingMaxPrice = '';

async function loadListings() {
  const params = { q: '' };
  if (listingStatusFilter) params.status = listingStatusFilter;
  if (listingMinPrice) params.min_price = listingMinPrice;
  if (listingMaxPrice) params.max_price = listingMaxPrice;
  if (IS_AGENT) params.assigned_to = APP_USER?.id;
  const res = await API.get('listings/index.php', params);
  allListings = res.data;
  const filtered = listingTypeFilter === 'all' ? allListings : allListings.filter(l => l.listing_type === listingTypeFilter);
  renderListingsPage(filtered);
}

function renderListingsPage(listings) {
  const fmt = n => n ? 'R ' + Number(n).toLocaleString('en-ZA', {minimumFractionDigits:0}) : '—';
  const typeBadge = { Sale:'badge-green', Rent:'badge-blue', Both:'badge-purple' };
  const statusBadge = { Active:'badge-green', 'Under Offer':'badge-amber', Sold:'badge-gray', Rented:'badge-gray', Withdrawn:'badge-red', Draft:'badge-gray' };

  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">Listings</div>
      <div class="topbar-actions">
        <div class="search-wrap" style="width:180px">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input class="form-input" placeholder="Search listings…" oninput="filterListingsSearch(this.value)">
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm ${listingTypeFilter==='all'?'btn-active':''}" onclick="setListingType('all')">All</button>
          <button class="btn btn-ghost btn-sm ${listingTypeFilter==='Sale'?'btn-active':''}" onclick="setListingType('Sale')">Sale</button>
          <button class="btn btn-ghost btn-sm ${listingTypeFilter==='Rent'?'btn-active':''}" onclick="setListingType('Rent')">Rental</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openListingModal()">+ Add Listing</button>
      </div>
    </div>

    <!-- Price filter -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-body" style="padding:12px 20px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:500;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em">Price Range (R):</span>
          <input class="form-input" id="price-min" type="number" placeholder="Min" style="width:110px" value="${listingMinPrice}">
          <span style="color:var(--text-3)">to</span>
          <input class="form-input" id="price-max" type="number" placeholder="Max" style="width:110px" value="${listingMaxPrice}">
          <button class="btn btn-primary btn-sm" onclick="applyPriceFilter()">Apply</button>
          <button class="btn btn-ghost btn-sm" onclick="clearPriceFilter()">Clear</button>
          <span style="font-size:12px;color:var(--text-3);margin-left:8px">${listings.length} listing${listings.length!==1?'s':''}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th style="width:60px"></th>
            <th>Property</th><th>Type</th><th>Beds</th><th>Baths</th><th>Parking</th>
            <th>Price / Rent</th><th>Linked Client</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody id="listings-tbody">${renderListingRows(listings)}</tbody>
        </table>
      </div>
    </div>
    ${listingModalHTML()}
    ${linkClientModalHTML()}
  `;
}


function renderListingRows(listings) {
  const fmt = n => n ? 'R ' + Number(n).toLocaleString('en-ZA', {minimumFractionDigits:0}) : '—';
  const typeBadge   = { Sale:'badge-green', Rent:'badge-blue', Both:'badge-purple' };
  const statusBadge = { Active:'badge-green', 'Under Offer':'badge-amber', Sold:'badge-gray', Rented:'badge-gray', Withdrawn:'badge-red', Draft:'badge-gray' };
  if (!listings.length) return `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-3)">No listings found</td></tr>`;
  return listings.map(l => `
  <tr>
    <td><div style="width:48px;height:48px;background:var(--surface-2);border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center">
      ${l.primary_photo ? `<img src="${l.primary_photo}" style="width:100%;height:100%;object-fit:cover">` : `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" style="width:20px;height:20px;color:var(--text-3)"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`}
    </div></td>
    <td>
      <div style="font-weight:500;cursor:pointer;color:var(--blue)" onclick="openListingDetail(${l.id})">${esc(l.title)}</div>
      <div style="font-size:11px;color:var(--text-3)">Ref: ${l.ref}${l.floor_size?' · '+l.floor_size+'m²':''}</div>
    </td>
    <td><span class="badge ${typeBadge[l.listing_type]||'badge-gray'}">${l.listing_type}</span></td>
    <td>${l.bedrooms||'—'}</td><td>${l.bathrooms||'—'}</td><td>${l.garages||'—'}</td>
    <td><div class="font-mono" style="font-weight:600;color:var(--green)">
      ${l.listing_type==='Rent'?(l.rental_price?fmt(l.rental_price)+'/mo':'—'):(l.price?fmt(l.price):'—')}
    </div></td>
    <td>${l.linked_client_name?`<span class="badge badge-blue" style="cursor:pointer" onclick="viewContact(${l.contact_id})">${esc(l.linked_client_name)}</span>`:`<button class="btn btn-ghost btn-sm" onclick="openLinkClientModal(${l.id})">Link Client</button>`}</td>
    <td><span class="badge ${statusBadge[l.status]||'badge-gray'}">${l.status}</span></td>
    <td><div style="display:flex;gap:4px;flex-wrap:nowrap">
      <button class="btn btn-ghost btn-sm" onclick="openLinkClientModal(${l.id})" title="Link Client" style="padding:4px 8px">🔗</button>
      <button class="btn btn-ghost btn-sm" onclick="openListingDetail(${l.id})" title="View" style="padding:4px 8px">👁</button>
      <button class="btn btn-ghost btn-sm" onclick="openListingModal(${l.id})" title="Edit" style="padding:4px 8px">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="deleteListing(${l.id},'${esc(l.title)}')" title="Delete" style="padding:4px 8px">🗑</button>
    </div></td>
  </tr>`).join('');
}

function setListingType(type) {
  listingTypeFilter = type;
  // Update button styles
  document.querySelectorAll('[onclick^="setListingType"]').forEach(b => {
    const bType = b.getAttribute('onclick').match(/'(.+)'/)?.[1];
    b.classList.toggle('btn-active', bType === type);
  });
  // Update table only
  const filtered = type === 'all' ? allListings : allListings.filter(l => l.listing_type === type);
  const tbody = document.getElementById('listings-tbody');
  if (tbody) {
    tbody.innerHTML = renderListingRows(filtered);
  } else {
    renderListingsPage(filtered);
  }
}

function filterListingsSearch(q) {
  const filtered = allListings.filter(l =>
    (l.title||'').toLowerCase().includes(q.toLowerCase()) ||
    (l.address||'').toLowerCase().includes(q.toLowerCase()) ||
    (l.ref||'').toLowerCase().includes(q.toLowerCase())
  );
  renderListingsPage(filtered);
}

function applyPriceFilter() {
  listingMinPrice = document.getElementById('price-min')?.value || '';
  listingMaxPrice = document.getElementById('price-max')?.value || '';
  loadListings();
}

function clearPriceFilter() {
  listingMinPrice = ''; listingMaxPrice = '';
  loadListings();
}

async function openListingModal(id = null) {
  editingListingId = id;
  if (!document.getElementById('modal-listing')) {
    const div = document.createElement('div');
    div.innerHTML = listingModalHTML();
    document.body.appendChild(div.firstElementChild);
  }

  // Load contacts for owner/client dropdowns
  const contactsRes = await API.get('contacts/index.php', { limit: 2000, status: 'active' });
  const contacts = contactsRes.data;
  const contactOpts = '<option value="">— None —</option>' +
    contacts.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  // Load agents
  const usersRes = await API.get('users/index.php');
  const agents = usersRes.data.filter(u => ['agent','admin','super_admin'].includes(u.role));
  const agentOpts = '<option value="">— Unassigned —</option>' +
    agents.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');

  // Fill dropdowns
  document.getElementById('el-owner').innerHTML  = contactOpts;
  document.getElementById('el-client').innerHTML = contactOpts;
  document.getElementById('el-agent').innerHTML  = agentOpts;

  if (id) {
    const res = await API.get(`listings/index.php?id=${id}`);
    const l   = res.data;
    document.getElementById('listing-modal-title').textContent = 'Edit Listing';
    document.getElementById('el-title').value        = l.title || '';
    document.getElementById('el-type').value         = l.listing_type || 'Sale';
    document.getElementById('el-prop-type').value    = l.type || 'Residential';
    document.getElementById('el-status').value       = l.status || 'Active';
    document.getElementById('el-price').value        = l.price || '';
    document.getElementById('el-rent').value         = l.rental_price || '';
    document.getElementById('el-address').value      = l.address || '';
    document.getElementById('el-complex').value      = l.complex || '';
    document.getElementById('el-unit').value         = l.unit || '';
    document.getElementById('el-city').value         = l.city || '';
    document.getElementById('el-province').value     = l.province || '';
    document.getElementById('el-beds').value         = l.bedrooms || '';
    document.getElementById('el-baths').value        = l.bathrooms || '';
    document.getElementById('el-parking').value      = l.garages || '';
    document.getElementById('el-floor').value        = l.floor_size || '';
    document.getElementById('el-erf').value          = l.erf_size || '';
    document.getElementById('el-desc').value         = l.description || '';
    document.getElementById('el-mandate').value      = l.mandate_type || 'Sole';
    document.getElementById('el-owner').value        = l.owner_id || '';
    document.getElementById('el-client').value       = l.contact_id || '';
    document.getElementById('el-agent').value        = l.assigned_to || '';
    togglePriceFields(l.listing_type);
  } else {
    document.getElementById('listing-modal-title').textContent = 'Add Listing';
    document.getElementById('listing-form').reset();
    togglePriceFields('Sale');
  }
  openModal('modal-listing');
}

function togglePriceFields(type) {
  const priceRow  = document.getElementById('el-price-row');
  const rentRow   = document.getElementById('el-rent-row');
  if (priceRow) priceRow.style.display = type === 'Rent' ? 'none' : '';
  if (rentRow)  rentRow.style.display  = type !== 'Rent' ? 'none' : '';
}

async function saveListing() {
  const data = {
    title:        document.getElementById('el-title').value.trim(),
    listing_type: document.getElementById('el-type').value,
    type:         document.getElementById('el-prop-type').value,
    status:       document.getElementById('el-status').value,
    price:        document.getElementById('el-price').value,
    rental_price: document.getElementById('el-rent').value,
    address:      document.getElementById('el-address').value,
    complex:      document.getElementById('el-complex').value,
    unit:         document.getElementById('el-unit').value,
    city:         document.getElementById('el-city').value,
    province:     document.getElementById('el-province').value,
    bedrooms:     document.getElementById('el-beds').value,
    bathrooms:    document.getElementById('el-baths').value,
    garages:      document.getElementById('el-parking').value,
    floor_size:   document.getElementById('el-floor').value,
    erf_size:     document.getElementById('el-erf').value,
    description:  document.getElementById('el-desc').value,
    mandate_type: document.getElementById('el-mandate').value,
    owner_id:     document.getElementById('el-owner').value,
    contact_id:   document.getElementById('el-client').value,
    assigned_to:  document.getElementById('el-agent').value,
  };
  if (!data.title) { toast('Property title is required', 'error'); return; }
  try {
    if (editingListingId) {
      await API.put(`listings/index.php?id=${editingListingId}`, data);
      toast('Listing updated', 'success');
    } else {
      await API.post('listings/index.php', data);
      toast('Listing created', 'success');
    }
    closeModal('modal-listing');
    loadListings();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteListing(id, title) {
  if (!confirm(`Delete listing "${title}"? This cannot be undone.`)) return;
  try {
    await API.delete(`listings/index.php?id=${id}`);
    toast('Listing deleted', 'success');
    loadListings();
  } catch(e) { toast(e.message, 'error'); }
}

async function openListingDetail(id) {
  const res = await API.get(`listings/index.php?id=${id}`);
  const l   = res.data;
  toast('Listing detail view coming soon', 'default');
}

// Link client modal
let linkingListingId = null;
async function openLinkClientModal(id) {
  linkingListingId = id;
  const res = await API.get('contacts/index.php', { limit: 2000, status: 'active' });
  const sel = document.getElementById('link-client-select');
  if (sel) sel.innerHTML = '<option value="">— Select Contact —</option>' +
    res.data.map(c => `<option value="${c.id}">${esc(c.name)} ${c.phone?'· '+c.phone:''}</option>`).join('');
  openModal('modal-link-client');
}

async function saveLinkClient() {
  const contactId = document.getElementById('link-client-select')?.value;
  if (!contactId) { toast('Please select a contact', 'error'); return; }
  try {
    await API.put(`listings/index.php?id=${linkingListingId}`, { contact_id: contactId });
    toast('Client linked to listing', 'success');
    closeModal('modal-link-client');
    loadListings();
  } catch(e) { toast(e.message, 'error'); }
}

function listingModalHTML() {
  return `
  <div class="modal-overlay" id="modal-listing">
    <div class="modal" style="max-width:700px">
      <div class="modal-header">
        <div class="modal-title" id="listing-modal-title">Add Listing</div>
        <button class="modal-close" onclick="closeModal('modal-listing')">✕</button>
      </div>
      <div class="modal-body">
        <form id="listing-form">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Property Details</div>
          <div class="form-group"><label class="form-label">Property Title / Address *</label>
            <input class="form-input" id="el-title" placeholder="e.g. 14 Oak Avenue, Sandton"></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Listing Type</label>
              <select class="form-select" id="el-type" onchange="togglePriceFields(this.value)">
                <option value="Sale">Sale</option>
                <option value="Rent">Rental</option>
                <option value="Both">Both</option>
              </select></div>
            <div class="form-group"><label class="form-label">Property Type</label>
              <select class="form-select" id="el-prop-type">
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Land">Land</option>
                <option value="Mixed Use">Mixed Use</option>
              </select></div>
          </div>
          <div class="form-row-2">
            <div class="form-group" id="el-price-row"><label class="form-label">Sale Price (R)</label>
              <input class="form-input" type="number" id="el-price" placeholder="0"></div>
            <div class="form-group" id="el-rent-row" style="display:none"><label class="form-label">Monthly Rent (R)</label>
              <input class="form-input" type="number" id="el-rent" placeholder="0"></div>
            <div class="form-group"><label class="form-label">Status</label>
              <select class="form-select" id="el-status">
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Under Offer">Under Offer</option>
                <option value="Sold">Sold</option>
                <option value="Rented">Rented</option>
                <option value="Withdrawn">Withdrawn</option>
              </select></div>
          </div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Property Specs</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px">
            <div class="form-group"><label class="form-label">Bedrooms</label>
              <select class="form-select" id="el-beds">
                <option value="">—</option><option value="0">Studio</option>
                <option>1</option><option>2</option><option>3</option>
                <option>4</option><option>5</option><option>6</option>
              </select></div>
            <div class="form-group"><label class="form-label">Bathrooms</label>
              <select class="form-select" id="el-baths">
                <option value="">—</option><option>1</option><option>2</option>
                <option>3</option><option>4</option>
              </select></div>
            <div class="form-group"><label class="form-label">Parking</label>
              <select class="form-select" id="el-parking">
                <option value="">—</option><option value="0">None</option>
                <option>1</option><option>2</option><option>3</option>
              </select></div>
            <div class="form-group"><label class="form-label">Floor Size (m²)</label>
              <input class="form-input" type="number" id="el-floor" placeholder="e.g. 120"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">ERF Size</label>
              <input class="form-input" id="el-erf" placeholder="e.g. 450m²"></div>
            <div class="form-group"><label class="form-label">Mandate Type</label>
              <select class="form-select" id="el-mandate">
                <option value="Sole">Sole</option>
                <option value="Joint">Joint</option>
                <option value="Open">Open</option>
              </select></div>
          </div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Location</div>
          <div class="form-group"><label class="form-label">Full Address</label>
            <input class="form-input" id="el-address" placeholder="Street address"></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Complex / Estate</label>
              <input class="form-input" id="el-complex" placeholder="Complex name"></div>
            <div class="form-group"><label class="form-label">Unit</label>
              <input class="form-input" id="el-unit" placeholder="Unit number"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">City</label>
              <input class="form-input" id="el-city" placeholder="City / suburb"></div>
            <div class="form-group"><label class="form-label">Province</label>
              <select class="form-select" id="el-province">
                <option value="">— Select —</option>
                <option>Gauteng</option><option>Western Cape</option><option>KwaZulu-Natal</option>
                <option>Eastern Cape</option><option>Limpopo</option><option>Mpumalanga</option>
                <option>North West</option><option>Free State</option><option>Northern Cape</option>
              </select></div>
          </div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)">Assignment</div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Owner / Landlord</label>
              <select class="form-select" id="el-owner"><option value="">Loading…</option></select></div>
            <div class="form-group"><label class="form-label">Linked Client</label>
              <select class="form-select" id="el-client"><option value="">Loading…</option></select></div>
          </div>
          <div class="form-group"><label class="form-label">Assigned Agent</label>
            <select class="form-select" id="el-agent"><option value="">— Unassigned —</option></select></div>
          <div class="form-group"><label class="form-label">Description</label>
            <textarea class="form-textarea" id="el-desc" placeholder="Property description…"></textarea></div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-listing')">Cancel</button>
        <button class="btn btn-primary" onclick="saveListing()">Save Listing</button>
      </div>
    </div>
  </div>`;
}

function linkClientModalHTML() {
  return `
  <div class="modal-overlay" id="modal-link-client">
    <div class="modal" style="max-width:440px">
      <div class="modal-header">
        <div class="modal-title">Link Client to Listing</div>
        <button class="modal-close" onclick="closeModal('modal-link-client')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Select Contact</label>
          <select class="form-select" id="link-client-select"><option value="">Loading…</option></select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-link-client')">Cancel</button>
        <button class="btn btn-primary" onclick="saveLinkClient()">Link Client</button>
      </div>
    </div>
  </div>`;
}


// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!APP_USER) return;
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); navigate(item.dataset.view); });
  });
  // Agents land on My Work, others on Dashboard
  navigate(IS_AGENT ? 'mywork' : APP_USER?.role === 'platform_superadmin' ? 'platform-tenants' : 'dashboard');
  loadNotifications();
  // Load company logo
  API.get('settings/index.php').then(res => {
    const logoUrl = res?.data?.settings?.logo_url;
    if (logoUrl) {
      const img = document.getElementById('nav-logo-img');
      const txt = document.getElementById('nav-logo-text');
      if (img) { img.src = logoUrl; img.style.display = 'block'; }
      if (txt) txt.style.display = 'none';
    }
  }).catch(() => {});
});



(function(){
  const s = document.createElement('style');
  s.textContent = `.estate-layout{display:flex;gap:0;align-items:flex-start}.estate-sidebar{width:220px;flex-shrink:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg) 0 0 var(--radius-lg);position:sticky;top:52px;max-height:calc(100vh - 60px);overflow-y:auto}.estate-sidebar-hdr{padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);display:flex;justify-content:space-between;align-items:center}.estate-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:all .12s;font-size:13px}.estate-item:hover{background:var(--bg)}.estate-item.active{background:var(--accent);color:#fff}.estate-item.active .ecnt{background:rgba(255,255,255,.2);color:#fff}.ename{font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ecnt{font-size:11px;background:var(--surface-2);border-radius:10px;padding:1px 7px;color:var(--text-3);flex-shrink:0;margin-left:6px}.estate-main{flex:1;border:1px solid var(--border);border-left:none;border-radius:0 var(--radius-lg) var(--radius-lg) 0;background:var(--surface);min-width:0}.estate-mhdr{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}.estate-mbody{overflow-x:auto}`;
  document.head.appendChild(s);
})();


function buildEstateGroups(contacts) {
  const g = {};
  contacts.forEach(c => { const k = c.complex||"__none__"; (g[k]=g[k]||[]).push(c); });
  return g;
}

function renderEstateLayout() {
  estateGroups = buildEstateGroups(allContacts);
  const estates = Object.keys(estateGroups).filter(k=>k!=="__none__").sort();
  const noEst   = estateGroups["__none__"]||[];
  if (!currentEstate) currentEstate = estates.length ? estates[0] : "__none__";
  const view = document.getElementById("contacts-view");
  if (!view) return;
  view.innerHTML = `<div class="estate-layout">
    <div class="estate-sidebar">
      <div class="estate-sidebar-hdr"><span>Estates (${estates.length})</span>
        <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px" onclick="groupedByEstate=false;toggleGroupByEstate()">All</button>
      </div>
      ${estates.map(e=>{const safe=e.replace(/'/g,"&apos;");return `<div class="estate-item ${currentEstate===e?"active":""}" onclick="selectEstate(this,'${safe}')"><span class="ename">${e}</span><span class="ecnt">${estateGroups[e].length}</span></div>`;}).join("")}
      ${noEst.length?`<div class="estate-item ${currentEstate==="__none__"?"active":""}" onclick="selectEstate(this,'__none__')"><span class="ename" style="color:var(--text-3)">No Estate</span><span class="ecnt">${noEst.length}</span></div>`:""}
    </div>
    <div class="estate-main">
      <div class="estate-mhdr" id="estate-mhdr"></div>
      <div class="estate-mbody" id="estate-mbody"></div>
    </div>
  </div>`;
  selectEstate(null, currentEstate);
}

function selectEstate(el, estate) {
  currentEstate = estate;
  document.querySelectorAll(".estate-item").forEach(i => i.classList.remove("active"));
  if (el) el.classList.add("active");
  else {
    document.querySelectorAll(".estate-item").forEach(i => {
      if ((i.querySelector(".ename")||{}).textContent === (estate==="__none__"?"No Estate":estate)) i.classList.add("active");
    });
  }
  const contacts = estateGroups[estate]||[];
  const name     = estate==="__none__" ? "No Estate" : estate;
  const agents   = [...new Set(contacts.map(c=>c.assigned_name).filter(Boolean))];
  const unasgn   = contacts.filter(c=>!c.assigned_name).length;
  const hdr = document.getElementById("estate-mhdr");
  const bdy = document.getElementById("estate-mbody");
  if (!hdr||!bdy) return;
  hdr.innerHTML = `<div>
    <div style="font-size:14px;font-weight:500">${name}</div>
    <div style="font-size:12px;color:var(--text-3);margin-top:2px">${contacts.length} contacts ${agents.map(a=>`<span class="badge badge-blue" style="font-size:10px">${a.split(" ")[0]}</span>`).join(" ")} ${unasgn?`<span class="badge badge-amber" style="font-size:10px">${unasgn} unassigned</span>`:""}</div>
  </div>
  <div class="flex-gap">
    <div class="search-wrap" style="width:160px"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input class="form-input" placeholder="Search…" oninput="searchInEstate(this.value)"></div>
    ${estate!=="__none__"?`<button class="btn btn-ghost btn-sm" onclick="openAssignComplexModal('${name}',${contacts.length})">Reassign All</button>`:""}
    <button class="btn btn-primary btn-sm" onclick="openContactModal()">+ Add</button>
  </div>`;
  bdy.innerHTML = '<div style="overflow-x:auto">' + renderEstateTable(contacts) + '</div>';
}

function renderEstateTable(contacts) {
  if (!contacts.length) return `<div class="empty" style="padding:60px"><div class="empty-text">No contacts</div></div>`;
  return `<table style="width:100%;min-width:800px;border-collapse:collapse;font-size:13px">
    <thead style="position:sticky;top:0;background:var(--surface);z-index:1"><tr>
      <th style="padding:10px 12px;width:36px;border-bottom:1px solid var(--border)"><input type="checkbox" onclick="toggleSelectAll(this)"></th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);border-bottom:1px solid var(--border)">Name</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);border-bottom:1px solid var(--border)">Type</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);border-bottom:1px solid var(--border)">Phone</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);border-bottom:1px solid var(--border)">Email</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);border-bottom:1px solid var(--border)">Agent</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);border-bottom:1px solid var(--border)">FICA</th>
      <th style="padding:10px 12px;border-bottom:1px solid var(--border);width:80px"></th>
    </tr></thead>
    <tbody>${contacts.map(c=>`<tr style="border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
      <td style="padding:8px 12px"><input type="checkbox" class="contact-checkbox" value="${c.id}" onchange="toggleContact(this)"></td>
      <td style="padding:8px 12px"><div style="font-weight:500;cursor:pointer;color:var(--blue)" onclick="viewContact(${c.id})">${esc(c.name)}</div>
        ${c.unit&&c.unit!=='0'?`<div style="font-size:11px;color:var(--text-3)">Unit ${esc(c.unit)}${c.erf?' · ERF '+esc(c.erf):''}</div>`:''}
      </td>
      <td style="padding:8px 12px"><span class="badge badge-gray" style="font-size:10px">${esc(c.type||'—')}</span></td>
      <td style="padding:8px 12px">${c.phone?`<a href="tel:${esc(c.phone)}" style="color:var(--blue);font-size:12px">${esc(c.phone)}</a>`:"—"}</td>
      <td style="padding:8px 12px;font-size:12px">${c.email?`<a href="mailto:${esc(c.email)}" style="color:var(--blue)">${esc(c.email)}</a>`:"—"}</td>
      <td style="padding:8px 12px">${c.assigned_name?`<span class="badge badge-blue" style="cursor:pointer;font-size:10px" onclick="openAssignModal(${c.id},'${c.name.replace(/'/g,"&apos;")}')">&#128100; ${c.assigned_name.split(" ")[0]}</span>`:`<button class="btn btn-ghost btn-sm" onclick="openAssignModal(${c.id},'${c.name.replace(/'/g,"&apos;")}')">Assign</button>`}</td>
      <td style="padding:8px 12px"><span class="badge ${{"pending":"badge-gray","partial":"badge-amber","complete":"badge-green","expired":"badge-red"}[c.fica_status]||"badge-gray"}">${c.fica_status}</span></td>
      <td style="padding:8px 12px"><div style="display:flex;gap:4px">
        <button class="btn btn-sm btn-ghost" onclick="openQuickView(${c.id},(estateGroups[currentEstate]||[]).map(x=>x.id))">View</button>
        <button class="btn btn-sm btn-ghost" onclick="openContactModal(${c.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteContact(${c.id},'${c.name.replace(/'/g,"&apos;")}')">Del</button>
      </div></td>
    </tr>`).join("")}</tbody></table>`;
}

function searchInEstate(q) {
  const all = estateGroups[currentEstate]||[];
  const f = q ? all.filter(c=>(c.name||"").toLowerCase().includes(q.toLowerCase())||(c.phone||"").includes(q)||(c.email||"").toLowerCase().includes(q.toLowerCase())||(c.erf||"").includes(q)) : all;
  const bdy = document.getElementById("estate-mbody");
  if (bdy) bdy.innerHTML = renderEstateTable(f);
}


// ── BULK SELECTION & ACTIONS ─────────────────────────────────

function toggleSelectAll(cb) {
  document.querySelectorAll('.contact-checkbox').forEach(b => {
    b.checked = cb.checked;
    if (cb.checked) selectedContacts.add(parseInt(b.value));
    else selectedContacts.delete(parseInt(b.value));
  });
  updateBulkBar();
}

function toggleContact(cb) {
  if (cb.checked) selectedContacts.add(parseInt(cb.value));
  else selectedContacts.delete(parseInt(cb.value));
  // Sync select-all checkbox
  const all = document.querySelectorAll('.contact-checkbox');
  const allCb = document.getElementById('select-all-cb');
  if (allCb) allCb.checked = all.length > 0 && [...all].every(b => b.checked);
  updateBulkBar();
}

function updateBulkBar() {
  const bar   = document.getElementById('bulk-info-bar');
  const txt   = document.getElementById('bulk-count-text');
  const btnA  = document.getElementById('btn-bulk-assign');
  const btnD  = document.getElementById('btn-bulk-delete');
  const n = selectedContacts.size;
  if (n > 0) {
    if (bar) { bar.style.display = 'flex'; }
    if (txt) txt.textContent = n + ' contact' + (n===1?'':'s') + ' selected';
    if (btnA) btnA.style.display = '';
    if (btnD) btnD.style.display = '';
  } else {
    if (bar) bar.style.display = 'none';
    if (btnA) btnA.style.display = 'none';
    if (btnD) btnD.style.display = 'none';
  }
}

function clearBulkSelection() {
  selectedContacts.clear();
  document.querySelectorAll('.contact-checkbox').forEach(b => b.checked = false);
  const allCb = document.getElementById('select-all-cb');
  if (allCb) allCb.checked = false;
  updateBulkBar();
}

async function bulkDelete() {
  if (!selectedContacts.size) return;
  if (!confirm(`Delete ${selectedContacts.size} contact(s)? This cannot be undone.`)) return;
  const ids = [...selectedContacts].join(',');
  try {
    const res = await fetch('/crm/api/contacts/index.php?bulk_delete=1', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedContacts] })
    });
    const json = await res.json();
    selectedContacts.clear();
    toast((json.data?.deleted || 0) + ' contact(s) deleted', 'success');
    allContacts = [];
    loadContacts(true);
  } catch(e) { toast(e.message, 'error'); }
}

async function bulkChangeType() {
  if (!selectedContacts.size) return;
  const type = document.getElementById('bulk-type-select')?.value;
  if (!type) { toast('Please select a type first', 'error'); return; }
  let done = 0;
  for (const id of selectedContacts) {
    try { await API.put(`contacts/index.php?id=${id}`, { type }); done++; } catch(e) {}
  }
  toast(`${done} contact(s) updated to ${type}`, 'success');
  clearBulkSelection();
  loadContacts();
}

// ── ASSIGN TO AGENT ──────────────────────────────────────────
let assigningContactId = null;
let assigningComplex   = null;

async function openAssignModal(id, name) {
  assigningContactId = id;
  assigningComplex   = null;
  document.getElementById('assign-modal-title').textContent = 'Assign — ' + name;
  document.getElementById('assign-hint').textContent = '';
  await loadAgentOptions('assign-agent-select');
  openModal('modal-assign');
}

async function openBulkAssignModal() {
  if (!selectedContacts.size) return;
  assigningContactId = null;
  assigningComplex   = null;
  document.getElementById('assign-modal-title').textContent = 'Assign ' + selectedContacts.size + ' Contact(s)';
  document.getElementById('assign-hint').textContent = selectedContacts.size + ' contacts will be assigned to the selected agent.';
  await loadAgentOptions('assign-agent-select');
  openModal('modal-assign');
}

async function openAssignComplexModal(complex, count) {
  assigningContactId = null;
  assigningComplex   = complex;
  document.getElementById('assign-modal-title').textContent = 'Reassign Estate — ' + complex;
  document.getElementById('assign-hint').textContent = 'All ' + count + ' contacts in this estate will be reassigned.';
  await loadAgentOptions('assign-agent-select');
  openModal('modal-assign');
}

async function loadAgentOptions(selectId) {
  try {
    const res = await API.get('users/index.php');
    const agents = res.data.filter(u => u.role === 'agent');
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select Agent —</option>' +
      '<option value="unassign">⊘ Unassigned (remove agent)</option>' +
      agents.map(a => `<option value="${a.id}">${esc(a.name)} (${a.role.replace('_',' ')})</option>`).join('');
  } catch(e) {}
}

async function saveAssign() {
  const agentId = document.getElementById('assign-agent-select')?.value;
  if (!agentId) { toast('Please select an agent or Unassigned', 'error'); return; }
  const actualAgentId = agentId === 'unassign' ? null : agentId;
  const complexToSet = currentEstate && currentEstate !== '__none__' ? currentEstate : null;
  try {
    if (assigningComplex) {
      // Reassign whole complex/estate
      let done = 0;
      for (const c of allContacts.filter(c => c.complex === assigningComplex)) {
        await API.put(`contacts/index.php?id=${c.id}`, { assigned_to: actualAgentId });
        done++;
      }
      toast(`${done} contacts in ${assigningComplex} reassigned`, 'success');
    } else if (assigningContactId) {
      // Single contact
      const updateData = { assigned_to: actualAgentId };
    if (complexToSet) updateData.complex = complexToSet;
    await API.put(`contacts/index.php?id=${assigningContactId}`, updateData);
      toast('Contact assigned', 'success');
    } else {
      // Bulk selected
      let done = 0;
      for (const id of selectedContacts) {
        await API.put(`contacts/index.php?id=${id}`, { assigned_to: actualAgentId });
        done++;
      }
      toast(`${done} contacts assigned`, 'success');
      clearBulkSelection();
    }
    closeModal('modal-assign');
    allContacts = []; // clear cache
    loadContacts(true);
  } catch(e) { toast(e.message, 'error'); }
}

function importModalHTML() {
  return `
  <div class="modal-overlay" id="modal-import">
    <div class="modal" style="max-width:750px">
      <div class="modal-header">
        <div class="modal-title">Import Contacts</div>
        <button class="modal-close" onclick="closeModal('modal-import')">✕</button>
      </div>
      <div class="modal-body">
        <div id="import-step-1">
          <div style="font-size:13px;color:var(--text-2);margin-bottom:16px">Upload an Excel (.xlsx) or CSV file. Supported columns: Name, Phone, Email, ID Number.</div>
          <div style="border:2px dashed var(--border);border-radius:12px;padding:40px;text-align:center;cursor:pointer" onclick="document.getElementById('import-file-input').click()">
            <div style="font-size:32px;margin-bottom:8px">📂</div>
            <div style="font-weight:500">Click to select file</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:4px">.xlsx or .csv files only</div>
          </div>
          <input type="file" id="import-file-input" style="display:none" accept=".xlsx,.xls,.csv" onchange="previewImport(this)">
          <div id="import-preview-area"></div>
        </div>
        <div id="import-step-2" style="display:none"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-import')">Cancel</button>
        <button class="btn btn-ghost" onclick="document.getElementById('import-step-1').style.display='';document.getElementById('import-step-2').style.display='none';document.getElementById('import-btn').style.display='none'">← Back</button>
        <button class="btn btn-primary" id="import-btn" onclick="runImport()" style="display:none">Import</button>
      </div>
    </div>
  </div>`;
}

let importHeaders = [];
let importTotalRows = 0;
let importFile = null;
let importEstateName = '';

function openImportModal() {
  importHeaders = []; importTotalRows = 0; importFile = null;
  if (!document.getElementById('modal-import')) {
    const div = document.createElement('div');
    div.innerHTML = importModalHTML();
    document.body.appendChild(div.firstElementChild);
  }
  document.getElementById('import-step-1').style.display = '';
  document.getElementById('import-step-2').style.display = 'none';
  document.getElementById('import-preview-area').innerHTML = '';
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-btn').style.display = 'none';
  openModal('modal-import');
}

async function previewImport(input) {
  const file = input.files[0];
  if (!file) return;
  importFile = file;
  // Auto-detect estate name from filename
  const rawName = file.name.replace(/\.[^.]+$/, ''); // remove extension
  const autoEstate = rawName
    .replace(/[-_]/g, ' ')           // underscores/hyphens to spaces
    .replace(/\s+/g, ' ')            // collapse spaces
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase()); // Title Case
  importEstateName = autoEstate;
  const formData = new FormData();
  formData.append('file', file);
  document.getElementById('import-preview-area').innerHTML = '<div style="text-align:center;padding:20px">Reading file…</div>';
  try {
    const res = await fetch('/crm/api/contacts/import.php?action=preview', {
      method: 'POST', credentials: 'same-origin', body: formData
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    importHeaders   = json.data.headers;
    importTotalRows = json.data.total_rows;
    const opts = '<option value="">— Skip —</option>' + importHeaders.map(h => `<option value="${h}">${h}</option>`).join('');
    const autoMap = (kws) => importHeaders.find(h => kws.some(k => h.toLowerCase().includes(k))) || '';
    const nameCol  = autoMap(['name','full']);
    const phoneCol = autoMap(['phone','contact','mobile','cell']);
    const emailCol = autoMap(['email','mail']);
    const idCol    = autoMap(['id','identifier','idnum']);
    const erfCol   = autoMap(['erf','stand','plot']);
    const unitCol  = autoMap(['unit','flat','apt']);
    const sizeCol  = autoMap(['size','m2','sqm','extent']);

    const makeOpts = (sel) => importHeaders.map(h =>
      `<option value="${h}"${h===sel?' selected':''}>${h}</option>`
    ).join('');

    document.getElementById('import-step-1').style.display = 'none';
    document.getElementById('import-step-2').style.display = '';
    document.getElementById('import-step-2').innerHTML = `
      <div style="font-size:13px;color:var(--text-2);margin-bottom:12px">
        Found <strong>${importTotalRows}</strong> rows in <strong>${file.name}</strong>. Map columns below.
      </div>
      <div class="form-row-2">
        <div class="form-group"><label class="form-label">Name Column *</label>
          <select class="form-select" id="map-name"><option value="">— Skip —</option>${makeOpts(nameCol)}</select></div>
        <div class="form-group"><label class="form-label">Phone Column</label>
          <select class="form-select" id="map-phone"><option value="">— Skip —</option>${makeOpts(phoneCol)}</select></div>
      </div>
      <div class="form-row-2">
        <div class="form-group"><label class="form-label">Email Column</label>
          <select class="form-select" id="map-email"><option value="">— Skip —</option>${makeOpts(emailCol)}</select></div>
        <div class="form-group"><label class="form-label">ID Number Column</label>
          <select class="form-select" id="map-id"><option value="">— Skip —</option>${makeOpts(idCol)}</select></div>
      </div>
      <div class="form-row-2">
        <div class="form-group"><label class="form-label">ERF Column</label>
          <select class="form-select" id="map-erf"><option value="">— Skip —</option>${makeOpts(erfCol)}</select></div>
        <div class="form-group"><label class="form-label">Unit Column</label>
          <select class="form-select" id="map-unit"><option value="">— Skip —</option>${makeOpts(unitCol)}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Size Column</label>
        <select class="form-select" id="map-size" style="width:200px"><option value="">— Skip —</option>${makeOpts(sizeCol)}</select></div>
      <div class="form-group" style="margin-top:4px"><label class="form-label">Estate / Complex Name <span style="color:var(--text-3);font-size:11px">(applies to ALL imported contacts)</span></label>
        <input class="form-input" id="map-estate" placeholder="e.g. Midrand Village"></div>
      <div class="form-row-2">
        <div class="form-group"><label class="form-label">Default Contact Type</label>
          <select class="form-select" id="map-default-type">
            <option value="Lead">Lead</option><option value="Owner">Owner</option>
            <option value="Tenant">Tenant</option><option value="Landlord">Landlord</option>
            <option value="Buyer">Buyer</option><option value="Other">Other</option>
          </select></div>
        <div class="form-group"><label class="form-label">Limit rows (0 = all)</label>
          <input class="form-input" type="number" id="map-limit" value="0" min="0" placeholder="0 = import all"></div>
      </div>
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin:12px 0 8px">Preview (first 5 rows)</div>
      <div class="table-wrap" style="font-size:12px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <table>
          <thead><tr>${importHeaders.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${json.data.preview.map(row=>`<tr>${importHeaders.map(h=>`<td>${row[h]||''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`;
    document.getElementById('import-btn').style.display = '';
    // Pre-fill estate name from filename
    const estateInput = document.getElementById('map-estate');
    if (estateInput && !estateInput.value) estateInput.value = importEstateName;
  } catch(e) {
    document.getElementById('import-preview-area').innerHTML = `<div style="color:var(--red);padding:12px">${e.message}</div>`;
    toast(e.message, 'error');
  }
}

async function runImport() {
  const mapName = document.getElementById('map-name')?.value;
  if (!mapName) { toast('Please select the Name column', 'error'); return; }
  const formData = new FormData();
  formData.append('file',           importFile);
  formData.append('map_name',       mapName);
  formData.append('map_phone',      document.getElementById('map-phone')?.value || '');
  formData.append('map_email',      document.getElementById('map-email')?.value || '');
  formData.append('map_id',         document.getElementById('map-id')?.value || '');
  formData.append('map_erf',        document.getElementById('map-erf')?.value || '');
  formData.append('map_unit',       document.getElementById('map-unit')?.value || '');
  formData.append('map_size',       document.getElementById('map-size')?.value || '');
  const estateEl = document.getElementById('map-estate');
  const estateVal = estateEl ? (estateEl.value.trim() || importEstateName) : importEstateName;
  console.log('Estate name being sent:', estateVal);
  formData.append('estate_name', estateVal);
  formData.append('default_type',   document.getElementById('map-default-type')?.value || 'Lead');
  formData.append('limit',          document.getElementById('map-limit')?.value || '0');
  const btn = document.getElementById('import-btn');
  btn.textContent = 'Importing…'; btn.disabled = true;
  try {
    const res = await fetch('/crm/api/contacts/import.php?action=import', {
      method: 'POST', credentials: 'same-origin', body: formData
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    toast(`✅ ${json.data.imported} contacts imported${json.data.skipped ? ', ' + json.data.skipped + ' skipped' : ''}`, 'success');
    closeModal('modal-import');
    allContacts = [];
    loadContacts(true);
  } catch(e) {
    toast(e.message, 'error');
  } finally {
    if (btn) { btn.textContent = 'Import'; btn.disabled = false; }
  }
}

function bulkAssignModalHTML() {
  return `
  <div class="modal-overlay" id="modal-assign">
    <div class="modal" style="max-width:440px">
      <div class="modal-header">
        <div class="modal-title" id="assign-modal-title">Assign Contact</div>
        <button class="modal-close" onclick="closeModal('modal-assign')">✕</button>
      </div>
      <div class="modal-body">
        <div id="assign-hint" style="font-size:13px;color:var(--text-2);margin-bottom:12px"></div>
        <div class="form-group">
          <label class="form-label">Select Agent</label>
          <select class="form-select" id="assign-agent-select">
            <option value="">Loading agents…</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-assign')">Cancel</button>
        <button class="btn btn-primary" onclick="saveAssign()">Assign</button>
      </div>
    </div>
  </div>`;
}

// ── ESTATE/COMPLEX GROUPING ──────────────────────────────────
function toggleGroupByEstate() {
  groupedByEstate = !groupedByEstate;
  const btn = document.getElementById('btn-group-estate');
  if (btn) {
    btn.style.background  = groupedByEstate ? 'var(--accent)' : '';
    btn.style.color       = groupedByEstate ? '#fff' : '';
    btn.style.borderColor = groupedByEstate ? 'var(--accent)' : '';
    btn.textContent = groupedByEstate ? 'Flat View' : 'By Estate';
  }
  if (groupedByEstate) { currentEstate = null; renderEstateLayout(); }
  else {
    const view = document.getElementById('contacts-view');
    if (view) view.innerHTML = `<div class="card desktop-only"><div class="table-wrap"><table>
      <thead><tr><th style="width:36px"><input type="checkbox" onclick="toggleSelectAll(this)"></th>
      <th>Name</th><th>Type</th><th>Phone</th><th>Email</th><th>Agent</th><th>FICA</th><th style="width:90px"></th></tr></thead>
      <tbody id="contacts-tbody">${renderContactRows(allContacts)}</tbody></table></div></div>
      <div class="mobile-only" id="contacts-mobile">${renderContactCards(allContacts)}</div>`;
  }
}


function renderEstateGroupView(contacts) {
  const view = document.getElementById('contacts-view');
  if (!view) return;

  // Group by complex
  const groups = {};
  const noEstate = [];
  contacts.forEach(c => {
    if (c.complex) {
      (groups[c.complex] = groups[c.complex] || []).push(c);
    } else {
      noEstate.push(c);
    }
  });

  const estateCards = Object.keys(groups).sort().map(estate => {
    const list = groups[estate];
    const agents = [...new Set(list.map(c => c.assigned_name).filter(Boolean))];
    const unassigned = list.filter(c => !c.assigned_name).length;
    return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div>
          <div class="card-title">${esc(estate)}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px">
            ${list.length} contact${list.length!==1?'s':''} ·
            ${agents.length ? 'Agents: ' + agents.map(a=>`<span class="badge badge-blue" style="font-size:10px">${esc(a.split(' ')[0])}</span>`).join(' ') : ''}
            ${unassigned ? `<span class="badge badge-amber" style="font-size:10px">${unassigned} unassigned</span>` : ''}
          </div>
        </div>
        <div class="flex-gap">
          <button class="btn btn-ghost btn-sm" onclick="openAssignComplexModal('${esc(estate)}', ${list.length})">Reassign Estate</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleEstateTable('estate-${esc(estate).replace(/[^a-z0-9]/gi,'_')}')">Toggle</button>
        </div>
      </div>
      <div id="estate-${esc(estate).replace(/[^a-z0-9]/gi,'_')}" class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Unit</th><th>Phone</th><th>Email</th><th>Agent</th><th>FICA</th><th></th></tr></thead>
          <tbody>${list.map(c=>`
          <tr>
            <td><div style="cursor:pointer;color:var(--blue);font-weight:500" onclick="viewContact(${c.id})">${esc(c.name)}</div></td>
            <td style="font-size:12px;color:var(--text-3)">${esc(c.unit||'—')}</td>
            <td>${c.phone?`<a href="tel:${c.phone}" style="color:var(--blue)">${esc(c.phone)}</a>`:'—'}</td>
            <td style="font-size:12px">${c.email?`<a href="mailto:${c.email}" style="color:var(--blue)">${esc(c.email)}</a>`:'—'}</td>
            <td>${c.assigned_name?`<span class="badge badge-blue">${esc(c.assigned_name.split(' ')[0])}</span>`:'<span class="badge badge-gray">Unassigned</span>'}</td>
            <td><span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span></td>
            <td><button class="btn btn-ghost btn-sm" onclick="openAssignModal(${c.id},'${esc(c.name)}')">Assign</button></td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  view.innerHTML = estateCards + (noEstate.length ? `
    <div class="card">
      <div class="card-header"><div class="card-title">No Estate / Complex</div><span class="badge badge-gray">${noEstate.length}</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Type</th><th>Phone</th><th>Agent</th><th>FICA</th><th></th></tr></thead>
        <tbody>${noEstate.map(c=>`
        <tr>
          <td><div style="cursor:pointer;color:var(--blue);font-weight:500" onclick="viewContact(${c.id})">${esc(c.name)}</div></td>
          <td><span class="badge badge-gray">${c.type}</span></td>
          <td>${c.phone?`<a href="tel:${c.phone}" style="color:var(--blue)">${esc(c.phone)}</a>`:'—'}</td>
          <td>${c.assigned_name?`<span class="badge badge-blue">${esc(c.assigned_name.split(' ')[0])}</span>`:'<span class="badge badge-gray">Unassigned</span>'}</td>
          <td><span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span></td>
          <td><button class="btn btn-ghost btn-sm" onclick="openAssignModal(${c.id},'${esc(c.name)}')">Assign</button></td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : '');
}

function toggleEstateTable(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}



// ── QUICK VIEW POPUP ─────────────────────────────────────────
let qvList = [];
let qvIndex = 0;

function openQuickView(id, list) {
  if (!document.getElementById('modal-quick-view')) {
    const div = document.createElement('div');
    div.innerHTML = quickViewModalHTML();
    document.body.appendChild(div.firstElementChild);
  }
  qvList  = list || allContacts.map(c => c.id);
  qvIndex = qvList.indexOf(id);
  if (qvIndex === -1) { qvList = [id]; qvIndex = 0; }
  fillQuickView(id);
  openModal('modal-quick-view');
}

function fillQuickView(id) {
  let c = allContacts.find(c => c.id === id);
  if (!c) {
    // Try loading from API
    API.get(`contacts/index.php?id=${id}`).then(res => {
      if (res.data) {
        allContacts.push(res.data);
        fillQuickView(id);
      }
    });
    return;
  }
  currentContactId = id;

  const initials = (c.name||'?').substring(0,2).toUpperCase();
  document.getElementById('qv-avatar').textContent  = initials;
  document.getElementById('qv-name').textContent    = c.name;
  document.getElementById('qv-complex').textContent = [c.complex, c.unit ? 'Unit ' + c.unit : ''].filter(Boolean).join(' · ');
  document.getElementById('qv-phone').innerHTML     = c.phone ? `<a href="tel:${c.phone}" style="color:var(--blue)">${esc(c.phone)}</a>` : '—';
  document.getElementById('qv-id').textContent      = c.id_number || '—';
  document.getElementById('qv-property').textContent = c.complex || '—';
  const qvUnit = document.getElementById('qv-unit');
  if (qvUnit) qvUnit.textContent = c.unit && c.unit !== '0' ? 'Unit ' + c.unit + (c.erf ? ' · ERF ' + c.erf : '') : '—';
  document.getElementById('qv-size').textContent    = c.size || '—';
  document.getElementById('qv-note').value          = '';
  document.getElementById('qv-sched-notes').value   = '';
  document.getElementById('qv-sched-date').value    = '';

  // Counter
  document.getElementById('qv-counter').textContent = `${qvIndex + 1} / ${qvList.length}`;
  document.getElementById('qv-prev').disabled = qvIndex === 0;
  document.getElementById('qv-next').disabled = qvIndex === qvList.length - 1;
}

function quickViewNav(dir) {
  qvIndex = Math.max(0, Math.min(qvList.length - 1, qvIndex + dir));
  fillQuickView(qvList[qvIndex]);
}

async function saveQuickNote() {
  const note = document.getElementById('qv-note')?.value?.trim();
  if (!note || !currentContactId) return;
  try {
    await API.put(`contacts/index.php?id=${currentContactId}`, { notes: note });
    toast('Note saved', 'success');
    document.getElementById('qv-note').value = '';
  } catch(e) { toast(e.message, 'error'); }
}

function quickViewModalHTML() {
  return `
  <div class="modal-overlay" id="modal-quick-view">
    <div class="modal" style="max-width:480px">
      <!-- Top nav bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--bg);border-radius:var(--radius-lg) var(--radius-lg) 0 0">
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-ghost btn-sm" id="qv-prev" onclick="quickViewNav(-1)">← Prev</button>
          <span id="qv-counter" style="font-size:12px;color:var(--text-3);min-width:50px;text-align:center"></span>
          <button class="btn btn-primary btn-sm" id="qv-next" onclick="quickViewNav(1)">Next →</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="closeModal('modal-quick-view');viewContact(currentContactId)">Full Detail →</button>
          <button class="modal-close" onclick="closeModal('modal-quick-view')">✕</button>
        </div>
      </div>
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border)">
        <div class="avatar" id="qv-avatar" style="width:40px;height:40px;font-size:14px;flex-shrink:0"></div>
        <div>
          <div style="font-size:15px;font-weight:500;cursor:pointer;color:var(--blue)" id="qv-name" onclick="closeModal('modal-quick-view');viewContact(currentContactId)"></div>
          <div style="font-size:12px;color:var(--text-3)" id="qv-complex"></div>
        </div>
      </div>
      <!-- Body -->
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div><div class="form-label">Phone</div><div id="qv-phone" style="font-size:13px;margin-top:4px"></div></div>
          <div><div class="form-label">ID Number</div><div id="qv-id" style="font-size:13px;margin-top:4px"></div></div>
          <div><div class="form-label">Property / Unit</div><div id="qv-property" style="font-size:13px;margin-top:4px"></div></div>
          <div><div class="form-label">Size</div><div id="qv-size" style="font-size:13px;margin-top:4px"></div></div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:16px;margin-bottom:16px">
          <div class="form-label" style="margin-bottom:6px">Quick Note</div>
          <textarea class="form-textarea" id="qv-note" placeholder="Log a note…" style="width:100%;height:60px;margin-bottom:8px"></textarea>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-primary btn-sm" onclick="saveQuickNote()">Save Note</button>
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:16px">
          <div class="form-label" style="margin-bottom:8px">Schedule Callback / Reminder</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <select class="form-select" id="qv-sched-type">
              <option>Call</option><option>Meeting</option><option>Site Visit</option><option>Follow-up</option><option>Video Call</option>
            </select>
            <input class="form-input" type="datetime-local" id="qv-sched-date">
          </div>
          <input class="form-input" id="qv-sched-notes" placeholder="e.g. Client asked to call back at 10:00" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between">
            <button class="btn btn-ghost btn-sm" onclick="closeModal('modal-quick-view');viewContact(currentContactId)">Full Detail →</button>
            <button class="btn btn-ghost btn-sm" onclick="toast('Reminder scheduled','success')">Schedule Reminder</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}


// ── CONTACT DETAIL VIEW ──────────────────────────────────────
let currentContactId = null;

async function viewContact(id) {
  currentContactId = id;
  const loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';
  try {
    const [contactRes, dealsRes, leasesRes, invoicesRes] = await Promise.all([
      API.get(`contacts/index.php?id=${id}`),
      API.get('deals/index.php', { contact_id: id }),
      API.get('leases/index.php', { contact_id: id }),
      CAN_INVOICE ? API.get('invoices/index.php', { contact_id: id }) : Promise.resolve({data:[]})
    ]);
    const c = contactRes.data;
    c._deals    = dealsRes.data || [];
    c._leases   = leasesRes.data || [];
    c._invoices = invoicesRes.data || [];
    renderContactDetail(c);
  } catch(e) {
    toast('Failed to load contact', 'error');
  } finally {
    if (loader) loader.style.display = 'none';
  }
}
function renderContactDetail(c) {
  const initials = (c.name||'?').substring(0,2).toUpperCase();
  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-actions">
        <button class="btn btn-ghost btn-sm" onclick="loadContacts()">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="width:14px;height:14px"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <button class="btn btn-ghost btn-sm" onclick="navigateContact(-1)">← Prev</button>
        <button class="btn btn-ghost btn-sm" onclick="navigateContact(1)">Next →</button>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-ghost btn-sm" onclick="openContactModal(${c.id})">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="btn btn-primary btn-sm" onclick="switchContactDetailTab('tab-message')">Send Email</button>
      </div>
    </div>
    <div class="content" style="padding:20px">
      <div style="display:flex;gap:20px;align-items:flex-start">

        <!-- LEFT: Main profile + tabs -->
        <div style="flex:1;min-width:0">
          <div class="card" style="margin-bottom:16px">
            <!-- Stats bar -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--border)">
              <div style="padding:16px;text-align:center;border-right:1px solid var(--border);cursor:pointer" onclick="navigate('deals')">
                <div style="font-size:22px;font-weight:300;font-family:'DM Mono',monospace">${(c._deals||[]).length}</div>
                <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em">Deals</div>
              </div>
              <div style="padding:16px;text-align:center;border-right:1px solid var(--border);cursor:pointer" onclick="navigate('leases')">
                <div style="font-size:22px;font-weight:300;font-family:'DM Mono',monospace">${(c._leases||[]).length}</div>
                <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em">Leases</div>
              </div>
              <div style="padding:16px;text-align:center;border-right:1px solid var(--border);cursor:pointer">
                <div style="font-size:22px;font-weight:300;font-family:'DM Mono',monospace">${(c._invoices||[]).length}</div>
                <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em">Invoices</div>
              </div>
              <div style="padding:16px;text-align:center;cursor:pointer">
                <div style="font-size:22px;font-weight:300;font-family:'DM Mono',monospace">${(c.documents||[]).length}</div>
                <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em">Documents</div>
              </div>
            </div>
            <div class="card-body">
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
                <div class="avatar" style="width:52px;height:52px;font-size:18px;flex-shrink:0">${initials}</div>
                <div>
                  <div style="font-size:18px;font-weight:500">${esc(c.name)}</div>
                  <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">
                    <span class="badge badge-blue">${c.type}</span>
                    <span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span>
                    ${c.source ? `<span style="font-size:12px;color:var(--text-3)">${esc(c.source)}</span>` : ''}
                  </div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                ${detailField('Phone', c.phone ? `<a href="tel:${c.phone}" style="color:var(--blue)">${esc(c.phone)}</a>` : '—')}
                ${detailField('Alt Phone', c.phone2 ? `<a href="tel:${c.phone2}" style="color:var(--blue)">${esc(c.phone2)}</a>` : '—')}
                ${detailField('Email', c.email ? `<a href="mailto:${c.email}" style="color:var(--blue)">${esc(c.email)}</a>` : '—')}
                ${detailField('ID Number', c.id_number || '—')}
                ${detailField('Date of Birth', c.dob || '—')}
                ${detailField('Complex / Estate', c.complex || '—')}
                ${detailField('Unit', c.unit || '—')}
                ${detailField('ERF / Stand', c.erf || '—')}
                ${detailField('Portion', c.portion || '—')}
                ${detailField('Size', c.size || '—')}
                ${detailField('Province', c.province || '—')}
                ${detailField('Agent', c.assigned_name || '<span style="color:var(--text-3)">Unassigned</span>')}
                ${detailField('Onsite Contact', c.onsite_name ? `${esc(c.onsite_name)} ${c.onsite_phone ? '· ' + esc(c.onsite_phone) : ''}` : '—')}
                ${detailField('Tag', c.tag ? `<span class="badge badge-blue">${esc(c.tag)}</span>` : '—')}
              </div>
            </div>
          </div>

          <!-- Activity tabs -->
          <div class="card">
            <div class="tabs" style="padding:0 20px">
              <div class="tab active" id="det-tab-note" onclick="switchContactDetailTab('tab-note', this)">Log Note</div>
              <div class="tab" id="det-tab-message" onclick="switchContactDetailTab('tab-message', this)">Send Email</div>
              <div class="tab" id="det-tab-schedule" onclick="switchContactDetailTab('tab-schedule', this)">Schedule Activity</div>
            </div>

            <div id="tab-note" class="tab-panel active" style="padding:20px">
              <textarea class="form-textarea" id="internal-note-input" placeholder="Log a call note, meeting outcome, or any update…" style="width:100%;margin-bottom:8px"></textarea>
              <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
                <button class="btn btn-primary btn-sm" onclick="saveContactNote(${c.id})">Add Note</button>
              </div>
              <div id="notes-list" style="border-top:1px solid var(--border);padding-top:16px">
                ${(c.notes && c.notes.trim()) ? `<div style="padding:12px;background:var(--bg);border-radius:8px;font-size:13px;color:var(--text-2);white-space:pre-wrap">${esc(c.notes)}</div>` : '<div style="color:var(--text-3);font-size:13px">No notes yet</div>'}
              </div>
            </div>

            <div id="tab-message" class="tab-panel" style="padding:20px">
              <div class="form-group"><label class="form-label">To</label><input class="form-input" id="msg-to" value="${esc(c.email||'')}"></div>
              <div class="form-group"><label class="form-label">Subject</label><input class="form-input" id="msg-subject" placeholder="Subject"></div>
              <div class="form-group"><label class="form-label">Message</label><textarea class="form-textarea" id="msg-body" placeholder="Email content…" style="min-height:100px"></textarea></div>
              <div style="display:flex;justify-content:flex-end;gap:8px">
                <button class="btn btn-ghost btn-sm">Attach File</button>
                <button class="btn btn-primary btn-sm">Send Email</button>
              </div>
            </div>

            <div id="tab-schedule" class="tab-panel" style="padding:20px">
              <div class="form-row-2">
                <div class="form-group"><label class="form-label">Activity Type</label>
                  <select class="form-select" id="sched-type">
                    <option>Call</option><option>Meeting</option><option>Site Visit</option><option>Follow-up</option><option>Video Call</option>
                  </select>
                </div>
                <div class="form-group"><label class="form-label">Date & Time</label><input class="form-input" type="datetime-local" id="sched-date"></div>
              </div>
              <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="sched-notes" placeholder="What needs to happen…"></textarea></div>
              <div style="display:flex;justify-content:flex-end">
                <button class="btn btn-primary btn-sm" onclick="scheduleActivity(${c.id})">Schedule</button>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: FICA & Documents -->
        <div style="width:260px;flex-shrink:0">
          <div class="card" style="margin-bottom:16px">
            <div class="card-header">
              <div class="card-title">FICA Status</div>
              <span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span>
            </div>
            <div style="padding:12px 16px">
              ${ficaItem('ID Document', c.documents, 'ID Copy')}
              ${ficaItem('Proof of Address', c.documents, 'Proof of Address')}
              ${ficaItem('Bank Statement', c.documents, 'Bank Statement')}
            </div>
            <div style="padding:0 16px 16px">
              <select class="form-select" id="doc-type-select" style="margin-bottom:8px">
                <option value="ID Copy">ID Copy</option>
                <option value="Proof of Address">Proof of Address</option>
                <option value="Bank Statement">Bank Statement</option>
                <option value="Lease Agreement">Lease Agreement</option>
                <option value="Other">Other</option>
              </select>
              <button class="btn btn-ghost btn-sm" style="width:100%" onclick="document.getElementById('doc-upload-input').click()">+ Upload Document</button>
              <input type="file" id="doc-upload-input" style="display:none" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onchange="uploadContactDoc(this)">
            </div>
          </div>

          <div class="card">
            <div class="card-header"><div class="card-title">Documents</div></div>
            <div style="padding:12px 16px" id="documents-list">
              ${renderDocumentsList(c.documents||[])}
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Upload overlay -->
    <div id="upload-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;align-items:center;justify-content:center">
      <div style="background:#fff;padding:32px;border-radius:12px;text-align:center"><div class="spinner" style="margin:0 auto 16px"></div><div>Uploading…</div></div>
    </div>
  `;
}

function detailField(label, value) {
  return `<div>
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:4px">${label}</div>
    <div style="font-size:13px">${value}</div>
  </div>`;
}

function ficaItem(label, docs, type) {
  const docs2 = docs || [];
  const found = docs2.find(d => d.doc_type === type);
  const icon  = found ? '✅' : '⬜';
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
    <span>${icon} ${label}</span>
    ${found ? `<a href="${esc(found.file_url)}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px">View</a>` : '<span style="font-size:11px;color:var(--text-3)">Missing</span>'}
  </div>`;
}

function switchContactDetailTab(tabId, el) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  if (el) el.classList.add('active');
}

async function saveContactNote(contactId) {
  const note = document.getElementById('internal-note-input')?.value?.trim();
  if (!note) return;
  try {
    await API.put(`contacts/index.php?id=${contactId}`, { notes: note });
    toast('Note saved', 'success');
    document.getElementById('internal-note-input').value = '';
    document.getElementById('notes-list').innerHTML = `<div style="padding:12px;background:var(--bg);border-radius:8px;font-size:13px;color:var(--text-2);white-space:pre-wrap">${esc(note)}</div>`;
  } catch(e) { toast(e.message, 'error'); }
}

async function scheduleActivity(contactId) {
  const type  = document.getElementById('sched-type')?.value;
  const date  = document.getElementById('sched-date')?.value;
  const notes = document.getElementById('sched-notes')?.value;
  if (!date) { toast('Please select a date and time', 'error'); return; }
  toast(`${type} scheduled for ${new Date(date).toLocaleDateString('en-ZA')}`, 'success');
}


function profileRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);font-size:13px">
    <span style="color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:.06em">${label}</span>
    <span style="text-align:right">${value}</span>
  </div>`;
}

function renderDocumentsList(docs) {
  if (!docs.length) return `<div class="empty" style="padding:32px"><div class="empty-text">No documents uploaded yet</div><div class="empty-sub">Upload ID copy, proof of address, and other FICA documents</div></div>`;
  const icons = { 'application/pdf': '📄', 'image/jpeg': '🖼️', 'image/png': '🖼️', 'image/webp': '🖼️' };
  return docs.map(d => `
    <div style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
      <div style="font-size:20px;flex-shrink:0">${icons[d.mime_type] || '📎'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(d.file_name)}">${esc(d.file_name)}</div>
        <div style="font-size:11px;color:var(--text-3)">${esc(d.doc_type)} · ${new Date(d.created_at).toLocaleDateString('en-ZA')}</div>
      </div>
      <a href="${esc(d.file_url)}" target="_blank" class="btn btn-ghost btn-sm" style="flex-shrink:0;padding:2px 8px;font-size:11px">View</a>
      <button onclick="deleteContactDoc(${d.id})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;flex-shrink:0;padding:2px" title="Delete">✕</button>
    </div>`).join('');
}

function switchContactTab(name, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-' + name)?.classList.add('active');
}

async function uploadContactDoc(input) {
  const file = input.files[0];
  if (!file) return;
  const docType = document.getElementById('doc-type-select').value;

  const overlay = document.getElementById('upload-overlay');
  overlay.style.display = 'flex';

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'contact_doc');
    formData.append('entity_id', currentContactId);
    formData.append('doc_type', docType);

    const res = await fetch('/crm/api/files/upload.php', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Upload failed');

    toast('Document uploaded successfully', 'success');

    // Refresh documents list
    const contactRes = await API.get(`contacts/index.php?id=${currentContactId}`);
    document.getElementById('documents-list').innerHTML = renderDocumentsList(contactRes.data.documents || []);

    // Update FICA badge
    const ficaBadge = FICA_BADGE[contactRes.data.fica_status] || 'badge-gray';

  } catch(e) {
    toast(e.message || 'Upload failed', 'error');
  } finally {
    overlay.style.display = 'none';
    input.value = '';
  }
}

async function loadContactDeals(contactId) {
  try {
    const res = await API.get('deals/index.php');
    const deals = res.data.filter(d => d.contact_id == contactId);
    const el = document.getElementById('contact-deals-content');
    if (!el) return;
    if (!deals.length) {
      el.innerHTML = `<div class="empty" style="padding:32px"><div class="empty-text">No deals for this contact</div></div>`;
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>Stage</th><th>Value</th><th>Agent</th></tr></thead>
      <tbody>${deals.map(d => `
      <tr>
        <td class="td-name">${esc(d.title)}</td>
        <td><span class="badge ${DEAL_BADGE[d.stage]||'badge-gray'}">${d.stage}</span></td>
        <td class="font-mono">${fmt(d.value)}</td>
        <td>${esc(d.agent_name||'—')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) { /* silent */ }
}

async function loadContactLeases(contactId, tenantName) {
  try {
    const res = await API.get('leases/index.php');
    const leases = res.data.filter(l => l.contact_id == contactId || l.tenant_name === tenantName);
    const el = document.getElementById('contact-leases-content');
    if (!el) return;
    if (!leases.length) {
      el.innerHTML = `<div class="empty" style="padding:32px"><div class="empty-text">No leases for this contact</div></div>`;
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Ref</th><th>Property</th><th>Monthly Rent</th><th>Status</th></tr></thead>
      <tbody>${leases.map(l => `
      <tr>
        <td class="font-mono">${l.ref}</td>
        <td>${esc(l.property||'—')}</td>
        <td class="font-mono">${fmt(l.monthly_rent)}</td>
        <td><span class="badge ${STATUS_BADGE[l.status]||'badge-gray'}">${l.status}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) { /* silent */ }
}

async function loadContactActivity(contactId) {
  try {
    const res = await API.get(`dashboard/index.php`);
    const activity = (res.data.activity || []).filter(a => a.entity_type === 'contact' && a.entity_id == contactId);
    const el = document.getElementById('contact-activity-content');
    if (!el) return;
    if (!activity.length) {
      el.innerHTML = `<div class="empty" style="padding:32px"><div class="empty-text">No activity recorded yet</div></div>`;
      return;
    }
    el.innerHTML = activity.map(a => `
      <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:8px;height:8px;border-radius:50%;background:var(--accent);margin-top:5px;flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:13px">${esc(a.description||a.action)}</div>
          <div style="font-size:11px;color:var(--text-3)">${timeAgo(a.created_at)} by ${esc(a.user_name||'System')}</div>
        </div>
      </div>`).join('');
  } catch(e) { /* silent */ }
}

function invoiceModalHTML() {
  return `
  <div class="modal-overlay" id="modal-invoice">
    <div class="modal" style="max-width:720px">
      <div class="modal-header">
        <div class="modal-title">New Invoice</div>
        <button class="modal-close" onclick="closeModal('modal-invoice')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Invoice Type</label>
          <select class="form-select" id="inv-type">
            <option value="Monthly Rental">Monthly Rental</option>
            <option value="Water">Water</option>
            <option value="Electricity">Electricity</option>
            <option value="Levy">Levy</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Admin Fee">Admin Fee</option>
            <option value="Other">Other</option>
          </select></div>
        <div class="form-row-2">
          <div class="form-group"><label class="form-label">Lease *</label>
            <select class="form-select" id="inv-lease" onchange="onLeaseChange()"><option value="">— Select Lease —</option></select>
          </div>
          <div class="form-group"><label class="form-label">Due Date *</label>
            <input class="form-input" type="date" id="inv-due">
          </div>
        </div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:16px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)">Line Items</div>
        <div class="table-wrap">
          <table style="min-width:500px">
            <thead><tr>
              <th>Description</th><th style="width:70px">Qty</th>
              <th style="width:120px">Unit Price (R)</th>
              <th style="width:100px">Discount (R)</th>
              <th style="width:100px">Subtotal</th>
              <th style="width:30px"></th>
            </tr></thead>
            <tbody id="inv-lines"></tbody>
          </table>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="addInvoiceLine()">+ Add Line</button>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="display:flex;justify-content:flex-end">
            <div style="min-width:260px">
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span>Subtotal</span><span id="inv-subtotal" class="font-mono">R 0,00</span></div>
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;align-items:center">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                  <input type="checkbox" id="inv-vat" onchange="updateInvoiceTotal()"> VAT 15%
                </label>
                <span id="inv-vat-amt" class="font-mono">R 0,00</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:10px 14px;font-size:14px;font-weight:700;background:var(--accent);color:#fff;border-radius:6px;margin-top:6px">
                <span>Total Due</span><span id="inv-total">R 0,00</span>
              </div>
            </div>
          </div>
        </div>
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" id="inv-notes" placeholder="Payment instructions or notes…"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-invoice')">Cancel</button>
        <button class="btn btn-primary" onclick="saveInvoice()">Create Invoice</button>
      </div>
    </div>
  </div>`;
}

function openNewInvoice() {
  if (!document.getElementById('modal-invoice')) {
    const div = document.createElement('div');
    div.innerHTML = invoiceModalHTML();
    document.body.appendChild(div.firstElementChild);
  }
  API.get('leases/index.php?status=active').then(res => {
    const leases = res.data;
    document.getElementById('inv-lease').innerHTML =
      '<option value="">— Select Lease —</option>' +
      leases.map(l => `<option value="${l.id}" data-rent="${l.monthly_rent}" data-tenant="${esc(l.tenant_name)}" data-property="${esc(l.property||'')}">${l.ref} — ${esc(l.tenant_name)}</option>`).join('');
  });
  invoiceLines = [{ description: '', quantity: 1, unit_price: 0, discount: 0 }];
  // Load products for quick select if not already loaded
  if (!allProducts.length) {
    API.get('products/index.php').then(res => { allProducts = res.data || []; renderInvoiceLines(); }).catch(()=>{});
  }
  renderInvoiceLines();
  const due = new Date(); due.setMonth(due.getMonth()+1); due.setDate(1);
  document.getElementById('inv-due').value = due.toISOString().split('T')[0];
  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-vat').checked = false;
  updateInvoiceTotal();
  openModal('modal-invoice');
}

async function quickStageChange(id, stage) {
  try {
    await API.put(`deals/index.php?id=${id}`, { stage });
    toast('Deal moved to ' + stage, 'success');
    loadDeals();
  } catch(e) { toast(e.message, 'error'); }
}
function dealModalHTML() {
  return `
  <div class="modal-overlay" id="modal-deal">
    <div class="modal" style="max-width:680px">
      <div class="modal-header">
        <div class="modal-title" id="deal-modal-title">New Deal</div>
        <button class="modal-close" onclick="closeModal('modal-deal')">✕</button>
      </div>
      <div class="modal-body">
        <form id="deal-form">
          <!-- Basic -->
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Deal Title *</label>
              <input class="form-input" id="d-title" placeholder="e.g. 3BR Sandton Lease"></div>
            <div class="form-group"><label class="form-label">Type</label>
              <select class="form-select" id="d-type" onchange="toggleDealType(this.value)">
                <option value="Lease">Lease</option>
                <option value="Sale">Sale</option>
              </select></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Stage</label>
              <select class="form-select" id="d-stage" onchange="this.value==='withdrawn'?document.getElementById('d-lost-row').style.display='':document.getElementById('d-lost-row').style.display='none'">
                <option value="lead">Lead</option><option value="qualified">Qualified</option>
                <option value="pending">Pending</option><option value="closed">Closed</option>
                <option value="withdrawn">Withdrawn</option>
              </select></div>
            <div class="form-group"><label class="form-label">Expected Close Date</label>
              <input class="form-input" type="date" id="d-close"></div>
          </div>
          <div class="form-group" id="d-lost-row" style="display:none">
            <label class="form-label">Withdrawn Reason</label>
            <input class="form-input" id="d-lost" placeholder="Why was this deal withdrawn?">
          </div>

          <!-- Parties -->
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:12px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)">Parties</div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Landlord / Client *</label>
              <input class="form-input" id="d-contact-search" placeholder="Search contact name…" oninput="searchDealContact(this.value)" autocomplete="off">
              <input type="hidden" id="d-contact">
              <div id="d-contact-results" style="position:relative"></div>
            </div>
            <div class="form-group" id="d-tenant-row"><label class="form-label">Tenant (Lease)</label>
              <input class="form-input" id="d-tenant-search" placeholder="Search tenant name…" oninput="searchDealTenant(this.value)" autocomplete="off">
              <input type="hidden" id="d-tenant">
              <div id="d-tenant-results" style="position:relative"></div>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Agent *</label>
              <select class="form-select" id="d-agent"><option value="">— Unassigned —</option></select>
            </div>
            <div class="form-group"><label class="form-label">Listing / Property</label>
              <select class="form-select" id="d-listing"><option value="">— None —</option></select>
            </div>
          </div>

          <!-- Lease Financial Details -->
          <div id="d-lease-financials">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:12px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)">Lease Financial Details</div>
            <div class="form-row-2">
              <div class="form-group"><label class="form-label">Monthly Rental (R)</label>
                <input class="form-input" type="number" id="d-rent" placeholder="0" oninput="calcDealFinancials()"></div>
              <div class="form-group"><label class="form-label">Procurement Fee (R) <span style="color:var(--text-3);font-size:10px">~1 month rent</span></label>
                <input class="form-input" type="number" id="d-procurement" placeholder="0" oninput="calcDealFinancials()"></div>
            </div>
            <div class="form-row-2">
              <div class="form-group"><label class="form-label">Agent Commission (R) <span style="color:var(--text-3);font-size:10px">50% of procurement</span></label>
                <input class="form-input" type="number" id="d-comm-amt" placeholder="0"></div>
              <div class="form-group"><label class="form-label">Administration Fee (R)</label>
                <input class="form-input" type="number" id="d-admin-fee" placeholder="0"></div>
            </div>
            <div class="form-row-2">
              <div class="form-group"><label class="form-label">Management Fee % <span style="color:var(--text-3);font-size:10px">~7%</span></label>
                <input class="form-input" type="number" id="d-mgmt-pct" placeholder="e.g. 7" oninput="calcDealFinancials()"></div>
              <div class="form-group"><label class="form-label">Management Fee (R/month)</label>
                <input class="form-input" type="number" id="d-mgmt-amt" placeholder="0" style="background:var(--bg)" readonly></div>
            </div>
          </div>

          <!-- Sale Financial Details -->
          <div id="d-sale-financials" style="display:none">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:12px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)">Sale Financial Details</div>
            <div class="form-row-2">
              <div class="form-group"><label class="form-label">Sale Price (R)</label>
                <input class="form-input" type="number" id="d-value" placeholder="0" oninput="calcDealFinancials()"></div>
              <div class="form-group"><label class="form-label">Commission %</label>
                <input class="form-input" type="number" id="d-comm" placeholder="e.g. 7.5" oninput="calcDealFinancials()"></div>
            </div>
            <div class="form-group"><label class="form-label">Commission Amount (R)</label>
              <input class="form-input" type="number" id="d-sale-comm-amt" placeholder="0" style="background:var(--bg)" readonly></div>
          </div>

          <!-- Notes -->
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--text-3);margin:12px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)">Notes</div>
          <div class="form-group">
            <textarea class="form-textarea" id="d-notes" placeholder="Notes about this deal…"></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modal-deal')">Cancel</button>
        <button class="btn btn-primary" onclick="saveDeal()">Save Deal</button>
      </div>
    </div>
  </div>`;
}

// Contact search for deal form
function searchDealContact(q) {
  const results = document.getElementById('d-contact-results');
  if (!results) return;
  if (!q || q.length < 2) { results.innerHTML = ''; return; }
  const matches = allContacts.filter(c =>
    (c.name||''). toLowerCase().includes(q.toLowerCase()) ||
    (c.phone||''). includes(q)
  ).slice(0, 8);
  results.innerHTML = matches.length ? `<div style="position:absolute;top:0;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);z-index:100;box-shadow:var(--shadow-lg)">
    ${matches.map(c => `<div style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)" onmousedown="selectDealContact(${c.id},'${c.name.replace(/'/g,'&apos;')}')">
      <div style="font-weight:500">${esc(c.name)}</div>
      <div style="font-size:11px;color:var(--text-3)">${c.phone||''}</div>
    </div>`).join('')}</div>` : '';
}

function selectDealContact(id, name) {
  document.getElementById('d-contact').value = id;
  document.getElementById('d-contact-search').value = name;
  document.getElementById('d-contact-results').innerHTML = '';
}

function searchDealTenant(q) {
  const results = document.getElementById('d-tenant-results');
  if (!results) return;
  if (!q || q.length < 2) { results.innerHTML = ''; return; }
  const matches = allContacts.filter(c =>
    (c.name||''). toLowerCase().includes(q.toLowerCase()) ||
    (c.phone||''). includes(q)
  ).slice(0, 8);
  results.innerHTML = matches.length ? `<div style="position:absolute;top:0;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);z-index:100;box-shadow:var(--shadow-lg)">
    ${matches.map(c => `<div style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)" onmousedown="selectDealTenant(${c.id},'${c.name.replace(/'/g,'&apos;')}')">
      <div style="font-weight:500">${esc(c.name)}</div>
      <div style="font-size:11px;color:var(--text-3)">${c.phone||''}</div>
    </div>`).join('')}</div>` : '';
}

function selectDealTenant(id, name) {
  document.getElementById('d-tenant').value = id;
  document.getElementById('d-tenant-search').value = name;
  document.getElementById('d-tenant-results').innerHTML = '';
}

function toggleDealType(type) {
  const leaseF = document.getElementById('d-lease-financials');
  const saleF  = document.getElementById('d-sale-financials');
  const tenRow = document.getElementById('d-tenant-row');
  if (leaseF) leaseF.style.display = type === 'Sale' ? 'none' : '';
  if (saleF)  saleF.style.display  = type === 'Sale' ? '' : 'none';
  if (tenRow) tenRow.style.display = type === 'Sale' ? 'none' : '';
}

function calcDealFinancials() {
  const type    = document.getElementById('d-type')?.value;
  const rent    = parseFloat(document.getElementById('d-rent')?.value) || 0;
  const price   = parseFloat(document.getElementById('d-value')?.value) || 0;
  const commPct = parseFloat(document.getElementById('d-comm')?.value) || 0;
  const mgmtPct = parseFloat(document.getElementById('d-mgmt-pct')?.value) || 0;

  if (type === 'Lease' && rent > 0) {
    const procEl = document.getElementById('d-procurement');
    if (procEl && !procEl.value) procEl.value = rent.toFixed(0);
    const proc = parseFloat(procEl?.value || rent);
    const commEl = document.getElementById('d-comm-amt');
    if (commEl && !commEl.value) commEl.value = (proc * 0.5).toFixed(0);
    const mgmtEl = document.getElementById('d-mgmt-amt');
    if (mgmtEl && mgmtPct > 0) mgmtEl.value = (rent * mgmtPct / 100).toFixed(0);
  }
  if (type === 'Sale' && price > 0 && commPct > 0) {
    const commEl = document.getElementById('d-sale-comm-amt');
    if (commEl) commEl.value = (price * commPct / 100).toFixed(0);
  }
}

async function openNewInvoiceForLease(leaseId) {
  // Open invoice modal directly with lease pre-selected
  if (!document.getElementById('modal-invoice')) {
    const div = document.createElement('div');
    div.innerHTML = invoiceModalHTML();
    document.body.appendChild(div.firstElementChild);
  }
  const res = await API.get('leases/index.php');
  const leases = res.data;
  const sel = document.getElementById('inv-lease');
  if (sel) {
    sel.innerHTML = '<option value="">— Select Lease —</option>' +
      leases.map(l => `<option value="${l.id}" ${l.id==leaseId?'selected':''}>${l.ref} — ${esc(l.tenant_name)}</option>`).join('');
  }
  invoiceLines = [{ description: 'Monthly Rental', quantity: 1, unit_price: 0, discount: 0 }];
  renderInvoiceLines();
  const due = new Date(); due.setMonth(due.getMonth()+1); due.setDate(1);
  document.getElementById('inv-due').value = due.toISOString().split('T')[0];
  document.getElementById('inv-notes').value = '';
  document.getElementById('inv-vat').checked = false;
  updateInvoiceTotal();
  openModal('modal-invoice');
}

async function openEditInvoice(id) {
  try {
    const res = await API.get(`invoices/index.php?id=${id}`);
    const inv = res.data;

    // Ensure modal is in DOM
    if (!document.getElementById('modal-invoice')) {
      const div = document.createElement('div');
      div.innerHTML = invoiceModalHTML();
      document.body.appendChild(div.firstElementChild);
    }

    // Load leases into dropdown
    const leasesRes = await API.get('leases/index.php');
    const leaseEl = document.getElementById('inv-lease');
    if (leaseEl) {
      leaseEl.innerHTML = '<option value="">— Select Lease —</option>' +
        leasesRes.data.map(l => `<option value="${l.id}" ${l.id==inv.lease_id?'selected':''}>${l.ref} — ${esc(l.tenant_name)}</option>`).join('');
    }

    // Fill fields
    if (document.getElementById('inv-due')) document.getElementById('inv-due').value = inv.due_date || '';
    if (document.getElementById('inv-notes')) document.getElementById('inv-notes').value = inv.notes || '';
    if (document.getElementById('inv-vat')) document.getElementById('inv-vat').checked = !!inv.vat_applied;

    // Fill line items
    invoiceLines = (inv.lines||[]).map(l => ({
      description: l.description,
      quantity: parseFloat(l.quantity) || 1,
      unit_price: parseFloat(l.unit_price) || 0,
      discount: parseFloat(l.discount) || 0
    }));
    if (!invoiceLines.length) invoiceLines = [{ description:'', quantity:1, unit_price:0, discount:0 }];
    renderInvoiceLines();
    updateInvoiceTotal();

    editingInvoiceId = id;
    const isPaid = inv.status === 'paid';
    const titleEl = document.querySelector('#modal-invoice .modal-title');
    if (titleEl) titleEl.textContent = isPaid
      ? 'New Invoice from ' + inv.ref + ' (paid — will create new)'
      : 'Edit Invoice — ' + inv.ref;
    const saveBtn = document.querySelector('#modal-invoice .btn-primary');
    if (saveBtn) saveBtn.textContent = isPaid ? 'Create New Invoice' : 'Update Invoice';

    openModal('modal-invoice');
  } catch(e) { toast('Failed to load invoice: ' + e.message, 'error'); }
}

let editingInvoiceId = null;

async function emailInvoice(id) {
  try {
    const res = await API.get(`invoices/index.php?id=${id}`);
    const inv = res.data;
    const defaultEmail = inv.tenant_email || inv.contact_email || '';
    // Show modal
    let modal = document.getElementById('modal-send-invoice-email');
    if (!modal) {
      const div = document.createElement('div');
      div.innerHTML = `<div class="modal-overlay" id="modal-send-invoice-email">
        <div class="modal" style="max-width:420px">
          <div class="modal-header">
            <div class="modal-title">Send Invoice</div>
            <button class="modal-close" onclick="closeModal('modal-send-invoice-email')">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size:13px;color:var(--text-2);margin-bottom:16px">Send invoice <strong id="send-inv-ref"></strong> as a PDF attachment.</p>
            <div class="form-group">
              <label class="form-label">Recipient Email *</label>
              <input class="form-input" id="send-inv-email" type="email" placeholder="tenant@example.com">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal('modal-send-invoice-email')">Cancel</button>
            <button class="btn btn-primary" id="send-inv-btn">Send Invoice</button>
          </div>
        </div>
      </div>`;
      document.body.appendChild(div.firstElementChild);
      modal = document.getElementById('modal-send-invoice-email');
    }
    document.getElementById('send-inv-ref').textContent = inv.ref;
    document.getElementById('send-inv-email').value = defaultEmail;
    document.getElementById('send-inv-btn').onclick = async () => {
      const email = document.getElementById('send-inv-email').value.trim();
      if (!email) { toast('Please enter an email address', 'error'); return; }
      document.getElementById('send-inv-btn').textContent = 'Sending…';
      document.getElementById('send-inv-btn').disabled = true;
      try {
        await API.post('invoices/email.php', { invoice_id: id, to: email });
        toast('Invoice emailed to ' + email, 'success');
        closeModal('modal-send-invoice-email');
      } catch(e) {
        toast(e.message, 'error');
      } finally {
        document.getElementById('send-inv-btn').textContent = 'Send Invoice';
        document.getElementById('send-inv-btn').disabled = false;
      }
    };
    openModal('modal-send-invoice-email');
  } catch(e) { toast(e.message, 'error'); }
}
function renderInvoiceLines() {
  const tbody = document.getElementById('inv-lines');
  if (!tbody) return;
  const productOpts = allProducts.length ?
    '<option value="">— Quick select product —</option>' + allProducts.map(p => `<option value="${p.id}" data-price="${p.price||0}" data-desc="${esc(p.name)}">${esc(p.name)}${p.price?' — R'+Number(p.price).toLocaleString('en-ZA'):''}</option>`).join('') :
    '<option value="">— No products —</option>';

  tbody.innerHTML = invoiceLines.map((line, i) => `
    <tr id="inv-line-row-${i}">
      <td>
        <select class="form-select" style="font-size:11px;margin-bottom:4px" onchange="selectProduct(${i},this)">
          ${productOpts}
        </select>
        <input class="form-input" value="${esc(line.description)}" placeholder="Description" onchange="syncLine(${i})">
      </td>
      <td><input class="form-input" type="number" value="${parseFloat(line.quantity)||1}" min="1" style="width:60px" onchange="syncLine(${i})"></td>
      <td><input class="form-input" type="number" value="${parseFloat(line.unit_price)||0}" min="0" onchange="syncLine(${i})"></td>
      <td><input class="form-input" type="number" value="${parseFloat(line.discount)||0}" min="0" onchange="syncLine(${i})"></td>
      <td id="inv-line-total-${i}" style="text-align:right;font-size:13px;font-family:monospace">R ${((parseFloat(line.quantity)||1)*(parseFloat(line.unit_price)||0)-(parseFloat(line.discount)||0)).toLocaleString('en-ZA',{minimumFractionDigits:2})}</td>
      <td><button class="btn btn-danger btn-sm" onclick="removeInvoiceLine(${i})" ${invoiceLines.length===1?'disabled':''}>✕</button></td>
    </tr>`).join('');
  updateInvoiceTotal();
}

function selectProduct(lineIndex, sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  const price = parseFloat(opt.dataset.price) || 0;
  const desc  = opt.dataset.desc || '';
  invoiceLines[lineIndex].description = desc;
  invoiceLines[lineIndex].unit_price  = price;
  renderInvoiceLines();
  updateInvoiceTotal();
}

function syncLine(i) {
  const row = document.getElementById(`inv-line-row-${i}`);
  if (!row) return;
  const inputs = row.querySelectorAll('input');
  invoiceLines[i].description = inputs[0].value;
  invoiceLines[i].quantity    = parseFloat(inputs[1].value) || 1;
  invoiceLines[i].unit_price  = parseFloat(inputs[2].value) || 0;
  invoiceLines[i].discount    = parseFloat(inputs[3].value) || 0;
  updateLineTotal(i);
  updateInvoiceTotal();
}

function addInvoiceLine() {
  invoiceLines.push({ description: '', quantity: 1, unit_price: 0, discount: 0 });
  renderInvoiceLines();
}

function removeInvoiceLine(i) {
  if (invoiceLines.length === 1) return;
  invoiceLines.splice(i, 1);
  renderInvoiceLines();
}

function updateInvoiceTotal() {
  const subtotal = invoiceLines.reduce((s, l) => s + ((l.quantity*(l.unit_price||0))-(l.discount||0)), 0);
  const vat      = document.getElementById('inv-vat')?.checked ? subtotal * 0.15 : 0;
  const total    = subtotal + vat;
  const fmt      = n => 'R ' + n.toLocaleString('en-ZA', {minimumFractionDigits:2});
  if (document.getElementById('inv-subtotal')) document.getElementById('inv-subtotal').textContent = fmt(subtotal);
  if (document.getElementById('inv-vat-amt'))  document.getElementById('inv-vat-amt').textContent  = fmt(vat);
  if (document.getElementById('inv-total'))    document.getElementById('inv-total').textContent    = fmt(total);
}

function onLeaseChange() {
  const sel   = document.getElementById('inv-lease');
  const opt   = sel?.options[sel.selectedIndex];
  const rent  = parseFloat(opt?.dataset?.rent || 0);
  const tenant= opt?.dataset?.tenant || '';
  if (rent && invoiceLines.length === 1 && !invoiceLines[0].description) {
    invoiceLines[0] = { description: `Monthly Rental — ${tenant}`, quantity: 1, unit_price: rent, discount: 0 };
    renderInvoiceLines();
  }
}

function updateLineTotal(i) {
  const line = invoiceLines[i];
  const total = ((parseFloat(line.quantity)||1) * (parseFloat(line.unit_price)||0)) - (parseFloat(line.discount)||0);
  const el = document.getElementById(`inv-line-total-${i}`);
  if (el) el.textContent = 'R ' + total.toLocaleString('en-ZA', {minimumFractionDigits:2});
}

async function saveInvoice() {
  const leaseId = document.getElementById('inv-lease')?.value || null;
  const dueDate = document.getElementById('inv-due')?.value;
  const notes   = document.getElementById('inv-notes')?.value || '';
  const vatAppl = document.getElementById('inv-vat')?.checked ? 1 : 0;

  if (!dueDate) { toast('Please set a due date', 'error'); return; }
  if (!invoiceLines.length) { toast('Please add at least one line item', 'error'); return; }

  const subtotal = invoiceLines.reduce((s,l) => s + ((parseFloat(l.quantity)||1)*(parseFloat(l.unit_price)||0)-(parseFloat(l.discount)||0)), 0);
  const vatAmt   = vatAppl ? subtotal * 0.15 : 0;
  const total    = subtotal + vatAmt;

  const data = {
    lease_id:    leaseId,
    invoice_type: document.getElementById('inv-type')?.value || 'Monthly Rental',
    due_date:    dueDate,
    notes:       notes,
    vat_applied: vatAppl,
    vat_amount:  vatAmt,
    subtotal:    subtotal,
    total:       total,
    lines:       invoiceLines,
  };

  try {
    if (editingInvoiceId) {
      // Check if invoice is already paid — if so, create new invoice instead
      const existing = allInvoices.find(i => i.id === editingInvoiceId);
      if (existing && existing.status === 'paid') {
        // Create new invoice (don't touch the paid one)
        await API.post('invoices/index.php', data);
        toast('New invoice created from paid invoice', 'success');
      } else {
        // Unpaid — edit in place
        await API.put(`invoices/index.php?id=${editingInvoiceId}`, data);
        toast('Invoice updated', 'success');
      }
    } else {
      await API.post('invoices/index.php', data);
      toast('Invoice created', 'success');
    }
    closeModal('modal-invoice');
    editingInvoiceId = null;
    loadInvoices();
  } catch(e) { toast(e.message, 'error'); }
}

async function markInvoicePaid(id) {
  try {
    await API.put(`invoices/index.php?id=${id}`, {
      status: 'paid',
      paid_date: new Date().toISOString().split('T')[0]
    });
    toast('Invoice marked as paid', 'success');
    loadInvoices();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteInvoice(id, ref) {
  if (!confirm(`Delete invoice ${ref}? This cannot be undone.`)) return;
  try {
    await API.delete(`invoices/index.php?id=${id}`);
    toast('Invoice deleted', 'success');
    loadInvoices();
  } catch(e) { toast(e.message, 'error'); }
}

async function viewInvoiceDetail(id) {
  try {
    const res = await API.get(`invoices/index.php?id=${id}`);
    const inv = res.data;
    const fmt = n => 'R ' + Number(n||0).toLocaleString('en-ZA', {minimumFractionDigits:2});

    const html = `
      <div style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:20px">
          <div>
            <div style="font-size:20px;font-weight:600">${esc(inv.ref)}</div>
            <div style="font-size:13px;color:var(--text-3)">Due: ${inv.due_date} · ${inv.status.toUpperCase()}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:24px;font-weight:700;color:var(--accent)">${fmt(inv.total)}</div>
            ${inv.paid_date?`<div style="font-size:12px;color:var(--green)">Paid: ${inv.paid_date}</div>`:''}
          </div>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:4px">Tenant</div>
          <div style="font-size:13px;font-weight:500">${esc(inv.tenant_name||'—')}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
          <thead><tr>
            <th style="text-align:left;padding:8px;background:var(--bg);border-bottom:2px solid var(--border)">Description</th>
            <th style="text-align:right;padding:8px;background:var(--bg);border-bottom:2px solid var(--border)">Qty</th>
            <th style="text-align:right;padding:8px;background:var(--bg);border-bottom:2px solid var(--border)">Unit Price</th>
            <th style="text-align:right;padding:8px;background:var(--bg);border-bottom:2px solid var(--border)">Amount</th>
          </tr></thead>
          <tbody>
            ${(inv.lines||[]).map(l=>`<tr>
              <td style="padding:8px;border-bottom:1px solid var(--border)">${esc(l.description)}</td>
              <td style="padding:8px;border-bottom:1px solid var(--border);text-align:right">${l.quantity}</td>
              <td style="padding:8px;border-bottom:1px solid var(--border);text-align:right">${fmt(l.unit_price)}</td>
              <td style="padding:8px;border-bottom:1px solid var(--border);text-align:right;font-weight:500">${fmt(parseFloat(l.quantity)*parseFloat(l.unit_price)-parseFloat(l.discount||0))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="display:flex;justify-content:flex-end">
          <div style="min-width:220px">
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
            ${inv.vat_applied?`<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span>VAT (15%)</span><span>${fmt(inv.vat_amount)}</span></div>`:''}
            <div style="display:flex;justify-content:space-between;padding:10px;background:var(--accent);color:#fff;border-radius:6px;font-weight:700;font-size:15px;margin-top:4px"><span>TOTAL</span><span>${fmt(inv.total)}</span></div>
          </div>
        </div>
        ${inv.notes?`<div style="margin-top:16px;padding:12px;background:var(--bg);border-radius:6px;font-size:13px;color:var(--text-2)">${esc(inv.notes)}</div>`:''}
      </div>`;

    // Show in modal
    if (!document.getElementById('modal-inv-detail')) {
      const div = document.createElement('div');
      div.innerHTML = `<div class="modal-overlay" id="modal-inv-detail">
        <div class="modal" style="max-width:600px">
          <div class="modal-header">
            <div class="modal-title" id="inv-detail-title">Invoice</div>
            <button class="modal-close" onclick="closeModal('modal-inv-detail')">✕</button>
          </div>
          <div class="modal-body" id="inv-detail-body"></div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal('modal-inv-detail')">Close</button>
            <button class="btn btn-ghost" onclick="closeModal('modal-inv-detail');openEditInvoice(${id})">Edit</button>
            <button class="btn btn-ghost" onclick="printInvoice(${id})">Download PDF</button>
            <button class="btn btn-ghost" onclick="emailInvoice(${id})">Send Email</button>
            ${inv.status!=='paid'?`<button class="btn btn-primary" onclick="markInvoicePaid(${id});closeModal('modal-inv-detail')">Mark Paid</button>`:''}
          </div>
        </div>
      </div>`;
      document.body.appendChild(div.firstElementChild);
    }
    document.getElementById('inv-detail-title').textContent = inv.ref;
    document.getElementById('inv-detail-body').innerHTML = html;
    openModal('modal-inv-detail');
  } catch(e) { toast('Failed to load invoice', 'error'); }
}

// ── INVOICE EXPORT & STATEMENT ───────────────────────────────
function exportInvoicesToExcel() {
  const rows = [
    ['Ref', 'Tenant', 'Type', 'Amount', 'VAT', 'Total', 'Due Date', 'Paid Date', 'Status', 'Notes'],
    ...allInvoices.map(i => [
      i.ref, i.tenant_name||'', i.invoice_type||'Monthly Rental',
      i.subtotal||0, i.vat_amount||0, i.total||0,
      i.due_date||'', i.paid_date||'', i.status, i.notes||''
    ])
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `invoices_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  toast('Invoices exported', 'success');
}

function viewInvoiceStatement() {
  const paid    = allInvoices.filter(i => i.status === 'paid');
  const unpaid  = allInvoices.filter(i => i.status === 'unpaid');
  const overdue = allInvoices.filter(i => i.status === 'overdue');
  const fmt     = n => 'R ' + Number(n||0).toLocaleString('en-ZA', {minimumFractionDigits:2});
  const totalOwed = [...unpaid, ...overdue].reduce((s,i) => s+parseFloat(i.total||0), 0);
  const totalPaid = paid.reduce((s,i) => s+parseFloat(i.total||0), 0);

  if (!document.getElementById('modal-statement')) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="modal-overlay" id="modal-statement">
      <div class="modal" style="max-width:700px">
        <div class="modal-header">
          <div class="modal-title">Debtors Statement</div>
          <button class="modal-close" onclick="closeModal('modal-statement')">✕</button>
        </div>
        <div class="modal-body" id="statement-body"></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-statement')">Close</button>
          <button class="btn btn-ghost" onclick="exportInvoicesToExcel()">Export CSV</button>
          <button class="btn btn-primary" onclick="window.print()">Print</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  document.getElementById('statement-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div class="kpi-card"><div class="kpi-label">Total Paid</div><div class="kpi-value" style="color:var(--green)">${fmt(totalPaid)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Outstanding</div><div class="kpi-value" style="color:var(--amber)">${fmt(totalOwed)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Overdue</div><div class="kpi-value" style="color:var(--red)">${fmt(overdue.reduce((s,i)=>s+parseFloat(i.total||0),0))}</div></div>
    </div>
    ${overdue.length ? `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;color:var(--red);margin-bottom:8px">⚠️ Overdue</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr><th style="text-align:left;padding:8px;background:var(--bg)">Ref</th><th style="text-align:left;padding:8px;background:var(--bg)">Tenant</th><th style="text-align:right;padding:8px;background:var(--bg)">Amount</th><th style="text-align:left;padding:8px;background:var(--bg)">Due Date</th></tr></thead>
        <tbody>${overdue.map(i=>`<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px;font-family:monospace">${i.ref}</td>
          <td style="padding:8px">${esc(i.tenant_name||'—')}</td>
          <td style="padding:8px;text-align:right;font-weight:600;color:var(--red)">${fmt(i.total)}</td>
          <td style="padding:8px">${i.due_date}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}
    ${unpaid.length ? `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;color:var(--amber);margin-bottom:8px">Unpaid</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr><th style="text-align:left;padding:8px;background:var(--bg)">Ref</th><th style="text-align:left;padding:8px;background:var(--bg)">Tenant</th><th style="text-align:right;padding:8px;background:var(--bg)">Amount</th><th style="text-align:left;padding:8px;background:var(--bg)">Due Date</th></tr></thead>
        <tbody>${unpaid.map(i=>`<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px;font-family:monospace">${i.ref}</td>
          <td style="padding:8px">${esc(i.tenant_name||'—')}</td>
          <td style="padding:8px;text-align:right;font-weight:600">${fmt(i.total)}</td>
          <td style="padding:8px">${i.due_date}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : ''}
    <div>
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;color:var(--green);margin-bottom:8px">Paid</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr><th style="text-align:left;padding:8px;background:var(--bg)">Ref</th><th style="text-align:left;padding:8px;background:var(--bg)">Tenant</th><th style="text-align:right;padding:8px;background:var(--bg)">Amount</th><th style="text-align:left;padding:8px;background:var(--bg)">Paid Date</th></tr></thead>
        <tbody>${paid.map(i=>`<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px;font-family:monospace">${i.ref}</td>
          <td style="padding:8px">${esc(i.tenant_name||'—')}</td>
          <td style="padding:8px;text-align:right;font-weight:600;color:var(--green)">${fmt(i.total)}</td>
          <td style="padding:8px">${i.paid_date||'—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  openModal('modal-statement');
}

async function viewTenantStatement(tenantName) {
  const tenantInvoices = allInvoices.filter(i => i.tenant_name === tenantName);
  if (!tenantInvoices.length) { toast('No invoices found for ' + tenantName, 'error'); return; }

  const fmt  = n => 'R ' + Number(n||0).toLocaleString('en-ZA', {minimumFractionDigits:2});
  const paid = tenantInvoices.filter(i => i.status === 'paid');
  const owed = tenantInvoices.filter(i => i.status !== 'paid');
  const totalPaid = paid.reduce((s,i)=>s+parseFloat(i.total||0),0);
  const totalOwed = owed.reduce((s,i)=>s+parseFloat(i.total||0),0);

  if (!document.getElementById('modal-tenant-stmt')) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="modal-overlay" id="modal-tenant-stmt">
      <div class="modal" style="max-width:680px">
        <div class="modal-header">
          <div class="modal-title" id="tenant-stmt-title">Tenant Statement</div>
          <button class="modal-close" onclick="closeModal('modal-tenant-stmt')">✕</button>
        </div>
        <div class="modal-body" id="tenant-stmt-body"></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-tenant-stmt')">Close</button>
          <button class="btn btn-primary" onclick="window.print()">Print</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  // Get company settings for header
  let companyName = 'Property Management';
  let companyAddr = '';
  try {
    const sRes = await API.get('settings/index.php');
    companyName = sRes.data.settings.company_name || companyName;
    companyAddr = sRes.data.settings.address || '';
  } catch(e) {}
  document.getElementById('tenant-stmt-title').textContent = `Debtor Statement — ${tenantName}`;
  const stmtDate = new Date().toLocaleDateString('en-ZA', {day:'numeric',month:'long',year:'numeric'});
  document.getElementById('tenant-stmt-body').innerHTML = `
    <!-- Company header -->
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--accent)">
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--dark)">${companyName}</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:4px">${companyAddr}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:600;color:var(--accent)">DEBTOR STATEMENT</div>
        <div style="font-size:12px;color:var(--text-3)">Date: ${stmtDate}</div>
        <div style="font-size:12px;color:var(--text-3)">Account: ${tenantName}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div class="kpi-card"><div class="kpi-label">Total Paid</div><div class="kpi-value" style="color:var(--green)">${fmt(totalPaid)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Outstanding</div><div class="kpi-value" style="color:var(--amber)">${fmt(totalOwed)}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="text-align:left;padding:10px;background:var(--dark);color:#fff">Ref</th>
        <th style="text-align:left;padding:10px;background:var(--dark);color:#fff">Type</th>
        <th style="text-align:left;padding:10px;background:var(--dark);color:#fff">Due Date</th>
        <th style="text-align:left;padding:10px;background:var(--dark);color:#fff">Paid Date</th>
        <th style="text-align:right;padding:10px;background:var(--dark);color:#fff">Amount</th>
        <th style="text-align:left;padding:10px;background:var(--dark);color:#fff">Status</th>
      </tr></thead>
      <tbody>
        ${tenantInvoices.map((i,idx)=>`<tr style="background:${idx%2?'var(--bg)':'#fff'};border-bottom:1px solid var(--border)">
          <td style="padding:10px;font-family:monospace;cursor:pointer;color:var(--blue)" onclick="closeModal('modal-tenant-stmt');viewInvoiceDetail(${i.id})">${esc(i.ref)}</td>
          <td style="padding:10px;font-size:12px">${esc(i.invoice_type||'Monthly Rental')}</td>
          <td style="padding:10px;font-size:12px">${i.due_date||'—'}</td>
          <td style="padding:10px;font-size:12px;color:${i.paid_date?'var(--green)':'var(--text-3)'}">${i.paid_date||'—'}</td>
          <td style="padding:10px;text-align:right;font-weight:600;font-family:monospace">${fmt(i.total)}</td>
          <td style="padding:10px"><span class="badge ${INVOICE_BADGE[i.status]||'badge-gray'}">${i.status}</span></td>
        </tr>`).join('')}
        <tr style="background:var(--accent);color:#fff;font-weight:700">
          <td colspan="4" style="padding:12px">Total Outstanding</td>
          <td style="padding:12px;text-align:right;font-family:monospace">${fmt(totalOwed)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>`;
  openModal('modal-tenant-stmt');
}

function handleInvoiceAction(id, tenantName, action) {
  switch(action) {
    case 'edit':      openEditInvoice(id); break;
    case 'pdf':       printInvoice(id); break;
    case 'email':     emailInvoice(id); break;
    case 'statement': viewTenantStatement(tenantName); break;
    case 'delete':    deleteInvoice(id, 'this invoice'); break;
  }
}


// ── NOTIFICATIONS ─────────────────────────────────────────────
let notifications = [];
let notifPanelOpen = false;

async function loadNotifications() {
  try {
    const res = await API.get('notifications/index.php');
    notifications = res.data || [];
    updateNotifBadge();
  } catch(e) {}
}

function updateNotifBadge() {
  const unread = notifications.filter(n => !n.is_read).length;
  const badge = document.getElementById('notif-badge');
  const bell  = document.getElementById('notif-bell');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
  if (bell) bell.title = `${unread} unread notification${unread!==1?'s':''}`;
}

function toggleNotifPanel() {
  // Close nav on mobile when opening notifications
  if (window.innerWidth <= 768) closeNav();
  let panel = document.getElementById('notif-panel');
  if (!panel) { buildNotifPanel(); return; }
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  notifPanelOpen = !isOpen;
  let overlay = document.getElementById('notif-overlay');
  if (overlay) overlay.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) renderNotifList();
}
function buildNotifPanel() {
  const div = document.createElement('div');
  div.innerHTML = `
  <div id="notif-panel" class="notif-panel open">
    <div class="notif-panel-header">
      <div class="notif-panel-title">Notifications</div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="markAllNotifsRead()">Mark all read</button>
        <button class="modal-close" onclick="toggleNotifPanel()">✕</button>
      </div>
    </div>
    <div class="notif-list" id="notif-list"></div>
  </div>
  <div id="notif-overlay" style="position:fixed;inset:0;z-index:199" onclick="toggleNotifPanel()"></div>`;
  document.body.appendChild(div);
  renderNotifList();
}

function renderNotifList() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
    return;
  }
  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick(${n.id},'${n.entity_type}',${n.entity_id||null})">
      <div class="notif-item-text">${esc(n.title||n.message||'Notification')}</div>
      <div class="notif-item-meta">${n.message && n.message.length>60 ? esc(n.message.substring(0,60))+'…' : esc(n.message||'')}</div>
      <div class="notif-item-meta" style="margin-top:4px;color:var(--text-3)">${timeAgo(n.created_at)}</div>
    </div>`).join('');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return days + 'd ago';
  if (hrs > 0)  return hrs + 'h ago';
  if (mins > 0) return mins + 'm ago';
  return 'Just now';
}

async function handleNotifClick(id, entityType, entityId) {
  // Mark as read
  try { await API.put(`notifications/index.php?id=${id}`, { is_read: 1 }); } catch(e) {}
  notifications = notifications.map(n => n.id === id ? {...n, is_read: 1} : n);
  updateNotifBadge();
  renderNotifList();
  // Navigate to entity
  toggleNotifPanel();
  if (entityType === 'lease' && entityId)   viewLease(entityId);
  if (entityType === 'contact' && entityId) viewContact(entityId);
  if (entityType === 'deal' && entityId)    openDealModal(entityId);
  if (entityType === 'invoice' && entityId) { navigate('invoices'); }
}

async function markAllNotifsRead() {
  try { await API.post('notifications/index.php', { action: 'mark_all_read' }); } catch(e) {}
  notifications = notifications.map(n => ({...n, is_read: 1}));
  updateNotifBadge();
  renderNotifList();
}

// Create a notification (called internally when things happen)
async function createNotif(type, title, body, entityType, entityId, assignedTo) {
  try {
    await API.post('notifications/index.php', {
      action: 'create',
      type, title, body, entity_type: entityType, entity_id: entityId, assigned_to: assignedTo
    });
    loadNotifications();
  } catch(e) {}
}

// Poll for new notifications every 2 minutes
setInterval(loadNotifications, 2 * 60 * 1000);


// ── AUTO LOGOUT ───────────────────────────────────────────────
(function() {
  // Check session every 5 minutes
  setInterval(async () => {
    try {
      const res = await fetch('/crm/api/auth/login.php', { method: 'GET', credentials: 'same-origin' });
      if (res.status === 401) {
        alert('Your session has expired. Please log in again.');
        window.location.reload();
      }
    } catch(e) {}
  }, 5 * 60 * 1000);

  // Also check on user activity after 8 hours
  let lastActivity = Date.now();
  document.addEventListener('click', () => lastActivity = Date.now());
  document.addEventListener('keypress', () => lastActivity = Date.now());
  
  setInterval(() => {
    if (Date.now() - lastActivity > 8 * 60 * 60 * 1000) {
      alert('You have been logged out due to inactivity.');
      window.location.href = '/crm/';
    }
  }, 60 * 1000);
})();

// ── EXPORT TO CSV ─────────────────────────────────────────────
function exportToCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename + '_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  toast('Exported to CSV', 'success');
}

function exportContacts() {
  const rows = [
    ['Name', 'Type', 'Phone', 'Email', 'Complex/Estate', 'Unit', 'ERF', 'ID Number', 'FICA Status', 'Agent'],
    ...allContacts.map(c => [c.name, c.type, c.phone||'', c.email||'', c.complex||'', c.unit||'', c.erf||'', c.id_number||'', c.fica_status, c.assigned_name||''])
  ];
  exportToCSV(rows, 'contacts');
}

function exportLeases() {
  const rows = [
    ['Ref', 'Tenant', 'Landlord', 'Property', 'Unit', 'Start Date', 'End Date', 'Monthly Rent', 'Deposit', 'Escalation %', 'Status'],
    ...allLeases.map(l => [l.ref, l.tenant_name, l.landlord_name||'', l.property||'', l.unit||'', l.start_date, l.end_date, l.monthly_rent, l.deposit, l.escalation_pct||0, l.status])
  ];
  exportToCSV(rows, 'leases');
}

function exportDeals() {
  const rows = [
    ['Title', 'Type', 'Stage', 'Contact', 'Agent', 'Value', 'Commission', 'Expected Close'],
    ...allDeals.map(d => [d.title, d.deal_type||'Lease', d.stage, d.contact_name||'', d.agent_name||'', d.value||0, d.commission_amt||0, d.expected_close||''])
  ];
  exportToCSV(rows, 'deals');
}

// ── MY WORK ───────────────────────────────────────────────────
async function loadMyWork() {
  try {
    const userId = APP_USER?.id;
    const res = await API.get('contacts/index.php', { limit: 2000, status: 'active', assigned_to: userId });
    renderMyWork(res.data);
  } catch(e) { toast('Failed to load My Work', 'error'); console.error(e); }
}

function renderMyWork(contacts) {
  const groups = {};
  const noEstate = [];
  contacts.forEach(c => {
    if (c.complex) (groups[c.complex] = groups[c.complex] || []).push(c);
    else noEstate.push(c);
  });
  const estates = Object.keys(groups).sort();

  document.getElementById('page-content').innerHTML = `
    <div class="topbar">
      <div class="topbar-title">My Work <span style="font-size:12px;color:var(--text-3);font-weight:400">(${contacts.length})</span></div>
      <div class="topbar-actions">
        <div class="search-wrap" style="width:200px">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input class="form-input" placeholder="Search estate…" oninput="filterMyWorkEstates(this.value)">
        </div>
        <button class="btn btn-primary btn-sm" onclick="navigate('contacts')">All My Contacts</button>
      </div>
    </div>
    <div id="mywork-content" style="padding:20px">
      ${estates.map(estate => `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header">
          <div><div class="card-title">${esc(estate)}</div><div style="font-size:12px;color:var(--text-3)">${groups[estate].length} contacts</div></div>
          <div class="flex-gap">
            <button class="btn btn-ghost btn-sm" onclick="startCallingEstate('${esc(estate)}',${JSON.stringify(groups[estate].map(c=>c.id))})">📞 Call</button>
            <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').querySelector('.table-wrap').style.display=this.closest('.card').querySelector('.table-wrap').style.display==='none'?'':'none'">Toggle</button>
          </div>
        </div>
        <div class="table-wrap">
          <table><thead><tr><th>Name</th><th>Unit/ERF</th><th>Phone</th><th>FICA</th><th></th></tr></thead>
          <tbody>${groups[estate].map(c=>`<tr>
            <td class="td-name" style="cursor:pointer;color:var(--blue)" onclick="viewContact(${c.id})">${esc(c.name)}</td>
            <td style="font-size:12px;color:var(--text-3)">${[c.unit&&c.unit!=='0'?'Unit '+c.unit:'',c.erf?'ERF '+c.erf:''].filter(Boolean).join(' · ')||'—'}</td>
            <td>${c.phone?`<a href="tel:${c.phone}" style="color:var(--blue)">${esc(c.phone)}</a>`:'—'}</td>
            <td><span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span></td>
            <td><button class="btn btn-ghost btn-sm" onclick="openQuickView(${c.id},[${groups[estate].map(x=>x.id).join(',')}])">View</button></td>
          </tr>`).join('')}</tbody></table>
        </div>
      </div>`).join('')}
      ${noEstate.length ? `
      <div class="card">
        <div class="card-header">
          <div><div class="card-title">No Estate</div><div style="font-size:12px;color:var(--text-3)">${noEstate.length} contacts</div></div>
          <button class="btn btn-ghost btn-sm" onclick="startCallingEstate('__none__',[${noEstate.map(c=>c.id).join(',')}])">📞 Call</button>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>FICA</th><th></th></tr></thead>
        <tbody>${noEstate.map(c=>`<tr>
          <td class="td-name" style="cursor:pointer;color:var(--blue)" onclick="viewContact(${c.id})">${esc(c.name)}</td>
          <td>${c.phone?`<a href="tel:${c.phone}" style="color:var(--blue)">${esc(c.phone)}</a>`:'—'}</td>
          <td><span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span></td>
          <td><button class="btn btn-ghost btn-sm" onclick="openQuickView(${c.id},[${noEstate.map(x=>x.id).join(',')}])">View</button></td>
        </tr>`).join('')}</tbody></table>
      </div>` : ''}
      ${!contacts.length ? '<div class="empty"><div class="empty-text">No contacts assigned to you yet</div></div>' : ''}
    </div>`;
}

function filterMyWorkEstates(q) {
  if (!q) {
    document.querySelectorAll('#mywork-content .card').forEach(card => card.style.display = '');
    document.querySelectorAll('#mywork-content tr[id]').forEach(row => row.style.display = '');
    return;
  }
  const ql = q.toLowerCase();
  document.querySelectorAll('#mywork-content .card').forEach(card => {
    const title = card.querySelector('.card-title')?.textContent?.toLowerCase() || '';
    const names = [...card.querySelectorAll('.td-name')].map(n => n.textContent.toLowerCase());
    const matches = title.includes(ql) || names.some(n => n.includes(ql));
    card.style.display = matches ? '' : 'none';
    // Show/hide individual rows if searching by name
    if (!title.includes(ql)) {
      card.querySelectorAll('tbody tr').forEach(row => {
        const name = row.querySelector('.td-name')?.textContent?.toLowerCase() || '';
        row.style.display = name.includes(ql) ? '' : 'none';
      });
      if (names.some(n => n.includes(ql))) card.style.display = '';
    }
  });
}

function startCallingEstate(estate, ids) {
  openQuickView(ids[0], ids);
}

// ── COMPLEX SEARCH ────────────────────────────────────────────
async function loadComplexSearch() {
  if (!allContacts.length) {
    const res = await API.get('contacts/index.php', { limit: 2000, status: 'active' });
    allContacts = res.data;
  }
  const estates = [...new Set(allContacts.map(c => c.complex).filter(Boolean))].sort();

  document.getElementById('page-content').innerHTML = `
    <div class="topbar"><div class="topbar-title">Complex Search</div></div>
    <div style="max-width:800px;margin:0 auto;padding:20px">
      <div class="card" style="margin-bottom:20px">
        <div class="card-body">
          <div class="form-label" style="margin-bottom:8px">Search by complex / estate name</div>
          <div style="display:flex;gap:8px">
            <input class="form-input" id="complex-search-input" placeholder="e.g. Midrand Village…"
              style="flex:1" oninput="doComplexSearch(this.value)" list="complex-dl">
            <datalist id="complex-dl">${estates.map(e=>`<option value="${esc(e)}">`).join('')}</datalist>
          </div>
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px">
            ${estates.map(e=>`<button class="btn btn-ghost btn-sm" onclick="document.getElementById('complex-search-input').value='${esc(e)}';doComplexSearch('${esc(e)}')">${esc(e)}</button>`).join('')}
          </div>
        </div>
      </div>
      <div id="complex-search-results"></div>
    </div>`;
}

function doComplexSearch(q) {
  const results = document.getElementById('complex-search-results');
  if (!results) return;
  if (!q || q.length < 2) { results.innerHTML = ''; return; }

  const matches = allContacts.filter(c => (c.complex||'').toLowerCase().includes(q.toLowerCase()));
  if (!matches.length) { results.innerHTML = '<div class="empty"><div class="empty-text">No contacts found</div></div>'; return; }

  const groups = {};
  matches.forEach(c => { const k = c.complex||'Unknown'; (groups[k]=groups[k]||[]).push(c); });

  results.innerHTML = Object.keys(groups).sort().map(estate => `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div><div class="card-title">${esc(estate)}</div><div style="font-size:12px;color:var(--text-3)">${groups[estate].length} contacts</div></div>
        <button class="btn btn-ghost btn-sm" onclick="openAssignComplexModal('${esc(estate)}',${groups[estate].length})">Reassign Estate</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Unit/ERF</th><th>Phone</th><th>Agent</th><th>FICA</th><th></th></tr></thead>
        <tbody>${groups[estate].map(c=>`<tr>
          <td class="td-name" style="cursor:pointer;color:var(--blue)" onclick="viewContact(${c.id})">${esc(c.name)}</td>
          <td style="font-size:12px;color:var(--text-3)">${[c.unit&&c.unit!=='0'?'Unit '+c.unit:'',c.erf?'ERF '+c.erf:''].filter(Boolean).join(' · ')||'—'}</td>
          <td>${c.phone?`<a href="tel:${c.phone}" style="color:var(--blue)">${esc(c.phone)}</a>`:'—'}</td>
          <td>${c.assigned_name?`<span class="badge badge-blue">${esc(c.assigned_name.split(' ')[0])}</span>`:'<span class="badge badge-gray">Unassigned</span>'}</td>
          <td><span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span></td>
          <td><button class="btn btn-ghost btn-sm" onclick="viewContact(${c.id})">View</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`).join('');
}

// ── LEADERBOARD ───────────────────────────────────────────────
async function loadLeaderboard() {
  try {
    const [dealsRes, contactsRes] = await Promise.all([
      API.get('deals/index.php'),
      allContacts.length ? Promise.resolve({data:allContacts}) : API.get('contacts/index.php', { limit: 2000 })
    ]);

    const deals    = dealsRes.data;
    const contacts = contactsRes.data;
    const fmt      = n => 'R ' + Number(n||0).toLocaleString('en-ZA', {minimumFractionDigits:0});

    const stats = {};
    deals.forEach(d => {
      if (!d.agent_name) return;
      const a = stats[d.agent_name] = stats[d.agent_name] || { name:d.agent_name, closed:0, closedVal:0, open:0, commission:0, contacts:0 };
      if (d.stage==='closed') { a.closed++; a.closedVal+=parseFloat(d.value||0); a.commission+=parseFloat(d.commission_amt||0); }
      else if (d.stage!=='withdrawn') a.open++;
    });
    contacts.forEach(c => {
      if (!c.assigned_name) return;
      const a = stats[c.assigned_name] = stats[c.assigned_name] || { name:c.assigned_name, closed:0, closedVal:0, open:0, commission:0, contacts:0 };
      a.contacts++;
    });

    const agents = Object.values(stats).sort((a,b) => b.closedVal - a.closedVal);
    const maxVal = agents[0]?.closedVal || 1;

    document.getElementById('page-content').innerHTML = `
      <div class="topbar">
        <div class="topbar-title">Leaderboard</div>
        <div class="topbar-actions">
          <div class="search-wrap" style="width:180px">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input class="form-input" placeholder="Search agents…" oninput="filterLeaderboard(this.value)">
          </div>
          <button class="btn btn-ghost btn-sm" onclick="exportLeaderboardCSV()">↓ Export</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div class="kpi-card"><div class="kpi-label">Agents</div><div class="kpi-value">${agents.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Closed Value</div><div class="kpi-value" style="font-size:18px">${fmt(agents.reduce((s,a)=>s+a.closedVal,0))}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Commission</div><div class="kpi-value" style="font-size:18px;color:var(--green)">${fmt(agents.reduce((s,a)=>s+a.commission,0))}</div></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Agent Rankings</div></div>
        <div class="table-wrap"><table id="leaderboard-table">
          <thead><tr><th style="width:50px">Rank</th><th>Agent</th><th>Contacts</th><th>Open Deals</th><th>Closed Deals</th><th>Closed Value</th><th>Commission</th><th>Performance</th></tr></thead>
          <tbody id="leaderboard-tbody">
            ${agents.map((a,i) => `<tr>
              <td style="text-align:center;font-size:18px">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
              <td class="td-name">${esc(a.name)}</td>
              <td>${a.contacts}</td>
              <td>${a.open}</td>
              <td style="font-weight:600">${a.closed}</td>
              <td class="font-mono" style="color:var(--green);font-weight:600">${fmt(a.closedVal)}</td>
              <td class="font-mono">${fmt(a.commission)}</td>
              <td style="width:160px">
                <div style="margin-bottom:4px">
                  <span class="badge ${a.closed>=5?'badge-green':a.closed>=2?'badge-amber':'badge-gray'}" style="font-size:10px">
                    ${a.closed>=5?'High Activity':a.closed>=2?'Moderate':'Low Activity'}
                  </span>
                </div>
                <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden" title="${Math.round((a.closedVal/maxVal)*100)}% of top performer">
                  <div style="background:${a.closed>=5?'var(--green)':a.closed>=2?'var(--accent)':'var(--border-2)'};height:100%;width:${Math.round((a.closedVal/maxVal)*100)}%;transition:width .3s"></div>
                </div>
              </td>
            </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-3)">No data yet</td></tr>'}
          </tbody>
        </table></div>
      </div>`;
  } catch(e) { toast('Failed to load leaderboard', 'error'); }
}

function filterLeaderboard(q) {
  document.querySelectorAll('#leaderboard-tbody tr').forEach(row => {
    const name = row.querySelector('.td-name')?.textContent?.toLowerCase() || '';
    row.style.display = !q || name.includes(q.toLowerCase()) ? '' : 'none';
  });
}

function exportLeaderboardCSV() {
  const rows = [...document.querySelectorAll('#leaderboard-tbody tr')].map(row =>
    [...row.querySelectorAll('td')].map(td => td.textContent.trim())
  );
  exportToCSV([['Rank','Agent','Contacts','Open','Closed','Value','Commission'], ...rows], 'leaderboard');
}

// ── CHANGE PASSWORD ───────────────────────────────────────────
function openChangePasswordModal(userId, userName) {
  if (!document.getElementById('modal-change-pw')) {
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-overlay" id="modal-change-pw">
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <div class="modal-title" id="change-pw-title">Change Password</div>
          <button class="modal-close" onclick="closeModal('modal-change-pw')">✕</button>
        </div>
        <div class="modal-body">
          <div id="change-pw-own" style="display:none">
            <div class="form-group"><label class="form-label">Current Password</label>
              <div style="position:relative"><input class="form-input" type="password" id="pw-current" placeholder="Current password" style="padding-right:36px"><button type="button" onclick="togglePwField('pw-current',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:var(--text-3)">👁</button></div></div>
          </div>
          <div class="form-group"><label class="form-label">New Password</label>
            <div style="position:relative"><input class="form-input" type="password" id="pw-new" placeholder="New password (min 6 chars)" style="padding-right:36px"><button type="button" onclick="togglePwField('pw-new',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:var(--text-3)">👁</button></div></div>
          <div class="form-group"><label class="form-label">Confirm New Password</label>
            <div style="position:relative"><input class="form-input" type="password" id="pw-confirm" placeholder="Confirm new password" style="padding-right:36px"><button type="button" onclick="togglePwField('pw-confirm',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;color:var(--text-3)">👁</button></div></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-change-pw')">Cancel</button>
          <button class="btn btn-primary" onclick="saveNewPassword()">Update Password</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  changingPasswordUserId = userId;
  const isOwnPassword = !userId || userId === APP_USER?.id;
  document.getElementById('change-pw-title').textContent = isOwnPassword ? 'Change My Password' : `Reset Password — ${userName || 'User'}`;
  document.getElementById('change-pw-own').style.display = isOwnPassword ? '' : 'none';
  document.getElementById('pw-current').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  openModal('modal-change-pw');
}

let changingPasswordUserId = null;

async function saveNewPassword() {
  const newPw  = document.getElementById('pw-new')?.value;
  const confPw = document.getElementById('pw-confirm')?.value;
  const currPw = document.getElementById('pw-current')?.value;

  if (!newPw || newPw.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
  if (newPw !== confPw) { toast('Passwords do not match', 'error'); return; }

  const userId = changingPasswordUserId || APP_USER?.id;
  const isOwnPassword = !changingPasswordUserId || changingPasswordUserId === APP_USER?.id;

  if (isOwnPassword && !currPw) { toast('Please enter your current password', 'error'); return; }

  try {
    await API.put(`users/index.php?id=${userId}`, {
      new_password:     newPw,
      current_password: isOwnPassword ? currPw : null,
      admin_reset:      !isOwnPassword,
    });
    toast('Password updated successfully', 'success');
    closeModal('modal-change-pw');
  } catch(e) { toast(e.message, 'error'); }
}

function navigateContact(direction) {
  const currentIndex = allContacts.findIndex(c => c.id === currentContactId);
  if (currentIndex === -1) return;
  const newIndex = currentIndex + direction;
  if (newIndex < 0 || newIndex >= allContacts.length) {
    toast('No more contacts', 'default');
    return;
  }
  viewContact(allContacts[newIndex].id);
}

async function unassignContact(id, name) {
  if (!confirm(`Unassign ${name} from their agent?`)) return;
  try {
    await API.put(`contacts/index.php?id=${id}`, { assigned_to: null });
    toast(`${name} unassigned`, 'success');
    loadContacts(true);
  } catch(e) { toast(e.message, 'error'); }
}

let contactSortOrder = 'name';

function sortContacts(order) {
  contactSortOrder = order;
  let sorted = [...allContacts];
  if (order === 'name') {
    sorted.sort((a, b) => (a.name||'').localeCompare(b.name||''));
  } else if (order === 'recent') {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (order === 'updated') {
    sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }
  if (groupedByEstate) {
    // Re-group sorted contacts
    estateGroups = buildEstateGroups(sorted);
    renderEstateLayout();
  } else {
    const tbody = document.getElementById('contacts-tbody');
    if (tbody) tbody.innerHTML = renderContactRows(sorted);
  }
}

// ── LISTING PHOTOS ───────────────────────────────────────────
async function openListingDetail(id) {
  try {
    const [listingRes, photosRes] = await Promise.all([
      API.get(`listings/index.php?id=${id}`),
      API.get('photos/index.php', { listing_id: id })
    ]);
    const l = listingRes.data;
    const photos = photosRes.data || [];
    renderListingDetail(l, photos);
  } catch(e) { toast('Failed to load listing', 'error'); }
}

let currentListingPhotos = [];
let currentListingId = null;

function renderListingDetail(l, photos) {
  currentListingPhotos = photos.map(p => p.file_url);
  currentListingId = l.id;
  const fmt = n => n ? 'R ' + Number(n).toLocaleString('en-ZA', {minimumFractionDigits:0}) : '—';
  if (!document.getElementById('modal-listing-detail')) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="modal-overlay" id="modal-listing-detail">
      <div class="modal" style="max-width:780px">
        <div class="modal-header">
          <div class="modal-title" id="listing-detail-title">Listing</div>
          <button class="modal-close" onclick="closeModal('modal-listing-detail')">✕</button>
        </div>
        <div class="modal-body" id="listing-detail-body"></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-listing-detail')">Close</button>
          <button class="btn btn-primary" id="listing-detail-edit-btn">Edit Listing</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  document.getElementById('listing-detail-title').textContent = l.ref + ' — ' + l.title;
  document.getElementById('listing-detail-edit-btn').onclick = () => { closeModal('modal-listing-detail'); openListingModal(l.id); };

  document.getElementById('listing-detail-body').innerHTML = `
    <!-- Photo gallery -->
    <div style="margin-bottom:20px">
      <div id="listing-photo-gallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:8px">
        ${photos.map((p,i) => `
          <div draggable="true" ondragstart="dragPhoto(event,${i})" ondragover="event.preventDefault()" ondrop="dropPhoto(event,${i},${l.id})"
            style="position:relative;aspect-ratio:4/3;background:var(--bg);border-radius:8px;overflow:hidden;border:2px solid ${p.is_primary?'var(--accent)':'var(--border)'};cursor:grab">
            <img src="${p.file_url}" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="openLightbox(${i},currentListingPhotos)">
            <div style="position:absolute;top:4px;right:4px;display:flex;gap:4px">
              ${!p.is_primary ? `<button onclick="event.stopPropagation();setListingPrimaryPhoto(${p.id},${l.id})" style="background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer">★</button>` : '<span style="background:var(--accent);color:#fff;border-radius:4px;padding:2px 6px;font-size:10px">Primary</span>'}
              <button onclick="event.stopPropagation();deleteListingPhoto(${p.id},${l.id})" style="background:rgba(220,0,0,.7);color:#fff;border:none;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer">✕</button>
            </div>
          </div>`).join('') || '<div style="color:var(--text-3);font-size:13px;padding:20px">No photos yet</div>'}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="file" id="listing-photo-input" style="display:none" accept="image/*" multiple onchange="uploadListingPhotos(this,${l.id})">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('listing-photo-input').click()">+ Add Photos</button>
        <span style="font-size:12px;color:var(--text-3)">${photos.length} photo${photos.length!==1?'s':''} · Click ★ to set primary</span>
      </div>
    </div>
    <!-- Listing details -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px">
      <div>
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Property Details</div>
        ${ldr('Type', l.listing_type)} ${ldr('Status', l.status)}
        ${ldr('Bedrooms', l.bedrooms||'—')} ${ldr('Bathrooms', l.bathrooms||'—')}
        ${ldr('Garages', l.garages||'—')} ${ldr('Floor Size', l.floor_size ? l.floor_size+'m²' : '—')}
        ${ldr('Erf Size', l.erf_size ? l.erf_size+'m²' : '—')}
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;color:var(--text-3);margin-bottom:8px">Financial</div>
        ${ldr('Sale Price', l.price ? 'R '+Number(l.price).toLocaleString('en-ZA') : '—')}
        ${ldr('Rental', l.rental_price ? 'R '+Number(l.rental_price).toLocaleString('en-ZA')+'/mo' : '—')}
        ${ldr('Levy', l.levy ? 'R '+Number(l.levy).toLocaleString('en-ZA') : '—')}
        ${ldr('Rates', l.rates ? 'R '+Number(l.rates).toLocaleString('en-ZA') : '—')}
      </div>
    </div>
    ${l.description ? `<div style="margin-top:16px;padding:12px;background:var(--bg);border-radius:6px;font-size:13px">${esc(l.description)}</div>` : ''}`;

  openModal('modal-listing-detail');
}

async function uploadListingPhotos(input, listingId) {
  const files = [...input.files];
  if (!files.length) return;
  let uploaded = 0;
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'listing_photo');
    formData.append('entity_id', listingId);
    try {
      const res = await fetch('/crm/api/files/upload.php', { method:'POST', credentials:'same-origin', body:formData });
      const json = await res.json();
      if (json.success) uploaded++;
    } catch(e) {}
  }
  toast(`${uploaded} photo${uploaded!==1?'s':''} uploaded`, 'success');
  input.value = '';
  // Refresh gallery
  const photosRes = await API.get('photos/index.php', { listing_id: listingId });
  const listingRes = await API.get(`listings/index.php?id=${listingId}`);
  renderListingDetail(listingRes.data, photosRes.data || []);
}

async function setListingPrimaryPhoto(photoId, listingId) {
  try {
    await API.put(`photos/index.php?id=${photoId}`, { is_primary: 1 });
    const [listingRes, photosRes] = await Promise.all([
      API.get(`listings/index.php?id=${listingId}`),
      API.get('photos/index.php', { listing_id: listingId })
    ]);
    renderListingDetail(listingRes.data, photosRes.data || []);
    toast('Primary photo updated', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteListingPhoto(photoId, listingId) {
  if (!confirm('Delete this photo?')) return;
  try {
    await API.delete(`photos/index.php?id=${photoId}`);
    const [listingRes, photosRes] = await Promise.all([
      API.get(`listings/index.php?id=${listingId}`),
      API.get('photos/index.php', { listing_id: listingId })
    ]);
    renderListingDetail(listingRes.data, photosRes.data || []);
    toast('Photo deleted', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

function openLightbox(index, urls) {
  let current = index;
  const overlay = document.createElement('div');
  overlay.id = 'lightbox-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column';
  
  const render = () => {
    overlay.innerHTML = `
      <button onclick="document.getElementById('lightbox-overlay').remove()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:28px;cursor:pointer">✕</button>
      <div style="position:absolute;top:50%;left:20px;transform:translateY(-50%)">
        <button onclick="lightboxNav(-1)" style="background:rgba(255,255,255,.2);border:none;color:#fff;font-size:24px;padding:12px 16px;border-radius:8px;cursor:pointer">‹</button>
      </div>
      <div style="position:absolute;top:50%;right:20px;transform:translateY(-50%)">
        <button onclick="lightboxNav(1)" style="background:rgba(255,255,255,.2);border:none;color:#fff;font-size:24px;padding:12px 16px;border-radius:8px;cursor:pointer">›</button>
      </div>
      <img src="${urls[current]}" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px">
      <div style="color:rgba(255,255,255,.6);margin-top:12px;font-size:13px">${current+1} / ${urls.length}</div>`;
  };
  
  window.lightboxNav = (dir) => {
    current = (current + dir + urls.length) % urls.length;
    render();
  };
  
  // Keyboard navigation
  const keyHandler = (e) => {
    if (e.key === 'ArrowLeft') lightboxNav(-1);
    if (e.key === 'ArrowRight') lightboxNav(1);
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', keyHandler); }
  };
  document.addEventListener('keydown', keyHandler);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); document.removeEventListener('keydown', keyHandler); } });
  
  render();
  document.body.appendChild(overlay);
}

let dragPhotoIndex = null;
let listingPhotosCache = [];

function dragPhoto(event, index) {
  dragPhotoIndex = index;
  event.dataTransfer.effectAllowed = 'move';
}

async function dropPhoto(event, targetIndex, listingId) {
  event.preventDefault();
  if (dragPhotoIndex === null || dragPhotoIndex === targetIndex) return;

  // Reorder locally first for instant feedback
  const photosRes = await API.get('photos/index.php', { listing_id: listingId });
  const photos = photosRes.data || [];
  const moved = photos.splice(dragPhotoIndex, 1)[0];
  photos.splice(targetIndex, 0, moved);
  dragPhotoIndex = null;

  // Update UI immediately
  currentListingPhotos = photos.map(p => p.file_url);
  const gallery = document.getElementById('listing-photo-gallery');
  if (gallery) {
    gallery.style.opacity = '0.6';
  }

  // Fire all updates in parallel
  await Promise.all(photos.map((p, i) =>
    API.put(`photos/index.php?id=${p.id}`, { sort_order: i })
  ));

  const listingRes = await API.get(`listings/index.php?id=${listingId}`);
  renderListingDetail(listingRes.data, photos);
  toast('Photos reordered', 'success');
}

// ── INVOICE SCHEDULES (Monthly Automated) ─────────────────────
async function loadSchedules(el) {
  console.log('loadSchedules called, el:', el);
  if (!el) el = document.getElementById('inv-section-content');
  console.log('inv-section-content:', el);
  if (!el) { toast('No content element', 'error'); return; }
  const [schedulesRes, leasesRes] = await Promise.all([
    API.get('schedules/index.php'),
    API.get('leases/index.php')
  ]);
  const schedules = schedulesRes.data || [];
  const leases    = leasesRes.data || [];
  const fmt = n => 'R ' + Number(n||0).toLocaleString('en-ZA', {minimumFractionDigits:2});

  const tabContent = el;

  tabContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-size:14px;font-weight:600">Monthly Automated Invoices</div>
        <div style="font-size:12px;color:var(--text-3)">Invoices generated automatically on the set day each month</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openScheduleModal()">+ Add Schedule</button>
    </div>
    ${schedules.length ? `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Lease</th><th>Type</th><th>Amount</th><th>Day</th>
        <th>Start</th><th>End</th><th>Last Generated</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>${schedules.map(s => `<tr>
        <td class="font-mono">${esc(s.lease_ref||'—')}</td>
        <td style="font-size:12px">${esc(s.invoice_type)}</td>
        <td class="font-mono">${fmt(s.amount)}</td>
        <td style="text-align:center">${s.day_of_month}</td>
        <td style="font-size:12px">${s.start_date}</td>
        <td style="font-size:12px">${s.end_date||'—'}</td>
        <td style="font-size:12px;color:var(--text-3)">${s.last_generated||'Never'}</td>
        <td><span class="badge ${s.is_active?'badge-green':'badge-gray'}">${s.is_active?'Active':'Paused'}</span></td>
        <td><div class="flex-gap">
          <button class="btn btn-sm btn-ghost" onclick="toggleSchedule(${s.id},${s.is_active})">
            ${s.is_active?'Pause':'Resume'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteSchedule(${s.id})">Del</button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table></div>` : `
    <div class="empty" style="padding:60px">
      <div class="empty-text">No automated schedules yet</div>
      <div class="empty-sub">Add a schedule to automatically generate monthly invoices for a lease</div>
      <button class="btn btn-primary btn-sm" style="margin-top:16px" onclick="openScheduleModal()">+ Add Schedule</button>
    </div>`}

    <!-- Schedule Modal -->
    <div class="modal-overlay" id="modal-schedule">
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <div class="modal-title">New Automated Schedule</div>
          <button class="modal-close" onclick="closeModal('modal-schedule')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Lease *</label>
            <select class="form-select" id="sched-lease">
              <option value="">— Select Lease —</option>
              ${leases.map(l => `<option value="${l.id}">${l.ref} — ${esc(l.tenant_name)}</option>`).join('')}
            </select></div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Invoice Type</label>
              <select class="form-select" id="sched-type">
                <option value="Monthly Rental">Monthly Rental</option>
                <option value="Water">Water</option>
                <option value="Electricity">Electricity</option>
                <option value="Levy">Levy</option>
                <option value="Admin Fee">Admin Fee</option>
                <option value="Other">Other</option>
              </select></div>
            <div class="form-group"><label class="form-label">Amount (R) *</label>
              <input class="form-input" type="number" id="sched-amount" placeholder="0"></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Day of Month *</label>
              <input class="form-input" type="number" id="sched-day" value="1" min="1" max="28" placeholder="1-28"></div>
            <div class="form-group"><label class="form-label">VAT (15%)</label>
              <select class="form-select" id="sched-vat">
                <option value="0">No VAT</option>
                <option value="1">Apply VAT</option>
              </select></div>
          </div>
          <div class="form-row-2">
            <div class="form-group"><label class="form-label">Start Date *</label>
              <input class="form-input" type="date" id="sched-start"></div>
            <div class="form-group"><label class="form-label">End Date <span style="color:var(--text-3);font-size:11px">(optional)</span></label>
              <input class="form-input" type="date" id="sched-end"></div>
          </div>
          <div class="form-group"><label class="form-label">Description</label>
            <input class="form-input" id="sched-desc" placeholder="e.g. Monthly rental for Unit 3"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal('modal-schedule')">Cancel</button>
          <button class="btn btn-primary" onclick="saveSchedule()">Create Schedule</button>
        </div>
      </div>
    </div>`;
}

function openScheduleModal() {
  document.getElementById('sched-start').value = new Date().toISOString().split('T')[0];
  openModal('modal-schedule');
}

async function saveSchedule() {
  const leaseId = document.getElementById('sched-lease')?.value;
  const amount  = document.getElementById('sched-amount')?.value;
  const day     = document.getElementById('sched-day')?.value;
  const start   = document.getElementById('sched-start')?.value;

  if (!leaseId) { toast('Please select a lease', 'error'); return; }
  if (!amount)  { toast('Amount is required', 'error'); return; }
  if (!start)   { toast('Start date is required', 'error'); return; }

  try {
    await API.post('schedules/index.php', {
      lease_id:     leaseId,
      invoice_type: document.getElementById('sched-type')?.value,
      description:  document.getElementById('sched-desc')?.value,
      amount:       parseFloat(amount),
      vat_applied:  parseInt(document.getElementById('sched-vat')?.value || '0'),
      day_of_month: parseInt(day),
      start_date:   start,
      end_date:     document.getElementById('sched-end')?.value || null,
    });
    toast('Schedule created', 'success');
    closeModal('modal-schedule');
    loadSchedules();
  } catch(e) { toast(e.message, 'error'); }
}

async function toggleSchedule(id, isActive) {
  try {
    await API.put(`schedules/index.php?id=${id}`, { is_active: isActive ? 0 : 1 });
    toast(isActive ? 'Schedule paused' : 'Schedule resumed', 'success');
    loadSchedules();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteSchedule(id) {
  if (!confirm('Delete this schedule? This will not delete existing invoices.')) return;
  try {
    await API.delete(`schedules/index.php?id=${id}`);
    toast('Schedule deleted', 'success');
    loadSchedules();
  } catch(e) { toast(e.message, 'error'); }
}

// ── INVOICE REPORTS ───────────────────────────────────────────
function renderInvoiceReports(el) {
  if (!el) el = document.getElementById('inv-section-content');
  if (!el) return;

  const fmt = n => 'R ' + Number(n||0).toLocaleString('en-ZA', {minimumFractionDigits:0, maximumFractionDigits:0});
  const paid     = allInvoices.filter(i => i.status==='paid');
  const unpaid   = allInvoices.filter(i => i.status==='unpaid');
  const overdue  = allInvoices.filter(i => i.status==='overdue');
  const totalInv = allInvoices.reduce((s,i) => s+parseFloat(i.total||0), 0);
  const collected= paid.reduce((s,i) => s+parseFloat(i.total||0), 0);
  const outstanding = [...unpaid,...overdue].reduce((s,i) => s+parseFloat(i.total||0), 0);
  const overdueAmt  = overdue.reduce((s,i) => s+parseFloat(i.total||0), 0);

  el.innerHTML = `
    <!-- Export by date range -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><div class="card-title">Export by Date Range</div></div>
      <div class="card-body">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0">
            <label class="form-label">From Date</label>
            <input class="form-input" type="date" id="inv-export-from">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">To Date</label>
            <input class="form-input" type="date" id="inv-export-to">
          </div>
          <button class="btn btn-primary btn-sm" onclick="exportInvoicesByRange()">Export to Excel</button>
          <button class="btn btn-ghost btn-sm" onclick="exportInvoicesToExcel()">Export All</button>
          <button class="btn btn-ghost btn-sm" onclick="exportInvoiceCustomers()">Export Customers</button>
        </div>
      </div>
    </div>

    <!-- KPI tiles -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div class="kpi-card"><div class="kpi-label">Total Invoiced</div><div class="kpi-value" style="font-size:18px">${fmt(totalInv)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Collected</div><div class="kpi-value" style="font-size:18px;color:var(--green)">${fmt(collected)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Outstanding</div><div class="kpi-value" style="font-size:18px;color:var(--amber)">${fmt(outstanding)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Overdue</div><div class="kpi-value" style="font-size:18px;color:var(--red)">${fmt(overdueAmt)}</div></div>
    </div>
    <div style="font-size:12px;color:var(--text-3);margin-bottom:16px">${allInvoices.length} total · ${paid.length} paid · ${unpaid.length} unpaid · ${overdue.length} overdue</div>

    <!-- Report table -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Invoice Summary</div>
        <select class="form-select" style="width:160px" id="inv-report-period" onchange="filterInvoiceReport()">
          <option value="all">All Time</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
        </select>
      </div>
      <div class="table-wrap" id="inv-report-table">
        ${renderInvoiceReportTable(allInvoices)}
      </div>
    </div>`;
}

function renderInvoiceReportTable(invoices) {
  const fmt = n => 'R ' + Number(n||0).toLocaleString('en-ZA', {minimumFractionDigits:2});
  if (!invoices.length) return '<div class="empty" style="padding:32px"><div class="empty-text">No invoices found</div></div>';
  return `<table>
    <thead><tr><th>Ref</th><th>Tenant</th><th>Type</th><th>Amount</th><th>Due Date</th><th>Paid Date</th><th>Status</th></tr></thead>
    <tbody>${invoices.map(i => `<tr>
      <td class="font-mono">${i.ref}</td>
      <td>${esc(i.tenant_name||'—')}</td>
      <td style="font-size:12px">${esc(i.invoice_type||'Monthly Rental')}</td>
      <td class="font-mono">${fmt(i.total)}</td>
      <td style="font-size:12px">${i.due_date||'—'}</td>
      <td style="font-size:12px;color:${i.paid_date?'var(--green)':'var(--text-3)'}">${i.paid_date||'—'}</td>
      <td><span class="badge ${INVOICE_BADGE[i.status]||'badge-gray'}">${i.status}</span></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function filterInvoiceReport() {
  const period = document.getElementById('inv-report-period')?.value || 'all';
  const now = new Date();
  let filtered = allInvoices;
  if (period === 'this_month') filtered = allInvoices.filter(i => (i.due_date||'').startsWith(now.toISOString().slice(0,7)));
  else if (period === 'last_month') {
    const lm = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
    filtered = allInvoices.filter(i => (i.due_date||'').startsWith(lm));
  } else if (period === 'this_year') filtered = allInvoices.filter(i => (i.due_date||'').startsWith(now.getFullYear().toString()));
  const table = document.getElementById('inv-report-table');
  if (table) table.innerHTML = renderInvoiceReportTable(filtered);
}

function exportInvoicesByRange() {
  const from = document.getElementById('inv-export-from')?.value;
  const to   = document.getElementById('inv-export-to')?.value;
  if (!from || !to) { toast('Please select a date range', 'error'); return; }
  const filtered = allInvoices.filter(i => {
    const d = i.due_date || i.created_at?.split('T')[0];
    return d >= from && d <= to;
  });
  if (!filtered.length) { toast('No invoices in that range', 'error'); return; }
  const rows = [
    ['Ref','Tenant','Type','Amount','VAT','Total','Due Date','Paid Date','Status'],
    ...filtered.map(i => [i.ref, i.tenant_name||'', i.invoice_type||'', i.subtotal||0, i.vat_amount||0, i.total||0, i.due_date||'', i.paid_date||'', i.status])
  ];
  exportToCSV(rows, 'invoices_' + from + '_to_' + to);
}

function exportInvoiceCustomers() {
  const customers = {};
  allInvoices.forEach(i => {
    if (!i.tenant_name) return;
    if (!customers[i.tenant_name]) customers[i.tenant_name] = { name: i.tenant_name, total: 0, paid: 0, count: 0 };
    customers[i.tenant_name].total += parseFloat(i.total||0);
    if (i.status === 'paid') customers[i.tenant_name].paid += parseFloat(i.total||0);
    customers[i.tenant_name].count++;
  });
  const rows = [
    ['Customer', 'Total Invoiced', 'Total Paid', 'Outstanding', 'Invoice Count'],
    ...Object.values(customers).map(c => [c.name, c.total, c.paid, c.total-c.paid, c.count])
  ];
  exportToCSV(rows, 'invoice_customers');
}

async function deleteLeaseDoc(docId, leaseId) {
  if (!confirm('Delete this document?')) return;
  try {
    const res = await fetch(`/crm/api/files/upload.php?doc_id=${docId}`, {
      method: 'DELETE', credentials: 'same-origin'
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    toast('Document deleted', 'success');
    viewLease(leaseId);
  } catch(e) { toast('Failed to delete document', 'error'); }
}

async function deleteContactDoc(docId) {
  if (!confirm('Delete this document?')) return;
  try {
    const res = await fetch(`/crm/api/files/upload.php?doc_id=${docId}`, {
      method: 'DELETE', credentials: 'same-origin'
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    toast('Document deleted', 'success');
    if (currentContactId) viewContact(currentContactId);
  } catch(e) { toast('Failed to delete document', 'error'); }
}

function renderContactCards(contacts) {
  if (!contacts.length) return '<div class="empty" style="padding:40px"><div class="empty-text">No contacts found</div></div>';
  return contacts.map(c => `
    <div class="mobile-card" onclick="viewContact(${c.id})">
      <div class="mobile-card-title">${esc(c.name)}</div>
      <div class="mobile-card-sub">${esc(c.complex||'')}${c.unit?' · Unit '+c.unit:''}</div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">Phone</span>
        <span class="mobile-card-value">${c.phone ? `<a href="tel:${c.phone}">${esc(c.phone)}</a>` : '—'}</span>
      </div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">Type</span>
        <span class="mobile-card-value"><span class="badge badge-gray">${c.type}</span></span>
      </div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">FICA</span>
        <span class="mobile-card-value"><span class="badge ${FICA_BADGE[c.fica_status]||'badge-gray'}">${c.fica_status}</span></span>
      </div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">Agent</span>
        <span class="mobile-card-value">${c.assigned_name||'Unassigned'}</span>
      </div>
      <div class="mobile-card-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openQuickView(${c.id},allContacts.map(x=>x.id))">View</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openContactModal(${c.id})">Edit</button>
      </div>
    </div>`).join('');
}

function renderLeaseCards(leases) {
  const fmt = n => n ? 'R ' + Number(n).toLocaleString('en-ZA',{minimumFractionDigits:0}) : '—';
  if (!leases.length) return '<div class="empty" style="padding:40px"><div class="empty-text">No leases found</div></div>';
  return leases.map(l => `
    <div class="mobile-card" onclick="viewLease(${l.id})">
      <div class="mobile-card-title">${esc(l.ref)}</div>
      <div class="mobile-card-sub">${esc(l.property||'')}${l.unit?' · Unit '+l.unit:''}</div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">Tenant</span>
        <span class="mobile-card-value">${esc(l.tenant_name||'—')}</span>
      </div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">Monthly Rent</span>
        <span class="mobile-card-value">${fmt(l.monthly_rent)}</span>
      </div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">End Date</span>
        <span class="mobile-card-value">${l.end_date||'—'}</span>
      </div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">Status</span>
        <span class="mobile-card-value"><span class="badge ${STATUS_BADGE[l.status]||'badge-gray'}">${l.status}</span></span>
      </div>
    </div>`).join('');
}

function renderInvoiceCards(invoices) {
  const fmt = n => n ? 'R ' + Number(n).toLocaleString('en-ZA',{minimumFractionDigits:2}) : '—';
  if (!invoices.length) return '<div class="empty" style="padding:40px"><div class="empty-text">No invoices found</div></div>';
  return invoices.map(i => `
    <div class="mobile-card" onclick="viewInvoiceDetail(${i.id})">
      <div class="mobile-card-title">${i.ref}</div>
      <div class="mobile-card-sub">${esc(i.tenant_name||'—')} · ${esc(i.invoice_type||'Monthly Rental')}</div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">Amount</span>
        <span class="mobile-card-value" style="font-weight:700">${fmt(i.total)}</span>
      </div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">Due Date</span>
        <span class="mobile-card-value">${i.due_date||'—'}</span>
      </div>
      <div class="mobile-card-row">
        <span class="mobile-card-label">Status</span>
        <span class="mobile-card-value"><span class="badge ${INVOICE_BADGE[i.status]||'badge-gray'}">${i.status}</span></span>
      </div>
      <div class="mobile-card-actions">
        ${i.status!=='paid'?`<button class="btn btn-success btn-sm" onclick="event.stopPropagation();markInvoicePaid(${i.id})">Mark Paid</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();printInvoice(${i.id})">PDF</button>
      </div>
    </div>`).join('');
}

function isMobile() { return window.innerWidth <= 768; }

async function exitImpersonation() {
  try {
    await API.post('platform', { action: 'exit_impersonate' });
    toast('Returning to platform admin...', 'success');
    setTimeout(() => window.location.reload(), 800);
  } catch(e) { toast(e.message, 'error'); }
}

function togglePwField(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
    btn.title = 'Hide password';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
    btn.title = 'Show password';
  }
}

function pwFieldHTML(id, placeholder = 'Password') {
  return `<div style="position:relative">
    <input class="form-input" type="password" id="${id}" placeholder="${placeholder}" style="padding-right:40px">
    <button type="button" onclick="togglePwField('${id}',this)" title="Show password"
      style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-3);padding:0">👁</button>
  </div>`;
}

async function deleteUser(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  try {
    await API.delete(`users/index.php?id=${id}`);
    toast(`${name} deleted`, 'success');
    loadTeam();
  } catch(e) { toast(e.message, 'error'); }
}

function switchSettingsTab(tab, btn) {
  document.querySelectorAll('.stab').forEach(b => {
    b.style.background = 'transparent';
    b.style.color = 'var(--text-2)';
  });
  if (btn) { btn.style.background = 'var(--surface)'; btn.style.color = 'var(--accent)'; }
  const ids = ['settings-section-company','settings-section-branding','settings-section-bank','settings-section-smtp'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.closest('.card').style.display = 'none';
  });
  const el = document.getElementById('settings-section-' + tab);
  if (el) el.closest('.card').style.display = '';
}
