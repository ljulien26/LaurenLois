// ============================================================
// Décor 4 : Cinéma Pathé (façade). TROIS PORTES = TROIS SÉANCES. Au-dessus de
// chaque porte, les affiches du film que l'on y projette (gauche : Heureux
// gagnants, centre : F1, droite : Materialists). Lauren arrive par la gauche ;
// les trois portes s'éclairent d'un halo. On peut CLIQUER LES AFFICHES pour les
// voir en grand, puis amener Lauren devant une porte et cliquer dessus pour
// choisir sa séance -> décor 5.
//
// Fond : Assets/Jeu/Places/4.png. Affiches : Assets/Jeu/AffichesCinema/.
// ============================================================

// >>> CONTENU <<< Une question par séance : la date à laquelle on a vu CE film.
// L'ordre suit celui des portes (gauche, centre, droite).
const PLACE4_FILMS = [
  {
    question: 'Quand a-t-on vu « Heureux Gagnants » au cinéma ?',
    reponses: ['1er avril 2024', '6 avril 2024', '10 avril 2024', '15 avril 2024'],
    bonne: 1, // 6 avril 2024
  },
  {
    question: 'Quand a-t-on vu « F1 » au cinéma ?',
    reponses: ['3 juillet 2025', '11 juillet 2025', '27 juillet 2025', '2 août 2025'],
    bonne: 3, // 2 août 2025
  },
  {
    question: 'Quand a-t-on vu « Materialist » au cinéma ?',
    reponses: ['3 juin 2025', '3 juillet 2025', '3 août 2025', '3 septembre 2025'],
    bonne: 2, // 3 août 2025
  },
];

const PLACE4_GROUND_Y = 515;
const PLACE4_LAUREN_SCALE = 0.8;
const PLACE4_LAUREN_START_X = -70;
const PLACE4_LAUREN_READY_X = 150;
const PLACE4_LAUREN_MIN_X = 60;
const PLACE4_LAUREN_MAX_X = 905;

// Les trois séances, de gauche à droite (coordonnées relevées sur 4.png) :
// doorX = milieu de la porte, posters = bandeau des 4 affiches au-dessus.
const PLACE4_DOORS = [
  { film: 0, doorX: 209, posters: { x: 126, y: 266, w: 136, h: 52 } },
  { film: 1, doorX: 483, posters: { x: 413, y: 266, w: 149, h: 52 } },
  { film: 2, doorX: 759, posters: { x: 700, y: 266, w: 145, h: 52 } },
];
const PLACE4_DOOR_Y = 385;    // milieu de la porte (halo)
const PLACE4_DOOR_R = 74;     // rayon de la zone cliquable / du halo
// Portée : plus petite que la moitié de l'écart entre deux portes, pour qu'une
// seule séance à la fois soit à portée de Lauren.
const PLACE4_DOOR_REACH = 120;

const place4Lauren = createCharacter(
  PLACE4_LAUREN_START_X, 'left', LAUREN_VISIBLE_WIDTH_RATIO, 5, PLACE4_LAUREN_SCALE, 2
);

// Phases : 'enter' (arrivée) -> 'choix' (halos + affiches) -> 'question' (date
// du film choisi) -> 'exit'.
let place4Phase = 'enter';
let place4Entered = false;
let place4Assets = null;
let place4ExitStart = 0;
// Question de la séance choisie.
let place4QuestionStart = null;
let place4Picked = -1;
let place4PickedStart = 0;
let place4PickedCorrect = false;
// Affiche affichée en grand (index de séance), -1 si aucune.
let place4Zoom = -1;
let place4ZoomStart = 0;
// Panneau d'aide ouvert (bouton « Aide » en haut à droite).
let place4Help = false;
// Séance choisie (index), -1 tant qu'elle n'a pas franchi une porte. Sert au
// décor 5 pour s'adapter au film choisi.
let place4Choice = -1;

const PLACE4_FADE_IN = 500;
const PLACE4_EXIT_FADE = 900;
const PLACE4_ZOOM_IN = 260; // ms d'ouverture de l'affiche en grand

