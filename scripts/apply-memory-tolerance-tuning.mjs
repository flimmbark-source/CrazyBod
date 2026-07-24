import fs from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

const cognitivePath = 'src/minigames/cognitive.jsx'
let cognitive = fs.readFileSync(cognitivePath, 'utf8')

cognitive = replaceOnce(
  cognitive,
  `  useEffect(() => {\n    if (phase !== 'study') return undefined\n    const timer = window.setTimeout(() => setPhase('interrupt'), 800)\n    return () => window.clearTimeout(timer)\n  }, [phase])`,
  `  useEffect(() => {\n    if (phase !== 'study' && phase !== 'review') return undefined\n    const nextPhase = phase === 'study' ? 'interrupt' : 'recall'\n    const timer = window.setTimeout(() => setPhase(nextPhase), 850)\n    return () => window.clearTimeout(timer)\n  }, [phase])`,
  'Interrupted Thought phase timer',
)

cognitive = replaceOnce(
  cognitive,
  `    if (sequence[index] !== icon) {\n      setWrong(true)\n      setIndex(0)\n      window.setTimeout(() => setWrong(false), 180)\n      return\n    }`,
  `    if (sequence[index] !== icon) {\n      setWrong(true)\n      setIndex(0)\n      setPhase('review')\n      window.setTimeout(() => setWrong(false), 180)\n      return\n    }`,
  'Interrupted Thought failure handling',
)

cognitive = replaceOnce(
  cognitive,
  `      {phase === 'study' && <><small>KEEP THIS THOUGHT</small><div className="thought-sequence">{sequence.map((icon) => <b key={icon}>{icon}</b>)}</div></>}`,
  `      {(phase === 'study' || phase === 'review') && (\n        <>\n          <small>{phase === 'review' ? 'HERE IT WAS' : 'KEEP THIS THOUGHT'}</small>\n          <div className="thought-sequence">{sequence.map((icon) => <b key={icon}>{icon}</b>)}</div>\n        </>\n      )}`,
  'Interrupted Thought study rendering',
)

cognitive = replaceOnce(
  cognitive,
  `    const good = phaseRef.current < 0.14 || phaseRef.current > 0.86`,
  `    const good = phaseRef.current < 0.22 || phaseRef.current > 0.78`,
  'Racing Heart timing window',
)

fs.writeFileSync(cognitivePath, cognitive)

const sensoryPath = 'src/minigames/sensory.jsx'
let sensory = fs.readFileSync(sensoryPath, 'utf8')

sensory = replaceOnce(
  sensory,
  `  useEffect(() => {\n    const timer = window.setTimeout(() => setShowing(false), 850)\n    return () => window.clearTimeout(timer)\n  }, [])`,
  `  useEffect(() => {\n    if (!showing) return undefined\n    const timer = window.setTimeout(() => setShowing(false), 850)\n    return () => window.clearTimeout(timer)\n  }, [showing])`,
  'Pins and Needles reveal timer',
)

sensory = replaceOnce(
  sensory,
  `    if (!targets.includes(index)) {\n      setWrong(index)\n      setSelected([])\n      window.setTimeout(() => setWrong(null), 180)\n      return\n    }`,
  `    if (!targets.includes(index)) {\n      setWrong(index)\n      setSelected([])\n      setShowing(true)\n      window.setTimeout(() => setWrong(null), 180)\n      return\n    }`,
  'Pins and Needles failure review',
)

fs.writeFileSync(sensoryPath, sensory)

const physicalPath = 'src/minigames/physical.jsx'
let physical = fs.readFileSync(physicalPath, 'utf8')

physical = replaceOnce(
  physical,
  `    const level = Math.abs(tiltRef.current) < 3\n    steadyRef.current = clamp(steadyRef.current + (level ? delta : -delta), 0, 950)`,
  `    const level = Math.abs(tiltRef.current) < 6\n    steadyRef.current = clamp(steadyRef.current + (level ? delta : -delta * 0.65), 0, 950)`,
  'Dizziness success tolerance',
)

fs.writeFileSync(physicalPath, physical)
