import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'
import { ShowDirector, cesiumRefs } from '../cesium/director'
import { useShowStore } from '../store/useShowStore'
import { getFireworkById } from '../data/fireworks'

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const directorRef = useRef<ShowDirector | null>(null)

  // --- Mount Cesium once ---
  useEffect(() => {
    if (!containerRef.current) return
    const director = new ShowDirector(containerRef.current)
    directorRef.current = director
    cesiumRefs.director = director

    const viewer = director.viewer
    const ssc = viewer.scene.screenSpaceCameraController
    const canvas = viewer.scene.canvas
    const handler = new Cesium.ScreenSpaceEventHandler(canvas)

    // Click empty ground to place a site, or click a marker to select it.
    handler.setInputAction((evt: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      onMapClick(director, evt.position)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    // --- Drag a launch-site marker to reposition it ---
    // While dragging we freeze the camera and move the picked marker directly,
    // re-anchoring it to the rendered surface under the cursor. The store is
    // updated once on release so we don't rebuild every entity each frame.
    const drag = { id: null as string | null, moved: false }

    handler.setInputAction((evt: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(evt.position)
      const id = picked?.id?.id
      if (typeof id !== 'string') return
      if (!useShowStore.getState().launchSites.some((l) => l.id === id)) return
      drag.id = id
      drag.moved = false
      useShowStore.getState().selectSite(id)
      ssc.enableInputs = false // freeze camera while dragging the marker
      canvas.style.cursor = 'grabbing'
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN)

    handler.setInputAction((evt: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (!drag.id) {
        // Hover feedback: show a grab cursor over draggable markers.
        const picked = viewer.scene.pick(evt.endPosition)
        const overSite =
          typeof picked?.id?.id === 'string' &&
          useShowStore.getState().launchSites.some((l) => l.id === picked.id.id)
        canvas.style.cursor = overSite ? 'grab' : ''
        return
      }
      const cart = pickSurface(viewer, evt.endPosition)
      if (!cart) return
      drag.moved = true
      const entity = viewer.entities.getById(drag.id)
      if (entity) entity.position = new Cesium.ConstantPositionProperty(cart)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction(() => {
      const id = drag.id
      const moved = drag.moved
      drag.id = null
      drag.moved = false
      ssc.enableInputs = true
      canvas.style.cursor = ''
      if (!id || !moved) return
      const entity = viewer.entities.getById(id)
      const pos = entity?.position?.getValue(viewer.clock.currentTime)
      if (!pos) return
      const carto = Cesium.Cartographic.fromCartesian(pos)
      useShowStore.getState().updateLaunchSitePosition(id, {
        longitude: Cesium.Math.toDegrees(carto.longitude),
        latitude: Cesium.Math.toDegrees(carto.latitude),
        height: carto.height,
      })
    }, Cesium.ScreenSpaceEventType.LEFT_UP)

    return () => {
      handler.destroy()
      cesiumRefs.director = null
      director.destroy()
      directorRef.current = null
    }
  }, [])

  // --- Keep launch-site markers in sync with the store ---
  const launchSites = useShowStore((s) => s.launchSites)
  const selectedSiteId = useShowStore((s) => s.selectedSiteId)
  useEffect(() => {
    const director = directorRef.current
    if (!director) return
    const viewer = director.viewer
    viewer.entities.removeAll()
    for (const site of launchSites) {
      const selected = site.id === selectedSiteId
      viewer.entities.add({
        id: site.id,
        position: Cesium.Cartesian3.fromDegrees(site.longitude, site.latitude, site.height),
        point: {
          pixelSize: selected ? 16 : 12,
          color: selected
            ? Cesium.Color.fromCssColorString('#ff8a3e')
            : Cesium.Color.fromCssColorString('#3effe2'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: site.name,
          font: '13px sans-serif',
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#000000').withAlpha(0.6),
          pixelOffset: new Cesium.Cartesian2(0, -24),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    }
  }, [launchSites, selectedSiteId])

  // --- Playback + animation loop ---
  useEffect(() => {
    let raf = 0
    let lastNow = performance.now()
    let lastTime = 0

    const frame = () => {
      const now = performance.now()
      const dt = (now - lastNow) / 1000
      lastNow = now
      const director = directorRef.current
      if (director) {
        const s = useShowStore.getState()
        const t = s.currentTime
        const dur = s.duration || 0

        // The playhead moves for three reasons, which must be told apart:
        //  • normal playback -> forward steps; fire any cues crossed (the range
        //    check below handles big forward gaps too, e.g. a throttled tab
        //    catching up, so cues are never missed).
        //  • seek / restart   -> a jump backwards; drop stale particles and
        //    resync without retro-firing every earlier cue.
        //  • a startup spike  -> some audio backends emit one `timeupdate` at
        //    the track's *duration* on the first play frame before real
        //    playback begins (playhead jumps 0 -> end, then back to 0). That
        //    spike must NOT fire the whole show at once, so it is ignored.
        const isEndSpike = dur > 0 && t >= dur - 0.05 && lastTime < dur - 1
        if (t + 0.001 < lastTime) {
          // Scrubbed backwards / restarted.
          director.engine.clear()
        } else if (s.isPlaying && !isEndSpike) {
          // Fire any cues crossed since the last frame.
          for (const cue of s.cues) {
            if (cue.time > lastTime && cue.time <= t) {
              const type = getFireworkById(cue.fireworkTypeId)
              const site = s.launchSites.find((l) => l.id === cue.launchSiteId)
              if (type && site) {
                director.fireBurst(site, type, cue.colorOverride ?? type.colors[0])
              }
            }
          }
        }
        lastTime = t

        const focusSite =
          s.launchSites.find((l) => l.id === s.selectedSiteId) ?? s.launchSites[0]
        director.tick(dt, s.cinematic && s.isPlaying, focusSite
          ? { lon: focusSite.longitude, lat: focusSite.latitude, height: focusSite.height + 60 }
          : undefined)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <div ref={containerRef} className="cesium-container" />
}

/** Handle a click on the globe: place a new launch site or select one. */
function onMapClick(director: ShowDirector, position: Cesium.Cartesian2) {
  const viewer = director.viewer
  const store = useShowStore.getState()

  // If clicking an existing site marker, select it.
  const picked = viewer.scene.pick(position)
  if (picked && picked.id && typeof picked.id.id === 'string') {
    store.selectSite(picked.id.id)
    return
  }

  if (!store.placingSite) return

  const cartesian = pickSurface(viewer, position)
  if (!cartesian) return

  // Use the exact surface height returned by the pick so the marker rests on
  // the 3D model where it was clicked (ground, rooftop, stands, etc.). Do NOT
  // clamp to 0 — over photoreal tiles the ground's ellipsoidal height can be
  // negative (geoid offset), and clamping would float the marker in mid-air.
  const carto = Cesium.Cartographic.fromCartesian(cartesian)
  store.addLaunchSite({
    longitude: Cesium.Math.toDegrees(carto.longitude),
    latitude: Cesium.Math.toDegrees(carto.latitude),
    height: carto.height,
  })
}

/**
 * Resolve a world position on the rendered surface under a screen point.
 * Prefers the rendered surface (works for both photoreal 3D Tiles and the
 * terrain globe), then falls back to the terrain ray pick, then the ellipsoid.
 */
function pickSurface(
  viewer: Cesium.Viewer,
  position: Cesium.Cartesian2,
): Cesium.Cartesian3 | undefined {
  let cartesian: Cesium.Cartesian3 | undefined
  if (viewer.scene.pickPositionSupported) {
    cartesian = viewer.scene.pickPosition(position) ?? undefined
  }
  if (!cartesian) {
    const ray = viewer.camera.getPickRay(position)
    if (ray) cartesian = viewer.scene.globe.pick(ray, viewer.scene) ?? undefined
  }
  if (!cartesian) {
    cartesian = viewer.camera.pickEllipsoid(position) ?? undefined
  }
  return cartesian
}
