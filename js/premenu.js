// ============================================================
// Scène PreMenu : écran noir, "Touchez l'écran pour commencer". Au premier
// tap, l'écran s'allume et Loïs (bleu) arrive automatiquement depuis la
// gauche et active son bouton (bot). Une fois cela fait, Lauren (rose) entre
// depuis la droite et s'arrête dès qu'elle atteint le bord de l'écran : à
// partir de là, elle répond aux commandes du joueur (maintenir la moitié
// gauche/droite de l'écran pour la faire marcher) jusqu'à activer son
// bouton. La télé s'allume alors et un fondu au noir mène jusqu'au Menu.
// ============================================================

// Boîte commune (englobe idle + enfoncé + activé, glow compris) par couleur,
// utilisée pour les 3 états afin que le bouton ne saute jamais en changeant d'état.
const BUTTON_BLEU_SRC = { x: 249, y: 75, w: 451, h: 377 };
const BUTTON_ROSE_SRC = { x: 254, y: 76, w: 449, h: 388 };

// Points d'ancrage (centre du bouton) en coordonnées de Fond.png (1376x768) :
// repérés par détection de couleur sur les boutons déjà dessinés dans le fond.
const preMenuButtons = {
  bleu: { state: 'idle', anchorX: 631, anchorY: 617, src: BUTTON_BLEU_SRC, scale: 1, images: null },
  rose: { state: 'idle', anchorX: 739, anchorY: 617, src: BUTTON_ROSE_SRC, scale: 1, images: null },
};

// Largeur visée (boîte source complète) en unités Fond.png : calée pour que le
// bouton "idle" du sprite recouvre pile le bouton déjà dessiné dans le fond.
const BUTTON_DISPLAY_W_FOND = 68;

// Rayon (relatif à destW) du disque visible du bouton : sert à masquer
// l'ancien bouton dessiné dans le fond avant de poser le sprite par-dessus.
const BUTTON_MASK_RADIUS_RATIO = 0.45;

