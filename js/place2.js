// ============================================================
// Décor 2 : le café BlasTodice. Lauren arrive par la gauche, le titre du bar
// (sur le store) est masqué. Une question s'affiche (panneau + boutons du
// Quiz) ; à la bonne réponse, le titre s'illumine, puis un panneau "SORTIE"
// apparaît à droite : y amener Lauren déclenche un fondu au noir vers la suite.
//
// Réutilise : character.js, le déplacement clavier (keyDirection de core.js),
// lock.js (drawPill, pointInRect, pillSize), la police via menu.js
// (fitButtonFontSize).
// ============================================================

const PLACE2_GROUND_Y = 462;         // un peu plus bas : Lauren plus proche du 1er plan
const PLACE2_LAUREN_SCALE = 1.05;    // +6 % par rapport à 0.99
const PLACE2_LAUREN_START_X = 80;    // visible à gauche ; le joueur l'avance
const PLACE2_QUESTION_TRIGGER_X = 470; // en arrivant au milieu, la question démarre
const PLACE2_LAUREN_MIN_X = 60;
const PLACE2_LAUREN_MAX_X = 905;
const PLACE2_EXIT_X = 880; // Lauren atteint la sortie au-delà de ce x

const place2Lauren = createCharacter(
  PLACE2_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, PLACE2_LAUREN_SCALE, 2
);

// Titre BLASTODICE sur le store (coords 2.png) : masqué jusqu'à la bonne
// réponse, en recouvrant la zone d'une bande de store propre prélevée juste
// en dessous (même position horizontale = même teinte).
const PLACE2_TITLE_RECT = { x: 358, y: 105, w: 156, h: 25 };


// ---------- Question ----------
const PLACE2_QUESTION = 'Quel est le nom du bar à jeux dans lequel nous sommes allés pour notre 1ère rencontre ?';
const PLACE2_ANSWERS = ['Le blastodice', 'All4Play', 'La Taverne du troll', 'La Baraka'];
const PLACE2_CORRECT = 0;
// Effet "machine à écrire" : la question puis chaque réponse s'écrivent
// caractère par caractère, les réponses apparaissant l'une après l'autre.
const PLACE2_CHAR_MS = 42;    // ms par caractère
const PLACE2_ANSWER_GAP = 220; // pause entre deux éléments (question→rép1, rép→rép)

// ---------- État ----------
// Phases : 'enter' (arrivée) → 'question' → 'explore' (titre révélé, sortie
// dispo) → 'exit' (fondu au noir).
let place2Phase = 'enter';
let place2QuestionStart = 0;     // début de l'affichage machine à écrire
let place2TitleRevealStart = -1; // début de l'illumination du titre (-1 = pas encore)
let place2ExitStart = -1;        // début du fondu de sortie

let place2Picked = -1;           // réponse tapée en attente de feedback
let place2PickedStart = 0;
let place2PickedCorrect = false;

let place2Assets = null;

// Si au bout d'une minute la joueuse n'a pas progressé (toujours en train de
// marcher), on affiche un message explicite « va tout à droite » + son notif.
const PLACE2_GO_RIGHT_DELAY = 60000;
let place2HintNotified = false;

function place2Reset() {
  place2Phase = 'enter';
  place2TitleRevealStart = -1;
  place2ExitStart = -1;
  place2Picked = -1;
  place2HintNotified = false;
  place2Lauren.x = PLACE2_LAUREN_START_X;
  place2Lauren.facing = 'right'; // tournée vers le café, prête à avancer
  place2Lauren.walking = false;
  place2Lauren.targetX = null;
}

