-- Add genres table and genre_id column to products table
-- This migration adds support for game genres

-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
    genre_id INT PRIMARY KEY AUTO_INCREMENT,
    genre_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert some default genres
INSERT INTO genres (genre_name, description) VALUES
('Action', 'Fast-paced games with combat and adventure'),
('RPG', 'Role-playing games with character development'),
('Sports', 'Sports simulation and competitive games'),
('Adventure', 'Exploration and story-driven games'),
('Shooter', 'First-person and third-person shooter games'),
('Strategy', 'Tactical and strategic gameplay'),
('Racing', 'Racing and driving games'),
('Puzzle', 'Puzzle-solving games'),
('Simulation', 'Life and city simulation games'),
('Fighting', 'Combat and fighting games')
ON DUPLICATE KEY UPDATE genre_name = genre_name;

