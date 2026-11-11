
const test = require("node:test");
const assert = require("node:assert/strict");

global.window = {};
require("../room-data.js");
const designs = window.ROOM_DESIGNS;
const equipment = window.ROOM_EQUIPMENT;

test("three rooms retain their database-compatible seat counts", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(designs).map(([code, room]) => [code, room.seats.length])),
    { b1a: 12, b1b: 16, b1c: 20 }
  );
});

test("every chair is unique, selectable and has valid equipment", () => {
  for (const room of Object.values(designs)) {
    const identifiers = new Set();
    room.seats.forEach((seat, index) => {
      assert.equal(seat.no, index + 1);
      assert.equal(seat.code, room.code + String(index + 1).padStart(2, "0"));
      assert.ok(!identifiers.has(seat.code));
      identifiers.add(seat.code);
      assert.ok(seat.x >= 8 && seat.x <= 92, seat.code);
      assert.ok(seat.y >= 10 && seat.y <= 90, seat.code);
      assert.ok(["lounge", "recliner", "workbench"].includes(seat.shape));
      assert.ok(seat.equipment.length > 0);
      seat.equipment.forEach(key => assert.ok(equipment[key], key));
    });
  }
});

test("layouts have separate furniture types, room outlines and windows", () => {
  assert.equal(new Set(Object.values(designs).map(room => room.seats[0].shape)).size, 3);
  assert.equal(new Set(Object.values(designs).map(room => room.outline)).size, 3);
  assert.equal(new Set(Object.values(designs).map(room => room.window)).size, 3);
  assert.ok(designs.b1b.seats.every(seat => seat.equipment.includes("recline")));
  assert.ok(designs.b1c.seats.every(seat => seat.equipment.includes("divider")));
  assert.ok(designs.b1c.decor.filter(item => item.type === "workbench").length >= 4);
  assert.ok(Object.values(designs).some(room => room.decor.some(item => item.type === "column")));
});

test("seat models have non-overlapping center coordinates", () => {
  for (const room of Object.values(designs)) {
    for (let i = 0; i < room.seats.length; i++) {
      for (let j = i + 1; j < room.seats.length; j++) {
        const a = room.seats[i], b = room.seats[j];
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 12, `${a.code} overlaps ${b.code}`);
      }
    }
  }
});

test("walking characters have valid bounded travel paths", () => {
  for (const room of Object.values(designs)) {
    assert.ok(room.walkers.length > 0);
    room.walkers.forEach(walker => {
      for (const key of ["x", "y", "dx", "dy", "delay"]) {
        assert.ok(Number.isFinite(walker[key]));
      }
      assert.ok(Math.abs(walker.dx) <= 100 && Math.abs(walker.dy) <= 100);
    });
  }
});


test("Discipline tables each have one continuous tabletop and five aligned stations", () => {
  const room = designs.b1c;
  const tables = room.decor.filter(item => item.type === "workbench");
  assert.equal(tables.length, 4);
  assert.equal(new Set(tables.map(table => table.id)).size, 4);
  for (const table of tables) {
    const seats = room.seats.filter(seat => seat.benchId === table.id);
    assert.equal(seats.length, 5);
    assert.deepEqual(seats.filter(seat => seat.side === "north").map(seat => seat.slot), [0, 1, 2]);
    assert.deepEqual(seats.filter(seat => seat.side === "south").map(seat => seat.slot), [0, 1]);
    for (const seat of seats) {
      assert.ok(Math.abs(seat.x - table.x) < table.width / 2);
      assert.ok(Math.abs(seat.y - table.y) < 15);
      assert.equal(seat.facing, seat.side);
    }
  }
});
