// models/userSector.js
// Associação N:N entre users e sectors, com garantias de "mínimo 1" em ambos os lados.
// Comentários em pt-BR; identificadores em inglês.

const db = require('../config/database');

const ph = (i) => `$${i}`;

async function listUserSectors(userId) {
  const { rows } = await db.query(`
    SELECT s.id, s.name, s.email, s.is_active
      FROM user_sectors us
      JOIN sectors s ON s.id = us.sector_id
     WHERE us.user_id = ${ph(1)}
     ORDER BY s.name ASC
  `, [userId]);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    is_active: r.is_active === true || r.is_active === 't',
  }));
}

// Define exatamente os setores de um usuário (substituição completa).
// Regra: lista não pode ser vazia; não pode deixar qualquer setor sem usuários após a operação.
async function setUserSectors(userId, sectorIds) {
  if (!Array.isArray(sectorIds) || sectorIds.length === 0) {
    const e = new Error('Pelo menos um setor deve ser selecionado');
    e.code = 'VALIDATION';
    throw e;
  }
  const uniqueIds = [...new Set(sectorIds.map(Number).filter(Number.isFinite))];
  if (uniqueIds.length === 0) {
    const e = new Error('IDs de setor inválidos');
    e.code = 'VALIDATION';
    throw e;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Verifica existência do usuário (falha cedo para evitar operações desnecessárias)
    const { rows: userRows } = await client.query(`
      SELECT id FROM users WHERE id = ${ph(1)}
    `, [userId]);
    if (!userRows.length) {
      const e = new Error('Usuário não encontrado');
      e.code = 'USER_NOT_FOUND';
      throw e;
    }

    // Confere se todos os setores existem
    const { rows: sectorRows } = await client.query(`
      SELECT id FROM sectors WHERE id = ANY(${ph(1)})
    `, [uniqueIds]);
    const existingSectorIds = sectorRows.map((row) => row.id);
    if (existingSectorIds.length !== uniqueIds.length) {
      const e = new Error('IDs de setor inválidos');
      e.code = 'VALIDATION';
      throw e;
    }

    // Setores atuais
    const { rows: cur } = await client.query(`
      SELECT sector_id FROM user_sectors WHERE user_id = ${ph(1)}
    `, [userId]);
    const current = cur.map(r => r.sector_id);

    const toAdd = uniqueIds.filter(id => !current.includes(id));
    const toRemove = current.filter(id => !uniqueIds.includes(id));

    // Garantia: após remover, nenhum setor fica vazio
    if (toRemove.length > 0) {
      const { rows } = await client.query(`
        SELECT sector_id, COUNT(*)::int AS cnt
          FROM user_sectors
         WHERE sector_id = ANY(${ph(1)})
         GROUP BY sector_id
      `, [toRemove]);
      const counts = Object.fromEntries(rows.map(r => [r.sector_id, r.cnt]));
      const emptyWouldOccur = toRemove.some(id => (counts[id] || 0) <= 1);
      if (emptyWouldOccur) {
        const e = new Error('Não é possível remover: algum setor ficaria sem usuários');
        e.code = 'SECTOR_MIN_ONE';
        throw e;
      }
    }

    // Aplica remoções
    if (toRemove.length > 0) {
      await client.query(`
        DELETE FROM user_sectors WHERE user_id = ${ph(1)} AND sector_id = ANY(${ph(2)})
      `, [userId, toRemove]);
    }

    // Aplica adições (ignora duplicatas)
    for (const sid of toAdd) {
      await client.query(`
        INSERT INTO user_sectors (user_id, sector_id)
        VALUES (${ph(1)}, ${ph(2)})
        ON CONFLICT DO NOTHING
      `, [userId, sid]);
    }

    // Garantia: usuário não pode ficar sem setor
    const { rows: after } = await client.query(`
      SELECT COUNT(*)::int AS total FROM user_sectors WHERE user_id = ${ph(1)}
    `, [userId]);
    if (Number(after?.[0]?.total || 0) < 1) {
      const e = new Error('Usuário deve pertencer a pelo menos um setor');
      e.code = 'USER_MIN_ONE';
      throw e;
    }

    await client.query('COMMIT');
    return listUserSectors(userId);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

async function isUserInSector(userId, sectorId) {
  const { rows } = await db.query(`
    SELECT 1
      FROM user_sectors
     WHERE user_id = ${ph(1)}
       AND sector_id = ${ph(2)}
     LIMIT 1
  `, [userId, sectorId]);
  return rows.length > 0;
}

module.exports = { listUserSectors, setUserSectors, isUserInSector };
