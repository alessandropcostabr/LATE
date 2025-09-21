// models/recado.js
// Acesso a dados: tabela 'recados' (better-sqlite3).
// Alinha com o schema informado:
// CREATE TABLE recados (
//   id INTEGER PK AUTOINCREMENT,
//   data_ligacao TEXT NOT NULL,
//   hora_ligacao TEXT NOT NULL,
//   destinatario TEXT NOT NULL,
//   remetente_nome TEXT NOT NULL,
//   remetente_telefone TEXT,
//   remetente_email TEXT,
//   assunto TEXT NOT NULL,
//   mensagem TEXT NOT NULL,
//   situacao TEXT DEFAULT 'pendente' CHECK (...),
//   horario_retorno TEXT,
//   observacoes TEXT,
//   criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
//   atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
// );

const { db } = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers SQL

function now() {
  return db.prepare(`SELECT datetime('now') AS n`).get().n;
}

// Garante NOT NULL de 'mensagem'
function comFallbackMensagem(d) {
  const out = { ...d };
  const msg = (out.mensagem ?? out.observacoes ?? '').toString().trim();
  out.mensagem = msg || '(sem mensagem)';
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD

exports.create = (dadosIn) => {
  const dados = comFallbackMensagem(dadosIn);
  try {
    const stmt = db.prepare(`
      INSERT INTO recados (
        data_ligacao, hora_ligacao, destinatario, remetente_nome,
        remetente_telefone, remetente_email, assunto, mensagem,
        situacao, horario_retorno, observacoes, criado_em, atualizado_em
      ) VALUES (
        @data_ligacao, @hora_ligacao, @destinatario, @remetente_nome,
        @remetente_telefone, @remetente_email, @assunto, @mensagem,
        COALESCE(@situacao,'pendente'), @horario_retorno, @observacoes,
        COALESCE(@criado_em, datetime('now')), COALESCE(@atualizado_em, datetime('now'))
      )
    `);
    const info = stmt.run(dados);
    return info.lastInsertRowid;
  } catch (e) {
    console.error('[recados:model] falha INSERT', { dados }, e);
    throw e;
  }
};

exports.atualizar = (id, dadosIn) => {
  const dados = comFallbackMensagem(dadosIn);
  try {
    const stmt = db.prepare(`
      UPDATE recados
         SET data_ligacao      = @data_ligacao,
             hora_ligacao      = @hora_ligacao,
             destinatario      = @destinatario,
             remetente_nome    = @remetente_nome,
             remetente_telefone= @remetente_telefone,
             remetente_email   = @remetente_email,
             assunto           = @assunto,
             mensagem          = @mensagem,
             situacao          = COALESCE(@situacao,'pendente'),
             horario_retorno   = @horario_retorno,
             observacoes       = @observacoes,
             atualizado_em     = datetime('now')
       WHERE id = @id
    `);
    const info = stmt.run({ id, ...dados });
    return info.changes > 0;
  } catch (e) {
    console.error('[recados:model] falha UPDATE', { id, dados }, e);
    throw e;
  }
};

exports.excluir = (id) => {
  try {
    const stmt = db.prepare(`DELETE FROM recados WHERE id = ?`);
    const info = stmt.run(id);
    return info.changes > 0;
  } catch (e) {
    console.error('[recados:model] falha DELETE', { id }, e);
    throw e;
  }
};

exports.obterPorId = (id) => {
  try {
    const stmt = db.prepare(`
      SELECT id, data_ligacao, hora_ligacao, destinatario, remetente_nome,
             remetente_telefone, remetente_email, assunto, mensagem,
             situacao, horario_retorno, observacoes, criado_em, atualizado_em
        FROM recados
       WHERE id = ?
    `);
    return stmt.get(id);
  } catch (e) {
    console.error('[recados:model] falha SELECT by id', { id }, e);
    throw e;
  }
};

// Lista recentes (padrão: 10)
exports.listarRecentes = (lim = 10) => {
  const limit = Number(lim) > 0 ? Number(lim) : 10;
  try {
    const stmt = db.prepare(`
      SELECT id, assunto, mensagem, situacao, criado_em
        FROM recados
    ORDER BY id DESC
       LIMIT ?
    `);
    return stmt.all(limit);
  } catch (e) {
    console.error('[recados:model] falha listarRecentes', { lim }, e);
    throw e;
  }
};

// Contadores p/ Dashboard
exports.estatisticas = () => {
  try {
    const total = db.prepare(`SELECT COUNT(*) AS c FROM recados`).get().c;
    const pend  = db.prepare(`SELECT COUNT(*) AS c FROM recados WHERE situacao='pendente'`).get().c;
    const anda  = db.prepare(`SELECT COUNT(*) AS c FROM recados WHERE situacao='em_andamento'`).get().c;
    const resol = db.prepare(`SELECT COUNT(*) AS c FROM recados WHERE situacao='resolvido'`).get().c;
    return { total, pendentes: pend, em_andamento: anda, resolvidos: resol };
  } catch (e) {
    console.error('[recados:model] falha estatisticas', e);
    throw e;
  }
};

