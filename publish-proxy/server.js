/* =========================================================
   Espace de publication simplifie (sans compte GitHub)
   Permet a du personnel non technique de publier des offres
   d'emploi et des promotions via un simple email + mot de passe.
   Ecrit directement dans le depot GitHub avec un jeton technique
   unique, cote serveur uniquement.

   Variables d'environnement requises :
     GITHUB_TOKEN    (PAT "fine-grained", Contents: Read/Write sur CE depot uniquement)
     GITHUB_REPO     (ex: "martheSOK/site-vitrine-de-la-termitiere")
     SESSION_SECRET  (chaine aleatoire longue)
     USERS_JSON      (tableau JSON [{"email":"...","passwordHash":"$2a$..."}])
   Optionnelles :
     PORT (defaut 8082)
     GITHUB_BRANCH (defaut "main")
     COOKIE_SECURE (defaut "true" ; mettre "false" uniquement pour tester
       en local sans HTTPS - a laisser sur "true" en production)
   ========================================================= */
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fetch = require('node-fetch');
const path = require('path');

const {
  GITHUB_TOKEN,
  GITHUB_REPO,
  SESSION_SECRET,
  USERS_JSON,
  PORT = 8082,
  GITHUB_BRANCH = 'main',
  COOKIE_SECURE = 'true',
} = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPO || !SESSION_SECRET || !USERS_JSON) {
  console.error('GITHUB_TOKEN, GITHUB_REPO, SESSION_SECRET et USERS_JSON sont obligatoires.');
  process.exit(1);
}

let USERS;
try {
  USERS = JSON.parse(USERS_JSON);
} catch (err) {
  console.error('USERS_JSON invalide (attendu : [{"email":"...","passwordHash":"..."}]).');
  process.exit(1);
}

const SECTORS = [
  { value: 'sport', label: 'Maxi Gym' },
  { value: 'briqueterie', label: 'La Briqueterie' },
  { value: 'garderie', label: 'La Garderie' },
  { value: 'agro', label: 'Maxi Agro' },
  { value: 'batiment', label: 'Maxi Bâtiment' },
  { value: 'logistique', label: 'Maxi Logistique' },
  { value: 'efoncier', label: 'La Foncière' },
  { value: 'cosmetique', label: 'Maxi Cosmétique' },
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: COOKIE_SECURE !== 'false', maxAge: 8 * 60 * 60 * 1000 },
}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.send('ok'));

function requireAuth(req, res, next) {
  if (!req.session.email) {
    res.status(401).json({ ok: false, error: 'Non connecte.' });
    return;
  }
  next();
}

app.get('/api/session', (req, res) => {
  res.json({ ok: true, email: req.session.email || null, sectors: SECTORS });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = USERS.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  const valid = user && (await bcrypt.compare(String(password || ''), user.passwordHash));
  if (!valid) {
    res.status(401).json({ ok: false, error: 'Email ou mot de passe incorrect.' });
    return;
  }
  req.session.email = user.email;
  res.json({ ok: true, email: user.email });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

/* ---------- Aides GitHub Contents API ---------- */

const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/contents`;

async function githubGetFile(filePath) {
  const res = await fetch(`${GITHUB_API}/${filePath}?ref=${GITHUB_BRANCH}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lecture GitHub echouee (${filePath}) : ${res.status}`);
  const json = await res.json();
  return { sha: json.sha, content: Buffer.from(json.content, 'base64') };
}

async function githubPutFile(filePath, contentBuffer, message, sha) {
  const res = await fetch(`${GITHUB_API}/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: contentBuffer.toString('base64'),
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ecriture GitHub echouee (${filePath}) : ${res.status} ${body}`);
  }
  return res.json();
}

const DIACRITICS_RE = new RegExp(String.fromCharCode(0x5b) + String.fromCharCode(0x300) + String.fromCharCode(0x2d) + String.fromCharCode(0x36f) + String.fromCharCode(0x5d), 'g');

function slugify(str) {
  return String(str)
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'photo';
}

async function uploadPhoto(file) {
  const ext = (file.originalname.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
  const filename = `${Date.now()}-${slugify(path.basename(file.originalname, ext))}${ext}`;
  await githubPutFile(`site2/images/uploads/${filename}`, file.buffer, `Ajoute une photo via l'espace de publication (${filename})`);
  return `/images/uploads/${filename}`;
}

async function appendItem(dataFilePath, item, commitMessage) {
  const existing = await githubGetFile(dataFilePath);
  const data = existing ? JSON.parse(existing.content.toString('utf8')) : { items: [] };
  data.items.unshift(item);
  const newContent = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await githubPutFile(dataFilePath, newContent, commitMessage, existing ? existing.sha : undefined);
}

function cleanItem(item) {
  Object.keys(item).forEach((k) => (item[k] === undefined || item[k] === '') && delete item[k]);
  return item;
}

/* ---------- Publication ---------- */

app.post('/api/offres', requireAuth, upload.single('photo'), async (req, res) => {
  const { title, type, location, sector, description, dateLimite } = req.body || {};
  if (!title || !type) {
    res.status(400).json({ ok: false, error: 'Titre et type de contrat obligatoires.' });
    return;
  }
  try {
    const item = cleanItem({ title, type, location, sector, description, dateLimite });
    if (req.file) item.photo = await uploadPhoto(req.file);
    await appendItem('site2/data/offres.json', item, `Ajoute une offre : ${title} (via ${req.session.email})`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Echec de la publication.' });
  }
});

app.post('/api/promotions', requireAuth, upload.single('photo'), async (req, res) => {
  const { title, sector, description, validUntil } = req.body || {};
  if (!title) {
    res.status(400).json({ ok: false, error: 'Titre obligatoire.' });
    return;
  }
  try {
    const item = cleanItem({ title, sector, description, validUntil });
    if (req.file) item.photo = await uploadPhoto(req.file);
    await appendItem('site2/data/promotions.json', item, `Ajoute une promotion : ${title} (via ${req.session.email})`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Echec de la publication.' });
  }
});

app.listen(PORT, () => {
  console.log(`Espace de publication demarre sur le port ${PORT}`);
});
