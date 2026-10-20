// Demo-Session: Das ausgewählte Konto liegt als loginId in einem Cookie.
// Das ist bewusst keine Authentifizierung, sondern nur die Zuordnung des
// Browsers zu einem der drei Demo-Warenkörbe.

import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start-server'
import { findAccount } from './accounts.ts'
import type { DemoAccount } from './accounts.ts'

const LOGIN_COOKIE = 'tg-demo-login-id'

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 8,
}

export function getCurrentAccount(): DemoAccount | null {
  const loginId = getCookie(LOGIN_COOKIE)
  return loginId ? findAccount(loginId) : null
}

export function loginAccount(loginId: string): DemoAccount {
  const account = findAccount(loginId.trim())
  if (!account) throw new Error('Unbekanntes Demo-Konto.')
  setCookie(LOGIN_COOKIE, account.loginId, cookieOptions)
  return account
}

export function logoutAccount(): void {
  deleteCookie(LOGIN_COOKIE, { path: '/' })
}
