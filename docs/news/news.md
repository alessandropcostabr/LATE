<article class="card" aria-labelledby="news-2025-12-22">

  <div class="card-header">
    <h1 class="card-title" id="news-2025-12-22">🗞️ Novidades — 22/12/2025</h1>
    <p class="card-subtitle">Opus Security Review: hardening do CRM</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 22/12/2025 · Sprint Opus Review
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🛡️ Hardening do CRM</h2>
      <p>Finalizamos a rodada de segurança com sanitização de XSS no frontend, validação robusta de upload CSV, rate limit dedicado para rotas CRM e melhorias de performance (N+1) com benchmark registrado.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">✅ Testes e resiliência</h2>
      <p>Reforçamos testes de importação, concorrência e performance, além de checklist atualizado para manter o CRM resiliente.</p>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-12-19">

  <div class="card-header">
    <h1 class="card-title" id="news-2025-12-19">🗞️ Novidades — 19/12/2025</h1>
    <p class="card-subtitle">CRM do LATE: importador CSV com upload e preview</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 19/12/2025 · Sprint CRM Import
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📥 Import CSV evoluído</h2>
      <p>O CRM ganhou upload multipart, preview e simulação (dry‑run), além de uma tela dedicada de importação em <strong>/crm/importar</strong>.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🧭 O que vem a seguir</h2>
      <ul style="margin-left:1.25rem;line-height:1.6;list-style:disc;">
        <li>Wizard de 5 passos com mapeamento de colunas e preview.</li>
        <li>Dedup avançado com merge sugerido e relatório de alterações.</li>
        <li>Dry-run e aplicação em lote com progressos e rollback seguro.</li>
      </ul>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">✅ Benefício imediato</h2>
      <p>Já é possível pré‑visualizar e simular importações com dedup/merge básico, mantendo o CRM operando sem interrupções.</p>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-12-16">

  <div class="card-header">
    <h1 class="card-title" id="news-2025-12-16">🗞️ Novidades — 16/12/2025</h1>
    <p class="card-subtitle">CRM do LATE: funis flexíveis, calendário e dedup</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 16/12/2025 · Sprint CRM Core
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🚀 CRM nativo</h2>
      <p>Pipelines de vendas, leads, contatos e oportunidades agora rodam dentro do LATE, com estágios configuráveis, regras por etapa e criação de negócio sem conta quando o funil permitir (útil para B2C).</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📅 Calendário integrado</h2>
      <p>Atividades (tarefas, reuniões, chamadas) aparecem no FullCalendar com filtros por dono/status/tipo/data, arrastar para reagendar e exportar em ICS.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🧹 Dedup e importações</h2>
      <p>Deduplicação por email/telefone normalizado com merge seguro; export CSV de leads e oportunidades respeitando “Meus” e escopo de acesso. Import de leads por CSV disponível na aba CRM.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📞 Integrações</h2>
      <p>Eventos de envio (WhatsApp Sender) com idempotência garantida e relatório dedicado; ingestão de telefonia com HMAC e bearer; health gate devolve 503 JSON se o banco ficar indisponível.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🛣️ Próximos passos</h2>
      <ul style="margin-left:1.25rem;line-height:1.6;list-style:disc;">
        <li>RBAC fino em todas as listagens e transições (Meus / Equipe).</li>
        <li>Importador CSV com preview e dedup avançado.</li>
        <li>Custom fields com UI e validação por estágio.</li>
        <li>Stats/dashboards finalizados usando views materializadas.</li>
      </ul>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-11-14">

  <div class="card-header">
    <h1 class="card-title" id="news-2025-11-14">🗞️ Novidades — 14/11/2025</h1>
    <p class="card-subtitle">Restrições de acesso por usuário</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 14/11/2025 · Sprint Controle de Acesso
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🔐 Horários controlados</h2>
      <p>Admins agora conseguem definir faixas de dias e horários permitidos por usuário. Basta acessar <strong>Admin → Usuários → Editar</strong> e ativar “Acesso restrito por horário”. Adicione quantas faixas quiser (ex.: Segunda a Sexta, 08h às 18h) e o LATE bloqueia tentativas fora desses intervalos.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🌐 Lista de IPs autorizados</h2>
      <p>O antigo conceito de “Interno/Externo” foi substituído por uma lista flexível de IPs. Ative “Acesso restrito por IP” e informe os IPs externos liberados (ex.: 191.9.115.129). Quem estiver fora da lista recebe um aviso no login e na sessão.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📊 Transparência no Status</h2>
      <p>O painel <strong>/relatorios/status</strong> ganhou um bloco “Sessão &amp; Rede” que mostra o IP atual, o escopo aplicado (liberado, restrito por IP ou horário) e a lista de políticas ativas para o usuário autenticado.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🧭 Dicas rápidas</h2>
      <ul style="margin-left:1.25rem;line-height:1.6;list-style:disc;">
        <li>Ninguém fica travado ao ativar a novidade: todos começam liberados e você só restringe quem realmente precisa de controle extra.</li>
        <li>Quando uma tentativa for bloqueada, o próprio usuário vê o motivo e a auditoria registra o evento de forma automática para o time de suporte.</li>
        <li>Esqueça variáveis técnicas como <code>OFFSITE_POLICY</code>: agora o ajuste é todo visual, direto no formulário do usuário.</li>
      </ul>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-11-08">

  <div class="card-header">
    <h1 class="card-title" id="news-2025-11-08">🗞️ Novidades — 08/11/2025</h1>
    <p class="card-subtitle">Status Operacional e deploy automático</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 08/11/2025 · Sprint 02B — Auditoria &amp; Infraestrutura
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🧾 Exportações com fila</h2>
      <p>Relatórios pesados agora entram em fila, com avisos por e-mail assim que ficam prontos para download.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🖥️ Status Operacional</h2>
      <p>O painel de status ganhou cards com saúde do app, banco e túnel, evitando diagnósticos fora do sistema.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🔒 Auditoria reforçada</h2>
      <p>Logs de eventos agora agrupam ações críticas e facilitam o acompanhamento por período.</p>
    </section>
  </div>
</article>
