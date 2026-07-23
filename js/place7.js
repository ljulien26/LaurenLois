// ============================================================
// Décor 7 : Les Halles de la Cartoucherie. Lauren entre et avance (← →) ;
// arrivée au centre, un JEU DE PUZZLE apparaît. La photo (Assets/Jeu/Puzzle/
// 1.png) est découpée en 5 colonnes x 6 lignes (30 pièces). Le plateau
// démarre VIDE : les 20 pièces sont mélangées dans une RÉSERVE à droite et il
// faut les GLISSER une à une sur la bonne case du plateau (glisser-déposer entre
// réserve <-> plateau, et d'une case à l'autre). Le MODÈLE n'apparaît que si
// l'on clique sur le bouton « Aide ». Quand toutes les pièces sont bien placées
// -> « Bravo ! » puis on enchaîne sur le feu d'artifice final. Design 960x540.
// ============================================================

const PLACE7_GROUND_Y = 515;
const PLACE7_LAUREN_SCALE = 0.7;      // un peu plus petite qu'avant (0.8)
const PLACE7_LAUREN_START_X = -70;
const PLACE7_LAUREN_READY_X = 300;    // s'arrête plus au centre (rapprochée)
const PLACE7_LAUREN_MIN_X = 60;
const PLACE7_LAUREN_MAX_X = 905;
const PLACE7_TRIGGER_X = 460; // au centre : déclenche le puzzle

// Puzzle : grille 5 colonnes x 6 lignes = 30 pièces (plus difficile).
const PUZZLE_COLS = 5;
const PUZZLE_ROWS = 6;
const PUZZLE_N = PUZZLE_COLS * PUZZLE_ROWS;

const PLACE7_FADE_IN = 500;
const PLACE7_WIN_MS = 2200;
const PLACE7_EXIT_FADE = 900;

const place7Lauren = createCharacter(
  PLACE7_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, PLACE7_LAUREN_SCALE, 2
);

// Phases : 'enter' -> 'play' -> 'puzzle' -> 'win' -> 'exit'.
let place7Phase = 'enter';
let place7Entered = false;
let place7Assets = null;
// place7Board[pos] = index de la pièce posée sur cette case, ou -1 (vide).
let place7Board = [];
// place7Tray = liste ordonnée des index de pièces encore dans la réserve.
let place7Tray = [];
// Glissement en cours : { piece, origin, x, y, offX, offY } ou null.
// origin = { type:'tray', index } ou { type:'board', pos }.
let place7Drag = null;
// Le modèle n'est visible que si Lauren a demandé de l'aide.
let place7ShowModel = false;
let place7WinStart = 0;
let place7ExitStart = 0;

function place7ShufflePuzzle() {
  const a = [];
  for (let i = 0; i < PUZZLE_N; i++) a.push(i);
  // Mélange (Fisher-Yates), en évitant de tomber pile sur la solution.
  do {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  } while (a.every((v, i) => v === i));
  place7Tray = a;
  place7Board = new Array(PUZZLE_N).fill(-1);
  place7Drag = null;
  place7ShowModel = false;
}

function place7Reset() {
  place7Phase = 'enter';
  place7Entered = false;
  place7Drag = null;
  place7ShufflePuzzle();
  place7Lauren.x = PLACE7_LAUREN_START_X;
  place7Lauren.facing = 'right';
  place7Lauren.walking = false;
  place7Lauren.targetX = null;
  characterWalkTo(place7Lauren, PLACE7_LAUREN_READY_X);
}

function getPlace7ContainT(assets) {
  const w = assets.place7Fond ? assets.place7Fond.width : 960;
  const h = assets.place7Fond ? assets.place7Fond.height : 540;
  return getContainTransform(w, h, window.innerWidth, window.innerHeight);
}

// ---------- Déplacement de Lauren ----------
function updatePlace7Lauren(dt) {
  if (!place7Entered) {
    updateCharacter(place7Lauren, dt);
    if (!place7Lauren.walking) { place7Entered = true; place7Phase = 'play'; }
    updateWalkSound(dt, place7Lauren.walking);
    return;
  }
  stepPlayerWalk(place7Lauren, place7Phase === 'play' ? keyDirection() : 0, dt, PLACE7_LAUREN_MIN_X, PLACE7_LAUREN_MAX_X);
  if (place7Phase === 'play' && place7Lauren.x >= PLACE7_TRIGGER_X) {
    place7Phase = 'puzzle';
  }
}

// ---------- Géométrie du plateau (vide) ----------
// Plateau décalé vers la gauche pour laisser la place à la réserve à droite.
function place7BoardRect() {
  const img = place7Assets && place7Assets.puzzle;
  const ratio = img ? img.width / img.height : 0.75;
  const h = Math.min(window.innerHeight * 0.80, window.innerWidth * 0.34 / ratio);
  const w = h * ratio;
  const cx = window.innerWidth * 0.30;
  return { x: cx - w / 2, y: window.innerHeight / 2 - h / 2, w, h };
}

