/**
 * Colourful navigation icons in a friendly, emoji-like style. Drawn as SVG (not emoji) so they look
 * the same on Windows, macOS, Android and iOS. Decorative: the label next to them carries the meaning.
 */
const icons = {
  /** Dashboard: the sun of "today". */
  today: (
    <>
      <g stroke="#F79009" strokeWidth="2" strokeLinecap="round">
        <path d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7" />
      </g>
      <circle cx="12" cy="12" r="5.6" fill="#FDB022" />
      <circle cx="10.4" cy="10.4" r="1.9" fill="#FEF0C7" />
    </>
  ),
  /** Tasks: a clipboard with a tick. */
  tasks: (
    <>
      <rect x="4" y="3.5" width="16" height="18.5" rx="3" fill="#60A5FA" />
      <rect x="6.2" y="6.4" width="11.6" height="13.4" rx="1.8" fill="#EFF6FF" />
      <rect x="8.5" y="2" width="7" height="3.6" rx="1.4" fill="#1D4ED8" />
      <path d="M8.6 13.2l2.3 2.3 4.6-4.9" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  /** Focus: a target with an arrow. */
  focus: (
    <>
      <circle cx="12" cy="12" r="10" fill="#F04438" />
      <circle cx="12" cy="12" r="7.2" fill="#FFF" />
      <circle cx="12" cy="12" r="4.6" fill="#F04438" />
      <circle cx="12" cy="12" r="2" fill="#FFF" />
      <path d="M12 12l7.6-7.6" stroke="#1E3A8A" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19.6 4.4l-.4 2.6 2.6-.4z" fill="#1E3A8A" stroke="#1E3A8A" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  /** Clients: a globe. */
  clients: (
    <>
      <circle cx="12" cy="12" r="10" fill="#38BDF8" />
      <path d="M7 5.2c1.6.4 2.4 1.6 2 3-.5 1.6-2.6 1.3-3 3-.3 1.2.9 2 .5 3.4-.3 1-1.3 1.3-2.2 1A10 10 0 017 5.2z" fill="#22C55E" />
      <path d="M14.5 4.3c-.5 1.4.4 2.5 1.8 2.7 1.5.2 2.1 1.6 1.4 2.8-.6 1-2 .9-2.6 2-.7 1.3.5 2.4.1 3.8-.4 1.3-1.6 2-1.4 3.6.1.6.4 1 .8 1.2a10 10 0 00-.1-16.1z" fill="#22C55E" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="#0284C7" strokeWidth="1.2" />
    </>
  ),
  /** Reports: a bar chart card. */
  reports: (
    <>
      <rect x="2.5" y="3" width="19" height="18" rx="3.5" fill="#E0E7FF" />
      <rect x="5.5" y="12" width="3" height="6" rx="1" fill="#6366F1" />
      <rect x="10.5" y="7" width="3" height="11" rx="1" fill="#2563EB" />
      <rect x="15.5" y="10" width="3" height="8" rx="1" fill="#EC4899" />
    </>
  ),
  /** Account: a person. */
  account: (
    <>
      <circle cx="12" cy="7.6" r="4.4" fill="#7C3AED" />
      <path d="M3.6 21c.5-4.4 4-7.2 8.4-7.2s7.9 2.8 8.4 7.2c0 .6-.4 1-1 1H4.6c-.6 0-1-.4-1-1z" fill="#A78BFA" />
    </>
  ),
  /** Streak / energy accent. */
  fire: (
    <>
      <path d="M12 2c.6 3.2 3.4 4.6 4.8 7.2 1.9 3.4.4 8.4-3.6 9.9-4.6 1.7-9.3-1.5-9.2-6.4.1-2.6 1.6-4.2 2.6-5.6.3 1.8 1.2 2.8 2.3 3.2C8.2 7.8 10 4.6 12 2z" fill="#F97316" />
      <path d="M12.3 11.2c1.8 1.4 3 3.2 2.4 5.3-.6 2-3 3-4.9 2-1.6-.8-2-2.9-1-4.4.4.6 1 .9 1.6.9-.2-1.5.6-2.9 1.9-3.8z" fill="#FDB022" />
    </>
  ),
}

export type AppIconName = keyof typeof icons

export function AppIcon({ name, size = 22, className = '' }: { name: AppIconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      {icons[name]}
    </svg>
  )
}
