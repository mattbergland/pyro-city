import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useShowStore } from '../store/useShowStore'
import { audioRefs } from '../audio/audioRefs'
import { getFireworkById } from '../data/fireworks'

const DEFAULT_DURATION = 60 // seconds, used when no audio is loaded

function fmt(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const ms = Math.floor((t % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

export default function Timeline() {
  const waveRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const syntheticRaf = useRef<number>(0)

  const audioUrl = useShowStore((s) => s.audioUrl)
  const duration = useShowStore((s) => s.duration)
  const currentTime = useShowStore((s) => s.currentTime)
  const isPlaying = useShowStore((s) => s.isPlaying)
  const cues = useShowStore((s) => s.cues)
  const [dragOver, setDragOver] = useState(false)

  // --- Build / rebuild the WaveSurfer instance when audio changes ---
  useEffect(() => {
    const store = useShowStore.getState()
    // Tear down any synthetic clock.
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
      height: 84,
      waveColor: '#3a4a6b',
      progressColor: '#ff8a3e',
      cursorColor: '#ffffff',
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
    ws.on('finish', () => {
      store.setPlaying(false)
    })

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

  // --- Transport controls ---
  function togglePlay() {
    const store = useShowStore.getState()
    if (wsRef.current) {
      wsRef.current.playPause()
    } else {
      store.setPlaying(!store.isPlaying)
    }
  }
  function stop() {
    const store = useShowStore.getState()
    if (wsRef.current) {
      wsRef.current.stop()
    }
    store.setPlaying(false)
    store.setCurrentTime(0)
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
  }

  // --- Drag a firework from the library onto the timeline ---
  function timeFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return frac * (duration || DEFAULT_DURATION)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const fwId = e.dataTransfer.getData('application/x-firework')
    if (!fwId) return
    const time = timeFromClientX(e.clientX)
    useShowStore.getState().addCue(time, fwId)
  }

  const effectiveDuration = duration || DEFAULT_DURATION
  const playheadPct = (currentTime / effectiveDuration) * 100

  return (
    <div className="timeline">
      <div className="timeline-bar">
        <button className="transport" onClick={togglePlay} title="Play / Pause">
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
          title="Add selected firework at the playhead"
        >
          + Cue at playhead
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

      <div
        ref={trackRef}
        className={dragOver ? 'timeline-track drag-over' : 'timeline-track'}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {!audioUrl && (
          <div className="no-audio-hint">
            No audio yet — upload a track to see its waveform, or drag fireworks here to
            build a {DEFAULT_DURATION}s test show.
          </div>
        )}
        <div ref={waveRef} className="waveform" style={{ display: audioUrl ? 'block' : 'none' }} />

        {/* Cue markers */}
        <div className="cue-layer">
          {cues.map((cue) => {
            const fw = getFireworkById(cue.fireworkTypeId)
            const left = (cue.time / effectiveDuration) * 100
            return (
              <div
                key={cue.id}
                className="cue-marker"
                style={{ left: `${left}%`, background: fw?.colors[0] ?? '#fff' }}
                title={`${fw?.name ?? 'Firework'} @ ${fmt(cue.time)} — click to delete`}
                onPointerDown={(e) => startCueDrag(e, cue.id)}
                onClick={(e) => {
                  // Plain click with no drag deletes the cue.
                  if (!(e.currentTarget as HTMLElement).dataset.dragged) {
                    useShowStore.getState().removeCue(cue.id)
                  }
                }}
              />
            )
          })}
        </div>

        {/* Playhead line */}
        <div className="playhead" style={{ left: `${playheadPct}%` }} />
      </div>
    </div>
  )

  // --- Cue dragging to reposition in time ---
  function startCueDrag(e: React.PointerEvent, cueId: string) {
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    delete target.dataset.dragged
    const startX = e.clientX
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 3) target.dataset.dragged = '1'
      const time = timeFromClientX(ev.clientX)
      useShowStore.getState().updateCueTime(cueId, time)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      // Clear the dragged flag shortly after so the click handler can read it.
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
