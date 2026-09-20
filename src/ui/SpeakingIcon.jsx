// A face with sound coming out of it. The dialogue portrait used to be just the
// speaker's initial in a circle, which did not say "someone is talking to you"
// to anyone who had not already worked the game out.
export default function SpeakingIcon() {
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
      <circle cx="10" cy="9.5" r="5.5" />
      <path d="M8 9h.01M12 9h.01M8.2 12.2a3.2 3.2 0 0 0 3.6 0" />
      <path d="M17.4 7.2a5 5 0 0 1 0 5.6M20 5.4a8 8 0 0 1 0 9.2" />
    </svg>
  )
}
