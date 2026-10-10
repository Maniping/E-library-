const { query } = require("./db");

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireAuthConfig({ admin = false } = {}) {
  if (!supabaseUrl || !anonKey || (admin && !serviceRoleKey)) {
    const error = new Error(
      "Supabase Auth is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY, and, for admin operations, SUPABASE_SERVICE_ROLE_KEY."
    );
    error.status = 503;
    throw error;
  }
}

async function authRequest(path, { key = anonKey, ...options } = {}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.msg || body.message || body.error_description || "Supabase Auth request failed.");
    error.status = response.status === 400 || response.status === 422 ? 401 : response.status;
    throw error;
  }
  return body;
}

async function signInByUniversityId(id, password) {
  requireAuthConfig();
  const { rows } = await query(
    "SELECT email FROM public.profiles WHERE lower(student_id) = lower($1) LIMIT 1",
    [id]
  );
  if (!rows.length || !rows[0].email) {
    const error = new Error("Invalid ID number or password.");
    error.status = 401;
    throw error;
  }
  const session = await authRequest("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: rows[0].email, password }),
  });
  const profile = await getProfile(session.user.id);
  if (!profile) {
    const error = new Error("This account has no library profile. Contact an administrator.");
    error.status = 403;
    throw error;
  }
  return { ...session, profile };
}

async function getAuthUser(accessToken) {
  requireAuthConfig();
  return authRequest("user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function getProfile(userId) {
  const { rows } = await query(
    `SELECT id, full_name, role, student_id, email, section, dept, bio, image, qr_data
       FROM public.profiles WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

async function createAuthUser({ email, password, name }) {
  requireAuthConfig({ admin: true });
  return authRequest("admin/users", {
    key: serviceRoleKey,
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    }),
  });
}

async function deleteAuthUser(userId) {
  requireAuthConfig({ admin: true });
  return authRequest(`admin/users/${encodeURIComponent(userId)}`, {
    key: serviceRoleKey,
    method: "DELETE",
  });
}

async function updatePassword(accessToken, email, currentPassword, password) {
  requireAuthConfig();
  await authRequest("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password: currentPassword }),
  });
  return authRequest("user", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ password }),
  });
}

async function requireAdminById(userId) {
  const profile = await getProfile(userId);
  return profile?.role === "Admin";
}

module.exports = {
  createAuthUser,
  deleteAuthUser,
  getAuthUser,
  getProfile,
  requireAdminById,
  signInByUniversityId,
  updatePassword,
};
