# Workshop Job Tracker — Current Frontend Handoff

The React frontend now uses the real Express API. Demo login and localStorage CRUD are not part of the active `App.jsx` flow.

## Run

```powershell
cd frontend
npm ci
npm test
npm run build
npm run dev
```

The default API is `http://localhost:5000/api`. Override it with `VITE_API_URL` in `frontend/.env`, then restart Vite.

## Implemented

- JWT login with authenticated session in `sessionStorage`
- Admin and technician routing
- Customer, vehicle, technician and job management
- Administrator management
- Assigned-job restriction for technicians
- Job status and history display
- Dashboard totals
- Monthly and individual-job reports with Print / Save PDF
- Loading, validation and API error messages

Frontend route guards are for user experience only. The backend enforces all roles, ownership and validation.

## Manual flow

Admin login → add customer → add vehicle → create technician → assign job → technician login → In Progress → Completed → admin login → inspect history and enter final cost → print report.
