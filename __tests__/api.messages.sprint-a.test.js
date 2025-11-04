const express = require('express');
const supertest = require('supertest');
const { newDb } = require('pg-mem');
const { randomUUID } = require('crypto');

jest.mock('../middleware/csrf', () => jest.fn((req, _res, next) => next()));

describe('Sprint A endpoints', () => {
  let dbManager;
  let app;
  let mem;

  beforeEach(async () => {
    ({ mem, dbManager } = setupDatabase());
    await bootstrapSchema(mem);
    await seedBaseData(mem);
    app = createApp();
  });

  afterEach(async () => {
    if (dbManager?.close) {
      await dbManager.close();
    }
    jest.resetModules();
    delete global.__LATE_POOL_FACTORY;
  });

  it('permite adicionar e remover labels normalizando o texto', async () => {
    const addResponse = await supertest(app)
      .post('/api/messages/1/labels')
      .send({ label: ' Urgente ' });

    expect(addResponse.status).toBe(201);
    expect(addResponse.body).toMatchObject({ success: true });
    expect(addResponse.body.data.labels).toContain('urgente');

    const getResponse = await supertest(app).get('/api/messages/1');
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.labels).toContain('urgente');

    const removeResponse = await supertest(app)
      .delete('/api/messages/1/labels/urgente');
    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.success).toBe(true);

    const afterRemoval = await supertest(app).get('/api/messages/1');
    expect(afterRemoval.body.data.labels).toHaveLength(0);
  });

  it('cria checklist, adiciona item, marca como concluído e recalcula progresso', async () => {
    const checklistRes = await supertest(app)
      .post('/api/messages/1/checklists')
      .send({ title: 'Checklist Atendimento' });

    expect(checklistRes.status).toBe(201);
    const checklistId = checklistRes.body.data.checklist.id;

    const itemRes = await supertest(app)
      .post(`/api/messages/1/checklists/${checklistId}/items`)
      .send({ title: 'Retornar ligação' });
    expect(itemRes.status).toBe(201);
    const itemId = itemRes.body.data.item.id;

    const toggleRes = await supertest(app)
      .put(`/api/messages/1/checklists/${checklistId}/items/${itemId}`)
      .send({ done: true });
    expect(toggleRes.status).toBe(200);

    const messageRes = await supertest(app).get('/api/messages/1');
    const checklists = messageRes.body.data.checklists;
    expect(checklists[0].progress_cached).toBe(100);

    const removeRes = await supertest(app)
      .delete(`/api/messages/1/checklists/${checklistId}/items/${itemId}`);
    expect(removeRes.status).toBe(200);

    const deleteChecklist = await supertest(app)
      .delete(`/api/messages/1/checklists/${checklistId}`);
    expect(deleteChecklist.status).toBe(200);
  });

  it('permite registrar e remover comentários', async () => {
    const commentRes = await supertest(app)
      .post('/api/messages/1/comments')
      .send({ body: 'Primeira atualização' });
    expect(commentRes.status).toBe(201);
    const commentId = commentRes.body.data.comment.id;

    const messageRes = await supertest(app).get('/api/messages/1');
    expect(messageRes.body.data.comments).toHaveLength(1);
    expect(messageRes.body.data.comments[0].body).toBe('Primeira atualização');

    const removeRes = await supertest(app)
      .delete(`/api/messages/1/comments/${commentId}`);
    expect(removeRes.status).toBe(200);

    const afterRemoval = await supertest(app).get('/api/messages/1');
    expect(afterRemoval.body.data.comments).toHaveLength(0);
  });

  it('gerencia observadores adicionando e removendo usuários', async () => {
    const addRes = await supertest(app)
      .post('/api/messages/1/watchers')
      .send({ userId: 2 });
    expect(addRes.status).toBe(201);

    const messageRes = await supertest(app).get('/api/messages/1');
    expect(messageRes.body.data.watchers).toHaveLength(1);
    expect(messageRes.body.data.watchers[0].user_id).toBe(2);

    const removeRes = await supertest(app)
      .delete('/api/messages/1/watchers/2');
    expect(removeRes.status).toBe(200);

    const afterRemoval = await supertest(app).get('/api/messages/1');
    expect(afterRemoval.body.data.watchers).toHaveLength(0);
  });

  function setupDatabase() {
    const mem = newDb({ autoCreateForeignKeyIndices: true });
    const adapter = mem.adapters.createPg();
    global.__LATE_POOL_FACTORY = () => new adapter.Pool();
    jest.resetModules();
    const dbManager = require('../config/database');
    return { mem, dbManager };
  }

  async function bootstrapSchema(memInstance) {
    const db = memInstance.public;

    db.registerFunction({
      name: 'gen_random_uuid',
      returns: 'uuid',
      implementation: () => randomUUID(),
    });

    db.none('DROP TABLE IF EXISTS automation_logs CASCADE;');
    db.none('DROP TABLE IF EXISTS automations CASCADE;');
    db.none('DROP TABLE IF EXISTS message_watchers CASCADE;');
    db.none('DROP TABLE IF EXISTS message_comments CASCADE;');
    db.none('DROP TABLE IF EXISTS message_checklist_items CASCADE;');
    db.none('DROP TABLE IF EXISTS message_checklists CASCADE;');
    db.none('DROP TABLE IF EXISTS message_labels CASCADE;');
    db.none('DROP TABLE IF EXISTS messages CASCADE;');
    db.none('DROP TABLE IF EXISTS users CASCADE;');

    db.none(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);

    db.none(`
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        call_date TEXT,
        call_time TEXT,
        recipient TEXT,
        recipient_user_id INTEGER,
        recipient_sector_id INTEGER,
        sender_name TEXT,
        sender_phone TEXT,
        sender_email TEXT,
        subject TEXT,
        message TEXT,
        status TEXT DEFAULT 'pending',
        visibility TEXT DEFAULT 'private',
        callback_at TIMESTAMPTZ,
        notes TEXT,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.none(`
      CREATE TABLE message_labels (
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        PRIMARY KEY (message_id, label)
      );
    `);

    db.none(`
      CREATE TABLE sectors (
        id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
        name TEXT NOT NULL,
        email TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);

    db.none(`
      CREATE TABLE user_sectors (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, sector_id)
      );
    `);

    db.none(`
      CREATE TABLE message_checklists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        progress_cached SMALLINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.none(`
      CREATE TABLE message_checklist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        checklist_id UUID NOT NULL REFERENCES message_checklists(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT FALSE,
        position SMALLINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.none(`
      CREATE TABLE message_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    db.none(`
      CREATE TABLE message_watchers (
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (message_id, user_id)
      );
    `);

    db.none(`
      CREATE TABLE message_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async function seedBaseData(memInstance) {
    const db = memInstance.public;
    db.none(`INSERT INTO users (id, name, email, role) VALUES (1, 'Admin', 'admin@example.com', 'ADMIN')`);
    db.none(`INSERT INTO users (id, name, email, role) VALUES (2, 'Maria Usuária', 'maria@example.com', 'OPERADOR')`);
    db.none(`INSERT INTO users (id, name, email, role) VALUES (3, 'João Operador', 'joao@example.com', 'OPERADOR')`);
    db.none(`INSERT INTO messages (id, call_date, call_time, recipient, sender_name, sender_phone, sender_email, subject, message, status, created_by)
             VALUES (1, '2025-01-01', '09:00', 'Suporte', 'Cliente', '11999999999', 'cliente@example.com', 'Dúvida', 'Detalhes do recado', 'pending', 1)`);
  }

  function createApp(role = 'ADMIN') {
    const app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      req.session = {
        user: {
          id: 1,
          name: 'Admin',
          role,
        },
      };
      next();
    });

    const apiRoutes = require('../routes/api');
    app.use('/api', apiRoutes);
    return app;
  }
});
