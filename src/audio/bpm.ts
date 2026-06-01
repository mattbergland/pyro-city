// Lightweight tempo (BPM) estimation from a decoded AudioBuffer.
//
// Approach: build an amplitude "energy envelope" of the track, then run an
// autocorrelation over the range of plausible beat periods (60–180 BPM) and
// pick the lag with the strongest periodicity. This is intentionally simple —
// good enough to seed the beat grid, which the user can fine-tune or override.

const MIN_BPM = 60
const MAX_BPM = 180

/** Decode an audio file/blob URL into a mono AudioBuffer. */
export async function decodeAudio(url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  const arr = await res.arrayBuffer()
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    return await ctx.decodeAudioData(arr)
  } finally {
    void ctx.close()
  }
}

/**
 * Estimate the tempo of a decoded buffer.
 * @returns the estimated BPM (rounded), or null if it can't be determined.
 */
export function estimateBpm(buffer: AudioBuffer): number | null {
  const sampleRate = buffer.sampleRate
  const channel = buffer.getChannelData(0)

  // 1) Downsample into an energy envelope at ~200 Hz.
  const envHz = 200
  const win = Math.max(1, Math.floor(sampleRate / envHz))
  const envLen = Math.floor(channel.length / win)
  if (envLen < envHz) return null
  const env = new Float32Array(envLen)
  for (let i = 0; i < envLen; i++) {
    let sum = 0
    const base = i * win
    for (let j = 0; j < win; j++) sum += Math.abs(channel[base + j])
    env[i] = sum / win
  }

  // 2) Differentiate + half-wave rectify to emphasise onsets (rising energy).
  const onset = new Float32Array(envLen)
  for (let i = 1; i < envLen; i++) {
    const d = env[i] - env[i - 1]
    onset[i] = d > 0 ? d : 0
  }

  // 3) Autocorrelate the onset signal across plausible beat periods.
  const minLag = Math.floor((60 / MAX_BPM) * envHz)
  const maxLag = Math.ceil((60 / MIN_BPM) * envHz)
  let bestLag = -1
  let bestScore = -Infinity
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0
    for (let i = lag; i < envLen; i++) score += onset[i] * onset[i - lag]
    // Normalise slightly toward faster tempos to avoid octave-down bias.
    score /= lag
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  if (bestLag <= 0) return null

  let bpm = (60 * envHz) / bestLag
  // Fold into a musical range.
  while (bpm < MIN_BPM) bpm *= 2
  while (bpm > MAX_BPM) bpm /= 2
  return Math.round(bpm)
}
