// THE MANDALA HUB.
//
// This is the single authored controller for a Mandala descent. Everything the
// director needs is data here: the run is a list of SECTIONS (beginning, middle,
// end, ...), each section a list of WAVES, each wave a set of spawns plus the
// trigger that advances to the next wave and any special effects.
//
// Shape (all fields optional except where noted):
//
//   sections: [
//     {
//       id, name,
//       effects: { ...see Effects below }   // section-wide, inherited by waves
//       waves: [
//         {
//           id,
//           spawns: [
//             { kind, count, staggerSeconds, delaySeconds }  // enemy type + how
//           ],                                               // many + spacing
//           advance: { type, ... }        // wave progression trigger:
//             //   { type: 'cleared' }                  -> all this wave's foes killed
//             //   { type: 'timer',    seconds }        -> after N seconds
//             //   { type: 'kills',    count }          -> after N kills this wave
//             //   { type: 'distance', distance }       -> after N units travelled
//           effects: { ... }              // wave-specific, overrides the section
//         },
//       ],
//     },
//   ]
//
// Effects (a section or wave may declare any of these; wave overrides section):
//
//   background:  { color, fogNear, fogFar }                  // the tube's look
//   perception:  { invertPointerX, bladeProfile }            // how you perceive /
//                //   invertPointerX: mirror horizontal aim  //   wield the sword
//                //   bladeProfile: 'light' | 'heavy' | 'default'
//   interaction: { twistScale, travelScale }                 // how things move
//                //   twistScale: multiply the tube's roll
//                //   travelScale: multiply base travel speed
//
// The perception/interaction menu is intentionally open-ended: add a key here,
// read it where the sword or tube is driven, and any section/wave can switch it
// on. Only the keys listed above are wired today; unknown keys are ignored.

export const MANDALA_SCRIPT = Object.freeze({
  sections: [
    {
      id: 'beginning',
      name: 'THE DESCENT',
      effects: {
        background: { color: '#0d0a14', fogNear: 12, fogFar: 62 },
      },
      waves: [
        {
          id: 'b-w1',
          spawns: [{ kind: 'checking', count: 2, staggerSeconds: 1.8 }],
          advance: { type: 'cleared' },
        },
        {
          id: 'b-w2',
          spawns: [
            { kind: 'microRest', count: 2, staggerSeconds: 1.6 },
            { kind: 'workingMemory', count: 1, staggerSeconds: 1.6, delaySeconds: 0.8 },
          ],
          advance: { type: 'timer', seconds: 14 },
        },
        {
          id: 'b-w3',
          spawns: [{ kind: 'racingHeart', count: 3, staggerSeconds: 1.3 }],
          advance: { type: 'kills', count: 3 },
        },
      ],
    },
    {
      id: 'middle',
      name: 'THE CHURN',
      effects: {
        // The tube deepens and spins harder as you go under.
        background: { color: '#120a1e', fogNear: 11, fogFar: 58 },
        interaction: { twistScale: 2.2 },
      },
      waves: [
        {
          id: 'm-w1',
          spawns: [
            { kind: 'dizziness', count: 3, staggerSeconds: 1.2 },
            { kind: 'spiral', count: 2, staggerSeconds: 1.4, delaySeconds: 1 },
          ],
          advance: { type: 'cleared' },
        },
        {
          id: 'm-w2',
          spawns: [
            { kind: 'directionLoss', count: 2, staggerSeconds: 1.0 },
            { kind: 'packingCheck', count: 2, staggerSeconds: 1.0, delaySeconds: 0.6 },
          ],
          // A heavier blade for the churn — momentum you have to commit to.
          effects: { perception: { bladeProfile: 'heavy' } },
          advance: { type: 'timer', seconds: 16 },
        },
      ],
    },
    {
      id: 'end',
      name: 'THE CORE',
      effects: {
        // Everything tilts: red core, mirrored aim, a lighter frantic blade.
        background: { color: '#1a0910', fogNear: 9, fogFar: 52 },
        perception: { invertPointerX: false, bladeProfile: 'light' },
        interaction: { twistScale: 3.2 },
      },
      waves: [
        {
          id: 'e-w1',
          spawns: [{ kind: 'afterimage', count: 4, staggerSeconds: 1.0 }],
          advance: { type: 'kills', count: 4 },
        },
        {
          id: 'e-w2',
          spawns: [
            { kind: 'lightSensitivity', count: 3, staggerSeconds: 0.8 },
            { kind: 'tremor', count: 2, staggerSeconds: 0.9, delaySeconds: 0.5 },
          ],
          advance: { type: 'cleared' },
        },
      ],
    },
  ],
})
