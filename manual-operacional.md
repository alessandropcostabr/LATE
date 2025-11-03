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

## 📥 Integração via /intake

- Envio seguro via token
- Formulário público externo ou e-mail gateway

## 📚 Ajuda

- Página `/ajuda` com atalhos e guias rápidos
- Links para SOPs e Playbooks no Notion

### Quando acionar o diagnóstico técnico
- Ao notar lentidão ou falhas repetidas, rode `node scripts/dev-info.js --json --output=diagnostics.json` (via time técnico) para registrar o estado do sistema.
- O arquivo gerado (`diagnostics.json`, por padrão) deve ser enviado junto ao chamado para agilizar a análise.
- Para homologação, a rota `/api/debug/info` (apenas em DEV/TEST e com usuário logado) retorna o mesmo resumo. Sem sessão válida o endpoint responde 401.

---

📩 Dúvidas? Fale com a coordenação ou veja `/ajuda` dentro do sistema.
