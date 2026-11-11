(function (root, factory) {
  const utilities = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = utilities;
  } else {
    root.AppUtils = utilities;
  }
})(globalThis, function () {
  "use strict";

  function protectSpreadsheetFormula(value) {
    const text = String(value ?? "");
    return /^[\u0000-\u0020\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]*[=+\-@]/u.test(text)
      ? `'${text}`
      : text;
  }

  function csvCell(value) {
    return `"${protectSpreadsheetFormula(value).replace(/"/g, '""')}"`;
  }

  function toCsv(headers, rows) {
    return [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  }

  function endTime(startTime) {
    const hour = Number(String(startTime).slice(0, 2));
    return `${String(hour + 1).padStart(2, "0")}:00`;
  }

  function reservationTimeState(date, startTime, now) {
    const today = now.dateStr;
    if (date < today) return "ended";
    if (date > today) return "future";
    const startHour = Number(String(startTime).slice(0, 2));
    const startMinute = Number(String(startTime).slice(3, 5));
    const nowMinute = now.hour * 60 + now.minute;
    const start = startHour * 60 + startMinute;
    if (nowMinute < start) return "future";
    if (nowMinute >= start + 60) return "ended";
    return "active";
  }

  function reservationCsvRows(reservations, roomNames, statusNames) {
    return reservations.map(reservation => [
      roomNames[reservation.room_code] || "閱覽室",
      String(reservation.seats?.seat_no || "").padStart(2, "0"),
      reservation.reservation_date,
      reservation.start_time.slice(0, 5),
      endTime(reservation.start_time),
      statusNames[reservation.status] || reservation.status
    ]);
  }

  return { csvCell, endTime, reservationCsvRows, reservationTimeState, toCsv };
});
