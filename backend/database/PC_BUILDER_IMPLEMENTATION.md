# PC Builder Build System Implementation

## Overview
The PC Builder now treats builds as **bundles** with discount already applied, rather than individual items. This ensures:
- Builds are treated as a single unit
- Discount is applied at build level
- Better tracking and management
- Proper connection to products, users, and checkout

## Database Changes

### New Tables

1. **`pc_builder_builds`** - Stores build configurations
   - `build_id` - Primary key
   - `user_id` - Owner of the build
   - `build_name` - Name of the build
   - `discount_percent` - Discount percentage (10% or 20%)
   - `discount_amount` - Discount amount in currency
   - `subtotal` - Subtotal before discount
   - `total_amount` - Final amount after discount
   - `currency` - Currency code
   - `created_at`, `updated_at` - Timestamps

2. **`pc_builder_build_items`** - Stores which products are in each build
   - `build_item_id` - Primary key
   - `build_id` - Foreign key to pc_builder_builds
   - `product_id` - Product in the build
   - `category_id`, `category_name` - Category info
   - `quantity` - Quantity (usually 1 per component)
   - `unit_price` - Price at time of build
   - `subtotal` - Line total

### Modified Tables

1. **`cart`** - Added fields:
   - `pc_builder_build_id` - Links cart items to a build (NULL = standalone item)
   - `branch_id` - Branch for the cart item

## API Endpoints

### POST `/api/cart/pc-builder-build`
Adds a complete PC builder build to cart as a bundle.

**Request Body:**
```json
{
  "items": [
    {
      "product_id": 1,
      "quantity": 1,
      "unit_price": 100.00,
      "category_id": 1,
      "category_name": "CPU"
    }
  ],
  "discount_percent": 10,
  "discount_amount": 50.00,
  "subtotal": 500.00,
  "total_amount": 450.00,
  "currency": "USD",
  "build_name": "Custom PC Build (5 components)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "build_id": 1,
    "message": "PC builder build added to cart successfully",
    "items_count": 5,
    "discount_percent": 10,
    "total_amount": 450.00
  }
}
```

## Frontend Changes

### PC Builder (`src/pages/PcBuilder.tsx`)
- Now calls `/api/cart/pc-builder-build` instead of adding items individually
- Sends complete build information including discount
- Build is added as a single bundle

### Cart Display (TODO)
- Need to update `get_cart.php` to group PC builder items
- Display builds as bundles in cart
- Show build name, components, and discount

### Checkout (TODO)
- Need to update checkout to handle PC builder builds
- Ensure build items are processed together
- Apply discount correctly

## Next Steps

1. ✅ Create database tables
2. ✅ Create API endpoint for adding builds
3. ✅ Update PC Builder frontend
4. ⏳ Update `get_cart.php` to group builds
5. ⏳ Update Cart page to display builds as bundles
6. ⏳ Update checkout to handle builds correctly

## Discount Rules

- **10% discount**: 5-8 components selected
- **20% discount**: All 9 components selected
- Discount is calculated and stored at build creation
- Discount is applied to the build total, not individual items

## Benefits

1. **Better Organization**: Builds are treated as single units
2. **Accurate Discounts**: Discount is applied at build level
3. **Better Tracking**: Can track which items belong to which build
4. **Easier Management**: Can remove entire builds at once
5. **Proper Connection**: Builds are properly linked to users, products, and orders



