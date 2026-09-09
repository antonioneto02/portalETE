const express = require('express');
const router = express.Router();
const { validaLogin } = require('../controllers/loginController');
const { generateCsrfToken, verifyCsrfToken } = require('../middleware/csrf');

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/home');
  const csrfToken = generateCsrfToken(req);
  res.render('System/loginPage', {
    error: req.query.error || null,
    username: req.query.username || '',
    timeout: req.query.timeout === 'true',
    csrfToken,
  });
});

router.post('/login', verifyCsrfToken, validaLogin);

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('refresh_token');
  res.clearCookie('username');
  req.session.destroy(() => {});
  res.redirect('/login');
});

module.exports = router;
