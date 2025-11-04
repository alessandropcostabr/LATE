// utils/auditLogger.js
// Camada fina para registrar eventos de auditoria sem quebrar fluxo principal.

const EventLog = require('../models/eventLog');

async function logEvent(eventType, {
  entityType,
  entityId,
  actorUserId = null,
  metadata = null,
} = {}) {
  if (!eventType || !entityType || entityId === undefined || entityId === null) {
    return;
  }

  try {
    await EventLog.create({
      eventType,
      entityType,
      entityId,
      actorUserId,
      metadata,
    });
  } catch (err) {
    console.warn('[audit] falha ao registrar evento', {
      eventType,
      entityType,
      entityId,
      error: err?.message || err,
    });
  }
}

module.exports = {
  logEvent,
};
