const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ override: true });

const PROTHEUS_SERVER = process.env.PROTHEUS_SERVER;
const TIMEOUT_MS = 120 * 60 * 1000;
const PROTHEUS_ADMIN_IDS = (process.env.PROTHEUS_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const COOKIE_COMMON = { httpOnly: true, secure: false, sameSite: 'lax' };

async function validaLogin(req, res) {
  const { username, authData } = req.body;
  const usernameClean = String(username || '').trim();
  if (!usernameClean || !authData) {
    return res.redirect('/login?error=invalid_credentials');
  }

  let password;
  try {
    password = decodeURIComponent(escape(atob(String(authData))));
  } catch {
    return res.redirect('/login?error=invalid_credentials');
  }

  if (!password) return res.redirect('/login?error=invalid_credentials');

  try {
    const protheusResp = await axios.post(
      `http://${PROTHEUS_SERVER}:9001/rest/api/oauth2/v1/token`,
      null,
      {
        params: { grant_type: 'password', username: usernameClean, password },
        timeout: 10000,
      }
    );

    const { access_token, refresh_token } = protheusResp.data;
    if (!access_token) return res.redirect('/login?error=invalid_credentials');

    let protheusId = null;
    let nomeCompleto = usernameClean;

    try {
      const userResp = await axios.get(
        `http://${PROTHEUS_SERVER}:9001/rest/users/getuserid`,
        {
          headers: { Authorization: `Bearer ${access_token}` },
          timeout: 8000,
        }
      );
      protheusId = userResp.data?.userId || userResp.data?.id || null;
      if (userResp.data?.nome) nomeCompleto = userResp.data.nome;
    } catch {}

    const isAdmin = PROTHEUS_ADMIN_IDS.length > 0
      ? PROTHEUS_ADMIN_IDS.includes(String(protheusId))
      : false;

    req.session.userId = protheusId || usernameClean;
    req.session.username = nomeCompleto;
    req.session.isProtheus = true;
    req.session.protheusId = protheusId;
    req.session.isAdmin = isAdmin;
    req.session.lastActivity = Date.now();

    res.cookie('token', access_token, COOKIE_COMMON);
    if (refresh_token) res.cookie('refresh_token', refresh_token, COOKIE_COMMON);
    res.cookie('username', nomeCompleto, COOKIE_COMMON);

    const returnTo = req.session.returnTo || '/home';
    delete req.session.returnTo;
    return res.redirect(returnTo);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401 || status === 400 || status === 403) {
      return res.redirect(`/login?error=invalid_credentials&username=${encodeURIComponent(usernameClean)}`);
    }
    console.error('[Login] Erro inesperado ao autenticar via Protheus:', err?.message || err);
    return res.redirect('/login?error=invalid_credentials');
  }
}

async function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }

  const now = Date.now();
  const lastActivity = req.session.lastActivity || 0;
  if (now - lastActivity > TIMEOUT_MS) {
    res.clearCookie('token');
    res.clearCookie('refresh_token');
    res.clearCookie('username');
    req.session.destroy(() => {});
    return res.redirect('/login?timeout=true');
  }

  req.session.lastActivity = now;
  if (req.session.isProtheus) {
    const token = req.cookies?.token;
    const refreshToken = req.cookies?.refresh_token;

    if (!token && refreshToken) {
      try {
        const refreshResp = await axios.post(
          `http://${PROTHEUS_SERVER}:9001/rest/api/oauth2/v1/token`,
          null,
          { params: { grant_type: 'refresh_token', refresh_token: refreshToken }, timeout: 8000 }
        );
        const { access_token, refresh_token: newRefresh } = refreshResp.data;
        if (access_token) {
          res.cookie('token', access_token, COOKIE_COMMON);
          if (newRefresh) res.cookie('refresh_token', newRefresh, COOKIE_COMMON);
        }
      } catch {}
    }
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(403).render('System/erro', {
      mensagem: 'Acesso restrito a administradores.',
      currentPath: req.path,
      username: req.session.username || '',
      isAdmin: false,
    });
  }
  return next();
}

module.exports = { validaLogin, requireAuth, requireAdmin };
