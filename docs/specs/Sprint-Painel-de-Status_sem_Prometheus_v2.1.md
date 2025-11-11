# Sprint 1 — Painel de Status (Back + Front) **sem Prometheus**

**Data:** 09/11/2025  
**Escopo:** `/api/status` (JSON protegido) e `/relatorios/status` (EJS + JS).  
**Nota:** Porta da aplicação Node (PM2) em **PROD = 3100** (ajustada).

## 🎯 Objetivo
Entregar status operacional do LATE **sem** integrar Prometheus. Campos:
- **App**: versão, uptime, memória, hostname, env
- **DB**: latência `SELECT 1`, papel via `pg_is_in_recovery()`, replicação (primário/standby)
- **VIP/Health local**: `VIP_HEALTH_URL`
- **Tunnel Cloudflare**: `TUNNEL_HEALTH_URL`

## 🔧 .env (variáveis)
```dotenv
# VIP aponta para a porta do app Node (PM2) em PROD
VIP_HEALTH_URL=http://192.168.15.250/health
TUNNEL_HEALTH_URL=https://late.amah.com.br/health
```

## 🧠 Controller — helpers
```js
// controllers/statusController.js
const os = require('os');
const { performance } = require('perf_hooks');
const db = require('../config/database');

const fetch = global.fetch || ((...a)=>import('node-fetch').then(({default:f})=>f(...a)));

async function safeFetchJson(url, timeoutMs=2500){
  if(!url) return { available:false, error:'url_not_set' };
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const ct = r.headers.get('content-type')||'';
    const data = ct.includes('json') ? await r.json() : await r.text();
    return { available: r.ok, status: r.status, data };
  } catch(e){
    return { available:false, error:String(e.message||e) };
  } finally {
    clearTimeout(t);
  }
}

async function getPgHealth(){
  const t0 = performance.now();
  const ping = await db.query('SELECT 1 as ok');
  const latency = Math.round(performance.now() - t0);

  const rec = await db.query('SELECT pg_is_in_recovery() AS is_recovery');
  const isPrimary = rec.rows[0]?.is_recovery === false;
  const replication = { role: isPrimary ? 'primary' : 'standby' };

  if (isPrimary) {
    const q = await db.query(`
      SELECT application_name, client_addr, state, sync_state
      FROM pg_stat_replication
    `);
    replication.peers = q.rows;
  } else {
    const wal = await db.query('SELECT status FROM pg_stat_wal_receiver');
    const rp  = await db.query(`
      SELECT pg_last_wal_receive_lsn() AS receive_lsn,
             pg_last_wal_replay_lsn()  AS replay_lsn,
             EXTRACT(EPOCH FROM now()-pg_last_xact_replay_timestamp())::int AS replay_delay_seconds
    `);
    replication.wal_receiver = wal.rows[0]||null;
    replication.replay = rp.rows[0]||null;
  }

  return { ok: ping.rows[0]?.ok===1, latency_ms:latency, is_primary:isPrimary, replication };
}
```

## 🚪 Handler principal
```js
exports.getStatus = async (req,res)=>{
  try{
    const appInfo = {
      version: process.env.npm_package_version || 'unknown',
      node: process.version,
      env: process.env.NODE_ENV || 'development',
      uptime_s: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss/(1024*1024)),
      hostname: require('os').hostname()
    };

    const [dbH, vipH, tunH] = await Promise.all([
      getPgHealth(),
      safeFetchJson(process.env.VIP_HEALTH_URL || 'http://127.0.0.1:3100/health'),
      safeFetchJson(process.env.TUNNEL_HEALTH_URL)
    ]);

    return res.json({ success:true, data:{ app: appInfo, db: dbH, vip_health: vipH, tunnel_health: tunH }});
  }catch(err){
    return res.status(500).json({ success:false, error:'Falha ao coletar status: '+(err.message||err) });
  }
};
```

## 🔒 Rotas
```js
// routes/api.js
router.get('/status',
  auth.requireAuth,
  auth.requireRoles(['ADMIN','SUPERVISOR']),
  statusController.getStatus
);

// routes/web.js
router.get('/relatorios/status',
  auth.requireAuth,
  auth.requireRoles(['ADMIN','SUPERVISOR']),
  (req,res)=>res.render('status')
);
```

## ✅ Critérios de aceite
1) `/api/status` retorna 200 (autenticado) com `app`, `db`, `vip_health`, `tunnel_health`.  
2) `/relatorios/status` carrega e atualiza a cada 10s.  
3) **Sem inline script**; layout **intacto**.
