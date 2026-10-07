const express = require("express");
const router = express.Router();
const { appState } = require("../store");

const getUsers = () => appState.users;

const getNextUserId = () => {
  const numericIds = getUsers()
    .map((user) => Number(user.id))
    .filter(Number.isSafeInteger);
  return numericIds.length ? Math.max(...numericIds) + 1 : 1;
};

const getUserById = (id) => getUsers().find((user) => String(user.id) === String(id));

router.get("/", (req, res) => {
  res.json(getUsers());
});

router.get("/:id", (req, res) => {
  const user = getUserById(req.params.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json(user);
});

router.post("/", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const newUser = { id: getNextUserId(), name };
  getUsers().push(newUser);

  return res.status(201).json(newUser);
});

router.put("/:id", (req, res) => {
  const id = req.params.id;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const userIndex = getUsers().findIndex((user) => String(user.id) === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  getUsers()[userIndex] = { ...getUsers()[userIndex], name };

  return res.json(getUsers()[userIndex]);
});

router.delete("/:id", (req, res) => {
  const id = req.params.id;
  const userIndex = getUsers().findIndex((user) => String(user.id) === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const [deletedUser] = getUsers().splice(userIndex, 1);

  return res.json({ message: "User deleted", user: deletedUser });
});

module.exports = router;