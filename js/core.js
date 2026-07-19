// ---------- Canvas setup ----------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  // DPR plafonné à 2 : suffisant pour rester net (y compris écrans 3x des
  // iPhone) tout en gardant le canvas raisonnable pour de bonnes perfs.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
// iOS rapporte parfois les anciennes dimensions au changement d'orientation :
// on redimensionne aussi juste après l'événement.
window.addEventListener('orientationchange', () => setTimeout(resize, 150));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resize);
}
// Pas de menu contextuel au clic droit / long-press, ni de pinch-zoom iOS.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
resize();

// ---------- Chargement d'images ----------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Échec du chargement: ' + src));
    img.src = src;
  });
}

// Comme loadImage, mais un fichier absent ne fait pas planter le jeu : la
// promesse se résout à null (la scène concernée dessine alors un fond de
// secours). Utile pour des décors dont l'image n'est pas encore fournie.
function loadImageOptional(src) {
  return loadImage(src).catch(() => null);
}

// ---------- Fond en "cover" (comme background-size: cover) ----------

// Rectangle source à prélever dans une image (imgW x imgH) pour remplir une
// zone cible (viewW x viewH) sans déformation, en recadrant le surplus.
function getCoverRect(imgW, imgH, viewW, viewH) {
  const imgRatio = imgW / imgH;
  const viewRatio = viewW / viewH;
  if (imgRatio > viewRatio) {
    const sh = imgH;
    const sw = sh * viewRatio;
    return { sx: (imgW - sw) / 2, sy: 0, sw, sh };
  }
  const sw = imgW;
  const sh = sw / viewRatio;
  return { sx: 0, sy: (imgH - sh) / 2, sw, sh };
}

function drawBackgroundCover(img) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = getCoverRect(img.width, img.height, w, h);
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
}

// ---------- Fond en "contain" (toute la composition reste visible) ----------

function getContainTransform(imgW, imgH, viewW, viewH) {
  const scale = Math.min(viewW / imgW, viewH / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  return { scale, dx: (viewW - dw) / 2, dy: (viewH - dh) / 2, dw, dh };
}

function drawBackgroundContain(img, t) {
  ctx.drawImage(img, 0, 0, img.width, img.height, t.dx, t.dy, t.dw, t.dh);
}

// Découpe un texte en lignes tenant dans maxWidth, en police PressStart2P, et
// réduit la taille tant qu'il dépasse 3 lignes. Renvoie { lines, fs }.
function wrapPixelQuestion(text, maxWidth, startSize) {
  let fs = startSize;
  const words = text.split(' ');
  const build = () => {
    ctx.font = `${fs}px 'PressStart2P'`;
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  let lines = build();
  while (lines.length > 3 && fs > 6) { fs *= 0.92; lines = build(); }
  return { lines, fs };
}

// Trace un rectangle à coins arrondis dans le chemin courant (à remplir /
// tracer / découper ensuite par l'appelant).
function roundRectPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Échelle de l'interface ----------
// Vaut 1 sur un écran "normal" (>= 1280x720, typiquement un ordinateur) : les
// tailles fixes en pixels y restent identiques. Sur un petit écran (téléphone
// en paysage), le facteur descend en dessous de 1 et réduit proportionnellement
// les éléments d'UI, pour garder la même disposition qu'au bureau (sinon les
// pixels fixes paraissent énormes sur le petit écran).
function uiSizeFactor() {
  return Math.min(1, window.innerWidth / 1280, window.innerHeight / 720);
}

// ---------- Entrées tactiles/souris ----------

function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

// ---------- Clavier (déplacement des personnages sur ordinateur) ----------
// Direction courante : -1 (gauche), 0 (immobile), +1 (droite). Flèches ← → et
// A/Q (gauche) / D (droite), pour couvrir claviers QWERTY et AZERTY.
const heldKeys = new Set();

function keyDirection() {
  const left = heldKeys.has('arrowleft') || heldKeys.has('a') || heldKeys.has('q');
  const right = heldKeys.has('arrowright') || heldKeys.has('d');
  return (right ? 1 : 0) - (left ? 1 : 0);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 'q' || k === 'd') {
    heldKeys.add(k);
    if (k === 'arrowleft' || k === 'arrowright') e.preventDefault(); // pas de défilement
  }
});
window.addEventListener('keyup', (e) => heldKeys.delete(e.key.toLowerCase()));

