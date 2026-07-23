// ============================================================
// Cadenas à combinaison (6 molettes). Overlay réutilisable, indépendant de la
// scène qui l'ouvre :
//   - openLock(onUnlock) l'affiche en grand par-dessus la scène courante ;
//   - chaque molette se tourne en glissant le doigt verticalement dessus ;
//   - quand le code affiché vaut LOCK_CODE, onUnlock() est appelé.
// Les chiffres sont rendus à la main (police pixel PressStart2P) pour garder
// une esthétique cohérente sur les 10 chiffres, le sprite 17.png ne servant
// que de cadre.
// ============================================================

const LOCK_CODE = [3, 0, 0, 3, 2, 4];

// Son de molette : petit "tick" joué au passage d'un chiffre à l'autre. On
// prépare un pool de clips identiques que l'on fait tourner, pour que des ticks
// rapprochés (défilement rapide) se chevauchent sans se couper les uns les
// autres → défilement fluide.
const LOCK_WHEEL_SOUND_POOL = [];
for (let i = 0; i < 6; i++) {
  const a = new Audio('Assets/Sound/10.CadenasMolette.wav');
  a.volume = 0.45;
  registerAudioForUnlock(a);
  LOCK_WHEEL_SOUND_POOL.push(a);
}
let lockWheelSoundIdx = 0;
function playMoletteSound() {
  const a = LOCK_WHEEL_SOUND_POOL[lockWheelSoundIdx];
  lockWheelSoundIdx = (lockWheelSoundIdx + 1) % LOCK_WHEEL_SOUND_POOL.length;
  a.currentTime = 0;
  a.play().catch(() => {});
}

// Géométrie dans l'espace natif du sprite (960x540), repérée sur 17.png.
const LOCK_SPRITE_W = 960;
const LOCK_SPRITE_H = 540;
// Centres des molettes : premier centre + pas régulier. Augmenter le pas les
// écarte vers la droite (la première reste en place).
const LOCK_WHEEL_FIRST_X = 309;
const LOCK_WHEEL_SPACING = 68;
const LOCK_WHEEL_CENTERS = [0, 1, 2, 3, 4, 5].map(
  (i) => LOCK_WHEEL_FIRST_X + i * LOCK_WHEEL_SPACING
);
const LOCK_WHEEL_HALF_W = 22;   // demi-largeur de la fenêtre d'un chiffre
const LOCK_DIGIT_CENTER_Y = 365; // y du chiffre courant (centre du "0" imprimé)
const LOCK_DIGIT_STEP = 48;      // écart vertical entre deux chiffres
// Fenêtre couvrant TOUTE la zone d'affichage : elle doit masquer les chiffres
// imprimés du sprite (qui descendent jusqu'à ~447) pour éviter tout doublon.
const LOCK_WINDOW_TOP = 296;    // remonté de 20 px : on voit les molettes plus haut
const LOCK_WINDOW_BOTTOM = 458;

const LOCK_OPEN_DURATION = 320;  // ms : le cadenas grandit à l'ouverture
const LOCK_SNAP_SPEED = 14;      // vitesse de recalage d'une molette relâchée
const LOCK_FLASH_DURATION = 500; // ms : durée du flash (vert au succès, rouge à l'échec)
const LOCK_CLOSE_DURATION = 450; // ms : fondu de fermeture de l'overlay

// Ouverture animée par 2 frames (1.png fermé → 2.png déverrouillé), puis un
// halo vert avant que l'overlay ne se ferme. Le corps bouge à peine entre les
// deux frames : on cale les molettes dessus via la position/largeur du corps.
const LOCK_REF_TOP = 227; // haut du corps dans la frame de référence (fermée)
const LOCK_REF_CX = 479;  // centre horizontal du corps de référence
const LOCK_REF_W = 458;   // largeur du corps de référence
const LOCK_FRAMES_BODY = [
  { top: 227, cx: 479, w: 458 }, // 1.png
  { top: 230, cx: 479, w: 455 }, // 2.png
];
const LOCK_OPEN_FRAME_MS = 380; // ms : passe de la frame fermée à la frame ouverte

