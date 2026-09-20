/**
 * Service utilitas perhitungan nilai CBT SMP IT HM (Mobile App)
 * 
 * Aturan Perhitungan:
 * 1. Jika dalam paket ujian terdapat lebih dari 1 jenis soal (PG, Isian Singkat, Esai),
 *    maka nilai mentah skala 0 - 100 dihitung untuk masing-masing jenis soal aktif,
 *    lalu dirata-ratakan.
 * 2. Skema Konversi Nilai:
 *    - 'asli': Nilai mentah apa adanya (Skala Murni 0 - 100).
 *    - 'kkm': Siswa dengan nilai mentah 0 akan mendapatkan nilai pas KKM (default 75).
 *             Siswa benar semua mendapat 100. Rentang: KKM s/d 100 (Semua lulus).
 *    - 'kompres': Siswa dengan nilai mentah 0 mendapatkan nilai 10 poin di bawah KKM (default 65).
 *                 Siswa benar semua mendapat 100. Rentang: (KKM - 10) s/d 100.
 */

export interface CalculateScoreParams {
  skorPg?: number;
  maxBobotPg?: number;
  countPg?: number;

  skorIsian?: number;
  maxBobotIsian?: number;
  countIsian?: number;

  skorEsai?: number;
  maxBobotEsai?: number;
  countEsai?: number;

  skemaKonversi?: 'asli' | 'kkm' | 'kompres' | string;
  kkm?: number;
}

export function calculateCbtFinalScore({
  skorPg = 0,
  maxBobotPg = 0,
  countPg = 0,

  skorIsian = 0,
  maxBobotIsian = 0,
  countIsian = 0,

  skorEsai = 0,
  maxBobotEsai = 0,
  countEsai = 0,

  skemaKonversi = 'asli',
  kkm = 75,
}: CalculateScoreParams) {
  const activeTypesPercentages: number[] = [];

  // 1. Pilihan Ganda (PG)
  if (countPg > 0 && maxBobotPg > 0) {
    const pctPg = Math.min(100, Math.max(0, (skorPg / maxBobotPg) * 100));
    activeTypesPercentages.push(pctPg);
  }

  // 2. Isian Singkat
  if (countIsian > 0 && maxBobotIsian > 0) {
    const pctIsian = Math.min(100, Math.max(0, (skorIsian / maxBobotIsian) * 100));
    activeTypesPercentages.push(pctIsian);
  }

  // 3. Esai
  if (countEsai > 0 && maxBobotEsai > 0) {
    const pctEsai = Math.min(100, Math.max(0, (skorEsai / maxBobotEsai) * 100));
    activeTypesPercentages.push(pctEsai);
  }

  // Hitung rata-rata persentase nilai mentah dari seluruh jenis soal yang ada
  let rawAverage = 0;
  if (activeTypesPercentages.length > 0) {
    const sum = activeTypesPercentages.reduce((acc, val) => acc + val, 0);
    rawAverage = sum / activeTypesPercentages.length;
  }

  // Terapkan Skema Konversi Nilai
  let finalScore = rawAverage;
  const numericKkm = Number(kkm) || 75;

  if (skemaKonversi === 'kkm') {
    // Siswa nilai 0 -> KKM (75), nilai 100 -> 100
    const base = numericKkm;
    const span = 100 - base;
    finalScore = base + (span / 100) * rawAverage;
  } else if (skemaKonversi === 'kompres') {
    // Siswa nilai 0 -> KKM - 10 (65), nilai 100 -> 100
    const base = Math.max(0, numericKkm - 10);
    const span = 100 - base;
    finalScore = base + (span / 100) * rawAverage;
  } else {
    // 'asli' -> Skala Murni 0 - 100
    finalScore = rawAverage;
  }

  return {
    rawAverage: parseFloat(rawAverage.toFixed(2)),
    finalScore: parseFloat(finalScore.toFixed(2)),
    activeTypesCount: activeTypesPercentages.length,
    detailByType: {
      pg: countPg > 0 && maxBobotPg > 0 ? parseFloat(((skorPg / maxBobotPg) * 100).toFixed(2)) : null,
      isian: countIsian > 0 && maxBobotIsian > 0 ? parseFloat(((skorIsian / maxBobotIsian) * 100).toFixed(2)) : null,
      esai: countEsai > 0 && maxBobotEsai > 0 ? parseFloat(((skorEsai / maxBobotEsai) * 100).toFixed(2)) : null,
    },
  };
}
