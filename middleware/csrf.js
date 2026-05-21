const crypto = require('crypto');

function generateCsrfToken(req) {
  const token = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = token;
  return token;
}

function verifyCsrfToken(req, res, next) {
  const sessionToken = String(req.session?.csrfToken || '');
  const requestToken = String(req.body?._csrf || '');

  if (!sessionToken || !requestToken) {
    return res.redirect('/login?error=sessao_invalida');
  }

  const sessionBuffer = Buffer.from(sessionToken);
  const requestBuffer = Buffer.from(requestToken);

  if (sessionBuffer.length !== requestBuffer.length) {
    return res.redirect('/login?error=sessao_invalida');
  }

  const isValid = crypto.timingSafeEqual(sessionBuffer, requestBuffer);
  if (!isValid) {
    return res.redirect('/login?error=sessao_invalida');
  }

  req.session.csrfToken = null;
  return next();
}

module.exports = { generateCsrfToken, verifyCsrfToken };
