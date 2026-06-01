import { create } from 'zustand'
import type { Cue, LaunchSite } from '../types'
import { FIREWORK_LIBRARY } from '../data/fireworks'

let siteCounter = 0

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

interface ShowState {
  // --- Launch sites ---
  launchSites: LaunchSite[]
  selectedSiteId: string | null
  addLaunchSite: (site: Omit<LaunchSite, 'id' | 'name'> & { name?: string }) => string
  removeLaunchSite: (id: string) => void
  selectSite: (id: string | null) => void

  // --- Library selection (the firework you're about to place) ---
  // `selectedFireworkId` is the primary type (used for single placement /
  // preview). `selectedFireworkIds` is the multi-select palette used for batch
  // cueing and auto-assign variety. The primary is always the first entry.
  selectedFireworkId: string
  selectedFireworkIds: string[]

  selectFirework: (id: string) => void
  toggleFireworkSelected: (id: string) => void

  // --- Cues (fireworks scheduled on the timeline) ---
  cues: Cue[]
  addCue: (time: number, fireworkTypeId?: string, launchSiteId?: string) => void
  /** Add many cues at once (used by batch placement / auto-assign). */
  addCues: (entries: { time: number; fireworkTypeId: string }[], launchSiteId?: string) => void
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
    siteCounter += 1
    const newSite: LaunchSite = {
      id,
      name: site.name ?? `Launch ${siteCounter}`,
      longitude: site.longitude,
      latitude: site.latitude,
      height: site.height ?? 0,
    }
    set((s) => ({
      launchSites: [...s.launchSites, newSite],
      selectedSiteId: s.selectedSiteId ?? id,
    }))
    return id
  },
  removeLaunchSite: (id) =>
    set((s) => ({
      launchSites: s.launchSites.filter((l) => l.id !== id),
      cues: s.cues.filter((c) => c.launchSiteId !== id),
      selectedSiteId: s.selectedSiteId === id ? null : s.selectedSiteId,
    })),
  selectSite: (id) => set({ selectedSiteId: id }),

  selectedFireworkId: FIREWORK_LIBRARY[0].id,
  selectedFireworkIds: [FIREWORK_LIBRARY[0].id],
  selectFirework: (id) => set({ selectedFireworkId: id, selectedFireworkIds: [id] }),
  toggleFireworkSelected: (id) =>
    set((s) => {
      const has = s.selectedFireworkIds.includes(id)
      const ids = has
        ? s.selectedFireworkIds.filter((x) => x !== id)
        : [...s.selectedFireworkIds, id]
      // Never allow an empty palette; keep at least the toggled item.
      const next = ids.length > 0 ? ids : [id]
      return { selectedFireworkIds: next, selectedFireworkId: next[0] }
    }),

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
  addCues: (entries, launchSiteId) => {
    const state = get()
    const siteId = launchSiteId ?? state.selectedSiteId ?? state.launchSites[0]?.id
    if (!siteId || entries.length === 0) return
    const newCues: Cue[] = entries.map((e) => ({
      id: uid('cue'),
      time: Math.max(0, e.time),
      fireworkTypeId: e.fireworkTypeId,
      launchSiteId: siteId,
    }))
    set((s) => ({ cues: [...s.cues, ...newCues].sort((a, b) => a.time - b.time) }))
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
