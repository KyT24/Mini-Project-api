"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dayOfWeek = exports.fromDbTime = exports.toDbTime = exports.toDbDate = void 0;
// Kolom @db.Date dan @db.Time disimpan sebagai tanggal/jam UTC apa adanya
const toDbDate = (date) => new Date(`${date}T00:00:00Z`);
exports.toDbDate = toDbDate;
const toDbTime = (time) => new Date(`1970-01-01T${time}:00Z`);
exports.toDbTime = toDbTime;
// Kolom @db.Time → "HH:mm"
const fromDbTime = (time) => time.toISOString().slice(11, 16);
exports.fromDbTime = fromDbTime;
// "YYYY-MM-DD" → 0 (Minggu) ... 6 (Sabtu), tanpa terpengaruh zona waktu server
const dayOfWeek = (date) => (0, exports.toDbDate)(date).getUTCDay();
exports.dayOfWeek = dayOfWeek;
