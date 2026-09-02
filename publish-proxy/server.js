/* =========================================================
   LA TERMITIÈRE — PUBLISH PROXY

   Espace de publication simplifie (email + mot de passe, sans
   compte GitHub) pour les offres d'emploi et les promotions.

   Architecture :
     Personnel -> publish-proxy -> /content (volume Docker
     partage "termitiere-content") -> lu directement par le
     site vitrine (site2/data et site2/images/uploads sont des
     liens symboliques vers /content).

   IMPORTANT : GitHub / GitHub Actions ne sont PAS utilises pour
   les publications de contenu. GitHub reste reserve au code et
   au CI/CD (voir /admin, qui est un chemin distinct et n'ecrit
   plus dans le contenu vu par le site).

   Variables obligatoires :
     SESSION_SECRET
     USERS_JSON        (tableau JSON [{"email":"...","passwordHash":"$2a$..."}])
   Variables optionnelles :
     PORT (defaut 8082)
     COOKIE_SECURE (defaut "true")
     ALLOWED_ORIGIN (defaut "https://latermitiere.com")
     CONTENT_CACHE_SECONDS (defaut 10)
     CONTENT_DIR (defaut "/content")
   Variables optionnelles (statistiques de visite, onglet "Statistiques") :
     GA_PROPERTY_ID                    identifiant de la propriete Google Analytics (ex: 551566365)
     GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 cle JSON du compte de service, encodee en base64
     STATS_CACHE_SECONDS (defaut 300)
   Si ces variables sont absentes, l'onglet Statistiques affiche simplement
   "non configure" sans empecher le reste du service de fonctionner.
   ========================================================= */
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const {
  SESSION_SECRET,
  USERS_JSON,
  PORT = 8082,
  COOKIE_SECURE = 'true',
  ALLOWED_ORIGIN = 'https://latermitiere.com',
  CONTENT_CACHE_SECONDS = '10',
  CONTENT_DIR = '/content',
  GA_PROPERTY_ID,
  GOOGLE_SERVICE_ACCOUNT_KEY_BASE64,
  STATS_CACHE_SECONDS = '300',
} = process.env;

if (!SESSION_SECRET || !USERS_JSON) {
  console.error('SESSION_SECRET et USERS_JSON sont obligatoires.');
  process.exit(1);
}

/* ---------- Chemins contenu (volume partage) ---------- */

const DATA_DIRECTORY = path.join(CONTENT_DIR, 'data');
const UPLOADS_DIRECTORY = path.join(CONTENT_DIR, 'images', 'uploads');
const OFFRES_PATH = path.join(DATA_DIRECTORY, 'offres.json');
const PROMOTIONS_PATH = path.join(DATA_DIRECTORY, 'promotions.json');

const COLLECTIONS = {
  offres: { path: OFFRES_PATH, cacheKey: 'offres', label: 'offre', requiredFields: ['title', 'type'] },
  promotions: { path: PROMOTIONS_PATH, cacheKey: 'promotions', label: 'promotion', requiredFields: ['title'] },
};

function ensureStorage() {
  fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
  fs.mkdirSync(UPLOADS_DIRECTORY, { recursive: true });
  [OFFRES_PATH, PROMOTIONS_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `${JSON.stringify({ items: [] }, null, 2)}\n`, 'utf8');
    }
  });
}

try {
  ensureStorage();
} catch (err) {
  console.error("Impossible d'initialiser le stockage contenu :", err);
  process.exit(1);
}

/* ---------- Utilisateurs ---------- */

let USERS;
try {
  USERS = JSON.parse(USERS_JSON);
  if (!Array.isArray(USERS)) throw new Error('USERS_JSON doit être un tableau.');
  USERS.forEach((user) => {
    if (!user.email || !user.passwordHash) {
      throw new Error('Chaque utilisateur doit contenir email et passwordHash.');
    }
  });
} catch (err) {
  console.error('USERS_JSON invalide :', err.message);
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

/* ---------- Lecture / ecriture JSON (atomique) ---------- */

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return { items: [] };
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    throw new Error(`JSON invalide dans ${filePath}.`);
  }
  if (!data || !Array.isArray(data.items)) {
    throw new Error(`"items" doit être un tableau dans ${filePath}.`);
  }
  return data;
}

