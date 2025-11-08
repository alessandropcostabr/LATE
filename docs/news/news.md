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
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📊 Painel “Status Operacional”</h2>
      <p>Admins e Supervisores agora acompanham a saúde do LATE em <strong>Relatórios → Status</strong>. Você vê a versão, uptime, uso de memória e a latência do banco. Também enxerga qual nó do cluster está primário ou standby, além da saúde do VIP 192.168.15.250 e do túnel Cloudflare.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📡 Telemetria Prometheus</h2>
      <p>O painel mostra na mesma tela as métricas de CPU, memória, disco e rede coletadas do Prometheus para mach1, mach2 e mach3. Assim dá para perceber rapidamente se algum nó está sobrecarregado.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🤖 Deploy Ansible + PM2 clusterizado</h2>
      <p>Merge em <code>main</code> agora dispara o workflow <strong>Deploy Cluster</strong>, que sincroniza o bastion, roda o playbook Ansible e recarrega o app em modo cluster (PM2). Os workers de e-mail/exportação seguem em fork, mas são garantidos após cada deploy.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📌 Próximas entregas</h2>
      <ul style="margin-left:1.25rem;line-height:1.6;list-style:disc;">
        <li><strong>Exportações CSV/JSON</strong> em <strong>Relatórios → Exportações</strong>.</li>
        <li><strong>Anexos nos recados</strong> (imagens/PDFs) com quota segura.</li>
        <li><strong>Revisão de segurança de login</strong>: alertas de tentativas falhas e MFA opcional.</li>
      </ul>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-11-06">
  <div class="card-header">
    <h1 class="card-title" id="news-2025-11-06">🗞️ Novidades — 06/11/2025</h1>
    <p class="card-subtitle">Auditoria leve liberada para Admins e Supervisores</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 06/11/2025 · Sprint 02 — Auditoria Leve concluída
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🔍 Nova aba em Relatórios</h2>
      <p>A área <strong>Relatórios</strong> ganhou a aba <strong>Auditoria</strong>, exclusiva para perfis Admin e Supervisor. Lá você acompanha, dia a dia, quem criou, encaminhou ou resolveu cada recado — tudo filtrável por período, tipo de evento e responsável.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📝 Resolução sempre documentada</h2>
      <p>Ao concluir um recado, o sistema agora pede um breve comentário com a solução adotada. Esse registro aparece tanto na timeline do recado quanto na auditoria, garantindo histórico completo para reaberturas e auditorias internas.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🛡️ Segurança reforçada</h2>
      <p>Logins, logouts e automações passaram a gerar trilhas leves automaticamente. Assim, fica fácil identificar acessos simultâneos ou revisar alertas disparados fora de hora.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📅 O que vem a seguir</h2>
      <p>Estamos trabalhando na próxima etapa da aba Auditoria: cards com indicadores, filtros salvos e exportação em CSV/JSON. Compartilhe suas necessidades para priorizarmos nas próximas sprints!</p>
    </section>
  </div>
</article>