// Message d'aide affiché après un long moment sans progresser.
function drawPlace2GoRightMessage() {
  const w = window.innerWidth, h = window.innerHeight;
  const pulse = 0.6 + Math.sin(performance.now() / 400) * 0.4;
  const text = 'Va tout à droite →';
  ctx.save();
  ctx.font = `${Math.round(h * 0.038)}px 'PressStart2P'`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const boxW = ctx.measureText(text).width + h * 0.07;
  const boxH = h * 0.09;
  const cx = w / 2, cy = h * 0.13;
  roundRectPath(cx - boxW / 2, cy - boxH / 2, boxW, boxH, boxH * 0.28);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fill();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffe08a';
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

// État "machine à écrire" à l'instant courant : combien de caractères de la
// question et de chaque réponse sont visibles (les réponses arrivent l'une
// après l'autre, après la question).
function place2Typing() {
  const t = performance.now() - place2QuestionStart;
  const qFull = PLACE2_QUESTION.length;
  const qShown = Math.max(0, Math.min(Math.floor(t / PLACE2_CHAR_MS), qFull));

  let cursor = qFull * PLACE2_CHAR_MS + PLACE2_ANSWER_GAP;
  const answers = PLACE2_ANSWERS.map((ans) => {
    const start = cursor;
    const len = ans.length;
    let shown = 0;
    const visible = t >= start;
    if (visible) shown = Math.min(Math.floor((t - start) / PLACE2_CHAR_MS), len);
    cursor = start + len * PLACE2_CHAR_MS + PLACE2_ANSWER_GAP;
    return { visible, shown, full: shown >= len };
  });

  return { qShown, qFull, answers };
}

function getPlace2ContainT(assets) {
  return getContainTransform(assets.place2Fond.width, assets.place2Fond.height,
    window.innerWidth, window.innerHeight);
}

// ---------- Titre du bar : masquage puis illumination ----------
function drawPlace2Title(assets, containT) {
  const r = PLACE2_TITLE_RECT;
  const x = containT.dx + r.x * containT.scale;
  const y = containT.dy + r.y * containT.scale;
  const w = r.w * containT.scale;
  const h = r.h * containT.scale;

  if (place2TitleRevealStart < 0) {
    // Masqué : simple aplat du bleu nuit du store (pas de prélèvement d'image,
    // qui laissait apparaître un bout de vitrine/porte).
    ctx.save();
    ctx.fillStyle = '#252b36';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    return;
  }

  // Révélé : le titre du fond réapparaît. Illumination one-shot (un pic doré
  // qui retombe à zéro) — aucun halo persistant ensuite.
  const t = (performance.now() - place2TitleRevealStart) / 1200;
  if (t >= 1) return; // fini : plus aucun halo, le titre reste simplement visible
  const glow = Math.sin(t * Math.PI) * 0.9;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = glow;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.7);
  g.addColorStop(0, 'rgba(255, 210, 110, 0.9)');
  g.addColorStop(1, 'rgba(255, 210, 110, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - w * 0.3, y - h, w * 1.6, h * 3);
  ctx.restore();
}

// ---------- Question : panneau + 4 réponses ----------
function wrapPixelText(text, maxWidth, fontPx) {
  ctx.font = `${fontPx}px 'PressStart2P'`;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function place2QuestionPanelRect() {
  const w = Math.min(window.innerWidth * 0.7, 560) * uiSizeFactor();
  const h = w / (1717 / 916);
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.05, w, h };
}

// Taille des pilules de réponse (un peu plus petites que celles des indices,
// pour tenir en grille 2x2). Réduites sur petit écran comme le reste de l'UI.
function place2PillSize() {
  const w = Math.min(window.innerWidth * 0.4, 270) * uiSizeFactor();
  return { w, h: w / (1349 / 255) };
}

// 4 réponses en grille 2x2 sous le panneau.
function place2AnswerRects() {
  const panel = place2QuestionPanelRect();
  const { w, h } = place2PillSize();
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

// Curseur clignotant façon clavier, tant qu'un texte est en train de s'écrire.
function place2Caret() {
  return Math.floor(performance.now() / 400) % 2 === 0 ? '_' : ' ';
}

// Taille de police commune à la question et aux 4 réponses : la plus grande
// qui fait tenir la réponse la plus longue dans sa pilule. Ainsi les réponses
// sont toutes identiques et de la même taille que la question.
function place2TextFontPx() {
  // Taille de référence du jeu (le café est la question de référence).
  return firstQuestionFontPx();
}

function drawPlace2Question(assets) {
  dimBackdrop();
  const panel = place2QuestionPanelRect();
  ctx.drawImage(assets.quizPanel, 0, 0, assets.quizPanel.width, assets.quizPanel.height,
    panel.x, panel.y, panel.w, panel.h);

  const typing = place2Typing();
  // Son clavier tant que la question ou les réponses sont en train de s'écrire ;
  // il s'arrête net dès que tout est affiché.
  const allTyped = typing.qShown >= typing.qFull && typing.answers.every((a) => a.full);
  setKeyboardTyping(!allTyped);
  const fontPx = place2TextFontPx();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Question qui s'écrit caractère par caractère (curseur tant qu'inachevée).
  let qText = PLACE2_QUESTION.slice(0, typing.qShown);
  if (typing.qShown < typing.qFull) qText += place2Caret();
  const lines = wrapPixelText(qText, panel.w * 0.78, fontPx);
  ctx.fillStyle = '#2a1a0a';
  const lineH = fontPx * 1.6;
  lines.forEach((ln, i) => {
    const cy = panel.y + panel.h / 2 + (i - (lines.length - 1) / 2) * lineH;
    ctx.font = `${fontPx}px 'PressStart2P'`;
    ctx.fillText(ln, panel.x + panel.w / 2, cy);
  });

  // Réponses : chacune apparaît à son tour et s'écrit caractère par caractère,
  // toutes à la même taille de police (celle calculée ci-dessus).
  const rects = place2AnswerRects();
  rects.forEach((r, i) => {
    const a = typing.answers[i];
    if (!a.visible) return; // pas encore son tour
    let img = assets.menuBouton;
    if (place2Picked === i) img = place2PickedCorrect ? assets.quizGood : assets.quizBad;
    ctx.drawImage(img, 0, 0, img.width, img.height, r.x, r.y, r.w, r.h);

    let text = PLACE2_ANSWERS[i].slice(0, a.shown);
    if (!a.full) text += place2Caret();
    ctx.font = `${fontPx}px 'PressStart2P'`;
    ctx.fillStyle = '#201306';
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + fontPx * 0.05);
  });
}

