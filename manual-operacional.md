## 🎯 Objetivo
Este manual orienta o uso diário do sistema LATE (Ligação, Atendimento e Triagem Eficiente) por equipes operacionais e administrativas.

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

### Relatórios de Auditoria
- Acesse **Menu → Relatórios → Auditoria** (disponível para Admins e Supervisores).
- Use os filtros rápidos (7 ou 30 dias) ou escolha um intervalo personalizado para investigar ações específicas.
- Clique em **Ver detalhes** para visualizar o histórico completo da ação (quem fez, qual setor, antes e depois).
- Gere arquivos CSV/JSON em **Relatórios › Exportações**; aplique os filtros desejados e acompanhe o status de cada arquivo no próprio painel.

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
