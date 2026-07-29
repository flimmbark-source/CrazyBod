// All Mandala tuning lives here so speeds, spacing and the interaction plane
// can be changed without touching simulation or rendering logic.
//
// TEMPORARY DEVELOPMENT VALUES. Every number below is a prototype tuning value
// for the vertical slice, not a resolved design decision. They are gathered in
// one object on purpose — see the implementation report.

export const MANDALA_CONFIG = Object.freeze({
  // --- Travel -------------------------------------------------------------
  // World units per second at rest. Distances below are in the same units.
  BASE_TRAVEL_SPEED: 9,
  // Multiplier applied to travel speed while Dive is held. Held-only.
  DIVE_SPEED_MULTIPLIER: 2.4,

  // --- Interaction geometry (distance ahead of the camera) ----------------
  // An encounter's "distance" is how far ahead of the player it still is:
  //   distanceAhead = routeZ - travelDistance
  // These thresholds classify that distance into lifecycle states.
  APPROACHING_DISTANCE: 46, // enters view, starts reading
  ARRIVING_DISTANCE: 20, // close, settling to face the camera
  INTERACTION_DISTANCE: 10, // reaches the interaction plane -> becomes active
  // While active, an encounter is slashable until it falls this far behind the
  // plane. Past it, the encounter is unreachable but still counts as load.
  SLASH_REAR_LIMIT: -3,

  // --- Encounter placement (all by distance, never by time) ---------------
  FIRST_ENCOUNTER_DISTANCE: 34, // where the very first foe waits
  INTRO_COUNT: 4, // widely spaced teaching encounters
  INTRO_SPACING: 30, // gap between the intro encounters
  MIN_SPACING: 13, // tightest gap the ramp approaches
  // After the intro, spacing shrinks with depth (pressure rises). Each unit of
  // depth travelled reduces the spawn gap by this much, floored at MIN_SPACING.
  SPACING_RAMP_PER_UNIT: 0.03,
  // How far ahead of the player we keep the route populated with encounters.
  LOOKAHEAD_DISTANCE: 70,
  // Lateral spread of encounters inside the tube (fraction of tube radius).
  MAX_PATH_OFFSET: 0.55,

  // --- Tube visuals -------------------------------------------------------
  TUBE_RADIUS: 3.1,
  RING_SPACING: 4,
  RING_COUNT: 26,
  // Undulation: the tube axis wanders on sine waves of these amplitudes.
  UNDULATION_X: 1.5,
  UNDULATION_Y: 1.1,
  UNDULATION_FREQ: 0.055, // cycles per world unit of depth
  TWIST_PER_UNIT: 0.9, // degrees of ring roll per world unit of depth

  // The world-space z of the interaction plane in front of the camera.
  // Camera sits at z = 0 looking down -Z, so the plane is negative.
  get INTERACTION_PLANE_Z() {
    return -this.INTERACTION_DISTANCE
  },

  // World radius used to size an enemy's on-screen panel via perspective.
  ENEMY_WORLD_RADIUS: 1.25,

  // The foes are the game's microgames. These are plain kind ids (kept as
  // strings here, decoupled from the JSX catalog, so the pure/tested modules
  // never import React). The enemy layer maps them to names/colours for
  // display. TEMPORARY selection for the slice.
  ENEMY_KINDS: Object.freeze([
    'discomfort',
    'checking',
    'microRest',
    'workingMemory',
    'racingHeart',
    'lightSensitivity',
    'directionLoss',
    'heavyEyes',
    'dizziness',
    'brainFog',
  ]),
})

// The Mandala's axis offset at a given depth. Shared by simulation (encounter
// lateral position) and rendering (tube rings) so foes ride the tube exactly.
export function mandalaAxisAt(depth, config = MANDALA_CONFIG) {
  const t = depth * config.UNDULATION_FREQ
  return {
    x: Math.sin(t) * config.UNDULATION_X,
    y: Math.cos(t * 0.7) * config.UNDULATION_Y,
  }
}