// ---------- Contrôle de Lauren ----------
// Le joueur avance Lauren (aucun déplacement automatique) : en phase 'enter'
// jusqu'au milieu (déclenche la question), puis en phase 'explore' jusqu'à la
// sortie.
function updatePlace2Lauren(dt) {
  const controllable = place2Phase === 'enter' || place2Phase === 'explore';
  const dir = controllable ? keyDirection() : 0;
  if (dir === 0) {
    place2Lauren.walking = false;
    place2Lauren.frameIndex = 0;
    updateWalkSound(dt, false);
    return;
  }

  const nextX = place2Lauren.x + dir * CHARACTER_WALK_SPEED * dt;
  const clampedX = Math.max(PLACE2_LAUREN_MIN_X, Math.min(PLACE2_LAUREN_MAX_X, nextX));
  if (clampedX !== place2Lauren.x) {
    place2Lauren.facing = dir < 0 ? 'left' : 'right';
    place2Lauren.x = clampedX;
    place2Lauren.walking = true;
    place2Lauren.frameElapsed += dt * 1000;
    while (place2Lauren.frameElapsed >= CHARACTER_WALK_FRAME_DURATION) {
      place2Lauren.frameElapsed -= CHARACTER_WALK_FRAME_DURATION;
      place2Lauren.frameIndex = (place2Lauren.frameIndex + 1) % place2Lauren.walkFrameCount;
    }
    updateWalkSound(dt, true);
  } else {
    place2Lauren.walking = false;
    place2Lauren.frameIndex = 0;
    updateWalkSound(dt, false);
  }

  // Arrivée au milieu : la question démarre (effet machine à écrire).
  if (place2Phase === 'enter' && place2Lauren.x >= PLACE2_QUESTION_TRIGGER_X) {
    place2Phase = 'question';
    place2QuestionStart = performance.now();
    return;
  }

  // Sortie atteinte : on lance le fondu au noir.
  if (place2Phase === 'explore' && place2Lauren.x >= PLACE2_EXIT_X && place2ExitStart < 0) {
    place2Phase = 'exit';
    place2ExitStart = performance.now();
  }
}