// --- DEBUG (à retirer pour la version finale) : Maj+3/4/5/6 sautent
// directement à Saint-Sernin / Cinéma façade / Cinéma intérieur / pluie de
// chats, pour tester vite. ---
window.addEventListener('keydown', (e) => {
  if (!e.shiftKey) return;
  if (['Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(e.code)) setKeyboardTyping(false);
  if (e.code === 'Digit3') { place3Reset(); scene = 'place3'; startTime = null; }
  else if (e.code === 'Digit4') { place4Reset(); scene = 'place4'; startTime = null; }
  else if (e.code === 'Digit5') { place5Reset(); scene = 'place5'; startTime = null; }
  else if (e.code === 'Digit6') { catGameReset(); scene = 'catgame'; startTime = null; }
});

// Indice discret rappelant que le déplacement se fait au clavier. Affiché en
// bas de l'écran tant que le joueur contrôle un personnage. S'estompe dès
// qu'une touche de direction est enfoncée (le joueur a compris).
function drawKeyboardMoveHint() {
  const alpha = keyDirection() !== 0 ? 0.15 : 0.5 + Math.sin(performance.now() / 600) * 0.12;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(window.innerHeight * 0.026)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('←  →  pour se déplacer', window.innerWidth / 2, window.innerHeight * 0.96);
  ctx.restore();
}

function isInsideRect(pos, rect) {
  return (
    !!rect &&
    pos.x >= rect.x && pos.x <= rect.x + rect.w &&
    pos.y >= rect.y && pos.y <= rect.y + rect.h
  );
}

// ---------- Déblocage audio ----------
// Les navigateurs bloquent tout son tant qu'aucun geste utilisateur n'a eu
// lieu sur la page. Chaque scène enregistre ici ses sons ; ils sont tous
// "amorcés" (lecture/pause muette) au premier tap, y compris ceux qui ne
// serviront que bien plus tard (ex. la musique du Menu), sans quoi ils
// seraient refusés faute de geste au moment de leur lecture.

const audioToUnlock = [];

function registerAudioForUnlock(audio) {
  audioToUnlock.push(audio);
}

function unlockAudio() {
  audioToUnlock.forEach((audio) => {
    const wasMuted = audio.muted;
    audio.muted = true;
    audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = wasMuted;
      })
      .catch(() => {
        audio.muted = wasMuted;
      });
  });
}

// ---------- Questions "machine à écrire" + son clavier ----------
// Toute question du jeu s'écrit caractère par caractère. Le son clavier (un
// clip continu, partagé) tourne pendant l'écriture via setKeyboardTyping() et
// s'arrête net une fois la question entièrement affichée.
const keyboardSound = new Audio('Assets/Sound/5.Son Clavier.mp3');
keyboardSound.volume = 0.5;
keyboardSound.loop = true; // clip de frappe continu : il tourne pendant l'écriture
registerAudioForUnlock(keyboardSound);

// Sons de validation : bonne réponse / mauvaise réponse (quiz, cadenas, etc.).
const correctSound = new Audio('Assets/Sound/6.Correct.mp3');
correctSound.volume = 0.6;
registerAudioForUnlock(correctSound);
const wrongSound = new Audio('Assets/Sound/7.Faux.mp3');
wrongSound.volume = 0.6;
registerAudioForUnlock(wrongSound);

function playCorrectSound() { correctSound.currentTime = 0; correctSound.play().catch(() => {}); }
function playWrongSound() { wrongSound.currentTime = 0; wrongSound.play().catch(() => {}); }

// Notification (ex. apparition d'un indice). Le fichier peut ne pas encore
// exister : dans ce cas la lecture échoue silencieusement, sans planter.
const notifSound = new Audio('Assets/Sound/8.Notif.mp3');
notifSound.volume = 0.6;
registerAudioForUnlock(notifSound);
function playNotifSound() { notifSound.currentTime = 0; notifSound.play().catch(() => {}); }

