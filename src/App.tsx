import './i18n'
import { AppShell } from './ui/AppShell'
import { VizPopout } from './ui/VizPopout'
import { popoutScreen } from './store/vizSync'
// Access gate temporarily OFF (nobody has the URL yet). To re-enable, wrap <AppShell/>
// back in <PasswordGate>…</PasswordGate> — the component (src/ui/PasswordGate.tsx) is kept.
// import { PasswordGate } from './ui/PasswordGate'

export default function App() {
  // ?win=<screen> → this is a workspace popped out to its own window (2nd monitor).
  const win = popoutScreen()
  if (win) return <VizPopout screen={win} />
  return <AppShell />
}
