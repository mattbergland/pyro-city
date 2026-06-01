import { useState } from 'react'
import { useShowStore } from '../store/useShowStore'
import { audioRefs } from '../audio/audioRefs'
import { analyzeAudio, spacedTimes, type AudioAnalysis } from '../audio/analyze'
import { getFireworkById } from '../data/fireworks'

type Mode = 'peaks' | 'beats' | 'interval'

/**
 * "Auto-cue" tool: analyses the loaded track and scatters cues onto musical
 * onsets (peaks), evenly on the detected beat (BPM), or at a fixed interval.
 * Cues cycle through the multi-selected firework palette for variety.
 */
export default function AutoCuePanel() {
  const audioUrl = useShowStore((s) => s.audioUrl)
  const duration = useShowStore((s) => s.duration)
  const selectedFireworkIds = useShowStore((s) => s.selectedFireworkIds)

  const [open, setOpen] = useState(false)
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [mode, setMode] = useState<Mode>('peaks')
  const [interval, setIntervalSec] = useState(1)
  const [sensitivity, setSensitivity] = useState(1.3)
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [status, setStatus] = useState<string | null>(null)

  function analyze() {
    const ws = audioRefs.ws
    const buffer = ws?.getDecodedData()
    if (!buffer) {
      setStatus('Audio is still loading — try again in a moment.')
      return
    }
    setAnalyzing(true)
    setStatus(null)
    // Defer so the "Analyzing…" state can paint before the (sync) crunch.
    setTimeout(() => {
      try {
        const result = analyzeAudio(buffer, sensitivity)
        setAnalysis(result)
        setStatus(
          `Found ${result.peaks.length} peaks · ${
            result.bpm ? `~${result.bpm} BPM` : 'tempo unclear'
          }`,
        )
      } catch {
        setStatus('Could not analyze this track.')
      } finally {
        setAnalyzing(false)
      }
    }, 20)
  }

  function timesForMode(): number[] {
    if (mode === 'interval') return spacedTimes(duration, interval)
    if (!analysis) return []
    return mode === 'peaks' ? analysis.peaks : analysis.beatTimes
  }

  function placeCues() {
    const store = useShowStore.getState()
    const ids = store.selectedFireworkIds.length ? store.selectedFireworkIds : [store.selectedFireworkId]
    const times = timesForMode()
    if (times.length === 0) {
      setStatus(mode === 'interval' ? 'Set an interval first.' : 'Run Analyze first.')
      return
    }
    if (replaceExisting) store.clearCues()
    const entries = times.map((t, i) => ({ time: t, fireworkTypeId: ids[i % ids.length] }))
    store.addCues(entries)
    setStatus(`Placed ${entries.length} cues.`)
  }

  if (!audioUrl) return null

  const paletteNames = selectedFireworkIds
    .map((id) => getFireworkById(id)?.name ?? '?')
    .join(', ')

  return (
    <div className="autocue">
      <button
        className={open ? 'transport ghost active' : 'transport ghost'}
        onClick={() => setOpen((o) => !o)}
        title="Analyze the audio and auto-place cues"
      >
        ✨ Auto-cue
      </button>

      {open && (
        <div className="autocue-panel">
          <div className="autocue-row">
            <button className="transport ghost" onClick={analyze} disabled={analyzing}>
              {analyzing ? 'Analyzing…' : 'Analyze audio'}
            </button>
            {analysis?.bpm ? <span className="autocue-bpm">~{analysis.bpm} BPM</span> : null}
          </div>

          <label className="autocue-field">
            Sensitivity
            <input
              type="range"
              min={0.4}
              max={2.5}
              step={0.1}
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            />
          </label>

          <div className="autocue-modes">
            <label>
              <input
                type="radio"
                name="autocue-mode"
                checked={mode === 'peaks'}
                onChange={() => setMode('peaks')}
              />
              On peaks{analysis ? ` (${analysis.peaks.length})` : ''}
            </label>
            <label>
              <input
                type="radio"
                name="autocue-mode"
                checked={mode === 'beats'}
                onChange={() => setMode('beats')}
              />
              On beat{analysis?.beatTimes.length ? ` (${analysis.beatTimes.length})` : ''}
            </label>
            <label>
              <input
                type="radio"
                name="autocue-mode"
                checked={mode === 'interval'}
                onChange={() => setMode('interval')}
              />
              Every
              <input
                type="number"
                className="autocue-interval"
                min={0.1}
                step={0.1}
                value={interval}
                onChange={(e) => setIntervalSec(parseFloat(e.target.value) || 0)}
              />
              s
            </label>
          </div>

          <label className="autocue-checkbox">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Replace existing cues
          </label>

          <div className="autocue-palette">
            Palette ({selectedFireworkIds.length}): <span>{paletteNames}</span>
            <br />
            <small>Ctrl/⌘-click fireworks in the library to add variety.</small>
          </div>

          <button className="transport primary" onClick={placeCues}>
            Place cues
          </button>
          {status && <div className="autocue-status">{status}</div>}
        </div>
      )}
    </div>
  )
}
