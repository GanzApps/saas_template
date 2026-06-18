import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
  },
}

const BASE_URL = __ENV.BASE_URL || 'https://api.yourdomain.com'

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`)
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health response ok': (r) => r.json().status === 'ok',
  })

  // Authenticated request (would need valid JWT in real test)
  // const authHeaders = { Authorization: `Bearer ${__ENV.TEST_JWT}` }
  // const profileRes = http.get(`${BASE_URL}/api/user/profile`, { headers: authHeaders })
  // check(profileRes, { 'profile status 200': (r) => r.status === 200 })

  sleep(1)
}