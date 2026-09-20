// What is in the room, where it actually is, and what taking it gives you.
//
// Positions are world coordinates in the bedroom (see BedroomStatic in
// JourneyScene.jsx): the floor is y=0, the room runs x -4..4, and the camera
// stands at [0.55, 1.65, 3.1] looking down -z toward the hall. Every entry here
// is a real object drawn in the 3D room, not a marker floating over it, so the
// coordinates are chosen to sit on the surface that holds them.

// Ordinary morning things. Each opens one real minigame, alone, with nothing at
// stake — the point is to meet a minigame before four of them arrive at once.
// `lift` is how far above the object its name tag hangs, in metres. Things
// standing close together on the same counter get different lifts so their
// tags stack instead of sitting on top of each other.
export const PRACTICE_SPOTS = [
  { id: 'keys', model: 'keys', kind: 'workingMemory', position: [2.55, 0.92, 0.35], lift: 0.28 },
  { id: 'coffee', model: 'mug', kind: 'fatigue', position: [2.6, 0.91, -0.4], lift: 0.4 },
  { id: 'water', model: 'glass', kind: 'weakGrip', position: [2.64, 0.91, -1.12], lift: 0.52 },
  { id: 'clothes', model: 'clothes', kind: 'jointSlip', position: [-1.15, 1.0, 0.5], lift: 0.3 },
  { id: 'window', model: 'window', kind: 'lightSensitivity', position: [-3.72, 2.15, -3.5], lift: 0.5 },
]

// The upgrade elements. Each appears only when its skill node is owned and
// switched on, and doing it is what turns that upgrade on for this run —
// nothing fires on a timer any more. `reward` is shown on the label before you
// touch it and again, in arcade green, when you finish.
export const TECHNIQUE_SPOTS = [
  {
    id: 'rehearse',
    model: 'mirror',
    position: [2.62, 2.42, -1.75],
    lift: 0.72,
    reward: 'morning.reward.rehearse',
  },
  {
    id: 'stretch',
    model: 'mat',
    position: [0.6, 0.08, -1.05],
    lift: 0.28,
    reward: 'morning.reward.stretch',
  },
  {
    id: 'plan',
    model: 'clipboard',
    position: [-2.7, 1.75, -7.68],
    lift: 0.6,
    reward: 'morning.reward.plan',
  },
]

export const ALL_SPOTS = [...PRACTICE_SPOTS, ...TECHNIQUE_SPOTS]

export function spotById(id) {
  return ALL_SPOTS.find((spot) => spot.id === id) ?? null
}
