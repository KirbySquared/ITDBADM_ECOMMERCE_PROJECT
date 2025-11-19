<?php
/**
 * COMPREHENSIVE INPUT VALIDATION UTILITY
 * 
 * Validates and sanitizes all types of input data
 */

/**
 * Validate and sanitize integer input
 * 
 * @param mixed $value Input value
 * @param int|null $min Minimum value
 * @param int|null $max Maximum value
 * @return int|false Validated integer or false on failure
 */
function validateInteger($value, $min = null, $max = null) {
    if (!is_numeric($value)) {
        return false;
    }
    
    $intValue = (int)$value;
    
    if ($min !== null && $intValue < $min) {
        return false;
    }
    
    if ($max !== null && $intValue > $max) {
        return false;
    }
    
    return $intValue;
}

/**
 * Validate and sanitize float/decimal input
 * 
 * @param mixed $value Input value
 * @param float|null $min Minimum value
 * @param float|null $max Maximum value
 * @return float|false Validated float or false on failure
 */
function validateFloat($value, $min = null, $max = null) {
    if (!is_numeric($value)) {
        return false;
    }
    
    $floatValue = (float)$value;
    
    if ($min !== null && $floatValue < $min) {
        return false;
    }
    
    if ($max !== null && $floatValue > $max) {
        return false;
    }
    
    return $floatValue;
}

/**
 * Validate and sanitize amount (price/money)
 * 
 * @param mixed $value Input value
 * @param float $min Minimum amount (default 0)
 * @param float|null $max Maximum amount
 * @return float|false Validated amount or false on failure
 */
function validateAmount($value, $min = 0.0, $max = null) {
    return validateFloat($value, $min, $max);
}

/**
 * Validate email address
 * 
 * @param mixed $value Input value
 * @return string|false Validated email or false on failure
 */
function validateEmail($value) {
    if (!is_string($value)) {
        return false;
    }
    
    $email = filter_var(trim($value), FILTER_VALIDATE_EMAIL);
    return $email !== false ? $email : false;
}

/**
 * Validate string with length constraints
 * 
 * @param mixed $value Input value
 * @param int|null $minLength Minimum length
 * @param int|null $maxLength Maximum length
 * @param string|null $pattern Regex pattern
 * @return string|false Validated string or false on failure
 */
function validateString($value, $minLength = null, $maxLength = null, $pattern = null) {
    if (!is_string($value) && !is_numeric($value)) {
        return false;
    }
    
    $stringValue = (string)$value;
    $length = strlen($stringValue);
    
    if ($minLength !== null && $length < $minLength) {
        return false;
    }
    
    if ($maxLength !== null && $length > $maxLength) {
        return false;
    }
    
    if ($pattern !== null && !preg_match($pattern, $stringValue)) {
        return false;
    }
    
    return $stringValue;
}

/**
 * Validate array input
 * 
 * @param mixed $value Input value
 * @param int|null $minItems Minimum items
 * @param int|null $maxItems Maximum items
 * @return array|false Validated array or false on failure
 */
function validateArray($value, $minItems = null, $maxItems = null) {
    if (!is_array($value)) {
        return false;
    }
    
    $count = count($value);
    
    if ($minItems !== null && $count < $minItems) {
        return false;
    }
    
    if ($maxItems !== null && $count > $maxItems) {
        return false;
    }
    
    return $value;
}

/**
 * Validate enum value
 * 
 * @param mixed $value Input value
 * @param array $allowedValues Allowed values
 * @return mixed Validated value or false on failure
 */
function validateEnum($value, $allowedValues) {
    if (in_array($value, $allowedValues, true)) {
        return $value;
    }
    return false;
}

/**
 * Validate and sanitize input data based on schema
 * 
 * @param array $data Input data
 * @param array $schema Validation schema
 * @return array ['valid' => bool, 'data' => array, 'errors' => array]
 */
function validateInputSchema($data, $schema) {
    $validated = [];
    $errors = [];
    
    foreach ($schema as $field => $rules) {
        $value = $data[$field] ?? null;
        $required = $rules['required'] ?? false;
        
        // Check if required field is missing
        if ($required && ($value === null || $value === '')) {
            $errors[$field] = ucfirst($field) . ' is required';
            continue;
        }
        
        // Skip validation if field is not required and not provided
        if (!$required && ($value === null || $value === '')) {
            if (isset($rules['default'])) {
                $validated[$field] = $rules['default'];
            }
            continue;
        }
        
        // Validate based on type
        $type = $rules['type'] ?? 'string';
        $validatedValue = null;
        
        switch ($type) {
            case 'int':
            case 'integer':
                $validatedValue = validateInteger($value, $rules['min'] ?? null, $rules['max'] ?? null);
                break;
                
            case 'float':
            case 'decimal':
                $validatedValue = validateFloat($value, $rules['min'] ?? null, $rules['max'] ?? null);
                break;
                
            case 'amount':
            case 'price':
                $validatedValue = validateAmount($value, $rules['min'] ?? 0.0, $rules['max'] ?? null);
                break;
                
            case 'email':
                $validatedValue = validateEmail($value);
                break;
                
            case 'string':
                $validatedValue = validateString(
                    $value,
                    $rules['min_length'] ?? null,
                    $rules['max_length'] ?? null,
                    $rules['pattern'] ?? null
                );
                break;
                
            case 'array':
                $validatedValue = validateArray($value, $rules['min_items'] ?? null, $rules['max_items'] ?? null);
                break;
                
            case 'enum':
                $validatedValue = validateEnum($value, $rules['allowed'] ?? []);
                break;
        }
        
        if ($validatedValue === false) {
            $errors[$field] = $rules['error'] ?? ucfirst($field) . ' is invalid';
        } else {
            $validated[$field] = $validatedValue;
        }
    }
    
    return [
        'valid' => empty($errors),
        'data' => $validated,
        'errors' => $errors
    ];
}

?>


