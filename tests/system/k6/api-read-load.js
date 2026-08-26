import http from 'k6/http';
import { check, group } from 'k6';

// Exercises the routine authenticated read endpoints a logged-in user hits
// most: dashboard, contacts list, invoices list, leases list.

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8299';

export const options = {
    scenarios: {
        ramp: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: JSON.parse(__ENV.STAGES || '[{"duration":"10s","target":10},{"duration":"20s","target":10},{"duration":"5s","target":0}]'),
        },
    },
};

export function setup() {
    const res = http.post(
        `${BASE}/crm/api/auth/login`,
        JSON.stringify({ username: 'qa.admin', password: 'TestPass123!' }),
        { headers: { 'Content-Type': 'application/json' } }
    );
    const setCookie = res.headers['Set-Cookie'] || '';
    const match = setCookie.match(/crm_session=([^;]+)/);
    if (!match) throw new Error('Setup login failed: ' + res.status + ' ' + res.body);
    return { cookie: `crm_session=${match[1]}` };
}

export default function (data) {
    const params = { headers: { Cookie: data.cookie } };

    group('dashboard', () => {
        const r = http.get(`${BASE}/crm/api/dashboard`, params);
        check(r, { 'dashboard 200': (res) => res.status === 200 });
    });
    group('contacts list', () => {
        const r = http.get(`${BASE}/crm/api/contacts?limit=50`, params);
        check(r, { 'contacts 200': (res) => res.status === 200 });
    });
    group('invoices list', () => {
        const r = http.get(`${BASE}/crm/api/invoices`, params);
        check(r, { 'invoices 200': (res) => res.status === 200 });
    });
    group('leases list', () => {
        const r = http.get(`${BASE}/crm/api/leases`, params);
        check(r, { 'leases 200': (res) => res.status === 200 });
    });
}
