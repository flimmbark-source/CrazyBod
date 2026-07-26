import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CAFE_BEAT_PHASES, CAFE_BEAT_TIMINGS } from './cafeBeat.js'

const SEATED_POSITION = new THREE.Vector3(4.2, 0, -91.6)
const STANDING_POSITION = new THREE.Vector3(4.2, 0.08, -91.6)
const AISLE_POSITION = new THREE.Vector3(6.05, 0, -90.5)
const EXIT_POSITION = new THREE.Vector3(0.15, 0, -75.4)
const CAMERA_POSITION = new THREE.Vector3(4.2, 1.58, -88.25)
const CAFE_DOOR_LOOK = new THREE.Vector3(0, 1.65, -73.5)
const FACE_OFFSET = new THREE.Vector3(0, 1.62, 0)
// The seated conversation is framed a little lower than eye level so the dark
// café ceiling stays above the top of the frame (it otherwise fills the empty
// headroom above Mara, especially on tall/portrait screens).
const CONVO_FACE_OFFSET = new THREE.Vector3(0, 1.34, 0)

// Mara walks in from behind and to the player's left, then rounds the left end
// of the table before lowering into the chair across from the player, instead
// of cutting straight through the table (or popping into place). The walk runs
// in two legs via a waypoint so she skirts the table rather than clipping it.
const MARA_ENTRANCE_POSITION = new THREE.Vector3(1.5, 0, -85.5)
const MARA_ENTRANCE_WAYPOINT = new THREE.Vector3(2.1, 0, -91.35)
const MARA_ENTRANCE_START = 40.5 // dayElapsed seconds
const MARA_ENTRANCE_WALK = 2.9 // seconds spent walking to the chair
const MARA_ENTRANCE_SIT = 0.7 // seconds spent lowering into the seat
// Fraction of the walk spent on the first leg (up alongside the table to the
// waypoint); the remainder crosses behind the table to the chair.
const MARA_ENTRANCE_LEG1 = 0.72
const MARA_ENTRANCE_HEADING_1 = Math.atan2(
  MARA_ENTRANCE_WAYPOINT.x - MARA_ENTRANCE_POSITION.x,
  MARA_ENTRANCE_WAYPOINT.z - MARA_ENTRANCE_POSITION.z,
)
const MARA_ENTRANCE_HEADING_2 = Math.atan2(
  STANDING_POSITION.x - MARA_ENTRANCE_WAYPOINT.x,
  STANDING_POSITION.z - MARA_ENTRANCE_WAYPOINT.z,
)

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(value) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function sampleDeparture(progress, target) {
  const t = clamp01(progress)
  if (t < 0.32) {
    target.lerpVectors(STANDING_POSITION, AISLE_POSITION, smoothstep(t / 0.32))
  } else {
    target.lerpVectors(AISLE_POSITION, EXIT_POSITION, smoothstep((t - 0.32) / 0.68))
  }
  return target
}

function LowPolyMara({ mode }) {
  const leftArmRef = useRef(null)
  const rightArmRef = useRef(null)
  const leftLegRef = useRef(null)
  const rightLegRef = useRef(null)
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    timeRef.current += delta
    const time = timeRef.current
    const walking = mode === 'walk'
    const seated = mode === 'seated'
    const angry = mode === 'angry'
    const stride = walking ? Math.sin(time * 8.2) * 0.62 : 0

    if (leftArmRef.current) {
      // When angry the arms fling outward and up rather than crossing inward,
      // so the forearms clear the torso instead of clipping through it.
      leftArmRef.current.rotation.x = seated ? -0.2 : -stride * 0.72
      leftArmRef.current.rotation.z = angry ? -0.92 : 0.14
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = seated ? -0.15 : stride * 0.72
      rightArmRef.current.rotation.z = angry ? 0.92 : -0.14
    }
    if (leftLegRef.current) leftLegRef.current.rotation.x = seated ? -1.18 : stride
    if (rightLegRef.current) rightLegRef.current.rotation.x = seated ? -1.18 : -stride
  })

  return (
    <group scale={0.98}>
      <mesh position={[0, 1.74, 0]} castShadow>
        <icosahedronGeometry args={[0.25, 1]} />
        <meshStandardMaterial color="#d7a982" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 1.91, -0.03]} castShadow>
        <sphereGeometry args={[0.24, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color="#493e4a" roughness={0.92} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.34, 1.05, 7]} />
        <meshStandardMaterial color="#a65d63" roughness={0.84} flatShading />
      </mesh>
      {/* Shoulders sit outside the torso radius so the arms don't clip the body. */}
      <group ref={leftArmRef} position={[-0.44, 1.44, 0.02]} rotation={[0, 0, 0.14]}>
        <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.075, 0.095, 0.78, 6]} />
          <meshStandardMaterial color="#d7a982" roughness={0.78} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.44, 1.44, 0.02]} rotation={[0, 0, -0.14]}>
        <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.075, 0.095, 0.78, 6]} />
          <meshStandardMaterial color="#d7a982" roughness={0.78} />
        </mesh>
      </group>
      <group ref={leftLegRef} position={[-0.15, 0.62, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.105, 0.82, 6]} />
          <meshStandardMaterial color="#493e4a" roughness={0.78} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.15, 0.62, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.105, 0.82, 6]} />
          <meshStandardMaterial color="#493e4a" roughness={0.78} />
        </mesh>
      </group>
    </group>
  )
}

