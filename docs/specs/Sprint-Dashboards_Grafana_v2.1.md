# Sprint 3 — Dashboards (Grafana) embutidos no Painel de Status
> Atualizado em 2025/11/12.

**Data:** 09/11/2025  
**Nota:** App Node/PM2 (PROD) = porta **3100**; Grafana mantém **3000**.

## 🎯 Objetivo
Embutir painéis Grafana via `iframe` no bloco "Dashboards Grafana" do `/relatorios/status`.

## 🔧 .env
```dotenv
GRAFANA_EMBED_ENABLED=true
GRAFANA_BASE=http://192.168.15.201:3000
GRAFANA_DASH_UID=node-exporter-full-uid
GRAFANA_PANELS=2,74
```

## 🧠 Controller — payload grafana
```js
grafana: {
  enabled: process.env.GRAFANA_EMBED_ENABLED === 'true',
  base: process.env.GRAFANA_BASE || null,
  uid: process.env.GRAFANA_DASH_UID || null,
  panels: (process.env.GRAFANA_PANELS||'').split(',').map(s=>s.trim()).filter(Boolean)
}
```

## 🧩 View — comportamento
- Ativo: renderizar `iframes` para os `panelId`s.
- Inativo: renderizar texto "Integração não habilitada."

## 🖥️ Front-end — `iframes`
```js
function renderGrafanaEmbed(grafana){
  const block=document.getElementById('grafana-block'); if(!block) return;
  if(!grafana?.enabled || !grafana?.base){ block.innerHTML='Integração não habilitada.'; return; }
  const uid = grafana.uid || '000000000';
  const panels = (grafana.panels && grafana.panels.length) ? grafana.panels : ['2','74'];
  const q='&from=now-15m&to=now&orgId=1&refresh=10s';
  const html = panels.map(p=>`
    <iframe src="${grafana.base}/d-solo/${uid}/_embed?panelId=${p}${q}" frameborder="0" width="100%" height="320" loading="lazy"></iframe>
  `).join('');
  block.innerHTML = html;
}
```

## 🛡️ CSP / Segurança
Adicionar host do Grafana em `frame-src`/`child-src` (Helmet). Sem inline script; usar `/public/js/status.js`.

## ✅ Critérios de aceite
1) Com `GRAFANA_EMBED_ENABLED=true` e `GRAFANA_BASE` setado, iframes carregam.  
2) Em indisponibilidade, exibir **"Integração não habilitada."**
