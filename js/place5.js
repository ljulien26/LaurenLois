// ============================================================
// Décor 5 : intérieur du Cinéma Pathé. Lauren entre et avance ; une question
// LIBRE apparaît : "Combien de fois est-on allé au cinéma ensemble ?". Le
// joueur tape un nombre au clavier (Entrée pour valider, ou bouton Valider).
// La réponse est acceptée à 5 près autour de 35 (donc 30 à 40). Bonne réponse
// -> "GAGNÉ", puis on enchaîne sur le mini-jeu de la pluie de chats.
//
// Fond : Assets/Jeu/Places/5.png.
// ============================================================

// >>> CONTENU <<<
const PLACE5_QUESTION = 'Combien de fois est-on allé au cinéma ensemble ?';
const PLACE5_ANSWER = 35;
const PLACE5_TOLERANCE = 5; // accepté de 30 à 40

const PLACE5_GROUND_Y = 515;
const PLACE5_LAUREN_SCALE = 0.8;
const PLACE5_LAUREN_START_X = -70;
const PLACE5_LAUREN_READY_X = 150;
const PLACE5_LAUREN_MIN_X = 60;
const PLACE5_LAUREN_MAX_X = 905;
const PLACE5_TRIGGER_X = 460;

const place5Lauren = createCharacter(
  PLACE5_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, PLACE5_LAUREN_SCALE, 2
);

// Phases : 'enter' -> 'play' -> 'question' -> 'win' -> 'exit'.
let place5Phase = 'enter';
let place5Entered = false;
let place5Assets = null;
let place5Input = '';
let place5QuestionStart = null;
let place5WrongUntil = 0;
let place5WinStart = 0;
let place5ExitStart = 0;

const PLACE5_FADE_IN = 500;
const PLACE5_WIN_MS = 2400;
const PLACE5_EXIT_FADE = 900;

function place5Reset() {
  place5Phase = 'enter';
  place5Entered = false;
  place5Input = '';
  place5QuestionStart = null;
  place5WrongUntil = 0;
  place5Lauren.x = PLACE5_LAUREN_START_X;
  place5Lauren.facing = 'right';
  place5Lauren.walking = false;
  place5Lauren.targetX = null;
  characterWalkTo(place5Lauren, PLACE5_LAUREN_READY_X);
}

function getPlace5ContainT(assets) {
  const w = assets.place5Fond ? assets.place5Fond.width : 960;
  const h = assets.place5Fond ? assets.place5Fond.height : 540;
  return getContainTransform(w, h, window.innerWidth, window.innerHeight);
}

// ---------- Ambiance lumineuse (positions relevées dans 5.png) ----------
// Étoiles du plafond (scintillent), appliques murales (flicker chaud), et
// l'écran central (halo bleu qui respire). Tout en additif par-dessus le fond.
const PLACE5_STARS = [
  [138,38],[237,38],[348,38],[478,38],[607,38],[720,38],[820,38],
  [64,75],[180,75],[286,75],[389,75],[478,75],[566,75],[668,75],[774,75],[892,75],
  [128,112],[225,112],[326,112],[408,112],[478,112],[548,112],[627,112],[726,112],[828,112],
  [198,147],[272,147],[352,147],[604,147],[684,147],[759,147],
];
const PLACE5_LAMPS = [[54,188],[144,191],[809,192],[895,183]];
const PLACE5_SCREEN = { x: 481, y: 178 };

