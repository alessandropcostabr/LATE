// models/message/utils.js

const {
  LEGACY_STATUS_ALIASES,
  STATUS_EN_TO_PT,
  STATUS_LABELS_PT,
  STATUS_PT_TO_EN,
  STATUS_VALUES,
} = require('./constants');

// Helper de placeholder para PG ($1, $2, ...)
function ph(i) {
  return `$${i}`;
}

function toString(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function trim(value) {
  return toString(value).trim();
}

function emptyToNull(value) {
  const v = trim(value);
  return v === '' ? null : v;
}

function normalizeRecipientUserId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRecipientSectorId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeUserId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeVisibility(raw) {
  const value = String(raw || 'private').trim().toLowerCase();
  return value === 'public' ? 'public' : 'private';
}

function normalizeStatus(raw) {
  const base = trim(raw);
  if (!base) return 'pending';
  const normalized = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (STATUS_EN_TO_PT[normalized]) return normalized;
  if (STATUS_PT_TO_EN[normalized]) return STATUS_PT_TO_EN[normalized];
  if (LEGACY_STATUS_ALIASES[normalized]) return LEGACY_STATUS_ALIASES[normalized];
  return 'pending';
}

function ensureStatus(value) {
  const normalized = normalizeStatus(value);
  return STATUS_VALUES.includes(normalized) ? normalized : 'pending';
}

function translateStatusForQuery(status) {
  if (!status) return null;
  const normalized = normalizeStatus(status);
  return {
    current: normalized,
    legacy: STATUS_EN_TO_PT[normalized] || normalized,
  };
}

function normalizeLabelFilter(value) {
  const raw = trim(value).toLowerCase();
  if (!raw) return null;
  return raw;
}

function parseBaseDate(dateInput) {
  const raw = trim(dateInput);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = Date.parse(`${raw}T00:00:00`);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return null;
}

function normalizeCallbackAt(input, baseDateInput) {
  const raw = trim(input).toLowerCase();
  if (!raw) return null;

  const baseDate = parseBaseDate(baseDateInput);

  const matchHour = raw.match(/^(\d{1,2})h$/);
  if (matchHour) {
    const hour = Number.parseInt(matchHour[1], 10);
    if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
      const reference = baseDate ? new Date(baseDate) : new Date();
      reference.setHours(hour, 0, 0, 0);
      return reference;
    }
  }

  const matchHourMinute = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (matchHourMinute) {
    const hour = Number.parseInt(matchHourMinute[1], 10);
    const minute = Number.parseInt(matchHourMinute[2], 10);
    if ([hour, minute].every((value) => Number.isInteger(value)) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      const reference = baseDate ? new Date(baseDate) : new Date();
      reference.setHours(hour, minute, 0, 0);
      return reference;
    }
  }

  const normalizedInput = trim(input).replace(' ', 'T');
  const parsed = Date.parse(normalizedInput);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

function normalizePayload(payload = {}) {
  const messageContent = trim(payload.message || payload.notes || '');
  const statusProvided = Object.prototype.hasOwnProperty.call(payload, 'status');
  const visibilityProvided = Object.prototype.hasOwnProperty.call(payload, 'visibility');
  const recipientUserProvided = Object.prototype.hasOwnProperty.call(payload, 'recipient_user_id') ||
    Object.prototype.hasOwnProperty.call(payload, 'recipientUserId');
  const recipientSectorProvided = Object.prototype.hasOwnProperty.call(payload, 'recipient_sector_id') ||
    Object.prototype.hasOwnProperty.call(payload, 'recipientSectorId');
  const callbackProvided = (
    Object.prototype.hasOwnProperty.call(payload, 'callback_at') ||
    Object.prototype.hasOwnProperty.call(payload, 'callbackAt') ||
    Object.prototype.hasOwnProperty.call(payload, 'callback_time')
  );
  const parentProvided = (
    Object.prototype.hasOwnProperty.call(payload, 'parent_message_id') ||
    Object.prototype.hasOwnProperty.call(payload, 'parentMessageId')
  );

  const recipientUserId = recipientUserProvided
    ? normalizeRecipientUserId(payload.recipient_user_id ?? payload.recipientUserId)
    : null;
  const recipientSectorId = recipientSectorProvided
    ? normalizeRecipientSectorId(payload.recipient_sector_id ?? payload.recipientSectorId)
    : null;
  const parentId = parentProvided ? Number(payload.parent_message_id ?? payload.parentMessageId) : null;
  const parentMessageId = Number.isInteger(parentId) && parentId > 0 ? parentId : null;

  let callbackAtValue;
  if (callbackProvided) {
    const callbackInput = payload.callback_at ?? payload.callbackAt ?? payload.callback_time;
    const parsed = normalizeCallbackAt(callbackInput, payload.call_date ?? payload.callDate);
    callbackAtValue = parsed ? new Date(parsed) : null;
  }

  const data = {
    call_date: emptyToNull(payload.call_date),
    call_time: emptyToNull(payload.call_time),
    recipient: emptyToNull(payload.recipient),
    sender_name: emptyToNull(payload.sender_name),
    sender_phone: emptyToNull(payload.sender_phone),
    sender_email: emptyToNull(payload.sender_email),
    subject: emptyToNull(payload.subject),
    message: messageContent || '(sem mensagem)',
    status: statusProvided ? ensureStatus(payload.status) : null,
    visibility: visibilityProvided ? normalizeVisibility(payload.visibility) : undefined,
    callback_at: callbackProvided ? callbackAtValue ?? null : undefined,
    notes: emptyToNull(payload.notes),
  };

  if (recipientUserProvided) {
    data.recipient_user_id = recipientUserId;
  }
  if (recipientSectorProvided) {
    data.recipient_sector_id = recipientSectorId;
  }
  if (parentProvided) {
    data.parent_message_id = parentMessageId;
  }

  return {
    data,
    statusProvided,
    visibilityProvided,
    recipientUserProvided,
    recipientSectorProvided,
    callbackProvided,
    parentProvided,
  };
}

function attachTimestamps(_payload, source = {}) {
  return {
    created_at: emptyToNull(source.created_at),
    updated_at: emptyToNull(source.updated_at),
  };
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    call_date: row.call_date ?? null,
    call_time: row.call_time ?? null,
    recipient: row.recipient ?? null,
    recipient_user_id: row.recipient_user_id ?? null,
    recipientUserId: row.recipient_user_id ?? null,
    recipient_sector_id: row.recipient_sector_id ?? null,
    recipientSectorId: row.recipient_sector_id ?? null,
    sender_name: row.sender_name ?? null,
    sender_phone: row.sender_phone ?? null,
    sender_email: row.sender_email ?? null,
    subject: row.subject ?? null,
    message: row.message ?? null,
    status: ensureStatus(row.status),
    visibility: normalizeVisibility(row.visibility),
    callback_at: row.callback_at ?? null,
    callbackAt: row.callback_at ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    created_by: row.created_by ?? null,
    createdBy: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    updatedBy: row.updated_by ?? null,
    parent_message_id: row.parent_message_id ?? null,
    parentMessageId: row.parent_message_id ?? null,
  };
}

module.exports = {
  STATUS_LABELS_PT,
  STATUS_VALUES,
  attachTimestamps,
  emptyToNull,
  ensureStatus,
  mapRow,
  normalizeCallbackAt,
  normalizeLabelFilter,
  normalizePayload,
  normalizeRecipientSectorId,
  normalizeRecipientUserId,
  normalizeStatus,
  normalizeUserId,
  normalizeVisibility,
  ph,
  parseBaseDate,
  toString,
  translateStatusForQuery,
  trim,
};
