// ============================================================
// Mini-jeu : la pluie de chats. Écran noir. Lauren tient un panier (assets
// WalkPanier) et se déplace à gauche/droite (flèches). Des chatons tombent du
// ciel ; il faut en rattraper 30 dans le panier en 60 secondes. Compteur et
// chrono affichés. Objectif atteint -> victoire ; temps écoulé -> "Réessayer".
//
// Travaille dans l'espace de design 960x540 (comme les décors) pour une échelle
// cohérente sur tout écran.
// ============================================================

const CAT_DURATION = 40;      // secondes (plus dur)
const CAT_GOAL = 30;          // chats à sauver
const CAT_INTRO_MS = 2200;    // court écran d'intro avant le départ du chrono
const CAT_SPAWN_MS = 470;     // intervalle d'apparition (plus de chats pour tenir en 40 s)
const CAT_GROUND_Y = 505;     // pieds de Lauren (coords design)
const CAT_BASKET_H = 200;     // hauteur d'affichage du sprite panier (coords design)
const CAT_BASKET_SPEED = 340; // vitesse de déplacement du panier (design px/s)
const CAT_MIN_X = 90;
const CAT_MAX_X = 870;
const CAT_SIZE_W = 92;        // largeur d'affichage d'un chat (coords design)

// audio miaou (rattrapage)
const catMeow = new Audio('Assets/Sound/Chat/Miaou.mp3');
catMeow.volume = 0.5;
registerAudioForUnlock(catMeow);
let catLastMeow = 0;

let catPhase = 'intro';       // 'intro' -> 'play' -> 'win' | 'lose' -> 'exit'
let catIntroStart = 0;
let catCount = 0;
let catBasketX = 480;
let catFacing = 'right';
let catFrame = 0;
let catFrameElapsed = 0;
let cats = [];
let catSpawnTimer = 0;
let catTimeLeft = CAT_DURATION;
let catWinStart = 0;
let catExitStart = 0;
let catAssets = null;

const CAT_EXIT_FADE = 1200;

function catGameReset() {
  catPhase = 'intro';
  catIntroStart = performance.now();
  catCount = 0;
  catBasketX = 480;
  catFacing = 'right';
  catFrame = 0;
  catFrameElapsed = 0;
  cats = [];
  catSpawnTimer = 0;
  catTimeLeft = CAT_DURATION;
}

function getCatContainT() {
  return getContainTransform(960, 540, window.innerWidth, window.innerHeight);
}

// Grande Roue qui tourne (coords 6.png). On isole une région circulaire autour
// du moyeu et on la fait pivoter lentement. NB : depuis une image plate, le
// fond et les pieds de la roue à l'intérieur du cercle tournent aussi ; pour un
// rendu parfait il faudrait la roue en calque séparé.
const CAT_WHEEL_CX = 342;   // centre de la roue
const CAT_WHEEL_CY = 150;
const CAT_WHEEL_R = 140;    // rayon du cercle qui tourne
const CAT_WHEEL_SPEED = 0.12; // rad/s (lent)

let catWheelTex = null;
function buildCatWheelTex(img) {
  const size = CAT_WHEEL_R * 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  // Copie la région carrée centrée sur le moyeu.
  g.drawImage(img, CAT_WHEEL_CX - CAT_WHEEL_R, CAT_WHEEL_CY - CAT_WHEEL_R, size, size, 0, 0, size, size);
  return c;
}

function drawSpinningWheel(img, containT) {
  if (!catWheelTex) catWheelTex = buildCatWheelTex(img);
  const scale = containT.scale;
  const cx = containT.dx + CAT_WHEEL_CX * scale;
  const cy = containT.dy + CAT_WHEEL_CY * scale;
  const r = CAT_WHEEL_R * scale;
  const angle = performance.now() * 0.001 * CAT_WHEEL_SPEED;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(catWheelTex, -r, -r, r * 2, r * 2);
  ctx.restore();
}

