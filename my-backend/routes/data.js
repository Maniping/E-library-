const express = require("express");
const { requirePool } = require("../db");
const { createInitialState } = require("../store");
const { authenticate } = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate);

function userFromProfile(profile) {
  return {
    id: profile.student_id,
    authUserId: profile.id,
    name: profile.full_name,
    role: profile.role?.toLowerCase(),
    email: profile.email,
    section: profile.section || "",
    dept: profile.dept || "",
    bio: profile.bio || "",
    image: profile.image || null,
    qrData: profile.qr_data || `E-LIBRARY-${profile.role?.toUpperCase()}-${profile.student_id}`,
  };
}

async function getStoredState(client) {
  const { rows } = await client.query("SELECT state FROM public.app_state WHERE id = 1");
  if (rows.length) return rows[0].state;

  const state = createInitialState();
  await client.query(
    "INSERT INTO public.app_state (id, state) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING",
    [JSON.stringify(state)]
  );
  return state;
}

router.get("/", async (req, res, next) => {
  const client = await requirePool().connect();
  try {
    const state = await getStoredState(client);
    const { rows: roomRows } = await client.query(
      "SELECT id, name, type, capacity, capacity_min AS \"capacityMin\", capacity_max AS \"capacityMax\", status, location FROM public.rooms ORDER BY id"
    );
    const rooms = roomRows.length ? roomRows : state.rooms;
    const isAdmin = req.profile.role === "Admin";
    const { rows: profiles } = await client.query(
      `SELECT id, full_name, role, student_id, email, section, dept, bio, image, qr_data
         FROM public.profiles ${isAdmin ? "" : "WHERE id = $1"}
         ORDER BY student_id`,
      isAdmin ? [] : [req.profile.id]
    );
    const users = profiles.map(userFromProfile);
    const reservations = isAdmin
      ? state.reservations
      : state.reservations.map((reservation) =>
          reservation.filedById === req.profile.student_id
            ? reservation
            : {
                id: reservation.id,
                roomId: reservation.roomId,
                useDate: reservation.useDate,
                useTime: reservation.useTime,
                status: reservation.status,
              }
        );

    return res.json({
      ...state,
      users,
      rooms,
      reservations,
      registry: isAdmin
        ? state.registry
        : {
            [req.profile.student_id]: {
              name: req.profile.full_name,
              section: req.profile.section,
              dept: req.profile.dept,
              email: req.profile.email,
            },
          },
      sessions: isAdmin ? state.sessions : [],
      checkins: isAdmin ? state.checkins : [],
      draft: null,
    });
  } catch (error) {
    return next(error);
  } finally {
    client.release();
  }
});

router.put("/", async (req, res, next) => {
  if (req.profile.role !== "Admin") {
    return res.status(403).json({ error: "Administrator access is required to save shared library data." });
  }
  const input = req.body;
  if (!input || !Array.isArray(input.rooms) || !Array.isArray(input.reservations) ||
      !Array.isArray(input.sessions) || !Array.isArray(input.checkins) ||
      !input.registry || typeof input.registry !== "object" || Array.isArray(input.registry)) {
    return res.status(400).json({ error: "The library data snapshot is incomplete or invalid." });
  }

  const pool = requirePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const state = {
      rooms: input.rooms,
      reservations: input.reservations,
      sessions: input.sessions,
      checkins: input.checkins,
      registry: input.registry,
      nextResId: Number.isInteger(input.nextResId) ? input.nextResId : 1,
      nextSessionId: Number.isInteger(input.nextSessionId) ? input.nextSessionId : 1,
      draft: null,
    };

    for (const room of state.rooms) {
      await client.query(
        `INSERT INTO public.rooms (id, name, type, capacity, capacity_min, capacity_max, status, location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type,
           capacity=EXCLUDED.capacity, capacity_min=EXCLUDED.capacity_min,
           capacity_max=EXCLUDED.capacity_max, status=EXCLUDED.status, location=EXCLUDED.location`,
        [room.id, room.name, room.type, room.capacity, room.capacityMin, room.capacityMax, room.status, room.location || ""]
      );
    }

    await client.query("DELETE FROM public.reservations WHERE legacy_id IS NOT NULL");
    for (const reservation of state.reservations) {
      const { rows: ownerRows } = await client.query(
        "SELECT id FROM public.profiles WHERE student_id = $1",
        [String(reservation.filedById)]
      );
      if (!ownerRows.length) {
        throw Object.assign(new Error(`No account exists for reservation owner ${reservation.filedById}.`), { status: 400 });
      }
      await insertReservation(client, reservation, ownerRows[0].id);
    }
    await client.query(
      `INSERT INTO public.app_state (id, state, updated_at) VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state, updated_at=now()`,
      [JSON.stringify(state)]
    );
    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

async function insertReservation(client, reservation, userId) {
  await client.query(
    `INSERT INTO public.reservations
       (user_id, reservation_date, status, pc_number, legacy_id, room_id, room_name, room_type,
        date_filed, use_date, use_time, participants, contact, purpose, members, remarks,
        checked_in, qr_data, payload)
     VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14::jsonb, $15, $16, $17, $18::jsonb)`,
    [
      userId,
      reservation.status,
      reservation.roomId,
      String(reservation.id),
      reservation.roomId,
      reservation.roomName,
      reservation.roomType,
      reservation.dateFiled || null,
      reservation.useDate,
      reservation.useTime,
      reservation.participants,
      reservation.contact || "",
      reservation.purpose || "",
      JSON.stringify(reservation.members || []),
      reservation.remarks || "",
      Boolean(reservation.checkedIn),
      reservation.qrData || "",
      JSON.stringify(reservation),
    ]
  );
}

module.exports = router;
module.exports.getStoredState = getStoredState;
module.exports.insertReservation = insertReservation;
