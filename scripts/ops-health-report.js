#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * scripts/ops-health-report.js
 *
 * Gera um relatório de saúde dos nós mach1/mach2/mach3 e,
 * opcionalmente, envia por e-mail usando as credenciais SMTP do .env.
 *
 * Dependências: nodemailer, ssh (com chave ~/mach-key), smartctl, jq, socat, curl.
 */

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

const DOTENV_PATH = process.env.DOTENV_FILE
  ? path.resolve(process.cwd(), process.env.DOTENV_FILE)
  : path.resolve(__dirname, '..', '.env');

if (fs.existsSync(DOTENV_PATH)) {
  dotenv.config({ path: DOTENV_PATH });
}

const nodes = [
  { name: 'mach1', host: '192.168.0.251' },
  { name: 'mach2', host: '192.168.0.252' },
  { name: 'mach3', host: '192.168.0.253' },
];

const sshKey = process.env.HEALTH_SSH_KEY || '/home/alessandro/.ssh/mach-key';
const sshUser = process.env.HEALTH_SSH_USER || 'alessandro';
const sudoPassword = process.env.SUDO_PASSWORD || process.env.HEALTH_SUDO_PASSWORD || 'ale123';
const recipients =
  getArgValue('--email') ||
  process.env.HEALTH_REPORT_RECIPIENTS ||
  process.env.SMTP_USER;
const sendEmail = Boolean(recipients);

const repoPath = '/home/alessandro/late-prod';
const reportSections = [];
const alerts = [];

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return null;
}

