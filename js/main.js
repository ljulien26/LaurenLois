// ---------- Chargement des assets et démarrage ----------

Promise.all([
  loadImage('Assets/Menu/Fond.png'),
  loadImage('Assets/Menu/Titre.png'),
  loadImage('Assets/Menu/Nuages.png'),
  loadImage('Assets/Jeu/Quiz/Boutons/Réponse.png'),
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
  loadImage('Assets/Persos/Lauren/Côté/Activer le bouton/1.png'),
  loadImage('Assets/Persos/Lauren/Côté/Activer le bouton/2.png'),
  loadImage('Assets/Persos/Loïs/Côté/Idle/Idle.png'),
  loadImage('Assets/Persos/Loïs/Côté/Walk/18.png'),
  loadImage('Assets/Persos/Loïs/Côté/Walk/19.png'),
  loadImage('Assets/Persos/Loïs/Côté/Walk/20.png'),
  loadImage('Assets/Persos/Loïs/Côté/Walk/21.png'),
  loadImage('Assets/Persos/Loïs/Côté/Activer le bouton/1.png'),
  loadImage('Assets/Persos/Loïs/Côté/Activer le bouton/2.png'),
  loadImage('Assets/PreMenu/Télé/1.Statique légère.png'),
  loadImage('Assets/PreMenu/Télé/2.Statique dense.png'),
  loadImage('Assets/PreMenu/Télé/3.Flash faible.png'),
  loadImage('Assets/PreMenu/Télé/4.Flash fort.png'),
  loadImage('Assets/PreMenu/Télé/5.Retour au calme.png'),
  loadImage('Assets/Jeu/Places/1.png'),
  loadImage('Assets/Jeu/Places/2.png'),
  loadImage('Assets/Jeu/Cadenas/1.png'),
  loadImage('Assets/Jeu/Cadenas/2.png'),
  loadImage('Assets/Jeu/Quiz/Boutons/Question.png'),
  loadImage('Assets/Jeu/Quiz/Boutons/Bonne réponse.png'),
  loadImage('Assets/Jeu/Quiz/Boutons/Mauvaise réponse.png'),
])
  .then(([
    menuFond, menuTitre, nuagesImg, menuBouton,
    preMenuFond,
    bleuIdle, bleuPressed, bleuActivated,
    roseIdle, rosePressed, roseActivated,
    laurenIdle,
    laurenWalk6, laurenWalk7, laurenWalk9, laurenWalk10, laurenWalk11,
    laurenPress1, laurenPress2,
    loisIdle,
    loisWalk18, loisWalk19, loisWalk20, loisWalk21,
    loisPress1, loisPress2,
    tvStaticLight, tvStaticDense, tvFlashWeak, tvFlashStrong, tvCalm,
    placeFond, place2Fond, cadenasClosed, cadenasOpen1,
    quizPanel, quizGood, quizBad,
  ]) => {
    createClouds(nuagesImg);

    preMenuButtons.bleu.images = { idle: bleuIdle, pressed: bleuPressed, activated: bleuActivated };
    preMenuButtons.rose.images = { idle: roseIdle, pressed: rosePressed, activated: roseActivated };

    const assets = {
      menuFond, menuTitre, menuBouton, preMenuFond, placeFond, place2Fond,
      cadenasFrames: [cadenasClosed, cadenasOpen1],
      quizPanel, quizGood, quizBad,
      laurenIdle,
      laurenWalk: [laurenWalk6, laurenWalk7, laurenWalk9, laurenWalk10, laurenWalk11],
      laurenPress: [laurenPress1, laurenPress2],
      loisIdle,
      loisWalk: [loisWalk18, loisWalk19, loisWalk20, loisWalk21],
      loisPress: [loisPress1, loisPress2],
      tvFrames: [tvStaticLight, tvStaticDense, tvFlashWeak, tvFlashStrong, tvCalm],
    };
    requestAnimationFrame((ts) => loop(ts, assets));
  })
  .catch((err) => {
    console.error(err);
  });
