import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SearchApp } from './search/SearchApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SearchApp />
  </StrictMode>,
)
