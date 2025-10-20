GameStore E‑Commerce (Frontend + PHP API)

This repository contains a React + TypeScript + Vite frontend and a simple PHP/MySQL backend API for a GameStore demo.

Contents
- Prerequisites
- Local setup (recommended flow for groupmates)
- Backend setup (PHP/MySQL)
- Frontend setup (Vite/React)
- Running the app
- Building for production
- Configuration notes
- GitHub workflow for collaborators
- Troubleshooting

Prerequisites
- Node.js 18 or 20 (includes npm). Verify with `node -v` and `npm -v`.
- Git
- PHP 8.1+ (CLI or via XAMPP/WAMP/MAMP)
- MySQL 8.x (or MariaDB 10.6+)
- Optional: XAMPP/WAMP for an easy Apache + PHP + MySQL stack on Windows

Local Setup (Quick Start)
1) Clone the repo
   - Using GitHub: fork the repo, then
     - `git clone https://github.com/<your-username>/<repo>.git`
   - Or direct clone (if you have access):
     - `git clone https://github.com/<org-or-user>/<repo>.git`
   - `cd ITDBADM_ECOMMERCE_PROJECT`

2) Install frontend dependencies
   - `npm install`

3) Set up the backend
   - Ensure MySQL is running and create a database named `gamestore_db`:
     - `CREATE DATABASE gamestore_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
   - Configure PHP app settings in `backend/config/database.php` as needed:
     - DB_HOST, DB_NAME, DB_USER, DB_PASS
     - CORS origin defaults to `http://localhost:5173` (Vite dev). Change if your dev server runs elsewhere.
     - `API_BASE_URL` defaults to `http://localhost/gamestore/api` (assumes Apache serving backend under `/gamestore/api`). Adjust to match your local server path.

4) Serve the backend
   Option A — XAMPP/Apache (recommended on Windows):
   - Copy or symlink `backend` into your Apache web root (e.g., `C:\xampp\htdocs\gamestore`).
   - You should end up with `C:\xampp\htdocs\gamestore\api\index.php` accessible at `http://localhost/gamestore/api`.

   Option B — PHP built-in server (alternative):
   - From the project root or `backend` folder, serve the `api` subfolder:
     - `cd backend`
     - `php -S localhost:8000 -t api`
   - Then set `API_BASE_URL` in `backend/config/database.php` to `http://localhost:8000`.

5) Start the frontend
   - `npm run dev`
   - Vite dev server runs at `http://localhost:5173` by default.

Backend Details
- Entry point: `backend/api/index.php`
- Notable endpoints (examples):
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /products`
  - `GET /products?id=<id>`
  - `GET /categories`
  - `GET/POST/PUT/DELETE /cart`
- CORS and headers are set in `backend/config/database.php`.
- Tokens are simple base64 payloads in this demo (`backend/utils/response.php`). Replace with a real JWT solution for production.

Frontend Details
- React 19 + Vite 7 + TypeScript
- Routing via `react-router-dom`
- Bootstrap is included via CDN in `index.html`
- Main entry: `src/main.tsx`, routes: `src/App.tsx`

Running the App
1) Backend served at either `http://localhost/gamestore/api` (Apache) or `http://localhost:8000` (PHP built-in server).
2) Frontend at `http://localhost:5173`.
3) If you change either port or path, update:
   - `API_BASE_URL` in `backend/config/database.php`
   - `Access-Control-Allow-Origin` in the same file to match the frontend origin

Build and Preview (Frontend)
- Build: `npm run build`
- Preview production build locally: `npm run preview`

Configuration Notes
- `backend/config/database.php` controls:
  - DB connection (host, db, user, pass)
  - `API_BASE_URL` used by the router
  - CORS headers (origin, methods, headers)
- If your Apache path differs (not `/gamestore/api`), change line where the router normalizes the path in `backend/api/index.php` or keep the same folder structure under your web root.

GitHub Workflow (for groupmates)
- Clone or fork, then create a new branch for your work:
  - `git checkout -b feature/<short-description>`
- Install deps: `npm install`
- Run dev server: `npm run dev`
- Commit in small, focused chunks:
  - `git add -A`
  - `git commit -m "<clear message>"`
- Push your branch and open a Pull Request to `main`.
- Keep PRs small and focused. Include a brief description of what changed and how to test it.

Troubleshooting
- 403/404 from API
  - Confirm the backend is served from the correct path and `API_BASE_URL` matches it.
- CORS errors in browser console
  - Verify `Access-Control-Allow-Origin` in `backend/config/database.php` matches your frontend origin (default `http://localhost:5173`).
- Cannot connect to database
  - Check MySQL is running and the credentials in `backend/config/database.php` are correct.
- Dev server port changed
  - If Vite chooses a different port, update the origin in `backend/config/database.php`.

Scripts
- `npm run dev`     Start Vite dev server
- `npm run build`   Type-check and build
- `npm run preview` Preview the built app
- `npm run lint`    Run ESLint

Notes
- This is a demo codebase. The authentication token is not a real JWT; do not use as-is in production.
- No Composer packages are used. PHP extensions required: `pdo`, `pdo_mysql`.