// --- État ---
let lockActive = false;
let lockOpenStart = 0;
let lockOnUnlock = null;
// Position continue de chaque molette, en unités "chiffre" (peut être
// fractionnaire pendant un glissement, se recale sur un entier au relâcher).
const lockPos = [0, 0, 0, 0, 0, 0];
// Indice "cranté" de chaque molette (entier, non modulo) : le chiffre sur lequel
// la molette est considérée posée. Il ne change qu'en franchissant NETTEMENT le
// demi-pas (hystérésis), pour jouer UN seul tick par chiffre et éviter les ticks
// multiples dus au tremblement du pointeur près de la bascule.
const lockShownIndex = [0, 0, 0, 0, 0, 0];
const LOCK_TICK_HYSTERESIS = 0.18; // marge au-delà du demi-pas avant de basculer
let lockDragWheel = -1;      // molette en cours de glissement, -1 si aucune
let lockDragPointerId = null;
let lockDragLastY = 0;
let lockUnlocked = false;
let lockUnlockStart = 0;
let lockClosing = false;
let lockCloseStart = 0;
// Flash rouge affiché quand une tentative validée est fausse.
let lockRedFlashStart = null;
// Indice en attente : on ne le propose (+ notif) qu'une fois le son "faux" fini.
let lockPendingHint = -1;
let lockPendingHintTime = 0;

// Indices : débloqués après un nombre croissant de mauvais essais (une
// validation ratée = 1 essai). Chaque indice est d'abord
// proposé (Consulter / Refuser) ; s'il est refusé, il reste consultable
// ensuite via le bouton "Indices", dans l'ordre.
const HINTS = ['JJMMAA', '1ère rencontre', '30/XX/XX'];
const HINT_THRESHOLDS = [3, 5, 7]; // nb de mauvais essais pour débloquer chaque indice

let wrongAttempts = 0;
let hintsUnlocked = 0;   // combien d'indices débloqués (0..3)
let hintOfferIndex = -1; // indice proposé, en attente de décision (-1 = aucun)
let hintViewIndex = -1;  // indice affiché dans le lecteur (-1 = aucun)

function mod10(n) {
  return ((Math.round(n) % 10) + 10) % 10;
}

// Transforme "contain" du sprite du cadenas vers l'écran, agrandi à l'ouverture.
// `appear` (0→1) pilote l'opacité de tout l'overlay : il monte à l'ouverture
// et redescend à la fermeture, révélant la scène derrière.
function getLockTransform() {
  const base = getContainTransform(LOCK_SPRITE_W, LOCK_SPRITE_H, window.innerWidth, window.innerHeight);
  const openT = Math.min((performance.now() - lockOpenStart) / LOCK_OPEN_DURATION, 1);
  const eased = 1 - Math.pow(1 - openT, 3); // easeOutCubic
  // Le cadenas occupe ~68 % de la zone "contain", et grandit depuis 60 %.
  // (réduit pour laisser la place au titre en haut et au bouton Valider en bas)
  const scale = base.scale * 0.68 * (0.6 + 0.4 * eased);
  const dw = LOCK_SPRITE_W * scale;
  const dh = LOCK_SPRITE_H * scale;

  let appear = eased;
  if (lockClosing) {
    appear *= 1 - Math.min((performance.now() - lockCloseStart) / LOCK_CLOSE_DURATION, 1);
  }
  return {
    scale,
    dx: (window.innerWidth - dw) / 2,
    dy: (window.innerHeight - dh) / 2,
    dw, dh,
    appear,
  };
}

// Ferme l'overlay en fondu (révèle la scène). Une fois fini, lockActive passe
// à false et la scène reprend la main.
function closeLockAnimated() {
  if (lockClosing) return;
  lockClosing = true;
  lockCloseStart = performance.now();
}

