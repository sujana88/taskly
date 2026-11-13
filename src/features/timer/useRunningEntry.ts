import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { TimeEntry } from '../../db/types'

/** The time entry that is running right now, kept live from the database. */
export function useRunningEntry(): TimeEntry | undefined {
  return useLiveQuery(() => db.timeEntries.filter((e) => !e.endedAt).first(), [])
}
