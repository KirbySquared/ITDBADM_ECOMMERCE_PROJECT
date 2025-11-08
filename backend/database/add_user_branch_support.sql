-- Add branch_id column to users table
-- This allows users to select their nearest branch during registration and update it in their profile

USE electronics_store;

-- Check if branch_id column already exists before adding
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'branch_id'
);

-- Add branch_id column to users table (if it doesn't exist)
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN branch_id INT NULL',
    'SELECT "Column branch_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if foreign key already exists before adding
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'users' 
      AND CONSTRAINT_NAME = 'fk_user_branch'
);

-- Add foreign key constraint (if it doesn't exist)
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE users ADD CONSTRAINT fk_user_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key fk_user_branch already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check if index already exists before adding
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'electronics_store' 
      AND TABLE_NAME = 'users' 
      AND INDEX_NAME = 'idx_users_branch_id'
);

-- Add index for better query performance (if it doesn't exist)
SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_users_branch_id ON users(branch_id)',
    'SELECT "Index idx_users_branch_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'electronics_store' 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'branch_id';

