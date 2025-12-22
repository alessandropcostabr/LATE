// controllers/statusController.js
// Painel de status /api/status: agrega saúde do app, banco, VIP, túnel e (opcional) Prometheus.

const os = require('os');
const Diagnostics = require('../models/diagnostics');
const ReportExportModel = require('../models/reportExport');

function getFetch() {
  const fetchImpl = global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('[statusController] fetch API indisponível no runtime atual');
  }
  return fetchImpl.bind(global);
}

async function safeFetchJson(url, timeoutMs = 2500) {
  if (!url) {
    return { available: false, error: 'url_not_set' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await getFetch()(url, { signal: controller.signal });
    const contentType = response.headers?.get?.('content-type') || '';
    let data;

    if (contentType.includes('json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      available: response.ok,
      status: response.status,
      data,
    };
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'timeout' : String(err?.message || err);
    return { available: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

async function promQL(query) {
  const base = process.env.PROMETHEUS_URL;
  if (!base) return null;

  const url = `${base.replace(/\/$/, '')}/api/v1/query?query=${encodeURIComponent(query)}`;
  const response = await safeFetchJson(url, 2500);
  if (!response?.available || response.status !== 200) {
    return null;
  }

  const payload = response.data;
  if (!payload || payload.status !== 'success') {
    return null;
  }

  return Array.isArray(payload.data?.result) ? payload.data.result : null;
}

async function getPrometheusNodeSummary() {
  if (!process.env.PROMETHEUS_URL) {
    return { enabled: false, nodes: {} };
  }

  const queries = {
    up: 'up{job=~"node.*|node-exporter"}',
    load1: 'node_load1',
    cpu: '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)',
    mem: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
    rootfs: '(1 - (node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{mountpoint="/",fstype!~"tmpfs|overlay"})) * 100',
    rx: 'sum by (instance) (rate(node_network_receive_bytes_total{device!~"lo"}[2m]))',
    tx: 'sum by (instance) (rate(node_network_transmit_bytes_total{device!~"lo"}[2m]))',
  };

  try {
    const [up, load1, cpu, mem, rootfs, rx, tx] = await Promise.all([
      promQL(queries.up),
      promQL(queries.load1),
      promQL(queries.cpu),
      promQL(queries.mem),
      promQL(queries.rootfs),
      promQL(queries.rx),
      promQL(queries.tx),
    ]);

    const nodes = {};
    const parseValue = (item) => {
      if (!item || !Array.isArray(item.value)) return NaN;
      const [, value] = item.value;
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    };

    const fold = (series, key) => {
      (series || []).forEach((item) => {
        const instance = item?.metric?.instance || 'unknown';
        if (!nodes[instance]) nodes[instance] = {};
        nodes[instance][key] = parseValue(item);
      });
    };

    fold(up, 'up');
    fold(load1, 'load1');
    fold(cpu, 'cpu');
    fold(mem, 'mem');
    fold(rootfs, 'rootfs');
    fold(rx, 'rx');
    fold(tx, 'tx');

    return { enabled: true, nodes };
  } catch (err) {
    return { enabled: true, nodes: {}, error: String(err?.message || err) };
  }
}

async function getExportQueueHealth() {
  try {
    return await ReportExportModel.getQueueMetrics();
  } catch (err) {
    return { error: String(err?.message || err) };
  }
}

exports.getStatus = async (_req, res) => {
  try {
    const appInfo = {
      version: process.env.npm_package_version || process.env.APP_VERSION || 'unknown',
      build: process.env.APP_BUILD || null,
      node: process.version,
      env: process.env.NODE_ENV || 'development',
      uptime_s: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      hostname: os.hostname(),
    };

    const [dbHealth, vipHealth, tunnelHealth, prometheus, exportsHealth] = await Promise.all([
      Diagnostics.getPgHealth(),
      safeFetchJson(process.env.VIP_HEALTH_URL || 'http://127.0.0.1:3000/api/health'),
      safeFetchJson(process.env.TUNNEL_HEALTH_URL),
      getPrometheusNodeSummary(),
      getExportQueueHealth(),
    ]);

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        app: appInfo,
        db: dbHealth,
        vip_health: vipHealth,
        tunnel_health: tunnelHealth,
        prometheus,
        exports: exportsHealth,
      },
    });
  } catch (err) {
    console.error('[status] Falha ao coletar status operacional:', err);
    res.set('Cache-Control', 'no-store');
    return res.status(500).json({
      success: false,
      error: `Falha ao coletar status: ${err?.message || err}`,
    });
  }
};

// Exportamos internamente para facilitar testes.
exports.__private = {
  safeFetchJson,
  getPgHealth: Diagnostics.getPgHealth,
  getPrometheusNodeSummary,
  promQL,
  getExportQueueHealth,
};
