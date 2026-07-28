import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

// Lives inside the <Canvas> so it can reach the live WebGL renderer. It hands a
// capture() function back up to <App> through registerCapture. Calling capture()
// copies whatever the renderer last drew into a small JPEG data URL — a cheap
// polaroid-sized thumbnail of the 3D scene at that instant.
//
// The parent's <Canvas> sets preserveDrawingBuffer:true so the last rendered
// frame is still readable when capture() runs (a click handler, an off-render
// tick), rather than being cleared between frames.
const SNAPSHOT_WIDTH = 420

export default function SnapshotCaptureBridge({ registerCapture }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    if (typeof registerCapture !== 'function') return undefined

    const capture = () => {
      try {
        const source = gl?.domElement
        if (!source || !source.width || !source.height) return null

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
  }, [gl, registerCapture])

  return null
}
