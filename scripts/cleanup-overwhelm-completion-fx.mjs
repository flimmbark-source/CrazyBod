import fs from 'node:fs'

const path = 'src/App.jsx'
let source = fs.readFileSync(path, 'utf8')

const layer = `          <section className="completion-fx-layer" aria-hidden="true">
            {completionEffects.map((effect) => (
              <CompletionBurst key={effect.id} effect={effect} />
            ))}
          </section>`

const component = `function CompletionBurst({ effect }) {
  return (
    <div
      className={\`completion-burst kind-\${effect.kind}\`}
      style={{ '--burst-x': \`\${effect.x}px\`, '--burst-y': \`\${effect.y}px\` }}
    >
      <span className="completion-flash" />
      {COMPLETION_SHARDS.map((shard, index) => (
        <span
          key={index}
          className="completion-shard"
          style={{
            '--dx': shard.dx,
            '--dy': shard.dy,
            '--start-rotation': shard.start,
            '--end-rotation': shard.end,
            '--shard-width': shard.width,
            '--shard-height': shard.height,
          }}
        />
      ))}
      <strong className="completion-get">GET!</strong>
    </div>
  )
}`

while (source.includes(`${layer}\n\n${layer}`)) {
  source = source.replace(`${layer}\n\n${layer}`, layer)
}

while (source.includes(`${component}\n\n${component}`)) {
  source = source.replace(`${component}\n\n${component}`, component)
}

const layerCount = source.split('className="completion-fx-layer"').length - 1
const componentCount = source.split('function CompletionBurst').length - 1
if (layerCount !== 1 || componentCount !== 1) {
  throw new Error(`Expected one completion layer/component, found ${layerCount}/${componentCount}`)
}

fs.writeFileSync(path, source)
console.log('Collapsed duplicated completion FX source.')
