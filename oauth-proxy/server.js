/* =========================================================
   Petit service OAuth GitHub pour Decap CMS
   Remplace Netlify Identity + Git Gateway sur un hebergement
   qui n'est pas Netlify (ex: Docker).

   Variables d'environnement requises :
     GITHUB_CLIENT_ID
     GITHUB_CLIENT_SECRET
   Optionnelles :
     PORT (defaut 8080)
     OAUTH_SCOPE (defaut "repo,user")
   ========================================================= */
const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  PORT = 8080,
  OAUTH_SCOPE = 'repo,user',
} = process.env;

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.error('GITHUB_CLIENT_ID et GITHUB_CLIENT_SECRET sont obligatoires.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', true);

// L'etat CSRF est garde en memoire (un seul processus, usage faible volume : admin uniquement)
const pendingStates = new Set();

app.get('/health', (req, res) => res.send('ok'));

app.get('/auth', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);
  const redirectUri = `${req.protocol}://${req.get('host')}/callback`;
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', OAUTH_SCOPE);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!state || !pendingStates.has(state)) {
    res.status(400).send('Etat invalide (state manquant ou expire). Reessaie la connexion.');
    return;
  }
  pendingStates.delete(state);

  if (!code) {
    res.status(400).send('Code manquant.');
    return;
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenJson = await tokenRes.json();

    if (tokenJson.error || !tokenJson.access_token) {
      res.status(400).send(`Erreur GitHub : ${tokenJson.error_description || tokenJson.error || 'jeton introuvable'}`);
      return;
    }

    const token = tokenJson.access_token;
    const payload = JSON.stringify({ token, provider: 'github' });

    // Page pont : dialogue avec la fenetre Decap CMS qui a ouvert ce popup (protocole standard netlify-cms/decap-cms)
    res.set('Content-Type', 'text/html').send(`<!doctype html>
<html><body>
<script>
  (function() {
    function receiveMessage(e) {
      window.opener.postMessage(
        'authorization:github:success:${payload.replace(/'/g, "\\'")}',
        e.origin
      );
      window.removeEventListener('message', receiveMessage, false);
    }
    window.addEventListener('message', receiveMessage, false);
    window.opener.postMessage('authorizing:github', '*');
  })();
</script>
<p>Connexion reussie, tu peux fermer cette fenetre.</p>
</body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur pendant l'echange du jeton GitHub.");
  }
});

app.listen(PORT, () => {
  console.log(`OAuth proxy Decap CMS demarre sur le port ${PORT}`);
});
