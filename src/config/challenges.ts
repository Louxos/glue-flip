/**
 * Challenge definitions.
 *
 * Challenges exist to exercise the physics from different angles: distance,
 * surface grip, bounce, obstacles and precision. They reuse the exact same
 * simulation as Classic — only the setup differs.
 */

export type ObstacleKind = 'book' | 'mug' | 'tape' | 'block' | 'pencilCase';

export interface ObstacleSpec {
  kind: ObstacleKind;
  /** Position of the obstacle base centre, in desk-local coordinates. */
  position: [number, number, number];
  size: [number, number, number];
  rotationY?: number;
}

export type ChallengeGoalType = 'landings' | 'perfects' | 'combo' | 'distance';

export interface ChallengeGoal {
  type: ChallengeGoalType;
  count: number;
  /** Minimum distance for `distance` goals (m). */
  minDistance?: number;
}

export interface ChallengeDef {
  id: string;
  name: string;
  brief: string;
  goal: ChallengeGoal;
  /** Number of throws allowed; 0 = unlimited. */
  attempts: number;
  surfaceId: string;
  glueStickId?: string;
  /** Distance from the spawn point to the landing zone centre (m). */
  distance: number;
  /** Landing zone radius (m); 0 disables the zone requirement. */
  zoneRadius: number;
  obstacles: ObstacleSpec[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Optional flavour shown on completion. */
  rewardText?: string;
}

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'first-blood',
    name: 'First Landing',
    brief: 'Land the glue stick upright on the desk. Any tilt under 14° counts.',
    goal: { type: 'landings', count: 1 },
    attempts: 0,
    surfaceId: 'wood',
    distance: 0.3,
    zoneRadius: 0.22,
    obstacles: [],
    difficulty: 1,
    rewardText: 'That is the whole game. Now master it.',
  },
  {
    id: 'precision',
    name: 'Dead Centre',
    brief: 'Score a PERFECT landing: under 5° of tilt, on its base.',
    goal: { type: 'perfects', count: 1 },
    attempts: 0,
    surfaceId: 'wood',
    distance: 0.34,
    zoneRadius: 0.18,
    obstacles: [],
    difficulty: 2,
  },
  {
    id: 'long-shot',
    name: 'Long Shot',
    brief: 'Reach the far pad. You will need real speed and a full rotation.',
    goal: { type: 'landings', count: 1 },
    attempts: 12,
    surfaceId: 'walnut',
    distance: 0.78,
    zoneRadius: 0.14,
    obstacles: [],
    difficulty: 3,
  },
  {
    id: 'streak',
    name: 'Streak of Three',
    brief: 'Three consecutive landings without a miss.',
    goal: { type: 'combo', count: 3 },
    attempts: 0,
    surfaceId: 'wood',
    distance: 0.42,
    zoneRadius: 0.2,
    obstacles: [],
    difficulty: 2,
  },
  {
    id: 'ice-panel',
    name: 'Ice Panel',
    brief: 'Land on the glass. Almost no grip, lots of bounce.',
    goal: { type: 'landings', count: 1 },
    attempts: 15,
    surfaceId: 'glass',
    distance: 0.36,
    zoneRadius: 0.16,
    obstacles: [],
    difficulty: 4,
  },
  {
    id: 'steel-tray',
    name: 'Steel Tray',
    brief: 'The tray rings and springs. Kill the bounce with a soft throw.',
    goal: { type: 'landings', count: 2 },
    attempts: 18,
    surfaceId: 'metal',
    distance: 0.44,
    zoneRadius: 0.15,
    obstacles: [],
    difficulty: 4,
  },
  {
    id: 'the-gap',
    name: 'Through the Gap',
    brief: 'A textbook is in the way. Clear it and land in the zone.',
    goal: { type: 'landings', count: 1 },
    attempts: 15,
    surfaceId: 'wood',
    distance: 0.62,
    zoneRadius: 0.15,
    obstacles: [
      { kind: 'book', position: [0, 0, 0.06], size: [0.21, 0.035, 0.16], rotationY: 0.12 },
    ],
    difficulty: 3,
  },
  {
    id: 'desk-clutter',
    name: 'Cluttered Desk',
    brief: 'Mug, tape and a pencil case. Thread the needle.',
    goal: { type: 'landings', count: 1 },
    attempts: 15,
    surfaceId: 'walnut',
    distance: 0.58,
    zoneRadius: 0.13,
    obstacles: [
      { kind: 'mug', position: [0.17, 0, 0.02], size: [0.08, 0.1, 0.08] },
      { kind: 'tape', position: [-0.19, 0, 0.05], size: [0.1, 0.05, 0.1] },
      { kind: 'pencilCase', position: [0.02, 0, 0.2], size: [0.2, 0.05, 0.07], rotationY: -0.3 },
    ],
    difficulty: 4,
  },
  {
    id: 'soft-touch',
    name: 'Soft Touch',
    brief: 'The notebook swallows bounce. Land twice on paper.',
    goal: { type: 'landings', count: 2 },
    attempts: 14,
    surfaceId: 'paper',
    distance: 0.4,
    zoneRadius: 0.16,
    obstacles: [],
    difficulty: 2,
  },
  {
    id: 'marble-run',
    name: 'Marble Run',
    brief: 'Polished stone, long distance, two perfect landings.',
    goal: { type: 'perfects', count: 2 },
    attempts: 20,
    surfaceId: 'stone',
    distance: 0.66,
    zoneRadius: 0.13,
    obstacles: [],
    difficulty: 5,
  },
  {
    id: 'slim-expert',
    name: 'Slim Expert',
    brief: 'The featherweight stick on rubber. Everything happens faster.',
    goal: { type: 'landings', count: 1 },
    attempts: 15,
    surfaceId: 'rubber',
    glueStickId: 'slim',
    distance: 0.46,
    zoneRadius: 0.12,
    obstacles: [],
    difficulty: 5,
  },
  {
    id: 'gauntlet',
    name: 'The Gauntlet',
    brief: 'Glass, clutter and a long throw. Five landings.',
    goal: { type: 'landings', count: 5 },
    attempts: 30,
    surfaceId: 'glass',
    distance: 0.7,
    zoneRadius: 0.14,
    obstacles: [
      { kind: 'block', position: [0.24, 0, 0.08], size: [0.09, 0.09, 0.09] },
      { kind: 'book', position: [-0.2, 0, 0.02], size: [0.2, 0.03, 0.15], rotationY: -0.2 },
    ],
    difficulty: 5,
    rewardText: 'You have nothing left to prove.',
  },
];

export function getChallenge(id: string): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
