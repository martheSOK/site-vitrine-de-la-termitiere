# OAuth proxy Decap CMS (GitHub)

Remplace Netlify Identity + Git Gateway pour l'espace admin (`/admin`) du site, quand le site n'est plus hébergé sur Netlify (ex: Docker).

## 1. Créer une GitHub OAuth App

Sur github.com → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.

- **Homepage URL** : `https://<domaine-du-site>`
- **Authorization callback URL** : `https://<domaine-de-ce-proxy>/callback`

Note le **Client ID** et génère un **Client secret**.

## 2. Lancer le conteneur

```bash
docker build -t termitiere-oauth-proxy .
docker run -d \
  --name termitiere-oauth-proxy \
  -p 8080:8080 \
  -e GITHUB_CLIENT_ID=xxxxxxxx \
  -e GITHUB_CLIENT_SECRET=xxxxxxxx \
  termitiere-oauth-proxy
```

Mets ce conteneur derrière un sous-domaine avec HTTPS (ex. `oauth.la-termitiere.com`), via le reverse proxy déjà utilisé pour le site (nginx, Traefik, Caddy...). Un simple `http://IP:8080` ne suffit pas : GitHub exige HTTPS pour l'URL de callback en production.

## 3. Mettre à jour `site2/admin/config.yml`

Remplacer le bloc `backend` actuel par :

```yaml
backend:
  name: github
  repo: martheSOK/site-vitrine-de-la-termitiere
  branch: main
  base_url: https://oauth.la-termitiere.com
```

(`base_url` = l'adresse publique de ce proxy, sans `/auth` ni `/callback` à la fin — le CMS ajoute ça automatiquement.)

## 4. Donner accès au dépôt

Chaque personne qui doit publier via `/admin` doit avoir un compte GitHub invité comme collaborateur sur le dépôt (Settings → Collaborators). Elle se connectera avec son propre compte GitHub, plus avec un email/mot de passe séparé comme avant.

## Vérifier que ça tourne

`GET /health` répond `ok` si le service est up.
