# Sprint 2 — Integração Prometheus no Painel de Status
> Atualizado em 2025/11/12.

**Data:** 09/11/2025  
**Nota:** Porta do app Node/PM2 em PROD = **3100** (apenas para health local).

## 🎯 Objetivo
Integrar Prometheus a `/api/status` e à view via tabela **Resumo Prometheus por Nó** (campos: `up`, `load1`, `CPU %`, `Mem %`, `RootFS %`, `RX/TX`).

## 🔧 .env
```dotenv
PROMETHEUS_URL=http://192.168.15.201:9090
```

## 🧠 Controller — PromQL e agregação
```js
async function promQL(query){
  const base=process.env.PROMETHEUS_URL; if(!base) return null;
  const url=`${base}/api/v1/query?query=${encodeURIComponent(query)}`;
  const r = await safeFetchJson(url, 2500);
  if(!r?.available || r.status!==200) return null;
  return r.data?.data?.result ?? null;
}

async function getPrometheusNodeSummary(){
  if(!process.env.PROMETHEUS_URL) return { enabled:false };

  const queries = {
    up: `up{job=~"node.*|node-exporter"}`,
    load1: `node_load1`,
    cpu: `100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)`,
    mem: `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100`,
    rootfs: `(1 - (node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{mountpoint="/",fstype!~"tmpfs|overlay"})) * 100`,
    rx: `sum by (instance) (rate(node_network_receive_bytes_total{device!~"lo"}[2m]))`,
    tx: `sum by (instance) (rate(node_network_transmit_bytes_total{device!~"lo"}[2m]))`,
  };

  const [up,load1,cpu,mem,rootfs,rx,tx] = await Promise.all([
    promQL(queries.up), promQL(queries.load1), promQL(queries.cpu),
    promQL(queries.mem), promQL(queries.rootfs), promQL(queries.rx), promQL(queries.tx)
  ]);

  const byInst={}; const val = it => Array.isArray(it.value)? parseFloat(it.value[1]) : NaN;
  function fold(arr,key){ (arr||[]).forEach(it=>{ const inst=it.metric?.instance||'unknown'; byInst[inst]??={}; byInst[inst][key]=val(it); }); }
  fold(up,'up'); fold(load1,'load1'); fold(cpu,'cpu'); fold(mem,'mem'); fold(rootfs,'rootfs'); fold(rx,'rx'); fold(tx,'tx');

  return { enabled:true, nodes: byInst };
}
```

### Handler principal (trecho)
```js
const promSummary = await getPrometheusNodeSummary();
data.prometheus = promSummary;
```

## 🧩 View — Tabela "Resumo Prometheus por Nó"
Colunas: **Instance | UP | Load1 | CPU % | Mem % | RootFS % | RX (B/s) | TX (B/s)**

## 🖥️ Front-end — preenchimento
```js
function fmtNum(v){ if(v===undefined||v===null||Number.isNaN(v)) return '—'; return Math.abs(v)>=100? v.toFixed(0): v.toFixed(2); }
function renderPrometheusSummary(nodes){
  const tb=document.getElementById('prometheus-node-rows'); if(!tb) return;
  tb.innerHTML='';
  if(!nodes || !Object.keys(nodes).length){ tb.innerHTML='Sem dados Prometheus.'; return; }
  for(const [inst,m] of Object.entries(nodes)){
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${inst}</td><td>${(m.up??0)===1?'UP':'DOWN'}</td>
      <td>${fmtNum(m.load1)}</td><td>${fmtNum(m.cpu)}%</td><td>${fmtNum(m.mem)}%</td>
      <td>${fmtNum(m.rootfs)}%</td><td>${fmtNum(m.rx)}</td><td>${fmtNum(m.tx)}</td>`;
    tb.appendChild(tr);
  }
}
```

## ✅ Critérios de aceite
1) `/api/status` inclui `prometheus.enabled` e `prometheus.nodes`.  
2) Tabela na view preenche quando `PROMETHEUS_URL` está acessível.  
3) Em falha, UI mostra **"Sem dados Prometheus."**  
