// ============================================================
// Décor 3 : Saint-Sernin (souvenir sur un banc). Lauren arrive par la gauche
// et avance jusqu'au banc ; une question apparaît avec 4 tickets à gratter. Le
// joueur gratte à la souris (clic maintenu + déplacement, gauche ou droit).
// Sous la couche argentée se cache "VRAI" (le bon film) ou "FAUX". Quand le bon
// ticket est révélé : "GAGNÉ", puis enchaînement sur le décor 4 (Cinéma Pathé).
//
// Fond : Assets/Jeu/Places/3.png. Réutilise quizPanel (Question.png).
// ============================================================

// >>> CONTENU <<<
const PLACE3_QUESTION = 'Quel était le nom du 1er film qu’on a vu ensemble ?';
const PLACE3_TICKETS = ['Heureux gagnants', 'Le ticket gagnant', 'La chance sourit', 'Jackpot Surprise'];
const PLACE3_CORRECT = 0; // "Heureux gagnants" révèle VRAI

const PLACE3_GROUND_Y = 505;
const PLACE3_LAUREN_SCALE = 0.82;
const PLACE3_LAUREN_START_X = -70;
const PLACE3_LAUREN_READY_X = 150;
const PLACE3_LAUREN_MIN_X = 60;
const PLACE3_LAUREN_MAX_X = 905;
const PLACE3_TRIGGER_X = 600; // arrivée près du banc : les tickets apparaissent

// Résolution interne (fixe) de la couche à gratter de chaque ticket.
const TICKET_TEX_W = 260;
const TICKET_TEX_H = 150;
const SCRATCH_RADIUS = TICKET_TEX_W * 0.1;
const SCRATCH_REVEAL_FRACTION = 0.5;

const place3Lauren = createCharacter(
  PLACE3_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, PLACE3_LAUREN_SCALE, 2
);

// Phases : 'enter' -> 'play' (avance) -> 'scratch' (tickets) -> 'win' -> 'exit'.
let place3Phase = 'enter';
let place3Entered = false;
let place3Assets = null;
let place3Coatings = null;
let place3Scratch = null;
let place3WinStart = 0;
let place3ExitStart = 0;

const PLACE3_FADE_IN = 500;
const PLACE3_WIN_MS = 1500;
const PLACE3_EXIT_FADE = 1000;

function place3MakeCoating() {
  const c = document.createElement('canvas');
  c.width = TICKET_TEX_W;
  c.height = TICKET_TEX_H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, TICKET_TEX_W, TICKET_TEX_H);
  grad.addColorStop(0, '#ccced4');
  grad.addColorStop(0.5, '#a7abb3');
  grad.addColorStop(1, '#d0d3d9');
  g.fillStyle = grad;
  g.fillRect(0, 0, TICKET_TEX_W, TICKET_TEX_H);
  for (let i = 0; i < 240; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * TICKET_TEX_W, Math.random() * TICKET_TEX_H, 2, 2);
  }
  g.fillStyle = '#6b6f78';
  g.font = "22px 'Courier New', monospace";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('★ GRATTE ICI ★', TICKET_TEX_W / 2, TICKET_TEX_H / 2);
  return { canvas: c, ctx: g, revealed: false };
}

function place3Reset() {
  place3Phase = 'enter';
  place3Entered = false;
  place3Scratch = null;
  place3Coatings = [place3MakeCoating(), place3MakeCoating(), place3MakeCoating(), place3MakeCoating()];
  place3Lauren.x = PLACE3_LAUREN_START_X;
  place3Lauren.facing = 'right';
  place3Lauren.walking = false;
  place3Lauren.targetX = null;
  characterWalkTo(place3Lauren, PLACE3_LAUREN_READY_X);
}

function getPlace3ContainT(assets) {
  const w = assets.place3Fond ? assets.place3Fond.width : 960;
  const h = assets.place3Fond ? assets.place3Fond.height : 540;
  return getContainTransform(w, h, window.innerWidth, window.innerHeight);
}

// ---------- Déplacement de Lauren ----------
function updatePlace3Lauren(dt) {
  if (!place3Entered) {
    updateCharacter(place3Lauren, dt);
    if (!place3Lauren.walking) { place3Entered = true; place3Phase = 'play'; }
    updateWalkSound(dt, place3Lauren.walking);
    return;
  }

  const dir = place3Phase === 'play' ? keyDirection() : 0;
  if (dir === 0) {
    place3Lauren.walking = false;
    place3Lauren.frameIndex = 0;
    place3Lauren.frameElapsed = 0;
    updateWalkSound(dt, false);
  } else {
    const nextX = place3Lauren.x + dir * CHARACTER_WALK_SPEED * dt;
    const clampedX = Math.max(PLACE3_LAUREN_MIN_X, Math.min(PLACE3_LAUREN_MAX_X, nextX));
    if (clampedX === place3Lauren.x) {
      place3Lauren.walking = false;
      place3Lauren.frameIndex = 0;
      place3Lauren.frameElapsed = 0;
      updateWalkSound(dt, false);
    } else {
      place3Lauren.facing = dir < 0 ? 'left' : 'right';
      place3Lauren.x = clampedX;
      place3Lauren.walking = true;
      place3Lauren.frameElapsed += dt * 1000;
      while (place3Lauren.frameElapsed >= CHARACTER_WALK_FRAME_DURATION) {
        place3Lauren.frameElapsed -= CHARACTER_WALK_FRAME_DURATION;
        place3Lauren.frameIndex = (place3Lauren.frameIndex + 1) % place3Lauren.walkFrameCount;
      }
      updateWalkSound(dt, true);
    }
  }

  if (place3Phase === 'play' && place3Lauren.x >= PLACE3_TRIGGER_X) {
    place3Phase = 'scratch';
  }
}

