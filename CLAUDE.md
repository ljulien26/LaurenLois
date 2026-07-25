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
Tout est pensé dans un espace **design 960×540**. `getContainTransform(imgW,imgH,vw,vh)` → {scale,dx,dy,dw,dh}. `drawBackgroundContain`, `drawBackgroundCover` (plein écran, recadré). `uiSizeFactor()` = 1 sur écran ≥1280×720 (ordi), <1 sur petit écran (réduit l'UI proportionnellement).

## Machine à scènes (variable globale `scene`)
`premenu → tvOn → blackout → menu → place → place2 → place3 → place4 → place5 → catgame → place7 → fireworks`
Départ normal : `let scene = 'premenu'` (core.js). Chaque scène a sa fonction `drawXScene` dans son fichier.
Le jeu démarre bien **au tout début** (`premenu`) : plus aucun forçage de scène dans main.js.

| Scène | Fichier | Lieu / contenu |
|---|---|---|
| premenu | premenu*.js | Loïs (bot) puis Lauren appuient sur les boutons ; télé qui flashe ; son d'activation |
| menu | menu.js | Titre + bouton « Démarrer l'aventure » (musique Take on Me) |
| place | place.js + lock.js | Décor 1 : portail, **cadenas** à combinaison (6 molettes) + indices + bouton Valider |
| place2 | place2.js | Décor 2 : café BlasTodice, question QCM |
| place3 | place3.js | Décor 3 : Saint-Sernin, **tickets à gratter** (ticket tombe du ciel) |
| place4 | place4.js | Décor 4 : Cinéma Pathé façade, **3 portes = 3 séances** (affiches cliquables → grand format), on entre par la porte de son choix |
| place5 | place5.js | Décor 5 : Cinéma intérieur, question **libre** (nombre au clavier) + ambiance lumineuse animée |
| catgame | catgame.js | Décor 6 : Grande Roue. Question (Lauren/Loïs) puis mini-jeu : rattraper 30 chatons au panier |
| place7 | place7.js | Décor 7 : Les Halles de la Cartoucherie. **Jeu de puzzle** (30 pièces, réserve + glisser-déposer, modèle sur « Aide ») |
| fireworks | fireworks.js | Décor 8 (**écran final**) : bord de Garonne. **Arrivée du couple** (non jouable) + transition jour→coucher→nuit, **feu d'artifice** procédural, message « Bon anniversaire », **photos souvenir**, musique, « Fin… » |

Ordre habituel d'une scène : entrée en marchant → jouable → trigger (position) → question/interaction → `fillBlack` fondu → scène suivante.

## Fichiers clés & helpers partagés (à réutiliser, NE PAS redupliquer)
- **core.js** : canvas/`ctx`, `resize`, boucle `loop` (dispatch par `scene`), `loadImage`/`loadImageOptional`, `uiSizeFactor`, **pointeur global** (`getPointerPos`, `pointerPos` MAJ en continu), **clavier** (`keyDirection`, `drawKeyboardMoveHint`), **fondus** (`fillBlack(alpha)`, `drawSceneFadeIn(elapsed,dur)`), **repères de décor** (`getContainTransform`, `getCoverTransform` pour les fonds en « cover »), **musique de fond des décors 1→7** (`gameMusic` + `updateGameMusic(dt)` appelé dans `loop` : boucle unique pour `place…place7`, fondu à l'entrée/sortie, **pas** sur l'écran final qui a la sienne), **déblocage audio** (`registerAudioForUnlock`, `unlockAudio`, drapeau global **`audioUnlocked`** — le navigateur refuse tout son avant le 1er geste : une scène qui doit être sonore peut l'attendre), **sons** (`playCorrectSound`, `playWrongSound`, `playClickSound`, `playNotifSound`, `keyboardSound`/`setKeyboardTyping`), **questions machine à écrire** (`drawTypingQuestion`, `questionCharsShown`, `questionTypingDone`, `answersTyping`, `drawAnswerPill`, `drawTypedAnswerPill`, `firstQuestionFontPx`, `wrapPixelQuestion`, `wrapTextAtFont`), **survol des réponses** (`answerHoverRect(r)` → grossit ~7 % la pastille survolée, `ANSWER_HOVER_SCALE`), `roundRectPath`, `isInsideRect`. **DEBUG Maj+3/4/5/6/7**.
- **character.js** : `createCharacter`, `updateCharacter` (marche auto vers `targetX`), **`stepPlayerWalk(c,dir,dt,minX,maxX)`** (déplacement clavier mutualisé), `drawCharacter(c,idle,walk,containT,press,anchorY)`, `characterWalkTo`. `CHARACTER_WALK_SPEED=112`, `CHARACTER_WALK_FRAME_DURATION=90`.
- **premenu-sound.js** : `updateWalkSound`, `playButtonSound`, `playActivationSound`, musique premenu.
- **lock.js** : cadenas complet. Titre « Trouve le code du cadenas. », **bouton Valider** (seul déclencheur : pas d'auto-déverrouillage ni d'erreur au temps ; `000000` ne déclenche jamais d'erreur), **tick de molette** au passage d'un chiffre (son `10.CadenasMolette.wav`) : **UN SEUL tick à la fois**, un clip unique relancé à chaque passage (jamais de ticks superposés) + hystérésis `LOCK_TICK_HYSTERESIS` pour n'en jouer **qu'un par chiffre**, flash vert/rouge, indices. `drawPill` (boutons du cadenas) grossit au survol comme les réponses.
- **place7.js** : puzzle. Grille `PUZZLE_COLS×PUZZLE_ROWS` (**5×6 = 30 pièces**). Le **plateau démarre vide** ; les pièces sont dans une **réserve (bac) à droite** et se **glissent** sur les cases (réserve↔plateau et case↔case ; case occupée → l'ancienne pièce est évincée). Le **modèle est caché** et n'apparaît qu'en cliquant sur le bouton **« Aide »**. Résolu (réserve vide + toutes les cases bonnes) → « Bravo ! » → `fireworks`.
- **fireworks.js** : écran final (voir « Contenu »). Feux **procéduraux** (particules additives), fonds `assets.place8`, photos `assets.finalPhotos`, sons `fwMusic`/`fwFireSound`, message « Bon anniversaire » **écrit en particules**. **Bloc « arrivée du couple »** en tête du fichier : `fwLois`/`fwLauren`, `fwUpdateCouple`/`fwDrawCouple`, lecteur de séquence mutualisé (`fwStepSequence`, `fwDrawCoupleSprite`). Repère décor via `getCoverTransform` (le fond est en **cover**), sol `FW_GROUND_Y=512`, centre `FW_COUPLE_X=480`, échelles `FW_LAUREN_SCALE=0.86` / `FW_LOIS_SCALE=1.0` / `FW_CLL_SCALE=1.03`. **Bruit de pas** (`updateWalkSound`) appelé à chaque image pendant l'arrivée. ⚠️ Le navigateur interdit tout son avant un geste utilisateur : tant que `audioUnlocked` est faux, la scène est **gelée** sur « Clique pour commencer » (`fwDrawWaitForAudio`, `startTime=null`) pour que l'arrivée ne soit jamais muette — invisible en jeu normal (audio débloqué au pré-menu).
- **main.js** : `Promise.all` de tous les `loadImage`, construit l'objet `assets`, charge les 12 photos à part, lance la boucle.

Convention : commentaires **en français**, style/idiome du code environnant, police pixel **PressStart2P** pour l'UI.

## Contrôles
- Déplacement de Lauren : **flèches ← →** (aussi A/Q/D pour AZERTY/QWERTY) via `keyDirection`.
- **Souris** : clic sur les objets (cadenas, ticket, porte, panier) et les réponses ; **glisser-déposer** des pièces (place7) ; **tapoter** (fireworks). Curseur « main »/`grab` au survol de tout élément cliquable **quand l'action est possible**.
- Questions : la question **s'écrit** caractère par caractère (son clavier), puis les réponses apparaissent **une à une** ; elles **grossissent au survol** (`answerHoverRect`). Clic réponse → **son de clic** + **son correct/faux**. Police **uniforme** (`firstQuestionFontPx`).

## Réponses / contenu (pour référence)
- Cadenas (place) : code **`[3,0,0,3,2,4]`** (30/03/24). `HINTS = ['JJMMAA','1ère rencontre','30/XX/XX']`, seuils `[3,5,7]` mauvais essais (une **validation ratée** = 1 essai). Indice + notif **différés à la fin du son « faux »**.
- Café (place2) : → **Le blastodice** (index 0).
- Saint-Sernin (place3) : → **Heureux gagnants** (ticket VRAI). Écran de réussite « **Bravo !** ». Lauren `SCALE=0.8907`.
- Cinéma façade (place4) : **3 séances**, une par porte — gauche **Heureux gagnants**, centre **F1**, droite **Materialists** (les 4 affiches d'un groupe sont déjà dans le décor `4.png`). Les **3 portes ont le même halo, même intensité** (centres `209 / 483 / 759`, milieu `385` ; seule la mention « Entrer » s'ajoute sur la porte à portée, `PLACE4_DOOR_REACH=120`) ; **bouton « Aide » en haut à droite** (même style que celui du puzzle) qui ouvre la consigne à la place du bandeau « Choisis ta séance » ; **cliquer un bandeau d'affiches** (`PLACE4_DOORS[i].posters`) l'ouvre **en grand** (clic pour refermer). Entrer par une porte enregistre le choix dans **`place4Choice`** (0/1/2) → place5. ⏳ **À venir** : la question « quand avons-nous vu ce film ? » (dates par film, pas encore fournies) et ce qui change dans la salle selon `place4Choice`.
- Cinéma nombre (place5) : **35** (±5). « **Bravo !** » + révèle le chiffre exact (affiché `PLACE5_WIN_MS=3900`).
- Chatons (catgame) : « Qui est le plus un mimi kely ? » → **Lauren**. Puis **30 chatons en 37 s** (`CAT_DURATION`), chutes 155–240 px/s. Panier au sol = **asset `Panier.png`** avec **tête de chat qui dépasse** (région tête de `Chat 1.png`, `drawCatBasketObject`, `CAT_BASKET_DISPLAY_W≈69.6`) + halo qui orbite. Miaou volume `0.14`. Échec → « Dommage / Réessayer ».
- Puzzle (place7) : photo `Puzzle/1.png` en **5×6 (30 pièces)**, plateau vide + **réserve** à droite, glisser-déposer, modèle sur **« Aide »**. Résolu → « Bravo ! » → fireworks.
- Écran final (fireworks) : **phase `arrivee` (non jouable)** — transition jour→coucher→nuit (`place8` = `Places/8/1-3.png` ; `FW_DAY_HOLD=0,8 s`, `FW_FADE=3 s`, `FW_SUNSET_HOLD=1 s` → **nuit en place vers 7,8 s**, juste après l'étreinte ; fondus adoucis en smoothstep) pendant que **Loïs entre par la gauche et Lauren par la droite en même temps** (départ à `FW_COUPLE_START=0,7 s`, ~5 s de marche **avec le bruit de pas**), s'arrêtent **l'un contre l'autre** — ils marchent **directement** jusqu'à l'écart de l'étreinte (`FW_COUPLE_GAP=40`, mesuré sur le sprite CLL) et l'**étreinte** `CLL1→CLL4` enchaîne **aussitôt**, sans pose intermédiaire (les `Côté/Calin.png` ne servent plus que de pose d'arrêt, jamais affichée), en **fondu enchaîné** entre images (`FW_SEQ_FRAME=420 ms`, `FW_SEQ_BLEND=260 ms`, via `fwStepSequence`) ; sur **CLL4** ils restent enlacés avec de **petits cœurs pixel** qui s'envolent → phase **charge** « Clic, clic, clic ! » (`FW_TAP_GOAL=12`, **son de clic seulement pendant la charge**), déclenchée quand la **nuit est tombée ET l'étreinte finie** (**pas d'écran noir** entre les deux) → **une fois le feu DÉCLENCHÉ** (jauge pleine, dans `fwStartShow`), `fwCoupleWatch()` enchaîne **CLL4 → TLL1…TLL4** (mêmes fondus, retournement fini juste quand les fusées partent) : ils restent **de dos, main dans la main**, immobiles jusqu'à la fin. **Toutes les poses du couple sont ramenées à la même taille apparente** (`FW_SPRITE_REF_H=102` + tables de cadrage mesurées `FW_CLL_BOX`/`FW_TLL_BOX`, TLL4 étant plus haut que les autres). Puis **spectacle** : `fwMusic` (**Every Breath You Take**) + `fwFireSound` (**11.Firework**, boucle) lancées ensemble après `FW_FIRE_DELAY=1.8 s` → **« Bon anniversaire ! »** en particules (`FW_MSG_AT=6 s`, durée `FW_MSG_DUR=6.5 s`) → **12 photos** (`finalPhotos`, mélangées, **chacune une fois**, zones réparties, `FW_PHOTO_SPAWN=5.2 s`, vie ~11–13 s → séquence photos ≈ **69 s**, +13 s par rapport à avant) → après la dernière + `FW_END_DELAY=3.5 s` → **« Fin… »** : les **feux continuent de partir pendant tout le fondu noir** (`fwAutoVolley` aussi en phase `end`) et le **bruit des feux baisse au même rythme que l'image** (`FW_FIRE_VOLUME × (1−k)`) ; musique à fond ~3.5 s puis fondu 4.5 s. Volumes : `fwMusic 0.5`, `FW_FIRE_VOLUME 0.3`.

## Assets
`Assets/Jeu/Places/1-7.png` (décors 960×540) ; `Places/8/1-3.png` (final jour/coucher/nuit) ; `Cadenas/`, `Ticket/1.png`, `Chat/Chat 1-3.png`, `Quiz/Boutons/`, `Panier/Panier.png`, `Puzzle/1.png`, `Bouton Suite/1.png`, `AffichesCinema/{HeureuxGagnants,F1,Materialist}.png` (**haute résolution**, pour le grand format du décor 4 → `assets.affiches[0..2]`). `Assets/Persos/Lauren|Loïs/Côté/{Idle,Walk,Activer le bouton,Calin.png}`, `Lauren/Côté/WalkPanier/26-29.png`, `Assets/Persos/CLL1-4.png` (**couple enlacé**, écran final) et `TLL1-4.png` (**retournement + couple de dos main dans la main**, écran final). Sons `Assets/Sound/1.Walking … 9.Click.mp3`, `10.CadenasMolette.wav`, `11.Firework.mp3`, `Chat/Miaou.mp3`, `Générique/` (Take on Me = menu ; **`maksymmalko-gaming-game-minecraft-background-music-372242.mp3` = musique de fond des décors 1→7, en boucle** ; Every Breath You Take = écran final ; copyright — le dev a choisi de les pousser). `Assets/Photo Fin de Jeu/1-12.png` (**utilisées** dans l'écran final).

## Vérification (je ne vois pas le navigateur)
Pour valider une **mise en page/position** statique, composer une image de contrôle via **.NET System.Drawing en PowerShell** (charger le PNG, dessiner/composer, sauver dans le scratchpad, puis `Read` l'image). Ex. déjà fait : cadrage de la tête du chat dans le panier, étoiles de place5, molettes du cadenas.

## Divers
- **DEBUG (à retirer pour la version finale)** : **Maj+3/4/5/6/7** sautent à place3/place4/place5/catgame/place7 (désactivé pendant la saisie du nombre en place5, car sur AZERTY les chiffres se tapent avec Maj). Le **démarrage forcé de main.js a été retiré** : le jeu repart toujours de `premenu`.
- Le jeu est **desktop-only** ; `manifest.json`/`sw.js` inoffensifs.
- Flux complet OK : `place → place2 → place3 → place4 → place5 → catgame → place7 → fireworks` (transition catgame→place7 ajoutée ; l'ancien écran « À suivre… » est retiré).
- **TODO** : retirer les raccourcis DEBUG Maj+3…7 et le démarrage forcé pour la version cadeau finale.