function place4Reset() {
  place4Phase = 'enter';
  place4Entered = false;
  place4Zoom = -1;
  place4Help = false;
  place4Choice = -1;
  place4QuestionStart = null;
  place4Picked = -1;
  place4Lauren.x = PLACE4_LAUREN_START_X;
  place4Lauren.facing = 'right';
  place4Lauren.walking = false;
  place4Lauren.targetX = null;
  characterWalkTo(place4Lauren, PLACE4_LAUREN_READY_X);
}

function getPlace4ContainT(assets) {
  const w = assets && assets.place4Fond ? assets.place4Fond.width : 960;
  const h = assets && assets.place4Fond ? assets.place4Fond.height : 540;
  return getContainTransform(w, h, window.innerWidth, window.innerHeight);
}

// ---------- Ambiance : enseignes lumineuses + sol mouillé ----------
// Tout est procédural (aucun asset) : un halo qui respire sur les trois
// enseignes, un grésillement de néon de temps en temps sur « PATHE », et la
// lumière des portes qui se reflète sur le dallage mouillé en ondulant.
const PLACE4_SIGNS = [
  { x: 119, y: 231, w: 145, h: 32, neon: false }, // cinéma (gauche)
  { x: 417, y: 231, w: 146, h: 32, neon: true },  // PATHE (centre)
  { x: 699, y: 231, w: 145, h: 32, neon: false }, // cinéma (droite)
];
const PLACE4_FLOOR_TOP = 449;    // haut du dallage mouillé
const PLACE4_FLOOR_BOTTOM = 534; // au-delà, le reflet est éteint
const PLACE4_FLOOR_HALF_W = 66;  // demi-largeur d'une flaque de lumière

// Grésillement du néon : courtes salves, espacées de plusieurs secondes.
let place4FlickerEnd = 0;
let place4NextFlicker = 0;

function place4NeonLevel(t) {
  if (place4NextFlicker === 0) place4NextFlicker = t + 3000 + Math.random() * 5000;
  if (t >= place4NextFlicker) {
    place4FlickerEnd = t + 180 + Math.random() * 260;
    place4NextFlicker = place4FlickerEnd + 5000 + Math.random() * 9000;
  }
  if (t > place4FlickerEnd) return 1;
  // Battement rapide et irrégulier : l'enseigne s'éteint presque par à-coups.
  return Math.sin(t / 26) * Math.sin(t / 11) > 0.1 ? 0.3 : 1;
}

