# View Integration Guide

## Overview
This guide explains how to use the database views in your PHP codebase.

## How to Query Views in PHP

Views are queried just like regular tables:

```php
// Query a view
$stmt = $pdo->prepare("SELECT * FROM v_product_catalog WHERE category_name = ?");
$stmt->execute(['Electronics']);
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

## View Usage Examples

### 1. Product Catalog View

**View:** `v_product_catalog`

**Usage:**
```php
// Get all products with category and stock info
$stmt = $pdo->query("SELECT * FROM v_product_catalog ORDER BY product_name");
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Filter by category
$stmt = $pdo->prepare("SELECT * FROM v_product_catalog WHERE category_name = ?");
$stmt->execute(['Electronics']);
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 2. Product Availability by Branch

**View:** `v_product_availability_by_branch`

**Usage:**
```php
// Get product availability across all branches
$stmt = $pdo->prepare("SELECT * FROM v_product_availability_by_branch WHERE product_id = ?");
$stmt->execute([$productId]);
$availability = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get all products for a specific branch
$stmt = $pdo->prepare("SELECT * FROM v_product_availability_by_branch WHERE branch_id = ? AND availability_status = 'In Stock'");
$stmt->execute([$branchId]);
$availableProducts = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 3. Order Summary View

**View:** `v_order_summary`

**Usage:**
```php
// Get order summary for a customer
$stmt = $pdo->prepare("SELECT * FROM v_order_summary WHERE user_id = ? ORDER BY order_date DESC");
$stmt->execute([$userId]);
$orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get order summary with payment status
$stmt = $pdo->prepare("SELECT * FROM v_order_summary WHERE payment_status = 'completed' ORDER BY order_date DESC");
$stmt->execute();
$completedOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 4. Order Details View

**View:** `v_order_details`

**Usage:**
```php
// Get detailed order items
$stmt = $pdo->prepare("SELECT * FROM v_order_details WHERE order_id = ?");
$stmt->execute([$orderId]);
$orderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 5. Order Dashboard View

**View:** `v_order_dashboard`

**Usage:**
```php
// Get dashboard data for admin
$stmt = $pdo->query("SELECT * FROM v_order_dashboard ORDER BY order_date DESC LIMIT 50");
$dashboardData = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Filter by branch
$stmt = $pdo->prepare("SELECT * FROM v_order_dashboard WHERE branch_id = ? ORDER BY order_date DESC");
$stmt->execute([$branchId]);
$branchOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 6. Branch Inventory Levels

**View:** `v_branch_inventory_levels`

**Usage:**
```php
// Get inventory levels for a branch
$stmt = $pdo->prepare("SELECT * FROM v_branch_inventory_levels WHERE branch_id = ? AND stock_status = 'Low Stock'");
$stmt->execute([$branchId]);
$lowStockItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 7. Daily Sales Totals

**View:** `v_daily_sales_totals`

**Usage:**
```php
// Get daily sales for a date range
$stmt = $pdo->prepare("SELECT * FROM v_daily_sales_totals WHERE sale_date BETWEEN ? AND ? ORDER BY sale_date DESC");
$stmt->execute([$startDate, $endDate]);
$dailySales = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get sales by branch
$stmt = $pdo->prepare("SELECT * FROM v_daily_sales_totals WHERE branch_id = ? ORDER BY sale_date DESC");
$stmt->execute([$branchId]);
$branchSales = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 8. Top Rated Products

**View:** `v_top_rated_products`

**Usage:**
```php
// Get top rated products
$stmt = $pdo->query("SELECT * FROM v_top_rated_products ORDER BY average_rating DESC, review_count DESC LIMIT 10");
$topProducts = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 9. Low Stock Alerts

**View:** `v_low_stock_alerts`

**Usage:**
```php
// Get all low stock alerts
$stmt = $pdo->query("SELECT * FROM v_low_stock_alerts ORDER BY alert_level, branch_name, product_name");
$alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get critical alerts only
$stmt = $pdo->query("SELECT * FROM v_low_stock_alerts WHERE alert_level IN ('Out of Stock', 'Critical Low Stock')");
$criticalAlerts = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 10. Customer Purchase Summary

**View:** `v_customer_purchase_summary`

**Usage:**
```php
// Get customer purchase summary
$stmt = $pdo->prepare("SELECT * FROM v_customer_purchase_summary WHERE user_id = ?");
$stmt->execute([$userId]);
$summary = $stmt->fetch(PDO::FETCH_ASSOC);

// Get top customers
$stmt = $pdo->query("SELECT * FROM v_customer_purchase_summary ORDER BY total_spent DESC LIMIT 10");
$topCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 11. Multi-Currency Product Prices (NEW)

**View:** `v_product_prices_multi_currency`

**Usage:**
```php
// Get product prices (base PHP prices - conversion happens in PHP)
$stmt = $pdo->query("SELECT * FROM v_product_prices_multi_currency ORDER BY product_name");
$products = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Note: Actual currency conversion is handled in PHP using currency_api.php
// This view provides base PHP prices for reference
```

### 12. Order Status Timeline (NEW)

**View:** `v_order_status_timeline`

**Usage:**
```php
// Get order status history
$stmt = $pdo->prepare("SELECT * FROM v_order_status_timeline WHERE order_id = ? ORDER BY status_change_date DESC");
$stmt->execute([$orderId]);
$timeline = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 13. Orders with Payment Details (NEW)

**View:** `v_orders_with_payment_details`

