# La Termitière — Site vitrine (v2, architecture multi-pages)

## Ce qui a changé par rapport à la version précédente

- **Architecture** : une page d'accueil (`index.html`) avec des **cartes secteurs**
  cliquables, et une **page détail unique** (`service.html`) qui affiche le bon
  contenu selon le secteur cliqué (`service.html?id=sport`, `?id=agro`, etc.).
  Tout le contenu vient d'un seul fichier de données : `js/sector-data.js`.
- **Couleur dédiée par secteur**, déduite de chaque logo :
  - Maxi Gym : orange `#E2810D`
  - Briqueterie : brun brique `#9C5B3C` (pas de logo dédié pour l'instant)
  - Garderie : jaune doré `#E2A400`
  - Maxi Agro : vert `#27A64F`
  - Maxi Bâtiment : bleu plan `#2E4A62`
  - Maxi Logistique : bleu-sarcelle `#0E7C86` (choix libre, pas de charte définie)
  - Couleur de marque (header, footer, accueil) : rouge terracotta `#BD3C2F` + noir,
    d'après le logo principal.
- **Maxi Logistique** apparaît maintenant comme 6ᵉ carte, avec une page « Bientôt
  disponible » simple (juste le logo + un message), en attendant ses informations.

## Modifier le contenu d'un secteur

Tout se passe dans **`js/sector-data.js`** : missions, services, tableaux de
tarifs, horaires, localisation, photos, vidéos. Pas besoin de toucher au HTML —
`service.html` se remplit automatiquement selon le secteur demandé dans l'URL.

Pour ajouter des photos/vidéos à un secteur qui n'en a pas encore (Maxi Bâtiment,
Maxi Logistique) : déposez les fichiers dans `images/<secteur>/photos/` (dossiers
déjà prêts), puis ajoutez leurs noms dans la liste `photos:` du secteur concerné
dans `sector-data.js`.

## Comment voir le site

Ouvrez `index.html` dans votre navigateur pour un premier aperçu.

## Déployer (rappel)

Glissez-déposez le dossier complet sur **https://app.netlify.com/drop** — HTTPS
automatique, aucune ligne de commande. Le formulaire de contact fonctionne dès
le déploiement (voir Site settings → Forms → Form notifications dans Netlify).

## Ce qui n'a pas changé

FAQ, formulaire de contact sécurisé (piège à robots), mode sombre, carrousels
photo du hero et de la section "À propos" — tout est repris et fonctionnel.
