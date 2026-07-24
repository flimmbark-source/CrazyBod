import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './compat.css'
import './microgameEnhancements.css'
import './completionEffects.css'
import './endScreens.css'
import './endScreensCompat.css'
import './endScreensResponsive.css'
import './tutorial.css'
import './microgameEnhancements.js'
import './endScreens.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
