// Kolom @db.Date dan @db.Time disimpan sebagai tanggal/jam UTC apa adanya
export const toDbDate = (date: string) => new Date(`${date}T00:00:00Z`);
export const toDbTime = (time: string) => new Date(`1970-01-01T${time}:00Z`);

// Kolom @db.Time → "HH:mm"
export const fromDbTime = (time: Date | string) => {
  if (!time) return '00:00';
  if (typeof time === 'string') return time.slice(0, 5);
  return time.toISOString().slice(11, 16);
};

// "YYYY-MM-DD" → 0 (Minggu) ... 6 (Sabtu), tanpa terpengaruh zona waktu server
export const dayOfWeek = (date: string) => toDbDate(date).getUTCDay();
