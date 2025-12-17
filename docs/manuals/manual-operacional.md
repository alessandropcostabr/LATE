## 🎯 Objetivo
> Atualizado em 2025/12/16.

Este manual orienta o uso diário do sistema LATE por equipes operacionais e administrativas, desde o registro até a conclusão dos recados, fortalecendo o relacionamento com os clientes e garantindo a rastreabilidade das interações.

## 🧑‍💼 Perfis de Acesso

- **Leitor:** Apenas leitura
- **Operador:** Cria recados, atualiza seus próprios
- **Supervisor:** Pode editar e reatribuir recados do setor
- **Administrador:** Acesso completo

## 📬 Tipos de Registro

- **Normal:** Pendências comuns com destinatário
- **Comunicado:** Leitura obrigatória com confirmação
- **Incidente:** Ocorrência não-clínica com categoria e severidade
- **Ideia:** Sugestão de melhoria

## 🛠️ Funcionalidades

### Criar Recado
- Campos: remetente, assunto, mensagem, status, prazo (callback), setor/destinatário, etiquetas
- Pode usar modelo pré-configurado com checklists

### Comentários e Menções
- Comentários visíveis por todos com permissão
- Use `@nome` para alertar usuários específicos
- Ao resolver um registro, descreva a solução no comentário solicitado (follow-up obrigatório)

### Checklists
- Itens marcáveis por progresso
- Útil para ações pós-ligação ou playbooks

### Etiquetas (Labels)
- Cores e nomes livres, mas recomenda-se padrão por setor
- Exemplo: `urgente`, `suprimentos`, `financeiro`

### Encaminhar
- Muda o destinatário mantendo o histórico

## 📊 Visões

- **Lista padrão:** ordenável e com filtros
- **Kanban:** colunas por status, ideal para triagem
- **Calendário:** prazos e ligações por data
- **Widgets (Dashboard):** hoje, atrasados, SLAs, por setor
- **Relatórios de Auditoria:** em `/relatorios/auditoria`, acompanhe eventos recentes (criação, mudanças de status, comentários, login/logout) com filtros por período, tipo de evento e responsável.
- **Status Operacional:** em `/relatorios/status`, disponível para Admin/Supervisor. Apresenta um resumo amigável de cada servidor (versão, tempo no ar e uso de recursos) e sinaliza, em linguagem simples, se os serviços essenciais — banco de dados, integrações externas e monitoramento — estão funcionando bem. O painel se atualiza automaticamente a cada 10 segundos.

### Relatórios de Auditoria
- Acesse **Menu → Relatórios → Auditoria** (disponível para Admins e Supervisores).
- Use os filtros rápidos (7 ou 30 dias) ou escolha um intervalo personalizado para investigar ações específicas.
- Clique em **Ver detalhes** para visualizar o histórico completo da ação (quem fez, qual setor, antes e depois).
- Gere arquivos CSV/JSON em **Relatórios › Exportações**; aplique os filtros desejados e acompanhe o status de cada arquivo no próprio painel (a exportação roda em segundo plano e você recebe um aviso assim que estiver pronta).

## 🎯 CRM — Gestão de Relacionamento

O LATE agora conta com um módulo de CRM completo para gerenciar leads, contatos e oportunidades de negócio.

### Pipelines e Funis
- Acesse **CRM → Dashboard** para ver o resumo de oportunidades por estágio
- Cada pipeline possui estágios configuráveis (ex.: Qualificação → Proposta → Negociação → Fechado)
- Arraste oportunidades entre estágios no **CRM → Kanban**

### Leads e Contatos
- **CRM → Leads** lista todos os leads com filtros por status, origem e responsável
- Deduplicação automática por email e telefone evita cadastros duplicados
- Exporte leads em CSV respeitando seu escopo de acesso

### Oportunidades
- **CRM → Oportunidades** mostra negócios em andamento
- Cada oportunidade pode ter atividades (tarefas, reuniões, chamadas) associadas
- Mova oportunidades entre estágios; o sistema valida campos obrigatórios por etapa

### Calendário de Atividades
- **CRM → Calendário** exibe tarefas e compromissos em formato visual
- Arraste para reagendar, redimensione para ajustar duração
- Exporte em ICS para sincronizar com seu calendário pessoal

### Configuração do CRM
- **CRM → Config** permite gerenciar pipelines, estágios e regras
- Defina campos obrigatórios por estágio, restrições de movimentação e automações

### Relatório de WhatsApp
- **Relatórios → WhatsApp** mostra eventos de envio de mensagens
- Útil para acompanhar comunicações enviadas pelo sistema

## 🔔 Notificações

- Envio por e-mail para:
  - Novo recado
  - Resolução
  - @menções
  - Vencimento próximo (data/hora agendada)

## 🔐 Segurança

- Login com sessão segura (cookies httpOnly, regeneração de sessão)
- Sessão única: novo login invalida automaticamente sessões anteriores
- Tokens de intake armazenados como hash + expiração opcional
- Rate-limit e CSRF ativos
- Ações críticas registradas em log/auditoria

### Restrições por IP e Horário
- Em **Admin → Usuários → Editar**, a seção *Restrições de acesso* permite:
  - Ativar "Acesso restrito por IP" e informar os IPs externos liberados (ex.: `191.9.115.129`). Tudo desativado = usuário pode acessar de qualquer lugar.
  - Ativar "Acesso restrito por horário" e definir faixas por dia da semana (segunda a sexta, 08h–18h, por exemplo).
- O painel **Relatórios → Status** mostra o IP atual, o escopo aplicado (liberado/restrito) e a lista de regras ativas.
- Bloqueios são informados ao usuário e registrados na auditoria (`user.login_denied_offsite` / `user.session_denied_offsite`); peça para o time de TI ajustar as regras caso alguém seja bloqueado indevidamente.

## 🔗 Integrações externas

- Envio de recados via formulários públicos ou sistemas parceiros autorizados
- Cada integração usa um token exclusivo e pode ter validade definida pelo administrador
- Em caso de troca de parceiro ou suspeita de uso incorreto, solicite um novo token ao time de produto

## 📚 Ajuda

- Página `/ajuda` com atalhos e guias rápidos
- Links para SOPs e Playbooks no Notion

### Quando acionar o diagnóstico técnico
- Note qualquer comportamento fora do esperado (lentidão, erro recorrente, notificações duplicadas) e registre horário/setor afetado.
- Abra um recado para o time responsável ou acione o canal interno dedicado; a equipe técnica coleta os diagnósticos necessários e acompanha a evolução do incidente.
- Quanto mais contexto for enviado (capturas de tela, IDs de recado, navegador utilizado), mais rápido conseguimos responder.

---

📩 Dúvidas? Fale com a coordenação ou veja `/ajuda` dentro do sistema.
