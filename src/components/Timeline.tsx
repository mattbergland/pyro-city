import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useShowStore } from '../store/useShowStore'
import { audioRefs } from '../audio/audioRefs'
import { getFireworkById, FIREWORK_LIBRARY } from '../data/fireworks'
import { decodeAudio, estimateBpm } from '../audio/bpm'
import type { Cue, LaunchSite } from '../types'

const DEFAULT_DURATION = 60 // seconds, used when no audio is loaded
const MAX_ZOOM = 24

function fmt(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const ms = Math.floor((t % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

export default function Timeline() {
  const waveRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const syntheticRaf = useRef<number>(0)
  const tapTimes = useRef<number[]>([])

  const audioUrl = useShowStore((s) => s.audioUrl)
  const duration = useShowStore((s) => s.duration)
  const currentTime = useShowStore((s) => s.currentTime)
  const isPlaying = useShowStore((s) => s.isPlaying)
  const cues = useShowStore((s) => s.cues)
  const launchSites = useShowStore((s) => s.launchSites)
  const bpm = useShowStore((s) => s.bpm)
  const beatOffset = useShowStore((s) => s.beatOffset)
  const snapToBeat = useShowStore((s) => s.snapToBeat)
  const autoAdvance = useShowStore((s) => s.autoAdvance)
  const selectedCueId = useShowStore((s) => s.selectedCueId)
  const selectCue = useShowStore((s) => s.selectCue)

  const selectedCue = cues.find((c) => c.id === selectedCueId) ?? null

  const [dragOver, setDragOver] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [containerW, setContainerW] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const [everyN, setEveryN] = useState(1)
  const [detecting, setDetecting] = useState(false)

  const effectiveDuration = duration || DEFAULT_DURATION
  const siteNumber = (id: string) => launchSites.findIndex((l) => l.id === id) + 1
  const innerWidth = zoom > 1 && containerW > 0 ? containerW * zoom : undefined // px; undefined = 100%

  // --- Track the scroll container width so zoom math fits exactly at zoom=1 ---
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth))
    ro.observe(el)
    setContainerW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // --- Build / rebuild the WaveSurfer instance when audio changes ---
  useEffect(() => {
    const store = useShowStore.getState()
    cancelAnimationFrame(syntheticRaf.current)

    if (!audioUrl) {
      wsRef.current?.destroy()
      wsRef.current = null
      audioRefs.ws = null
      store.setDuration(DEFAULT_DURATION)
      store.setCurrentTime(0)
      store.setPlaying(false)
      return
    }

    if (!waveRef.current) return
    const ws = WaveSurfer.create({
      container: waveRef.current,
      height: 92,
      waveColor: '#3a4a6b',
      progressColor: '#ff8a3e',
      cursorColor: 'transparent', // we draw our own DJ-style playhead
      barWidth: 2,
      barGap: 1,
      url: audioUrl,
    })
    wsRef.current = ws
    audioRefs.ws = ws

    ws.on('ready', () => store.setDuration(ws.getDuration()))
    ws.on('audioprocess', (t: number) => store.setCurrentTime(t))
    ws.on('timeupdate', (t: number) => store.setCurrentTime(t))
    ws.on('play', () => store.setPlaying(true))
    ws.on('pause', () => store.setPlaying(false))
    ws.on('finish', () => store.setPlaying(false))

    return () => {
      ws.destroy()
      if (audioRefs.ws === ws) audioRefs.ws = null
    }
  }, [audioUrl])

  // --- Synthetic clock when there is no audio loaded ---
  useEffect(() => {
    if (audioUrl) return
    cancelAnimationFrame(syntheticRaf.current)
    if (!isPlaying) return
    let last = performance.now()
    const step = () => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      const store = useShowStore.getState()
      const next = store.currentTime + dt
      if (next >= store.duration) {
        store.setCurrentTime(store.duration)
        store.setPlaying(false)
        return
      }
      store.setCurrentTime(next)
      syntheticRaf.current = requestAnimationFrame(step)
    }
    syntheticRaf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(syntheticRaf.current)
  }, [audioUrl, isPlaying])

  // --- Keep the playhead in view while playing when zoomed in ---
  useEffect(() => {
    if (zoom <= 1 || !innerWidth || !scrollRef.current) return
    const el = scrollRef.current
    const playheadPx = (currentTime / effectiveDuration) * innerWidth
    const target = playheadPx - el.clientWidth / 2
    const max = innerWidth - el.clientWidth
    el.scrollLeft = Math.max(0, Math.min(max, target))
  }, [currentTime, zoom, innerWidth, effectiveDuration])

  // --- Keyboard shortcuts for rapid cueing ---
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const store = useShowStore.getState()
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'c' || e.key === 'C') {
        store.addCue(store.currentTime)
      } else if (e.key === 'n' || e.key === 'N') {
        cueThenNext()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete the selected cue (if any).
        if (store.selectedCueId) {
          e.preventDefault()
          store.removeCue(store.selectedCueId)
        }
      } else if (e.key === 'Escape') {
        store.selectCue(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // --- Transport controls ---
  function togglePlay() {
    const store = useShowStore.getState()
    const ws = wsRef.current
    if (ws) {
      if (!ws.isPlaying() && ws.getCurrentTime() >= ws.getDuration() - 0.05) {
        ws.setTime(0)
      }
      ws.playPause()
    } else {
      store.setPlaying(!store.isPlaying)
    }
  }
  function stop() {
    const store = useShowStore.getState()
    if (wsRef.current) wsRef.current.stop()
    store.setPlaying(false)
    store.setCurrentTime(0)
  }

  /** Cue the active site at the playhead, then advance to the next site. */
  function cueThenNext() {
    const store = useShowStore.getState()
    const site = store.selectedSiteId
    if (site) store.addCue(store.currentTime, undefined, site)
    store.advanceToNextSite()
  }

  // --- Upload handler ---
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const store = useShowStore.getState()
    store.setAudio(url, file.name)
    store.setCurrentTime(0)
    store.setPlaying(false)
    store.setBpm(null)
  }

  // --- BPM helpers ---
  function tapTempo() {
    const now = performance.now()
    const taps = tapTimes.current
    // Reset if the previous tap was long ago.
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0
    taps.push(now)
    if (taps.length > 8) taps.shift()
    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((t, i) => t - taps[i])
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      useShowStore.getState().setBpm(Math.round(60000 / avg))
    }
  }
  async function autoDetect() {
    if (!audioUrl) return
    setDetecting(true)
    try {
      const buf = await decodeAudio(audioUrl)
      const detected = estimateBpm(buf)
      if (detected) useShowStore.getState().setBpm(detected)
    } catch {
      /* ignore — user can enter BPM manually */
    } finally {
      setDetecting(false)
    }
  }

  // --- Map an x-coordinate to a time, accounting for zoom + scroll ---
  function timeFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return frac * effectiveDuration
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const fwId = e.dataTransfer.getData('application/x-firework')
    if (!fwId) return
    useShowStore.getState().addCue(timeFromClientX(e.clientX), fwId)
  }
  function seekTo(clientX: number) {
    const t = timeFromClientX(clientX)
    const ws = wsRef.current
    if (ws) ws.setTime(t)
    else useShowStore.getState().setCurrentTime(t)
  }

  const playheadPct = (currentTime / effectiveDuration) * 100

  // Beat grid lines (only when a BPM is set and the grid is shown).
  const beats: number[] = []
  if (bpm && showGrid) {
    const beat = 60 / bpm
    for (let t = beatOffset, n = 0; t <= effectiveDuration && n < 2000; t += beat, n++) {
      if (t >= 0) beats.push(t)
    }
  }

  const setBpm = useShowStore((s) => s.setBpm)
  const setBeatOffset = useShowStore((s) => s.setBeatOffset)
  const setSnapToBeat = useShowStore((s) => s.setSnapToBeat)
  const setAutoAdvance = useShowStore((s) => s.setAutoAdvance)

  return (
    <div className="timeline">
      <div className="timeline-bar">
        <button className="transport" onClick={togglePlay} title="Play / Pause (Space)">
          {isPlaying ? '❚❚' : '►'}
        </button>
        <button className="transport" onClick={stop} title="Stop">
          ■
        </button>
        <span className="time-readout">
          {fmt(currentTime)} / {fmt(effectiveDuration)}
        </span>

        <label className="upload-btn">
          {audioUrl ? 'Change Audio' : 'Upload Audio'}
          <input type="file" accept="audio/*" onChange={onFile} hidden />
        </label>

        <button
          className="transport ghost"
          onClick={() => useShowStore.getState().addCue(currentTime)}
          title="Add the selected firework to the selected site(s) at the playhead (C)"
        >
          + Cue
        </button>
        <button
          className="transport ghost"
          onClick={cueThenNext}
          title="Cue the active site, then jump to the next site (N)"
        >
          + Cue → next
        </button>
        <button
          className={autoAdvance ? 'transport ghost active' : 'transport ghost'}
          onClick={() => setAutoAdvance(!autoAdvance)}
          title="Chase: each cue you drop advances to the next launch site"
        >
          🔁 Chase {autoAdvance ? 'On' : 'Off'}
        </button>
        <CinematicToggle />
        <button
          className="transport ghost"
          onClick={() => useShowStore.getState().clearCues()}
          title="Remove all cues"
        >
          Clear cues
        </button>
      </div>

      {/* Second row: zoom + beat/BPM tools */}
      <div className="timeline-tools">
        <div className="tool-group">
          <span className="tool-label">Zoom</span>
          <button
            className="mini-btn"
            onClick={() => setZoom((z) => Math.max(1, +(z - 1).toFixed(1)))}
            title="Zoom out"
          >
            －
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.5}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            title="Zoom into the waveform"
          />
          <button
            className="mini-btn"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 1).toFixed(1)))}
            title="Zoom in"
          >
            ＋
          </button>
          <button className="mini-btn" onClick={() => setZoom(1)} title="Fit to width">
            Fit
          </button>
        </div>

        <div className="tool-group">
          <span className="tool-label">BPM</span>
          <input
            type="number"
            className="bpm-input"
            min={40}
            max={240}
            value={bpm ?? ''}
            placeholder="—"
            onChange={(e) =>
              setBpm(e.target.value === '' ? null : Number(e.target.value))
            }
            title="Beats per minute"
          />
          <button className="mini-btn" onClick={tapTempo} title="Tap on the beat to set tempo">
            Tap
          </button>
          <button
            className="mini-btn"
            onClick={autoDetect}
            disabled={!audioUrl || detecting}
            title="Estimate BPM from the uploaded track"
          >
            {detecting ? '…' : 'Auto'}
          </button>
          <label className="tool-check" title="Offset the beat grid to align with the first beat">
            <span className="tool-label">Offset</span>
            <input
              type="number"
              className="bpm-input"
              step={0.01}
              value={beatOffset}
              onChange={(e) => setBeatOffset(Number(e.target.value) || 0)}
            />
          </label>
          <label className="tool-check">
            <input
              type="checkbox"
              checked={snapToBeat}
              onChange={(e) => setSnapToBeat(e.target.checked)}
            />
            Snap
          </label>
          <label className="tool-check">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            Grid
          </label>
        </div>

        <div className="tool-group">
          <span className="tool-label">Fill every</span>
          <input
            type="number"
            className="bpm-input"
            min={1}
            max={32}
            value={everyN}
            onChange={(e) => setEveryN(Math.max(1, Number(e.target.value) || 1))}
            title="Place a cue every N beats"
          />
          <span className="tool-label">beat(s)</span>
          <button
            className="mini-btn"
            disabled={!bpm}
            onClick={() =>
              useShowStore
                .getState()
                .fillBeats({ from: 0, to: effectiveDuration, everyNBeats: everyN, chase: autoAdvance })
            }
            title="Auto-place cues on the beat grid across the whole track"
          >
            Fill beats
          </button>
        </div>
      </div>

      <div className="timeline-scroll" ref={scrollRef}>
        <div
          ref={trackRef}
          className={dragOver ? 'timeline-track drag-over' : 'timeline-track'}
          style={innerWidth ? { width: `${innerWidth}px` } : undefined}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onPointerDown={(e) => {
            // Click on empty track space seeks the playhead and clears any
            // selected cue.
            if (e.target === trackRef.current || (e.target as HTMLElement).classList.contains('waveform')) {
              selectCue(null)
              seekTo(e.clientX)
            }
          }}
        >
          {!audioUrl && (
            <div className="no-audio-hint">
              No audio yet — upload a track to see its waveform, or drag fireworks here to
              build a {DEFAULT_DURATION}s test show.
            </div>
          )}
          <div ref={waveRef} className="waveform" style={{ display: audioUrl ? 'block' : 'none' }} />

          {/* Beat grid */}
          {beats.length > 0 && (
            <div className="beat-layer">
              {beats.map((t, i) => (
                <div
                  key={i}
                  className={i % 4 === 0 ? 'beat-line downbeat' : 'beat-line'}
                  style={{ left: `${(t / effectiveDuration) * 100}%` }}
                />
              ))}
            </div>
          )}

          {/* Cue markers: numbered by site, colored by firework */}
          <div className="cue-layer">
            {cues.map((cue) => {
              const fw = getFireworkById(cue.fireworkTypeId)
              const left = (cue.time / effectiveDuration) * 100
              const n = siteNumber(cue.launchSiteId)
              const color = cue.colorOverride ?? fw?.colors[0] ?? '#fff'
              const isSelected = cue.id === selectedCueId
              return (
                <div
                  key={cue.id}
                  className={isSelected ? 'cue-marker selected' : 'cue-marker'}
                  style={{ left: `${left}%` }}
                  title={`Launch ${n} · ${fw?.name ?? 'Firework'} @ ${fmt(cue.time)} — click to select, drag to move`}
                  onPointerDown={(e) => startCueDrag(e, cue.id)}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!(e.currentTarget as HTMLElement).dataset.dragged) {
                      selectCue(cue.id)
                    }
                  }}
                >
                  <span className="cue-badge" style={{ background: color }}>
                    {n > 0 ? n : '?'}
                  </span>
                  <span className="cue-stem" style={{ background: color }} />
                </div>
              )
            })}
          </div>

          {/* DJ-style playhead: bright line + flag head with time */}
          <div className="playhead" style={{ left: `${playheadPct}%` }}>
            <span className="playhead-flag">{fmt(currentTime)}</span>
          </div>
        </div>
      </div>

      {selectedCue && (
        <CueInspector key={selectedCue.id} cue={selectedCue} launchSites={launchSites} />
      )}
    </div>
  )

  // --- Cue dragging to reposition in time ---
  function startCueDrag(e: React.PointerEvent, cueId: string) {
    e.stopPropagation()
    // Selecting on pointer-down means a cue is selected even mid-drag.
    useShowStore.getState().selectCue(cueId)
    const target = e.currentTarget as HTMLElement
    delete target.dataset.dragged
    const startX = e.clientX
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 3) target.dataset.dragged = '1'
      useShowStore.getState().updateCueTime(cueId, timeFromClientX(ev.clientX))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setTimeout(() => delete target.dataset.dragged, 0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
}

