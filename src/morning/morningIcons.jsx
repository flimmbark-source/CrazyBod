// Small line icons for the Morning's interactive spots. Inline SVG (rather than
// emoji) so every platform draws the same shape, the stroke picks up the spot's
// colour, and nothing depends on a font that may not be installed.
const PATHS = {
  coffee: <path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 9h2a2 2 0 0 1 0 4h-2M6 4c0 1 1 1 1 2M10 4c0 1 1 1 1 2M14 4c0 1 1 1 1 2" />,
  water: <path d="M8 4h8l-1 15a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM8.4 12h7.2" />,
  clothes: <path d="M9 4l3 2 3-2 4 3-2 3-1-1v9H8v-9l-1 1-2-3z" />,
  window: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  keys: (
    <>
      <circle cx="8" cy="8" r="3.4" />
      <path d="M10.4 10.4L19 19M16.5 16.5l2-2M14 14l2-2" />
    </>
  ),
  mirror: (
    <>
      <ellipse cx="12" cy="10" rx="6" ry="7.5" />
      <path d="M12 17.5V21M8 21h8M9.6 6.6a4.6 5.6 0 0 0-1.4 3.2" />
    </>
  ),
  mat: <path d="M4 15h16M5 15l2-6h10l2 6M9 9V6h6v3M8 19h8" />,
  checklist: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M8.5 9l1.6 1.6L13 7.6M8.5 15l1.6 1.6L13 13.6M15.5 9.5h.01M15.5 15.5h.01" />
    </>
  ),
  door: (
    <>
      <path d="M6 3h9a1 1 0 0 1 1 1v17H6z" />
      <path d="M4 21h16M13 12.5h.01" />
    </>
  ),
  house: <path d="M4 11l8-7 8 7M6.5 9.6V20h11V9.6M10 20v-5h4v5" />,
  speaking: (
    <>
      <circle cx="10" cy="9.5" r="5.5" />
      <path d="M8 9h.01M12 9h.01M8.2 12.2a3.2 3.2 0 0 0 3.6 0" />
      <path d="M17.4 7.2a5 5 0 0 1 0 5.6M20 5.4a8 8 0 0 1 0 9.2" />
    </>
  ),
}

export default function MorningIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] ?? PATHS.house}
    </svg>
  )
}
