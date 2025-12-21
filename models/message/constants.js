// models/message/constants.js

const TABLE_NAME = 'messages';
const RECIPIENT_USER_COLUMN = 'recipient_user_id';
const RECIPIENT_SECTOR_COLUMN = 'recipient_sector_id';
const CREATED_BY_COLUMN = 'created_by';
const UPDATED_BY_COLUMN = 'updated_by';
const VISIBILITY_COLUMN = 'visibility';
const USER_SECTORS_TABLE = 'user_sectors';
const PARENT_MESSAGE_COLUMN = 'parent_message_id';

const BASE_SELECT_FIELDS = [
  'id',
  'call_date',
  'call_time',
  'recipient',
  'sender_name',
  'sender_phone',
  'sender_email',
  'subject',
  'message',
  'status',
  'visibility',
  'callback_at',
  'notes',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
];

const OPTIONAL_COLUMNS = new Set([
  RECIPIENT_USER_COLUMN,
  RECIPIENT_SECTOR_COLUMN,
  CREATED_BY_COLUMN,
  UPDATED_BY_COLUMN,
  PARENT_MESSAGE_COLUMN,
]);

const STATUS_EN_TO_PT = {
  pending: 'pendente',
  in_progress: 'em_andamento',
  resolved: 'resolvido',
};

const STATUS_LABELS_PT = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
};

const STATUS_PT_TO_EN = Object.entries(STATUS_EN_TO_PT).reduce((acc, [en, pt]) => {
  acc[pt] = en;
  return acc;
}, {});

const STATUS_VALUES = Object.keys(STATUS_EN_TO_PT);

const LEGACY_STATUS_ALIASES = {
  pendente: 'pending',
  aberto: 'pending',
  open: 'pending',
  andamento: 'in_progress',
  'em andamento': 'in_progress',
  'em-andamento': 'in_progress',
  resolvido: 'resolved',
  fechado: 'resolved',
  concluido: 'resolved',
  concluído: 'resolved',
  closed: 'resolved',
};

const DATE_REF_SQL = `
  CASE
    WHEN call_date IS NOT NULL AND call_date LIKE '____-__-__'
      THEN call_date::date
    ELSE created_at::date
  END
`;

module.exports = {
  TABLE_NAME,
  RECIPIENT_USER_COLUMN,
  RECIPIENT_SECTOR_COLUMN,
  CREATED_BY_COLUMN,
  UPDATED_BY_COLUMN,
  VISIBILITY_COLUMN,
  USER_SECTORS_TABLE,
  PARENT_MESSAGE_COLUMN,
  BASE_SELECT_FIELDS,
  OPTIONAL_COLUMNS,
  STATUS_EN_TO_PT,
  STATUS_LABELS_PT,
  STATUS_PT_TO_EN,
  STATUS_VALUES,
  LEGACY_STATUS_ALIASES,
  DATE_REF_SQL,
};
