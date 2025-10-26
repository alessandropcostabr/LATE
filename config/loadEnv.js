// Por quê: carregar .env correto (.env ou .env.prod) sem confusão e sem sobrescrever variáveis já definidas.
// Regras: se existir variável no ambiente (PM2/shell), ela prevalece sobre o arquivo .env.

const fs = require('fs');
const path = require('path');

function loadEnv() {
  // Permite forçar um arquivo específico definindo DOTENV_FILE=/caminho/arquivo
  const forced = process.env.DOTENV_FILE && process.env.DOTENV_FILE.trim();
  const byEnv = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
  const dotenvPath = forced || path.resolve(process.cwd(), byEnv);

  if (fs.existsSync(dotenvPath)) {
    // Importante: dotenv NÃO sobrescreve variáveis já definidas em process.env
    require('dotenv').config({ path: dotenvPath });
    console.info(`[env] Carregado: ${dotenvPath}`);
  } else {
    console.info(`[env] Arquivo não encontrado, prosseguindo só com variáveis do ambiente: ${dotenvPath}`);
  }
}

module.exports = { loadEnv };

