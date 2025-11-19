# How to Verify and Add Missing Triggers

## Overview
This guide explains how to verify and add the 8 additional triggers that are in separate files.

## Step-by-Step Instructions

### Option 1: Run the Verification Script (Recommended)

1. **Open MySQL Workbench**
   - Connect to your database

2. **Run the verification script**
   - Open: `backend/database/04_verify_and_add_missing_triggers_mysql.sql`
   - Execute the entire script
   - This will:
     - Check if triggers exist
     - Create missing triggers
     - Verify all triggers are present

3. **Check the results**
   - The script will show:
     - A list of all triggers
     - Total count of triggers
   - You should see at least 20 triggers total (12 main + 8 additional)

### Option 2: Manual Verification

#### Step 1: Check if triggers exist

Run this query in MySQL Workbench:

```sql
USE electronics_store;

-- Check all triggers
SELECT 
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE,
    ACTION_TIMING
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = 'electronics_store'
ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;
```

#### Step 2: Check specific triggers

Run these queries to check if each trigger exists:

```sql
-- Check stock validation trigger
SHOW TRIGGERS WHERE `Table` = 'product_inventory' AND Trigger = 'trg_product_inventory_prevent_negative_stock';

-- Check product audit triggers
SHOW TRIGGERS WHERE `Table` = 'products' AND Trigger LIKE 'trg_products_%_audit';

-- Check inventory audit triggers
SHOW TRIGGERS WHERE `Table` = 'product_inventory' AND Trigger LIKE 'trg_product_inventory_%_audit';

-- Check user registration trigger
SHOW TRIGGERS WHERE `Table` = 'users' AND Trigger = 'trg_users_registration_audit';

-- Check stock deduction trigger
SHOW TRIGGERS WHERE `Table` = 'payments' AND Trigger = 'trg_payment_completed_deduct_stock';
```

#### Step 3: Create missing triggers

If any triggers are missing, run the appropriate section from `04_verify_and_add_missing_triggers_mysql.sql`.

### Option 3: Check if audit_logs table exists

The audit triggers require the `audit_logs` table. Check if it exists:

```sql
-- Check if audit_logs table exists
SELECT COUNT(*) AS table_exists
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'electronics_store' 
AND TABLE_NAME = 'audit_logs';

-- If it doesn't exist, the audit triggers will be created but won't do anything
-- (they check for table existence before logging)
```

## Expected Results

### After running the verification script, you should have:

1. **Stock Validation Trigger** ✅
   - `trg_product_inventory_prevent_negative_stock`
   - Prevents negative stock values

2. **Product Audit Triggers** ✅ (if audit_logs table exists)
   - `trg_products_create_audit`
   - `trg_products_update_audit`
   - `trg_products_delete_audit`

3. **Inventory Audit Triggers** ✅ (if audit_logs table exists)
   - `trg_product_inventory_insert_audit`
   - `trg_product_inventory_update_audit`
   - `trg_product_inventory_delete_audit`

4. **User Registration Audit Trigger** ✅ (if audit_logs table exists)
   - `trg_users_registration_audit`

5. **Stock Deduction Trigger** ✅ (placeholder, intentionally empty)
   - `trg_payment_completed_deduct_stock`
   - Note: This trigger is intentionally empty because stock deduction is handled in PHP

## Integration Status

### ✅ Already Integrated with PHP Code

All these triggers use `@audit_user_id`, which is now properly set in:
- `backend/api/checkout/create-order.php`
- `backend/api/admin/orders.php`
- `backend/api/admin/products.php`

The triggers will automatically:
- Use `@audit_user_id` if set (from PHP code)
- Fall back to `NEW.user_id` or `OLD.user_id` if not set
- Log to `audit_logs` table (if it exists)

## Troubleshooting

### Issue: Triggers not created
- **Check:** Make sure you're connected to the correct database
- **Check:** Verify you have CREATE TRIGGER permissions
- **Check:** Look for error messages in MySQL Workbench

### Issue: Audit triggers not logging
- **Check:** Verify `audit_logs` table exists
- **Check:** Verify `@audit_user_id` is set in PHP code (it is!)
- **Check:** Check MySQL error log for trigger errors

### Issue: Stock validation trigger not working
- **Check:** Verify trigger exists: `SHOW TRIGGERS WHERE Trigger = 'trg_product_inventory_prevent_negative_stock';`
- **Test:** Try updating stock to negative value (should fail)

## Quick Verification Query

Run this to see all triggers and their status:

```sql
USE electronics_store;

SELECT 
    TRIGGER_NAME AS 'Trigger Name',
    EVENT_OBJECT_TABLE AS 'Table',
    EVENT_MANIPULATION AS 'Event',
    ACTION_TIMING AS 'Timing',
    CASE 
        WHEN TRIGGER_NAME LIKE '%audit%' THEN 'Audit Logging'
        WHEN TRIGGER_NAME LIKE '%prevent%' THEN 'Validation'
        WHEN TRIGGER_NAME LIKE '%calculate%' OR TRIGGER_NAME LIKE '%update%' THEN 'Auto-calculation'
        WHEN TRIGGER_NAME LIKE '%restore%' THEN 'Stock Management'
        WHEN TRIGGER_NAME LIKE '%log%' THEN 'Transaction Logging'
        ELSE 'Other'
    END AS 'Type'
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = 'electronics_store'
ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME;
```

## Summary

1. ✅ **Run `04_verify_and_add_missing_triggers_mysql.sql`** - This will create all missing triggers
2. ✅ **Verify triggers exist** - Use the verification queries above
3. ✅ **Check audit_logs table** - If it exists, audit triggers will log; if not, they'll skip logging
4. ✅ **All triggers are integrated** - PHP code sets `@audit_user_id` properly

All triggers will work automatically once created!



