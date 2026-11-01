# Pixel Studio

**Ton rush + ton texte = ton reel.** Tu déposes une vidéo (un plan de bureau, ton écran, n'importe quel rush), tu écris un écran par ligne, et Pixel Studio sort un reel vertical 1080×1920, avec texte animé, effets et transitions. Pas de logiciel de montage, pas de timeline.

![Effets de Pixel Studio](examples/effets.jpg)

Créé par [Selim · Pixel by Sel](https://pixelbysel.com) ([@pixel.bysel](https://instagram.com/pixel.bysel)) pour monter ses reels sans voix. Gratuit et open source (licence MIT).

## Comment ça marche

1. Ton texte devient une page web animée (HTML + CSS).
2. [Playwright](https://playwright.dev) ouvre cette page et la filme image par image, 30 fois par seconde, avec un fond transparent.
3. [ffmpeg](https://ffmpeg.org) recadre ton rush en 9:16, ajoute un léger mouvement de caméra et colle le texte par-dessus.

Tout tourne sur ton ordinateur : ta vidéo n'est envoyée nulle part.

## Installation

Il te faut **Node.js 18 ou plus** et **ffmpeg**.

| Système | ffmpeg |
|---|---|
| Mac | `brew install ffmpeg` |
| Windows | `winget install ffmpeg` |
| Linux | `sudo apt install ffmpeg` |

Puis, dans un terminal :

```bash
git clone https://github.com/PixelBySel/pixel-studio.git
cd pixel-studio
npm install
npm run setup     # télécharge le navigateur utilisé pour filmer (une seule fois)
npm start
```

Ouvre ensuite **http://localhost:4321**.

![Interface de Pixel Studio](examples/interface.png)

## Écrire ses écrans

Un écran par ligne. La première ligne est l'accroche.

| Syntaxe | Effet |
|---|---|
| `*mot*` | le mot passe en couleur (et en italique avec les polices à empattement) |
| `Titre \| sous-titre` | un titre et une phrase en dessous |
| ` / ` | retour à la ligne |
| `;` | sépare les éléments d'une liste, d'un mur ou d'une conversation |

### Effets

Ajoute le nom de l'effet entre crochets au début de la ligne (ou clique sur les boutons sous la zone de texte).

| Effet | Exemple |
|---|---|
| `[verre]` carte en verre | `[verre] Pas de *template.* \| Ton style, pas celui de tout le monde.` |
| `[liste]` liste qui se coche | `[liste] Les *3 réglages.* \| Une vraie police ; Une seule couleur ; Tes photos` |
| `[mur]` mur de titres | `[mur] Police ; *Couleur* ; Photos ; *Espace*` |
| `[chiffre]` chiffre qui monte | `[chiffre] 7 \| effets, une ligne de texte chacun.` |
| `[tel]` conversation dans un téléphone | `[tel] Il répond *en DM.* \| Tu fais comment ? ; Commente GUIDE ; Merci !` |
| `[magazine]` couverture de magazine | `[magazine] Le site qui *te ressemble.* \| Édition spéciale` |
| `[code]` commandes qui s'écrivent | `[code] Une *commande.* \| npm start ; ouvre localhost:4321` |

Sans effet, l'écran affiche un titre et son sous-titre.

### Réglages

- **Police** : Éditorial (Instrument Serif), Fraunces, Magazine (DM Serif), Bricolage, Grotesk (Space Grotesk), Syne.
- **Couleur** d'accent, **transition** (fondu, glissé, zoom), **mouvement du rush** (zoom avant, recul, zoom à chaque écran, fixe), **cadrage** (gauche, centre, droite).
- **Lecture** : 3 à 6 secondes par écran. Compte 4 s pour qu'on ait le temps de lire.
- **Mot-clé de fin** : ajoute un écran « Commente MOT-CLÉ ». Laisse vide pour ne pas en avoir.
- **Ta signature** : le nom affiché en haut des écrans et ton @. Les valeurs par défaut sont dans `studio.config.json`.

Le MP4 sort dans le dossier `out/`. Il a une piste audio vide : ajoute ta musique dans Instagram ou TikTok au moment de publier.

## Bon à savoir

- Le rendu prend environ 1 à 3 minutes pour un reel de 30 s, selon ton ordinateur.
- Si ton rush est plus court que le reel, il est légèrement ralenti pour couvrir toute la durée.
- Le gabarit vidéo est dans `public/template.html` : c'est du HTML et du CSS, tu peux le modifier (ou demander à Claude Code de le faire) pour créer tes propres effets.

## Licence

Code sous licence [MIT](LICENSE). Les polices incluses sont sous licence SIL Open Font License 1.1 (voir [public/fonts](public/fonts/LISEZMOI-POLICES.md)).
