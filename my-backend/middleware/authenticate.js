const { getAuthUser, getProfile } = require("../supabase-auth");

async function authenticate(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Sign in to continue." });
  }

  try {
    const authUser = await getAuthUser(match[1]);
    const profile = await getProfile(authUser.id);
    if (!profile) {
      return res.status(403).json({ error: "Library profile not found." });
    }
    req.authUser = authUser;
    req.profile = profile;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { authenticate };
