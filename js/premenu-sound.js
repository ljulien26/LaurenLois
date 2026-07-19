// ============================================================
// Sons de la scène PreMenu : marche (partagée entre Loïs et Lauren), bouton,
// activation, musique de fond, et déblocage audio navigateur.
// ============================================================

// ---------- Son de marche, partagé (mêmes pas pour les deux personnages) ----------
// Boucle tant que l'un des deux marche, avec un léger fondu (départ/arrêt)
// pour éviter une coupure brutale en plein milieu d'un pas.

const walkSound = new Audio('Assets/Sound/1.Walking.mp3');
walkSound.loop = true;
walkSound.volume = 0;

const WALK_SOUND_FADE_MS = 120;
const WALK_SOUND_MAX_VOLUME = 0.8;

function updateWalkSound(dt, anyWalking) {
  const target = anyWalking ? WALK_SOUND_MAX_VOLUME : 0;

  if (target > 0 && walkSound.paused) {
    walkSound.play().catch(() => {});
  }

  const step = (dt * 1000) / WALK_SOUND_FADE_MS;
  if (walkSound.volume < target) {
    walkSound.volume = Math.min(target, walkSound.volume + step);
  } else if (walkSound.volume > target) {
    walkSound.volume = Math.max(target, walkSound.volume - step);
  }

  if (target === 0 && !walkSound.paused && walkSound.volume === 0) {
    walkSound.pause();
    walkSound.currentTime = 0;
  }
}

// ---------- Son de bouton ----------

const buttonSound = new Audio('Assets/Sound/2.Button.mp3');

function playButtonSound() {
  buttonSound.currentTime = 0;
  buttonSound.play().catch(() => {});
}

// ---------- Son d'activation (joué une fois que les 2 boutons sont activés) ----------

const activationSound = new Audio('Assets/Sound/4.ActivationTV.mp3');

function playActivationSound() {
  activationSound.currentTime = 0;
  activationSound.play().catch(() => {});
}

// ---------- Musique de fond du PreMenu ----------
// Démarre au premier tap (geste utilisateur requis) et joue en boucle tant
// qu'on est dans la scène ; s'éteint en fondu dès que la télé s'allume.

const PREMENU_MUSIC_VOLUME = 0.5;
const PREMENU_MUSIC_FADE_MS = 600;

const preMenuMusic = new Audio('Assets/Sound/3.MusiqueFondPreMenu.wav');
preMenuMusic.loop = true;

function startPreMenuMusic() {
  preMenuMusic.volume = PREMENU_MUSIC_VOLUME;
  preMenuMusic.currentTime = 0;
  preMenuMusic.play().catch(() => {});
}

function fadeOutPreMenuMusic(dt) {
  if (preMenuMusic.paused) return;
  const step = (dt * 1000 / PREMENU_MUSIC_FADE_MS) * PREMENU_MUSIC_VOLUME;
  preMenuMusic.volume = Math.max(0, preMenuMusic.volume - step);
  if (preMenuMusic.volume <= 0) {
    preMenuMusic.pause();
    preMenuMusic.currentTime = 0;
  }
}

// preMenuMusic démarre pendant le tap lui-même : pas besoin de l'amorcer.
registerAudioForUnlock(walkSound);
registerAudioForUnlock(buttonSound);
registerAudioForUnlock(activationSound);
