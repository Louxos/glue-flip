// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

/**
 * "The module transforms" is not "the module evaluates". A top-level throw
 * anywhere in the import graph produces a blank screen with a valid build, and
 * nothing else in the suite imports these files for their side effects.
 */
describe('module graph evaluates', () => {
  it('imports the app entry without throwing', async () => {
    const mod = await import('@/app');
    expect(typeof mod.GameApp).toBe('function');
  });

  it('imports every config, gameplay and ui module', async () => {
    const mods = [
      '@/config/physics', '@/config/glueSticks', '@/config/gameplay', '@/config/throw',
      '@/config/surfaces', '@/config/camera', '@/config/quality', '@/config/challenges',
      '@/config/world', '@/config/easterEggs',
      '@/gameplay/GameController', '@/gameplay/modes', '@/gameplay/EasterEggSystem',
      '@/gameplay/LandingEvaluator', '@/gameplay/ScoreSystem', '@/gameplay/ProgressionSystem',
      '@/gameplay/ThrowGesture',
      '@/ui/UIManager', '@/ui/i18n', '@/ui/screens/MenuScreen', '@/ui/screens/HudScreen',
      '@/ui/screens/PauseScreen', '@/ui/screens/SettingsScreen', '@/ui/screens/ChallengesScreen',
      '@/ui/screens/ResultScreen',
      '@/core/SaveManager', '@/core/EventBus',
      '@/physics/PhysicsWorld', '@/physics/GlueStickBody', '@/physics/TrajectorySimulator',
      '@/render/PostFX', '@/render/MaterialLibrary', '@/render/ProceduralTextures',
      '@/render/ThrowGuide', '@/render/ContactShadow',
      '@/utils/math', '@/utils/random', '@/utils/platform', '@/utils/dom', '@/utils/logger',
      '@/objects/SurfacePad', '@/objects/Obstacles',
    ];
    for (const m of mods) {
      await expect(import(m)).resolves.toBeTruthy();
    }
  });
});
