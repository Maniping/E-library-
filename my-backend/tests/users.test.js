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