function writeJsonFile(filePath, data) {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, content, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

/* ---------- Cache contenu public (lecture seule, courte duree) ---------- */

const cache = { offres: null, promotions: null };

function cacheDurationMs() {
  const seconds = Number(CONTENT_CACHE_SECONDS);
  if (!Number.isFinite(seconds) || seconds < 0) return 10000;
  return seconds * 1000;
}

function getCachedContent(type, filePath) {
  const now = Date.now();
  const cached = cache[type];
  if (cached && now - cached.timestamp < cacheDurationMs()) return cached.data;
  const data = readJsonFile(filePath);
  cache[type] = { timestamp: now, data };
  return data;
}

function invalidateCache(type) {
  cache[type] = null;
}

/* ---------- Statistiques de visite (Google Analytics, optionnel) ---------- */

let analyticsClient = null;
if (GA_PROPERTY_ID && GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
  try {
    const credentials = JSON.parse(Buffer.from(GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8'));
    analyticsClient = new BetaAnalyticsDataClient({ credentials });
    console.log('Statistiques Google Analytics : configurées.');
  } catch (err) {
    console.error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 invalide, statistiques désactivées :', err.message);
  }
} else {
  console.log('Statistiques Google Analytics : non configurées (GA_PROPERTY_ID / GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 absents).');
}

let statsCache = null;

function statsCacheDurationMs() {
  const seconds = Number(STATS_CACHE_SECONDS);
  if (!Number.isFinite(seconds) || seconds < 0) return 300000;
  return seconds * 1000;
}

function firstOfMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

async function fetchVisitorStats() {
  const now = Date.now();
  if (statsCache && now - statsCache.timestamp < statsCacheDurationMs()) {
    return statsCache.data;
  }
  const [response] = await analyticsClient.runReport({
    property: `properties/${GA_PROPERTY_ID}`,
    dateRanges: [
      { startDate: 'today', endDate: 'today' },
      { startDate: firstOfMonthISO(), endDate: 'today' },
    ],
    metrics: [{ name: 'activeUsers' }],
  });
  let today = 0;
  let month = 0;
  (response.rows || []).forEach((row) => {
    const rangeName = row.dimensionValues?.[0]?.value;
    const value = Number(row.metricValues?.[0]?.value || 0);
    if (rangeName === 'date_range_0') today = value;
    if (rangeName === 'date_range_1') month = value;
  });
  const data = { today, month, updatedAt: new Date().toISOString() };
  statsCache = { timestamp: now, data };
  return data;
}

/* ---------- Utilitaires ---------- */

const DIACRITICS_RE = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

function slugify(value) {
  return (
    String(value)
      .normalize('NFD')
      .replace(DIACRITICS_RE, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'photo'
  );
}

function cleanItem(item) {
  Object.keys(item).forEach((key) => {
    if (item[key] === undefined || item[key] === null || item[key] === '') delete item[key];
  });
  return item;
}

function requireAuth(req, res, next) {
  if (!req.session.email) {
    res.status(401).json({ ok: false, error: 'Non connecté.' });
    return;
  }
  next();
}

function requireCollection(req, res, next) {
  const collection = COLLECTIONS[req.params.collection];
  if (!collection) {
    res.status(404).json({ ok: false, error: 'Collection inconnue.' });
    return;
  }
  req.collection = collection;
  next();
}

function buildImageFilename(originalName) {
  const parsed = path.parse(originalName || '');
  let extension = parsed.ext.toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  if (!allowedExtensions.includes(extension)) extension = '.jpg';
  const baseName = slugify(parsed.name || 'photo');
  const unique = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
  return `${unique}-${baseName}${extension}`;
}

function saveUploadedImage(file) {
  const filename = buildImageFilename(file.originalname);
  const destination = path.join(UPLOADS_DIRECTORY, filename);
  fs.writeFileSync(destination, file.buffer);
  return { filename, url: `/images/uploads/${filename}` };
}

function deleteUploadedImage(url) {
  if (!url) return;
  const filename = path.basename(url);
  try {
    fs.unlinkSync(path.join(UPLOADS_DIRECTORY, filename));
  } catch (err) {
    // fichier deja absent ou image externe : rien a faire
  }
}

/* ---------- Express ---------- */

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: COOKIE_SECURE !== 'false',
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

/* CORS : necessaire uniquement si le site (autre origine) appelle l'API
   directement. La page /public de ce service est same-origin et n'en a pas besoin. */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN || origin === 'https://www.latermitiere.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//i.test(file.mimetype)) {
      cb(new Error('Seules les images sont autorisées.'));
      return;
    }
    cb(null, true);
  },
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'publish-proxy', storage: CONTENT_DIR });
});

