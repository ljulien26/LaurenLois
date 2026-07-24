// ============================================================
// Écran final (bord de Garonne). Déroulé :
//   1) 'arrivee'    : fondu du décor JOUR -> COUCHER -> NUIT (Places/8/1-3.png)
//                     pendant que le COUPLE arrive (scène non jouable) : Loïs
//                     par la gauche, Lauren par la droite, bras tendus
//                     (Calin.png), puis étreinte (CLL1-4) et petits cœurs ;
//   2) 'charge'     : on invite à TAPOTER (jauge). Chaque tap = petite fusée +
//                     son de clic (le clic ne sonne QUE pendant cette phase) ;
//   3) 'show'       : les feux se déclenchent. La MUSIQUE du générique ET
//                     l'AMBIANCE des feux démarrent ENSEMBLE, en boucle, en fond.
//                     Après quelques secondes : message « Bon anniversaire »
//                     en feu d'artifice ; puis les PHOTOS souvenir défilent
//                     (les 12, chacune une seule fois, ordre aléatoire, lent) ;
//   4) 'end'        : écran qui se termine sur « Fin ».
// Feux entièrement PROCÉDURAUX (petits carrés additifs).
// ============================================================

const FW_COLORS = {
  or:     [255, 214, 106],
  orange: [255, 150, 70],
  rose:   [255, 120, 190],
  teal:   [120, 220, 210],
  bleu:   [150, 190, 255],
  blanc:  [255, 255, 255],
};
const FW_THEMES = [
  [FW_COLORS.or, FW_COLORS.orange, FW_COLORS.rose],
  [FW_COLORS.teal, FW_COLORS.bleu, FW_COLORS.blanc],
  [FW_COLORS.rose, FW_COLORS.or, FW_COLORS.blanc],
  [FW_COLORS.or, FW_COLORS.orange, FW_COLORS.teal, FW_COLORS.rose, FW_COLORS.bleu],
];
const FW_SPARKLE = FW_COLORS.blanc;

// Chronologie du fond (ms depuis le début de la scène).
const FW_DAY_HOLD = 1200;
const FW_FADE = 3500;
const FW_SUNSET_HOLD = 1500;
const FW_NIGHT_AT = FW_DAY_HOLD + FW_FADE + FW_SUNSET_HOLD + FW_FADE;

const FW_TAP_GOAL = 12;         // nb de tapotements pour déclencher
const FW_FIRE_DELAY = 1800;     // ms de musique seule (léger) avant les feux
const FW_END_DELAY = 3500;      // ms de feux après la dernière photo avant la fin
const FW_FIN_HOLD = 2500;       // « Fin... » visible AVANT que le fondu ne commence
const FW_END_FADE = 8000;       // durée du long fondu au noir final
// Chronologie du spectacle (ms depuis le DÉPART DES FEUX).
const FW_MSG_AT = 6000;         // apparition du message « Bon anniversaire »
const FW_MSG_DUR = 7500;        // durée d'affichage du message
const FW_MSG_BURST_GAP = 120;   // ms entre deux fusées qui construisent le texte
const FW_PHOTOS_START = FW_MSG_AT + FW_MSG_DUR; // photos après le message
const FW_PHOTO_SPAWN = 4200;    // ms entre deux photos (plus espacées)
// Zones d'apparition des photos (centres en fractions d'écran), parcourues en
// cycle pour bien répartir les photos dans l'espace.
const FW_PHOTO_ZONES = [
  [0.24, 0.34], [0.74, 0.32], [0.50, 0.52], [0.28, 0.66], [0.72, 0.64], [0.50, 0.30],
];

// Musique du générique (l'autre que le menu) + ambiance des feux : les deux en
// boucle, lancées ensemble au départ des feux.
const fwMusic = new Audio('Assets/Sound/Générique/The Police - Every Breath You Take (Official Video).mp3');
fwMusic.loop = true;
fwMusic.volume = 0.5;
registerAudioForUnlock(fwMusic);
const fwFireSound = new Audio('Assets/Sound/11.Firework.mp3');
fwFireSound.loop = true;
const FW_FIRE_VOLUME = 0.3;
fwFireSound.volume = FW_FIRE_VOLUME;
registerAudioForUnlock(fwFireSound);

// Pool de clics dédié (NON enregistré pour le déblocage : évite la course où le
// déblocage muet couperait le tout premier clic). Chaque tap est un geste
// utilisateur, donc la lecture est autorisée. Rotation pour taps rapprochés.
const fwClickPool = [];
for (let i = 0; i < 5; i++) { const a = new Audio('Assets/Sound/9.Click.mp3'); a.volume = 0.6; fwClickPool.push(a); }
let fwClickIdx = 0;
function fwPlayClick() {
  const a = fwClickPool[fwClickIdx];
  fwClickIdx = (fwClickIdx + 1) % fwClickPool.length;
  a.currentTime = 0;
  a.play().catch(() => {});
}

