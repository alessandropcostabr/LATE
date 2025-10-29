// services/emailQueue.js
// Helper para enfileirar notificações usando templates.

const EmailQueueModel = require('../models/emailQueue');
const templates = require('./emailTemplates');

async function enqueueTemplate({ to, template, data = {}, subjectOverride = null, nextRunAt = null }) {
  if (!to) {
    throw new Error('Destinatário do e-mail não informado (fila)');
  }
  const rendered = templates.render(template, data);
  const subject = subjectOverride || rendered.subject;
  return EmailQueueModel.enqueue({
    toEmail: to,
    subject,
    body: {
      template,
      data,
    },
    nextRunAt,
  });
}

module.exports = {
  enqueueTemplate,
};
