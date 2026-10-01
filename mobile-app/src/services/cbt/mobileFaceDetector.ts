import * as jpegJs from 'jpeg-js';
import { decode as decodeBase64 } from 'base64-arraybuffer';

export interface FaceAnalysisResult {
  faceStatus: 'normal' | 'look_left_right' | 'tilt_up_down' | 'no_face' | 'multiple_faces';
  yaw: number;
  pitch: number;
  confidence: number;
  skinRatio: number;
}

/**
 * Menganalisis frame gambar JPEG base64 dari kamera depan mobile untuk mendeteksi:
 * 1. Keberadaan wajah (no_face)
 * 2. Siswa menengok ke kiri atau ke kanan (look_left_right / yaw)
 * 3. Siswa menunduk atau menengadah (tilt_up_down / pitch)
 * 4. Keberadaan lebih dari satu wajah (multiple_faces)
 */
export function analyzeMobileFrame(base64Image: string): FaceAnalysisResult {
  try {
    if (!base64Image) {
      return { faceStatus: 'no_face', yaw: 0, pitch: 0, confidence: 0, skinRatio: 0 };
    }

    // Bersihkan prefix data URL jika ada
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '').trim();
    const arrayBuffer = decodeBase64(cleanBase64);

    const decodeFn = (jpegJs as any).decode || (jpegJs as any).default?.decode || jpegJs;
    const decoded = decodeFn(arrayBuffer, { useTArray: true, formatAsRGBA: true });

    if (!decoded || !decoded.data || decoded.width === 0 || decoded.height === 0) {
      return { faceStatus: 'no_face', yaw: 0, pitch: 0, confidence: 0, skinRatio: 0 };
    }

    const { width, height, data } = decoded;
    const totalPixels = width * height;

    let skinCount = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let sumX = 0, sumY = 0;

    // Grid untuk deteksi kluster multi-wajah (16 kolom x 12 baris)
    const cols = 16, rows = 12;
    const colSkin = new Int32Array(cols);
    const rowSkin = new Int32Array(rows);
    const blockW = width / cols;
    const blockH = height / rows;

    // 1. Pass 1: Segmentasi Warna Kulit (YCbCr + RGB) & Bounding Box
    for (let y = 0; y < height; y++) {
      const rowIdx = Math.min(rows - 1, Math.floor(y / blockH));
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Konversi YCbCr
        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        // Filter chromaticity kulit yang toleran terhadap berbagai pencahayaan ruang ujian
        const isSkin =
          Cb >= 73 &&
          Cb <= 138 &&
          Cr >= 129 &&
          Cr <= 183 &&
          Y >= 30 &&
          r > g &&
          (r - g) >= 6;

        if (isSkin) {
          skinCount++;
          sumX += x;
          sumY += y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          const colIdx = Math.min(cols - 1, Math.floor(x / blockW));
          colSkin[colIdx]++;
          rowSkin[rowIdx]++;
        }
      }
    }

    const skinRatio = skinCount / totalPixels;

    // Jika luas piksel kulit < 4% dari total frame atau < 60 piksel -> Tidak ada wajah
    if (skinRatio < 0.04 || skinCount < 60) {
      return { faceStatus: 'no_face', yaw: 0, pitch: 0, confidence: 0, skinRatio };
    }

    // 2. Deteksi Multiple Faces (Dua puncak persebaran kulit horizontal yang terpisah)
    let peaks = 0;
    let inPeak = false;
    for (let c = 0; c < cols; c++) {
      const frac = colSkin[c] / skinCount;
      if (frac > 0.14) {
        if (!inPeak) {
          peaks++;
          inPeak = true;
        }
      } else if (frac < 0.04) {
        inPeak = false;
      }
    }
    if (peaks >= 2 && skinRatio > 0.18) {
      return { faceStatus: 'multiple_faces', yaw: 0, pitch: 0, confidence: 0.9, skinRatio };
    }

    const cx = sumX / skinCount;
    const cy = sumY / skinCount;
    const fw = Math.max(1, maxX - minX);
    const fh = Math.max(1, maxY - minY);

    // 3. Analisis Keseimbangan Simetri Bilateral & Sebaran Fitur Wajah
    const midX = minX + fw / 2;
    let leftSkin = 0, rightSkin = 0;
    let leftDark = 0, rightDark = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const isSkin =
          Cb >= 73 &&
          Cb <= 138 &&
          Cr >= 129 &&
          Cr <= 183 &&
          Y >= 30 &&
          r > g &&
          (r - g) >= 6;

        if (isSkin) {
          if (x < midX) leftSkin++;
          else rightSkin++;
        } else if (Y < 75) {
          // Fitur kontras gelap (mata, alis, rambut)
          if (x < midX) leftDark++;
          else rightDark++;
        }
      }
    }

    // Centroid offset ternormalisasi (-1 sampai 1 dari pusat bounding box wajah)
    const normOffset = (cx - midX) / (fw / 2);
    // Posisi relatif kepala terhadap tengah frame kamera
    const frameOffset = (cx - width / 2) / (width / 2);
    // Rasio persebaran massa kulit kiri vs kanan
    const balanceRatio = (leftSkin + 1) / (rightSkin + 1);
    const logBalance = Math.log(balanceRatio);

    // Estimasi Sudut Yaw (Tengok Kiri / Kanan):
    // Jika siswa menengok ke samping, simetri wajah terdistorsi dan pusat massa bergeser
    let yaw = Math.round(normOffset * 48 - logBalance * 36 + frameOffset * 22);
    yaw = Math.max(-90, Math.min(90, yaw));

    // Estimasi Sudut Pitch (Angguk / Menunduk):
    const normCy = cy / height;
    let pitch = Math.round((0.45 - normCy) * 75);
    pitch = Math.max(-90, Math.min(90, pitch));

    // Ambang Batas Ketat Sesuai Spesifikasi Web-App:
    // Yaw > 28° atau Yaw < -28°: Menengok kiri/kanan
    // Pitch < -25° atau Pitch > 22°: Menunduk / Menengadah
    if (Math.abs(yaw) > 28) {
      return { faceStatus: 'look_left_right', yaw, pitch, confidence: 0.85, skinRatio };
    }

    if (pitch < -25 || pitch > 22) {
      return { faceStatus: 'tilt_up_down', yaw, pitch, confidence: 0.85, skinRatio };
    }

    return { faceStatus: 'normal', yaw, pitch, confidence: 0.95, skinRatio };
  } catch (err) {
    console.warn('[Face Detector] Error analyzing frame:', err);
    return { faceStatus: 'normal', yaw: 0, pitch: 0, confidence: 0, skinRatio: 0 };
  }
}
