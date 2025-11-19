# Database Implementation Guide

## Overview
This directory contains SQL scripts to implement all missing triggers, stored procedures, and views from the proposal.

## Installation Order

### For MySQL Workbench (Recommended)

Run these SQL scripts in MySQL Workbench in the following order:

1. **Open MySQL Workbench** and connect to your database
2. **Select the `electronics_store` database**
3. **Run each file in order:**
   - `01_create_missing_triggers_mysql.sql`
   - `02_create_missing_stored_procedures_mysql.sql`
   - `03_create_missing_views_mysql.sql`

**How to run in MySQL Workbench:**
- File → Open SQL Script → Select the file
- Click Execute button (or press Ctrl+Shift+Enter)
- Wait for "Success" message

### For MySQL Command Line

Run these SQL scripts in the following order:

```sql
USE electronics_store;
SOURCE 01_create_missing_triggers_mysql.sql;
SOURCE 02_create_missing_stored_procedures_mysql.sql;
SOURCE 03_create_missing_views_mysql.sql;
```

### For Command Line (bash/terminal)

```bash
mysql -u your_username -p electronics_store < 01_create_missing_triggers_mysql.sql
mysql -u your_username -p electronics_store < 02_create_missing_stored_procedures_mysql.sql
mysql -u your_username -p electronics_store < 03_create_missing_views_mysql.sql
```

## Important Notes

### Schema Adjustments Required

Some triggers and views assume certain table structures. **Please review and adjust** based on your actual schema:

1. **Branch ID Location:**
   - The scripts assume `branch_id` might be in `orders` table or `order_items` table
   - **Check your schema** and adjust the JOINs accordingly
   - If `orders` has `branch_id`, use: `o.branch_id`
   - If `order_items` has `branch_id`, use: `oi.branch_id`

2. **Currencies Table:**
   - The currency validation triggers assume a `currencies` table exists
   - If you don't have this table, comment out or remove those triggers

3. **Audit User ID:**
   - Many triggers use `@audit_user_id` variable
   - **Set this variable** before operations:
   ```sql
   SET @audit_user_id = 1;  -- Replace with actual user ID
   ```

### Testing the Implementation

After running the scripts, verify everything works:

```sql
-- Check triggers
SHOW TRIGGERS;

-- Check stored procedures
SHOW PROCEDURE STATUS WHERE Db = 'electronics_store';

-- Check views
SHOW FULL TABLES WHERE Table_type = 'VIEW';

-- Test a stored procedure
CALL sp_get_top_selling_products('2025-01-01', '2025-12-31', 10);

-- Test a view
SELECT * FROM v_product_catalog LIMIT 10;
```

## What Each Script Does

### `create_missing_triggers.sql`
Creates 8 missing triggers:
- Auto-calculate order item subtotal
- Auto-update order total when items change
- Restore stock when order is cancelled
- Log order status changes
- Log payment activities
- Prevent invalid payment status changes
- Prevent invalid currency rates
- Prevent negative prices (backup)

### `create_missing_stored_procedures.sql`
Creates 8 missing stored procedures:
- `sp_get_top_selling_products` - Top-selling products report
- `sp_get_monthly_sales` - Monthly sales totals
- `sp_get_monthly_sales_by_branch` - Monthly sales by branch
- `sp_get_revenue_by_currency` - Revenue by currency
- `sp_cancel_order` - Cancel order and restore stock
- `sp_transfer_stock` - Transfer stock between branches
- `sp_update_order_item_quantity` - Update order item quantity
- `sp_get_low_stock_products` - Get low stock products

### `create_missing_views.sql`
Creates 10 missing database views:
- `v_product_catalog` - Product catalog with categories
- `v_product_availability_by_branch` - Product availability per branch
- `v_branch_inventory_levels` - Branch inventory levels
- `v_daily_sales_totals` - Daily sales totals
- `v_order_summary` - Order summary view
- `v_order_details` - Order details view
- `v_order_dashboard` - Order dashboard view
- `v_top_rated_products` - Top-rated products
- `v_low_stock_alerts` - Low stock alerts
- `v_customer_purchase_summary` - Customer purchase summary

## Troubleshooting

### Error: "Table doesn't exist"
- Make sure you've run the base schema file first
- Check that all migration scripts have been executed

### Error: "Trigger already exists"
- The scripts use `DROP TRIGGER IF EXISTS`, so this shouldn't happen
- If it does, manually drop the trigger first

### Error: "Unknown column 'branch_id'"
- Check where `branch_id` is stored in your schema
- Adjust the JOINs in the views/stored procedures accordingly

### Error: "Unknown table 'currencies'"
- If you don't have a currencies table, comment out the currency validation triggers
- Or create a minimal currencies table

## Next Steps

After implementing these scripts:

1. **Update PHP code** to use stored procedures where appropriate
2. **Update PHP code** to use views for reporting
3. **Test all triggers** with sample data
4. **Test all stored procedures** with various parameters
5. **Test all views** to ensure they return correct data

## Support

If you encounter issues:
1. Check the error message carefully
2. Verify your schema matches the assumptions in the scripts
3. Adjust the scripts based on your actual table structure
4. Test incrementally (one trigger/procedure/view at a time)

