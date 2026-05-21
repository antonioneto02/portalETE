const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const FileStoreFactory = require('session-file-store');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const port = process.env.PORT || 3021;
const host = process.env.HOST;
const isProduction = process.env.NODE_ENV === 'production';
const FileStore = FileStoreFactory(session);
const sessionSecret = process.env.SESSION_SECRET;
const sessionFilesDir = path.join(__dirname, 'logs', 'sessions');

if (!fs.existsSync(sessionFilesDir)) {
  fs.mkdirSync(sessionFilesDir, { recursive: true });
}

if (!sessionSecret) {
  if (isProduction) {
    throw new Error('SESSION_SECRET não definido em produção. Defina uma chave forte no ambiente antes de iniciar o serviço.');
  }
  console.warn('SESSION_SECRET não definido. Usando chave temporária apenas para ambiente não-produtivo.');
}

const effectiveSessionSecret = sessionSecret || crypto.randomBytes(48).toString('hex');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  hsts: false,
}));
app.use(hpp());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 800,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use(session({
  name: 'portal_ete_sid',
  secret: effectiveSessionSecret,
  store: new FileStore({
    path: sessionFilesDir,
    ttl: 2 * 60 * 60,
    retries: 1,
    logFn: function () {},
  }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7200000,
  },
}));

const authRouter = require('./routes/auth');
const mainRouter = require('./routes/main');

app.use(authRouter);
app.use(mainRouter);

app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.redirect('/home');
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(port, host || '0.0.0.0', () => {
  console.log(`Portal ETE rodando em http://${host || '0.0.0.0'}:${port}`);
});
