-- Add admin role to users table and create admin user
-- Run this script on your remote MySQL server

USE electronics_store;

-- Add role column to users table (if it doesn't exist)
ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user';

-- Create admin user only if it doesn't exist
INSERT IGNORE INTO users (
    username, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role
) VALUES (
    'admin',
    'admin@electronicsstore.com',
    '$2y$10$pWihihOinmqi.kNs1c0uWexnc6KzfaMNsoXdLyPD9lV0fydILPBAG', -- password: Dlsu1234!
    'Admin',
    'User',
    'admin'
);

-- Verify admin user was created
SELECT user_id, username, email, first_name, last_name, role, created_at 
FROM users 
WHERE role = 'admin';

-- Show all users
SELECT * FROM users;
