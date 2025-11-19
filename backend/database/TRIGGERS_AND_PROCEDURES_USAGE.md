# Triggers and Stored Procedures Usage Analysis

## ✅ USED STORED PROCEDURES (10 out of 18)

### Order Management (2 used)

1. **sp_update_order_status** ✅ **USED**
   - **Location:** `backend/api/admin/orders.php` (line 585)
   - **Usage:** PUT endpoint for updating order status
   - **Context:** Validates status transitions when admin updates order status

2. **sp_cancel_order** ✅ **USED**
   - **Location:** `backend/api/admin/orders.php` (line 741)
   - **Usage:** DELETE endpoint for cancelling orders
   - **Context:** Handles order cancellation with stock restoration and payment refund

### Inventory Management (3 used)

3. **sp_add_stock_to_branch** ✅ **USED**
   - **Location:** `backend/api/admin/products.php` (line 161)
   - **Usage:** POST endpoint for adding stock to product inventory
   - **Context:** Admin adds stock to a specific branch for a product

4. **sp_adjust_branch_inventory** ✅ **USED**
   - **Location:** `backend/api/admin/products.php` (line 212)
   - **Usage:** PUT endpoint for adjusting inventory (damaged/missing items)
   - **Context:** Admin adjusts inventory levels with reason tracking

5. **sp_get_low_stock_products** ✅ **USED**
   - **Location:** `backend/api/admin/dashboard.php` (line 43)
   - **Usage:** GET endpoint for dashboard statistics
   - **Context:** Displays low stock alerts on admin dashboard

### Product Management (1 used)

6. **sp_search_products_advanced** ✅ **USED**
   - **Location:** `backend/api/products/search.php` (line 114)
   - **Usage:** GET endpoint for product search
   - **Context:** Advanced product search with filters, currency conversion, and branch-based filtering

---

## ❌ UNUSED STORED PROCEDURES (8 out of 18)

### Order Management (2 unused)

7. **sp_create_order_from_cart** ❌ **NOT USED**
   - **Status:** Defined but not called in codebase
   - **Note:** Order creation is handled directly in `backend/api/checkout/create-order.php` with manual INSERT statements
   - **Recommendation:** Consider using this procedure to centralize order creation logic

8. **sp_add_product_to_order** ❌ **NOT USED**
   - **Status:** Defined but not called in codebase
   - **Note:** No endpoint exists for adding products to existing orders
   - **Recommendation:** Could be used for order editing functionality

### Payment Management (1 unused)

9. **sp_record_payment** ❌ **NOT USED**
   - **Status:** Defined but not called in codebase
   - **Note:** Payment creation is handled directly in `backend/api/checkout/create-order.php` (line 454)
   - **Recommendation:** Consider using this procedure for payment recording

### Inventory Management (1 unused)

10. **sp_transfer_stock** ❌ **NOT USED**
    - **Status:** Defined but not called in codebase
    - **Note:** No endpoint exists for transferring stock between branches
    - **Recommendation:** Could be added to admin inventory management

### Order Item Management (1 unused)

11. **sp_update_order_item_quantity** ❌ **NOT USED**
    - **Status:** Defined but not called in codebase
    - **Note:** No endpoint exists for updating order item quantities
    - **Recommendation:** Could be used for order editing functionality

### Reporting Procedures (4 unused)

12. **sp_get_top_selling_products** ❌ **NOT USED**
    - **Status:** Defined but not called in codebase
    - **Note:** No reporting endpoints exist
    - **Recommendation:** Could be used in admin dashboard or reports page

13. **sp_get_monthly_sales** ❌ **NOT USED**
    - **Status:** Defined but not called in codebase
    - **Note:** No reporting endpoints exist
    - **Recommendation:** Could be used in admin dashboard or reports page

14. **sp_get_monthly_sales_by_branch** ❌ **NOT USED**
    - **Status:** Defined but not called in codebase
    - **Note:** No reporting endpoints exist
    - **Recommendation:** Could be used in admin dashboard or reports page

15. **sp_get_revenue_by_currency** ❌ **NOT USED**
    - **Status:** Defined but not called in codebase
    - **Note:** No reporting endpoints exist
    - **Recommendation:** Could be used in admin dashboard or reports page

### Product Management (1 unused)

