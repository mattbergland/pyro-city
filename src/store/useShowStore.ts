import { create } from 'zustand'
import type { Cue, LaunchSite } from '../types'
import { FIREWORK_LIBRARY } from '../data/fireworks'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Rename sites to a gap-free `Launch 1..N` sequence in their current order. */
function renumber(sites: LaunchSite[]): LaunchSite[] {
  return sites.map((site, i) => ({ ...site, name: `Launch ${i + 1}` }))
}

/** Snap a time (seconds) to the nearest beat of a BPM grid, if enabled. */
function maybeSnap(time: number, s: Pick<ShowState, 'snapToBeat' | 'bpm' | 'beatOffset'>) {
  if (!s.snapToBeat || !s.bpm || s.bpm <= 0) return time
  const beat = 60 / s.bpm
  const snapped = Math.round((time - s.beatOffset) / beat) * beat + s.beatOffset
  return Math.max(0, snapped)
}

interface ShowState {
  // --- Launch sites ---
  launchSites: LaunchSite[]
  /** The primary/active site (last one selected). */
  selectedSiteId: string | null
  /** All currently selected sites (for batch cueing). Includes the primary. */
  selectedSiteIds: string[]
  addLaunchSite: (site: Omit<LaunchSite, 'id' | 'name'> & { name?: string }) => string
  removeLaunchSite: (id: string) => void
  updateLaunchSitePosition: (
    id: string,
    pos: { longitude: number; latitude: number; height: number },
  ) => void
  renumberSites: () => void
  clearLaunchSites: () => void
  /** Replace the selection with a single site (or clear it with null). */
  selectSite: (id: string | null) => void
  /** Add/remove a site from the multi-selection. */
  toggleSiteInSelection: (id: string) => void
  /** Select every launch site. */
  selectAllSites: () => void
  /** Move the active site to the next one in order (wraps). Used for "chase" cueing. */
  advanceToNextSite: () => void

  // --- Library selection (the firework you're about to place) ---
  selectedFireworkId: string

  selectFirework: (id: string) => void

  // --- Cues (fireworks scheduled on the timeline) ---
  cues: Cue[]
  /**
   * Add a cue. When no explicit `launchSiteId` is given, a cue is added to
   * EVERY currently selected site (batch cueing). Honours snap-to-beat and,
   * when `autoAdvance` is on with a single site selected, hops to the next
   * site afterwards (chase cueing).
   */
  addCue: (time: number, fireworkTypeId?: string, launchSiteId?: string) => void
  updateCueTime: (id: string, time: number) => void
  removeCue: (id: string) => void
  clearCues: () => void
  /** Auto-place a cue on every Nth beat across a time range, optionally chasing sites. */
  fillBeats: (opts: {
    from: number
    to: number
    everyNBeats: number
    chase: boolean
  }) => number

  // --- Chase / rapid cueing ---
  /** When on, each batch-less cue advances the active site to the next one. */
  autoAdvance: boolean
  setAutoAdvance: (v: boolean) => void

  // --- Beat grid ---
  bpm: number | null
  beatOffset: number
  snapToBeat: boolean
  setBpm: (bpm: number | null) => void
  setBeatOffset: (offset: number) => void
  setSnapToBeat: (v: boolean) => void

  // --- Audio ---
  audioUrl: string | null
  audioName: string | null
  duration: number
  setAudio: (url: string | null, name: string | null) => void
  setDuration: (d: number) => void

  // --- Transport ---
  isPlaying: boolean
  currentTime: number
  setPlaying: (p: boolean) => void
  setCurrentTime: (t: number) => void

  // --- Camera ---
  cinematic: boolean
  toggleCinematic: () => void

  // --- Map interaction ---
  placingSite: boolean
  setPlacingSite: (v: boolean) => void
}

