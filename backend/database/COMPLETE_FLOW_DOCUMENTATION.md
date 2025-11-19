# Complete Flow Documentation: Cart → Checkout → Order → Review

This document explains how the entire user journey is connected from adding items to cart through checkout, order creation, and reviews.

## Flow Overview

```
User (user_id) 
  ↓
Add to Cart (cart table: user_id, product_id, branch_id, quantity)
  ↓
Checkout (validates cart items match request)
  ↓
Create Order (orders table: user_id, order_id, branch_id)
  ↓
Create Order Items (order_items table: order_id, product_id, quantity)
  ↓
Create Payment (payments table: order_id, payment_status)
  ↓
Clear Cart (DELETE cart WHERE user_id AND branch_id)
  ↓
Inventory Reduced (product_inventory.stock_qty decreased)
  ↓
User Can Review (reviews table: user_id, product_id, rating, comment)
  ↓
Review Validated (checks order_items + orders + payments for completed purchases)
```

## Database Connections

### 1. Cart → Checkout → Order

**Cart Table:**
- `cart.user_id` → `users.user_id`
- `cart.product_id` → `products.product_id`
- `cart.branch_id` → `branches.branch_id`
- `cart.quantity` - Quantity in cart

**Checkout Validation:**
- Validates that all items in checkout request exist in user's cart
- Validates quantities match between cart and checkout request
- Ensures same `user_id` and `branch_id` throughout

**Order Creation:**
- `orders.user_id` = same `user_id` from cart
- `orders.branch_id` = same `branch_id` from cart
- `order_items.product_id` = same `product_id` from cart
- `order_items.quantity` = same `quantity` from cart

### 2. Order → Payment → Inventory

**Payment:**
- `payments.order_id` → `orders.order_id`
- `payments.payment_status` = 'completed' triggers inventory reduction

**Inventory:**
- `product_inventory.stock_qty` reduced when payment completed
- Uses same `product_id` and `branch_id` from order

### 3. Order → Review

**Review Validation:**
- Checks if `reviews.user_id` matches `orders.user_id`
- Checks if `reviews.product_id` exists in `order_items` for that user
- Validates `payments.payment_status` = 'completed'
- Ensures user actually purchased before allowing review

## API Endpoints Flow

### 1. Add to Cart
**POST `/api/cart`**
- Input: `product_id`, `quantity`
- Uses: `user_id` from JWT token
- Uses: `branch_id` from user's profile
- Creates: `cart` record with `user_id`, `product_id`, `branch_id`, `quantity`

### 2. Get Cart
**GET `/api/cart`**
- Returns: All cart items for authenticated user
- Filters by: `user_id` and `branch_id`
- Shows: Product details, prices, stock availability

### 3. Checkout
**POST `/api/checkout/create-order`**
- Validates: Cart items match checkout request
- Creates: `orders` record with `user_id`, `branch_id`
- Creates: `order_items` records for each cart item
- Creates: `payments` record
- Clears: Cart items for `user_id` and `branch_id`
- Reduces: Inventory when payment completed

### 4. View Orders
**GET `/api/orders`**
- Returns: All orders for authenticated user
- Shows: Order items with product details
- Shows: Review status for each product (has_reviewed, review_rating)

### 5. Create Review
**POST `/api/reviews`**
- Validates: User purchased product (checks `order_items` + `orders` + `payments`)
- Creates: `reviews` record with `user_id`, `product_id`
- Marks: `verified_purchase = 1` if purchase confirmed

## Code Implementation

### Cart Validation in Checkout

```php
// Step 0: Validate cart items match checkout request
$stmt = $pdo->prepare("
    SELECT cart_id, product_id, quantity 
    FROM cart 
    WHERE user_id = ? AND branch_id = ?
");
$stmt->execute([$userId, $branchId]);
$cartItems = $stmt->fetchAll();

// Validate all items in request exist in cart
// Validate quantities match
// Ensure all cart items are included
```

### Order Creation with Cart Connection

```php
// Step 3: Create order items from cart
foreach ($items as $item) {
    // Each order_item corresponds to a cart item
    // Maintains cart → order connection via same user_id, product_id, quantity
    $stmt = $pdo->prepare("
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([$orderId, $productId, $quantity, $unitPrice, $subtotal]);
}
```

### Review Validation

```php
// Verify user purchased product before allowing review
$stmt = $pdo->prepare("
    SELECT COUNT(*) as purchase_count
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.order_id
    INNER JOIN payments pay ON pay.order_id = o.order_id
    WHERE oi.product_id = ? 
    AND o.user_id = ? 
    AND pay.payment_status = 'completed'
");
```

## Data Integrity

### Same user_id Throughout:
- ✅ Cart: `cart.user_id`
- ✅ Order: `orders.user_id`
- ✅ Order Items: Via `orders.user_id`
- ✅ Payment: Via `orders.user_id`
- ✅ Review: `reviews.user_id`

### Same product_id Throughout:
- ✅ Cart: `cart.product_id`
- ✅ Order Items: `order_items.product_id`
- ✅ Review: `reviews.product_id`

### Same branch_id Throughout:
- ✅ Cart: `cart.branch_id`
- ✅ Order: `orders.branch_id`
- ✅ Inventory: `product_inventory.branch_id`

## Transaction Logging

All operations are logged in `transaction_log` table:
- Entity: 'order'
- Action: 'created'
- Meta: Includes `user_id`, `order_id`, `cart_items_processed`, `flow: 'cart → checkout → order'`

## Error Handling

- Cart validation fails if items don't match
- Stock validation fails if insufficient inventory
- Review validation fails if user hasn't purchased
- All operations use ACID transactions for data integrity

## Testing the Flow

1. **Add to Cart**: POST `/api/cart` with `product_id` and `quantity`
2. **View Cart**: GET `/api/cart` - verify items appear
3. **Checkout**: POST `/api/checkout/create-order` - verify cart items are validated
4. **View Order**: GET `/api/orders/{order_id}` - verify order created with same items
5. **Verify Cart Cleared**: GET `/api/cart` - should be empty
6. **Create Review**: POST `/api/reviews` - verify purchase validation works
7. **View Review**: GET `/api/reviews?product_id={id}` - verify review shows verified purchase

## Key Features

✅ **Cart Validation**: Checkout validates cart items match request
✅ **User Consistency**: Same `user_id` throughout entire flow
✅ **Product Consistency**: Same `product_id` from cart → order → review
✅ **Branch Consistency**: Same `branch_id` from cart → order → inventory
✅ **Purchase Verification**: Reviews only allowed for purchased products
✅ **Inventory Sync**: Stock reduces when orders completed
✅ **Complete Traceability**: All operations logged with user_id and flow information

