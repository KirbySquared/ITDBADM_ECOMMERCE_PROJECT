<?php
/**
 * CHECKOUT / CREATE ORDER ENDPOINT
 * 
 * Creates an order with ACID transaction support, stock validation, and payment processing.
 * 
 * POST /api/checkout/create-order
 * 
 * Business Rules:
 * - Stock is only reduced when payment is confirmed (payment_status = 'completed')
 * - Stock deduction happens via database trigger
 * - Transaction is rejected if stock would go negative
 * - Uses ACID transactions for data integrity
 * - Logs all actions to transaction_log table
 * 
 * Request Body:
 * {
 *   "lock_id": "string",
 *   "currency": "USD",
 *   "customer": { "first_name": "...", "last_name": "...", "email": "..." },
 *   "fulfillment": { "type": "pickup|delivery", "branch_id": 1, "address": {...} },
 *   "payment": { "method": "credit_card|debit_card|cod|..." },
 *   "items": [{ "product_id": 1, "quantity": 2, "unit_price": 100.00, "currency": "USD" }],
 *   "notes": "optional notes"
 * }
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../utils/currency_api.php';

header('Content-Type: application/json');

// Get authorization header
$headers = getallheaders();
$token = null;

if (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
}
if (!$token) {
    sendError('Authorization token required', 401);
}

// Validate token
$userId = validateToken($token);
if (!$userId) {
    sendError('Invalid or expired token', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($input['currency']) || !isset($input['items']) || !is_array($input['items']) || empty($input['items'])) {
        sendError('Currency and items are required', 400);
    }
    
    if (!isset($input['fulfillment']['branch_id']) || !is_numeric($input['fulfillment']['branch_id'])) {
        sendError('Branch ID is required', 400);
    }
    
    if (!isset($input['customer']['first_name']) || !isset($input['customer']['last_name']) || !isset($input['customer']['email'])) {
        sendError('Customer information is required', 400);
    }
    
    if (!isset($input['payment']['method'])) {
        sendError('Payment method is required', 400);
    }
    
    $currency = strtoupper(trim($input['currency']));
    $branchId = (int)$input['fulfillment']['branch_id'];
    $items = $input['items'];
    $paymentMethod = $input['payment']['method'];
    $fulfillmentType = $input['fulfillment']['type'] ?? 'pickup';
    
    // Validate currency code
    if (!isValidCurrencyCode($currency)) {
        sendError('Invalid currency code', 400);
    }
    
    // Get exchange rate from API (automatic, always up-to-date)
    // rateToPhp is the rate FROM PHP TO currency (e.g., 0.018 for USD means 1 PHP = 0.018 USD)
    $rateToPhp = getExchangeRateFromAPI($currency);
    if ($rateToPhp === null) {
        sendError('Failed to fetch exchange rate for ' . $currency, 500);
    }
    
    // Validate branch exists
    $stmt = $pdo->prepare("SELECT branch_id, branch_name FROM branches WHERE branch_id = ?");
    $stmt->execute([$branchId]);
    $branch = $stmt->fetch();
    
    if (!$branch) {
        sendError('Invalid branch', 400);
    }
    
    // Build shipping address
    $shippingAddress = '';
    if ($fulfillmentType === 'delivery' && isset($input['fulfillment']['address'])) {
        $addr = $input['fulfillment']['address'];
        $shippingAddress = trim(
            ($addr['line1'] ?? '') . ', ' .
            ($addr['city'] ?? '') . ', ' .
            ($addr['zip'] ?? '')
        );
    } else {
        $shippingAddress = $branch['branch_name'] . ' - Store Pickup';
    }
    
    if (empty($shippingAddress)) {
        $shippingAddress = 'Store Pickup';
    }
    
    // Calculate total amount
    $totalAmount = 0.0;
    foreach ($items as $item) {
        if (!isset($item['product_id']) || !isset($item['quantity']) || !isset($item['unit_price'])) {
            sendError('Invalid item data', 400);
        }
        $totalAmount += (float)$item['unit_price'] * (int)$item['quantity'];
    }
    
    // Start ACID transaction with explicit MySQL statements
    // This ensures proper ACID compliance:
    // - ATOMICITY: All operations succeed or all fail (via COMMIT/ROLLBACK)
    // - CONSISTENCY: Database constraints and business rules are maintained
    // - ISOLATION: Changes are isolated until COMMIT (default: REPEATABLE READ)
    // - DURABILITY: Once COMMIT, changes are permanent even if system crashes
    $pdo->exec("START TRANSACTION");
    
    try {
        // 0. Validate that items in request match items in user's cart (same user_id, branch_id, products)
        // This ensures cart → checkout → order flow is connected
        $cartValidationErrors = [];
        $cartItems = [];
        
        // Get all items from user's cart for this branch
        $stmt = $pdo->prepare("
            SELECT cart_id, product_id, quantity 
            FROM cart 
            WHERE user_id = ? AND branch_id = ?
        ");
        $stmt->execute([$userId, $branchId]);
        $cartItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($cartItems)) {
            $pdo->exec("ROLLBACK");
            sendError('Cart is empty. Please add items to cart before checkout.', 400);
        }
        
        // Create a map of cart items for quick lookup
        $cartMap = [];
        foreach ($cartItems as $cartItem) {
            $key = (int)$cartItem['product_id'];
            $cartMap[$key] = [
                'cart_id' => (int)$cartItem['cart_id'],
                'quantity' => (int)$cartItem['quantity']
            ];
        }
        
        // Validate that all items in request exist in cart with matching quantities
        $requestItemMap = [];
        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $quantity = (int)$item['quantity'];
            
            if (!isset($cartMap[$productId])) {
                $cartValidationErrors[] = "Product ID $productId is not in your cart";
                continue;
            }
            
            if ($cartMap[$productId]['quantity'] !== $quantity) {
                $cartValidationErrors[] = "Quantity mismatch for product ID $productId. Cart: {$cartMap[$productId]['quantity']}, Request: $quantity";
                continue;
            }
            
            $requestItemMap[$productId] = [
                'cart_id' => $cartMap[$productId]['cart_id'],
                'quantity' => $quantity,
                'item_data' => $item
            ];
        }
        
        // Check if all cart items are included in the request
        if (count($requestItemMap) !== count($cartMap)) {
            $missingProducts = array_diff(array_keys($cartMap), array_keys($requestItemMap));
            foreach ($missingProducts as $missingId) {
                $cartValidationErrors[] = "Product ID $missingId is in your cart but not included in checkout";
            }
        }
        
        if (!empty($cartValidationErrors)) {
            $pdo->exec("ROLLBACK");
            sendError('Cart validation failed: ' . implode('; ', $cartValidationErrors), 400);
        }
        
        // 1. Validate stock availability BEFORE creating order
        $stockErrors = [];
        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $quantity = (int)$item['quantity'];
            
            // Check stock in the selected branch
            $stmt = $pdo->prepare("
                SELECT COALESCE(pi.stock_qty, 0) as stock_qty, p.product_name
                FROM products p
                LEFT JOIN product_inventory pi ON p.product_id = pi.product_id AND pi.branch_id = ?
                WHERE p.product_id = ?
            ");
            $stmt->execute([$branchId, $productId]);
            $product = $stmt->fetch();
            
            if (!$product) {
                $stockErrors[] = "Product ID $productId not found";
                continue;
            }
            
            $availableStock = (int)$product['stock_qty'];
            if ($availableStock < $quantity) {
                $stockErrors[] = "Insufficient stock for {$product['product_name']}. Available: $availableStock, Requested: $quantity";
            }
        }
        
        if (!empty($stockErrors)) {
            $pdo->exec("ROLLBACK");
            sendError('Stock validation failed: ' . implode('; ', $stockErrors), 400);
        }
        
        // 2. Create order (include branch_id)
        $stmt = $pdo->prepare("
            INSERT INTO orders (user_id, total_amount, currency, status, shipping_address, branch_id)
            VALUES (?, ?, ?, 'pending', ?, ?)
        ");
        $stmt->execute([$userId, $totalAmount, $currency, $shippingAddress, $branchId]);
        $orderId = $pdo->lastInsertId();
        
        // 3. Create order items (connected to cart via cart_id tracking)
        // Each order_item corresponds to a cart item, maintaining the cart → order connection
        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $quantity = (int)$item['quantity'];
            $unitPrice = (float)$item['unit_price'];
            $subtotal = $unitPrice * $quantity;
            $cartId = isset($requestItemMap[$productId]) ? $requestItemMap[$productId]['cart_id'] : null;
            
            $stmt = $pdo->prepare("
                INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$orderId, $productId, $quantity, $unitPrice, $subtotal]);
            
            // Log the cart → order connection for traceability
            error_log("Order Item Created: order_id=$orderId, product_id=$productId, quantity=$quantity, cart_id=" . ($cartId ?? 'N/A') . ", user_id=$userId");
        }
        
        // 4. Create payment record (status: pending initially, will be completed after payment simulation)
        $paymentStatus = ($paymentMethod === 'cod') ? 'pending' : 'pending'; // All start as pending
        $stmt = $pdo->prepare("
            INSERT INTO payments (order_id, payment_method, payment_status, amount, currency, transaction_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $transactionId = 'TXN-' . strtoupper(bin2hex(random_bytes(8)));
        $stmt->execute([$orderId, $paymentMethod, $paymentStatus, $totalAmount, $currency, $transactionId]);
        
        // 5. Create order currency snapshot (snapshot the rate at time of order)
        // This preserves the rate used for the order even if rates change later
        $stmt = $pdo->prepare("
            INSERT IGNORE INTO order_currency_snapshots (order_id, currency_code, rate_to_php)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$orderId, $currency, $rateToPhp]);
        
        // If the record already exists, update it instead
        if ($stmt->rowCount() === 0) {
            $stmt = $pdo->prepare("
                UPDATE order_currency_snapshots 
                SET currency_code = ?, rate_to_php = ?
                WHERE order_id = ?
            ");
            $stmt->execute([$currency, $rateToPhp, $orderId]);
        }
        
        // 6. Simulate payment (for now, auto-complete non-COD payments)
        // In production, this would integrate with payment gateway
        if ($paymentMethod !== 'cod') {
            // Simulate successful payment
            $stmt = $pdo->prepare("
                UPDATE payments 
                SET payment_status = 'completed', payment_date = NOW()
                WHERE order_id = ?
            ");
            $stmt->execute([$orderId]);
            
            // Update order status
            $stmt = $pdo->prepare("
                UPDATE orders 
                SET status = 'processing'
                WHERE order_id = ?
            ");
            $stmt->execute([$orderId]);
            
            // 7. Deduct stock (this will be handled by trigger, but we validate first)
            // The trigger will automatically deduct stock when payment_status = 'completed'
            // We've already validated stock availability above
            foreach ($items as $item) {
                $productId = (int)$item['product_id'];
                $quantity = (int)$item['quantity'];
                
                // Update stock in product_inventory
                // Use a safe update that prevents negative stock
                $stmt = $pdo->prepare("
                    UPDATE product_inventory 
                    SET stock_qty = GREATEST(0, stock_qty - ?)
                    WHERE product_id = ? AND branch_id = ? AND stock_qty >= ?
                ");
                $stmt->execute([$quantity, $productId, $branchId, $quantity]);
                
                // Verify the update actually happened (if affected_rows = 0, stock was insufficient)
                if ($stmt->rowCount() === 0) {
                    throw new Exception("Stock deduction failed for product ID $productId - insufficient stock");
                }
            }
        }
        
        // 8. Log transaction (includes cart connection info)
        $logMeta = json_encode([
            'order_id' => $orderId,
            'currency' => $currency,
            'rate_to_php' => $rateToPhp,
            'total_amount' => $totalAmount,
            'payment_method' => $paymentMethod,
            'branch_id' => $branchId,
            'items_count' => count($items),
            'cart_items_processed' => count($cartItems),
            'user_id' => $userId,
            'flow' => 'cart → checkout → order'
        ]);
        
        $stmt = $pdo->prepare("
            INSERT INTO transaction_log (entity, entity_id, action, meta, performed_by, created_at)
            VALUES ('order', ?, 'created', ?, ?, NOW())
        ");
        $stmt->execute([$orderId, $logMeta, $userId]);
        
        // Log the complete flow: Cart → Order → (Future: Review)
        error_log("=== COMPLETE FLOW: Cart → Order ===");
        error_log("User ID: $userId");
        error_log("Order ID: $orderId");
        error_log("Cart Items Processed: " . count($cartItems));
        error_log("Order Items Created: " . count($items));
        error_log("Branch ID: $branchId");
        error_log("Total Amount: $totalAmount $currency");
        
        // 9. Clear user's cart after successful order
        $stmt = $pdo->prepare("DELETE FROM cart WHERE user_id = ? AND branch_id = ?");
        $stmt->execute([$userId, $branchId]);
        
        // Commit transaction - all changes are now permanent
        $pdo->exec("COMMIT");
        
        // Return order details
        $stmt = $pdo->prepare("
            SELECT o.*, u.first_name, u.last_name, u.email
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.user_id
            WHERE o.order_id = ?
        ");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        
        // Get order items
        $stmt = $pdo->prepare("
            SELECT oi.*, p.product_name, p.brand
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.product_id
            WHERE oi.order_id = ?
        ");
        $stmt->execute([$orderId]);
        $order['items'] = $stmt->fetchAll();
        
        // Get payment details
        $stmt = $pdo->prepare("SELECT * FROM payments WHERE order_id = ?");
        $stmt->execute([$orderId]);
        $order['payment'] = $stmt->fetch();
        
        sendResponse($order, 'Order created successfully');
        
    } catch (Exception $e) {
        // Rollback on any error - all changes are discarded
        $pdo->exec("ROLLBACK");
        error_log('Order creation error: ' . $e->getMessage());
        throw $e;
    }
    
} catch (PDOException $e) {
    error_log('Database error in checkout: ' . $e->getMessage());
    sendError('Failed to create order: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log('Checkout error: ' . $e->getMessage());
    sendError('Failed to create order: ' . $e->getMessage(), 500);
}
?>

