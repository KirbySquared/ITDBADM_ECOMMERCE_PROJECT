-- Update stored procedure to properly filter by branch_id
-- When branch_id is provided (logged-in user): Start from product_inventory filtered by branch_id
-- When branch_id is NULL (non-logged-in user): Start from products and show all products

DROP PROCEDURE IF EXISTS `sp_search_products_advanced`;

DELIMITER $$

CREATE DEFINER=`student1`@`localhost` PROCEDURE `sp_search_products_advanced`(
    IN p_currency    VARCHAR(3),
    IN p_branch_id   INT,
    IN p_q           VARCHAR(255),
    IN p_genre_id    INT,
    IN p_year        INT,
    IN p_month       INT,
    IN p_price_min   DECIMAL(10,2),
    IN p_price_max   DECIMAL(10,2),
    IN p_in_stock    TINYINT,
    IN p_sort        VARCHAR(20),
    IN p_limit       INT,
    IN p_offset      INT
)
BEGIN
    DECLARE v_rate DECIMAL(18,8);
    DECLARE v_currency VARCHAR(3);

    -- Normalize currency and get rate
    SET v_currency = IFNULL(p_currency, 'PHP');

    SELECT rate_to_php INTO v_rate
    FROM currencies
    WHERE code = v_currency AND is_active = 1
    LIMIT 1;

    IF v_rate IS NULL THEN
        SET v_currency = 'PHP';
        SET v_rate = 1;
    END IF;

    -- 1) TOTAL COUNT (for pagination)
    IF p_branch_id IS NOT NULL THEN
        -- User is logged in - Start from product_inventory filtered by branch_id
        SELECT COUNT(DISTINCT p.product_id) AS total
        FROM product_inventory pi
        INNER JOIN products p ON pi.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE pi.branch_id = p_branch_id
          -- keyword search
          AND (
            p_q IS NULL OR p_q = '' OR
            p.product_name LIKE CONCAT('%', p_q, '%') OR
            p.brand        LIKE CONCAT('%', p_q, '%') OR
            p.model        LIKE CONCAT('%', p_q, '%') OR
            p.description  LIKE CONCAT('%', p_q, '%')
          )
          -- category filter (genre_id is actually category_id)
          AND (p_genre_id IS NULL OR p.category_id = p_genre_id)
          -- release date: year / month (if release_date column exists)
          AND (p_year  IS NULL OR (p.release_date IS NULL OR YEAR(p.release_date) = p_year))
          AND (p_month IS NULL OR (p.release_date IS NULL OR MONTH(p.release_date) = p_month))
          -- price range (in PHP base)
          AND (p_price_min IS NULL OR p.price >= p_price_min)
          AND (p_price_max IS NULL OR p.price <= p_price_max)
          -- in-stock filter
          AND (
            p_in_stock IS NULL OR p_in_stock = 0 OR
            pi.stock_qty > 0
          );
    ELSE
        -- User not logged in - Start from products and show all products
        SELECT COUNT(DISTINCT p.product_id) AS total
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE
          -- keyword search
          (
            p_q IS NULL OR p_q = '' OR
            p.product_name LIKE CONCAT('%', p_q, '%') OR
            p.brand        LIKE CONCAT('%', p_q, '%') OR
            p.model        LIKE CONCAT('%', p_q, '%') OR
            p.description  LIKE CONCAT('%', p_q, '%')
          )
          -- category filter (genre_id is actually category_id)
          AND (p_genre_id IS NULL OR p.category_id = p_genre_id)
          -- release date: year / month (if release_date column exists)
          AND (p_year  IS NULL OR (p.release_date IS NULL OR YEAR(p.release_date) = p_year))
          AND (p_month IS NULL OR (p.release_date IS NULL OR MONTH(p.release_date) = p_month))
          -- price range (in PHP base)
          AND (p_price_min IS NULL OR p.price >= p_price_min)
          AND (p_price_max IS NULL OR p.price <= p_price_max)
          -- in-stock filter (check total stock across all branches)
          AND (
            p_in_stock IS NULL OR p_in_stock = 0 OR
            (SELECT COALESCE(SUM(pi_all.stock_qty), 0) FROM product_inventory pi_all WHERE pi_all.product_id = p.product_id) > 0
          );
    END IF;

    -- 2) ACTUAL ROWS (products)
    IF p_branch_id IS NOT NULL THEN
        -- User is logged in - Start from product_inventory filtered by branch_id
        SELECT
          p.product_id,
          p.product_name,
          p.brand,
          p.model,
          p.price                                  AS price,
          p.price                                  AS price_php,
          CASE 
            WHEN v_currency = 'PHP' THEN p.price
            ELSE ROUND(p.price * v_rate, 2)
          END                                      AS display_price,
          v_currency                               AS currency,
          c.category_name,
          pi.stock_qty                             AS stock_quantity,
          (
            SELECT image_url
            FROM product_images
            WHERE product_id = p.product_id
              AND is_primary = 1
            ORDER BY sort_order ASC, created_at ASC
            LIMIT 1
          )                                        AS primary_image_url,
          p.created_at
        FROM product_inventory pi
        INNER JOIN products p ON pi.product_id = p.product_id
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE pi.branch_id = p_branch_id
          -- same filters as in count
          AND (
            p_q IS NULL OR p_q = '' OR
            p.product_name LIKE CONCAT('%', p_q, '%') OR
            p.brand        LIKE CONCAT('%', p_q, '%') OR
            p.model        LIKE CONCAT('%', p_q, '%') OR
            p.description  LIKE CONCAT('%', p_q, '%')
          )
          AND (p_genre_id IS NULL OR p.category_id = p_genre_id)
          AND (p_year  IS NULL OR (p.release_date IS NULL OR YEAR(p.release_date) = p_year))
          AND (p_month IS NULL OR (p.release_date IS NULL OR MONTH(p.release_date) = p_month))
          AND (p_price_min IS NULL OR p.price >= p_price_min)
          AND (p_price_max IS NULL OR p.price <= p_price_max)
          AND (
            p_in_stock IS NULL OR p_in_stock = 0 OR
            pi.stock_qty > 0
          )
        ORDER BY
          -- Sorting order
          CASE 
            WHEN p_sort = 'price_asc'  THEN CASE WHEN v_currency='PHP' THEN p.price ELSE ROUND(p.price * v_rate,2) END
            ELSE NULL
          END ASC,
          CASE 
            WHEN p_sort = 'price_desc' THEN CASE WHEN v_currency='PHP' THEN p.price ELSE ROUND(p.price * v_rate,2) END
            ELSE NULL
          END DESC,
          CASE 
            WHEN p_sort = 'name_asc' THEN p.product_name
            ELSE NULL
          END ASC,
          CASE 
            WHEN p_sort = 'name_desc' THEN p.product_name
            ELSE NULL
          END DESC,
          -- default / "newest" fallback
          p.created_at DESC,
          p.product_id DESC
        LIMIT p_limit OFFSET p_offset;
    ELSE
        -- User not logged in - Start from products and show all products
        SELECT
          p.product_id,
          p.product_name,
          p.brand,
          p.model,
          p.price                                  AS price,
          p.price                                  AS price_php,
          CASE 
            WHEN v_currency = 'PHP' THEN p.price
            ELSE ROUND(p.price * v_rate, 2)
          END                                      AS display_price,
          v_currency                               AS currency,
          c.category_name,
          (SELECT COALESCE(SUM(pi_all.stock_qty), 0) FROM product_inventory pi_all WHERE pi_all.product_id = p.product_id) AS stock_quantity,
          (
            SELECT image_url
            FROM product_images
            WHERE product_id = p.product_id
              AND is_primary = 1
            ORDER BY sort_order ASC, created_at ASC
            LIMIT 1
          )                                        AS primary_image_url,
          p.created_at
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        WHERE
          -- same filters as in count
          (
            p_q IS NULL OR p_q = '' OR
            p.product_name LIKE CONCAT('%', p_q, '%') OR
            p.brand        LIKE CONCAT('%', p_q, '%') OR
            p.model        LIKE CONCAT('%', p_q, '%') OR
            p.description  LIKE CONCAT('%', p_q, '%')
          )
          AND (p_genre_id IS NULL OR p.category_id = p_genre_id)
          AND (p_year  IS NULL OR (p.release_date IS NULL OR YEAR(p.release_date) = p_year))
          AND (p_month IS NULL OR (p.release_date IS NULL OR MONTH(p.release_date) = p_month))
          AND (p_price_min IS NULL OR p.price >= p_price_min)
          AND (p_price_max IS NULL OR p.price <= p_price_max)
          AND (
            p_in_stock IS NULL OR p_in_stock = 0 OR
            (SELECT COALESCE(SUM(pi_all.stock_qty), 0) FROM product_inventory pi_all WHERE pi_all.product_id = p.product_id) > 0
          )
        GROUP BY
          p.product_id,
          p.product_name,
          p.brand,
          p.model,
          p.price,
          c.category_name,
          p.created_at
        ORDER BY
          -- Sorting order
          CASE 
            WHEN p_sort = 'price_asc'  THEN CASE WHEN v_currency='PHP' THEN p.price ELSE ROUND(p.price * v_rate,2) END
            ELSE NULL
          END ASC,
          CASE 
            WHEN p_sort = 'price_desc' THEN CASE WHEN v_currency='PHP' THEN p.price ELSE ROUND(p.price * v_rate,2) END
            ELSE NULL
          END DESC,
          CASE 
            WHEN p_sort = 'name_asc' THEN p.product_name
            ELSE NULL
          END ASC,
          CASE 
            WHEN p_sort = 'name_desc' THEN p.product_name
            ELSE NULL
          END DESC,
          -- default / "newest" fallback
          p.created_at DESC,
          p.product_id DESC
        LIMIT p_limit OFFSET p_offset;
    END IF;
END$$

DELIMITER ;

