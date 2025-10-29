// services/emailQueueWorker.js
// Worker simples que consome email_queue e envia notificações.

const EmailQueueModel = require('../models/emailQueue');
const templates = require('./emailTemplates');
const { sendMail } = require('./mailer');

const DEFAULT_INTERVAL = Number(process.env.EMAIL_WORKER_INTERVAL_MS || 15000);
const DEFAULT_BATCH = Number(process.env.EMAIL_WORKER_BATCH || 10);

let timer = null;
let running = false;

async function processBatch() {
  if (running) return;
  running = true;
  try {
    const jobs = await EmailQueueModel.pullPending(DEFAULT_BATCH);
    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err) {
    console.error('[email-worker] falha ao processar lote', err);
  } finally {
    running = false;
  }
}

async function processJob(job) {
  try {
    const payload = job.body_json || {};
    const templateName = payload.template;
    const data = payload.data || {};
    const rendered = templates.render(templateName, data);
    const subject = job.subject || rendered.subject;

    await sendMail({
      to: job.to_email,
      subject,
      html: rendered.html,
      text: rendered.text,
    });

    await EmailQueueModel.markSent(job.id);
  } catch (err) {
    const message = err?.message || String(err);
    console.error('[email-worker] falha ao enviar e-mail', { id: job.id, err: message });
    await EmailQueueModel.markErrored(job, message);
  }
}

function startEmailQueueWorker() {
  if (timer) return;
  const interval = DEFAULT_INTERVAL;
  timer = setInterval(processBatch, interval);
  processBatch().catch((err) => {
    console.error('[email-worker] falha na execução inicial', err);
  });
  console.info('[email-worker] iniciado', { intervalMs: interval, batchSize: DEFAULT_BATCH });
}

function stopEmailQueueWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  startEmailQueueWorker,
  stopEmailQueueWorker,
};
