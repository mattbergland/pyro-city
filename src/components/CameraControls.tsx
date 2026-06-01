import { useEffect, useRef } from 'react'
import { cesiumRefs } from '../cesium/director'

/**
 * On-screen camera pad for trackpads / touchscreens that have no middle- or
 * right-mouse button. Each button nudges the view a little per press and, when
 * held down, repeats so the motion is smooth — like Google Earth's controls.
 */
export default function CameraControls() {
  // The action to repeat while a button is held (null when nothing is held).
  const actionRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => actionRef.current?.(), 60)
    const release = () => {
      actionRef.current = null
    }
    window.addEventListener('pointerup', release)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('pointerup', release)
    }
  }, [])

  const d = () => cesiumRefs.director

  const orbitLeft = () => d()?.orbit(-3, 0)
  const orbitRight = () => d()?.orbit(3, 0)
  const tiltUp = () => d()?.orbit(0, 3)
  const tiltDown = () => d()?.orbit(0, -3)
  const zoomIn = () => d()?.zoomByFactor(0.9)
  const zoomOut = () => d()?.zoomByFactor(1.1)
  const reset = () => d()?.resetView()

  return (
    <div className="camera-controls">
      <div className="cam-pad">
        <button
          className="cam-btn cam-up"
          title="Tilt up"
          onPointerDown={(e) => {
            e.preventDefault()
            tiltUp()
            actionRef.current = tiltUp
          }}
        >
          ▲
        </button>
        <button
          className="cam-btn cam-left"
          title="Orbit left"
          onPointerDown={(e) => {
            e.preventDefault()
            orbitLeft()
            actionRef.current = orbitLeft
          }}
        >
          ◀
        </button>
        <button className="cam-btn cam-reset" title="Reset view" onClick={reset}>
          ⟲
        </button>
        <button
          className="cam-btn cam-right"
          title="Orbit right"
          onPointerDown={(e) => {
            e.preventDefault()
            orbitRight()
            actionRef.current = orbitRight
          }}
        >
          ▶
        </button>
        <button
          className="cam-btn cam-down"
          title="Tilt down"
          onPointerDown={(e) => {
            e.preventDefault()
            tiltDown()
            actionRef.current = tiltDown
          }}
        >
          ▼
        </button>
      </div>
      <div className="cam-zoom">
        <button
          className="cam-btn"
          title="Zoom in"
          onPointerDown={(e) => {
            e.preventDefault()
            zoomIn()
            actionRef.current = zoomIn
          }}
        >
          ＋
        </button>
        <button
          className="cam-btn"
          title="Zoom out"
          onPointerDown={(e) => {
            e.preventDefault()
            zoomOut()
            actionRef.current = zoomOut
          }}
        >
          －
        </button>
      </div>
    </div>
  )
}
