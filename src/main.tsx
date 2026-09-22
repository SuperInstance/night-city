import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.scss'

// ─── quilt backend · fleet addition · see QUILT-BACKEND.md ───
// The ONLY upstream-file change: wrap the game from outside, wire the
// substrate. Everything under src/experience/ stays byte-identical.
import { startQuiltBackend } from './quilt/bootstrap'
startQuiltBackend()
// ─── end quilt backend ───

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
