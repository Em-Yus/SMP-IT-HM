/**
 * Helper untuk logika filter & formatting target audiens Pengumuman (Mobile App)
 * Mendukung: Semua, Guru, Semua Siswa, Kelas Tertentu, dan 1 Siswa Spesifik
 */

export const isPengumumanVisibleForSiswa = (targetStr: any, siswa: any): boolean => {
  if (!targetStr) return true;
  const t = String(targetStr).trim();

  // 1. Publik / Semua Pengguna / Semua Siswa
  if (t === 'Semua' || t === 'Publik' || t === 'Siswa') return true;

  // 2. Khusus Guru
  if (t === 'Guru') return false;

  if (!siswa) return false;

  // 3. Khusus 1 Siswa Spesifik
  if (t.startsWith('Siswa:')) {
    const sId = String(siswa.id || '');
    const sNipd = String(siswa.nipd || '').trim();
    const sNisn = String(siswa.nisn || '').trim();

    if (sId && t.includes(`[${sId}]`)) return true;
    if (sNipd && t.includes(`[${sNipd}]`)) return true;
    if (sNipd && t.includes(sNipd)) return true;
    if (sNisn && t.includes(sNisn)) return true;
    return false;
  }

  // 4. Khusus Kelas Tertentu (Tingkat atau Rombel)
  if (t.startsWith('Kelas:')) {
    const targetKelas = t.replace('Kelas:', '').trim().toLowerCase();
    const siswaKelas = String(siswa.kelas || '').trim().toLowerCase();

    if (!siswaKelas) return false;

    // Jika rombel sama persis (misal 'vii-a' === 'vii-a')
    if (siswaKelas === targetKelas) return true;

    // Bersihkan prefix 'kelas '
    const cleanTarget = targetKelas.replace(/^kelas\s*/, '');
    const cleanSiswa = siswaKelas.replace(/^kelas\s*/, '');

    if (cleanTarget === cleanSiswa) return true;

    // Deteksi tingkat (7, 8, 9 atau VII, VIII, IX)
    const getTingkat = (val: string) => {
      if (val.includes('viii') || val.includes('8')) return '8';
      if (val.includes('vii') || val.includes('7')) return '7';
      if (val.includes('ix') || val.includes('9')) return '9';
      return val;
    };

    const targetTingkat = getTingkat(cleanTarget);
    const siswaTingkat = getTingkat(cleanSiswa);

    // Jika target adalah tingkat (misal '7') dan tingkat siswa sama
    if (['7', '8', '9'].includes(targetTingkat) && targetTingkat === siswaTingkat) {
      // Jika target spesifik mengandung rombel (misal '7-a' atau 'vii-a'), jangan samakan rombel lain
      const targetHasRombel = /[a-z]/i.test(cleanTarget.replace(/^(vii|viii|ix|[789])/i, ''));
      if (!targetHasRombel) {
        return true; // Target untuk seluruh tingkat (semua kelas 7)
      }
    }

    return false;
  }

  return false;
};

export const formatTargetBadge = (targetStr: any) => {
  if (!targetStr) return { label: 'Semua', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
  const t = String(targetStr).trim();

  if (t === 'Semua' || t === 'Publik') {
    return { label: 'Semua (Guru & Siswa)', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
  }
  if (t === 'Guru') {
    return { label: 'Khusus Guru', bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' };
  }
  if (t === 'Siswa') {
    return { label: 'Semua Siswa', bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
  }
  if (t.startsWith('Kelas:')) {
    const kName = t.replace('Kelas:', '').trim();
    const isTingkat = ['7', '8', '9'].includes(kName);
    return {
      label: isTingkat ? `Kelas ${kName} (Semua Rombel)` : `Kelas ${kName}`,
      bg: '#fffbeb',
      text: '#b45309',
      border: '#fde68a',
    };
  }
  if (t.startsWith('Siswa:')) {
    const cleaned = t.replace(/^Siswa:\s*(\[\d+\]\s*)+/, '');
    return {
      label: `Siswa: ${cleaned}`,
      bg: '#faf5ff',
      text: '#7e22ce',
      border: '#e9d5ff',
    };
  }

  return { label: t, bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
};
