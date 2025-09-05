function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/login');
}

function requireRole(...roles) {
  return function (req, res, next) {
    if (req.session && req.session.user) {
      if (roles.length === 0 || roles.includes(req.session.user.role)) {
        return next();
      }
      return res.status(403).render('403', { title: 'Acesso negado' });
    }
    return res.redirect('/login');
  };
}

module.exports = { requireAuth, requireRole };
