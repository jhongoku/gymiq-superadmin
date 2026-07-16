import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import SuperAdminApp from './SuperAdminApp.jsx'
import CheckInScreen from './CheckInScreen.jsx'
import DownloadPage from './DownloadPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<SuperAdminApp />} />
        <Route path="/ingreso" element={<CheckInScreen />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
