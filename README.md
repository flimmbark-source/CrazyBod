# CrazyBod

A React Three Fiber game-jam prototype for the theme **Countdown**.

The character moves automatically through an ordinary day. Events in the low-poly world create tiny internal-state microgames. Those microgames persist until completed, accumulate on screen, and eventually cause overload.

## Current playable loop

- Automatically travel from waking up to sitting down at a café.
- Clear four popup microgames: discomfort, anxiety, brain fog, and fatigue.
- Encounter shuffled variations within each microgame family.
- Earn points continuously while staying out.
- Press **Go Home** at any time to safely cash out.
- Reach six simultaneous microgames and overload, ending the day with a severe score penalty.
- Handle a café conversation whose text and options degrade as overload approaches.

The microgames represent feelings and internal friction caused by the character's situation. They do not reproduce the literal actions happening in the 3D world.

## Controls

Click a microgame window to make it the active keyboard target. The highlighted window is the only microgame that receives keyboard input.

- **Discomfort:** follow the current adjustment prompt using the mouse, `A` / `D`, arrow keys, or `Space` depending on the variation.
- **Anxiety:** click the active pulse targets.
- **Brain Fog:** click the window, then use the arrow keys or `WASD`. The on-screen arrows remain available.
- **Fatigue:** press and hold the visible button, or hold `Space`. Some variations require releasing between pushes.
- **Dialogue:** press `1`, `2`, or `3`, or click a response.

No microgame can be dismissed or abandoned.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Prototype tuning

The main pacing values live at the top of `src/App.jsx`:

- `DAY_LENGTH`
- `OVERLOAD_LIMIT`
- `SCORE_PER_SECOND`
- `MICROGAME_SCRIPT`
