<?php
/**
 * CURRENCY API UTILITY
 * 
 * Fetches live exchange rates from external API instead of database.
 * This ensures rates are always up-to-date without manual database updates.
 * 
 * Uses exchangerate-api.com (free tier available)
 * Alternative APIs: fixer.io, currencyapi.net, exchangerate.host
 */

// API Configuration
define('CURRENCY_API_URL', 'https://api.exchangerate-api.com/v4/latest/PHP');
define('CURRENCY_CACHE_DURATION', 3600); // Cache for 1 hour (3600 seconds)

/**
 * Get exchange rate from PHP to target currency
 * 
 * @param string $targetCurrency - Target currency code (e.g., 'USD', 'KRW')
 * @return float|null - Exchange rate or null if error
 */
function getExchangeRateFromAPI($targetCurrency) {
    // PHP is base currency, so rate is 1.0
    if (strtoupper($targetCurrency) === 'PHP') {
        return 1.0;
    }
    
    try {
        // Try to get from cache first
        $cacheKey = 'currency_rate_' . strtoupper($targetCurrency);
        $cachedRate = getCachedRate($cacheKey);
        
        if ($cachedRate !== null) {
            return $cachedRate;
        }
        
        // Fetch from API
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, CURRENCY_API_URL);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        if ($httpCode !== 200 || $response === false) {
            error_log("Currency API Error: HTTP $httpCode, cURL Error: $curlError");
            // Fallback to database if API fails
            return getExchangeRateFromDatabase($targetCurrency);
        }
        
        $data = json_decode($response, true);
        
        if (!$data || !isset($data['rates'])) {
            error_log("Currency API Error: Invalid response format");
            return getExchangeRateFromDatabase($targetCurrency);
        }
        
        $targetCurrencyUpper = strtoupper($targetCurrency);
        
        if (!isset($data['rates'][$targetCurrencyUpper])) {
            error_log("Currency API Error: Currency $targetCurrency not found in rates");
            return getExchangeRateFromDatabase($targetCurrency);
        }
        
        // Rate from PHP to target currency
        // Example: If 1 PHP = 0.018 USD, then rate = 0.018
        $rate = (float)$data['rates'][$targetCurrencyUpper];
        
        // Cache the rate
        cacheRate($cacheKey, $rate);
        
        return $rate;
        
    } catch (Exception $e) {
        error_log("Currency API Exception: " . $e->getMessage());
        // Fallback to database if API fails
        return getExchangeRateFromDatabase($targetCurrency);
    }
}

/**
 * Get exchange rate from database (fallback)
 * 
 * @param string $targetCurrency - Target currency code
 * @return float|null - Exchange rate or null if error
 */
function getExchangeRateFromDatabase($targetCurrency) {
    global $pdo;
    
    try {
        if (!isset($pdo)) {
            require_once __DIR__ . '/../config/database.php';
        }
        
        $stmt = $pdo->prepare("SELECT rate_to_php FROM currencies WHERE code = ? AND is_active = 1 LIMIT 1");
        $stmt->execute([strtoupper($targetCurrency)]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row && isset($row['rate_to_php'])) {
            return (float)$row['rate_to_php'];
        }
        
        // Default fallback: return 1.0 for PHP or null for others
        return strtoupper($targetCurrency) === 'PHP' ? 1.0 : null;
        
    } catch (Exception $e) {
        error_log("Currency Database Fallback Error: " . $e->getMessage());
        return strtoupper($targetCurrency) === 'PHP' ? 1.0 : null;
    }
}

/**
 * Get cached exchange rate
 * 
 * @param string $cacheKey - Cache key
 * @return float|null - Cached rate or null
 */
function getCachedRate($cacheKey) {
    // Use file-based caching (simple implementation)
    $cacheFile = __DIR__ . '/../cache/' . md5($cacheKey) . '.json';
    
    if (!file_exists($cacheFile)) {
        return null;
    }
    
    $cacheData = json_decode(file_get_contents($cacheFile), true);
    
    if (!$cacheData || !isset($cacheData['rate']) || !isset($cacheData['timestamp'])) {
        return null;
    }
    
    // Check if cache is still valid
    $age = time() - $cacheData['timestamp'];
    if ($age > CURRENCY_CACHE_DURATION) {
        // Cache expired
        @unlink($cacheFile);
        return null;
    }
    
    return (float)$cacheData['rate'];
}

/**
 * Cache exchange rate
 * 
 * @param string $cacheKey - Cache key
 * @param float $rate - Exchange rate to cache
 */
function cacheRate($cacheKey, $rate) {
    $cacheDir = __DIR__ . '/../cache';
    
    // Create cache directory if it doesn't exist
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }
    
    $cacheFile = $cacheDir . '/' . md5($cacheKey) . '.json';
    
    $cacheData = [
        'rate' => $rate,
        'timestamp' => time()
    ];
    
    @file_put_contents($cacheFile, json_encode($cacheData));
}

/**
 * Convert price from PHP to target currency
 * 
 * @param float $priceInPhp - Price in PHP
 * @param string $targetCurrency - Target currency code
 * @return float - Converted price
 */
function convertPriceFromPhp($priceInPhp, $targetCurrency) {
    if (strtoupper($targetCurrency) === 'PHP') {
        return $priceInPhp;
    }
    
    $rate = getExchangeRateFromAPI($targetCurrency);
    
    if ($rate === null || $rate <= 0) {
        error_log("Invalid exchange rate for $targetCurrency, using PHP");
        return $priceInPhp;
    }
    
    // Convert: PHP * rate = Target Currency
    // Example: 100 PHP * 0.018 = 1.8 USD
    return round($priceInPhp * $rate, 2);
}

/**
 * Convert price from target currency to PHP
 * 
 * @param float $priceInCurrency - Price in target currency
 * @param string $sourceCurrency - Source currency code
 * @return float - Converted price in PHP
 */
function convertPriceToPhp($priceInCurrency, $sourceCurrency) {
    if (strtoupper($sourceCurrency) === 'PHP') {
        return $priceInCurrency;
    }
    
    $rate = getExchangeRateFromAPI($sourceCurrency);
    
    if ($rate === null || $rate <= 0) {
        error_log("Invalid exchange rate for $sourceCurrency, returning original price");
        return $priceInCurrency;
    }
    
    // Convert: Target Currency / rate = PHP
    // Example: 1.8 USD / 0.018 = 100 PHP
    return round($priceInCurrency / $rate, 2);
}

/**
 * Validate currency code
 * 
 * @param string $currency - Currency code to validate
 * @return bool - True if valid
 */
function isValidCurrencyCode($currency) {
    $supportedCurrencies = ['PHP', 'USD', 'KRW', 'JPY', 'EUR', 'GBP', 'CAD', 'AUD'];
    return in_array(strtoupper($currency), $supportedCurrencies);
}

?>

