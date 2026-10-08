const express = require("express");
const { query } = require("../db");
const { authenticate } = require("../middleware/authenticate");
const { createAuthUser, getProfile } = require("../supabase-auth");

const router = express.Router();
router.use(authenticate);

function toUser(profile) {
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
    qrData: profile.qr_data || "",
  };
}

router.get("/", async (req, res, next) => {
  try {
    if (req.profile.role !== "Admin") return res.json([toUser(req.profile)]);
    const { rows } = await query(
      `SELECT id, full_name, role, student_id, email, section, dept, bio, image, qr_data
         FROM public.profiles ORDER BY student_id`
    );
    return res.json(rows.map(toUser));
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  if (req.profile.role !== "Admin" && req.profile.student_id !== req.params.id) {
    return res.status(403).json({ error: "You can only view your own account." });
  }
  try {
    const profile = await getProfileByStudentId(req.params.id);
    if (!profile) return res.status(404).json({ error: "User not found." });
    return res.json(toUser(profile));
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  if (req.profile.role !== "Admin") {
    return res.status(403).json({ error: "Administrator access is required to create accounts." });
  }
  const { id, email, password, name, role, section = "", dept = "" } = req.body || {};
  if ([id, email, password, name].some((value) => typeof value !== "string" || !value.trim())) {
    return res.status(400).json({ error: "ID, email, name, and password are required." });
  }
  const normalizedRole = typeof role === "string" ? role[0].toUpperCase() + role.slice(1).toLowerCase() : "";
  if (!["Student", "Faculty"].includes(normalizedRole)) {
    return res.status(400).json({ error: "New accounts must be Student or Faculty." });
  }

  try {
    const exists = await query(
      "SELECT 1 FROM public.profiles WHERE lower(student_id)=lower($1) OR lower(email)=lower($2) LIMIT 1",
      [id.trim(), email.trim()]
    );
    if (exists.rowCount) return res.status(409).json({ error: "That ID or email is already registered." });

    const authUser = await createAuthUser({ email: email.trim(), password, name: name.trim() });
    const { rows } = await query(
      `INSERT INTO public.profiles (id, full_name, role, student_id, email, section, dept, bio, qr_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'',$8)
       RETURNING id, full_name, role, student_id, email, section, dept, bio, image, qr_data`,
      [
        authUser.id,
        name.trim(),
        normalizedRole,
        id.trim(),
        email.trim(),
        typeof section === "string" ? section.trim() : "",
        typeof dept === "string" ? dept.trim() : "",
        `E-LIBRARY-${normalizedRole.toUpperCase()}-${id.trim()}`,
      ]
    );
    return res.status(201).json(toUser(rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  if (req.profile.role !== "Admin" && req.profile.student_id !== req.params.id) {
    return res.status(403).json({ error: "You can only update your own account." });
  }
  const { name, email, section, dept, bio, image } = req.body || {};
  if (email !== undefined && email !== req.profile.email) {
    return res.status(400).json({ error: "Contact an administrator to change the sign-in email." });
  }
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "Name is required." });
  }
  try {
    const { rows } = await query(
      `UPDATE public.profiles
         SET full_name=COALESCE($1, full_name),
             email=COALESCE($2, email),
             section=COALESCE($3, section),
             dept=COALESCE($4, dept),
             bio=COALESCE($5, bio),
             image=CASE WHEN $6::boolean THEN $7 ELSE image END
       WHERE student_id=$8
       RETURNING id, full_name, role, student_id, email, section, dept, bio, image, qr_data`,
      [
        name === undefined ? null : name.trim(),
        typeof email === "string" ? email.trim() : null,
        typeof section === "string" ? section.trim() : null,
        typeof dept === "string" ? dept.trim() : null,
        typeof bio === "string" ? bio : null,
        image !== undefined,
        image ?? null,
        req.params.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found." });
    return res.json(toUser(rows[0]));
  } catch (error) {
    return next(error);
  }
});

async function getProfileByStudentId(studentId) {
  const { rows } = await query(
    `SELECT id, full_name, role, student_id, email, section, dept, bio, image, qr_data
       FROM public.profiles WHERE student_id=$1`,
    [studentId]
  );
  return rows[0] || null;
}

module.exports = router;
