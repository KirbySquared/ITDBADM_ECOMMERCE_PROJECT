-- Fix all product-related triggers and add inventory audit triggers
-- This script fixes the products triggers and adds new triggers for product_inventory

-- ========================================
-- 1. FIX PRODUCTS CREATE TRIGGER (already correct, but ensure it uses @audit_user_id)
-- ========================================
DROP TRIGGER IF EXISTS trg_products_create_audit;

CREATE TRIGGER trg_products_create_audit
AFTER INSERT ON products
FOR EACH ROW
BEGIN
  INSERT INTO `audit_logs` (user_id, category, description)
  VALUES (
    @audit_user_id,
    'product',
    CONCAT('New product: ', COALESCE(NEW.product_name,'(no name)'), ' (ID=', NEW.product_id, ')')
  );
END;

-- ========================================
-- 2. FIX PRODUCTS DELETE TRIGGER (use @audit_user_id instead of hardcoded 1)
-- ========================================
DROP TRIGGER IF EXISTS trg_products_delete_audit;

CREATE TRIGGER trg_products_delete_audit
AFTER DELETE ON products
FOR EACH ROW
BEGIN
  INSERT INTO `audit_logs` (user_id, category, description)
  VALUES (
    @audit_user_id,
    'product',
    CONCAT('Product deleted: ', COALESCE(OLD.product_name,'(no name)'), ' (ID=', OLD.product_id, ')')
  );
END;

-- ========================================
-- 3. CREATE PRODUCT_INVENTORY INSERT TRIGGER
-- ========================================
DROP TRIGGER IF EXISTS trg_product_inventory_insert_audit;

CREATE TRIGGER trg_product_inventory_insert_audit
AFTER INSERT ON product_inventory
FOR EACH ROW
BEGIN
  DECLARE product_name_val VARCHAR(200);
  
  -- Get product name
  SELECT product_name INTO product_name_val
  FROM products
  WHERE product_id = NEW.product_id;
  
  INSERT INTO `audit_logs` (user_id, category, description)
  VALUES (
    @audit_user_id,
    'product',
    CONCAT('Inventory added: Product "', COALESCE(product_name_val, '(unknown)'), 
           '" (ID=', NEW.product_id, ') - Branch ID: ', NEW.branch_id, 
           ', Stock Qty: ', NEW.stock_qty)
  );
END;

-- ========================================
-- 4. CREATE PRODUCT_INVENTORY UPDATE TRIGGER
-- ========================================
DROP TRIGGER IF EXISTS trg_product_inventory_update_audit;

CREATE TRIGGER trg_product_inventory_update_audit
AFTER UPDATE ON product_inventory
FOR EACH ROW
BEGIN
  DECLARE product_name_val VARCHAR(200);
  DECLARE change_desc TEXT DEFAULT '';
  
  -- Get product name
  SELECT product_name INTO product_name_val
  FROM products
  WHERE product_id = NEW.product_id;
  
  -- Check what changed
  IF OLD.stock_qty != NEW.stock_qty THEN
    SET change_desc = CONCAT('Stock: ', OLD.stock_qty, ' -> ', NEW.stock_qty);
  END IF;
  
  IF OLD.branch_id != NEW.branch_id THEN
    IF change_desc <> '' THEN
      SET change_desc = CONCAT(change_desc, ', ');
    END IF;
    SET change_desc = CONCAT(change_desc, 'Branch: ', OLD.branch_id, ' -> ', NEW.branch_id);
  END IF;
  
  IF OLD.safety_stock != NEW.safety_stock THEN
    IF change_desc <> '' THEN
      SET change_desc = CONCAT(change_desc, ', ');
    END IF;
    SET change_desc = CONCAT(change_desc, 'Safety Stock: ', OLD.safety_stock, ' -> ', NEW.safety_stock);
  END IF;
  
  -- Only log if something actually changed
  IF change_desc <> '' THEN
    INSERT INTO `audit_logs` (user_id, category, description)
    VALUES (
      @audit_user_id,
      'product',
      CONCAT('Inventory updated: Product "', COALESCE(product_name_val, '(unknown)'), 
             '" (ID=', NEW.product_id, ') - ', change_desc)
    );
  END IF;
END;

-- ========================================
-- 5. CREATE PRODUCT_INVENTORY DELETE TRIGGER
-- ========================================
DROP TRIGGER IF EXISTS trg_product_inventory_delete_audit;

CREATE TRIGGER trg_product_inventory_delete_audit
AFTER DELETE ON product_inventory
FOR EACH ROW
BEGIN
  DECLARE product_name_val VARCHAR(200);
  
  -- Get product name
  SELECT product_name INTO product_name_val
  FROM products
  WHERE product_id = OLD.product_id;
  
  INSERT INTO `audit_logs` (user_id, category, description)
  VALUES (
    @audit_user_id,
    'product',
    CONCAT('Inventory removed: Product "', COALESCE(product_name_val, '(unknown)'), 
           '" (ID=', OLD.product_id, ') - Branch ID: ', OLD.branch_id, 
           ', Stock Qty: ', OLD.stock_qty)
  );
END;

-- ========================================
-- VERIFY TRIGGERS
-- ========================================
SHOW TRIGGERS WHERE `Table` IN ('products', 'product_inventory');
