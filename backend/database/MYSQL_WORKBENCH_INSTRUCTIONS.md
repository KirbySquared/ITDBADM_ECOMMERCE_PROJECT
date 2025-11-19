# MySQL Workbench Installation Instructions

## Quick Start Guide

### Step 1: Open MySQL Workbench
1. Launch MySQL Workbench
2. Connect to your MySQL server
3. Make sure you're connected to the `electronics_store` database

### Step 2: Run the Scripts in Order

Execute these files **one at a time** in MySQL Workbench:

#### File 1: Triggers
1. Click **File** → **Open SQL Script**
2. Navigate to: `backend/database/01_create_missing_triggers_mysql.sql`
3. Click **Open**
4. Click the **Execute** button (⚡ icon) or press **Ctrl+Shift+Enter**
5. Wait for "Success" message in the Output panel

#### File 2: Stored Procedures
1. Click **File** → **Open SQL Script**
2. Navigate to: `backend/database/02_create_missing_stored_procedures_mysql.sql`
3. Click **Open**
4. Click the **Execute** button (⚡ icon) or press **Ctrl+Shift+Enter**
5. Wait for "Success" message

#### File 3: Views
1. Click **File** → **Open SQL Script**
2. Navigate to: `backend/database/03_create_missing_views_mysql.sql`
3. Click **Open**
4. Click the **Execute** button (⚡ icon) or press **Ctrl+Shift+Enter**
5. Wait for "Success" message

### Step 3: Verify Installation

Run this verification query in MySQL Workbench:

```sql
USE electronics_store;

-- Check triggers
SELECT COUNT(*) AS total_triggers 
FROM information_schema.triggers 
WHERE trigger_schema = 'electronics_store';

-- Check stored procedures
SELECT COUNT(*) AS total_procedures 
FROM information_schema.routines 
WHERE routine_schema = 'electronics_store' 
AND routine_type = 'PROCEDURE';

-- Check views
SELECT COUNT(*) AS total_views 
FROM information_schema.views 
WHERE table_schema = 'electronics_store';
```

**Expected Results:**
- Triggers: Should show 8+ triggers
- Procedures: Should show 8+ procedures
- Views: Should show 10 views

### Step 4: Test a Stored Procedure

Test that everything works:

```sql
-- Test top-selling products procedure
CALL sp_get_top_selling_products('2025-01-01', '2025-12-31', 10);

-- Test a view
SELECT * FROM v_product_catalog LIMIT 10;
```

## Troubleshooting

### Error: "Table doesn't exist"
- Make sure you've run the base schema files first
- Verify you're connected to the correct database (`electronics_store`)

### Error: "Trigger already exists"
- The scripts use `DROP TRIGGER IF EXISTS`, so this shouldn't happen
- If it does, you can manually drop the trigger first

### Error: "DELIMITER can't be used in prepared statements"
- This is normal in MySQL Workbench
- The DELIMITER commands are handled automatically by Workbench
- Just execute the entire script as-is

### Error: "Unknown column 'branch_id'"
- Verify that `orders` table has `branch_id` column
- Run: `DESCRIBE orders;` to check
- If missing, run: `add_orders_branch_support.sql` first

### Error: "Unknown table 'currencies'"
- The currency validation triggers are commented out by default
- If you don't have a currencies table, this is expected
- The script will skip those triggers automatically

## What Gets Created

### Triggers (8 total)
1. `trg_order_items_calculate_subtotal` - Auto-calculate subtotal on insert
2. `trg_order_items_update_subtotal` - Auto-calculate subtotal on update
3. `trg_order_items_update_order_total_insert` - Update order total on item insert
4. `trg_order_items_update_order_total_update` - Update order total on item update
5. `trg_order_items_update_order_total_delete` - Update order total on item delete
6. `trg_orders_restore_stock_on_cancel` - Restore stock when order cancelled
7. `trg_orders_log_status_change` - Log order status changes
8. `trg_payments_log_insert` - Log payment creation
9. `trg_payments_log_update` - Log payment updates
10. `trg_payments_validate_status_change` - Validate payment status changes
11. `trg_products_prevent_negative_price` - Prevent negative prices

### Stored Procedures (8 total)
1. `sp_get_top_selling_products` - Top-selling products report
2. `sp_get_monthly_sales` - Monthly sales totals
3. `sp_get_monthly_sales_by_branch` - Monthly sales by branch
4. `sp_get_revenue_by_currency` - Revenue by currency
5. `sp_cancel_order` - Cancel order and restore stock
6. `sp_transfer_stock` - Transfer stock between branches
7. `sp_update_order_item_quantity` - Update order item quantity
8. `sp_get_low_stock_products` - Get low stock products

### Views (10 total)
1. `v_product_catalog` - Product catalog with categories
2. `v_product_availability_by_branch` - Product availability per branch
3. `v_branch_inventory_levels` - Branch inventory levels
4. `v_daily_sales_totals` - Daily sales totals
5. `v_order_summary` - Order summary view
6. `v_order_details` - Order details view
7. `v_order_dashboard` - Order dashboard view
8. `v_top_rated_products` - Top-rated products
9. `v_low_stock_alerts` - Low stock alerts
10. `v_customer_purchase_summary` - Customer purchase summary

## Next Steps

After successful installation:

1. **Update PHP code** to use stored procedures where appropriate
2. **Update PHP code** to use views for reporting
3. **Test all triggers** with sample data
4. **Test all stored procedures** with various parameters
5. **Test all views** to ensure they return correct data

## Support

If you encounter issues:
1. Check the error message carefully
2. Verify your schema matches the assumptions in the scripts
3. Make sure you've run all prerequisite schema files
4. Test incrementally (one trigger/procedure/view at a time)