function drawPlace4SignGlow(sign, containT, t, level) {
  const x = containT.dx + sign.x * containT.scale;
  const y = containT.dy + sign.y * containT.scale;
  const w = sign.w * containT.scale;
  const h = sign.h * containT.scale;
  const cx = x + w / 2, cy = y + h / 2;
  const breathe = 0.85 + 0.15 * Math.sin(t / 900 + sign.x);
  const a = breathe * level;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Bloom diffus autour du panneau.
  const r = Math.max(w, h) * 0.8;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0, `rgba(255, 222, 150, ${0.17 * a})`);
  glow.addColorStop(1, 'rgba(255, 222, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Cœur : le panneau lui-même, un peu plus lumineux.
  ctx.globalAlpha = 0.1 * a;
  ctx.fillStyle = 'rgb(255, 236, 190)';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Reflet des portes sur le dallage : une flaque de lumière par porte, dans
// laquelle glissent lentement des ondes horizontales.
function drawPlace4FloorGlow(containT, t, neonLevel) {
  const top = containT.dy + PLACE4_FLOOR_TOP * containT.scale;
  const bot = containT.dy + PLACE4_FLOOR_BOTTOM * containT.scale;
  const halfW = PLACE4_FLOOR_HALF_W * containT.scale;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  PLACE4_DOORS.forEach((d, i) => {
    const cx = containT.dx + d.doorX * containT.scale;
    const level = (d.film === 1 ? neonLevel : 1) * (0.86 + 0.14 * Math.sin(t / 1100 + i * 2.1));

    // Flaque : plus large et plus faible en s'éloignant de la porte.
    const pool = ctx.createLinearGradient(0, top, 0, bot);
    pool.addColorStop(0, `rgba(255, 214, 140, ${0.15 * level})`);
    pool.addColorStop(0.45, `rgba(255, 206, 130, ${0.07 * level})`);
    pool.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.moveTo(cx - halfW * 0.72, top);
    ctx.lineTo(cx + halfW * 0.72, top);
    ctx.lineTo(cx + halfW * 1.5, bot);
    ctx.lineTo(cx - halfW * 1.5, bot);
    ctx.closePath();
    ctx.fill();

    // Ondes : trois bandes qui descendent doucement dans la flaque.
    for (let k = 0; k < 3; k++) {
      const p = ((t / 3400 + k / 3 + i * 0.17) % 1);
      const y = top + p * (bot - top);
      const fade = Math.sin(p * Math.PI); // apparaît puis s'efface
      const bandH = Math.max(1.5, 3 * containT.scale);
      const spread = halfW * (0.7 + p * 0.8);
      const band = ctx.createLinearGradient(cx - spread, 0, cx + spread, 0);
      const aa = 0.09 * fade * level;
      band.addColorStop(0, 'rgba(255, 228, 170, 0)');
      band.addColorStop(0.5, `rgba(255, 228, 170, ${aa})`);
      band.addColorStop(1, 'rgba(255, 228, 170, 0)');
      ctx.fillStyle = band;
      ctx.fillRect(cx - spread, y, spread * 2, bandH);
    }
  });
  ctx.restore();
}

function drawPlace4Ambience(containT) {
  const t = performance.now();
  const neon = place4NeonLevel(t);
  PLACE4_SIGNS.forEach((s) => drawPlace4SignGlow(s, containT, t, s.neon ? neon : 1));
  drawPlace4FloorGlow(containT, t, neon);
}

// ---------- Déplacement de Lauren ----------
function updatePlace4Lauren(dt) {
  if (!place4Entered) {
    updateCharacter(place4Lauren, dt);
    if (!place4Lauren.walking) { place4Entered = true; place4Phase = 'choix'; }
    updateWalkSound(dt, place4Lauren.walking);
    return;
  }
  // On ne se déplace pas tant qu'une affiche est ouverte en grand.
  const controllable = place4Phase === 'choix' && place4Zoom === -1;
  stepPlayerWalk(place4Lauren, controllable ? keyDirection() : 0, dt, PLACE4_LAUREN_MIN_X, PLACE4_LAUREN_MAX_X);
}

// ---------- Portes ----------
function place4DoorScreen(door, containT) {
  return {
    cx: containT.dx + door.doorX * containT.scale,
    cy: containT.dy + PLACE4_DOOR_Y * containT.scale,
    r: PLACE4_DOOR_R * containT.scale,
  };
}

// La séance à portée de Lauren (index), ou -1 si elle est entre deux portes.
function place4DoorInReach() {
  for (let i = 0; i < PLACE4_DOORS.length; i++) {
    if (Math.abs(place4Lauren.x - PLACE4_DOORS[i].doorX) <= PLACE4_DOOR_REACH) return i;
  }
  return -1;
}

// Halo doré sur une porte : le MÊME sur les trois (même intensité), pour dire
// « il y a trois séances, à toi de choisir » sans en désigner aucune.
function drawPlace4DoorHint(door, containT, elapsed) {
  const s = place4DoorScreen(door, containT);
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
}

// ---------- Affiches ----------
function place4PosterRect(door, containT) {
  const p = door.posters;
  return {
    x: containT.dx + p.x * containT.scale,
    y: containT.dy + p.y * containT.scale,
    w: p.w * containT.scale,
    h: p.h * containT.scale,
  };
}

// Séance dont les affiches sont sous le pointeur, ou -1.
function place4PosterUnder(pos, containT) {
  for (let i = 0; i < PLACE4_DOORS.length; i++) {
    if (pointInRect(pos, place4PosterRect(PLACE4_DOORS[i], containT))) return i;
  }
  return -1;
}

// Liseré doux autour du bandeau d'affiches survolé : montre que c'est cliquable.
function drawPlace4PosterHover(containT) {
  if (place4Zoom !== -1) return;
  const i = place4PosterUnder(pointerPos, containT);
  if (i === -1) return;
  const r = place4PosterRect(PLACE4_DOORS[i], containT);
  const m = r.h * 0.12;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 300) * 0.12;
  ctx.strokeStyle = 'rgba(255, 230, 160, 0.9)';
  ctx.lineWidth = Math.max(1.5, r.h * 0.06);
  roundRectPath(r.x - m, r.y - m, r.w + m * 2, r.h + m * 2, r.h * 0.18);
  ctx.stroke();
  ctx.restore();
}

