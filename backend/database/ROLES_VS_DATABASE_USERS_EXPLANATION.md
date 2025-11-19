# Application Roles vs Database Users - Explanation

## Two Different Systems

### 1. **Application Roles** (in your `users` table)
These are stored in your `users.role` column:
- `admin` - Application admin role
- `staff` - Application staff role  
- `user` - Application customer role

**These are application-level roles** - they control what users can do in your application.

### 2. **Database Users** (MySQL database accounts)
These are separate MySQL database accounts:
- `admin_user` - Database user with admin privileges
- `staff_user` - Database user with staff privileges
- `app_user` - Database user for application
- `readonly_user` - Database user for reporting
- `backup_user` - Database user for backups

**These are database-level users** - they control what can be done at the database level.

## They Are Different Things!

| Application Role | Database User | Purpose |
|-----------------|---------------|---------|
| `admin` (in users table) | `admin_user` (MySQL account) | Different! |
| `staff` (in users table) | `staff_user` (MySQL account) | Different! |
| `user` (in users table) | `app_user` (MySQL account) | Different! |

## How They Work Together

### Current Setup (What You Have Now):
```
Application User (John) 
  → Has role: "admin" (in users table)
  → Connects to database using: Your current DB_USER/DB_PASS
  → Application checks: if (user.role === 'admin') allow access
```

### With Database Users (Optional Enhancement):
```
Application User (John)
  → Has role: "admin" (in users table)
  → Connects to database using: "admin_user" MySQL account
  → Application checks: if (user.role === 'admin') allow access
  → Database also enforces: admin_user has ALL PRIVILEGES
```

## Why Create Database Users?

The database users (`admin_user`, `staff_user`, etc.) are for:
1. **Demonstrating GRANT/REVOKE** for the rubric
2. **Additional security layer** (optional)
3. **Separation of concerns** (different DB accounts for different purposes)

**You don't have to use them!** They're just created to show you have GRANT/REVOKE statements.

## Mapping Options

### Option 1: Keep Current Setup (Recommended)
- Keep using your current database user
- Application roles (admin/staff/user) work as-is
- Database users are just for demonstration

### Option 2: Map Database Users to Application Roles
If you want to use the database users:

```php
// In database.php - map application role to database user
$userRole = getUserRole($userId); // Get from users.role column

switch($userRole) {
    case 'admin':
        $dbUser = 'admin_user';
        $dbPass = 'Admin@Secure123!';
        break;
    case 'staff':
        $dbUser = 'staff_user';
        $dbPass = 'Staff@Secure123!';
        break;
    default:
        $dbUser = 'app_user';
        $dbPass = 'App@Secure123!';
}
```

But this is **optional** - you don't need to do this!

## For the Rubric

The GRANT/REVOKE script demonstrates:
- ✅ You know how to use GRANT statements
- ✅ You know how to use REVOKE statements
- ✅ You understand database-level privileges
- ✅ You can create role-based database users

**The database users don't have to match your application roles exactly!**

## Summary

- **Application roles** (`admin`, `staff`, `user`) = What users can do in your app
- **Database users** (`admin_user`, `staff_user`, `app_user`) = Separate MySQL accounts with different privileges
- **They are different systems** that can work together
- **You can keep your current setup** - database users are just for demonstration

The script is safe to run - it won't affect your application roles at all!

