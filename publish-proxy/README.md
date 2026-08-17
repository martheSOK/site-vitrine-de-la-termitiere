# Espace de publication (sans compte GitHub)

Permet à du personnel non technique de publier des offres d'emploi et des
promotions via un simple email + mot de passe, sans jamais voir GitHub. Le
service écrit à leur place dans le dépôt avec un jeton technique unique.

## 1. Créer un jeton GitHub "fine-grained" (contents seulement, sur ce dépôt uniquement)

Sur github.com → **Settings** → **Developer settings** → **Personal access
tokens** → **Fine-grained tokens** → **Generate new token**.

- **Resource owner** : ton compte (`martheSOK`)
- **Repository access** : "Only select repositories" → `site-vitrine-de-la-termitiere`
- **Permissions** → **Repository permissions** → **Contents** : `Read and write`
  (laisser tout le reste sur "No access")

Copie le jeton généré (visible une seule fois) : c'est `GITHUB_TOKEN`.

Ce jeton ne peut rien faire d'autre que lire/écrire des fichiers sur CE dépôt —
il ne donne pas accès à tes autres dépôts ni aux réglages du compte.

## 2. Créer les comptes des personnes autorisées

Pour chaque personne, choisissez un mot de passe puis générez son hash :

```bash
npm install
node scripts/hash-password.js "motDePasseChoisi"
```

Construisez ensuite `USERS_JSON` (un tableau, une entrée par personne) :

```json
[
  { "email": "rh@latermitiere.com", "passwordHash": "$2a$10$....." },
  { "email": "marketing@latermitiere.com", "passwordHash": "$2a$10$....." }
]
```

Pour ajouter/retirer quelqu'un plus tard : régénérez ce tableau JSON et
redéployez le service avec la nouvelle valeur de `USERS_JSON`.

## 3. Lancer le conteneur

```bash
docker build -t termitiere-publish-proxy .
docker run -d \
  --name termitiere-publish-proxy \
  -p 8082:8082 \
  -e GITHUB_TOKEN=xxxxxxxx \
  -e GITHUB_REPO=martheSOK/site-vitrine-de-la-termitiere \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e USERS_JSON='[{"email":"rh@latermitiere.com","passwordHash":"$2a$10$....."}]' \
  termitiere-publish-proxy
```

Mets ce conteneur derrière un sous-domaine HTTPS (ex.
`publier.latermitiere.com`), via le même reverse proxy que les autres
services (`oauth-proxy`, `contact-proxy`). Les cookies de session exigent
HTTPS (`secure: true`) — un simple `http://IP:8082` en direct ne
fonctionnera pas pour la connexion.

## 4. Utilisation

Les personnes autorisées vont sur `https://publier.latermitiere.com/`, se
connectent avec leur email + mot de passe, choisissent "Offre d'emploi" ou
"Promotion", remplissent le formulaire et publient. Le contenu apparaît sur
le site en général en quelques secondes à une minute (le temps que le build
reprenne les nouveaux fichiers).

## Vérifier que ça tourne

`GET /health` répond `ok` si le service est up.
