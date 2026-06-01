import { useEffect, useRef, useState } from 'react'
import { cesiumRefs } from '../cesium/director'

interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
  type?: string
  class?: string
}

/**
 * Free place search via OpenStreetMap's Nominatim service (no API key).
 * Typing shows an autocomplete dropdown of matching places with their real
 * addresses; clicking one flies the camera down into that venue.
 */
export default function AddressSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const reqId = useRef(0)

  // Debounced autocomplete lookup. All state updates happen inside the timer
  // callback (never synchronously in the effect body).
  useEffect(() => {
    const q = query.trim()
    const id = ++reqId.current
    const timer = setTimeout(async () => {
      if (q.length < 3) {
        setResults([])
        setOpen(false)
        return
      }
      setLoading(true)
      try {
        const url =
          'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=' +
          encodeURIComponent(q)
        const res = await fetch(url, { headers: { Accept: 'application/json' } })
        const data: NominatimResult[] = res.ok ? await res.json() : []
        if (id !== reqId.current) return // a newer request superseded this one
        setResults(data)
        setOpen(true)
        setActiveIdx(-1)
      } catch {
        if (id === reqId.current) setResults([])
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    }, q.length < 3 ? 0 : 350)
    return () => clearTimeout(timer)
  }, [query])

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function choose(r: NominatimResult) {
    setQuery(primaryName(r))
    setOpen(false)
    setResults([])
    // Fly down close to the venue so its 3D structure fills the view.
    cesiumRefs.director?.flyToVenue(parseFloat(r.lon), parseFloat(r.lat))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[activeIdx >= 0 ? activeIdx : 0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="address-search" ref={boxRef}>
      <div className="address-search-field">
        <input
          type="text"
          placeholder="Search a venue or address — e.g. Oracle Park"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <span className="search-status">{loading ? '…' : '🔍'}</span>
      </div>

      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => (
            <li
              key={r.place_id}
              className={i === activeIdx ? 'search-result active' : 'search-result'}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(r)
              }}
            >
              <span className="result-name">{primaryName(r)}</span>
              <span className="result-addr">{r.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** First, most recognisable part of a Nominatim display name. */
function primaryName(r: NominatimResult) {
  return r.display_name.split(',')[0]
}
