// models/message/index.js

const queries = require('./queries');
const {
  STATUS_EN_TO_PT,
  STATUS_LABELS_PT,
  STATUS_PT_TO_EN,
  STATUS_VALUES,
} = require('./constants');
const { normalizeStatus } = require('./utils');

module.exports = {
  ...queries,
  normalizeStatus,
  STATUS_VALUES,
  STATUS_LABELS_PT,
  STATUS_TRANSLATIONS: {
    enToPt: { ...STATUS_EN_TO_PT },
    ptToEn: { ...STATUS_PT_TO_EN },
    labelsPt: { ...STATUS_LABELS_PT },
  },
};
