## Atualização — Sprint E (Sessão Única) em desenvolvimento
> Atualizado em 2025/11/12.

> Sugestão de mensagem para o canal `#late-dev` após merge para develop.

Pessoal, seguimos avançando! 🚀

- Adicionamos `session_version` na tabela `users` com migration + índice;
- Login agora incrementa a versão e derruba sessões antigas automaticamente;
- `requireAuth` valida a versão a cada requisição e redireciona para o login com aviso;
- Troca de senha e resets administrados também renovam a versão;
- Testes automatizados: `__tests__/auth.session-version.test.js` (login + mismatch).

Checklist rápido para validação:
- `npm run migrate` no DEV (gera coluna nova);
- `npm test -- auth.session-version` e `npm test -- dev-info`;
- Login em dois navegadores → o primeiro deve ser redirecionado com erro `session_invalidada`;
- Conferir mensagem na tela de login e docs atualizados (`README.md`, `docs/manuals/manual-operacional.md`).

Próximos passos:
1. Alinhar janela de deploy conjunto (Hardening + Sessão Única);
2. Revisar planejamento da Sprint 02 (Audit);
3. Atualizar comunicação externa antes de subir para produção.

Qualquer achado, sinalizem aqui. Obrigado! 🙌
