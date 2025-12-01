
-- PC BUILDER BUILDS TABLE

-- This table stores PC builder build configurations
-- Each build represents a custom PC configuration with multiple components
-- Discounts are applied at the build level, not individual items

CREATE TABLE IF NOT EXISTS pc_builder_builds (
    build_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    build_name VARCHAR(255) DEFAULT 'Custom PC Build',
    discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'PHP',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    
    CHECK (discount_percent >= 0 AND discount_percent <= 100),
    CHECK (discount_amount >= 0),
    CHECK (subtotal >= 0),
    CHECK (total_amount >= 0)
);


-- ADD PC BUILDER BUILD ID TO CART TABLE

-- This links cart items to a PC builder build
-- NULL means the item is not part of a build

-- Check and add pc_builder_build_id column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'cart';
SET @columnname = 'pc_builder_build_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add branch_id column if it doesn't exist
SET @columnname = 'branch_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT NULL DEFAULT 1')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add foreign key constraint (drop first if exists to avoid errors)
SET @constraint_name = 'fk_cart_pc_builder_build';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (CONSTRAINT_NAME = @constraint_name)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT ', @constraint_name, 
         ' FOREIGN KEY (pc_builder_build_id) REFERENCES pc_builder_builds(build_id) ON DELETE CASCADE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add foreign key for branch_id
SET @constraint_name = 'fk_cart_branch';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (CONSTRAINT_NAME = @constraint_name)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT ', @constraint_name, 
         ' FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE SET NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Drop old unique constraint if it exists
SET @index_name = 'unique_user_product';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @index_name)
  ) > 0,
  CONCAT('ALTER TABLE ', @tablename, ' DROP INDEX ', @index_name),
  'SELECT 1'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Create new unique constraint: same product can be in cart once per user per branch per build
-- NULL build_id means standalone item
-- We'll use a generated column to handle NULL values for the unique constraint
SET @columnname = 'pc_builder_build_id_coalesced';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, 
         ' INT GENERATED ALWAYS AS (COALESCE(pc_builder_build_id, -1)) STORED')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Now create the unique index using the generated column
SET @index_name = 'unique_user_product_branch_build';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @index_name)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE UNIQUE INDEX ', @index_name, ' ON ', @tablename, 
         '(user_id, product_id, branch_id, pc_builder_build_id_coalesced)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;


-- PC BUILDER BUILD ITEMS TABLE

-- This table stores which products are in each build
-- This allows us to track the build configuration even after items are removed from cart

CREATE TABLE IF NOT EXISTS pc_builder_build_items (
    build_item_id INT PRIMARY KEY AUTO_INCREMENT,
    build_id INT NOT NULL,
    product_id INT NOT NULL,
    category_id INT NULL,
    category_name VARCHAR(100) NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (build_id) REFERENCES pc_builder_builds(build_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    
    CHECK (quantity > 0),
    CHECK (unit_price >= 0),
    CHECK (subtotal >= 0),
    UNIQUE KEY unique_build_product (build_id, product_id)
);


-- INDEXES FOR PERFORMANCE


-- Create indexes if they don't exist
SET @dbname = DATABASE();
SET @tablename = 'cart';
SET @index_name = 'idx_cart_pc_builder_build_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @index_name)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @index_name, ' ON ', @tablename, '(pc_builder_build_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @index_name = 'idx_cart_branch_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @index_name)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @index_name, ' ON ', @tablename, '(branch_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @tablename = 'pc_builder_builds';
SET @index_name = 'idx_pc_builder_builds_user_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @index_name)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @index_name, ' ON ', @tablename, '(user_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @tablename = 'pc_builder_build_items';
SET @index_name = 'idx_pc_builder_build_items_build_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @index_name)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @index_name, ' ON ', @tablename, '(build_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @index_name = 'idx_pc_builder_build_items_product_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (INDEX_NAME = @index_name)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @index_name, ' ON ', @tablename, '(product_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;


-- VERIFICATION


SELECT 'PC Builder builds tables created successfully!' AS Status;

