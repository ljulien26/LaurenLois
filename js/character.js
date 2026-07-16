// ============================================================
// Système générique de personnage (vue de côté) : marche, idle, animation
// d'appui sur bouton. Réutilisé par Loïs et Lauren dans premenu.js.
// ============================================================

const CHARACTER_ASPECT = 96 / 128; // dimensions natives (canevas complet) des sprites Côté
const CHARACTER_ANCHOR_Y = 493;    // aligné sur le niveau des boutons (plus de sol dessiné)
const CHARACTER_HEIGHT = 190;
const CHARACTER_WALK_FRAME_DURATION = 90;   // ms par frame (~11 img/s), pour une marche fluide
const CHARACTER_WALK_SPEED = 112;           // unités Fond.png (960x540) par seconde
const CHARACTER_PRESS_FRAME_DURATION = 150; // ms par frame (2 frames ≈ PRESS_DURATION)

// Un personnage n'occupe qu'une partie étroite de son canevas 96x128 (marge
// transparente tout autour) : visibleWidthRatio sert à calculer sa vraie
// demi-largeur pour le positionner au bord d'un bouton, pas au bord du canevas.
// pressFrameCount reste à 0 pour les personnages sans animation d'appui sur bouton.
function createCharacter(startX, nativeFacing, visibleWidthRatio, walkFrameCount, scale = 1, pressFrameCount = 0) {
  return {
    x: startX,
    facing: nativeFacing,
    nativeFacing,
    visibleWidthRatio,
    walkFrameCount,
    pressFrameCount,
    scale,
    targetX: null,
    walking: false,
    pressing: false,
    frameIndex: 0,
    frameElapsed: 0,
    pressFrameIndex: 0,
    pressFrameElapsed: 0,
  };
}

function startPressing(c) {
  c.pressing = true;
  c.pressFrameIndex = 0;
  c.pressFrameElapsed = 0;
}

function stopPressing(c) {
  c.pressing = false;
}

function updatePressAnimation(c, dt) {
  if (!c.pressing || c.pressFrameCount === 0) return;
  c.pressFrameElapsed += dt * 1000;
  while (c.pressFrameElapsed >= CHARACTER_PRESS_FRAME_DURATION) {
    c.pressFrameElapsed -= CHARACTER_PRESS_FRAME_DURATION;
    c.pressFrameIndex = Math.min(c.pressFrameIndex + 1, c.pressFrameCount - 1);
  }
}

function characterHalfWidth(c) {
  return CHARACTER_HEIGHT * c.scale * CHARACTER_ASPECT * c.visibleWidthRatio * 0.5;
}

function characterWalkTo(c, targetX) {
  c.targetX = targetX;
}

function updateCharacter(c, dt) {
  if (c.targetX === null) {
    c.walking = false;
    c.frameIndex = 0;
    c.frameElapsed = 0;
    return;
  }

  const remaining = c.targetX - c.x;
  const step = CHARACTER_WALK_SPEED * dt;

  if (Math.abs(remaining) <= step) {
    c.x = c.targetX;
    c.targetX = null;
    c.walking = false;
    c.frameIndex = 0;
    c.frameElapsed = 0;
    return;
  }

  c.facing = remaining < 0 ? 'left' : 'right';
  c.x += Math.sign(remaining) * step;
  c.walking = true;

  c.frameElapsed += dt * 1000;
  while (c.frameElapsed >= CHARACTER_WALK_FRAME_DURATION) {
    c.frameElapsed -= CHARACTER_WALK_FRAME_DURATION;
    c.frameIndex = (c.frameIndex + 1) % c.walkFrameCount;
  }
}

function drawCharacter(c, idleImg, walkFrames, containT, pressFrames) {
  const h = CHARACTER_HEIGHT * c.scale * containT.scale;
  const w = h * CHARACTER_ASPECT;
  const screenX = containT.dx + c.x * containT.scale;
  const screenY = containT.dy + CHARACTER_ANCHOR_Y * containT.scale;
  const x = screenX - w / 2;
  const y = screenY - h;

  let img;
  if (c.pressing && pressFrames) {
    img = pressFrames[c.pressFrameIndex];
  } else if (c.walking) {
    img = walkFrames[c.frameIndex];
  } else {
    img = idleImg;
  }

  ctx.save();
  if (c.facing !== c.nativeFacing) {
    // retourne le sprite quand il marche dans le sens opposé à son orientation native
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}
