import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import CryptoJS from 'crypto-js';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  ShieldCheck, ShieldAlert, Video, Flag, Save, RefreshCw, Send,
  User, BookOpen, PauseCircle, PlayCircle, Eye, AlertOctagon,
  Camera, Check, X, QrCode, LogOut, Sparkles
} from 'lucide-react';
import { evaluateShortAnswer, evaluateEssayWithAI } from '../../services/cbt/aiGradingService';
import { calculateCbtFinalScore } from '../../services/cbt/scoringService';
import { useEdgeFaceLandmarker } from '../../hooks/cbt/useEdgeFaceLandmarker';

const SECRET_KEY = import.meta.env.VITE_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

// Helper robust parsing opsi jawaban pilihan ganda
const parseOpsiJawaban = (rawOpsi) => {
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
    return parsed.map((item, idx) => {
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
          text: String(val?.text ?? val?.teks ?? ''),
          gambar_url: val?.gambar_url,
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
const processExamQuestions = (rawSoals, isAcakSoal, isAcakOpsi, siswaId, seedKey) => {
  if (!rawSoals || rawSoals.length === 0) return [];

  // Deterministic LCG-based Fisher-Yates shuffle
  const deterministicShuffle = (array, seed) => {
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
  const pgList = rawSoals.filter((s) => s.jenis_soal === 'pg');
  const isianList = rawSoals.filter((s) => s.jenis_soal === 'isian');
  const esaiList = rawSoals.filter((s) => s.jenis_soal === 'esai');
  const otherList = rawSoals.filter((s) => !['pg', 'isian', 'esai'].includes(s.jenis_soal));

  // 2. Acak soal per jenis soal secara mandiri jika isAcakSoal bernilai true
  const shuffledPg = isAcakSoal ? deterministicShuffle(pgList, baseSeed + 101) : pgList;
  const shuffledIsian = isAcakSoal ? deterministicShuffle(isianList, baseSeed + 202) : isianList;
  const shuffledEsai = isAcakSoal ? deterministicShuffle(esaiList, baseSeed + 303) : esaiList;

  // 3. Gabungkan dalam urutan baku: Pilihan Ganda -> Jawaban Singkat -> Esai -> Lainnya
  const orderedSoals = [...shuffledPg, ...shuffledIsian, ...shuffledEsai, ...otherList];

  // 4. Acak opsi jawaban untuk Pilihan Ganda jika isAcakOpsi bernilai true
  return orderedSoals.map((soal) => {
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

export default function CbtUjianSiswa() {
  const { jadwalId } = useParams();
  const navigate = useNavigate();

  // Workflow Step: 'scan' | 'beranda' | 'soal'
  const [currentStep, setCurrentStep] = useState('scan');

  // Scanner & Verifikasi Kartu Siswa
  const [isVerifyingCard, setIsVerifyingCard] = useState(false);
  const [isCardVerified, setIsCardVerified] = useState(false);
  const [cameraList, setCameraList] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [cameraFacing, setCameraFacing] = useState('user'); // 'user' (depan) | 'environment' (belakang)
  const [scannerError, setScannerError] = useState('');

  const scannerRef = useRef(null);
  const isVerifyingCardRef = useRef(false);
  const isCardVerifiedRef = useRef(false);
  const isResumingRef = useRef(false);

  useEffect(() => {
    isVerifyingCardRef.current = isVerifyingCard;
  }, [isVerifyingCard]);

  useEffect(() => {
    isCardVerifiedRef.current = isCardVerified;
  }, [isCardVerified]);

  // State Ujian & Siswa
  const [jadwal, setJadwal] = useState(null);
  const [soalList, setSoalList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [jawabanState, setJawabanState] = useState({});
  const [sesiSiswa, setSesiSiswa] = useState(null);
  const [currentSiswa, setCurrentSiswa] = useState(null);
  const [settingsUjian, setSettingsUjian] = useState(null);

  const [sisaDetik, setSisaDetik] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Refs untuk sinkronisasi state tanpa stale closure di dalam hook/callback
  const sesiSiswaRef = useRef(sesiSiswa);
  useEffect(() => {
    sesiSiswaRef.current = sesiSiswa;
  }, [sesiSiswa]);

  const settingsUjianRef = useRef(settingsUjian);
  useEffect(() => {
    settingsUjianRef.current = settingsUjian;
  }, [settingsUjian]);

  const isBlockedRef = useRef(isBlocked);
  useEffect(() => {
    isBlockedRef.current = isBlocked;
  }, [isBlocked]);

  // Helper Eksekusi Pemblokiran Siswa Secara Instan & Tuntas
  const triggerBlockStudent = async (reason = 'Pelanggaran pengawasan ujian AI', totalPelanggaran = null) => {
    if (isBlockedRef.current) return;
    setIsBlocked(true);
    isBlockedRef.current = true;

    try { Swal.close(); } catch (_) {}

    const curSesi = sesiSiswaRef.current;
    if (curSesi?.id) {
      const finalCount = totalPelanggaran ?? ((curSesi.total_pelanggaran || 0) + 1);
      setSesiSiswa(prev => ({ ...prev, status: 'diblokir', total_pelanggaran: finalCount }));

      try {
        await supabase
          .from('cbt_sesi_siswa')
          .update({
            status: 'diblokir',
            total_pelanggaran: finalCount,
          })
          .eq('id', curSesi.id);

        if (jadwalId) {
          const cmdChan = supabase.channel(`cbt_exam_cmd_${jadwalId}`);
          cmdChan.send({
            type: 'broadcast',
            event: 'student_block_status',
            payload: {
              sesiId: curSesi.id,
              siswaId: currentSiswa?.id,
              status: 'diblokir',
              reason: reason,
            },
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Gagal update status blokir ke database:', err);
      }
    }
  };

  // Hook Edge AI Pengawasan Wajah MediaPipe
  const { videoRef, faceStatus, violationCount, headAngles, cameraActive } = useEdgeFaceLandmarker({
    enabled: currentStep === 'soal' && !isBlocked,
    sampleIntervalMs: 400, // 300ms - 500ms
    debounceThresholdMs: 2500, // 2.0s - 3.0s (setiap 2.5s akumulasi anomali = 1 pelanggaran)
    onViolation: async (v) => {
      const curSesi = sesiSiswaRef.current;
      const curSettings = settingsUjianRef.current;

      console.warn(`[CBT Proctor] Pelanggaran AI terdeteksi: ${v.type}, count ke-${v.count}`);

      if (curSesi?.id && !isBlockedRef.current) {
        try {
          // 1. Catat ke tabel log pelanggaran
          await supabase.from('cbt_log_pelanggaran').insert([
            {
              sesi_id: curSesi.id,
              jenis_pelanggaran: v.type,
              sudut_yaw: v.yaw,
              sudut_pitch: v.pitch,
              durasi_detik: 2.5,
              keterangan: `Anomali wajah terdeteksi (${v.type}) - Pelanggaran terakumulasi ke-${v.count}`,
            },
          ]);

          const nextCount = v.count || ((curSesi.total_pelanggaran || 0) + 1);
          setSesiSiswa(prev => ({ ...prev, total_pelanggaran: nextCount }));

          // 2. Jika konfigurasi blokir_menengok aktif (default true) dan pelanggaran >= 3, blokir otomatis
          const isBlokirMenengok = curSettings ? curSettings.blokir_menengok !== false : true;
          if (isBlokirMenengok && nextCount >= 3) {
            console.error('[CBT Proctor] Akumulasi pelanggaran mencapai 3 kali! Memblokir siswa langsung...');
            await triggerBlockStudent('Akumulasi pelanggaran menengok / anomali wajah (3 kali)', nextCount);
          } else {
            await supabase
              .from('cbt_sesi_siswa')
              .update({ total_pelanggaran: nextCount })
              .eq('id', curSesi.id);
          }
        } catch (e) {
          console.warn('Gagal mencatat log pelanggaran:', e);
        }
      }
    },
  });

  // Safety net: Segera blokir jika hook useEdgeFaceLandmarker melaporkan violationCount >= 3
  useEffect(() => {
    if (violationCount >= 3 && !isBlocked && currentStep === 'soal') {
      const curSettings = settingsUjianRef.current;
      const isBlokirMenengok = curSettings ? curSettings.blokir_menengok !== false : true;
      if (isBlokirMenengok) {
        console.error('[CBT Proctor] Safety net: violationCount >= 3! Memblokir siswa...');
        triggerBlockStudent('Akumulasi pelanggaran menengok / anomali wajah (3 kali)', violationCount);
      }
    }
  }, [violationCount, isBlocked, currentStep]);

  // Ref untuk faceStatus agar selalu terbaca nilai terbaru tanpa re-trigger effect
  const faceStatusRef = useRef('normal');
  useEffect(() => {
    faceStatusRef.current = faceStatus;
  }, [faceStatus]);

  // Ref untuk sisaDetik agar selalu terbaca di broadcast tanpa re-trigger effect
  const sisaDetikRef = useRef(sisaDetik);
  useEffect(() => {
    sisaDetikRef.current = sisaDetik;
  }, [sisaDetik]);

  // Realtime Broadcast Kamera Siswa & Status Kehadiran ke Ruang Pengawas
  // PENTING: faceStatus & sisaDetik TIDAK masuk ke deps array — gunakan Ref
  // agar channel tidak di-teardown setiap 400ms saat AI update status wajah.
  useEffect(() => {
    if (currentStep !== 'soal' || isBlocked || !jadwalId || !currentSiswa?.id) return;

    const channelName = `cbt_exam_${jadwalId}`;
    const channel = supabase.channel(channelName);

    // Tunggu subscribe selesai baru mulai kirim frame & status
    let intervalId = null;
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        const sendFrame = () => {
          let dataUrl = null;
          const video = videoRef.current;
          if (video && video.readyState >= 2 && ctx) {
            try {
              ctx.drawImage(video, 0, 0, 160, 120);
              dataUrl = canvas.toDataURL('image/jpeg', 0.35);
            } catch (err) {
              // Safe ignore
            }
          }

          try {
            channel.send({
              type: 'broadcast',
              event: 'student_video_feed',
              payload: {
                siswaId: currentSiswa.id,
                sesiId: sesiSiswa?.id,
                image: dataUrl,
                faceStatus: faceStatusRef.current,
                isOpen: true,
                sisaDetik: sisaDetikRef.current,
                timestamp: Date.now(),
              },
            });
          } catch (err) {
            // Safe ignore
          }
        };

        // Kirim frame/status pertama segera, lalu setiap 3 detik
        sendFrame();
        intervalId = setInterval(sendFrame, 3000);
      }
    });

    const handleBeforeUnload = () => {
      try {
        channel.send({
          type: 'broadcast',
          event: 'student_presence',
          payload: {
            siswaId: currentSiswa.id,
            isOpen: false,
            timestamp: Date.now(),
          },
        });
      } catch (err) {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (intervalId) clearInterval(intervalId);
      try {
        channel.send({
          type: 'broadcast',
          event: 'student_presence',
          payload: {
            siswaId: currentSiswa?.id,
            isOpen: false,
            timestamp: Date.now(),
          },
        });
      } catch (err) {}
      supabase.removeChannel(channel);
    };
  }, [currentStep, isBlocked, jadwalId, currentSiswa?.id, sesiSiswa?.id]);

  // Anti-Cheat: Deteksi Tab Switch / Blur Browser
  useEffect(() => {
    if (currentStep !== 'soal' || isBlocked) return;

    const handleVisibilityChange = async () => {
      if (document.hidden && settingsUjian?.blokir_keluar_browser) {
        if (sesiSiswa?.id) {
          await supabase.from('cbt_log_pelanggaran').insert([
            {
              sesi_id: sesiSiswa.id,
              jenis_pelanggaran: 'tab_switch',
              durasi_detik: 1,
              keterangan: 'Siswa berpindah tab / keluar dari jendela ujian',
            },
          ]);

          // Beri sanksi pemblokiran jika diatur
          await supabase
            .from('cbt_sesi_siswa')
            .update({ status: 'diblokir' })
            .eq('id', sesiSiswa.id);

          setSesiSiswa((prev) => ({ ...prev, status: 'diblokir' }));
          setIsBlocked(true);
          try { Swal.close(); } catch (_) {}
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentStep, isBlocked, sesiSiswa, settingsUjian]);

  // Realtime Subscription: Mendengarkan perubahan status sesi siswa secara realtime (Blokir, Buka Blokir, Jeda, Tambah Waktu)
  useEffect(() => {
    if (!sesiSiswa?.id) return;

    const channelName = `cbt_sesi_live_${sesiSiswa.id}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cbt_sesi_siswa',
          filter: `id=eq.${sesiSiswa.id}`,
        },
        (payload) => {
          const updatedSesi = payload.new;
          if (!updatedSesi) return;

          setSesiSiswa((prev) => ({ ...prev, ...updatedSesi }));

          if (updatedSesi.status === 'diblokir') {
            setIsBlocked(true);
            try { Swal.close(); } catch (_) {}
          } else if (updatedSesi.status === 'mengerjakan') {
            setIsBlocked(false);
            setIsPaused(false);
            try { Swal.close(); } catch (_) {}
          } else if (updatedSesi.status === 'dijeda') {
            setIsPaused(true);
          }

          if (
            updatedSesi.sisa_detik !== undefined &&
            Math.abs(updatedSesi.sisa_detik - sisaDetikRef.current) > 60
          ) {
            setSisaDetik(updatedSesi.sisa_detik);
          }
        }
      )
      .subscribe();

    // Broadcast Listener untuk respon instan dari pengawas (0ms latency)
    let examCmdChannel = null;
    if (jadwalId) {
      examCmdChannel = supabase
        .channel(`cbt_exam_cmd_${jadwalId}`)
        .on('broadcast', { event: 'student_block_status' }, ({ payload }) => {
          if (payload?.sesiId === sesiSiswa.id || payload?.siswaId === currentSiswa?.id) {
            if (payload.status === 'diblokir') {
              setIsBlocked(true);
              setSesiSiswa((prev) => ({ ...prev, status: 'diblokir' }));
              try { Swal.close(); } catch (_) {}
            } else if (payload.status === 'mengerjakan') {
              setIsBlocked(false);
              setIsPaused(false);
              setSesiSiswa((prev) => ({ ...prev, status: 'mengerjakan' }));
              try { Swal.close(); } catch (_) {}
            }
          }
        })
        .subscribe();
    }

    // Polling sinkronisasi status setiap 2.5 detik sebagai pengaman jika koneksi realtime terputus/lambat
    const pollInterval = setInterval(async () => {
      try {
        const { data: latestSesi } = await supabase
          .from('cbt_sesi_siswa')
          .select('id, status, total_pelanggaran, sisa_detik')
          .eq('id', sesiSiswa.id)
          .maybeSingle();

        if (latestSesi) {
          if (latestSesi.status === 'diblokir') {
            setIsBlocked(true);
            setSesiSiswa((prev) => ({ ...prev, ...latestSesi }));
            try { Swal.close(); } catch (_) {}
          } else if (latestSesi.status === 'mengerjakan' && isBlocked) {
            setIsBlocked(false);
            setIsPaused(false);
            setSesiSiswa((prev) => ({ ...prev, ...latestSesi }));
            try { Swal.close(); } catch (_) {}
          } else if (latestSesi.status === 'dijeda' && !isPaused) {
            setIsPaused(true);
            setSesiSiswa((prev) => ({ ...prev, ...latestSesi }));
          }
        }
      } catch (_e) {}
    }, 2500);

    return () => {
      supabase.removeChannel(channel);
      if (examCmdChannel) supabase.removeChannel(examCmdChannel);
      clearInterval(pollInterval);
    };
  }, [sesiSiswa?.id, jadwalId, currentSiswa?.id, isBlocked, isPaused]);

  // Inisialisasi Data Ujian & Pengaturan
  useEffect(() => {
    initExamSession();
  }, [jadwalId]);

  const initExamSession = async () => {
    try {
      const storedSiswa = JSON.parse(
        localStorage.getItem('user_siswa') || localStorage.getItem('siswa_user') || '{}'
      );
      if (!storedSiswa.id) {
        Swal.fire('Belum Login', 'Silakan login terlebih dahulu sebagai Siswa.', 'warning')
          .then(() => navigate('/login-siswa'));
        return;
      }
      setCurrentSiswa(storedSiswa);

      // Ambil data siswa segar dari Supabase & tentukan tingkat kelas
      const { data: dbSiswa } = await supabase
        .from('data_siswa')
        .select('id, nama, kelas, nisn, nipd, status_keaktifan')
        .eq('id', storedSiswa.id)
        .maybeSingle();

      // Validasi status keaktifan siswa (Hanya siswa Aktif yang boleh mengakses ujian CBT)
      if (!dbSiswa || (dbSiswa.status_keaktifan && dbSiswa.status_keaktifan.toLowerCase() !== 'aktif')) {
        Swal.fire({
          icon: 'error',
          title: 'Akses Ujian Ditolak',
          text: `Akun siswa Anda saat ini berstatus "${dbSiswa?.status_keaktifan || 'Nonaktif'}". Hanya siswa berstatus "Aktif" yang berhak mengakses dan mengerjakan ujian CBT.`,
          confirmButtonText: 'Kembali ke Dashboard',
          confirmButtonColor: '#2a2c87',
          allowOutsideClick: false,
        }).then(() => navigate('/dashboard-siswa'));
        return;
      }

      const kelasSiswa = dbSiswa?.kelas || storedSiswa.kelas || '';
      let tingkatSiswa = null;

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
        if (upper.includes('VII') && !upper.includes('VIII')) tingkatSiswa = '7';
        else if (upper.includes('VIII')) tingkatSiswa = '8';
        else if (upper.includes('IX')) tingkatSiswa = '9';
        else {
          const m = upper.match(/\b([789])\b/);
          if (m) tingkatSiswa = m[1];
        }
      }

      // Ambil Jadwal
      const { data: jData, error: jErr } = await supabase
        .from('cbt_jadwal_ujian')
        .select(`
          *,
          data_mapel(nama_mapel),
          data_ruang(nama_ruang),
          pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama),
          cbt_bank_soal(id, total_soal, tingkat_kelas, acak_soal, acak_opsi, skema_konversi)
        `)
        .eq('id', jadwalId)
        .single();

      if (jErr || !jData) throw new Error('Jadwal ujian tidak ditemukan.');
      setJadwal(jData);

      // 1. Cek Sesi Siswa terlebih dahulu agar jika statusnya 'diblokir', UI langsung render Halaman Terblokir seketika
      let { data: sesi } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('jadwal_id', jadwalId)
        .eq('siswa_id', storedSiswa.id)
        .maybeSingle();

      if (sesi) {
        setSesiSiswa(sesi);
        setSisaDetik(sesi.sisa_detik || (jData.durasi_menit || 90) * 60);
        if (sesi.status === 'diblokir') {
          setIsBlocked(true);
        } else if (sesi.status === 'dijeda') {
          setIsPaused(true);
        }
        // Tandai apakah siswa sedang melanjutkan sesi yang sedang berjalan
        if (sesi.status === 'mengerjakan' || sesi.status === 'dijeda') {
          isResumingRef.current = true;
        } else {
          isResumingRef.current = false;
        }
        setCurrentStep('scan');
      } else {
        const initialSeconds = (jData.durasi_menit || 90) * 60;
        setSisaDetik(initialSeconds);
        isResumingRef.current = false;
        setCurrentStep('scan');
      }

      // Validasi Tanggal & Waktu Pelaksanaan Ujian (jika sesi baru dimulai)
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (!sesi || (sesi.status !== 'mengerjakan' && sesi.status !== 'diblokir' && sesi.status !== 'dijeda')) {
        if (jData.tanggal_ujian && jData.tanggal_ujian !== todayStr) {
          Swal.fire({
            icon: 'warning',
            title: 'Bukan Waktu Ujian',
            text: `Ujian ini dijadwalkan pada tanggal ${jData.tanggal_ujian}. Hari ini bukan tanggal pelaksanaan ujian tersebut.`,
            confirmButtonColor: '#2a2c87',
          }).then(() => navigate('/cbt/jadwal-siswa'));
          return;
        }

        if (jData.jam_mulai && nowTimeStr < jData.jam_mulai.slice(0, 5)) {
          Swal.fire({
            icon: 'info',
            title: 'Ujian Belum Dimulai',
            text: `Ujian ini baru dapat diakses pada pukul ${jData.jam_mulai.slice(0, 5)} WIB.`,
            confirmButtonColor: '#2a2c87',
          }).then(() => navigate('/cbt/jadwal-siswa'));
          return;
        }

        if (jData.jam_selesai && nowTimeStr > jData.jam_selesai.slice(0, 5)) {
          Swal.fire({
            icon: 'error',
            title: 'Waktu Ujian Berakhir',
            text: `Waktu pelaksanaan ujian ini telah berakhir pada pukul ${jData.jam_selesai.slice(0, 5)} WIB.`,
            confirmButtonColor: '#2a2c87',
          }).then(() => navigate('/cbt/jadwal-siswa'));
          return;
        }
      }

      // Ambil Pengaturan Ujian Global
      const { data: setRes } = await supabase
        .from('cbt_pengaturan_ujian')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSettingsUjian(setRes || {
        tampilkan_kamera: true,
        tampilkan_tombol_selesai_menit: 15,
        blokir_menengok: true,
        blokir_keluar_browser: true,
      });

      // Ambil Butir Soal dengan pencocokan kelas ketat
      let targetBank = null;
      if (jData.cbt_bank_soal?.id) {
        const bTingkat = String(jData.cbt_bank_soal.tingkat_kelas || '');
        if (!bTingkat || bTingkat === 'Semua' || (tingkatSiswa && bTingkat === tingkatSiswa)) {
          targetBank = jData.cbt_bank_soal;
        }
      }

      // Jika bank soal bawaan tidak sesuai tingkat kelas siswa, cari bank soal mapel ini yang sesuai kelas siswa
      if (!targetBank && jData.mapel_id && tingkatSiswa) {
        const { data: matchedBank } = await supabase
          .from('cbt_bank_soal')
          .select('id, tingkat_kelas, acak_soal, acak_opsi, skema_konversi')
          .eq('mapel_id', jData.mapel_id)
          .or(`tingkat_kelas.eq.${tingkatSiswa},tingkat_kelas.eq.Semua`)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (matchedBank?.id) {
          targetBank = matchedBank;
        }
      }

      // Jika tidak ditemukan bank soal untuk tingkat kelas siswa, tolak akses
      if (!targetBank) {
        const kelasLabel = tingkatSiswa ? `Kelas ${tingkatSiswa}` : (kelasSiswa || 'kelas Anda');
        Swal.fire({
          icon: 'warning',
          title: 'Akses Ujian Ditolak',
          text: `Bank soal untuk tingkat ${kelasLabel} belum tersedia pada ujian ini.`,
          confirmButtonColor: '#2a2c87',
        }).then(() => navigate('/cbt/jadwal-siswa'));
        return;
      }

      const targetBankId = targetBank.id;

      const { data: sData } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', targetBankId)
        .order('nomor_urut', { ascending: true });

      // Tentukan apakah acak soal dan acak opsi aktif berdasarkan pengaturan soal
      let isAcakSoal = false;
      if (targetBank && targetBank.acak_soal !== null && targetBank.acak_soal !== undefined) {
        isAcakSoal = Boolean(targetBank.acak_soal);
      } else if (jData && jData.acak_soal !== null && jData.acak_soal !== undefined) {
        isAcakSoal = Boolean(jData.acak_soal);
      }

      let isAcakOpsi = false;
      if (targetBank && targetBank.acak_opsi !== null && targetBank.acak_opsi !== undefined) {
        isAcakOpsi = Boolean(targetBank.acak_opsi);
      } else if (jData && jData.acak_opsi !== null && jData.acak_opsi !== undefined) {
        isAcakOpsi = Boolean(jData.acak_opsi);
      }

      const finalSoals = processExamQuestions(sData || [], isAcakSoal, isAcakOpsi, storedSiswa.id, jadwalId);
      setSoalList(finalSoals);

      // Ambil Jawaban Tersimpan
      if (sesi?.id) {
        const { data: storedAnswers } = await supabase
          .from('cbt_jawaban_siswa')
          .select('soal_id, jawaban_siswa, is_ragu')
          .eq('sesi_id', sesi.id);

        const loadedMap = {};
        (storedAnswers || []).forEach((a) => {
          loadedMap[a.soal_id] = {
            jawaban: a.jawaban_siswa || '',
            isRagu: !!a.is_ragu,
          };
        });
        setJawabanState(loadedMap);
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Pemberitahuan', err.message || 'Gagal memuat ujian.', 'error');
    }
  };

  // Timer Countdown Loop
  useEffect(() => {
    if (currentStep !== 'soal' || isPaused || isBlocked || sisaDetik <= 0) return;

    const timer = setInterval(() => {
      setSisaDetik((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitUjian(true); // Auto-submit waktu habis
          return 0;
        }
        const updated = prev - 1;
        // Auto-save sisa_detik berkala setiap 30 detik ke database
        if (sesiSiswa?.id && updated % 30 === 0) {
          supabase
            .from('cbt_sesi_siswa')
            .update({ sisa_detik: updated })
            .eq('id', sesiSiswa.id)
            .then();
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep, isPaused, isBlocked, sisaDetik]);

  // Format Timer mm:ss
  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Effect Scanner Kartu Pelajar (Html5Qrcode)
  useEffect(() => {
    if (currentStep !== 'scan' || isCardVerified || isBlocked || sesiSiswa?.status === 'diblokir') {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning || scannerRef.current.getState() === 2) {
            scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch (_e) {}
        scannerRef.current = null;
      }
      return;
    }

    let isMounted = true;
    setScannerError('');

    const startScanner = async () => {
      try {
        const el = document.getElementById('cbt-card-scanner-box');
        if (!el || !isMounted) return;

        // Bersihkan scanner sebelumnya
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning || scannerRef.current.getState() === 2) {
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch (_e) {}
          scannerRef.current = null;
        }

        el.innerHTML = '';

        const html5QrCode = new Html5Qrcode('cbt-card-scanner-box');
        scannerRef.current = html5QrCode;

        // Ambil daftar kamera (hanya untuk dropdown pilihan manual)
        // Catatan: getCameras() bisa gagal atau mengembalikan label kosong sebelum izin diberikan.
        // Kita tetap lakukan tapi tidak bergantung padanya untuk start scanner awal.
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0 && isMounted) {
            setCameraList(devices);
          }
        } catch (_camErr) {
          console.warn('Could not list cameras:', _camErr);
        }

        const config = {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.floor(minEdge * 0.72);
            return { width: Math.max(edgeSize, 220), height: Math.max(edgeSize, 220) };
          },
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        };

        // === STRATEGI PEMILIHAN KAMERA ===
        // Prioritas:
        // 1. Jika user memilih kamera spesifik dari dropdown → gunakan deviceId itu
        // 2. Jika tidak, gunakan { facingMode } string — paling kompatibel di semua perangkat
        //    (desktop webcam, laptop, HP Android/iOS, tablet)
        let cameraTarget;
        if (selectedCameraId) {
          cameraTarget = { deviceId: { exact: selectedCameraId } };
        } else {
          cameraTarget = { facingMode: cameraFacing };
        }

        const onScan = (decodedText) => {
          if (isMounted && !isVerifyingCardRef.current && !isCardVerifiedRef.current) {
            handleCardScanned(decodedText);
          }
        };

        try {
          await html5QrCode.start(cameraTarget, config, onScan, () => {});
        } catch (firstErr) {
          console.warn('Camera start failed, trying without constraint:', firstErr);
          // Fallback terakhir: tanpa constraint facingMode sama sekali (buka kamera apapun yang tersedia)
          try {
            await html5QrCode.start({ facingMode: 'user' }, config, onScan, () => {});
          } catch (secondErr) {
            console.warn('All camera targets failed:', secondErr);
            throw secondErr;
          }
        }
      } catch (err) {
        console.warn('Scanner camera error:', err);
        if (isMounted) {
          setScannerError(
            err?.name === 'NotAllowedError'
              ? 'Akses kamera diblokir. Izinkan kamera di pengaturan browser Anda.'
              : err?.name === 'NotFoundError'
              ? 'Kamera tidak ditemukan. Pastikan perangkat memiliki kamera aktif.'
              : err?.name === 'NotReadableError'
              ? 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain yang menggunakan kamera.'
              : err?.message || 'Tidak dapat mengakses kamera. Pastikan izin kamera browser telah diaktifkan.'
          );
        }
      }
    };

    const timer = setTimeout(startScanner, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning || scannerRef.current.getState() === 2) {
            scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch (_e) {}
        scannerRef.current = null;
      }
    };
  }, [currentStep, isCardVerified, selectedCameraId, cameraFacing, isBlocked, sesiSiswa?.status]);

  // Handler Pemindaian & Verifikasi Kartu Siswa
  const handleCardScanned = async (decodedText) => {
    if (isVerifyingCardRef.current || isCardVerifiedRef.current) return;
    setIsVerifyingCard(true);

    try {
      const rawData = String(decodedText || '').trim();
      let extractedId = '';

      // 1. Coba dekripsi AES menggunakan SECRET_KEY (format resmi Kartu Pelajar SMP IT HM)
      try {
        const bytes = CryptoJS.AES.decrypt(rawData, SECRET_KEY);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted && decrypted !== 'NO-DATA') {
          extractedId = decrypted.trim();
        }
      } catch (_e) {}

      // 2. Coba parse JSON jika kartu menyimpan objek data
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
      const currentNipd = String(currentSiswa?.nipd || '').trim();
      const currentNisn = String(currentSiswa?.nisn || '').trim();
      const currentId = String(currentSiswa?.id || '').trim();

      const isOwner = Boolean(
        (currentNipd && extractedId === currentNipd) ||
        (currentNisn && extractedId === currentNisn) ||
        (currentId && extractedId === currentId)
      );

      if (isOwner) {
        setIsCardVerified(true);

        // Hentikan kamera scanner sebelum berpindah
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning || scannerRef.current.getState() === 2) {
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch (_e) {}
          scannerRef.current = null;
        }

        await Swal.fire({
          icon: 'success',
          title: 'Identitas Terverifikasi!',
          html: `
            <div class="text-left space-y-2 mt-2">
              <p class="text-sm font-bold text-gray-800">Kartu Pelajar valid terkonfirmasi atas nama:</p>
              <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div class="font-black text-emerald-900 text-sm">${currentSiswa?.nama || currentSiswa?.nama_lengkap || 'Siswa'}</div>
                <div class="text-emerald-700">NISN: ${currentSiswa?.nisn || '-'} | NIPD: ${currentSiswa?.nipd || '-'}</div>
                <div class="text-emerald-700">Kelas: ${currentSiswa?.kelas || '-'}</div>
              </div>
              ${
                isResumingRef.current
                  ? '<p class="text-xs font-semibold text-blue-700 mt-2">Sesi ujian Anda yang sedang berlangsung akan langsung dilanjutkan.</p>'
                  : '<p class="text-xs text-gray-500 mt-2">Silakan melanjutkan ke halaman konfirmasi kepesertaan ujian.</p>'
              }
            </div>
          `,
          confirmButtonText: isResumingRef.current ? 'Lanjutkan Mengerjakan Soal' : 'Lanjut ke Beranda Ujian',
          confirmButtonColor: '#2a2c87',
          allowOutsideClick: false,
        });

        setIsVerifyingCard(false);

        if (isResumingRef.current) {
          // Melanjutkan pengerjaan soal
          if (sesiSiswa?.id && sesiSiswa.status === 'dijeda') {
            await supabase
              .from('cbt_sesi_siswa')
              .update({ status: 'mengerjakan' })
              .eq('id', sesiSiswa.id);
            setSesiSiswa(prev => ({ ...prev, status: 'mengerjakan' }));
            setIsPaused(false);
          }
          setCurrentStep('soal');
        } else {
          // Masuk ke beranda konfirmasi peserta
          setCurrentStep('beranda');
        }
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Verifikasi Gagal!',
          html: `
            <div class="text-left space-y-2 mt-2">
              <p class="text-sm text-gray-800">Kartu yang dipindai <b>BUKAN milik akun Anda</b> (${currentSiswa?.nama || currentSiswa?.nama_lengkap || 'Siswa'}).</p>
              <div class="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                Anda tidak diperkenankan mengerjakan ujian dengan kartu pelajar milik peserta lain.
              </div>
            </div>
          `,
          confirmButtonText: 'Pindai Ulang',
          confirmButtonColor: '#d33',
          allowOutsideClick: false,
        });
        setIsVerifyingCard(false);
      }
    } catch (err) {
      console.error('Scan verification error:', err);
      setIsVerifyingCard(false);
    }
  };

  // Alur 2: Klik Tombol "Mulai Ujian" di Beranda Ujian
  const handleStartExam = async () => {
    try {
      // Pastikan kartu telah terverifikasi sah
      if (!isCardVerified) {
        Swal.fire({
          icon: 'warning',
          title: 'Verifikasi Diperlukan',
          text: 'Anda harus memverifikasi kartu pelajar terlebih dahulu sebelum memulai ujian.',
          confirmButtonColor: '#2a2c87',
        });
        setCurrentStep('scan');
        return;
      }

      // Cek Status Terblokir dari Database Realtime
      const { data: checkSesi } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('jadwal_id', jadwalId)
        .eq('siswa_id', currentSiswa.id)
        .maybeSingle();

      if (checkSesi && checkSesi.status === 'diblokir') {
        setIsBlocked(true);
        Swal.fire({
          icon: 'error',
          title: 'Kamu Terblokir',
          text: 'Kamu terblokir, silahkan hubungi pengawas.',
          confirmButtonColor: '#d33',
        });
        return;
      }

      // Jika belum ada sesi, buat sesi baru
      if (!checkSesi) {
        const initialSeconds = (jadwal.durasi_menit || 90) * 60;
        const { data: newSesi, error: createErr } = await supabase
          .from('cbt_sesi_siswa')
          .insert([
            {
              jadwal_id: jadwalId,
              siswa_id: currentSiswa.id,
              status: 'mengerjakan',
              waktu_mulai: new Date().toISOString(),
              sisa_detik: initialSeconds,
            },
          ])
          .select()
          .single();

        if (createErr) throw createErr;
        setSesiSiswa(newSesi);
      } else {
        setSesiSiswa(checkSesi);
      }

      // Langsung mengarah ke Halaman Soal
      setCurrentStep('soal');
    } catch (err) {
      Swal.fire('Error', err.message || 'Gagal memulai sesi ujian.', 'error');
    }
  };

  // Pilih Jawaban
  const handleSelectAnswer = (soalId, value) => {
    setJawabanState((prev) => {
      const updated = {
        ...prev,
        [soalId]: {
          ...(prev[soalId] || {}),
          jawaban: value,
        },
      };

      // Sync ke DB
      if (sesiSiswa?.id) {
        supabase.from('cbt_jawaban_siswa').upsert(
          {
            sesi_id: sesiSiswa.id,
            soal_id: soalId,
            jawaban_siswa: value,
            is_ragu: updated[soalId]?.isRagu || false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'sesi_id, soal_id' }
        );
      }
      return updated;
    });
  };

  // Toggle Ragu-ragu
  const handleToggleRagu = (soalId) => {
    setJawabanState((prev) => {
      const current = prev[soalId] || { jawaban: '', isRagu: false };
      const updated = {
        ...prev,
        [soalId]: {
          ...current,
          isRagu: !current.isRagu,
        },
      };

      if (sesiSiswa?.id) {
        supabase.from('cbt_jawaban_siswa').upsert(
          {
            sesi_id: sesiSiswa.id,
            soal_id: soalId,
            jawaban_siswa: current.jawaban,
            is_ragu: !current.isRagu,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'sesi_id, soal_id' }
        );
      }
      return updated;
    });
  };

  // Toggle Jeda Ujian oleh Siswa (jika diizinkan)
  const handleTogglePause = async () => {
    const nextPause = !isPaused;
    setIsPaused(nextPause);
    if (sesiSiswa?.id) {
      await supabase
        .from('cbt_sesi_siswa')
        .update({ status: nextPause ? 'dijeda' : 'mengerjakan' })
        .eq('id', sesiSiswa.id);
    }
  };

  // Submit Ujian
  const handleSubmitUjian = async (isAuto = false) => {
    if (!isAuto) {
      // Periksa apakah masih ada soal yang ditandai ragu-ragu
      const hasRagu = Object.values(jawabanState).some(item => item?.isRagu);
      if (hasRagu) {
        Swal.fire({
          icon: 'warning',
          title: 'Masih Ada Soal Ragu-Ragu!',
          text: 'Anda masih memiliki butir soal yang ditandai ragu-ragu. Harap periksa dan hilangkan tanda centang ragu-ragu sebelum mengumpulkan ujian.',
          confirmButtonColor: '#d97706',
        });
        return;
      }

      // Validasi waktu tombol selesai jika tombol ditekan dari header sebelum batas waktu dan belum mencapai butir soal terakhir
      const menitBerjalan = ((jadwal.durasi_menit * 60) - sisaDetik) / 60;
      const batasMenitTerakhir = settingsUjian?.tampilkan_tombol_selesai_menit ?? 0;
      const minimalMenit = jadwal.durasi_menit - batasMenitTerakhir;

      if (batasMenitTerakhir > 0 && menitBerjalan < minimalMenit && currentIndex < soalList.length - 1) {
        Swal.fire({
          title: 'Belum Waktunya Selesai',
          text: `Tombol selesai baru dapat digunakan pada ${batasMenitTerakhir} menit terakhir ujian.`,
          icon: 'info',
          confirmButtonColor: '#2a2c87',
        });
        return;
      }

      const totalSoal = soalList.length;
      const terisiCount = soalList.filter(s => {
        const j = jawabanState[s.id]?.jawaban;
        return j !== undefined && j !== null && String(j).trim().length > 0;
      }).length;
      const belumTerisi = totalSoal - terisiCount;


      if (belumTerisi > 0) {
        Swal.fire({
          title: 'Soal Belum Selesai!',
          html: `
            <div style="font-size: 13.5px; color: #475569; margin-top: 8px; line-height: 1.5;">
              <div style="color: #e11d48; font-weight: bold; font-size: 15px; margin-bottom: 8px;">
                Masih ada ${belumTerisi} dari ${totalSoal} butir soal yang belum Anda kerjakan!
              </div>
              <div>Anda <b>wajib menjawab seluruh butir soal</b> sebelum dapat mengumpulkan ujian ini. Silakan periksa kembali lembar ujian Anda.</div>
            </div>
          `,
          icon: 'warning',
          confirmButtonText: 'Lanjutkan Mengerjakan',
          confirmButtonColor: '#2a2c87',
        });
        return;
      }

      const confirm = await Swal.fire({
        title: 'Kumpulkan Ujian Sekarang?',
        html: `
          <div style="font-size: 13px; color: #475569; margin-top: 8px;">
            <div style="color: #10b981; font-weight: bold; margin-bottom: 8px;">Seluruh butir soal telah berhasil Anda jawab!</div>
            <div>Apakah Anda yakin ingin mengakhiri sesi dan mengumpulkan lembar jawaban ini?</div>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Kumpulkan Ujian',
        cancelButtonText: 'Periksa Kembali',
        confirmButtonColor: '#10b981',
      });
      if (!confirm.isConfirmed) return;
    }

    setIsSubmitting(true);
    Swal.fire({
      title: 'Menyimpan & Mengoreksi...',
      text: 'Sistem sedang memproses hasil penilaian otomatis...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      let totalSkorPG = 0;
      let maxBobotPG = 0;
      let countPG = 0;

      let totalSkorIsian = 0;
      let maxBobotIsian = 0;
      let countIsian = 0;

      let totalSkorEsai = 0;
      let maxBobotEsai = 0;
      let countEsai = 0;

      for (const soal of soalList) {
        const userAns = jawabanState[soal.id]?.jawaban || '';
        const bobot = parseFloat(soal.bobot_nilai || 1);

        if (soal.jenis_soal === 'pg') {
          countPG++;
          maxBobotPG += bobot;
          const isBenar = String(userAns).trim() === String(soal.kunci_jawaban).trim();
          const skor = isBenar ? bobot : 0;
          totalSkorPG += skor;

          await supabase.from('cbt_jawaban_siswa').upsert(
            {
              sesi_id: sesiSiswa.id,
              soal_id: soal.id,
              jawaban_siswa: userAns,
              is_benar: isBenar,
              skor_final_guru: skor,
              status_koreksi: 'otomatis_ai',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'sesi_id, soal_id' }
          );
        } else if (soal.jenis_soal === 'isian') {
          countIsian++;
          maxBobotIsian += bobot;
          const evalRes = evaluateShortAnswer(userAns, soal.kunci_jawaban, bobot);
          totalSkorIsian += evalRes.score;

          await supabase.from('cbt_jawaban_siswa').upsert(
            {
              sesi_id: sesiSiswa.id,
              soal_id: soal.id,
              jawaban_siswa: userAns,
              is_benar: evalRes.isCorrect,
              skor_ai: evalRes.score,
              skor_final_guru: evalRes.score,
              status_koreksi: 'otomatis_ai',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'sesi_id, soal_id' }
          );
        } else if (soal.jenis_soal === 'esai') {
          countEsai++;
          maxBobotEsai += bobot;
          const evalRes = await evaluateEssayWithAI({
            questionText: soal.pertanyaan,
            rubricText: soal.rubrik_esai,
            studentAnswer: userAns,
            maxScore: bobot,
          });
          totalSkorEsai += evalRes.score;

          await supabase.from('cbt_jawaban_siswa').upsert(
            {
              sesi_id: sesiSiswa.id,
              soal_id: soal.id,
              jawaban_siswa: userAns,
              skor_ai: evalRes.score,
              feedback_ai: evalRes.feedback,
              skor_final_guru: evalRes.score,
              status_koreksi: 'otomatis_ai',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'sesi_id, soal_id' }
          );
        }
      }

      // Hitung nilai akhir dengan pemisahan jenis soal dan skema konversi
      const skema = jadwal?.skema_konversi || jadwal?.cbt_bank_soal?.skema_konversi || 'asli';
      const scoreResult = calculateCbtFinalScore({
        skorPg: totalSkorPG,
        maxBobotPg: maxBobotPG,
        countPg: countPG,

        skorIsian: totalSkorIsian,
        maxBobotIsian: maxBobotIsian,
        countIsian: countIsian,

        skorEsai: totalSkorEsai,
        maxBobotEsai: maxBobotEsai,
        countEsai: countEsai,

        skemaKonversi: skema,
        kkm: 75,
      });

      const finalNilai = scoreResult.finalScore;

      await supabase
        .from('cbt_sesi_siswa')
        .update({
          status: 'selesai',
          waktu_selesai: new Date().toISOString(),
          sisa_detik: 0,
          skor_pg: totalSkorPG,
          skor_isian: totalSkorIsian,
          skor_esai: totalSkorEsai,
          nilai_akhir: finalNilai,
        })
        .eq('id', sesiSiswa.id);

      Swal.fire({
        icon: 'success',
        title: 'Ujian Berhasil Dikumpulkan',
        text: settingsUjian?.tampilkan_hasil
          ? `Nilai Ujian Anda: ${finalNilai}`
          : 'Jawaban Anda telah tersimpan dengan aman di server sekolah.',
        confirmButtonColor: '#2a2c87',
      }).then(() => {
        navigate('/cbt/jadwal-siswa');
      });
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal mengumpulkan ujian. Silakan hubungi pengawas.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Periksa Status Blokir Secara Manual dari Server
  const handleCheckBlockStatus = async () => {
    const curSesi = sesiSiswaRef.current;
    if (!curSesi?.id) return;
    try {
      const { data: latestSesi, error } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('id', curSesi.id)
        .maybeSingle();

      if (error) throw error;

      if (latestSesi) {
        setSesiSiswa(latestSesi);
        if (latestSesi.status === 'mengerjakan') {
          setIsBlocked(false);
          setIsPaused(false);
          Swal.fire({
            icon: 'success',
            title: 'Blokir Telah Dibuka!',
            text: 'Pengawas telah membuka akses ujian Anda. Silakan lanjutkan pengerjaan.',
            timer: 2000,
            showConfirmButton: false,
          });
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'Status Masih Terblokir',
            text: 'Akses ujian Anda saat ini masih diblokir oleh pengawas. Silakan hubungi pengawas ruang.',
            confirmButtonColor: '#e11d48',
          });
        }
      }
    } catch (err) {
      console.warn('Gagal cek status sesi:', err);
    }
  };

  // =========================================================================
  // HALAMAN TERBLOKIR: TAMPIL SEGERA JIKA STATUS SESI DIBLOKIR ATAU ISBLOCKED
  // =========================================================================
  if (isBlocked || sesiSiswa?.status === 'diblokir') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-rose-950/30 to-slate-950 text-white flex flex-col justify-between p-4 sm:p-8 font-sans select-none">
        {/* Top Navbar */}
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between py-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-rose-900/40">
              HM
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Ruang Ujian CBT Siswa
              </h1>
              <p className="text-[11px] text-slate-400">SMP IT Hidayatul Mubtadi-ien</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/cbt/jadwal-siswa')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-semibold transition"
          >
            <LogOut size={14} />
            <span>Keluar ke Jadwal</span>
          </button>
        </div>

        {/* Center Card Halaman Terblokir */}
        <div className="max-w-lg mx-auto w-full my-auto py-8">
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border-2 border-rose-500/40 shadow-2xl shadow-rose-950/60 text-center relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Icon Alert Besar */}
            <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-5 text-rose-500 shadow-inner">
              <ShieldAlert size={44} className="animate-pulse" />
            </div>

            {/* Badge Terblokir */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-rose-500/20 border border-rose-500/50 text-rose-400 mb-3">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              AKSES UJIAN DIBLOKIR
            </div>

            {/* Judul & Deskripsi Sesuai Permintaan */}
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
              Kamu Terblokir
            </h2>
            <p className="text-sm font-semibold text-rose-300 mb-6 leading-relaxed">
              Kamu terblokir, silahkan hubungi pengawas.
            </p>

            {/* Card Info Siswa & Ujian */}
            <div className="bg-slate-950/70 rounded-2xl p-4 border border-white/10 text-left space-y-2 mb-6">
              <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                <span className="text-slate-400">Nama Peserta</span>
                <span className="font-bold text-white font-mono">{currentSiswa?.nama || currentSiswa?.nama_lengkap || 'Siswa'}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                <span className="text-slate-400">Kelas / NISN</span>
                <span className="font-semibold text-slate-200">{currentSiswa?.kelas || '-'} • {currentSiswa?.nisn || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                <span className="text-slate-400">Mata Pelajaran</span>
                <span className="font-semibold text-slate-200">{jadwal?.data_mapel?.nama_mapel || jadwal?.nama_ujian || 'Ujian CBT'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Pelanggaran</span>
                <span className="font-black text-rose-400">{sesiSiswa?.total_pelanggaran || 0} Pelanggaran</span>
              </div>
            </div>

            {/* Live Polling / Realtime Indicator */}
            <div className="bg-slate-800/60 rounded-xl px-4 py-2.5 border border-white/5 flex items-center justify-center gap-2.5 text-xs text-slate-300 mb-5">
              <RefreshCw size={13} className="animate-spin text-rose-400" />
              <span>Menunggu pengawas membuka blokir secara realtime...</span>
            </div>

            {/* Tombol Aksi */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleCheckBlockStatus}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-rose-900/40"
              >
                <RefreshCw size={14} />
                <span>Periksa Status Buka Blokir</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/cbt/jadwal-siswa')}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 border border-white/10"
              >
                <LogOut size={14} />
                <span>Kembali ke Halaman Jadwal</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-3xl mx-auto w-full text-center py-2 border-t border-white/5 text-[11px] text-slate-500">
          Sistem Pengawasan Keamanan Ujian CBT • SMP IT Hidayatul Mubtadi-ien
        </div>
      </div>
    );
  }

  if (!jadwal || soalList.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-secondary mx-auto" />
          <p className="text-sm font-semibold">Menyiapkan Ruang CBT Siswa...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 1: SCAN KARTU PELAJAR (WAJIB UNTUK MULAI AWAL ATAU MELANJUTKAN)
  // =========================================================================
  if (currentStep === 'scan') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col justify-between p-4 sm:p-6 select-none font-sans">
        {/* Top Navbar */}
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between py-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-lg shadow-md shadow-primary/40">
              HM
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Verifikasi Kartu Pelajar Peserta CBT
              </h1>
              <p className="text-[11px] text-slate-400">SMP IT Hidayatul Mubtadi-ien</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/cbt/jadwal-siswa')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-semibold transition"
          >
            <LogOut size={14} />
            <span>Keluar</span>
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="max-w-4xl mx-auto w-full my-auto py-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Kolom Kiri: Informasi Peserta & Petunjuk */}
          <div className="space-y-4">
            {/* Status Sesi Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#85c226]/20 border border-[#85c226]/50 text-[#85c226]">
              <Sparkles size={13} />
              {isResumingRef.current ? 'Melanjutkan Ujian CBT' : 'Memulai Ujian CBT Baru'}
            </div>

            {/* Info Ujian */}
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {jadwal?.nama_ujian || 'Ujian CBT'}
              </h2>
              <p className="text-xs text-indigo-300 font-medium mt-1">
                {jadwal?.data_mapel?.nama_mapel || 'Mata Pelajaran'} • {jadwal?.durasi_menit || 90} Menit
              </p>
            </div>

            {/* Card Data Siswa */}
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-xl space-y-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User size={13} className="text-[#85c226]" /> Data Peserta yang Sedang Login
              </div>
              <div className="space-y-1.5">
                <div className="text-base font-extrabold text-white">
                  {currentSiswa?.nama || currentSiswa?.nama_lengkap || 'Peserta Ujian'}
                </div>
                <div className="text-xs text-slate-300 flex flex-wrap gap-x-4 gap-y-1">
                  <span>NISN: <b className="text-white font-mono">{currentSiswa?.nisn || '-'}</b></span>
                  <span>NIPD: <b className="text-white font-mono">{currentSiswa?.nipd || '-'}</b></span>
                  <span>Kelas: <b className="text-white">{currentSiswa?.kelas || '-'}</b></span>
                </div>
              </div>
            </div>

            {/* Petunjuk Pemindaian */}
            <div className="bg-indigo-950/40 rounded-2xl p-4 border border-indigo-500/20 text-xs text-slate-300 space-y-2">
              <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                <ShieldCheck size={14} className="text-[#85c226]" />
                Ketentuan Verifikasi Kartu Pelajar:
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed">
                <li>Tunjukkan barcode / QR Code pada <b>Kartu Pelajar Fisik</b> Anda ke depan kamera.</li>
                <li>Posisikan kartu agar tidak terkena pantulan cahaya lampu atau silau.</li>
                <li>Sistem mencocokkan identitas kartu secara otomatis demi memastikan integritas ujian.</li>
                <li><b className="text-red-400">Dilarang menggunakan kartu pelajar milik peserta lain.</b></li>
              </ul>
            </div>
          </div>

          {/* Kolom Kanan: Kamera Scanner */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-sm bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-2xl relative">
              {/* Header Box Scanner with Kamera Depan / Belakang Switch */}
              <div className="flex flex-col gap-2 mb-3 px-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Camera size={14} className="text-[#85c226]" />
                    Pemindai Kamera
                  </span>
                  <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCameraId('');
                        setCameraFacing('user');
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 ${
                        cameraFacing === 'user'
                          ? 'bg-[#85c226] text-gray-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Gunakan Kamera Depan"
                    >
                      <User size={10} /> Depan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCameraId('');
                        setCameraFacing('environment');
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 ${
                        cameraFacing === 'environment'
                          ? 'bg-[#85c226] text-gray-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Gunakan Kamera Belakang"
                    >
                      <Camera size={10} /> Belakang
                    </button>
                  </div>
                </div>

                {/* Optional Device Select Dropdown if Multiple Cameras are Available */}
                {cameraList.length > 1 && (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full bg-slate-800/90 text-slate-200 border border-white/15 rounded-xl px-2.5 py-1 text-[10.5px] font-medium focus:outline-none focus:ring-1 focus:ring-[#85c226]"
                  >
                    <option value="">Otomatis ({cameraFacing === 'user' ? 'Kamera Depan' : 'Kamera Belakang'})</option>
                    {cameraList.map((cam, idx) => (
                      <option key={cam.id || idx} value={cam.id}>
                        {cam.label || `Kamera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Viewport Frame */}
              <div className="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-inner flex items-center justify-center">
                {/* Container target Html5Qrcode */}
                <div
                  id="cbt-card-scanner-box"
                  className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                />

                {/* Laser Scanning Animation Overlay */}
                {!scannerError && (
                  <div className="pointer-events-none absolute inset-x-6 top-0 bottom-0 flex flex-col justify-center">
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#85c226] to-transparent animate-pulse shadow-[0_0_12px_#85c226]" />
                  </div>
                )}

                {/* Loading / Error Overlay */}
                {scannerError ? (
                  <div className="absolute inset-0 bg-slate-950/90 p-4 flex flex-col items-center justify-center text-center">
                    <AlertTriangle size={32} className="text-amber-400 mb-2" />
                    <p className="text-xs font-semibold text-white mb-1">Akses Kamera Bermasalah</p>
                    <p className="text-[11px] text-slate-400 mb-3">{scannerError}</p>
                    <button
                      onClick={() => {
                        setScannerError('');
                        setSelectedCameraId('');
                      }}
                      className="px-3 py-1.5 bg-[#85c226] text-gray-950 font-bold text-xs rounded-xl hover:bg-[#97dd2d] transition"
                    >
                      Coba Muat Ulang Kamera
                    </button>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Jika masih blank hitam, coba tombol Depan / Belakang di atas
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Status Indicator Bar */}
              <div className="mt-3 text-center">
                {isVerifyingCard ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 border border-amber-500/50 text-amber-300">
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Sedang memverifikasi data kartu...</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 border border-emerald-500/50 text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Arahkan QR Kartu Pelajar ke Area Kotak</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-4xl mx-auto w-full text-center py-2 border-t border-white/5 text-[11px] text-slate-500">
          Sistem Ujian Online CBT & Verifikasi Kartu Siswa • SMP IT Hidayatul Mubtadi-ien
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 2: BERANDA UJIAN SISWA (CARD IDENTITAS PESERTA & SOAL)
  // =========================================================================
  if (currentStep === 'beranda') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans select-none">
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {/* Header Beranda */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black">
                HM
              </div>
              <div>
                <h1 className="text-base font-black text-gray-900">Beranda Ujian CBT</h1>
                <p className="text-xs text-gray-500">Konfirmasi data kepesertaan sebelum mulai</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-50 text-primary text-xs font-black rounded-full uppercase">
              {jadwal?.jenis_ujian}
            </span>
          </div>

          {/* CARD 1: IDENTITAS PESERTA */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <User size={15} className="text-primary" /> Identitas Peserta Ujian
            </h2>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pt-2">
              <div className="w-24 h-28 rounded-2xl bg-slate-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                {currentSiswa?.foto_url ? (
                  <img
                    src={currentSiswa.foto_url}
                    alt={currentSiswa.nama_lengkap}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={40} className="text-gray-400" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-xs">
                <div>
                  <span className="text-gray-400 block text-[11px]">Nama Lengkap Siswa</span>
                  <span className="font-bold text-gray-900 text-sm">{currentSiswa?.nama || currentSiswa?.nama_lengkap || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">NISN / NIPD</span>
                  <span className="font-bold font-mono text-gray-800">
                    {currentSiswa?.nisn || '-'} / {currentSiswa?.nipd || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Kelas & Rombel</span>
                  <span className="font-bold text-gray-800">{jadwal?.data_kelas?.nama_kelas || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Ruang Pelaksanaan</span>
                  <span className="font-bold text-gray-800">{jadwal?.data_ruang?.nama_ruang || 'Lab CBT'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: IDENTITAS SOAL UJIAN */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <BookOpen size={15} className="text-primary" /> Identitas Soal & Ketentuan Ujian
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs pt-2">
              <div>
                <span className="text-gray-400 block text-[11px]">Nama Ujian</span>
                <span className="font-bold text-gray-900">{jadwal?.nama_ujian}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Mata Pelajaran</span>
                <span className="font-bold text-primary">{jadwal?.data_mapel?.nama_mapel}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Jumlah Butir Soal</span>
                <span className="font-bold text-gray-900">{soalList.length} Butir</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Durasi Pengerjaan</span>
                <span className="font-bold text-gray-900">{jadwal?.durasi_menit} Menit</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Pengawas Ruang</span>
                <span className="font-bold text-gray-900">{jadwal?.pengawas?.nama || jadwal?.pengawas?.nama_guru || '-'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[11px]">Metode Pengawasan</span>
                <span className="font-bold text-emerald-700">Edge AI Face Tracking</span>
              </div>
            </div>
          </div>

          {/* Tombol Mulai Ujian */}
          <div className="pt-2">
            <button
              onClick={handleStartExam}
              className="w-full py-4 bg-primary hover:bg-blue-900 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-2xl transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <PlayCircle size={20} />
              <span>Mulai Mengerjakan Ujian Sekarang</span>
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 py-4">
          SMP IT Hidayatul Mubtadi-ien CBT System
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 3: HALAMAN SOAL SISWA
  // =========================================================================
  const currentSoal = soalList[currentIndex];
  const currentAnswer = jawabanState[currentSoal?.id]?.jawaban || '';
  const currentIsRagu = jawabanState[currentSoal?.id]?.isRagu || false;

  // Cek apakah tombol selesai diizinkan aktif
  const menitBerjalan = ((jadwal.durasi_menit * 60) - sisaDetik) / 60;
  const minimalMenitTombolSelesai = jadwal.durasi_menit - (settingsUjian?.tampilkan_tombol_selesai_menit ?? 15);
  const isTombolSelesaiAktif = menitBerjalan >= minimalMenitTombolSelesai;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans select-none relative">
      {/* HEADER STICKY */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black text-sm">
            HM
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">
              {jadwal.nama_ujian}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              Peserta: {currentSiswa?.nama_lengkap} (NISN: {currentSiswa?.nisn})
            </p>
          </div>
        </div>

        {/* Kontrol Kanan: Timer, Jeda, Selesai (Dinamis), Daftar Soal */}
        <div className="flex items-center gap-2.5">
          {/* Countdown Timer */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm font-black shadow-inner ${
              sisaDetik < 300
                ? 'bg-red-600 text-white animate-pulse'
                : sisaDetik < 900
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 text-slate-800'
            }`}
          >
            <Clock size={16} />
            <span>{formatTimer(sisaDetik)}</span>
          </div>

          {/* Tombol Jeda */}
          <button
            onClick={handleTogglePause}
            className={`p-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 ${
              isPaused
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
            }`}
            title={isPaused ? 'Lanjutkan Ujian' : 'Jeda Ujian'}
          >
            {isPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
          </button>

          {/* Tombol Selesai (Dinamis: Diatur berdasarkan Time Picker) */}
          {isTombolSelesaiAktif && (
            <button
              onClick={() => handleSubmitUjian(false)}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition animate-in fade-in"
            >
              Selesai
            </button>
          )}

          {/* Tombol Daftar Soal */}
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="px-3.5 py-1.5 bg-primary hover:bg-blue-900 text-white text-xs font-bold rounded-xl transition"
          >
            Daftar Soal
          </button>
        </div>
      </header>

      {/* TAMPILAN SOAL: 1 SOAL PER HALAMAN */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 flex-1">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Header Soal */}
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-primary text-white font-black text-sm flex items-center justify-center">
                {currentIndex + 1}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                dari {soalList.length} Butir Soal
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  currentSoal.jenis_soal === 'pg'
                    ? 'bg-blue-50 text-blue-700'
                    : currentSoal.jenis_soal === 'isian'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-purple-50 text-purple-700'
                }`}
              >
                {currentSoal.jenis_soal === 'pg'
                  ? 'Pilihan Ganda'
                  : currentSoal.jenis_soal === 'isian'
                  ? 'Jawaban Singkat'
                  : 'Essay'}
              </span>
              <span className="text-xs text-gray-500 font-bold">
                Bobot: {currentSoal.bobot_nilai} Poin
              </span>
            </div>
          </div>

          {/* Teks Pertanyaan */}
          <div className="text-base sm:text-lg font-medium text-gray-800 leading-relaxed space-y-3">
            <p>{currentSoal.pertanyaan}</p>
            {currentSoal.gambar_url && (
              <img
                src={currentSoal.gambar_url}
                alt="Gambar Soal"
                className="max-h-64 rounded-2xl border object-contain"
              />
            )}
          </div>

          {/* Lembar Jawaban */}
          <div className="pt-4 border-t border-gray-100">
            {/* Pilihan Ganda */}
            {currentSoal.jenis_soal === 'pg' && (
              <div className="space-y-3">
                {(currentSoal.opsi_jawaban || []).map((op, idx) => {
                  const isSelected = currentAnswer === op.id;
                  const displayLabel = String.fromCharCode(65 + idx);
                  return (
                    <div
                      key={op.id || idx}
                      onClick={() => handleSelectAnswer(currentSoal.id, op.id)}
                      className={`p-4 rounded-2xl border-2 flex items-center gap-3 cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50/70 border-primary text-primary font-bold shadow-sm'
                          : 'bg-gray-50/50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition ${
                          isSelected ? 'bg-primary text-white shadow' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {displayLabel}
                      </span>
                      <div className="flex-1 space-y-2">
                        {op.text ? <span className="text-sm sm:text-base block">{op.text}</span> : null}
                        {op.gambar_url && (
                          <img
                            src={op.gambar_url}
                            alt={`Opsi ${displayLabel}`}
                            className="max-h-40 rounded-xl border object-contain bg-white"
                          />
                        )}
                      </div>
                      {isSelected && <CheckCircle2 size={18} className="text-primary" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Jawaban Singkat */}
            {currentSoal.jenis_soal === 'isian' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-600">Jawaban Singkat:</label>
                <input
                  type="text"
                  placeholder="Ketikkan jawaban Anda di sini..."
                  value={currentAnswer}
                  onChange={(e) => handleSelectAnswer(currentSoal.id, e.target.value)}
                  className="w-full text-base font-bold border-2 border-gray-300 rounded-2xl p-3.5 focus:border-primary outline-none transition"
                />
              </div>
            )}

            {/* Essay */}
            {currentSoal.jenis_soal === 'esai' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-600">Jawaban Uraian Anda:</label>
                <textarea
                  rows={6}
                  placeholder="Tuliskan jawaban uraian Anda secara lengkap..."
                  value={currentAnswer}
                  onChange={(e) => handleSelectAnswer(currentSoal.id, e.target.value)}
                  className="w-full text-sm sm:text-base border-2 border-gray-300 rounded-2xl p-4 focus:border-primary outline-none transition leading-relaxed"
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FLOATING CAMERA PREVIEW (AI DETECTOR) DI SUDUT KANAN BAWAH */}
      {settingsUjian?.tampilkan_kamera !== false && (
        <div className="fixed bottom-20 right-4 z-40 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-gray-200 shadow-2xl transition hover:scale-105">
          <div className="relative w-28 h-20 bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover -scale-x-100"
            />
            <div
              className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[8px] font-black text-white flex items-center gap-1 ${
                faceStatus === 'normal' ? 'bg-emerald-600' : 'bg-red-600 animate-pulse'
              }`}
            >
              <Video size={10} />
              <span>{faceStatus === 'normal' ? 'AI OK' : 'ANOMALI'}</span>
            </div>
            {cameraActive && (
              <div className="absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded text-[7px] text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>LIVE</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR (STICKY): Sebelumnya, Ragu-ragu, Selanjutnya */}
      <footer className="sticky bottom-0 z-30 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Tombol Sebelumnya */}
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 font-bold text-xs rounded-xl transition"
          >
            <ChevronLeft size={16} />
            <span>Sebelumnya</span>
          </button>

          {/* Checkbox Ragu-Ragu */}
          <label className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-300 rounded-xl cursor-pointer hover:bg-amber-100 transition">
            <input
              type="checkbox"
              checked={currentIsRagu}
              onChange={() => handleToggleRagu(currentSoal.id)}
              className="w-4 h-4 text-amber-600 rounded border-amber-400 focus:ring-amber-500"
            />
            <span className="text-xs font-bold text-amber-900">Ragu-ragu</span>
          </label>

          {/* Tombol Selanjutnya atau Kumpulkan Ujian pada soal terakhir */}
          {currentIndex < soalList.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(soalList.length - 1, prev + 1))}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <span>Selanjutnya</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => handleSubmitUjian(false)}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition animate-in fade-in"
            >
              <Send size={15} />
              <span>{isSubmitting ? 'Mengumpulkan...' : 'Kumpulkan Ujian'}</span>
            </button>
          )}
        </div>
      </footer>

      {/* POP-UP DRAWER DAFTAR SOAL (HIJAU = DIISI, ABU-ABU = BELUM) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-80 bg-white h-full shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-primary">Daftar Nomor Soal</h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-900"
                >
                  Tutup
                </button>
              </div>

              {/* Legenda Warna */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-600 mb-4 pb-3 border-b">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-emerald-600 block" /> Diisi
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-amber-400 block" /> Ragu
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-gray-200 block" /> Belum
                </div>
              </div>

              {/* Grid Nomor Soal */}
              <div className="grid grid-cols-5 gap-2 max-h-[65vh] overflow-y-auto pr-1">
                {soalList.map((soal, idx) => {
                  const state = jawabanState[soal.id];
                  const hasAnswer = state?.jawaban && state.jawaban.toString().trim().length > 0;
                  const isRagu = state?.isRagu;
                  const isCurrent = idx === currentIndex;

                  let bgClass = 'bg-gray-100 text-gray-700 border-gray-200'; // Belum Diisi (Abu-abu)
                  if (isRagu) {
                    bgClass = 'bg-amber-400 text-amber-950 font-bold border-amber-500';
                  } else if (hasAnswer) {
                    bgClass = 'bg-emerald-600 text-white font-bold border-emerald-700'; // Diisi (Hijau)
                  }

                  return (
                    <button
                      key={soal.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setIsDrawerOpen(false);
                      }}
                      className={`h-10 rounded-xl border text-xs flex items-center justify-center transition ${bgClass} ${
                        isCurrent ? 'ring-2 ring-offset-1 ring-primary' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tombol Kumpulkan di dalam Drawer */}
            <button
              onClick={() => {
                setIsDrawerOpen(false);
                handleSubmitUjian(false);
              }}
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <Send size={15} />
              <span>Kumpulkan Ujian Sekarang</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
