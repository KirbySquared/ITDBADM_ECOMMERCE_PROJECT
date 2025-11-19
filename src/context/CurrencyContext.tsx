import { createContext, useContext, useState } from 'react'

type Currency = 'PHP' | 'USD' | 'KRW' | 'JPY' | 'EUR' | 'GBP' | 'CAD' | 'AUD'
type Ctx = { currency: Currency; setCurrency: (c: Currency) => void }

const CurrencyContext = createContext<Ctx>({ currency: 'PHP', setCurrency: () => {} })

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem('currency')
    return (saved as Currency) || 'PHP'
  })
  
  const handleSet = (c: Currency) => {
    localStorage.setItem('currency', c)
    setCurrency(c)
    // Dispatch event to notify components of currency change
    window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency: c } }))
  }
  
  return (
    <CurrencyContext.Provider value={{ currency, setCurrency: handleSet }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
