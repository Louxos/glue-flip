/**
 * Interface translations.
 *
 * English is the source of truth: every key lives in `EN`, and the TypeScript
 * type of `FR` is `Record<keyof typeof EN, string>`, so the compiler refuses to
 * build if a key is missing from a translation. `tOr()` covers id-based keys
 * that come from data files (sticks, surfaces, challenges) and cannot be listed
 * statically.
 */

export type Language = 'en' | 'fr';

export interface LanguageInfo {
  id: Language;
  /** Native label, shown as-is in the language picker. */
  label: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
];

const EN = {
  // --- Menu --------------------------------------------------------------
  'menu.eyebrow': 'A desk physics toy',
  'menu.title': 'Glue Flip',
  'menu.tagline': 'Grab the stick, flick it, land it upright.',
  'menu.play': 'Play',
  'menu.challenges': 'Challenges',
  'menu.openMode': 'Open Mode',
  'menu.settings': 'Settings',
  'menu.stick': 'Stick',
  'menu.stickHint': 'Click to change stick',
  'menu.bestScore': 'Best score',
  'menu.bestCombo': 'Best combo',
  'menu.perfects': 'Perfects',

  // --- HUD ---------------------------------------------------------------
  'hud.score': 'Score',
  'hud.combo': 'Combo',
  'hud.best': 'Best',
  'hud.level': 'Level',
  'hud.attempts': 'Throws left',
  'hud.progress': 'Progress',
  'hud.objective': 'Objective',
  'hud.power': 'Power',
  'hud.rotations': 'turns',
  'hud.pause': 'Pause',
  'hud.hint.classic': 'Drag the stick and flick to throw',
  'hud.hint.challenge': 'Land inside the target zone',
  'hud.hint.open': 'Drag to throw · C surface · V stick',
  'hud.nextThrow': 'Next throw',
  'hud.retry': 'Retry',
  'hud.nextThrowHint': 'Press R for the next throw',

  // --- Verdicts ----------------------------------------------------------
  'verdict.perfect': 'PERFECT',
  'verdict.landing': 'LANDING',
  'verdict.failed': 'FAILED',
  'verdict.lost': 'LOST',
  'landing.lost': 'The stick is gone',
  'landing.tooWeak': 'Barely left the hand',
  'landing.onCap': 'Landed on the cap',
  'landing.notBase': 'Never touched down on its base',
  'landing.toppled': 'Toppled over',
  'landing.outside': 'Outside the zone',
  'landing.vertical': 'Dead vertical',
  'landing.standing': 'Standing',

  // --- Pause -------------------------------------------------------------
  'pause.title': 'Paused',
  'pause.hint': 'The stick will wait.',
  'pause.resume': 'Resume',
  'pause.restart': 'Restart',
  'pause.settings': 'Settings',
  'pause.menu': 'Main menu',

  // --- Result card -------------------------------------------------------
  'result.runOver': 'Run over',
  'result.challengeComplete': 'Challenge complete',
  'result.outOfThrows': 'Out of throws',
  'result.newBest': 'New personal best.',
  'result.personalBest': 'Personal best: {score}',
  'result.challengeCleared': '{name} cleared.',
  'result.challengeAgain': '{name} needs another run.',
  'result.score': 'Score',
  'result.best': 'Best',
  'result.bestCombo': 'Best combo',
  'result.landings': 'Landings',
  'result.perfect': 'Perfect',
  'result.level': 'Level',
  'result.attempts': 'Throws',
  'result.menu': 'Menu',
  'result.retry': 'Retry',
  'result.next': 'Next',
  'result.again': 'Play again',
  'result.back': 'Back',
  'result.credits': 'Credits',

  // --- Challenges --------------------------------------------------------
  'challenges.title': 'Challenges',
  'challenges.subtitle': 'Short tests. Each one is a different desk problem.',
  'challenges.done': 'Cleared',
  'challenges.best': 'Best',
  'challenges.attempts': 'throws',
  'challenges.back': 'Back',
  'challenges.objective': 'Objective',

  // --- Settings ----------------------------------------------------------
  'settings.title': 'Settings',
  'settings.close': 'Close settings',
  'settings.sectionAudio': 'Audio',
  'settings.masterVolume': 'Master volume',
  'settings.sfxVolume': 'Effects',
  'settings.ambienceVolume': 'Ambience',
  'settings.sectionLanguage': 'Language',
  'settings.language': 'Interface language',
  'settings.languageHint': 'Applied immediately, kept in your save',
  'settings.sectionGraphics': 'Graphics',
  'settings.quality': 'Graphic quality',
  'settings.qualityHint': 'Lower it for a steadier frame rate',
  'settings.quality.auto': 'Auto',
  'settings.quality.low': 'Perf',
  'settings.quality.medium': 'Bal',
  'settings.quality.high': 'High',
  'settings.quality.ultra': 'Ultra',
  'settings.performanceMode': 'Performance mode',
  'settings.performanceModeHint': 'Cheapest preset, effects off',
  'settings.sectionControls': 'Controls',
  'settings.cameraSensitivity': 'Camera sensitivity',
  'settings.throwSensitivity': 'Throw sensitivity',
  'settings.invertCameraY': 'Invert camera Y',
  'settings.haptics': 'Haptic feedback',
  'settings.hapticsHint': 'Vibration on landings (mobile)',
  'settings.sectionComfort': 'Comfort',
  'settings.showThrowGuide': 'Throw guide',
  'settings.showThrowGuideHint': 'Faint trajectory dots while holding',
  'settings.screenShake': 'Screen shake',
  'settings.reducedMotion': 'Reduce motion',
  'settings.reducedMotionHint': 'Softens camera moves and slow motion',
  'settings.sectionAccessibility': 'Accessibility',
  'settings.highContrast': 'High contrast',
  'settings.highContrastHint': 'Stronger text and panel contrast',
  'settings.textSize': 'Text size',
  'settings.textSizeHint': 'Scales the whole interface',
  'settings.sectionTools': 'Tools',
  'settings.showDebug': 'Debug overlay',
  'settings.showDebugHint': 'Telemetry, colliders and vectors (F1)',
  'settings.resetProgress': 'Reset progress',
  'settings.resetConfirm': 'Tap again to confirm',
  'settings.resetDone': 'Progress reset',

  // --- Modes -------------------------------------------------------------
  'mode.classic': 'Classic',
  'mode.challenge': 'Challenge',
  'mode.open': 'Open Mode',
  'mode.objective.landUpright': 'Land it upright',
  'mode.objective.zone': 'Land inside the zone',
  'mode.objective.free': 'Throw wherever you like',
  'mode.goal.combo': '{count} in a row',
  'mode.goal.landings': '{progress} / {count} landings',
  'mode.goal.perfects': '{progress} / {count} perfect landings',
  'mode.last': 'Last: {reason}',
  'mode.changeSurface': 'Change surface',
  'mode.changeStick': 'Change stick',

  // --- Toasts ------------------------------------------------------------
  'toast.levelUp': 'Level {level} · {note}',
  'toast.throwsLeft': '{count} throws left',
  'toast.challengeProgress': '{completed} / {total}',
  'toast.stickUpdated': 'Stick updated',
  'toast.surface': 'Surface: {name}',
  'toast.progressReset': 'Progress reset',
  'toast.quality': 'Quality: {quality}',
  'toast.debugOn': 'Debug on',
  'toast.debugOff': 'Debug off',
  'toast.challengeUnavailable': 'Challenge unavailable',
  'toast.language': 'Language: {language}',

  // --- Credits -----------------------------------------------------------
  'credits.title': 'Glue Flip',
  'credits.body':
    'Real rigid-body physics by Rapier. Every landing you saw was simulated, not animated. ' +
    'Built with Vite, TypeScript and three.js. Thanks for playing.',
  'credits.close': 'Close',

  // --- Easter eggs -------------------------------------------------------
  'egg.unlocked': 'Secret found',
  'egg.konami': 'Golden Glue',
  'egg.konamiToast': 'Secret stick unlocked: Golden Glue',
  'egg.konamiHint': 'A heavier stick with a low centre of mass. Find it in the menu.',
  'egg.glueglue': 'G.L.U.E.',
  'egg.glueglueToast': 'You spelled the word',
  'egg.glueglueHint': 'It was always going to be GLUE.',
  'egg.moon': 'Desk Moon',
  'egg.moonToast': 'Low gravity on',
  'egg.moonOffToast': 'Low gravity off',
  'egg.moonHint': 'Three G presses in Open Mode. The desk is the moon now.',
  'egg.velvet': 'Velvet pad',
  'egg.velvetToast': 'Secret surface unlocked: Velvet',
  'egg.velvetHint': 'Ten perfect landings earned you a velvet pad. Find it in Open Mode (C).',
  'egg.patience': 'Steady hands',
  'egg.patienceToast': 'Take your time — the zone is helping you',
  'egg.patienceHint': 'After ten misses the target zone glows to guide you.',
  'egg.insomniac': 'Night shift',
  'egg.insomniacToast': 'Playing this late? The desk is quieter at night.',
  'egg.insomniacHint': 'Land a throw between midnight and 4 a.m.',
  'egg.credits': 'Credits',
  'egg.creditsToast': 'Credits',
  'egg.creditsHint': 'Click the title seven times.',
  'egg.lostfound': 'Lost and found',
  'egg.lostfoundToast': 'Five on the floor. The walls will catch it now.',
  'egg.lostfoundHint': 'Throw five sticks off the desk in a row.',

  // --- Data names --------------------------------------------------------
  'stick.classic.name': 'School Classic',
  'stick.classic.tagline': 'Balanced, forgiving. The one everyone knows.',
  'stick.jumbo.name': 'Jumbo Stick',
  'stick.jumbo.tagline': 'Heavier and taller. Slower spin, bigger wobble.',
  'stick.slim.name': 'Slim Glue',
  'stick.slim.tagline': 'Light and quick. Spins fast, lands nervously.',
  'stick.purple.name': 'Purple Twist',
  'stick.purple.tagline': 'Slightly top heavy — for experts.',
  'stick.gold.name': 'Golden Glue',
  'stick.gold.tagline': 'Not a real product. Lands like a rumour.',
  'surface.wood.name': 'Oak Desk',
  'surface.walnut.name': 'Dark Walnut',
  'surface.rubber.name': 'Rubber Mat',
  'surface.glass.name': 'Glass Tray',
  'surface.metal.name': 'Steel Tray',
  'surface.stone.name': 'Stone Coaster',
  'surface.paper.name': 'Notebook',
  'surface.velvet.name': 'Velvet',
  'challenge.first-blood.name': 'First Blood',
  'challenge.first-blood.brief': 'Land the stick upright once.',
  'challenge.precision.name': 'Precision',
  'challenge.precision.brief': 'Land inside a small zone.',
  'challenge.long-shot.name': 'Long Shot',
  'challenge.long-shot.brief': 'Reach a distant zone.',
  'challenge.streak.name': 'Streak',
  'challenge.streak.brief': 'Chain landings without a miss.',
  'challenge.ice-panel.name': 'Ice Panel',
  'challenge.ice-panel.brief': 'Land on a slippery glass tray.',
  'challenge.steel-tray.name': 'Steel Tray',
  'challenge.steel-tray.brief': 'Bouncy metal. Control the rebound.',
  'challenge.the-gap.name': 'The Gap',
  'challenge.the-gap.brief': 'Thread a tight landing spot.',
  'challenge.desk-clutter.name': 'Desk Clutter',
  'challenge.desk-clutter.brief': 'Clear the obstacles.',
  'challenge.soft-touch.name': 'Soft Touch',
  'challenge.soft-touch.brief': 'Land gently on paper.',
  'challenge.marble-run.name': 'Marble Run',
  'challenge.marble-run.brief': 'Land on stone without tipping.',
  'challenge.slim-expert.name': 'Slim Expert',
  'challenge.slim-expert.brief': 'Do it with the lightest stick.',
  'challenge.gauntlet.name': 'Gauntlet',
  'challenge.gauntlet.brief': 'Everything at once.',
} as const;

