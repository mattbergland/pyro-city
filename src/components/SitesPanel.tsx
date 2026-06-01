import { useShowStore } from '../store/useShowStore'
import { cesiumRefs } from '../cesium/director'

export default function SitesPanel() {
  const launchSites = useShowStore((s) => s.launchSites)
  const selectedSiteId = useShowStore((s) => s.selectedSiteId)
  const selectSite = useShowStore((s) => s.selectSite)
  const removeLaunchSite = useShowStore((s) => s.removeLaunchSite)
  const renumberSites = useShowStore((s) => s.renumberSites)
  const clearLaunchSites = useShowStore((s) => s.clearLaunchSites)
  const cues = useShowStore((s) => s.cues)

  return (
    <div className="sites-panel">
      <div className="sites-header">
        <h3>Launch Sites</h3>
        {launchSites.length > 0 && (
          <div className="sites-header-actions">
            <button
              title="Renumber sites to Launch 1…N"
              onClick={() => renumberSites()}
            >
              Reset #
            </button>
            <button
              title="Remove all launch sites and their cues"
              onClick={() => clearLaunchSites()}
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      {launchSites.length === 0 && (
        <p className="muted">
          Click anywhere on the map to drop your first launch site, then drag a marker
          to reposition it. Fireworks fire from the selected site.
        </p>
      )}
      <ul>
        {launchSites.map((site) => {
          const count = cues.filter((c) => c.launchSiteId === site.id).length
          return (
            <li
              key={site.id}
              className={site.id === selectedSiteId ? 'site-row selected' : 'site-row'}
              onClick={() => selectSite(site.id)}
            >
              <div className="site-info">
                <span className="site-name">{site.name}</span>
                <span className="site-coords">
                  {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)} · {count} cue
                  {count === 1 ? '' : 's'}
                </span>
              </div>
              <div className="site-actions">
                <button
                  title="Fly camera here"
                  onClick={(e) => {
                    e.stopPropagation()
                    cesiumRefs.director?.flyTo(site.longitude, site.latitude, 900)
                  }}
                >
                  🎯
                </button>
                <button
                  title="Delete site"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeLaunchSite(site.id)
                  }}
                >
                  ✕
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
