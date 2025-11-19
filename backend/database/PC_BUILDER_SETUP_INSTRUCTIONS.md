# PC Builder Build System - Setup Instructions

## Step 1: Run Database Migration

Run the SQL script to create the necessary tables:

```sql
-- Run this file in MySQL Workbench or your MySQL client
SOURCE backend/database/08_add_pc_builder_builds.sql;
```

Or manually run the contents of `backend/database/08_add_pc_builder_builds.sql`

## Step 2: Verify Tables Created

Check that the following tables exist:
- `pc_builder_builds`
- `pc_builder_build_items`
- `cart` table should have new columns: `pc_builder_build_id` and `branch_id`

## Step 3: Test the Implementation

1. Go to PC Builder page
2. Select 5+ components (or all 9 for 20% discount)
3. Click "Add Build to Cart"
4. Check that build is added successfully
5. Go to Cart page - builds should appear as bundles

## Current Status

✅ **Completed:**
- Database schema created
- API endpoint `/api/cart/pc-builder-build` created
- PC Builder frontend updated to use new endpoint
- Route added to API router

⏳ **Remaining:**
- Update `get_cart.php` to group PC builder items as bundles
- Update Cart page UI to display builds as bundles
- Update checkout to handle PC builder builds correctly

## Notes

- PC Builder builds are now treated as single bundles
- Discount is applied at build level (10% for 5+, 20% for all 9)
- Each build has a unique `build_id` that links all its items
- Builds are properly connected to users, products, and will be connected to orders

## Troubleshooting

If you encounter issues:

1. **Database errors**: Make sure you ran the migration script
2. **API errors**: Check that the route is correctly added in `backend/api/index.php`
3. **Cart display**: The cart page may need updates to show builds as bundles (this is pending)



