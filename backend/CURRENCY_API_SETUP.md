# Currency API Setup

## Overview

The system now uses **automatic currency conversion** via external API instead of database-stored rates. This ensures exchange rates are always up-to-date without manual database updates.

## API Provider

**exchangerate-api.com** (Free tier)
- URL: `https://api.exchangerate-api.com/v4/latest/PHP`
- Base Currency: PHP (Philippine Peso)
- Free tier: No API key required, 1,500 requests/month
- Updates: Daily

## Features

✅ **Automatic Rate Fetching**: Rates fetched from API automatically
✅ **Caching**: Rates cached for 1 hour to reduce API calls
✅ **Fallback**: Falls back to database if API fails
✅ **No Manual Updates**: No need to update database regularly

## How It Works

1. **Rate Fetching**: When a currency conversion is needed, the system:
   - Checks cache first (1-hour duration)
   - If not cached, fetches from API
   - Caches the result for future use

2. **Conversion Formula**:
   - PHP to Target: `PHP * rate = Target Currency`
   - Example: 100 PHP * 0.018 = 1.8 USD

3. **Error Handling**:
   - If API fails, falls back to database rates
   - If database also fails, uses PHP as default (rate = 1.0)

## Cache Directory

Rates are cached in: `backend/cache/`
- Automatically created if doesn't exist
- Files: `{md5(currency_code)}.json`
- Duration: 1 hour (3600 seconds)

## Supported Currencies

- PHP (Philippine Peso) - Base currency
- USD (US Dollar)
- KRW (South Korean Won)
- JPY (Japanese Yen)
- EUR (Euro)
- GBP (British Pound)
- CAD (Canadian Dollar)
- AUD (Australian Dollar)

## Configuration

Edit `backend/utils/currency_api.php` to:
- Change API URL: `CURRENCY_API_URL`
- Change cache duration: `CURRENCY_CACHE_DURATION` (in seconds)
- Switch to different API provider

## Alternative API Providers

If you want to use a different provider:

### Fixer.io
```php
define('CURRENCY_API_URL', 'http://data.fixer.io/api/latest?access_key=YOUR_KEY&base=PHP');
```

### CurrencyAPI.net
```php
define('CURRENCY_API_URL', 'https://api.currencyapi.com/v3/latest?apikey=YOUR_KEY&base_currency=PHP');
```

### ExchangeRate.host
```php
define('CURRENCY_API_URL', 'https://api.exchangerate.host/latest?base=PHP');
```

## Testing

To test the currency API:

```php
require_once 'utils/currency_api.php';

// Get USD rate
$rate = getExchangeRateFromAPI('USD');
echo "1 PHP = $rate USD\n";

// Convert price
$priceInPhp = 100;
$priceInUsd = convertPriceFromPhp($priceInPhp, 'USD');
echo "$priceInPhp PHP = $priceInUsd USD\n";
```

## Notes

- **Order Currency Snapshots**: When orders are created, the rate is still saved to `order_currency_snapshots` table to preserve the rate used at checkout time
- **Database Fallback**: The `currencies` table is still used as fallback if API fails
- **No Breaking Changes**: All existing endpoints work the same way, just with automatic rate updates

