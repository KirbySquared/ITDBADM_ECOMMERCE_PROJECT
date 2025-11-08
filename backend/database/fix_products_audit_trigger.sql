-- Fix the products update audit trigger to remove stock_quantity and currency references
-- These columns no longer exist in the products table

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trg_products_update_audit;

-- Recreate the trigger without stock_quantity and currency references
CREATE TRIGGER trg_products_update_audit
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  DECLARE changed_fields TEXT DEFAULT '';

  /* Build a comma-separated list of changed fields */
  IF NOT (OLD.category_id    <=> NEW.category_id)    THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'category_id');    END IF;
  IF NOT (OLD.product_name   <=> NEW.product_name)   THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'product_name');   END IF;
  IF NOT (OLD.brand          <=> NEW.brand)          THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'brand');          END IF;
  IF NOT (OLD.model          <=> NEW.model)          THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'model');          END IF;
  IF NOT (OLD.description    <=> NEW.description)    THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'description');    END IF;
  IF NOT (OLD.price          <=> NEW.price)          THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'price');          END IF;
  IF NOT (OLD.specifications <=> NEW.specifications) THEN SET changed_fields = CONCAT_WS(', ', changed_fields, 'specifications'); END IF;

  /* Only log when at least one of the above actually changed.
     (Ignore updated_at since apps often update it automatically.) */
  IF changed_fields <> '' THEN
    INSERT INTO `audit_logs` (user_id, category, description)
    VALUES (
      @audit_user_id, 
      'product',
      CONCAT('Product updated: ', COALESCE(NEW.product_name,'(no name)'),
             ' (ID=', NEW.product_id, '); fields: ', changed_fields)
    );
  END IF;
END;

-- Verify the trigger was created correctly
SHOW CREATE TRIGGER trg_products_update_audit;
