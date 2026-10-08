/**
 * API abstraction layer.
 * Prefer the live backend when it is available and gracefully fall back
 * to the browser's local storage cache for offline access.
 */
import { API_BASE, db, persist } from '../js/utils/storage.js';

const ACCESS_TOKEN_KEY = 'uv_arc_access_token';

function accessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

async function requestJson(path, { method = 'GET', body } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      ...headers,
      ...(accessToken() ? { Authorization: `Bearer ${accessToken()}` } : {}),
    },
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

  async login(id, password) {
    const result = await requestJson('/api/auth/login', {
      method: 'POST',
      body: { id, password },
    });
    sessionStorage.setItem(ACCESS_TOKEN_KEY, result.access_token);
    sessionStorage.setItem('uv_arc_user_id', result.profile.student_id);
    return {
      id: result.profile.student_id,
      authUserId: result.profile.id,
      name: result.profile.full_name,
      role: result.profile.role.toLowerCase(),
      email: result.profile.email,
      section: result.profile.section || '',
      dept: result.profile.dept || '',
      bio: result.profile.bio || '',
      image: result.profile.image || null,
      qrData: result.profile.qr_data || '',
    };
  },

  logout() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem('uv_arc_user_id');
  },

  async updatePassword(password) {
    return requestJson('/api/auth/password', { method: 'PUT', body: { password } });
  },

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
    return requestJson('/api/users', { method: 'POST', body: user });
  },

  async updateUser(id, updates) {
    return requestJson(`/api/users/${encodeURIComponent(id)}`, { method: 'PUT', body: updates });
  },

  async changePassword(password, currentPassword) {
    return requestJson('/api/auth/password', { method: 'PUT', body: { password, currentPassword } });
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
    return requestJson('/api/reservations', { method: 'POST', body: reservation });
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