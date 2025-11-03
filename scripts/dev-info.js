#!/usr/bin/env node

// scripts/dev-info.js
// CLI de diagnóstico para ambientes DEV/CI. Executa queries leves e
// imprime (ou salva) um snapshot de informações relevantes.

const process = require('process');
const db = require('../config/database');
const {
  collectDevInfo,
  writeDiagnosticsJson,
  DEFAULT_JSON_FILENAME,
} = require('../utils/devInfo');

function printHelp() {
  console.log(`Uso:
  node scripts/dev-info.js            # imprime JSON no stdout
  node scripts/dev-info.js --json     # salva em ${DEFAULT_JSON_FILENAME}
  node scripts/dev-info.js --json --output=out.json

Flags:
  --json           Gera um arquivo JSON (padrão: ${DEFAULT_JSON_FILENAME})
  --output <path>  Personaliza o nome/caminho do arquivo quando usado com --json
  --help           Exibe esta ajuda
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    json: false,
    output: DEFAULT_JSON_FILENAME,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      break;
    }
    if (arg.startsWith('--output=')) {
      options.json = true;
      options.output = arg.split('=', 2)[1] || DEFAULT_JSON_FILENAME;
      continue;
    }
    if (arg === '--output') {
      options.json = true;
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options.output = next;
        i += 1;
      } else {
        console.warn('[dev-info] --output requer um caminho; usando padrão.');
      }
      continue;
    }
    console.warn(`[dev-info] argumento desconhecido ignorado: ${arg}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    process.exit(0);
    return;
  }

  try {
    const diagnostics = await collectDevInfo();
    if (options.json) {
      const outputPath = await writeDiagnosticsJson(diagnostics, options.output);
      console.log(`[dev-info] Diagnóstico salvo em: ${outputPath}`);
    } else {
      console.log(JSON.stringify(diagnostics, null, 2));
    }
  } catch (err) {
    console.error('[dev-info] erro ao gerar diagnóstico:', err);
    process.exitCode = 1;
  } finally {
    try {
      await db.close?.();
    } catch (err) {
      if (err) console.error('[dev-info] falha ao encerrar pool do PostgreSQL:', err);
    }
  }
}

if (require.main === module) {
  main();
}
