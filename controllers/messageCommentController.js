// controllers/messageCommentController.js
// CRUD de comentários na timeline dos registros.

const MessageCommentModel = require('../models/messageComment');

exports.list = async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const comments = await MessageCommentModel.listByMessage(messageId);
    return res.json({ success: true, data: { comments } });
  } catch (err) {
    console.error('[comments] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar comentários.' });
  }
};

exports.create = async (req, res) => {
  try {
    const sessionUser = req.session?.user;
    if (!sessionUser) {
      return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
    }

    const messageId = Number(req.params.id);
    const body = String(req.body?.body || '').trim();

    const comment = await MessageCommentModel.create({
      messageId,
      userId: sessionUser.id,
      body,
    });

    return res.status(201).json({ success: true, data: { comment } });
  } catch (err) {
    if (err?.code === 'INVALID_COMMENT') {
      return res.status(400).json({ success: false, error: 'Comentário inválido. Use entre 1 e 5000 caracteres.' });
    }
    console.error('[comments] erro ao criar comentário:', err);
    return res.status(500).json({ success: false, error: 'Falha ao registrar comentário.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const commentId = String(req.params.commentId || '');
    const sessionUser = req.session?.user;
    if (!sessionUser) {
      return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
    }

    const comment = await MessageCommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comentário não encontrado.' });
    }

    if (Number(comment.message_id) !== Number(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Comentário não pertence a este registro.' });
    }

    const isOwner = Number(comment.user_id) === Number(sessionUser.id);
    const isAdmin = String(sessionUser.role || '').toUpperCase() === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Você não tem permissão para remover este comentário.' });
    }

    await MessageCommentModel.remove(commentId);
    return res.json({ success: true, data: { removed: true } });
  } catch (err) {
    console.error('[comments] erro ao remover comentário:', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover comentário.' });
  }
};
