const createInitialState = () => ({
  users: [],
  rooms: Array.from({ length: 20 }, (_, index) => ({
    id: `PC-${index + 1}`,
    name: `PC ${index + 1}`,
    type: "pc",
    capacity: 1,
    capacityMin: 1,
    capacityMax: 1,
    status: "available",
    location: index < 10 ? "ARC 2F" : "ARC 3F",
  })),
  reservations: [],
  registry: {},
  checkins: [],
  sessions: [],
  nextResId: 1,
  nextSessionId: 1,
  draft: null,
});

module.exports = { createInitialState };
