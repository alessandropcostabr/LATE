const path = require('path');

const EXPORT_DIR = path.resolve(process.env.REPORT_EXPORT_DIR || path.join(process.cwd(), 'storage', 'exports'));
const EXPORT_MAX_ROWS = Math.max(100, Number(process.env.REPORT_EXPORT_MAX_ROWS) || 5000);
const EXPORT_HISTORY_LIMIT = Math.max(5, Number(process.env.REPORT_EXPORT_HISTORY_LIMIT) || 30);
const EXPORT_TTL_DAYS = Math.max(1, Number(process.env.REPORT_EXPORT_TTL_DAYS) || 7);

module.exports = {
  EXPORT_DIR,
  EXPORT_MAX_ROWS,
  EXPORT_HISTORY_LIMIT,
  EXPORT_TTL_DAYS,
};
