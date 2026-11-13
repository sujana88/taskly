import { useId, type SVGProps } from 'react'

const paths = {
  home: <><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9v11h5v-6h4v6h5V9" /></>,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>,
  file: <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  tasks: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12l3 3 5-6" /></>,
  focus: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></>,
  clients: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>,
  reports: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  kanban: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="10" rx="1.5" /><rect x="17" y="4" width="4" height="13" rx="1.5" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  sort: <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />,
  filter: <path d="M3 4h18l-7 8v6l-4 2v-8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></>,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M19 12l-7 7-7-7" />,
  back: <path d="M15 18l-6-6 6-6" />,
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth={3} />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
  skip: <path d="M5 5l9 7-9 7zM19 5v14" />,
  reset: <><path d="M3 12a9 9 0 109-9 9.5 9.5 0 00-6.7 2.8L3 8" /><path d="M3 3v5h5" /></>,
  check: <path d="M5 12l5 5L20 7" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6A17.6 17.6 0 002 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></>,
  logout: <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l-5-5 5-5M5 12h11" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M10 13h4" /></>,
  chevronLeft: <path d="M15 18l-6-6 6-6" />,
  chevronRight: <path d="M9 18l6-6-6-6" />,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
  bell: <><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 003.4 0" /></>,
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {paths[name]}
    </svg>
  )
}

/** App mark: a checked box with a clock badge on a blue tile (same artwork as public/favicon.svg). */
export function Logo({ size = 36 }: { size?: number }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <mask id={`${uid}cut`}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="46" cy="46" r="13" fill="#000" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${uid}bg)`} />
      <rect x="12" y="12" width="36" height="36" rx="8" fill="none" stroke="#fff" strokeWidth="4.5" mask={`url(#${uid}cut)`} />
      <path d="M20.5 30.5l7 7 13-14" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="46" r="9.5" fill="#fff" />
      <path d="M46 41.5V46l3 2" fill="none" stroke="#1D4ED8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
