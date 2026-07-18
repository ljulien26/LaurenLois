// ============================================================
// Scène PreMenu : écran noir, "Touchez l'écran pour commencer". Au premier
// tap, l'écran s'allume et Loïs (bleu) arrive automatiquement depuis la
// gauche et active son bouton (bot). Une fois cela fait, Lauren (rose)
// entre en marchant depuis la droite : le joueur la déplace avec les deux
// boutons fléchés affichés en bas de l'écran, puis clique sur le bouton rose
// (une fois Lauren assez proche) pour qu'elle l'active elle-même. La télé
// s'allume alors (voir premenu-tv.js) et un fondu au noir mène au Menu.
//
// Dépend de : character.js (système générique de personnage), premenu-sound.js
// (sons), premenu-buttons.js (boutons bleu/rose), premenu-tv.js (télé et
// scènes de transition).
// ============================================================

function getPreMenuContainT(assets) {
  return getContainTransform(
    assets.preMenuFond.width, assets.preMenuFond.height,
    window.innerWidth, window.innerHeight
  );
}

// Distance (en unités Fond.png) à l'intérieur du bouton jusqu'où un
// personnage peut avancer avant de s'arrêter : même pourcentage pour les deux.
const BUTTON_PENETRATION_RATIO = 0.1;
const PRESS_DURATION = 360; // ms : le bouton reste "enfoncé" avant de s'activer

// Loïs : sprite natif tourné vers la droite. Entre depuis hors-écran à
// gauche (en deçà de x=0, donc invisible au départ) et marche automatiquement,
// sans s'arrêter, jusqu'à son bouton (bleu), comme un bot.
const LOIS_VISIBLE_WIDTH_RATIO = 34 / 96;
const LOIS_OFFSCREEN_START_X = -87;
const LOIS_SCALE = 1.177; // 1.1 + 7 %
const lois = createCharacter(LOIS_OFFSCREEN_START_X, 'right', LOIS_VISIBLE_WIDTH_RATIO, 4, LOIS_SCALE, 2);
const LOIS_TARGET_X = preMenuButtons.bleu.anchorX
  - BUTTON_DISPLAY_W_FOND * (0.5 - BUTTON_PENETRATION_RATIO)
  - characterHalfWidth(lois);

// Lauren : sprite natif tourné vers la gauche. Entre en marchant depuis
// hors-écran à droite jusqu'à LAUREN_READY_X (le joueur ne peut pas interférer
// pendant cette entrée) : à partir de là, c'est à lui de la faire avancer
// jusqu'à son bouton, puis de cliquer sur le bouton pour qu'elle appuie
// dessus (le simple contact ne déclenche rien, et elle doit lui faire face).
const LAUREN_VISIBLE_WIDTH_RATIO = 38 / 96;
const LAUREN_OFFSCREEN_START_X = 1047;
const LAUREN_READY_X = 907; // aussi la limite droite pour les déplacements contrôlés par le joueur
const LAUREN_SCALE = 1.0088; // 0.97 + 4 %
const lauren = createCharacter(LAUREN_OFFSCREEN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, LAUREN_SCALE, 2);
// Lauren approche par la droite : LAUREN_TARGET_X est la limite GAUCHE (la plus
// petite valeur de x) qu'elle peut atteindre, pas une limite haute.
const LAUREN_TARGET_X = preMenuButtons.rose.anchorX
  + BUTTON_DISPLAY_W_FOND * (0.5 - BUTTON_PENETRATION_RATIO)
  + characterHalfWidth(lauren);
// Marge (en unités Fond.png) au-delà de sa position d'arrêt dans laquelle un
// clic sur le bouton compte encore : au-delà, elle est trop loin pour appuyer.
const LAUREN_PRESS_REACH = 30;

// Assets de la scène, mémorisés pour que les gestionnaires de clic puissent
// calculer la position écran des boutons hors de la boucle de rendu.
let preMenuAssets = null;

// Dessine Loïs puis Lauren, avec leurs frames d'appui respectives. Utilisé
// par la scène PreMenu et par les scènes de transition (premenu-tv.js).
function drawBothCharacters(assets, containT) {
  drawCharacter(lois, assets.loisIdle, assets.loisWalk, containT, assets.loisPress);
  drawCharacter(lauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress);
}

