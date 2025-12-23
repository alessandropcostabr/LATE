#!/usr/bin/env node

// scripts/stress-crm-import.js
// Gera ~10MB de CSV e executa applyImport com cliente fake (sem DB real).

const CrmImportService = require('../services/crmImportService');
const ContactModel = require('../models/contact');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');

const TARGET_MB = Number(process.env.TARGET_MB || 10);
const ROWS = Number(process.env.ROWS || 10000);
const NOTE_SIZE = process.env.NOTE_SIZE ? Number(process.env.NOTE_SIZE) : null;

function buildCsv(noteSize) {
  const header = 'name,email,phone,notes';
  const chunk = 'A'.repeat(noteSize);
  const rows = [];
  for (let i = 0; i < ROWS; i += 1) {
    rows.push(`User${i},user${i}@example.com,1199999${String(i).padStart(4, '0')},${chunk}`);
  }
  return [header, ...rows].join('\n');
}

function estimateNoteSize() {
  if (NOTE_SIZE !== null && !Number.isNaN(NOTE_SIZE)) {
    return Math.max(1, NOTE_SIZE);
  }
  const header = 'name,email,phone,notes\n';
  const baseRow = 'User0,user0@example.com,11999990000,';
  const headerBytes = Buffer.byteLength(header);
  const baseBytes = Buffer.byteLength(`${baseRow}\n`);
  const targetBytes = TARGET_MB * 1024 * 1024;
  const remaining = Math.max(targetBytes - headerBytes - (baseBytes * ROWS), 0);
  const perRow = Math.floor(remaining / Math.max(ROWS, 1));
  return Math.min(Math.max(perRow, 1), 2000);
}

async function main() {
  // stub models to avoid touching DB
  ContactModel.findByAnyIdentifier = async () => null;
  ContactModel.updateById = async () => ({ id: 'noop' });
  LeadModel.createLead = async () => ({ id: 'noop' });
  OpportunityModel.createOpportunity = async () => ({ id: 'noop' });

  const noteSize = estimateNoteSize();
  const csv = buildCsv(noteSize);
  const sizeMB = Buffer.byteLength(csv) / (1024 * 1024);
  console.log(`[stress] CSV gerado: ${sizeMB.toFixed(2)}MB (target ~${TARGET_MB}MB), linhas=${ROWS}, noteSize=${noteSize}`);

  const fakeClient = {
    query: async () => ({ rows: [] }),
    release: () => {},
  };

  const start = Date.now();
  const result = await CrmImportService.applyImport({
    csv,
    targetType: 'lead',
    options: { duplicate_mode: 'merge' },
    user: { id: 1 },
    dbClient: fakeClient,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`[stress] concluído em ${elapsed}s`, result);
}

main().catch((err) => {
  console.error('[stress] falha:', err.message);
  process.exit(1);
});
