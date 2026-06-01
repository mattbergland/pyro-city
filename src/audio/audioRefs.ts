import type WaveSurfer from 'wavesurfer.js'

/** Shared handle to the active WaveSurfer instance for transport control. */
export const audioRefs: { ws: WaveSurfer | null } = { ws: null }
