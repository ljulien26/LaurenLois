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
const CAT_DURATION = 37;      // secondes
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
const CAT_OBJ_REACH = 165;    // distance max (x) pour pouvoir cliquer

// ---------- Question ----------
const CAT_QUESTION = 'Qui des 2 est le plus un mimi kely ?';
const CAT_ANSWERS = ['Lauren', 'Loïs'];
const CAT_CORRECT = 0; // Lauren

// audio miaou (rattrapage)
const catMeow = new Audio('Assets/Sound/Chat/Miaou.mp3');
catMeow.volume = 0.14;
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

// ---------- Panier au sol (asset Panier.png) + chaton qui dépasse ----------
// Géométrie repérée dans Panier.png (cadre 960x540) :
const CAT_BASKET_SPR_CX = 476;    // centre X du contenu (px sprite)
const CAT_BASKET_SPR_BOT = 530;   // bas du panier posé au sol (px sprite)
const CAT_BASKET_SPR_W = 536;     // largeur du contenu (px sprite)
const CAT_BASKET_DISPLAY_W = 69.6; // largeur d'affichage du panier (px design, -13 %)
const CAT_BASKET_RIM_Y = 206;     // ligne du rebord : le chat est masqué en dessous
// Tête du chat : région source (dans le sprite du chat) + emplacement dans le
// cadre du panier (px sprite). Cadré large pour remplir l'ouverture (le chaton
// a l'air posé DANS le panier : oreilles + yeux + museau, menton sous le rebord).
const CAT_HEAD_SRC = { x: 176, y: 15, w: 300, h: 300 };
const CAT_HEAD_DST = { cx: 476, top: 28, size: 210 };

// Transforme le cadre 960x540 du sprite panier vers l'écran (contenu centré en
// CAT_OBJ_X, bas posé sur le sol CAT_OBJ_Y). Renvoie {originX, originY, s} tels
// que le point sprite (sx,sy) est à l'écran en (originX + sx*s, originY + sy*s).
function catBasketFrame(containT) {
  const ks = CAT_BASKET_DISPLAY_W / CAT_BASKET_SPR_W; // design px / px-sprite
  const s = ks * containT.scale;                       // écran px / px-sprite
  const originX = containT.dx + (CAT_OBJ_X - CAT_BASKET_SPR_CX * ks) * containT.scale;
  const originY = containT.dy + (CAT_OBJ_Y - CAT_BASKET_SPR_BOT * ks) * containT.scale;
  return { originX, originY, s };
}

// Rectangle écran cliquable du panier (un peu élargi pour cliquer aisément).
function catBasketHitRect(containT) {
  const f = catBasketFrame(containT);
  // Boîte autour du contenu du panier (x[208..744], y[60..540] du sprite),
  // légèrement agrandie.
  const x1 = f.originX + 190 * f.s, x2 = f.originX + 762 * f.s;
  const y1 = f.originY + 40 * f.s, y2 = f.originY + 540 * f.s;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function drawCatBasketObject(containT) {
  const f = catBasketFrame(containT);
  const t = performance.now();
  const bob = Math.sin(t / 320) * 6; // léger va-et-vient de la tête (px sprite)

  // Halo de lumière pour attirer l'oeil (« va cliquer là-bas ») : un halo central
  // qui respire + une étincelle qui ORBITE autour du panier (mouvement bien
  // visible qui désigne l'objet).
  const cxs = f.originX + CAT_BASKET_SPR_CX * f.s;
  const cys = f.originY + 260 * f.s;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Halo central pulsé.
  const pulse = 0.26 + Math.sin(t / 340) * 0.14;
  const hr = (150 + Math.sin(t / 520) * 20) * f.s;
  ctx.globalAlpha = Math.max(0, pulse);
  let glow = ctx.createRadialGradient(cxs, cys, 0, cxs, cys, hr);
  glow.addColorStop(0, 'rgba(255, 226, 150, 0.85)');
  glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cxs - hr, cys - hr, hr * 2, hr * 2);

  // Étincelle qui tourne autour du panier (ellipse), pour bien montrer où aller.
  const ang = t / 620;
  const ox = cxs + Math.cos(ang) * 150 * f.s;
  const oy = cys + Math.sin(ang) * 95 * f.s;
  const sr = 34 * f.s;
  ctx.globalAlpha = 0.9;
  glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, sr);
  glow.addColorStop(0, 'rgba(255, 245, 200, 0.95)');
  glow.addColorStop(1, 'rgba(255, 245, 200, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(ox - sr, oy - sr, sr * 2, sr * 2);
  ctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Tête du chat qui dépasse : dessinée AVANT le panier mais clippée au rebord,
  // pour que seule la partie au-dessus du rebord soit visible (le panier, dessiné
  // ensuite, masque tout le reste du corps).
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, window.innerWidth, f.originY + CAT_BASKET_RIM_Y * f.s);
  ctx.clip();
  const hd = CAT_HEAD_DST;
  ctx.drawImage(
    catAssets.cats[0], CAT_HEAD_SRC.x, CAT_HEAD_SRC.y, CAT_HEAD_SRC.w, CAT_HEAD_SRC.h,
    f.originX + (hd.cx - hd.size / 2) * f.s, f.originY + (hd.top + bob) * f.s,
    hd.size * f.s, hd.size * f.s
  );
  ctx.restore();

  // Panier par-dessus (cadre complet du sprite).
  ctx.drawImage(catAssets.panier, f.originX, f.originY, 960 * f.s, 540 * f.s);
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
    vy: 155 + Math.random() * 85, // vitesse de chute
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
    if (pointInRect(pos, catBasketHitRect(getCatContainT()))) {
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
    over = pointInRect(pos, catBasketHitRect(getCatContainT()));
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
      // Enchaînement normal : le décor 7 (puzzle) suit le jeu des chats,
      // qui enchaînera lui-même sur l'écran final (fireworks).
      catPhase = 'done';
      place7Reset();
      scene = 'place7';
      startTime = null;
    }
  }
}
