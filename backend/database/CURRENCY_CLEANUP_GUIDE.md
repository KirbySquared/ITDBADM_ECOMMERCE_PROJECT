# Currency System Cleanup Guide

## Current Status

The system now uses **API-based currency conversion** instead of database-stored rates. However, the old database code is still present as a **fallback mechanism**.

## What Was Changed

✅ **Updated to use API:**
- `backend/api/products/get_product.php`
- `backend/api/products/get_products.php`
- `backend/api/products/index.php`
- `backend/api/products/pc_builder_components.php`
- `backend/api/cart/get_cart.php`
- `backend/api/checkout/create-order.php`
- `backend/api/checkout/lock-currency.php`
- `backend/api/admin/products.php` (just updated)

✅ **Fallback still exists:**
- `backend/utils/currency_api.php` has `getExchangeRateFromDatabase()` function
- This is used if the API fails

## Database Tables

### 1. `currencies` Table (Can be removed/disabled)

**Purpose:** Previously stored exchange rates  
**Current Status:** Only used as fallback if API fails  
**Action:** Can be safely disabled or removed

**Options:**
- **Option A (Recommended):** Mark all currencies as inactive
  ```sql
  UPDATE currencies SET is_active = 0;
  ```
- **Option B:** Drop the table entirely
  ```sql
  DROP TABLE IF EXISTS currencies;
  ```

### 2. `order_currency_snapshots` Table (KEEP THIS)

**Purpose:** Stores historical exchange rates used at order creation time  
**Current Status:** Still actively used and important  
**Action:** **DO NOT DELETE** - This is historical data

**Why keep it:**
- Preserves the exact rate used when each order was placed
- Important for financial records and order history
- Used for order reporting and accounting

## Cleanup Steps

### Step 1: Verify API is Working

Test that the currency API is functioning:
```bash
# Test a currency conversion
curl "https://api.exchangerate-api.com/v4/latest/PHP"
```

### Step 2: Choose Your Cleanup Level

#### Level 1: Minimal (Recommended)
Just mark currencies as inactive - keeps fallback available:
```sql
USE electronics_store;
UPDATE currencies SET is_active = 0;
```

#### Level 2: Moderate
Clear the rates but keep table structure:
```sql
USE electronics_store;
UPDATE currencies SET is_active = 0;
UPDATE currencies SET rate_to_php = 0;
```

#### Level 3: Complete Removal
Remove the table entirely (only if you're sure):
```sql
USE electronics_store;
DROP TABLE IF EXISTS currencies;
```

### Step 3: Remove Fallback Code (Optional)

If you want to completely remove database fallback:

1. Edit `backend/utils/currency_api.php`
2. Remove or comment out the `getExchangeRateFromDatabase()` function
3. Update all calls to return `null` instead of calling fallback

**Current fallback code location:**
- Line ~86-110 in `backend/utils/currency_api.php`

## Files That Still Reference Database

These files have fallback references but use API first:

1. `backend/utils/currency_api.php` - Has fallback function
2. `backend/api/_bootstrap.php` - May have currency validation (check if needed)

## Verification Queries

### Check current currencies table:
```sql
SELECT code, rate_to_php, is_active, updated_at 
FROM currencies;
```

### Check order snapshots (should have data):
```sql
SELECT COUNT(*) as total_snapshots 
FROM order_currency_snapshots;
```

### Check if any active code uses currencies table:
```sql
-- This won't find code, but shows what's in the table
SELECT * FROM currencies WHERE is_active = 1;
```

## Recommended Approach

**Best Practice:** Keep the table but disable it:
1. Mark all currencies as inactive
2. Keep the fallback code in place
3. This provides a safety net if API fails
4. No risk of breaking the system

**SQL:**
```sql
USE electronics_store;
UPDATE currencies SET is_active = 0;
SELECT 'Currencies table disabled. System will use API only.' AS status;
```

## Testing After Cleanup

1. Test product listing with different currencies
2. Test cart with currency conversion
3. Test checkout process
4. Verify order currency snapshots still work
5. Test API failure scenario (if fallback is kept)

## Rollback Plan

If you need to rollback:
```sql
-- Re-enable currencies table
UPDATE currencies SET is_active = 1;

-- Or restore from backup if you dropped the table
```