// Clic d'interface (ex. bouton « Démarrer l'aventure »).
const clickSound = new Audio('Assets/Sound/9.Click.mp3');
clickSound.volume = 0.6;
registerAudioForUnlock(clickSound);
function playClickSound() { clickSound.currentTime = 0; clickSound.play().catch(() => {}); }

// active=true : l'écriture est en cours, le son tourne ; active=false : on
// l'arrête net (le clip est long, il ne doit surtout pas traîner une fois la
// question entièrement écrite).
function setKeyboardTyping(active) {
  if (active) {
    if (keyboardSound.paused) keyboardSound.play().catch(() => {});
  } else if (!keyboardSound.paused) {
    keyboardSound.pause();
    keyboardSound.currentTime = 0;
  }
}

const QUESTION_CHAR_MS = 42; // ms par caractère

function questionCharsShown(startedAt, text) {
  if (startedAt == null) return 0;
  return Math.min(text.length, Math.floor((performance.now() - startedAt) / QUESTION_CHAR_MS));
}

function questionTypingDone(startedAt, text) {
  return questionCharsShown(startedAt, text) >= text.length;
}

// Taille de police de RÉFÉRENCE : exactement celle de la 1re question (le café).
// Toutes les questions ET les réponses du jeu s'y calent, pour une taille
// identique partout. Reproduit le calcul de place2TextFontPx (même pastille,
// même réduction sur la réponse la plus longue du café).
function firstQuestionFontPx() {
  const w = Math.min(window.innerWidth * 0.4, 270) * uiSizeFactor();
  const pillH = w / (1349 / 255);
  let fs = pillH * 0.34;
  const answers = (typeof PLACE2_ANSWERS !== 'undefined') ? PLACE2_ANSWERS : ['La Taverne du troll'];
  const longest = answers.reduce((a, b) => (a.length >= b.length ? a : b));
  ctx.font = `${fs}px 'PressStart2P'`;
  const maxW = w * 0.84;
  const tw = ctx.measureText(longest).width;
  if (tw > maxW) fs *= maxW / tw;
  return fs;
}

// Dessine une pastille (image) + son texte centré, à la taille de police de
// référence (identique aux réponses du café).
function drawAnswerPill(img, text, r) {
  ctx.drawImage(img, 0, 0, img.width, img.height, r.x, r.y, r.w, r.h);
  const fs = firstQuestionFontPx();
  ctx.font = `${fs}px 'PressStart2P'`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#201306';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + fs * 0.05);
}

const QUESTION_ANSWER_GAP = 220; // ms de pause entre l'apparition de deux réponses

// État "machine à écrire" de réponses qui apparaissent une à une APRÈS la
// question (qStart = début de l'écriture de la question). Renvoie pour chaque
// réponse { visible, shown, full }.
function answersTyping(qStart, questionText, answers) {
  const qEnd = qStart != null
    ? qStart + questionText.length * QUESTION_CHAR_MS + QUESTION_ANSWER_GAP
    : Infinity;
  const t = performance.now() - qEnd;
  let cursor = 0;
  return answers.map((a) => {
    const start = cursor;
    const len = a.length;
    const visible = t >= start;
    let shown = 0;
    if (visible) shown = Math.min(Math.floor((t - start) / QUESTION_CHAR_MS), len);
    cursor = start + len * QUESTION_CHAR_MS + QUESTION_ANSWER_GAP;
    return { visible, shown, full: shown >= len };
  });
}

// Comme drawAnswerPill, mais le texte s'écrit progressivement (typingState).
function drawTypedAnswerPill(img, fullText, r, typingState) {
  ctx.drawImage(img, 0, 0, img.width, img.height, r.x, r.y, r.w, r.h);
  const fs = firstQuestionFontPx();
  ctx.font = `${fs}px 'PressStart2P'`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#201306';
  let text = fullText.slice(0, typingState.shown);
  if (!typingState.full && Math.floor(performance.now() / 400) % 2 === 0) text += '_';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + fs * 0.05);
}

