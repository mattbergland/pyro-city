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

    const handler = new Cesium.ScreenSpaceEventHandler(director.viewer.scene.canvas)
    handler.setInputAction((evt: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      onMapClick(director, evt.position)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

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

        // Detect seek / restart -> clear active particles, don't retro-fire.
        if (t + 0.001 < lastTime) {
          director.engine.clear()
        } else if (s.isPlaying) {
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

  // Resolve a ground position from the click.
  let cartesian: Cesium.Cartesian3 | undefined
  const ray = viewer.camera.getPickRay(position)
  if (ray) {
    cartesian = viewer.scene.globe.pick(ray, viewer.scene) ?? undefined
  }
  if (!cartesian) {
    cartesian = viewer.camera.pickEllipsoid(position) ?? undefined
  }
  if (!cartesian) return

  const carto = Cesium.Cartographic.fromCartesian(cartesian)
  store.addLaunchSite({
    longitude: Cesium.Math.toDegrees(carto.longitude),
    latitude: Cesium.Math.toDegrees(carto.latitude),
    height: Math.max(0, carto.height),
  })
}