// ---------- Contrôle de Lauren par le joueur (clavier) ----------
// Une fois arrivée, Lauren n'est pas un bot : les flèches ← → du clavier la
// font marcher (relâcher la touche l'arrête net). Rien ne se déclenche tant
// que le joueur n'appuie pas sur une touche.

function isInsideCircle(pos, circle) {
  const dx = pos.x - circle.cx;
  const dy = pos.y - circle.cy;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function updateLaurenControlled(dt) {
  const dir = keyDirection();

  if (dir === 0) {
    lauren.walking = false;
    lauren.frameIndex = 0;
    lauren.frameElapsed = 0;
    return;
  }

  const nextX = lauren.x + dir * CHARACTER_WALK_SPEED * dt;
  const clampedX = Math.max(LAUREN_TARGET_X, Math.min(LAUREN_READY_X, nextX));

  // Bloquée contre une limite (bord d'écran ou bouton) : pas de vrai
  // déplacement, donc pas de marche ni de bruit de pas, même si une flèche
  // reste maintenue.
  if (clampedX === lauren.x) {
    lauren.walking = false;
    lauren.frameIndex = 0;
    lauren.frameElapsed = 0;
    return;
  }

  lauren.facing = dir < 0 ? 'left' : 'right';
  lauren.x = clampedX;
  lauren.walking = true;

  lauren.frameElapsed += dt * 1000;
  while (lauren.frameElapsed >= CHARACTER_WALK_FRAME_DURATION) {
    lauren.frameElapsed -= CHARACTER_WALK_FRAME_DURATION;
    lauren.frameIndex = (lauren.frameIndex + 1) % lauren.walkFrameCount;
  }
}

// ---------- Orchestration : bot Loïs, puis entrée et tour du joueur avec Lauren ----------

const STAGE_WAITING_TO_START = 'waitingToStart';
const STAGE_ABOUT_TO_START = 'aboutToStart';
const STAGE_LOIS_WALKING = 'loisWalking';
const STAGE_LOIS_PRESSING = 'loisPressing';
const STAGE_LAUREN_ENTERING = 'laurenEntering';
const STAGE_LAUREN_CONTROLLABLE = 'laurenControllable';
const STAGE_LAUREN_PRESSING = 'laurenPressing';
const STAGE_DONE = 'done';

// On attend un premier tap (nécessaire pour débloquer le son) avant que
// l'écran s'allume et que Loïs ne parte automatiquement vers son bouton.
let preMenuStage = STAGE_WAITING_TO_START;
let pressTimer = 0;
let lightUpStartTime = null; // instant (performance.now()) du premier tap, pour le fondu depuis le noir
const LIGHT_UP_DURATION = 500;
let loisStartTimer = 0;
const LOIS_START_DELAY = 1700; // ms : petite pause après l'allumage avant que Loïs n'arrive

function updatePreMenuActors(dt) {
  updateCharacter(lois, dt);
  updatePressAnimation(lois, dt);
  updatePressAnimation(lauren, dt);

  if (preMenuStage === STAGE_LAUREN_CONTROLLABLE) {
    updateLaurenControlled(dt);
  } else {
    updateCharacter(lauren, dt);
  }

  updateWalkSound(dt, lois.walking || lauren.walking);

  switch (preMenuStage) {
    case STAGE_ABOUT_TO_START:
      loisStartTimer += dt * 1000;
      if (loisStartTimer >= LOIS_START_DELAY) {
        characterWalkTo(lois, LOIS_TARGET_X);
        preMenuStage = STAGE_LOIS_WALKING;
      }
      break;

    case STAGE_LOIS_WALKING:
      if (!lois.walking) {
        preMenuButtons.bleu.state = 'pressed';
        playButtonSound();
        startPressing(lois);
        pressTimer = 0;
        preMenuStage = STAGE_LOIS_PRESSING;
      }
      break;

    case STAGE_LOIS_PRESSING:
      pressTimer += dt * 1000;
      if (pressTimer >= PRESS_DURATION) {
        preMenuButtons.bleu.state = 'activated';
        stopPressing(lois);
        // Lauren entre en marchant depuis hors-écran à droite ; le joueur ne
        // prend la main qu'une fois qu'elle est arrivée.
        characterWalkTo(lauren, LAUREN_READY_X);
        preMenuStage = STAGE_LAUREN_ENTERING;
      }
      break;

    case STAGE_LAUREN_ENTERING:
      if (!lauren.walking) {
        preMenuStage = STAGE_LAUREN_CONTROLLABLE;
      }
      break;

    case STAGE_LAUREN_PRESSING:
      pressTimer += dt * 1000;
      if (pressTimer >= PRESS_DURATION) {
        preMenuButtons.rose.state = 'activated';
        stopPressing(lauren);
        // Les 2 boutons sont désormais activés : joue le son d'activation,
        // la télé s'allume et flashe pendant toute sa durée.
        playActivationSound();
        preMenuStage = STAGE_DONE;
        scene = 'tvOn';
        startTime = null;
      }
      break;

    // STAGE_WAITING_TO_START : on attend le premier tap.
    // STAGE_LAUREN_CONTROLLABLE : on attend que le joueur amène Lauren près du
    // bouton puis clique dessus (voir handlePreMenuDown).
  }
}

// Premier tap : débloque le son et allume l'écran ; Loïs (bot) arrive un peu
// plus tard (STAGE_ABOUT_TO_START). Ensuite, tant que Lauren est contrôlable,
// un doigt maintenu sur l'un des deux boutons fléchés la fait marcher dans
// cette direction (le relâcher l'arrête), et un clic sur le bouton rose la
// fait appuyer dessus — à condition qu'elle soit assez proche.
function handlePreMenuDown(evt) {
  if (preMenuStage === STAGE_WAITING_TO_START) {
    unlockAudio();
    startPreMenuMusic();
    lightUpStartTime = performance.now();
    loisStartTimer = 0;
    preMenuStage = STAGE_ABOUT_TO_START;
    return;
  }

  if (preMenuStage !== STAGE_LAUREN_CONTROLLABLE) return;

  const pos = getPointerPos(evt);

  // Clic sur le bouton rose : il faut que Lauren soit venue assez près ET
  // qu'elle regarde vers le bouton (à sa gauche). Dos tourné, elle ne peut
  // pas appuyer : au joueur de la réorienter avec la flèche gauche.
  const containT = getPreMenuContainT(preMenuAssets);
  const roseCircle = getPreMenuButtonCircle(preMenuButtons.rose, containT);
  const isNearRose = lauren.x <= LAUREN_TARGET_X + LAUREN_PRESS_REACH;
  const facesRose = lauren.facing === 'left';

  if (isInsideCircle(pos, roseCircle) && isNearRose && facesRose) {
    preMenuButtons.rose.state = 'pressed';
    playButtonSound();
    startPressing(lauren);
    pressTimer = 0;
    preMenuStage = STAGE_LAUREN_PRESSING;
  }
}

canvas.addEventListener('pointerdown', (evt) => {
  if (scene === 'premenu') handlePreMenuDown(evt);
});

// Invite discrète, affichée uniquement tant qu'on attend le premier tap
// (nécessaire pour débloquer le son avant de démarrer la séquence).
function drawTapToStartHint() {
  const pulse = 0.55 + Math.sin(performance.now() / 500) * 0.35;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(window.innerHeight * 0.028)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Cliquez pour commencer', window.innerWidth / 2, window.innerHeight / 2);
  ctx.restore();
}

// Fondu depuis le noir juste après le premier tap : la scène "s'allume"
// pendant que Loïs entre déjà dans le champ.
function drawLightUpOverlay() {
  if (lightUpStartTime === null) return;
  const elapsed = performance.now() - lightUpStartTime;
  if (elapsed >= LIGHT_UP_DURATION) {
    lightUpStartTime = null;
    return;
  }
  ctx.save();
  ctx.globalAlpha = 1 - elapsed / LIGHT_UP_DURATION;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.restore();
}

function drawPreMenuScene(assets, dt) {
  preMenuAssets = assets;

  if (preMenuStage === STAGE_WAITING_TO_START) {
    // Écran totalement noir tant que le joueur n'a pas touché l'écran.
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
    drawTapToStartHint();
    return;
  }

  const containT = getPreMenuContainT(assets);
  drawBackgroundContain(assets.preMenuFond, containT);
  drawIdleTv(assets, containT);
  drawBothPreMenuButtons(containT);
  updatePreMenuActors(dt);
  drawBothCharacters(assets, containT);
  if (preMenuStage === STAGE_LAUREN_CONTROLLABLE) {
    drawKeyboardMoveHint();
  }
  drawLightUpOverlay();
}
