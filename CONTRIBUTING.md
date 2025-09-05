# Contribuindo

Obrigado por considerar contribuir com este projeto. Algumas orientações importantes:

## Content Security Policy (CSP)

A política de **Content Security Policy** é gerenciada centralmente no arquivo [`server.js`](server.js) por meio do middleware [`helmet`](https://helmetjs.github.io/). **Não adicione** tags `<meta http-equiv="Content-Security-Policy">` nas views EJS. Qualquer ajuste de CSP deve ser feito exclusivamente na configuração do `helmet`.

## Testes

Execute `npm test` para garantir que todos os testes estejam passando antes de abrir um pull request.

