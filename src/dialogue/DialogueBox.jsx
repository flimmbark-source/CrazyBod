function scrambleText(text, intensity) {
  if (intensity <= 0) return text
  const words = text.split(' ')
  if (intensity >= 2 && words.length > 4) {
    const second = words[1]
    words[1] = words[3]
    words[3] = second
  }
  if (intensity >= 3) {
    for (let index = 2; index < words.length; index += 4) words[index] = '▒▒▒'
  }
  return words.join(' ')
}

export default function DialogueBox({
  dialogue,
  load = 0,
  distortion = 0,
  onAnswer,
  className = '',
  ariaLabel,
  beforeOptions = null,
  afterOptions = null,
}) {
  const classes = ['dialogue-box', `distortion-${distortion}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={classes}
      role="dialog"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      <div className="speaker-row">
        <span className="portrait">{dialogue.speaker.slice(0, 1)}</span>
        <div>
          <strong>{dialogue.speaker}</strong>
          <p>{scrambleText(dialogue.line, distortion)}</p>
        </div>
      </div>
      {beforeOptions}
      <div className="dialogue-options">
        {dialogue.options.map((option, index) => (
          <button
            key={`${option}-${index}`}
            type="button"
            style={{ '--option-index': index, '--load': load }}
            onClick={() => onAnswer(index)}
          >
            {scrambleText(option, distortion >= 3 ? 2 : distortion - 1)}
          </button>
        ))}
      </div>
      {afterOptions}
    </section>
  )
}