export default function CafeNarrativeBeatScene({ elapsed, phase }) {
  const rootRef = useRef(null)
  const phaseRef = useRef(phase)
  const phaseElapsedRef = useRef(0)
  const entranceRef = useRef(0)
  const enteredBeatRef = useRef(false)
  const friendPosition = useMemo(() => new THREE.Vector3(), [])
  const cameraTarget = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const smoothedLook = useMemo(() => CAFE_DOOR_LOOK.clone(), [])

  useEffect(() => {
    phaseRef.current = phase
    phaseElapsedRef.current = 0
  }, [phase])

  useFrame(({ camera }, delta) => {
    const currentPhase = phaseRef.current
    if (currentPhase !== CAFE_BEAT_PHASES.INACTIVE) phaseElapsedRef.current += delta

    if (rootRef.current) {
      if (currentPhase === CAFE_BEAT_PHASES.RUPTURE) {
        const standProgress = smoothstep(phaseElapsedRef.current / 0.58)
        rootRef.current.position.lerpVectors(SEATED_POSITION, STANDING_POSITION, standProgress)
        rootRef.current.rotation.y = 0
        rootRef.current.visible = true
      } else if (currentPhase === CAFE_BEAT_PHASES.DEPARTURE) {
        const progress = phaseElapsedRef.current / (CAFE_BEAT_TIMINGS.departureMs / 1000)
        sampleDeparture(progress, friendPosition)
        rootRef.current.position.copy(friendPosition)
        rootRef.current.rotation.y = progress < 0.32 ? -Math.PI / 2 : Math.PI
        rootRef.current.visible = progress < 0.98
      } else if (currentPhase === CAFE_BEAT_PHASES.AFTERMATH
        || currentPhase === CAFE_BEAT_PHASES.CELEBRATION) {
        rootRef.current.visible = false
      } else if (elapsed < MARA_ENTRANCE_START) {
        // Before her cue Mara is off-stage; reset the entrance clock so a
        // restarted run replays the walk-in.
        entranceRef.current = 0
        rootRef.current.visible = false
      } else {
        // Walk to the chair, then lower into the seat.
        entranceRef.current = Math.min(
          entranceRef.current + delta,
          MARA_ENTRANCE_WALK + MARA_ENTRANCE_SIT,
        )
        rootRef.current.visible = true
        const walkProgress = clamp01(entranceRef.current / MARA_ENTRANCE_WALK)
        if (walkProgress < 1) {
          if (walkProgress < MARA_ENTRANCE_LEG1) {
            // Leg one: come up the player's left, alongside the table.
            const legT = smoothstep(walkProgress / MARA_ENTRANCE_LEG1)
            rootRef.current.position.lerpVectors(
              MARA_ENTRANCE_POSITION,
              MARA_ENTRANCE_WAYPOINT,
              legT,
            )
            rootRef.current.rotation.y = MARA_ENTRANCE_HEADING_1
          } else {
            // Leg two: round the far end of the table across to the chair.
            const legT = smoothstep(
              (walkProgress - MARA_ENTRANCE_LEG1) / (1 - MARA_ENTRANCE_LEG1),
            )
            rootRef.current.position.lerpVectors(
              MARA_ENTRANCE_WAYPOINT,
              STANDING_POSITION,
              legT,
            )
            rootRef.current.rotation.y = MARA_ENTRANCE_HEADING_2
          }
        } else {
          const sitProgress = smoothstep(
            clamp01((entranceRef.current - MARA_ENTRANCE_WALK) / MARA_ENTRANCE_SIT),
          )
          rootRef.current.position.lerpVectors(STANDING_POSITION, SEATED_POSITION, sitProgress)
          rootRef.current.rotation.y = THREE.MathUtils.lerp(MARA_ENTRANCE_HEADING_2, 0, sitProgress)
        }
      }
    }

    if (currentPhase === CAFE_BEAT_PHASES.INACTIVE) {
      // Off-stage: the beat camera is dormant, so arm the entry snap for the
      // moment the conversation actually opens.
      enteredBeatRef.current = false
      return
    }

    cameraTarget.copy(CAMERA_POSITION)
    if (currentPhase === CAFE_BEAT_PHASES.DEPARTURE) {
      sampleDeparture(phaseElapsedRef.current / (CAFE_BEAT_TIMINGS.departureMs / 1000), friendPosition)
      lookTarget.copy(friendPosition).add(FACE_OFFSET)
    } else if (currentPhase === CAFE_BEAT_PHASES.AFTERMATH
      || currentPhase === CAFE_BEAT_PHASES.CELEBRATION) {
      lookTarget.copy(CAFE_DOOR_LOOK)
    } else {
      lookTarget.copy(rootRef.current?.position ?? SEATED_POSITION).add(CONVO_FACE_OFFSET)
    }

    if (!enteredBeatRef.current) {
      // First frame of the beat: the smoothed look target has been parked at the
      // café door while the beat was dormant. Snap straight to Mara so the view
      // does not whip across the interior walls as the conversation opens.
      enteredBeatRef.current = true
      camera.position.copy(cameraTarget)
      smoothedLook.copy(lookTarget)
    } else {
      const snap = currentPhase === CAFE_BEAT_PHASES.RUPTURE
      camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * (snap ? 13 : 7)))
      smoothedLook.lerp(lookTarget, 1 - Math.exp(-delta * (snap ? 18 : 8)))
    }
    camera.lookAt(smoothedLook)

    // Screen shake: a violent jolt as Mara stands, then heavy footfalls that
    // rock the room as she stomps out. Applied after lookAt so it translates and
    // rolls the finished view rather than being cancelled by the re-aim.
    const shake = cameraShake(currentPhase, phaseElapsedRef.current)
    if (shake) {
      camera.position.x += shake.x
      camera.position.y += shake.y
      if (shake.roll) camera.rotateZ(shake.roll)
    }

    const lookingAtDoor = currentPhase === CAFE_BEAT_PHASES.AFTERMATH
      || currentPhase === CAFE_BEAT_PHASES.CELEBRATION
    const talking = currentPhase === CAFE_BEAT_PHASES.CONVERSATION
      || currentPhase === CAFE_BEAT_PHASES.INTERLUDE
    // A tighter lens on the seated exchange keeps the empty ceiling out of frame.
    const targetFov = lookingAtDoor ? 61 : talking ? 46 : 57
    const nextFov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-delta * 6))
    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  })

  const walkingIn = phase === CAFE_BEAT_PHASES.INACTIVE
    && elapsed >= MARA_ENTRANCE_START
    && elapsed < MARA_ENTRANCE_START + MARA_ENTRANCE_WALK
  const mode = phase === CAFE_BEAT_PHASES.RUPTURE
    ? 'angry'
    : phase === CAFE_BEAT_PHASES.DEPARTURE || walkingIn
      ? 'walk'
      : 'seated'

  return (
    <group ref={rootRef} position={SEATED_POSITION.toArray()} rotation={[0, 0, 0]}>
      <LowPolyMara mode={mode} />
    </group>
  )
}

