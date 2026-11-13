import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from 'react-router-dom';
import { STATUSES } from './lib/constants';
import { api, validEmail } from './lib/api';
const SESSION_KEY = 'workshop_api_session';
const emptyData = () => ({ users: [], customers: [], vehicles: [], jobs: [], job_status_history: [] });

import './App.css';
/* Common helpers */
const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
};
const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
  })}`;
const label = (key) =>
  key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const hasCost = (value) =>
  value !== null && value !== undefined && value !== '';
const showCost = (value) =>
  hasCost(value) ? money(value) : 'Not entered';
const keys = {
  customers: 'customer_id',
  vehicles: 'vehicle_id',
  users: 'user_id',
  jobs: 'job_id',
};
const defaults = {
  customers: {
    name: '',
    phone: '',
    email: '',
    address: '',
  },
  vehicles: {
    customer_id: '',
    vehicle_number: '',
    vehicle_type: 'Car',
    brand: '',
    model: '',
    manufacture_year: '',
  },
  users: {
    name: '',
    email: '',
    role: 'technician',
    is_active: true,
  },
  jobs: {
    vehicle_id: '',
    technician_id: '',
    problem_description: '',
    repair_notes: '',
    status: 'Pending',
    received_date: '',
    expected_date: '',
    completed_date: null,
    estimated_cost: '',
    final_cost: '',
  },
};
function Badge({ status }) {
  return (
    <span className={`badge ${status.toLowerCase().replaceAll(' ', '-')}`}>
      {status}
    </span>
  );
}
/* Backend-only sign in — no browser/demo accounts */
function Auth({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const email = form.email.trim();
      if (!validEmail(email)) throw new Error('Enter a valid email address.');
      const result = await api('/auth/login', {
        method: 'POST', body: { email, password: form.password },
      });
      if (!result.token || !result.user || !['admin', 'technician'].includes(result.user.role)) {
        throw new Error('Unexpected login response.');
      }
      onLogin({
        token: result.token,
        user: { ...result.user, user_id: Number(result.user.userId ?? result.user.user_id), is_active: true },
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth">
      <div className="auth-intro">
        <div className="brand-mark" aria-hidden="true">W</div>
        <p className="eyebrow">WORKSHOP PRO <span className="brand-divider">/</span> MANAGEMENT SUITE</p>
        <h2>Every repair.<br />Every detail.<br /><span>One workspace.</span></h2>
        <p>Run your workshop with clarity — from the first customer visit to the final service report.</p>
        <div className="auth-features" aria-label="Key features">
          <span>Customer records</span><span>Job tracking</span><span>Team workflow</span>
        </div>
        <div className="auth-promise"><span className="pulse-dot"/> All your workshop operations, connected.</div>
      </div>
      <section className="card auth-card" aria-label="Sign in to Workshop Pro">
        <div className="auth-card-top">
          <span className="auth-lock" aria-hidden="true">◆</span>
          <span>SECURE WORKSPACE</span>
        </div>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Sign in to Workshop Pro</h1>
        <p className="muted">Access your workshop management dashboard.</p>
        <form onSubmit={submit}>
          <label htmlFor="login-email">Email address
            <input id="login-email" required type="email" autoComplete="username"
              placeholder="you@workshop.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}/>
          </label>
          <label htmlFor="login-password">Password
            <input id="login-password" required type={show ? 'text' : 'password'}
              autoComplete="current-password" placeholder="Enter your password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}/>
          </label>
          <label className="check"><input type="checkbox" checked={show}
            onChange={(e) => setShow(e.target.checked)}/> Show password</label>
          <button className="auth-submit" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in securely'}
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </form>
        {message && <p role="alert" className="error auth-message">{message}</p>}
        <div className="auth-help">
          <span className="auth-help-icon" aria-hidden="true">✓</span>
          <p>Admin and technician access only.<br /><small>Contact your workshop administrator for an account.</small></p>
        </div>
      </section>
    </div>
  );
}
/* Admin-only administrator directory — uses backend API, never browser demo data. */
function AdminManagement({ request, currentUser }) {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [changingId, setChangingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchAdmins = useCallback(async (signal) => {
    try {
      const result = await request('/users/admins', { signal });
      if (!signal?.aborted) setAdmins(result.admins || []);
    } catch (err) {
      if (!signal?.aborted) setError(err.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdmins(controller.signal);
    return () => controller.abort();
  }, [fetchAdmins]);

  const activeCount = admins.filter(a => Boolean(Number(a.is_active))).length;

  async function createAdministrator(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setNotice('');
    const name = form.name.trim();
    const email = form.email.trim();
    if (name.length < 2 || name.length > 100) return setError('Name must contain 2–100 characters.');
    if (!validEmail(email)) return setError('Enter a valid email address.');
    if (form.password.length < 10 || form.password.length > 72 ||
        !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      return setError('Password must have 10–72 characters, including a letter and a number.');
    }
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');

    setBusy(true);
    try {
      await request('/users/admins', {
        method: 'POST', body: { name, email, password: form.password },
      });
      setForm({ name: '', email: '', password: '', confirmPassword: '' });
      setShowPassword(false);
      await fetchAdmins();
      setNotice('Administrator created. They can sign in with their email and password.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(admin) {
    if (changingId !== null) return;
    const activating = !Boolean(Number(admin.is_active));
    if (!activating && Number(admin.user_id) === Number(currentUser.user_id)) {
      return setError('You cannot deactivate your own account.');
    }
    if (!activating && activeCount <= 1) {
      return setError('At least one active administrator must remain.');
    }
    if (!window.confirm(`${activating ? 'Activate' : 'Deactivate'} ${admin.name}?`)) return;
    setChangingId(admin.user_id); setError(''); setNotice('');
    try {
      const result = await request(`/users/admins/${admin.user_id}/status`, {
        method: 'PATCH', body: { is_active: activating },
      });
      await fetchAdmins();
      setNotice(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingId(null);
    }
  }

  return (
    <div className="admins-page">
      <section className="admins-hero">
        <div>
          <span className="admins-eyebrow">ACCESS CONTROL · ADMIN ONLY</span>
          <h1>Manage Administrators</h1>
          <p>Create secure administrator accounts and control access to Workshop Pro.</p>
        </div>
      </section>

      <div className="admins-metrics">
        <div className="admins-metric"><span>Total admins</span><strong>{admins.length}</strong></div>
        <div className="admins-metric"><span>Active admins</span><strong>{activeCount}</strong></div>
        <div className="admins-metric"><span>Inactive admins</span><strong>{admins.length - activeCount}</strong></div>
      </div>

      {error && <p className="error admins-alert" role="alert">{error}</p>}
      {notice && <p className="admins-success admins-alert" role="status">{notice}</p>}

      <section className="card admins-create-card">
        <div className="admins-section-header">
          <div><span className="admins-step">01 / ACCOUNT CREATION</span><h2>Create New Administrator</h2>
            <p className="muted">An administrator can manage customers, technicians, jobs and reports.</p>
          </div>
          <span className="admins-lock-label">Restricted access</span>
        </div>
        <form onSubmit={createAdministrator} autoComplete="off">
          <div className="admins-form-grid">
            <label htmlFor="new-admin-name">Full name
              <input id="new-admin-name" required minLength={2} maxLength={100} placeholder="e.g. Workshop Manager"
                autoComplete="off" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}/>
            </label>
            <label htmlFor="new-admin-email">Email address
              <input id="new-admin-email" required type="email" placeholder="manager@example.com"
                autoComplete="off" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}/>
            </label>
            <label htmlFor="new-admin-password">Temporary password
              <input id="new-admin-password" required type={showPassword ? 'text' : 'password'} minLength={10} maxLength={72}
                autoComplete="new-password" placeholder="10+ characters, letter + number" value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}/>
            </label>
            <label htmlFor="confirm-admin-password">Confirm password
              <input id="confirm-admin-password" required type={showPassword ? 'text' : 'password'} minLength={10} maxLength={72}
                autoComplete="new-password" placeholder="Re-enter the password" value={form.confirmPassword}
                onChange={e => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}/>
            </label>
          </div>
          <div className="admins-form-footer">
            <label className="check"><input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)}/> Show passwords</label>
            <button type="submit" disabled={busy}>{busy ? 'Creating administrator…' : '+ Create Administrator'}</button>
          </div>
        </form>
      </section>

      <section className="card admins-directory-card">
        <div className="admins-section-header">
          <div><span className="admins-step">02 / TEAM ACCESS</span><h2>Administrator Directory</h2>
            <p className="muted">You cannot deactivate your own account or the final active admin.</p>
          </div>
          <button className="secondary" type="button" disabled={loading} onClick={() => { setLoading(true); setError(''); fetchAdmins(); }}>Refresh list</button>
        </div>
        {loading ? <p role="status">Loading administrators…</p> : (
          <div className="table-wrap admins-table-wrap">
            <table className="admins-table">
              <thead><tr><th>Administrator</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{admins.map(admin => {
                const own = Number(admin.user_id) === Number(currentUser.user_id);
                const active = Boolean(Number(admin.is_active));
                const blockOff = active && (own || activeCount <= 1);
                return <tr key={admin.user_id}>
                  <td><span className="admins-person"><span className="admins-avatar" aria-hidden="true">{admin.name?.slice(0, 1)?.toUpperCase() || 'A'}</span>
                    <span><strong>{admin.name}</strong>{own && <small> Your account</small>}</span></span></td>
                  <td>{admin.email}</td>
                  <td><span className={`admins-status ${active ? 'is-active' : 'is-inactive'}`}>{active ? 'Active' : 'Inactive'}</span></td>
                  <td><button type="button" className={active ? 'danger small' : 'secondary small'} disabled={changingId !== null || blockOff}
                      title={own ? 'You cannot deactivate yourself' : blockOff ? 'At least one active admin is required' : ''}
                      onClick={() => toggleStatus(admin)}>{changingId === admin.user_id ? 'Saving…' : active ? 'Deactivate' : 'Activate'}</button></td>
                </tr>;
              })}</tbody>
            </table>
            {admins.length === 0 && <p className="muted">No administrators found.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

/* Customers / Vehicles / Jobs / Technicians */
function Management({
  table,
  data,
  user,
  commit,
  remote = false,
  loadHistory,
  technician = false,
}) {
  const blank = () => ({
    ...defaults[table],
    ...(table === 'jobs' ? { received_date: today() } : {}),
  });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyBusy, setHistoryBusy] = useState(false);
  const options = {
    customer_id: data.customers.map((c) => [
      c.customer_id, c.name,
    ]),
    vehicle_id: data.vehicles.map((v) => [
      v.vehicle_id, v.vehicle_number,
    ]),
    technician_id: data.users
      .filter((u) => u.role === 'technician' && u.is_active)
      .map((u) => [u.user_id, u.name]),
    vehicle_type: [
      'Car', 'Van', 'Motorbike', 'Three Wheeler', 'SUV', 'Lorry',
    ].map((v) => [v, v]),
    status: STATUSES.map((v) => [v, v]),
    is_active: [
      [true, 'Active'],
      [false, 'Inactive'],
    ],
  };
  const editing = Boolean(form[keys[table]]);
  const fields = technician
    ? ['status', 'repair_notes']
    : remote && table === 'users'
      ? editing ? ['is_active'] : ['name', 'email', 'password']
    : Object.keys(defaults[table]).filter(
        (k) => !['role', 'completed_date'].includes(k) && !(remote && table === 'jobs' && !editing && ['status', 'repair_notes', 'final_cost'].includes(k)),
      );
  function change(k, value) {
    setForm((prev) => ({
      ...prev,
      [k]: value,
      ...(k === 'technician_id' &&
      value &&
      prev.status === 'Pending'
        ? { status: 'Assigned' }
        : {}),
    }));
  }
async function submit(e) {
  e.preventDefault();
  if (busy) return;
  setBusy(true);
  setError('');
  setNotice('');
  try {
    const row = { ...form };
    // Text fields වල මුල සහ අග spaces ඉවත් කිරීම
    for (const field of [
      'name',
      'phone',
      'email',
      'address',
      'vehicle_number',
      'brand',
      'model',
      'problem_description',
      'repair_notes',
    ]) {
      if (typeof row[field] === 'string') {
        row[field] = row[field].trim();
      }
    }
    // Customer / Technician name
    if (table === 'customers' || table === 'users') {
      if (!row.name || row.name.length < 2) {
        throw new Error(
          'Please enter a name with at least 2 characters.',
        );
      }
      if (row.name.length > 100) {
        throw new Error(
          'Name must not exceed 100 characters.',
        );
      }
    }
    // Customer phone number
    if (table === 'customers') {
      if (!row.phone) {
        throw new Error('Phone number is required.');
      }
      // Spaces සහ hyphens සහිත numbers ද භාරගනී
      let phone = row.phone.replace(/[\s-]/g, '');
      // +94771234567 → 0771234567
      if (/^\+94[1-9]\d{8}$/.test(phone)) {
        phone = `0${phone.slice(3)}`;
      }
      // Local format: 0 වලින් පටන් ගන්නා digits 10
      if (!/^0[1-9]\d{8}$/.test(phone)) {
        throw new Error(
          'Enter a valid phone format: 0771234567 or +94771234567.',
        );
      }
      row.phone = phone;
    }
    // Customer / Technician email
    if (table === 'customers' || table === 'users') {
      if (!row.email) {
        throw new Error('Email address is required.');
      }
      if (!validEmail(row.email)) throw new Error('Enter a valid email address, for example name@gmail.com (maximum 150 characters).');
      row.email = row.email.toLowerCase();
    }
    // Customer address
    if (table === 'customers' && !row.address) {
      throw new Error('Customer address is required.');
    }
    // Vehicle details
    if (table === 'vehicles') {
      if (!row.vehicle_number) {
        throw new Error('Vehicle number is required.');
      }
      row.vehicle_number = row.vehicle_number.toUpperCase();
      if (!row.brand || !row.model) {
        throw new Error('Vehicle brand and model are required.');
      }
    }
    // Job description
    if (table === 'jobs' && !row.problem_description) {
      throw new Error('Problem description is required.');
    }
    // Numeric fields
    for (const field of [
      'customer_id',
      'vehicle_id',
      'technician_id',
      'manufacture_year',
      'estimated_cost',
      'final_cost',
    ]) {
      if (field in row) {
        row[field] =
          row[field] === '' || row[field] === null
            ? null
            : Number(row[field]);
        if (
          row[field] !== null &&
          !Number.isFinite(row[field])
        ) {
          throw new Error(
            `Please enter a valid value for ${label(field)}.`,
          );
        }
      }
    }
    // Manufacture year
    if (table === 'vehicles') {
      const currentYear = new Date().getFullYear();
      if (
        !Number.isInteger(row.manufacture_year) ||
        row.manufacture_year < 1950 ||
        row.manufacture_year > currentYear
      ) {
        throw new Error(
          `Manufacture year must be between 1950 and ${currentYear}.`,
        );
      }
    }
    if ('expected_date' in row) {
      row.expected_date = row.expected_date || null;
    }
    for (const field of ['estimated_cost', 'final_cost']) {
      if (row[field] != null && (row[field] < 0 || row[field] > 99999999.99)) throw new Error(`${label(field)} must be between 0 and 99,999,999.99.`);
    }
    if (row.expected_date && row.expected_date < row.received_date) throw new Error('Expected date cannot be before received date.');
    if (table === 'vehicles' && (row.vehicle_number.length > 30 || row.brand.length > 50 || row.model.length > 50)) throw new Error('Vehicle number: maximum 30 characters; brand/model: maximum 50.');
    if (table === 'customers' && row.address.length > 255) throw new Error('Address must not exceed 255 characters.');
    if (remote && table === 'users' && !editing && (!row.password || row.password.length < 6 || new TextEncoder().encode(row.password).length > 72)) throw new Error('Password must have at least 6 characters and at most 72 bytes.');
    if (table === 'jobs' && !technician && row.technician_id == null && ['Assigned', 'In Progress'].includes(row.status)) throw new Error('Choose a technician for this status.');
    if (technician && !['In Progress', 'Completed'].includes(row.status)) throw new Error('Choose In Progress or Completed.');
    await commit('save', table, row);
    setForm(blank());
    setNotice('Record saved successfully.');
  } catch (err) {
    setError(err.message);
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  } finally { setBusy(false); }
}
  async function remove(row) {
    if (busy || !window.confirm('Delete this record? Related vehicles/jobs must be removed first.')) return;
    setBusy(true);
    try {
      await commit('delete', table, row);
      setNotice('Record deleted.');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }
  const rows = data[table].filter(
    (r) =>
      (table !== 'users' || r.role === 'technician') &&
      (!technician || r.technician_id === user.user_id) &&
      (!filter || r.status === filter) &&
      JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );
  const columns = {
    customers: ['name', 'phone', 'email', 'address'],
    vehicles: [
      'vehicle_number',
      'customer_id',
      'vehicle_type',
      'brand',
      'model',
      'manufacture_year',
    ],
    users: ['name', 'email', 'is_active'],
    jobs: [
      'vehicle_id',
      'technician_id',
      'problem_description',
      'status',
      'received_date',
      'expected_date',
      'estimated_cost',
      'final_cost',
    ],
  }[table];
  function display(row, k) {
    if (k === 'status') return <Badge status={row[k]} />;
    if (k === 'is_active') return row[k] ? 'Active' : 'Inactive';
    if (k.endsWith('_cost')) return showCost(row[k]);
    if (k === 'technician_id') {
      return data.users.find(
        (u) => u.user_id === row[k],
      )?.name || 'Unassigned';
    }
    return (
      options[k]?.find(([v]) => v === row[k])?.[1] ??
      row[k] ??
      '—'
    );
  }
  return (
    <>
      <h1>
        {technician
          ? 'My Assigned Jobs'
          : table === 'users'
            ? 'Technician Management'
            : `${label(table)} Management`}
      </h1>
      <p className="muted">
        {technician
          ? 'Update your assigned repair jobs and notes.'
          : 'Manage your workshop records in one place.'}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      {(!technician || editing) && (
        <section className="card">
          <h2>{editing ? 'Edit record' : 'Add new record'}</h2>
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="record-fields">
            <div className="form-grid">
              {fields.map((k) => (
                <label key={k}>
                  {label(k)}
                  {options[k] ? (
                    <select
                      value={form[k] ?? ''}
                      required={[
                        'customer_id', 'vehicle_id', 'status',
                      ].includes(k)}
                      onChange={(e) =>
                        change(
                          k,
                          k === 'is_active'
                            ? e.target.value === 'true'
                            : e.target.value,
                        )
                      }
                    >
                      {![
                        'status', 'vehicle_type', 'is_active',
                      ].includes(k) && (
                        <option value="">
                          {k === 'technician_id'
                            ? 'Unassigned'
                            : 'Choose…'}
                        </option>
                      )}
                      {options[k]
                        .filter(
                          ([v]) =>
                            !technician ||
                            k !== 'status' ||
                            ['In Progress', 'Completed', form.status]
                              .includes(v),
                        )
                        .map(([v, t]) => (
                          <option key={String(v)} value={String(v)}>
                            {t}
                          </option>
                        ))}
                    </select>
                  ) : [
                      'problem_description', 'repair_notes', 'address',
                    ].includes(k) ? (
                    <textarea
                      rows="3"
                      value={form[k] ?? ''}
                      required={k === 'problem_description'}
                      onChange={(e) => change(k, e.target.value)}
                    />
                  ) : (
                    <input
                      value={form[k] ?? ''}
                      type={
                        k.endsWith('_date')
                          ? 'date'
                          : k.endsWith('_cost') ||
                              k === 'manufacture_year'
                            ? 'number'
                            : k === 'password' ? 'password' : k === 'email'
                              ? 'email'
                              : k === 'phone' ? 'tel' : 'text'
                      }
                      min={
                        k === 'manufacture_year'
                          ? 1950
                          : k.endsWith('_cost') ? 0 : undefined
                      }
                      max={
                        k === 'manufacture_year'
                          ? new Date().getFullYear()
                          : undefined
                      }
                      step={k.endsWith('_cost') ? '0.01' : undefined}
                      required={
                        ![
                          'estimated_cost',
                          'final_cost', 'expected_date',
                        ].includes(k) ||
                        (table === 'users' && k === 'email')
                      }
                      onChange={(e) => change(k, e.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="actions">
              <button disabled={busy}>{busy ? 'Saving…' : `Save ${editing ? 'changes' : 'record'}`}</button>
              {editing && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setForm(blank())}
                >
                  Cancel edit
                </button>
              )}
            </div>
            </fieldset>
          </form>
        </section>
      )}
      <section className="card">
        <div className="toolbar">
          <input
            aria-label="Search records"
            placeholder="Search records…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {table === 'jobs' && (
            <select
              aria-label="Filter status"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          <span>{rows.length} records</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((k) => <th key={k}>{label(k)}</th>)}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[keys[table]]}>
                  {columns.map((k) => (
                    <td key={k}>{display(row, k)}</td>
                  ))}
                  <td>
                    <div className="actions">
                      {(!technician ||
                        !['Completed', 'Cancelled'].includes(
                          row.status,
                        )) && (
                        <button
                          className="small secondary"
                          disabled={busy}
                          onClick={() => {
                            setForm({ ...row, ...(technician && row.status === 'Assigned' ? { status: 'In Progress' } : {}) });
                            setError('');
                            setNotice('');
                            window.scrollTo({
                              top: 0,
                              behavior: 'smooth',
                            });
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {!technician && table !== 'jobs' && !(remote && table === 'users') && (
                        <button
                          className="small danger"
                          disabled={busy}
                          onClick={() => remove(row)}
                        >
                          Delete
                        </button>
                      )}
                      {table === 'jobs' && (
                        <button
                          className="small secondary"
                          disabled={busy}
                          onClick={async () => {
                            setHistory(row.job_id); setHistoryError(''); setHistoryBusy(true);
                            try { await loadHistory(row.job_id); } catch (e) { setHistoryError(e.message); }
                            finally { setHistoryBusy(false); }
                          }}
                        >
                          History
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="empty">
              No records found.{' '}
              {technician
                ? 'Ask the admin to assign a job.'
                : 'Add a record above to get started.'}
            </p>
          )}
        </div>
      </section>
      {history !== null && (
        <section className="card">
          <div className="toolbar">
            <h2>Job #{history} — Status History</h2>
            <button
              className="secondary"
              onClick={() => setHistory(null)}
            >
              Close
            </button>
          </div>
          {historyBusy && <p role="status">Loading history…</p>}
          {historyError && <p role="alert" className="error">{historyError}</p>}
          {!historyBusy && !historyError && !data.job_status_history.some(h => h.job_id === history) && <p>No status history recorded.</p>}
          {data.job_status_history
            .filter((h) => h.job_id === history)
            .map((h) => (
              <p key={h.history_id}>
                <Badge status={h.status} /> {h.note || 'No note'}
                <small>
                  {' · '}
                  {h.updated_by_name || data.users.find(
                    (u) => u.user_id === h.updated_by,
                  )?.name || h.updated_by}
                  {' · '}
                  {new Date(h.updated_at).toLocaleString()}
                </small>
              </p>
            ))}
        </section>
      )}
    </>
  );
}
/* Dashboard */
function Dashboard({ data }) {
  const active = data.jobs.filter(
    (j) => !['Completed', 'Cancelled'].includes(j.status),
  ).length;
  const recent = [...data.jobs]
    .sort((a, b) => b.job_id - a.job_id)
    .slice(0, 5);
  const completedValue = data.jobs
    .filter((j) => j.status === 'Completed')
    .reduce((sum, j) => sum + Number(j.final_cost || 0), 0);
  const summary = [
    ['Customers', data.customers.length],
    ['Vehicles', data.vehicles.length],
    ['Active Jobs', active],
    ['Completed Job Value', money(completedValue)],
  ];
  return (
    <>
      <section className="welcome">
        <p className="eyebrow">YOUR WORKSHOP AT A GLANCE</p>
        <h1>Welcome to your workspace</h1>
        <p>
          Keep your customers, vehicles and repair jobs moving together.
        </p>
      </section>
      <div className="stats">
        {summary.map(([name, value]) => (
          <section className="card" key={name}>
            <p className="muted">{name}</p>
            <strong>{value}</strong>
          </section>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-title">
            <h2>Job status overview</h2>
            <span className="muted">
              {data.jobs.length} total jobs
            </span>
          </div>
          {STATUSES.map((status) => {
            const count = data.jobs.filter(
              (j) => j.status === status,
            ).length;
            const percentage = data.jobs.length
              ? (count / data.jobs.length) * 100
              : 0;
            return (
              <div className="status-row" key={status}>
                <Badge status={status} />
                <div className="status-track" aria-hidden="true">
                  <div
                    className="status-fill"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            );
          })}
        </section>
        <section className="card">
          <h2>Quick actions</h2>
          <p className="muted">
            Start with a customer, then add their vehicle and repair job.
          </p>
          {[
            ['Add a customer', '/customers'],
            ['Register a vehicle', '/vehicles'],
            ['Create a repair job', '/jobs'],
          ].map(([name, path]) => (
            <NavLink className="quick-link" key={path} to={path}>
              {name}
              <span aria-hidden="true">↗</span>
            </NavLink>
          ))}
        </section>
      </div>
      <section className="card">
        <div className="card-title">
          <h2>Recent repair jobs</h2>
          <NavLink to="/jobs">View all jobs →</NavLink>
        </div>
        {recent.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Vehicle</th>
                  <th>Problem description</th>
                  <th>Status</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((j) => (
                  <tr key={j.job_id}>
                    <td>#{j.job_id}</td>
                    <td>
                      {data.vehicles.find(
                        (v) => v.vehicle_id === j.vehicle_id,
                      )?.vehicle_number || '—'}
                    </td>
                    <td>{j.problem_description}</td>
                    <td><Badge status={j.status} /></td>
                    <td>{j.received_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            Your workshop starts here. Add a customer and vehicle,
            then create your first repair job.
          </p>
        )}
      </section>
    </>
  );
}
/* Selectable reports and printing */
function Reports({ data, loadHistory }) {
  const [reportType, setReportType] = useState('monthly');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [jobId, setJobId] = useState('');
  const [historyState, setHistoryState] = useState({ id: '', error: '', loading: false });
  useEffect(() => {
    if (reportType !== 'job' || !jobId) return;
    let active = true;
    setHistoryState({ id: jobId, error: '', loading: true });
    loadHistory(Number(jobId)).then(() => {
      if (active) setHistoryState({ id: jobId, error: '', loading: false });
    }).catch(e => { if (active) setHistoryState({ id: jobId, error: e.message, loading: false }); });
    return () => { active = false; };
  }, [jobId, reportType, loadHistory]);
  const monthlyJobs = month
    ? data.jobs.filter((job) => job.received_date?.startsWith(month))
    : [];
  const selectedJob = data.jobs.find(
    (job) => String(job.job_id) === jobId,
  );
  const vehicle = selectedJob
    ? data.vehicles.find(
        (item) => item.vehicle_id === selectedJob.vehicle_id,
      )
    : null;
  const customer = vehicle
    ? data.customers.find(
        (item) => item.customer_id === vehicle.customer_id,
      )
    : null;
  const technician = selectedJob
    ? data.users.find(
        (item) => item.user_id === selectedJob.technician_id,
      )
    : null;
  const completedJobs = monthlyJobs.filter(
    (job) => job.status === 'Completed',
  );
  const completedValue = completedJobs.reduce(
    (total, job) =>
      total + (hasCost(job.final_cost) ? Number(job.final_cost) : 0),
    0,
  );
  const missingCosts = completedJobs.filter(
    (job) => !hasCost(job.final_cost),
  ).length;
  const canPrint =
    reportType === 'monthly'
      ? Boolean(month) && monthlyJobs.length > 0
      : Boolean(selectedJob) && historyState.id === jobId && !historyState.loading && !historyState.error;
  const history = selectedJob
    ? data.job_status_history
        .filter((item) => item.job_id === selectedJob.job_id)
        .sort((a, b) =>
          String(a.updated_at).localeCompare(String(b.updated_at)),
        )
    : [];
  return (
    <div className="reports-page">
      <section className="card report-controls">
        <h1>Reports</h1>
        <p className="muted">
          Select a report, check the preview, then print or save as PDF.
        </p>
        <div className="report-filters">
          <label>
            Report Type
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="monthly">Monthly Summary Report</option>
              <option value="job">Individual Job Report</option>
            </select>
          </label>
          {reportType === 'monthly' ? (
            <label>
              Received Month
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
          ) : (
            <label>
              Select Job
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">Choose a job…</option>
                {[...data.jobs]
                  .sort((a, b) => b.job_id - a.job_id)
                  .map((job) => {
                    const jobVehicle = data.vehicles.find(
                      (item) => item.vehicle_id === job.vehicle_id,
                    );
                    return (
                      <option
                        key={job.job_id}
                        value={String(job.job_id)}
                      >
                        JOB-{job.job_id} —{' '}
                        {jobVehicle?.vehicle_number || 'Unknown vehicle'}
                        {' — '}
                        {job.problem_description}
                      </option>
                    );
                  })}
              </select>
            </label>
          )}
          <button
            type="button"
            disabled={!canPrint}
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </section>
      {reportType === 'job' && historyState.loading && <p role="status">Loading status history…</p>}
      {reportType === 'job' && historyState.error && <p role="alert" className="error">{historyState.error} Select the job again after checking the backend.</p>}
      <section className="card report-document">
        <div className="report-heading">
          <div>
            <p className="eyebrow">WORKSHOP PRO</p>
            <h2>
              {reportType === 'monthly'
                ? 'Monthly Summary Report'
                : 'Individual Job Report'}
            </h2>
          </div>
          <p className="muted">
            Generated: {new Date().toLocaleDateString('en-GB')}
          </p>
        </div>
        {reportType === 'monthly' ? (
          <>
            <p>
              <strong>Received month:</strong>{' '}
              {month || 'Please select a month'}
            </p>
            <div className="report-summary">
              <div>
                <span>Total Jobs</span>
                <strong>{monthlyJobs.length}</strong>
              </div>
              <div>
                <span>Completed Jobs</span>
                <strong>{completedJobs.length}</strong>
              </div>
              <div>
                <span>Completed Job Value</span>
                <strong>{money(completedValue)}</strong>
              </div>
            </div>
            <p className="muted">
              Includes jobs received in the selected month.
              Completed job value includes entered final costs only;
              it is not a payment receipt.
              {missingCosts > 0 &&
                ` ${missingCosts} completed job(s) have no final cost entered.`}
            </p>
            {monthlyJobs.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Vehicle</th>
                      <th>Problem Description</th>
                      <th>Status</th>
                      <th>Final Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyJobs.map((job) => (
                      <tr key={job.job_id}>
                        <td>JOB-{job.job_id}</td>
                        <td>
                          {data.vehicles.find(
                            (item) =>
                              item.vehicle_id === job.vehicle_id,
                          )?.vehicle_number || '—'}
                        </td>
                        <td>{job.problem_description}</td>
                        <td><Badge status={job.status} /></td>
                        <td>{showCost(job.final_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">
                {month
                  ? 'No jobs found for this month.'
                  : 'Select a month to preview its report.'}
              </p>
            )}
          </>
        ) : selectedJob ? (
          <>
            <div className="report-job-heading">
              <h2>JOB-{selectedJob.job_id}</h2>
              <Badge status={selectedJob.status} />
            </div>
            <div className="report-details">
              <div>
                <span>Customer</span>
                <strong>{customer?.name || '—'}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{customer?.phone || '—'}</strong>
              </div>
              <div>
                <span>Vehicle Number</span>
                <strong>{vehicle?.vehicle_number || '—'}</strong>
              </div>
              <div>
                <span>Vehicle</span>
                <strong>
                  {vehicle
                    ? `${vehicle.brand} ${vehicle.model} (${vehicle.vehicle_type})`
                    : '—'}
                </strong>
              </div>
              <div>
                <span>Assigned Technician</span>
                <strong>{technician?.name || 'Unassigned'}</strong>
              </div>
              <div>
                <span>Received Date</span>
                <strong>{selectedJob.received_date || '—'}</strong>
              </div>
              <div>
                <span>Expected Date</span>
                <strong>{selectedJob.expected_date || '—'}</strong>
              </div>
              <div>
                <span>Completed Date</span>
                <strong>{selectedJob.completed_date || '—'}</strong>
              </div>
            </div>
            <div className="report-text">
              <h3>Problem Description</h3>
              <p>{selectedJob.problem_description}</p>
            </div>
            <div className="report-text">
              <h3>Repair Notes</h3>
              <p>
                {selectedJob.repair_notes || 'No repair notes entered.'}
              </p>
            </div>
            <div className="report-summary">
              <div>
                <span>Estimated Cost</span>
                <strong>{showCost(selectedJob.estimated_cost)}</strong>
              </div>
              <div>
                <span>Final Cost</span>
                <strong>{showCost(selectedJob.final_cost)}</strong>
              </div>
            </div>
            {history.length > 0 && (
              <>
                <h3>Status History</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date / Time</th>
                        <th>Status</th>
                        <th>Note</th>
                        <th>Updated By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr key={item.history_id}>
                          <td>
                            {new Date(item.updated_at).toLocaleString(
                              'en-GB',
                            )}
                          </td>
                          <td>{item.status}</td>
                          <td>{item.note || '—'}</td>
                          <td>
                            {item.updated_by_name || data.users.find(
                              (u) => u.user_id === item.updated_by,
                            )?.name || item.updated_by}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="muted report-footer">
              Service job report — not a payment receipt.
            </p>
          </>
        ) : (
          <p className="empty">
            Select a job above to preview its report.
          </p>
        )}
      </section>
    </div>
  );
}
/* Main layout — authenticated API sessions only */
function Workspace() {
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      return saved?.token && saved?.user?.user_id && ['admin', 'technician'].includes(saved.user.role) ? saved : null;
    } catch { return null; }
  });
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(Boolean(session));
  const [loadError, setLoadError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const navigate = useNavigate();
  const requestGeneration = useRef(0);
  const user = session?.user;
  const admin = user?.role === 'admin';

  const logout = useCallback(() => {
    requestGeneration.current++;
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null); setData(emptyData()); setLoadError(''); setLoading(false);
    navigate('/login');
  }, [navigate]);

  const authorized = useCallback(async (path, options = {}) => {
    try { return await api(path, { ...options, token: session?.token }); }
    catch (error) {
      if (error.expired) { logout(); setAuthNotice('Your session expired or account is inactive. Please log in again.'); }
      throw error;
    }
  }, [session?.token, logout]);

  const refresh = useCallback(async (signal) => {
    if (!session) return;
    const generation = ++requestGeneration.current;
    setLoading(true); setLoadError('');
    try {
      const [customers, vehicles, jobs, technicians] = await Promise.all([
        authorized('/customers', { signal }), authorized('/vehicles', { signal }),
        authorized('/jobs', { signal }), session.user.role === 'admin'
          ? authorized('/users/technicians', { signal }) : Promise.resolve({ technicians: [] }),
      ]);
      if (signal?.aborted || generation !== requestGeneration.current) return;
      setData({ customers: customers.customers, vehicles: vehicles.vehicles,
        jobs: jobs.jobs.filter(j => session.user.role === 'admin' || Number(j.technician_id) === Number(session.user.user_id)),
        users: [session.user, ...technicians.technicians.map(u => ({ ...u, is_active: Boolean(Number(u.is_active)) }))],
        job_status_history: [],
      });
    } catch (error) {
      if (!signal?.aborted && generation === requestGeneration.current) setLoadError(error.message);
    } finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [session, authorized]);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const loadHistory = useCallback(async (id) => {
    if (!session) return;
    const generation = requestGeneration.current;
    const result = await authorized(`/jobs/${id}/history`);
    if (generation !== requestGeneration.current) return;
    setData(previous => ({ ...previous, job_status_history: [
      ...previous.job_status_history.filter(h => h.job_id !== id), ...result.history,
    ] }));
  }, [session, authorized]);

  function login(result) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
    setAuthNotice(''); setData(emptyData()); setLoading(true); setSession(result);
    navigate(result.user.role === 'admin' ? '/dashboard' : '/technician-dashboard');
  }
  async function commit(action, table, row) {
    const id = row[keys[table]];
    if (action === 'delete') {
      if (table === 'customers' && data.vehicles.some(v => v.customer_id === id)) throw new Error('This customer has vehicles. Delete is blocked to preserve related jobs.');
      if (table === 'vehicles' && data.jobs.some(j => j.vehicle_id === id)) throw new Error('This vehicle has jobs. Delete is blocked to preserve job history.');
      await authorized(`/${table}/${id}`, { method: 'DELETE' });
    } else if (table === 'users') {
      await authorized(id ? `/users/technicians/${id}/status` : '/users/technicians', {
        method: id ? 'PATCH' : 'POST', body: id ? { is_active: row.is_active } : { name: row.name, email: row.email, password: row.password },
      });
    } else if (table === 'jobs' && !admin) {
      await authorized(`/jobs/${id}/status`, { method: 'PATCH', body: { status: row.status, repair_notes: row.repair_notes } });
    } else {
      const allowed = table === 'jobs'
        ? id ? Object.keys(defaults.jobs) : ['vehicle_id', 'technician_id', 'problem_description', 'received_date', 'expected_date', 'estimated_cost']
        : Object.keys(defaults[table]);
      const body = Object.fromEntries(allowed.map(k => [k, row[k] ?? null]));
      if (table === 'jobs' && id) body.completed_date = row.status === 'Completed' ? row.completed_date || today() : null;
      await authorized(`/${table}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body });
    }
    // A saved write is never repeated automatically if the following refresh fails.
    await refresh();
  }
  if (!user) return <>
    {authNotice && <p className="error" role="alert">{authNotice}</p>}
    <Routes>
      <Route path="/login" element={<Auth onLogin={login} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </>;

  const menus = admin
    ? [
        ['Dashboard', '/dashboard'],
        ['Customers', '/customers'],
        ['Vehicles', '/vehicles'],
        ['Jobs', '/jobs'],
        ['Technicians', '/technicians'],
        ['Manage Admins', '/admins'],
        ['Reports', '/reports'],
      ]
    : [['My Jobs', '/technician-dashboard']];
  return (
    <div className="shell">
      <aside>
<div className="sidebar-brand"><span className="sidebar-mark" aria-hidden="true">W</span><div><h2>Workshop Pro</h2><p>VEHICLE SERVICE MANAGEMENT</p></div></div>
        <nav>
          {menus.map(([name, path]) => (
            <NavLink key={path} to={path}>{name}</NavLink>
          ))}
        </nav>
        <button className="secondary" onClick={logout}>
          Logout
        </button>
      </aside>
      <div className="workspace">
        <header>
          <span>{user.name} · {user.role}</span>
          <span><span className="connection-dot"/> Connected to workshop database</span>
        </header>
        <div className="connection-banner">Your workshop records are securely managed through the backend.</div>
        <main>
          <div className="actions refresh-controls"><button className="secondary" disabled={loading} onClick={() => refresh()}>Refresh records</button></div>
          {loading ? <p role="status">Loading workshop records…</p> : loadError ? <p className="error" role="alert">{loadError} Use Refresh records to retry.</p> : <Routes>
            {admin && (
              <>
                <Route
                  path="/dashboard"
                  element={<Dashboard data={data} />}
                />
                {[
                  ['customers', 'customers'],
                  ['vehicles', 'vehicles'],
                  ['jobs', 'jobs'],
                  ['technicians', 'users'],
                ].map(([path, table]) => (
                  <Route
                    key={path}
                    path={`/${path}`}
                    element={
                      <Management
                        key={table}
                        table={table}
                        data={data}
                        user={user}
                        commit={commit} remote loadHistory={loadHistory}
                      />
                    }
                  />
                ))}
                <Route path="/admins" element={<AdminManagement request={authorized} currentUser={user} />} />
                <Route
                  path="/reports"
                  element={<Reports data={data} loadHistory={loadHistory} />}
                />
              </>
            )}
            {!admin && (
              <Route
                path="/technician-dashboard"
                element={
                  <Management
                    table="jobs"
                    data={data}
                    user={user}
                    commit={commit} remote loadHistory={loadHistory}
                    technician
                  />
                }
              />
            )}
            <Route
              path="*"
              element={
                <Navigate
                  to={admin ? '/dashboard' : '/technician-dashboard'}
                  replace
                />
              }
            />
          </Routes>}
        </main>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Workspace />
    </BrowserRouter>
  );
}
