import * as Cesium from 'cesium'
import type { FireworkType } from '../types'

/**
 * A GPU-rendered firework particle engine for Cesium.
 *
 * Each firework "break" spawns hundreds of star particles. We simulate the
 * physics in a local East-North-Up (ENU) frame centred on the burst point
 * (so "up" is always away from the ground) and convert to world coordinates
 * each frame. This keeps the maths simple and works anywhere on the globe.
 */

interface Particle {
  point: Cesium.PointPrimitive
  // Local ENU position (metres) relative to the burst origin frame.
  px: number
  py: number
  pz: number
  // Local ENU velocity (metres/second).
  vx: number
  vy: number
  vz: number
  age: number
  life: number
  baseColor: Cesium.Color
  size: number
  drag: number
  gravity: number
  twinkle: number // 0..1 amount of flicker
  trail: boolean // emit fading embers behind the star
  trailTimer: number
  canSplit: boolean // crossette children
  splitAt: number // age at which to split
}

// The ENU->ECEF transform for the frame a group of particles lives in.
interface Frame {
  matrix: Cesium.Matrix4
}

const GLOBAL_PARTICLE_CAP = 12000

export class FireworkEngine {
  private scene: Cesium.Scene
  private collection: Cesium.PointPrimitiveCollection
  private particles: Particle[] = []
  // Particles are grouped per-frame so we can reuse the ENU transform.
  private frameOf = new WeakMap<Particle, Frame>()
  private scratchLocal = new Cesium.Cartesian3()
  private scratchWorld = new Cesium.Cartesian3()

  constructor(scene: Cesium.Scene) {
    this.scene = scene
    this.collection = new Cesium.PointPrimitiveCollection()
    // Additive blending makes overlapping sparks glow like real fire.
    this.collection.blendOption = Cesium.BlendOption.TRANSLUCENT
    scene.primitives.add(this.collection)
  }

  destroy() {
    if (!this.collection.isDestroyed()) {
      this.scene.primitives.remove(this.collection)
    }
    this.particles = []
  }

  /** Remove every active particle (used when resetting / seeking). */
  clear() {
    this.collection.removeAll()
    this.particles = []
  }

  get activeCount() {
    return this.particles.length
  }

  /**
   * Trigger a firework break at the given world position.
   * @param worldOrigin ECEF position of the burst centre.
   * @param type firework definition controlling the look.
   * @param colorHex resolved color for this shot.
   */
  burst(worldOrigin: Cesium.Cartesian3, type: FireworkType, colorHex: string) {
    const frame: Frame = {
      matrix: Cesium.Transforms.eastNorthUpToFixedFrame(worldOrigin),
    }
    const color = Cesium.Color.fromCssColorString(colorHex)

    // A bright flash at the burst point.
    this.spawnFlash(frame, color)

    const count = type.starCount
    const radius = type.breakSize / 2

    for (let i = 0; i < count; i++) {
      const dir = this.directionForShape(type, i, count)
      // Speed so that stars roughly reach `radius` over their lifetime.
      const speed = (radius / type.duration) * (1.6 + Math.random() * 0.5)
      const p = this.makeParticle(frame, type, color)
      p.vx = dir.x * speed
      p.vy = dir.y * speed
      p.vz = dir.z * speed
      this.pushParticle(p, frame)
    }
  }

  private spawnFlash(frame: Frame, color: Cesium.Color) {
    const flash = this.collection.add({
      position: Cesium.Matrix4.getTranslation(frame.matrix, new Cesium.Cartesian3()),
      pixelSize: 26,
      color: Cesium.Color.WHITE.withAlpha(0.95),
    })
    const p: Particle = {
      point: flash,
      px: 0, py: 0, pz: 0,
      vx: 0, vy: 0, vz: 0,
      age: 0, life: 0.18,
      baseColor: Cesium.Color.lerp(color, Cesium.Color.WHITE, 0.7, new Cesium.Color()),
      size: 26, drag: 0, gravity: 0, twinkle: 0,
      trail: false, trailTimer: 0, canSplit: false, splitAt: 0,
    }
    this.pushParticle(p, frame)
  }

