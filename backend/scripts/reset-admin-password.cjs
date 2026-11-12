#!/usr/bin/env node
// One-time local administrator password reset for Workshop Job Tracker.
// Run from the backend directory: node scripts/reset-admin-password.cjs
// Requires access to the project's backend/.env and the local MySQL database.
'use strict';

const path = require('node:path');
const readline = require('node:readline');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const ADMIN_EMAIL = 'admin@gmail.com';

function hiddenInput(message) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(message);
    // Hide input; don't put the password in shell history or terminal output.
    rl._writeToOutput = () => {};
    rl.on('SIGINT', () => { rl.close(); reject(new Error('Cancelled')); });
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];
  const missing = required.filter((k) => !process.env[k] || process.env[k].startsWith('your_'));
  if (missing.length) throw new Error('Missing backend/.env settings: ' + missing.join(', '));

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    connectTimeout: 8000,
  });

  try {
    const [admins] = await connection.execute(
      'SELECT user_id FROM users WHERE email = ? AND role = ? AND is_active = 1 LIMIT 1',
      [ADMIN_EMAIL, 'admin']
    );
    if (admins.length !== 1) {
      throw new Error('Active admin account ' + ADMIN_EMAIL + ' not found; no changes made.');
    }

    console.log('Resetting password for the existing admin account: ' + ADMIN_EMAIL);
    const password = await hiddenInput('New password (12+ characters; input hidden): ');
    if (password.length < 12) throw new Error('Password must be at least 12 characters; no changes made.');
    const confirmation = await hiddenInput('Confirm new password (input hidden): ');
    if (password !== confirmation) throw new Error('Passwords do not match; no changes made.');

    const hash = await bcrypt.hash(password, 12);
    const [result] = await connection.execute(
      'UPDATE users SET password = ? WHERE user_id = ? AND email = ? AND role = ? AND is_active = 1',
      [hash, admins[0].user_id, ADMIN_EMAIL, 'admin']
    );
    if (result.affectedRows !== 1) throw new Error('Password was not changed; please check the account.');
    console.log('SUCCESS: Admin password updated. Log in using ' + ADMIN_EMAIL + '.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('RESET FAILED:', err.message);
  process.exitCode = 1;
});
