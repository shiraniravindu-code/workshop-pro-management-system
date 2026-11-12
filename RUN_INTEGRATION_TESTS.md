# Workshop Job Tracker — Run the Integration Checks (Windows / PowerShell)

This GitHub-ready package includes real HTTP route tests (mock database), a **read-only** MySQL schema checker, and a **read-only** live API smoke test. No secrets, `.env`, `node_modules`, build output, old ZIPs, database backups, or production data are included.

## 0. Critical: protect your existing data

- **If you already have a MySQL database, BACK IT UP before changing anything.** Do not run `schema.sql` on a populated database.
- The original upload contains **two incompatible SQL schemas**. This app needs the root `schema.sql` column naming (`users.name`, `users.password`, `jobs.technician_id`, `job_status_history.status`).
- `migration_safe_deletes.sql` applies **only to databases matching the root schema**. Do not blindly execute it on the older `detabase.zip` structure.
- The commands below only **read your existing database**, unless you explicitly choose to bootstrap an admin, add UI test records, or run a schema import on a new database.

## 1. Check system requirements

Install Node.js (version 22.12+ or supported equivalent), npm, and MySQL Server with Workbench.

Open **PowerShell** in `workshop-job-tracker/backend` (the folder with `package.json`):

```powershell
node --version
npm --version
Copy-Item .env.example .env   # Only if you have not made .env yet
notepad .env
```

In `backend/.env`, set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=workshop_job_tracker` and a strong randomly generated `JWT_SECRET`. Do not share that file or paste your password into ChatGPT. Keep `ALLOW_INITIAL_ADMIN_REGISTRATION=false` unless deliberately creating the first admin in a **new, empty database**.

**New database only:** In MySQL Workbench, execute the package-root `schema.sql` once. For an **existing** database, do NOT import it or overwrite your existing data.

## 2. Test the Backend and actual MySQL schema

In the same PowerShell window:

```powershell
npm ci
npm test
npm run verify:db
npm start
```

- `npm test` runs **mock-database** unit and real-HTTP route tests. It does not need your MySQL password or a running MySQL server.
- `npm run verify:db` opens your actual configured MySQL database **read-only** and compares tables, required columns, statuses, and the supplied foreign-key names.
- `npm start` runs the backend at `http://localhost:5000` by default. Leave this terminal running.
- `http://localhost:5000/api/health` should return `{"api":"running","database":"connected"}` **only when the actual backend can connect to MySQL**.
- `http://localhost:5000/api-docs` is the Swagger UI.

If `verify:db` reports missing columns, **stop** and check which SQL schema was originally imported; do not run a blind migration.

## 3. Live API smoke test

Open a **second** PowerShell window in the same `backend` folder:

```powershell
npm run smoke:live
```

This makes six real HTTP requests to your running backend: root route, MySQL-backed health endpoint, unauthorized jobs request, invalid login validation, unknown route, and frontend CORS. All are non-mutating (invalid login payload is intentionally rejected). It does **not** verify CRUD or credentials.

## 4. Run the Frontend

Open a **third** PowerShell window in `workshop-job-tracker/frontend`:

```powershell
npm ci
npm test
npm run build
npm run dev
```

Open `http://localhost:5173` (or Vite's printed URL). `frontend/.env.example` defaults to `VITE_API_URL=http://localhost:5000/api`; copy it to `.env` only if you need to change the API URL. Browser access and production-build tests must be run on your own computer because this review environment does not have the Linux native Vite/Rolldown binding.

## 5. Create the FIRST admin ONLY if the database is EMPTY

The login screen does not expose public registration. If `verify:db` reports **Users=0, Admins=0** on a **new/empty** database:

1. Temporarily change `ALLOW_INITIAL_ADMIN_REGISTRATION=true` in `backend/.env`, and restart `npm start`.
2. In a separate PowerShell terminal, execute the commands below with your own name and email. Enter the password when prompted (do **not** share it here).

```powershell
$name = Read-Host "First administrator name"
$email = Read-Host "First administrator email"
$secure = Read-Host "New administrator password" -AsSecureString
$password = [System.Net.NetworkCredential]::new('', $secure).Password
$body = @{ name = $name; email = $email; password = $password } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/auth/register' -ContentType 'application/json' -Body $body
Remove-Variable password,body,secure
```

3. **Immediately set** `ALLOW_INITIAL_ADMIN_REGISTRATION=false` in `backend/.env` and **restart** the backend. Then sign in at `http://localhost:5173`.
4. If users already exist, do **not** use the first-admin bootstrap. Use the existing admin account or your authorized account-recovery process.

## 6. Manual end-to-end check in a TEST database

For this part, preferably use a backed-up or disposable test database. Do not create fake customer data in a live workshop database.

1. Admin: sign in; the dashboard and Customers/Vehicles/Jobs pages should load without console errors.
2. Admin: add one test customer, then a vehicle belonging to them.
3. Admin: create a technician and create a repair job assigned to that technician.
4. Technician: sign in using their new credentials; verify only their own jobs appear; change the job status to **In Progress** and then **Completed**.
5. Admin: sign in again; verify the job's updated status, status history, and job report. A technician must not be able to change `final_cost`.
6. Try deleting a customer with vehicles or a vehicle with repair jobs; the server should reject the delete (HTTP 409) rather than erase the history.

## Interpreting results

| Check | What a pass proves | What it does NOT prove |
|---|---|---|
| `npm test` (Backend) | Express HTTP behavior + mocked SQL/controller logic | Live MySQL data and browser flows |
| `npm run verify:db` | MySQL is reachable; expected columns and enum values exist | Every application query succeeds |
| `npm run smoke:live` | Local API responds and its health endpoint can reach MySQL | Valid login and CRUD |
| `npm run build` (Frontend) | Bundler can compile the frontend on your PC | Browser and API interactions |
| Manual UI check | Browser login and actual CRUD on YOUR test database | Production performance and security audit |

If a test fails, save its **error message** (not `.env` or password), and use that to identify the exact problem.
