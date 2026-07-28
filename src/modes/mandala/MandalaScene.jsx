import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

import { MANDALA_CONFIG, mandalaAxisAt } from './mandalaConfig.js'
import MandalaTube from './MandalaTube.jsx'
import MandalaEncounter from './MandalaEncounter.jsx'

// Runs the simulation each frame (single source of advance), flies the camera
// down the tube, and keeps the mounted encounter list in step with the run.
function MandalaStepper({ runRef, step, inputsRef, onOverload, onEncountersChanged, config }) {
  const camera = useThree((state) => state.camera)
  const idsRef = useRef('')
  const syncClockRef = useRef(0)
  const rollRef = useRef(0)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const inputs = inputsRef.current
    const run = step(delta, {
      diving: inputs.diveEnabled && inputs.forwardHeld,
      capacity: inputs.capacity,
      onOverload,
    })
    if (!run) return

    // Fly the camera along the tube axis, looking down the curve ahead.
    const here = mandalaAxisAt(run.travelDistance, config)
    const ahead = mandalaAxisAt(run.travelDistance + 14, config)
    camera.position.set(here.x * 0.35, here.y * 0.35, 0)
    camera.up.set(0, 1, 0)
    camera.lookAt(ahead.x, ahead.y, -14)
    rollRef.current = Math.sin(run.travelDistance * config.UNDULATION_FREQ * 1.3) * 0.12
    camera.rotation.z += rollRef.current

    // Sync the mounted encounter ids a few times a second (not every frame).
    syncClockRef.current += delta
    if (syncClockRef.current >= 1 / 12) {
      syncClockRef.current = 0
      const ids = run.encounters.map((encounter) => encounter.id).join('|')
      if (ids !== idsRef.current) {
        idsRef.current = ids
        onEncountersChanged(run.encounters.map((encounter) => encounter.id))
      }
    }
  })

  return null
}

export default function MandalaScene({
  runRef,
  step,
  registryRef,
  inputsRef,
  onOverload,
  config = MANDALA_CONFIG,
}) {
  const [encounterIds, setEncounterIds] = useState([])

  // Encounters mount/unmount from this id list; each reads its live transform
  // from runRef every frame, so motion stays frame-exact between syncs.
  const encounters = useMemo(
    () => encounterIds.map((id) => <MandalaEncounter key={id} id={id} runRef={runRef} registryRef={registryRef} config={config} />),
    [encounterIds, runRef, registryRef, config],
  )

  // color/fog must attach at the scene root, so they are top-level here (not
  // wrapped in a group) — MandalaScene is a direct child of the Canvas.
  return (
    <>
      <color attach="background" args={['#0d0a14']} />
      <fog attach="fog" args={['#0d0a14', 12, 62]} />
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 0, 2]} intensity={2.4} distance={40} color="#ffd9a0" />
      <MandalaStepper
        runRef={runRef}
        step={step}
        inputsRef={inputsRef}
        onOverload={onOverload}
        onEncountersChanged={setEncounterIds}
        config={config}
      />
      <MandalaTube runRef={runRef} config={config} />
      {encounters}
    </>
  )
}
