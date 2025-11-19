# Stored Procedure Integration Guide

## Overview
This guide explains how to integrate stored procedures with your PHP codebase.

## How to Call Stored Procedures in PHP

### Basic Pattern

```php
// 1. Prepare the CALL statement
$stmt = $pdo->prepare("CALL sp_procedure_name(?, ?, ?)");

// 2. Execute with parameters
$stmt->execute([$param1, $param2, $param3]);

// 3. Fetch results
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

// 4. Close cursor (IMPORTANT for stored procedures)
$stmt->closeCursor();
```

### Using the Helper Function

We've created a helper function in `backend/utils/stored_procedure_helper.php`:

```php
require_once __DIR__ . '/../../utils/stored_procedure_helper.php';

// Call procedure and get all results
$results = callStoredProcedure($pdo, 'sp_get_top_selling_products', [
    '2024-01-01',
    '2024-12-31',
    10
]);

// Call procedure and get single result
$result = callStoredProcedureSingle($pdo, 'sp_get_monthly_sales', [2024, 11]);

// Call procedure that returns a message
$message = callStoredProcedureMessage($pdo, 'sp_cancel_order', [$orderId, $userId]);
```

## Integration Examples

### 1. Top-Selling Products Report

**In Admin Dashboard API:**

```php
// backend/api/admin/reports.php (create this file)
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/stored_procedure_helper.php';

$startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
$endDate = $_GET['end_date'] ?? date('Y-m-d');
$limit = (int)($_GET['limit'] ?? 10);

$results = callStoredProcedure($pdo, 'sp_get_top_selling_products', [
    $startDate,
    $endDate,
    $limit
]);

sendResponse($results, 'Top selling products retrieved successfully');
```

### 2. Cancel Order (Replace Current Logic)

**In admin/orders.php:**

```php
// Replace the DELETE case with:
case 'DELETE':
    if (!$orderIdParam) {
        sendError('Order ID required', 400);
    }
    
    require_once __DIR__ . '/../../utils/stored_procedure_helper.php';
    
    try {
        $message = callStoredProcedureMessage($pdo, 'sp_cancel_order', [
            $orderIdParam,
            $userId
        ]);
        
        sendResponse(null, $message ?? 'Order cancelled successfully');
    } catch (PDOException $e) {
        sendError('Failed to cancel order: ' . $e->getMessage(), 500);
    }
    break;
```

### 3. Update Order Item Quantity

**In admin/orders.php:**

```php
// Add new endpoint or modify existing PUT case
if (isset($input['update_item_quantity'])) {
    require_once __DIR__ . '/../../utils/stored_procedure_helper.php';
    
    $orderItemId = (int)$input['order_item_id'];
    $newQuantity = (int)$input['quantity'];
    
    try {
        $message = callStoredProcedureMessage($pdo, 'sp_update_order_item_quantity', [
            $orderItemId,
            $newQuantity,
            $userId
        ]);
        
        sendResponse(null, $message ?? 'Order item updated successfully');
    } catch (PDOException $e) {
        sendError('Failed to update order item: ' . $e->getMessage(), 500);
    }
}
```

### 4. Transfer Stock Between Branches

**In admin/inventory.php (create this file):**

```php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/stored_procedure_helper.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $productId = (int)$input['product_id'];
    $fromBranchId = (int)$input['from_branch_id'];
    $toBranchId = (int)$input['to_branch_id'];
    $quantity = (int)$input['quantity'];
    
    // Get user ID from token
    $userId = validateToken($token);
    
    try {
        $message = callStoredProcedureMessage($pdo, 'sp_transfer_stock', [
            $productId,
            $fromBranchId,
            $toBranchId,
            $quantity,
            $userId
        ]);
        
        sendResponse(null, $message ?? 'Stock transferred successfully');
    } catch (PDOException $e) {
        sendError('Failed to transfer stock: ' . $e->getMessage(), 500);
    }
}
```

### 5. Get Low Stock Products

**In admin/dashboard.php:**

```php
// Add to existing dashboard endpoint
$threshold = (int)($_GET['low_stock_threshold'] ?? 10);
$branchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : null;

require_once __DIR__ . '/../../utils/stored_procedure_helper.php';

$lowStockProducts = callStoredProcedure($pdo, 'sp_get_low_stock_products', [
    $threshold,
    $branchId
]);

// Add to response
$response['low_stock_products'] = $lowStockProducts;
```

### 6. Monthly Sales Report

**In admin/reports.php:**

