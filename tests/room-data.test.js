const test = require("node:test");
const assert = require("node:assert/strict");

// room-data.js is a browser script. Supply a global window only within this test process.
global.window = {};
require("../room-data.js");
const designs = window.ROOM_DESIGNS, equipment = window.ROOM_EQUIPMENT;

test("three extra study rooms have the expected distinct capacities", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(designs).map(([key, room]) => [key, room.seats.length])),
    { b1a: 12, b1b: 16, b1c: 20 }
  );
});

test("every room seat has unique sequential identifiers and valid positions", () => {
  for (const room of Object.values(designs)) {
    const labels = room.seats.map(seat => seat.code);
    assert.equal(new Set(labels).size, labels.length);
    room.seats.forEach((seat, i) => {
      assert.equal(seat.no, i + 1);
      assert.equal(seat.code, room.code + String(i + 1).padStart(2, "0"));
      assert.ok(seat.x >= 0 && seat.x <= 100);
      assert.ok(seat.y >= 0 && seat.y <= 100);
      assert.ok(seat.equipment.length > 0);
      seat.equipment.forEach(key => assert.ok(equipment[key], key));
    });
  }
});

test("each room has a distinct desk arrangement and defined walker routes", () => {
  const layouts = Object.values(designs).map(room => JSON.stringify(room.seats.map(seat => [seat.x,seat.y])));
  assert.equal(new Set(layouts).size, 3);
  for (const room of Object.values(designs)) {
    assert.ok(room.walkers.length >= 1);
    room.walkers.forEach(walker => assert.ok(["horizontal", "vertical"].includes(walker.path)));
  }
});