function CinematicToggle() {
  const cinematic = useShowStore((s) => s.cinematic)
  const toggle = useShowStore((s) => s.toggleCinematic)
  return (
    <button
      className={cinematic ? 'transport ghost active' : 'transport ghost'}
      onClick={toggle}
      title="Auto-orbit the camera during playback"
    >
      🎥 Cinematic {cinematic ? 'On' : 'Off'}
    </button>
  )
}

/** Editor for the currently selected cue: site, firework, time, color, delete. */
function CueInspector({ cue, launchSites }: { cue: Cue; launchSites: LaunchSite[] }) {
  const updateCueTime = useShowStore((s) => s.updateCueTime)
  const updateCueSite = useShowStore((s) => s.updateCueSite)
  const updateCueFirework = useShowStore((s) => s.updateCueFirework)
  const updateCueColor = useShowStore((s) => s.updateCueColor)
  const removeCue = useShowStore((s) => s.removeCue)
  const selectCue = useShowStore((s) => s.selectCue)

  const fw = getFireworkById(cue.fireworkTypeId)
  const siteNum = launchSites.findIndex((l) => l.id === cue.launchSiteId) + 1
  const color = cue.colorOverride ?? fw?.colors[0] ?? '#ffffff'

  return (
    <div className="cue-inspector" role="group" aria-label="Selected cue">
      <span className="cue-inspector-title">
        <span className="cue-badge" style={{ background: color }}>
          {siteNum > 0 ? siteNum : '?'}
        </span>
        Cue
      </span>

      <label className="cue-field">
        <span className="tool-label">Site</span>
        <select
          value={cue.launchSiteId}
          onChange={(e) => updateCueSite(cue.id, e.target.value)}
          title="Launch site this cue fires from"
        >
          {launchSites.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="cue-field">
        <span className="tool-label">Firework</span>
        <select
          value={cue.fireworkTypeId}
          onChange={(e) => updateCueFirework(cue.id, e.target.value)}
          title="Firework this cue fires"
        >
          {FIREWORK_LIBRARY.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <label className="cue-field">
        <span className="tool-label">Time</span>
        <input
          type="number"
          className="bpm-input"
          step={0.1}
          min={0}
          value={Number(cue.time.toFixed(2))}
          onChange={(e) => updateCueTime(cue.id, Math.max(0, Number(e.target.value) || 0))}
          title="Time (seconds) the cue fires"
        />
        <span className="tool-label">s</span>
      </label>

      <label className="cue-field">
        <span className="tool-label">Color</span>
        <input
          type="color"
          className="cue-color"
          value={color}
          onChange={(e) => updateCueColor(cue.id, e.target.value)}
          title="Override this cue's color"
        />
        {cue.colorOverride && (
          <button
            className="mini-btn"
            onClick={() => updateCueColor(cue.id, null)}
            title="Reset to the firework's default color"
          >
            Reset
          </button>
        )}
      </label>

      <button
        className="mini-btn danger"
        onClick={() => removeCue(cue.id)}
        title="Delete this cue (Delete)"
      >
        ✕ Delete
      </button>
      <button className="mini-btn" onClick={() => selectCue(null)} title="Close (Esc)">
        Done
      </button>
    </div>
  )
}
