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
 * Format price with currency symbol
 * @param price - Price value (number or string)
 * @param currency - Currency code (e.g., 'USD', 'PHP')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted price string (e.g., '$99.99', '₱5,999.99')
 */
export const formatPrice = (price: number | string, currency: string, decimals: number = 2): string => {
  const symbol = getCurrencySymbol(currency)
  const numericPrice = typeof price === 'string' ? parseFloat(price) : Number(price)
  
  if (isNaN(numericPrice)) {
    return `${symbol}0.00`
  }
  
  return `${symbol}${numericPrice.toFixed(decimals)}`
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
