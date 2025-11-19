cloud9 (React + TypeScript + Vite + PHP API)

Prerequisites
- Node.js 18 or 20 (with npm)
- Git
- PHP 8.1+ (CLI or via XAMPP/WAMP)
- MySQL 8.x (or MariaDB)

Get the Code
- GitHub Desktop: File > Clone Repository… and select this repo
- CLI:
  - `git clone https://github.com/<org-or-user>/<repo>.git`
  - `cd ITDBADM_ECOMMERCE_PROJECT`

Install and Run
1) Frontend
   - `npm install`
   - `npm run dev`
   - Access the site at: `http://localhost:5173`

2) Backend (PHP/MySQL)
   - Create database: (Tayo na gagawa neto for backend)
     - `CREATE DATABASE gamestore_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
   - Configure connection in `backend/config/database.php`:
     - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`
     - `Access-Control-Allow-Origin` should match the frontend origin (default `http://localhost:5173`).
   - Serve the API:
     - Apache/XAMPP: place project under web root so API is at `http://localhost/gamestore/api`
     - or PHP built-in server:
       - `cd backend`
       - `php -S localhost:8000 -t api`
       - if using this, set `API_BASE_URL` in `backend/config/database.php` to `http://localhost:8000`

Where Things Are
- Frontend: `src/` (entry `src/main.tsx`, routes `src/App.tsx`)
- Backend API: `backend/api/` (router `backend/api/index.php`)
- Backend configuration: `backend/config/database.php`

Access
- Frontend (use this in the browser): `http://localhost:5173`
- Backend base URL (for reference):
  - Apache: `http://localhost/gamestore/api`
  - PHP built-in server: `http://localhost:8000`