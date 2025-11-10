// public/js/status.js
// Atualiza o painel /relatorios/status com dados do endpoint /api/status.

(function statusPanel() {
  const REFRESH_INTERVAL_MS = 10000;
  const ENDPOINT = '/api/status';

  const state = {
    timerId: null,
  };

  const qs = (id) => document.getElementById(id);

  const elements = {
    lastUpdated: () => qs('status-last-updated'),
    appVersion: () => qs('app-version'),
    appBuild: () => qs('app-build'),
    appNode: () => qs('app-node'),
    appEnv: () => qs('app-env'),
    appHostname: () => qs('app-hostname'),
    appUptime: () => qs('app-uptime'),
    appMemory: () => qs('app-memory'),
    dbStatus: () => qs('db-status'),
    dbLatency: () => qs('db-latency'),
    dbRole: () => qs('db-role'),
    dbReplicationExtra: () => qs('db-replication-extra'),
    vipHealth: () => qs('vip-health-status'),
    tunnelHealth: () => qs('tunnel-health-status'),
    exportsPending: () => qs('exports-pending'),
    exportsProcessing: () => qs('exports-processing'),
    exportsFailed: () => qs('exports-failed'),
    exportsStalled: () => qs('exports-stalled'),
    exportsLastFailed: () => qs('exports-last-failed'),
    exportsLastCompleted: () => qs('exports-last-completed'),
    promCard: () => qs('prometheus-card'),
    promDisabled: () => qs('prometheus-disabled'),
    promTableBody: () => qs('prometheus-node-rows'),
  };

  const numberFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '—';
    const units = [
      { label: 'd', value: 86400 },
      { label: 'h', value: 3600 },
      { label: 'm', value: 60 },
      { label: 's', value: 1 },
    ];

    let remaining = Math.floor(seconds);
    const parts = [];

    for (const unit of units) {
      if (unit.value > remaining && parts.length === 0) continue;
      const amount = Math.floor(remaining / unit.value);
      remaining -= amount * unit.value;
      if (amount > 0 || unit.label === 's') {
        parts.push(`${amount}${unit.label}`);
      }
      if (parts.length >= 3) break;
    }

    return parts.length ? parts.join(' ') : '0s';
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  function formatMemoryMb(value) {
    if (!Number.isFinite(value)) return '—';
    return `${numberFormatter.format(Math.round(value))} MB`;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 100) return numberFormatter.format(Math.round(value));
    if (abs >= 10) return numberFormatter.format(Number(value.toFixed(1)));
    return numberFormatter.format(Number(value.toFixed(2)));
  }

  function formatBytesPerSecond(value) {
    if (!Number.isFinite(value)) return '—';
    if (Math.abs(value) > 1024) {
      const kb = value / 1024;
      if (Math.abs(kb) > 1024) {
        const mb = kb / 1024;
        return `${formatNumber(mb)} MB/s`;
      }
      return `${formatNumber(kb)} kB/s`;
    }
    return `${formatNumber(value)} B/s`;
  }

  function setText(getter, value) {
    const element = getter();
    if (element) {
      element.textContent = value;
    }
  }

  function updateAppSection(app) {
    setText(elements.appVersion, app?.version ?? '—');
    setText(elements.appBuild, app?.build ?? '—');
    setText(elements.appNode, app?.node ?? '—');
    setText(elements.appEnv, app?.env ?? '—');
    setText(elements.appHostname, app?.hostname ?? '—');
    setText(elements.appUptime, formatDuration(app?.uptime_s));
    setText(elements.appMemory, formatMemoryMb(app?.memory_mb));
  }

  function describeRole(replication) {
    if (!replication) return 'desconhecido';
    const role = replication.role || 'desconhecido';
    return role;
  }

  function updateDbSection(db) {
    const dbStatus = elements.dbStatus();
    const ok = Boolean(db?.ok);

    if (dbStatus) {
      dbStatus.textContent = ok ? 'Operacional' : 'Indisponível';
      dbStatus.classList.toggle('text-success', ok);
      dbStatus.classList.toggle('text-danger', !ok);
    }

    setText(elements.dbLatency, Number.isFinite(db?.latency_ms) ? `${db.latency_ms} ms` : '—');
    const role = describeRole(db?.replication);
    setText(elements.dbRole, role);

    const extra = elements.dbReplicationExtra();
    if (!extra) return;

    extra.innerHTML = '';

    if (db?.replication?.role === 'primary') {
      const peers = Array.isArray(db.replication.peers) ? db.replication.peers : [];
      if (!peers.length) {
        extra.textContent = 'Nenhum replica conectado.';
        return;
      }
      const list = document.createElement('ul');
      peers.forEach((peer) => {
        const item = document.createElement('li');
        const name = peer.application_name || 'replica';
        const addr = peer.client_addr || 'sem IP';
        const state = peer.state || '—';
        const sync = peer.sync_state || '—';
        item.textContent = `${name} @ ${addr} · ${state} (${sync})`;
        list.appendChild(item);
      });
      extra.appendChild(list);
      return;
    }

    if (db?.replication?.role === 'standby') {
      const wrapper = document.createElement('div');
      if (db.replication.wal_receiver) {
        const p = document.createElement('p');
        const { status, receive_start_lsn, received_tli } = db.replication.wal_receiver;
        p.textContent = `Recepção: ${status || '—'} · LSN inicial ${receive_start_lsn || '—'} · TLI ${received_tli || '—'}`;
        wrapper.appendChild(p);
      }
      if (db.replication.replay) {
        const p = document.createElement('p');
        const { receive_lsn, replay_lsn, replay_delay_seconds } = db.replication.replay;
        const delay = Number.isFinite(replay_delay_seconds) ? `${replay_delay_seconds}s` : '—';
        p.textContent = `Replay: receive ${receive_lsn || '—'} · replay ${replay_lsn || '—'} · delay ${delay}`;
        wrapper.appendChild(p);
      }
      if (!wrapper.childNodes.length) {
        wrapper.textContent = 'Sem detalhes de replay.';
      }
      extra.appendChild(wrapper);
      return;
    }

    if (db?.replication?.error) {
      extra.textContent = `Erro ao coletar replicação: ${db.replication.error}`;
    }
  }

  function describeRemoteService(result) {
    if (!result) return 'URL não configurada';
    if (result.available) {
      return `OK (${result.status})`;
    }
    if (result.status) {
      return `Falha (${result.status})`;
    }
    return `Indisponível (${result.error || 'erro desconhecido'})`;
  }

  function updateRemoteServices(vip, tunnel) {
    setText(elements.vipHealth, describeRemoteService(vip));
    setText(elements.tunnelHealth, describeRemoteService(tunnel));
  }

  function renderPrometheus(summary) {
    const disabled = elements.promDisabled();
    const tbody = elements.promTableBody();

    if (!disabled || !tbody) return;

    const enabled = Boolean(summary?.enabled);
    const nodes = summary?.nodes || {};
    const instances = Object.entries(nodes);

    if (!enabled) {
      disabled.hidden = false;
      disabled.textContent = 'Sem dados Prometheus.';
      tbody.innerHTML = '';
      return;
    }

    if (!instances.length) {
      disabled.hidden = false;
      disabled.textContent = summary?.error ? `Falha ao carregar métricas: ${summary.error}` : 'Sem dados Prometheus.';
      tbody.innerHTML = '';
      return;
    }

    disabled.hidden = true;
    tbody.innerHTML = '';

    instances.forEach(([instance, metrics]) => {
      const tr = document.createElement('tr');

      const cells = [
        instance,
        (metrics.up ?? 0) === 1 ? 'UP' : 'DOWN',
        formatNumber(metrics.load1),
        `${formatNumber(metrics.cpu)}%`,
        `${formatNumber(metrics.mem)}%`,
        `${formatNumber(metrics.rootfs)}%`,
        formatBytesPerSecond(metrics.rx),
        formatBytesPerSecond(metrics.tx),
      ];

      cells.forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  function updateExportsSection(queue) {
    const counts = queue?.counts || {};
    setText(elements.exportsPending, formatNumber(Number(counts.pending) || 0));
    setText(elements.exportsProcessing, formatNumber(Number(counts.processing) || 0));
    setText(elements.exportsFailed, formatNumber(Number(counts.failed) || 0));
    setText(elements.exportsStalled, formatNumber(Number(queue?.stalled) || 0));

    if (queue?.last_failed) {
      const error = queue.last_failed.error || 'Falha';
      const at = formatDateTime(queue.last_failed.at);
      setText(elements.exportsLastFailed, `${error} (${at})`);
    } else if (queue?.error) {
      setText(elements.exportsLastFailed, `Erro ao coletar: ${queue.error}`);
    } else {
      setText(elements.exportsLastFailed, 'Nenhuma falha registrada');
    }

    setText(
      elements.exportsLastCompleted,
      queue?.last_completed_at ? formatDateTime(queue.last_completed_at) : 'Ainda não concluído'
    );
  }

  async function loadStatus() {
    try {
      const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      const { app, db, vip_health: vip, tunnel_health: tunnel, prometheus, exports: exportsQueue } = payload.data || {};
      updateAppSection(app);
      updateDbSection(db);
      updateRemoteServices(vip, tunnel);
      renderPrometheus(prometheus);
      updateExportsSection(exportsQueue);

      const now = new Date();
      setText(elements.lastUpdated, `Atualizado às ${now.toLocaleTimeString('pt-BR')}`);
    } catch (err) {
      console.error('[status] Falha ao atualizar painel:', err);
      const text = `Erro ao atualizar: ${err?.message || err}`;
      setText(elements.lastUpdated, text);
    }
  }

  function schedule() {
    if (state.timerId) {
      clearInterval(state.timerId);
    }
    state.timerId = setInterval(() => {
      if (!document.hidden) {
        loadStatus();
      }
    }, REFRESH_INTERVAL_MS);
  }

  function init() {
    if (!qs('status-last-updated')) {
      return;
    }
    loadStatus();
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
