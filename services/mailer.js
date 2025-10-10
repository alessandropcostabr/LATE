// services/mailer.js
// Encapsula o envio de e-mails para permitir troca de provedor e facilitar testes.
/* eslint-disable no-console */

const nodemailer = require('nodemailer');

const logTransport = {
  async sendMail(payload) {
    console.info('[MAIL:LOG]', JSON.stringify(payload, null, 2));
    return { messageId: 'mail-log' };
  },
};

function buildTransport() {
  const defaultDriver = process.env.NODE_ENV === 'test' ? 'log' : 'smtp';
  const driver = (process.env.MAIL_DRIVER || defaultDriver).trim().toLowerCase();

  if (driver === 'log') {
    return logTransport;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === '1';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const auth = (user && pass) ? { user, pass } : undefined;

  if (!host) {
    console.warn('[MAIL:WARN] SMTP_HOST ausente. Alternando para driver log.');
    return logTransport;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth,
  });
}

const transport = buildTransport();

async function sendMail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || 'LATE <no-reply@example.com>';
  if (!to) {
    throw new Error('Destinatário do e-mail não informado');
  }
  return transport.sendMail({ from, to, subject, html, text });
}

module.exports = {
  sendMail,
};