// --- État ---
let fwPhase = 'arrivee'; // 'arrivee' -> 'charge' -> 'show' -> 'end'
let fwParticles = [];
let fwRockets = [];
let fwShowTimer = 0;
let fwThemeIndex = 0;
let fwThemeTimer = 0;
let fwTapCount = 0;
let fwCharge = 0;
let fwShowStart = 0;    // début de la phase show (= départ de la musique)
let fwFireStarted = false;
let fwFireStart = 0;    // départ effectif des feux (après FW_FIRE_DELAY)
let fwPhotosDoneAt = 0; // instant où la dernière photo a disparu
let fwPhotos = [];
let fwPhotoOrder = [];  // ordre aléatoire des 12 photos (chacune une fois)
let fwPhotoNext = 0;    // prochaine photo à faire apparaître
let fwPhotoTimer = 0;
let fwPhotoZone = 0;    // index de zone d'apparition (cyclé)
let fwTextParticles = []; // particules formant le message « Bon anniversaire »
let fwTextClusters = [];  // fusées programmées : une par « bande » de lettres
let fwTextStart = 0;      // instant (perf.now) où le message commence à se former
let fwTextTriggered = false;
let fwTextDot = 3;        // taille (px écran) d'un point du message
let fwEndStart = 0;
let fwAudioUnlocked = false;
let fwAssets = null;

function fwScale() { return window.innerHeight / 540; }

// Permutation aléatoire de [0..n-1] (Fisher-Yates).
function fwShuffle(n) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// ARRIVÉE DU COUPLE (début de l'écran final, rien à faire pour la joueuse).
// Loïs entre par la gauche et Lauren par la droite EN MÊME TEMPS. Ils se
// rejoignent au centre et se mettent bras tendus (Côté/Calin.png), se
// rapprochent, puis le sprite « couple » prend le relais pour l'étreinte
// (Persos/CLL1 -> CLL4). Sur la dernière image ils restent enlacés devant le
// feu d'artifice et de petits cœurs s'envolent.
// Tout est exprimé dans le repère du décor (960x540), via getCoverTransform.
// ============================================================

const FW_GROUND_Y = 512;      // niveau des pieds sur la promenade
const FW_COUPLE_X = 480;      // centre du couple (milieu du décor)
const FW_LAUREN_SCALE = 0.86;
const FW_LOIS_SCALE = 1.0;    // Loïs légèrement plus grand (son sprite est plus petit dans son canevas)
const FW_CLL_SCALE = 1.0;     // sprite du couple : +1 % pendant le câlin

// Un canevas de sprite fait 96x128 pour une hauteur dessinée de CHARACTER_HEIGHT
// * scale : voici la taille (en unités décor) d'un pixel de ce canevas.
function fwSpritePx(scale) { return (CHARACTER_HEIGHT * scale) / 128; }

// Écart entre les CORPS des deux personnages : ils marchent DIRECTEMENT jusqu'à
// l'écart de l'étreinte (celui mesuré sur le sprite CLL), donc ni glissement ni
// décalage au moment d'enchaîner sur le câlin — juste les bras qui s'ouvrent.
const FW_COUPLE_GAP = 40;
// Le corps n'est pas centré dans le canevas du sprite (bras tendu d'un côté) :
// décalage mesuré entre le centre du corps et le centre du canevas.
const FW_LOIS_BODY_OFF = -3.5 * fwSpritePx(FW_LOIS_SCALE);
const FW_LAUREN_BODY_OFF = 3.5 * fwSpritePx(FW_LAUREN_SCALE);
// De même, le couple du sprite CLL est un peu à droite du centre du canevas.
const FW_CLL_CENTER_OFF = 4 * fwSpritePx(FW_CLL_SCALE);

const FW_COUPLE_START = 700;  // ms avant que les deux se mettent en marche
const FW_CALIN_HOLD = 700;    // ms bras ouverts, l'un contre l'autre
const FW_CLL_FRAME = 260;     // ms par image de l'étreinte (CLL1 -> CLL4)
const FW_HEART_MIN_GAP = 0.45, FW_HEART_MAX_GAP = 0.95; // s entre deux cœurs

const FW_LOIS_START_X = -90;   // hors écran à gauche
const FW_LAUREN_START_X = 1050; // hors écran à droite

// Position d'arrêt (centre du canevas) de chacun, pour l'écart de l'étreinte.
const FW_LOIS_END_X = FW_COUPLE_X - FW_COUPLE_GAP / 2 - FW_LOIS_BODY_OFF;
const FW_LAUREN_END_X = FW_COUPLE_X + FW_COUPLE_GAP / 2 - FW_LAUREN_BODY_OFF;

const fwLois = createCharacter(FW_LOIS_START_X, 'right', LOIS_VISIBLE_WIDTH_RATIO, 4, FW_LOIS_SCALE, 2);
const fwLauren = createCharacter(FW_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, FW_LAUREN_SCALE, 2);

// Étapes : 'attente' -> 'marche' -> 'calin' -> 'etreinte' -> 'coeurs' (final).
let fwCoupleStep = 'attente';
let fwCoupleStepStart = 0;
let fwCllFrame = 0;
let fwHearts = [];
let fwHeartTimer = 0;

// Petit cœur pixel (7x6), dessiné case par case.
const FW_HEART_ROWS = [
  '0110110',
  '1111111',
  '1111111',
  '0111110',
  '0011100',
  '0001000',
];
const FW_HEART_COLORS = [[255, 120, 170], [255, 80, 120], [255, 175, 200], [255, 214, 106]];

function fwCoupleReset() {
  fwCoupleStep = 'attente';
  fwCoupleStepStart = 0;
  fwCllFrame = 0;
  fwHearts = [];
  fwHeartTimer = 0;
  fwLois.x = FW_LOIS_START_X;
  fwLois.facing = 'right';
  fwLois.walking = false;
  fwLois.targetX = null;
  fwLauren.x = FW_LAUREN_START_X;
  fwLauren.facing = 'left';
  fwLauren.walking = false;
  fwLauren.targetX = null;
}

