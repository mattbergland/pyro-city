import { useState } from 'react'
import { cesiumRefs } from '../cesium/director'

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

/**
 * Free address geocoding via OpenStreetMap's Nominatim service (no API key).
 * On success the camera flies to the location.
 */
export default function AddressSearch() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
        encodeURIComponent(query)
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error('Search failed')
      const data: NominatimResult[] = await res.json()
      if (!data.length) {
        setError('No results found')
        return
      }
      const { lat, lon } = data[0]
      cesiumRefs.director?.flyTo(parseFloat(lon), parseFloat(lat), 1600)
    } catch {
      setError('Could not search that address')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="address-search" onSubmit={search}>
      <input
        type="text"
        placeholder="Search an address or place…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? '…' : 'Go'}
      </button>
      {error && <span className="search-error">{error}</span>}
    </form>
  )
}
