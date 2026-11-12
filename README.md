# Workshop Job Tracker

A vehicle-repair workshop management system built with React, Vite, Node.js, Express and MySQL.

## Features

- JWT authentication with admin and technician roles
- Customer and vehicle management
- Technician and administrator account management
- Repair job assignment, status updates and audit history
- Dashboard, monthly reports and individual job reports
- CSV/PDF report endpoints and browser Print / Save PDF
- Swagger API documentation

## Project structure

- `frontend/` — React/Vite application
- `backend/` — Express REST API
- `schema.sql` — new empty database schema
- `migration_safe_deletes.sql` — optional FK migration for a compatible existing database
- `API_CONTRACT.md` — current endpoint and field contract
- `RUN_INTEGRATION_TESTS.md` — Windows/PowerShell validation guide

## Quick start

1. For a new empty database, import `schema.sql` once in MySQL Workbench. Never import it over an existing populated database.
2. Copy `backend/.env.example` to `backend/.env` and set private local values.
3. Run `npm ci && npm test && npm start` inside `backend/`.
4. Run `npm ci && npm test && npm run build && npm run dev` inside `frontend/`.
5. Open the Vite URL. Swagger is available at `http://localhost:5000/api-docs`.

See `RUN_INTEGRATION_TESTS.md` for the safe first-admin and full manual test procedure.

## Security

Never commit `.env`, database backups, real customer data, `node_modules`, build output, logs or JWT secrets. The supplied `.gitignore` excludes them.
