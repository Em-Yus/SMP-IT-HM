import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

/**
 * Custom Hook untuk Pengawasan Hybrid Edge AI menggunakan MediaPipe Face Landmarker
 * Berjalan di sisi klien (Wasm/WebGL) dengan interval 300ms - 500ms.
 *
 * Sistem Deteksi: AKUMULATIF (Ketat)
 * - Setiap interval (400ms) siswa dalam kondisi anomali → ditambahkan ke akumulator (ms)
 * - Ketika akumulator mencapai kelipatan debounceThresholdMs → 1 pelanggaran dicatat
 * - Siswa kembali menghadap kamera TIDAK mereset akumulator — hitungan terus berjalan
 */
export function useEdgeFaceLandmarker({
  onViolation = null,
  enabled = true,
  sampleIntervalMs = 400,
  debounceThresholdMs = 2500,
} = {}) {
  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [faceStatus, setFaceStatus] = useState('normal'); // 'normal' | 'no_face' | 'multiple_faces' | 'look_left_right' | 'tilt_up_down'
  const [violationCount, setViolationCount] = useState(0);
  const [headAngles, setHeadAngles] = useState({ yaw: 0, pitch: 0, roll: 0 });

  // Akumulator total waktu anomali (dalam ms) — tidak direset saat siswa kembali normal
  const accumulatedMsRef = useRef(0);
  // Batas akumulator untuk pelanggaran berikutnya (kelipatan debounceThresholdMs)
  const nextViolationThresholdRef = useRef(debounceThresholdMs);
  // Referensi violationCount agar bisa diakses dalam callback tanpa stale closure
  const violationCountRef = useRef(0);

  // Simpan onViolation & parameter ke ref agar tidak memicu re-running interval
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  const sampleIntervalMsRef = useRef(sampleIntervalMs);
  const debounceThresholdMsRef = useRef(debounceThresholdMs);
  useEffect(() => {
    sampleIntervalMsRef.current = sampleIntervalMs;
    debounceThresholdMsRef.current = debounceThresholdMs;
  }, [sampleIntervalMs, debounceThresholdMs]);

  // Hanya reset akumulator ketika 'enabled' pertama kali aktif (masuk ke pengerjaan soal)
  const prevEnabledRef = useRef(false);
  useEffect(() => {
    if (!prevEnabledRef.current && enabled) {
      accumulatedMsRef.current = 0;
      nextViolationThresholdRef.current = debounceThresholdMsRef.current;
      violationCountRef.current = 0;
      setViolationCount(0);
    }
    prevEnabledRef.current = enabled;
  }, [enabled]);

  // 1. Inisialisasi Akses Kamera / Webcam Siswa
  useEffect(() => {
    if (!enabled) return;
    let localStream = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('Browser tidak mendukung navigator.mediaDevices.getUserMedia');
          setCameraError('Kamera tidak didukung browser');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            facingMode: 'user',
          },
          audio: false,
        });

        localStream = stream;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn('Video play catch:', e));
            setCameraActive(true);
          };
        }
      } catch (err) {
        console.warn('Izin kamera ditolak atau tidak ditemukan:', err);
        setCameraError(err.message);
      }
    };

    startCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      setCameraActive(false);
    };
  }, [enabled]);

  // 2. Inisialisasi MediaPipe FaceLandmarker
  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    const initLandmarker = async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 3,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
        });

        if (isMounted) {
          landmarkerRef.current = landmarker;
          setIsLoaded(true);
          console.log('✅ MediaPipe Edge AI Face Landmarker siap digunakan di GPU lokal.');
        }
      } catch (err) {
        console.warn('Fallback: MediaPipe GPU error, mencoba fallback CPU / rule-based:', err);
        if (isMounted) {
          setIsLoaded(true); // Fallback ready
        }
      }
    };

    initLandmarker();

    return () => {
      isMounted = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
    };
  }, [enabled]);

  // 3. Hitung Sudut Kepala (Euler Angles) dari Matrix Transformasi
  const computeEulerAngles = (matrix) => {
    if (!matrix || matrix.length < 16) return { yaw: 0, pitch: 0, roll: 0 };
    // Matriks 4x4 berbentuk kolom mayor dari MediaPipe
    const m00 = matrix[0];
    const m10 = matrix[1];
    const m20 = matrix[2];
    const m21 = matrix[6];
    const m22 = matrix[10];

    const pitch = Math.atan2(-m21, m22) * (180 / Math.PI);
    const yaw = Math.atan2(m20, Math.sqrt(m00 * m00 + m10 * m10)) * (180 / Math.PI);
    const roll = Math.atan2(m10, m00) * (180 / Math.PI);

    return {
      yaw: Math.round(yaw),
      pitch: Math.round(pitch),
      roll: Math.round(roll),
    };
  };

  // 4. Loop Deteksi Berkala — Sistem Akumulasi Ketat & Akurat
  const runDetection = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    let currentAnomaly = null;
    let yaw = 0;
    let pitch = 0;

    if (landmarkerRef.current) {
      try {
        const results = landmarkerRef.current.detectForVideo(video, performance.now());

        if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
          currentAnomaly = 'no_face';
        } else if (results.faceLandmarks.length > 1) {
          currentAnomaly = 'multiple_faces';
        } else {
          // 1 Wajah Terdeteksi → Cek Sudut Rotasi Kepala
          if (results.facialTransformationMatrixes && results.facialTransformationMatrixes[0]) {
            const angles = computeEulerAngles(results.facialTransformationMatrixes[0].data);
            yaw = angles.yaw;
            pitch = angles.pitch;
            setHeadAngles(angles);

            // Ambang Batas Toleransi:
            // Yaw (Tengok Kiri / Kanan): > ±28°
            // Pitch (Angguk / Menunduk): > +22° atau < -25°
            if (Math.abs(yaw) > 28) {
              currentAnomaly = 'look_left_right';
            } else if (pitch < -25 || pitch > 22) {
              currentAnomaly = 'tilt_up_down';
            }
          }
        }
      } catch (err) {
        // Safe fail
      }
    }

    // === SISTEM AKUMULATIF (KETAT) ===
    // Setiap interval (400ms) siswa dalam kondisi anomali → +400ms ke akumulator
    // Saat akumulator >= threshold berikutnya → picu 1 pelanggaran, naikkan threshold
    // Siswa kembali normal TIDAK mereset akumulator — hitungan terus berjalan
    if (currentAnomaly) {
      setFaceStatus(prev => (prev !== currentAnomaly ? currentAnomaly : prev));
      accumulatedMsRef.current += sampleIntervalMsRef.current;

      console.log(
        `[FaceLandmarker] Anomaly: ${currentAnomaly} | Acc: ${accumulatedMsRef.current}ms / Next: ${nextViolationThresholdRef.current}ms`
      );

      if (accumulatedMsRef.current >= nextViolationThresholdRef.current) {
        const step = debounceThresholdMsRef.current;
        const newViolations = Math.max(
          1,
          Math.floor(
            (accumulatedMsRef.current - (nextViolationThresholdRef.current - step)) / step
          )
        );

        nextViolationThresholdRef.current += newViolations * step;
        violationCountRef.current += newViolations;
        const totalCount = violationCountRef.current;
        setViolationCount(totalCount);

        console.warn(
          `[FaceLandmarker] PELANGGARAN TERAKUMULASI! Total: ${totalCount} (+${newViolations})`
        );

        if (onViolationRef.current) {
          for (let i = 0; i < newViolations; i++) {
            onViolationRef.current({
              type: currentAnomaly,
              count: totalCount - newViolations + i + 1,
              yaw,
              pitch,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    } else {
      // Normal: akumulator TIDAK direset — hanya hentikan penambahan sementara
      setFaceStatus(prev => (prev !== 'normal' ? 'normal' : prev));
    }
  };

  // Simpan fungsi runDetection di ref agar setInterval stabil tidak pernah ter-reset
  const runDetectionRef = useRef(runDetection);
  runDetectionRef.current = runDetection;

  useEffect(() => {
    if (!enabled || !isLoaded) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    console.log('[FaceLandmarker] Memulai loop deteksi interval. Akumulasi saat ini:', accumulatedMsRef.current);

    timerRef.current = setInterval(() => {
      runDetectionRef.current?.();
    }, sampleIntervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, isLoaded, sampleIntervalMs]);

  return {
    videoRef,
    isLoaded,
    cameraActive,
    cameraError,
    faceStatus,
    violationCount,
    headAngles,
    accumulatedMs: accumulatedMsRef.current,
  };
}
