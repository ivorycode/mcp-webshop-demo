import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CartApp } from './cart/CartApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartApp />
  </StrictMode>,
)
