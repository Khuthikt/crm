import http from 'k6/http';
import { check } from 'k6';

// Exercises POST /crm/api/auth/login under concurrency. This is the most
// CPU-expensive endpoint in the app (bcrypt cost=12 password_verify per
// request), so it's the most informative one to load/stress on a 1-vCPU box.

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

export default function () {
    const res = http.post(
        `${BASE}/crm/api/auth/login`,
        JSON.stringify({ username: 'qa.admin', password: 'TestPass123!' }),
        { headers: { 'Content-Type': 'application/json' } }
    );
    check(res, {
        'status is 200': (r) => r.status === 200,
        'has session cookie': (r) => !!r.headers['Set-Cookie'],
    });
}
