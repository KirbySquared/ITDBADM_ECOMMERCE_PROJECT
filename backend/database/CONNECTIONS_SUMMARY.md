# Database Connections Summary

This document explains how sold items, orders, customers, and reviews are connected in the system.

## Database Relationships

### Core Connections

1. **Orders → Customers (Users)**
   - `orders.user_id` → `users.user_id`
   - Every order belongs to a customer

2. **Orders → Order Items**
   - `orders.order_id` → `order_items.order_id`
   - Each order contains multiple order items (products)

3. **Order Items → Products**
   - `order_items.product_id` → `products.product_id`
   - Each order item represents a product purchase

4. **Orders → Payments**
   - `orders.order_id` → `payments.order_id`
   - Each order has a payment record
   - Only orders with `payment_status = 'completed'` count as sold

5. **Reviews → Customers (Users)**
   - `reviews.user_id` → `users.user_id`
   - Each review is written by a customer

6. **Reviews → Products**
   - `reviews.product_id` → `products.product_id`
   - Each review is for a specific product

## API Implementation

### 1. Products API (`/api/products`)

**Sold Count Calculation:**
- Calculates total sold items by joining:
  - `order_items` (quantity sold)
  - `orders` (order information)
  - `payments` (only count completed payments)
- Query: `SUM(order_items.quantity) WHERE payment_status = 'completed'`

**Endpoints:**
- `GET /api/products?id={id}` - Single product with sold count
- `GET /api/products` - Product list with sold count

### 2. Reviews API (`/api/reviews`)

**GET `/api/reviews?product_id={id}`**
- Returns all reviews for a product
- Includes customer information (username, email, first_name, last_name)
- **Verified Purchase Check**: Verifies if reviewer actually purchased the product
  - Joins: `reviews` → `order_items` → `orders` → `payments`
  - Only counts completed payments
- Returns:
  - `verified_purchase`: 1 if customer purchased, 0 otherwise
  - `purchase_quantity`: Total quantity purchased by reviewer
  - `first_purchase_date`: When reviewer first purchased the product

**POST `/api/reviews`**
- Creates a new review
- **Validation**: Ensures user has purchased the product before allowing review
- Checks: `order_items` → `orders` → `payments` (completed only)
- Prevents duplicate reviews (one review per user per product)

### 3. Checkout API (`/api/checkout/create-order`)

**Inventory Reduction:**
- When payment status becomes 'completed', inventory is reduced
- Updates `product_inventory.stock_qty` for the specific branch
- This ensures sold count and inventory stay in sync

## Frontend Display

### Product Detail Page

**Sales Information:**
- **Sold**: Total units sold (from completed orders)
- **In Stock**: Current available inventory

**Reviews Section:**
- Average rating with star visualization
- Rating distribution (5 progress bars for 5-1 stars)
- Individual reviews showing:
  - Customer name
  - **Verified Purchase badge** (if customer purchased)
  - Purchase quantity
  - Purchase date
  - Review date
  - Rating and comment

## Data Flow

### When a Customer Purchases:

1. Order created → `orders` table
2. Order items added → `order_items` table
3. Payment created → `payments` table
4. When payment completed:
   - Inventory reduced → `product_inventory.stock_qty` decreased
   - Sold count increases (calculated from `order_items`)

### When a Customer Reviews:

1. System checks if customer purchased product:
   - Query: `order_items` + `orders` + `payments` (completed)
2. If purchased:
   - Review created → `reviews` table
   - Review marked as `verified_purchase = 1`
3. Review displayed with purchase information

## SQL Queries Reference

See `queries_sold_orders_customers_reviews.sql` for comprehensive SQL queries showing:
- Sold items with order and customer info
- Product sales summaries
- Customers who bought and reviewed
- Products with sales, reviews, and stats
- Customer purchase and review behavior
- Sales vs reviews correlation

## Key Features

✅ **Verified Purchases**: Reviews show if customer actually bought the product
✅ **Purchase Validation**: Users can only review products they've purchased
✅ **Accurate Sold Count**: Only counts completed payments
✅ **Inventory Sync**: Inventory reduces when orders are completed
✅ **Customer Insights**: Shows purchase quantity and dates in reviews
✅ **Data Integrity**: All connections use proper foreign keys and constraints