function drawPreMenuButton(btn, containT) {
  const destW = BUTTON_DISPLAY_W_FOND * containT.scale * btn.scale;
  const destH = destW * (btn.src.h / btn.src.w);
  const screenX = containT.dx + btn.anchorX * containT.scale;
  const screenY = containT.dy + btn.anchorY * containT.scale;
  const x = screenX - destW / 2;
  const y = screenY - destH / 2;

  // Masque l'ancien bouton dessiné dans le fond avant de poser le sprite
  // (silhouette légèrement plus large que le bouton, par sécurité).
  ctx.save();
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.arc(screenX, screenY, destW * BUTTON_MASK_RADIUS_RATIO, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const img = btn.images[btn.state];
  ctx.drawImage(img, btn.src.x, btn.src.y, btn.src.w, btn.src.h, x, y, destW, destH);
}

function getPreMenuContainT(assets) {
  return getContainTransform(
    assets.preMenuFond.width, assets.preMenuFond.height,
    window.innerWidth, window.innerHeight
  );
}

function drawBothPreMenuButtons(containT) {
  drawPreMenuButton(preMenuButtons.bleu, containT);
  drawPreMenuButton(preMenuButtons.rose, containT);
}

// ---------- Personnages (vue de côté) : marche + idle, réutilisés pour Loïs et Lauren ----------

const CHARACTER_ASPECT = 96 / 128; // dimensions natives (canevas complet) des sprites Côté
const CHARACTER_ANCHOR_Y = 645;    // aligné sur le niveau des boutons (plus de sol dessiné)
const CHARACTER_HEIGHT = 272;
const CHARACTER_WALK_FRAME_DURATION = 90; // ms par frame (~11 img/s), pour une marche fluide
const CHARACTER_WALK_SPEED = 160;         // unités Fond.png (1376x768) par seconde

// Un personnage n'occupe qu'une partie étroite de son canevas 96x128 (marge
// transparente tout autour) : visibleWidthRatio sert à calculer sa vraie
// demi-largeur pour le positionner au bord d'un bouton, pas au bord du canevas.
function createCharacter(startX, nativeFacing, visibleWidthRatio, walkFrameCount, scale = 1) {
  return {
    x: startX,
    facing: nativeFacing,
    nativeFacing,
    visibleWidthRatio,
    walkFrameCount,
    scale,
    targetX: null,
    walking: false,
    frameIndex: 0,
    frameElapsed: 0,
  };
}

function characterHalfWidth(c) {
  return CHARACTER_HEIGHT * c.scale * CHARACTER_ASPECT * c.visibleWidthRatio * 0.5;
}

function characterWalkTo(c, targetX) {
  c.targetX = targetX;
}

function updateCharacter(c, dt) {
  if (c.targetX === null) {
    c.walking = false;
    c.frameIndex = 0;
    c.frameElapsed = 0;
    return;
  }

  const remaining = c.targetX - c.x;
  const step = CHARACTER_WALK_SPEED * dt;

  if (Math.abs(remaining) <= step) {
    c.x = c.targetX;
    c.targetX = null;
    c.walking = false;
    c.frameIndex = 0;
    c.frameElapsed = 0;
    return;
  }

  c.facing = remaining < 0 ? 'left' : 'right';
  c.x += Math.sign(remaining) * step;
  c.walking = true;

  c.frameElapsed += dt * 1000;
  while (c.frameElapsed >= CHARACTER_WALK_FRAME_DURATION) {
    c.frameElapsed -= CHARACTER_WALK_FRAME_DURATION;
    c.frameIndex = (c.frameIndex + 1) % c.walkFrameCount;
  }
}

function drawCharacter(c, idleImg, walkFrames, containT) {
  const h = CHARACTER_HEIGHT * c.scale * containT.scale;
  const w = h * CHARACTER_ASPECT;
  const screenX = containT.dx + c.x * containT.scale;
  const screenY = containT.dy + CHARACTER_ANCHOR_Y * containT.scale;
  const x = screenX - w / 2;
  const y = screenY - h;

  const img = c.walking ? walkFrames[c.frameIndex] : idleImg;

  ctx.save();
  if (c.facing !== c.nativeFacing) {
    // retourne le sprite quand il marche dans le sens opposé à son orientation native
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

// Distance (en unités Fond.png) à l'intérieur du bouton jusqu'où un
// personnage peut avancer avant de s'arrêter : les premiers 30% de sa largeur.
const BUTTON_PENETRATION_RATIO = 0.3;
const PRESS_DURATION = 300; // ms : le bouton reste "enfoncé" avant de s'activer

// Loïs : sprite natif tourné vers la droite. Entre depuis hors-écran à
// gauche (en deçà de x=0, donc invisible au départ) et marche automatiquement,
// sans s'arrêter, jusqu'à son bouton (bleu), comme un bot.
const LOIS_VISIBLE_WIDTH_RATIO = 34 / 96;
const LOIS_OFFSCREEN_START_X = -124;
const LOIS_SCALE = 1.1;
const lois = createCharacter(LOIS_OFFSCREEN_START_X, 'right', LOIS_VISIBLE_WIDTH_RATIO, 4, LOIS_SCALE);
const LOIS_TARGET_X = preMenuButtons.bleu.anchorX
  - BUTTON_DISPLAY_W_FOND * (0.5 - BUTTON_PENETRATION_RATIO)
  - characterHalfWidth(lois);

// Lauren : sprite natif tourné vers la gauche. Entre depuis hors-écran à
// droite (au-delà de la largeur de Fond.png, donc invisible au départ) et
// s'arrête dès qu'elle atteint le bord de l'écran (LAUREN_READY_X) : à partir
// de là, c'est au joueur de la faire avancer jusqu'à son bouton.
const LAUREN_VISIBLE_WIDTH_RATIO = 38 / 96;
const LAUREN_OFFSCREEN_START_X = 1500;
const LAUREN_READY_X = 1300; // aussi la limite droite pour les déplacements contrôlés par le joueur
const lauren = createCharacter(LAUREN_OFFSCREEN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5);
// Lauren approche par la droite : LAUREN_TARGET_X est la limite GAUCHE (la plus
// petite valeur de x) qu'elle peut atteindre, pas une limite haute.
const LAUREN_TARGET_X = preMenuButtons.rose.anchorX
  + BUTTON_DISPLAY_W_FOND * (0.5 - BUTTON_PENETRATION_RATIO)
  + characterHalfWidth(lauren);

// ---------- Son de marche, partagé (mêmes pas pour les deux personnages) ----------
// Boucle tant que l'un des deux marche, avec un léger fondu (départ/arrêt)
// pour éviter une coupure brutale en plein milieu d'un pas.

const walkSound = new Audio('Assets/Sound/1.Walking.mp3');
walkSound.loop = true;
walkSound.volume = 0;

const WALK_SOUND_FADE_MS = 120;
const WALK_SOUND_MAX_VOLUME = 0.8;

function updateWalkSound(dt, anyWalking) {
  const target = anyWalking ? WALK_SOUND_MAX_VOLUME : 0;

  if (target > 0 && walkSound.paused) {
    walkSound.play().catch(() => {});
  }

  const step = (dt * 1000) / WALK_SOUND_FADE_MS;
  if (walkSound.volume < target) {
    walkSound.volume = Math.min(target, walkSound.volume + step);
  } else if (walkSound.volume > target) {
    walkSound.volume = Math.max(target, walkSound.volume - step);
  }

  if (target === 0 && !walkSound.paused && walkSound.volume === 0) {
    walkSound.pause();
    walkSound.currentTime = 0;
  }
}

// ---------- Son de bouton ----------

const buttonSound = new Audio('Assets/Sound/2.Button.mp3');

function playButtonSound() {
  buttonSound.currentTime = 0;
  buttonSound.play().catch(() => {});
}

// Les navigateurs bloquent tout son tant qu'aucun geste utilisateur n'a eu
// lieu sur la page : on "débloque" les deux sons (lecture/pause muette) dès
// le premier tap, avant de lancer la marche automatique de Loïs.
function unlockAudio() {
  [walkSound, buttonSound].forEach((audio) => {
    const wasMuted = audio.muted;
    audio.muted = true;
    audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = wasMuted;
      })
      .catch(() => {
        audio.muted = wasMuted;
      });
  });
}

// ---------- Musique de fond du PreMenu ----------
// Démarre au premier tap (geste utilisateur requis) et joue en boucle tant
// qu'on est dans la scène ; s'éteint en fondu dès que la télé s'allume.

const PREMENU_MUSIC_VOLUME = 0.5;
const PREMENU_MUSIC_FADE_MS = 600;

const preMenuMusic = new Audio('Assets/Sound/3.MusiqueFondPreMenu.wav');
preMenuMusic.loop = true;

function startPreMenuMusic() {
  preMenuMusic.volume = PREMENU_MUSIC_VOLUME;
  preMenuMusic.currentTime = 0;
  preMenuMusic.play().catch(() => {});
}

function fadeOutPreMenuMusic(dt) {
  if (preMenuMusic.paused) return;
  const step = (dt * 1000 / PREMENU_MUSIC_FADE_MS) * PREMENU_MUSIC_VOLUME;
  preMenuMusic.volume = Math.max(0, preMenuMusic.volume - step);
  if (preMenuMusic.volume <= 0) {
    preMenuMusic.pause();
    preMenuMusic.currentTime = 0;
  }
}

// ---------- Contrôle de Lauren par le joueur ----------
// Une fois arrivée, Lauren n'est plus un bot : deux boutons fléchés visibles
// en bas de l'écran, à maintenir enfoncés, la font marcher (relâcher l'arrête
// net). Rien ne se déclenche sans que le joueur maintienne un bouton.

const ARROW_BUTTON_RADIUS_RATIO = 0.045; // relatif à la plus petite dimension de l'écran
const ARROW_BUTTON_MARGIN_RATIO = 0.06;  // relatif à la largeur de l'écran
const ARROW_BUTTON_BOTTOM_RATIO = 0.88;  // relatif à la hauteur de l'écran

function getArrowButtonCircle(side) {
  const radius = Math.min(window.innerWidth, window.innerHeight) * ARROW_BUTTON_RADIUS_RATIO;
  const margin = window.innerWidth * ARROW_BUTTON_MARGIN_RATIO;
  const cx = side === 'left' ? margin + radius : window.innerWidth - margin - radius;
  const cy = window.innerHeight * ARROW_BUTTON_BOTTOM_RATIO;
  return { cx, cy, radius };
}

function isInsideCircle(pos, circle) {
  const dx = pos.x - circle.cx;
  const dy = pos.y - circle.cy;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function drawArrowButton(side, pressed) {
  const circle = getArrowButtonCircle(side);

  ctx.save();
  ctx.beginPath();
  ctx.arc(circle.cx, circle.cy, circle.radius, 0, Math.PI * 2);
  ctx.fillStyle = pressed ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.stroke();

  const a = circle.radius * 0.5;
  ctx.beginPath();
  if (side === 'left') {
    ctx.moveTo(circle.cx + a * 0.5, circle.cy - a);
    ctx.lineTo(circle.cx - a * 0.6, circle.cy);
    ctx.lineTo(circle.cx + a * 0.5, circle.cy + a);
  } else {
    ctx.moveTo(circle.cx - a * 0.5, circle.cy - a);
    ctx.lineTo(circle.cx + a * 0.6, circle.cy);
    ctx.lineTo(circle.cx - a * 0.5, circle.cy + a);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

function drawLaurenControls() {
  drawArrowButton('left', laurenControl.direction === -1);
  drawArrowButton('right', laurenControl.direction === 1);
}

const laurenControl = { direction: 0 }; // -1 = gauche, 0 = immobile, 1 = droite
let laurenControlPointerId = null; // pointer actif sur un bouton fléché, pour ignorer les autres doigts

function updateLaurenControlled(dt) {
  if (laurenControl.direction === 0) {
    lauren.walking = false;
    lauren.frameIndex = 0;
    lauren.frameElapsed = 0;
    return;
  }

  const nextX = lauren.x + laurenControl.direction * CHARACTER_WALK_SPEED * dt;
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

  lauren.facing = laurenControl.direction < 0 ? 'left' : 'right';
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
const STAGE_LOIS_WALKING = 'loisWalking';
const STAGE_LOIS_PRESSING = 'loisPressing';
const STAGE_LAUREN_CONTROLLABLE = 'laurenControllable';
const STAGE_LAUREN_PRESSING = 'laurenPressing';
const STAGE_DONE = 'done';

// On attend un premier tap (nécessaire pour débloquer le son) avant que
// l'écran s'allume et que Loïs ne parte automatiquement vers son bouton.
let preMenuStage = STAGE_WAITING_TO_START;
let pressTimer = 0;
let lightUpStartTime = null; // instant (performance.now()) du premier tap, pour le fondu depuis le noir
const LIGHT_UP_DURATION = 500;

function updatePreMenuActors(dt) {
  updateCharacter(lois, dt);

  if (preMenuStage === STAGE_LAUREN_CONTROLLABLE) {
    updateLaurenControlled(dt);
  } else {
    updateCharacter(lauren, dt);
  }

  updateWalkSound(dt, lois.walking || lauren.walking);

  switch (preMenuStage) {
    case STAGE_LOIS_WALKING:
      if (!lois.walking) {
        preMenuButtons.bleu.state = 'pressed';
        playButtonSound();
        pressTimer = 0;
        preMenuStage = STAGE_LOIS_PRESSING;
      }
      break;

    case STAGE_LOIS_PRESSING:
      pressTimer += dt * 1000;
      if (pressTimer >= PRESS_DURATION) {
        preMenuButtons.bleu.state = 'activated';
        // Lauren apparaît directement au bord de l'écran, sans marche
        // automatique : dès qu'elle est visible, c'est au joueur de jouer.
        lauren.x = LAUREN_READY_X;
        preMenuStage = STAGE_LAUREN_CONTROLLABLE;
      }
      break;

    case STAGE_LAUREN_CONTROLLABLE:
      if (lauren.x <= LAUREN_TARGET_X) {
        preMenuButtons.rose.state = 'pressed';
        playButtonSound();
        pressTimer = 0;
        laurenControl.direction = 0;
        laurenControlPointerId = null;
        preMenuStage = STAGE_LAUREN_PRESSING;
      }
      break;

    case STAGE_LAUREN_PRESSING:
      pressTimer += dt * 1000;
      if (pressTimer >= PRESS_DURATION) {
        preMenuButtons.rose.state = 'activated';
        preMenuStage = STAGE_DONE;
        scene = 'tvOn';
        startTime = null;
      }
      break;

    // STAGE_WAITING_TO_START : rien à faire, on attend le premier tap.
  }
}

// Premier tap : débloque le son, allume l'écran et lance Loïs (bot). Ensuite,
// tant que Lauren est contrôlable, seul un doigt maintenu sur l'un des deux
// boutons fléchés la fait marcher dans cette direction ; le relâcher l'arrête.
function handlePreMenuDown(evt) {
  if (preMenuStage === STAGE_WAITING_TO_START) {
    unlockAudio();
    startPreMenuMusic();
    lightUpStartTime = performance.now();
    characterWalkTo(lois, LOIS_TARGET_X);
    preMenuStage = STAGE_LOIS_WALKING;
    return;
  }

  if (preMenuStage === STAGE_LAUREN_CONTROLLABLE) {
    const pos = getPointerPos(evt);
    if (isInsideCircle(pos, getArrowButtonCircle('left'))) {
      laurenControl.direction = -1;
      laurenControlPointerId = evt.pointerId;
    } else if (isInsideCircle(pos, getArrowButtonCircle('right'))) {
      laurenControl.direction = 1;
      laurenControlPointerId = evt.pointerId;
    }
  }
}

function handlePreMenuUp(evt) {
  if (evt.pointerId === laurenControlPointerId) {
    laurenControl.direction = 0;
    laurenControlPointerId = null;
  }
}

canvas.addEventListener('pointerdown', (evt) => {
  if (scene === 'premenu') handlePreMenuDown(evt);
});

canvas.addEventListener('pointerup', (evt) => {
  if (scene === 'premenu') handlePreMenuUp(evt);
});

canvas.addEventListener('pointercancel', (evt) => {
  if (scene === 'premenu') handlePreMenuUp(evt);
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
  ctx.fillText('Touchez l’écran pour commencer', window.innerWidth / 2, window.innerHeight / 2);
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
  drawBothPreMenuButtons(containT);
  updatePreMenuActors(dt);
  drawCharacter(lois, assets.loisIdle, assets.loisWalk, containT);
  drawCharacter(lauren, assets.laurenIdle, assets.laurenWalk, containT);
  if (preMenuStage === STAGE_LAUREN_CONTROLLABLE) {
    drawLaurenControls();
  }
  drawLightUpOverlay();
}

// ---------- Transition : allumage de l'écran, puis fondu au noir vers le Menu ----------

// Écran de la télé, mesuré directement dans Fond.png (bruit statique).
const TV_SCREEN_RECT = { x: 604, y: 275, w: 166, h: 110 };
const TV_FLICKER_DURATION = 700; // ms : la télé flashe avant de rester allumée

// Coupure classique : la scène PreMenu s'assombrit, courte pause au noir,
// puis le Menu apparaît en fondu depuis le noir. Un peu plus lente pour
// laisser le temps de "digérer" le changement de scène.
const BLACKOUT_FADE_OUT_DURATION = 550;
const BLACKOUT_HOLD_DURATION = 350;
const BLACKOUT_FADE_IN_DURATION = 700;

function getTvScreenRect(containT) {
  return {
    x: containT.dx + TV_SCREEN_RECT.x * containT.scale,
    y: containT.dy + TV_SCREEN_RECT.y * containT.scale,
    w: TV_SCREEN_RECT.w * containT.scale,
    h: TV_SCREEN_RECT.h * containT.scale,
  };
}

// Clignotement façon tube cathodique qui chauffe, plusieurs flashs qui
// s'enchaînent, le dernier étant le plus long/le plus lumineux.
function drawTvFlicker(containT, elapsed) {
  const rect = getTvScreenRect(containT);
  const flickers = [
    { start: 0, end: 70, peak: 0.9 },
    { start: 110, end: 170, peak: 0.5 },
    { start: 220, end: 260, peak: 0.7 },
    { start: 320, end: 360, peak: 0.4 },
    { start: 420, end: 480, peak: 0.8 },
    { start: 560, end: 700, peak: 1 },
  ];
  let alpha = 0;
  for (const f of flickers) {
    if (elapsed >= f.start && elapsed <= f.end) {
      const localT = (elapsed - f.start) / (f.end - f.start);
      alpha = Math.max(alpha, Math.sin(localT * Math.PI) * f.peak);
    }
  }
  if (alpha > 0) {
    // Lueur qui déborde de l'écran et éclaire la pièce sombre autour (boutons,
    // personnages...), pour que le flash vienne vraiment de la télé comme
    // source de lumière, pas d'un simple rectangle blanc contenu dans l'écran.
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const glowRadius = Math.max(rect.w, rect.h) * 2.4;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    glow.addColorStop(0, `rgba(255, 250, 235, ${alpha * 0.8})`);
    glow.addColorStop(0.35, `rgba(255, 244, 220, ${alpha * 0.3})`);
    glow.addColorStop(1, 'rgba(255, 244, 220, 0)');
    ctx.save();
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}

function drawTvOnScene(assets, elapsed, dt) {
  const containT = getPreMenuContainT(assets);
  drawBackgroundContain(assets.preMenuFond, containT);
  drawBothPreMenuButtons(containT);
  drawCharacter(lois, assets.loisIdle, assets.loisWalk, containT);
  drawCharacter(lauren, assets.laurenIdle, assets.laurenWalk, containT);
  fadeOutPreMenuMusic(dt);

  if (elapsed < TV_FLICKER_DURATION) {
    drawTvFlicker(containT, elapsed);
  } else {
    scene = 'blackout';
    startTime = null;
  }
}

// Coupure classique : la scène PreMenu (écran allumé) s'assombrit jusqu'au
// noir complet, courte pause, puis le Menu apparaît en fondu depuis le noir.
function drawBlackoutScene(assets, elapsed, dt) {
  const fadeOutEnd = BLACKOUT_FADE_OUT_DURATION;
  const holdEnd = fadeOutEnd + BLACKOUT_HOLD_DURATION;
  const fadeInEnd = holdEnd + BLACKOUT_FADE_IN_DURATION;

  if (elapsed < fadeOutEnd) {
    const containT = getPreMenuContainT(assets);
    drawBackgroundContain(assets.preMenuFond, containT);
    drawBothPreMenuButtons(containT);
    drawCharacter(lois, assets.loisIdle, assets.loisWalk, containT);
    drawCharacter(lauren, assets.laurenIdle, assets.laurenWalk, containT);

    ctx.save();
    ctx.globalAlpha = elapsed / fadeOutEnd;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
  } else if (elapsed < holdEnd) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  } else if (elapsed < fadeInEnd) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.save();
    ctx.globalAlpha = (elapsed - holdEnd) / BLACKOUT_FADE_IN_DURATION;
    drawBackgroundCover(assets.menuFond);
    ctx.restore();
  } else {
    scene = 'menu';
    startTime = null;
  }
}