// ---------- Entrées : seul le clic sur une réponse est géré ici (le
// déplacement de Lauren se fait au clavier, voir updatePlace2Lauren). ----------
function handlePlace2Down(evt) {
  if (place2Phase !== 'question' || place2Picked !== -1) return; // rien à cliquer / feedback en cours

  const typing = place2Typing();
  // On ne peut répondre qu'une fois que les 4 réponses sont entièrement
  // affichées (avant ça, aucune réponse n'est sélectionnable).
  if (!typing.answers.every((a) => a.full)) return;

  const pos = getPointerPos(evt);
  const rects = place2AnswerRects();
  for (let i = 0; i < 4; i++) {
    if (pointInRect(pos, rects[i])) {
      playClickSound();
      place2Picked = i;
      place2PickedStart = performance.now();
      place2PickedCorrect = i === PLACE2_CORRECT;
      if (place2PickedCorrect) playCorrectSound(); else playWrongSound();
      return;
    }
  }
}

canvas.addEventListener('pointerdown', (evt) => { if (scene === 'place2') handlePlace2Down(evt); });

// ---------- Résolution du feedback de réponse ----------
function updatePlace2Answer() {
  if (place2Picked === -1) return;
  const held = performance.now() - place2PickedStart;
  if (place2PickedCorrect) {
    if (held >= 700) {
      place2Picked = -1;
      place2TitleRevealStart = performance.now(); // le titre s'illumine
      place2Phase = 'explore';
    }
  } else if (held >= 600) {
    place2Picked = -1; // mauvaise réponse : on réessaie
  }
}

// ---------- Scène ----------
const PLACE2_FADE_IN = 500;
const PLACE2_EXIT_FADE = 900;

// Halo sombre pulsé sur le bord droit : indique, dès le début, qu'il faut se
// diriger vers la droite (la question s'y déclenche, puis la sortie s'y trouve).
function drawPlace2ExitHint() {
  const w = window.innerWidth, h = window.innerHeight;
  const pulse = 0.5 + Math.sin(performance.now() / 500) * 0.5; // 0 → 1

  ctx.save();
  const bandW = w * 0.26;
  const grad = ctx.createLinearGradient(w - bandW, 0, w, 0);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, `rgba(0, 0, 0, ${0.45 + 0.3 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(w - bandW, 0, bandW, h);
  ctx.restore();
}

function drawPlace2Scene(assets, elapsed, dt) {
  place2Assets = assets;
  const containT = getPlace2ContainT(assets);

  drawBackgroundContain(assets.place2Fond, containT);
  drawPlace2Title(assets, containT);

  updatePlace2Lauren(dt);
  updatePlace2Answer();

  drawCharacter(place2Lauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress, PLACE2_GROUND_Y);

  // Indice clavier : à l'arrivée (jusqu'au milieu) puis à l'exploration.
  if (place2Phase === 'enter' || place2Phase === 'explore') {
    drawKeyboardMoveHint();
  }
  // Halo sombre vers la droite : dès l'arrivée (pour indiquer où aller) et à
  // nouveau à l'exploration (vers la sortie). Masqué pendant la question.
  if (place2Phase === 'enter' || place2Phase === 'explore') {
    drawPlace2ExitHint();
    // Au bout d'une minute sans avoir progressé : message explicite + notif.
    if (elapsed >= PLACE2_GO_RIGHT_DELAY) {
      if (!place2HintNotified) { place2HintNotified = true; playNotifSound(); }
      drawPlace2GoRightMessage();
    }
  }

  if (place2Phase === 'question') {
    drawPlace2Question(assets);
  }

  // Fondu d'arrivée depuis le noir.
  if (elapsed < PLACE2_FADE_IN) {
    ctx.save();
    ctx.globalAlpha = 1 - elapsed / PLACE2_FADE_IN;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
  }

  // Fondu de sortie, puis bascule vers le décor 3 (Saint-Sernin).
  if (place2Phase === 'exit') {
    const t = Math.min((performance.now() - place2ExitStart) / PLACE2_EXIT_FADE, 1);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
    if (t >= 1) {
      place2Phase = 'done';
      place3Reset();
      scene = 'place3';
      startTime = null;
    }
  }
}
