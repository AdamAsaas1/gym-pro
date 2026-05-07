import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'flag-icons/css/flag-icons.min.css'
import './i18n/i18n.js'
import App from './App.jsx'

if (typeof window !== 'undefined' && !sessionStorage.getItem('gym_session_reset_done')) {
  localStorage.removeItem('gym_access_token')
  localStorage.removeItem('gym_refresh_token')
  localStorage.removeItem('gym_user_v1')
  sessionStorage.setItem('gym_session_reset_done', '1')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
