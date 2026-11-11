
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

class Element {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.sub = {};
    this.dataset = {};
    this.attrs = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    this.style = { setProperty() {} };
    this.classes = new Set();
    this.classList = {
      toggle: (key, enabled) => {
        if (enabled === undefined) enabled = !this.classes.has(key);
        enabled ? this.classes.add(key) : this.classes.delete(key);
        return enabled;
      },
      add: key => this.classes.add(key),
      remove: key => this.classes.delete(key),
      contains: key => this.classes.has(key) || this.className.split(/\s+/).includes(key)
    };
  }
  set innerHTML(html) {
    this.html = html;
    if (html.includes("room-seat-layer")) {
      ["room-furniture", "room-seat-layer", "room-people"].forEach(key => {
        this.sub[key] = new Element();
      });
    }
    if (this.tag === "button" && html.includes("seat-model")) {
      this.sub["seat-model"] = new Element("span");
    }
    if (html.includes('data-bench-seat="')) {
      for (const match of html.matchAll(/data-bench-seat="(\d+)"/g)) {
        const place = new Element("span");
        place.className = "bench-place";
        place.dataset.benchSeat = match[1];
        this.children.push(place);
      }
    }
  }
  get innerHTML() { return this.html || ""; }
  querySelector(selector) {
    if (selector === ".iso-room") {
      return this.children.find(item => item.className.includes("iso-room")) || null;
    }
    const key = selector.slice(1);
    return this.sub[key] || this.children.find(child => child.className.split(/\s+/).includes(key)) || null;
  }
  querySelectorAll(selector) {
    const room = this.querySelector(".iso-room");
    if (selector === ".seat-object") return room?.sub["room-seat-layer"]?.children || [];
    if (selector === ".bench-place") {
      return room?.sub["room-furniture"]?.children.flatMap(item => item.children.filter(child => child.className === "bench-place")) || [];
    }
    return [];
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  replaceChildren(...children) { this.children = children; this.mounts = (this.mounts || 0) + 1; }
  setAttribute(key, value) { this.attrs[key] = value; }
  remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  scrollIntoView() {}
}

function createHarness() {
  const window = { matchMedia: () => ({ matches: false }) };
  const roomScript = fs.readFileSync(path.join(__dirname, "../room-data.js"), "utf8");
  new Function("window", roomScript)(window);
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const document = {
    getElementById: get,
    createElement: tag => new Element(tag),
    addEventListener() {}
  };
  get("room-select").value = "b1a";
  get("date-select").value = "2026-11-12";
  get("slot-select").value = "10:00";
  get("bookable-only").checked = false;

  const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
  const main = source.replace(
    'document.addEventListener("DOMContentLoaded", init);',
    'window.__testApp = { setView(v){ seatView=v; }, renderMap, updateSummary };'
  );
  assert.notEqual(main, source, "test hook not found");
  new Function("window", "document", "setTimeout", "clearTimeout", main)(
    window, document, () => {}, () => {}
  );
  const view = (room, seats, booked, alerts = []) => window.__testApp.setView({
    room, seats, bookedSet: new Set(booked),
    alertMap: new Map(alerts.map(a => [a.seat_id, a])), isBlocked: false
  });
  const button = no => get("floorplan").querySelectorAll(".seat-object")
    .find(node => Number(node.dataset.seatNo) === no);
  return { window, get, view, button, render: window.__testApp.renderMap, update: window.__testApp.updateSummary };
}

test("clicking seats does not remount the room or restart pedestrian animation", () => {
  const app = createHarness();
  const seats = Array.from({ length: 11 }, (_, index) =>
    ({ id: `seat-${index + 1}`, seat_no: index + 1, is_active: true }));
  app.view("b1a", seats, ["seat-1"]);
  app.render();
  assert.equal(app.get("floorplan").mounts, 1);
  assert.equal(app.get("floorplan").querySelectorAll(".seat-object").length, 12);
  const originalReader = app.button(1).querySelector(".seat-model").querySelector(".desk-reader");
  const originalWalkers = app.get("floorplan").querySelector(".iso-room").sub["room-people"];

  app.button(2).onclick();
  app.button(3).onclick();
  app.button(1).onclick();

  assert.equal(app.get("floorplan").mounts, 1);
  assert.strictEqual(app.get("floorplan").querySelector(".iso-room").sub["room-people"], originalWalkers);
  assert.strictEqual(app.button(1).querySelector(".seat-model").querySelector(".desk-reader"), originalReader);
  assert.equal(app.button(1).classList.contains("seat-occupied"), true);
});

test("missing backend seat can be inspected, but never booked", () => {
  const app = createHarness();
  const seats = Array.from({ length: 11 }, (_, index) =>
    ({ id: `seat-${index + 1}`, seat_no: index + 1, is_active: true }));
  app.view("b1a", seats, []);
  app.render();
  app.button(12).onclick();
  assert.equal(app.get("sum-seat").textContent, "A12");
  assert.equal(app.get("confirm-booking").disabled, true);
  assert.equal(app.get("report-reveal").classList.contains("hidden"), true);
});

