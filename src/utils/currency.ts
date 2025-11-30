/**
 * CURRENCY UTILITIES
 * 
 * This file provides centralized currency handling utilities for the entire application.
 * 
 * FEATURES:
 * - Currency symbols mapping
 * - Price formatting functions
 * - Currency validation
 * - Consistent currency display across all components
 * 
 * USAGE:
 * import { CURRENCY_SYMBOLS, formatPrice, getCurrencySymbol } from '../utils/currency'
 */

// Currency symbols mapping
export const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'PHP': '₱',
  'KRW': '₩',
  'JPY': '¥',
  'EUR': '€',
  'GBP': '£',
  'CAD': 'C$',
  'AUD': 'A$'
}

// Supported currencies list
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' }
]

/**
 * Get currency symbol by currency code
 * @param currency - Currency code (e.g., 'USD', 'PHP')
 * @returns Currency symbol (e.g., '$', '₱')
 */
export const getCurrencySymbol = (currency: string): string => {
  return CURRENCY_SYMBOLS[currency] || currency
}

/**
 * Format price with currency symbol, thousands separator, and always 2 decimal places
 * @param price - Price value (number or string)
 * @param currency - Currency code (e.g., 'USD', 'PHP')
 * @param decimals - Number of decimal places (default: 2, always enforced)
 * @returns Formatted price string (e.g., '$99.99', '₱5,999.99', '$100,000,000.00')
 */
export const formatPrice = (price: number | string, currency: string, decimals: number = 2): string => {
  const symbol = getCurrencySymbol(currency)
  const numericPrice = typeof price === 'string' ? parseFloat(price) : Number(price)
  
  if (isNaN(numericPrice)) {
    return `${symbol}0.00`
  }
  
  // Always use thousands separator and always show 2 decimal places
  return `${symbol}${numericPrice.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`
}

/**
 * Format price with thousands separator
 * @param price - Price value (number or string)
 * @param currency - Currency code (e.g., 'USD', 'PHP')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted price string with thousands separator
 */
export const formatPriceWithSeparator = (price: number | string, currency: string, decimals: number = 2): string => {
  const symbol = getCurrencySymbol(currency)
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price
  
  if (isNaN(numericPrice)) {
    return `${symbol}0.00`
  }
  
  return `${symbol}${numericPrice.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`
}

/**
 * Format number with thousands separator and always 2 decimal places
 * @param num - Number value (number or string)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string (e.g., '100,000,000.00')
 */
export const formatNumber = (num: number | string, decimals: number = 2): string => {
  const numericValue = typeof num === 'string' ? parseFloat(num) : Number(num)
  
  if (isNaN(numericValue)) {
    return '0.00'
  }
  
  return numericValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Validate if currency code is supported
 * @param currency - Currency code to validate
 * @returns True if currency is supported
 */
export const isValidCurrency = (currency: string): boolean => {
  return currency in CURRENCY_SYMBOLS
}

/**
 * Get currency options for dropdowns
 * @returns Array of currency options for select elements
 */
export const getCurrencyOptions = () => {
  return SUPPORTED_CURRENCIES.map(currency => ({
    value: currency.code,
    label: `${currency.code} - ${currency.name} (${currency.symbol})`
  }))
}

/**
 * Convert price from PHP (base currency) to target currency
 * This is used for display purposes only - analytics data stays in PHP
 * @param priceInPhp - Price in PHP
 * @param targetCurrency - Target currency code
 * @param exchangeRate - Exchange rate from PHP to target currency (rate_to_php from backend)
 * @returns Converted price
 */
export const convertFromPhp = (priceInPhp: number, targetCurrency: string, exchangeRate: number | null): number => {
  if (targetCurrency === 'PHP' || !exchangeRate || exchangeRate <= 0) {
    return priceInPhp
  }
  // Exchange rate is rate_to_php (e.g., 0.018 for USD means 1 PHP = 0.018 USD)
  // So to convert PHP to target: PHP * rate = Target
  return round(priceInPhp * exchangeRate, 2)
}

/**
 * Round number to specified decimal places
 * @param num - Number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
const round = (num: number, decimals: number): number => {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

/**
 * Fetch exchange rate from backend
 * @param currency - Currency code
 * @returns Exchange rate (rate_to_php) or null if error
 */
export const fetchExchangeRate = async (currency: string): Promise<number | null> => {
  if (currency === 'PHP') {
    return 1.0
  }

  try {
    const token = localStorage.getItem('token')
    if (!token) {
      return null
    }

    const response = await fetch('http://localhost:8000/api/checkout/lock-currency', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currency })
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    if (data.success && data.data?.rate_to_php) {
      return parseFloat(data.data.rate_to_php)
    }

    return null
  } catch (error) {
    console.error('Error fetching exchange rate:', error)
    return null
  }
}
