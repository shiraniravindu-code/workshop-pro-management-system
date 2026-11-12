#!/usr/bin/env node
// Read-only live MySQL preflight for the Workshop Job Tracker (no schema mutations).
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const mysql = require('mysql2/promise');

const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key] || /^(your_|change_me)/i.test(process.env[key]));
if (missing.length) {
  console.error('FAIL: Configure real values for these keys in backend/.env:', missing.join(', '));
  process.exitCode = 1;
} else {
  void main();
}

const expected = {
  users: ['user_id', 'name', 'email', 'password', 'role', 'is_active'],
  customers: ['customer_id', 'name', 'phone', 'email', 'address'],
  vehicles: ['vehicle_id', 'customer_id', 'vehicle_number', 'vehicle_type'],
  jobs: ['job_id', 'vehicle_id', 'technician_id', 'problem_description', 'repair_notes', 'status', 'received_date', 'expected_date', 'completed_date', 'estimated_cost', 'final_cost'],
  job_status_history: ['history_id', 'job_id', 'status', 'note', 'updated_by', 'updated_at'],
};
async function main() {
  let connection;
  let failures = 0;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      connectTimeout: 8000,
      dateStrings: true,
    });
    console.log('PASS: MySQL connection to configured database succeeded.');
    for (const [table, fields] of Object.entries(expected)) {
      const [rows] = await connection.query('SHOW COLUMNS FROM ??', [table]);
      const names = new Set(rows.map(row => row.Field));
      const absent = fields.filter(field => !names.has(field));
      if (absent.length) {
        console.error(`FAIL: ${table} missing columns: ${absent.join(', ')}`);
        failures++;
      } else {
        console.log(`PASS: ${table} required columns present`);
      }
      if (table === 'jobs' || table === 'job_status_history') {
        const statusColumn = rows.find(row => row.Field === 'status');
        if (statusColumn) {
          const names = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'];
          const absentStatuses = names.filter(status => !statusColumn.Type.includes(`'${status}'`));
          if (absentStatuses.length) {
            console.error(`FAIL: ${table}.status missing values: ${absentStatuses.join(', ')}`);
            failures++;
          } else console.log(`PASS: ${table}.status enum values match API`);
        }
      }
    }
    const [constraints] = await connection.execute(
      `SELECT TABLE_NAME, CONSTRAINT_NAME, DELETE_RULE
       FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE()
         AND CONSTRAINT_NAME IN ('fk_vehicle_customer', 'fk_job_vehicle')`
    );
    for (const constraint of ['fk_vehicle_customer', 'fk_job_vehicle']) {
      const row = constraints.find(row => row.CONSTRAINT_NAME === constraint);
      if (!row) {
        console.warn(`WARN: Constraint ${constraint} not found; inspect SHOW CREATE TABLE before migration.`);
      } else if (row.DELETE_RULE === 'CASCADE') {
        console.warn(`WARN: ${constraint} uses ON DELETE CASCADE. Back up DB; review migration_safe_deletes.sql first.`);
      } else console.log(`PASS: ${constraint} delete rule is ${row.DELETE_RULE}`);
    }
    if (failures === 0) {
      const [[row]] = await connection.query("SELECT COUNT(*) AS total, COALESCE(SUM(role = 'admin'), 0) AS admins FROM users");
      console.log(`INFO: Users=${row.total}, Admins=${row.admins}`);
      if (!Number(row.admins)) console.warn('WARN: No admin account found. See first-admin bootstrap instructions.');
    }
    if (process.env.ALLOW_INITIAL_ADMIN_REGISTRATION === 'true') {
      console.warn('WARN: Initial admin registration is ENABLED. Disable it after first admin is created.');
    }
    if (failures) {
      console.error(`FAIL: Found ${failures} schema incompatibilities. Do NOT run migrations blindly.`);
      process.exitCode = 1;
    } else console.log('PASS: Read-only database preflight completed.');
  } catch (err) {
    console.error('FAIL: Database preflight could not complete:', err.code || err.message);
    console.error('Check MySQL service, backend/.env, and whether you imported the correct schema.');
    process.exitCode = 1;
  } finally { if (connection) await connection.end(); }
}
