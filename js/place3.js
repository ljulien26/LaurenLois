// ============================================================
// Décor 3 : Saint-Sernin (souvenir sur un banc). Lauren arrive par la gauche.
// Un ticket tombe du ciel et se pose au sol à côté du banc, entouré d'un léger
// halo. Le joueur amène Lauren dessus et clique : la question s'écrit alors au
// clavier (machine à écrire + son), puis 4 tickets à gratter apparaissent. On
// gratte à la souris (clic maintenu, gauche ou droit) ; sous la couche argentée
// se cache "VRAI" (le bon film) ou "FAUX". Bon ticket révélé -> "GAGNÉ", puis
// enchaînement sur le décor 4 (Cinéma Pathé).
//
// Fond : Assets/Jeu/Places/3.png. Ticket : Assets/Jeu/Ticket/1.png.
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

// Ticket posé au sol à côté du banc (coords 3.png) : il tombe puis devient
// cliquable si Lauren est assez proche.
const PLACE3_TICKET_X = 690;
const PLACE3_TICKET_GROUND_Y = 486;
const PLACE3_TICKET_W = 46;   // largeur d'affichage (coords design) — deux fois plus petit
const PLACE3_TICKET_START_Y = -40;
const PLACE3_TICKET_START_DX = -55; // entre par la gauche : le vent le pousse vers sa position
const PLACE3_TICKET_SWAY = 55;      // amplitude du balancement gauche-droite
const PLACE3_TICKET_FALL_MS = 2800; // chute lente, comme portée par le vent
const PLACE3_TICKET_REACH = 160;

// Résolution interne (fixe) de la couche à gratter de chaque ticket.
const TICKET_TEX_W = 260;
const TICKET_TEX_H = 150;
const SCRATCH_RADIUS = TICKET_TEX_W * 0.1;
const SCRATCH_REVEAL_FRACTION = 0.5;

const place3Lauren = createCharacter(
  PLACE3_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, PLACE3_LAUREN_SCALE, 2
);

// Phases : 'enter' -> 'play' (ticket au sol, cliquable) -> 'scratch' (question
// + tickets) -> 'win' -> 'exit'.
let place3Phase = 'enter';
let place3Entered = false;
let place3Assets = null;
let place3Coatings = null;
let place3Scratch = null;
let place3TicketFallStart = 0;
let place3QuestionStart = null;
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
  place3QuestionStart = null;
  place3TicketFallStart = performance.now();
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

// ---------- Ticket qui tombe au sol (porté par le vent) ----------
function place3TicketFallT() {
  return Math.min((performance.now() - place3TicketFallStart) / PLACE3_TICKET_FALL_MS, 1);
}

function place3TicketLanded() {
  return place3TicketFallT() >= 1;
}

// Position + inclinaison du ticket pendant sa chute : descente lente adoucie à
// l'arrivée, dérive de la gauche vers sa position finale, et balancement
// gauche-droite qui s'atténue jusqu'à se poser bien à plat.
function place3TicketPose() {
  const t = place3TicketFallT();
  const yEase = 1 - Math.pow(1 - t, 1.8); // ralentit en approchant du sol
  const y = PLACE3_TICKET_START_Y + (PLACE3_TICKET_GROUND_Y - PLACE3_TICKET_START_Y) * yEase;
  const drift = PLACE3_TICKET_START_DX * (1 - t);
  const sway = Math.sin(t * Math.PI * 4) * PLACE3_TICKET_SWAY * (1 - t);
  const angle = Math.sin(t * Math.PI * 4) * 0.3 * (1 - t);
  return { x: PLACE3_TICKET_X + drift + sway, y, angle };
}

function laurenNearTicket() {
  return Math.abs(place3Lauren.x - PLACE3_TICKET_X) <= PLACE3_TICKET_REACH;
}

function drawPlace3GroundTicket(assets, containT) {
  const img = assets.ticketImg;
  const pose = place3TicketPose();
  const w = PLACE3_TICKET_W * containT.scale;
  const h = w * (img.height / img.width);
  const cx = containT.dx + pose.x * containT.scale;
  const cy = containT.dy + pose.y * containT.scale;

  // halo pulsé une fois posé
  if (place3TicketLanded()) {
    const pulse = 0.2 + Math.sin(performance.now() / 360) * 0.12;
    ctx.save();
    ctx.globalAlpha = Math.max(0, pulse);
    ctx.globalCompositeOperation = 'lighter';
    const r = w * 0.9;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, 'rgba(255, 226, 150, 0.85)');
    glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pose.angle);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// ---------- Déplacement de Lauren ----------
