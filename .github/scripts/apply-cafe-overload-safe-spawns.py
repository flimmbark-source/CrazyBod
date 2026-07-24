from pathlib import Path
import re


def replace_once(text, pattern, replacement, label, flags=0):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'Could not patch {label}: matches={count}')
    return updated


app_path = Path('src/App.jsx')
app = app_path.read_text()

new_position = '''function positionFor(seed, index, existingGames) {
  const { viewportWidth, viewportHeight, width, height, compact } = microgameViewportSize()
  const minimumLeft = compact ? 2.5 : 3
  const maximumLeft = Math.max(
    minimumLeft,
    ((viewportWidth - width - 10) / viewportWidth) * 100,
  )
  const minimumTop = compact ? 18 : 15
  const maximumTop = Math.max(
    minimumTop,
    ((viewportHeight - height - 14) / viewportHeight) * 100,
  )
  const goHomeRect = document.querySelector('.go-home')?.getBoundingClientRect()
  const reserved = goHomeRect && goHomeRect.width > 0 && goHomeRect.height > 0
    ? {
        left: goHomeRect.left - 18,
        right: goHomeRect.right + 18,
        top: goHomeRect.top - 18,
        bottom: goHomeRect.bottom + 18,
      }
    : null
  let fallback = { left: minimumLeft, top: minimumTop }
  let hasSafeFallback = false

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const left = minimumLeft
      + seededFraction(seed, index * 31 + attempt * 2) * (maximumLeft - minimumLeft)
    const top = minimumTop
      + seededFraction(seed, index * 31 + attempt * 2 + 1) * (maximumTop - minimumTop)
    const candidateLeft = (left / 100) * viewportWidth
    const candidateTop = (top / 100) * viewportHeight
    const candidateRight = candidateLeft + width
    const candidateBottom = candidateTop + height
    const clearOfGoHome = !reserved || (
      candidateRight <= reserved.left
      || candidateLeft >= reserved.right
      || candidateBottom <= reserved.top
      || candidateTop >= reserved.bottom
    )

    if (!clearOfGoHome) continue
    const candidate = { left, top }
    if (!hasSafeFallback) {
      fallback = candidate
      hasSafeFallback = true
    }

    const separated = existingGames.every((game) => {
      const previousLeft = Number.parseFloat(game.position.left)
      const previousTop = Number.parseFloat(game.position.top)
      const horizontalDistance = ((left - previousLeft) / 100) * viewportWidth
      const verticalDistance = ((top - previousTop) / 100) * viewportHeight
      return Math.hypot(horizontalDistance, verticalDistance) >= Math.min(width, height) * 0.78
    })

    if (separated) {
      return {
        left: `${left.toFixed(1)}%`,
        top: `${top.toFixed(1)}%`,
      }
    }
  }

  return {
    left: `${fallback.left.toFixed(1)}%`,
    top: `${fallback.top.toFixed(1)}%`,
  }
}

function scrambleText'''
app = replace_once(
    app,
    r'function positionFor\(seed, index, existingGames\) \{.*?\n\}\n\nfunction scrambleText',
    new_position,
    'positionFor',
    re.S,
)

app = replace_once(
    app,
    r'  const load = microgames\.length\n  const distortion =',
    '''  const load = microgames.length
  const overloadRatio = Math.min(1, load / OVERLOAD_LIMIT)
  const overloadShake = Math.max(0, load - 2) * 0.8
  const homeShake = Math.max(0, load - 1) * 0.85
  const distortion =''',
    'overload state',
)

meter_pattern = r'''          <div className="load-meter" aria-label=\{`Overload \$\{load\} of \$\{OVERLOAD_LIMIT\}`\}>\n            <span>OVERLOAD</span>\n            <div className="load-pips">\n              \{Array\.from\(\{ length: OVERLOAD_LIMIT \}\)\.map\(\(_, index\) => \(\n                <i key=\{index\} className=\{index < load \? 'filled' : ''\} />\n              \)\)\}\n            </div>\n          </div>'''
meter_replacement = '''          <div
            className="load-meter"
            aria-label={`Overload ${load} of ${OVERLOAD_LIMIT}`}
            style={{
              '--overload': overloadRatio,
              '--overload-scale': 1 + overloadRatio * 0.16,
              '--overload-saturation': 1 + overloadRatio * 0.8,
              '--overload-contrast': 1 + overloadRatio * 0.14,
              '--overload-alpha': overloadRatio * 0.72,
              '--overload-shake': `${overloadShake}px`,
              '--overload-shake-neg': `${-overloadShake}px`,
            }}
          >
            <span>OVERLOAD</span>
            <div className="load-pips">
              {Array.from({ length: OVERLOAD_LIMIT }).map((_, index) => (
                <i key={index} className={index >= OVERLOAD_LIMIT - load ? 'filled' : ''} />
              ))}
            </div>
          </div>'''
