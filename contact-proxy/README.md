# Service de contact (remplace Formspree)

Reçoit les messages du formulaire de contact du site et les envoie par email via [Brevo](https://www.brevo.com), avec un routage par secteur — sans limite basse de soumissions mensuelles (300 emails/jour gratuits chez Brevo, largement au-dessus des besoins actuels).

## 1. Créer un compte Brevo et une clé API

1. Crée un compte gratuit sur [brevo.com](https://www.brevo.com)
2. Vérifie un **expéditeur** (Senders) — l'adresse depuis laquelle les emails seront envoyés. `latermitiere2021@gmail.com` peut être vérifiée directement (Brevo envoie un lien de confirmation à cette adresse).
3. Va dans **SMTP & API** → **API Keys** → crée une nouvelle clé, note-la (elle ne s'affiche qu'une fois).

## 2. Lancer le conteneur

```bash
docker build -t termitiere-contact-proxy .
docker run -d \
  --name termitiere-contact-proxy \
  -p 8081:8081 \
  -e BREVO_API_KEY=xxxxxxxx \
  -e BREVO_SENDER_EMAIL=latermitiere2021@gmail.com \
  -e ALLOWED_ORIGIN=https://latermitiere.com \
  termitiere-contact-proxy
```

Expose-le en HTTPS via le reverse proxy, par exemple sur `https://contact.latermitiere.com`.

## 3. Mettre à jour les adresses par secteur

Le fichier `sector-emails.json` contient l'adresse de destination pour chaque secteur. Actuellement tout pointe vers `latermitiere2021@gmail.com` (le mail du siège). Dès qu'une adresse dédiée à un secteur est créée, remplace la valeur correspondante dans ce fichier et relance le conteneur — pas besoin de toucher au code.

## 4. Vérifier

`GET /health` doit répondre `ok`.

## Note

Une fois ce service en ligne, le code du site (`site2/js/main.js`) doit être mis à jour pour pointer vers `https://contact.latermitiere.com/contact` au lieu de Formspree — Claude s'en charge dès que l'URL du service est confirmée.
