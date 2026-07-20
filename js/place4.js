// ============================================================
// Décor 4 : Cinéma Pathé (façade). Lauren arrive par la gauche et avance
// jusqu'au milieu ; une question à choix multiple sur la date du 1er film
// apparaît. Une fois la bonne réponse donnée, la porte centrale s'éclaire :
// le joueur amène Lauren devant et clique dessus pour entrer → décor 5
// (l'intérieur du cinéma).
//
// Fond : Assets/Jeu/Places/4.png. Réutilise quizPanel + menuBouton + quizGood/Bad.
// ============================================================

// >>> CONTENU <<<
const PLACE4_QUESTION = 'Quelle était la date de ce 1er film au cinéma ?';
const PLACE4_ANSWERS = ['1er avril 2024', '6 avril 2024', '10 avril 2024', '15 avril 2024'];
const PLACE4_CORRECT = 1; // 6 avril 2024

const PLACE4_GROUND_Y = 515;
const PLACE4_LAUREN_SCALE = 0.8;
const PLACE4_LAUREN_START_X = -70;
const PLACE4_LAUREN_READY_X = 150;
const PLACE4_LAUREN_MIN_X = 60;
const PLACE4_LAUREN_MAX_X = 905;
const PLACE4_TRIGGER_X = 460; // arrivée au milieu : la question apparaît

// Porte centrale du cinéma (coords 4.png) : zone d'entrée + portée.
const PLACE4_DOOR_X = 483;
const PLACE4_DOOR_Y = 375;
const PLACE4_DOOR_R = 70;
const PLACE4_DOOR_REACH = 200;

const place4Lauren = createCharacter(
  PLACE4_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, PLACE4_LAUREN_SCALE, 2
);

// Phases : 'enter' -> 'play' -> 'question' -> 'door' (porte active) -> 'exit'.
let place4Phase = 'enter';
let place4Entered = false;
let place4Assets = null;
let place4Picked = -1;
let place4PickedStart = 0;
let place4PickedCorrect = false;
let place4QuestionStart = null;
let place4ExitStart = 0;

const PLACE4_FADE_IN = 500;
const PLACE4_EXIT_FADE = 900;

function place4Reset() {
  place4Phase = 'enter';
  place4Entered = false;
  place4Picked = -1;
  place4QuestionStart = null;
  place4Lauren.x = PLACE4_LAUREN_START_X;
  place4Lauren.facing = 'right';
  place4Lauren.walking = false;
  place4Lauren.targetX = null;
  characterWalkTo(place4Lauren, PLACE4_LAUREN_READY_X);
}

function getPlace4ContainT(assets) {
  const w = assets.place4Fond ? assets.place4Fond.width : 960;
  const h = assets.place4Fond ? assets.place4Fond.height : 540;
  return getContainTransform(w, h, window.innerWidth, window.innerHeight);
}

// ---------- Déplacement de Lauren ----------
function updatePlace4Lauren(dt) {
  if (!place4Entered) {
    updateCharacter(place4Lauren, dt);
    if (!place4Lauren.walking) { place4Entered = true; place4Phase = 'play'; }
    updateWalkSound(dt, place4Lauren.walking);
    return;
  }

  const controllable = place4Phase === 'play' || place4Phase === 'door';
  stepPlayerWalk(place4Lauren, controllable ? keyDirection() : 0, dt, PLACE4_LAUREN_MIN_X, PLACE4_LAUREN_MAX_X);

  if (place4Phase === 'play' && place4Lauren.x >= PLACE4_TRIGGER_X) {
    place4Phase = 'question';
    place4QuestionStart = performance.now();
  }
}

// ---------- Question à choix multiple ----------
function place4PanelRect() {
  const w = Math.min(window.innerWidth * 0.68, 560) * uiSizeFactor();
  const h = w / (1717 / 916);
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.05, w, h };
}

function place4PillSize() {
  const w = Math.min(window.innerWidth * 0.4, 270) * uiSizeFactor();
  return { w, h: w / (1349 / 255) };
}

function place4AnswerRects() {
  const panel = place4PanelRect();
  const { w, h } = place4PillSize();
  const gapX = w * 0.12;
  const gapY = h * 0.5;
  const cx = window.innerWidth / 2;
  const topY = panel.y + panel.h + h * 0.6;
  const leftX = cx - w - gapX / 2;
  const rightX = cx + gapX / 2;
  return [
    { x: leftX, y: topY, w, h },
    { x: rightX, y: topY, w, h },
    { x: leftX, y: topY + h + gapY, w, h },
    { x: rightX, y: topY + h + gapY, w, h },
  ];
}

function place4AllTyped() {
  return questionTypingDone(place4QuestionStart, PLACE4_QUESTION) &&
    answersTyping(place4QuestionStart, PLACE4_QUESTION, PLACE4_ANSWERS).every((a) => a.full);
}

