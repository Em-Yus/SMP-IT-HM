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
  AppState
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
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
  QrCode
} from 'lucide-react-native';
import { supabase } from '../../services/supabaseClient';
import { calculateCbtFinalScore } from '../services/cbt/scoringService';

export default function CbtUjian() {
  const { jadwalId } = useLocalSearchParams<{ jadwalId: string }>();

  // Permissions & Cam
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraMinimized, setIsCameraMinimized] = useState(false);

  // States
  const [currentStep, setCurrentStep] = useState<'scan' | 'beranda' | 'soal'>('scan');
  const [showCameraGuide, setShowCameraGuide] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

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

  const handleStartExam = () => {
    if (isBlocked || sesi?.status === 'diblokir') {
      Alert.alert('Kamu Terblokir', 'Kamu terblokir, silahkan hubungi pengawas.');
      return;
    }
    setCurrentStep('soal');
    if (sesi?.id) {
      startTimer(sesi.id);
    }
  };

  // Helper Pencatatan Pelanggaran Otomatis ke Supabase
  const recordViolation = async (jenis: string, durasi: number = 0) => {
    if (!sesiRef.current?.id) return;
    try {
      await supabase.from('cbt_log_pelanggaran').insert({
        sesi_id: sesiRef.current.id,
        jenis_pelanggaran: jenis,
        durasi_detik: durasi,
        timestamp: new Date().toISOString()
      });

      const newTotal = (sesiRef.current.total_pelanggaran || 0) + 1;
      setSesi((prev: any) => (prev ? { ...prev, total_pelanggaran: newTotal } : prev));
      await supabase
        .from('cbt_sesi_siswa')
        .update({ total_pelanggaran: newTotal })
        .eq('id', sesiRef.current.id);
    } catch (e) {
      console.error('Gagal mencatat log pelanggaran:', e);
    }
  };

  // 1. Detektor Tombol Hardware / Software Back di Android
  useEffect(() => {
    const backAction = () => {
      recordViolation('tombol_kembali', 0);
      setShowViolationWarning(
        'PERINGATAN: Anda menekan tombol KEMBALI! Ujian sedang berlangsung. Keluar dari lembar ujian dilarang dan kejadian ini telah dicatat oleh sistem pengawas!'
      );
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  // 2. Detektor Tombol Home / Overview (Recent Apps) / Minimize / Split Screen
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        // Siswa keluar dari aplikasi (tekan Home, Recent Apps, atau buka aplikasi lain)
        leaveTimeRef.current = Date.now();
        recordViolation('keluar_aplikasi', 0);
      } else if (nextAppState === 'active' && leaveTimeRef.current) {
        // Siswa kembali ke aplikasi
        const awaySeconds = Math.max(1, Math.round((Date.now() - leaveTimeRef.current) / 1000));
        leaveTimeRef.current = null;
        setShowViolationWarning(
          `PERINGATAN PELANGGARAN!\n\nAnda terdeteksi meninggalkan layar ujian selama ${awaySeconds} detik (menekan tombol Home / berpindah aplikasi / membuka split screen).\n\nPelanggaran ini telah dicatat dan pengawas ruang menerima notifikasi secara langsung!`
        );
      }
    });

    return () => subscription.remove();
  }, []);

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

  // Broadcast Snapshot Kamera Mobile ke Ruang Pengawas secara Realtime
  // PENTING: Tunggu status SUBSCRIBED sebelum mulai capture agar frame tidak hilang
  useEffect(() => {
    if (currentStep !== 'soal' || isBlocked || !jadwalId || !siswa?.id || !permission?.granted) return;

    const channelName = `cbt_exam_${jadwalId}`;
    const channel = supabase.channel(channelName);

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isCapturing = false;

    channel.subscribe(async (status: string) => {
      if (status !== 'SUBSCRIBED') return;

      const captureAndSend = async () => {
        if (isCapturing || !cameraRef.current) return;
        try {
          isCapturing = true;
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.2,
            base64: false, // Don't ask for base64 here since we'll manipulate it anyway
            skipProcessing: true,
          });

          if (photo?.uri) {
            // Downscale aggressively to match web app (160x120) so it doesn't drop from Supabase WebSocket limits
            const manipResult = await ImageManipulator.manipulateAsync(
              photo.uri,
              [{ resize: { width: 160 } }],
              { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (manipResult.base64) {
              channel.send({
                type: 'broadcast',
                event: 'student_video_feed',
                payload: {
                  siswaId: siswa.id,
                  sesiId: sesi?.id,
                  image: `data:image/jpeg;base64,${manipResult.base64}`,
                  faceStatus: 'normal',
                  timestamp: Date.now(),
                },
              });
            }
          }
        } catch (_err) {
          // Safe ignore — kamera belum siap atau izin dicabut
        } finally {
          isCapturing = false;
        }
      };

      // Kirim frame pertama setelah 1.5s (beri waktu kamera warm-up), lalu setiap 3.5s
      setTimeout(captureAndSend, 1500);
      intervalId = setInterval(captureAndSend, 3500);
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [currentStep, isBlocked, jadwalId, siswa?.id, sesi?.id, permission?.granted]);

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
        .select('*, data_mapel(nama_mapel), data_guru:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama), cbt_bank_soal(id, tingkat_kelas, skema_konversi)')
        .eq('id', jadwalId)
        .single();
      if (jErr || !jadwalData) throw new Error('Jadwal ujian tidak ditemukan.');
      setJadwal(jadwalData);

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
          .select('id, tingkat_kelas, skema_konversi')
          .eq('mapel_id', jadwalData.mapel_id)
          .eq('tingkat_kelas', tingkatSiswa)
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

      const { data: soalData, error: sErr } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', targetBankId)
        .order('nomor_urut', { ascending: true });
      if (sErr || !soalData || soalData.length === 0) {
        throw new Error('Bank soal belum memiliki butir pertanyaan.');
      }
      setSoalList(soalData);

      // 3. Ambil atau Buat Sesi Siswa
      let { data: existingSesi } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('jadwal_id', jadwalId)
        .eq('siswa_id', parsedSiswa.id)
        .maybeSingle();

      let activeSesi = existingSesi;

      if (!activeSesi) {
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

      // Realtime subscription untuk monitor kontrol pengawas
      setupRealtimeSubscription(activeSesi.id);
    } catch (err: any) {
      console.error('Error initExamSession:', err);
      Alert.alert('Gagal Memulai Ujian', err.message || 'Terjadi kesalahan sistem.');
      router.replace('/cbt-jadwal-siswa' as any);
    } finally {
      setLoading(false);
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

  const setupRealtimeSubscription = (sesiId: string) => {
    const channel = supabase
      .channel(`sesi_exam_${sesiId}`)
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

          if (newStatus === 'dijeda') {
            setIsPaused(true);
          } else if (newStatus === 'mengerjakan') {
            setIsPaused(false);
          } else if (newStatus === 'diblokir') {
            Alert.alert('Perhatian', 'Akses ujian Anda telah diblokir oleh pengawas.');
            router.replace('/cbt-jadwal-siswa' as any);
          }

          if (newSisaDetik && Math.abs(newSisaDetik - sisaDetikRef.current) > 60) {
            setSisaDetik(newSisaDetik);
            Alert.alert('Info Pengawas', 'Waktu ujian Anda telah disesuaikan oleh pengawas.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      { text: 'OK', onPress: () => finalizeSubmission() }
    ]);
  };

  const finalizeSubmission = async () => {
    if (!sesi || isSubmitting) return;
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
          // Esai dinilai oleh guru pada web app
          await supabase.from('cbt_jawaban_siswa').upsert({
            sesi_id: sesi.id,
            soal_id: soal.id,
            jawaban_siswa: userAns,
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

        skorEsai: 0,
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
            <CameraView style={StyleSheet.absoluteFill} facing="front" />
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
          <Text style={styles.scanHintText}>Posisikan Kartu Ujian atau Wajah Anda pada Area Kamera</Text>
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
                "Cari posisi yang nyaman dengan wajah menghadap kamera"
              </Text>
              <Text style={styles.cameraGuideNote}>
                Pastikan pencahayaan cukup dan wajah Anda terlihat jelas selama ujian berlangsung.
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

        {/* Bottom Action */}
        <View style={styles.scanBottomAction}>
          <TouchableOpacity
            style={styles.primaryActionBtn}
            onPress={() => setCurrentStep('beranda')}
          >
            <ShieldCheck size={20} color="#fff" />
            <Text style={styles.primaryActionBtnText}>Verifikasi & Lanjut ke Beranda Ujian</Text>
          </TouchableOpacity>
          <Text style={styles.scanSystemFooter}>
            Sistem Pengawasan Otomatis Edge AI CBT Version 2.0
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
            <View style={styles.badgeJenis}>
              <Text style={styles.badgeJenisText}>{jadwal?.jenis_ujian || 'Ujian'}</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.berandaContent}>
          {/* Status Terblokir Banner */}
          {(isBlocked || sesi?.status === 'diblokir') && (
            <View style={styles.blockedCard}>
              <AlertCircle size={30} color="#dc2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.blockedCardTitle}>Akses Ujian Terblokir</Text>
                <Text style={styles.blockedCardSub}>
                  Kamu terblokir, silahkan hubungi pengawas ruang untuk membuka kembali akses ujian Anda.
                </Text>
              </View>
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
        <View style={styles.berandaFooter}>
          <TouchableOpacity
            style={[styles.startExamBtn, (isBlocked || sesi?.status === 'diblokir') && styles.startExamBtnDisabled]}
            disabled={isBlocked || sesi?.status === 'diblokir'}
            onPress={handleStartExam}
          >
            <Play size={20} color="#fff" />
            <Text style={styles.startExamBtnText}>
              {(isBlocked || sesi?.status === 'diblokir') ? 'Ujian Terblokir' : 'Mulai Mengerjakan Ujian Sekarang'}
            </Text>
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
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarMapel} numberOfLines={1}>
            {jadwal?.data_mapel?.nama_mapel || jadwal?.nama_ujian || 'Ujian CBT'}
          </Text>
          <Text style={styles.topBarSiswa}>
            {siswa?.nama || 'Siswa'} ({siswa?.kelas || '-'})
          </Text>
        </View>

        {/* Timer Badge */}
        <View style={[styles.timerBox, sisaDetik < 300 && styles.timerBoxUrgent]}>
          <Clock size={16} color={sisaDetik < 300 ? '#dc2626' : '#1e293b'} />
          <Text style={[styles.timerText, sisaDetik < 300 && styles.timerTextUrgent]}>
            {formatTime(sisaDetik)}
          </Text>
        </View>

        {/* Palette Drawer Trigger */}
        <TouchableOpacity style={styles.drawerBtn} onPress={() => setShowDrawer(true)}>
          <LayoutGrid size={18} color="#3740A1" />
          <Text style={styles.drawerBtnText}>{currentIndex + 1}/{soalList.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Floating Front Camera Proctoring View */}
      {permission?.granted && (
        <View style={[styles.cameraContainer, isCameraMinimized && styles.cameraMinimized]}>
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
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
            />
            <View style={styles.cameraBadge}>
              <View style={styles.cameraDot} />
              <Text style={styles.cameraBadgeText}>AI Proctor Aktif</Text>
            </View>
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
              <View style={styles.cameraDot} />
              <Camera size={14} color="#16a34a" />
              <Maximize2 size={12} color="#475569" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Question Card Content */}
      {currentSoal ? (
        <ScrollView style={styles.questionScroll} contentContainerStyle={styles.questionContent}>
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
          {currentSoal.jenis_soal === 'pg' && (
            <View style={styles.opsiContainer}>
              {['A', 'B', 'C', 'D'].map((key) => {
                let opsiVal = '';
                if (typeof currentSoal.opsi_jawaban === 'object' && currentSoal.opsi_jawaban !== null) {
                  opsiVal = currentSoal.opsi_jawaban[key] || currentSoal.opsi_jawaban[key.toLowerCase()] || '';
                }
                const isSelected = currentAnswer?.jawaban === key;

                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.7}
                    style={[styles.opsiCard, isSelected && styles.opsiCardSelected]}
                    onPress={() => handleAnswerChange(key)}
                  >
                    <View style={[styles.opsiRadio, isSelected && styles.opsiRadioSelected]}>
                      <Text style={[styles.opsiRadioText, isSelected && styles.opsiRadioTextSelected]}>
                        {key}
                      </Text>
                    </View>
                    <Text style={[styles.opsiContentText, isSelected && styles.opsiContentTextSelected]}>
                      {opsiVal || `Pilihan ${key}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

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
      ) : null}

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {/* Tombol Sebelumnya */}
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          disabled={currentIndex === 0}
          onPress={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
        >
          <ChevronLeft size={20} color={currentIndex === 0 ? '#94a3b8' : '#3740A1'} />
          <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>Sebelumnya</Text>
        </TouchableOpacity>

        {/* Tombol Ragu-Ragu */}
        <TouchableOpacity
          style={[styles.raguBtn, currentAnswer?.is_ragu && styles.raguBtnActive]}
          onPress={handleToggleRagu}
        >
          {currentAnswer?.is_ragu ? (
            <CheckSquare size={18} color="#d97706" />
          ) : (
            <Square size={18} color="#64748b" />
          )}
          <Text style={[styles.raguBtnText, currentAnswer?.is_ragu && styles.raguBtnTextActive]}>
            Ragu-Ragu
          </Text>
        </TouchableOpacity>

        {/* Tombol Selanjutnya atau Selesai */}
        {currentIndex < soalList.length - 1 ? (
          <TouchableOpacity
            style={styles.navBtnPrimary}
            onPress={() => setCurrentIndex((prev) => Math.min(soalList.length - 1, prev + 1))}
          >
            <Text style={styles.navBtnPrimaryText}>Berikutnya</Text>
            <ChevronRight size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.navBtnSubmit}
            onPress={() => setShowConfirmModal(true)}
          >
            <Send size={16} color="#fff" />
            <Text style={styles.navBtnPrimaryText}>Kumpulkan</Text>
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
          <View style={styles.drawerSheet}>
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
              style={styles.drawerSubmitBtn}
              onPress={() => {
                setShowDrawer(false);
                setShowConfirmModal(true);
              }}
            >
              <CheckCircle size={18} color="#fff" />
              <Text style={styles.drawerSubmitBtnText}>Selesai & Kumpulkan Ujian</Text>
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
                  <Text style={[styles.summaryVal, { color: '#d97706' }]}>{stats.ragu} butir</Text>
                </View>
              )}
            </View>

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
                style={styles.confirmBtnSubmit}
                onPress={finalizeSubmission}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnSubmitText}>Ya, Kumpulkan</Text>
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
              style={[styles.confirmBtnSubmit, { backgroundColor: '#dc2626', marginTop: 20, width: '100%' }]}
              onPress={() => setShowViolationWarning(null)}
            >
              <Text style={styles.confirmBtnSubmitText}>Saya Mengerti & Lanjutkan Ujian</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
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
    top: Platform.OS === 'ios' ? 108 : 96,
    right: 14,
    zIndex: 100,
  },
  cameraFrame: {
    width: 100,
    height: 125,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#22c55e',
    backgroundColor: '#000',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
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
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    padding: 3,
  },
  cameraMinimized: {
    top: Platform.OS === 'ios' ? 108 : 96,
  },
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
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    gap: 4,
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3740A1',
  },
  navBtnTextDisabled: {
    color: '#94a3b8',
  },
  raguBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#3740A1',
    gap: 4,
  },
  navBtnSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    gap: 6,
  },
  navBtnPrimaryText: {
    fontSize: 13,
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
  scanBottomAction: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  primaryActionBtn: {
    width: '100%',
    backgroundColor: '#3740A1',
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  scanSystemFooter: {
    fontSize: 10,
    color: '#64748b',
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
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    padding: 14,
    flexDirection: 'row',
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
  startExamBtnText: {
    color: '#fff',
    fontSize: 14,
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
