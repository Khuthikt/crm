import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:8299';

export const options = {
    scenarios: {
        ramp: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: JSON.parse(__ENV.STAGES),
        },
    },
};

export default function () {
    const res = http.post(
        `${BASE}/crm/api/auth/login`,
        JSON.stringify({ username: 'qa.admin', password: 'TestPass123!' }),
        { headers: { 'Content-Type': 'application/json' }, timeout: '15s' }
    );
    check(res, { 'status is 200': (r) => r.status === 200 });
}
