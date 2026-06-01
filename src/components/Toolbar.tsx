import AddressSearch from './AddressSearch'
import { useShowStore } from '../store/useShowStore'

export default function Toolbar() {
  const placingSite = useShowStore((s) => s.placingSite)
  const setPlacingSite = useShowStore((s) => s.setPlacingSite)

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">✦</span>
        <span className="brand-name">Pyro Studio</span>
        <span className="brand-tag">3D fireworks designer</span>
      </div>

      <AddressSearch />

      <button
        className={placingSite ? 'tool-btn active' : 'tool-btn'}
        onClick={() => setPlacingSite(!placingSite)}
        title="When on, click the map to drop a launch site"
      >
        📍 {placingSite ? 'Placing launch sites' : 'Add launch site'}
      </button>
    </header>
  )
}
