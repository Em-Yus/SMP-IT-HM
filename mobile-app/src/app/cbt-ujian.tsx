import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  BackHandler,
  AppState,
  ToastAndroid,
  RefreshControl,
  StatusBar
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CryptoJS from 'crypto-js';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  CheckCircle,
  AlertCircle,
  Camera,
  Eye,
  CheckSquare,
  Square,
  Send,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Minimize2,
  Maximize2,
  User,
  BookOpen,
  Play,
  QrCode,
  FileQuestion,
  RefreshCw
} from 'lucide-react-native';
import { supabase } from '../../services/supabaseClient';
import { calculateCbtFinalScore } from '../services/cbt/scoringService';
import { analyzeMobileFrame } from '../services/cbt/mobileFaceDetector';
import { evaluateEssayWithAI } from '../services/cbt/aiGradingService';

const SECRET_KEY = process.env.EXPO_PUBLIC_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

// Helper robust parsing opsi jawaban pilihan ganda
const parseOpsiJawaban = (rawOpsi: any): Array<{ id: string; text: string; gambar_url?: string }> => {
  if (!rawOpsi) return [];
  let parsed = rawOpsi;
  if (typeof rawOpsi === 'string') {
    try {
      parsed = JSON.parse(rawOpsi);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) {
    return parsed.map((item: any, idx: number) => {
      const defaultId = String.fromCharCode(65 + idx);
      if (typeof item === 'string') {
        return { id: defaultId, text: item };
      }
      return {
        id: String(item?.id || defaultId).toUpperCase(),
        text: String(item?.text ?? item?.teks ?? item?.label ?? item?.opsi ?? item?.value ?? ''),
        gambar_url: item?.gambar_url,
      };
    });
  }
  if (typeof parsed === 'object' && parsed !== null) {
    return Object.entries(parsed).map(([key, val]) => {
      if (typeof val === 'object' && val !== null) {
        return {
          id: key.toUpperCase(),
          text: String((val as any)?.text ?? (val as any)?.teks ?? ''),
          gambar_url: (val as any)?.gambar_url,
        };
      }
      return {
        id: key.toUpperCase(),
        text: String(val ?? ''),
      };
    });
  }
  return [];
};

// Helper proses pengacakan soal per kelompok jenis dan acak opsi jawaban
const processExamQuestions = (
  rawSoals: any[],
  isAcakSoal: boolean,
  isAcakOpsi: boolean,
  siswaId: string | number,
  seedKey: string | number
) => {
  if (!rawSoals || rawSoals.length === 0) return [];

  // Deterministic LCG-based Fisher-Yates shuffle
  const deterministicShuffle = <T,>(array: T[], seed: number): T[] => {
    const result = [...array];
    let m = result.length;
    let s = Math.abs(Number(seed)) || 1;
    while (m) {
      s = (s * 9301 + 49297) % 233280;
      const i = Math.floor((s / 233280) * m--);
      const t = result[m];
      result[m] = result[i];
      result[i] = t;
    }
    return result;
  };

  const baseSeed = (Math.abs(Number(siswaId) || 1) * 10007 + Math.abs(Number(seedKey) || 1) * 37) % 2147483647;

  // 1. Pisahkan soal berdasarkan jenis soal
  const pgList = rawSoals.filter((s: any) => s.jenis_soal === 'pg');
  const isianList = rawSoals.filter((s: any) => s.jenis_soal === 'isian');
  const esaiList = rawSoals.filter((s: any) => s.jenis_soal === 'esai');
  const otherList = rawSoals.filter((s: any) => !['pg', 'isian', 'esai'].includes(s.jenis_soal));

  // 2. Acak soal per jenis soal secara mandiri jika isAcakSoal bernilai true
  const shuffledPg = isAcakSoal ? deterministicShuffle(pgList, baseSeed + 101) : pgList;
  const shuffledIsian = isAcakSoal ? deterministicShuffle(isianList, baseSeed + 202) : isianList;
  const shuffledEsai = isAcakSoal ? deterministicShuffle(esaiList, baseSeed + 303) : esaiList;

  // 3. Gabungkan dalam urutan baku: Pilihan Ganda -> Jawaban Singkat -> Esai -> Lainnya
  const orderedSoals = [...shuffledPg, ...shuffledIsian, ...shuffledEsai, ...otherList];

  // 4. Acak opsi jawaban untuk Pilihan Ganda jika isAcakOpsi bernilai true
  return orderedSoals.map((soal: any) => {
    if (soal.jenis_soal !== 'pg') return soal;

    const options = parseOpsiJawaban(soal.opsi_jawaban);
    if (!options || options.length <= 1) return soal;

    if (isAcakOpsi) {
      const optionSeed = (baseSeed * 13 + Math.abs(Number(soal.id) || 1) * 41) % 2147483647;
      const shuffledOptions = deterministicShuffle(options, optionSeed);
      return {
        ...soal,
        opsi_jawaban: shuffledOptions,
      };
    }

    return {
      ...soal,
      opsi_jawaban: options,
    };
  });
};

export default function CbtUjian() {
  const insets = useSafeAreaInsets();
  const { jadwalId } = useLocalSearchParams<{ jadwalId: string }>();

  // Permissions & Cam
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraMinimized, setIsCameraMinimized] = useState(false);
  const [proctorCameraReady, setProctorCameraReady] = useState(false);
  const [isCameraNativeReady, setIsCameraNativeReady] = useState(false);
  const isCameraNativeReadyRef = useRef(false);
  const [settingsUjian, setSettingsUjian] = useState<any>(null);
  const settingsUjianRef = useRef<any>(null);
  settingsUjianRef.current = settingsUjian;

  // Akumulator Anomali Kamera (Ketat: Akumulatif tidak direset jika kembali normal)
  const accumulatedAnomalyMsRef = useRef<number>(0);
  const nextViolationThresholdRef = useRef<number>(2500);
  const faceStatusRef = useRef<'normal' | 'look_left_right' | 'tilt_up_down' | 'no_face' | 'multiple_faces'>('normal');
  const [currentFaceStatus, setCurrentFaceStatus] = useState<string>('normal');

  // States
  const [currentStep, setCurrentStep] = useState<'scan' | 'beranda' | 'soal'>('scan');
  const [scanFacing, setScanFacing] = useState<'back' | 'front'>('back');
  const [isVerifyingCard, setIsVerifyingCard] = useState(false);
  const [isCardVerified, setIsCardVerified] = useState(false);
  const isResumingRef = useRef(false);
  const [showCameraGuide, setShowCameraGuide] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const isBlockedRef = useRef(false);
  isBlockedRef.current = isBlocked;

  const [loading, setLoading] = useState(true);
  const [jadwal, setJadwal] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sesi, setSesi] = useState<any>(null);
  const [siswa, setSiswa] = useState<any>(null);

  // Answers & States
  // Format: { [soalId]: { jawaban: string, is_ragu: boolean } }
  const [jawabanMap, setJawabanMap] = useState<Record<string, { jawaban: string; is_ragu: boolean }>>({});
  const [sisaDetik, setSisaDetik] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showViolationWarning, setShowViolationWarning] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const sisaDetikRef = useRef<number>(0);
  sisaDetikRef.current = sisaDetik;
  const sesiRef = useRef<any>(null);
  sesiRef.current = sesi;
  const leaveTimeRef = useRef<number | null>(null);
  const bankSoalIdRef = useRef<number | string | null>(null);
  const isAcakSoalRef = useRef(false);
  const isAcakOpsiRef = useRef(false);
  const [isRefreshingSoal, setIsRefreshingSoal] = useState(false);
  const [isRefreshingBeranda, setIsRefreshingBeranda] = useState(false);

  // Fungsi Refresh Butir Soal Realtime saat Ujian Berlangsung
  const handleRefreshSoal = async () => {
    if (!bankSoalIdRef.current || isRefreshingSoal) return;
    setIsRefreshingSoal(true);
    try {
      const { data: updatedSoal, error: sErr } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', bankSoalIdRef.current)
        .order('nomor_urut', { ascending: true });

      if (sErr) throw sErr;
      if (updatedSoal && updatedSoal.length > 0) {
        const processed = processExamQuestions(updatedSoal, isAcakSoalRef.current, isAcakOpsiRef.current, siswa?.id || 1, jadwalId || 1);
        setSoalList(processed);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Soal berhasil diperbarui', ToastAndroid.SHORT);
        } else {
          Alert.alert('Sukses', 'Daftar soal berhasil diperbarui dengan data terbaru.');
        }
      }
    } catch (err: any) {
      Alert.alert('Gagal Memperbarui', err.message || 'Terjadi gangguan koneksi.');
    } finally {
      setIsRefreshingSoal(false);
    }
  };

  // Fungsi Refresh Status Sesi & Beranda Ujian Realtime
  const handleRefreshBeranda = async () => {
    if (!jadwalId || !siswa?.id || isRefreshingBeranda) return;
    setIsRefreshingBeranda(true);
    try {
      // 1. Ambil data sesi siswa terkini dari Supabase
      const { data: latestSesi, error: sErr } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('jadwal_id', jadwalId)
        .eq('siswa_id', siswa.id)
        .maybeSingle();

      if (sErr) throw sErr;

      if (latestSesi) {
        setSesi(latestSesi);
        sesiRef.current = latestSesi;

        if (latestSesi.status === 'diblokir') {
          setIsBlocked(true);
          isBlockedRef.current = true;
          if (Platform.OS === 'android') {
            ToastAndroid.show('Status: Akses masih diblokir oleh pengawas.', ToastAndroid.SHORT);
          } else {
            Alert.alert('Status Terblokir', 'Akses ujian Anda masih diblokir oleh pengawas.');
          }
        } else if (latestSesi.status === 'mengerjakan') {
          setIsBlocked(false);
          isBlockedRef.current = false;
          setIsPaused(false);
          if (Platform.OS === 'android') {
            ToastAndroid.show('Blokir dibuka! Silakan lanjutkan ujian.', ToastAndroid.SHORT);
          } else {
            Alert.alert('Sukses', 'Blokir telah dibuka oleh pengawas. Anda dapat melanjutkan ujian.');
          }
        } else if (latestSesi.status === 'dijeda') {
          setIsPaused(true);
        }

        if (latestSesi.sisa_detik !== undefined && latestSesi.sisa_detik > 0) {
          setSisaDetik(latestSesi.sisa_detik);
        }
      }

      // 2. Ambil data jadwal terbaru jika ada perubahan
      const { data: latestJadwal } = await supabase
        .from('cbt_jadwal_ujian')
        .select(`
          *,
          data_kelas(id, nama_kelas),
          data_mapel(nama_mapel),
          data_ruang(nama_ruang),
          pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama),
          cbt_bank_soal(id, total_soal)
        `)
        .eq('id', jadwalId)
        .maybeSingle();

      if (latestJadwal) {
        setJadwal(latestJadwal);
      }
    } catch (err: any) {
      console.warn('Gagal refresh beranda ujian:', err);
      Alert.alert('Gagal Memperbarui', err.message || 'Terjadi gangguan koneksi saat memperbarui status.');
    } finally {
      setIsRefreshingBeranda(false);
    }
  };

  const handleStartExam = () => {
    if (isBlocked || sesi?.status === 'diblokir') {
      Alert.alert(
        'Kamu Terblokir',
        'Kamu terblokir, silahkan hubungi pengawas ruang untuk membuka akses ujian.',
        [
          { text: 'Periksa Status', onPress: handleRefreshBeranda },
          { text: 'Tutup', style: 'cancel' }
        ]
      );
      return;
    }
    setCurrentStep('soal');
    if (sesi?.id) {
      startTimer(sesi.id);
    }
  };

  // Helper Pencatatan Pelanggaran Otomatis ke Supabase
  // Helper Pencatatan Pelanggaran Otomatis ke Supabase
  const recordViolation = async (
    jenis: string,
    durasi: number = 0,
    keterangan: string = '',
    angles: { yaw?: number; pitch?: number } = {},
    forceBlock: boolean = false
  ) => {
    if (!sesiRef.current?.id || isBlockedRef.current) return;
    try {
      const newTotal = (sesiRef.current.total_pelanggaran || 0) + 1;
      sesiRef.current = { ...sesiRef.current, total_pelanggaran: newTotal };
      setSesi((prev: any) => (prev ? { ...prev, total_pelanggaran: newTotal } : prev));

      await supabase.from('cbt_log_pelanggaran').insert({
        sesi_id: sesiRef.current.id,
        jenis_pelanggaran: jenis,
        durasi_detik: durasi,
        sudut_yaw: angles.yaw || 0,
        sudut_pitch: angles.pitch || 0,
        keterangan: keterangan || `Pelanggaran terdeteksi (${jenis})`,
        timestamp: new Date().toISOString()
      });

      // Jika forceBlock aktif (misal pengulangan buka notifikasi/keluar) ATAU total pelanggaran >= 3
      const isBlokirMenengok = settingsUjianRef.current ? settingsUjianRef.current.blokir_menengok !== false : true;
      const shouldBlock = forceBlock || (isBlokirMenengok && newTotal >= 3);

      if (shouldBlock) {
        sesiRef.current = { ...sesiRef.current, status: 'diblokir', total_pelanggaran: newTotal };
        setSesi((prev: any) => (prev ? { ...prev, status: 'diblokir', total_pelanggaran: newTotal } : prev));

        await supabase
          .from('cbt_sesi_siswa')
          .update({ total_pelanggaran: newTotal, status: 'diblokir' })
          .eq('id', sesiRef.current.id);

        setIsBlocked(true);
        isBlockedRef.current = true;

        if (jadwalId) {
          try {
            const cmdChan = supabase.channel(`cbt_exam_cmd_${jadwalId}`);
            cmdChan.send({
              type: 'broadcast',
              event: 'student_block_status',
              payload: {
                sesiId: sesiRef.current.id,
                siswaId: siswa?.id,
                status: 'diblokir',
                reason: keterangan || 'Akses ujian diblokir oleh sistem keamanan CBT',
              },
            }).catch(() => {});
          } catch (_e) {}
        }

        Alert.alert(
          'Kamu Terblokir',
          'Kamu terblokir, silahkan hubungi pengawas.',
          [{ text: 'Tutup', style: 'destructive' }],
          { cancelable: false }
        );
      } else {
        await supabase
          .from('cbt_sesi_siswa')
          .update({ total_pelanggaran: newTotal })
          .eq('id', sesiRef.current.id);
      }
    } catch (e) {
      console.error('Gagal mencatat log pelanggaran:', e);
    }
  };

  // Ref penghitung pelanggaran status bar / notifikasi
  const statusBarViolationCountRef = useRef(0);
  const lastBlurTimeRef = useRef<number | null>(null);

  // 1. Detektor Tombol Hardware / Software Back di Android
  useEffect(() => {
    const backAction = () => {
      recordViolation('tombol_kembali', 0, 'Siswa menekan tombol Kembali');
      setShowViolationWarning(
        'PERINGATAN: Anda menekan tombol KEMBALI! Ujian sedang berlangsung. Keluar dari lembar ujian dilarang dan kejadian ini telah dicatat oleh sistem pengawas!'
      );
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  // 2. Detektor Status Bar / Notifikasi (Blur Event pada Android) & Meninggalkan Aplikasi (AppState Change)
  // Mekanisme: Peringatan keras pada pelanggaran ke-1, dan LANGSUNG DIBLOKIR jika diulangi (ke-2)!
  useEffect(() => {
    if (currentStep !== 'soal' || isBlocked) return;

    // Sembunyikan bilah status bar saat pengerjaan soal (Immersive Mode)
    StatusBar.setHidden(true, 'slide');

    const handleWindowBlurOrLeave = (source: 'status_bar' | 'keluar_aplikasi') => {
      if (isBlockedRef.current || currentStep !== 'soal') return;

      const now = Date.now();
      // Debounce 1.5s agar tidak dobel eksekusi jika blur dan change terpanggil bersamaan
      if (lastBlurTimeRef.current && now - lastBlurTimeRef.current < 1500) return;
      lastBlurTimeRef.current = now;

      statusBarViolationCountRef.current += 1;
      const violationNumber = statusBarViolationCountRef.current;

      if (violationNumber === 1) {
        // PERINGATAN KE-1: Belum diblokir, diperingatkan keras dan dicatat ke log
        recordViolation(
          source === 'status_bar' ? 'buka_notifikasi_status_bar' : 'keluar_aplikasi',
          0,
          source === 'status_bar'
            ? 'Peringatan 1: Siswa terdeteksi membuka panel notifikasi / status bar ponsel'
            : 'Peringatan 1: Siswa terdeteksi meninggalkan aplikasi ujian',
          {},
          false
        );

        setShowViolationWarning(
          source === 'status_bar'
            ? 'PERINGATAN KERAS (1/2)!\n\nAnda terdeteksi membuka panel notifikasi / bilah status bar ponsel!\n\nDilarang membuka notifikasi, membalas pesan, atau menurunkan bilah status bar selama ujian berlangsung.\n\nPelanggaran ini telah dicatat ke pengawas. JIKA DIULANGI SEKALI LAGI, AKUN UJIAN ANDA AKAN LANGSUNG DIBLOKIR!'
            : 'PERINGATAN KERAS (1/2)!\n\nAnda terdeteksi meninggalkan layar ujian (menekan tombol Home / berganti aplikasi / split screen)!\n\nPelanggaran ini telah dicatat ke pengawas. JIKA DIULANGI SEKALI LAGI, AKUN UJIAN ANDA AKAN LANGSUNG DIBLOKIR!'
        );
      } else {
        // PELANGGARAN KE-2 (DIULANGI): LANGSUNG BLOKIR OTOMATIS!
        recordViolation(
          source === 'status_bar' ? 'buka_notifikasi_status_bar' : 'keluar_aplikasi',
          0,
          source === 'status_bar'
            ? 'Siswa mengulangi membuka panel status bar / notifikasi ponsel (Akses Ujian Diblokir)'
            : 'Siswa mengulangi meninggalkan aplikasi ujian (Akses Ujian Diblokir)',
          {},
          true // Force Block seketika!
        );
      }
    };

    // Listener Blur (Terpanggil saat bilah status bar / drawer notifikasi HP ditarik turun di Android)
    const blurSubscription = AppState.addEventListener('blur', () => {
      handleWindowBlurOrLeave('status_bar');
    });

    // Listener Change (Terpanggil saat aplikasi diminimize, buka app lain, atau inactive di iOS)
    const changeSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        leaveTimeRef.current = Date.now();
        handleWindowBlurOrLeave('keluar_aplikasi');
      } else if (nextAppState === 'active' && leaveTimeRef.current) {
        leaveTimeRef.current = null;
      }
    });

    return () => {
      StatusBar.setHidden(false, 'slide');
      blurSubscription.remove();
      changeSubscription.remove();
    };
  }, [currentStep, isBlocked]);

  // Init Data
  useEffect(() => {
    initExamSession();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jadwalId]);

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Jeda warm-up mount kamera depan AI proctor saat masuk ke 'soal'
  useEffect(() => {
    if (currentStep === 'soal' && permission?.granted) {
      setProctorCameraReady(true);
      // Fallback maksimal 1.5 detik jika event onCameraReady lambat terpanggil di Android
      const fallbackTimer = setTimeout(() => {
        isCameraNativeReadyRef.current = true;
        setIsCameraNativeReady(true);
      }, 1500);

      return () => {
        clearTimeout(fallbackTimer);
        setProctorCameraReady(false);
        isCameraNativeReadyRef.current = false;
        setIsCameraNativeReady(false);
      };
    } else {
      setProctorCameraReady(false);
      isCameraNativeReadyRef.current = false;
      setIsCameraNativeReady(false);
    }
  }, [currentStep, permission?.granted]);

  // Broadcast Snapshot Kamera Mobile ke Ruang Pengawas secara Realtime & Deteksi Anomali
  useEffect(() => {
    if (currentStep !== 'soal' || isBlocked || !jadwalId || !siswa?.id || !permission?.granted) return;

    const channelName = `cbt_exam_${jadwalId}`;
    const channel = supabase.channel(channelName);

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isCapturing = false;

    // Reset akumulator saat pertama kali masuk ke lembar soal ujian
    accumulatedAnomalyMsRef.current = 0;
    nextViolationThresholdRef.current = 2500;

    channel.subscribe(async (status: string) => {
      if (status !== 'SUBSCRIBED') return;

      const captureAndSend = async () => {
        if (isCapturing || !cameraRef.current || isBlockedRef.current) return;
        try {
          isCapturing = true;
          let photo = null;
          try {
            photo = await cameraRef.current.takePictureAsync({
              quality: 0.2,
              shutterSound: false,
              skipProcessing: true,
            });
          } catch (_e) {
            photo = await cameraRef.current.takePictureAsync({
              quality: 0.2,
              shutterSound: false,
            });
          }

          if (photo?.uri) {
            // Downscale aggressively ke lebar 160px (sama persis dengan Web-App) agar aman pada WebSocket
            const manipResult = await ImageManipulator.manipulateAsync(
              photo.uri,
              [{ resize: { width: 160 } }],
              { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (manipResult.base64) {
              // 1. Analisis Pose & Deteksi Wajah AI di Sisi Klien Mobile
              const analysis = analyzeMobileFrame(manipResult.base64);
              if (faceStatusRef.current !== analysis.faceStatus) {
                faceStatusRef.current = analysis.faceStatus;
                setCurrentFaceStatus(analysis.faceStatus);
              }

              // 2. Broadcast Snapshot & Status Wajah ke Ruang Pengawas (Web App & Mobile App)
              channel.send({
                type: 'broadcast',
                event: 'student_video_feed',
                payload: {
                  siswaId: siswa.id,
                  sesiId: sesiRef.current?.id,
                  image: `data:image/jpeg;base64,${manipResult.base64}`,
                  faceStatus: analysis.faceStatus,
                  isOpen: true,
                  sisaDetik: sisaDetikRef.current,
                  timestamp: Date.now(),
                },
              });

              // 3. Sistem Pelanggaran AKUMULATIF (Ketat)
              // Setiap interval 3000ms terdeteksi anomali -> tambahkan ke akumulator
              if (analysis.faceStatus !== 'normal') {
                accumulatedAnomalyMsRef.current += 3000;

                if (accumulatedAnomalyMsRef.current >= nextViolationThresholdRef.current) {
                  nextViolationThresholdRef.current += 2500;
                  const labelPelanggaran =
                    analysis.faceStatus === 'look_left_right'
                      ? 'Menengok Kiri/Kanan'
                      : analysis.faceStatus === 'tilt_up_down'
                      ? 'Menunduk/Menengadah'
                      : analysis.faceStatus === 'multiple_faces'
                      ? 'Terdeteksi Lebih dari 1 Orang'
                      : 'Wajah Tidak Terdeteksi';

                  recordViolation(
                    analysis.faceStatus,
                    2.5,
                    `Anomali pengawasan kamera: ${labelPelanggaran} (Yaw: ${analysis.yaw}°, Pitch: ${analysis.pitch}°)`,
                    { yaw: analysis.yaw, pitch: analysis.pitch }
                  );
                }
              }
              // Catatan: Jika normal, akumulator TIDAK direset — hitungan akumulatif terus berjalan
            }
          }
        } catch (_err) {
          console.warn('[CBT Proctor Camera] Error capture/send:', _err);
        } finally {
          isCapturing = false;
        }
      };

      // Frame pertama setelah jeda 2.0s, lalu setiap 3.0s
      setTimeout(captureAndSend, 2000);
      intervalId = setInterval(captureAndSend, 3000);
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      try {
        channel.send({
          type: 'broadcast',
          event: 'student_presence',
          payload: {
            siswaId: siswa?.id,
            isOpen: false,
            timestamp: Date.now(),
          },
        });
      } catch (_e) {}
      supabase.removeChannel(channel);
    };
  }, [currentStep, isBlocked, jadwalId, siswa?.id, permission?.granted]);

  const initExamSession = async () => {
    try {
      setLoading(true);

      const userStr = await AsyncStorage.getItem('user_siswa');
      if (!userStr) {
        Alert.alert('Error', 'Sesi siswa tidak valid.');
        router.replace('/login');
        return;
      }
      const parsedSiswa = JSON.parse(userStr);
      setSiswa(parsedSiswa);

      // 0. Ambil data siswa segar dari Supabase & tentukan tingkat kelas
      const { data: dbSiswa } = await supabase
        .from('data_siswa')
        .select('id, nama, kelas, nisn, nipd, status_keaktifan')
        .eq('id', parsedSiswa.id)
        .maybeSingle();

      // Validasi status keaktifan siswa (Hanya siswa Aktif yang boleh mengakses ujian CBT)
      if (!dbSiswa || (dbSiswa.status_keaktifan && dbSiswa.status_keaktifan.toLowerCase() !== 'aktif')) {
        Alert.alert(
          'Akses Ujian Ditolak',
          `Akun siswa Anda berstatus "${dbSiswa?.status_keaktifan || 'Nonaktif'}". Hanya siswa berstatus "Aktif" yang dapat mengikuti ujian CBT.`,
          [{ text: 'Kembali', onPress: () => router.back() }]
        );
        return;
      }

      const kelasSiswa = dbSiswa?.kelas || parsedSiswa.kelas || '';
      let tingkatSiswa: string | null = null;

      if (kelasSiswa) {
        const { data: kData } = await supabase
          .from('data_kelas')
          .select('tingkat')
          .ilike('nama_kelas', kelasSiswa.trim())
          .maybeSingle();
        if (kData?.tingkat) {
          tingkatSiswa = String(kData.tingkat);
        }
      }

      if (!tingkatSiswa && kelasSiswa) {
        const upper = kelasSiswa.toUpperCase().trim();
        if (upper.includes('VII') && !upper.includes('VIII')) {
          tingkatSiswa = '7';
        } else if (upper.includes('VIII')) {
          tingkatSiswa = '8';
        } else if (upper.includes('IX')) {
          tingkatSiswa = '9';
        } else {
          const m = upper.match(/\b([789])\b/);
          if (m) tingkatSiswa = m[1];
        }
      }

      // 1. Ambil Jadwal beserta Bank Soal & Tingkat Kelasnya
      const { data: jadwalData, error: jErr } = await supabase
        .from('cbt_jadwal_ujian')
        .select('*, data_mapel(nama_mapel), data_guru:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama), cbt_bank_soal(id, tingkat_kelas, skema_konversi, acak_soal, acak_opsi)')
        .eq('id', jadwalId)
        .single();
      if (jErr || !jadwalData) throw new Error('Jadwal ujian tidak ditemukan.');
      setJadwal(jadwalData);

      // Ambil Pengaturan Ujian Global
      const { data: setRes } = await supabase
        .from('cbt_pengaturan_ujian')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const loadedSettings = setRes || {
        tampilkan_kamera: true,
        tampilkan_tombol_selesai_menit: 15,
        blokir_menengok: true,
        blokir_keluar_browser: true,
      };
      setSettingsUjian(loadedSettings);
      settingsUjianRef.current = loadedSettings;

      // 2. Pencocokan Bank Soal Berdasarkan Tingkat Kelas Siswa Secara Ketat
      let targetBank: any = null;

      // Cek apakah bank soal bawaan jadwal cocok dengan tingkat kelas siswa
      if (jadwalData.cbt_bank_soal?.id) {
        const bankTingkat = String(jadwalData.cbt_bank_soal.tingkat_kelas || '');
        if (!bankTingkat || bankTingkat === 'Semua' || (tingkatSiswa && bankTingkat === tingkatSiswa)) {
          targetBank = jadwalData.cbt_bank_soal;
        }
      }

      // Jika bank soal bawaan belum ada atau tidak sesuai tingkat kelas siswa, cari bank soal mapel ini yang sesuai kelas siswa
      if (!targetBank && jadwalData.mapel_id && tingkatSiswa) {
        const { data: matchedBank } = await supabase
          .from('cbt_bank_soal')
          .select('id, tingkat_kelas, skema_konversi, acak_soal, acak_opsi')
          .eq('mapel_id', jadwalData.mapel_id)
          .or(`tingkat_kelas.eq.${tingkatSiswa},tingkat_kelas.eq.Semua`)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (matchedBank?.id) {
          targetBank = matchedBank;
        }
      }

      // Jika tidak ditemukan bank soal yang sesuai tingkat kelas siswa, tolak akses dan jangan tampilkan soal kelas lain
      if (!targetBank) {
        const kelasLabel = tingkatSiswa ? `Kelas ${tingkatSiswa}` : (kelasSiswa || 'kelas Anda');
        throw new Error(`Bank soal untuk tingkat ${kelasLabel} belum tersedia pada ujian ini.`);
      }

      const targetBankId = targetBank.id;
      bankSoalIdRef.current = targetBankId;

      const { data: soalData, error: sErr } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', targetBankId)
        .order('nomor_urut', { ascending: true });
      if (sErr || !soalData || soalData.length === 0) {
        throw new Error('Bank soal belum memiliki butir pertanyaan.');
      }

      // Tentukan status acak soal dan acak opsi dari pengaturan bank soal / jadwal
      let isAcakSoal = false;
      if (targetBank && targetBank.acak_soal !== null && targetBank.acak_soal !== undefined) {
        isAcakSoal = Boolean(targetBank.acak_soal);
      } else if (jadwalData && jadwalData.acak_soal !== null && jadwalData.acak_soal !== undefined) {
        isAcakSoal = Boolean(jadwalData.acak_soal);
      }

      let isAcakOpsi = false;
      if (targetBank && targetBank.acak_opsi !== null && targetBank.acak_opsi !== undefined) {
        isAcakOpsi = Boolean(targetBank.acak_opsi);
      } else if (jadwalData && jadwalData.acak_opsi !== null && jadwalData.acak_opsi !== undefined) {
        isAcakOpsi = Boolean(jadwalData.acak_opsi);
      }

      isAcakSoalRef.current = isAcakSoal;
      isAcakOpsiRef.current = isAcakOpsi;

      const processedSoals = processExamQuestions(soalData, isAcakSoal, isAcakOpsi, parsedSiswa.id, jadwalId);
      setSoalList(processedSoals);

      // 3. Ambil atau Buat Sesi Siswa
      let { data: existingSesi } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('jadwal_id', jadwalId)
        .eq('siswa_id', parsedSiswa.id)
        .maybeSingle();

      let activeSesi = existingSesi;

      // Validasi Tanggal & Waktu Pelaksanaan Ujian (jika sesi baru)
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (!activeSesi) {
        if (jadwalData.tanggal_ujian && jadwalData.tanggal_ujian !== todayStr) {
          Alert.alert(
            'Bukan Waktu Ujian',
            `Ujian ini dijadwalkan pada tanggal ${jadwalData.tanggal_ujian}. Hari ini bukan tanggal pelaksanaan ujian tersebut.`,
            [{ text: 'Kembali', onPress: () => router.replace('/cbt-jadwal-siswa' as any) }]
          );
          return;
        }

        if (jadwalData.jam_mulai && nowTimeStr < jadwalData.jam_mulai.substring(0, 5)) {
          Alert.alert(
            'Ujian Belum Dimulai',
            `Ujian ini baru dapat diakses pada pukul ${jadwalData.jam_mulai.substring(0, 5)} WIB.`,
            [{ text: 'Kembali', onPress: () => router.replace('/cbt-jadwal-siswa' as any) }]
          );
          return;
        }

        if (jadwalData.jam_selesai && nowTimeStr > jadwalData.jam_selesai.substring(0, 5)) {
          Alert.alert(
            'Waktu Ujian Berakhir',
            `Waktu pelaksanaan ujian ini telah berakhir pada pukul ${jadwalData.jam_selesai.substring(0, 5)} WIB.`,
            [{ text: 'Kembali', onPress: () => router.replace('/cbt-jadwal-siswa' as any) }]
          );
          return;
        }

        // Buat sesi baru
        const totalDetik = (jadwalData.durasi_menit || 60) * 60;
        const { data: newSesi, error: createErr } = await supabase
          .from('cbt_sesi_siswa')
          .insert({
            jadwal_id: jadwalId,
            siswa_id: parsedSiswa.id,
            status: 'mengerjakan',
            waktu_mulai: new Date().toISOString(),
            sisa_detik: totalDetik,
            total_pelanggaran: 0
          })
          .select()
          .single();

        if (createErr) throw createErr;
        activeSesi = newSesi;
      } else {
        // Jika sudah selesai
        if (activeSesi.status === 'selesai') {
          Alert.alert('Info', 'Anda telah menyelesaikan ujian ini.');
          router.replace('/cbt-jadwal-siswa' as any);
          return;
        }
        if (activeSesi.status === 'diblokir') {
          setIsBlocked(true);
          isBlockedRef.current = true;
        }
        if (activeSesi.status === 'dijeda') {
          setIsPaused(true);
        }
      }

      setSesi(activeSesi);

      // Hitung sisa waktu
      const remaining = activeSesi.sisa_detik && activeSesi.sisa_detik > 0
        ? activeSesi.sisa_detik
        : (jadwalData.durasi_menit || 60) * 60;
      setSisaDetik(remaining);

      // 4. Muat Jawaban (AsyncStorage + Supabase)
      const storageKey = `cbt_answers_${activeSesi.id}`;
      const localAnswersStr = await AsyncStorage.getItem(storageKey);
      let loadedAnswers: Record<string, { jawaban: string; is_ragu: boolean }> = {};

      if (localAnswersStr) {
        try {
          loadedAnswers = JSON.parse(localAnswersStr);
        } catch (e) {}
      }

      // Ambil juga dari Supabase untuk sync
      const { data: remoteAnswers } = await supabase
        .from('cbt_jawaban_siswa')
        .select('*')
        .eq('sesi_id', activeSesi.id);

      if (remoteAnswers && remoteAnswers.length > 0) {
        remoteAnswers.forEach(r => {
          if (!loadedAnswers[r.soal_id]) {
            loadedAnswers[r.soal_id] = {
              jawaban: r.jawaban_siswa || '',
              is_ragu: !!r.is_ragu
            };
          }
        });
      }

      setJawabanMap(loadedAnswers);

      const isResuming = activeSesi.status === 'mengerjakan' || activeSesi.status === 'dijeda';
      isResumingRef.current = isResuming;

      // Siswa HARUS selalu melewati tahap scan kartu terlebih dahulu untuk verifikasi identitas
      setCurrentStep('scan');
    } catch (err: any) {
      console.error('Error initExamSession:', err);
      Alert.alert('Gagal Memulai Ujian', err.message || 'Terjadi kesalahan sistem.');
      router.replace('/cbt-jadwal-siswa' as any);
    } finally {
      setLoading(false);
    }
  };

  // Dedicated Realtime Subscription untuk Sesi Siswa dengan pembersihan yang aman
  useEffect(() => {
    if (!sesi?.id) return;
    const sesiId = sesi.id;
    const channelName = `sesi_exam_${sesiId}_${Date.now()}`;

    // Bersihkan channel lama yang mungkin masih tertinggal di registry Supabase
    try {
      const staleChannels = supabase.getChannels().filter((c) => c.topic.includes(`sesi_exam_${sesiId}`));
      staleChannels.forEach((c) => {
        supabase.removeChannel(c);
      });
    } catch (_e) {}

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cbt_sesi_siswa',
          filter: `id=eq.${sesiId}`
        },
        (payload) => {
          const newStatus = payload.new?.status;
          const newSisaDetik = payload.new?.sisa_detik;

          if (payload.new) {
            setSesi((prev: any) => ({ ...prev, ...payload.new }));
          }

          if (newStatus === 'dijeda') {
            setIsPaused(true);
          } else if (newStatus === 'mengerjakan') {
            setIsPaused(false);
            setIsBlocked(false);
            isBlockedRef.current = false;
          } else if (newStatus === 'diblokir') {
            setIsBlocked(true);
            isBlockedRef.current = true;
          }

          if (newSisaDetik && Math.abs(newSisaDetik - sisaDetikRef.current) > 60) {
            setSisaDetik(newSisaDetik);
            Alert.alert('Info Pengawas', 'Waktu ujian Anda telah disesuaikan oleh pengawas.');
          }
        }
      )
      .subscribe();

    // Broadcast Listener untuk respon instan dari pengawas (0ms latency)
    let examCmdChannel: any = null;
    if (jadwalId) {
      examCmdChannel = supabase
        .channel(`cbt_exam_cmd_mob_${jadwalId}_${Date.now()}`)
        .on('broadcast', { event: 'student_block_status' }, ({ payload }: any) => {
          if (payload?.sesiId === sesiId || payload?.siswaId === siswa?.id) {
            if (payload.status === 'diblokir') {
              setIsBlocked(true);
              isBlockedRef.current = true;
              setSesi((prev: any) => ({ ...prev, status: 'diblokir' }));
            } else if (payload.status === 'mengerjakan') {
              setIsBlocked(false);
              isBlockedRef.current = false;
              setIsPaused(false);
              setSesi((prev: any) => ({ ...prev, status: 'mengerjakan' }));
            }
          }
        })
        .subscribe();
    }

    // Polling sinkronisasi status setiap 2.5 detik
    const pollInterval = setInterval(async () => {
      try {
        const { data: latestSesi } = await supabase
          .from('cbt_sesi_siswa')
          .select('id, status, total_pelanggaran, sisa_detik')
          .eq('id', sesiId)
          .maybeSingle();

        if (latestSesi) {
          if (latestSesi.status === 'diblokir') {
            setIsBlocked(true);
            isBlockedRef.current = true;
            setSesi((prev: any) => ({ ...prev, ...latestSesi }));
          } else if (latestSesi.status === 'mengerjakan' && isBlockedRef.current) {
            setIsBlocked(false);
            isBlockedRef.current = false;
            setIsPaused(false);
            setSesi((prev: any) => ({ ...prev, ...latestSesi }));
          } else if (latestSesi.status === 'dijeda' && !isPaused) {
            setIsPaused(true);
            setSesi((prev: any) => ({ ...prev, ...latestSesi }));
          }
        }
      } catch (_e) {}
    }, 2500);

    return () => {
      try {
        supabase.removeChannel(channel);
        if (examCmdChannel) supabase.removeChannel(examCmdChannel);
        clearInterval(pollInterval);
      } catch (_e) {}
    };
  }, [sesi?.id, jadwalId, siswa?.id]);

  // Handler Pemindaian & Verifikasi Kartu Siswa
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (isVerifyingCard || isCardVerified) return;
    setIsVerifyingCard(true);

    try {
      const rawData = String(data || '').trim();
      let extractedId = '';

      // 1. Coba dekripsi menggunakan AES SECRET_KEY (format Kartu Pelajar resmi SMP IT HM)
      try {
        const bytes = CryptoJS.AES.decrypt(rawData, SECRET_KEY);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted && decrypted !== 'NO-DATA') {
          extractedId = decrypted.trim();
        }
      } catch (_e) {}

      // 2. Coba parse format JSON jika kartu menyimpan objek data
      if (!extractedId) {
        try {
          const parsed = JSON.parse(rawData);
          extractedId = String(parsed.nipd || parsed.nisn || parsed.id || '').trim();
        } catch (_e) {}
      }

      // 3. Fallback jika QR berisi teks NIPD/NISN mentah
      if (!extractedId) {
        extractedId = rawData;
      }

      // Cocokkan terhadap data siswa yang sedang login
      const currentNipd = String(siswa?.nipd || '').trim();
      const currentNisn = String(siswa?.nisn || '').trim();
      const currentId = String(siswa?.id || '').trim();

      const isOwner = Boolean(
        (currentNipd && extractedId === currentNipd) ||
        (currentNisn && extractedId === currentNisn) ||
        (currentId && extractedId === currentId)
      );

      if (isOwner) {
        setIsCardVerified(true);
        Alert.alert(
          'Identitas Terverifikasi!',
          `Kartu Pelajar atas nama ${siswa?.nama || 'Anda'} terverifikasi sah. Silakan melanjutkan ke lembar ujian.`,
          [
            {
              text: 'Lanjutkan',
              onPress: () => {
                setIsVerifyingCard(false);
                if (isResumingRef.current) {
                  setCurrentStep('soal');
                  if (sesi?.id) {
                    startTimer(sesi.id);
                  }
                } else {
                  setCurrentStep('beranda');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Verifikasi Gagal!',
          `Kartu yang dipindai BUKAN milik akun Anda (${siswa?.nama || 'Siswa'}).\n\nAnda tidak dapat mengerjakan soal ujian ini dengan kartu milik orang lain.`,
          [
            {
              text: 'Pindai Ulang',
              onPress: () => setIsVerifyingCard(false)
            }
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Gagal Memindai', 'Format kartu tidak valid atau tidak terbaca.', [
        { text: 'Coba Lagi', onPress: () => setIsVerifyingCard(false) }
      ]);
    }
  };

  const startTimer = (sesiId: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSisaDetik((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        const updated = prev - 1;

        // Auto save sisa detik berkala setiap 30 detik
        if (updated % 30 === 0) {
          supabase
            .from('cbt_sesi_siswa')
            .update({ sisa_detik: updated })
            .eq('id', sesiId)
            .then();
        }

        return updated;
      });
    }, 1000);
  };

  // Handler Ganti Jawaban
  const handleAnswerChange = async (val: string) => {
    const currSoal = soalList[currentIndex];
    if (!currSoal || !sesi) return;

    const currentObj = jawabanMap[currSoal.id] || { jawaban: '', is_ragu: false };
    const updatedObj = { ...currentObj, jawaban: val };

    const newMap = { ...jawabanMap, [currSoal.id]: updatedObj };
    setJawabanMap(newMap);

    // 1. Simpan Lokal Instan (AsyncStorage)
    await AsyncStorage.setItem(`cbt_answers_${sesi.id}`, JSON.stringify(newMap));

    // 2. Background Sync ke Supabase (Upsert)
    supabase
      .from('cbt_jawaban_siswa')
      .upsert({
        sesi_id: sesi.id,
        soal_id: currSoal.id,
        jawaban_siswa: val,
        is_ragu: updatedObj.is_ragu,
        updated_at: new Date().toISOString()
      }, { onConflict: 'sesi_id,soal_id' })
      .then();
  };

  // Handler Toggle Ragu-Ragu
  const handleToggleRagu = async () => {
    const currSoal = soalList[currentIndex];
    if (!currSoal || !sesi) return;

    const currentObj = jawabanMap[currSoal.id] || { jawaban: '', is_ragu: false };
    const updatedObj = { ...currentObj, is_ragu: !currentObj.is_ragu };

    const newMap = { ...jawabanMap, [currSoal.id]: updatedObj };
    setJawabanMap(newMap);

    await AsyncStorage.setItem(`cbt_answers_${sesi.id}`, JSON.stringify(newMap));

    supabase
      .from('cbt_jawaban_siswa')
      .upsert({
        sesi_id: sesi.id,
        soal_id: currSoal.id,
        jawaban_siswa: updatedObj.jawaban,
        is_ragu: updatedObj.is_ragu,
        updated_at: new Date().toISOString()
      }, { onConflict: 'sesi_id,soal_id' })
      .then();
  };

  // Submit Ujian
  const handleAutoSubmit = () => {
    Alert.alert('Waktu Habis!', 'Waktu pengerjaan ujian telah berakhir. Lembar jawaban Anda otomatis dikumpulkan.', [
      { text: 'OK', onPress: () => finalizeSubmission(true) }
    ]);
  };

  const finalizeSubmission = async (isAuto = false) => {
    if (!sesi || isSubmitting) return;

    // Larang mengumpulkan jika masih ada butir soal yang belum dikerjakan
    if (!isAuto && stats.unanswered > 0) {
      setShowConfirmModal(false);
      Alert.alert(
        'Soal Belum Lengkap!',
        `Masih ada ${stats.unanswered} dari ${stats.total} butir soal yang belum Anda kerjakan. Anda wajib menjawab seluruh butir soal sebelum mengumpulkan ujian.`
      );
      return;
    }

    // Larang mengumpulkan jika masih ada soal yang terceklis ragu-ragu
    if (!isAuto && stats.ragu > 0) {
      setShowConfirmModal(false);
      Alert.alert(
        'Tidak Dapat Mengumpulkan!',
        `Anda masih memiliki ${stats.ragu} butir soal yang ditandai ragu-ragu. Harap periksa dan hilangkan tanda centang ragu-ragu terlebih dahulu sebelum mengumpulkan ujian.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (timerRef.current) clearInterval(timerRef.current);

      // Hitung skor per jenis soal (PG, Isian Singkat, Esai)
      let totalSkorPg = 0;
      let totalBobotPg = 0;
      let countPg = 0;

      let totalSkorIsian = 0;
      let totalBobotIsian = 0;
      let countIsian = 0;

      let totalSkorEsai = 0;
      let totalBobotEsai = 0;
      let countEsai = 0;

      for (const soal of soalList) {
        const userAns = (jawabanMap[soal.id]?.jawaban || '').trim();
        const bobot = Number(soal.bobot_nilai) || 1;

        if (soal.jenis_soal === 'pg') {
          countPg++;
          totalBobotPg += bobot;
          const keyAns = (soal.kunci_jawaban || '').trim();
          const isBenar = userAns !== '' && userAns.toUpperCase() === keyAns.toUpperCase();
          const skor = isBenar ? bobot : 0;
          totalSkorPg += skor;

          // Sync jawaban ke database dengan status koreksi otomatis
          await supabase.from('cbt_jawaban_siswa').upsert({
            sesi_id: sesi.id,
            soal_id: soal.id,
            jawaban_siswa: userAns,
            is_benar: isBenar,
            skor_final_guru: skor,
            status_koreksi: 'otomatis_ai',
            updated_at: new Date().toISOString()
          }, { onConflict: 'sesi_id,soal_id' });
        } else if (soal.jenis_soal === 'isian') {
          countIsian++;
          totalBobotIsian += bobot;
          const keyAnsList = (soal.kunci_jawaban || '').split(/[,;|]/).map((k: string) => k.trim().toLowerCase());
          const isBenar = userAns !== '' && (keyAnsList.includes(userAns.toLowerCase()) || userAns.toLowerCase() === (soal.kunci_jawaban || '').trim().toLowerCase());
          const skor = isBenar ? bobot : 0;
          totalSkorIsian += skor;

          await supabase.from('cbt_jawaban_siswa').upsert({
            sesi_id: sesi.id,
            soal_id: soal.id,
            jawaban_siswa: userAns,
            is_benar: isBenar,
            skor_final_guru: skor,
            status_koreksi: 'otomatis_ai',
            updated_at: new Date().toISOString()
          }, { onConflict: 'sesi_id,soal_id' });
        } else if (soal.jenis_soal === 'esai') {
          countEsai++;
          totalBobotEsai += bobot;
          const evalRes = await evaluateEssayWithAI({
            questionText: soal.pertanyaan,
            rubricText: soal.rubrik_esai || '',
            studentAnswer: userAns,
            maxScore: bobot,
          });
          totalSkorEsai += evalRes.score;

          await supabase.from('cbt_jawaban_siswa').upsert({
            sesi_id: sesi.id,
            soal_id: soal.id,
            jawaban_siswa: userAns,
            skor_ai: evalRes.score,
            feedback_ai: evalRes.feedback,
            skor_final_guru: evalRes.score,
            status_koreksi: 'otomatis_ai',
            updated_at: new Date().toISOString()
          }, { onConflict: 'sesi_id,soal_id' });
        }
      }

      // Terapkan kalkulasi terstandarisasi dengan pemisahan jenis & skema konversi
      const skema = jadwal?.skema_konversi || jadwal?.cbt_bank_soal?.skema_konversi || 'asli';
      const scoreResult = calculateCbtFinalScore({
        skorPg: totalSkorPg,
        maxBobotPg: totalBobotPg,
        countPg: countPg,

        skorIsian: totalSkorIsian,
        maxBobotIsian: totalBobotIsian,
        countIsian: countIsian,

        skorEsai: totalSkorEsai,
        maxBobotEsai: totalBobotEsai,
        countEsai: countEsai,

        skemaKonversi: skema,
        kkm: 75,
      });

      const finalNilai = scoreResult.finalScore;

      // Update status sesi menjadi selesai
      const { error: updateErr } = await supabase
        .from('cbt_sesi_siswa')
        .update({
          status: 'selesai',
          waktu_selesai: new Date().toISOString(),
          sisa_detik: 0,
          skor_pg: totalSkorPg,
          skor_isian: totalSkorIsian,
          skor_esai: 0,
          nilai_akhir: finalNilai
        })
        .eq('id', sesi.id);

      if (updateErr) throw updateErr;

      // Bersihkan local storage
      await AsyncStorage.removeItem(`cbt_answers_${sesi.id}`);

      setShowConfirmModal(false);
      Alert.alert(
        'Ujian Selesai!',
        'Alhamdulillah, lembar jawaban Anda telah berhasil diserahkan ke server.',
        [{ text: 'Kembali ke Beranda', onPress: () => router.replace('/cbt-jadwal-siswa' as any) }]
      );
    } catch (err: any) {
      Alert.alert('Gagal Mengumpulkan', err.message || 'Terjadi gangguan jaringan saat menyimpan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format Timer
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Hitung statistik jawaban
  const stats = useMemo(() => {
    let answeredCount = 0;
    let raguCount = 0;
    soalList.forEach(s => {
      const item = jawabanMap[s.id];
      if (item?.jawaban && item.jawaban.trim() !== '') answeredCount++;
      if (item?.is_ragu) raguCount++;
    });
    return {
      total: soalList.length,
      answered: answeredCount,
      unanswered: soalList.length - answeredCount,
      ragu: raguCount
    };
  }, [soalList, jawabanMap]);

  const currentSoal = soalList[currentIndex];
  const currentAnswer = currentSoal ? jawabanMap[currentSoal.id] : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3740A1" />
        <Text style={styles.loadingTitle}>Mempersiapkan Lembar Ujian...</Text>
        <Text style={styles.loadingSub}>Memeriksa koneksi aman & sinkronisasi data</Text>
      </View>
    );
  }

  // =========================================================================
  // HALAMAN TERBLOKIR: JIKA DIBLOKIR LANGSUNG TAMPILKAN LAYAR TERBLOKIR
  // =========================================================================
  if (isBlocked || sesi?.status === 'diblokir') {
    return (
      <View style={styles.stepContainerDark}>
        <View style={styles.stepHeaderCenter}>
          <View style={[styles.logoCircle, { backgroundColor: '#dc2626' }]}>
            <Text style={styles.logoCircleText}>HM</Text>
          </View>
          <Text style={styles.stepScanTitle}>Ruang Ujian CBT Siswa</Text>
          <Text style={styles.stepScanSubtitle}>SMP IT Hidayatul Mubtadi-ien</Text>
        </View>

        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingBeranda}
              onRefresh={handleRefreshBeranda}
              colors={['#ef4444']}
              tintColor="#ef4444"
            />
          }
        >
          <View style={{
            width: '100%',
            maxWidth: 360,
            flexDirection: 'column',
            alignItems: 'center',
            paddingVertical: 28,
            paddingHorizontal: 20,
            backgroundColor: '#0f172a',
            borderColor: '#ef4444',
            borderWidth: 1.5,
            borderRadius: 24,
          }}>
            <ShieldAlert size={56} color="#ef4444" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 8 }}>
              Kamu Terblokir
            </Text>
            <Text style={{ fontSize: 14, color: '#fca5a5', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
              Kamu terblokir, silahkan hubungi pengawas.
            </Text>

            <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 16, gap: 6, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }}>
              <Text style={{ fontSize: 13, color: '#e2e8f0' }}>
                Peserta: <Text style={{ fontWeight: 'bold', color: '#fff' }}>{siswa?.nama || 'Siswa'}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                Kelas: {siswa?.kelas || '-'} • Mapel: {jadwal?.data_mapel?.nama_mapel || jadwal?.nama_ujian || 'Ujian'}
              </Text>
              <Text style={{ fontSize: 12, color: '#f87171', fontWeight: 'bold' }}>
                Total Pelanggaran: {sesi?.total_pelanggaran || 0} Pelanggaran
              </Text>
            </View>

            {/* Tombol Cek Pembukaan Blokir */}
            <TouchableOpacity
              style={{
                width: '100%',
                backgroundColor: '#dc2626',
                paddingVertical: 13,
                paddingHorizontal: 16,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 14,
                elevation: 3,
                shadowColor: '#dc2626',
                shadowOpacity: 0.4,
                shadowRadius: 8
              }}
              onPress={handleRefreshBeranda}
              disabled={isRefreshingBeranda}
              activeOpacity={0.8}
            >
              {isRefreshingBeranda ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <RefreshCw size={16} color="#fff" />
              )}
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
                {isRefreshingBeranda ? 'Memeriksa Izin Pengawas...' : 'Periksa Pembukaan Blokir Sekarang'}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <ActivityIndicator size="small" color="#ef4444" />
              <Text style={{ fontSize: 12, color: '#cbd5e1' }}>Tarik ke bawah atau tekan tombol untuk refresh</Text>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: 'rgba(255,255,255,0.12)', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
              onPress={() => router.back()}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Kembali ke Jadwal</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // =========================================================================
  // STEP 1: SCAN KARTU & POP-UP PERINGATAN KAMERA
  // =========================================================================
  if (currentStep === 'scan') {
    return (
      <View style={styles.stepContainerDark}>
        {/* Header */}
        <View style={styles.stepHeaderCenter}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoCircleText}>HM</Text>
          </View>
          <Text style={styles.stepScanTitle}>Verifikasi Identitas & Pemindaian Kartu CBT</Text>
          <Text style={styles.stepScanSubtitle}>SMP IT Hidayatul Mubtadi-ien</Text>
        </View>

        {/* Scan Frame Area */}
        <View style={styles.scanBox}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing={scanFacing}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'ean13', 'ean8', 'code39'],
              }}
              onBarcodeScanned={isVerifyingCard || isCardVerified ? undefined : handleBarcodeScanned}
            />
          ) : (
            <View style={styles.scanFallback}>
              <QrCode size={80} color="#38bdf8" />
            </View>
          )}
          <View style={styles.scanOverlayFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.laserBeam} />
          <Text style={styles.scanHintText}>
            {isVerifyingCard
              ? 'Memverifikasi keabsahan kartu...'
              : 'Arahkan QR Code Kartu Pelajar Anda ke dalam bingkai'}
          </Text>
        </View>

        {/* Info Siswa Yang Sedang Login */}
        <View style={styles.scanStudentBadge}>
          <Text style={styles.scanStudentLabel}>AKUN SISWA AKTIF</Text>
          <Text style={styles.scanStudentName}>{siswa?.nama || 'Siswa'}</Text>
          <Text style={styles.scanStudentMeta}>
            NISN: {siswa?.nisn || '-'} • NIPD: {siswa?.nipd || '-'} • Kelas: {siswa?.kelas || '-'}
          </Text>
        </View>

        {/* Indikator Wajib Kamera Belakang */}
        <View style={styles.scanControlsRow}>
          <View style={[styles.flipCamBtn, { backgroundColor: 'rgba(133, 194, 38, 0.15)', borderWidth: 1, borderColor: '#85c226' }]}>
            <Camera size={16} color="#85c226" />
            <Text style={[styles.flipCamBtnText, { color: '#daffcc', fontWeight: 'bold' }]}>
              Kamera Belakang Aktif (Scan Kartu)
            </Text>
          </View>
        </View>

        {/* Modal Petunjuk Posisi Kamera */}
        <Modal
          visible={showCameraGuide}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCameraGuide(false)}
        >
          <View style={styles.modalBackdropCenter}>
            <View style={styles.cameraGuideCard}>
              <View style={styles.cameraGuideIconCircle}>
                <Camera size={34} color="#3740A1" />
              </View>
              <Text style={styles.cameraGuideTitle}>Petunjuk Posisi Kamera</Text>
              <Text style={styles.cameraGuideQuote}>
                "Posisikan QR Code Kartu Pelajar di depan kamera hingga terbaca"
              </Text>
              <Text style={styles.cameraGuideNote}>
                Pastikan pencahayaan cukup dan kartu tidak buram. Sistem akan memverifikasi kesesuaian kartu dengan akun yang login.
              </Text>
              <TouchableOpacity
                style={styles.cameraGuideBtn}
                onPress={() => setShowCameraGuide(false)}
              >
                <Text style={styles.cameraGuideBtnText}>Oke, Saya Mengerti</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Bottom Action / Status Box */}
        <View style={styles.scanBottomAction}>
          <View style={styles.scanNoticeCard}>
            <ShieldAlert size={18} color="#f59e0b" />
            <Text style={styles.scanNoticeText}>
              Wajib memindai Kartu Pelajar milik Anda sendiri. Sistem akan menolak jika kartu tidak cocok dengan akun siswa yang login.
            </Text>
          </View>
          <Text style={styles.scanSystemFooter}>
            Sistem Verifikasi Kartu Siswa & Edge AI CBT Version 2.0
          </Text>
        </View>
      </View>
    );
  }

  // =========================================================================
  // STEP 2: BERANDA UJIAN SISWA (CARD IDENTITAS PESERTA & SOAL)
  // =========================================================================
  if (currentStep === 'beranda') {
    return (
      <View style={styles.stepContainerLight}>
        <LinearGradient colors={['#3740A1', '#1E257F']} style={styles.berandaHeader}>
          <View style={styles.berandaHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.berandaTitle}>Beranda Ujian CBT</Text>
              <Text style={styles.berandaSubtitle}>Konfirmasi data kepesertaan sebelum mulai</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Tombol Refresh Header Beranda */}
              <TouchableOpacity
                style={styles.berandaRefreshBtn}
                onPress={handleRefreshBeranda}
                disabled={isRefreshingBeranda}
                activeOpacity={0.7}
              >
                {isRefreshingBeranda ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <RefreshCw size={13} color="#fff" />
                )}
                <Text style={styles.berandaRefreshBtnText}>
                  {isRefreshingBeranda ? 'Memuat...' : 'Refresh'}
                </Text>
              </TouchableOpacity>

              <View style={styles.badgeJenis}>
                <Text style={styles.badgeJenisText}>{jadwal?.jenis_ujian || 'Ujian'}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.berandaContent, { paddingBottom: 40 + Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20) }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingBeranda}
              onRefresh={handleRefreshBeranda}
              colors={['#3740A1']}
              tintColor="#3740A1"
            />
          }
        >
          {/* Status Terblokir Banner */}
          {(isBlocked || sesi?.status === 'diblokir') && (
            <View style={styles.blockedCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AlertCircle size={30} color="#dc2626" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockedCardTitle}>Akses Ujian Terblokir</Text>
                  <Text style={styles.blockedCardSub}>
                    Kamu terblokir, silahkan hubungi pengawas ruang untuk membuka kembali akses ujian Anda.
                  </Text>
                </View>
              </View>

              {/* Tombol Periksa Status Pembukaan Blokir di dalam Banner */}
              <TouchableOpacity
                style={styles.blockedRefreshBtn}
                onPress={handleRefreshBeranda}
                disabled={isRefreshingBeranda}
                activeOpacity={0.8}
              >
                {isRefreshingBeranda ? (
                  <ActivityIndicator size="small" color="#dc2626" />
                ) : (
                  <RefreshCw size={14} color="#dc2626" />
                )}
                <Text style={styles.blockedRefreshBtnText}>
                  {isRefreshingBeranda ? 'Memeriksa Status Pengawas...' : 'Periksa Pembukaan Blokir Sekarang'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* CARD 1: IDENTITAS PESERTA */}
          <View style={styles.berandaCard}>
            <View style={styles.berandaCardHeader}>
              <User size={18} color="#3740A1" />
              <Text style={styles.berandaCardTitle}>Identitas Peserta Ujian</Text>
            </View>
            <View style={styles.pesertaRow}>
              <View style={styles.pesertaAvatar}>
                <Text style={styles.pesertaAvatarText}>
                  {siswa?.nama ? siswa.nama.charAt(0).toUpperCase() : 'S'}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.pesertaNama}>{siswa?.nama || 'Peserta Ujian'}</Text>
                <Text style={styles.pesertaMeta}>
                  NISN / NIPD: {siswa?.nisn || siswa?.nipd || '-'}
                </Text>
                <Text style={styles.pesertaMeta}>
                  Kelas: {siswa?.kelas || jadwal?.data_kelas?.nama_kelas || '-'}
                </Text>
                <Text style={styles.pesertaMeta}>
                  Ruang: {jadwal?.data_ruang?.nama_ruang || 'Lab Komputer CBT'}
                </Text>
              </View>
            </View>
          </View>

          {/* CARD 2: IDENTITAS SOAL & KETENTUAN UJIAN */}
          <View style={styles.berandaCard}>
            <View style={styles.berandaCardHeader}>
              <BookOpen size={18} color="#3740A1" />
              <Text style={styles.berandaCardTitle}>Identitas Soal & Ketentuan Ujian</Text>
            </View>
            <View style={styles.soalMetaGrid}>
              <View style={styles.soalMetaItem}>
                <Text style={styles.soalMetaLabel}>Mata Pelajaran</Text>
                <Text style={styles.soalMetaValHighlight}>
                  {jadwal?.data_mapel?.nama_mapel || jadwal?.nama_ujian || '-'}
                </Text>
              </View>
              <View style={styles.soalMetaItem}>
                <Text style={styles.soalMetaLabel}>Jumlah Soal</Text>
                <Text style={styles.soalMetaVal}>{soalList.length} Butir Soal</Text>
              </View>
              <View style={styles.soalMetaItem}>
                <Text style={styles.soalMetaLabel}>Durasi Pengerjaan</Text>
                <Text style={styles.soalMetaVal}>{jadwal?.durasi_menit || 60} Menit</Text>
              </View>
              <View style={styles.soalMetaItem}>
                <Text style={styles.soalMetaLabel}>Pengawas Ruang</Text>
                <Text style={styles.soalMetaVal}>{jadwal?.data_guru?.nama || 'Pengawas Ruang'}</Text>
              </View>
              <View style={[styles.soalMetaItem, { width: '100%' }]}>
                <Text style={styles.soalMetaLabel}>Metode Pengawasan</Text>
                <Text style={[styles.soalMetaVal, { color: '#16a34a', fontWeight: 'bold' }]}>
                  Edge AI Proctoring (Kamera Depan & Anti-Kecurangan)
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Tombol Mulai Ujian */}
        <View style={[styles.berandaFooter, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20) + 14 }]}>
          <TouchableOpacity
            style={[
              styles.startExamBtn,
              (isBlocked || sesi?.status === 'diblokir') && styles.startExamBtnBlocked
            ]}
            onPress={() => {
              if (isBlocked || sesi?.status === 'diblokir') {
                handleRefreshBeranda();
              } else {
                handleStartExam();
              }
            }}
          >
            {isBlocked || sesi?.status === 'diblokir' ? (
              <>
                {isRefreshingBeranda ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <RefreshCw size={18} color="#fff" />
                )}
                <Text style={styles.startExamBtnText}>
                  {isRefreshingBeranda ? 'Memeriksa Izin Pengawas...' : 'Ujian Terblokir • Tap untuk Cek Status'}
                </Text>
              </>
            ) : (
              <>
                <Play size={20} color="#fff" />
                <Text style={styles.startExamBtnText}>Mulai Mengerjakan Ujian Sekarang</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // =========================================================================
  // STEP 3: LEMBAR SOAL SISWA
  // =========================================================================
  return (
    <View style={styles.container}>
      {/* Blocked Overlay */}
      {(isBlocked || sesi?.status === 'diblokir') && (
        <View style={styles.blockedOverlay}>
          <AlertCircle size={60} color="#ef4444" />
          <Text style={styles.blockedOverlayTitle}>Kamu Terblokir</Text>
          <Text style={styles.blockedOverlaySub}>
            Kamu terblokir, silahkan hubungi pengawas ruang untuk membuka kembali akses ujian Anda.
          </Text>
        </View>
      )}

      {/* Paused Overlay */}
      {isPaused && (
        <View style={styles.pausedOverlay}>
          <AlertCircle size={54} color="#f59e0b" />
          <Text style={styles.pausedTitle}>Ujian Sedang Dijeda</Text>
          <Text style={styles.pausedSub}>
            Pengawas telah menjeda sesi ujian Anda. Harap menunggu instruksi selanjutnya.
          </Text>
        </View>
      )}

      {/* Sticky Header */}
      <View style={styles.topBar}>
        {/* Baris Utama: Nama Mapel & Identitas Siswa */}
        <View style={styles.topBarMainRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.topBarMapel} numberOfLines={1}>
              {jadwal?.data_mapel?.nama_mapel || jadwal?.nama_ujian || 'Ujian CBT'}
            </Text>
            <Text style={styles.topBarSiswa}>
              {siswa?.nama || 'Siswa'} ({siswa?.kelas || '-'})
            </Text>
          </View>
        </View>

        {/* Baris Bawah Header: Waktu Ujian, Tombol Refresh, & Tombol Palette Soal */}
        <View style={styles.topBarSubRow}>
          {/* Timer Badge */}
          <View style={[styles.timerBox, sisaDetik < 300 && styles.timerBoxUrgent]}>
            <Clock size={15} color={sisaDetik < 300 ? '#dc2626' : '#1e293b'} />
            <Text style={[styles.timerText, sisaDetik < 300 && styles.timerTextUrgent]}>
              {formatTime(sisaDetik)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* Tombol Refresh Soal Dinamis */}
            <TouchableOpacity
              style={styles.refreshSoalBtn}
              onPress={handleRefreshSoal}
              disabled={isRefreshingSoal}
              activeOpacity={0.7}
            >
              {isRefreshingSoal ? (
                <ActivityIndicator size={12} color="#3740A1" />
              ) : (
                <RefreshCw size={13} color="#3740A1" />
              )}
              <Text style={styles.refreshSoalBtnText}>
                {isRefreshingSoal ? 'Memuat...' : 'Refresh'}
              </Text>
            </TouchableOpacity>

            {/* Palette Drawer Trigger */}
            <TouchableOpacity style={styles.drawerBtn} onPress={() => setShowDrawer(true)}>
              <LayoutGrid size={15} color="#3740A1" />
              <Text style={styles.drawerBtnText}>Nomor: {currentIndex + 1}/{soalList.length}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Floating Front Camera Proctoring View (Di Bawah, di Atas Tombol Navigasi) */}
      {permission?.granted && settingsUjian?.tampilkan_kamera !== false && (
        <View style={[
          styles.cameraContainer,
          { bottom: Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20) + 72 },
          isCameraMinimized && styles.cameraMinimized
        ]}>
          {/* CameraView selalu di-mount agar cameraRef.current tidak null saat broadcast */}
          {/* Saat minimized: sembunyikan via opacity+absolute agar takePictureAsync tetap bisa berjalan */}
          <View style={[
            styles.cameraFrame,
            isCameraMinimized && {
              position: 'absolute',
              width: 80,
              height: 60,
              opacity: 0,
              top: -200,
              left: -200,
              pointerEvents: 'none',
            }
          ]}>
            {proctorCameraReady ? (
              <CameraView
                key="ai-proctor-front-camera"
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="front"
                flash="off"
                enableTorch={false}
                animateShutter={false}
                mute={true}
                onCameraReady={() => {
                  isCameraNativeReadyRef.current = true;
                  setIsCameraNativeReady(true);
                }}
              />
            ) : null}

            {/* Spinner loading saat kamera depan sedang warming-up */}
            {!isCameraNativeReady && (
              <View style={styles.cameraLoadingOverlay}>
                <ActivityIndicator size="small" color="#22c55e" />
              </View>
            )}

            {/* Tulisan AI Proctor / Status Pelanggaran di bagian ATAS video */}
            <View style={[
              styles.cameraBadge,
              currentFaceStatus !== 'normal' && { backgroundColor: 'rgba(220, 38, 38, 0.85)' }
            ]}>
              <View style={[
                styles.cameraDot,
                currentFaceStatus !== 'normal'
                  ? { backgroundColor: '#ef4444' }
                  : !isCameraNativeReady
                  ? { backgroundColor: '#eab308' }
                  : { backgroundColor: '#22c55e' }
              ]} />
              <Text style={styles.cameraBadgeText}>
                {currentFaceStatus === 'look_left_right'
                  ? 'Menengok!'
                  : currentFaceStatus === 'tilt_up_down'
                  ? 'Kepala Miring!'
                  : currentFaceStatus === 'no_face'
                  ? 'Wajah Hilang!'
                  : currentFaceStatus === 'multiple_faces'
                  ? 'Multi Wajah!'
                  : isCameraNativeReady
                  ? 'AI Proctor Aktif'
                  : 'Memuat Proctor...'}
              </Text>
            </View>

            {/* Tombol minimize sekarang di POJOK KANAN BAWAH video */}
            <TouchableOpacity
              style={styles.camMinimizeBtn}
              onPress={() => setIsCameraMinimized(true)}
            >
              <Minimize2 size={13} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Badge minimized — tampil di atas CameraView yang sudah di-collapse */}
          {isCameraMinimized && (
            <TouchableOpacity
              style={styles.cameraMinimizedBadge}
              onPress={() => setIsCameraMinimized(false)}
            >
              <View style={[
                styles.cameraDot,
                currentFaceStatus !== 'normal' && { backgroundColor: '#ef4444' }
              ]} />
              <Camera size={14} color={currentFaceStatus !== 'normal' ? '#dc2626' : '#16a34a'} />
              <Maximize2 size={12} color="#475569" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Question Card Content */}
      {currentSoal ? (
        <ScrollView
          style={styles.questionScroll}
          contentContainerStyle={[styles.questionContent, { paddingBottom: 130 + Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20) }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingSoal}
              onRefresh={handleRefreshSoal}
              colors={['#3740A1']}
            />
          }
        >
          {/* Question Meta Header */}
          <View style={styles.questionMetaHeader}>
            <View style={styles.questionNumBadge}>
              <Text style={styles.questionNumText}>Soal No. {currentIndex + 1}</Text>
            </View>
            <View style={styles.badgeSoalType}>
              <Text style={styles.badgeSoalTypeText}>
                {currentSoal.jenis_soal === 'pg' ? 'Pilihan Ganda' : currentSoal.jenis_soal === 'isian' ? 'Isian Singkat' : 'Esai'}
              </Text>
            </View>
            <Text style={styles.bobotText}>Bobot: {currentSoal.bobot_nilai || 1} Poin</Text>
          </View>

          {/* Question Text */}
          <Text style={styles.pertanyaanText}>{currentSoal.pertanyaan}</Text>

          {/* Jawaban Pilihan Ganda (PG) */}
          {currentSoal.jenis_soal === 'pg' && (() => {
            const rawOptions = parseOpsiJawaban(currentSoal.opsi_jawaban);
            const optionsToRender = rawOptions.length > 0 
              ? rawOptions 
              : ['A', 'B', 'C', 'D'].map(k => ({ id: k, text: '' }));

            return (
              <View style={styles.opsiContainer}>
                {optionsToRender.map((op, idx) => {
                  const key = op.id;
                  const displayLabel = String.fromCharCode(65 + idx);
                  const isSelected = currentAnswer?.jawaban === key;

                  return (
                    <TouchableOpacity
                      key={key || idx}
                      activeOpacity={0.7}
                      style={[styles.opsiCard, isSelected && styles.opsiCardSelected]}
                      onPress={() => handleAnswerChange(key)}
                    >
                      <View style={[styles.opsiRadio, isSelected && styles.opsiRadioSelected]}>
                        <Text style={[styles.opsiRadioText, isSelected && styles.opsiRadioTextSelected]}>
                          {displayLabel}
                        </Text>
                      </View>
                      <Text style={[styles.opsiContentText, isSelected && styles.opsiContentTextSelected]}>
                        {op.text || `Pilihan ${displayLabel}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })()}

          {/* Jawaban Isian Singkat */}
          {currentSoal.jenis_soal === 'isian' && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Tuliskan jawaban singkat Anda:</Text>
              <TextInput
                style={styles.textInputIsian}
                placeholder="Ketik jawaban Anda di sini..."
                placeholderTextColor="#9ca3af"
                value={currentAnswer?.jawaban || ''}
                onChangeText={handleAnswerChange}
              />
            </View>
          )}

          {/* Jawaban Esai */}
          {currentSoal.jenis_soal === 'esai' && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Tuliskan uraian jawaban Anda:</Text>
              <TextInput
                style={styles.textInputEsai}
                placeholder="Tuliskan penjelasan atau langkah-langkah lengkap..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={currentAnswer?.jawaban || ''}
                onChangeText={handleAnswerChange}
              />
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <FileQuestion size={48} color="#94a3b8" />
          <Text style={{ marginTop: 12, fontSize: 16, color: '#475569', fontWeight: 'bold' }}>Soal tidak tersedia</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
            Data soal gagal dimuat atau belum diatur untuk jadwal ujian ini.
          </Text>
        </View>
      )}

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20) + 12 }]}>
        {/* Tombol Sebelumnya */}
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          disabled={currentIndex === 0}
          onPress={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
        >
          <ChevronLeft size={18} color={currentIndex === 0 ? '#94a3b8' : '#3740A1'} />
          <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]} numberOfLines={1}>
            Sebelumnya
          </Text>
        </TouchableOpacity>

        {/* Tombol Ragu-Ragu */}
        <TouchableOpacity
          style={[styles.raguBtn, currentAnswer?.is_ragu && styles.raguBtnActive]}
          onPress={handleToggleRagu}
        >
          {currentAnswer?.is_ragu ? (
            <CheckSquare size={16} color="#d97706" />
          ) : (
            <Square size={16} color="#64748b" />
          )}
          <Text style={[styles.raguBtnText, currentAnswer?.is_ragu && styles.raguBtnTextActive]} numberOfLines={1}>
            Ragu-Ragu
          </Text>
        </TouchableOpacity>

        {/* Tombol Selanjutnya atau Selesai */}
        {currentIndex < soalList.length - 1 ? (
          <TouchableOpacity
            style={styles.navBtnPrimary}
            onPress={() => setCurrentIndex((prev) => Math.min(soalList.length - 1, prev + 1))}
          >
            <Text style={styles.navBtnPrimaryText} numberOfLines={1}>Berikutnya</Text>
            <ChevronRight size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.navBtnSubmit}
            onPress={() => {
              if (stats.ragu > 0) {
                Alert.alert(
                  'Masih Ada Soal Ragu-Ragu!',
                  `Anda masih memiliki ${stats.ragu} butir soal yang ditandai ragu-ragu. Harap periksa dan hilangkan tanda centang ragu-ragu sebelum mengumpulkan ujian.`,
                  [{ text: 'Periksa Soal', style: 'default' }]
                );
                return;
              }
              setShowConfirmModal(true);
            }}
          >
            <Send size={15} color="#fff" />
            <Text style={styles.navBtnPrimaryText} numberOfLines={1}>Kumpulkan</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal Daftar Soal (Question Palette Drawer) */}
      <Modal
        visible={showDrawer}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDrawer(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.drawerSheet,
              { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20) + 16 }
            ]}
          >
            {/* Sheet Header */}
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Daftar Butir Soal</Text>
              <TouchableOpacity onPress={() => setShowDrawer(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Tutup</Text>
              </TouchableOpacity>
            </View>

            {/* Legend Stats */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#22c55e' }]} />
                <Text style={styles.legendText}>Dijawab ({stats.answered})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.legendText}>Ragu ({stats.ragu})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: '#e2e8f0' }]} />
                <Text style={styles.legendText}>Kosong ({stats.unanswered})</Text>
              </View>
            </View>

            {/* Grid Soal */}
            <ScrollView contentContainerStyle={styles.drawerGrid}>
              {soalList.map((item, idx) => {
                const ans = jawabanMap[item.id];
                const hasAnswer = ans?.jawaban && ans.jawaban.trim() !== '';
                const isRagu = ans?.is_ragu;
                const isCurrent = idx === currentIndex;

                let bg = '#f1f5f9';
                let textColor = '#475569';

                if (isRagu) {
                  bg = '#fef3c7';
                  textColor = '#b45309';
                } else if (hasAnswer) {
                  bg = '#dcfce7';
                  textColor = '#15803d';
                }

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.gridItem,
                      { backgroundColor: bg },
                      isCurrent && styles.gridItemCurrent
                    ]}
                    onPress={() => {
                      setCurrentIndex(idx);
                      setShowDrawer(false);
                    }}
                  >
                    <Text style={[styles.gridItemText, { color: textColor }]}>{idx + 1}</Text>
                    {hasAnswer && (
                      <Text style={[styles.gridSubText, { color: textColor }]} numberOfLines={1}>
                        {ans?.jawaban}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Drawer Submit Button */}
            <TouchableOpacity
              style={[styles.drawerSubmitBtn, stats.ragu > 0 && { backgroundColor: '#f59e0b' }]}
              onPress={() => {
                if (stats.ragu > 0) {
                  Alert.alert(
                    'Masih Ada Soal Ragu-Ragu!',
                    `Anda masih memiliki ${stats.ragu} butir soal yang ditandai ragu-ragu. Harap periksa dan hilangkan tanda centang ragu-ragu sebelum mengumpulkan ujian.`
                  );
                  return;
                }
                setShowDrawer(false);
                setShowConfirmModal(true);
              }}
            >
              <CheckCircle size={18} color="#fff" />
              <Text style={styles.drawerSubmitBtnText}>
                {stats.ragu > 0 ? `Ada ${stats.ragu} Soal Ragu-Ragu` : 'Selesai & Kumpulkan Ujian'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Konfirmasi Pengumpulan Ujian */}
      <Modal
        visible={showConfirmModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalBackdropCenter}>
          <View style={styles.confirmCard}>
            <ShieldCheck size={48} color="#3740A1" />
            <Text style={styles.confirmTitle}>Kumpulkan Lembar Ujian?</Text>
            <Text style={styles.confirmSub}>
              Pastikan Anda telah memeriksa seluruh jawaban Anda sebelum melakukan penyerahan.
            </Text>

            {/* Summary Box */}
            <View style={styles.confirmSummaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Soal:</Text>
                <Text style={styles.summaryVal}>{stats.total} butir</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sudah Dijawab:</Text>
                <Text style={[styles.summaryVal, { color: '#16a34a' }]}>{stats.answered} butir</Text>
              </View>
              {stats.unanswered > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Belum Dijawab:</Text>
                  <Text style={[styles.summaryVal, { color: '#dc2626' }]}>{stats.unanswered} butir</Text>
                </View>
              )}
              {stats.ragu > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Masih Ragu-ragu:</Text>
                  <Text style={[styles.summaryVal, { color: '#d97706', fontWeight: '800' }]}>{stats.ragu} butir</Text>
                </View>
              )}
            </View>

            {/* Peringatan Kritis Jika Masih Ada Soal Belum Dikerjakan */}
            {stats.unanswered > 0 && (
              <View style={[styles.raguAlertBox, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                <AlertCircle size={18} color="#dc2626" />
                <Text style={styles.raguAlertText}>
                  Ujian TIDAK DAPAT dikumpulkan karena masih ada {stats.unanswered} butir soal yang belum dikerjakan. Harap selesaikan seluruh butir soal terlebih dahulu.
                </Text>
              </View>
            )}

            {/* Peringatan Kritis Jika Masih Ada Ragu-Ragu */}
            {stats.ragu > 0 && (
              <View style={styles.raguAlertBox}>
                <AlertCircle size={18} color="#dc2626" />
                <Text style={styles.raguAlertText}>
                  Ujian TIDAK DAPAT dikumpulkan karena masih ada {stats.ragu} butir soal berstatus ragu-ragu. Harap periksa dan hilangkan centang ragu-ragu terlebih dahulu.
                </Text>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                style={styles.confirmBtnCancel}
                onPress={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.confirmBtnCancelText}>Periksa Lagi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtnSubmit,
                  (stats.ragu > 0 || stats.unanswered > 0) && styles.confirmBtnSubmitDisabled
                ]}
                onPress={() => finalizeSubmission(false)}
                disabled={stats.ragu > 0 || stats.unanswered > 0 || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnSubmitText}>
                    {stats.unanswered > 0
                      ? `Terkunci (${stats.unanswered} Belum)`
                      : stats.ragu > 0
                      ? 'Terkunci (Ada Ragu)'
                      : 'Ya, Kumpulkan'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Peringatan Pelanggaran Tombol / Keluar Aplikasi */}
      <Modal
        visible={!!showViolationWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowViolationWarning(null)}
      >
        <View style={styles.modalBackdropCenter}>
          <View style={[styles.confirmCard, { borderColor: '#ef4444', borderWidth: 2 }]}>
            <ShieldAlert size={52} color="#dc2626" />
            <Text style={[styles.confirmTitle, { color: '#dc2626', textAlign: 'center' }]}>
              PERINGATAN PELANGGARAN!
            </Text>
            <Text style={[styles.confirmSub, { marginTop: 10 }]}>{showViolationWarning}</Text>
            <TouchableOpacity
              style={styles.warningActionBtn}
              onPress={() => setShowViolationWarning(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.warningActionBtnText}>Saya Mengerti & Lanjutkan Ujian</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 14,
  },
  loadingSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  pausedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  pausedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginTop: 16,
  },
  pausedSub: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  topBar: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  topBarMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  topBarMapel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  topBarSiswa: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  timerBoxUrgent: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  timerTextUrgent: {
    color: '#dc2626',
  },
  refreshSoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  refreshSoalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3740A1',
  },
  drawerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  drawerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3740A1',
  },
  cameraContainer: {
    position: 'absolute',
    right: 14,
    zIndex: 100,
  },
  cameraFrame: {
    width: 104,
    height: 130,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#22c55e',
    backgroundColor: '#000000',
    position: 'relative',
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  cameraBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  cameraDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  cameraBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  camMinimizeBtn: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    padding: 3,
  },
  cameraMinimized: {},
  cameraMinimizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#86efac',
    gap: 4,
  },
  questionScroll: {
    flex: 1,
  },
  questionContent: {
    padding: 16,
    paddingBottom: 90,
  },
  questionMetaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  questionNumBadge: {
    backgroundColor: '#3740A1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  questionNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  badgeSoalType: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSoalTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3740A1',
  },
  bobotText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 'auto',
  },
  pertanyaanText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    lineHeight: 24,
    marginBottom: 20,
  },
  opsiContainer: {
    gap: 10,
  },
  opsiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  opsiCardSelected: {
    borderColor: '#3740A1',
    backgroundColor: '#f5f3ff',
  },
  opsiRadio: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  opsiRadioSelected: {
    borderColor: '#3740A1',
    backgroundColor: '#3740A1',
  },
  opsiRadioText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  opsiRadioTextSelected: {
    color: '#fff',
  },
  opsiContentText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  opsiContentTextSelected: {
    color: '#1e257f',
    fontWeight: '600',
  },
  inputContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  textInputIsian: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  textInputEsai: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    minHeight: 120,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    gap: 4,
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  navBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3740A1',
  },
  navBtnTextDisabled: {
    color: '#94a3b8',
  },
  raguBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 5,
  },
  raguBtnActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  raguBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  raguBtnTextActive: {
    color: '#d97706',
  },
  navBtnPrimary: {
    flex: 1.15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#3740A1',
    gap: 4,
  },
  navBtnSubmit: {
    flex: 1.15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    gap: 4,
  },
  navBtnPrimaryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  drawerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3740A1',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  drawerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
  },
  gridItem: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  gridItemCurrent: {
    borderWidth: 2,
    borderColor: '#3740A1',
  },
  gridItemText: {
    fontSize: 14,
    fontWeight: '700',
  },
  gridSubText: {
    fontSize: 10,
    fontWeight: '800',
  },
  drawerSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    minHeight: 48,
    gap: 8,
  },
  drawerSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 12,
  },
  confirmSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  confirmSummaryBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#475569',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  confirmBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  confirmBtnCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtnSubmit: {
    flex: 1,
    backgroundColor: '#3740A1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  raguAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    gap: 8,
  },
  raguAlertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#b91c1c',
    lineHeight: 16,
  },
  confirmBtnSubmitDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7,
  },
  warningActionBtn: {
    width: '100%',
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
  },
  warningActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  // STEP 1 & 2 STYLES
  stepContainerDark: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
  },
  stepHeaderCenter: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#3740A1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoCircleText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  stepScanTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  stepScanSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  scanBox: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 4 / 3,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    position: 'relative',
  },
  scanFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanOverlayFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    margin: 20,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#38bdf8',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  laserBeam: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '50%',
    height: 2,
    backgroundColor: '#38bdf8',
  },
  scanHintText: {
    position: 'absolute',
    bottom: 12,
    fontSize: 11,
    color: '#cbd5e1',
    textAlign: 'center',
    paddingHorizontal: 16,
    fontWeight: '600',
  },
  cameraGuideCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  cameraGuideIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cameraGuideTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#3740A1',
    marginBottom: 8,
  },
  cameraGuideQuote: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  cameraGuideNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  cameraGuideBtn: {
    width: '100%',
    backgroundColor: '#3740A1',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  cameraGuideBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  scanStudentBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    marginTop: 10,
  },
  scanStudentLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 1,
  },
  scanStudentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
    textAlign: 'center',
  },
  scanStudentMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },
  scanControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 6,
  },
  flipCamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  flipCamBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  scanBottomAction: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  scanNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 12,
    width: '100%',
    maxWidth: 360,
  },
  scanNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#fde68a',
    lineHeight: 16,
    fontWeight: '500',
  },
  scanSystemFooter: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
  stepContainerLight: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  berandaHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  berandaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  berandaTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  berandaSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  badgeJenis: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeJenisText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  berandaContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 30,
  },
  blockedCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    padding: 16,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  blockedCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#dc2626',
  },
  blockedCardSub: {
    fontSize: 11,
    color: '#991b1b',
    marginTop: 2,
    lineHeight: 16,
  },
  berandaCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  berandaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  berandaCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pesertaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pesertaAvatar: {
    width: 60,
    height: 70,
    borderRadius: 14,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pesertaAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3740A1',
  },
  pesertaNama: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  pesertaMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  soalMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  soalMetaItem: {
    width: '50%',
    paddingRight: 8,
  },
  soalMetaLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  soalMetaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
  },
  soalMetaValHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3740A1',
    marginTop: 2,
  },
  berandaFooter: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  startExamBtn: {
    backgroundColor: '#3740A1',
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startExamBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  startExamBtnBlocked: {
    backgroundColor: '#dc2626',
  },
  startExamBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  berandaRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  berandaRefreshBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  blockedRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#f87171',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 10,
    width: '100%',
  },
  blockedRefreshBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },
  blockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  blockedOverlayTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ef4444',
    marginTop: 16,
  },
  blockedOverlaySub: {
    fontSize: 14,
    color: '#e2e8f0',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
