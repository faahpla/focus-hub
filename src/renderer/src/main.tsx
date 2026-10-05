import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/error-boundary'
import './styles/globals.css'

/*
  A file dragged over the window must not open in it. Drop zones handle their
  own drops and stop the event there; anywhere else ends up here, where the
  cursor says "no" and the drop does nothing. The main process refuses the
  navigation too — this is the half that also gets the cursor right.
*/
const refuseStrayFile = (e: DragEvent): void => {
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'none'
}
window.addEventListener('dragover', refuseStrayFile)
window.addEventListener('drop', refuseStrayFile)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