// Centre du panier (coords design) — dépend du sens dans lequel Lauren regarde,
// car le sprite est retourné quand elle va à gauche.
function catBasketCenter() {
  const drawW = CAT_BASKET_H * 0.75; // sprite 300x400 -> ratio 0.75
  const left = catBasketX - drawW / 2;
  // panier ~ à 30% depuis la gauche du sprite quand elle regarde à droite
  const cx = catFacing === 'right' ? left + drawW * 0.3 : left + drawW * 0.7;
  const cy = (CAT_GROUND_Y - CAT_BASKET_H) + CAT_BASKET_H * 0.6;
  return { cx, cy, halfW: drawW * 0.24 };
}

function catSpawn() {
  const imgs = catAssets.cats;
  cats.push({
    x: CAT_MIN_X + Math.random() * (CAT_MAX_X - CAT_MIN_X),
    y: -30,
    vy: 130 + Math.random() * 70,
    img: imgs[Math.floor(Math.random() * imgs.length)],
    sway: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI * 2,          // orientation initiale
    rotSpeed: (Math.random() * 2 - 1) * 3.2,    // vitesse de rotation (sens aléatoire)
  });
}

function updateCatGame(dt) {
  // Déplacement du panier (toujours actif, même pendant l'intro).
  const dir = keyDirection();
  if (dir !== 0) {
    catBasketX = Math.max(CAT_MIN_X, Math.min(CAT_MAX_X, catBasketX + dir * CAT_BASKET_SPEED * dt));
    catFacing = dir < 0 ? 'left' : 'right';
    catFrameElapsed += dt * 1000;
    while (catFrameElapsed >= CHARACTER_WALK_FRAME_DURATION) {
      catFrameElapsed -= CHARACTER_WALK_FRAME_DURATION;
      catFrame = (catFrame + 1) % catAssets.laurenBasket.length;
    }
  } else {
    catFrame = 0;
    catFrameElapsed = 0;
  }

  if (catPhase === 'intro') {
    if (performance.now() - catIntroStart >= CAT_INTRO_MS) catPhase = 'play';
    return;
  }
  if (catPhase !== 'play') return;

  catTimeLeft -= dt;

  // Apparition des chats.
  catSpawnTimer += dt * 1000;
  if (catSpawnTimer >= CAT_SPAWN_MS) {
    catSpawnTimer -= CAT_SPAWN_MS;
    catSpawn();
  }

  // Chute + rattrapage.
  const basket = catBasketCenter();
  for (let i = cats.length - 1; i >= 0; i--) {
    const cat = cats[i];
    cat.y += cat.vy * dt;
    cat.rot += cat.rotSpeed * dt; // le chat tournoie pendant sa chute
    if (cat.y >= basket.cy && cat.y <= basket.cy + 55 &&
        Math.abs(cat.x - basket.cx) <= basket.halfW) {
      cats.splice(i, 1);
      catCount++;
      const now = performance.now();
      if (now - catLastMeow > 120) { catLastMeow = now; catMeow.currentTime = 0; catMeow.play().catch(() => {}); }
      if (catCount >= CAT_GOAL) { catPhase = 'win'; catWinStart = now; }
      continue;
    }
    if (cat.y > 560) cats.splice(i, 1); // raté
  }

  if (catTimeLeft <= 0 && catPhase === 'play') {
    catTimeLeft = 0;
    catPhase = 'lose';
  }
}

// ---------- Rendu ----------
function drawCatSprite(containT) {
  const moving = keyDirection() !== 0;
  const img = moving ? catAssets.laurenBasket[catFrame] : catAssets.laurenBasket[0];
  const drawH = CAT_BASKET_H * containT.scale;
  const drawW = drawH * (img.width / img.height);
  const feetX = containT.dx + catBasketX * containT.scale;
  const feetY = containT.dy + CAT_GROUND_Y * containT.scale;
  ctx.save();
  ctx.translate(feetX, feetY);
  if (catFacing === 'left') ctx.scale(-1, 1);
  ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
}

