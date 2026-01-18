import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import ListPage from './pages/ListPage'
import Practice from './pages/Practice'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/list" element={<ListPage />} />
        <Route path="/interview" element={<Practice />} />
        <Route path="/practice" element={<Practice />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
