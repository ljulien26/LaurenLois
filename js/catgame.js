// ============================================================
// Décor 6 : la Grande Roue. Lauren arrive, un panier (avec un chaton qui sort
// la tête) est posé au sol avec un halo. Elle marche jusqu'à lui et clique :
// une question se lance (« Qui des 2 est le plus un mimi kely ? » — même style,
// mêmes bruitages que les autres questions). Bonne réponse -> le mini-jeu se
// lance : Lauren tient le panier et rattrape les chatons qui tombent (30 en
// 40 s). Qu'elle réussisse ou non, elle finit sur « Bravo, tu as sauvé tous les
// petits chats ». Travaille dans l'espace de design 960x540.
// ============================================================

// ---------- Mini-jeu (pluie de chats) ----------
const CAT_DURATION = 40;      // secondes (plus dur)
const CAT_GOAL = 30;          // chats à sauver
const CAT_INTRO_MS = 2200;    // court écran d'intro avant le départ du chrono
const CAT_SPAWN_MS = 470;     // intervalle d'apparition
const CAT_GROUND_Y = 505;     // sol (coords design)
const CAT_BASKET_H = 200;     // hauteur d'affichage du sprite panier (coords design)
const CAT_BASKET_SPEED = 340; // vitesse de déplacement du panier (design px/s)
const CAT_MIN_X = 90;
const CAT_MAX_X = 870;
const CAT_SIZE_W = 72;        // largeur d'affichage d'un chat qui tombe (coords design)

// ---------- Phase marche + objet panier au sol ----------
const CAT_LAUREN_START_X = 140;
const CAT_LAUREN_SCALE = 0.85;
const CAT_OBJ_X = 640;        // panier-chat posé au sol (coords design)
const CAT_OBJ_Y = 498;
const CAT_OBJ_W = 72;         // largeur du panier
const CAT_OBJ_REACH = 165;    // distance max (x) pour pouvoir cliquer

// ---------- Question ----------
const CAT_QUESTION = 'Qui des 2 est le plus un mimi kely ?';
const CAT_ANSWERS = ['Lauren', 'Loïs'];
const CAT_CORRECT = 0; // Lauren

// audio miaou (rattrapage)
const catMeow = new Audio('Assets/Sound/Chat/Miaou.mp3');
catMeow.volume = 0.3;
registerAudioForUnlock(catMeow);
let catLastMeow = 0;

// Phases : 'walk' -> 'question' -> 'intro' -> 'play' -> 'win' -> 'exit'.
let catPhase = 'walk';
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

let catQuestionStart = null;
let catPicked = -1;
let catPickedStart = 0;
let catPickedCorrect = false;

const CAT_EXIT_FADE = 1200;
const CAT_WIN_MS = 2800;

const catLauren = createCharacter(
  CAT_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, CAT_LAUREN_SCALE, 2
);

function catGameReset() {
  catPhase = 'walk';
  catQuestionStart = null;
  catPicked = -1;
  catLauren.x = CAT_LAUREN_START_X;
  catLauren.facing = 'right';
  catLauren.walking = false;
  catLauren.targetX = null;
  // état du mini-jeu (remis à zéro pour de bon au lancement du jeu)
  catCount = 0;
  cats = [];
  catSpawnTimer = 0;
  catTimeLeft = CAT_DURATION;
  catBasketX = 480;
  catFacing = 'right';
  catFrame = 0;
  catFrameElapsed = 0;
}

// Bonne réponse donnée : on démarre le mini-jeu.
function catStartMinigame() {
  catPhase = 'intro';
  catIntroStart = performance.now();
  catCount = 0;
  cats = [];
  catSpawnTimer = 0;
  catTimeLeft = CAT_DURATION;
  catBasketX = 480;
  catFacing = 'right';
  catFrame = 0;
  catFrameElapsed = 0;
}

function getCatContainT() {
  return getContainTransform(960, 540, window.innerWidth, window.innerHeight);
}

// ---------- Phase marche : Lauren + panier-chat au sol ----------
function updateCatWalk(dt) {
  stepPlayerWalk(catLauren, keyDirection(), dt, CAT_MIN_X, CAT_MAX_X);
}

