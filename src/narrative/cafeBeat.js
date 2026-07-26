export const CAFE_BEAT_PHASES = Object.freeze({
  INACTIVE: 'inactive',
  CONVERSATION: 'conversation',
  INTERLUDE: 'interlude',
  RUPTURE: 'rupture',
  DEPARTURE: 'departure',
  AFTERMATH: 'aftermath',
})

export const CAFE_BEAT_TIMINGS = Object.freeze({
  interludeMs: 5000,
  ruptureMs: 2100,
  departureMs: 2300,
  aftermathMs: 3000,
})

export const CAFE_DIALOGUE = Object.freeze([
  Object.freeze({
    speaker: 'Mara',
    line: "I need to ask you something. When I called last week, you said you'd come over. Then I didn't hear from you again.",
    options: Object.freeze([
      "I know. I'm sorry.",
      "I didn't disappear.",
      'Last week?',
    ]),
  }),
  Object.freeze({
    speaker: 'Mara',
    line: 'I was having a really bad night. I needed my friend.',
    options: Object.freeze([
      'I had a lot going on too.',
      "I didn't know it was that serious.",
      'What do you want me to say?',
    ]),
  }),
  Object.freeze({
    speaker: 'Mara',
    line: "Can you tell me what I've been trying to say to you?",
    options: Object.freeze([
      "That you're angry with me.",
      'That I should have come over.',
      "I don't know.",
    ]),
  }),
])

export const CAFE_RUPTURE_DIALOGUE = Object.freeze({
  speaker: 'Mara',
  line: "You're not even listening. I can't keep sitting here talking to someone who isn't here.",
  options: Object.freeze([]),
})

export function advanceCafeConversation(dialogueIndex) {
  if (!Number.isInteger(dialogueIndex) || dialogueIndex < 0) {
    throw new RangeError('dialogueIndex must be a non-negative integer')
  }

  if (dialogueIndex < CAFE_DIALOGUE.length - 1) {
    return {
      phase: CAFE_BEAT_PHASES.INTERLUDE,
      dialogueIndex: dialogueIndex + 1,
    }
  }

  return {
    phase: CAFE_BEAT_PHASES.RUPTURE,
    dialogueIndex: CAFE_DIALOGUE.length - 1,
  }
}

export function isCafeBeatFrozen(phase) {
  return phase === CAFE_BEAT_PHASES.RUPTURE
    || phase === CAFE_BEAT_PHASES.DEPARTURE
    || phase === CAFE_BEAT_PHASES.AFTERMATH
}
