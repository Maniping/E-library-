const express = require("express");
const { signInByUniversityId } = require("../supabase-auth");

const router = express.Router();

router.post("/login", async (req, res, next) => {
  const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!id || !password) {
    return res.status(400).json({ error: "Enter your ID number and password." });
  }

  try {
    const session = await signInByUniversityId(id, password);
    return res.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: session.user,
      profile: {
        id: session.profile.id,
        student_id: session.profile.student_id,
        full_name: session.profile.full_name,
        role: session.profile.role,
        email: session.profile.email,
        section: session.profile.section,
        dept: session.profile.dept,
        bio: session.profile.bio,
        image: session.profile.image,
        qr_data: session.profile.qr_data,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
