import { useMemo, useState } from 'react'
import { FIREWORK_LIBRARY } from '../data/fireworks'
import { useShowStore } from '../store/useShowStore'
import type { FireworkShape } from '../types'
import { cesiumRefs } from '../cesium/director'

const SHAPE_LABELS: Record<FireworkShape, string> = {
  peony: 'Peony',
  chrysanthemum: 'Chrysanthemum',
  willow: 'Willow',
  palm: 'Palm',
  ring: 'Ring',
  crossette: 'Crossette',
  strobe: 'Strobe',
  comet: 'Comet',
  crackle: 'Crackle',
  heart: 'Heart',
}

export default function FireworkLibrary() {
  const [filter, setFilter] = useState<FireworkShape | 'all'>('all')
  const selectedFireworkId = useShowStore((s) => s.selectedFireworkId)
  const selectFirework = useShowStore((s) => s.selectFirework)

  const shapes = useMemo(
    () => Array.from(new Set(FIREWORK_LIBRARY.map((f) => f.shape))),
    [],
  )
  const items = useMemo(
    () => (filter === 'all' ? FIREWORK_LIBRARY : FIREWORK_LIBRARY.filter((f) => f.shape === filter)),
    [filter],
  )

  /** Fire a one-off preview burst above the selected (or first) launch site. */
  function preview(id: string) {
    const fw = FIREWORK_LIBRARY.find((f) => f.id === id)
    const store = useShowStore.getState()
    const site =
      store.launchSites.find((l) => l.id === store.selectedSiteId) ?? store.launchSites[0]
    if (fw && site) {
      cesiumRefs.director?.fireBurst(site, fw, fw.colors[0])
    }
  }

  return (
    <div className="library">
      <div className="library-filters">
        <button
          className={filter === 'all' ? 'chip active' : 'chip'}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {shapes.map((sh) => (
          <button
            key={sh}
            className={filter === sh ? 'chip active' : 'chip'}
            onClick={() => setFilter(sh)}
          >
            {SHAPE_LABELS[sh]}
          </button>
        ))}
      </div>

      <div className="library-grid">
        {items.map((fw) => {
          const selected = fw.id === selectedFireworkId
          return (
            <button
              key={fw.id}
              className={selected ? 'fw-card selected' : 'fw-card'}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-firework', fw.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => selectFirework(fw.id)}
              onDoubleClick={() => preview(fw.id)}
              title={`${fw.description}\nDrag onto the timeline, or double-click to preview.`}
            >
              <span
                className="fw-swatch"
                style={{
                  background: `radial-gradient(circle at 50% 45%, ${fw.colors[0]} 0%, ${
                    fw.colors[1] ?? fw.colors[0]
                  } 60%, transparent 72%)`,
                }}
              />
              <span className="fw-name">{fw.name}</span>
              <span className="fw-shape">{SHAPE_LABELS[fw.shape]}</span>
            </button>
          )
        })}
      </div>
      <p className="library-hint">
        Click to select · drag onto the timeline · double-click to preview in 3D
      </p>
    </div>
  )
}
