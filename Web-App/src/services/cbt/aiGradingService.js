import { supabase } from '../supabaseClient';

/**
 * Menghitung jarak Levenshtein antara dua string untuk koreksi Isian Singkat
 */
function calculateLevenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Normalisasi teks untuk penilaian string
 */
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Evaluasi Isian Singkat secara deterministik & kemiripan teks
 */
export function evaluateShortAnswer(userAnswer, keyAnswer, maxScore = 100) {
  const normUser = normalizeText(userAnswer);
  const normKey = normalizeText(keyAnswer);

  if (!normUser) {
    return { score: 0, isCorrect: false, feedback: 'Jawaban kosong' };
  }

  // 1. Cocok Eksak
  if (normUser === normKey) {
    return { score: maxScore, isCorrect: true, feedback: 'Tepat sesuai kunci jawaban' };
  }

  // 2. Kunci jamak dipisahkan koma atau garis miring (opsi alternatif)
  const keys = normKey.split(/[,/]/).map((k) => k.trim());
  if (keys.includes(normUser)) {
    return { score: maxScore, isCorrect: true, feedback: 'Sesuai dengan salah satu alternatif kunci' };
  }

  // 3. Toleransi Kesalahan Ketik (Typo / Levenshtein Distance)
  const bestDistance = Math.min(...keys.map((k) => calculateLevenshteinDistance(normUser, k)));
  const maxLen = Math.max(normUser.length, normKey.length);
  const similarity = 1 - bestDistance / maxLen;

  if (similarity >= 0.85) {
    return {
      score: maxScore,
      isCorrect: true,
      feedback: 'Jawaban benar (diterima dengan toleransi salah ketik ringan)',
    };
  } else if (similarity >= 0.70) {
    const partialScore = Math.round(maxScore * 0.75);
    return {
      score: partialScore,
      isCorrect: true,
      feedback: `Mendekati konsep kunci (${Math.round(similarity * 100)}% kemiripan)`,
    };
  }

  return { score: 0, isCorrect: false, feedback: 'Belum sesuai dengan kunci jawaban' };
}

/**
 * Evaluasi Esai menggunakan Semantik AI
 */
export async function evaluateEssayWithAI({
  questionText,
  rubricText,
  studentAnswer,
  maxScore = 100,
}) {
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return {
      score: 0,
      feedback: 'Siswa tidak memberikan jawaban pada soal esai ini.',
    };
  }

  try {
    // 1. Coba panggil Supabase Edge Function 'cbt-ai-grading' jika tersedia
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('cbt-ai-grading', {
      body: {
        question: questionText,
        rubric: rubricText,
        answer: studentAnswer,
        maxScore,
      },
    });

    if (!edgeErr && edgeData && typeof edgeData.score === 'number') {
      return edgeData;
    }
  } catch (err) {
    console.warn('Edge Function AI tidak merespons, menjalankan semantic rule engine fallback.');
  }

  // Fallback Semantic Heuristics Engine (Client-side AI Rule Evaluation)
  // Menghitung kemiripan kata kunci esensial dari rubrik
  const normAnswer = normalizeText(studentAnswer);
  const rubricKeywords = normalizeText(rubricText)
    .split(' ')
    .filter((w) => w.length > 3);

  let matchedKeywords = 0;
  rubricKeywords.forEach((kw) => {
    if (normAnswer.includes(kw)) {
      matchedKeywords++;
    }
  });

  const keywordCoverage = rubricKeywords.length > 0 ? matchedKeywords / rubricKeywords.length : 0.5;
  const wordCount = studentAnswer.trim().split(/\s+/).length;

  let calculatedScore = 0;
  let feedback = '';

  if (keywordCoverage >= 0.7 && wordCount >= 15) {
    calculatedScore = Math.round(maxScore * 0.95);
    feedback = 'Penjelasan sangat komprehensif dan mencakup seluruh konsep kunci pada rubrik.';
  } else if (keywordCoverage >= 0.4 && wordCount >= 10) {
    calculatedScore = Math.round(maxScore * 0.75);
    feedback = 'Konsep dasar terjawab dengan baik, beberapa rincian pendukung belum lengkap.';
  } else if (wordCount >= 5) {
    calculatedScore = Math.round(maxScore * 0.4);
    feedback = 'Jawaban cukup relevan namun argumen dan konsep inti belum terelaborasi.';
  } else {
    calculatedScore = Math.round(maxScore * 0.15);
    feedback = 'Jawaban terlalu singkat dan belum menyentuh konsep rubrik.';
  }

  return {
    score: calculatedScore,
    feedback,
  };
}

/**
 * Analisis Psikometrik Paket Soal Ujian
 * Menghitung Tingkat Kesukaran (P), Daya Pembeda (D), dan Efektivitas Distraktor
 */
export function calculatePsychometrics({ soals, sessions, answers }) {
  if (!soals || soals.length === 0 || !sessions || sessions.length === 0) {
    return [];
  }

  // 1. Urutkan siswa berdasarkan total skor (Kelompok Atas vs Kelompok Bawah)
  const sortedSessions = [...sessions].sort((a, b) => (b.nilai_akhir || 0) - (a.nilai_akhir || 0));
  const n = sortedSessions.length;
  const halfN = Math.max(1, Math.floor(n * 0.27)); // 27% atas dan 27% bawah (standar psikometri Kelly)

  const upperGroupIds = new Set(sortedSessions.slice(0, halfN).map((s) => s.id));
  const lowerGroupIds = new Set(sortedSessions.slice(n - halfN).map((s) => s.id));

  // 2. Hitung per butir soal
  return soals.map((soal) => {
    const itemAnswers = answers.filter((a) => a.soal_id === soal.id);
    const totalPeserta = itemAnswers.length || 1;

    let totalBenar = 0;
    let benarAtas = 0;
    let benarBawah = 0;
    const optionCounts = { A: 0, B: 0, C: 0, D: 0 };

    itemAnswers.forEach((ans) => {
      const isBenar = ans.is_benar || (ans.skor_final_guru || ans.skor_ai || 0) > 0;
      if (isBenar) totalBenar++;

      if (upperGroupIds.has(ans.sesi_id) && isBenar) benarAtas++;
      if (lowerGroupIds.has(ans.sesi_id) && isBenar) benarBawah++;

      if (ans.jawaban_siswa && optionCounts[ans.jawaban_siswa] !== undefined) {
        optionCounts[ans.jawaban_siswa]++;
      }
    });

    // Indeks Kesukaran P = B / N
    const P = parseFloat((totalBenar / totalPeserta).toFixed(2));
    let kategoriKesukaran = 'Sedang';
    if (P > 0.7) kategoriKesukaran = 'Mudah';
    else if (P < 0.3) kategoriKesukaran = 'Sukar';

    // Daya Pembeda D = (BA - BB) / HalfN
    const D = parseFloat(((benarAtas - benarBawah) / halfN).toFixed(2));
    let kategoriDayaPembeda = 'Cukup';
    if (D >= 0.4) kategoriDayaPembeda = 'Sangat Baik';
    else if (D >= 0.3) kategoriDayaPembeda = 'Baik';
    else if (D < 0.2) kategoriDayaPembeda = 'Jelek / Revisi';

    return {
      soalId: soal.id,
      nomorUrut: soal.nomor_urut,
      jenisSoal: soal.jenis_soal,
      pertanyaan: soal.pertanyaan,
      kunciJawaban: soal.kunci_jawaban,
      tingkatKesukaran: P,
      kategoriKesukaran,
      dayaPembeda: D,
      kategoriDayaPembeda,
      distraktorCounts: optionCounts,
    };
  });
}
