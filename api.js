/**
 * API abstraction layer.
 * Currently uses localStorage (via storage.js) but can be swapped
 * to a real backend (REST/GraphQL) without changing UI code.
 */
import { db, persist } from './utils/storage.js';

export const api = {
  // Users
  getUsers: () => db.users,
  getUserById: id => db.users.find(u => u.id === id),
  createUser: user => { db.users.push(user); persist(); },

  // Reservations
  getReservations: () => db.reservations,
  getReservationById: id => db.reservations.find(r => r.id === id),
  createReservation: res => { db.reservations.push(res); persist(); },
  updateReservation: (id, updates) => {
    const r = db.reservations.find(x => x.id === id);
    if (r) { Object.assign(r, updates); persist(); }
  },

  // Sessions
  getSessions: () => db.sessions,
  createSession: sess => { db.sessions.push(sess); persist(); },

  // Rooms
  getRooms: () => db.rooms,
  updateRoom: (id, updates) => {
    const r = db.rooms.find(x => x.id === id);
    if (r) { Object.assign(r, updates); persist(); }
  },
};