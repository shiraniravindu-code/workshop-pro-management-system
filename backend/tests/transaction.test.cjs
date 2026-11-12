const test = require('node:test');
const assert = require('node:assert/strict');
const dbPath = require.resolve('../src/config/db.js');
const mockPool = { getConnection: async () => { throw new Error('configure test connection'); } };
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockPool };
const { createJob, updateJob, updateJobStatus } = require('../src/controllers/jobController.js');
const { deleteCustomer } = require('../src/controllers/customerController.js');
const { deleteVehicle } = require('../src/controllers/vehicleController.js');
function setup(handler) {
  const events = [];
  const con = {
    beginTransaction: async () => { events.push('begin'); },
    commit: async () => { events.push('commit'); },
    rollback: async () => { events.push('rollback'); },
    release: () => { events.push('release'); },
    execute: async (sql, params) => { events.push({sql, params}); return handler(sql, params); },
  };
  mockPool.getConnection = async () => con;
  return events;
}
async function call(fn, body, user={userId:1,role:'admin'}, id='1') {
  const result = { status: 200 };
  const response = {
    status(code) { result.status=code; return this; },
    json(data) { result.body=data; return this; },
  };
  await fn({ body, user, params: { id } }, response);
  return result;
}
const createBody = { vehicle_id:3, technician_id:null, problem_description:'Engine issue', received_date:'2026-11-05' };
const updateBody = { ...createBody, technician_id:2, status:'Completed', completed_date:null };
test('createJob saves first history row and commits exactly once', async () => {
  const events = setup(sql => {
    if (sql.includes('SELECT vehicle_id')) return [[{vehicle_id:3}]];
    if (sql.includes('INSERT INTO jobs')) return [{insertId:34}];
    if (sql.includes('INSERT INTO job_status_history')) return [{insertId:45}];
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const res = await call(createJob,createBody);
  assert.equal(res.status,201);
  assert.equal(res.body.job.status,'Pending');
  const history = events.find(e=>typeof e==='object'&&e.sql.includes('INSERT INTO job_status_history'));
  assert.deepEqual(history.params,[34,'Pending',null,1]);
  const insert = events.find(e=>typeof e==='object'&&e.sql.includes('INSERT INTO jobs'));
  assert.equal(insert.params.at(-1), null);
  assert.equal(events.filter(e=>e==='commit').length,1);
  assert.equal(events.at(-1),'release');
});
test('createJob rolls back if initial history insertion fails', async () => {
  const events = setup(sql => {
    if (sql.includes('SELECT vehicle_id')) return [[{vehicle_id:3}]];
    if (sql.includes('INSERT INTO jobs')) return [{insertId:34}];
    if (sql.includes('INSERT INTO job_status_history')) throw new Error('Simulated DB error');
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const original = console.error; console.error = ()=>{};
  let res;
  try { res=await call(createJob,createBody); } finally { console.error=original; }
  assert.equal(res.status,500);
  assert.ok(events.includes('rollback'));
  assert.ok(!events.includes('commit'));
});
test('updateJob saves status change and history in one transaction', async () => {
  const events = setup(sql => {
    if (sql.includes('FROM jobs WHERE job_id')) return [[{job_id:4,technician_id:2,status:'Assigned',completed_date:null}]];
    if (sql.includes('SELECT vehicle_id')) return [[{vehicle_id:3}]];
    if (sql.includes('FROM users')) return [[{user_id:2}]];
    if (sql.includes('UPDATE jobs')) return [{affectedRows:1}];
    if (sql.includes('INSERT INTO job_status_history')) return [{insertId:2}];
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const res=await call(updateJob,updateBody,{userId:1,role:'admin'},'4');
  assert.equal(res.status,200);
  assert.ok(events.some(e=>typeof e==='object' && e.sql.includes('FOR UPDATE')));
  assert.ok(events.some(e=>typeof e==='object' && e.sql.includes('INSERT INTO job_status_history')));
  assert.ok(events.includes('commit'));
});
test('createJob rejects an expected date before the received date', async () => {
  const res = await call(createJob, { ...createBody, expected_date:'2026-11-04' });
  assert.equal(res.status,400);
  assert.match(res.body.message,/Expected date/i);
});
test('updateJob requires a technician for an assigned or active status', async () => {
  const res = await call(updateJob, { ...createBody, status:'Assigned' });
  assert.equal(res.status,400);
  assert.match(res.body.message,/technician/i);
});
test('unassigned technician cannot change a job and triggers rollback', async () => {
  const events = setup(sql => {
    if (sql.includes('FROM jobs')) return [[{job_id:4,technician_id:9,status:'Assigned',completed_date:null}]];
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const res=await call(updateJobStatus,{status:'In Progress'},{userId:8,role:'technician'},'4');
  assert.equal(res.status,403);
  assert.ok(events.includes('rollback'));
  assert.ok(!events.includes('commit'));
});
for (const [name,fn,table] of [['customer',deleteCustomer,'vehicles'], ['vehicle',deleteVehicle,'jobs']]) {
  test(`${name} delete is blocked if related ${table} exist`, async () => {
    const events = setup(sql=> {
      if (sql.includes('FOR UPDATE')) return [[{id:1}]];
      if (sql.includes(`FROM ${table}`)) return [[{exists:1}]];
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const res = await call(fn, {}, {userId:1,role:'admin'},'1');
    assert.equal(res.status,409);
    assert.ok(events.includes('rollback'));
    assert.ok(!events.some(e=>typeof e==='object' && e.sql.includes('DELETE FROM')));
  });
}