export const useShowStore = create<ShowState>((set, get) => ({
  launchSites: [],
  selectedSiteId: null,
  selectedSiteIds: [],
  addLaunchSite: (site) => {
    const id = uid('site')
    set((s) => {
      const newSite: LaunchSite = {
        id,
        name: site.name ?? `Launch ${s.launchSites.length + 1}`,
        longitude: site.longitude,
        latitude: site.latitude,
        height: site.height ?? 0,
      }
      const firstSite = s.launchSites.length === 0
      return {
        launchSites: [...s.launchSites, newSite],
        // Auto-select the very first site so cueing works immediately.
        selectedSiteId: firstSite ? id : s.selectedSiteId,
        selectedSiteIds: firstSite ? [id] : s.selectedSiteIds,
      }
    })
    return id
  },
  removeLaunchSite: (id) =>
    set((s) => {
      const selectedSiteIds = s.selectedSiteIds.filter((sid) => sid !== id)
      return {
        // Renumber so the remaining sites stay a gap-free Launch 1..N sequence.
        launchSites: renumber(s.launchSites.filter((l) => l.id !== id)),
        cues: s.cues.filter((c) => c.launchSiteId !== id),
        // Keep the active site valid: if the deleted site was active, fall back
        // to the last still-selected site (or null when none remain).
        selectedSiteId:
          s.selectedSiteId === id
            ? selectedSiteIds[selectedSiteIds.length - 1] ?? null
            : s.selectedSiteId,
        selectedSiteIds,
      }
    }),
  updateLaunchSitePosition: (id, pos) =>
    set((s) => ({
      launchSites: s.launchSites.map((l) => (l.id === id ? { ...l, ...pos } : l)),
    })),
  renumberSites: () => set((s) => ({ launchSites: renumber(s.launchSites) })),
  clearLaunchSites: () =>
    set({ launchSites: [], cues: [], selectedSiteId: null, selectedSiteIds: [] }),
  selectSite: (id) =>
    set({ selectedSiteId: id, selectedSiteIds: id ? [id] : [] }),
  toggleSiteInSelection: (id) =>
    set((s) => {
      const has = s.selectedSiteIds.includes(id)
      const selectedSiteIds = has
        ? s.selectedSiteIds.filter((sid) => sid !== id)
        : [...s.selectedSiteIds, id]
      return {
        selectedSiteIds,
        // Keep the active site valid: the toggled site becomes active when added,
        // and falls back to the last remaining one when removed.
        selectedSiteId: has
          ? selectedSiteIds[selectedSiteIds.length - 1] ?? null
          : id,
      }
    }),
  selectAllSites: () =>
    set((s) => ({
      selectedSiteIds: s.launchSites.map((l) => l.id),
      selectedSiteId: s.launchSites[s.launchSites.length - 1]?.id ?? null,
    })),
  advanceToNextSite: () =>
    set((s) => {
      if (s.launchSites.length === 0) return {}
      const idx = s.launchSites.findIndex((l) => l.id === s.selectedSiteId)
      const next = s.launchSites[(idx + 1) % s.launchSites.length]
      return { selectedSiteId: next.id, selectedSiteIds: [next.id] }
    }),

  selectedFireworkId: FIREWORK_LIBRARY[0].id,
  selectFirework: (id) => set({ selectedFireworkId: id }),

  cues: [],
  addCue: (time, fireworkTypeId, launchSiteId) => {
    const state = get()
    const fwId = fireworkTypeId ?? state.selectedFireworkId
    const snapped = maybeSnap(Math.max(0, time), state)

    // Which sites get a cue: an explicit one, else the whole multi-selection,
    // else the active/first site.
    let siteIds: string[]
    if (launchSiteId) {
      siteIds = [launchSiteId]
    } else if (state.selectedSiteIds.length > 0) {
      siteIds = state.selectedSiteIds
    } else {
      const fallback = state.selectedSiteId ?? state.launchSites[0]?.id
      siteIds = fallback ? [fallback] : []
    }
    if (siteIds.length === 0) return

    const newCues: Cue[] = siteIds.map((siteId) => ({
      id: uid('cue'),
      time: snapped,
      fireworkTypeId: fwId,
      launchSiteId: siteId,
    }))
    set((s) => ({ cues: [...s.cues, ...newCues].sort((a, b) => a.time - b.time) }))

    // Chase: when exactly one site was cued and auto-advance is on, hop to the
    // next site so rapid cueing lays a sequence across sites.
    if (state.autoAdvance && !launchSiteId && siteIds.length === 1) {
      get().advanceToNextSite()
    }
  },
  updateCueTime: (id, time) =>
    set((s) => ({
      cues: s.cues
        .map((c) => (c.id === id ? { ...c, time: maybeSnap(Math.max(0, time), s) } : c))
        .sort((a, b) => a.time - b.time),
    })),
  removeCue: (id) => set((s) => ({ cues: s.cues.filter((c) => c.id !== id) })),
  clearCues: () => set({ cues: [] }),
  fillBeats: ({ from, to, everyNBeats, chase }) => {
    const state = get()
    const { bpm, beatOffset } = state
    if (!bpm || bpm <= 0) return 0
    const step = (60 / bpm) * Math.max(1, Math.round(everyNBeats))
    const sites = state.launchSites
    if (sites.length === 0) return 0
    // Anchor the grid to the beat offset and only place cues inside [from, to].
    const start = beatOffset + Math.ceil((from - beatOffset) / step) * step
    const fwId = state.selectedFireworkId
    const baseIdx = Math.max(0, sites.findIndex((l) => l.id === state.selectedSiteId))
    const targets =
      !chase && state.selectedSiteIds.length > 0
        ? state.selectedSiteIds
        : null
    const newCues: Cue[] = []
    let i = 0
    for (let t = start; t <= to + 1e-6; t += step, i++) {
      const time = Math.max(0, t)
      if (targets) {
        for (const siteId of targets) {
          newCues.push({ id: uid('cue'), time, fireworkTypeId: fwId, launchSiteId: siteId })
        }
      } else {
        const site = chase ? sites[(baseIdx + i) % sites.length] : sites[baseIdx]
        newCues.push({ id: uid('cue'), time, fireworkTypeId: fwId, launchSiteId: site.id })
      }
    }
    if (newCues.length === 0) return 0
    set((s) => ({ cues: [...s.cues, ...newCues].sort((a, b) => a.time - b.time) }))
    return newCues.length
  },

  autoAdvance: false,
  setAutoAdvance: (v) => set({ autoAdvance: v }),

  bpm: null,
  beatOffset: 0,
  snapToBeat: false,
  setBpm: (bpm) => set({ bpm }),
  setBeatOffset: (offset) => set({ beatOffset: Math.max(0, offset) }),
  setSnapToBeat: (v) => set({ snapToBeat: v }),

  audioUrl: null,
  audioName: null,
  duration: 0,
  setAudio: (url, name) => set({ audioUrl: url, audioName: name }),
  setDuration: (d) => set({ duration: d }),

  isPlaying: false,
  currentTime: 0,
  setPlaying: (p) => set({ isPlaying: p }),
  setCurrentTime: (t) => set({ currentTime: t }),

  cinematic: false,
  toggleCinematic: () => set((s) => ({ cinematic: !s.cinematic })),

  placingSite: true,
  setPlacingSite: (v) => set({ placingSite: v }),
}))

// Dev-only handle for scripting/automated testing from the console.
if (import.meta.env.DEV) {
  ;(window as unknown as { useShowStore: typeof useShowStore }).useShowStore = useShowStore
}
