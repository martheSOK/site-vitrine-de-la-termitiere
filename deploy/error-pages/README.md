# Page d'erreur 502/503 (site indisponible)

Cette page (`503.html`) est une page statique, autonome (aucune dependance
externe), a afficher par le reverse proxy (Caddy) quand aucun service
n'est joignable — plutot que la page d'erreur brute par defaut du
navigateur/proxy.

## A faire cote Caddy (VPS)

Monter ce fichier dans le conteneur/volume de Caddy, puis ajouter dans le
bloc du site concerne :

```
handle_errors {
    @maintenance expression {http.error.status_code} in [502, 503, 504]
    rewrite @maintenance /503.html
    file_server
    root * /path/vers/error-pages
}
```

(adapter `/path/vers/error-pages` a l'emplacement reel choisi sur le VPS)