<article class="card" aria-labelledby="news-2025-11-04">
  <div class="card-header">
    <h1 class="card-title" id="news-2025-11-04">🗞️ Novidades — 04/11/2025</h1>
    <p class="card-subtitle">Sessão única e diagnóstico reforçado</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 04/11/2025 · Sprint E — Sessão Única
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">👤 Uma sessão por usuário</h2>
      <p>Agora, ao fazer login, o LATE encerra automaticamente sessões antigas do mesmo usuário. Isso evita acessos concorrentes sem supervisão e reduz riscos quando alguém esquece a sessão aberta em outro dispositivo.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📝 Follow-up obrigatório na resolução</h2>
      <p>Ao marcar um registro como <strong>Resolvido</strong>, o sistema solicita um comentário descrevendo a solução aplicada. O texto fica registrado na linha do tempo e alimenta a trilha de auditoria leve.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🔄 Sessão atualizada em mudanças críticas</h2>
      <p>Troca de senha, reset administrado ou desativação também renovam a sessão. Quem estiver com o usuário logado recebe o aviso “Sua sessão foi encerrada porque outro login foi realizado” e precisa autenticar novamente.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🩺 Diagnóstico em linha com o rollout</h2>
      <p>O time técnico acompanha os mesmos indicadores usados na homologação para comparar o sistema antes e depois do deploy. Se notar lentidão ou falhas inesperadas, comunique o suporte e informe horário/recado afetado para acelerarmos o diagnóstico.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📚 Documentação revisada</h2>
      <p>Atualizamos o Manual Operacional e a Central de Ajuda com o funcionamento da sessão única, exemplos de mensagens e checklist de confirmação. Consulte <strong>/help</strong> e <strong>/manual-operacional</strong> para compartilhar com o time.</p>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-11-03">
  <div class="card-header">
    <h1 class="card-title" id="news-2025-11-03">🗞️ Novidades — 03/11/2025</h1>
    <p class="card-subtitle">Segurança reforçada e agendamentos mais claros</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 03/11/2025 · Sprint 00-PRE — Hardening &amp; Sanidade
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🔐 Tokens de intake mais seguros</h2>
      <p>Reforçamos a proteção dos tokens usados por integrações externas. Cada parceiro recebeu (ou receberá) um novo token com validade opcional; basta avisar o time de produto para concluir a troca e continuar enviando recados com segurança.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🗓️ Agende retornos com data e horário</h2>
      <p>No formulário de recados, o campo “Horário para retorno” virou um seletor de <strong>data e hora</strong>. Basta escolher o melhor momento e o sistema cuida da conversão automática — facilitando a distribuição da agenda e os alertas de follow-up.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📬 Alertas sem duplicidade</h2>
      <p>A automação de lembretes passou a registrar cada execução no minuto exato, evitando e-mails repetidos quando um recado já foi avisado. Quem recebe os alertas continua informado, mas sem ruído na caixa de entrada.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">✅ Checklist de segurança</h2>
      <p>Incluímos um comando rápido para o time técnico validar rate limit, cabeçalhos e usuários administradores. É transparência para você e segurança garantida antes de cada virada.</p>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-11-02">
  <div class="card-header">
    <h1 class="card-title" id="news-2025-11-02">🗞️ Novidades — 02/11/2025</h1>
    <p class="card-subtitle">Tela de login com arte exclusiva</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 02/11/2025 · PR #257
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🎨 Arte em tela cheia</h2>
      <p>A tela de login ganhou uma nova identidade visual em tela cheia, com foco na nossa marca e em deixar o acesso mais acolhedor para quem usa o sistema todos os dias.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📱 Acessível em qualquer viewport</h2>
      <p>Revisamos a experiência para que o login funcione bem em qualquer dispositivo: o contraste está mais forte, o foco ficou mais evidente e o layout prioriza o formulário em telas menores.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📚 Documentação</h2>
      <p>O <strong>Manual Operacional</strong> recebeu capturas atualizadas e dicas de acessibilidade para orientar novas pessoas da equipe.</p>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-10-31">
  <div class="card-header">
    <h1 class="card-title" id="news-2025-10-31">🗞️ Novidades — 31/10/2025</h1>
    <p class="card-subtitle">Histórico de contatos e continuidade de atendimento</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 31/10/2025 · Sprint D (Relacionamento) · PRs #238, #240, #241
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🔍 Registros relacionados no formulário</h2>
      <p>Ao começar um novo recado, o sistema sugere até cinco mensagens anteriores do mesmo contato. Isso ajuda a retomar conversas abertas e evita que alguém da equipe faça perguntas repetidas.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📚 Histórico completo em um só lugar</h2>
      <p>Na visualização do recado você encontra o link “Ver histórico completo”, que mostra todas as interações daquele telefone ou e-mail, com filtros por status, etiqueta e destinatário. Ideal para entender rapidamente o que já foi combinado.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🧱 Recados encadeados</h2>
      <p>Agora é possível marcar um recado como continuação de outro. O vínculo aparece para toda a equipe, permitindo acompanhar casos complexos sem perder o fio da conversa.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🎯 Experiência guiada</h2>
      <p>O assistente de sugestões é discreto: se preferir, é só ignorar e seguir com o cadastro. Corrigimos também situações em que o histórico não aparecia quando só o e-mail estava preenchido.</p>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-10-30">
  <div class="card-header">
    <h1 class="card-title" id="news-2025-10-30">🗞️ Novidades — 30/10/2025</h1>
    <p class="card-subtitle">Checklists, comentários e operação reforçada</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 30/10/2025 · Sprints 0 + A + B + C consolidadas
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🛡️ Base mais segura</h2>
      <p>Fortalecemos o backend com validações adicionais, limites de acesso e logs mais claros para os scripts de migração e criação de usuários. O objetivo é deixar as rotinas do time de suporte mais previsíveis e seguras.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📝 Etiquetas, checklists e comentários</h2>
      <p>Cada recado pode receber etiquetas coloridas, listas de tarefas com progresso automático e comentários com @menção. Assim, quem precisa acompanhar recebe alertas e sabe exatamente em que etapa a demanda está.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📊 Visões Kanban e Calendário fortalecidas</h2>
      <p>As visões ganharam filtros por setor e etiqueta, cartões com progresso do checklist e indicadores sobre o que precisa de atenção imediata. Perfeito para organizar o dia ou conduzir reuniões de status.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📨 Intake e notificações automáticas</h2>
      <p>Integrações externas enviam recados por token dedicado e contam com proteção contra excesso de chamadas. Cada mudança relevante dispara e-mails com registro em auditoria, garantindo rastreabilidade.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📚 Material de apoio</h2>
      <p>Revimos esta página, a Central de Ajuda e o Manual Operacional para orientar os novos fluxos. Aproveite para compartilhar com quem está chegando agora ao LATE.</p>
    </section>
  </div>
