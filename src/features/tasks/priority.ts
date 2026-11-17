import type { Priority } from '../../db/types'

/** Priority label colours: green (low), blue (medium), red (high). */
export const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'bg-green-600 text-white',
  medium: 'bg-blue-600 text-white',
  high: 'bg-red-600 text-white',
}
