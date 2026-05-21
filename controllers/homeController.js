function renderHome(req, res) {
  res.render('Home/index', {
    username: req.session.username || req.session.userId || 'Usuário',
    isAdmin: req.session.isAdmin || false,
    currentPath: '/home',
  });
}

module.exports = { renderHome };