  private makeParticle(
    frame: Frame,
    type: FireworkType,
    color: Cesium.Color,
  ): Particle {
    const jitter = 0.85 + Math.random() * 0.3
    let life = type.duration * jitter
    let size = 3 + Math.random() * 2
    let drag = 0.6
    let gravity = 4.5
    let twinkle = 0
    let trail = false
    let canSplit = false

    switch (type.shape) {
      case 'willow':
        gravity = 7.5
        drag = 0.35
        life *= 1.1
        trail = true
        size = 2.5 + Math.random() * 1.5
        break
      case 'chrysanthemum':
        gravity = 5
        drag = 0.5
        trail = true
        break
      case 'palm':
        gravity = 6
        drag = 0.45
        size = 4 + Math.random() * 2
        trail = true
        break
      case 'strobe':
        twinkle = 0.9
        gravity = 4
        size = 4 + Math.random() * 2
        break
      case 'crackle':
        twinkle = 0.8
        gravity = 5
        life *= 0.8
        size = 3 + Math.random() * 1.5
        break
      case 'comet':
        gravity = 3
        drag = 0.3
        trail = true
        size = 5 + Math.random() * 2
        break
      case 'crossette':
        canSplit = true
        drag = 0.4
        gravity = 4
        size = 4 + Math.random() * 2
        break
      case 'ring':
        gravity = 3
        drag = 0.5
        break
      case 'heart':
        gravity = 3.5
        drag = 0.5
        break
      case 'peony':
      default:
        break
    }

    // Slight color variation per star for richness.
    const c = color.clone()
    const point = this.collection.add({
      position: Cesium.Matrix4.getTranslation(frame.matrix, new Cesium.Cartesian3()),
      pixelSize: size,
      color: c,
    })

    return {
      point,
      px: 0, py: 0, pz: 0,
      vx: 0, vy: 0, vz: 0,
      age: 0, life,
      baseColor: c, size, drag, gravity, twinkle,
      trail, trailTimer: 0,
      canSplit, splitAt: life * 0.45,
    }
  }

  /** Unit direction (local ENU) for star `index` based on the shape. */
  private directionForShape(type: FireworkType, index: number, count: number) {
    switch (type.shape) {
      case 'ring': {
        // Flat horizontal ring (in the East-North plane).
        const a = (index / count) * Math.PI * 2
        return { x: Math.cos(a), y: Math.sin(a), z: (Math.random() - 0.5) * 0.08 }
      }
      case 'palm': {
        // Upward cone forming fronds.
        const a = (index / count) * Math.PI * 2
        const tilt = 0.25 + Math.random() * 0.35
        return normalize(Math.cos(a) * tilt, Math.sin(a) * tilt, 1)
      }
      case 'comet': {
        // Mostly straight up with a tiny spread.
        return normalize((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, 1)
      }
      case 'heart': {
        // Parametric heart curve in the East(x)-Up(z) vertical plane.
        const t = (index / count) * Math.PI * 2
        const hx = 16 * Math.pow(Math.sin(t), 3)
        const hz =
          13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
        return normalize(hx / 16, (Math.random() - 0.5) * 0.15, hz / 16)
      }
      case 'crossette': {
        // A handful of stars spread fairly wide.
        return randomSphere()
      }
      default:
        // Uniform sphere (peony, chrysanthemum, willow, strobe, crackle).
        return randomSphere()
    }
  }

  private pushParticle(p: Particle, frame: Frame) {
    this.frameOf.set(p, frame)
    this.particles.push(p)
  }

  /** Advance the simulation by `dt` seconds. */
  update(dt: number) {
    // Clamp dt to avoid huge jumps when the tab was backgrounded.
    if (dt > 0.1) dt = 0.1

    const survivors: Particle[] = []
    const toSpawn: { frame: Frame; particle: Particle }[] = []

    for (const p of this.particles) {
      p.age += dt
      if (p.age >= p.life) {
        this.collection.remove(p.point)
        continue
      }

      // Integrate velocity (gravity pulls along local -up = -z).
      p.vz -= p.gravity * dt
      const dragFactor = 1 - p.drag * dt
      p.vx *= dragFactor
      p.vy *= dragFactor
      p.vz *= dragFactor

      p.px += p.vx * dt
      p.py += p.vy * dt
      p.pz += p.vz * dt

      // Crossette: split into 4 child stars partway through life.
      if (p.canSplit && p.age >= p.splitAt) {
        p.canSplit = false
        const frame = this.frameOf.get(p)
        if (frame && this.particles.length < GLOBAL_PARTICLE_CAP) {
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2
            const child = this.makeSimpleStar(p)
            child.vx = p.vx * 0.4 + Math.cos(a) * 14
            child.vy = p.vy * 0.4 + Math.sin(a) * 14
            child.vz = p.vz * 0.4
            toSpawn.push({ frame, particle: child })
          }
        }
      }

      // Trails: emit a slow fading ember behind moving stars.
      if (p.trail) {
        p.trailTimer -= dt
        if (p.trailTimer <= 0 && this.particles.length < GLOBAL_PARTICLE_CAP) {
          p.trailTimer = 0.05
          const frame = this.frameOf.get(p)
          if (frame) {
            const ember = this.makeEmber(p)
            toSpawn.push({ frame, particle: ember })
          }
        }
      }

      // Convert local position -> world and update the point.
      const frame = this.frameOf.get(p)!
      Cesium.Cartesian3.fromElements(p.px, p.py, p.pz, this.scratchLocal)
      Cesium.Matrix4.multiplyByPoint(frame.matrix, this.scratchLocal, this.scratchWorld)
      p.point.position = Cesium.Cartesian3.clone(this.scratchWorld, p.point.position)

      // Fade + twinkle.
      const lifeFrac = p.age / p.life
      let alpha = 1 - lifeFrac * lifeFrac
      if (p.twinkle > 0) {
        const flicker = Math.random() < p.twinkle * 0.5 ? 0.2 : 1
        alpha *= flicker
      }
      p.point.color = p.baseColor.withAlpha(Math.max(0, alpha))
      p.point.pixelSize = p.size * (0.5 + 0.5 * (1 - lifeFrac))

      survivors.push(p)
    }

    for (const s of toSpawn) {
      this.pushParticle(s.particle, s.frame)
      survivors.push(s.particle)
    }

    this.particles = survivors
  }