// Rectangle écran d'une case du plateau (position dans la grille).
function place7CellRect(pos) {
  const b = place7BoardRect();
  const cw = b.w / PUZZLE_COLS, ch = b.h / PUZZLE_ROWS;
  const col = pos % PUZZLE_COLS, row = Math.floor(pos / PUZZLE_COLS);
  return { x: b.x + col * cw, y: b.y + row * ch, w: cw, h: ch };
}

// Case du plateau sous une position écran, ou -1.
function place7CellAt(pos) {
  const b = place7BoardRect();
  if (pos.x < b.x || pos.x > b.x + b.w || pos.y < b.y || pos.y > b.y + b.h) return -1;
  const col = Math.floor((pos.x - b.x) / (b.w / PUZZLE_COLS));
  const row = Math.floor((pos.y - b.y) / (b.h / PUZZLE_ROWS));
  return row * PUZZLE_COLS + col;
}

// ---------- Géométrie de la réserve (bac de pièces à droite) ----------
function place7TrayRect() {
  const b = place7BoardRect();
  const x = b.x + b.w + window.innerWidth * 0.045;
  const y = window.innerHeight * 0.10;
  const w = window.innerWidth * 0.965 - x;
  const h = window.innerHeight * 0.80;
  return { x, y, w, h };
}

// Taille d'une pièce dans la réserve = taille d'une case du plateau.
function place7TrayCellSize() {
  const b = place7BoardRect();
  return { cw: b.w / PUZZLE_COLS, ch: b.h / PUZZLE_ROWS };
}

function place7TrayCols() {
  const t = place7TrayRect();
  const { cw } = place7TrayCellSize();
  return Math.max(1, Math.floor(t.w / cw));
}

// Emplacement écran de la i-ème pièce de la réserve.
function place7TraySlotRect(i) {
  const t = place7TrayRect();
  const { cw, ch } = place7TrayCellSize();
  const cols = place7TrayCols();
  const col = i % cols, row = Math.floor(i / cols);
  return { x: t.x + col * cw, y: t.y + row * ch, w: cw, h: ch };
}

// Index de la pièce de réserve sous une position écran, ou -1.
function place7TrayAt(pos) {
  const t = place7TrayRect();
  if (pos.x < t.x || pos.y < t.y) return -1;
  const { cw, ch } = place7TrayCellSize();
  const cols = place7TrayCols();
  const col = Math.floor((pos.x - t.x) / cw);
  const row = Math.floor((pos.y - t.y) / ch);
  if (col < 0 || col >= cols) return -1;
  const idx = row * cols + col;
  if (idx < 0 || idx >= place7Tray.length) return -1;
  return idx;
}

function place7InTrayRegion(pos) {
  return isInsideRect(pos, place7TrayRect());
}

// ---------- Bouton « Aide » ----------
function place7HelpButtonRect() {
  const w = Math.min(window.innerWidth * 0.15, 190);
  const h = Math.max(34, window.innerHeight * 0.06);
  const x = window.innerWidth - w - window.innerWidth * 0.03;
  const y = window.innerHeight * 0.04;
  return { x, y, w, h };
}

function place7Solved() {
  if (place7Tray.length) return false;
  return place7Board.every((v, i) => v === i);
}

// ---------- Rendu ----------
function drawPuzzlePiece(img, piece, r, gap) {
  const sw = img.width / PUZZLE_COLS, sh = img.height / PUZZLE_ROWS;
  const scol = piece % PUZZLE_COLS, srow = Math.floor(piece / PUZZLE_COLS);
  ctx.drawImage(img, scol * sw, srow * sh, sw, sh,
    r.x + gap / 2, r.y + gap / 2, r.w - gap, r.h - gap);
}

