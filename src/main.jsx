import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ReadyJourneyAudioBridge from './world/ReadyJourneyAudioBridge.jsx'
import TutorialKeyboardBridge from './tutorialKeyboardBridge.jsx'
import './styles.css'
import './compat.css'
import './microgameEnhancements.css'
import './completionEffects.css'
import './endScreens.css'
import './endScreensCompat.css'
import './endScreensResponsive.css'
import './tutorial.css'
import './tutorialFocusGuide.css'
import './minigames.css'
import './startSequence.css'
import './progression/skillTree.css'
import './progression/skillTreeTweaks.css'
import './techniques/techniques.css'
import './results/homeReturn.css'
import './results/resultsCleanup.css'
import './results/runSnapshot.css'
import './cafeBeat.css'
import './world/audioSettings.css'
import './microgameEnhancements.js'
import './tutorialFocusGuide.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ReadyJourneyAudioBridge />
    <TutorialKeyboardBridge />
    <App />
  </StrictMode>,
)