  private makeSimpleStar(parent: Particle): Particle {
    const point = this.collection.add({
      position: Cesium.Cartesian3.clone(parent.point.position),
      pixelSize: parent.size,
      color: parent.baseColor,
    })
    return {
      point,
      px: parent.px, py: parent.py, pz: parent.pz,
      vx: 0, vy: 0, vz: 0,
      age: 0, life: parent.life - parent.age,
      baseColor: parent.baseColor, size: parent.size,
      drag: parent.drag, gravity: parent.gravity, twinkle: parent.twinkle,
      trail: false, trailTimer: 0, canSplit: false, splitAt: 0,
    }
  }

  private makeEmber(parent: Particle): Particle {
    const dim = Cesium.Color.lerp(
      parent.baseColor,
      Cesium.Color.fromCssColorString('#ff7a1a'),
      0.4,
      new Cesium.Color(),
    )
    const point = this.collection.add({
      position: Cesium.Cartesian3.clone(parent.point.position),
      pixelSize: parent.size * 0.7,
      color: dim,
    })
    return {
      point,
      px: parent.px, py: parent.py, pz: parent.pz,
      vx: parent.vx * 0.2, vy: parent.vy * 0.2, vz: parent.vz * 0.2,
      age: 0, life: 0.5 + Math.random() * 0.3,
      baseColor: dim, size: parent.size * 0.7,
      drag: 0.8, gravity: parent.gravity * 0.6, twinkle: 0,
      trail: false, trailTimer: 0, canSplit: false, splitAt: 0,
    }
  }
}

// --- helpers ---
function randomSphere() {
  // Uniform point on a unit sphere.
  const u = Math.random()
  const v = Math.random()
  const theta = 2 * Math.PI * u
  const phi = Math.acos(2 * v - 1)
  const s = Math.sin(phi)
  return { x: s * Math.cos(theta), y: s * Math.sin(theta), z: Math.cos(phi) }
}

function normalize(x: number, y: number, z: number) {
  const len = Math.hypot(x, y, z) || 1
  return { x: x / len, y: y / len, z: z / len }
}
