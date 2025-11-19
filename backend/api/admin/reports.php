<?php
/**
 * ADMIN REPORTS API ENDPOINT
 * 
 * Provides reporting endpoints using stored procedures
 * 
 * GET /api/admin/reports/top-selling-products?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&limit=10
 * GET /api/admin/reports/monthly-sales?year=2024&month=11
 * GET /api/admin/reports/monthly-sales-by-branch?year=2024&month=11
 * GET /api/admin/reports/revenue-by-currency?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/stored_procedure_helper.php';
require_once '../../utils/admin_auth.php';

// Require admin authentication
$adminId = requireAdminAuth();

header('Content-Type: application/json');

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method !== 'GET') {
        sendError('Method not allowed', 405);
    }
    
    // Parse the path to determine which report to generate
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $path = str_replace('/api/admin/reports', '', $path);
    $path = ltrim($path, '/');
    
    switch ($path) {
        case 'top-selling-products':
            // GET /api/admin/reports/top-selling-products?start_date=2024-01-01&end_date=2024-12-31&limit=10
            $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
            $endDate = $_GET['end_date'] ?? date('Y-m-d');
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            
            // Validate dates
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
                sendError('Invalid date format. Use YYYY-MM-DD', 400);
            }
            
            if ($limit < 1 || $limit > 100) {
                $limit = 10;
            }
            
            $results = callStoredProcedure($pdo, 'sp_get_top_selling_products', [
                $startDate,
                $endDate,
                $limit
            ]);
            
            sendResponse($results, 'Top selling products retrieved successfully');
            break;
            
        case 'monthly-sales':
            // GET /api/admin/reports/monthly-sales?year=2024&month=11
            $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
            $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
            
            if ($year < 2000 || $year > 2100) {
                sendError('Invalid year', 400);
            }
            if ($month < 1 || $month > 12) {
                sendError('Invalid month (1-12)', 400);
            }
            
            $results = callStoredProcedure($pdo, 'sp_get_monthly_sales', [
                $year,
                $month
            ]);
            
            sendResponse($results, 'Monthly sales retrieved successfully');
            break;
            
        case 'monthly-sales-by-branch':
            // GET /api/admin/reports/monthly-sales-by-branch?year=2024&month=11
            $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
            $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
            
            if ($year < 2000 || $year > 2100) {
                sendError('Invalid year', 400);
            }
            if ($month < 1 || $month > 12) {
                sendError('Invalid month (1-12)', 400);
            }
            
            $results = callStoredProcedure($pdo, 'sp_get_monthly_sales_by_branch', [
                $year,
                $month
            ]);
            
            sendResponse($results, 'Monthly sales by branch retrieved successfully');
            break;
            
        case 'revenue-by-currency':
            // GET /api/admin/reports/revenue-by-currency?start_date=2024-01-01&end_date=2024-12-31
            $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-30 days'));
            $endDate = $_GET['end_date'] ?? date('Y-m-d');
            
            // Validate dates
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
                sendError('Invalid date format. Use YYYY-MM-DD', 400);
            }
            
            $results = callStoredProcedure($pdo, 'sp_get_revenue_by_currency', [
                $startDate,
                $endDate
            ]);
            
            sendResponse($results, 'Revenue by currency retrieved successfully');
            break;
            
        default:
            sendError('Report not found. Available reports: top-selling-products, monthly-sales, monthly-sales-by-branch, revenue-by-currency', 404);
            break;
    }
    
} catch (PDOException $e) {
    error_log('Reports API error: ' . $e->getMessage());
    sendError('Failed to generate report: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log('Reports API error: ' . $e->getMessage());
    sendError('Failed to generate report: ' . $e->getMessage(), 500);
}
?>