</article>

<article class="card" aria-labelledby="news-2025-10-24">
  <div class="card-header">
    <h1 class="card-title" id="news-2025-10-24">🗞️ Novidades — 24/10/2025</h1>
    <p class="card-subtitle">Memória de interações e auditoria</p>
  </div>
  <div class="card-body">
    <p style="margin-bottom:1.5rem;color:var(--text-secondary);">
      Publicado em 24/10/2025 · PR #204
    </p>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🧠 Histórico sempre visível</h2>
      <p>A ficha do recado agora mostra um painel com timestamp, mensagem e responsável. Facilita para saber quem falou o quê e quando.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🗃️ Auditoria leve</h2>
      <p>As mudanças críticas entram em `message_events`, com payload JSON. É o primeiro passo para trilhas de auditoria completas.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📧 Intake com token</h2>
      <p>O endpoint `/intake` passou a exigir token. Cada requisição gera log com IP, user-agent e status.</p>
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
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">📊 Painel “Status Operacional”</h2>
      <p>Admins e Supervisores enxergam agora uma viseira completa em <strong>Relatórios → Status</strong>. O painel mostra a saúde da aplicação, latência do PostgreSQL, papel de cada nó (primário/standby), VIP, túnel Cloudflare e o resumo Prometheus (UP, CPU, memória, disco e rede por máquina). Tudo é atualizado automaticamente a cada 10 segundos sem recarregar a página.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🚦 Replicação transparente</h2>
      <p>O backend identifica se o nó é primário ou standby e exibe quem está ligado em cada slot (`mach1`, `mach2`, `mach3`). Quando o banco entra em modo leitura, o painel deixa claro o motivo, evitando surpresas em investigações de auditoria.</p>
    </section>
    <section style="margin-bottom:1.5rem;">
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🤖 Deploy automatizado</h2>
      <p>Cada merge em <code>main</code> aciona um workflow GitHub Actions que sincroniza o playbook Ansible para o bastion e roda <code>ansible-playbook</code> com PM2 em modo cluster (app principal) + workers de e-mail/exportação em fork. Senhas não ficam mais em arquivos versionados; o pipeline injeta o segredo via <code>ANSIBLE_BECOME_PASS</code>.</p>
    </section>
    <section>
      <h2 style="font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">🗓️ O que vem agora</h2>
      <ul style="margin-left:1.25rem;line-height:1.6;list-style:disc;">
        <li><strong>Anexar arquivos ao recado</strong> — permitir imagens e PDFs direto do LATE mantendo histórico e limites seguros.</li>
        <li><strong>Revisão de segurança pós-cluster</strong> — reforçar políticas de login (MFA opcional, alertas em tentativas falhas em sequência e bloqueio por IP suspeito).</li>
        <li><strong>Sprint 02B</strong> segue: exportações CSV/JSON e cards de auditoria entram na próxima entrega.</li>
      </ul>
    </section>
  </div>
</article>
