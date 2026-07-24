import fs from 'node:fs'

const path = 'src/world/JourneyScene.jsx'
let source = fs.readFileSync(path, 'utf8')

const wallAnchor = `      <Box position={[-3.86, 0.15, -1]} size={[0.12, 0.28, 13.7]} color="#876c62" />
      <Box position={[3.86, 0.15, -1]} size={[0.12, 0.28, 13.7]} color="#876c62" />`

const sealedWall = `${wallAnchor}

      {/* Seal the wide bedroom shell around the narrower entry hall. */}
      <Box position={[-3.1, 2.2, -7.88]} size={[1.8, 4.4, 0.22]} color="#c8b49a" />
      <Box position={[3.1, 2.2, -7.88]} size={[1.8, 4.4, 0.22]} color="#c8b49a" />
      <Box position={[0, 4.06, -7.88]} size={[4.4, 0.58, 0.22]} color="#c8b49a" />`

if (!source.includes(wallAnchor)) {
  throw new Error('Could not find bedroom wall anchor')
}
source = source.replace(wallAnchor, sealedWall)

const floatingTowel = `        <Box position={[2.15, 1.76, -2.62]} size={[0.58, 0.1, 0.08]} color="#564c4d" />
        <Box position={[2.15, 1.48, -2.57]} size={[0.5, 0.52, 0.05]} color="#c98670" />`

if (!source.includes(floatingTowel)) {
  throw new Error('Could not find floating towel and rail')
}
source = source.replace(floatingTowel, '')

fs.writeFileSync(path, source)