function drawPlace7Puzzle(assets) {
  const img = assets.puzzle;
  dimBackdrop();
  const b = place7BoardRect();
  const gap = Math.max(1, b.w * 0.006);
  ctx.imageSmoothingEnabled = true;

  // Cadre sombre du plateau (cases vides à remplir).
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRectPath(b.x - gap * 2, b.y - gap * 2, b.w + gap * 4, b.h + gap * 4, gap * 3);
  ctx.fill();
  ctx.restore();

  for (let posIndex = 0; posIndex < PUZZLE_N; posIndex++) {
    const r = place7CellRect(posIndex);
    const piece = place7Board[posIndex];
    const isDragOrigin = place7Drag && place7Drag.origin.type === 'board'
      && place7Drag.origin.pos === posIndex;
    if (piece === -1 || isDragOrigin) {
      // Case vide : léger liseré pour matérialiser l'emplacement.
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(r.x + gap / 2, r.y + gap / 2, r.w - gap, r.h - gap);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + gap / 2, r.y + gap / 2, r.w - gap, r.h - gap);
      ctx.restore();
      continue;
    }
    drawPuzzlePiece(img, piece, r, gap);
  }

  // Réserve (bac de pièces à droite) — masquée une fois vidée.
  if (place7Tray.length) {
    const t = place7TrayRect();
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRectPath(t.x - gap * 2, t.y - gap * 2, t.w + gap * 4, t.h + gap * 4, gap * 3);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < place7Tray.length; i++) {
    if (place7Drag && place7Drag.origin.type === 'tray' && place7Drag.origin.index === i) continue;
    drawPuzzlePiece(img, place7Tray[i], place7TraySlotRect(i), gap);
  }

  // Pièce en cours de déplacement : case cible surlignée + pièce sous le curseur.
  if (place7Drag) {
    const cw = b.w / PUZZLE_COLS, ch = b.h / PUZZLE_ROWS;
    const target = place7CellAt({ x: place7Drag.x, y: place7Drag.y });
    if (target !== -1) {
      const tr = place7CellRect(target);
      ctx.save();
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = Math.max(2, b.w * 0.012);
      ctx.strokeRect(tr.x + gap / 2, tr.y + gap / 2, tr.w - gap, tr.h - gap);
      ctx.restore();
    }
    const dx = place7Drag.x - place7Drag.offX, dy = place7Drag.y - place7Drag.offY;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    drawPuzzlePiece(img, place7Drag.piece, { x: dx, y: dy, w: cw, h: ch }, gap);
    ctx.restore();
  }

  // Bouton « Aide » (révèle le modèle) + modèle si activé.
  drawPlace7HelpButton();
  if (place7ShowModel) drawPlace7Model(img);

  // Consigne.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${Math.round(window.innerHeight * 0.022)}px 'PressStart2P'`;
  ctx.fillText('Glisse les pieces a leur place', window.innerWidth / 2, window.innerHeight * 0.975);
  ctx.restore();
}

