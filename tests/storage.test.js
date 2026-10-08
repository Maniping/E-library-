import { test } from 'node:test';
import assert from 'node:assert/strict';

global.localStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, value) { this._data[key] = String(value); },
  removeItem(key) { delete this._data[key]; },
  clear() { this._data = {}; },
};
global.sessionStorage = {
  getItem() { return null; },
};
global.window = {};

test('new library data starts without demo users or reservations', async () => {
  localStorage.clear();
  const storage = await import('../src/js/utils/storage.js');
  storage.loadDB();

  assert.deepEqual(storage.db.users, []);
  assert.deepEqual(storage.db.reservations, []);
  assert.equal(storage.db.rooms.length, 20);
});

test('local cache round-trips profiles without password fields', async () => {
  localStorage.clear();
  const storage = await import('../src/js/utils/storage.js');
  storage.loadDB();
  storage.db.users.push({ id: 'EMP-01', name: 'Test User', role: 'admin' });
  await storage.persist({ sync: false });

  const parsed = JSON.parse(localStorage.getItem('uv_arc_db_v14'));
  assert.ok(parsed.users.some(user => user.id === 'EMP-01'));
  assert.equal('password' in parsed.users[0], false);
});

test('unauthenticated startup ignores cached data from an earlier session', async () => {
  localStorage.clear();
  const storage = await import('../src/js/utils/storage.js');
  localStorage.setItem('uv_arc_db_v14', JSON.stringify({
    ...storage.defaultDB,
    users: [{ id: 'PRIVATE', name: 'Private User', role: 'admin' }],
  }));

  await storage.hydrateDB();

  assert.deepEqual(storage.db.users, []);
});

test('hydrated state does not mutate the default snapshot', async () => {
  localStorage.clear();
  const storage = await import('../src/js/utils/storage.js');

  await storage.hydrateDB();
  storage.db.rooms[0].name = 'Changed PC';
  storage.db.users.push({ id: 'TEMP', name: 'Temporary User', role: 'admin' });

  assert.equal(storage.defaultDB.rooms[0].name, 'PC 1');
  assert.deepEqual(storage.defaultDB.users, []);
});

test('malformed snapshots fall back to empty live data', async () => {
  localStorage.clear();
  const storage = await import('../src/js/utils/storage.js');
  localStorage.clear();
  localStorage.setItem('uv_arc_db_v14', JSON.stringify({
    ...storage.defaultDB,
    users: [null],
  }));

  storage.loadDB();

  assert.deepEqual(storage.db.users, []);
  assert.deepEqual(storage.db.reservations, []);
});

test('valid snapshots with optional fields omitted are normalized', async () => {
  localStorage.clear();
  const storage = await import('../src/js/utils/storage.js');
  localStorage.clear();
  const snapshot = JSON.parse(JSON.stringify(storage.defaultDB));
  delete snapshot.sessions;
  delete snapshot.checkins;
  delete snapshot.nextSessionId;
  localStorage.setItem('uv_arc_db_v14', JSON.stringify(snapshot));

  storage.loadDB();

  assert.deepEqual(storage.db.sessions, []);
  assert.deepEqual(storage.db.checkins, []);
  assert.equal(storage.db.nextSessionId, 1);
});

test('persist reports local storage failures', async () => {
  localStorage.clear();
  const storage = await import('../src/js/utils/storage.js');
  storage.loadDB();
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Quota exceeded'); };

  try {
    await assert.rejects(storage.persist(), /Could not save your changes/);
  } finally {
    localStorage.setItem = originalSetItem;
  }
});