export type TranslationKey = keyof typeof EN;

/** FR is checked against EN at compile time — a missing key breaks the build. */
const FR: Record<TranslationKey, string> = {
  // --- Menu --------------------------------------------------------------
  'menu.eyebrow': 'Un jouet physique de bureau',
  'menu.title': 'Glue Flip',
  'menu.tagline': 'Attrape le bâton, lance-le, fais-le tenir debout.',
  'menu.play': 'Jouer',
  'menu.challenges': 'Défis',
  'menu.openMode': 'Mode libre',
  'menu.settings': 'Réglages',
  'menu.stick': 'Bâton',
  'menu.stickHint': 'Cliquez pour changer de bâton',
  'menu.bestScore': 'Meilleur score',
  'menu.bestCombo': 'Meilleur combo',
  'menu.perfects': 'Parfaits',

  // --- HUD ---------------------------------------------------------------
  'hud.score': 'Score',
  'hud.combo': 'Combo',
  'hud.best': 'Record',
  'hud.level': 'Niveau',
  'hud.attempts': 'Lancers restants',
  'hud.progress': 'Progression',
  'hud.objective': 'Objectif',
  'hud.power': 'Puissance',
  'hud.rotations': 'tours',
  'hud.pause': 'Pause',
  'hud.hint.classic': 'Faites glisser le bâton puis relâchez pour lancer',
  'hud.hint.challenge': 'Atterrissez dans la zone cible',
  'hud.hint.open': 'Glissez pour lancer · C surface · V bâton',
  'hud.nextThrow': 'Lancer suivant',
  'hud.retry': 'Rejouer',
  'hud.nextThrowHint': 'Touche R pour le lancer suivant',

  // --- Verdicts ----------------------------------------------------------
  'verdict.perfect': 'PARFAIT',
  'verdict.landing': 'RÉUSSI',
  'verdict.failed': 'RATÉ',
  'verdict.lost': 'PERDU',
  'landing.lost': 'Le bâton est parti',
  'landing.tooWeak': 'Il a à peine quitté la main',
  'landing.onCap': 'Posé sur le capuchon',
  'landing.notBase': 'Jamais posé sur sa base',
  'landing.toppled': 'Renversé',
  'landing.outside': 'Hors de la zone',
  'landing.vertical': 'Parfaitement vertical',
  'landing.standing': 'Debout',

  // --- Pause -------------------------------------------------------------
  'pause.title': 'Pause',
  'pause.hint': 'Le bâton vous attend.',
  'pause.resume': 'Reprendre',
  'pause.restart': 'Recommencer',
  'pause.settings': 'Réglages',
  'pause.menu': 'Menu principal',

  // --- Result card -------------------------------------------------------
  'result.runOver': 'Partie terminée',
  'result.challengeComplete': 'Défi réussi',
  'result.outOfThrows': 'Plus de lancers',
  'result.newBest': 'Nouveau record personnel.',
  'result.personalBest': 'Record personnel : {score}',
  'result.challengeCleared': '{name} réussi.',
  'result.challengeAgain': '{name} demande une autre tentative.',
  'result.score': 'Score',
  'result.best': 'Record',
  'result.bestCombo': 'Meilleur combo',
  'result.landings': 'Atterrissages',
  'result.perfect': 'Parfaits',
  'result.level': 'Niveau',
  'result.attempts': 'Lancers',
  'result.menu': 'Menu',
  'result.retry': 'Réessayer',
  'result.next': 'Suivant',
  'result.again': 'Rejouer',
  'result.back': 'Retour',
  'result.credits': 'Générique',

  // --- Challenges --------------------------------------------------------
  'challenges.title': 'Défis',
  'challenges.subtitle': 'De courts tests. Chacun est un problème de bureau différent.',
  'challenges.done': 'Réussi',
  'challenges.best': 'Record',
  'challenges.attempts': 'lancers',
  'challenges.back': 'Retour',
  'challenges.objective': 'Objectif',

  // --- Settings ----------------------------------------------------------
  'settings.title': 'Réglages',
  'settings.close': 'Fermer les réglages',
  'settings.sectionAudio': 'Audio',
  'settings.masterVolume': 'Volume général',
  'settings.sfxVolume': 'Effets',
  'settings.ambienceVolume': 'Ambiance',
  'settings.sectionLanguage': 'Langue',
  'settings.language': "Langue de l'interface",
  'settings.languageHint': 'Appliquée immédiatement, enregistrée',
  'settings.sectionGraphics': 'Graphismes',
  'settings.quality': 'Qualité graphique',
  'settings.qualityHint': 'Baissez-la pour une image plus stable',
  'settings.quality.auto': 'Auto',
  'settings.quality.low': 'Perf',
  'settings.quality.medium': 'Équi',
  'settings.quality.high': 'Haute',
  'settings.quality.ultra': 'Ultra',
  'settings.performanceMode': 'Mode performance',
  'settings.performanceModeHint': "Préréglage minimal, effets désactivés",
  'settings.sectionControls': 'Commandes',
  'settings.cameraSensitivity': 'Sensibilité caméra',
  'settings.throwSensitivity': 'Sensibilité lancer',
  'settings.invertCameraY': 'Inverser l’axe Y caméra',
  'settings.haptics': 'Retour haptique',
  'settings.hapticsHint': 'Vibrations aux atterrissages (mobile)',
  'settings.sectionComfort': 'Confort',
  'settings.showThrowGuide': 'Guide de lancer',
  'settings.showThrowGuideHint': 'Points de trajectoire discrets pendant la prise',
  'settings.screenShake': 'Secousses d’écran',
  'settings.reducedMotion': 'Réduire les animations',
  'settings.reducedMotionHint': 'Adoucit la caméra et le ralenti',
  'settings.sectionAccessibility': 'Accessibilité',
  'settings.highContrast': 'Contraste élevé',
  'settings.highContrastHint': 'Texte et panneaux plus contrastés',
  'settings.textSize': 'Taille du texte',
  'settings.textSizeHint': "Agrandit toute l'interface",
  'settings.sectionTools': 'Outils',
  'settings.showDebug': 'Panneau de debug',
  'settings.showDebugHint': 'Télémétrie, colliders et vecteurs (F1)',
  'settings.resetProgress': 'Réinitialiser la progression',
  'settings.resetConfirm': 'Cliquez encore pour confirmer',
  'settings.resetDone': 'Progression réinitialisée',

  // --- Modes -------------------------------------------------------------
  'mode.classic': 'Classique',
  'mode.challenge': 'Défi',
  'mode.open': 'Mode libre',
  'mode.objective.landUpright': 'Faites-le tenir debout',
  'mode.objective.zone': 'Atterrissez dans la zone',
  'mode.objective.free': 'Lancez où vous voulez',
  'mode.goal.combo': '{count} d’affilée',
  'mode.goal.landings': '{progress} / {count} atterrissages',
  'mode.goal.perfects': '{progress} / {count} atterrissages parfaits',
  'mode.last': 'Dernier : {reason}',
  'mode.changeSurface': 'Changer de surface',
  'mode.changeStick': 'Changer de bâton',

  // --- Toasts ------------------------------------------------------------
  'toast.levelUp': 'Niveau {level} · {note}',
  'toast.throwsLeft': '{count} lancers restants',
  'toast.challengeProgress': '{completed} / {total}',
  'toast.stickUpdated': 'Bâton changé',
  'toast.surface': 'Surface : {name}',
  'toast.progressReset': 'Progression réinitialisée',
  'toast.quality': 'Qualité : {quality}',
  'toast.debugOn': 'Debug activé',
  'toast.debugOff': 'Debug désactivé',
  'toast.challengeUnavailable': 'Défi indisponible',
  'toast.language': 'Langue : {language}',

  // --- Credits -----------------------------------------------------------
  'credits.title': 'Glue Flip',
  'credits.body':
    'Physique de corps rigides réelle signée Rapier. Chaque atterrissage que vous avez vu a été ' +
    'simulé, jamais animé. Conçu avec Vite, TypeScript et three.js. Merci d’avoir joué.',
  'credits.close': 'Fermer',

  // --- Easter eggs -------------------------------------------------------
  'egg.unlocked': 'Secret trouvé',
  'egg.konami': 'Colle dorée',
  'egg.konamiToast': 'Bâton secret débloqué : Colle dorée',
  'egg.konamiHint': 'Un bâton plus lourd au centre de masse bas. Disponible dans le menu.',
  'egg.glueglue': 'C.O.L.L.E.',
  'egg.glueglueToast': 'Vous avez épelé le mot',
  'egg.glueglueHint': 'C’était forcément GLUE.',
  'egg.moon': 'Lune de bureau',
  'egg.moonToast': 'Gravité réduite activée',
  'egg.moonOffToast': 'Gravité réduite désactivée',
  'egg.moonHint': 'Trois appuis sur G en Mode libre. Le bureau est devenu la Lune.',
  'egg.velvet': 'Velours',
  'egg.velvetToast': 'Surface secrète débloquée : Velours',
  'egg.velvetHint': 'Dix atterrissages parfaits vous offrent un tapis de velours (Mode libre, C).',
  'egg.patience': 'Mains sûres',
  'egg.patienceToast': 'Prenez votre temps — la zone vous aide',
  'egg.patienceHint': 'Après dix échecs, la zone cible s’illumine pour vous guider.',
  'egg.insomniac': 'Équipe de nuit',
  'egg.insomniacToast': 'Vous jouez tard ? Le bureau est plus calme la nuit.',
  'egg.insomniacHint': 'Réussissez un lancer entre minuit et 4 h du matin.',
  'egg.credits': 'Générique',
  'egg.creditsToast': 'Générique',
  'egg.creditsHint': 'Cliquez sept fois sur le titre.',
  'egg.lostfound': 'Objets trouvés',
  'egg.lostfoundToast': 'Cinq par terre. Les murs le rattrapent maintenant.',
  'egg.lostfoundHint': 'Envoyez cinq bâtons hors du bureau d’affilée.',

  // --- Data names --------------------------------------------------------
  'stick.classic.name': 'Classique d’école',
  'stick.classic.tagline': 'Équilibré, indulgent. Celui que tout le monde connaît.',
  'stick.jumbo.name': 'Bâton Jumbo',
  'stick.jumbo.tagline': 'Plus lourd et plus haut. Rotation lente, oscillation large.',
  'stick.slim.name': 'Colle fine',
  'stick.slim.tagline': 'Légère et vive. Tourne vite, atterrit nerveusement.',
  'stick.purple.name': 'Twist violet',
  'stick.purple.tagline': 'Légèrement lourd du haut — pour les experts.',
  'stick.gold.name': 'Colle dorée',
  'stick.gold.tagline': 'N’existe pas vraiment. Atterrit comme une rumeur.',
  'surface.wood.name': 'Bureau en chêne',
  'surface.walnut.name': 'Noyer foncé',
  'surface.rubber.name': 'Tapis en caoutchouc',
  'surface.glass.name': 'Plateau en verre',
  'surface.metal.name': 'Plateau en acier',
  'surface.stone.name': 'Dessous de verre en pierre',
  'surface.paper.name': 'Cahier',
  'surface.velvet.name': 'Velours',
  'challenge.first-blood.name': 'Premier sang',
  'challenge.first-blood.brief': 'Posez le bâton debout une fois.',
  'challenge.precision.name': 'Précision',
  'challenge.precision.brief': 'Atterrissez dans une petite zone.',
  'challenge.long-shot.name': 'Long tir',
  'challenge.long-shot.brief': 'Atteignez une zone éloignée.',
  'challenge.streak.name': 'Série',
  'challenge.streak.brief': 'Enchaînez les atterrissages sans échec.',
  'challenge.ice-panel.name': 'Panneau de glace',
  'challenge.ice-panel.brief': 'Atterrissez sur un plateau en verre glissant.',
  'challenge.steel-tray.name': 'Plateau d’acier',
  'challenge.steel-tray.brief': 'Métal rebondissant. Contrôlez le ricochet.',
  'challenge.the-gap.name': 'Le passage',
  'challenge.the-gap.brief': 'Visez un espace d’atterrissage étroit.',
  'challenge.desk-clutter.name': 'Bureau encombré',
  'challenge.desk-clutter.brief': 'Évitez les obstacles.',
  'challenge.soft-touch.name': 'Toucher léger',
  'challenge.soft-touch.brief': 'Atterrissez en douceur sur du papier.',
  'challenge.marble-run.name': 'Piste de marbre',
  'challenge.marble-run.brief': 'Atterrissez sur la pierre sans basculer.',
  'challenge.slim-expert.name': 'Expert de la colle fine',
  'challenge.slim-expert.brief': 'Réussissez avec le bâton le plus léger.',
  'challenge.gauntlet.name': 'Gantelet',
  'challenge.gauntlet.brief': 'Tout à la fois.',
};

