const express = require("express");
const { randomUUID } = require("node:crypto");
const { requirePool } = require("../db");
const { authenticate } = require("../middleware/authenticate");
const { getStoredState, insertReservation } = require("./data");

const router = express.Router();
router.use(authenticate);

router.post("/", async (req, res, next) => {
  const input = req.body || {};
  if (
    typeof input.roomId !== "string" ||
    typeof input.useDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.useDate) ||
    typeof input.useTime !== "string" ||
    !/^\d{2}:\d{2}$/.test(input.useTime) ||
    !Number.isInteger(input.participants) || input.participants < 1 ||
    !Array.isArray(input.members) ||
    !input.members.length ||
    !input.members.every((member) => typeof member?.name === "string" && member.name.trim())
  ) {
    return res.status(400).json({ error: "Reservation details are incomplete or invalid." });
  }

  const client = await requirePool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT state FROM public.app_state WHERE id=1 FOR UPDATE");
    const state = rows[0]?.state || await getStoredState(client);
    const conflict = state.reservations.some((reservation) =>
      reservation.roomId === input.roomId &&
      reservation.useDate === input.useDate &&
      reservation.status !== "cancelled" &&
      Math.abs(timeToMinutes(reservation.useTime) - timeToMinutes(input.useTime)) < 90
    );
    if (conflict) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "PC already reserved for this time." });
    }

    const id = `RES-${new Date().getUTCFullYear()}-${String(state.nextResId || 1).padStart(3, "0")}`;
    const reservation = {
      ...input,
      id,
      filedBy: req.profile.full_name,
      filedById: req.profile.student_id,
      dept: req.profile.dept || req.profile.section || "—",
      dateFiled: new Date().toISOString().slice(0, 10),
      status: "pending",
      remarks: "",
      checkedIn: false,
      qrData: `E-LIBRARY-RES-${randomUUID()}`,
    };
    const room = state.rooms.find((item) => item.id === reservation.roomId);
    if (!room) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "The selected PC does not exist." });
    }
    if (room.status !== "available" || reservation.participants < room.capacityMin || reservation.participants > room.capacityMax) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "The selected PC is unavailable or the participant count is invalid." });
    }
    reservation.roomName = room.name;
    reservation.roomType = room.type;
    await insertReservation(client, reservation, req.profile.id);
    state.reservations.push(reservation);
    state.nextResId = (state.nextResId || 1) + 1;
    await client.query(
      `INSERT INTO public.app_state (id, state, updated_at) VALUES (1,$1::jsonb,now())
       ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state, updated_at=now()`,
      [JSON.stringify(state)]
    );
    await client.query("COMMIT");
    return res.status(201).json(reservation);
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

function timeToMinutes(value = "") {
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : NaN;
}

module.exports = router;
