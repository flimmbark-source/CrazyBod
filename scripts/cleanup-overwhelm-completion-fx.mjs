import fs from 'node:fs'

const path = 'src/App.jsx'
let source = fs.readFileSync(path, 'utf8')

const shards = `const COMPLETION_SHARDS = [
  { dx: '-118px', dy: '-78px', start: '-12deg', end: '-185deg', width: '34px', height: '20px' },
  { dx: '-52px', dy: '-116px', start: '8deg', end: '215deg', width: '24px', height: '38px' },
  { dx: '40px', dy: '-122px', start: '-5deg', end: '165deg', width: '42px', height: '18px' },
  { dx: '118px', dy: '-66px', start: '14deg', end: '224deg', width: '29px', height: '30px' },
  { dx: '132px', dy: '22px', start: '-8deg', end: '-160deg', width: '45px', height: '19px' },
  { dx: '72px', dy: '92px', start: '6deg', end: '198deg', width: '26px', height: '35px' },
  { dx: '-34px', dy: '112px', start: '-15deg', end: '-210deg', width: '39px', height: '21px' },
  { dx: '-126px', dy: '54px', start: '11deg', end: '175deg', width: '28px', height: '32px' },
]`

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

for (const block of [shards, layer, component]) {
  while (source.includes(`${block}\n\n${block}`)) {
    source = source.replace(`${block}\n\n${block}`, block)
  }
}

const shardCount = source.split('const COMPLETION_SHARDS').length - 1
const layerCount = source.split('className="completion-fx-layer"').length - 1
const componentCount = source.split('function CompletionBurst').length - 1
if (shardCount !== 1 || layerCount !== 1 || componentCount !== 1) {
  throw new Error(`Expected one shard constant/layer/component, found ${shardCount}/${layerCount}/${componentCount}`)
}

fs.writeFileSync(path, source)
console.log('Collapsed duplicated completion FX source.')