function openLock(onUnlock) {
  lockActive = true;
  lockOpenStart = performance.now();
  lockOnUnlock = onUnlock || null;
  lockUnlocked = false;
  lockClosing = false;
  lockDragWheel = -1;
  lockDragPointerId = null;
  lockRedFlashStart = null;
  wrongAttempts = 0;
  hintsUnlocked = 0;
  hintOfferIndex = -1;
  hintViewIndex = -1;
  lockPendingHint = -1;
  for (let i = 0; i < 6; i++) { lockPos[i] = 0; lockShownIndex[i] = 0; }
}

// Rectangle écran d'une molette (zone cliquable = toute la hauteur du cadre).
function getLockWheelRect(index, t) {
  const cx = LOCK_WHEEL_CENTERS[index];
  return {
    x: t.dx + (cx - LOCK_WHEEL_HALF_W) * t.scale,
    y: t.dy + LOCK_WINDOW_TOP * t.scale,
    w: LOCK_WHEEL_HALF_W * 2 * t.scale,
    h: (LOCK_WINDOW_BOTTOM - LOCK_WINDOW_TOP) * t.scale,
  };
}

function lockWheelAt(pos, t) {
  for (let i = 0; i < 6; i++) {
    const r = getLockWheelRect(i, t);
    if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) return i;
  }
  return -1;
}

// Le code affiché correspond-il à la combinaison ?
function lockCodeMatches() {
  for (let i = 0; i < 6; i++) {
    if (mod10(lockPos[i]) !== LOCK_CODE[i]) return false;
  }
  return true;
}

// --- Entrées ---
function handleLockDown(evt) {
  if (!lockActive || lockUnlocked) return;
  const pos = getPointerPos(evt);

  // Les panneaux d'indices captent le tap en priorité (et bloquent les
  // molettes tant qu'ils sont ouverts).
  if (handleHintsDown(pos)) return;

  // Bouton "Valider" : c'est le seul déclencheur de vérification du code.
  if (pointInRect(pos, lockValidateButton())) {
    playClickSound();
    validateLockAttempt();
    return;
  }

  const t = getLockTransform();
  const w = lockWheelAt(pos, t);
  if (w !== -1) {
    lockDragWheel = w;
    lockDragPointerId = evt.pointerId;
    lockDragLastY = pos.y;
  }
}

function handleLockMove(evt) {
  if (lockDragWheel === -1 || evt.pointerId !== lockDragPointerId) return;
  const t = getLockTransform();
  const pos = getPointerPos(evt);
  const stepScreen = LOCK_DIGIT_STEP * t.scale;
  // Glisser vers le HAUT fait défiler la molette vers les chiffres suivants
  // (le chiffre augmente), comme on pousse une molette physique vers le haut.
  const deltaDigits = (lockDragLastY - pos.y) / stepScreen;
  lockPos[lockDragWheel] += deltaDigits;
  lockDragLastY = pos.y;
}

function handleLockUp(evt) {
  if (evt.pointerId !== lockDragPointerId) return;
  lockDragWheel = -1;
  lockDragPointerId = null;
}

canvas.addEventListener('pointerdown', (evt) => { if (lockActive) handleLockDown(evt); });
canvas.addEventListener('pointermove', (evt) => { if (lockActive) handleLockMove(evt); });
canvas.addEventListener('pointerup', (evt) => { if (lockActive) handleLockUp(evt); });
canvas.addEventListener('pointercancel', (evt) => { if (lockActive) handleLockUp(evt); });

// Curseur "main" au survol des molettes / boutons du cadenas (comme un bouton).
canvas.addEventListener('pointermove', (evt) => {
  if (!lockActive) return;
  canvas.style.cursor = lockHoverInteractive(getPointerPos(evt)) ? 'pointer' : 'default';
});

// --- Mise à jour ---

// Toutes les molettes sont-elles sur 0 (état initial, aucune tentative) ?
function lockAllZero() {
  for (let i = 0; i < 6; i++) {
    if (mod10(lockPos[i]) !== 0) return false;
  }
  return true;
}

