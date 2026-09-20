import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { Box, Cylinder } from '../world/JourneyScene.jsx'
import {
  morningProjections,
  openMorningSpot,
  setMorningHover,
  useMorningState,
} from './morningStore.js'

// The things in the room, drawn as the things they are.
//
// These used to be flat circles floating over the 3D scene with a line icon in
// them, which told the player there was a hotspot but not what it was. A mug is
// now a mug on the counter, the clothes are folded on the bed, the mirror is
// the mirror that was already above the sink. You click the object itself.
//
// Each model is authored around its own origin so morningSpots.js only has to
// say where the object sits.

function Mug() {
  return (
    <group>
      <Cylinder position={[0, 0.05, 0]} args={[0.075, 0.062, 0.11, 10]} color="#e8ded0" />
      <Cylinder position={[0, 0.105, 0]} args={[0.062, 0.062, 0.012, 10]} color="#6b4a33" castShadow={false} />
      <mesh position={[0.088, 0.055, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <torusGeometry args={[0.042, 0.013, 6, 10]} />
        <meshStandardMaterial color="#e8ded0" roughness={0.8} />
      </mesh>
    </group>
  )
}

function Glass() {
  return (
    <group>
      <Cylinder position={[0, 0.07, 0]} args={[0.055, 0.045, 0.145, 10]} color="#d5e6ea" />
      <Cylinder position={[0, 0.05, 0]} args={[0.047, 0.04, 0.09, 10]} color="#9fc6d6" castShadow={false} />
    </group>
  )
}

function Clothes() {
  return (
    <group rotation={[0, 0.22, 0]}>
      <Box position={[0, 0.035, 0]} size={[0.56, 0.07, 0.42]} color="#6d8a97" />
      <Box position={[0.01, 0.095, -0.01]} size={[0.5, 0.06, 0.37]} color="#c2a074" />
      <Box position={[-0.01, 0.145, 0.01]} size={[0.44, 0.05, 0.33]} color="#8e7d9b" />
    </group>
  )
}

// The window pane is part of the room; this is the openable inner casement the
// player actually reaches for, sat just proud of it.
function WindowLatch() {
  return (
    <group>
      <Box position={[0, 0, 0]} size={[0.07, 0.62, 0.62]} color="#e6d9c4" castShadow={false} />
      <Box position={[0.05, 0, 0]} size={[0.05, 0.5, 0.5]} color="#dbeaf1" opacity={0.7} castShadow={false} />
      <Cylinder position={[0.09, -0.06, -0.24]} args={[0.022, 0.022, 0.16, 6]} rotation={[0, 0, Math.PI / 2]} color="#b59a63" castShadow={false} />
    </group>
  )
}

function Keys() {
  return (
    <group rotation={[0, 0.5, 0]}>
      <mesh position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <torusGeometry args={[0.042, 0.009, 6, 12]} />
        <meshStandardMaterial color="#b9a24d" roughness={0.5} metalness={0.3} />
      </mesh>
      <Box position={[0.09, 0.01, 0.015]} size={[0.13, 0.012, 0.028]} color="#c9b25c" castShadow={false} />
      <Box position={[0.09, 0.01, -0.03]} size={[0.115, 0.012, 0.026]} color="#9aa2ad" castShadow={false} />
      <Box position={[0.145, 0.016, 0.015]} size={[0.03, 0.022, 0.028]} color="#c9b25c" castShadow={false} />
    </group>
  )
}

// A frame drawn around the mirror that is already above the sink, so the
// mirror reads as the thing you can use rather than scenery.
function MirrorFrame() {
  return (
    <group rotation={[0, -Math.PI / 2, 0]}>
      <Box position={[0, 0, -0.03]} size={[1.52, 1.2, 0.06]} color="#7d6a5d" castShadow={false} />
      <Box position={[0, 0, 0.02]} size={[1.36, 1.04, 0.04]} color="#b8cdd2" opacity={0.85} castShadow={false} />
      <Box position={[0, 0.64, -0.02]} size={[1.52, 0.09, 0.08]} color="#8d7868" castShadow={false} />
    </group>
  )
}

function Mat() {
  return (
    <group rotation={[0, 0.18, 0]}>
      <Box position={[0, 0.015, 0]} size={[0.78, 0.03, 1.95]} color="#7b9d86" />
      <Box position={[0, 0.032, -0.82]} size={[0.6, 0.012, 0.22]} color="#94b39e" castShadow={false} />
      <Box position={[0, 0.032, 0.82]} size={[0.6, 0.012, 0.22]} color="#94b39e" castShadow={false} />
    </group>
  )
}

function Clipboard() {
  return (
    <group>
      <Box position={[0, 0, 0]} size={[0.62, 0.84, 0.05]} color="#8b7357" castShadow={false} />
      <Box position={[0, -0.04, 0.04]} size={[0.53, 0.68, 0.02]} color="#f3ead9" castShadow={false} />
      <Box position={[0, 0.37, 0.05]} size={[0.26, 0.09, 0.05]} color="#9aa2ad" castShadow={false} />
      {[0.2, 0.06, -0.08, -0.22].map((y) => (
        <Box key={y} position={[-0.03, y, 0.055]} size={[0.32, 0.03, 0.012]} color="#8f8577" castShadow={false} />
      ))}
    </group>
  )
}

// A mug is a two-centimetre target on screen. Each prop gets an invisible
// proxy around it so the object is as easy to click as it looks, without
// drawing a big box over the room. Kept renderable (zero opacity rather than
// visible={false}) because the raycaster skips invisible objects.
const HIT_SIZES = {
  mug: [0.34, 0.34, 0.34],
  glass: [0.32, 0.36, 0.32],
  keys: [0.42, 0.26, 0.34],
  clothes: [0.68, 0.38, 0.54],
  window: [0.3, 0.95, 0.95],
  mirror: [0.3, 1.25, 1.6],
  mat: [0.95, 0.4, 2.1],
  clipboard: [0.75, 0.95, 0.25],
}

function HitProxy({ model, onOver, onOut, onClick }) {
  const size = HIT_SIZES[model] ?? [0.4, 0.4, 0.4]
  const centre = model === 'mat' ? 0.18 : model === 'clothes' ? 0.12 : 0.06

  return (
    <mesh
      position={[0, centre, 0]}
      scale={size}
      geometry={SHARED_HIT_GEOMETRY}
      onPointerOver={onOver}
      onPointerOut={onOut}
      onClick={onClick}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

const SHARED_HIT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)

const MODELS = {
  mug: Mug,
  glass: Glass,
  clothes: Clothes,
  window: WindowLatch,
  keys: Keys,
  mirror: MirrorFrame,
  mat: Mat,
  clipboard: Clipboard,
}

// A ring on the floor / wall under each object. Subtle when idle, bright on
// hover, so the room does not read as a row of identical buttons but the
// player can still see at a glance what can be touched.
function Halo({ radius, active, done }) {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const pulse = done ? 1 : 1 + Math.sin(clock.elapsedTime * 2.4) * 0.07
    ref.current.scale.setScalar(active ? pulse * 1.18 : pulse)
  })

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <ringGeometry args={[radius * 0.82, radius, 22]} />
      <meshBasicMaterial
        color={done ? '#8fd46a' : active ? '#ffe9a8' : '#ffd166'}
        transparent
        opacity={done ? 0.5 : active ? 0.9 : 0.42}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function Prop({ spot, done, disabled, active }) {
  const Model = MODELS[spot.model] ?? Mug
  const groupRef = useRef(null)
  // Wall-mounted things get no floor ring; it would lie flat in the wall.
  const floorMounted = spot.model !== 'window' && spot.model !== 'mirror' && spot.model !== 'clipboard'

  useFrame(() => {
    if (!groupRef.current) return
    const lift = active && !disabled ? 0.045 : 0
    groupRef.current.position.y += (lift - groupRef.current.position.y) * 0.2
  })

  const enter = useCallback((event) => {
    event.stopPropagation()
    if (disabled) return
    setMorningHover(spot.id)
    document.body.style.cursor = 'pointer'
  }, [disabled, spot.id])

  const leave = useCallback(() => {
    setMorningHover(null)
    document.body.style.cursor = ''
  }, [])

  const click = useCallback((event) => {
    event.stopPropagation()
    if (disabled || done) return
    openMorningSpot(spot.id)
  }, [disabled, done, spot.id])

  return (
    <group position={spot.position}>
      {floorMounted && <Halo radius={spot.model === 'mat' ? 0.62 : 0.2} active={active} done={done} />}
      <group ref={groupRef}>
        <Model />
      </group>
      <HitProxy model={spot.model} onOver={enter} onOut={leave} onClick={click} />
    </group>
  )
}

export default function MorningProps({ spots, disabled = false }) {
  const { camera, size } = useThree()
  const { doneIds, usedIds, hoverId, openId } = useMorningState()
  const vector = useMemo(() => new THREE.Vector3(), [])
  const doneSet = useMemo(() => new Set([...doneIds, ...usedIds]), [doneIds, usedIds])

  // Project every object to screen space so the overlay can hang its label off
  // the real thing. The morning camera is static, so this settles within a few
  // frames and then writes the same numbers; it is eight vector projections a
  // frame either way.
  useFrame(() => {
    for (const spot of spots) {
      vector.set(spot.position[0], spot.position[1], spot.position[2])
      // Labels sit above whatever they name, by however much that thing asks
      // for (see `lift` in morningSpots.js).
      vector.y += spot.lift ?? 0.28
      vector.project(camera)
      morningProjections.set(spot.id, {
        x: (vector.x * 0.5 + 0.5) * size.width,
        y: (-vector.y * 0.5 + 0.5) * size.height,
        visible: vector.z < 1,
      })
    }
  })

  useEffect(() => () => {
    document.body.style.cursor = ''
  }, [])

  return (
    <group>
      {spots.map((spot) => (
        <Prop
          key={spot.id}
          spot={spot}
          done={doneSet.has(spot.id)}
          disabled={disabled || openId !== null}
          active={hoverId === spot.id}
        />
      ))}
    </group>
  )
}