// ---------- Tickets à gratter ----------
function place3QuestionPanelRect() {
  const w = Math.min(window.innerWidth * 0.66, 540) * uiSizeFactor();
  const h = w / (1717 / 916);
  return { x: window.innerWidth / 2 - w / 2, y: window.innerHeight * 0.04, w, h };
}

function place3TicketRects() {
  const panel = place3QuestionPanelRect();
  const w = Math.min(window.innerWidth * 0.34, 240) * uiSizeFactor();
  const h = w * (TICKET_TEX_H / TICKET_TEX_W) * 1.4;
  const gapX = w * 0.14;
  const gapY = h * 0.24;
  const cx = window.innerWidth / 2;
  const topY = panel.y + panel.h + h * 0.28;
  const leftX = cx - w - gapX / 2;
  const rightX = cx + gapX / 2;
  return [
    { x: leftX, y: topY, w, h },
    { x: rightX, y: topY, w, h },
    { x: leftX, y: topY + h + gapY, w, h },
    { x: rightX, y: topY + h + gapY, w, h },
  ];
}

function place3ScratchArea(rect) {
  const th = rect.h * 0.34;
  return { x: rect.x + rect.w * 0.06, y: rect.y + th, w: rect.w * 0.88, h: rect.h - th - rect.h * 0.08 };
}

function place3CoatingRevealed(coat) {
  const data = coat.ctx.getImageData(0, 0, TICKET_TEX_W, TICKET_TEX_H).data;
  let cleared = 0, total = 0;
  for (let i = 3; i < data.length; i += 4 * 10) {
    total++;
    if (data[i] < 40) cleared++;
  }
  return total ? cleared / total : 0;
}