function drawPlace4Question(assets) {
  dimBackdrop();
  const panel = place4PanelRect();
  // Le son clavier est géré ici (pour couvrir aussi l'écriture des réponses).
  const qDone = drawTypingQuestion(assets.quizPanel, panel, PLACE4_QUESTION, place4QuestionStart, false);
  if (!qDone) {
    setKeyboardTyping(place4QuestionStart != null); // question en cours d'écriture
    return;
  }

  // Puis chaque réponse apparaît à son tour, écrite caractère par caractère.
  const typing = answersTyping(place4QuestionStart, PLACE4_QUESTION, PLACE4_ANSWERS);
  const rects = place4AnswerRects();
  rects.forEach((r, i) => {
    if (!typing[i].visible) return;
    let img = assets.menuBouton;
    if (place4Picked === i) img = place4PickedCorrect ? assets.quizGood : assets.quizBad;
    drawTypedAnswerPill(img, PLACE4_ANSWERS[i], r, typing[i]);
  });
  setKeyboardTyping(!typing.every((a) => a.full));
}

// ---------- Porte du cinéma ----------
function getPlace4DoorScreen(containT) {
  return {
    cx: containT.dx + PLACE4_DOOR_X * containT.scale,
    cy: containT.dy + PLACE4_DOOR_Y * containT.scale,
    r: PLACE4_DOOR_R * containT.scale,
  };
}

function laurenNearDoor() {
  return Math.abs(place4Lauren.x - PLACE4_DOOR_X) <= PLACE4_DOOR_REACH;
}

function drawPlace4DoorHint(containT, elapsed) {
  const s = getPlace4DoorScreen(containT);
  const pulse = 0.2 + Math.sin(elapsed / 360) * 0.12;
  ctx.save();
  ctx.globalAlpha = Math.max(0, pulse);
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.r * 1.4);
  glow.addColorStop(0, 'rgba(255, 226, 150, 0.85)');
  glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(s.cx - s.r * 1.4, s.cy - s.r * 1.4, s.r * 2.8, s.r * 2.8);
  ctx.restore();

  // petite invite "Entrer"
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#fff4d6';
  ctx.font = `${Math.round(window.innerHeight * 0.026)}px 'PressStart2P'`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Entrer', s.cx, s.cy - s.r);
  ctx.restore();
}

// ---------- Entrées souris ----------
function handlePlace4Down(evt) {
  const pos = getPointerPos(evt);

  if (place4Phase === 'question') {
    if (place4Picked !== -1) return;
    if (!place4AllTyped()) return;
    const rects = place4AnswerRects();
    for (let i = 0; i < 4; i++) {
      if (pointInRect(pos, rects[i])) {
        playClickSound();
        place4Picked = i;
        place4PickedStart = performance.now();
        place4PickedCorrect = i === PLACE4_CORRECT;
        if (place4PickedCorrect) playCorrectSound(); else playWrongSound();
        return;
      }
    }
    return;
  }

  if (place4Phase === 'door') {
    const containT = getPlace4ContainT(place4Assets);
    const s = getPlace4DoorScreen(containT);
    const dx = pos.x - s.cx;
    const dy = pos.y - s.cy;
    if (dx * dx + dy * dy <= s.r * s.r && laurenNearDoor()) {
      place4Phase = 'exit';
      place4ExitStart = performance.now();
    }
  }
}

function updatePlace4Answer() {
  if (place4Picked === -1) return;
  const held = performance.now() - place4PickedStart;
  if (place4PickedCorrect) {
    if (held >= 700) { place4Picked = -1; place4Phase = 'door'; }
  } else if (held >= 600) {
    place4Picked = -1;
  }
}

canvas.addEventListener('pointerdown', (evt) => { if (scene === 'place4') handlePlace4Down(evt); });

// Curseur "main" au survol d'une réponse cliquable, ou de la porte une fois
// la question résolue.
canvas.addEventListener('pointermove', (evt) => {
  if (scene !== 'place4') return;
  const pos = getPointerPos(evt);
  let over = false;
  if (place4Phase === 'question' && place4Picked === -1 && place4AllTyped()) {
    over = place4AnswerRects().some((r) => pointInRect(pos, r));
  } else if (place4Phase === 'door') {
    const s = getPlace4DoorScreen(getPlace4ContainT(place4Assets));
    const dx = pos.x - s.cx, dy = pos.y - s.cy;
    over = dx * dx + dy * dy <= s.r * s.r && laurenNearDoor();
  }
  canvas.style.cursor = over ? 'pointer' : 'default';
});

// ---------- Scène ----------
function drawPlace4Scene(assets, elapsed, dt) {
  place4Assets = assets;
  const containT = getPlace4ContainT(assets);

  if (assets.place4Fond) drawBackgroundContain(assets.place4Fond, containT);

  if (place4Phase === 'door') drawPlace4DoorHint(containT, elapsed);

  updatePlace4Lauren(dt);
  updatePlace4Answer();
  drawCharacter(place4Lauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress, PLACE4_GROUND_Y);

  if (place4Phase === 'play' || place4Phase === 'door') drawKeyboardMoveHint();

  if (place4Phase === 'question') drawPlace4Question(assets);

  drawSceneFadeIn(elapsed, PLACE4_FADE_IN);

  if (place4Phase === 'exit') {
    const t = Math.min((performance.now() - place4ExitStart) / PLACE4_EXIT_FADE, 1);
    fillBlack(t);
    if (t >= 1) {
      place4Phase = 'done';
      place5Reset();
      scene = 'place5';
      startTime = null;
    }
  }
}