function fwCoupleT() {
  return getCoverTransform(960, 540, window.innerWidth, window.innerHeight);
}

// Un cœur part de la hauteur des épaules, d'un côté ou de l'autre du couple.
function fwSpawnHeart() {
  fwHearts.push({
    x: FW_COUPLE_X + (Math.random() * 2 - 1) * 34,
    y: FW_GROUND_Y - 108 - Math.random() * 20,
    vy: -(16 + Math.random() * 12),
    sway: 5 + Math.random() * 7,
    phase: Math.random() * 6.28,
    cell: 1.5 + Math.random() * 1.1,
    col: FW_HEART_COLORS[Math.floor(Math.random() * FW_HEART_COLORS.length)],
    born: performance.now(),
    life: 2600 + Math.random() * 1400,
  });
}

function fwUpdateCouple(dt, elapsed) {
  const now = performance.now();

  if (fwCoupleStep === 'attente') {
    if (elapsed >= FW_COUPLE_START) {
      fwCoupleStep = 'marche';
      characterWalkTo(fwLois, FW_LOIS_END_X);
      characterWalkTo(fwLauren, FW_LAUREN_END_X);
    }
  } else if (fwCoupleStep === 'marche') {
    updateCharacter(fwLois, dt);
    updateCharacter(fwLauren, dt);
    if (!fwLois.walking && !fwLauren.walking) { fwCoupleStep = 'calin'; fwCoupleStepStart = now; }
  } else if (fwCoupleStep === 'calin') {
    // Bras ouverts, déjà l'un contre l'autre : le sprite du couple enchaîne
    // pile à la même place (aucun glissement).
    if (now - fwCoupleStepStart >= FW_CALIN_HOLD) { fwCoupleStep = 'etreinte'; fwCoupleStepStart = now; }
  } else if (fwCoupleStep === 'etreinte') {
    fwCllFrame = Math.min(3, Math.floor((now - fwCoupleStepStart) / FW_CLL_FRAME));
    if (fwCllFrame >= 3) { fwCoupleStep = 'coeurs'; fwHeartTimer = 0.2; }
  } else {
    // Enlacés pour de bon : les cœurs continuent tout le reste de la scène.
    fwHeartTimer -= dt;
    if (fwHeartTimer <= 0) {
      fwSpawnHeart();
      fwHeartTimer = FW_HEART_MIN_GAP + Math.random() * (FW_HEART_MAX_GAP - FW_HEART_MIN_GAP);
    }
  }

  // Bruit de pas : mis à jour à CHAQUE image, dès que l'un des deux marche
  // (et fondu à zéro dès qu'ils s'arrêtent).
  updateWalkSound(dt, fwLois.walking || fwLauren.walking);

  for (let i = fwHearts.length - 1; i >= 0; i--) {
    const h = fwHearts[i];
    h.y += h.vy * dt;
    if (now - h.born > h.life) fwHearts.splice(i, 1);
  }
}

// L'étreinte est-elle terminée ? (rien d'autre ne démarre avant.)
function fwCoupleDone() { return fwCoupleStep === 'coeurs'; }

// Dessine le sprite du couple (CLL) : un seul canevas pour les deux.
function fwDrawCll(img, t) {
  const h = CHARACTER_HEIGHT * FW_CLL_SCALE * t.scale;
  const w = h * CHARACTER_ASPECT;
  const x = t.dx + (FW_COUPLE_X - FW_CLL_CENTER_OFF) * t.scale - w / 2;
  const y = t.dy + FW_GROUND_Y * t.scale - h;
  ctx.drawImage(img, x, y, w, h);
}