function drawPlace5Ambience(containT) {
  const t = performance.now();
  const s = containT.scale;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Étoiles : certaines scintillent fort, d'autres à peine (phases décalées).
  for (let i = 0; i < PLACE5_STARS.length; i++) {
    const amp = 0.25 + 0.6 * ((i * 37) % 100) / 100;
    const tw = Math.max(0, Math.sin(t / (520 + (i % 5) * 90) + i * 1.7));
    const a = tw * amp * 0.7;
    if (a < 0.02) continue;
    const cx = containT.dx + PLACE5_STARS[i][0] * s;
    const cy = containT.dy + PLACE5_STARS[i][1] * s;
    const r = (2.2 + amp * 2.5) * s;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Écran central : halo bleu-blanc qui respire.
  {
    const cx = containT.dx + PLACE5_SCREEN.x * s;
    const cy = containT.dy + PLACE5_SCREEN.y * s;
    const pulse = 0.55 + 0.45 * Math.sin(t / 900);
    const r = 46 * s;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(150,200,255,${0.22 * pulse})`);
    g.addColorStop(0.5, `rgba(120,170,255,${0.08 * pulse})`);
    g.addColorStop(1, 'rgba(120,170,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Appliques murales : petit flicker chaud.
  for (let i = 0; i < PLACE5_LAMPS.length; i++) {
    const flick = 0.72 + 0.28 * Math.sin(t / 140 + i * 2) + 0.1 * Math.sin(t / 47 + i);
    const cx = containT.dx + PLACE5_LAMPS[i][0] * s;
    const cy = containT.dy + PLACE5_LAMPS[i][1] * s;
    const r = 22 * s;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,180,90,${0.18 * flick})`);
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  ctx.restore();
}

// ---------- Déplacement de Lauren ----------
function updatePlace5Lauren(dt) {
  if (!place5Entered) {
    updateCharacter(place5Lauren, dt);
    if (!place5Lauren.walking) { place5Entered = true; place5Phase = 'play'; }
    updateWalkSound(dt, place5Lauren.walking);
    return;
  }

  stepPlayerWalk(place5Lauren, place5Phase === 'play' ? keyDirection() : 0, dt, PLACE5_LAUREN_MIN_X, PLACE5_LAUREN_MAX_X);

  if (place5Phase === 'play' && place5Lauren.x >= PLACE5_TRIGGER_X) {
    place5Phase = 'question';
    place5QuestionStart = performance.now();
  }
}

// ---------- Question libre ----------
function place5PanelRect() {
  const w = Math.min(window.innerWidth * 0.7, 580) * uiSizeFactor();
  const h = w / (1717 / 916);
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.08, w, h };
}

function place5InputRect() {
  const panel = place5PanelRect();
  const w = Math.min(window.innerWidth * 0.3, 220) * uiSizeFactor();
  const h = w * 0.42;
  return { x: window.innerWidth / 2 - w / 2, y: panel.y + panel.h + h * 0.4, w, h };
}

function place5ValidateRect() {
  const box = place5InputRect();
  const w = box.w * 0.9;
  const h = box.h * 0.7;
  return { x: window.innerWidth / 2 - w / 2, y: box.y + box.h + h * 0.4, w, h };
}

