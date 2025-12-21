#!/usr/bin/env node

// scripts/bench-alerts.js
// Benchmark de um ciclo do scheduler de alertas (N+1) com contagem de queries.

const db = require('../config/database');
const { runAlertCycle } = require('../services/messageAlerts');

const stats = {
  count: 0,
  totalMs: 0,
};

function wrapQuery(fn) {
  return async (...args) => {
    const start = process.hrtime.bigint();
    try {
      return await fn(...args);
    } finally {
      const end = process.hrtime.bigint();
      stats.count += 1;
      stats.totalMs += Number(end - start) / 1e6;
    }
  };
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

async function main() {
  const originalQuery = db.query.bind(db);
  db.query = wrapQuery(originalQuery);

  const originalConnect = db.connect.bind(db);
  db.connect = async () => {
    const client = await originalConnect();
    const originalClientQuery = client.query.bind(client);
    client.query = wrapQuery(originalClientQuery);
    return client;
  };

  const startedAt = new Date();
  const startNs = process.hrtime.bigint();

  const result = await runAlertCycle();

  const endNs = process.hrtime.bigint();
  const durationMs = Number(endNs - startNs) / 1e6;
  const avgQueryMs = stats.count ? stats.totalMs / stats.count : 0;

  console.log(JSON.stringify({
    started_at: startedAt.toISOString(),
    duration_ms: round(durationMs),
    queries: {
      count: stats.count,
      total_ms: round(stats.totalMs),
      avg_ms: round(avgQueryMs),
    },
    result,
  }, null, 2));
}

main()
  .then(() => db.close())
  .catch((err) => {
    console.error('[bench-alerts] falha', err);
    return db.close().catch(() => undefined).finally(() => process.exit(1));
  });