function fwDrawHearts(t) {
  const now = performance.now();
  for (const hp of fwHearts) {
    const age = now - hp.born;
    let a = 1;
    if (age < 300) a = age / 300;
    else if (age > hp.life - 900) a = Math.max(0, (hp.life - age) / 900);
    if (a <= 0.02) continue;
    const cell = Math.max(1, Math.round(hp.cell * t.scale));
    const sx = t.dx + (hp.x + Math.sin(now / 700 + hp.phase) * hp.sway) * t.scale;
    const sy = t.dy + hp.y * t.scale;
    ctx.globalAlpha = a;
    ctx.fillStyle = `rgb(${hp.col[0]},${hp.col[1]},${hp.col[2]})`;
    for (let r = 0; r < FW_HEART_ROWS.length; r++) {
      const row = FW_HEART_ROWS[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '1') {
          ctx.fillRect(Math.round(sx + (c - row.length / 2) * cell), Math.round(sy + (r - FW_HEART_ROWS.length / 2) * cell), cell, cell);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}

function fwDrawCouple(assets) {
  if (fwCoupleStep === 'attente') return;
  const t = fwCoupleT();
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (fwCoupleStep === 'marche' || fwCoupleStep === 'calin') {
    // Pendant la marche : sprites de marche ; à l'arrêt : les bras tendus.
    drawCharacter(fwLois, assets.loisCalin, assets.loisWalk, t, null, FW_GROUND_Y);
    drawCharacter(fwLauren, assets.laurenCalin, assets.laurenWalk, t, null, FW_GROUND_Y);
  } else {
    fwDrawCll(assets.cll[Math.min(fwCllFrame, assets.cll.length - 1)], t);
  }
  fwDrawHearts(t);
  ctx.restore();
}

function fireworksReset() {
  fwPhase = 'arrivee';
  fwCoupleReset();
  fwParticles = [];
  fwRockets = [];
  fwShowTimer = 0;
  fwThemeIndex = Math.floor(Math.random() * FW_THEMES.length);
  fwThemeTimer = 5;
  fwTapCount = 0;
  fwCharge = 0;
  fwShowStart = 0;
  fwFireStarted = false;
  fwFireStart = 0;
  fwPhotosDoneAt = 0;
  fwPhotos = [];
  fwPhotoOrder = fwShuffle(12);
  fwPhotoNext = 0;
  fwPhotoTimer = 0;
  fwPhotoZone = Math.floor(Math.random() * FW_PHOTO_ZONES.length);
  fwTextParticles = [];
  fwTextClusters = [];
  fwTextStart = 0;
  fwTextTriggered = false;
  fwEndStart = 0;
  try { fwMusic.pause(); fwMusic.currentTime = 0; fwMusic.volume = 0.5; } catch (e) {}
  try { fwFireSound.pause(); fwFireSound.currentTime = 0; fwFireSound.volume = FW_FIRE_VOLUME; } catch (e) {}
}

function fwThemeColor() {
  const th = FW_THEMES[fwThemeIndex];
  return th[Math.floor(Math.random() * th.length)];
}

// --- Fusées ---
function fwSpawnRocket(opts) {
  const S = fwScale();
  const o = opts || {};
  fwRockets.push({
    x: o.x != null ? o.x : window.innerWidth * (0.15 + Math.random() * 0.7),
    y: o.y != null ? o.y : window.innerHeight + 6,
    vx: o.vx != null ? o.vx : (Math.random() * 2 - 1) * 24 * S,
    vy: o.vy != null ? o.vy : -(300 + Math.random() * 90) * S,
    targetY: o.targetY != null ? o.targetY : window.innerHeight * (0.12 + Math.random() * 0.34),
    color: o.color || fwThemeColor(),
    type: o.type || 'sphere',
    textCluster: o.textCluster != null ? o.textCluster : null, // forme une bande du message
    trail: [],
  });
}

// Tap pendant la charge : petite fusée + remplissage de la jauge.
function fwTapCharge(px) {
  const S = fwScale();
  const x = Math.max(30, Math.min(window.innerWidth - 30, px));
  fwSpawnRocket({ x, vy: -(250 + Math.random() * 70) * S, targetY: window.innerHeight * (0.3 + Math.random() * 0.28) });
  fwTapCount++;
  if (fwTapCount >= FW_TAP_GOAL) fwStartShow();
}

// Déclenchement : la MUSIQUE part tout de suite (ambiance légère). Les feux et
// leurs bruits ne démarrent qu'après FW_FIRE_DELAY (voir fwIgniteFireworks).
function fwStartShow() {
  if (fwPhase === 'show') return;
  fwPhase = 'show';
  fwShowStart = performance.now();
  fwPhotoTimer = 0;
  fwMusic.currentTime = 0; fwMusic.play().catch(() => {});
}

// Départ effectif des feux : ambiance sonore + salve d'ouverture.
function fwIgniteFireworks() {
  fwFireStarted = true;
  fwFireStart = performance.now();
  fwShowTimer = 0.05;
  fwFireSound.currentTime = 0; fwFireSound.play().catch(() => {});
  const S = fwScale();
  for (let i = 0; i < 6; i++) {
    fwSpawnRocket({ x: window.innerWidth * (0.15 + i * 0.14), vy: -(300 + Math.random() * 100) * S, type: i % 2 === 0 ? 'big' : 'ring' });
  }
}

// --- Explosions ---
function fwExplode(x, y, color, type) {
  const S = fwScale();
  const add = (vx, vy, life, col, size, gmul) => {
    fwParticles.push({ x, y, vx, vy, life, maxLife: life, col, size: size * S, gmul: gmul || 1, flick: Math.random() * 6.28 });
  };
  if (type === 'ring') {
    const n = 42, speed = 120 * S;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; add(Math.cos(a) * speed, Math.sin(a) * speed, 1.1 + Math.random() * 0.3, color, 2.6, 0.8); }
  } else if (type === 'willow') {
    for (let i = 0; i < 55; i++) { const a = Math.random() * Math.PI * 2; const speed = (20 + Math.sqrt(Math.random()) * 90) * S; add(Math.cos(a) * speed, Math.sin(a) * speed - 40 * S, 1.8 + Math.random(), Math.random() < 0.3 ? FW_SPARKLE : color, 2.8, 1.7); }
  } else if (type === 'big') {
    const n = 80 + Math.floor(Math.random() * 30);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const speed = (30 + Math.sqrt(Math.random()) * 190) * S; add(Math.cos(a) * speed, Math.sin(a) * speed, 0.9 + Math.random(), Math.random() < 0.2 ? FW_SPARKLE : color, 3.0, 1); }
  } else if (type === 'double') {
    const c2 = fwThemeColor();
    for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2; add(Math.cos(a) * 70 * S, Math.sin(a) * 70 * S, 0.9 + Math.random() * 0.6, color, 2.8, 1); }
    for (let i = 0; i < 50; i++) { const a = Math.random() * Math.PI * 2; const sp = (100 + Math.random() * 90) * S; add(Math.cos(a) * sp, Math.sin(a) * sp, 0.9 + Math.random() * 0.8, c2, 2.4, 1); }
  } else {
    const n = 50 + Math.floor(Math.random() * 30);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const speed = (30 + Math.sqrt(Math.random()) * 150) * S; add(Math.cos(a) * speed, Math.sin(a) * speed, 0.8 + Math.random() * 0.9, Math.random() < 0.22 ? FW_SPARKLE : color, 2.8, 1); }
  }
  fwParticles.push({ x, y, vx: 0, vy: 0, life: 0.18, maxLife: 0.18, col: FW_SPARKLE, size: 7 * S, gmul: 0, flick: 0, flash: true });
}

