# What this branch is

The game is **`a24c14c`** — the original, before any of the work in this
session — plus **the Morning** and nothing else. Every other change from that
session was reverted. Anything you want back is still in git:

    git show pre-reset-full-work            # the tag holding all of it
    git diff a24c14c pre-reset-full-work    # everything that was in there

Verify this branch against the original with:

    git diff a24c14c HEAD -- <path>

---

## The day: untouched

`gameConfig.js`, `pacingConfig.js`, `pacingDirector.js`, `styles.css`,
`skillTreeConfig.js`, `SkillTreeScreen.jsx`, `DialogueBox.jsx`,
`techniqueEngine.js`, `PlanTechnique.jsx`, `StretchTechnique.jsx`,
`endScreens*.css`, the audio hooks and the minigame catalog are **byte-identical
to `a24c14c`**. So the day is the original one:

- Starts beside the bed. `WAKING UP` → `GETTING READY` → `WALKING TO THE CAFÉ`
  → `ORDERING` → `SITTING DOWN`, 50 seconds.
- Overload meter back under the clock at the top left; phase label centred.
- Original pacing, original spawn weights, no difficulty ramp.
- Original skill tree, original copy, original techniques, original end screens.

## What was added

### The Morning (new files only)

`src/morning/` — the untimed house: the room's objects drawn in 3D, walking to
what you click, click-and-hold to look around, the mirror / stretch / checklist
techniques, and the front door that starts the day. Each object carries a soft
yellow glow; its name only appears while the cursor is on it. The front door
keeps its label pinned, since it is the way out. Every Morning begins standing
beside the bed.

`src/morning/PracticeSession.jsx` + `practiceConfig.js` — a practice is a short
run of the day's real minigames. `keys`, `clothes` and `window` send three, one
at a time, unlosable; `coffee` sends four in pairs; `water` sends five at random
behind a real 3-slot overload meter and can be lost.

### Its tutorial

Runs inside the Morning only, when the switch is on:
`walking → first (mid-walk, the walk stops where it stands) → second (at the
mirror) → summary → meter → room → door`. The summary is the original
`HOW THE DAY WORKS`; `meter`, `room` and `door` are three tips pinned to the
overload meter, the room and the front door.

### The door into it

`ResultsScreen.jsx` gains a **PRACTICE** button under TRY ANOTHER DAY and a
**TUTORIAL** switch under the skill tree; `PLAY TUTORIAL` is gone. That is the
only change to any day-facing screen.

### Three files moved, not rewritten

To let the Morning show the day's real minigames, code was lifted out of
`App.jsx` unchanged:

- `src/minigames/core.jsx` — the four original microgames
- `src/minigames/window.jsx` — `MicrogameWindow` and its placement geometry
- `src/ui/OverloadMeter.jsx` — the meter, same markup as the original

`App.jsx` imports them instead of defining them. No behaviour changed.

`RehearsalTechnique.jsx` gains one optional `onAnswered` callback, used only by
the Morning.

## Known deviations from the original

1. **The apartment has a kitchen counter and a window** that it did not have
   before. The Morning's keys, coffee, water and window spots sit on them, so
   they had to stay — which means they are also visible during the day's
   getting-ready sequence. Say the word and I will hide them outside the
   Morning.
2. ~~The end screens are static under reduce-motion.~~ **Diagnosed and
   softened.** The `@media (prefers-reduced-motion: reduce)` blocks in
   `endScreens.css` and `homeReturn.css` were killing every animation on those
   screens, leaving a still frame for two seconds. Measured with the browser's
   own `getAnimations()`: motion on, 90 of 90 frames had running animations;
   motion reduced, 0 of 62 did. Those screens now fade their words in under the
   setting -- opacity only, no travel, shake or scaling -- so they are alive
   without breaking what the setting is for. Nothing changes for anyone with
   motion enabled.

## Test baseline

`npm test` — 80 pass, 14 fail. The same 14 failed at `a24c14c`
(mandalaState, two pacingDirector upgrade tests, progression, swordPhysics).
