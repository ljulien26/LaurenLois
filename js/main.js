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
  loadImage('Assets/Jeu/Places/3.png'), // Saint-Sernin
  loadImage('Assets/Jeu/Places/4.png'), // Cinéma Pathé (façade)
  loadImage('Assets/Jeu/Places/5.png'), // Cinéma Pathé (intérieur)
  loadImage('Assets/Jeu/Places/6.png'), // Grande Roue au bord de l'eau (mini-jeu chatons)
  loadImage('Assets/Jeu/Cadenas/1.png'),
  loadImage('Assets/Jeu/Cadenas/2.png'),
  loadImage('Assets/Jeu/Quiz/Boutons/Question.png'),
  loadImage('Assets/Jeu/Quiz/Boutons/Bonne réponse.png'),
  loadImage('Assets/Jeu/Quiz/Boutons/Mauvaise réponse.png'),
  loadImage('Assets/Jeu/Ticket/1.png'), // ticket qui tombe (Saint-Sernin)
  // Affiches des 3 séances du cinéma (gauche, centre, droite), vues en grand.
  loadImage('Assets/Jeu/AffichesCinema/HeureuxGagnants.png'),
  loadImage('Assets/Jeu/AffichesCinema/F1.png'),
  loadImage('Assets/Jeu/AffichesCinema/Materialist.png'),
  // Mini-jeu de la pluie de chats : Lauren avec panier + chatons.
  loadImage('Assets/Persos/Lauren/Côté/WalkPanier/26.png'),
  loadImage('Assets/Persos/Lauren/Côté/WalkPanier/27.png'),
  loadImage('Assets/Persos/Lauren/Côté/WalkPanier/28.png'),
  loadImage('Assets/Persos/Lauren/Côté/WalkPanier/29.png'),
  loadImage('Assets/Jeu/Chat/Chat 1.png'),
  loadImage('Assets/Jeu/Chat/Chat 2.png'),
  loadImage('Assets/Jeu/Chat/Chat 3.png'),
  loadImage('Assets/Jeu/Panier/Panier.png'), // panier au sol (objet cliquable)
  loadImage('Assets/Jeu/Popcorn/1.png'),     // boîte de popcorn au sol (décor 5)
  loadImage('Assets/Jeu/Places/8/1.png'), // décor final : jour
  loadImage('Assets/Jeu/Places/8/2.png'), // décor final : coucher de soleil
  loadImage('Assets/Jeu/Places/8/3.png'), // décor final : nuit
  loadImage('Assets/Jeu/Places/7.png'),   // décor 7 : Cartoucherie
  loadImage('Assets/Jeu/Puzzle/1.png'),   // photo du puzzle
  // Écran final : les deux bras tendus, puis le sprite « couple » de l'étreinte.
  loadImage('Assets/Persos/Lauren/Côté/Calin.png'),
  loadImage('Assets/Persos/Loïs/Côté/Calin.png'),
  loadImage('Assets/Persos/CLL1.png'),
  loadImage('Assets/Persos/CLL2.png'),
  loadImage('Assets/Persos/CLL3.png'),
  loadImage('Assets/Persos/CLL4.png'),
  // ...puis ils se retournent, main dans la main, pour regarder le feu.
  loadImage('Assets/Persos/TLL1.png'),
  loadImage('Assets/Persos/TLL2.png'),
  loadImage('Assets/Persos/TLL3.png'),
  loadImage('Assets/Persos/TLL4.png'),
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
    placeFond, place2Fond, place3Fond, place4Fond, place5Fond, place6Fond, cadenasClosed, cadenasOpen1,
    quizPanel, quizGood, quizBad, ticketImg,
    afficheHeureux, afficheF1, afficheMaterialist,
    basket26, basket27, basket28, basket29,
    cat1, cat2, cat3, panierImg, popcornImg,
    place8Day, place8Sunset, place8Night,
    place7Fond, puzzleImg,
    laurenCalin, loisCalin, cll1, cll2, cll3, cll4, tll1, tll2, tll3, tll4,
  ]) => {
    createClouds(nuagesImg);

    preMenuButtons.bleu.images = { idle: bleuIdle, pressed: bleuPressed, activated: bleuActivated };
    preMenuButtons.rose.images = { idle: roseIdle, pressed: rosePressed, activated: roseActivated };

    const assets = {
      menuFond, menuTitre, menuBouton, preMenuFond, placeFond, place2Fond,
      place3Fond, place4Fond, place5Fond, place6Fond,
      ticketImg,
      // Affiches du cinéma, dans l'ordre des portes : gauche, centre, droite.
      affiches: [afficheHeureux, afficheF1, afficheMaterialist],
      laurenBasket: [basket26, basket27, basket28, basket29],
      cats: [cat1, cat2, cat3],
      panier: panierImg,
      popcorn: popcornImg,
      place8: [place8Day, place8Sunset, place8Night], // jour -> coucher -> nuit
      place7Fond, puzzle: puzzleImg,
      cadenasFrames: [cadenasClosed, cadenasOpen1],
      quizPanel, quizGood, quizBad,
      laurenIdle, laurenCalin, loisCalin,
      cll: [cll1, cll2, cll3, cll4], // étreinte de l'écran final
      tll: [tll1, tll2, tll3, tll4], // ...puis ils regardent le feu, de dos
      laurenWalk: [laurenWalk6, laurenWalk7, laurenWalk9, laurenWalk10, laurenWalk11],
      laurenPress: [laurenPress1, laurenPress2],
      loisIdle,
      loisWalk: [loisWalk18, loisWalk19, loisWalk20, loisWalk21],
      loisPress: [loisPress1, loisPress2],
      tvFrames: [tvStaticLight, tvStaticDense, tvFlashWeak, tvFlashStrong, tvCalm],
    };
    // Photos souvenir de l'écran final (chargées à part car nombreuses).
    const photoPaths = [];
    for (let i = 1; i <= 12; i++) photoPaths.push(loadImage(`Assets/Photo Fin de Jeu/${i}.png`));
    Promise.all(photoPaths).then((finalPhotos) => {
      assets.finalPhotos = finalPhotos;

      // Départ normal du jeu (voir `let scene = 'premenu'` dans core.js).
      requestAnimationFrame((ts) => loop(ts, assets));
    });
  })
  .catch((err) => {
    console.error(err);
  });
