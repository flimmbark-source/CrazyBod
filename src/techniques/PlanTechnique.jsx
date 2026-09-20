import PickFromPicture from './PickFromPicture.jsx'
import './pickFromPicture.css'

// Run Through the Plan. The morning's things are drawn where they actually are
// in the room; the checklist says which order to pick them up in. Grabbing out
// of turn is a mistake, but the sequence stays open so it can still be finished.
export default function PlanTechnique({ steps, timeLimitSeconds, onComplete }) {
  return (
    <PickFromPicture
      scene="room"
      className="plan-picture"
      items={steps}
      ordered
      timeLimitSeconds={timeLimitSeconds}
      headingKey="plan.speaker"
      promptKey="plan.line"
      ariaLabelKey="plan.aria"
      labelFor={(step, t) => t(`plan.step.${step.label.toLowerCase()}`)}
      onComplete={onComplete}
    />
  )
}
