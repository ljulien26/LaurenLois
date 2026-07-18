// ============================================================
// Boutons bleu/rose de la scène PreMenu : configuration et rendu.
// ============================================================

// Boîte commune (englobe idle + enfoncé + activé, glow compris) par couleur,
// utilisée pour les 3 états afin que le bouton ne saute jamais en changeant d'état.
const BUTTON_BLEU_SRC = { x: 249, y: 75, w: 451, h: 377 };
const BUTTON_ROSE_SRC = { x: 254, y: 76, w: 449, h: 388 };

// Points d'ancrage (centre du bouton) en coordonnées de Fond.png (960x540) :
// repérés par détection de couleur sur les boutons déjà dessinés dans le fond.
const preMenuButtons = {
  bleu: { state: 'idle', anchorX: 424, anchorY: 475, src: BUTTON_BLEU_SRC, images: null },
  rose: { state: 'idle', anchorX: 533.5, anchorY: 471.5, src: BUTTON_ROSE_SRC, images: null },
};

// Largeur visée (boîte source complète) en unités Fond.png : calée pour que le
// bouton "idle" du sprite recouvre pile le bouton déjà dessiné dans le fond.
const BUTTON_DISPLAY_W_FOND = 60;

// Rayon (relatif à destW) du disque visible du bouton : sert à masquer
// l'ancien bouton dessiné dans le fond avant de poser le sprite par-dessus.
const BUTTON_MASK_RADIUS_RATIO = 0.45;

// Rayon (relatif à destW) de la zone cliquable : un peu plus large que le
// disque visible, pour rester confortable au doigt sur téléphone.
const BUTTON_HIT_RADIUS_RATIO = 0.6;

// Cercle du bouton en coordonnées écran, pour le hit-test au clic/tap.
function getPreMenuButtonCircle(btn, containT) {
  const destW = BUTTON_DISPLAY_W_FOND * containT.scale;
  return {
    cx: containT.dx + btn.anchorX * containT.scale,
    cy: containT.dy + btn.anchorY * containT.scale,
    radius: destW * BUTTON_HIT_RADIUS_RATIO,
  };
}

function drawPreMenuButton(btn, containT) {
  const destW = BUTTON_DISPLAY_W_FOND * containT.scale;
  const destH = destW * (btn.src.h / btn.src.w);
  const screenX = containT.dx + btn.anchorX * containT.scale;
  const screenY = containT.dy + btn.anchorY * containT.scale;
  const x = screenX - destW / 2;
  const y = screenY - destH / 2;

  // Masque l'ancien bouton dessiné dans le fond avant de poser le sprite
  // (silhouette légèrement plus large que le bouton, par sécurité).
  ctx.save();
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.arc(screenX, screenY, destW * BUTTON_MASK_RADIUS_RATIO, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const img = btn.images[btn.state];
  ctx.drawImage(img, btn.src.x, btn.src.y, btn.src.w, btn.src.h, x, y, destW, destH);
}

function drawBothPreMenuButtons(containT) {
  drawPreMenuButton(preMenuButtons.bleu, containT);
  drawPreMenuButton(preMenuButtons.rose, containT);
}