// Validation d'une tentative, déclenchée uniquement par le bouton "Valider".
// 000000 est l'état initial : on ne le considère pas comme une tentative, donc
// aucune erreur quel que soit le temps passé dessus.
function validateLockAttempt() {
  if (lockUnlocked || lockClosing) return;
  if (lockAllZero()) return;

  if (lockCodeMatches()) {
    lockUnlocked = true;
    lockUnlockStart = performance.now();
    playCorrectSound();
    if (lockOnUnlock) lockOnUnlock();
    return;
  }

  // Tentative fausse : flash rouge immédiat, puis (au besoin) indice + notif
  // différés à la fin du son "faux".
  lockRedFlashStart = performance.now();
  playWrongSound();
  wrongAttempts++;
  if (hintsUnlocked < HINTS.length && wrongAttempts >= HINT_THRESHOLDS[hintsUnlocked]) {
    lockPendingHint = hintsUnlocked;
    hintsUnlocked++;
    const dur = wrongSound.duration && !isNaN(wrongSound.duration) ? wrongSound.duration * 1000 : 1200;
    lockPendingHintTime = performance.now() + dur;
  }
}

function updateLock(dt) {
  // Molettes relâchées : recalage doux vers l'entier le plus proche.
  for (let i = 0; i < 6; i++) {
    if (i === lockDragWheel) continue;
    const target = Math.round(lockPos[i]);
    const diff = target - lockPos[i];
    if (Math.abs(diff) < 0.001) {
      lockPos[i] = target;
    } else {
      lockPos[i] += diff * Math.min(1, LOCK_SNAP_SPEED * dt);
    }
  }

  // Tick de molette : la molette n'est réputée "changer de chiffre" qu'après
  // avoir franchi le demi-pas + une marge d'hystérésis. Un seul tick par chiffre,
  // même si le pointeur tremble autour de la bascule. La boucle "while" gère les
  // défilements rapides (plusieurs chiffres en une frame) sans rafale : un tick.
  for (let i = 0; i < 6; i++) {
    let changed = false;
    while (lockPos[i] > lockShownIndex[i] + 0.5 + LOCK_TICK_HYSTERESIS) { lockShownIndex[i]++; changed = true; }
    while (lockPos[i] < lockShownIndex[i] - 0.5 - LOCK_TICK_HYSTERESIS) { lockShownIndex[i]--; changed = true; }
    if (changed && !lockUnlocked) playMoletteSound();
  }

  // Indice en attente : proposé (+ notif) seulement une fois le son "faux" fini.
  if (lockPendingHint >= 0 && performance.now() >= lockPendingHintTime) {
    hintOfferIndex = lockPendingHint;
    lockPendingHint = -1;
    playNotifSound();
  }
}

// --- Rendu ---