function drawPlace7HelpButton() {
  const r = place7HelpButtonRect();
  const hover = place7Phase === 'puzzle' && isInsideRect(pointerPos, r);
  ctx.save();
  ctx.fillStyle = place7ShowModel ? 'rgba(255,215,106,0.9)' : (hover ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.5)');
  roundRectPath(r.x, r.y, r.w, r.h, r.h * 0.25);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  roundRectPath(r.x, r.y, r.w, r.h, r.h * 0.25);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = place7ShowModel ? '#2a2a2a' : '#ffffff';
  ctx.font = `${Math.round(r.h * 0.32)}px 'PressStart2P'`;
  ctx.fillText('Aide', r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

function drawPlace7Model(img) {
  const btn = place7HelpButtonRect();
  const pw = Math.min(window.innerWidth * 0.16, 240);
  const ph = pw / (img.width / img.height);
  const px = window.innerWidth - pw - window.innerWidth * 0.03;
  const py = btn.y + btn.h + window.innerHeight * 0.03;
  ctx.save();
  ctx.globalAlpha = 0.97;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, px, py, pw, ph);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(window.innerHeight * 0.02)}px 'PressStart2P'`;
  ctx.fillText('Modele', px + pw / 2, py - 4);
  ctx.restore();
}

// Petit halo doré de victoire par-dessus le plateau reconstitué.
function drawPlace7Win() {
  const b = place7BoardRect();
  const t = (performance.now() - place7WinStart) / PLACE7_WIN_MS;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = Math.sin(Math.min(t, 1) * Math.PI) * 0.9 + 0.1;
  ctx.fillStyle = '#ffd76a';
  ctx.font = `${Math.round(window.innerHeight * 0.06)}px 'PressStart2P'`;
  ctx.fillText('Bravo !', window.innerWidth / 2, b.y - window.innerHeight * 0.06);
  ctx.restore();
}

// ---------- Entrées : glisser-déposer réserve <-> plateau ----------
function handlePlace7Down(evt) {
  if (place7Phase !== 'puzzle') return;
  const pos = getPointerPos(evt);

  // Bouton « Aide » : bascule l'affichage du modèle.
  if (isInsideRect(pos, place7HelpButtonRect())) {
    place7ShowModel = !place7ShowModel;
    playClickSound();
    return;
  }

  // Attraper une pièce déjà posée sur le plateau.
  const cell = place7CellAt(pos);
  if (cell !== -1 && place7Board[cell] !== -1) {
    const r = place7CellRect(cell);
    place7Drag = {
      piece: place7Board[cell], origin: { type: 'board', pos: cell },
      x: pos.x, y: pos.y, offX: pos.x - r.x, offY: pos.y - r.y
    };
    return;
  }

  // Attraper une pièce de la réserve.
  const idx = place7TrayAt(pos);
  if (idx !== -1) {
    const r = place7TraySlotRect(idx);
    place7Drag = {
      piece: place7Tray[idx], origin: { type: 'tray', index: idx },
      x: pos.x, y: pos.y, offX: pos.x - r.x, offY: pos.y - r.y
    };
  }
}

function handlePlace7Move(evt) {
  if (!place7Drag) return;
  const pos = getPointerPos(evt);
  place7Drag.x = pos.x;
  place7Drag.y = pos.y;
}

// Retire la pièce en cours de déplacement de son emplacement d'origine.
function place7RemoveFromOrigin() {
  const o = place7Drag.origin;
  if (o.type === 'board') place7Board[o.pos] = -1;
  else place7Tray.splice(o.index, 1);
}

// Renvoie une pièce évincée vers l'origine du glissement (case ou réserve).
function place7ReturnBumped(piece) {
  const o = place7Drag.origin;
  if (o.type === 'board') place7Board[o.pos] = piece;
  else place7Tray.push(piece);
}

function handlePlace7Up(evt) {
  if (!place7Drag) return;
  const drop = { x: place7Drag.x, y: place7Drag.y };
  const target = place7CellAt(drop);
  let moved = false;

  if (target !== -1) {
    // Dépose sur une case du plateau.
    const sameCell = place7Drag.origin.type === 'board' && place7Drag.origin.pos === target;
    if (!sameCell) {
      const occupant = place7Board[target];
      place7RemoveFromOrigin();
      if (occupant !== -1) place7ReturnBumped(occupant);
      place7Board[target] = place7Drag.piece;
      moved = true;
    }
  } else if (place7InTrayRegion(drop) && place7Drag.origin.type === 'board') {
    // Renvoie une pièce du plateau vers la réserve.
    place7Board[place7Drag.origin.pos] = -1;
    place7Tray.push(place7Drag.piece);
    moved = true;
  }
  // Sinon : dépose invalide -> la pièce revient à sa place (aucune mutation).

  place7Drag = null;
  if (moved) {
    playClickSound();
    if (place7Solved()) {
      place7Phase = 'win';
      place7WinStart = performance.now();
      playCorrectSound();
    }
  }
}

canvas.addEventListener('pointerdown', (evt) => { if (scene === 'place7') handlePlace7Down(evt); });
canvas.addEventListener('pointerup', (evt) => { if (scene === 'place7') handlePlace7Up(evt); });
canvas.addEventListener('pointercancel', (evt) => { if (scene === 'place7') handlePlace7Up(evt); });
canvas.addEventListener('pointermove', (evt) => {
  if (scene !== 'place7') return;
  handlePlace7Move(evt);
  if (place7Phase !== 'puzzle') { canvas.style.cursor = 'default'; return; }
  if (place7Drag) { canvas.style.cursor = 'grabbing'; return; }
  const pos = getPointerPos(evt);
  const onButton = isInsideRect(pos, place7HelpButtonRect());
  const onPiece = (place7CellAt(pos) !== -1 && place7Board[place7CellAt(pos)] !== -1)
    || place7TrayAt(pos) !== -1;
  canvas.style.cursor = onButton ? 'pointer' : (onPiece ? 'grab' : 'default');
});

// ---------- Scène ----------
function drawPlace7Scene(assets, elapsed, dt) {
  place7Assets = assets;
  const containT = getPlace7ContainT(assets);

  if (assets.place7Fond) drawBackgroundContain(assets.place7Fond, containT);

  updatePlace7Lauren(dt);
  drawCharacter(place7Lauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress, PLACE7_GROUND_Y);

  if (place7Phase === 'play') drawKeyboardMoveHint();

  if (place7Phase === 'puzzle') drawPlace7Puzzle(assets);
  else if (place7Phase === 'win' || place7Phase === 'exit') {
    drawPlace7Puzzle(assets); // plateau reconstitué visible
    drawPlace7Win();
    if (place7Phase === 'win' && performance.now() - place7WinStart >= PLACE7_WIN_MS) {
      place7Phase = 'exit';
      place7ExitStart = performance.now();
    }
  }

  drawSceneFadeIn(elapsed, PLACE7_FADE_IN);

  if (place7Phase === 'exit') {
    const t = Math.min((performance.now() - place7ExitStart) / PLACE7_EXIT_FADE, 1);
    fillBlack(t);
    if (t >= 1) {
      place7Phase = 'done';
      fireworksReset();
      scene = 'fireworks';
      startTime = null;
    }
  }
}
