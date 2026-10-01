import { supabase } from '../../../services/supabaseClient';

function normalizeText(text: any): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ');
}

export function evaluateShortAnswer(userAnswer: string, keyAnswer: string, maxScore = 100) {
  const normUser = normalizeText(userAnswer);
  const normKey = normalizeText(keyAnswer);

  if (!normUser) {
    return { score: 0, isCorrect: false, feedback: 'Jawaban kosong' };
  }

  if (normUser === normKey) {
    return { score: maxScore, isCorrect: true, feedback: 'Tepat sesuai kunci jawaban' };
  }

  const keys = normKey.split(/[,/]/).map((k) => k.trim());
  if (keys.includes(normUser)) {
    return { score: maxScore, isCorrect: true, feedback: 'Sesuai dengan salah satu alternatif kunci' };
  }

  return { score: 0, isCorrect: false, feedback: 'Belum sesuai dengan kunci jawaban' };
}

export async function evaluateEssayWithAI({
  questionText,
  rubricText,
  studentAnswer,
  maxScore = 100,
}: {
  questionText: string;
  rubricText: string;
  studentAnswer: string;
  maxScore?: number;
}): Promise<{ score: number; feedback: string }> {
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return {
      score: 0,
      feedback: 'Siswa tidak memberikan jawaban pada soal esai ini.',
    };
  }

  try {
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
