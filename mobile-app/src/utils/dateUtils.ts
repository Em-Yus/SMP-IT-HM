/**
 * Modul utilitas untuk penanganan tanggal dan hari operasional aplikasi.
 * Aturan: Pergantian hari operasional terjadi pada pukul 18.00 WIB.
 * Jika waktu saat ini >= 18:00, maka hari dan tanggal langsung berganti ke esok harinya (H+1).
 * Contoh: Selasa pukul 18:05 -> Hari Rabu dan tanggal hari Rabu.
 */

export const HARI_MAP = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
export type HariType = typeof HARI_MAP[number];

/**
 * Mendapatkan objek Date operasional.
 * Jika `baseDate` tidak diberikan, menggunakan waktu saat ini (`new Date()`).
 * Jika jam >= 18, tanggal dimajukan +1 hari.
 */
export const getOperationalDate = (baseDate?: Date | string): Date => {
  if (!baseDate) {
    const now = new Date();
    if (now.getHours() >= 18) {
      now.setDate(now.getDate() + 1);
    }
    return now;
  }

  // Jika berupa string tanggal 'YYYY-MM-DD' (tanpa komponen jam spesifik), jangan geser lagi karena sudah spesifik.
  if (typeof baseDate === 'string' && baseDate.length === 10 && baseDate.includes('-')) {
    return new Date(baseDate);
  }

  const d = typeof baseDate === 'string' ? new Date(baseDate) : new Date(baseDate.getTime());
  if (d.getHours() >= 18) {
    d.setDate(d.getDate() + 1);
  }
  return d;
};

/**
 * Mendapatkan nama hari operasional dalam bahasa Indonesia ('Minggu'..'Sabtu').
 */
export const getOperationalDayName = (baseDate?: Date | string): string => {
  const d = getOperationalDate(baseDate);
  return HARI_MAP[d.getDay()];
};

/**
 * Mendapatkan indeks hari operasional (0: Minggu, 1: Senin, ..., 6: Sabtu).
 */
export const getOperationalDayIndex = (baseDate?: Date | string): number => {
  const d = getOperationalDate(baseDate);
  return d.getDay();
};

/**
 * Mendapatkan string tanggal format 'YYYY-MM-DD'.
 * Jika tanpa parameter, otomatis mengacu pada tanggal operasional (aturan 18.00).
 * Jika parameter diberikan, memformat tanggal tersebut tanpa pergeseran ekstra.
 */
export const getLocalDate = (d?: Date | string): string => {
  if (!d) {
    const op = getOperationalDate();
    const year = op.getFullYear();
    const month = String(op.getMonth() + 1).padStart(2, '0');
    const day = String(op.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const target = typeof d === 'string' ? new Date(d) : d;
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