function drawCats(containT) {
  for (const cat of cats) {
    const w = CAT_SIZE_W * containT.scale;
    const h = w * (cat.img.height / cat.img.width);
    const sway = Math.sin(cat.y / 40 + cat.sway) * 8;
    const cx = containT.dx + (cat.x + sway) * containT.scale;
    const cy = containT.dy + cat.y * containT.scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(cat.rot);
    ctx.drawImage(cat.img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function drawCatHud() {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  const fs = Math.round(window.innerHeight * 0.038);
  ctx.font = `${fs}px 'PressStart2P'`;
  // Ombre portée : lisibilité par-dessus le ciel orangé.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = Math.max(2, fs * 0.2);
  ctx.shadowOffsetY = 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(`Chats : ${catCount}/${CAT_GOAL}`, window.innerWidth * 0.03, window.innerHeight * 0.04);
  ctx.textAlign = 'right';
  ctx.fillStyle = catTimeLeft <= 10 ? '#ff8a80' : '#9fd4ff';
  ctx.fillText(`${Math.ceil(catTimeLeft)}s`, window.innerWidth * 0.97, window.innerHeight * 0.04);
  ctx.restore();
}

function drawCatIntro() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(window.innerHeight * 0.05)}px 'PressStart2P'`;
  ctx.fillText('Sauve les chatons !', window.innerWidth / 2, window.innerHeight * 0.4);
  ctx.font = `${Math.round(window.innerHeight * 0.03)}px 'PressStart2P'`;
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(`${CAT_GOAL} chats en ${CAT_DURATION}s`, window.innerWidth / 2, window.innerHeight * 0.52);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${Math.round(window.innerHeight * 0.024)}px 'PressStart2P'`;
  ctx.fillText('← →  déplace le panier', window.innerWidth / 2, window.innerHeight * 0.62);
  ctx.restore();
}

function catRetryRect() {
  const w = Math.min(window.innerWidth * 0.4, 280) * uiSizeFactor();
  const h = w / (1349 / 255);
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.62, w, h };
}

function drawCatResult(assets) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(window.innerHeight * 0.045)}px 'PressStart2P'`;
  ctx.fillText('Temps écoulé', window.innerWidth / 2, window.innerHeight * 0.36);
  ctx.font = `${Math.round(window.innerHeight * 0.032)}px 'PressStart2P'`;
  ctx.fillStyle = '#ffd76a';
  ctx.fillText(`${catCount} chats sauvés`, window.innerWidth / 2, window.innerHeight * 0.48);
  ctx.restore();
  drawPill(assets.menuBouton, 'Réessayer', catRetryRect());
}

function drawCatWin() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = '#ff9ec2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(window.innerHeight * 0.09)}px 'Courier New', monospace`;
  ctx.fillText('❤', window.innerWidth / 2, window.innerHeight * 0.4);
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(window.innerHeight * 0.04)}px 'PressStart2P'`;
  ctx.fillText('Tous sauvés !', window.innerWidth / 2, window.innerHeight * 0.54);
  ctx.restore();
}

// ---------- Entrées ----------
function handleCatDown(evt) {
  if (catPhase === 'lose' && pointInRect(getPointerPos(evt), catRetryRect())) {
    catGameReset();
  }
}
canvas.addEventListener('pointerdown', (evt) => { if (scene === 'catgame') handleCatDown(evt); });

// ---------- Scène ----------
function drawCatGameScene(assets, elapsed, dt) {
  catAssets = assets;
  const containT = getCatContainT();

  // Bordures noires (letterbox) puis le décor de la Grande Roue + l'eau animée.
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  if (assets.place6Fond) {
    drawBackgroundContain(assets.place6Fond, containT);
    drawSpinningWheel(assets.place6Fond, containT);
  }

  updateCatGame(dt);

  drawCats(containT);
  drawCatSprite(containT);
  drawCatHud();

  if (catPhase === 'intro') drawCatIntro();
  else if (catPhase === 'lose') drawCatResult(assets);
  else if (catPhase === 'win' || catPhase === 'exit') {
    drawCatWin();
    if (catPhase === 'win' && performance.now() - catWinStart >= 2000) {
      catPhase = 'exit';
      catExitStart = performance.now();
    }
  }

  if (elapsed < 500) {
    ctx.save();
    ctx.globalAlpha = 1 - elapsed / 500;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
  }

  if (catPhase === 'exit') {
    const t = Math.min((performance.now() - catExitStart) / CAT_EXIT_FADE, 1);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
    if (t >= 1) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(window.innerHeight * 0.05)}px 'PressStart2P'`;
      ctx.fillText('À suivre...', window.innerWidth / 2, window.innerHeight / 2);
      ctx.restore();
    }
  }
}
