// Technique content and the small amount of pure logic the technique
// components share. Prompt sequences live here as data so their wording and
// mix can change without touching component code.

// Rehearsal prompt structure (as specified):
//   { line, options, correctOption }
// correctOption: an index means there is an anticipated correct answer.
// correctOption: null means any response is valid (free-response).
export const REHEARSAL_SEQUENCE = {
  prompts: [
    {
      line: 'You picture walking in. What do you lead with?',
      options: ['"Hey, good to see you."', '"...sorry, one second."', '"I almost didn\'t come."'],
      correctOption: null, // free response — any answer advances
    },
    {
      line: 'They ask how you have been. Keep it level.',
      options: ['"Honestly? Not great."', '"Good, busy, but good."', '"Why are you asking?"'],
      correctOption: 1,
    },
    {
      line: 'Order without second-guessing it.',
      options: ['"Umm... I don\'t know yet."', '"The usual, please."', '"Whatever is easiest."'],
      correctOption: 1,
    },
  ],
}

// Run Through the Plan: pick the morning's things up in order. `order` is the
// intended position in the sequence; `x`/`y` place the thing on the room
// picture (a 0-100 grid) so it is grabbed where it actually sits.
export const PLAN_SEQUENCE = {
  steps: [
    { key: 'keys', label: 'Keys', order: 0, x: 44, y: 54 },
    { key: 'wallet', label: 'Wallet', order: 1, x: 61, y: 54 },
    { key: 'phone', label: 'Phone', order: 2, x: 21, y: 34 },
    { key: 'door', label: 'Door', order: 3, x: 82, y: 50 },
  ],
}

// Stretch Every Joint: a pre-departure ritual. The player taps each joint where
// it sits on the body picture (a 0-100 grid) to loosen it. There is nothing to
// get "wrong" — you either finished warming up before you had to leave, or you
// ran out of time and didn't.
export const STRETCH_SEQUENCE = {
  joints: [
    { key: 'neck', label: 'Neck', x: 50, y: 20 },
    { key: 'shoulders', label: 'Shoulders', x: 32, y: 27 },
    { key: 'wrists', label: 'Wrists', x: 22, y: 55 },
    { key: 'back', label: 'Back', x: 62, y: 38 },
    { key: 'hips', label: 'Hips', x: 50, y: 49 },
    { key: 'knees', label: 'Knees', x: 61, y: 66 },
    { key: 'ankles', label: 'Ankles', x: 64, y: 82 },
  ],
}

// The physical symptoms a completed stretch thins out early in the walk. These
// are exactly the minigames authored in physical.jsx.
export const PHYSICAL_SYMPTOM_KINDS = [
  'balance',
  'jointSlip',
  'muscleLock',
  'pressurePoint',
  'spiral',
  'tremor',
  'weakGrip',
]

// The stretch pays off only if every joint was loosened before the window ran
// out. Failure is gentle: you simply do not get the benefit this run.
export function stretchSucceeded({ finished }) {
  return Boolean(finished)
}

export function scoredPromptCount(prompts) {
  return prompts.filter((prompt) => prompt.correctOption !== null).length
}

// A scheduled technique (rehearsal or plan) succeeds only when it finished
// within its window with nothing done wrong.
export function scheduledSucceeded({ finished, wrong }) {
  return finished && !wrong
}

// Suppress Visible Distress removal rule. "Destroy half" and "leave a fixed
// resulting load" are reconciled as suppress = ceil(load/2), remaining =
// floor(load/2).
export function suppressionSplit(load) {
  return {
    suppressed: Math.ceil(load / 2),
    remaining: Math.floor(load / 2),
  }
}

// A rehearsal succeeds only if every scored prompt was answered correctly and
// the sequence finished before the window expired.
export function rehearsalSucceeded({ finished, wrongScoredAnswers }) {
  return finished && wrongScoredAnswers === 0
}
