import { useState } from 'react'
import { DEMO_ACCOUNTS } from '../../lib/accounts.ts'
import type { DemoAccount } from '../../lib/accounts.ts'

/** Auswahl eines Demo-Kontos. Keine Sicherheit: Die loginId landet in einem Cookie. */
export function LoginDialog({
  account,
  onLogin,
  onLogout,
  onClose,
  isPending,
  error,
}: {
  account: DemoAccount | null
  onLogin: (loginId: string) => void
  onLogout: () => void
  onClose: () => void
  isPending: boolean
  error: Error | null
}) {
  const [loginId, setLoginId] = useState(
    account?.loginId ?? DEMO_ACCOUNTS[0].loginId,
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-8">
      <div className="w-full max-w-xl rounded-[1.75rem] border border-[var(--line)] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.2)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="island-kicker mb-2">Demo-Login</p>
            <h2 className="m-0 text-2xl font-semibold text-[var(--ink-strong)]">
              Warenkorb zuordnen
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-3 py-1 text-sm font-semibold text-[var(--ink-soft)]"
            onClick={onClose}
          >
            Schliessen
          </button>
        </div>

        {account ? (
          <div className="mt-4 rounded-xl bg-[rgba(217,31,38,0.06)] px-4 py-3 text-sm font-semibold text-[var(--ink-strong)]">
            Aktives Konto: {account.name}
          </div>
        ) : null}

        <form
          className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            onLogin(loginId)
          }}
        >
          <select
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none"
          >
            {DEMO_ACCOUNTS.map((candidate) => (
              <option key={candidate.loginId} value={candidate.loginId}>
                {candidate.name} ({candidate.loginId})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="action-button rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? 'Anmelden...' : 'Anmelden'}
          </button>
          <button
            type="button"
            className="rounded-2xl border border-[var(--line)] bg-white/70 px-5 py-3 text-sm font-semibold text-[var(--ink-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onLogout}
            disabled={isPending || !account}
          >
            Abmelden
          </button>
        </form>

        <p className="mt-3 text-sm text-[var(--ink-soft)]">
          Keine Sicherheit in dieser Demo: Die Login-ID wird in einem Cookie
          gespeichert und auf dem Server als Warenkorb-Identität verwendet.
        </p>

        {error ? (
          <p className="mt-3 text-sm font-medium text-[var(--alert)]">
            {error.message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
