// Line icons from the KenDo design, drawn on a 24px grid.
const paths = {
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 4h16l2 12v4H2v-4L4 4Z" />
      <path d="M2 15h6l2 3h4l2-3h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 3v18M15 3v18M6 7v4m6-4v8m6-8v3" />
    </>
  ),
  note: (
    <>
      <path d="M4 3h16v13l-5 5H4V3Z" />
      <path d="M15 21v-5h5M8 8h8m-8 4h5" />
    </>
  ),
  focus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  habit: <path d="M12 21C5 17 2 13 3 8s7-6 9-1c2-5 8-4 9 1s-2 9-9 13Z" />,
  chart: <path d="M4 3v18h17M8 16v-4m5 4V8m5 8V5" />,
  matrix: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  map: (
    <>
      <rect x="8" y="2" width="8" height="5" rx="1" />
      <rect x="2" y="17" width="6" height="5" rx="1" />
      <rect x="16" y="17" width="6" height="5" rx="1" />
      <path d="M12 7v5M5 17v-5h14v5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" fill="var(--surface)" />
      <circle cx="16" cy="12" r="2" fill="var(--surface)" />
      <circle cx="8" cy="18" r="2" fill="var(--surface)" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  fire: <path d="M12 2c2 6 7 7 7 12a7 7 0 0 1-14 0c0-3 2-5 4-7l1 5c3-3 2-7 2-10Z" />,
  play: <path d="m8 4 12 8-12 8V4Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  reset: <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />,
  pin: <path d="m9 3 10 10-3 1-3 4-3-4-4-3 4-3-1-5ZM9 15l-6 6" />,
  archive: (
    <>
      <rect x="3" y="3" width="18" height="4" rx="1" />
      <path d="M5 7v14h14V7M10 11h4" />
    </>
  ),
  trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  edit: <path d="m14 4 6 6-10 10-7 1 1-7L14 4Zm0 0 3-3 6 6-3 3" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  moon: <path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  team: (
    <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4" />
  ),
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  leaf: <path d="M20 3C7 2 2 7 5 15c7 6 15 0 15-12ZM3 21 16 8" />,
  repeat: <path d="M4 10V5h15l-3-3M20 14v5H5l3 3M19 5l-3 3M5 19l3-3" />,
  link: <path d="m10 14 4-4m-5 6-2 2a4 4 0 0 1-6-6l5-5m9 1 2-2a4 4 0 0 1 6 6l-5 5" />,
}

export type IconName = keyof typeof paths

export const isIconName = (name: string): name is IconName => name in paths

export default function Icon({ name, style }: { name: IconName; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={style}>
      {paths[name]}
    </svg>
  )
}
