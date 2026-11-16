import type { Priority } from '../../db/types'

/** Label colours: green, yellow, blue (blue rather than red for "high", so it reads as important, not as an error). */
export const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'bg-green-600 text-white',
  medium: 'bg-amber-400 text-amber-950',
  high: 'bg-blue-600 text-white',
}