function fwAutoLaunch() {
  const S = fwScale();
  const roll = Math.random();
  const type = roll < 0.34 ? 'sphere' : roll < 0.54 ? 'big' : roll < 0.72 ? 'ring' : roll < 0.88 ? 'willow' : 'double';
  if (Math.random() < 0.2) {
    const fromLeft = Math.random() < 0.5;
    fwSpawnRocket({ x: fromLeft ? window.innerWidth * 0.05 : window.innerWidth * 0.95, vx: (fromLeft ? 1 : -1) * (120 + Math.random() * 80) * S, vy: -(300 + Math.random() * 80) * S, type });
  } else {
    fwSpawnRocket({ type });
  }
}

// Construit le message « Bon anniversaire! » PAR EXPLOSIONS DE FEUX D'ARTIFICE.
// On rastérise le texte hors écran et on le pixelise proprement (grille régulière
// de cellules pleines). Les cellules sont réparties en « bandes » verticales (~une
// lettre) ; chaque bande est associée à UNE fusée qui, en explosant à cet endroit,
// libère les braises qui se rassemblent pour dessiner ces lettres. Les fusées
// partent de gauche à droite -> le message se construit sous les feux.
function fwBuildTextFirework(label) {
  const W = window.innerWidth, H = window.innerHeight;
  const oc = document.createElement('canvas');
  const octx = oc.getContext('2d');
  let fs = Math.round(H * 0.12);
  octx.font = `${fs}px 'PressStart2P'`;
  const maxW = W * 0.86;
  let tw = octx.measureText(label).width;
  if (tw > maxW) { fs = Math.floor(fs * maxW / tw); }
  octx.font = `${fs}px 'PressStart2P'`;
  tw = octx.measureText(label).width;

  const pad = Math.ceil(fs * 0.5); // marge (jambages, trait + point du « ! »)
  oc.width = Math.ceil(tw) + pad * 2;
  oc.height = Math.ceil(fs * 1.5) + pad;
  octx.font = `${fs}px 'PressStart2P'`;
  octx.textAlign = 'left';
  octx.textBaseline = 'top';
  octx.fillStyle = '#fff';
  octx.fillText(label, pad, Math.round(pad * 0.6));

  const data = octx.getImageData(0, 0, oc.width, oc.height).data;

  // Taille d'une cellule (~un « pixel » du texte). Échantillon pris au centre,
  // cellule remplie ENTIÈREMENT à l'écran (pas de trous).
  const cell = Math.max(4, Math.round(fs * 0.09));
  fwTextDot = cell;
  const originX = Math.round(W / 2 - oc.width / 2);
  const originY = Math.round(H * 0.26 - oc.height / 2);

  // Léger dégradé doré du haut (clair) vers le bas (plus chaud).
  const goldTop = [255, 236, 172], goldBot = [255, 198, 88];
  const half = cell >> 1;
  // Largeur d'une bande ~ une lettre. Chaque bande = une explosion.
  const bandW = Math.max(cell * 4, fs * 0.9);
  const bands = {}; // index -> { sx, sy, n } pour le centre de la bande

  fwTextParticles = [];
  for (let y = half; y < oc.height; y += cell) {
    for (let x = half; x < oc.width; x += cell) {
      if (data[(y * oc.width + x) * 4 + 3] > 110) {
        const tx = originX + x, ty = originY + y;
        const bi = Math.floor(x / bandW);
        const k = Math.min(1, y / oc.height);
        fwTextParticles.push({
          tx, ty, x: tx, y: ty, active: false, cluster: bi,
          col: [
            Math.round(goldTop[0] + (goldBot[0] - goldTop[0]) * k),
            Math.round(goldTop[1] + (goldBot[1] - goldTop[1]) * k),
            Math.round(goldTop[2] + (goldBot[2] - goldTop[2]) * k),
          ],
          phase: Math.random() * 6.28,
        });
        const b = bands[bi] || (bands[bi] = { sx: 0, sy: 0, n: 0 });
        b.sx += tx; b.sy += ty; b.n++;
      }
    }
  }

  // Une fusée programmée par bande, de gauche à droite, couleurs variées.
  const festive = [FW_COLORS.or, FW_COLORS.rose, FW_COLORS.teal, FW_COLORS.bleu, FW_COLORS.orange];
  const keys = Object.keys(bands).map(Number).sort((a, b) => a - b);
  fwTextClusters = keys.map((bi, i) => ({
    index: bi,
    cx: bands[bi].sx / bands[bi].n,
    cy: bands[bi].sy / bands[bi].n,
    color: festive[i % festive.length],
    rocketAt: i * FW_MSG_BURST_GAP,
    launched: false,
  }));
}

