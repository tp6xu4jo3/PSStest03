const test = require("node:test");
const assert = require("node:assert/strict");
const { endTime, reservationCsvRows, toCsv } = require("../app-utils.js");

test("CSV quotes Traditional Chinese, commas, quotes, and line breaks", () => {
  const csv = toCsv(
    ["館室", "原因"],
    [["B1 自習室 C 區", '桌面, "維護"\r\n今日']]
  );

  assert.equal(csv, '"館室","原因"\r\n"B1 自習室 C 區","桌面, ""維護""\r\n今日"');
});

test("CSV neutralizes spreadsheet formulas after leading whitespace", () => {
  const csv = toCsv(["狀態"], [[" \t=HYPERLINK(\"https://example.invalid\")"]]);

  assert.equal(csv, '"狀態"\r\n"\' \t=HYPERLINK(""https://example.invalid"")"');
});

test("CSV escapes formula prefixes and retains ordinary negative values", () => {
  const csv = toCsv(["資料"], [["=1+1"], ["+SUM(A1:A2)"], ["@cmd"], ["-1"]]);

  assert.equal(csv, '"資料"\r\n"\'=1+1"\r\n"\'+SUM(A1:A2)"\r\n"\'@cmd"\r\n"\'-1"');
});

test("reservation end time handles the last supported slot", () => {
  assert.equal(endTime("09:00:00"), "10:00");
  assert.equal(endTime("20:00:00"), "21:00");
});

test("reservation CSV rows contain only the six requested non-identifying fields", () => {
  const rows = reservationCsvRows([{
    room_code: "b1c",
    reservation_date: "2026-11-07",
    start_time: "20:00:00",
    status: "confirmed",
    seats: { seat_no: 10 },
    student_id: "001123456",
    user_id: "private-user-id",
    email: "reader@example.invalid"
  }], {
    b1c: "B1 自習室 C 區"
  }, {
    confirmed: "已確認"
  });

  assert.deepEqual(rows, [[
    "B1 自習室 C 區", "10", "2026-11-07", "20:00", "21:00", "已確認"
  ]]);
  assert.equal(rows[0].length, 6);
});
