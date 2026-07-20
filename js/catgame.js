// ============================================================
// Mini-jeu : la pluie de chats. Écran noir. Lauren tient un panier (assets
// WalkPanier) et se déplace à gauche/droite (flèches). Des chatons tombent du
// ciel ; il faut en rattraper 30 dans le panier en 60 secondes. Compteur et
// chrono affichés. Objectif atteint -> victoire ; temps écoulé -> "Réessayer".
//
// Travaille dans l'espace de design 960x540 (comme les décors) pour une échelle
// cohérente sur tout écran.
// ============================================================

const CAT_DURATION = 60;      // secondes
const CAT_GOAL = 30;          // chats à sauver
const CAT_INTRO_MS = 2200;    // court écran d'intro avant le départ du chrono
const CAT_SPAWN_MS = 620;     // intervalle moyen d'apparition d'un chat
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

// Bande d'eau (reflets) du décor 6, en coordonnées de l'image (960x540).
const CAT_WATER_TOP = 352;
const CAT_WATER_BOTTOM = 432;

// Anime l'eau : chaque ligne de la bande de reflets est redessinée avec un léger
// décalage horizontal qui ondule dans le temps (l'eau proche bouge davantage),
// plus une scintillance dorée qui dérive lentement.
function drawCatWater(img, containT) {
  const scale = containT.scale;
  const t = performance.now();
  const maxAmp = 3.2; // amplitude max (px source)
  const overW = (maxAmp + 1) * scale + 2;

  for (let sy = CAT_WATER_TOP; sy < CAT_WATER_BOTTOM; sy++) {
    const depth = (sy - CAT_WATER_TOP) / (CAT_WATER_BOTTOM - CAT_WATER_TOP);
    const amp = (0.5 + depth * 1.5) * maxAmp;
    const off = (Math.sin(sy * 0.22 + t * 0.0022) * amp +
                 Math.sin(sy * 0.55 - t * 0.0031) * amp * 0.4) * scale;
    const dx = containT.dx - overW + off;
    const dy = containT.dy + sy * scale;
    // dest légèrement plus large (overW de chaque côté) : jamais de trou au bord.
    ctx.drawImage(img, 0, sy, img.width, 1, dx, dy, containT.dw + overW * 2, scale + 1);
  }

  // Scintillance : quelques halos dorés qui dérivent sur l'eau.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bandY = containT.dy + CAT_WATER_TOP * scale;
  const bandH = (CAT_WATER_BOTTOM - CAT_WATER_TOP) * scale;
  for (let i = 0; i < 3; i++) {
    const p = ((t * 0.00012 + i / 3) % 1);
    const cx = containT.dx - 120 + p * (containT.dw + 240);
    const cy = bandY + bandH * (0.45 + 0.25 * i / 3);
    const a = Math.max(0, 0.05 + 0.04 * Math.sin(t * 0.001 + i * 2));
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, containT.dw * 0.16);
    glow.addColorStop(0, `rgba(255, 214, 150, ${a})`);
    glow.addColorStop(1, 'rgba(255, 214, 150, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(containT.dx, bandY, containT.dw, bandH);
  }
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
    const x = containT.dx + (cat.x + sway) * containT.scale - w / 2;
    const y = containT.dy + cat.y * containT.scale - h / 2;
    ctx.drawImage(cat.img, x, y, w, h);
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
    drawCatWater(assets.place6Fond, containT);
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