const DICTIONARIES: Record<Language, Record<string, string>> = { en: EN, fr: FR };

let current: Language = 'en';
const listeners = new Set<(language: Language) => void>();

export function setLanguage(language: Language): void {
  if (language !== 'en' && language !== 'fr') return;
  if (current === language) return;
  current = language;
  for (const listener of listeners) listener(language);
}

export function getLanguage(): Language {
  return current;
}

/** Subscribe to language changes (screens rebuild themselves). */
export function onLanguageChange(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/** Translates a known key. Falls back to English, then to the key itself. */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const table = DICTIONARIES[current];
  const value = table[key] ?? EN[key];
  return fill(value ?? key, vars);
}

/**
 * Translates an id-based key (stick / surface / challenge names). Used for
 * strings that come from data files, where the key cannot be checked statically.
 */
export function tOr(
  key: string,
  fallback: string,
  vars?: Record<string, string | number>,
): string {
  const table = DICTIONARIES[current];
  const value = table[key] ?? (EN as Record<string, string>)[key];
  return value ? fill(value, vars) : fill(fallback, vars);
}

/** Keys of `EN` — handy for coverage tests. */
export const TRANSLATION_KEYS = Object.keys(EN) as TranslationKey[];

/** Reports which keys a translation is missing (empty for a complete one). */
export function dictionaryCoverage(language: Language): { missing: string[]; total: number } {
  const table = DICTIONARIES[language];
  const missing = TRANSLATION_KEYS.filter((key) => !table[key]);
  return { missing, total: TRANSLATION_KEYS.length };
}
