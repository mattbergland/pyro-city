// Lightweight client-side audio analysis used to auto-place firework cues.
//
// We work from the decoded PCM samples (an AudioBuffer). The goal isn't a
// research-grade beat tracker — just a good-enough onset/energy detector so the
// user can auto-scatter cues onto the loud moments of a track, plus a tempo
// (BPM) estimate for evenly spaced "on the beat" triggers.

export interface AudioAnalysis {
  /** Times (seconds) of detected energy peaks / onsets, sorted ascending. */
  peaks: number[]
  /** Estimated tempo in beats per minute (0 if it couldn't be determined). */
  bpm: number
  /** Evenly spaced beat times (seconds) derived from the BPM + first onset. */
  beatTimes: number[]
}

const HOP = 1024 // samples per analysis frame (~23ms at 44.1kHz)

/** Mono mix-down of an AudioBuffer into a single Float32Array. */
function toMono(buffer: AudioBuffer): Float32Array {
  const ch = buffer.numberOfChannels
  const out = new Float32Array(buffer.length)
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) out[i] += data[i] / ch
  }
  return out
}

/** Per-frame RMS energy envelope and the time (s) of each frame. */
function energyEnvelope(samples: Float32Array, sampleRate: number) {
  const frames = Math.floor(samples.length / HOP)
  const env = new Float32Array(frames)
  const times = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let sum = 0
    const start = f * HOP
    for (let i = 0; i < HOP; i++) {
      const s = samples[start + i]
      sum += s * s
    }
    env[f] = Math.sqrt(sum / HOP)
    times[f] = (start + HOP / 2) / sampleRate
  }
  return { env, times }
}

/**
 * Onset "novelty": the positive change in energy between frames. Rising energy
 * marks the start of a note / hit, which is where fireworks should pop.
 */
function novelty(env: Float32Array): Float32Array {
  const nov = new Float32Array(env.length)
  for (let i = 1; i < env.length; i++) {
    const d = env[i] - env[i - 1]
    nov[i] = d > 0 ? d : 0
  }
  return nov
}

function mean(a: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]
  return a.length ? s / a.length : 0
}

function stddev(a: Float32Array, m: number): number {
  let s = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - m
    s += d * d
  }
  return a.length ? Math.sqrt(s / a.length) : 0
}

/**
 * Pick onset peaks: local maxima of the novelty curve that clear an adaptive
 * threshold, enforcing a minimum spacing so we don't fire dozens of cues on a
 * single drum hit.
 */
function pickPeaks(
  nov: Float32Array,
  times: Float32Array,
  minSpacingSec: number,
  sensitivity: number,
): number[] {
  const m = mean(nov)
  const sd = stddev(nov, m)
  const threshold = m + sensitivity * sd
  const peaks: number[] = []
  let lastTime = -Infinity
  for (let i = 1; i < nov.length - 1; i++) {
    const v = nov[i]
    if (v < threshold) continue
    if (v < nov[i - 1] || v < nov[i + 1]) continue // local maximum only
    const t = times[i]
    if (t - lastTime < minSpacingSec) {
      // Keep the louder of two peaks that are too close together.
      if (peaks.length && v > nov[Math.max(1, i - 1)]) {
        peaks[peaks.length - 1] = t
        lastTime = t
      }
      continue
    }
    peaks.push(t)
    lastTime = t
  }
  return peaks
}

/**
 * Estimate tempo by autocorrelating the novelty curve over the lag range that
 * corresponds to 60–200 BPM and taking the strongest periodicity.
 */
function estimateBpm(nov: Float32Array, frameRate: number): number {
  const minBpm = 60
  const maxBpm = 200
  const minLag = Math.floor((60 / maxBpm) * frameRate)
  const maxLag = Math.ceil((60 / minBpm) * frameRate)
  let bestLag = 0
  let bestScore = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0
    for (let i = lag; i < nov.length; i++) score += nov[i] * nov[i - lag]
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  if (!bestLag) return 0
  const bpm = (60 * frameRate) / bestLag
  return Math.round(bpm)
}

/** Run the full analysis on a decoded audio buffer. */
export function analyzeAudio(buffer: AudioBuffer, sensitivity = 1.3): AudioAnalysis {
  const samples = toMono(buffer)
  const { env, times } = energyEnvelope(samples, buffer.sampleRate)
  const nov = novelty(env)
  const frameRate = buffer.sampleRate / HOP

  const peaks = pickPeaks(nov, times, 0.18, sensitivity)
  const bpm = estimateBpm(nov, frameRate)

  // Build evenly spaced beats from the tempo, phased to the first onset.
  const beatTimes: number[] = []
  if (bpm > 0) {
    const period = 60 / bpm
    const start = peaks.length ? peaks[0] : 0
    for (let t = start; t < buffer.duration; t += period) beatTimes.push(t)
  }

  return { peaks, bpm, beatTimes }
}

/** Evenly spaced trigger times every `interval` seconds across `duration`. */
export function spacedTimes(duration: number, interval: number): number[] {
  const out: number[] = []
  if (interval <= 0) return out
  for (let t = 0; t < duration; t += interval) out.push(t)
  return out
}
