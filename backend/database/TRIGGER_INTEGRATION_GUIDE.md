# Trigger Integration Guide

## Overview
This guide explains how the database triggers are integrated with the PHP codebase.

## Triggers Created

### 1. Order Item Triggers
- **`trg_order_items_calculate_subtotal`** - Auto-calculates subtotal on INSERT
- **`trg_order_items_update_subtotal`** - Auto-calculates subtotal on UPDATE
- **`trg_order_items_update_order_total_insert`** - Updates order total when item is inserted
- **`trg_order_items_update_order_total_update`** - Updates order total when item is updated
- **`trg_order_items_update_order_total_delete`** - Updates order total when item is deleted

### 2. Order Management Triggers
- **`trg_orders_restore_stock_on_cancel`** - Restores stock when order is cancelled
- **`trg_orders_log_status_change`** - Logs order status changes to transaction_log

### 3. Payment Triggers
- **`trg_payments_log_insert`** - Logs payment creation to transaction_log
- **`trg_payments_log_update`** - Logs payment status changes to transaction_log
- **`trg_payments_validate_status_change`** - Prevents invalid payment status transitions

### 4. Product Triggers
- **`trg_products_prevent_negative_price`** - Prevents negative prices (backup to CHECK constraint)

## PHP Code Integration

### Audit User ID Helper

All triggers that log to `transaction_log` use the `@audit_user_id` session variable. The PHP code sets this before operations:

```php
require_once __DIR__ . '/../../utils/audit_helper.php';

// Before transaction
setAuditUserId($pdo, $userId);

// After transaction (success or error)
clearAuditUserId($pdo);
```

### Files Updated

1. **`backend/utils/audit_helper.php`** - New utility for managing audit user ID
2. **`backend/api/checkout/create-order.php`** - Sets audit user ID before order creation
3. **`backend/api/admin/orders.php`** - Sets audit user ID for all order operations
4. **`backend/api/admin/products.php`** - Sets audit user ID for product/inventory operations

## How Triggers Work with Code

### Order Creation Flow

1. **PHP Code:**
   ```php
   setAuditUserId($pdo, $userId);
   START TRANSACTION;
   INSERT INTO orders (...);
   INSERT INTO order_items (...); // Triggers fire here
   INSERT INTO payments (...); // Triggers fire here
   COMMIT;
   clearAuditUserId($pdo);
   ```

2. **Triggers Execute:**
   - `trg_order_items_calculate_subtotal` - Calculates subtotal if NULL
   - `trg_order_items_update_order_total_insert` - Updates order.total_amount
   - `trg_payments_log_insert` - Logs payment creation

### Order Update Flow

1. **PHP Code:**
   ```php
   setAuditUserId($pdo, $userId);
   START TRANSACTION;
   UPDATE orders SET status = 'processing'; // Triggers fire here
   COMMIT;
   clearAuditUserId($pdo);
   ```

2. **Triggers Execute:**
   - `trg_orders_log_status_change` - Logs status change to transaction_log

### Order Cancellation Flow

1. **PHP Code:**
   ```php
   setAuditUserId($pdo, $userId);
   START TRANSACTION;
   UPDATE orders SET status = 'cancelled'; // Triggers fire here
   UPDATE payments SET payment_status = 'refunded'; // Triggers fire here
   COMMIT;
   clearAuditUserId($pdo);
   ```

2. **Triggers Execute:**
   - `trg_orders_restore_stock_on_cancel` - Restores stock to inventory
   - `trg_orders_log_status_change` - Logs status change
   - `trg_payments_log_update` - Logs payment status change

## Important Notes

### 1. Order Total Calculation
- **Before:** PHP code manually calculated and set `total_amount`
- **After:** Triggers automatically update `total_amount` when order_items change
- **PHP Code:** Still calculates total for initial order creation, but triggers ensure it matches sum of items

### 2. Subtotal Calculation
- **Before:** PHP code always calculated subtotal
- **After:** Triggers calculate subtotal if NULL or if quantity/price changes
- **PHP Code:** Still calculates subtotal, but triggers provide backup/verification

### 3. Stock Restoration
- **Before:** PHP code manually restored stock on cancellation
- **After:** Trigger `trg_orders_restore_stock_on_cancel` automatically restores stock
- **PHP Code:** Still restores stock manually for immediate effect, trigger provides backup

### 4. Transaction Logging
- **Before:** PHP code manually logged some operations
- **After:** Triggers automatically log order status changes and payment activities
- **PHP Code:** Still logs some operations manually, triggers provide comprehensive audit trail

## Testing Triggers

### Test Order Item Subtotal Calculation
```sql
-- Insert order item with NULL subtotal
INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
VALUES (1, 1, 2, 100.00, NULL);

-- Check if subtotal was calculated
SELECT * FROM order_items WHERE order_id = 1;
```

### Test Order Total Update
```sql
-- Insert order item
INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
VALUES (1, 1, 2, 100.00, 200.00);

-- Check if order total was updated
SELECT total_amount FROM orders WHERE order_id = 1;
```

### Test Stock Restoration
```sql
-- Cancel an order
UPDATE orders SET status = 'cancelled' WHERE order_id = 1;

-- Check if stock was restored
SELECT stock_qty FROM product_inventory WHERE product_id = 1 AND branch_id = 1;
```

### Test Transaction Logging
```sql
-- Update order status
SET @audit_user_id = 1;
UPDATE orders SET status = 'processing' WHERE order_id = 1;

-- Check transaction log
SELECT * FROM transaction_log WHERE entity = 'order' ORDER BY created_at DESC LIMIT 5;
```

## Troubleshooting

### Issue: Triggers not firing
- **Check:** Verify triggers exist: `SHOW TRIGGERS;`
- **Check:** Verify table names match exactly
- **Check:** Check MySQL error log for trigger errors

### Issue: Audit user ID not set
- **Check:** Verify `setAuditUserId()` is called before operations
- **Check:** Verify `@audit_user_id` is set: `SELECT @audit_user_id;`
- **Check:** Triggers use `COALESCE(@audit_user_id, NEW.user_id)` as fallback

### Issue: Order total not updating
- **Check:** Verify triggers exist: `SHOW TRIGGERS WHERE `Table` = 'order_items';`
- **Check:** Check if order_items are being inserted/updated
- **Check:** Verify subtotal is being calculated correctly

### Issue: Stock not restoring on cancellation
- **Check:** Verify trigger exists: `SHOW TRIGGERS WHERE `Table` = 'orders';`
- **Check:** Verify order has `branch_id` set
- **Check:** Verify order_items exist for the order

## Best Practices

1. **Always set audit user ID** before database operations that need logging
2. **Always clear audit user ID** after transactions (success or error)
3. **Don't rely solely on triggers** - PHP code should still validate and calculate values
4. **Test triggers** after any schema changes
5. **Monitor transaction_log** to ensure triggers are logging correctly

## Summary

All triggers are now integrated with the PHP codebase:
- ✅ Audit user ID is set before operations
- ✅ Triggers automatically calculate subtotals and order totals
- ✅ Triggers automatically restore stock on cancellation
- ✅ Triggers automatically log order status changes and payment activities
- ✅ PHP code works in harmony with triggers (calculates values, triggers verify/update)

The system now has comprehensive database-level business rule enforcement and audit logging!



