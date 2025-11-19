# Complete List of Triggers and Stored Procedures

## TRIGGERS (28 Total)

### Order Items Triggers (5)

1. **trg_order_items_calculate_subtotal**
   - **Event:** INSERT
   - **Table:** `order_items`
   - **Timing:** BEFORE
   - **Description:** Automatically calculates subtotal (quantity × unit_price) when a new order item is inserted. If subtotal is NULL or 0, it calculates it automatically.

2. **trg_order_items_update_subtotal**
   - **Event:** UPDATE
   - **Table:** `order_items`
   - **Timing:** BEFORE
   - **Description:** Recalculates subtotal when quantity or unit_price is updated in an order item.

3. **trg_order_items_update_order_total_insert**
   - **Event:** INSERT
   - **Table:** `order_items`
   - **Timing:** AFTER
   - **Description:** Automatically recalculates and updates the order's total_amount when a new order item is added.

4. **trg_order_items_update_order_total_update**
   - **Event:** UPDATE
   - **Table:** `order_items`
   - **Timing:** AFTER
   - **Description:** Automatically recalculates and updates the order's total_amount when an order item is modified.

5. **trg_order_items_update_order_total_delete**
   - **Event:** DELETE
   - **Table:** `order_items`
   - **Timing:** AFTER
   - **Description:** Automatically recalculates and updates the order's total_amount when an order item is removed.

### Orders Triggers (3)

6. **trg_orders_restore_stock_on_cancel**
   - **Event:** UPDATE
   - **Table:** `orders`
   - **Timing:** AFTER
   - **Description:** Automatically restores stock to inventory when an order status changes to 'cancelled'. Restores stock for all items in the cancelled order.

7. **trg_orders_log_status_change**
   - **Event:** UPDATE
   - **Table:** `orders`
   - **Timing:** AFTER
   - **Description:** Logs every order status change (Pending → Processing → Shipped → Delivered) to the transaction_log table with old and new status information.

8. **trg_orders_lock_currency_rate**
   - **Event:** INSERT
   - **Table:** `orders`
   - **Timing:** AFTER
   - **Description:** Locks the currency exchange rate at the time of order creation by creating a snapshot in order_currency_snapshots table. Ensures accurate historical pricing even if exchange rates change later.

### Payments Triggers (4)

9. **trg_payments_log_insert**
   - **Event:** INSERT
   - **Table:** `payments`
   - **Timing:** AFTER
   - **Description:** Logs all new payment records to the transaction_log table with payment details (method, status, amount, currency, transaction_id).

10. **trg_payments_log_update**
    - **Event:** UPDATE
    - **Table:** `payments`
    - **Timing:** AFTER
    - **Description:** Logs payment status changes to the transaction_log table, recording old and new status along with payment details.

11. **trg_payments_validate_status_change**
    - **Event:** UPDATE
    - **Table:** `payments`
    - **Timing:** BEFORE
    - **Description:** Validates payment status transitions to prevent invalid changes. Prevents moving from Completed to Pending/Failed, and prevents changing Refunded status.

12. **trg_payment_completed_deduct_stock**
    - **Event:** UPDATE
    - **Table:** `payments`
    - **Timing:** AFTER
    - **Description:** Placeholder trigger for stock deduction when payment is completed. Actual stock deduction is handled in PHP application code for better transaction control.

### Products Triggers (6)

13. **trg_products_prevent_negative_price**
    - **Event:** INSERT
    - **Table:** `products`
    - **Timing:** BEFORE
    - **Description:** Prevents insertion of products with negative prices. Raises an error if price < 0.

14. **trg_products_prevent_negative_price_update**
    - **Event:** UPDATE
    - **Table:** `products`
    - **Timing:** BEFORE
    - **Description:** Prevents updating product prices to negative values. Raises an error if new price < 0.

15. **trg_products_price_before_insert**
    - **Event:** INSERT
    - **Table:** `products`
    - **Timing:** BEFORE
    - **Description:** Validates and processes product price before insertion (additional price validation/formatting).

16. **trg_products_price_before_update**
    - **Event:** UPDATE
    - **Table:** `products`
    - **Timing:** BEFORE
    - **Description:** Validates and processes product price before update (additional price validation/formatting).

17. **trg_products_create_audit**
    - **Event:** INSERT
    - **Table:** `products`
    - **Timing:** AFTER
    - **Description:** Logs new product creation to audit_logs table with product name and ID.

18. **trg_products_update_audit**
    - **Event:** UPDATE
    - **Table:** `products`
    - **Timing:** AFTER
    - **Description:** Logs product updates to audit_logs table, recording which fields were changed (category_id, product_name, brand, model, description, price, specifications).

19. **trg_products_delete_audit**
    - **Event:** DELETE
    - **Table:** `products`
    - **Timing:** AFTER
    - **Description:** Logs product deletion to audit_logs table with product name and ID.

### Product Inventory Triggers (4)