function laurenNearCatObj() {
  return Math.abs(catLauren.x - CAT_OBJ_X) <= CAT_OBJ_REACH;
}

// Panier en osier (dessiné) avec un chaton qui sort la tête (bob) + halo.
function drawCatBasketObject(containT) {
  const scale = containT.scale;
  const cx = containT.dx + CAT_OBJ_X * scale;
  const gy = containT.dy + CAT_OBJ_Y * scale; // base du panier (sol)
  const bw = CAT_OBJ_W * scale;
  const bh = bw * 0.6;
  const by = gy - bh; // rebord haut du panier
  const t = performance.now();
  const bob = Math.sin(t / 320) * bh * 0.16;

  // halo pulsé (repère cliquable)
  const pulse = 0.22 + Math.sin(t / 360) * 0.12;
  ctx.save();
  ctx.globalAlpha = Math.max(0, pulse);
  ctx.globalCompositeOperation = 'lighter';
  const hr = bw * 1.05;
  const hy = by - bh * 0.3;
  const glow = ctx.createRadialGradient(cx, hy, 0, cx, hy, hr);
  glow.addColorStop(0, 'rgba(255, 226, 150, 0.85)');
  glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - hr, hy - hr, hr * 2, hr * 2);
  ctx.restore();

  // anse (derrière le chaton)
  ctx.save();
  ctx.strokeStyle = '#8a5c22';
  ctx.lineWidth = Math.max(2, bw * 0.07);
  ctx.beginPath();
  ctx.arc(cx, by, bw * 0.42, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.restore();

  // chaton qui sort la tête (bob) — le bas sera caché par le panier
  const cat = catAssets.cats[0];
  const cw = bw * 0.86;
  const ch = cw * (cat.height / cat.width);
  const catCenterY = by - bh * 0.05 + bob;
  ctx.drawImage(cat, cx - cw / 2, catCenterY - ch / 2, cw, ch);

  // corps du panier (osier) devant le bas du chaton
  ctx.save();
  const bx = cx - bw / 2;
  ctx.fillStyle = '#a9752f';
  roundRectPath(bx, by, bw, bh, bh * 0.16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 55, 20, 0.5)';
  ctx.lineWidth = Math.max(1, scale);
  for (let i = 1; i < 4; i++) {
    const yy = by + bh * i / 4;
    ctx.beginPath();
    ctx.moveTo(bx, yy);
    ctx.lineTo(bx + bw, yy);
    ctx.stroke();
  }
  // rebord
  ctx.fillStyle = '#c99450';
  roundRectPath(bx - bw * 0.05, by - bh * 0.1, bw * 1.1, bh * 0.22, bh * 0.11);
  ctx.fill();
  ctx.restore();
}

function drawCatWalkLauren(containT) {
  drawCharacter(catLauren, catAssets.laurenIdle, catAssets.laurenWalk, containT, catAssets.laurenPress, CAT_GROUND_Y);
}

// ---------- Question (même style que les autres) ----------
function catQuestionPanelRect() {
  const w = Math.min(window.innerWidth * 0.68, 560) * uiSizeFactor();
  const h = w / (1717 / 916);
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.08, w, h };
}

function catAnswerRects() {
  const panel = catQuestionPanelRect();
  const w = Math.min(window.innerWidth * 0.4, 270) * uiSizeFactor();
  const h = w / (1349 / 255);
  const gap = w * 0.14;
  const cx = window.innerWidth / 2;
  const y = panel.y + panel.h + h * 0.9;
  return [
    { x: cx - w - gap / 2, y, w, h },
    { x: cx + gap / 2, y, w, h },
  ];
}

function catAllTyped() {
  return questionTypingDone(catQuestionStart, CAT_QUESTION) &&
    answersTyping(catQuestionStart, CAT_QUESTION, CAT_ANSWERS).every((a) => a.full);
}

function drawCatQuestion(assets) {
  dimBackdrop();
  const panel = catQuestionPanelRect();
  const qDone = drawTypingQuestion(assets.quizPanel, panel, CAT_QUESTION, catQuestionStart, false);
  if (!qDone) {
    setKeyboardTyping(catQuestionStart != null);
    return;
  }
  const typing = answersTyping(catQuestionStart, CAT_QUESTION, CAT_ANSWERS);
  const rects = catAnswerRects();
  rects.forEach((r, i) => {
    if (!typing[i].visible) return;
    let img = assets.menuBouton;
    if (catPicked === i) img = catPickedCorrect ? assets.quizGood : assets.quizBad;
    drawTypedAnswerPill(img, CAT_ANSWERS[i], r, typing[i]);
  });
  setKeyboardTyping(!typing.every((a) => a.full));
}

