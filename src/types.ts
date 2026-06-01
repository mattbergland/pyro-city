// Core domain types for Pyro Studio

/** A visual category of firework break. Drives the particle simulation shape. */
export type FireworkShape =
  | 'peony'
  | 'chrysanthemum'
  | 'willow'
  | 'palm'
  | 'ring'
  | 'crossette'
  | 'strobe'
  | 'comet'
  | 'crackle'
  | 'heart'

/** Named color presets (hex) used by fireworks and the UI. */
export interface ColorStop {
  name: string
  hex: string
}

/** A firework definition from the library. */
export interface FireworkType {
  id: string
  name: string
  shape: FireworkShape
  /** Default color(s) of the break, hex strings. */
  colors: string[]
  /** Approximate break diameter in meters (controls particle spread). */
  breakSize: number
  /** Burst altitude above the launch site in meters. */
  burstAltitude: number
  /** Number of star particles in the break. */
  starCount: number
  /** Lifetime of break particles in seconds. */
  duration: number
  /** Short human description shown in the library. */
  description: string
}

/** A physical launch position on the map. */
export interface LaunchSite {
  id: string
  name: string
  longitude: number
  latitude: number
  /** Ground height (meters) at the site, used as the launch base. */
  height: number
}

/** A scheduled firework on the timeline, tied to a launch site and a type. */
export interface Cue {
  id: string
  /** Time in seconds from the start of the show. */
  time: number
  fireworkTypeId: string
  launchSiteId: string
  /** Optional per-cue color override (hex). */
  colorOverride?: string | null
}