20. **trg_product_inventory_prevent_negative_stock**
    - **Event:** UPDATE
    - **Table:** `product_inventory`
    - **Timing:** BEFORE
    - **Description:** Prevents stock quantity from going negative. Raises an error with product ID and branch ID if stock would become negative.

21. **trg_product_inventory_insert_audit**
    - **Event:** INSERT
    - **Table:** `product_inventory`
    - **Timing:** AFTER
    - **Description:** Logs new inventory entries to audit_logs table with product name, branch ID, and stock quantity.

22. **trg_product_inventory_update_audit**
    - **Event:** UPDATE
    - **Table:** `product_inventory`
    - **Timing:** AFTER
    - **Description:** Logs inventory updates to audit_logs table, recording changes to stock quantity, branch ID, or safety stock.

23. **trg_product_inventory_delete_audit**
    - **Event:** DELETE
    - **Table:** `product_inventory`
    - **Timing:** AFTER
    - **Description:** Logs inventory removal to audit_logs table with product name, branch ID, and stock quantity.

### Users Triggers (4)

24. **trg_users_registration_audit**
    - **Event:** INSERT
    - **Table:** `users`
    - **Timing:** AFTER
    - **Description:** Logs new user registration to audit_logs table with username.

25. **trg_users_status_audit**
    - **Event:** UPDATE
    - **Table:** `users`
    - **Timing:** AFTER
    - **Description:** Logs user status changes to audit_logs table when user status is updated.

26. **trg_users_profile_update_audit**
    - **Event:** UPDATE
    - **Table:** `users`
    - **Timing:** AFTER
    - **Description:** Logs user profile updates to audit_logs table when user profile information is modified.

27. **trg_users_password_change_audit**
    - **Event:** UPDATE
    - **Table:** `users`
    - **Timing:** AFTER
    - **Description:** Logs password changes to audit_logs table for security auditing purposes.

### Currencies Triggers (1)

28. **trg_currencies_rate_changed**
    - **Event:** UPDATE
    - **Table:** `currencies`
    - **Timing:** AFTER
    - **Description:** Logs currency exchange rate changes to track rate updates and maintain audit trail of rate modifications.

---

## STORED PROCEDURES (18 Total)

### Order Management Procedures (4)

1. **sp_create_order_from_cart**
   - **Description:** Creates a new order from the user's cart items. Calculates total amount, creates order record, adds all cart items as order items, creates payment record, and optionally clears the cart. Handles currency conversion and branch assignment.
   - **Parameters:** `p_user_id`, `p_branch_id`, `p_currency`, `p_shipping_address`, `p_payment_method`, `p_user_id_for_audit`
   - **Returns:** Order ID and success message

2. **sp_add_product_to_order**
   - **Description:** Adds a specific product to an existing order. If the product already exists in the order, it updates the quantity. Validates that order can be modified (not shipped/delivered/cancelled). Automatically recalculates order totals via triggers.
   - **Parameters:** `p_order_id`, `p_product_id`, `p_quantity`, `p_unit_price`, `p_user_id`
   - **Returns:** Success message

3. **sp_update_order_status**
   - **Description:** Validates and updates order status with proper state transitions (Pending → Processing → Shipped → Delivered). Prevents invalid transitions and ensures payment is completed before processing. Logs status changes via triggers.
   - **Parameters:** `p_order_id`, `p_new_status`, `p_user_id`
   - **Returns:** Success message

4. **sp_cancel_order**
   - **Description:** Cancels an order and automatically restores stock to inventory. Validates that order can be cancelled (not delivered). Updates payment status to refunded if payment was completed. Uses transaction for atomicity.
   - **Parameters:** `p_order_id`, `p_user_id`
   - **Returns:** Success message

### Payment Procedures (1)

5. **sp_record_payment**
   - **Description:** Records a customer payment and updates payment status. If payment already exists, updates it; otherwise creates new payment record. Updates order status to processing. Logs payment activities via triggers.
   - **Parameters:** `p_order_id`, `p_payment_method`, `p_amount`, `p_currency`, `p_transaction_id`, `p_user_id`
   - **Returns:** Success message

### Inventory Management Procedures (4)

6. **sp_add_stock_to_branch**
   - **Description:** Adds new product stock to a specific branch. Creates new inventory entry if it doesn't exist, or updates existing stock. Logs the stock addition to transaction_log.
   - **Parameters:** `p_product_id`, `p_branch_id`, `p_quantity`, `p_user_id`
   - **Returns:** Success message

7. **sp_adjust_branch_inventory**
   - **Description:** Adjusts branch inventory levels for reasons like damaged or missing items. Validates that adjustment won't result in negative stock. Logs the adjustment with reason to transaction_log.
   - **Parameters:** `p_product_id`, `p_branch_id`, `p_adjustment_quantity`, `p_reason`, `p_user_id`
   - **Returns:** Success message

