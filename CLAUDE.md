# Lauren & Loïs — jeu (cadeau)

Jeu d'aventure narratif en **HTML5 Canvas 2D + JavaScript vanilla** (aucun
framework). Une suite de décors où **Lauren** (contrôlée au clavier) résout des
énigmes/questions personnelles. Cible : **ordinateur** (clavier + souris).

- Repo : github.com/ljulien26/LaurenLois — GitHub Pages : https://ljulien26.github.io/LaurenLois/
- Ouvrir en local pour tester : `start index.html` (le dev teste dans son navigateur ; je ne peux pas observer le navigateur — voir « Vérification »).

## Lancer / commiter
- `git` est dispo via l'**outil Bash** (pas dans le PATH PowerShell). Identifiants en cache : `git push` marche sans re-auth.
- Après chaque changement : `start index.html` puis commit + push. Terminer les messages de commit par le trailer Co-Authored-By habituel.
- **PowerShell** sert pour le travail d'image (System.Drawing) ; **Bash** pour git / POSIX.

## Espace de coordonnées
Tout est pensé dans un espace **design 960×540**. `getContainTransform(imgW,imgH,vw,vh)` → {scale,dx,dy,dw,dh}. `drawBackgroundContain`, `drawBackgroundCover`. `uiSizeFactor()` = 1 sur écran ≥1280×720 (ordi), <1 sur petit écran (réduit l'UI proportionnellement).

## Machine à scènes (variable globale `scene`)
`premenu → tvOn → blackout → menu → place → place2 → place3 → place4 → place5 → catgame`
Départ : `let scene = 'premenu'` (core.js). Chaque scène a sa fonction `drawXScene` dans son fichier.

| Scène | Fichier | Lieu / contenu |
|---|---|---|
| premenu | premenu*.js | Loïs (bot) puis Lauren appuient sur les boutons ; télé qui flashe ; son d'activation |
| menu | menu.js | Titre + bouton « Démarrer l'aventure » (musique Take on Me) |
| place | place.js + lock.js | Décor 1 : portail, **cadenas** à combinaison (6 molettes) + indices |
| place2 | place2.js | Décor 2 : café BlasTodice, question QCM |
| place3 | place3.js | Décor 3 : Saint-Sernin, **tickets à gratter** (ticket tombe du ciel) |
| place4 | place4.js | Décor 4 : Cinéma Pathé façade, QCM date + entrée par la porte |
| place5 | place5.js | Décor 5 : Cinéma intérieur, question **libre** (nombre au clavier) + ambiance lumineuse animée |
| catgame | catgame.js | Décor 6 : Grande Roue. Question (Lauren/Loïs) puis mini-jeu : rattraper 30 chatons en 40 s au panier |

Ordre habituel d'une scène : entrée en marchant → jouable → trigger (position) → question/interaction → `fillBlack` fondu → scène suivante.

## Fichiers clés & helpers partagés (à réutiliser, NE PAS redupliquer)
- **core.js** : canvas/`ctx`, `resize`, boucle `loop`, `loadImage`/`loadImageOptional`, `uiSizeFactor`, **clavier** (`keyDirection`, `drawKeyboardMoveHint`), **fondus** (`fillBlack(alpha)`, `drawSceneFadeIn(elapsed,dur)`), **déblocage audio** (`registerAudioForUnlock`, `unlockAudio`), **sons** (`playCorrectSound`, `playWrongSound`, `playClickSound`, `playNotifSound`, `keyboardSound`/`setKeyboardTyping`), **questions machine à écrire** (`drawTypingQuestion(panelImg,panel,text,startedAt,manageSound)`, `questionCharsShown`, `questionTypingDone`, `answersTyping`, `drawAnswerPill`, `drawTypedAnswerPill`, `firstQuestionFontPx`, `wrapPixelQuestion`, `wrapTextAtFont`), `roundRectPath`, `isInsideRect`.
- **character.js** : `createCharacter`, `updateCharacter` (marche auto vers `targetX`), **`stepPlayerWalk(c,dir,dt,minX,maxX)`** (déplacement clavier mutualisé : borne/orientation/anim/son de pas), `drawCharacter(c,idle,walk,containT,press,anchorY)`, `characterWalkTo`. `CHARACTER_WALK_SPEED=112`, `CHARACTER_WALK_FRAME_DURATION=90`.
- **premenu-sound.js** : `updateWalkSound`, `playButtonSound`, `playActivationSound`, musique premenu.
- **lock.js** : cadenas complet (molettes, code, flash vert/rouge, indices).
- **main.js** : `Promise.all` de tous les `loadImage`, construit l'objet `assets`, lance la boucle.

Convention : commentaires **en français**, style/idiome du code environnant, police pixel **PressStart2P** pour l'UI.

## Contrôles
- Déplacement de Lauren : **flèches ← →** (aussi A/Q/D pour AZERTY/QWERTY) via `keyDirection`.
- **Souris** : clic sur les objets (cadenas, ticket, porte, panier) et les réponses. Curseur « main » (`canvas.style.cursor='pointer'`) au survol de tout élément cliquable **quand l'action est possible** (ex. Lauren proche).
- Questions : la question **s'écrit** caractère par caractère avec le **son clavier**, puis les réponses apparaissent **une à une**. Clic réponse → **son de clic** + **son correct/faux**. Taille de police **uniforme** partout (`firstQuestionFontPx`).

## Réponses / contenu (pour référence)
- Cadenas (place) : code **`[3,0,0,3,2,4]`** (date 30/03/24, 1ère rencontre). Indices `HINTS = ['JJMMAA','1ère rencontre','(à venir)']` — **3e indice « le mot » à fournir** par le dev. Seuils `[3,5,7]` mauvais essais. Indice + notif **différés à la fin du son « faux »**.
- Café (place2) : « nom du bar 1ère rencontre » → **Le blastodice** (index 0).
- Saint-Sernin (place3) : « 1er film » → **Heureux gagnants** (ticket VRAI).
- Cinéma date (place4) : **6 avril 2024**.
- Cinéma nombre (place5) : **35** (accepté à ±5). Révèle le chiffre exact si bon.
- Chatons (catgame) : « Qui est le plus un mimi kely ? » → **Lauren**. Puis 30 chatons en 40 s (échec → « Dommage / Réessayer »).

## Assets
`Assets/Jeu/Places/1-6.png` (décors, 960×540), `Cadenas/`, `Ticket/1.png`, `Chat/Chat 1-3.png`, `Quiz/Boutons/`. `Assets/Persos/Lauren|Loïs/Côté/{Idle,Walk,Activer le bouton}`, `Lauren/Côté/WalkPanier/26-29.png`. Sons `Assets/Sound/1.Walking … 9.Click.mp3`, `Chat/Miaou.mp3`, `Générique/` (musiques, copyright — le dev a choisi de les pousser). `Assets/Photo Fin de Jeu/1-12.png` (galerie de fin, pas encore utilisée).

## Vérification (je ne vois pas le navigateur)
Pour valider une **mise en page/position** statique, composer une image de contrôle via **.NET System.Drawing en PowerShell** (charger le PNG, dessiner des repères, sauver dans le scratchpad, puis `Read` l'image). Ex. déjà fait : positions des étoiles de place5, alignement des molettes du cadenas.

## Divers
- **DEBUG (à retirer pour la version finale)** : dans core.js, **Maj+3/4/5/6** sautent à place3/place4/place5/catgame. ⚠️ Sur AZERTY les chiffres se tapent avec Maj → ces sauts sont **désactivés pendant la saisie du nombre** (place5) pour ne pas interférer.
- Le jeu a été **désactivé côté « appli téléphone »** (on est passé desktop-only) ; il reste un `manifest.json`/`sw.js` inoffensifs.
- TODO éventuels : 3e indice cadenas (« le mot ») ; vrai sprite « panier + chaton » (actuellement composé en Canvas) ; écran de fin avec les 12 photos.