// Affiche en grand par-dessus la scène (clic n'importe où pour refermer).
function drawPlace4Zoom(assets) {
  const img = assets.affiches && assets.affiches[place4Zoom];
  if (!img) return;
  const W = window.innerWidth, H = window.innerHeight;
  const k = Math.min(1, (performance.now() - place4ZoomStart) / PLACE4_ZOOM_IN);
  const ease = k * k * (3 - 2 * k);

  dimBackdrop();

  const h = H * 0.8 * (0.9 + 0.1 * ease);
  const w = h * (img.width / img.height);
  const x = W / 2 - w / 2, y = H * 0.46 - h / 2;
  ctx.save();
  ctx.globalAlpha = ease;
  ctx.imageSmoothingEnabled = true; // photo : on la veut lisse, pas crénelée
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 24;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = ease * (0.7 + 0.3 * Math.sin(performance.now() / 400));
  ctx.fillStyle = '#ffe08a';
  ctx.font = `${Math.round(H * 0.022)}px 'PressStart2P'`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Clique pour refermer', W / 2, y + h + H * 0.02);
  ctx.restore();
}

// ---------- Question : la date du film choisi ----------
function place4Film() {
  return PLACE4_FILMS[place4Choice] || PLACE4_FILMS[0];
}

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
  const f = place4Film();
  return questionTypingDone(place4QuestionStart, f.question) &&
    answersTyping(place4QuestionStart, f.question, f.reponses).every((a) => a.full);
}

function drawPlace4Question(assets) {
  const f = place4Film();
  dimBackdrop();
  const panel = place4PanelRect();
  // Le son clavier est géré ici (pour couvrir aussi l'écriture des réponses).
  const qDone = drawTypingQuestion(assets.quizPanel, panel, f.question, place4QuestionStart, false);
  if (!qDone) {
    setKeyboardTyping(place4QuestionStart != null);
    return;
  }

  // Puis chaque réponse apparaît à son tour, écrite caractère par caractère.
  const typing = answersTyping(place4QuestionStart, f.question, f.reponses);
  const rects = place4AnswerRects();
  rects.forEach((r, i) => {
    if (!typing[i].visible) return;
    let img = assets.menuBouton;
    if (place4Picked === i) img = place4PickedCorrect ? assets.quizGood : assets.quizBad;
    drawTypedAnswerPill(img, f.reponses[i], r, typing[i]);
  });
  setKeyboardTyping(!typing.every((a) => a.full));
}

// Bonne réponse : on entre dans le cinéma. Mauvaise : la pastille rougit un
// instant, puis on peut réessayer.
function updatePlace4Answer() {
  if (place4Picked === -1) return;
  const held = performance.now() - place4PickedStart;
  if (place4PickedCorrect) {
    if (held >= 700) { place4Picked = -1; place4Phase = 'exit'; place4ExitStart = performance.now(); }
  } else if (held >= 600) {
    place4Picked = -1;
  }
}

// ---------- Bouton « Aide » ----------
const PLACE4_HELP_TEXT = 'Va devant la porte de la séance, et clique sur la porte.';
const PLACE4_HELP_PS = 'Ps : Tu peux également cliquer sur les affiches pour voir de quel film il s’agit.';

