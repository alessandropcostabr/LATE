// services/emailTemplates.js
// Templates pt-BR para notificações enviadas pela fila de e-mails.

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const DEFAULT_SUBJECT = 'Notificação LATE';

function buildContactUrl(id) {
  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${baseUrl}/recados/${id}`;
}

function renderContactBase(data = {}) {
  const url = buildContactUrl(data.id);
  const htmlUrl = escapeHtml(url);
  const textLines = [
    `Assunto: ${data.subject || '-'}`,
    `Remetente: ${data.sender_name || '-'} (${data.sender_phone || '—'} / ${data.sender_email || '—'})`,
    '',
    `Mensagem: ${data.message_snippet || ''}`,
    '',
    `Abrir contato: ${url}`,
  ];
  const html = `
<ul>
  <li><strong>Assunto:</strong> ${escapeHtml(data.subject || '-')}</li>
  <li><strong>Remetente:</strong> ${escapeHtml(data.sender_name || '-')} (${escapeHtml(data.sender_phone || '—')} / ${escapeHtml(data.sender_email || '—')})</li>
  <li><strong>Mensagem:</strong> ${escapeHtml(data.message_snippet || '')}</li>
</ul>
<p><a href="${htmlUrl}">➜ Abrir contato</a></p>
`.trim();
  return { url, html, textLines };
}

const templates = {
  'contact-new': (data = {}) => {
    const recipient = data.recipient_name || 'colega';
    const { html, textLines } = renderContactBase(data);
    return {
      subject: '[LATE] Novo contato para você',
      text: [`Olá, ${recipient}!`, '', 'Você recebeu um novo contato.', '', ...textLines].join('\n'),
      html: `
<p>Olá, <strong>${escapeHtml(recipient)}</strong>!</p>
<p><strong>Você recebeu um novo contato.</strong></p>
${html}
`.trim(),
    };
  },
  'contact-forward': (data = {}) => {
    const recipient = data.recipient_name || 'colega';
    const forwardedBy = data.forwarded_by || null;
    const note = data.note ? `Observação do encaminhamento: ${data.note}` : null;
    const { html, textLines } = renderContactBase(data);
    const baseText = [
      `Olá, ${recipient}!`,
      '',
      forwardedBy ? `O contato foi encaminhado para você por ${forwardedBy}.` : 'Você recebeu um contato encaminhado para você.',
      '',
      ...textLines,
    ];
    if (note) baseText.splice(baseText.length - 2, 0, note, '');
    const baseHtml = `
<p>Olá, <strong>${escapeHtml(recipient)}</strong>!</p>
<p><strong>${forwardedBy ? `O contato foi encaminhado para você por ${escapeHtml(forwardedBy)}.` : 'Você recebeu um contato encaminhado para você.'}</strong></p>
${note ? `<p><em>${escapeHtml(note)}</em></p>` : ''}
${html}
`.trim();
    return {
      subject: '[LATE] Contato encaminhado para você',
      text: baseText.join('\n'),
      html: baseHtml,
    };
  },
  'contact-new-sector': (data = {}) => {
    const sectorName = data.recipient_name || '(setor)';
    const { html, textLines } = renderContactBase(data);
    return {
      subject: `[LATE] Novo contato para o setor ${sectorName}`,
      text: [
        `Olá, ${sectorName}!`,
        '',
        `Um novo contato foi criado para o setor ${sectorName}.`,
        '',
        ...textLines,
      ].join('\n'),
      html: `
<p>Olá, <strong>${escapeHtml(sectorName)}</strong>!</p>
<p>Um novo contato foi criado para o setor <strong>${escapeHtml(sectorName)}</strong>.</p>
${html}
`.trim(),
    };
  },
  'contact-pending': (data = {}) => {
    const recipient = data.recipient_name || 'colega';
    const { html, textLines } = renderContactBase(data);
    return {
      subject: '[LATE] Contato pendente aguardando atendimento',
      text: [`Olá, ${recipient}!`, '', 'Há um contato pendente aguardando retorno.', '', ...textLines].join('\n'),
      html: `
<p>Olá, <strong>${escapeHtml(recipient)}</strong>!</p>
<p>Há um contato pendente aguardando retorno.</p>
${html}
`.trim(),
    };
  },
  'contact-pending-sector': (data = {}) => {
    const sectorName = data.recipient_name || '(setor)';
    const { html, textLines } = renderContactBase(data);
    return {
      subject: '[LATE] Contato pendente para o seu setor',
      text: [`Olá, ${sectorName}!`, '', `Há um contato pendente para o setor ${sectorName}.`, '', ...textLines].join('\n'),
      html: `
<p>Olá, <strong>${escapeHtml(sectorName)}</strong>!</p>
<p>Há um contato pendente para o setor <strong>${escapeHtml(sectorName)}</strong>.</p>
${html}
`.trim(),
    };
  },
  'contact-in-progress': (data = {}) => {
    const recipient = data.recipient_name || 'colega';
    const { html, textLines } = renderContactBase(data);
    return {
      subject: '[LATE] Contato em andamento aguardando atualização',
      text: [`Olá, ${recipient}!`, '', 'Este contato está em andamento. Atualize o status ou registre um retorno, se possível.', '', ...textLines].join('\n'),
      html: `
<p>Olá, <strong>${escapeHtml(recipient)}</strong>!</p>
<p>Este contato está em andamento. Atualize o status ou registre um retorno, se possível.</p>
${html}
`.trim(),
    };
  },
  'contact-reminder-30m': (data = {}) => {
    const recipient = data.recipient_name || 'colega';
    const { html, textLines } = renderContactBase(data);
    return {
      subject: '[LATE] Lembrete: contato vence em 30 minutos',
      text: [`Olá, ${recipient}!`, '', 'Lembrete: este contato vence em aproximadamente 30 minutos.', '', ...textLines].join('\n'),
      html: `
<p>Olá, <strong>${escapeHtml(recipient)}</strong>!</p>
<p><strong>Lembrete:</strong> este contato vence em aproximadamente 30 minutos.</p>
${html}
`.trim(),
    };
  },
  'contact-escalated-48h': (data = {}) => {
    const recipient = data.recipient_name || 'colega';
    const { html, textLines } = renderContactBase(data);
    return {
      subject: '[LATE] Contato escalonado (48h sem resposta)',
      text: [`Olá, ${recipient}!`, '', 'Este contato foi escalonado após 48 horas sem atualização.', '', ...textLines].join('\n'),
      html: `
<p>Olá, <strong>${escapeHtml(recipient)}</strong>!</p>
<p>Este contato foi escalonado após 48 horas sem atualização.</p>
${html}
`.trim(),
    };
  },
};

function render(templateName, data) {
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Template de e-mail desconhecido: ${templateName}`);
  }
  const rendered = template(data || {});
  return {
    subject: rendered.subject || DEFAULT_SUBJECT,
    html: rendered.html || '',
    text: rendered.text || '',
  };
}

module.exports = {
  render,
};