// Découpe un texte en lignes tenant dans maxWidth, à une taille de police
// donnée (sans la modifier).
function wrapTextAtFont(text, maxWidth, fs) {
  ctx.font = `${fs}px 'PressStart2P'`;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Dessine un panneau de question (image) + son texte qui s'écrit peu à peu
// (avec le son clavier), à une taille de police FIXE identique pour toutes les
// questions. Réduit seulement si le texte déborde en hauteur. Renvoie true une
// fois tout le texte affiché.
// manageSound=false : la scène gère elle-même le son clavier (utile quand
// d'autres éléments s'écrivent après la question, ex. les tickets à gratter),
// pour éviter deux appels contradictoires par frame.
function drawTypingQuestion(panelImg, panel, text, startedAt, manageSound = true) {
  ctx.drawImage(panelImg, 0, 0, panelImg.width, panelImg.height, panel.x, panel.y, panel.w, panel.h);

  let fs = firstQuestionFontPx();
  let lines = wrapTextAtFont(text, panel.w * 0.8, fs);
  const maxLines = Math.max(2, Math.floor((panel.h * 0.74) / (fs * 1.5)));
  while (lines.length > maxLines && fs > 6) {
    fs *= 0.9;
    lines = wrapTextAtFont(text, panel.w * 0.8, fs);
  }

  const shown = questionCharsShown(startedAt, text);
  const done = shown >= text.length;
  if (manageSound) setKeyboardTyping(startedAt != null && !done);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a1a0a';
  ctx.font = `${fs}px 'PressStart2P'`;
  const lineH = fs * 1.6;
  const blinkOn = Math.floor(performance.now() / 400) % 2 === 0;
  let remaining = shown;
  lines.forEach((line, i) => {
    let str;
    let caret = '';
    if (remaining >= line.length) {
      str = line;
    } else {
      str = line.slice(0, Math.max(0, remaining));
      if (!done && blinkOn && remaining >= 0) caret = '_';
    }
    remaining -= line.length + 1; // +1 pour l'espace consommé à la coupure
    const cy = panel.y + panel.h / 2 + (i - (lines.length - 1) / 2) * lineH;
    ctx.fillText(str + caret, panel.x + panel.w / 2, cy);
  });
  return done;
}

// ---------- Boucle de jeu ----------
// Scènes : premenu -> tvOn -> blackout -> menu -> place -> place2 (café)
//   -> place3 (Saint-Sernin) -> place4 (Cinéma façade) -> place5 (Cinéma
//   intérieur) -> catgame (pluie de chats)
// Chaque scène est dessinée par une fonction définie dans son propre fichier
// (premenu.js, menu.js, place.js, ...).

// TEST (temporaire) : on démarre directement au menu. Le pré-menu reste dans
// le jeu ; remettre 'premenu' ici pour reprendre depuis le début.
let scene = 'menu';
let startTime = null; // début de la scène courante (remis à zéro à chaque changement de scène)
let lastTimestamp = 0;

function loop(timestamp, assets) {
  if (startTime === null) startTime = timestamp;
  const elapsed = timestamp - startTime;
  const dt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
  lastTimestamp = timestamp;

  // Fond noir (pas juste un clear) : les bordures autour des images en
  // "contain" (qui ne remplissent pas toujours tout l'écran) restent noires
  // quel que soit le fond CSS de la page.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  if (scene === 'premenu') {
    drawPreMenuScene(assets, dt);
  } else if (scene === 'tvOn') {
    drawTvOnScene(assets, elapsed, dt);
  } else if (scene === 'blackout') {
    drawBlackoutScene(assets, elapsed, dt);
  } else if (scene === 'menu') {
    drawMenuScene(assets, elapsed, dt);
  } else if (scene === 'place') {
    drawPlaceScene(assets, elapsed, dt);
  } else if (scene === 'place2') {
    drawPlace2Scene(assets, elapsed, dt);
  } else if (scene === 'place3') {
    drawPlace3Scene(assets, elapsed, dt);
  } else if (scene === 'place4') {
    drawPlace4Scene(assets, elapsed, dt);
  } else if (scene === 'place5') {
    drawPlace5Scene(assets, elapsed, dt);
  } else if (scene === 'catgame') {
    drawCatGameScene(assets, elapsed, dt);
  }

  requestAnimationFrame((ts) => loop(ts, assets));
}
