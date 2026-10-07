const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../server");

test("GET /api/users returns the user list", async () => {
  const response = await request(app).get("/api/users");

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body), true);
  assert.ok(response.body.length >= 2);
});

test("POST /api/users rejects empty or missing names", async () => {
  const response = await request(app).post("/api/users").send({ name: "" });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Name is required");
});

test("POST /api/users assigns a numeric ID after seeded string IDs", async () => {
  const response = await request(app).post("/api/users").send({ name: "Test API User" });

  assert.equal(response.status, 201);
  assert.equal(Number.isSafeInteger(response.body.id), true);
  assert.equal(response.body.name, "Test API User");
});

test("GET /api/data returns the full system data snapshot", async () => {
  const response = await request(app).get("/api/data");

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body.users), true);
  assert.equal(Array.isArray(response.body.rooms), true);
  assert.equal(Array.isArray(response.body.reservations), true);
  assert.equal(Array.isArray(response.body.sessions), true);
});

test("GET /api/users resolves university IDs as strings", async () => {
  const response = await request(app).get("/api/users/2023-00123");

  assert.equal(response.status, 200);
  assert.equal(response.body.id, "2023-00123");
});

test("GET /api/users returns a clear 404 for missing users", async () => {
  const response = await request(app).get("/api/users/UNKNOWN-USER");

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "User not found");
});
