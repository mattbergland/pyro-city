# Pyro City

A browser-based **3D fireworks designer** — think "Finale 3D" in the browser. Search any
real-world venue, place launch sites on a photoreal 3D map, line fireworks up to an audio
track on a waveform timeline, then press play and watch the show fire in sync with a
cinematic, Google-Earth-style camera.

## Features

- **Real 3D venues** — CesiumJS globe with satellite imagery, world terrain, and 3D
  buildings (Cesium OSM Buildings). Search a place (e.g. "Oracle Park") and fly straight in.
- **Autocomplete place search** — type a venue/address, pick from real matches (powered by
  free OpenStreetMap Nominatim geocoding), and the camera flies down into it.
- **Firework library** — 30+ shells across 10 shapes (peony, chrysanthemum, willow, palm,
  ring, crossette, strobe, comet, crackle, heart) with a named color palette.
- **Place launch sites** — click anywhere on the map to drop a launch position.
- **Audio + waveform timeline** — upload a track, see its waveform (wavesurfer.js), and
  scrub through it.
- **Cue system** — drag fireworks from the library onto the timeline at exact timestamps.
- **Synchronized playback** — press play and the cued bursts fire in 3D at their times,
  using a custom GPU point-particle engine with shape-specific physics. No audio? A 60s
  silent clock lets you build and preview a test show.
- **Google-Earth navigation + cinematic mode** — drag to pan, right-drag/ctrl-drag to
  tilt and orbit, scroll to zoom, plus a "Cinematic" toggle that auto-orbits the show
  during playback.

## Tech stack

Vite + React + TypeScript · CesiumJS (3D) · wavesurfer.js (audio) · Zustand (state) ·
OpenStreetMap Nominatim (geocoding).

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

### Cesium ion token (for 3D buildings + terrain)

The 3D buildings, world terrain, and satellite imagery come from
[Cesium ion](https://ion.cesium.com/) (free, no billing required). Create an account, copy
your default access token, and add it to a local env file:

```bash
echo "VITE_CESIUM_ION_TOKEN=your_token_here" > .env.local
```

Without a token the app still runs and is fully functional, but falls back to flat
OpenStreetMap map tiles (no 3D buildings).

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the dev server (HMR)           |
| `npm run build`   | Type-check and build for production  |
| `npm run lint`    | Run ESLint                           |
| `npm run preview` | Preview the production build locally |