function updatePlace3Lauren(dt) {
  if (!place3Entered) {
    updateCharacter(place3Lauren, dt);
    if (!place3Lauren.walking) { place3Entered = true; place3Phase = 'play'; }
    updateWalkSound(dt, place3Lauren.walking);
    return;
  }

  stepPlayerWalk(place3Lauren, place3Phase === 'play' ? keyDirection() : 0, dt, PLACE3_LAUREN_MIN_X, PLACE3_LAUREN_MAX_X);
}

// ---------- Mise en page des tickets à gratter (tient dans l'écran) ----------
function place3Layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const uf = uiSizeFactor();

  let panelW = Math.min(vw * 0.6, 520) * uf;
  let panelH = panelW / (1717 / 916);
  const maxPanelH = vh * 0.3;
  if (panelH > maxPanelH) { panelH = maxPanelH; panelW = panelH * (1717 / 916); }
  const panel = { x: vw / 2 - panelW / 2, y: vh * 0.03, w: panelW, h: panelH };

  const areaTop = panel.y + panel.h + vh * 0.035;
  const areaBottom = vh * 0.9; // laisse la place pour la consigne du bas
  const rowGap = vh * 0.035;
  let ticketH = Math.min((areaBottom - areaTop - rowGap) / 2, vh * 0.27);
  let ticketW = ticketH * (260 / 150);
  const maxW = vw * 0.44;
  if (ticketW > maxW) { ticketW = maxW; ticketH = ticketW * (150 / 260); }
  const colGap = Math.min(ticketW * 0.14, vw * 0.05);

  const gridW = ticketW * 2 + colGap;
  const gridH = ticketH * 2 + rowGap;
  const startX = vw / 2 - gridW / 2;
  const startY = areaTop + Math.max(0, (areaBottom - areaTop - gridH) / 2);
  return {
    panel,
    rects: [
      { x: startX, y: startY, w: ticketW, h: ticketH },
      { x: startX + ticketW + colGap, y: startY, w: ticketW, h: ticketH },
      { x: startX, y: startY + ticketH + rowGap, w: ticketW, h: ticketH },
      { x: startX + ticketW + colGap, y: startY + ticketH + rowGap, w: ticketW, h: ticketH },
    ],
  };
}

