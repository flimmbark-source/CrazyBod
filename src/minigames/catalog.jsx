import {
  BalanceGame,
  JointSlipGame,
  MuscleLockGame,
  PressurePointGame,
  SpiralGame,
  TremorGame,
  WeakGripGame,
} from './physical.jsx'
import {
  CheckingGame,
  DirectionLossGame,
  PackingCheckGame,
  TaskSwitchingGame,
  WorkingMemoryGame,
} from './cognitive.jsx'
import {
  AfterimageGame,
  HeavyEyesGame,
  LightSensitivityGame,
  MicroRestGame,
} from './sensory.jsx'
import {
  DizzinessGame,
  InterruptedThoughtGame,
  PinsNeedlesGame,
  RacingHeartGame,
} from './retuned.jsx'

export const MICROGAME_NAMES = {
  discomfort: 'DISCOMFORT',
  anxiety: 'ANXIETY',
  brainFog: 'BRAIN FOG',
  fatigue: 'FATIGUE',
  balance: 'BALANCE',
  tremor: 'TREMOR',
  jointSlip: 'JOINT SLIP',
  muscleLock: 'MUSCLE LOCK',
  weakGrip: 'WEAK GRIP',
  dizziness: 'DIZZINESS',
  pressurePoint: 'PRESSURE POINT',
  spiral: 'SPIRAL',
  workingMemory: 'WORKING MEMORY',
  taskSwitching: 'TASK SWITCHING',
  directionLoss: 'DIRECTION LOSS',
  packingCheck: 'PACKING CHECK',
  interruptedThought: 'INTERRUPTED THOUGHT',
  checking: 'CHECKING',
  racingHeart: 'RACING HEART',
  heavyEyes: 'HEAVY EYES',
  microRest: 'MICRO-REST',
  lightSensitivity: 'LIGHT SENSITIVITY',
  pinsNeedles: 'PINS & NEEDLES',
  afterimage: 'AFTERIMAGE',
}

const COMPONENTS = {
  balance: BalanceGame,
  tremor: TremorGame,
  jointSlip: JointSlipGame,
  muscleLock: MuscleLockGame,
  weakGrip: WeakGripGame,
  dizziness: DizzinessGame,
  pressurePoint: PressurePointGame,
  spiral: SpiralGame,
  workingMemory: WorkingMemoryGame,
  taskSwitching: TaskSwitchingGame,
  directionLoss: DirectionLossGame,
  packingCheck: PackingCheckGame,
  interruptedThought: InterruptedThoughtGame,
  checking: CheckingGame,
  racingHeart: RacingHeartGame,
  heavyEyes: HeavyEyesGame,
  microRest: MicroRestGame,
  lightSensitivity: LightSensitivityGame,
  pinsNeedles: PinsNeedlesGame,
  afterimage: AfterimageGame,
}

export function NewMicrogameContent({ kind, onResolve }) {
  const Component = COMPONENTS[kind]
  return Component ? <Component onResolve={onResolve} /> : null
}
