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

// Phases : 'enter' (arrivée) -> 'choix' (halos + affiches) -> 'exit'.
let place4Phase = 'enter';
let place4Entered = false;
let place4Assets = null;
let place4ExitStart = 0;
// Affiche affichée en grand (index de séance), -1 si aucune.
let place4Zoom = -1;
let place4ZoomStart = 0;
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
  place4Choice = -1;
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

// Halo doré sur une porte. Plus vif sur la porte à portée de Lauren, qui est la
// seule où l'on peut entrer : le halo dit à la fois « il y a trois séances » et
// « c'est celle-ci que tu peux choisir ».
function drawPlace4DoorHint(door, containT, elapsed, active) {
  const s = place4DoorScreen(door, containT);
  const pulse = (active ? 0.34 : 0.16) + Math.sin(elapsed / 360) * (active ? 0.14 : 0.07);
  ctx.save();
  ctx.globalAlpha = Math.max(0, pulse);
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.r * 1.4);
  glow.addColorStop(0, 'rgba(255, 226, 150, 0.85)');
  glow.addColorStop(1, 'rgba(255, 226, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(s.cx - s.r * 1.4, s.cy - s.r * 1.4, s.r * 2.8, s.r * 2.8);
  ctx.restore();

  if (!active) return;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#fff4d6';
  ctx.font = `${Math.round(window.innerHeight * 0.026)}px 'PressStart2P'`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Entrer', s.cx, s.cy - s.r);
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
  if (place4Phase !== 'choix') return;
  const pos = getPointerPos(evt);
  const containT = getPlace4ContainT(place4Assets);

  // Affiche ouverte : n'importe quel clic la referme.
  if (place4Zoom !== -1) {
    playClickSound();
    place4Zoom = -1;
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
    place4Phase = 'exit';
    place4ExitStart = performance.now();
  }
}

canvas.addEventListener('pointerdown', (evt) => { if (scene === 'place4') handlePlace4Down(evt); });

// Curseur « main » : sur les affiches, sur la porte à portée, ou partout quand
// une affiche est ouverte (tout clic la referme).
canvas.addEventListener('pointermove', (evt) => {
  if (scene !== 'place4') return;
  if (place4Phase !== 'choix') { canvas.style.cursor = 'default'; return; }
  if (place4Zoom !== -1) { canvas.style.cursor = 'pointer'; return; }
  const pos = getPointerPos(evt);
  const containT = getPlace4ContainT(place4Assets);
  let over = place4PosterUnder(pos, containT) !== -1;
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

  // Les trois portes s'éclairent dès que Lauren est en place.
  if (place4Phase === 'choix') {
    const reach = place4DoorInReach();
    PLACE4_DOORS.forEach((d, i) => drawPlace4DoorHint(d, containT, elapsed, i === reach && place4Zoom === -1));
    drawPlace4PosterHover(containT);
  }

  updatePlace4Lauren(dt);
  drawCharacter(place4Lauren, assets.laurenIdle, assets.laurenWalk, containT, assets.laurenPress, PLACE4_GROUND_Y);

  if (place4Phase === 'choix' && place4Zoom === -1) {
    drawPlace4Prompt();
    drawKeyboardMoveHint();
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
