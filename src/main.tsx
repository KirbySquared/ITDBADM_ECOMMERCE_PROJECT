import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { CurrencyProvider } from './context/CurrencyContext'
import { BranchProvider } from './context/BranchContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrencyProvider>
      <BranchProvider>
        <App />
      </BranchProvider>
    </CurrencyProvider>
  </StrictMode>
)
