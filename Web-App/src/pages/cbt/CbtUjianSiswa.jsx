import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import {
  Clock, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  ShieldCheck, ShieldAlert, Video, Flag, Save, RefreshCw, Send,
  User, BookOpen, PauseCircle, PlayCircle, Eye, AlertOctagon,
  Camera, Check, X, QrCode
} from 'lucide-react';
import { evaluateShortAnswer, evaluateEssayWithAI } from '../../services/cbt/aiGradingService';
import { calculateCbtFinalScore } from '../../services/cbt/scoringService';
import { useEdgeFaceLandmarker } from '../../hooks/cbt/useEdgeFaceLandmarker';

export default function CbtUjianSiswa() {
  const { jadwalId } = useParams();
  const navigate = useNavigate();

  // Workflow Step: 'scan' | 'beranda' | 'soal'
  const [currentStep, setCurrentStep] = useState('scan');
  const [isScanAlertOpen, setIsScanAlertOpen] = useState(true);

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

  // Hook Edge AI Pengawasan Wajah MediaPipe
  const { videoRef, faceStatus, violationCount, headAngles } = useEdgeFaceLandmarker({
    enabled: currentStep === 'soal' && !isBlocked,
    sampleIntervalMs: 400, // 300ms - 500ms
    debounceThresholdMs: 2500, // 2.0s - 3.0s
    onViolation: async (v) => {
      if (sesiSiswa?.id && !isBlocked) {
        try {
          // 1. Catat ke tabel log pelanggaran
          await supabase.from('cbt_log_pelanggaran').insert([
            {
              sesi_id: sesiSiswa.id,
              jenis_pelanggaran: v.type,
              sudut_yaw: v.yaw,
              sudut_pitch: v.pitch,
              durasi_detik: 2.5,
              keterangan: `Anomali wajah terdeteksi (${v.type})`,
            },
          ]);

          const nextCount = (sesiSiswa.total_pelanggaran || 0) + 1;
          setSesiSiswa(prev => ({ ...prev, total_pelanggaran: nextCount }));

          // 2. Jika konfigurasi blokir_menengok aktif dan pelanggaran >= 3, blokir otomatis
          if (settingsUjian?.blokir_menengok && nextCount >= 3) {
            await supabase
              .from('cbt_sesi_siswa')
              .update({ status: 'diblokir', total_pelanggaran: nextCount })
              .eq('id', sesiSiswa.id);

            setIsBlocked(true);
            Swal.fire({
              icon: 'error',
              title: 'Kamu Terblokir',
              text: 'Kamu terblokir, silahkan hubungi pengawas.',
              allowOutsideClick: false,
              confirmButtonText: 'Tutup',
              confirmButtonColor: '#d33',
            });
          } else {
            await supabase
              .from('cbt_sesi_siswa')
              .update({ total_pelanggaran: nextCount })
              .eq('id', sesiSiswa.id);
          }
        } catch (e) {
          console.warn('Gagal mencatat log pelanggaran:', e);
        }
      }
    },
  });

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

          setIsBlocked(true);
          Swal.fire({
            icon: 'error',
            title: 'Kamu Terblokir',
            text: 'Kamu terblokir karena keluar dari layar ujian, silahkan hubungi pengawas.',
            allowOutsideClick: false,
            confirmButtonColor: '#d33',
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentStep, isBlocked, sesiSiswa, settingsUjian]);

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

      // Ambil Jadwal
      const { data: jData, error: jErr } = await supabase
        .from('cbt_jadwal_ujian')
        .select(`
          *,
          data_mapel(nama_mapel),
          data_ruang(nama_ruang),
          pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama),
          cbt_bank_soal(id, total_soal)
        `)
        .eq('id', jadwalId)
        .single();

      if (jErr || !jData) throw new Error('Jadwal ujian tidak ditemukan.');
      setJadwal(jData);

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

      // Ambil Butir Soal
      let targetBankId = jData.bank_soal_id;
      if (!targetBankId && jData.mapel_id) {
        const { data: bData } = await supabase
          .from('cbt_bank_soal')
          .select('id')
          .eq('mapel_id', jData.mapel_id)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bData?.id) {
          targetBankId = bData.id;
          supabase.from('cbt_jadwal_ujian').update({ bank_soal_id: bData.id }).eq('id', jadwalId).then();
        }
      }

      const { data: sData } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', targetBankId)
        .order('nomor_urut', { ascending: true });

      let finalSoals = sData || [];
      if (jData.acak_soal) {
        finalSoals = [...finalSoals].sort((a, b) => {
          const hashA = (a.id * 31 + storedSiswa.id) % 1000;
          const hashB = (b.id * 31 + storedSiswa.id) % 1000;
          return hashA - hashB;
        });
      }
      setSoalList(finalSoals);

      // Cek Sesi Siswa
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
        // Jika sudah pernah mulai dan belum selesai, bisa langsung ke soal
        if (sesi.status === 'mengerjakan' || sesi.status === 'dijeda') {
          setCurrentStep('soal');
        }
      } else {
        const initialSeconds = (jData.durasi_menit || 90) * 60;
        setSisaDetik(initialSeconds);
      }

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
        return prev - 1;
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

  // Alur 1: Konfirmasi Pop-up Scan
  const handleConfirmScanAlert = () => {
    setIsScanAlertOpen(false);
    setCurrentStep('beranda');
  };

  // Alur 2: Klik Tombol "Mulai Ujian" di Beranda Ujian
  const handleStartExam = async () => {
    try {
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
      // Validasi waktu tombol selesai aktif
      const menitBerjalan = ((jadwal.durasi_menit * 60) - sisaDetik) / 60;
      const minimalMenit = jadwal.durasi_menit - (settingsUjian?.tampilkan_tombol_selesai_menit ?? 15);

      if (menitBerjalan < minimalMenit) {
        Swal.fire({
          title: 'Belum Waktunya Selesai',
          text: `Tombol selesai baru dapat digunakan pada ${settingsUjian?.tampilkan_tombol_selesai_menit ?? 15} menit terakhir ujian.`,
          icon: 'info',
        });
        return;
      }

      const confirm = await Swal.fire({
        title: 'Kumpulkan Ujian Sekarang?',
        text: 'Periksa kembali seluruh jawaban Anda sebelum mengakhiri sesi ujian.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Selesaikan Ujian',
        confirmButtonColor: '#2a2c87',
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
        navigate('/dashboard-siswa');
      });
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal mengumpulkan ujian. Silakan hubungi pengawas.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
  // STEP 1: SCAN KARTU & POP-UP PERINGATAN KAMERA
  // =========================================================================
  if (currentStep === 'scan') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between items-center p-6 select-none">
        <div className="text-center mt-6">
          <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-xl mx-auto mb-2">
            HM
          </div>
          <h1 className="text-lg font-bold">Verifikasi Identitas & Pemindaian Kartu CBT</h1>
          <p className="text-xs text-slate-400">SMP IT Hidayatul Mubtadi-ien</p>
        </div>

        {/* Frame Scan Kartu */}
        <div className="relative w-full max-w-sm aspect-[4/3] bg-slate-900 rounded-3xl border-2 border-primary/50 overflow-hidden flex flex-col items-center justify-center p-6 shadow-2xl">
          <QrCode className="w-24 h-24 text-secondary/80 animate-pulse mb-3" />
          <p className="text-xs font-semibold text-slate-300 text-center">
            Posisikan Kartu Ujian atau Wajah Anda pada Area Kamera
          </p>
          <div className="absolute inset-x-8 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-secondary to-transparent animate-bounce" />
        </div>

        {/* Pop-up Peringatan Hadap Kamera */}
        {isScanAlertOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white text-gray-900 rounded-3xl p-6 w-full max-w-md shadow-2xl text-center space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-primary flex items-center justify-center mx-auto shadow-inner">
                <Camera size={32} />
              </div>
              <h3 className="text-lg font-black text-primary">Petunjuk Posisi Kamera</h3>
              <p className="text-sm font-semibold text-gray-700 leading-relaxed">
                "Cari posisi yang nyaman dengan wajah menghadap kamera"
              </p>
              <p className="text-xs text-gray-500">
                Pastikan pencahayaan cukup dan wajah Anda terlihat jelas selama ujian berlangsung.
              </p>
              <button
                onClick={handleConfirmScanAlert}
                className="w-full py-3.5 bg-primary hover:bg-blue-900 text-white font-bold rounded-2xl shadow-lg transition transform hover:-translate-y-0.5 text-sm"
              >
                Oke, Saya Mengerti
              </button>
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-500 mb-2">
          Sistem Pengawasan Otomatis Edge AI CBT Version 2.0
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
                  <span className="font-bold text-gray-900 text-sm">{currentSiswa?.nama_lengkap || '-'}</span>
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
                {(currentSoal.opsi_jawaban || []).map((op) => {
                  const isSelected = currentAnswer === op.id;
                  return (
                    <div
                      key={op.id}
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
                        {op.id}
                      </span>
                      <span className="text-sm sm:text-base flex-1">{op.text}</span>
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

          {/* Tombol Selanjutnya */}
          <button
            disabled={currentIndex === soalList.length - 1}
            onClick={() => setCurrentIndex((prev) => Math.min(soalList.length - 1, prev + 1))}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-blue-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            <span>Selanjutnya</span>
            <ChevronRight size={16} />
          </button>
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

            {/* Tombol Kumpulkan jika tombol selesai aktif */}
            {isTombolSelesaiAktif && (
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  handleSubmitUjian(false);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                Kumpulkan Ujian Sekarang
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
