/**
 * API abstraction layer.
 * Prefer the live backend when it is available and gracefully fall back
 * to the browser's local storage implementation for offline/demo use.
 */
import { db, persist } from './utils/storage.js';

const API_BASE = 'http://localhost:5000';

async function requestJson(path, { method = 'GET', body } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.text();
    const requestError = new Error(error || 'Request failed');
    requestError.status = response.status;
    throw requestError;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function localFallback(method, entity, id, payload) {
  switch (method) {
    case 'list':
      return db[entity];
    case 'get':
      return db[entity].find(item => item.id === id || item.id === String(id));
    case 'create':
      db[entity].push(payload);
      persist();
      return payload;
    case 'update': {
      const item = db[entity].find(entry => entry.id === id || entry.id === String(id));
      if (!item) return null;
      Object.assign(item, payload);
      persist();
      return item;
    }
    default:
      return null;
  }
}

export const api = {
  baseUrl: API_BASE,

  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE}/health`, { method: 'GET' });
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  async getUsers() {
    try {
      return await requestJson('/api/users');
    } catch (error) {
      if (error.status) throw error;
      return localFallback('list', 'users');
    }
  },

  async getUserById(id) {
    try {
      return await requestJson(`/api/users/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error.status) {
        if (error.status === 404 && typeof window !== 'undefined' && typeof window.navigateTo === 'function') {
          window.navigateTo('notfound');
        }
        throw error;
      }
      return localFallback('get', 'users', id);
    }
  },

  async createUser(user) {
    try {
      const created = await requestJson('/api/users', { method: 'POST', body: user });
      if (created) return created;
    } catch (error) {
      if (error.status) throw error;
    }

    const payload = { ...user, id: user.id || `USER-${Date.now()}` };
    return localFallback('create', 'users', null, payload);
  },

  async getReservations() {
    try {
      return db.reservations;
    } catch (error) {
      return localFallback('list', 'reservations');
    }
  },

  async getReservationById(id) {
    return localFallback('get', 'reservations', id);
  },

  async createReservation(reservation) {
    const payload = { ...reservation };
    db.reservations.push(payload);
    persist();
    return payload;
  },

  async updateReservation(id, updates) {
    return localFallback('update', 'reservations', id, updates);
  },

  getSessions: () => db.sessions,
  createSession: sess => {
    db.sessions.push(sess);
    persist();
    return sess;
  },

  getRooms: () => db.rooms,
  updateRoom: (id, updates) => {
    const room = db.rooms.find(entry => entry.id === id || entry.id === String(id));
    if (!room) return null;
    Object.assign(room, updates);
    persist();
    return room;
  },
};

if (typeof window !== 'undefined') {
  window.uvArcApi = api;
}