// ============================================================
// Scène Place : la devanture du café BlasTodice. Écran fixe, rendu vivant par
// des effets d'ambiance en surcouche uniquement — le fond reste un PNG plat,
// aucun calque séparé n'est nécessaire :
//   - la lueur chaude des vitres, qui respire (le café est habité) ;
//   - des feuilles jaunes qui tombent et voltigent ;
//   - des ombres de nuages qui traversent lentement la façade.
// Tout est en boucle infinie et volontairement discret.
// ============================================================

function getPlaceContainT(assets) {
  return getContainTransform(
    assets.placeFond.width, assets.placeFond.height,
    window.innerWidth, window.innerHeight
  );
}

// NB : le décor est un portail verrouillé au coucher de soleil (et non plus la
// devanture du café). La lueur des vitres du café a donc été retirée — elle
// tomberait dans le ciel. Les feuilles et les ombres de nuages, elles,
// conviennent toujours à ce plan extérieur.

// ---------- Feuilles qui tombent ----------

const LEAF_COUNT = 24;
const LEAF_COLORS = ['#c8952f', '#d9a83c', '#a87b28', '#e0b84e'];
const LEAF_LAND_MIN = 398; // bande du trottoir (coords 1.png) où elles se posent
const LEAF_LAND_MAX = 442;
const LEAF_WIND = 6;       // dérive horizontale, en px source par seconde

let leaves = null;

function createLeaf(initial, fondW) {
  return {
    x: Math.random() * fondW,
    // Une feuille initiale démarre toujours au-dessus de sa zone d'atterrissage,
    // sinon elle se poserait et disparaîtrait dès la première frame.
    y: initial ? Math.random() * LEAF_LAND_MIN : -6 - Math.random() * 40,
    fallSpeed: 8 + Math.random() * 14, // px source par seconde
    swayAmp: 3 + Math.random() * 9,
    swaySpeed: 0.6 + Math.random() * 1.2,
    swayPhase: Math.random() * Math.PI * 2,
    landY: LEAF_LAND_MIN + Math.random() * (LEAF_LAND_MAX - LEAF_LAND_MIN),
    w: Math.random() < 0.5 ? 2 : 3,
    h: 2,
    color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
    life: Math.random() * 10,
    landed: false,
    fade: 1,
  };
}

function updateLeaf(leaf, dt, fondW) {
  leaf.life += dt;

  // Posée au sol : elle s'efface doucement, puis repart du haut.
  if (leaf.landed) {
    leaf.fade -= dt * 0.7;
    if (leaf.fade <= 0) Object.assign(leaf, createLeaf(false, fondW));
    return;
  }

  leaf.y += leaf.fallSpeed * dt;
  leaf.x += LEAF_WIND * dt;
  if (leaf.x > fondW + 10) leaf.x = -10;

  if (leaf.y >= leaf.landY) {
    leaf.y = leaf.landY;
    leaf.landed = true;
    leaf.fade = 1;
  }
}

// Les feuilles se déplacent en pixels source entiers : sans cet arrondi, les
// petits rectangles seraient anticrénelés à chaque frame et scintilleraient,
// ce qui casserait immédiatement le rendu pixel art.
function drawLeaf(leaf, containT) {
  const sway = Math.sin(leaf.life * leaf.swaySpeed + leaf.swayPhase) * leaf.swayAmp;
  const fx = Math.round(leaf.x + sway);
  const fy = Math.round(leaf.y);

  const x = Math.round(containT.dx + fx * containT.scale);
  const y = Math.round(containT.dy + fy * containT.scale);
  const w = Math.max(1, Math.round(leaf.w * containT.scale));
  const h = Math.max(1, Math.round(leaf.h * containT.scale));

  ctx.save();
  ctx.globalAlpha = leaf.landed ? leaf.fade : 1;
  ctx.fillStyle = leaf.color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function updateAndDrawLeaves(containT, dt, fondW) {
  for (const leaf of leaves) {
    updateLeaf(leaf, dt, fondW);
    drawLeaf(leaf, containT);
  }
}

// ---------- Ombres de nuages ----------

// Deux bandes sombres, de largeurs et de vitesses différentes, qui traversent
// l'écran en diagonale. Les périodes sont volontairement premières entre elles
// pour que le motif ne se répète pas de façon perceptible.
const CLOUD_SHADOWS = [
  { period: 47000, phase: 0, width: 0.55, strength: 0.13 },
  { period: 68000, phase: 0.45, width: 0.38, strength: 0.08 },
];

function drawCloudShadows(elapsed) {
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (const cloud of CLOUD_SHADOWS) {
    const t = ((elapsed / cloud.period) + cloud.phase) % 1;
    const bandW = viewW * cloud.width;
    // Entre par la droite, sort par la gauche.
    const cx = viewW + bandW - t * (viewW + bandW * 2);

    // En "multiply", blanc = aucun assombrissement : les bords du dégradé se
    // fondent donc naturellement, sans arête visible.
    const v = Math.round(255 * (1 - cloud.strength));
    const shade = ctx.createLinearGradient(cx - bandW / 2, 0, cx + bandW / 2, viewH);
    shade.addColorStop(0, 'rgb(255, 255, 255)');
    shade.addColorStop(0.5, `rgb(${v}, ${v + 3}, ${v + 9})`);
    shade.addColorStop(1, 'rgb(255, 255, 255)');

    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, viewW, viewH);
  }
  ctx.restore();
}

