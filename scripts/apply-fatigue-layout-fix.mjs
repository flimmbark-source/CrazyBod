import fs from 'node:fs'

const path = 'src/App.jsx'
let source = fs.readFileSync(path, 'utf8')

const replaceOnce = (needle, replacement, label) => {
  if (!source.includes(needle)) {
    if (source.includes(replacement)) return
    throw new Error(`Could not find ${label}`)
  }
  source = source.replace(needle, replacement)
}

replaceOnce(
  `      <button type="button" onClick={shift} style={{ transform: \`translateX(\${(presses % 3 - 1) * 16}px)\` }}>
        SHIFT
      </button>`,
  `      <button type="button" onClick={shift} style={{ transform: \`translateX(\${(presses % 3 - 1) * 16}px)\` }}>
        ADJUST
      </button>`,
  'discomfort button label',
)

replaceOnce(
  `    <div className="fatigue-game">
      <div className="heavy-lid" style={{ transform: \`translateY(\${44 - (held / needed) * 44}px)\` }} />
      <button`,
  `    <div className="fatigue-game">
      <div className="fatigue-eye">
        <div className="heavy-lid" style={{ transform: \`translateY(\${44 - (held / needed) * 44}px)\` }} />
      </div>
      <button`,
  'fatigue eye layout',
)

fs.writeFileSync(path, source)
console.log('Applied fatigue layout and discomfort label fixes.')
