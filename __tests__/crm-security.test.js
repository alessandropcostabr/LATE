const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateCsvFile } = require('../middleware/fileValidation');

function writeTempFile(name, content) {
  const filePath = path.join(os.tmpdir(), `late-test-${Date.now()}-${Math.random().toString(16).slice(2)}-${name}`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function cleanupFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (_err) {
    // ignore
  }
}

describe('CRM security - XSS frontend', () => {
  const files = [
    {
      file: 'public/js/crm-leads.js',
      mustContain: ['escapeHtml('],
    },
    {
      file: 'public/js/crm-opportunities.js',
      mustContain: ['escapeHtml('],
    },
    {
      file: 'public/js/crm-dashboard.js',
      mustContain: ['escapeHtml('],
    },
    {
      file: 'public/js/crm-dedup.js',
      mustContain: ['escapeHtml('],
    },
    {
      file: 'public/js/crm-kanban.js',
      mustContain: ['escapeHtml(', 'escapeAttr('],
    },
    {
      file: 'public/js/crm-import.js',
      mustContain: ['escapeHtml(', 'escapeAttr('],
    },
  ];

  files.forEach(({ file, mustContain }) => {
    test(`usa escapes em ${file}`, () => {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      mustContain.forEach((needle) => {
        expect(content).toContain(needle);
      });
    });
  });
});

describe('CRM security - CSV upload validation', () => {
  test('rejeita extensão diferente de .csv', () => {
    const filePath = writeTempFile('notcsv.txt', 'a,b\n1,2\n');
    try {
      const result = validateCsvFile(filePath, 'arquivo.txt', 'text/plain');
      expect(result.valid).toBe(false);
    } finally {
      cleanupFile(filePath);
    }
  });

  test('rejeita MIME inválido quando informado', () => {
    const filePath = writeTempFile('file.csv', 'a,b\n1,2\n');
    try {
      const result = validateCsvFile(filePath, 'file.csv', 'application/pdf');
      expect(result.valid).toBe(false);
    } finally {
      cleanupFile(filePath);
    }
  });

  test('rejeita conteúdo binário', () => {
    const filePath = writeTempFile('binary.csv', `a,b\n1,2\n\x00\x01`);
    try {
      const result = validateCsvFile(filePath, 'binary.csv', 'text/csv');
      expect(result.valid).toBe(false);
    } finally {
      cleanupFile(filePath);
    }
  });

  test('rejeita padrão perigoso de CSV injection', () => {
    const filePath = writeTempFile('danger.csv', 'col1,col2\n=HYPERLINK("http://evil")\n');
    try {
      const result = validateCsvFile(filePath, 'danger.csv', 'text/csv');
      expect(result.valid).toBe(false);
    } finally {
      cleanupFile(filePath);
    }
  });

  test('aceita CSV válido', () => {
    const filePath = writeTempFile('ok.csv', 'nome,email\nAlice,alice@example.com\n');
    try {
      const result = validateCsvFile(filePath, 'ok.csv', 'text/csv');
      expect(result.valid).toBe(true);
    } finally {
      cleanupFile(filePath);
    }
  });
});
