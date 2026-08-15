import './i18n'
import { AppShell } from './ui/AppShell'
import { VizPopout } from './ui/VizPopout'
import { isVizPopout } from './store/vizSync'
// Access gate temporarily OFF (nobody has the URL yet). To re-enable, wrap <AppShell/>
// back in <PasswordGate>…</PasswordGate> — the component (src/ui/PasswordGate.tsx) is kept.
// import { PasswordGate } from './ui/PasswordGate'

export default function App() {
  // ?viz=1 → this is the popped-out Visualiser window (2nd monitor); mirror the main window.
  if (isVizPopout()) return <VizPopout />
  return <AppShell />
}