// Deterministic per-frame shake offset for the café climax. Returns null when
// the current phase is calm so the camera is left untouched.
function cameraShake(phase, phaseElapsed) {
  if (phase === CAFE_BEAT_PHASES.RUPTURE) {
    const duration = CAFE_BEAT_TIMINGS.ruptureMs / 1000
    const decay = 1 - clamp01(phaseElapsed / duration)
    const amp = 0.13 * decay * decay
    const t = phaseElapsed
    return {
      x: (Math.sin(t * 47) + Math.sin(t * 78) * 0.6) * amp,
      y: (Math.cos(t * 53) + Math.sin(t * 96) * 0.5) * amp,
      roll: Math.sin(t * 41) * 0.022 * decay,
    }
  }
  if (phase === CAFE_BEAT_PHASES.DEPARTURE) {
    const duration = CAFE_BEAT_TIMINGS.departureMs / 1000
    // Footfalls stay heavy while she is close, fading as she reaches the door.
    const fade = 1 - smoothstep(clamp01(phaseElapsed / duration))
    const stomp = Math.pow(Math.abs(Math.sin(phaseElapsed * 9.4)), 6)
    return {
      x: Math.sin(phaseElapsed * 19) * 0.02 * fade * stomp,
      y: -stomp * 0.08 * fade,
      roll: 0,
    }
  }
  return null
}
