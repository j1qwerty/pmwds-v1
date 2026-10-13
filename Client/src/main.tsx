import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DevPanel } from './dev/DevPanel'
import { SHOW_BOTTOM_DEV_PANEL } from './dev/devPanelFlag'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {/* Demo aid for the Playwright e2e runner. On by default so a deployed build
        shows it too; set VITE_BOTTOM_DEV_PANLE=false to hide it. */}
    {SHOW_BOTTOM_DEV_PANEL && <DevPanel />}
  </React.StrictMode>,
)
