// Die drei Demo-Konten. Die loginId ist zugleich der Schlüssel für Warenkorb
// und Bestellungen; eine echte Authentifizierung gibt es in der Demo nicht.

export type DemoAccount = { loginId: string; name: string }

export const DEMO_ACCOUNTS: ReadonlyArray<DemoAccount> = [
  { loginId: 'restaurant-baeren', name: 'Restaurant Bären' },
  { loginId: 'hotel-alpenblick', name: 'Hotel Alpenblick' },
  { loginId: 'kantine-campus', name: 'Kantine Campus' },
]

export function findAccount(loginId: string): DemoAccount | null {
  return DEMO_ACCOUNTS.find((account) => account.loginId === loginId) ?? null
}