// Un chiffre gravé, style pixel (PressStart2P), avec un léger relief.
// Chiffre au style exact de l'asset : corps crème clair, contour sombre gravé
// (obtenu en dessinant le chiffre décalé dans les 4 directions), police pixel.
function drawLockDigit(value, cx, cy, sizePx, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(sizePx)}px 'PressStart2P', monospace`;
  const o = Math.max(1, sizePx * 0.07);
  ctx.fillStyle = '#3a1e08';
  ctx.fillText(String(value), cx - o, cy);
  ctx.fillText(String(value), cx + o, cy);
  ctx.fillText(String(value), cx, cy - o);
  ctx.fillText(String(value), cx, cy + o);
  ctx.fillStyle = '#f4dc8a'; // crème, comme les chiffres de l'asset
  ctx.fillText(String(value), cx, cy);
  ctx.restore();
}

// Colonne du sprite (sans chiffre) utilisée comme fond de molette : elle porte
// les stries métalliques exactes de l'asset, étirées sur la largeur.
const LOCK_BG_SRC_X = 292;
const LOCK_BG_SRC_W = 2;

// Une molette, calée sur le corps de la frame courante (bx = {top, cx, w}).
// Fond doré prélevé dans l'asset de référence (couvre le "0" imprimé), puis
// les chiffres qui défilent.
function drawLockWheel(index, t, bgImg, bx) {
  const s = bx.w / LOCK_REF_W;
  const wheelXsrc = bx.cx + (LOCK_WHEEL_CENTERS[index] - LOCK_REF_CX) * s;
  const winTopSrc = bx.top + (LOCK_WINDOW_TOP - LOCK_REF_TOP) * s;
  const winBotSrc = bx.top + (LOCK_WINDOW_BOTTOM - LOCK_REF_TOP) * s;
  const centerYsrc = bx.top + (LOCK_DIGIT_CENTER_Y - LOCK_REF_TOP) * s;
  const halfWSrc = LOCK_WHEEL_HALF_W * s;

  const rx = t.dx + (wheelXsrc - halfWSrc) * t.scale;
  const ry = t.dy + winTopSrc * t.scale;
  const rw = halfWSrc * 2 * t.scale;
  const rh = (winBotSrc - winTopSrc) * t.scale;
  const cx = t.dx + wheelXsrc * t.scale;
  const centerY = t.dy + centerYsrc * t.scale;
  const stepScreen = LOCK_DIGIT_STEP * s * t.scale;
  const digitSize = LOCK_DIGIT_STEP * t.scale * 0.78 * s;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();

  // Fond : bande dorée de l'asset de référence étirée (stries identiques).
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    bgImg,
    LOCK_BG_SRC_X, LOCK_WINDOW_TOP, LOCK_BG_SRC_W, LOCK_WINDOW_BOTTOM - LOCK_WINDOW_TOP,
    rx, ry, rw, rh
  );

  const pos = lockPos[index];
  const baseIndex = Math.round(pos);
  const frac = pos - baseIndex;

  // Chiffre courant + voisins, décalés selon la fraction de rotation.
  for (let i = -2; i <= 2; i++) {
    const value = mod10(baseIndex + i);
    const y = centerY + (i - frac) * stepScreen;
    const dist = Math.abs(i - frac);
    const alpha = Math.max(0, 1 - dist * 0.7); // les voisins s'assombrissent
    if (alpha > 0) drawLockDigit(value, cx, y, digitSize, alpha);
  }

  ctx.restore();
}

// Index de frame d'ouverture selon le temps écoulé depuis le déverrouillage.
function lockOpenFrameIndex() {
  if (!lockUnlocked) return 0;
  return (performance.now() - lockUnlockStart) >= LOCK_OPEN_FRAME_MS ? 1 : 0;
}

function drawLockScene(assets, elapsed, dt) {
  updateLock(dt);
  const t = getLockTransform();

  // Fondu de fermeture terminé : l'overlay se retire, la scène reprend.
  if (lockClosing && t.appear <= 0) {
    lockActive = false;
    lockClosing = false;
    canvas.style.cursor = 'default';
    return;
  }

  // Fond assombri par-dessus la scène du lieu (déjà dessinée avant).
  ctx.save();
  ctx.globalAlpha = 0.7 * t.appear;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.restore();

  // Cadenas affiché via la frame d'ouverture courante (fermé → déverrouillé →
  // grand ouvert), avec les molettes calées sur le corps de cette frame.
  const frameIdx = lockOpenFrameIndex();
  const bx = LOCK_FRAMES_BODY[frameIdx];

  ctx.save();
  ctx.globalAlpha = t.appear;
  ctx.drawImage(assets.cadenasFrames[frameIdx], 0, 0, LOCK_SPRITE_W, LOCK_SPRITE_H,
    t.dx, t.dy, t.dw, t.dh);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = t.appear;
  for (let i = 0; i < 6; i++) drawLockWheel(i, t, assets.cadenasFrames[0], bx);
  ctx.restore();

  // Titre + bouton Valider, tant que le cadenas n'est pas ouvert et qu'aucun
  // panneau d'indice n'est ouvert (ceux-ci ont leur propre fond assombri).
  if (!lockUnlocked && hintOfferIndex < 0 && hintViewIndex < 0) {
    drawLockTitle(t.appear);
    drawPill(assets.menuBouton, 'Valider', lockValidateButton());
  }

  // Flash vert de confirmation au déverrouillage, ou flash rouge après une
  // tentative validée fausse.
  drawLockFlash(t, lockUnlocked ? lockUnlockStart : lockRedFlashStart,
    lockUnlocked ? [120, 255, 150] : [255, 90, 90]);

  if (!lockUnlocked) drawHints(assets);
}

// Titre affiché en haut de l'overlay du cadenas (police pixel, contour sombre
// pour rester lisible par-dessus le décor assombri).
function drawLockTitle(appear) {
  const label = 'Trouve le code du cadenas.';
  ctx.save();
  ctx.globalAlpha = appear;
  let size = Math.round(26 * uiSizeFactor());
  ctx.font = `${size}px 'PressStart2P', monospace`;
  // Réduit la police si le titre dépasse ~90 % de la largeur de l'écran.
  const maxW = window.innerWidth * 0.9;
  const measured = ctx.measureText(label).width;
  if (measured > maxW) {
    size = Math.floor(size * maxW / measured);
    ctx.font = `${size}px 'PressStart2P', monospace`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.11;
  const o = Math.max(2, size * 0.12);
  ctx.fillStyle = '#000000';
  ctx.fillText(label, cx - o, cy);
  ctx.fillText(label, cx + o, cy);
  ctx.fillText(label, cx, cy - o);
  ctx.fillText(label, cx, cy + o);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

// Bouton "Valider" au centre bas de l'overlay (seul moyen de tester le code).
function lockValidateButton() {
  const w = Math.min(window.innerWidth * 0.34, 240) * uiSizeFactor();
  const h = w / PILL_ASPECT;
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.9 - h / 2, w, h };
}

// Halo coloré centré sur le cadenas, qui monte puis retombe une fois.
function drawLockFlash(t, startTime, rgb) {
  if (startTime === null) return;
  const flashT = (performance.now() - startTime) / LOCK_FLASH_DURATION;
  if (flashT >= 1) return;
  const cx = t.dx + t.dw / 2;
  const cy = t.dy + t.dh / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.sin(flashT * Math.PI) * 0.5;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, t.dw * 0.6);
  glow.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`);
  glow.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.restore();
}

