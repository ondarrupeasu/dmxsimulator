import './i18n'
import { AppShell } from './ui/AppShell'
// Access gate temporarily OFF (nobody has the URL yet). To re-enable, wrap <AppShell/>
// back in <PasswordGate>…</PasswordGate> — the component (src/ui/PasswordGate.tsx) is kept.
// import { PasswordGate } from './ui/PasswordGate'

export default function App() {
  return <AppShell />
}
