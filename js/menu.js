// ============================================================
// Scène Menu : fond, nuages animés, titre, bouton "Démarrer l'aventure".
// ============================================================

// ---------- Nuages animés (découpés dans Nuages.png, vrais nuages transparents) ----------

// Nuages individuels détectés dans Nuages.png (960x540, fond transparent),
// chacun avec une petite marge autour de sa boîte englobante réelle.
const CLOUD_SOURCE_RECTS = [
  { x: 113, y: 3, w: 407, h: 105 },
  { x: 531, y: 125, w: 321, h: 110 },
  { x: 100, y: 150, w: 259, h: 101 },
  { x: 626, y: 275, w: 229, h: 99 },
  { x: 301, y: 476, w: 179, h: 50 },
  { x: 604, y: 70, w: 120, h: 47 },
  { x: 231, y: 126, w: 114, h: 40 },
  { x: 537, y: 400, w: 299, h: 97 },
  { x: 111, y: 283, w: 284, h: 97 },
  { x: 118, y: 459, w: 141, h: 53 },
  { x: 351, y: 261, w: 167, h: 43 },
];

function createCloudSprite(nuagesImg, rect) {
  const off = document.createElement('canvas');
  off.width = rect.w;
  off.height = rect.h;
  const octx = off.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(nuagesImg, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return off;
}

// Bande du ciel (fraction de la hauteur d'écran) où les nuages peuvent apparaître :
// large, pour que le ciel soit rempli "un peu partout", pas juste en haut.
const SKY_BAND_TOP = 0.0;
const SKY_BAND_BOTTOM = 0.27;
const CLOUD_COUNT = 26;
const CLOUD_SCALE_MIN = 0.28;
const CLOUD_SCALE_MAX = 0.55;
const CLOUD_MIN_GAP = 12; // marge mini entre deux nuages, en px

class CloudLayer {
  constructor(sprites, allClouds) {
    this.sprites = sprites;
    this.allClouds = allClouds; // référence partagée, pour éviter les chevauchements
    this.spawn(true);
  }

  // Tire une position/apparence aléatoire ; réessaie quelques fois si ça
  // chevauche un nuage déjà en place, pour rester bien réparti dans le ciel.
  spawn(initial) {
    let candidate;
    for (let i = 0; i < 15; i++) {
      candidate = this.randomCandidate(initial);
      if (!this.overlapsAny(candidate)) break;
    }
    Object.assign(this, candidate);
  }

  randomCandidate(initial) {
    const sprite = this.sprites[Math.floor(Math.random() * this.sprites.length)];
    const depth = Math.random(); // 0 = lointain/petit/lent, 1 = proche/grand/rapide
    const scale = CLOUD_SCALE_MIN + depth * (CLOUD_SCALE_MAX - CLOUD_SCALE_MIN);
    const w = sprite.width * scale;
    const h = sprite.height * scale;
    const y = (SKY_BAND_TOP + Math.random() * (SKY_BAND_BOTTOM - SKY_BAND_TOP)) * window.innerHeight;
    const x = initial
      ? Math.random() * (window.innerWidth + w) - w
      : window.innerWidth + Math.random() * w;
    return {
      sprite, w, h, x, y,
      speed: 3 + depth * 10,
      opacity: 0.35 + depth * 0.55,
    };
  }

  overlapsAny(c) {
    return this.allClouds.some((o) => {
      if (o === this || o.w === undefined) return false;
      return !(
        c.x + c.w + CLOUD_MIN_GAP < o.x ||
        o.x + o.w + CLOUD_MIN_GAP < c.x ||
        c.y + c.h + CLOUD_MIN_GAP < o.y ||
        o.y + o.h + CLOUD_MIN_GAP < c.y
      );
    });
  }

  update(dt) {
    this.x -= this.speed * dt;
    if (this.x < -this.w) {
      this.spawn(false);
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.drawImage(this.sprite, this.x, this.y, this.w, this.h);
    ctx.restore();
  }
}

let clouds = [];

function createClouds(nuagesImg) {
  const sprites = CLOUD_SOURCE_RECTS.map((rect) => createCloudSprite(nuagesImg, rect));
  clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    clouds.push(new CloudLayer(sprites, clouds));
  }
}

// ---------- Titre : zoom élastique avec léger squash/stretch, puis fixe ----------

const TITLE_DELAY = 300;          // ms avant le début de l'animation
const TITLE_ZOOM_DURATION = 2200; // ms pour passer de minuscule à sa taille finale : lent, en douceur

// Rebond élastique qui se stabilise pile à t=1 (plusieurs oscillations amorties),
// dont on amortit l'amplitude pour une entrée plus douce, moins brusque.
function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  if (t === 0 || t === 1) return t;
  const raw = Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  return 1 + (raw - 1) * 0.45;
}

