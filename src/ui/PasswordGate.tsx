import { useState, type FormEvent, type ReactNode } from 'react'

/**
 * A soft, client-side access gate (same idea as live.cinemafilmak.com's key
 * screen). On a static host there's no server to enforce it, so this keeps casual
 * visitors out and remembers the key — it is NOT real protection against a
 * technical user who reads the source.
 *
 * To change the password, replace PASS_HASH with the SHA-256 of the new one:
 *   node -e "console.log(require('crypto').createHash('sha256').update('NEWPASS').digest('hex'))"
 */
const PASS_HASH = 'ffb03d1665168035e7a08a8b3d8d91e90b9c5f53051831a423c1f906830548f0' // "tartanga"
const STORE_KEY = 'dmxsim-access'

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return localStorage.getItem(STORE_KEY) === PASS_HASH
    } catch {
      return false
    }
  })
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')

  if (unlocked) return <>{children}</>

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    const h = await sha256Hex(pass)
    if (h === PASS_HASH) {
      try {
        localStorage.setItem(STORE_KEY, h)
      } catch {
        /* private mode — just unlock for this session */
      }
      setUnlocked(true)
    } else {
      setErr('Clave incorrecta.')
      setPass('')
    }
  }

  return (
    <div className="gate">
      <img className="gate-logo" src="/logo.svg" alt="" width={72} height={72} />
      <h1>
        <span className="accent">DMX</span>SimulatoR
      </h1>
      <p>Introduce la clave de acceso.</p>
      <form onSubmit={onSubmit} autoComplete="off">
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="clave"
          autoFocus
        />
        <button type="submit">Entrar</button>
      </form>
      <div className="gate-err">{err}</div>
    </div>
  )
}