function place3ScratchArea(rect) {
  const th = rect.h * 0.36; // bandeau du titre
  return { x: rect.x + rect.w * 0.07, y: rect.y + th, w: rect.w * 0.86, h: rect.h - th - rect.h * 0.1 };
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

// État "machine à écrire" des tickets : chacun apparaît à son tour après la
// question, et son titre s'écrit caractère par caractère (comme au café).
function place3TicketsTyping() {
  return answersTyping(place3QuestionStart, PLACE3_QUESTION, PLACE3_TICKETS);
}

function place3AllTyped() {
  return questionTypingDone(place3QuestionStart, PLACE3_QUESTION) &&
    place3TicketsTyping().every((a) => a.full);
}

function drawPlace3Ticket(assets, r, i, typingState) {
  // carte
  ctx.save();
  roundRectPath(r.x, r.y, r.w, r.h, r.w * 0.06);
  ctx.fillStyle = '#fff7ec';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#d9b48a';
  ctx.stroke();
  ctx.restore();

  // titre qui s'écrit caractère par caractère (taille = réponses du café).
  const fitFs = fitButtonFontSize(PLACE3_TICKETS[i], r.w * 0.86, r.h * 0.13);
  const fs = Math.min(firstQuestionFontPx(), fitFs);
  ctx.font = `${fs}px 'PressStart2P'`;
  ctx.fillStyle = '#7a4a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let title = PLACE3_TICKETS[i].slice(0, typingState.shown);
  if (!typingState.full && Math.floor(performance.now() / 400) % 2 === 0) title += '_';
  ctx.fillText(title, r.x + r.w / 2, r.y + r.h * 0.18);

  // La zone à gratter n'apparaît qu'une fois le titre entièrement écrit.
  if (!typingState.full) return;

  const sa = place3ScratchArea(r);
  const win = i === PLACE3_CORRECT;
  ctx.save();
  roundRectPath(sa.x, sa.y, sa.w, sa.h, sa.w * 0.05);
  ctx.clip();
  ctx.fillStyle = win ? '#e9f8ee' : '#fbecec';
  ctx.fillRect(sa.x, sa.y, sa.w, sa.h);
  ctx.fillStyle = win ? '#1f9d55' : '#c0392b';
  ctx.font = `${Math.round(sa.h * 0.4)}px 'PressStart2P'`;
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
}

function drawPlace3Tickets(assets) {
  dimBackdrop();
  const layout = place3Layout();

  // La question s'écrit d'abord (le son clavier est géré ici, pas par
  // drawTypingQuestion, pour couvrir aussi l'écriture des tickets ensuite).
  const qDone = drawTypingQuestion(assets.quizPanel, layout.panel, PLACE3_QUESTION, place3QuestionStart, false);
  if (!qDone) {
    setKeyboardTyping(place3QuestionStart != null); // question en cours d'écriture
    return;
  }

  // Puis chaque ticket apparaît à son tour, titre écrit caractère par caractère.
  const typing = place3TicketsTyping();
  layout.rects.forEach((r, i) => {
    if (typing[i].visible) drawPlace3Ticket(assets, r, i, typing[i]);
  });

  // Le son clavier continue tant que les tickets s'écrivent, puis s'arrête net.
  const allTyped = typing.every((a) => a.full);
  setKeyboardTyping(!allTyped);

  if (allTyped) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `${Math.round(window.innerHeight * 0.026)}px 'PressStart2P'`;
    ctx.fillText('Gratte un ticket (clic maintenu)', window.innerWidth / 2, window.innerHeight * 0.97);
    ctx.restore();
  }
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

// ---------- Entrées souris ----------
function handlePlace3Down(evt) {
  const pos = getPointerPos(evt);

  // Cliquer le ticket au sol (une fois posé et Lauren proche) : ouvre la question.
  if (place3Phase === 'play' && place3TicketLanded() && laurenNearTicket()) {
    const containT = getPlace3ContainT(place3Assets);
    const w = PLACE3_TICKET_W * containT.scale;
    const cx = containT.dx + PLACE3_TICKET_X * containT.scale;
    const cy = containT.dy + PLACE3_TICKET_GROUND_Y * containT.scale;
    // Zone de clic généreuse (le ticket est petit) : environ la taille du halo.
    if (Math.abs(pos.x - cx) <= w * 1.3 && Math.abs(pos.y - cy) <= w * 1.1) {
      place3Phase = 'scratch';
      place3QuestionStart = performance.now();
    }
    return;
  }

  // Gratter (uniquement une fois la question ET les 4 tickets écrits).
  if (place3Phase !== 'scratch') return;
  if (!place3AllTyped()) return;
  const rects = place3Layout().rects;
  for (let i = 0; i < 4; i++) {
    if (place3Coatings[i].revealed) continue;
    const sa = place3ScratchArea(rects[i]);
    if (pointInRect(pos, sa)) {
      playClickSound();
      place3Scratch = { pointerId: evt.pointerId, ticket: i, lastTx: null, lastTy: null };
      place3ScratchAt(i, sa, pos);
      return;
    }
  }
}

function handlePlace3Move(evt) {
  if (!place3Scratch || evt.pointerId !== place3Scratch.pointerId) return;
  const rects = place3Layout().rects;
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
    if (i === PLACE3_CORRECT) {
      playCorrectSound();
      if (place3Phase === 'scratch') {
        place3Phase = 'win';
        place3WinStart = performance.now();
      }
    } else {
      playWrongSound();
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

// Curseur "main" au survol du ticket au sol ou d'un ticket à gratter.
canvas.addEventListener('pointermove', (evt) => {
  if (scene !== 'place3') return;
  const pos = getPointerPos(evt);
  let over = false;
  if (place3Phase === 'play' && place3TicketLanded() && laurenNearTicket()) {
    const containT = getPlace3ContainT(place3Assets);
    const w = PLACE3_TICKET_W * containT.scale;
    const cx = containT.dx + PLACE3_TICKET_X * containT.scale;
    const cy = containT.dy + PLACE3_TICKET_GROUND_Y * containT.scale;
    over = Math.abs(pos.x - cx) <= w * 1.3 && Math.abs(pos.y - cy) <= w * 1.1;
  } else if (place3Phase === 'scratch' && place3AllTyped()) {
    over = place3Layout().rects.some((r, i) => !place3Coatings[i].revealed && pointInRect(pos, place3ScratchArea(r)));
  }
  canvas.style.cursor = over ? 'pointer' : 'default';
});

// ---------- Scène ----------
function drawPlace3Scene(assets, elapsed, dt) {
  place3Assets = assets;
  const containT = getPlace3ContainT(assets);

  if (assets.place3Fond) drawBackgroundContain(assets.place3Fond, containT);

  // Ticket au sol (tombe puis attend d'être cliqué), avant l'ouverture.
  if (place3Phase === 'enter' || place3Phase === 'play') {
    drawPlace3GroundTicket(assets, containT);
  }

  updatePlace3Lauren(dt);
  drawCharacter(place3Lauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress, PLACE3_GROUND_Y);

  if (place3Phase === 'play' && place3TicketLanded()) drawKeyboardMoveHint();

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

  drawSceneFadeIn(elapsed, PLACE3_FADE_IN);

  if (place3Phase === 'exit') {
    const t = Math.min((performance.now() - place3ExitStart) / PLACE3_EXIT_FADE, 1);
    fillBlack(t);
    if (t >= 1) {
      place3Phase = 'done';
      place4Reset();
      scene = 'place4';
      startTime = null;
    }
  }
}
