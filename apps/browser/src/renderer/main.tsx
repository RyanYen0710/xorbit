import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@orbit/ui/orbit.css'
import './styles.css'
import { initState, useOrbit } from './state'
import { Chrome } from './chrome/Chrome'
import { Overlay } from './overlay/Overlay'

// Internal pages are lazy: only the one a tab actually shows is ever downloaded/parsed.
const pages: Record<string, ReturnType<typeof lazy>> = {
  newtab: lazy(() => import('./pages/NewTab')),
  settings: lazy(() => import('./pages/Settings')),
  history: lazy(() => import('./pages/History')),
  downloads: lazy(() => import('./pages/Downloads')),
  themes: lazy(() => import('./pages/Themes')),
  pins: lazy(() => import('./pages/Pins')),
  welcome: lazy(() => import('./pages/Welcome')),
  error: lazy(() => import('./pages/ErrorPage')),
}

function App() {
  const s = useOrbit()
  const route = location.hostname
  if (!s) return null
  if (route === 'chrome') return <Chrome />
  if (route === 'overlay') return <Overlay />
  const Page = pages[route]
  return Page ? (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  ) : null
}

document.documentElement.dataset.route = location.hostname
void initState().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
