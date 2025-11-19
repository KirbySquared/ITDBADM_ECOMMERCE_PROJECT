# Security Implementation Guide

This guide explains how to use the security system that has been added to the project.

## Security Framework Overview

The security system implements the **Assess-Prevent-Detect-Recover** framework:

### 1. ASSESS - Locate Risks and Vulnerabilities
- Security audit logging system
- Vulnerability detection
- Security event tracking

### 2. PREVENT - Using Cryptography, User Controls, Access Controls
- Rate limiting
- Input sanitization
- Security headers
- Access control validation
- JWT token security (already implemented)

### 3. DETECT - Audit, Monitor, Alert
- Security event monitoring
- Suspicious activity detection
- Alert system for critical events
- Real-time security dashboard

### 4. RECOVER - Ensure Service Continuity
- Database backup and restore
- Forensics logging for postmortem analysis
- Service continuity measures

## Setup Instructions

### Step 1: Create Security Database Tables

Run the SQL script to create all security tables:

```bash
mysql -u your_user -p electronics_store < backend/database/create_security_tables.sql
```

Or execute it in MySQL Workbench.

### Step 2: Include Security Utilities

The security utilities are in `backend/utils/`:
- `security_audit.php` - Audit logging
- `rate_limiter.php` - Rate limiting
- `security_headers.php` - Security headers
- `database_backup.php` - Backup/recovery
- `forensics.php` - Forensics logging

### Step 3: Integrate Security (Optional - Non-Breaking)

See `backend/utils/security_integration_example.php` for examples of how to add security to existing endpoints without breaking them.

## Security Features

### 1. Security Audit Logging

Log security events for monitoring:

```php
require_once __DIR__ . '/../../utils/security_audit.php';

// Log a security event
logSecurityEvent($pdo, 'login_failed', 'medium', 
    "Failed login attempt", $userId, ['email' => $email]);
```

Event types: `login_failed`, `access_denied`, `rate_limit_exceeded`, etc.
Severity levels: `low`, `medium`, `high`, `critical`

### 2. Rate Limiting

Prevent brute force attacks:

```php
require_once __DIR__ . '/../../utils/rate_limiter.php';

$clientId = getClientIdentifier($userId);
$rateLimit = checkRateLimit($pdo, $clientId, 'login', 5, 300);

if (!$rateLimit['allowed']) {
    sendError('Too many attempts. Try again later.', 429);
}
```

### 3. Security Headers

Add security headers to prevent XSS, clickjacking, etc.:

```php
require_once __DIR__ . '/../../utils/security_headers.php';

setSecurityHeaders(); // Call at the start of your endpoint
```

### 4. Database Backup

Create and restore database backups:

```php
require_once __DIR__ . '/../../utils/database_backup.php';

// Create backup
$result = createDatabaseBackup($pdo);

// Restore backup
$result = restoreDatabaseBackup($pdo, '/path/to/backup.sql');
```

### 5. Forensics Logging

Log detailed information for security incident investigation:

```php
require_once __DIR__ . '/../../utils/forensics.php';

logForensics($pdo, 'security_incident', 
    "Detailed incident description", $userId, $contextData);
```

## API Endpoints

### Security Monitoring API

**GET /api/security/monitor?action=dashboard**
- Get security dashboard statistics
- Requires admin authentication

**GET /api/security/monitor?action=events**
- Get security events with filters
- Query params: `event_type`, `severity`, `user_id`, `date_from`, `date_to`

**GET /api/security/monitor?action=alerts**
- Get security alerts
- Query params: `status` (pending, reviewed, resolved)

**GET /api/security/monitor?action=suspicious**
- Detect suspicious activity
- Query params: `user_id`, `ip_address`

### Database Backup API

**GET /api/security/backup?action=list**
- List available backups
- Requires admin authentication

**POST /api/security/backup**
```json
{
  "action": "create",
  "backup_dir": "/optional/path"
}
```

**POST /api/security/backup**
```json
{
  "action": "restore",
  "backup_file": "/path/to/backup.sql"
}
```

## Security Tables

- `security_audit_log` - All security events
- `security_alerts` - Critical security alerts
- `rate_limits` - Rate limiting data
- `backup_logs` - Backup operation logs
- `forensics_log` - Detailed forensics data
- `failed_login_attempts` - Failed login tracking

## Best Practices

1. **Always log security events** for important actions (login, access attempts, etc.)
2. **Use rate limiting** on sensitive endpoints (login, checkout, password reset)
3. **Set security headers** on all API responses
4. **Sanitize all user inputs** before processing
5. **Create regular backups** (automate with cron jobs)
6. **Monitor security alerts** regularly
7. **Review forensics logs** after security incidents

## Integration Examples

See `backend/utils/security_integration_example.php` for detailed examples of integrating security into existing endpoints without breaking changes.

## Notes

- All security features are **optional** and can be added incrementally
- Existing code continues to work without modifications
- Security utilities are designed to be non-intrusive
- All security operations are logged for audit purposes


