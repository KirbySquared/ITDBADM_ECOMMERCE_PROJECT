<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';

try {
    $stmt = $pdo->prepare("SELECT * FROM genres ORDER BY genre_name");
    $stmt->execute();
    $genres = $stmt->fetchAll();
    
    sendResponse($genres, 'Genres retrieved successfully');
    
} catch (PDOException $e) {
    sendError('Failed to retrieve genres', 500);
}
?>

