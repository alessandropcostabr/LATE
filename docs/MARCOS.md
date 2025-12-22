# MARCOS DE RELEASE (LATE)

Atualizado em 22 de dezembro de 2025.

## Politica de versionamento
Modelo: release por marco (SemVer leve).
- MAJOR (2 -> 3): quebra de compatibilidade (API, contrato de dados, ou fluxo critico).
- MINOR (2.x): marco funcional relevante (entrega de sprint/fase).
- PATCH (2.x.y): correcoes pontuais e hardening sem novo marco.

## Como determinamos marcos
Baseado em PRs mergeadas no GitHub e nos docs de planejamento:
- docs/planning/LATE_SPRINTS_EXECUTADAS.md
- docs/planning/LATE_SPRINTS_FUTURAS.md
- docs/planning/Sprint_Opus_Review.md

## Linha do tempo (proposta)

### 2.0.0 - Base LATE core
- Fundacao do sistema (core, auth, recados, operacao basica).

### 2.1.0 - Hardening inicial (Sprint 00-PRE)
- Seguranca base, sanidade do ambiente, ajustes operacionais iniciais.

### 2.2.0 - Dev tools e diagnostico (Sprint 01)
- Endpoints/CLI de diagnostico e melhorias operacionais.

### 2.3.0 - Sessao unica por usuario (Sprint E)
- Controle de sessao unica e hardening de sessao.

### 2.4.0 - Auditoria leve + status operacional + exportacoes (Sprint 02B)
- Trilhas de auditoria leves, painel de status e exportacoes CSV/JSON.

### 2.5.0 - CRM Fase I (RBAC e escopos)
- Filtros Me/Equipe/All e regras de escopo no CRM.

### 2.6.0 - CRM Fase II (Stats/Dashboards MVs)
- Dashboards e MVs com escopo e refresh.

### 2.7.0 - Opus Security Review (concluida em 22/12/2025)
- XSS sanitizado, validacao de upload CSV, rate limit CRM,
  timeout/backpressure de import, refactors e testes de seguranca.
  (PRs #318 e #330-#341)

### 2.8.0 - CRM Fase III (Import CSV avancado) - em andamento
- Wizard completo, dedup avancado, dry-run e relatorio final.

## Proxima versao oficial sugerida
- Atual: 2.7.0 (Opus Security Review)
- Proxima: 2.8.0 (quando concluir CRM Fase III)

## Observacoes
- A versao oficial exibida no app segue o package.json.
- Se aprovado, basta ajustar package.json + APP_VERSION e registrar no news.