// Utilisé par le bouton "Démarrer l'aventure" plus bas.
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function drawTitle(img, elapsed) {
  const targetW = window.innerWidth * 0.595;
  const targetH = img.height * (targetW / img.width);
  const centerX = window.innerWidth / 2;
  const baseY = window.innerHeight * 0.04 + targetH / 2;

  if (elapsed < TITLE_DELAY) return; // rien à dessiner avant le délai

  const t = Math.min((elapsed - TITLE_DELAY) / TITLE_ZOOM_DURATION, 1);
  const scale = easeOutElastic(t); // part de 0 (minuscule) jusqu'à 1 avec un rebond élastique
  const opacity = Math.min(t / 0.15, 1); // visible dès les tout premiers instants du zoom

  // Léger étirement/compression pendant les phases de rebond, façon
  // "squash & stretch" : renforce l'impact sans avoir besoin d'un flash.
  const stretch = (scale - 1) * 0.18;
  const scaleX = scale + stretch;
  const scaleY = scale - stretch;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(centerX, baseY);
  ctx.scale(scaleX, scaleY);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
  ctx.restore();
}

// ---------- Bouton "Démarrer l'aventure" (Assets/Jeu/Quiz/Boutons/Réponse.png) ----------

// Bouton vierge (pilule, sans texte), aspect natif ≈ 1349x255.
const BUTTON_TEXT = "Démarrer l'aventure";
const BUTTON_ASPECT = 255 / 1349;

const BUTTON_DELAY = TITLE_DELAY + TITLE_ZOOM_DURATION + 350; // laisse le titre bien se poser avant d'apparaître
const BUTTON_ENTER_DURATION = 700;

let buttonRect = null; // { x, y, w, h } en CSS px, recalculé chaque frame pour le hit-test
let buttonPressed = false;
let buttonHover = false;

// Ajuste la taille de police pour que BUTTON_TEXT tienne dans la largeur du
// bouton (la police pixel Press Start 2P est large par caractère).
function fitButtonFontSize(text, maxWidth, startSize) {
  let fontSize = startSize;
  ctx.font = `${fontSize}px 'PressStart2P'`;
  const textWidth = ctx.measureText(text).width;
  if (textWidth > maxWidth) {
    fontSize *= maxWidth / textWidth;
    ctx.font = `${fontSize}px 'PressStart2P'`;
  }
  return fontSize;
}

function drawStartButton(img, elapsed) {
  const t = Math.min(Math.max((elapsed - BUTTON_DELAY) / BUTTON_ENTER_DURATION, 0), 1);
  if (t <= 0) {
    buttonRect = null;
    return;
  }

  const w = Math.min(window.innerWidth * 0.58, 340);
  const h = w * BUTTON_ASPECT;
  const x = window.innerWidth / 2 - w / 2;
  const y = window.innerHeight * 0.76 - h / 2;
  buttonRect = { x, y, w, h };

  const eased = easeOutBack(t);
  const opacity = Math.min(t / 0.6, 1);
  const pulse = 1 + Math.sin(elapsed / 600) * 0.02; // légère respiration, invite au tap
  const scale = (0.7 + eased * 0.3) * pulse * (buttonPressed ? 0.94 : 1);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
  ctx.shadowColor = 'transparent';

  const fontSize = fitButtonFontSize(BUTTON_TEXT, w * 0.82, h * 0.32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(BUTTON_TEXT, w / 2, h / 2 + fontSize * 0.08);

  if (buttonPressed) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}

function drawMenuScene(assets, elapsed, dt) {
  drawBackgroundCover(assets.menuFond);
  clouds.forEach((cloud) => {
    cloud.update(dt);
    cloud.draw();
  });
  drawTitle(assets.menuTitre, elapsed);
  drawStartButton(assets.menuBouton, elapsed);
}

function isInsideButton(pos) {
  return isInsideRect(pos, buttonRect);
}

canvas.addEventListener('pointerdown', (evt) => {
  if (scene === 'menu' && isInsideButton(getPointerPos(evt))) {
    buttonPressed = true;
  }
});

canvas.addEventListener('pointerup', (evt) => {
  if (scene !== 'menu') return;
  if (buttonPressed && isInsideButton(getPointerPos(evt))) {
    // TODO : lancer la séquence d'ouverture (Loïs / Lauren) une fois les assets prêts
    console.log("Démarrer l'aventure");
  }
  buttonPressed = false;
});

canvas.addEventListener('pointercancel', () => {
  buttonPressed = false;
});

canvas.addEventListener('pointermove', (evt) => {
  if (scene !== 'menu') return;
  buttonHover = isInsideButton(getPointerPos(evt));
  canvas.style.cursor = buttonHover ? 'pointer' : 'default';
});