app = replace_once(app, meter_pattern, meter_replacement, 'overload meter')

app = replace_once(
    app,
    r'''          <button className="go-home" type="button" onClick=\{goHome\} disabled=\{gameplayPaused\}>''',
    '''          <button
            className="go-home"
            type="button"
            onClick={goHome}
            disabled={gameplayPaused}
            style={{
              '--overload': overloadRatio,
              '--home-scale': 1 + overloadRatio * 0.1,
              '--home-shake': `${homeShake}px`,
              '--home-shake-neg': `${-homeShake}px`,
            }}
          >''',
    'Go Home markup',
)
app_path.write_text(app)

css_path = Path('src/styles.css')
css = css_path.read_text()

load_css = '''.load-meter {
  --overload: 0;
  --overload-scale: 1;
  --overload-saturation: 1;
  --overload-contrast: 1;
  --overload-alpha: 0;
  --overload-shake: 0px;
  --overload-shake-neg: 0px;
  position: absolute;
  z-index: 21;
  top: 88px;
  left: 22px;
  width: 148px;
  padding: 9px 11px;
  overflow: hidden;
  isolation: isolate;
  border: 2px solid #302b38;
  border-radius: 8px;
  color: #302b38;
  background: rgba(247, 240, 232, 0.92);
  box-shadow: 4px 4px 0 rgba(48, 43, 56, 0.55);
  transform: scale(var(--overload-scale));
  transform-origin: top left;
  filter: saturate(var(--overload-saturation)) contrast(var(--overload-contrast));
  transition: transform 180ms ease, filter 180ms ease, box-shadow 180ms ease;
}
.load-meter::after {
  content: "";
  position: absolute;
  z-index: 0;
  inset: 0;
  border-radius: inherit;
  background: #e0524d;
  opacity: var(--overload-alpha);
  pointer-events: none;
  transition: opacity 180ms ease;
}
.load-meter > * { position: relative; z-index: 1; }
.load-meter > span { display: block; margin-bottom: 7px; font-size: 10px; font-weight: 950; letter-spacing: 0.13em; }
.load-pips { display: flex; justify-content: flex-end; gap: 5px; }
.load-pips i { width: 16px; height: 9px; border: 2px solid #403848; border-radius: 2px; background: rgba(247, 240, 232, 0.7); }
.load-pips i.filled { background: #8f1725; box-shadow: inset 0 0 0 1px rgba(255, 235, 220, 0.28); }
.load-3 .load-meter { box-shadow: 5px 5px 0 rgba(82, 28, 38, 0.7), 0 0 12px rgba(224, 82, 77, 0.38); animation: overload-anger 0.62s steps(2) infinite; }
.load-4 .load-meter { box-shadow: 6px 6px 0 rgba(82, 28, 38, 0.78), 0 0 18px rgba(224, 82, 77, 0.52); animation: overload-anger 0.45s steps(2) infinite; }
.load-5 .load-meter, .load-6 .load-meter { box-shadow: 7px 7px 0 rgba(82, 28, 38, 0.86), 0 0 25px rgba(224, 82, 77, 0.68); animation: overload-anger 0.28s steps(2) infinite; }

.microgame-layer'''
css = replace_once(
    css,
    r'\.load-meter \{.*?\.load-pips i\.filled \{.*?\}\n\n\.microgame-layer',
    load_css,
    'overload CSS',
    re.S,
)

go_css = '''.go-home {
  --overload: 0;
  --home-scale: 1;
  --home-shake: 0px;
  --home-shake-neg: 0px;
  position: absolute;
  z-index: 45;
  right: 22px;
  bottom: 22px;
  width: 142px;
  padding: 11px 14px;
  border: 3px solid #282331;
  border-radius: 10px;
  color: #fffaf4;
  background: #4f5961;
  box-shadow: 6px 7px 0 rgba(40, 35, 49, 0.72);
  cursor: pointer;
  transform-origin: center;
  transition: background 180ms ease, filter 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}
.go-home:hover { background: #66757d; }
.load-2 .go-home { background: #65565e; animation: go-home-alarm 0.92s ease-in-out infinite; }
.load-3 .go-home { background: #77515a; box-shadow: 6px 7px 0 rgba(75, 27, 37, 0.76), 0 0 12px rgba(224, 82, 77, 0.34); animation: go-home-alarm 0.68s ease-in-out infinite; }
.load-4 .go-home { background: #8d414b; box-shadow: 7px 8px 0 rgba(75, 27, 37, 0.82), 0 0 18px rgba(224, 82, 77, 0.5); animation: go-home-alarm 0.48s ease-in-out infinite; }
.load-5 .go-home, .load-6 .go-home { background: #a92f3b; box-shadow: 8px 9px 0 rgba(75, 27, 37, 0.9), 0 0 25px rgba(224, 82, 77, 0.68); animation: go-home-alarm 0.31s ease-in-out infinite; }
.go-home:active'''
css = replace_once(
    css,
    r'\.go-home \{.*?\.go-home:hover \{ background: #66757d; \}\n\.go-home:active',
    go_css,
    'Go Home CSS',
    re.S,
)

