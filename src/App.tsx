import MapView from './components/MapView'
import Toolbar from './components/Toolbar'
import FireworkLibrary from './components/FireworkLibrary'
import SitesPanel from './components/SitesPanel'
import Timeline from './components/Timeline'
import CameraControls from './components/CameraControls'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="stage">
        <MapView />
        <CameraControls />
        <aside className="panel panel-left">
          <h3>Firework Library</h3>
          <FireworkLibrary />
        </aside>
        <aside className="panel panel-right">
          <SitesPanel />
        </aside>
      </div>
      <Timeline />
    </div>
  )
}
