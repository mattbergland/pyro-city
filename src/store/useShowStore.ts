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

interface ShowState {
  // --- Launch sites ---
  launchSites: LaunchSite[]
  selectedSiteId: string | null
  addLaunchSite: (site: Omit<LaunchSite, 'id' | 'name'> & { name?: string }) => string
  removeLaunchSite: (id: string) => void
  updateLaunchSitePosition: (
    id: string,
    pos: { longitude: number; latitude: number; height: number },
  ) => void
  renumberSites: () => void
  clearLaunchSites: () => void
  selectSite: (id: string | null) => void

  // --- Library selection (the firework you're about to place) ---
  selectedFireworkId: string

  selectFirework: (id: string) => void

  // --- Cues (fireworks scheduled on the timeline) ---
  cues: Cue[]
  addCue: (time: number, fireworkTypeId?: string, launchSiteId?: string) => void
  updateCueTime: (id: string, time: number) => void
  removeCue: (id: string) => void
  clearCues: () => void

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
      return {
        launchSites: [...s.launchSites, newSite],
        selectedSiteId: s.selectedSiteId ?? id,
      }
    })
    return id
  },
  removeLaunchSite: (id) =>
    set((s) => ({
      // Renumber so the remaining sites stay a gap-free Launch 1..N sequence.
      launchSites: renumber(s.launchSites.filter((l) => l.id !== id)),
      cues: s.cues.filter((c) => c.launchSiteId !== id),
      selectedSiteId: s.selectedSiteId === id ? null : s.selectedSiteId,
    })),
  updateLaunchSitePosition: (id, pos) =>
    set((s) => ({
      launchSites: s.launchSites.map((l) => (l.id === id ? { ...l, ...pos } : l)),
    })),
  renumberSites: () => set((s) => ({ launchSites: renumber(s.launchSites) })),
  clearLaunchSites: () => set({ launchSites: [], cues: [], selectedSiteId: null }),
  selectSite: (id) => set({ selectedSiteId: id }),

  selectedFireworkId: FIREWORK_LIBRARY[0].id,
  selectFirework: (id) => set({ selectedFireworkId: id }),

  cues: [],
  addCue: (time, fireworkTypeId, launchSiteId) => {
    const state = get()
    const siteId = launchSiteId ?? state.selectedSiteId ?? state.launchSites[0]?.id
    if (!siteId) return
    const cue: Cue = {
      id: uid('cue'),
      time: Math.max(0, time),
      fireworkTypeId: fireworkTypeId ?? state.selectedFireworkId,
      launchSiteId: siteId,
    }
    set((s) => ({ cues: [...s.cues, cue].sort((a, b) => a.time - b.time) }))
  },
  updateCueTime: (id, time) =>
    set((s) => ({
      cues: s.cues
        .map((c) => (c.id === id ? { ...c, time: Math.max(0, time) } : c))
        .sort((a, b) => a.time - b.time),
    })),
  removeCue: (id) => set((s) => ({ cues: s.cues.filter((c) => c.id !== id) })),
  clearCues: () => set({ cues: [] }),

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