// ---------- Scène ----------

// ---------- Lauren jouable + cadenas cliquable ----------

// Sol et échelle propres à ce lieu (coordonnées 1.png, 960x540).
const PLACE_GROUND_Y = 452;
const PLACE_LAUREN_SCALE = 0.8;
const PLACE_LAUREN_START_X = -70; // hors-champ à gauche : elle entre en marchant
const PLACE_LAUREN_READY_X = 135; // s'arrête tôt (vers la gauche), puis devient jouable
const PLACE_LAUREN_MIN_X = 60;
const PLACE_LAUREN_MAX_X = 900;

const placeLauren = createCharacter(
  PLACE_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, PLACE_LAUREN_SCALE, 2
);

// Le cadenas est déjà peint sur le portail : on ne le redessine pas, on définit
// juste sa zone cliquable (centre + rayon, en coords 1.png) et un halo d'appel.
const PLACE_LOCK_X = 475;
const PLACE_LOCK_Y = 335;
const PLACE_LOCK_RADIUS = 70;  // rayon cliquable, en coords 1.png
const PLACE_LOCK_REACH = 170;  // distance max (en x) à laquelle Lauren peut l'atteindre

let placeEntered = false; // passe à true une fois l'entrée terminée ⇒ jouable

function getPlaceLockScreen(containT) {
  return {
    cx: containT.dx + PLACE_LOCK_X * containT.scale,
    cy: containT.dy + PLACE_LOCK_Y * containT.scale,
    r: PLACE_LOCK_RADIUS * containT.scale,
  };
}

function laurenNearLock() {
  return Math.abs(placeLauren.x - PLACE_LOCK_X) <= PLACE_LOCK_REACH;
}

// Halo doux et discret sur le cadenas peint, affiché dès que Lauren est
// jouable : il indique où se rendre et cliquer, sans être trop voyant.
function drawPlaceLockHint(containT, elapsed) {
  if (!placeEntered || lockActive) return;
  const s = getPlaceLockScreen(containT);
  const pulse = 0.19 + Math.sin(elapsed / 380) * 0.11; // entre-deux : discret mais repérable
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.globalCompositeOperation = 'lighter';
  const r = s.r * 1.3;
  const glow = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, r);
  glow.addColorStop(0, 'rgba(255, 226, 150, 0.82)');
  glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(s.cx - r, s.cy - r, r * 2, r * 2);
  ctx.restore();
}

function updatePlaceLauren(dt) {
  // Entrée : elle marche depuis la gauche jusqu'à sa position, puis devient
  // jouable (aucune interaction du joueur pendant cette arrivée).
  if (!placeEntered) {
    updateCharacter(placeLauren, dt);
    if (!placeLauren.walking) placeEntered = true;
    updateWalkSound(dt, placeLauren.walking);
    return;
  }

  // Jouable : déplacement au clavier.
  stepPlayerWalk(placeLauren, keyDirection(), dt, PLACE_LAUREN_MIN_X, PLACE_LAUREN_MAX_X);
}

// Lauren entre en marchant jusqu'à sa position d'arrêt dès l'arrivée en scène.
characterWalkTo(placeLauren, PLACE_LAUREN_READY_X);