// Explosion d'une fusée « texte » : ses braises deviennent les lettres de la
// bande. On (ré)initialise les particules de cette bande au point d'explosion
// avec un léger éparpillement ; elles convergeront ensuite vers leurs cases.
function fwActivateTextCluster(clusterIndex, x, y) {
  const spread = Math.min(window.innerWidth, window.innerHeight) * 0.05;
  for (const tp of fwTextParticles) {
    if (tp.cluster === clusterIndex && !tp.active) {
      tp.active = true;
      const a = Math.random() * 6.28, r = Math.random() * spread;
      tp.x = x + Math.cos(a) * r;
      tp.y = y + Math.sin(a) * r;
    }
  }
}

// Dessine le message par-dessus les feux : d'abord un halo doré additif (bloom),
// puis les lettres PLEINES et OPAQUES (source-over) pour rester bien lisibles,
// même devant un feu d'artifice clair. `t` = performance.now().
function fwDrawMessage(t) {
  if (!fwTextParticles.length) return;
  const md = (t - fwFireStart) - FW_MSG_AT;
  let ta = 1;
  if (md < 700) ta = md / 700;                              // fondu d'entrée
  else if (md > FW_MSG_DUR - 1000) ta = Math.max(0, (FW_MSG_DUR - md) / 1000); // sortie
  if (ta <= 0) return;
  const cell = Math.max(1, Math.round(fwTextDot));

  // 1) Halo (bloom) additif derrière les lettres.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = Math.round(cell * 2);
  for (const tp of fwTextParticles) {
    if (!tp.active) continue;
    ctx.globalAlpha = ta * 0.09;
    ctx.fillStyle = `rgb(${tp.col[0]},${tp.col[1]},${tp.col[2]})`;
    ctx.fillRect(Math.round(tp.x - glow / 2), Math.round(tp.y - glow / 2), glow, glow);
  }
  ctx.restore();

  // 2) Lettres pleines et nettes (léger recouvrement pour éviter les coutures).
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const d = cell + 1;
  for (const tp of fwTextParticles) {
    if (!tp.active) continue;
    const sh = 0.93 + 0.07 * Math.sin(t / 240 + tp.phase); // scintillement très discret
    ctx.globalAlpha = ta * sh;
    ctx.fillStyle = `rgb(${tp.col[0]},${tp.col[1]},${tp.col[2]})`;
    ctx.fillRect(Math.round(tp.x - d / 2), Math.round(tp.y - d / 2), d, d);
  }
  ctx.restore();
}

// --- Photos souvenir (une par index donné, jamais deux fois la même) ---
function fwSpawnPhoto(idx) {
  const imgs = fwAssets && fwAssets.finalPhotos;
  if (!imgs || !imgs.length) return;
  const img = imgs[idx % imgs.length];
  const H = window.innerHeight, W = window.innerWidth;
  const h = H * 0.5; // plus grandes
  const w = h * (img.width / img.height);
  // Répartition : on suit les zones en cycle + un jitter, puis on borne à l'écran.
  const z = FW_PHOTO_ZONES[fwPhotoZone % FW_PHOTO_ZONES.length];
  fwPhotoZone++;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const x = clamp(z[0] * W + (Math.random() * 2 - 1) * W * 0.07, w / 2 + 6, W - w / 2 - 6);
  const y = clamp(z[1] * H + (Math.random() * 2 - 1) * H * 0.07, h / 2 + 6, H - h / 2 - 6);
  fwPhotos.push({
    img, w, h, x, y,
    vy: -(12 + Math.random() * 8) * fwScale(),
    swayPhase: Math.random() * 6.28,
    swayAmp: 5 + Math.random() * 6,
    rot: (Math.random() * 2 - 1) * 0.08,
    born: performance.now(),
    life: 9200 + Math.random() * 1800, // affichées plus longtemps
  });
}

