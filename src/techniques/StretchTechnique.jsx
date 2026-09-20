import PickFromPicture from './PickFromPicture.jsx'
import './pickFromPicture.css'

// Stretch Every Joint. The body is drawn and the joints are marked on it; the
// checklist says what still needs loosening. Any order works and nothing has to
// be held down — one tap per joint. Running out of time is a gentle failure:
// no benefit, no penalty.
export default function StretchTechnique({ joints, timeLimitSeconds, onComplete }) {
  return (
    <PickFromPicture
      scene="body"
      className="stretch-picture"
      items={joints}
      timeLimitSeconds={timeLimitSeconds}
      headingKey="speaker.Stretch"
      promptKey="stretch.line"
      ariaLabelKey="stretch.aria"
      labelFor={(joint, t) => t(`stretch.joint.${joint.key}`)}
      onComplete={onComplete}
    />
  )
}