// Même bouton que celui du puzzle (décor 7), en haut à droite.
function place4HelpButtonRect() {
  const w = Math.min(window.innerWidth * 0.15, 190);
  const h = Math.max(34, window.innerHeight * 0.06);
  return { x: window.innerWidth - w - window.innerWidth * 0.03, y: window.innerHeight * 0.04, w, h };
}

function drawPlace4HelpButton() {
  const r = place4HelpButtonRect();
  const hover = place4Zoom === -1 && isInsideRect(pointerPos, r);
  ctx.save();
  ctx.fillStyle = place4Help ? 'rgba(255,215,106,0.9)' : (hover ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.5)');
  roundRectPath(r.x, r.y, r.w, r.h, r.h * 0.25);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  roundRectPath(r.x, r.y, r.w, r.h, r.h * 0.25);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = place4Help ? '#2a2a2a' : '#ffffff';
  ctx.font = `${Math.round(r.h * 0.32)}px 'PressStart2P'`;
  ctx.fillText('Aide', r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

// Panneau d'aide : la consigne, puis le « Ps » en plus discret.
function drawPlace4HelpPanel() {
  const W = window.innerWidth, H = window.innerHeight;
  const btn = place4HelpButtonRect();
  const boxW = Math.min(W * 0.74, 700);
  const pad = boxW * 0.05;
  const fs = Math.round(H * 0.026);
  const psFs = Math.round(H * 0.021);
  const lines = wrapTextAtFont(PLACE4_HELP_TEXT, boxW - pad * 2, fs);
  const psLines = wrapTextAtFont(PLACE4_HELP_PS, boxW - pad * 2, psFs);
  const lineH = fs * 1.6, psLineH = psFs * 1.7;
  const boxH = pad * 2 + lines.length * lineH + psLines.length * psLineH + fs * 0.6;
  const x = W / 2 - boxW / 2, y = btn.y + btn.h + H * 0.02;

  ctx.save();
  roundRectPath(x, y, boxW, boxH, boxH * 0.1);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 224, 138, 0.9)';
  ctx.lineWidth = 2;
  roundRectPath(x, y, boxW, boxH, boxH * 0.1);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let cy = y + pad + lineH / 2;
  ctx.fillStyle = '#ffe08a';
  ctx.font = `${fs}px 'PressStart2P'`;
  lines.forEach((l) => { ctx.fillText(l, W / 2, cy); cy += lineH; });
  cy += fs * 0.6;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.font = `${psFs}px 'PressStart2P'`;
  psLines.forEach((l) => { ctx.fillText(l, W / 2, cy); cy += psLineH; });
  ctx.restore();
}

// Bandeau d'invite en haut de l'écran.
function drawPlace4Prompt() {
  const w = window.innerWidth, h = window.innerHeight;
  const text = 'Choisis ta séance';
  ctx.save();
  ctx.font = `${Math.round(h * 0.038)}px 'PressStart2P'`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const boxW = ctx.measureText(text).width + h * 0.07;
  const boxH = h * 0.09;
  const cx = w / 2, cy = h * 0.1;
  roundRectPath(cx - boxW / 2, cy - boxH / 2, boxW, boxH, boxH * 0.28);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fill();
  ctx.fillStyle = '#ffe08a';
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

// ---------- Entrées souris ----------
function handlePlace4Down(evt) {
  const pos = getPointerPos(evt);

  // La séance est choisie : on répond à la question sur sa date.
  if (place4Phase === 'question') {
    if (place4Picked !== -1 || !place4AllTyped()) return;
    const f = place4Film();
    const rects = place4AnswerRects();
    for (let i = 0; i < rects.length; i++) {
      if (pointInRect(pos, rects[i])) {
        playClickSound();
        place4Picked = i;
        place4PickedStart = performance.now();
        place4PickedCorrect = i === f.bonne;
        if (place4PickedCorrect) playCorrectSound(); else playWrongSound();
        return;
      }
    }
    return;
  }

  if (place4Phase !== 'choix') return;
  const containT = getPlace4ContainT(place4Assets);

  // Affiche ouverte : n'importe quel clic la referme.
  if (place4Zoom !== -1) {
    playClickSound();
    place4Zoom = -1;
    return;
  }

  // Bouton « Aide » : ouvre / referme la consigne.
  if (isInsideRect(pos, place4HelpButtonRect())) {
    playClickSound();
    place4Help = !place4Help;
    return;
  }

  // Clic sur un bandeau d'affiches : on la regarde en grand.
  const poster = place4PosterUnder(pos, containT);
  if (poster !== -1) {
    playClickSound();
    place4Zoom = poster;
    place4ZoomStart = performance.now();
    return;
  }

  // Clic sur la porte devant laquelle se tient Lauren : séance choisie.
  const reach = place4DoorInReach();
  if (reach === -1) return;
  const s = place4DoorScreen(PLACE4_DOORS[reach], containT);
  const dx = pos.x - s.cx, dy = pos.y - s.cy;
  if (dx * dx + dy * dy <= s.r * s.r) {
    playClickSound();
    place4Choice = PLACE4_DOORS[reach].film;
    place4Help = false;
    place4Phase = 'question';
    place4QuestionStart = performance.now();
  }
}

canvas.addEventListener('pointerdown', (evt) => { if (scene === 'place4') handlePlace4Down(evt); });

// Curseur « main » : sur les affiches, sur la porte à portée, ou partout quand
// une affiche est ouverte (tout clic la referme).
canvas.addEventListener('pointermove', (evt) => {
  if (scene !== 'place4') return;
  if (place4Phase === 'question') {
    const over = place4Picked === -1 && place4AllTyped() &&
      place4AnswerRects().some((r) => pointInRect(getPointerPos(evt), r));
    canvas.style.cursor = over ? 'pointer' : 'default';
    return;
  }
  if (place4Phase !== 'choix') { canvas.style.cursor = 'default'; return; }
  if (place4Zoom !== -1) { canvas.style.cursor = 'pointer'; return; }
  const pos = getPointerPos(evt);
  const containT = getPlace4ContainT(place4Assets);
  let over = isInsideRect(pos, place4HelpButtonRect()) || place4PosterUnder(pos, containT) !== -1;
  if (!over) {
    const reach = place4DoorInReach();
    if (reach !== -1) {
      const s = place4DoorScreen(PLACE4_DOORS[reach], containT);
      const dx = pos.x - s.cx, dy = pos.y - s.cy;
      over = dx * dx + dy * dy <= s.r * s.r;
    }
  }
  canvas.style.cursor = over ? 'pointer' : 'default';
});

// ---------- Scène ----------
function drawPlace4Scene(assets, elapsed, dt) {
  place4Assets = assets;
  const containT = getPlace4ContainT(assets);

  if (assets.place4Fond) drawBackgroundContain(assets.place4Fond, containT);

  // Enseignes qui respirent (+ néon PATHE qui grésille) et reflets au sol.
  drawPlace4Ambience(containT);

  // Les trois portes s'éclairent dès que Lauren est en place.
  if (place4Phase === 'choix') {
    PLACE4_DOORS.forEach((d) => drawPlace4DoorHint(d, containT, elapsed));
    drawPlace4PosterHover(containT);
  }

  updatePlace4Lauren(dt);
  updatePlace4Answer();
  drawCharacter(place4Lauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress, PLACE4_GROUND_Y);

  if (place4Phase === 'question') drawPlace4Question(assets);

  if (place4Phase === 'choix' && place4Zoom === -1) {
    // L'aide prend la place du bandeau d'invite (même zone d'écran).
    if (place4Help) drawPlace4HelpPanel(); else drawPlace4Prompt();
    drawKeyboardMoveHint();
    drawPlace4HelpButton();
  }

  if (place4Zoom !== -1) drawPlace4Zoom(assets);

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
