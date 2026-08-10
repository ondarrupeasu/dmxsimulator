import './i18n'
import { AppShell } from './ui/AppShell'
import { PasswordGate } from './ui/PasswordGate'

export default function App() {
  return (
    <PasswordGate>
      <AppShell />
    </PasswordGate>
  )
}