function shQuote(value) {
  if (value === undefined || value === null) return "''";
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function ssh(node, remoteCommand, options = {}) {
  const script = `set -euo pipefail; ${remoteCommand}`;
  const encoded = Buffer.from(script, 'utf8').toString('base64');
  const remote = `echo ${encoded} | base64 --decode | bash`;
  const args = [
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=no',
    '-i',
    sshKey,
    `${sshUser}@${node.host}`,
    remote,
  ];
  try {
    return execFileSync('ssh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? `\n${err.stderr.toString()}` : '';
    throw new Error(`${remoteCommand} -> ${err.message}${stderr}`);
  }
}

function escapeSingleQuotes(value) {
  return String(value).replace(/'/g, `'\\''`);
}

function sudoPrefix(cmd, options = {}) {
  const userArg = options.user ? `-u ${options.user}` : '';
  if (!sudoPassword) return `sudo ${userArg} ${cmd}`.trim();
  const prefix = `printf '%s\\n' '${escapeSingleQuotes(sudoPassword)}' | sudo -S -p '' ${userArg}`;
  return `${prefix} ${cmd}`;
}

function addSection(title, bodyLines) {
  reportSections.push([title, ...bodyLines, ''].join('\n'));
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value)) return `${bytes} bytes`;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GiB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KiB`;
  return `${value} bytes`;
}

function performBackup() {
  const pgHost = process.env.PGHOST || process.env.PG_HOST || '192.168.0.250';
  const pgUser = process.env.PGUSER || process.env.PG_USER || 'late_app';
  const pgDatabase = process.env.PGDATABASE || process.env.PG_DATABASE || 'late_prod';
  const pgPassword = process.env.PGPASSWORD || process.env.PG_PASSWORD;
  if (!pgPassword) {
    addSection('Backup PostgreSQL', ['PGPASSWORD/PG_PASSWORD não configurado; backup ignorado.']);
    return;
  }

  const backupDir = process.env.DB_BACKUP_DIR || '/var/backups/late';
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .slice(0, 13); // YYYYMMDD_HH
  const backupFile = `${backupDir}/late_prod_${timestamp}.sql.gz`;

  try {
    const script = [
      sudoPrefix(`mkdir -p ${backupDir}`),
      sudoPrefix(`chown ${sshUser}:${sshUser} ${backupDir}`),
      `cd ${repoPath}`,
      `export PGPASSWORD='${escapeSingleQuotes(pgPassword)}'`,
      `/usr/bin/pg_dump -h ${pgHost} -U ${pgUser} -d ${pgDatabase} | gzip > ${backupFile}`,
      `/usr/bin/stat -c "%s" ${backupFile}`,
    ].join('\n');

    const raw = ssh(nodes.find((n) => n.name === 'mach2'), script);
    const output = raw.trim().split('\n');
    const sizeBytes = output.pop();
    addSection('Backup PostgreSQL', [
      `Backup concluído em ${backupFile}`,
      `Tamanho: ${formatBytes(sizeBytes)}`,
    ]);
  } catch (err) {
    addSection('Backup PostgreSQL', [`Erro ao gerar backup: ${err.message}`]);
  }
}

function collectEnvHashes() {
  const lines = [];
  let referenceSignature = null;
  let referenceMap = null;
  const hashValue = (value) =>
    crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 12);
  nodes.forEach((node, index) => {
    try {
      const raw = ssh(node, `cd ${repoPath} && cat .env`);
      const parsed = dotenv.parse(raw);
      const appVersion = parsed.APP_VERSION || 'N/D';
      const normalized = { ...parsed };
      delete normalized.APP_VERSION;
      const signature = crypto
        .createHash('sha256')
        .update(
          JSON.stringify(
            Object.keys(normalized)
              .sort()
              .reduce((acc, key) => {
                acc[key] = normalized[key];
                return acc;
              }, {}),
          ),
        )
        .digest('hex');
      if (index === 0) {
        referenceSignature = signature;
        referenceMap = normalized;
      }
      const status = signature === referenceSignature ? 'OK' : 'ALTERADO';
      lines.push(`- ${node.name}: APP_VERSION=${appVersion} · assinatura=${signature} (${status})`);
      if (status !== 'OK') {
        alerts.push(`.env divergente em ${node.name} (APP_VERSION=${appVersion})`);
      }
      if (signature !== referenceSignature && referenceMap) {
        const diffs = Object.keys({ ...referenceMap, ...normalized })
          .filter((key) => (referenceMap[key] || '') !== (normalized[key] || ''))
          .map(
            (key) =>
              `    • ${key}: hash_atual=${hashValue(normalized[key])} hash_ref=${hashValue(
                referenceMap[key],
              )}`,
          );
        if (diffs.length) lines.push(...diffs);
      }
    } catch (err) {
      lines.push(`- ${node.name}: erro ao ler .env -> ${err.message}`);
      alerts.push(`Falha ao ler .env em ${node.name}: ${err.message}`);
    }
  });
  addSection('Configuração (.env)', lines);
}

function collectPm2Status() {
  const lines = [];
  nodes.forEach((node) => {
    try {
      const json = ssh(node, 'pm2 jlist --no-color');
      const processes = JSON.parse(json);
      const expected = ['late-prod', 'late-prod-email-worker', 'late-prod-export-worker'];
      lines.push(`- ${node.name}:`);
      expected.forEach((name) => {
        const proc = processes.find((p) => p.name === name);
        if (!proc) {
          lines.push(`    • ${name}: não encontrado`);
          return;
        }
        const status = proc.pm2_env?.status || 'desconhecido';
        const host = proc.pm2_env?.env?.HOST || 'N/D';
        const ok = status === 'online' && (name !== 'late-prod' || host === '0.0.0.0');
        lines.push(`    • ${name}: status=${status} host=${host}${ok ? '' : ' (ALERTA)'}`);
        if (!ok) alerts.push(`PM2 ${name} em ${node.name} não está online/host esperado (status=${status}, host=${host})`);
      });
    } catch (err) {
      lines.push(`- ${node.name}: erro ao consultar PM2 -> ${err.message}`);
      alerts.push(`PM2 indisponível em ${node.name}: ${err.message}`);
    }
  });
  addSection('PM2', lines);
}

function collectDiskInfo() {
  const lines = [];
  nodes.forEach((node) => {
    try {
      const df = ssh(node, "df -h --output=source,size,used,avail,pcent,target / | tail -n +2");
      lines.push(`- ${node.name}: ${df.trim()}`);
      const match = df.match(/(\d+)%\s+\/$/);
      if (match && Number(match[1]) >= 80) {
        alerts.push(`Disco raiz em ${node.name} acima de 80% (${match[1]}%)`);
      }
    } catch (err) {
      lines.push(`- ${node.name}: erro ao consultar df -> ${err.message}`);
      alerts.push(`df falhou em ${node.name}: ${err.message}`);
    }
  });
  addSection('Uso de disco', lines);
}

function collectSmartInfo() {
  const lines = [];
  nodes.forEach((node) => {
    try {
      const cmd = sudoPrefix('smartctl -H /dev/sda');
      const output = ssh(node, cmd);
      const match = output.match(/overall-health self-assessment test result:\s+(\w+)/i);
      const status = match ? match[1] : 'N/D';
      lines.push(`- ${node.name}: SMART /dev/sda -> ${status}`);
      if (!['PASSED', 'OK'].includes(status.toUpperCase())) {
        alerts.push(`SMART alerta em ${node.name}: status=${status}`);
      }
    } catch (err) {
      lines.push(`- ${node.name}: SMART indisponível -> ${err.message}`);
      alerts.push(`SMART falhou em ${node.name}: ${err.message}`);
    }
  });
  addSection('SMART (discos)', lines);
}

function collectUbuntuPro() {
  const lines = [];
  nodes.forEach((node) => {
    try {
      const rawStatus = ssh(node, 'pro status --format json || pro status --format json');
      const statusJson = JSON.parse(rawStatus);
      const attached = Boolean(statusJson.attached);
      const services = Array.isArray(statusJson.services) ? statusJson.services : [];
      const findService = (name) => services.find((s) => s.name === name) || {};
      const esmApps = findService('esm-apps').status || 'N/D';
      const esmInfra = findService('esm-infra').status || 'N/D';
      const livepatch = findService('livepatch').status || 'N/D';

      let secSummary = null;
      try {
        const rawSec = ssh(
          node,
          'pro security-status --format json || pro security-status --format json',
        );
        const secJson = JSON.parse(rawSec);
        secSummary = secJson.summary || {};
      } catch (innerErr) {
        secSummary = { _error: innerErr.message };
      }

      if (secSummary && secSummary._error) {
        lines.push(
          `- ${node.name}: attached=${attached ? 'sim' : 'não'}; esm-apps=${esmApps}; esm-infra=${esmInfra}; livepatch=${livepatch}; segurança=erro -> ${secSummary._error}`,
        );
        alerts.push(`Ubuntu Pro/security-status falhou em ${node.name}: ${secSummary._error}`);
      } else {
        const reboot = (secSummary && secSummary.reboot_required) || 'desconhecido';
        const stdUpdates =
          secSummary && typeof secSummary.num_standard_security_updates === 'number'
            ? secSummary.num_standard_security_updates
            : 'N/D';
        const esmAppsUpdates =
          secSummary && typeof secSummary.num_esm_apps_updates === 'number'
            ? secSummary.num_esm_apps_updates
            : 'N/D';
        const esmInfraUpdates =
          secSummary && typeof secSummary.num_esm_infra_updates === 'number'
            ? secSummary.num_esm_infra_updates
            : 'N/D';
        lines.push(
          `- ${node.name}: attached=${attached ? 'sim' : 'não'}; esm-apps=${esmApps}; esm-infra=${esmInfra}; livepatch=${livepatch}; reboot=${reboot}; std_sec_updates=${stdUpdates}; esm_apps_updates=${esmAppsUpdates}; esm_infra_updates=${esmInfraUpdates}`,
        );
        if (!attached || reboot === true) {
          alerts.push(`Ubuntu Pro em ${node.name}: attached=${attached ? 'sim' : 'não'}, reboot_required=${reboot}`);
        }
      }
    } catch (err) {
      lines.push(`- ${node.name}: erro ao consultar Ubuntu Pro -> ${err.message}`);
      alerts.push(`Ubuntu Pro falhou em ${node.name}: ${err.message}`);
    }
  });
  addSection('Ubuntu Pro & atualizações de segurança', lines);
}

function collectJournalAlerts() {
  const lines = [];
  nodes.forEach((node) => {
    try {
      const out = ssh(node, `${sudoPrefix('journalctl -p err --since "1 hour ago"')} | tail -n 10 || true`);
      const filtered = out
        .split('\n')
        .filter(
          (line) =>
            line &&
            !line.includes('pam_unix(sudo:auth)') &&
            !line.includes('incorrect password attempt'),
        )
        .join('\n');
      const hasLines = Boolean(filtered && filtered.trim().length);
      const final = hasLines ? filtered : '    (sem erros relevantes na última hora)';
      lines.push(`- ${node.name}:\n${final}`);
      if (hasLines) alerts.push(`Erros no journal (última hora) em ${node.name}`);
    } catch (err) {
      lines.push(`- ${node.name}: erro ao consultar journal -> ${err.message}`);
      alerts.push(`journalctl falhou em ${node.name}: ${err.message}`);
    }
  });
  addSection('Logs (última hora)', lines);
}

function collectHAProxy() {
  try {
    const raw = ssh(
      nodes.find((n) => n.name === 'mach2'),
      `${sudoPrefix(
        "bash -c \"printf 'show stat\\n' | socat stdio /run/haproxy/admin.sock\"",
      )}`,
    );
    const payload = raw.trim();
    if (!payload) {
      addSection('HAProxy (late_back)', [
        'Admin socket não retornou dados (verificar permissões do sudo ou nível do socket).',
      ]);
      return;
    }
    const lines = payload
      .split('\n')
      .filter((line) => line && !line.startsWith('#') && line.startsWith('late_back,'))
      .map((line) => {
        const cols = line.split(',');
        const backend = cols[0];
        const server = cols[1];
        const status = cols[17] || cols[32] || 'N/D';
        const checkStatus = cols[34] || '';
        const txt = `- ${backend}/${server} -> ${status}${checkStatus ? ` (${checkStatus})` : ''}`;
        if (status !== 'UP') alerts.push(`HAProxy late_back ${server} está ${status}`);
        return txt;
      });
    addSection('HAProxy (late_back)', lines.length ? lines : ['Sem servidores listados']);
  } catch (err) {
    addSection('HAProxy (late_back)', [`Erro ao consultar: ${err.message}`]);
    alerts.push(`HAProxy late_back consulta falhou: ${err.message}`);
  }
}

function collectPostgres() {
  try {
    const out = ssh(
      nodes.find((n) => n.name === 'mach2'),
      `${sudoPrefix("psql -At -c \"select client_addr||' state='||state||' sync='||sync_state from pg_stat_replication;\"", { user: 'postgres' })}`,
    );
    const lines = out
      ? out
          .split('\n')
          .filter(Boolean)
          .map((line) => `- ${line}`)
      : ['Sem conexões de réplica detectadas'];
    if (!out) alerts.push('PostgreSQL sem réplicas detectadas em pg_stat_replication');
    addSection('PostgreSQL (pg_stat_replication)', lines);
  } catch (err) {
    addSection('PostgreSQL (pg_stat_replication)', [`Erro ao consultar: ${err.message}`]);
    alerts.push(`PostgreSQL réplica consulta falhou: ${err.message}`);
  }
}

async function collectPrometheus() {
  const lines = [];
  const url = process.env.PROMETHEUS_URL;
  if (!url) {
    addSection('Prometheus', ['PROMETHEUS_URL não configurada']);
    return;
  }
  try {
    const healthy = await fetch(`${url.replace(/\/$/, '')}/-/healthy`);
    lines.push(`- Healthcheck: ${healthy.status} ${healthy.statusText}`);
    if (healthy.status !== 200) alerts.push(`Prometheus healthcheck retornou ${healthy.status}`);
  } catch (err) {
    lines.push(`- Healthcheck: erro -> ${err.message}`);
    alerts.push(`Prometheus healthcheck falhou: ${err.message}`);
  }
  try {
    const targetsResp = await fetch(`${url.replace(/\/$/, '')}/api/v1/targets`);
    if (!targetsResp.ok) throw new Error(`HTTP ${targetsResp.status}`);
    const data = await targetsResp.json();
    const active = data.data?.activeTargets || [];
    active.forEach((target) => {
      lines.push(
        `- ${target.labels?.instance || 'sem-label'}: ${target.health} (${target.lastError || 'ok'})`,
      );
      if (target.health !== 'up') alerts.push(`Prometheus target ${target.labels?.instance} em ${target.health}`);
    });
  } catch (err) {
    lines.push(`- Targets: erro -> ${err.message}`);
    alerts.push(`Prometheus targets falhou: ${err.message}`);
  }
  addSection('Prometheus', lines);
}

async function collectSlackStatus() {
  const lines = [];
  try {
    const resp = await fetch('https://status.slack.com/api/v2.0.0/current');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    lines.push(`- Status: ${data.status} (${data.date_created})`);
    if (Array.isArray(data.active_incidents) && data.active_incidents.length) {
      data.active_incidents.forEach((incident) => {
        lines.push(`  • ${incident.title} - ${incident.status}`);
      });
    } else {
      lines.push('  • Sem incidentes ativos reportados');
    }
  } catch (err) {
    lines.push(`- Erro ao consultar status Slack: ${err.message}`);
  }
  addSection('Slack (status público)', lines);
}

async function triggerAutoDiagnostic(incidentId) {
  if (!alerts.length) return null;

  const url =
    process.env.DIAGNOSTIC_TRIGGER_URL ||
    process.env.DIAGNOSTIC_URL ||
    process.env.DIAGNOSTIC_ENDPOINT ||
    '';
  const token = process.env.DIAGNOSTIC_TOKEN || process.env.DARKSTAR_DIAGNOSTIC_TOKEN || '';
  if (!url || !token) {
    addSection('Auto-diagnóstico (Darkstar)', [
      'Não configurado: defina DIAGNOSTIC_TRIGGER_URL e DIAGNOSTIC_TOKEN para acionar diagnose.sh automaticamente.',
    ]);
    return null;
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.DIAGNOSTIC_TIMEOUT_MS || 5000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Diagnostic-Token': token,
      },
      body: JSON.stringify({ incident_id: incidentId }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json().catch(() => ({}));
    const diagId = data.incident_id || incidentId;
    addSection('Auto-diagnóstico (Darkstar)', [
      `Disparado em ${url}`,
      `incident_id=${diagId}`,
    ]);
    return diagId;
  } catch (err) {
    clearTimeout(timer);
    addSection('Auto-diagnóstico (Darkstar)', [`Falhou ao disparar: ${err.message}`]);
    return null;
  }
}

function buildEmailTransport() {
  const secure =
    String(process.env.SMTP_SECURE || '').toLowerCase() === '1' ||
    String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const clean = (v) => (v ? v.replace(/^['"]|['"]$/g, '') : v);
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error('Variáveis SMTP_* ausentes no .env');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure,
    auth: {
      user: clean(process.env.SMTP_USER),
      pass: clean(process.env.SMTP_PASS),
    },
  });
}

async function main() {
  performBackup();
  collectEnvHashes();
  collectPm2Status();
  collectDiskInfo();
  collectSmartInfo();
  collectUbuntuPro();
  collectJournalAlerts();
  collectHAProxy();
  collectPostgres();
  await collectPrometheus();
  await collectSlackStatus();
  if (alerts.length) await triggerAutoDiagnostic(crypto.randomUUID());

  const report = reportSections.join('\n');
  const alertHeader = alerts.length
    ? `ALERTAS (${alerts.length}):\n- ${alerts.join('\n- ')}\n\n`
    : 'Sem alertas detectados. E-mail não será enviado.\n\n';
  const header = `Relatório de Saúde – ${new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })}\nHost: ${os.hostname()}\n`;
  const message = `${alertHeader}${header}\n${report}`;
  process.exitCode = alerts.length ? 1 : 0;

  console.log(message);

  if (sendEmail && alerts.length) {
    try {
      const transporter = buildEmailTransport();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipients,
        subject: `LATE · Saúde dos nós (${new Date().toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        })})`,
        text: message,
      });
      console.log(`E-mail enviado para ${recipients}`);
    } catch (err) {
      console.error(`Falha ao enviar e-mail: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error('Erro inesperado no relatório:', err);
  process.exitCode = 1;
});
