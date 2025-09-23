// models/recado.js
// Tabela: recados (better-sqlite3) – usando helper db() (DatabaseManager + getDatabase()).

const db = require('./_db');

// Normalização mínima (evita NOT NULL quebrar)
function normalizarDados(b = {}) {
  const mensagem = String((b.mensagem ?? b.observacoes ?? '')).trim() || '(sem mensagem)';
  return {
    data_ligacao:       String(b.data_ligacao || '').trim(),
    hora_ligacao:       String(b.hora_ligacao || '').trim(),
    destinatario:       String(b.destinatario || '').trim(),
    remetente_nome:     String(b.remetente_nome || '').trim(),
    remetente_telefone: b.remetente_telefone ? String(b.remetente_telefone).trim() : null,
    remetente_email:    b.remetente_email ? String(b.remetente_email).trim() : null,
    assunto:            String(b.assunto || '').trim(),
    mensagem,
    situacao:           b.situacao || 'pendente', // pendente | em_andamento | resolvido
    horario_retorno:    b.horario_retorno ? String(b.horario_retorno).trim() : null,
    observacoes:        b.observacoes ? String(b.observacoes).trim() : null
  };
}

// CREATE
exports.create = (dados) => {
  const d = normalizarDados(dados);
  const info = db().prepare(`
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
  `).run(d);
  return info.lastInsertRowid;
};

// READ
exports.obterPorId = (id) => db().prepare(`
  SELECT id, data_ligacao, hora_ligacao, destinatario, remetente_nome,
         remetente_telefone, remetente_email, assunto, mensagem,
         situacao, horario_retorno, observacoes, criado_em, atualizado_em
    FROM recados
   WHERE id = ?
`).get(id);

// UPDATE
exports.atualizar = (id, dados) => {
  const d = normalizarDados(dados);
  const info = db().prepare(`
    UPDATE recados
       SET data_ligacao=@data_ligacao, hora_ligacao=@hora_ligacao,
           destinatario=@destinatario, remetente_nome=@remetente_nome,
           remetente_telefone=@remetente_telefone, remetente_email=@remetente_email,
           assunto=@assunto, mensagem=@mensagem, situacao=COALESCE(@situacao,'pendente'),
           horario_retorno=@horario_retorno, observacoes=@observacoes,
           atualizado_em=datetime('now')
     WHERE id=@id
  `).run({ id, ...d });
  return info.changes > 0;
};

// DELETE
exports.excluir = (id) => {
  const info = db().prepare(`DELETE FROM recados WHERE id = ?`).run(id);
  return info.changes > 0;
};

// LISTAR recentes
exports.listarRecentes = (lim = 10) => {
  const limit = Number(lim) > 0 ? Number(lim) : 10;
  return db().prepare(`
    SELECT id, assunto, mensagem, situacao, criado_em
      FROM recados
  ORDER BY id DESC
     LIMIT ?
  `).all(limit);
};

// KPIs p/ Dashboard
exports.estatisticas = () => ({
  total:        db().prepare(`SELECT COUNT(*) c FROM recados`).get().c,
  pendentes:    db().prepare(`SELECT COUNT(*) c FROM recados WHERE situacao='pendente'`).get().c,
  em_andamento: db().prepare(`SELECT COUNT(*) c FROM recados WHERE situacao='em_andamento'`).get().c,
  resolvidos:   db().prepare(`SELECT COUNT(*) c FROM recados WHERE situacao='resolvido'`).get().c,
});