function handlePlaceDown(evt) {
  if (lockActive || !placeEntered) return;
  const pos = getPointerPos(evt);

  // Clic sur le cadenas peint : ouvre l'overlay si Lauren est assez proche.
  const containT = getPlaceContainT(placeAssets);
  const s = getPlaceLockScreen(containT);
  const dx = pos.x - s.cx;
  const dy = pos.y - s.cy;
  if (dx * dx + dy * dy <= s.r * s.r && laurenNearLock()) {
    playClickSound();
    openLock(onPlaceUnlock);
  }
}

// Curseur "main" au survol du cadenas, uniquement quand Lauren est assez proche
// pour pouvoir cliquer (le curseur signale une action réellement possible).
canvas.addEventListener('pointermove', (evt) => {
  if (scene !== 'place' || lockActive || placePhase !== 'play' || !placeAssets) return;
  const pos = getPointerPos(evt);
  const s = getPlaceLockScreen(getPlaceContainT(placeAssets));
  const dx = pos.x - s.cx;
  const dy = pos.y - s.cy;
  const over = dx * dx + dy * dy <= s.r * s.r && laurenNearLock();
  canvas.style.cursor = over ? 'pointer' : 'default';
});

// ---------- Séquence de déverrouillage : anse qui saute → fermeture de
// l'overlay → (chute du cadenas + ouverture des portes, en attente de calques).
const PLACE_POP_HOLD = 1000;      // ms : on laisse voir le cadenas s'ouvrir + le halo vert
const PLACE_END_FADE = 900;       // ms : fondu au noir provisoire ("à suivre")

let placePhase = 'play';          // play → popping → closing → gate
let placePhaseStart = 0;

function onPlaceUnlock() {
  placePhase = 'popping';
  placePhaseStart = performance.now();
}

function updatePlacePhase() {
  const now = performance.now();
  if (placePhase === 'popping') {
    if (now - placePhaseStart >= PLACE_POP_HOLD) {
      closeLockAnimated();
      placePhase = 'closing';
    }
  } else if (placePhase === 'closing') {
    if (!lockActive) {
      placePhase = 'gate';
      placePhaseStart = now;
    }
  }
}

canvas.addEventListener('pointerdown', (evt) => { if (scene === 'place') handlePlaceDown(evt); });

// ---------- Scène ----------

const PLACE_FADE_IN_DURATION = 500; // fondu depuis le noir en arrivant du Menu

let placeAssets = null;

function drawPlaceScene(assets, elapsed, dt) {
  placeAssets = assets;
  const containT = getPlaceContainT(assets);
  const fondW = assets.placeFond.width;

  if (!leaves) {
    leaves = [];
    for (let i = 0; i < LEAF_COUNT; i++) leaves.push(createLeaf(true, fondW));
  }

  // Ordre voulu : la façade et les feuilles sont dehors, donc assombries par
  // les nuages ; la lueur des vitres vient d'une lampe à l'intérieur, elle
  // passe donc après et n'est pas touchée par l'ombre.
  drawBackgroundContain(assets.placeFond, containT);
  updateAndDrawLeaves(containT, dt, fondW);
  drawCloudShadows(elapsed);

  // Le cadenas n'est plus "cliquable" une fois la séquence lancée.
  if (placePhase === 'play') drawPlaceLockHint(containT, elapsed);
  updatePlaceLauren(dt);
  drawCharacter(placeLauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress, PLACE_GROUND_Y);

  if (placeEntered && !lockActive && placePhase === 'play') drawKeyboardMoveHint();

  // Overlay du cadenas par-dessus la scène.
  if (lockActive) drawLockScene(assets, elapsed, dt);

  updatePlacePhase();

  // Phase portail : chute du cadenas + ouverture des portes.
  // TODO (en attente des calques "portes" + "fond sans portes/cadenas") :
  // pour l'instant, fondu au noir puis bascule vers le décor 2.
  if (placePhase === 'gate') {
    const t = Math.min((performance.now() - placePhaseStart) / PLACE_END_FADE, 1);
    fillBlack(t);
    if (t >= 1) {
      placePhase = 'done';
      place2Reset();
      scene = 'place2';
      startTime = null;
    }
  }

  // Fondu d'arrivée depuis le noir.
  drawSceneFadeIn(elapsed, PLACE_FADE_IN_DURATION);
}