**Usage:**
```php
// Get orders with payment info
$stmt = $pdo->query("SELECT * FROM v_orders_with_payment_details WHERE payment_status = 'pending' ORDER BY order_date DESC");
$pendingPayments = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get orders by payment method
$stmt = $pdo->prepare("SELECT * FROM v_orders_with_payment_details WHERE payment_method = ? ORDER BY order_date DESC");
$stmt->execute([$paymentMethod]);
$orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 14. Shopping Cart Details (NEW)

**View:** `v_shopping_cart_details`

**Usage:**
```php
// Get all cart items for a user
$stmt = $pdo->prepare("SELECT * FROM v_shopping_cart_details WHERE user_id = ? ORDER BY added_to_cart_date DESC");
$stmt->execute([$userId]);
$cartItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get abandoned carts (items in cart for more than 7 days)
$stmt = $pdo->query("SELECT * FROM v_shopping_cart_details WHERE days_in_cart > 7 ORDER BY days_in_cart DESC");
$abandonedCarts = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get out of stock items in carts
$stmt = $pdo->query("SELECT * FROM v_shopping_cart_details WHERE stock_status = 'Out of Stock'");
$outOfStockCarts = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 15. Transaction Log Activities (NEW)

**View:** `v_transaction_log_activities`

**Usage:**
```php
// Get recent admin/staff activities
$stmt = $pdo->query("SELECT * FROM v_transaction_log_activities ORDER BY activity_date DESC LIMIT 50");
$activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get activities by user
$stmt = $pdo->prepare("SELECT * FROM v_transaction_log_activities WHERE performed_by = ? ORDER BY activity_date DESC");
$stmt->execute([$userId]);
$userActivities = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get activities by type
$stmt = $pdo->prepare("SELECT * FROM v_transaction_log_activities WHERE activity_type = ? ORDER BY activity_date DESC");
$stmt->execute(['Modification']);
$modifications = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get activities from last 24 hours
$stmt = $pdo->query("SELECT * FROM v_transaction_log_activities WHERE hours_ago < 24 ORDER BY activity_date DESC");
$recentActivities = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

## Integration Examples

### Example 1: Admin Dashboard

```php
// backend/api/admin/dashboard.php
require_once __DIR__ . '/../../config/database.php';

// Get daily sales
$stmt = $pdo->query("
    SELECT * FROM v_daily_sales_totals 
    WHERE sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ORDER BY sale_date DESC
");
$dailySales = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get low stock alerts
$stmt = $pdo->query("
    SELECT * FROM v_low_stock_alerts 
    WHERE alert_level IN ('Out of Stock', 'Critical Low Stock')
    ORDER BY alert_level, branch_name
");
$alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get recent activities
$stmt = $pdo->query("
    SELECT * FROM v_transaction_log_activities 
    WHERE hours_ago < 24
    ORDER BY activity_date DESC
    LIMIT 20
");
$activities = $stmt->fetchAll(PDO::FETCH_ASSOC);

sendResponse([
    'daily_sales' => $dailySales,
    'low_stock_alerts' => $alerts,
    'recent_activities' => $activities
], 'Dashboard data retrieved successfully');
```

### Example 2: Customer Order History

```php
// backend/api/orders/history.php
require_once __DIR__ . '/../../config/database.php';

$userId = validateToken($token);

// Get order summary
$stmt = $pdo->prepare("SELECT * FROM v_order_summary WHERE user_id = ? ORDER BY order_date DESC");
$stmt->execute([$userId]);
$orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get customer purchase summary
$stmt = $pdo->prepare("SELECT * FROM v_customer_purchase_summary WHERE user_id = ?");
$stmt->execute([$userId]);
$summary = $stmt->fetch(PDO::FETCH_ASSOC);

sendResponse([
    'orders' => $orders,
    'summary' => $summary
], 'Order history retrieved successfully');
```

### Example 3: Abandoned Cart Report

```php
// backend/api/admin/reports/abandoned_carts.php
require_once __DIR__ . '/../../../config/database.php';

// Get abandoned carts (items in cart for more than 3 days)
$stmt = $pdo->query("
    SELECT 
        user_id,
        username,
        email,
        COUNT(*) AS items_in_cart,
        SUM(line_total_php) AS total_cart_value,
        MAX(days_in_cart) AS oldest_item_days,
        GROUP_CONCAT(DISTINCT product_name) AS products
    FROM v_shopping_cart_details
    WHERE days_in_cart > 3
    GROUP BY user_id, username, email
    ORDER BY total_cart_value DESC
");
$abandonedCarts = $stmt->fetchAll(PDO::FETCH_ASSOC);

sendResponse($abandonedCarts, 'Abandoned carts retrieved successfully');
```

## Important Notes

1. **Views are Read-Only**: Views cannot be directly updated. Update the underlying tables instead.

2. **Performance**: Views are virtual tables. Complex views may have performance implications. Consider indexing underlying tables.

3. **Currency Conversion**: The `v_product_prices_multi_currency` view shows base PHP prices. Actual currency conversion is handled dynamically in PHP using the currency API.

4. **Transaction Log**: The `v_transaction_log_activities` view depends on the `transaction_log` table structure. Adjust if your schema differs.

5. **Order Status Timeline**: This view uses `transaction_log` to track status changes. If you have a dedicated `order_status_history` table, modify the view accordingly.

## Summary

- ✅ **10 views** already exist and are ready to use
- ✅ **5 new views** created in `07_create_missing_views_mysql.sql`
- ✅ **Integration examples** provided for all views

All views are ready to be integrated with your PHP code!