// --- Mise à jour ---
function updateFireworks(dt, elapsed) {
  const S = fwScale();
  const grav = 92 * S;
  const now = performance.now();

  // L'arrivée du couple n'attend rien de la joueuse : on ne lui propose de
  // déclencher les feux qu'une fois la nuit tombée ET l'étreinte terminée.
  fwUpdateCouple(dt, elapsed);
  if (fwPhase === 'arrivee' && elapsed >= FW_NIGHT_AT && fwCoupleDone()) fwPhase = 'charge';

  const target = Math.min(1, fwTapCount / FW_TAP_GOAL);
  fwCharge += (target - fwCharge) * Math.min(1, dt * 8);

  fwThemeTimer -= dt;
  if (fwThemeTimer <= 0) { fwThemeIndex = Math.floor(Math.random() * FW_THEMES.length); fwThemeTimer = 4 + Math.random() * 4; }

  if (fwPhase === 'show') {
    // Petit délai « léger » : musique seule, puis on allume les feux + leurs bruits.
    if (!fwFireStarted) {
      if (now - fwShowStart >= FW_FIRE_DELAY) fwIgniteFireworks();
    } else {
      // Tirs automatiques.
      fwShowTimer -= dt;
      if (fwShowTimer <= 0) {
        const volley = Math.random() < 0.45 ? 2 + Math.floor(Math.random() * 4) : 1;
        for (let i = 0; i < volley; i++) fwAutoLaunch();
        fwShowTimer = 0.22 + Math.random() * 0.5;
        if (Math.random() < 0.1) fwShowTimer += 0.5;
      }

      const fireElapsed = now - fwFireStart;

      // Message « Bon anniversaire! » : plusieurs fusées explosent de gauche à
      // droite et leurs braises se rassemblent pour former les lettres.
      if (!fwTextTriggered && fireElapsed >= FW_MSG_AT) {
        fwBuildTextFirework('Bon anniversaire!'); fwTextTriggered = true; fwTextStart = now;
      }
      for (const cl of fwTextClusters) {
        if (!cl.launched && now - fwTextStart >= cl.rocketAt) {
          cl.launched = true;
          const dist = (window.innerHeight + 6) - cl.cy;
          fwSpawnRocket({
            x: cl.cx, y: window.innerHeight + 6, vx: 0, vy: -(dist / 0.55),
            targetY: cl.cy, color: cl.color, type: 'sphere', textCluster: cl.index,
          });
        }
      }
      if (fwTextParticles.length) {
        const conv = Math.min(1, dt * 6);
        for (const tp of fwTextParticles) {
          if (tp.active) { tp.x += (tp.tx - tp.x) * conv; tp.y += (tp.ty - tp.y) * conv; }
        }
        if (fireElapsed > FW_MSG_AT + FW_MSG_DUR) { fwTextParticles = []; fwTextClusters = []; } // nettoyage
      }

      // Photos (après le message) : chacune une fois, dans l'ordre aléatoire.
      if (fireElapsed >= FW_PHOTOS_START) {
        if (fwPhotoNext < fwPhotoOrder.length) {
          fwPhotoTimer -= dt * 1000;
          if (fwPhotoTimer <= 0) { fwSpawnPhoto(fwPhotoOrder[fwPhotoNext]); fwPhotoNext++; fwPhotoTimer = FW_PHOTO_SPAWN; }
        } else if (fwPhotos.length === 0) {
          // Toutes les photos sont passées : on laisse encore les feux quelques
          // secondes, puis l'écran de fin.
          if (fwPhotosDoneAt === 0) fwPhotosDoneAt = now;
          if (now - fwPhotosDoneAt >= FW_END_DELAY) { fwPhase = 'end'; fwEndStart = now; }
        }
      }
    }
  }

  // Fusées.
  for (let i = fwRockets.length - 1; i >= 0; i--) {
    const r = fwRockets[i];
    r.trail.push({ x: r.x, y: r.y });
    if (r.trail.length > 6) r.trail.shift();
    r.x += r.vx * dt; r.y += r.vy * dt; r.vy += grav * 0.35 * dt;
    if (r.y <= r.targetY || r.vy >= 0) {
      fwExplode(r.x, r.y, r.color, r.type);
      if (r.textCluster != null) fwActivateTextCluster(r.textCluster, r.x, r.y);
      fwRockets.splice(i, 1);
    }
  }

  // Particules.
  for (let i = fwParticles.length - 1; i >= 0; i--) {
    const p = fwParticles[i];
    p.life -= dt;
    if (p.life <= 0) { fwParticles.splice(i, 1); continue; }
    if (!p.flash) { p.vy += grav * p.gmul * dt; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; }
  }

  // Photos.
  for (let i = fwPhotos.length - 1; i >= 0; i--) {
    const ph = fwPhotos[i];
    ph.y += ph.vy * dt;
    if (now - ph.born > ph.life) fwPhotos.splice(i, 1);
  }
}

// Fond en fondu jour -> coucher -> nuit.
function fwDrawBackground(assets, elapsed) {
  const imgs = assets && assets.place8;
  if (!imgs) { ctx.fillStyle = '#05050c'; ctx.fillRect(0, 0, window.innerWidth, window.innerHeight); return; }
  const t1 = FW_DAY_HOLD, t2 = t1 + FW_FADE, t3 = t2 + FW_SUNSET_HOLD, t4 = t3 + FW_FADE;
  let from = 2, to = 2, blend = 1;
  if (elapsed < t1) { from = 0; to = 0; blend = 0; }
  else if (elapsed < t2) { from = 0; to = 1; blend = (elapsed - t1) / FW_FADE; }
  else if (elapsed < t3) { from = 1; to = 1; blend = 0; }
  else if (elapsed < t4) { from = 1; to = 2; blend = (elapsed - t3) / FW_FADE; }
  drawBackgroundCover(imgs[from]);
  if (blend > 0 && to !== from) { ctx.save(); ctx.globalAlpha = blend; drawBackgroundCover(imgs[to]); ctx.restore(); }
}

// Une photo souvenir (cadre polaroïd, léger balancement, fondu entrée/sortie).
function fwDrawPhoto(p, now) {
  const age = now - p.born;
  let a = 1;
  if (age < 800) a = age / 800;
  else if (age > p.life - 1200) a = Math.max(0, (p.life - age) / 1200);
  if (a <= 0.01) return;
  const sway = Math.sin(now / 900 + p.swayPhase) * p.swayAmp;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(p.x + sway, p.y);
  ctx.rotate(p.rot);
  // Pas de cadre ajouté (l'image en a déjà un) : juste une ombre douce pour
  // détacher la photo du feu d'artifice en fond.
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(p.img, -p.w / 2, -p.h / 2, p.w, p.h);
  ctx.restore();
}