function drawPlace3Tickets(assets) {
  dimBackdrop();

  const panel = place3QuestionPanelRect();
  ctx.drawImage(assets.quizPanel, 0, 0, assets.quizPanel.width, assets.quizPanel.height,
    panel.x, panel.y, panel.w, panel.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a1a0a';
  const qLines = wrapPixelQuestion(PLACE3_QUESTION, panel.w * 0.76, panel.h * 0.15);
  const lineH = panel.h * 0.24;
  qLines.lines.forEach((ln, i) => {
    ctx.font = `${qLines.fs}px 'PressStart2P'`;
    ctx.fillText(ln, panel.x + panel.w / 2, panel.y + panel.h / 2 + (i - (qLines.lines.length - 1) / 2) * lineH);
  });

  const rects = place3TicketRects();
  rects.forEach((r, i) => {
    ctx.save();
    roundRectPath(r.x, r.y, r.w, r.h, r.w * 0.06);
    ctx.fillStyle = '#fff7ec';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#d9b48a';
    ctx.stroke();
    ctx.restore();

    const fs = fitButtonFontSize(PLACE3_TICKETS[i], r.w * 0.86, r.h * 0.12);
    ctx.font = `${fs}px 'PressStart2P'`;
    ctx.fillStyle = '#7a4a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PLACE3_TICKETS[i], r.x + r.w / 2, r.y + r.h * 0.17);

    const sa = place3ScratchArea(r);
    const win = i === PLACE3_CORRECT;
    ctx.save();
    roundRectPath(sa.x, sa.y, sa.w, sa.h, sa.w * 0.05);
    ctx.clip();
    ctx.fillStyle = win ? '#e9f8ee' : '#fbecec';
    ctx.fillRect(sa.x, sa.y, sa.w, sa.h);
    ctx.fillStyle = win ? '#1f9d55' : '#c0392b';
    ctx.font = `${Math.round(sa.h * 0.34)}px 'PressStart2P'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(win ? 'VRAI' : 'FAUX', sa.x + sa.w / 2, sa.y + sa.h / 2);
    ctx.restore();

    const coat = place3Coatings[i];
    if (!coat.revealed) {
      ctx.save();
      roundRectPath(sa.x, sa.y, sa.w, sa.h, sa.w * 0.05);
      ctx.clip();
      ctx.drawImage(coat.canvas, 0, 0, TICKET_TEX_W, TICKET_TEX_H, sa.x, sa.y, sa.w, sa.h);
      ctx.restore();
    }
  });

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `${Math.round(window.innerHeight * 0.028)}px 'PressStart2P'`;
  ctx.fillText('Gratte un ticket (clic maintenu)', window.innerWidth / 2, window.innerHeight * 0.97);
  ctx.restore();
}

function place3Win() {
  const t = (performance.now() - place3WinStart) / PLACE3_WIN_MS;
  ctx.save();
  ctx.globalAlpha = Math.sin(Math.min(t, 1) * Math.PI) * 0.9 + 0.1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd76a';
  ctx.font = `${Math.round(window.innerHeight * 0.07)}px 'PressStart2P'`;
  ctx.fillText('GAGNÉ !', window.innerWidth / 2, window.innerHeight * 0.5);
  ctx.restore();
}

// ---------- Grattage à la souris ----------
function handlePlace3Down(evt) {
  if (place3Phase !== 'scratch') return;
  const pos = getPointerPos(evt);
  const rects = place3TicketRects();
  for (let i = 0; i < 4; i++) {
    if (place3Coatings[i].revealed) continue;
    const sa = place3ScratchArea(rects[i]);
    if (pointInRect(pos, sa)) {
      place3Scratch = { pointerId: evt.pointerId, ticket: i, lastTx: null, lastTy: null };
      place3ScratchAt(i, sa, pos);
      return;
    }
  }
}

function handlePlace3Move(evt) {
  if (!place3Scratch || evt.pointerId !== place3Scratch.pointerId) return;
  const rects = place3TicketRects();
  const sa = place3ScratchArea(rects[place3Scratch.ticket]);
  place3ScratchAt(place3Scratch.ticket, sa, getPointerPos(evt));
}

function handlePlace3Up(evt) {
  if (!place3Scratch || evt.pointerId !== place3Scratch.pointerId) return;
  const i = place3Scratch.ticket;
  place3Scratch = null;
  const coat = place3Coatings[i];
  if (!coat.revealed && place3CoatingRevealed(coat) >= SCRATCH_REVEAL_FRACTION) {
    coat.revealed = true;
    if (i === PLACE3_CORRECT && place3Phase === 'scratch') {
      place3Phase = 'win';
      place3WinStart = performance.now();
    }
  }
}

function place3ScratchAt(i, sa, pos) {
  const coat = place3Coatings[i];
  if (coat.revealed) return;
  const tx = ((pos.x - sa.x) / sa.w) * TICKET_TEX_W;
  const ty = ((pos.y - sa.y) / sa.h) * TICKET_TEX_H;
  const g = coat.ctx;
  g.globalCompositeOperation = 'destination-out';
  if (place3Scratch && place3Scratch.lastTx !== null) {
    g.lineCap = 'round';
    g.lineWidth = SCRATCH_RADIUS * 2;
    g.beginPath();
    g.moveTo(place3Scratch.lastTx, place3Scratch.lastTy);
    g.lineTo(tx, ty);
    g.stroke();
  }
  g.beginPath();
  g.arc(tx, ty, SCRATCH_RADIUS, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  if (place3Scratch) { place3Scratch.lastTx = tx; place3Scratch.lastTy = ty; }
}

canvas.addEventListener('pointerdown', (evt) => { if (scene === 'place3') handlePlace3Down(evt); });
canvas.addEventListener('pointermove', (evt) => { if (scene === 'place3') handlePlace3Move(evt); });
canvas.addEventListener('pointerup', (evt) => { if (scene === 'place3') handlePlace3Up(evt); });
canvas.addEventListener('pointercancel', (evt) => { if (scene === 'place3') handlePlace3Up(evt); });

// ---------- Scène ----------
function drawPlace3Scene(assets, elapsed, dt) {
  place3Assets = assets;
  const containT = getPlace3ContainT(assets);

  if (assets.place3Fond) drawBackgroundContain(assets.place3Fond, containT);

  updatePlace3Lauren(dt);
  drawCharacter(place3Lauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress, PLACE3_GROUND_Y);

  if (place3Phase === 'play') drawKeyboardMoveHint();

  if (place3Phase === 'scratch' || place3Phase === 'win' || place3Phase === 'exit') {
    drawPlace3Tickets(assets);
  }

  if (place3Phase === 'win') {
    place3Win();
    if (performance.now() - place3WinStart >= PLACE3_WIN_MS) {
      place3Phase = 'exit';
      place3ExitStart = performance.now();
    }
  }

  if (elapsed < PLACE3_FADE_IN) {
    ctx.save();
    ctx.globalAlpha = 1 - elapsed / PLACE3_FADE_IN;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
  }

  if (place3Phase === 'exit') {
    const t = Math.min((performance.now() - place3ExitStart) / PLACE3_EXIT_FADE, 1);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
    if (t >= 1) {
      place3Phase = 'done';
      place4Reset();
      scene = 'place4';
      startTime = null;
    }
  }
}