test("reservation refresh updates chair colors without replacing room DOM", () => {
  const app = createHarness();
  const seats = Array.from({ length: 12 }, (_, index) =>
    ({ id: `seat-${index + 1}`, seat_no: index + 1, is_active: true }));
  app.view("b1a", seats, ["seat-1"]);
  app.render();
  const occupant = app.button(1).querySelector(".seat-model").querySelector(".desk-reader");
  app.view("b1a", seats, ["seat-1", "seat-3"]);
  app.render();
  assert.equal(app.get("floorplan").mounts, 1);
  assert.equal(app.button(3).classList.contains("seat-occupied"), true);
  assert.strictEqual(app.button(1).querySelector(".seat-model").querySelector(".desk-reader"), occupant);
});

test("switching the actual room builds a new map exactly once", () => {
  const app = createHarness();
  app.view("b1a", [], []);
  app.render();
  app.get("room-select").value = "b1b";
  app.view("b1b", [], []);
  app.render();
  assert.equal(app.get("floorplan").mounts, 2);
  assert.equal(app.get("floorplan").querySelectorAll(".seat-object").length, 16);
});


test("Discipline shared tables retain their five seat markings and update reserved segments", () => {
  const app = createHarness();
  const seats = Array.from({ length: 20 }, (_, index) =>
    ({ id: `seat-${index + 1}`, seat_no: index + 1, is_active: true }));
  app.get("room-select").value = "b1c";
  app.view("b1c", seats, ["seat-1", "seat-8"]);
  app.render();
  assert.equal(app.get("floorplan").querySelectorAll(".seat-object").length, 20);
  const marks = app.get("floorplan").querySelectorAll(".bench-place");
  assert.equal(marks.length, 20);
  const mark = no => marks.find(place => Number(place.dataset.benchSeat) === no);
  assert.equal(mark(1).classList.contains("is-booked"), true);
  assert.equal(mark(2).classList.contains("is-booked"), false);
  const originalTable = app.get("floorplan").querySelector(".iso-room").sub["room-furniture"];
  app.button(3).onclick();
  assert.equal(mark(3).classList.contains("is-selected"), true);
  app.view("b1c", seats, ["seat-1", "seat-3", "seat-8"]);
  app.render();
  assert.equal(app.get("floorplan").mounts, 1);
  assert.strictEqual(app.get("floorplan").querySelector(".iso-room").sub["room-furniture"], originalTable);
  assert.equal(mark(3).classList.contains("is-booked"), true);
});


test("camera mismatch adds visible object, warning and booking lock without scene restart", () => {
  const app = createHarness();
  const seats = Array.from({length:12}, (_,index) =>
    ({id:`seat-${index+1}`,seat_no:index+1,is_active:true}));
  app.view("b1a",seats,[],[{id:"a1",seat_id:"seat-2",object_type:"bag"}]);
  app.render();
  const seat = app.button(2);
  assert.equal(seat.classList.contains("seat-anomaly"),true);
  assert.ok(seat.querySelector(".seat-model").querySelector(".detected-object"));
  seat.onclick();
  assert.equal(app.get("confirm-booking").disabled,true);
  assert.ok(app.get("vision-seat-status").textContent.includes("已向管理員發出異常通報"));
  const prop = seat.querySelector(".seat-model").querySelector(".detected-object");
  app.button(3).onclick();
  assert.strictEqual(seat.querySelector(".seat-model").querySelector(".detected-object"),prop);
  assert.equal(app.get("floorplan").mounts,1);
});

test("cleared alert restores seat appearance and allows selected seat inspection", () => {
  const app = createHarness();
  const seats = Array.from({length:12}, (_,index) =>
    ({id:`seat-${index+1}`,seat_no:index+1,is_active:true}));
  app.view("b1a",seats,[],[{id:"a1",seat_id:"seat-2",object_type:"books"}]);
  app.render();
  app.button(2).onclick();
  assert.equal(app.button(2).classList.contains("seat-anomaly"),true);
  app.view("b1a",seats,[],[]);
  app.render();
  app.button(2).onclick();
  assert.equal(app.button(2).classList.contains("seat-anomaly"),false);
  assert.equal(app.button(2).querySelector(".seat-model").querySelector(".detected-object"),null);
  assert.equal(app.get("vision-seat-status").classList.contains("hidden"),true);
  assert.equal(app.get("floorplan").mounts,1);
});

test("shared Discipline workbench shows bag on the correct tabletop segment", () => {
  const app = createHarness();
  const seats = Array.from({length:20}, (_,index) =>
    ({id:`seat-${index+1}`,seat_no:index+1,is_active:true}));
  app.get("room-select").value = "b1c";
  app.view("b1c",seats,[],[{id:"a2",seat_id:"seat-3",object_type:"bag"}]);
  app.render();
  const marks = app.get("floorplan").querySelectorAll(".bench-place");
  const tableCell = marks.find(place => Number(place.dataset.benchSeat) === 3);
  assert.ok(tableCell);
  assert.equal(tableCell.classList.contains("is-anomaly"),true);
  assert.ok(tableCell.querySelector(".detected-object"));
  assert.equal(app.button(3).classList.contains("seat-anomaly"),true);
  assert.equal(app.get("floorplan").mounts,1);
});
