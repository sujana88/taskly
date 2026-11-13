import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { User } from '../../db/types'
import { myTimezone } from '../../lib/time'
import { DEFAULT_HOURS, useSession } from './auth'

/** The signed-in user: undefined while loading, null when signed out or the account is gone. */
export function useCurrentUser(): User | null | undefined {
  const userId = useSession((s) => s.userId)
  return useLiveQuery(async () => (userId ? ((await db.users.get(userId)) ?? null) : null), [userId])
}

/** The user's zone (from this device) and working hours, with a fallback before the account loads. */
export function useMyHours(): { timezone: string; workHours: User['workHours'] } {
  const user = useCurrentUser()
  return { timezone: myTimezone(), workHours: user?.workHours ?? DEFAULT_HOURS }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase() || '?'
}
