const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../server");

test("unauthenticated users cannot read account records", async () => {
  const response = await request(app).get("/api/users");
  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Sign in to continue.");
});

test("unauthenticated users cannot read shared library data", async () => {
  const response = await request(app).get("/api/data");
  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Sign in to continue.");
});

test("login requires an ID and password", async () => {
  const response = await request(app).post("/api/auth/login").send({ id: "emmanuel" });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Enter your ID number and password.");
});

test("public bootstrap contains rooms but no seeded demo users or reservations", async () => {
  const response = await request(app).get("/api/bootstrap");
  assert.equal(response.status, 200);
  assert.equal(response.body.rooms.length, 20);
  assert.equal("users" in response.body, false);
  assert.equal("reservations" in response.body, false);
});

test("health check is also available at /api/health", async () => {
  const response = await request(app).get("/api/health");
  assert.ok([200, 503].includes(response.status));
  assert.equal(typeof response.body.status, "string");
});

test("CORS allows the deployed Netlify sites and does not reflect arbitrary origins", async () => {
  for (const origin of ["https://elibuv.netlify.app", "https://elibuvtoledo.netlify.app"]) {
    const allowed = await request(app).get("/health").set("Origin", origin);
    assert.equal(allowed.headers["access-control-allow-origin"], origin);
  }

  const rejected = await request(app)
    .get("/health")
    .set("Origin", "https://untrusted.example");
  assert.equal(rejected.headers["access-control-allow-origin"], undefined);
});

test("demo credentials endpoint is disabled unless explicitly enabled for local development", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousEnabled = process.env.DEMO_ACCOUNTS_ENABLED;
  process.env.NODE_ENV = "production";
  process.env.DEMO_ACCOUNTS_ENABLED = "true";
  try {
    const response = await request(app).get("/api/demo-accounts/student");
    assert.equal(response.status, 404);
    assert.equal(response.body.error, "Demo sign-in is available only in local development.");
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousEnabled === undefined) delete process.env.DEMO_ACCOUNTS_ENABLED;
    else process.env.DEMO_ACCOUNTS_ENABLED = previousEnabled;
  }
});