function updateCatAnswer() {
  if (catPicked === -1) return;
  const held = performance.now() - catPickedStart;
  if (catPickedCorrect) {
    if (held >= 700) { catPicked = -1; catStartMinigame(); }
  } else if (held >= 600) {
    catPicked = -1;
  }
}

// ---------- Mini-jeu : apparition / chute / rattrapage ----------
function catSpawn() {
  const imgs = catAssets.cats;
  cats.push({
    x: CAT_MIN_X + Math.random() * (CAT_MAX_X - CAT_MIN_X),
    y: -30,
    vy: 130 + Math.random() * 70,
    img: imgs[Math.floor(Math.random() * imgs.length)],
    sway: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() * 2 - 1) * 3.2,
  });
}

function catBasketCenter() {
  const drawW = CAT_BASKET_H * 0.75;
  const left = catBasketX - drawW / 2;
  const cx = catFacing === 'right' ? left + drawW * 0.3 : left + drawW * 0.7;
  const cy = (CAT_GROUND_Y - CAT_BASKET_H) + CAT_BASKET_H * 0.6;
  return { cx, cy, halfW: drawW * 0.24 };
}

function updateCatGame(dt) {
  // Déplacement du panier (intro pour se positionner, puis pendant le jeu).
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
    // Le jeu (chrono + chute des chats) ne démarre qu'au 1er appui sur ← ou →.
    if (keyDirection() !== 0) catPhase = 'play';
    return;
  }
  if (catPhase !== 'play') return;

  catTimeLeft -= dt;

  catSpawnTimer += dt * 1000;
  if (catSpawnTimer >= CAT_SPAWN_MS) {
    catSpawnTimer -= CAT_SPAWN_MS;
    catSpawn();
  }

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

  // Temps écoulé sans les 30 chats : échec, il faut recommencer.
  if (catTimeLeft <= 0 && catPhase === 'play') {
    catTimeLeft = 0;
    catPhase = 'lose';
  }
}

// ---------- Rendu du mini-jeu ----------
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
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `${Math.round(window.innerHeight * 0.024)}px 'PressStart2P'`;
  ctx.fillText('Appuie sur ← ou → pour commencer', window.innerWidth / 2, window.innerHeight * 0.62);
  ctx.restore();
}

function catRetryRect() {
  const w = Math.min(window.innerWidth * 0.4, 280) * uiSizeFactor();
  const h = w / (1349 / 255);
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.64, w, h };
}

function drawCatLose(assets) {
  const w = window.innerWidth, h = window.innerHeight;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff8a80';
  ctx.font = `${Math.round(h * 0.055)}px 'PressStart2P'`;
  ctx.fillText('Dommage...', w / 2, h * 0.36);
  ctx.fillStyle = '#ffd76a';
  ctx.font = `${Math.round(h * 0.03)}px 'PressStart2P'`;
  ctx.fillText(`${catCount}/${CAT_GOAL} chats sauvés`, w / 2, h * 0.48);
  ctx.restore();
  drawPill(assets.menuBouton, 'Réessayer', catRetryRect());
}

function drawCatWin() {
  const w = window.innerWidth, h = window.innerHeight;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff9ec2';
  ctx.font = `${Math.round(h * 0.085)}px 'Courier New', monospace`;
  ctx.fillText('❤', w / 2, h * 0.33);
  ctx.fillStyle = '#ffd76a';
  ctx.font = `${Math.round(h * 0.055)}px 'PressStart2P'`;
  ctx.fillText('Bravo !', w / 2, h * 0.47);
  // phrase plus longue : police réduite pour tenir à l'écran
  ctx.fillStyle = '#ffffff';
  let fs = Math.round(h * 0.03);
  ctx.font = `${fs}px 'PressStart2P'`;
  const msg = 'Tu as sauvé tous les petits chats';
  const maxW = w * 0.9;
  const tw = ctx.measureText(msg).width;
  if (tw > maxW) { fs *= maxW / tw; ctx.font = `${fs}px 'PressStart2P'`; }
  ctx.fillText(msg, w / 2, h * 0.6);
  ctx.restore();
}