keyframes = '''@keyframes overload-anger {
  0%, 100% { transform: translate(0, 0) rotate(0) scale(var(--overload-scale)); }
  25% { transform: translate(var(--overload-shake), 0) rotate(0.45deg) scale(var(--overload-scale)); }
  50% { transform: translate(0, 1px) rotate(-0.35deg) scale(var(--overload-scale)); }
  75% { transform: translate(var(--overload-shake-neg), 0) rotate(-0.5deg) scale(var(--overload-scale)); }
}
@keyframes go-home-alarm {
  0%, 100% { transform: translate(0, 0) rotate(0) scale(1); }
  32% { transform: translate(var(--home-shake), var(--home-shake-neg)) rotate(0.8deg) scale(var(--home-scale)); }
  58% { transform: translate(var(--home-shake-neg), 1px) rotate(-0.75deg) scale(var(--home-scale)); }
  78% { transform: translate(0, var(--home-shake-neg)) rotate(0.35deg) scale(1); }
}
@keyframes window-arrive'''
css = replace_once(css, r'@keyframes window-arrive', keyframes, 'overload keyframes')
css = replace_once(
    css,
    r'@media \(max-width: 820px\) \{',
    '''@media (prefers-reduced-motion: reduce) {
  .load-meter,
  .go-home { animation: none !important; }
}

@media (max-width: 820px) {''',
    'reduced motion rule',
)
css_path.write_text(css)

scene_path = Path('src/world/JourneyScene.jsx')
scene = scene_path.read_text()

buildings = '''  const buildings = [
    [-10.6, -77.0, 6.8, 8.6, 7.2, '#68717a'],
    [10.8, -77.4, 7.0, 9.2, 7.4, '#6c6670'],
    [-17.2, -82.5, 7.8, 11.5, 8.0, '#59666f'],
    [17.5, -83.0, 8.2, 12.5, 8.4, '#535e68'],
    [-11.8, -94.0, 7.0, 13.2, 8.2, '#6a626d'],
    [11.9, -94.5, 7.4, 12.0, 8.0, '#58666b'],
    [-2.5, -108.0, 9.0, 15.0, 8.5, '#55616b'],
    [7.5, -109.5, 7.2, 11.6, 7.8, '#65716e'],
  ]'''
scene = replace_once(
    scene,
    r'  const buildings = \[.*?\n  \]\n\n  return \(',
    buildings + '\n\n  return (',
    'cafe backdrop buildings',
    re.S,
)

door = '''      <Label text="CAFÉ" position={[0, 4.38, -72.86]} size={[3.9, 1.08]} />
      <Box position={[-1.28, 1.82, -74.55]} size={[0.18, 3.64, 2.5]} color="#654740" />
      <Box position={[1.28, 1.82, -74.55]} size={[0.18, 3.64, 2.5]} color="#654740" />
      <Box position={[0, 3.55, -74.55]} size={[2.72, 0.2, 2.5]} color="#654740" castShadow={false} />
      <Box position={[-1.28, 1.82, -73.38]} size={[0.18, 3.64, 0.5]} color="#4f3a38" />
      <Box position={[1.28, 1.82, -73.38]} size={[0.18, 3.64, 0.5]} color="#4f3a38" />
      <Box position={[0, 3.55, -73.38]} size={[2.72, 0.2, 0.5]} color="#4f3a38" />
      <Door
        position={[-1.26, 0, -73.18]}
        color="#4f5961"
        progress={cafeDoorProgress}
        openAngle={Math.PI * 0.5}
        width={2.52}
        height={3.45}
      />
      <Box position={[0, 0.02, -73.55]} size={[2.6, 0.08, 2.4]} color="#8f725c" />'''
scene = replace_once(
    scene,
    r'''      <Label text="CAFÉ" position=\{\[0, 4\.38, -72\.86\]\} size=\{\[3\.9, 1\.08\]\} />\n      <Door.*?\n      <Box position=\{\[0, 0\.02, -72\.9\]\} size=\{\[2\.6, 0\.08, 1\.1\]\} color="#8f725c" />''',
    door,
    'cafe doorway',
    re.S,
)
scene_path.write_text(scene)

print('Applied cafe, overload, and safe spawn changes')
