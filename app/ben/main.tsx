import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import BenApp from '../src/ben/BenApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BenApp />
  </StrictMode>,
)