// ---------- Entrées ----------
function handleCatDown(evt) {
  const pos = getPointerPos(evt);

  if (catPhase === 'walk') {
    if (!laurenNearCatObj()) return;
    const containT = getCatContainT();
    const cx = containT.dx + CAT_OBJ_X * containT.scale;
    const cy = containT.dy + CAT_OBJ_Y * containT.scale;
    const rr = CAT_OBJ_W * containT.scale;
    if (Math.abs(pos.x - cx) <= rr && Math.abs(pos.y - cy) <= rr) {
      playClickSound();
      catPhase = 'question';
      catQuestionStart = performance.now();
    }
    return;
  }

  if (catPhase === 'question') {
    if (catPicked !== -1 || !catAllTyped()) return;
    const rects = catAnswerRects();
    for (let i = 0; i < rects.length; i++) {
      if (pointInRect(pos, rects[i])) {
        playClickSound();
        catPicked = i;
        catPickedStart = performance.now();
        catPickedCorrect = i === CAT_CORRECT;
        if (catPickedCorrect) playCorrectSound(); else playWrongSound();
        return;
      }
    }
    return;
  }

  if (catPhase === 'lose' && pointInRect(pos, catRetryRect())) {
    playClickSound();
    catStartMinigame();
  }
}
canvas.addEventListener('pointerdown', (evt) => { if (scene === 'catgame') handleCatDown(evt); });

// Curseur "main" au survol du panier-chat (marche), d'une réponse (question)
// ou du bouton Réessayer (échec).
canvas.addEventListener('pointermove', (evt) => {
  if (scene !== 'catgame') return;
  const pos = getPointerPos(evt);
  let over = false;
  if (catPhase === 'walk' && laurenNearCatObj()) {
    const containT = getCatContainT();
    const cx = containT.dx + CAT_OBJ_X * containT.scale;
    const cy = containT.dy + CAT_OBJ_Y * containT.scale;
    const rr = CAT_OBJ_W * containT.scale;
    over = Math.abs(pos.x - cx) <= rr && Math.abs(pos.y - cy) <= rr;
  } else if (catPhase === 'question' && catPicked === -1 && catAllTyped()) {
    over = catAnswerRects().some((r) => pointInRect(pos, r));
  } else if (catPhase === 'lose') {
    over = pointInRect(pos, catRetryRect());
  }
  canvas.style.cursor = over ? 'pointer' : 'default';
});

// ---------- Scène ----------
function drawCatGameScene(assets, elapsed, dt) {
  catAssets = assets;
  const containT = getCatContainT();

  // Décor de la Grande Roue sur fond noir (letterbox).
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  if (assets.place6Fond) {
    drawBackgroundContain(assets.place6Fond, containT);
  }

  updateCatAnswer();

  if (catPhase === 'walk') {
    updateCatWalk(dt);
  } else if (catPhase !== 'question') {
    updateCatGame(dt);
  }

  const preGame = catPhase === 'walk' || catPhase === 'question';
  if (preGame) {
    drawCatBasketObject(containT);
    drawCatWalkLauren(containT);
    if (catPhase === 'walk') drawKeyboardMoveHint();
  } else {
    drawCats(containT);
    drawCatSprite(containT);
    drawCatHud();
  }

  if (catPhase === 'question') drawCatQuestion(assets);
  else if (catPhase === 'intro') drawCatIntro();
  else if (catPhase === 'lose') drawCatLose(assets);
  else if (catPhase === 'win' || catPhase === 'exit') {
    drawCatWin();
    if (catPhase === 'win' && performance.now() - catWinStart >= CAT_WIN_MS) {
      catPhase = 'exit';
      catExitStart = performance.now();
    }
  }

  // Fondu d'arrivée depuis le noir.
  drawSceneFadeIn(elapsed, 500);

  if (catPhase === 'exit') {
    const t = Math.min((performance.now() - catExitStart) / CAT_EXIT_FADE, 1);
    fillBlack(t);
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
