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
      options: ['"Hey — good to see you."', '"...sorry, one second."', '"I almost didn\'t come."'],
      correctOption: null, // free response — any answer advances
    },
    {
      line: 'They ask how you have been. Keep it level.',
      options: ['"Honestly? Not great."', '"Good — busy, but good."', '"Why are you asking?"'],
      correctOption: 1,
    },
    {
      line: 'Order without second-guessing it.',
      options: ['"Umm... I don\'t know yet."', '"The usual, please."', '"Whatever is easiest."'],
      correctOption: 1,
    },
  ],
}

// Run Through the Plan: put the morning's steps back in order. `order` is the
// intended chronological position; the component presents them shuffled.
export const PLAN_SEQUENCE = {
  steps: [
    { label: 'Keys', order: 0 },
    { label: 'Wallet', order: 1 },
    { label: 'Phone', order: 2 },
    { label: 'Door', order: 3 },
  ],
}

export function scoredPromptCount(prompts) {
  return prompts.filter((prompt) => prompt.correctOption !== null).length
}

// A scheduled technique (rehearsal or plan) succeeds only when it finished
// within its window with nothing done wrong.
export function scheduledSucceeded({ finished, wrong }) {
  return finished && !wrong
}

// A rehearsal succeeds only if every scored prompt was answered correctly and
// the sequence finished before the window expired.
export function rehearsalSucceeded({ finished, wrongScoredAnswers }) {
  return finished && wrongScoredAnswers === 0
}