app.get('/api/session', (req, res) => {
  res.json({ ok: true, email: req.session.email || null, sectors: SECTORS });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = USERS.find((u) => String(u.email || '').trim().toLowerCase() === normalizedEmail);
  const valid = user && (await bcrypt.compare(String(password || ''), user.passwordHash));
  if (!valid) {
    res.status(401).json({ ok: false, error: 'Email ou mot de passe incorrect.' });
    return;
  }
  req.session.email = user.email;
  res.json({ ok: true, email: user.email });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur destruction session:', err);
      res.status(500).json({ ok: false, error: 'Impossible de fermer la session.' });
      return;
    }
    res.json({ ok: true });
  });
});

/* ---------- Lecture publique (utilisee par le site ET par l'interface de publication) ---------- */

app.get('/api/content/:collection', requireCollection, (req, res) => {
  try {
    const data = getCachedContent(req.collection.cacheKey, req.collection.path);
    res.setHeader('Cache-Control', 'public, max-age=10');
    res.json(data);
  } catch (err) {
    console.error('Erreur lecture contenu:', err);
    res.status(503).json({ ok: false, error: 'Contenu temporairement indisponible.' });
  }
});

app.get('/api/content/images/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    if (filename !== req.params.filename) {
      res.status(400).send('Nom de fichier invalide.');
      return;
    }
    const imagePath = path.join(UPLOADS_DIRECTORY, filename);
    if (!fs.existsSync(imagePath)) {
      res.status(404).send('Image introuvable.');
      return;
    }
    const extension = path.extname(filename).toLowerCase();
    const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
    res.setHeader('Content-Type', mimeTypes[extension] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(imagePath);
  } catch (err) {
    console.error('Erreur lecture image:', err);
    res.status(503).send('Image temporairement indisponible.');
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  if (!analyticsClient) {
    res.status(503).json({ ok: false, error: "Statistiques non configurées." });
    return;
  }
  try {
    const stats = await fetchVisitorStats();
    res.json({ ok: true, ...stats });
  } catch (err) {
    console.error('Erreur lecture statistiques Google Analytics:', err.message);
    res.status(502).json({ ok: false, error: "Impossible de récupérer les statistiques pour le moment." });
  }
});

/* ---------- Publication / modification / suppression ---------- */

app.post('/api/:collection', requireAuth, requireCollection, upload.single('photo'), (req, res) => {
  const col = req.collection;
  const body = req.body || {};
  const missing = col.requiredFields.filter((f) => !body[f]);
  if (missing.length) {
    res.status(400).json({ ok: false, error: `Champ(s) obligatoire(s) manquant(s) : ${missing.join(', ')}.` });
    return;
  }
  let savedImage = null;
  try {
    if (req.file) savedImage = saveUploadedImage(req.file);
    const item = cleanItem({
      title: String(body.title).trim(),
      type: body.type ? String(body.type).trim() : undefined,
      location: body.location ? String(body.location).trim() : undefined,
      sector: body.sector ? String(body.sector).trim() : undefined,
      description: body.description ? String(body.description).trim() : undefined,
      dateLimite: body.dateLimite ? String(body.dateLimite).trim() : undefined,
      validUntil: body.validUntil ? String(body.validUntil).trim() : undefined,
      photo: savedImage ? savedImage.url : undefined,
    });
    const data = readJsonFile(col.path);
    data.items.unshift(item);
    writeJsonFile(col.path, data);
    invalidateCache(col.cacheKey);
    console.log(`${col.label} publiée : "${item.title}" via ${req.session.email}`);
    res.json({ ok: true, item });
  } catch (err) {
    console.error(`Erreur publication ${col.label}:`, err);
    if (savedImage) deleteUploadedImage(savedImage.url);
    res.status(500).json({ ok: false, error: 'Échec de la publication.' });
  }
});