```php
$year = (int)($_GET['year'] ?? date('Y'));
$month = (int)($_GET['month'] ?? date('m'));

$monthlySales = callStoredProcedure($pdo, 'sp_get_monthly_sales', [$year, $month]);
$monthlySalesByBranch = callStoredProcedure($pdo, 'sp_get_monthly_sales_by_branch', [$year, $month]);

sendResponse([
    'monthly_sales' => $monthlySales,
    'monthly_sales_by_branch' => $monthlySalesByBranch
], 'Monthly sales report retrieved successfully');
```

### 7. Customer Purchase History

**In orders/index.php:**

```php
// Add new endpoint for customer purchase history
if (isset($_GET['purchase_history'])) {
    require_once __DIR__ . '/../../utils/stored_procedure_helper.php';
    
    $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-1 year'));
    $endDate = $_GET['end_date'] ?? date('Y-m-d');
    
    $history = callStoredProcedure($pdo, 'sp_get_customer_purchase_history', [
        $userId,
        $startDate,
        $endDate
    ]);
    
    sendResponse($history, 'Purchase history retrieved successfully');
}
```

### 8. Update Order Status (With Validation)

**In admin/orders.php:**

```php
// Replace status update logic with:
if (isset($input['status'])) {
    require_once __DIR__ . '/../../utils/stored_procedure_helper.php';
    
    try {
        $message = callStoredProcedureMessage($pdo, 'sp_update_order_status', [
            $orderIdParam,
            $input['status'],
            $userId
        ]);
        
        sendResponse(null, $message ?? 'Order status updated successfully');
    } catch (PDOException $e) {
        sendError('Failed to update order status: ' . $e->getMessage(), 500);
    }
}
```

### 9. Add Stock to Branch

**In admin/products.php:**

```php
// Add new endpoint for adding stock
if (isset($input['add_stock'])) {
    require_once __DIR__ . '/../../utils/stored_procedure_helper.php';
    
    $productId = (int)$input['product_id'];
    $branchId = (int)$input['branch_id'];
    $quantity = (int)$input['quantity'];
    
    try {
        $message = callStoredProcedureMessage($pdo, 'sp_add_stock_to_branch', [
            $productId,
            $branchId,
            $quantity,
            $userId
        ]);
        
        sendResponse(null, $message ?? 'Stock added successfully');
    } catch (PDOException $e) {
        sendError('Failed to add stock: ' . $e->getMessage(), 500);
    }
}
```

### 10. Adjust Inventory

**In admin/products.php:**

```php
// Add new endpoint for inventory adjustment
if (isset($input['adjust_inventory'])) {
    require_once __DIR__ . '/../../utils/stored_procedure_helper.php';
    
    $productId = (int)$input['product_id'];
    $branchId = (int)$input['branch_id'];
    $adjustment = (int)$input['adjustment']; // Can be negative
    $reason = $input['reason'] ?? 'Inventory adjustment';
    
    try {
        $message = callStoredProcedureMessage($pdo, 'sp_adjust_branch_inventory', [
            $productId,
            $branchId,
            $adjustment,
            $reason,
            $userId
        ]);
        
        sendResponse(null, $message ?? 'Inventory adjusted successfully');
    } catch (PDOException $e) {
        sendError('Failed to adjust inventory: ' . $e->getMessage(), 500);
    }
}
```

## Important Notes

### 1. Always Close Cursor
When calling stored procedures, always call `$stmt->closeCursor()` after fetching results. This is required for MySQL stored procedures.

### 2. Error Handling
Stored procedures can throw SQLSTATE errors. Always wrap calls in try-catch blocks.

### 3. Audit User ID
Procedures that modify data set `@audit_user_id` internally. Make sure to pass the correct user ID.

### 4. Transactions
Some procedures handle transactions internally. Check procedure documentation before wrapping in additional transactions.

### 5. Multiple Result Sets
Some procedures may return multiple result sets. Use `$stmt->nextRowset()` to access additional results.

## Testing Stored Procedures

### Test in MySQL Workbench:

```sql
-- Test top-selling products
CALL sp_get_top_selling_products('2024-01-01', '2024-12-31', 10);

-- Test monthly sales
CALL sp_get_monthly_sales(2024, 11);

-- Test cancel order
CALL sp_cancel_order(1, 1);

-- Test transfer stock
CALL sp_transfer_stock(1, 1, 2, 10, 1);
```

## Summary

- ✅ **8 procedures** already exist and can be integrated
- ✅ **8 new procedures** created in `06_create_missing_stored_procedures_mysql.sql`
- ✅ **Helper function** created in `stored_procedure_helper.php`
- ✅ **Integration examples** provided for all procedures

All stored procedures are ready to be integrated with your PHP code!



