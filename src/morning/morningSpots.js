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
  { id: 'keys', model: 'keys', kind: 'workingMemory', position: [3.4, 0.92, -4.85], lift: 0.3 },
  { id: 'coffee', model: 'mug', kind: 'fatigue', position: [3.42, 0.91, -5.55], lift: 0.44 },
  { id: 'water', model: 'glass', kind: 'weakGrip', position: [3.44, 0.91, -6.2], lift: 0.58 },
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

// The front door. Clicking it is the ready-up: the day starts, and the day's
// own opening carries the player out through it, so this is the one thing in
// the room you do not first walk over to.
export const DOOR_SPOT = {
  id: 'door',
  model: 'frontDoor',
  position: [0, 1.95, -14.25],
  lift: 0.75,
  reward: 'morning.reward.door',
  startsTheDay: true,
}

export const ALL_SPOTS = [...PRACTICE_SPOTS, ...TECHNIQUE_SPOTS, DOOR_SPOT]

export function spotById(id) {
  return ALL_SPOTS.find((spot) => spot.id === id) ?? null
}

// The tutorial happens at the bathroom mirror: you stand in front of yourself
// and the first two feelings of the day arrive. The mirror is part of the room
// whether or not its upgrade is owned, so the tutorial can send you to it on a
// save that owns nothing.
export const TUTORIAL_MIRROR_SPOT = {
  id: 'rehearse',
  model: 'mirror',
  position: [2.62, 2.42, -1.75],
  lift: 0.72,
  standoff: 2.7,
  // Look a little below the middle of the glass, so standing at the mirror
  // frames the sink under it rather than craning up at the ceiling.
  lookOffset: -0.42,
}

// Where the player stands when they walk over to something.
//
// Rather than authoring a camera pose per object (and re-authoring them every
// time a thing moves), the standing position is derived: step back from the
// object toward the middle of the room, stop at eye height, and look at it.
const ROOM_STAND = [0.55, 3.1]
// The bedroom runs back to the wall the hall opens through, at z = -7.88.
const ROOM_BOUNDS = { minX: -3.3, maxX: 3.3, minZ: -7.1, maxZ: 4.4 }

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function approachPose(spot) {
  const [objectX, objectY, objectZ] = spot.position
  const toRoomX = ROOM_STAND[0] - objectX
  const toRoomZ = ROOM_STAND[1] - objectZ
  const length = Math.hypot(toRoomX, toRoomZ) || 1
  const standoff = spot.standoff ?? 1.5
  const standing = resolveFloorTarget(
    clamp(objectX + (toRoomX / length) * standoff, ROOM_BOUNDS.minX, ROOM_BOUNDS.maxX),
    clamp(objectZ + (toRoomZ / length) * standoff, ROOM_BOUNDS.minZ, ROOM_BOUNDS.maxZ),
  ) ?? { x: ROOM_STAND[0], z: ROOM_STAND[1] }

  return {
    position: [standing.x, 1.65, standing.z],
    look: [objectX, objectY + (spot.lookOffset ?? 0), objectZ],
    fov: spot.fov ?? 62,
  }
}

// --- Walking on the floor ------------------------------------------------
//
// Clicking a patch of floor walks the player to it. The room is a real room,
// so a click has to be resolved against it: clamped inside the walls, and
// pushed out of anything solid rather than dropping the camera inside the bed.

// Footprints of the things you cannot stand in, as [minX, maxX, minZ, maxZ].
// Taken from BedroomStatic's geometry, with a little clearance.
const FURNITURE = [
  [-3.35, -0.75, -0.35, 4.15],  // the bed
  [-0.95, -0.01, 2.28, 3.22],   // the nightstand
  [2.92, 3.9, -6.75, -4.35],    // the kitchen counter by the door
  [2.68, 3.52, -2.6, -0.9],     // the sink unit
]

// The walls. The room is full width right back to the wall the hall opens
// through; only the hall itself is narrow, and the front door is clicked rather
// than walked to, so the floor stops at the wall.
const FLOOR_BOUNDS = { minX: -3.4, maxX: 3.4, minZ: -7.2, maxZ: 4.2 }
const HALL_MOUTH_Z = -7.2
const HALL_HALF_WIDTH = 1.9

// Push a point out of a footprint through whichever side it is nearest.
function pushOut(x, z, [minX, maxX, minZ, maxZ]) {
  const clearance = 0.32
  const exits = [
    { x: minX - clearance, z, distance: x - minX },
    { x: maxX + clearance, z, distance: maxX - x },
    { x, z: minZ - clearance, distance: z - minZ },
    { x, z: maxZ + clearance, distance: maxZ - z },
  ]
  return exits.reduce((best, exit) => (exit.distance < best.distance ? exit : best))
}

export function resolveFloorTarget(rawX, rawZ) {
  if (!Number.isFinite(rawX) || !Number.isFinite(rawZ)) return null

  let x = clamp(rawX, FLOOR_BOUNDS.minX, FLOOR_BOUNDS.maxX)
  let z = clamp(rawZ, FLOOR_BOUNDS.minZ, FLOOR_BOUNDS.maxZ)
  if (z < HALL_MOUTH_Z) x = clamp(x, -HALL_HALF_WIDTH, HALL_HALF_WIDTH)

  // One pass is enough: the footprints do not overlap.
  for (const footprint of FURNITURE) {
    const [minX, maxX, minZ, maxZ] = footprint
    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      const exit = pushOut(x, z, footprint)
      x = clamp(exit.x, FLOOR_BOUNDS.minX, FLOOR_BOUNDS.maxX)
      z = clamp(exit.z, FLOOR_BOUNDS.minZ, FLOOR_BOUNDS.maxZ)
      break
    }
  }

  return { x, z }
}

// How fast the player walks, in metres per second. The camera and the code
// that decides when you have arrived both read this, so they cannot disagree.
export const WALK_SPEED = 2.4

// Where the player stands when nothing is focused: the middle of the room.
export const MORNING_STAND = [0.55, 3.1]

// The floor position a focus puts the player at.
export function standingPointFor(focus) {
  if (!focus) return MORNING_STAND
  if (focus.type === 'floor') return [focus.x, focus.z]
  const spot = spotById(focus.id)
  if (!spot) return MORNING_STAND
  const pose = approachPose(spot)
  return [pose.position[0], pose.position[2]]
}

// How long a walk between two floor points takes, with a moment on the end so
// nothing opens the instant the last step lands.
export function walkDurationMs([fromX, fromZ], [toX, toZ]) {
  const distance = Math.hypot(toX - fromX, toZ - fromZ)
  return Math.min(2800, Math.max(450, (distance / WALK_SPEED) * 1000 + 260))
}

// A floor pose has no look target: walking somewhere should not spin the
// player round, so CameraRig carries their current facing to the new spot.
export function floorPose(target) {
  return { position: [target.x, 1.65, target.z], look: null, fov: 70 }
}
