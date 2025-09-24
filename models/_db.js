const dbManager = require('../config/database');

module.exports = function getDatabase() {
  return dbManager.getDatabase();
};
