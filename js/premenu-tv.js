// ============================================================
// Télé du PreMenu et transitions de sortie : sprite animé de la télé
// (5 frames), scène "tvOn" (flashs pendant le son d'activation), puis
// fondu au noir vers le Menu.
//
// Dépend de : premenu.js (getPreMenuContainT, personnages, boutons via
// drawPreMenuWorld) et premenu-sound.js (fadeOutPreMenuMusic).
// ============================================================

// Durée mesurée précisément (via l'API média) du son d'activation. La télé
// flashe pendant TOUTE la durée du son (le fondu au noir vient seulement
// après), pour que le climax dure aussi longtemps que le son d'activation.
const ACTIVATION_SOUND_DURATION = 5720;
const TV_ON_DURATION = ACTIVATION_SOUND_DURATION;

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
const TV_ANCHOR_Y = 248;       // un peu plus haut dans la scène

const TV_STATIC_LIGHT = 0;
const TV_STATIC_DENSE = 1;
const TV_FLASH_WEAK = 2;
const TV_FLASH_STRONG = 3;
const TV_CALM = 4;
// Lueur qui déborde dans la pièce, par frame. Jamais nulle, même sur la
// statique : la télé éclaire la pièce en continu, et les flashs ne sont que
// des pics par-dessus cette lueur de fond.
const TV_GLOW_BY_FRAME = [0.14, 0.2, 0.55, 1, 0.1];

// Montée de la télé, calculée à la volée à partir du TEMPS DE SCÈNE (donc lisse
// et déterministe : plus de calage sur la lecture du son, qui pouvait "sauter"
// et faire clignoter la scène de façon anormale juste avant la coupure). La
// scène tvOn et le son d'activation démarrent au même instant : ils restent
// donc synchronisés, et le flash final s'éteint pile quand l'écran passe au
// noir. Principe : démarrage timide -> flashs de plus en plus rapprochés et
// forts -> flash final garanti.
const TV_TIMID_MS = 420;       // ms : la télé "chauffe" (clignotements doux)
const TV_PERIOD_START = 300;   // ms entre deux flashs au début
const TV_PERIOD_END = 78;      // ms entre deux flashs à la fin (très resserré)
const TV_FLASH_MS = 72;        // durée d'un flash
const TV_FINAL_FLASH_MS = 120; // flash final garanti, calé sur la coupure

// Progression 0->1 de la montée (après le démarrage timide).
function tvRampP(elapsed) {
  return Math.min(Math.max((elapsed - TV_TIMID_MS) / (TV_ON_DURATION - TV_TIMID_MS), 0), 1);
}

function pickTvFrame(elapsed) {
  // Flash final garanti : le dernier flash s'éteint pile à la coupure.
  if (elapsed >= TV_ON_DURATION - TV_FINAL_FLASH_MS) return TV_FLASH_STRONG;

  // Démarrage timide : la télé sort du calme avec quelques clignotements doux.
  if (elapsed < TV_TIMID_MS) {
    const k = Math.floor(elapsed / 120) % 3;
    return k === 0 ? TV_CALM : (k === 1 ? TV_STATIC_LIGHT : TV_STATIC_DENSE);
  }

  // Montée : la période (écart entre flashs) se resserre nettement (p^2), et
  // les flashs deviennent de plus en plus souvent "forts".
  const p = tvRampP(elapsed);
  const period = TV_PERIOD_START + (TV_PERIOD_END - TV_PERIOD_START) * (p * p);
  const n = Math.floor(elapsed / period);
  const local = elapsed - n * period;
  if (local >= period - TV_FLASH_MS) {
    const strong = Math.abs(Math.sin(n * 1.9)) < 0.2 + p; // presque tous forts à la fin
    return strong ? TV_FLASH_STRONG : TV_FLASH_WEAK;
  }
  return n % 2 === 0 ? TV_STATIC_DENSE : TV_STATIC_LIGHT;
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

// Ondulation continue de la lumière : plusieurs fréquences superposées, pour
// que la lueur de la pièce vibre en permanence au lieu d'être un niveau fixe
// entre deux flashs.
function tvGlowWobble(elapsed) {
  return 0.85
    + Math.sin(elapsed / 70) * 0.09
    + Math.sin(elapsed / 163 + 1.3) * 0.06
    + Math.sin(elapsed / 37 + 0.5) * 0.04;
}

// Dernier état affiché par la scène tvOn : réutilisé pendant le fondu au noir
// qui suit, pour enchaîner sans retomber d'un coup sur la statique calme.
let lastTvFrameIndex = TV_STATIC_DENSE;
let lastTvGlow = 0;

// Pendant la scène tvOn : frame choisie par la montée de flashs, avec une
// lueur qui ondule en continu et s'intensifie à mesure qu'on approche de la
// transition. Pas de fondu ici : la télé reste allumée jusqu'au bout, c'est la
// scène "blackout" qui prend le relais pour l'extinction.
function drawTvScreen(assets, containT, elapsed) {
  const frameIndex = pickTvFrame(elapsed);
  // La lueur monte fortement vers la fin (final bien plus intense).
  const buildUp = 0.5 + 0.7 * tvRampP(elapsed);
  const glow = TV_GLOW_BY_FRAME[frameIndex] * tvGlowWobble(elapsed) * buildUp;

  lastTvFrameIndex = frameIndex;
  lastTvGlow = glow;

  drawTvSprite(assets.tvFrames[frameIndex], containT, 1, glow);
}

// ---------- Scènes de transition ----------

function drawTvOnScene(assets, elapsed, dt) {
  const containT = getPreMenuContainT(assets);
  drawBackgroundContain(assets.preMenuFond, containT);
  drawBothPreMenuButtons(containT);
  drawBothCharacters(assets, containT);

  // Animation calée sur le temps de scène (lisse). Le son démarre au même
  // instant que cette scène, donc ils restent synchronisés.
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
    // On repart de la dernière image de la télé (et de sa lueur) plutôt que de
    // la statique calme : sinon le climax de flashs retomberait d'un coup.
    drawTvSprite(assets.tvFrames[lastTvFrameIndex], containT, 1, lastTvGlow);
    drawBothPreMenuButtons(containT);
    drawBothCharacters(assets, containT);

    ctx.save();
    ctx.globalAlpha = elapsed / fadeOutEnd;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
  } else if (elapsed < holdEnd) {
    // La musique du menu démarre pendant l'écran noir, avant même que le décor
    // du menu ne commence à apparaître.
    startMenuMusic();
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
