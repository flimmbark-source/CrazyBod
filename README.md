# CrazyBod

A React Three Fiber game-jam prototype for the theme **Countdown**.

The character moves automatically through an ordinary day. Events in the low-poly world create tiny internal-state microgames. Those microgames persist until completed, accumulate on screen, and eventually cause overload.

## Current playable loop

- Automatically travel from waking up to sitting down at a café.
- Clear four popup microgames: discomfort, anxiety, brain fog, and fatigue.
- Encounter shuffled variations within each microgame family.
- Earn points continuously while staying out.
- Press **Go Home** at any time to safely cash out.
- Fill every Overload slot and overload, ending the day with a severe score penalty.
- Handle a café conversation whose text and options degrade as overload approaches.

The microgames represent feelings and internal friction caused by the character's situation. They do not reproduce the literal actions happening in the 3D world.

## Progression and the skill tree

Each finished day banks its final score. After the first day the **skill tree**
unlocks, where banked score buys techniques:

- **This Is Normal** — +1 Overload capacity (the first day starts at 5).
- **Rehearse the Conversation** — a scheduled prompt that grants +1 capacity for
  the run on success, or spawns two extra minigames on failure.
- **Run Through the Plan** — a scheduled sequence that staggers the next pair
  spawns.
- **Hold It Together** — automatically targets the next remaining minigame after
  the active one is cleared.
- **Run on Adrenaline** — pauses new spawns for six seconds at one below
  capacity.
- **Suppress Visible Distress** — an emergency Space-mash that suppresses half of
  the active minigames when you would overload.

Owned nodes can be toggled on and off. Progression persists in `localStorage`;
**Reset Tree** clears purchases (no refund) and **Reset Save** returns to the
original first-run state.

## Controls

Click a microgame window to make it the active keyboard target. The highlighted window is the only microgame that receives keyboard input. With **Hold It Together** enabled, clearing the active window automatically selects the next remaining minigame.

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

## Tests

Pure progression, config, pacing and technique logic are covered by the
built-in Node test runner:

```bash
npm test
```

## Prototype tuning

The authoritative day/scoring constants and phases live in
`src/config/gameConfig.js`:

- `DAY_LENGTH`
- `BASE_OVERLOAD_LIMIT`
- `SCORE_PER_SECOND`
- `PHASES`

Skill-tree costs, trigger times, and technique parameters are data in
`src/progression/skillTreeConfig.js`; spawn pacing weights live in
`src/pacingConfig.js`.
