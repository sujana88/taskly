import type { Priority } from '../../db/types'

/** Priority label colours: orange (low), blue (medium), red (high). Orange, not green: green and red look alike at a glance. */
export const PRIORITY_STYLE: Record<Priority, string> = {
  low: 'bg-orange-500 text-white',
  medium: 'bg-blue-600 text-white',
  high: 'bg-red-600 text-white',
}
