-- Fix the registration audit trigger to use CONCAT instead of + for string concatenation
-- MySQL uses + for numeric addition, not string concatenation

USE electronics_store;

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trg_users_registration_audit;

-- Recreate the trigger with CONCAT for proper string concatenation
DELIMITER $$

CREATE TRIGGER trg_users_registration_audit
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO `audit_logs` (user_id, category, description)
  VALUES (NEW.user_id, 'user', CONCAT('New User: ', NEW.username));
END$$

DELIMITER ;

-- Verify the trigger was created correctly
SHOW CREATE TRIGGER trg_users_registration_audit;

