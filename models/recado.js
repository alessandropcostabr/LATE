// models/recado.js
// Mantido por compatibilidade. Delegamos para models/message.js.

const MessageModel = require('./message');

exports.create = MessageModel.create;
exports.obterPorId = MessageModel.findById;
exports.atualizar = MessageModel.update;
exports.excluir = MessageModel.remove;
exports.listarRecentes = MessageModel.listRecent;
exports.estatisticas = MessageModel.stats;

exports.STATUS_TRANSLATIONS = MessageModel.STATUS_TRANSLATIONS;
exports.STATUS_VALUES = MessageModel.STATUS_VALUES;
exports.STATUS_LABELS_PT = MessageModel.STATUS_LABELS_PT;
