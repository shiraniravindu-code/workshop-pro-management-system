# Workshop Job Tracker — API Contract

This document describes the API implemented by the current React frontend and Node.js/Express backend.

## Base URLs

- API: `http://localhost:5000/api`
- Swagger UI: `http://localhost:5000/api-docs`
- Frontend (development): `http://localhost:5173`

Set a different frontend API URL with `VITE_API_URL`. Protected requests use:

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

The frontend stores the authenticated session in `sessionStorage` under `workshop_api_session`. Passwords and JWT secrets must never be stored in source code or committed.

## Roles

- `admin`: manages administrators, technicians, customers, vehicles, jobs and reports.
- `technician`: views only assigned jobs and updates their status/repair notes.
- Customers do not have system accounts.

## Authentication

### `POST /api/auth/register`

First-admin bootstrap only. It succeeds only when:

1. `ALLOW_INITIAL_ADMIN_REGISTRATION=true`, and
2. the `users` table is empty.

Disable the flag immediately after creating the first administrator. Normal technician and administrator accounts are created through protected admin endpoints.

Body: `{ "name": "...", "email": "...", "password": "..." }`

### `POST /api/auth/login`

Body: `{ "email": "...", "password": "..." }`

Success:

```json
{
  "message": "Login successful",
  "token": "JWT_TOKEN",
  "user": {
    "userId": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Protected checks

- `GET /api/auth/profile`
- `GET /api/auth/admin-only` — admin only

## Administrators and technicians

All endpoints below are admin only.

- `GET /api/users/admins`
- `POST /api/users/admins` — `{ name, email, password }`; password requires 10–72 characters with a letter and number.
- `PATCH /api/users/admins/:id/status` — `{ "is_active": true|false }`
- `GET /api/users/technicians`
- `POST /api/users/technicians` — `{ name, email, password }`
- `PATCH /api/users/technicians/:id/status` — `{ "is_active": true|false }`

The backend prevents an administrator from deactivating their own account or the final active administrator. Inactive users cannot log in.

## Customers

- `GET /api/customers` — admin and technician
- `GET /api/customers/:id` — admin and technician
- `POST /api/customers` — admin; `{ name, phone, email?, address? }`
- `PUT /api/customers/:id` — admin; full customer body
- `DELETE /api/customers/:id` — admin; returns `409` when related vehicles exist

Phone numbers are stored in the 10-digit local format used by the frontend.

## Vehicles

- `GET /api/vehicles` — admin and technician
- `GET /api/vehicles/:id` — admin and technician
- `POST /api/vehicles` — admin
- `PUT /api/vehicles/:id` — admin
- `DELETE /api/vehicles/:id` — admin; returns `409` when related jobs exist

Vehicle body fields:

```json
{
  "customer_id": 1,
  "vehicle_number": "CAB-1234",
  "vehicle_type": "Car",
  "brand": "Toyota",
  "model": "Corolla",
  "manufacture_year": 2018
}
```

## Repair jobs

Exact statuses: `Pending`, `Assigned`, `In Progress`, `Completed`, `Cancelled`.

- `GET /api/jobs` — admins receive all jobs; technicians receive only their assigned jobs
- `GET /api/jobs/:id` — an assigned technician can read their own job
- `GET /api/jobs/:id/history` — admin or assigned technician
- `POST /api/jobs` — admin
- `PUT /api/jobs/:id` — admin full update
- `PATCH /api/jobs/:id/status` — admin or assigned technician
- `DELETE /api/jobs/:id` — admin; permanently removes the job and its cascading history

Create body:

```json
{
  "vehicle_id": 1,
  "technician_id": 2,
  "problem_description": "Engine overheating",
  "received_date": "2026-11-05",
  "expected_date": "2026-11-08",
  "estimated_cost": 25000
}
```

Creation derives the status: technician present → `Assigned`; no technician → `Pending`. The initial history record is saved in the same database transaction.

Technician status update:

```json
{
  "status": "In Progress",
  "repair_notes": "Cooling system inspection started"
}
```

Technicians may use only `In Progress` and `Completed`, may edit only assigned unfinished jobs, and may not submit `final_cost`. An admin records or changes final cost through the admin job update.

Dates use `YYYY-MM-DD`. `expected_date` and `completed_date` cannot be before `received_date`. Optional costs are `null` when not entered and are limited to `0–99,999,999.99`.

## Reports

Admin only:

- `GET /api/reports/daily?date=YYYY-MM-DD`
- `GET /api/reports/monthly?month=YYYY-MM`
- `GET /api/reports/monthly/csv?month=YYYY-MM`
- `GET /api/reports/monthly/pdf?month=YYYY-MM`

The React Reports page also supports browser `Print / Save PDF` for monthly and individual-job reports. Completed-job value sums entered `final_cost` values for completed jobs; it is not payment revenue.

## Error formats

```json
{
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Enter a valid email address" }]
}
```

Other failures return `{ "message": "..." }` with an appropriate HTTP status.

## Database field names

Use snake_case at the API/database boundary:

- Users: `user_id`, `name`, `email`, `password`, `role`, `is_active`, timestamps
- Customers: `customer_id`, `name`, `phone`, `email`, `address`, timestamps
- Vehicles: `vehicle_id`, `customer_id`, `vehicle_number`, `vehicle_type`, `brand`, `model`, `manufacture_year`, `created_at`
- Jobs: `job_id`, `vehicle_id`, `technician_id`, `problem_description`, `repair_notes`, `status`, dates, costs, timestamps
- History: `history_id`, `job_id`, `status`, `note`, `updated_by`, `updated_at`

Backend request validation and authorization are the source of truth.
