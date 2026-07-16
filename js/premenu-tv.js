// ============================================================
// Télé du PreMenu et transitions de sortie : sprite animé de la télé
// (5 frames), scène "tvOn" (flashs pendant le son d'activation), puis
// fondu au noir vers le Menu.
//
// Dépend de : premenu.js (getPreMenuContainT, personnages, boutons via
// drawPreMenuWorld) et premenu-sound.js (fadeOutPreMenuMusic).
// ============================================================

// Durée mesurée précisément (via l'API média) du son d'activation. La
// transition vers le Menu démarre 1s avant la fin réelle du son.
const ACTIVATION_SOUND_DURATION = 5720;
const TV_ON_DURATION = ACTIVATION_SOUND_DURATION - 1000;

// Coupure classique : la scène PreMenu s'assombrit, courte pause au noir,
// puis le Menu apparaît en fondu depuis le noir. Un peu plus lente pour
// laisser le temps de "digérer" le changement de scène.
const BLACKOUT_FADE_OUT_DURATION = 550;
const BLACKOUT_HOLD_DURATION = 350;
const BLACKOUT_FADE_IN_DURATION = 700;

// ---------- Sprite de la télé (la télé n'est pas dessinée dans le fond :
// elle est entièrement portée par ces 5 frames) ----------

const TV_DISPLAY_W_FOND = 367;
const TV_ASPECT = 350 / 600;   // dimensions natives des frames (600x350)
const TV_ANCHOR_X = 479;       // centré au-dessus des boutons, repéré dans Fond.png (960x540)
const TV_ANCHOR_Y = 268;

const TV_STATIC_LIGHT = 0;
const TV_STATIC_DENSE = 1;
const TV_FLASH_WEAK = 2;
const TV_FLASH_STRONG = 3;
const TV_CALM = 4;
const TV_GLOW_BY_FRAME = [0, 0, 0.4, 0.9, 0]; // lueur qui déborde dans la pièce, par frame

const TV_TIMID_PHASE_DURATION = 900;   // ms : démarrage timide, la télé qui chauffe
const TV_SETTLE_PHASE_DURATION = 700;  // ms : elle se calme avant de s'éteindre
const TV_FADE_OUT_DURATION = 300;      // ms : fondu final avant le noir

// Tout début : quelques changements timides, un bref aperçu du flash faible.
const TV_TIMID_SEQUENCE = [
  { end: 250, frame: TV_STATIC_LIGHT },
  { end: 500, frame: TV_STATIC_DENSE },
  { end: 700, frame: TV_STATIC_LIGHT },
  { end: 820, frame: TV_FLASH_WEAK },
  { end: 900, frame: TV_STATIC_DENSE },
];

// Corps de la séquence : peu de flashs, mais bien marqués et espacés de façon
// irrégulière (jamais le même intervalle deux fois), certains tenus plus
// longtemps comme un vrai flash photo, un seul double-flash pour casser le
// rythme. Entre deux flashs, la statique "respire" sur des durées irrégulières.
const TV_MAIN_SEQUENCE = [
  { end: 350, frame: TV_STATIC_DENSE },
  { end: 600, frame: TV_FLASH_STRONG },
  { end: 950, frame: TV_STATIC_LIGHT },
  { end: 1000, frame: TV_FLASH_WEAK },
  { end: 1450, frame: TV_STATIC_DENSE },
  { end: 1620, frame: TV_FLASH_STRONG },
  { end: 1660, frame: TV_FLASH_WEAK },
  { end: 2100, frame: TV_STATIC_LIGHT },
  { end: 2200, frame: TV_FLASH_STRONG },
  { end: 2820, frame: TV_STATIC_DENSE },
];

// Sur la fin : de moins en moins de flashs, retour à une statique calme.
const TV_SETTLE_SEQUENCE = [
  { end: 250, frame: TV_FLASH_WEAK },
  { end: 450, frame: TV_STATIC_DENSE },
  { end: 700, frame: TV_CALM },
];

function pickTvFrame(elapsed) {
  if (elapsed < TV_TIMID_PHASE_DURATION) {
    for (const step of TV_TIMID_SEQUENCE) {
      if (elapsed < step.end) return step.frame;
    }
    return TV_STATIC_DENSE;
  }

  const settleStart = TV_ON_DURATION - TV_SETTLE_PHASE_DURATION - TV_FADE_OUT_DURATION;
  if (elapsed >= settleStart) {
    const t = elapsed - settleStart;
    for (const step of TV_SETTLE_SEQUENCE) {
      if (t < step.end) return step.frame;
    }
    return TV_CALM;
  }

  const t = elapsed - TV_TIMID_PHASE_DURATION;
  for (const step of TV_MAIN_SEQUENCE) {
    if (t < step.end) return step.frame;
  }
  return TV_STATIC_DENSE;
}

// Dessine le sprite de la télé (boîtier + écran) centré sur son ancrage dans
// Fond.png, avec une éventuelle lueur qui déborde dans la pièce.
function drawTvSprite(img, containT, alpha, glowAmount) {
  const destW = TV_DISPLAY_W_FOND * containT.scale;
  const destH = destW * TV_ASPECT;
  const screenX = containT.dx + TV_ANCHOR_X * containT.scale;
  const screenY = containT.dy + TV_ANCHOR_Y * containT.scale;
  const x = screenX - destW / 2;
  const y = screenY - destH / 2;

  if (glowAmount > 0) {
    const glowRadius = Math.max(destW, destH) * 1.3;
    const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);
    gradient.addColorStop(0, `rgba(255, 250, 235, ${glowAmount * 0.7})`);
    gradient.addColorStop(0.4, `rgba(255, 244, 220, ${glowAmount * 0.25})`);
    gradient.addColorStop(1, 'rgba(255, 244, 220, 0)');
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, 0, img.width, img.height, x, y, destW, destH);
  ctx.restore();
}

// Avant l'activation : la télé est déjà là, avec une statique calme qui
// alterne lentement entre les deux frames de statique (pas de flash).
const TV_IDLE_CYCLE_MS = 450;

function drawIdleTv(assets, containT) {
  const frameIndex = Math.floor(performance.now() / TV_IDLE_CYCLE_MS) % 2 === 0
    ? TV_STATIC_LIGHT
    : TV_STATIC_DENSE;
  drawTvSprite(assets.tvFrames[frameIndex], containT, 1, 0);
}

// Pendant la scène tvOn : frame choisie par la séquence de flashs, avec un
// fondu final avant le passage au noir.
function drawTvScreen(assets, containT, elapsed) {
  const frameIndex = pickTvFrame(elapsed);

  let alpha = 1;
  const fadeOutStart = TV_ON_DURATION - TV_FADE_OUT_DURATION;
  if (elapsed > fadeOutStart) {
    alpha = Math.max(0, 1 - (elapsed - fadeOutStart) / TV_FADE_OUT_DURATION);
  }

  drawTvSprite(assets.tvFrames[frameIndex], containT, alpha, TV_GLOW_BY_FRAME[frameIndex] * alpha);
}

// ---------- Scènes de transition ----------

function drawTvOnScene(assets, elapsed, dt) {
  const containT = getPreMenuContainT(assets);
  drawBackgroundContain(assets.preMenuFond, containT);
  drawBothPreMenuButtons(containT);
  drawBothCharacters(assets, containT);
  drawTvScreen(assets, containT, elapsed);
  fadeOutPreMenuMusic(dt);

  if (elapsed >= TV_ON_DURATION) {
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
    drawIdleTv(assets, containT);
    drawBothPreMenuButtons(containT);
    drawBothCharacters(assets, containT);

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
