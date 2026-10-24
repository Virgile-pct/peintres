# Ex-libris, la bibliothèque de la maison

Une petite application pour gérer une bibliothèque personnelle : on scanne le code-barres
d'un livre, elle retrouve le titre, l'auteur, la couverture, la série et le prix, puis elle
le range sur la bonne étagère.

Aucune installation, aucun compte, aucun abonnement : ce sont des fichiers qu'on ouvre dans
Edge ou Chrome. Les livres restent sur l'ordinateur.

## Installer sur l'ordinateur de maman

Méthode conseillée : la version en ligne, installée comme une application.

1. Ouvrir **Microsoft Edge** à l'adresse https://virgile-pct.github.io/peintres/ex-libris/
2. Menu `…` > Applications > « Installer ce site en tant qu'application », nom « Ex-libris ».
   Accepter l'épinglage à la barre des tâches et au menu Démarrer.
3. Dans l'appli, page **Sauvegarde** : écrire le nom de la bibliothèque, puis
   « Choisir le fichier de sauvegarde » et enregistrer `ma-bibliotheque.json` dans
   OneDrive > Documents. Si Edge demande l'accès, « Autoriser » (et « à chaque visite » si proposé).
4. Brancher la douchette et scanner un livre dans « Ajouter des livres » pour vérifier.

Après un redémarrage, Edge peut redemander l'accès au fichier : un clic sur
« Reprendre la sauvegarde » en haut à droite suffit.

Sans Internet à demeure, on peut aussi copier ce dossier sur l'ordinateur et ouvrir
`index.html` avec Edge, mais l'appli ne se mettra plus à jour toute seule. Les livres sont
rangés dans le navigateur, pour une adresse donnée : ne pas mélanger les deux méthodes
(sinon, passer de l'une à l'autre avec « Restaurer une sauvegarde »).

## Sur le téléphone (en librairie)

Ex-libris de poche dit en une seconde si un livre est déjà à la maison : même livre, autre
édition (poche ou grand format), livre de la liste d'envies, tome manquant d'une série.

Adresse : https://virgile-pct.github.io/peintres/ex-libris/poche.html
(la page Sauvegarde de l'ordinateur affiche un QR code qui y mène).

1. La sauvegarde automatique de l'ordinateur doit être dans OneDrive (ou Google Drive), avec
   l'appli OneDrive installée sur le téléphone.
2. Sur le téléphone, ouvrir l'adresse dans Chrome, puis « Installer Ex-libris sur ce téléphone ».
3. Onglet « Mettre à jour » : « Choisir le fichier », puis `ma-bibliotheque.json` dans OneDrive.
   À refaire avant d'aller en librairie pour avoir les derniers achats (la barre du haut
   prévient quand la liste a plus de deux semaines).

Le téléphone ne modifie jamais rien : il lit la liste, c'est l'ordinateur qui fait foi.
La page s'ouvre même sans réseau ; il faut juste du réseau pour vérifier les autres éditions
d'un livre qui n'est pas à la maison.

## Version en ligne pour l'ordinateur

La même adresse sans `poche.html` (https://virgile-pct.github.io/peintres/ex-libris/) ouvre
l'appli de l'ordinateur. L'utiliser plutôt que le fichier `index.html` a deux avantages : l'appli
se met à jour toute seule quand Virgile publie une nouvelle version, et Edge peut l'installer
comme une vraie application. Attention : les livres enregistrés en `file://` et en ligne ne se
voient pas ; pour passer de l'un à l'autre, utiliser « Restaurer une sauvegarde ».

## Publier une nouvelle version

L'appli est publiée dans le dossier `docs/ex-libris` du dépôt GitHub `Virgile-pct/peintres`
(GitHub Pages sert le dossier `docs`, le site des peintres est à côté et n'est pas touché).
Copier les fichiers de ce dossier dans `docs/ex-libris`, puis commit et push. Si un fichier de la
version téléphone change, augmenter le numéro de `CACHE` dans `sw-poche.js` pour que les
téléphones prennent la nouvelle version.

## La douchette

N'importe quelle douchette USB (lecteur de codes-barres « clavier », 15 à 25 €) fonctionne
sans réglage : on la branche, on scanne. Même réglée en clavier américain (elle tape alors
`&é"'(-è_çà` au lieu des chiffres sur un PC français), l'appli remet les chiffres d'aplomb. L'appli reconnaît la rafale de chiffres où que l'on
soit, même sans cliquer dans un champ. La webcam marche aussi, mais elle fait souvent la mise
au point moins bien qu'une douchette.

## D'où viennent les fiches

- Catalogue de la Bibliothèque nationale de France (titre, auteurs, éditeur, collection, série
  et tome, nombre de pages, format en cm, prix, genre).
- Open Library pour les couvertures et les livres étrangers.
- Google Books en option, avec une clé gratuite à coller dans « Sauvegarde ».

## Mettre à jour l'appli

Remplacer les fichiers du dossier par les nouveaux, sans toucher à rien d'autre : les livres
sont dans le navigateur et dans le fichier de sauvegarde, pas dans le dossier. Par prudence,
télécharger une copie (page Sauvegarde) avant.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page, qui charge tout le reste |
| `css/app.css` | L'apparence |
| `js/isbn.js` | Codes-barres : ISBN-13, ancien ISBN-10, clés de contrôle |
| `js/donnees.js` | Base IndexedDB, journal, anti-doublon |
| `js/catalogues.js` | Recherche BnF (UNIMARC), Open Library, Google Books |
| `js/couverture.js` | Couvertures dessinées et dos de livres |
| `js/scanner.js` | Douchette et webcam |
| `js/sauvegarde.js` | Fichier de sauvegarde automatique, exports |
| `js/fiche.js` | Fiche d'un livre (panneau de droite) |
| `js/vues/*.js` | Un fichier par écran |
| `js/app.js` | Navigation et démarrage |
| `poche.html`, `css/poche.css`, `js/poche.js` | Version téléphone pour la librairie |
| `sw-poche.js`, `manifest-poche.webmanifest`, `icones/` | Installation sur le téléphone et marche hors ligne |
