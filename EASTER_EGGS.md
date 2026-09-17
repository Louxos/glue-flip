# Easter eggs — Glue Flip

Huit secrets sont cachés dans le jeu. Aucun n'est annoncé dans l'interface : ils se
découvrent, et cinq d'entre eux sont **enregistrés dans la sauvegarde** (ils restent
débloqués pour toujours). Les trois autres ne durent que le temps de la session.

*Eight secrets are hidden in the game. None of them is advertised in the UI. Five are
**written to the save** and stay unlocked forever; the other three last for the session
only.*

| # | Nom / Name | Déclencheur / Trigger | Effet / Effect | Sauvegardé |
|---|---|---|---|---|
| 1 | **Colle dorée** / Golden Glue | Code Konami : ↑ ↑ ↓ ↓ ← → ← → B A | Débloquent un 5ᵉ bâton jouable, plus lourd, centre de masse bas | ✅ |
| 2 | **C.O.L.L.E.** / G.L.U.E. | Écrire le mot `GLUE` au clavier, n'importe où | Carillon de confirmation | ✅ |
| 3 | **Lune de bureau** / Desk Moon | 3 appuis sur `G` en moins de 2,5 s **en Mode libre** | Gravité à 35 % (ré-appuyer pour revenir sur Terre) | ⏱ session |
| 4 | **Velours** / Velvet pad | 10 atterrissages **parfaits** au total | Débloquent une 8ᵉ surface en Mode libre (touche `C`) | ✅ |
| 5 | **Mains sûres** / Steady hands | 10 échecs d'affilée | La zone cible s'illumine pour guider le joueur | ✅ |
| 6 | **Objets trouvés** / Lost and found | 5 bâtons hors du bureau d'affilée | Message : les murs rattrapent maintenant les lancers | ⏱ session |
| 7 | **Équipe de nuit** / Night shift | Réussir un lancer entre minuit et 4 h | Message de nuit (vérifié au démarrage et à chaque retour au menu) | ⏱ session |
| 8 | **Générique** / Credits | 7 clics sur le titre du menu en moins de 2,5 s | Ouvre la carte du générique | ✅ |

---

## Détail / Details

### 1. Colle dorée — Golden Glue (sauvegardé)

- **Déclencheur** : code Konami complet, `↑ ↑ ↓ ↓ ← → ← → B A`, à tout moment du jeu.
  La détection compare les 10 dernières touches, donc le code peut être tapé au milieu
  d'autres appuis.
- **Effet** : un cinquième bâton apparaît dans le sélecteur du menu principal — **Colle
  dorée / Golden Glue**, 52 g, centre de masse à 34 % de la hauteur. Il est le plus
  lourd du jeu : il tourne moins vite et pardonne davantage.
- **Persistance** : l'identifiant `konami` est écrit dans la sauvegarde
  (`easterEggs`), le bâton reste donc disponible après rechargement.
- **Implémentation** : `src/config/glueSticks.ts` (`secret: true`),
  `playableGlueSticks()`, effet appliqué dans `GameApp.applyEggs()`.

### 2. C.O.L.L.E. — G.L.U.E. (sauvegardé)

- **Déclencheur** : taper les lettres `G`, `L`, `U`, `E` au clavier, dans cet ordre.
  Majuscules ou minuscules, et le mot est aussi reconnu à l'intérieur d'un mot plus long
  (`superglue` fonctionne).
- **Effet** : un carillon bref. Aucun changement de jeu : c'est un clin d'œil.
- **Persistance** : `glueglue`, enregistré une fois trouvé.

### 3. Lune de bureau — Desk Moon (session)

- **Déclencheur** : en **Mode libre** uniquement, appuyer trois fois sur `G` en moins de
  2,5 secondes.
- **Effet** : la gravité passe de −9,81 m/s² à **−3,43 m/s²** (×0,35). Les bâtons
  flottent, les vols durent beaucoup plus longtemps, le ralenti d'atterrissage devient
  spectaculaire. Trois nouveaux appuis sur `G` remettent la gravité normale.
- **Persistance** : non — la gravité redevient terrestre au rechargement (un jeu de
  physique doit rester honnête par défaut). L'œuf reste marqué comme trouvé pour la
  session.
- **Implémentation** : `physics.world.gravity.y = PHYSICS.gravity * eggs.gravityScale`.

### 4. Velours — Velvet pad (sauvegardé)

- **Déclencheur** : cumuler **10 atterrissages parfaits** (inclinaison ≤ 5°) — le
  compteur est celui de la sauvegarde, il n'a donc pas besoin d'être fait d'un coup.
- **Effet** : une surface secrète rejoint le cycle du Mode libre (touche `C`) :
  **Velours**, friction 1,40, rebond 0,03. Le bâton colle presque au tapis.
- **Persistance** : `velvet` dans la sauvegarde.

### 5. Mains sûres — Steady hands (sauvegardé)

- **Déclencheur** : rater **10 lancers d'affilée** (tout ce qui n'est ni PARFAIT ni
  RÉUSSI). Un seul atterrissage remet le compteur à zéro.
- **Effet** : la zone cible s'illumine (`TargetZone.highlight(1)`) pour aider à viser.
  C'est le seul œuf qui modifie l'aide au jeu : il existe pour éviter qu'un joueur
  frustré abandonne.
- **Persistance** : `patience`. L'illumination elle-même se rejoue à chaque fois que
  la condition est remplie dans une partie suivante (le compteur repart à zéro).

### 6. Objets trouvés — Lost and found (session)

- **Déclencheur** : envoyer **5 bâtons hors du bureau** d'affilée (le verdict PERDU).
- **Effet** : message « Cinq par terre. Les murs le rattrapent maintenant. »
- **Persistance** : non, c'est un commentaire, pas un contenu.

### 7. Équipe de nuit — Night shift (session)

- **Déclencheur** : réussir un lancer entre **0 h et 4 h**, heure locale du joueur.
  L'heure est vérifiée au démarrage et à chaque retour au menu.
- **Effet** : message nocturne.
- **Persistance** : non.

### 8. Générique — Credits (sauvegardé)

- **Déclencheur** : cliquer **7 fois** sur le titre « Glue Flip » du menu principal en
  moins de 2,5 secondes.
- **Effet** : ouvre la carte du générique (moteur physique, technologies, remerciements),
  avec le meilleur score et le nombre de parfaits.
- **Persistance** : `credits`.

---

## Où sont les secrets dans le code

- `src/config/easterEggs.ts` — registre (id, persistance, catégorie), séquence Konami,
  mot magique, seuils (`EGG_TIMING`).
- `src/gameplay/EasterEggSystem.ts` — détection pure, sans DOM : on lui donne des
  événements (`key`, `char`, `throw`, `titleClick`, `hour`), elle renvoie les œufs
  débloqués. Testée dans `tests/easterEggs.test.ts` (19 tests).
- `src/app.ts` — `feedKey()`, `feedThrow()`, `handleTitleClick()`, `checkNightOwl()`
  alimentent le détecteur ; `applyEggs()` applique les effets (sauvegarde, gravité,
  zone, générique).
- `src/core/SaveManager.ts` — `easterEggs: string[]` dans la sauvegarde,
  `addEasterEgg()` / `hasEasterEgg()`.
- Contenu caché : `secret: true` sur le bâton `gold` et la surface `velvet` ; ils sont
  filtrés par `playableGlueSticks()` et `playableSurfaces()` tant qu'ils ne sont pas
  débloqués.

## Réinitialiser

`Réglages → Réinitialiser la progression` efface aussi les œufs sauvegardés : les deux
contenus secrets redeviennent cachés.
