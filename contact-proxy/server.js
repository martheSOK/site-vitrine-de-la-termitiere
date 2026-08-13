/* =========================================================
   Service de reception du formulaire de contact du site
   Envoie l'email via l'API Brevo, avec routage par secteur.

   Variables d'environnement requises :
     BREVO_API_KEY
     BREVO_SENDER_EMAIL   (adresse expediteur verifiee dans Brevo)
   Optionnelles :
     PORT (defaut 8081)
     ALLOWED_ORIGIN (defaut "*" - a restreindre au domaine du site en production)
   ========================================================= */
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const {
  BREVO_API_KEY,
  BREVO_SENDER_EMAIL,
  PORT = 8081,
  ALLOWED_ORIGIN = '*',
} = process.env;

if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
  console.error('BREVO_API_KEY et BREVO_SENDER_EMAIL sont obligatoires.');
  process.exit(1);
}

const emailsPath = path.join(__dirname, 'sector-emails.json');
function loadSectorEmails() {
  const raw = JSON.parse(fs.readFileSync(emailsPath, 'utf8'));
  delete raw._comment;
  return raw;
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => res.send('ok'));

app.post('/contact', async (req, res) => {
  const { name, email, phone, message, sector, 'bot-field': botField } = req.body || {};

  // Piege a robots : si ce champ cache est rempli, c'est un bot -> on repond succes sans rien envoyer
  if (botField) {
    res.json({ ok: true });
    return;
  }

  if (!name || !message || (!email && !phone)) {
    res.status(400).json({ ok: false, error: 'Champs requis manquants (nom, message, et email ou telephone).' });
    return;
  }

  const sectorEmails = loadSectorEmails();
  const destination = (sector && sectorEmails[sector]) || sectorEmails.default;

  const htmlContent = `
    <h2>Nouveau message depuis le site La Termitière</h2>
    <p><strong>Secteur :</strong> ${sector || 'Non précisé'}</p>
    <p><strong>Nom :</strong> ${name}</p>
    <p><strong>Email :</strong> ${email || 'Non renseigné'}</p>
    <p><strong>Téléphone :</strong> ${phone || 'Non renseigné'}</p>
    <p><strong>Message :</strong></p>
    <p>${String(message).replace(/\n/g, '<br>')}</p>
  `;

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Site La Termitière', email: BREVO_SENDER_EMAIL },
        to: [{ email: destination }],
        replyTo: email ? { email, name } : undefined,
        subject: `Nouveau message du site — ${sector || 'Contact général'}`,
        htmlContent,
      }),
    });

    if (!brevoRes.ok) {
      const errBody = await brevoRes.text();
      console.error('Erreur Brevo:', brevoRes.status, errBody);
      res.status(502).json({ ok: false, error: "Échec de l'envoi de l'email." });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Erreur serveur.' });
  }
});

app.listen(PORT, () => {
  console.log(`Service de contact demarre sur le port ${PORT}`);
});
