import type { FireworkType, ColorStop } from '../types'

/** Curated color palette inspired by real pyrotechnic star compositions. */
export const COLOR_PALETTE: ColorStop[] = [
  { name: 'Strontium Red', hex: '#ff2d2d' },
  { name: 'Sodium Gold', hex: '#ffb23e' },
  { name: 'Lemon Yellow', hex: '#ffe23e' },
  { name: 'Barium Green', hex: '#39ff7a' },
  { name: 'Copper Blue', hex: '#3e9bff' },
  { name: 'Indigo', hex: '#6a5bff' },
  { name: 'Magenta', hex: '#ff4fd8' },
  { name: 'Silver', hex: '#e8f0ff' },
  { name: 'Warm White', hex: '#fff4d6' },
  { name: 'Aqua', hex: '#3effe2' },
]

/**
 * A large, browseable library of firework "shells". These are grouped by
 * shape but vary in size, color and break behaviour so designers have plenty
 * of variety when building a show.
 */
export const FIREWORK_LIBRARY: FireworkType[] = [
  // --- Peonies (spherical ball of stars, no trail) ---
  {
    id: 'peony-red-3',
    name: '3" Red Peony',
    shape: 'peony',
    colors: ['#ff2d2d'],
    breakSize: 90,
    burstAltitude: 120,
    starCount: 220,
    duration: 2.2,
    description: 'Classic spherical break of red stars.',
  },
  {
    id: 'peony-gold-4',
    name: '4" Gold Peony',
    shape: 'peony',
    colors: ['#ffb23e'],
    breakSize: 120,
    burstAltitude: 150,
    starCount: 280,
    duration: 2.4,
    description: 'Warm gold spherical break.',
  },
  {
    id: 'peony-blue-5',
    name: '5" Blue Peony',
    shape: 'peony',
    colors: ['#3e9bff'],
    breakSize: 150,
    burstAltitude: 180,
    starCount: 320,
    duration: 2.6,
    description: 'Deep copper-blue spherical break.',
  },
  {
    id: 'peony-bicolor-6',
    name: '6" Red/Silver Peony',
    shape: 'peony',
    colors: ['#ff2d2d', '#e8f0ff'],
    breakSize: 180,
    burstAltitude: 210,
    starCount: 380,
    duration: 2.8,
    description: 'Two-tone red and silver break.',
  },

  // --- Chrysanthemums (spherical with glittering trails) ---
  {
    id: 'chrys-gold-4',
    name: '4" Gold Chrysanthemum',
    shape: 'chrysanthemum',
    colors: ['#ffb23e', '#ffe23e'],
    breakSize: 130,
    burstAltitude: 160,
    starCount: 300,
    duration: 3.0,
    description: 'Trailing gold stars forming a glittering sphere.',
  },
  {
    id: 'chrys-silver-6',
    name: '6" Silver Chrysanthemum',
    shape: 'chrysanthemum',
    colors: ['#e8f0ff'],
    breakSize: 170,
    burstAltitude: 200,
    starCount: 360,
    duration: 3.2,
    description: 'Brilliant silver trailing break.',
  },
  {
    id: 'chrys-multi-8',
    name: '8" Multicolor Chrysanthemum',
    shape: 'chrysanthemum',
    colors: ['#ff2d2d', '#3e9bff', '#39ff7a'],
    breakSize: 220,
    burstAltitude: 240,
    starCount: 440,
    duration: 3.4,
    description: 'Large multicolor trailing sphere.',
  },

  // --- Willows (slow, drooping long trails) ---
  {
    id: 'willow-gold-6',
    name: '6" Gold Willow',
    shape: 'willow',
    colors: ['#ffb23e'],
    breakSize: 200,
    burstAltitude: 230,
    starCount: 180,
    duration: 4.5,
    description: 'Long, slow drooping gold trails.',
  },
  {
    id: 'willow-silver-8',
    name: '8" Silver Willow',
    shape: 'willow',
    colors: ['#e8f0ff'],
    breakSize: 240,
    burstAltitude: 260,
    starCount: 200,
    duration: 5.0,
    description: 'Cascading silver willow that hangs in the sky.',
  },

  // --- Palms (thick rising trunk then spreading fronds) ---
  {
    id: 'palm-gold-5',
    name: '5" Gold Palm',
    shape: 'palm',
    colors: ['#ffb23e'],
    breakSize: 160,
    burstAltitude: 190,
    starCount: 90,
    duration: 3.2,
    description: 'Thick palm-tree fronds of gold sparks.',
  },
  {
    id: 'palm-green-6',
    name: '6" Green Palm',
    shape: 'palm',
    colors: ['#39ff7a'],
    breakSize: 180,
    burstAltitude: 210,
    starCount: 100,
    duration: 3.4,
    description: 'Green palm with rising trunk.',
  },

  // --- Rings (planar circle of stars) ---
  {
    id: 'ring-blue-5',
    name: '5" Blue Ring',
    shape: 'ring',
    colors: ['#3e9bff'],
    breakSize: 170,
    burstAltitude: 190,
    starCount: 140,
    duration: 2.4,
    description: 'Flat expanding ring of blue stars.',
  },
  {
    id: 'ring-magenta-5',
    name: '5" Magenta Ring',
    shape: 'ring',
    colors: ['#ff4fd8'],
    breakSize: 170,
    burstAltitude: 190,
    starCount: 140,
    duration: 2.4,
    description: 'Flat expanding ring of magenta stars.',
  },

  // --- Crossettes (stars that split into a grid) ---
  {
    id: 'crossette-red-4',
    name: '4" Red Crossette',
    shape: 'crossette',
    colors: ['#ff2d2d'],
    breakSize: 150,
    burstAltitude: 170,
    starCount: 24,
    duration: 2.6,
    description: 'Stars fly out and split into crosses.',
  },
  {
    id: 'crossette-white-5',
    name: '5" White Crossette',
    shape: 'crossette',
    colors: ['#fff4d6'],
    breakSize: 170,
    burstAltitude: 190,
    starCount: 28,
    duration: 2.8,
    description: 'White crossette grid effect.',
  },

  // --- Strobes (flickering twinkle) ---
  {
    id: 'strobe-white-5',
    name: '5" White Strobe',
    shape: 'strobe',
    colors: ['#e8f0ff'],
    breakSize: 160,
    burstAltitude: 200,
    starCount: 260,
    duration: 3.5,
    description: 'Crackling, flickering strobe stars.',
  },
  {
    id: 'strobe-aqua-6',
    name: '6" Aqua Strobe',
    shape: 'strobe',
    colors: ['#3effe2'],
    breakSize: 180,
    burstAltitude: 210,
    starCount: 280,
    duration: 3.6,
    description: 'Aqua flickering strobe sphere.',
  },

  // --- Comets (single rising tail) ---
  {
    id: 'comet-gold',
    name: 'Gold Comet',
    shape: 'comet',
    colors: ['#ffb23e'],
    breakSize: 40,
    burstAltitude: 160,
    starCount: 40,
    duration: 1.8,
    description: 'Single bright rising comet tail.',
  },
  {
    id: 'comet-silver',
    name: 'Silver Comet',
    shape: 'comet',
    colors: ['#e8f0ff'],
    breakSize: 40,
    burstAltitude: 160,
    starCount: 40,
    duration: 1.8,
    description: 'Single silver rising comet tail.',
  },

  // --- Crackle (gold spider crackle) ---
  {
    id: 'crackle-gold-5',
    name: '5" Gold Crackle',
    shape: 'crackle',
    colors: ['#ffe23e', '#ffb23e'],
    breakSize: 150,
    burstAltitude: 190,
    starCount: 320,
    duration: 1.6,
    description: 'Snappy gold crackle burst.',
  },

  // --- Heart (shaped novelty break) ---
  {
    id: 'heart-red-6',
    name: '6" Red Heart',
    shape: 'heart',
    colors: ['#ff2d2d'],
    breakSize: 170,
    burstAltitude: 200,
    starCount: 160,
    duration: 2.8,
    description: 'Novelty heart-shaped break.',
  },
]

export function getFireworkById(id: string): FireworkType | undefined {
  return FIREWORK_LIBRARY.find((f) => f.id === id)
}