// --- Rendu ---
function drawFireworksScene(assets, elapsed, dt) {
  fwAssets = assets;
  updateFireworks(dt, elapsed);
  const W = window.innerWidth, H = window.innerHeight, t = performance.now(), S = fwScale();
  canvas.style.cursor = fwPhase === 'charge' ? 'pointer' : 'default';

  fwDrawBackground(assets, elapsed);

  // Le couple : devant le décor, mais sous les feux (qui l'éclairent).
  fwDrawCouple(assets);

  // Feux (additif).
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'lighter';
  for (const r of fwRockets) {
    for (let k = 0; k < r.trail.length; k++) {
      const a = (k + 1) / r.trail.length * 0.5;
      const sz = Math.max(1, Math.round(S * 2));
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${r.color[0]},${r.color[1]},${r.color[2]})`;
      ctx.fillRect(Math.round(r.trail[k].x), Math.round(r.trail[k].y), sz, sz);
    }
    const hz = Math.max(2, Math.round(S * 3));
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff8e0';
    ctx.fillRect(Math.round(r.x - hz / 2), Math.round(r.y - hz / 2), hz, hz);
  }
  for (const p of fwParticles) {
    const lifeRatio = p.life / p.maxLife;
    let a = p.flash ? lifeRatio : Math.min(1, lifeRatio * 1.4);
    if (!p.flash && lifeRatio < 0.5) a *= 0.6 + 0.4 * Math.abs(Math.sin(t / 60 + p.flick));
    if (a <= 0.02) continue;
    const sz = Math.max(1, Math.round(p.size * (0.6 + 0.4 * lifeRatio)));
    ctx.globalAlpha = a;
    ctx.fillStyle = `rgb(${p.col[0]},${p.col[1]},${p.col[2]})`;
    ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
  }

  ctx.restore();

  // Message « Bon anniversaire! » : lettres pleines et nettes par-dessus les feux
  // (source-over), avec un léger halo doré. Voir fwDrawMessage.
  fwDrawMessage(t);

  // Photos souvenir.
  for (const p of fwPhotos) fwDrawPhoto(p, t);

  // UI de la phase de charge.
  if (fwPhase === 'charge') {
    ctx.save();
    const pulse = 0.7 + 0.3 * Math.sin(t / 260);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = pulse; ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(H * 0.045)}px 'PressStart2P'`;
    ctx.fillText('Clic, clic, clic !', W / 2, H * 0.42);
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffd76a';
    ctx.font = `${Math.round(H * 0.024)}px 'PressStart2P'`;
    ctx.fillText('pour déclencher le feu d’artifice', W / 2, H * 0.42 + H * 0.06);
    const bw = Math.min(W * 0.5, 420 * uiSizeFactor());
    const bh = Math.max(10, H * 0.028);
    const bx = W / 2 - bw / 2, by = H * 0.6;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffd76a'; ctx.fillRect(bx, by, bw * fwCharge, bh);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, S); ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();
  }

  // Écran de fin : « Fin... » s'affiche d'abord et reste visible ~2,5 s, PUIS un
  // long fondu au noir de 8 s ; la musique dure jusqu'au bout.
  if (fwPhase === 'end') {
    const e = t - fwEndStart;

    // Fondu au noir DIFFÉRÉ : ne commence qu'une fois « Fin... » affiché ~2,5 s.
    const k = Math.max(0, Math.min(1, (e - FW_FIN_HOLD) / FW_END_FADE));
    fillBlack(k);

    // L'ambiance des feux s'éteint pendant le début du fondu.
    fwFireSound.volume = FW_FIRE_VOLUME * Math.max(0, Math.min(1, 1 - (e - FW_FIN_HOLD) / 3000));
    if (fwFireSound.volume <= 0.001 && !fwFireSound.paused) { try { fwFireSound.pause(); } catch (err) {} }

    // La musique reste à fond, puis s'éteint en douceur vers la toute fin.
    const mFadeStart = FW_FIN_HOLD + 3500, mFadeDur = 5500;
    if (e >= mFadeStart) {
      const mk = Math.min(1, (e - mFadeStart) / mFadeDur);
      fwMusic.volume = 0.5 * (1 - mk);
      if (mk >= 1 && !fwMusic.paused) fwMusic.pause();
    }

    // « Fin... » par-dessus (fondu d'entrée), reste visible pendant tout le fondu.
    ctx.save();
    ctx.globalAlpha = Math.min(1, e / 900);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(H * 0.06)}px 'PressStart2P'`;
    ctx.fillText('Fin...', W / 2, H / 2);
    ctx.restore();
  }

  drawSceneFadeIn(elapsed, 600);
}

// --- Entrées ---
canvas.addEventListener('pointerdown', (evt) => {
  if (scene !== 'fireworks') return;
  const x = getPointerPos(evt).x;
  if (fwPhase === 'charge') { fwPlayClick(); fwTapCharge(x); } // clic synchro au tap
  else if (fwPhase === 'show') fwSpawnRocket({ x, type: 'sphere' }); // pas de son ici
  if (!fwAudioUnlocked) { unlockAudio(); fwAudioUnlocked = true; }
});
window.addEventListener('keydown', (e) => {
  if (scene !== 'fireworks') return;
  if (e.code === 'Space' || e.code === 'Enter') {
    const x = window.innerWidth * (0.3 + Math.random() * 0.4);
    if (fwPhase === 'charge') { fwPlayClick(); fwTapCharge(x); }
    else if (fwPhase === 'show') fwSpawnRocket({ x });
    if (!fwAudioUnlocked) { unlockAudio(); fwAudioUnlocked = true; }
    e.preventDefault();
  }
});
