import { test } from 'node:test';
import assert from 'node:assert';

// Mock localStorage for Node environment
global.localStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, value) { this._data[key] = String(value); },
  removeItem(key) { delete this._data[key]; },
  clear() { this._data = {}; },
};
global.window = {};

test('DB load/save roundtrip', async () => {
  const storage = await import('../src/js/utils/storage.js');
  storage.loadDB();
  const db = storage.db;
  db.users.push({ id: 'TEST-001', password: 'test', name: 'Test User', role: 'student' });
  storage.persist();
  const raw = localStorage.getItem('uv_arc_db_v13');
  assert.ok(raw);
  const parsed = JSON.parse(raw);
  assert.ok(parsed.users.some(u => u.id === 'TEST-001'));
});

test('DB falls back to demo accounts when stored data is from an unrelated backend', async () => {
  const storage = await import('../src/js/utils/storage.js');
  localStorage.setItem('uv_arc_db_v13', JSON.stringify({
    users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
    rooms: [],
    reservations: [],
    registry: {},
    checkins: [],
    sessions: [],
    nextResId: 2,
    nextSessionId: 1,
    draft: null,
  }));

  storage.loadDB();

  assert.ok(storage.db.users.some(u => u.id === '2023-00123'));
  assert.ok(storage.db.users.some(u => u.id === 'F-1024'));
  assert.ok(storage.db.users.some(u => u.id === 'A-001'));
});

test('DB keeps a valid local snapshot instead of replacing it with backend data', async () => {
  const storage = await import('../src/js/utils/storage.js');
  const originalFetch = global.fetch;
  let fetched = false;

  localStorage.clear();
  storage.loadDB();
  storage.db.reservations.push({
    ...storage.defaultDB.reservations[0],
    id: 'LOCAL-TEST',
    filedById: '2023-00123',
  });
  storage.persist();
  global.fetch = async () => {
    fetched = true;
    throw new Error('Backend should not be queried when local data exists');
  };

  try {
    await storage.hydrateDB();
    assert.equal(fetched, false);
    assert.ok(storage.db.reservations.some(r => r.id === 'LOCAL-TEST'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('DB rejects snapshots containing invalid records and restores demo data', async () => {
  const storage = await import('../src/js/utils/storage.js');
  localStorage.clear();
  const snapshot = JSON.parse(JSON.stringify(storage.defaultDB));
  snapshot.users.push(null);
  localStorage.setItem('uv_arc_db_v13', JSON.stringify(snapshot));

  storage.loadDB();

  assert.ok(storage.db.users.every(user => user && typeof user.id === 'string'));
  assert.ok(storage.db.users.some(user => user.id === '2023-00123'));
});

test('DB normalizes older valid snapshots with omitted optional fields', async () => {
  const storage = await import('../src/js/utils/storage.js');
  localStorage.clear();
  const snapshot = JSON.parse(JSON.stringify(storage.defaultDB));
  delete snapshot.sessions;
  delete snapshot.checkins;
  delete snapshot.nextSessionId;
  localStorage.setItem('uv_arc_db_v13', JSON.stringify(snapshot));

  storage.loadDB();

  assert.deepEqual(storage.db.sessions, []);
  assert.deepEqual(storage.db.checkins, []);
  assert.equal(storage.db.nextSessionId, 1);
});

test('persist reports local storage failures instead of silently succeeding', async () => {
  const storage = await import('../src/js/utils/storage.js');
  storage.loadDB();
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Quota exceeded'); };

  try {
    assert.throws(() => storage.persist(), /Could not save your changes/);
  } finally {
    localStorage.setItem = originalSetItem;
  }
});