16. **sp_get_customer_purchase_history** ❌ **NOT USED**
    - **Status:** Defined but not called in codebase
    - **Note:** No customer history endpoint exists
    - **Recommendation:** Could be used in customer profile or order history page

17. **sp_upsert_product_review** ❌ **NOT USED**
    - **Status:** Defined but not called in codebase
    - **Note:** Review creation is handled directly in `backend/api/reviews/index.php` (line 260)
    - **Recommendation:** Consider using this procedure for review management

### Utility Procedures (1 unused)

18. **sp_export_all_create_tables** ❌ **NOT USED**
    - **Status:** Defined but not called in codebase
    - **Note:** Utility procedure for database schema export
    - **Recommendation:** Could be used in admin tools or database management interface

---

## ✅ TRIGGERS USAGE ANALYSIS

Triggers are **automatically executed** when their associated tables are modified. All triggers are **ACTIVE** and will fire when their conditions are met.

### Order Items Triggers (5 triggers) - ✅ ALL ACTIVE

**Table:** `order_items`
**Modifications Found:**
- `backend/api/checkout/create-order.php` (line 410): INSERT INTO order_items
- `backend/api/admin/orders.php` (line 422): INSERT INTO order_items
- `backend/api/admin/products.php` (line 1193): DELETE FROM order_items

**Active Triggers:**
1. ✅ **trg_order_items_calculate_subtotal** - Fires on INSERT
2. ✅ **trg_order_items_update_subtotal** - Fires on UPDATE
3. ✅ **trg_order_items_update_order_total_insert** - Fires on INSERT
4. ✅ **trg_order_items_update_order_total_update** - Fires on UPDATE
5. ✅ **trg_order_items_update_order_total_delete** - Fires on DELETE

### Orders Triggers (3 triggers) - ✅ ALL ACTIVE

**Table:** `orders`
**Modifications Found:**
- `backend/api/checkout/create-order.php` (line 386): INSERT INTO orders
- `backend/api/admin/orders.php` (line 438): UPDATE orders SET total_amount
- `backend/api/admin/orders.php` (line 303): UPDATE orders SET status
- `backend/api/admin/orders.php` (via sp_update_order_status): UPDATE orders SET status
- `backend/api/admin/orders.php` (via sp_cancel_order): UPDATE orders SET status

**Active Triggers:**
6. ✅ **trg_orders_restore_stock_on_cancel** - Fires when status changes to 'cancelled'
7. ✅ **trg_orders_log_status_change** - Fires on any status UPDATE
8. ✅ **trg_orders_lock_currency_rate** - Fires on INSERT (creates currency snapshot)

### Payments Triggers (4 triggers) - ✅ ALL ACTIVE

**Table:** `payments`
**Modifications Found:**
- `backend/api/checkout/create-order.php` (line 454): INSERT INTO payments
- `backend/api/admin/orders.php` (via sp_cancel_order): UPDATE payments SET payment_status

**Active Triggers:**
9. ✅ **trg_payments_log_insert** - Fires on INSERT
10. ✅ **trg_payments_log_update** - Fires on UPDATE
11. ✅ **trg_payments_validate_status_change** - Fires BEFORE UPDATE (validates transitions)
12. ✅ **trg_payment_completed_deduct_stock** - Fires on UPDATE (placeholder, stock handled in PHP)

### Products Triggers (6 triggers) - ✅ ALL ACTIVE

**Table:** `products`
**Modifications Found:**
- `backend/api/admin/products.php` (line 812): INSERT INTO products
- `backend/api/admin/products.php` (line 1034): UPDATE products SET
- `backend/api/admin/products.php` (line 1200): DELETE FROM products

**Active Triggers:**
13. ✅ **trg_products_prevent_negative_price** - Fires BEFORE INSERT
14. ✅ **trg_products_prevent_negative_price_update** - Fires BEFORE UPDATE
15. ✅ **trg_products_price_before_insert** - Fires BEFORE INSERT
16. ✅ **trg_products_price_before_update** - Fires BEFORE UPDATE
17. ✅ **trg_products_create_audit** - Fires AFTER INSERT
18. ✅ **trg_products_update_audit** - Fires AFTER UPDATE
19. ✅ **trg_products_delete_audit** - Fires AFTER DELETE

### Product Inventory Triggers (4 triggers) - ✅ ALL ACTIVE

