import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

// Lives inside the <Canvas> so it can reach the live WebGL renderer. It hands a
// capture() function back up to <App> through registerCapture. Calling capture()
// copies the 3D scene into a small JPEG data URL — a cheap polaroid-sized
// thumbnail of the scene at that instant.
//
// Rather than force the <Canvas> to keep every frame around with
// preserveDrawingBuffer:true (a per-frame cost on every browser, and one that
// blocks some compositor fast-paths), capture() renders one fresh frame on
// demand and reads it back synchronously in the same tick — so the drawing
// buffer is guaranteed populated exactly when we sample it.
const SNAPSHOT_WIDTH = 420

export default function SnapshotCaptureBridge({ registerCapture }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    if (typeof registerCapture !== 'function') return undefined

    const capture = () => {
      try {
        const source = gl?.domElement
        if (!source || !source.width || !source.height) return null

        // Draw one up-to-date frame, then read it back immediately (before the
        // browser can clear the buffer). This keeps snapshots reliable without
        // preserveDrawingBuffer.
        if (scene && camera) gl.render(scene, camera)

        const scale = SNAPSHOT_WIDTH / source.width
        const targetWidth = SNAPSHOT_WIDTH
        const targetHeight = Math.max(1, Math.round(source.height * scale))

        const off = document.createElement('canvas')
        off.width = targetWidth
        off.height = targetHeight
        const ctx = off.getContext('2d')
        if (!ctx) return null

        ctx.drawImage(source, 0, 0, targetWidth, targetHeight)
        return off.toDataURL('image/jpeg', 0.72)
      } catch {
        // A tainted or lost context just means no snapshot this time.
        return null
      }
    }

    registerCapture(capture)
    return () => registerCapture(null)
  }, [gl, scene, camera, registerCapture])

  return null
}
