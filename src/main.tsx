import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { CurrencyProvider } from './context/CurrencyContext'
import { BranchProvider } from './context/BranchContext'
import { NotificationProvider } from './context/NotificationContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrencyProvider>
      <BranchProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </BranchProvider>
    </CurrencyProvider>
  </StrictMode>
)