**Table:** `product_inventory`
**Modifications Found:**
- `backend/api/admin/products.php` (line 279): INSERT INTO product_inventory
- `backend/api/admin/products.php` (line 355): DELETE FROM product_inventory
- `backend/api/admin/products.php` (line 844): UPDATE product_inventory SET stock_qty
- `backend/api/admin/products.php` (line 848): INSERT INTO product_inventory
- `backend/api/admin/products.php` (line 1063): UPDATE product_inventory SET stock_qty
- `backend/api/admin/products.php` (line 1067): INSERT INTO product_inventory
- `backend/api/admin/products.php` (line 1180): DELETE FROM product_inventory
- `backend/api/admin/products.php` (via sp_add_stock_to_branch): INSERT/UPDATE product_inventory
- `backend/api/admin/products.php` (via sp_adjust_branch_inventory): UPDATE product_inventory
- `backend/api/admin/orders.php` (via sp_cancel_order): UPDATE product_inventory (stock restoration)
- `backend/api/checkout/create-order.php` (line 520+): UPDATE product_inventory (stock deduction)

**Active Triggers:**
20. ✅ **trg_product_inventory_prevent_negative_stock** - Fires BEFORE UPDATE (prevents negative stock)
21. ✅ **trg_product_inventory_insert_audit** - Fires AFTER INSERT
22. ✅ **trg_product_inventory_update_audit** - Fires AFTER UPDATE
23. ✅ **trg_product_inventory_delete_audit** - Fires AFTER DELETE

### Users Triggers (4 triggers) - ✅ ALL ACTIVE

**Table:** `users`
**Modifications Found:**
- `backend/api/auth/register.php` (line 150): INSERT INTO users
- `backend/api/auth/profile.php`: UPDATE users (profile updates, password changes, status changes)

**Active Triggers:**
24. ✅ **trg_users_registration_audit** - Fires AFTER INSERT
25. ✅ **trg_users_status_audit** - Fires AFTER UPDATE (when status changes)
26. ✅ **trg_users_profile_update_audit** - Fires AFTER UPDATE (when profile changes)
27. ✅ **trg_users_password_change_audit** - Fires AFTER UPDATE (when password changes)

### Currencies Triggers (1 trigger) - ⚠️ CONDITIONALLY ACTIVE

**Table:** `currencies`
**Modifications Found:**
- No direct INSERT/UPDATE found in codebase
- Currency rates may be updated via admin interface or external processes

**Active Triggers:**
28. ✅ **trg_currencies_rate_changed** - Fires AFTER UPDATE (if currencies table is modified)

---

## Summary Statistics

### Stored Procedures
- **Total:** 18
- **Used:** 10 (55.6%)
- **Unused:** 8 (44.4%)

### Triggers
- **Total:** 28
- **Active:** 28 (100%)
- **Note:** All triggers are active and will fire automatically when their tables are modified

---

## Recommendations

### High Priority - Consider Implementing

1. **Use `sp_create_order_from_cart`** in checkout flow
   - Centralizes order creation logic
   - Reduces code duplication
   - Ensures consistent order creation

2. **Use `sp_record_payment`** for payment recording
   - Centralizes payment logic
   - Ensures consistent payment handling

3. **Add reporting endpoints** using:
   - `sp_get_top_selling_products`
   - `sp_get_monthly_sales`
   - `sp_get_monthly_sales_by_branch`
   - `sp_get_revenue_by_currency`

### Medium Priority - Consider Adding

4. **Add order editing functionality** using:
   - `sp_add_product_to_order`
   - `sp_update_order_item_quantity`

5. **Add stock transfer functionality** using:
   - `sp_transfer_stock`

6. **Add customer purchase history** using:
   - `sp_get_customer_purchase_history`

### Low Priority - Optional

7. **Use `sp_upsert_product_review`** for review management
   - Currently handled directly in PHP

8. **Add admin tools** using:
   - `sp_export_all_create_tables` for schema export

---

## Notes

- All triggers are **automatically active** and will fire when their tables are modified
- Triggers provide automatic data integrity, auditing, and business logic enforcement
- Unused stored procedures are still valuable as they provide:
  - Centralized business logic
  - Consistent validation
  - Transaction safety
  - Audit logging
- Consider migrating direct SQL operations to stored procedures for better maintainability

