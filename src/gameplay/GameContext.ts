import type { Engine } from '@/core/Engine';
import type { EventBus } from '@/core/EventBus';
import type { SaveManager } from '@/core/SaveManager';
import type { MaterialLibrary } from '@/render/MaterialLibrary';
import type { AudioEngine } from '@/audio/AudioEngine';
import type { InputManager } from '@/input/InputManager';
import type { CameraRig } from '@/camera/CameraRig';
import type { CinematicDirector } from '@/camera/CinematicDirector';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import type { GameEvents } from '@/gameplay/GameEvents';

/**
 * Everything a gameplay system needs, in one injected object.
 *
 * Passing a context (instead of importing singletons) keeps the modes and the
 * controller testable: a test can hand them a physics world and a stub event bus
 * without booting a renderer.
 */
export interface GameContext {
  physics: PhysicsWorld;
  engine: Engine;
  materials: MaterialLibrary;
  audio: AudioEngine;
  input: InputManager;
  rig: CameraRig;
  director: CinematicDirector;
  events: EventBus<GameEvents>;
  save: SaveManager;
  /** Live settings accessor (sensitivity, guide visibility, haptics…). */
  settings: () => SaveManager['settings'];
}
