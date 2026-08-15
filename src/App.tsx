import './i18n'
import { AppShell } from './ui/AppShell'
import { ExtMonitor } from './ui/VizPopout'
import { isExtMonitor } from './store/vizSync'
// Access gate temporarily OFF (nobody has the URL yet). To re-enable, wrap <AppShell/>
// back in <PasswordGate>…</PasswordGate> — the component (src/ui/PasswordGate.tsx) is kept.
// import { PasswordGate } from './ui/PasswordGate'

export default function App() {
  // ?ext=1 → this window is the external monitor (2nd display).
  if (isExtMonitor()) return <ExtMonitor />
  return <AppShell />
}
