#!/usr/bin/env node
/**
 * Simple profiling runner — hits a set of endpoints and records timings.
 * Usage: PROFILING=1 node scripts/run_profile.js
 */
import fs from 'fs';

const base = process.env.BASE_URL || 'http://localhost:5000';
const user = process.env.TEST_USER || 'user-1';

async function timeFetch(path, opts = {}) {
  const start = Date.now();
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      'x-test-user': user,
      ...(opts.headers || {}),
    },
  });
  const duration = Date.now() - start;
  let body = null;
  try { body = await res.json(); } catch (e) {}
  return { path, status: res.status, duration, body };
}

async function run() {
  console.log('Starting profiling run against', base);
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const endpoints = [
    { path: '/api/targets', method: 'GET' },
    { path: `/api/logs?startDate=${startDate}&endDate=${endDate}`, method: 'GET' },
    { path: '/api/interventions', method: 'GET' },
  ];

  const results = [];
  for (const ep of endpoints) {
    try {
      const res = await timeFetch(ep.path, { method: ep.method });
      console.log(`- ${ep.method} ${ep.path} -> ${res.status} in ${res.duration}ms`);
      results.push(res);
    } catch (err) {
      console.error('Request failed', ep.path, err);
      results.push({ path: ep.path, error: String(err) });
    }
  }

  const out = { base, timestamp: new Date().toISOString(), results };
  const dir = 'performance';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(`${dir}/baseline.json`, JSON.stringify(out, null, 2));
  console.log('Wrote performance/baseline.json');
}

run().catch((e) => {
  console.error('Profile run failed', e);
  process.exit(1);
});
