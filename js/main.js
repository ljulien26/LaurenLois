// ---------- Chargement des assets et démarrage ----------

Promise.all([
  loadImage('Assets/Menu/Fond.png'),
  loadImage('Assets/Menu/Titre.png'),
  loadImage('Assets/Menu/Nuages.png'),
  loadImage('Assets/Menu/Bouton.png'),
  loadImage('Assets/PreMenu/Fond.png'),
  loadImage('Assets/PreMenu/BoutonBleu/Bleu.png'),
  loadImage('Assets/PreMenu/BoutonBleu/BleuEnfoncé.png'),
  loadImage('Assets/PreMenu/BoutonBleu/BleuActivé.png'),
  loadImage('Assets/PreMenu/BoutonRose/Rose.png'),
  loadImage('Assets/PreMenu/BoutonRose/RoseEnfoncé.png'),
  loadImage('Assets/PreMenu/BoutonRose/RoseActivé.png'),
  loadImage('Assets/Persos/Lauren/Côté/Idle/Idle.png'),
  loadImage('Assets/Persos/Lauren/Côté/Walk/6.png'),
  loadImage('Assets/Persos/Lauren/Côté/Walk/7.png'),
  loadImage('Assets/Persos/Lauren/Côté/Walk/9.png'),
  loadImage('Assets/Persos/Lauren/Côté/Walk/10.png'),
  loadImage('Assets/Persos/Lauren/Côté/Walk/11.png'),
  loadImage('Assets/Persos/Loïs/Côté/Idle/Idle.png'),
  loadImage('Assets/Persos/Loïs/Côté/Walk/18.png'),
  loadImage('Assets/Persos/Loïs/Côté/Walk/19.png'),
  loadImage('Assets/Persos/Loïs/Côté/Walk/20.png'),
  loadImage('Assets/Persos/Loïs/Côté/Walk/21.png'),
])
  .then(([
    menuFond, menuTitre, nuagesImg, menuBouton,
    preMenuFond,
    bleuIdle, bleuPressed, bleuActivated,
    roseIdle, rosePressed, roseActivated,
    laurenIdle,
    laurenWalk6, laurenWalk7, laurenWalk9, laurenWalk10, laurenWalk11,
    loisIdle,
    loisWalk18, loisWalk19, loisWalk20, loisWalk21,
  ]) => {
    createClouds(nuagesImg);

    preMenuButtons.bleu.images = { idle: bleuIdle, pressed: bleuPressed, activated: bleuActivated };
    preMenuButtons.rose.images = { idle: roseIdle, pressed: rosePressed, activated: roseActivated };

    const assets = {
      menuFond, menuTitre, menuBouton, preMenuFond,
      laurenIdle,
      laurenWalk: [laurenWalk6, laurenWalk7, laurenWalk9, laurenWalk10, laurenWalk11],
      loisIdle,
      loisWalk: [loisWalk18, loisWalk19, loisWalk20, loisWalk21],
    };
    requestAnimationFrame((ts) => loop(ts, assets));
  })
  .catch((err) => {
    console.error(err);
  });
