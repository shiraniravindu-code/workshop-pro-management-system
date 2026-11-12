# Workshop Job Tracker — GitHub-ready source package

This copy was prepared from the reviewed integration source. It contains source code and safe setup documents only. It excludes `.env`, secrets, `node_modules`, `dist`, logs, database backups and nested ZIP files.

## Included fixes

1. Correct root and health route ordering; a single `/api/health` endpoint.
2. Transactional job creation/update/status history with rollback.
3. Customer and vehicle delete guards plus `ON DELETE RESTRICT` schema rules.
4. Read-only database preflight checks the actual supplied FK names.
5. Optional job costs remain `null` until entered; completed-report totals include completed jobs only.
6. Backend date ordering, technician/status consistency and database-size cost validation.
7. CSV formula-injection protection.
8. JWT expiry uses `JWT_EXPIRES_IN` with an 8-hour fallback.
9. Current API contract, frontend handoff, setup guide and root scripts.

## Database safety

- `schema.sql` is for a new empty database. Do not execute it over a populated database.
- Back up an existing database before any DDL.
- Run `npm run verify:db` in `backend/` before deciding whether a migration applies.
- `migration_safe_deletes.sql` applies only when existing compatible foreign keys currently use cascading parent deletes and have the expected names.
- Real database backups and customer data are intentionally excluded from this repository.

## Verification limits

Automated backend and frontend logic tests use mocked/in-memory data. Run the read-only live checks and manual browser flow in `RUN_INTEGRATION_TESTS.md` on the target computer with MySQL running.
