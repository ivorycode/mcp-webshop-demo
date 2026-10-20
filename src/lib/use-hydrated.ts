import { useEffect, useState } from 'react'

/** Defers browser-only work until React has hydrated the complete server tree. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}