// --- Indices : panneau (Question.png) + boutons pilule (Réponse/Bonne/Mauvaise) ---

const PANEL_ASPECT = 1717 / 916;
const PILL_ASPECT = 1349 / 255;

function pointInRect(pos, r) {
  return pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h;
}

function hintPanelRect() {
  const w = Math.min(window.innerWidth * 0.82, 640) * uiSizeFactor();
  const h = w / PANEL_ASPECT;
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.4 - h / 2, w, h };
}

function pillSize() {
  const w = Math.min(window.innerWidth * 0.42, 300) * uiSizeFactor();
  return { w, h: w / PILL_ASPECT };
}

// Boutons Consulter / Refuser sous le panneau d'offre.
function hintOfferButtons() {
  const panel = hintPanelRect();
  const { w, h } = pillSize();
  const y = panel.y + panel.h + h * 0.5;
  const gap = w * 0.16;
  return {
    consulter: { x: window.innerWidth / 2 - w - gap / 2, y, w, h },
    refuser: { x: window.innerWidth / 2 + gap / 2, y, w, h },
  };
}

// Boutons Fermer / Suivant sous le panneau de lecture d'un indice.
function hintViewerButtons() {
  const panel = hintPanelRect();
  const { w, h } = pillSize();
  const y = panel.y + panel.h + h * 0.5;
  const hasNext = hintViewIndex < hintsUnlocked - 1;
  if (hasNext) {
    const gap = w * 0.16;
    return {
      fermer: { x: window.innerWidth / 2 - w - gap / 2, y, w, h },
      suivant: { x: window.innerWidth / 2 + gap / 2, y, w, h },
    };
  }
  return { fermer: { x: window.innerWidth / 2 - w / 2, y, w, h } };
}

// Bouton permanent en bas à gauche pour reconsulter les indices débloqués.
function hintAccessButton() {
  const w = Math.min(window.innerWidth * 0.34, 220) * uiSizeFactor();
  const h = w / PILL_ASPECT;
  return { x: window.innerWidth * 0.04, y: window.innerHeight * 0.9 - h / 2, w, h };
}

