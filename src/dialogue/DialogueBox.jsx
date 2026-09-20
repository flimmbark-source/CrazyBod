import MorningIcon from '../morning/morningIcons.jsx'

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
  getOptionProps = null,
  renderOption = null,
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
      {/* A face with sound coming out of it, so it is obvious at a glance that
          someone is talking to you — the initial in the circle alone did not
          say "speech" to anyone who had not already worked the game out. */}
      <div className="speaker-row">
        <span className="portrait">
          <span className="portrait-initial" aria-hidden="true">{dialogue.speaker.slice(0, 1)}</span>
          <span className="portrait-speaking" aria-hidden="true"><MorningIcon name="speaking" /></span>
        </span>
        <div>
          <strong className="speaker-name">
            <span className="speaker-speaking-dot" aria-hidden="true" />
            {dialogue.speaker}
          </strong>
          <p>{scrambleText(dialogue.line, distortion)}</p>
        </div>
      </div>
      {beforeOptions}
      <div className="dialogue-options">
        {dialogue.options.map((option, index) => {
          const optionProps = getOptionProps?.(option, index) ?? {}
          const optionStyle = {
            '--option-index': index,
            '--load': load,
            ...optionProps.style,
          }

          return (
            <button
              key={option.key ?? `${option}-${index}`}
              type="button"
              {...optionProps}
              style={optionStyle}
              onClick={(event) => {
                optionProps.onClick?.(event)
                if (!event.defaultPrevented) onAnswer(index)
              }}
            >
              {renderOption
                ? renderOption(option, index)
                : scrambleText(String(option), distortion >= 3 ? 2 : distortion - 1)}
            </button>
          )
        })}
      </div>
      {afterOptions}
    </section>
  )
}
