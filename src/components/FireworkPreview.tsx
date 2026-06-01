import { useEffect, useRef } from 'react'
import type { FireworkType } from '../types'

/**
 * A tiny self-contained 2D canvas that loops a stylised animation of a
 * firework break — like a GIF thumbnail, but sharp and light. The motion
 * mirrors the real 3D engine: spherical peonies, drooping willows, upward palm
 * fronds, expanding rings, splitting crossettes, twinkling strobes, etc.
 */

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  color: string
  twinkle: boolean
  split: number // age at which a crossette star splits; 0 = never
}

const SIZE = 56 // device-independent px; canvas is scaled for crispness

export default function FireworkPreview({ fw }: { fw: FireworkType }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const ox = SIZE / 2
    const oy = SIZE * 0.46
    let sparks: Spark[] = []
    let raf = 0
    let last = performance.now()
    // Random phase so the 21 cards don't all flash (and go dark) in unison.
    let sinceBurst = Math.random() * 2.2

    const colors = fw.colors.length ? fw.colors : ['#ffffff']
    const pick = () => colors[(Math.random() * colors.length) | 0]

    function spawnBurst() {
      sparks = []
      const trail = ['chrysanthemum', 'willow', 'palm', 'comet'].includes(fw.shape)
      const count =
        fw.shape === 'comet' ? 1 : fw.shape === 'crossette' ? 8 : fw.shape === 'ring' ? 30 : 34
      const base = 16 // px/s spread speed

      for (let i = 0; i < count; i++) {
        let vx: number
        let vy: number
        let speed = base * (0.85 + Math.random() * 0.4)
        switch (fw.shape) {
          case 'ring': {
            const a = (i / count) * Math.PI * 2
            speed = base // uniform => clean circle
            vx = Math.cos(a) * speed
            vy = Math.sin(a) * speed
            break
          }
          case 'palm': {
            // Upward fan of fronds.
            const a = -Math.PI / 2 + (i / count - 0.5) * 1.7
            vx = Math.cos(a) * speed
            vy = Math.sin(a) * speed
            break
          }
          case 'comet': {
            vx = (Math.random() - 0.5) * 3
            vy = -base * 1.4
            break
          }
          case 'heart': {
            const t = (i / count) * Math.PI * 2
            const hx = 16 * Math.pow(Math.sin(t), 3)
            const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
            const m = base / 16
            vx = hx * m
            vy = hy * m
            break
          }
          default: {
            // Spherical break projected to 2D (peony, chrysanthemum, willow,
            // strobe, crackle, crossette).
            const a = Math.random() * Math.PI * 2
            vx = Math.cos(a) * speed
            vy = Math.sin(a) * speed
          }
        }

        const twinkle = fw.shape === 'strobe' || fw.shape === 'crackle'
        const split = fw.shape === 'crossette' ? 0.5 + Math.random() * 0.15 : 0
        sparks.push({
          x: ox,
          y: oy,
          vx,
          vy,
          age: 0,
          life: trail ? 1.5 : 1.2,
          size: fw.shape === 'comet' || fw.shape === 'palm' ? 2.4 : 1.8,
          color: pick(),
          twinkle,
          split,
        })
      }
    }

    function gravityFor(): number {
      switch (fw.shape) {
        case 'willow':
          return 34
        case 'comet':
          return 14
        case 'ring':
        case 'heart':
          return 12
        default:
          return 22
      }
    }

    const g = gravityFor()
    const drag = fw.shape === 'comet' ? 0.2 : 0.5

    function step(dt: number) {
      const survivors: Spark[] = []
      const children: Spark[] = []
      for (const s of sparks) {
        s.age += dt
        if (s.age >= s.life) continue
        s.vy += g * dt
        const df = 1 - drag * dt
        s.vx *= df
        s.vy *= df
        s.x += s.vx * dt
        s.y += s.vy * dt
        if (s.split && s.age >= s.split) {
          const wasSplit = s.split
          s.split = 0
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2
            children.push({
              x: s.x,
              y: s.y,
              vx: s.vx * 0.3 + Math.cos(a) * 14,
              vy: s.vy * 0.3 + Math.sin(a) * 14,
              age: 0,
              life: s.life - wasSplit,
              size: 1.6,
              color: s.color,
              twinkle: false,
              split: 0,
            })
          }
        }
        survivors.push(s)
      }
      sparks = survivors.concat(children)
    }

    function draw() {
      if (!ctx) return
      // Translucent clear leaves fading streaks => natural spark trails.
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(5, 7, 15, 0.28)'
      ctx.fillRect(0, 0, SIZE, SIZE)

      ctx.globalCompositeOperation = 'lighter'
      for (const s of sparks) {
        const t = s.age / s.life
        let alpha = 1 - t
        if (s.twinkle) alpha *= Math.random() > 0.5 ? 1 : 0.25
        ctx.globalAlpha = Math.max(0, alpha)
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    function frame(now: number) {
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05
      sinceBurst += dt
      if (sinceBurst > 2.2) {
        spawnBurst()
        sinceBurst = 0
      }
      step(dt)
      draw()
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [fw])

  return <canvas ref={canvasRef} className="fw-preview" style={{ width: SIZE, height: SIZE }} />
}