function dimBackdrop() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.restore();
}

// Pilule (asset) + texte centré, taille de police ajustée pour tenir dedans.
// Grossit un peu au survol (même principe que les réponses des questions) ; le
// texte garde sa taille de base (calculée sur le rectangle d'origine).
function drawPill(img, text, r) {
  const fs = fitButtonFontSize(text, r.w * 0.78, r.h * 0.34);
  r = answerHoverRect(r);
  ctx.drawImage(img, 0, 0, img.width, img.height, r.x, r.y, r.w, r.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#201306';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + fs * 0.05);
}

// Panneau Question.png + lignes de texte centrées.
function drawHintPanel(img, lines) {
  const panel = hintPanelRect();
  ctx.drawImage(img, 0, 0, img.width, img.height, panel.x, panel.y, panel.w, panel.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a1a0a';
  const lineH = panel.h * 0.26;
  lines.forEach((ln, i) => {
    fitButtonFontSize(ln, panel.w * 0.74, panel.h * 0.16);
    const cy = panel.y + panel.h / 2 + (i - (lines.length - 1) / 2) * lineH;
    ctx.fillText(ln, panel.x + panel.w / 2, cy);
  });
}

function drawHints(assets) {
  if (hintOfferIndex >= 0) {
    dimBackdrop();
    drawHintPanel(assets.quizPanel, ['Un indice', 'est disponible !']);
    const b = hintOfferButtons();
    drawPill(assets.quizGood, 'Consulter', b.consulter);
    drawPill(assets.quizBad, 'Refuser', b.refuser);
  } else if (hintViewIndex >= 0) {
    dimBackdrop();
    drawHintPanel(assets.quizPanel, ['Indice ' + (hintViewIndex + 1), HINTS[hintViewIndex]]);
    const b = hintViewerButtons();
    drawPill(assets.menuBouton, 'Fermer', b.fermer);
    if (b.suivant) drawPill(assets.quizGood, 'Suivant', b.suivant);
  } else if (hintsUnlocked > 0) {
    drawPill(assets.menuBouton, 'Indices (' + hintsUnlocked + ')', hintAccessButton());
  }
}

// Renvoie true si le tap a été capté par l'UI des indices (panneaux modaux :
// tout tap est absorbé tant qu'ils sont ouverts, pour ne pas tourner une molette).
function handleHintsDown(pos) {
  if (hintOfferIndex >= 0) {
    const b = hintOfferButtons();
    if (pointInRect(pos, b.consulter)) {
      hintViewIndex = hintOfferIndex;
      hintOfferIndex = -1;
    } else if (pointInRect(pos, b.refuser)) {
      hintOfferIndex = -1;
    }
    return true;
  }
  if (hintViewIndex >= 0) {
    const b = hintViewerButtons();
    if (b.suivant && pointInRect(pos, b.suivant)) {
      hintViewIndex++;
    } else if (pointInRect(pos, b.fermer)) {
      hintViewIndex = -1;
    }
    return true;
  }
  if (hintsUnlocked > 0 && pointInRect(pos, hintAccessButton())) {
    hintViewIndex = 0; // on commence toujours par l'indice 1
    return true;
  }
  return false;
}

// Le pointeur est-il au-dessus d'un élément cliquable du cadenas (molette ou
// bouton d'indice actuellement affiché) ? Sert à afficher le curseur "main".
function lockHoverInteractive(pos) {
  if (!lockActive || lockUnlocked) return false;
  if (hintOfferIndex >= 0) {
    const b = hintOfferButtons();
    return pointInRect(pos, b.consulter) || pointInRect(pos, b.refuser);
  }
  if (hintViewIndex >= 0) {
    const b = hintViewerButtons();
    return pointInRect(pos, b.fermer) || (!!b.suivant && pointInRect(pos, b.suivant));
  }
  if (hintsUnlocked > 0 && pointInRect(pos, hintAccessButton())) return true;
  if (pointInRect(pos, lockValidateButton())) return true;
  return lockWheelAt(pos, getLockTransform()) !== -1;
}
