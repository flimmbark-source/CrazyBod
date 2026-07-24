import fs from 'node:fs'

const path = 'src/minigames/physical.jsx'
const source = fs.readFileSync(path, 'utf8')
const before = `    steadyRef.current = clamp(steadyRef.current + (centered ? delta : -delta * 1.15), 0, 1500)`
const after = `    steadyRef.current = clamp(steadyRef.current + (centered ? delta : 0), 0, 1500)`

if (!source.includes(before)) {
  throw new Error('Could not find Balance progress update')
}

fs.writeFileSync(path, source.replace(before, after))
