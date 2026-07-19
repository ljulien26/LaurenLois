// ============================================================
// Télé du PreMenu et transitions de sortie : sprite animé de la télé
// (5 frames), scène "tvOn" (flashs pendant le son d'activation), puis
// fondu au noir vers le Menu.
//
// Dépend de : premenu.js (getPreMenuContainT, personnages, boutons via
// drawPreMenuWorld) et premenu-sound.js (fadeOutPreMenuMusic).
// ============================================================

// Durée mesurée précisément (via l'API média) du son d'activation. La
// On cale la fin du son sur l'écran noir : la télé flashe jusqu'à ce que le
// fondu au noir démarre, et ce fondu (BLACKOUT_FADE_OUT_DURATION = 550 ms)
// se termine pile quand le son se coupe. Donc tvOn dure (son − 550 ms).
const ACTIVATION_SOUND_DURATION = 5720;
const TV_ON_DURATION = ACTIVATION_SOUND_DURATION - 550;

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
// Lueur qui déborde dans la pièce, par frame. Jamais nulle, même sur la
// statique : la télé éclaire la pièce en continu, et les flashs ne sont que
// des pics par-dessus cette lueur de fond.
const TV_GLOW_BY_FRAME = [0.14, 0.2, 0.55, 1, 0.1];

const TV_TIMID_PHASE_DURATION = 450; // ms : démarrage timide, la télé qui chauffe

// Tout début : la télé sort du calme, quelques changements timides, un premier
// flash faible en guise d'amorce.
const TV_TIMID_SEQUENCE = [
  { end: 130, frame: TV_CALM },
  { end: 250, frame: TV_STATIC_LIGHT },
  { end: 330, frame: TV_CALM },
  { end: 400, frame: TV_STATIC_DENSE },
  { end: 450, frame: TV_FLASH_WEAK },
];

// Durée que la montée doit couvrir : tout ce qui reste jusqu'à la transition.
const TV_MAIN_PHASE_DURATION = TV_ON_DURATION - TV_TIMID_PHASE_DURATION;

// Réglages de la montée : au début les flashs sont rares et faibles, à la fin
// ils sont plus fréquents — mais on garde un écart raisonnable pour éviter un
// stroboscope trop agressif juste avant la coupure.
const TV_GAP_START = 340;  // ms de statique entre deux flashs, au début
const TV_GAP_END = 120;    // ms de statique entre deux flashs, à la fin
const TV_FLASH_DUR_START = 60;
const TV_FLASH_DUR_END = 95;

// La séquence est construite plutôt qu'écrite à la main : ça exprime
// directement la montée (les écarts se resserrent, les flashs forts prennent
// le dessus) et reste réglable via les 4 constantes ci-dessus. Le "jitter"
// déterministe évite un rythme mécanique tout en gardant un rendu identique
// à chaque partie.
function buildTvRampSequence(totalDuration) {
  const steps = [];
  let t = 0;
  let n = 0;

  while (t < totalDuration) {
    const p = Math.min(t / totalDuration, 1); // 0 au début, 1 à la transition
    const jitter = 0.8 + Math.abs(Math.sin(n * 2.399)) * 0.4;

    // Statique entre deux flashs, de plus en plus courte.
    t += (TV_GAP_START + (TV_GAP_END - TV_GAP_START) * p) * jitter;
    steps.push({ end: t, frame: n % 2 === 0 ? TV_STATIC_DENSE : TV_STATIC_LIGHT });

    // Flash : la probabilité qu'il soit fort monte avec la progression. Le
    // facteur 1.3 fait apparaître les premiers flashs forts dès le milieu,
    // sinon ils débarquent tous d'un coup à la toute fin.
    t += TV_FLASH_DUR_START + (TV_FLASH_DUR_END - TV_FLASH_DUR_START) * p;
    const isStrong = Math.abs(Math.sin(n * 1.7)) < p * 0.9;
    steps.push({ end: t, frame: isStrong ? TV_FLASH_STRONG : TV_FLASH_WEAK });

    n++;
  }

  // Cale la dernière étape pile sur la fin de la fenêtre : aucune image ne fige.
  steps[steps.length - 1].end = totalDuration;
  return steps;
}

const TV_MAIN_SEQUENCE = buildTvRampSequence(TV_MAIN_PHASE_DURATION);

function pickTvFrame(elapsed) {
  if (elapsed < TV_TIMID_PHASE_DURATION) {
    for (const step of TV_TIMID_SEQUENCE) {
      if (elapsed < step.end) return step.frame;
    }
    return TV_STATIC_DENSE;
  }

  const t = elapsed - TV_TIMID_PHASE_DURATION;
  for (const step of TV_MAIN_SEQUENCE) {
    if (t < step.end) return step.frame;
  }
  return TV_FLASH_STRONG;
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
  const buildUp = 0.55 + 0.45 * Math.min(elapsed / TV_ON_DURATION, 1);
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
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  } else if (elapsed < fadeInEnd) {
    // La musique du menu démarre dès que son décor commence à apparaître (un
    // peu avant la bascule sur la scène menu elle-même).
    startMenuMusic();
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
