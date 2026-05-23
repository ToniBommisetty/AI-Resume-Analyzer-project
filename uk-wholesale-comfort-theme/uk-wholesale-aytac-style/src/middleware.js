function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  if (req.session.user.role !== 'admin') {
    return res.redirect('/customer');
  }

  next();
}

module.exports = { requireLogin, requireAdmin };