app.put('/api/:collection/:index', requireAuth, requireCollection, upload.single('photo'), (req, res) => {
  const col = req.collection;
  const body = req.body || {};
  const index = Number(req.params.index);
  const missing = col.requiredFields.filter((f) => !body[f]);
  if (missing.length) {
    res.status(400).json({ ok: false, error: `Champ(s) obligatoire(s) manquant(s) : ${missing.join(', ')}.` });
    return;
  }
  let savedImage = null;
  try {
    const data = readJsonFile(col.path);
    if (!Number.isInteger(index) || index < 0 || index >= data.items.length) {
      res.status(404).json({ ok: false, error: 'Cette entrée a changé entre-temps, recharge la liste.' });
      return;
    }
    if (req.file) savedImage = saveUploadedImage(req.file);
    const previousPhoto = data.items[index].photo;
    const updated = cleanItem({
      title: String(body.title).trim(),
      type: body.type ? String(body.type).trim() : undefined,
      location: body.location ? String(body.location).trim() : undefined,
      sector: body.sector ? String(body.sector).trim() : undefined,
      description: body.description ? String(body.description).trim() : undefined,
      dateLimite: body.dateLimite ? String(body.dateLimite).trim() : undefined,
      validUntil: body.validUntil ? String(body.validUntil).trim() : undefined,
      photo: savedImage ? savedImage.url : previousPhoto,
    });
    data.items[index] = updated;
    writeJsonFile(col.path, data);
    invalidateCache(col.cacheKey);
    if (savedImage && previousPhoto) deleteUploadedImage(previousPhoto);
    console.log(`${col.label} modifiée : "${updated.title}" via ${req.session.email}`);
    res.json({ ok: true, item: updated });
  } catch (err) {
    console.error(`Erreur modification ${col.label}:`, err);
    if (savedImage) deleteUploadedImage(savedImage.url);
    res.status(500).json({ ok: false, error: 'Échec de la modification.' });
  }
});

app.delete('/api/:collection/:index', requireAuth, requireCollection, (req, res) => {
  const col = req.collection;
  const index = Number(req.params.index);
  try {
    const data = readJsonFile(col.path);
    if (!Number.isInteger(index) || index < 0 || index >= data.items.length) {
      res.status(404).json({ ok: false, error: 'Cette entrée a changé entre-temps, recharge la liste.' });
      return;
    }
    const [removed] = data.items.splice(index, 1);
    writeJsonFile(col.path, data);
    invalidateCache(col.cacheKey);
    if (removed.photo) deleteUploadedImage(removed.photo);
    console.log(`${col.label} supprimée : "${removed.title}" via ${req.session.email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(`Erreur suppression ${col.label}:`, err);
    res.status(500).json({ ok: false, error: 'Échec de la suppression.' });
  }
});

/* ---------- Gestion des erreurs Multer ---------- */

app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    res.status(400).json({
      ok: false,
      error: err.code === 'LIMIT_FILE_SIZE' ? 'Image trop volumineuse. Taille maximale : 5 Mo.' : "Erreur lors de l'upload de l'image.",
    });
    return;
  }
  if (err && err.message === 'Seules les images sont autorisées.') {
    res.status(400).json({ ok: false, error: err.message });
    return;
  }
  console.error('Erreur serveur non gérée:', err);
  res.status(500).json({ ok: false, error: 'Erreur serveur.' });
});

app.listen(PORT, () => {
  console.log('==========================================');
  console.log('LA TERMITIÈRE — PUBLISH PROXY');
  console.log('==========================================');
  console.log(`Port : ${PORT}`);
  console.log(`Stockage contenu : ${CONTENT_DIR}`);
  console.log(`Données : ${DATA_DIRECTORY}`);
  console.log(`Uploads : ${UPLOADS_DIRECTORY}`);
  console.log(`Origin autorisée : ${ALLOWED_ORIGIN}`);
  console.log(`Cache contenu : ${CONTENT_CACHE_SECONDS}s`);
  console.log(`Statistiques Google Analytics : ${analyticsClient ? 'activées' : 'désactivées'}`);
  console.log('==========================================');
});