8. **sp_transfer_stock**
   - **Description:** Transfers product stock from one branch to another. Validates sufficient stock in source branch and prevents transferring to same branch. Uses transaction for atomicity. Logs transfer to transaction_log.
   - **Parameters:** `p_product_id`, `p_from_branch_id`, `p_to_branch_id`, `p_quantity`, `p_user_id`
   - **Returns:** Success message

9. **sp_get_low_stock_products**
   - **Description:** Lists all products below a certain stock level threshold for a specific branch (or all branches if branch_id is NULL). Useful for inventory alerts and restocking.
   - **Parameters:** `p_threshold`, `p_branch_id`
   - **Returns:** List of products with low stock including product details, branch info, and current stock quantity

### Order Item Procedures (1)

10. **sp_update_order_item_quantity**
    - **Description:** Updates order item quantity and automatically recalculates subtotal and order total via triggers. Validates that order can be modified and quantity is positive.
    - **Parameters:** `p_order_item_id`, `p_new_quantity`, `p_user_id`
    - **Returns:** Success message

### Reporting Procedures (5)

11. **sp_get_top_selling_products**
    - **Description:** Generates a report of top-selling products for a specific date range. Returns products sorted by total quantity sold, including total orders, total revenue, and product details. Only includes completed payments and non-cancelled orders.
    - **Parameters:** `p_start_date`, `p_end_date`, `p_limit`
    - **Returns:** List of top-selling products with sales statistics

12. **sp_get_monthly_sales**
    - **Description:** Calculates total sales and revenue for a selected month. Returns total orders, total customers, total revenue, average order value grouped by currency. Only includes completed payments and non-cancelled orders.
    - **Parameters:** `p_year`, `p_month`
    - **Returns:** Monthly sales summary by currency

13. **sp_get_monthly_sales_by_branch**
    - **Description:** Produces a monthly sales comparison report per branch. Returns sales statistics (orders, customers, revenue, average order value) grouped by branch and currency. Useful for branch performance comparison.
    - **Parameters:** `p_year`, `p_month`
    - **Returns:** Monthly sales summary by branch and currency

14. **sp_get_revenue_by_currency**
    - **Description:** Calculates total revenue grouped by currency used within a date range. Returns comprehensive statistics including total orders, customers, revenue, average/min/max order values per currency.
    - **Parameters:** `p_start_date`, `p_end_date`
    - **Returns:** Revenue statistics grouped by currency

15. **sp_get_customer_purchase_history**
    - **Description:** Displays all orders and items purchased by a particular customer within a date range. Returns detailed order information including order items, product details, payment information, and shipping details.
    - **Parameters:** `p_user_id`, `p_start_date`, `p_end_date`
    - **Returns:** Complete purchase history with order and item details

### Product Procedures (2)

16. **sp_search_products_advanced**
    - **Description:** Advanced product search with multiple filters including keyword search, category/genre, release date (year/month), price range, in-stock filter, and sorting options. Supports currency conversion. Different behavior for logged-in users (shows products from their branch) vs non-logged-in users (shows unassigned products).
    - **Parameters:** `p_currency`, `p_branch_id`, `p_q` (keyword), `p_genre_id`, `p_year`, `p_month`, `p_price_min`, `p_price_max`, `p_in_stock`, `p_sort`, `p_limit`, `p_offset`
    - **Returns:** Two result sets: total count (for pagination) and product list with details

17. **sp_upsert_product_review**
    - **Description:** Inserts or updates a product review made by a customer. If review already exists, updates it; otherwise creates new review. Validates rating is between 1 and 5.
    - **Parameters:** `p_user_id`, `p_product_id`, `p_rating`, `p_comment`
    - **Returns:** Review ID and success message

### Utility Procedures (1)

18. **sp_export_all_create_tables**
    - **Description:** Utility procedure to export all CREATE TABLE statements for all tables in the database. Useful for database schema documentation and migration scripts.
    - **Parameters:** None
    - **Returns:** List of table names and their CREATE TABLE statements

---

## Summary Statistics

- **Total Triggers:** 28
- **Total Stored Procedures:** 18
- **Total Database Objects:** 46

### Triggers by Category:
- Order Items: 5 triggers
- Orders: 3 triggers
- Payments: 4 triggers
- Products: 6 triggers
- Product Inventory: 4 triggers
- Users: 4 triggers
- Currencies: 1 trigger
- Other: 1 trigger

### Stored Procedures by Category:
- Order Management: 4 procedures
- Payment Management: 1 procedure
- Inventory Management: 4 procedures
- Order Item Management: 1 procedure
- Reporting: 5 procedures
- Product Management: 2 procedures
- Utility: 1 procedure

---

## Notes

- All triggers use `@audit_user_id` session variable for audit logging when available
- Most triggers log to either `audit_logs` or `transaction_log` tables
- Stored procedures use transactions where appropriate for data integrity
- Currency conversion is handled in procedures that support multiple currencies
- Branch-based inventory management is integrated throughout the system