function drawPlace5Question(assets) {
  dimBackdrop();
  const panel = place5PanelRect();
  // La question s'écrit d'abord (machine à écrire + son clavier).
  const done = drawTypingQuestion(assets.quizPanel, panel, PLACE5_QUESTION, place5QuestionStart);
  if (!done) return; // le champ de saisie n'apparaît qu'une fois la question écrite

  // sous-titre "à 5 près" (sous le panneau)
  const box = place5InputRect();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(box.h * 0.32)}px 'PressStart2P'`;
  ctx.fillStyle = '#ffe8c2';
  ctx.fillText('(réponse à 5 près)', window.innerWidth / 2, box.y - box.h * 0.35);
  ctx.save();
  roundRectPath(box.x, box.y, box.w, box.h, box.h * 0.2);
  ctx.fillStyle = '#fff7ec';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = performance.now() < place5WrongUntil ? '#c0392b' : '#d9b48a';
  ctx.stroke();
  ctx.restore();

  const caret = Math.floor(performance.now() / 400) % 2 === 0 ? '_' : ' ';
  ctx.fillStyle = '#2a1a0a';
  ctx.font = `${Math.round(box.h * 0.5)}px 'PressStart2P'`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(place5Input + caret, box.x + box.w / 2, box.y + box.h / 2);

  // bouton Valider
  const btn = place5ValidateRect();
  drawPill(assets.menuBouton, 'Valider', btn);

  // consigne / feedback
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  if (performance.now() < place5WrongUntil) {
    ctx.fillStyle = '#ff8a80';
    ctx.font = `${Math.round(window.innerHeight * 0.03)}px 'PressStart2P'`;
    ctx.fillText('Presque... réessaie', window.innerWidth / 2, window.innerHeight * 0.97);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `${Math.round(window.innerHeight * 0.024)}px 'PressStart2P'`;
    ctx.fillText('Tape ton nombre au clavier, puis Entrée', window.innerWidth / 2, window.innerHeight * 0.97);
  }
  ctx.restore();
}

function place5Validate() {
  if (place5Input === '') return;
  const v = parseInt(place5Input, 10);
  if (!isNaN(v) && Math.abs(v - PLACE5_ANSWER) <= PLACE5_TOLERANCE) {
    place5Phase = 'win';
    place5WinStart = performance.now();
    playCorrectSound();
  } else {
    place5WrongUntil = performance.now() + 1100;
    place5Input = '';
    playWrongSound();
  }
}

function place5Win() {
  const t = (performance.now() - place5WinStart) / PLACE5_WIN_MS;
  ctx.save();
  ctx.globalAlpha = Math.sin(Math.min(t, 1) * Math.PI) * 0.9 + 0.1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd76a';
  ctx.font = `${Math.round(window.innerHeight * 0.07)}px 'PressStart2P'`;
  ctx.fillText('GAGNÉ !', window.innerWidth / 2, window.innerHeight * 0.44);
  // La bonne réponse est validée à 5 près : on révèle le chiffre exact.
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(window.innerHeight * 0.032)}px 'PressStart2P'`;
  ctx.fillText(`C'était ${PLACE5_ANSWER} fois !`, window.innerWidth / 2, window.innerHeight * 0.56);
  ctx.restore();
}

// ---------- Entrées ----------
function place5CanAnswer() {
  return place5Phase === 'question' && questionTypingDone(place5QuestionStart, PLACE5_QUESTION);
}

function handlePlace5Down(evt) {
  if (!place5CanAnswer()) return;
  if (pointInRect(getPointerPos(evt), place5ValidateRect())) { playClickSound(); place5Validate(); }
}

// Saisie au clavier (chiffres, effacement, Entrée) une fois la question écrite.
window.addEventListener('keydown', (e) => {
  if (scene !== 'place5' || !place5CanAnswer()) return;
  if (e.key >= '0' && e.key <= '9') {
    if (place5Input.length < 4) place5Input += e.key;
  } else if (e.key === 'Backspace') {
    place5Input = place5Input.slice(0, -1);
    e.preventDefault();
  } else if (e.key === 'Enter') {
    place5Validate();
  }
});

canvas.addEventListener('pointerdown', (evt) => { if (scene === 'place5') handlePlace5Down(evt); });

// ---------- Scène ----------
function drawPlace5Scene(assets, elapsed, dt) {
  place5Assets = assets;
  const containT = getPlace5ContainT(assets);

  if (assets.place5Fond) {
    drawBackgroundContain(assets.place5Fond, containT);
    drawPlace5Ambience(containT);
  }

  updatePlace5Lauren(dt);
  drawCharacter(place5Lauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress, PLACE5_GROUND_Y);

  if (place5Phase === 'play') drawKeyboardMoveHint();

  if (place5Phase === 'question') drawPlace5Question(assets);

  if (place5Phase === 'win') {
    dimBackdrop();
    place5Win();
    if (performance.now() - place5WinStart >= PLACE5_WIN_MS) {
      place5Phase = 'exit';
      place5ExitStart = performance.now();
    }
  }

  drawSceneFadeIn(elapsed, PLACE5_FADE_IN);

  if (place5Phase === 'exit') {
    const t = Math.min((performance.now() - place5ExitStart) / PLACE5_EXIT_FADE, 1);
    fillBlack(t);
    if (t >= 1) {
      place5Phase = 'done';
      catGameReset();
      scene = 'catgame';
      startTime = null;
    }
  }
}
