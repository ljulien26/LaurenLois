// ---------- Canvas setup ----------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
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

// ---------- Entrées tactiles/souris ----------

function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function isInsideRect(pos, rect) {
  return (
    !!rect &&
    pos.x >= rect.x && pos.x <= rect.x + rect.w &&
    pos.y >= rect.y && pos.y <= rect.y + rect.h
  );
}

// ---------- Boucle de jeu ----------
// Scènes : 'premenu' -> 'tvOn' -> 'blackout' -> 'menu' -> (jeu, à venir)
// Chaque scène est dessinée par une fonction définie dans son propre fichier
// (premenu.js, menu.js, ...).

let scene = 'premenu';
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
  }

  requestAnimationFrame((ts) => loop(ts, assets));
}
