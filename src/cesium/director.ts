import * as Cesium from 'cesium'
import { FireworkEngine } from './fireworkEngine'
import type { FireworkType, LaunchSite } from '../types'

/**
 * Wraps a Cesium Viewer and owns the firework engine + camera behaviour.
 * A single instance lives for the lifetime of the map and is shared with the
 * playback loop via {@link cesiumRefs}.
 */
export class ShowDirector {
  readonly viewer: Cesium.Viewer
  readonly engine: FireworkEngine
  private orbitAngle = 0

  constructor(container: HTMLElement) {
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined
    const hasIon = !!ionToken && ionToken.length > 0
    if (hasIon) {
      Cesium.Ion.defaultAccessToken = ionToken!
    }

    // Free, no-token base imagery from OpenStreetMap. Upgraded to richer
    // satellite imagery + terrain when a Cesium ion token is supplied.
    const viewer = new Cesium.Viewer(container, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      ...(hasIon
        ? {}
        : {
            baseLayer: Cesium.ImageryLayer.fromProviderAsync(
              Promise.resolve(
                new Cesium.OpenStreetMapImageryProvider({
                  url: 'https://tile.openstreetmap.org/',
                }),
              ),
              {},
            ),
          }),
    })
    this.viewer = viewer

    // Keep the ground fully lit (flat shading) so it's easy to see where you
    // are placing launch sites, but hide the daytime atmosphere so the sky
    // reads as night (Cesium's starfield shows through).
    viewer.scene.globe.enableLighting = false
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false
    viewer.scene.fog.enabled = false

    // Night-time look so fireworks pop.
    this.applyNightSky()

    // Google-Earth-style navigation (these are Cesium defaults, set
    // explicitly so the feel is guaranteed).
    const ctrl = viewer.scene.screenSpaceCameraController
    ctrl.enableRotate = true
    ctrl.enableTranslate = true
    ctrl.enableZoom = true
    ctrl.enableTilt = true
    ctrl.enableLook = true

    if (hasIon) {
      this.loadIonAssets()
    }

    this.engine = new FireworkEngine(viewer.scene)

    if (import.meta.env.DEV) {
      ;(window as unknown as { pyroDirector: ShowDirector }).pyroDirector = this
    }

    // Default view over San Francisco so the app isn't staring at blank ocean.
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-122.4194, 37.7649, 1800),
      orientation: {
        heading: Cesium.Math.toRadians(20),
        pitch: Cesium.Math.toRadians(-35),
      },
    })
  }

  private async loadIonAssets() {
    try {
      this.viewer.scene.setTerrain(
        new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromIonAssetId(1)),
      )
      const buildings = await Cesium.createOsmBuildingsAsync()
      this.viewer.scene.primitives.add(buildings)
    } catch (err) {
      // Non-fatal: app still works on the ellipsoid without terrain/buildings.
      console.warn('Cesium ion assets unavailable, continuing without them.', err)
    }
  }

  /** Dark sky so the show reads as a night display while the ground stays lit. */
  private applyNightSky() {
    const scene = this.viewer.scene
    // A clean, deep-night sky: hide daytime sky elements and paint the
    // background dark so fireworks read against it.
    scene.backgroundColor = Cesium.Color.fromCssColorString('#05070f')
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false
    if (scene.skyBox) scene.skyBox.show = false
    if (scene.sun) scene.sun.show = false
    if (scene.moon) scene.moon.show = false
    scene.globe.showGroundAtmosphere = false
    if (scene.globe) {
      scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a0d17')
    }
  }

  /**
   * Frame a bounding sphere from an oblique angle that leaves the airspace
   * above the target in view (so fireworks bursting overhead are visible).
   */
  private frameSphere(sphere: Cesium.BoundingSphere, duration: number) {
    this.viewer.camera.flyToBoundingSphere(sphere, {
      duration,
      offset: new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(20),
        Cesium.Math.toRadians(-25),
        sphere.radius * 3.2,
      ),
    })
  }

  /**
   * Smoothly fly the camera to a location, framed so there's sky above the
   * point (used after address search and the "fly here" site button). The
   * `height` argument is treated as a zoom hint controlling how wide the shot
   * is rather than a literal camera altitude.
   */
  flyTo(longitude: number, latitude: number, height = 1500) {
    const center = Cesium.Cartesian3.fromDegrees(longitude, latitude, 160)
    const radius = Math.max(height * 0.5, 400)
    this.frameSphere(new Cesium.BoundingSphere(center, radius), 2.0)
  }

  /**
   * Frame the whole show: all launch sites plus the airspace above them where
   * the breaks happen. Called when playback starts (outside cinematic mode) so
   * the user always sees the fireworks go off.
   */
  frameShow(sites: LaunchSite[], duration = 1.4) {
    if (sites.length === 0) return
    const points = sites.map((s) =>
      Cesium.Cartesian3.fromDegrees(s.longitude, s.latitude, s.height + 200),
    )
    const sphere = Cesium.BoundingSphere.fromPoints(points)
    sphere.radius = Math.max(sphere.radius + 250, 500)
    this.frameSphere(sphere, duration)
  }

  /** World (ECEF) position of a firework break above a launch site. */
  burstPosition(site: LaunchSite, type: FireworkType): Cesium.Cartesian3 {
    return Cesium.Cartesian3.fromDegrees(
      site.longitude,
      site.latitude,
      site.height + type.burstAltitude,
    )
  }

  fireBurst(site: LaunchSite, type: FireworkType, colorHex: string) {
    this.engine.burst(this.burstPosition(site, type), type, colorHex)
  }

  /** Advance one frame. `dt` seconds. Handles cinematic orbit. */
  tick(
    dt: number,
    cinematic: boolean,
    focus?: { lon: number; lat: number; height: number; radius?: number },
  ) {
    this.engine.update(dt)
    if (cinematic && focus) {
      this.orbitAngle += dt * 6 // degrees per second
      const center = Cesium.Cartesian3.fromDegrees(focus.lon, focus.lat, focus.height)
      const range = Math.max((focus.radius ?? 0) * 2.4, 900)
      this.viewer.camera.lookAt(
        center,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(this.orbitAngle),
          Cesium.Math.toRadians(-18),
          range,
        ),
      )
    } else {
      // Release any lookAt transform so manual navigation works again.
      this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    }
  }

  destroy() {
    this.engine.destroy()
    if (!this.viewer.isDestroyed()) {
      this.viewer.destroy()
    }
  }
}

/** Shared reference so the timeline / playback loop can reach the director. */
export const cesiumRefs: { director: ShowDirector | null } = { director: null }
