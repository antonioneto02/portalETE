const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { validaLogin } = require('../controllers/loginController');
const { generateCsrfToken, verifyCsrfToken } = require('../middleware/csrf');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.redirect('/login?error=too_many_attempts'),
});

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

router.post('/login', loginLimiter, verifyCsrfToken, validaLogin);

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('refresh_token');
  res.clearCookie('username');
  req.session.destroy(() => {});
  res.redirect('/login');
});

module.exports = router;
