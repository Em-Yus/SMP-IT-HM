import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { 
  Clock, Search, Save, Calendar, CheckCircle, XCircle, AlertCircle, 
  RefreshCw, Download, UserCheck, FileText, QrCode, DollarSign, 
  Camera, Sparkles, LogIn, LogOut, ChevronLeft, ChevronRight, 
  Edit3, X, Eye, BookOpen, Award, ShieldCheck, AlertTriangle
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { getOperationalDate, getOperationalDayName, getOperationalDayIndex, getLocalDate } from '../utils/dateUtils';

// Sub-component QR Scanner with Html5Qrcode
function QrScannerModal({ isOpen, onClose, onScan, isProcessing }) {
  const qrCodeId = useRef(`qr-teacher-scanner-${Date.now()}`);
  const onScanRef = useRef(onScan);
  const isProcessingRef = useRef(isProcessing);

  useEffect(() => {
    onScanRef.current = onScan;
    isProcessingRef.current = isProcessing;
  }, [onScan, isProcessing]);

  useEffect(() => {
    if (!isOpen) return;

    let scannerInstance = null;
    let isStopped = false;

    const timer = setTimeout(() => {
      try {
        scannerInstance = new Html5Qrcode(qrCodeId.current);
        const config = {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        };

        scannerInstance.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (!isProcessingRef.current && onScanRef.current) {
              onScanRef.current(decodedText);
            }
          },
          () => {}
        ).catch(err => {
          console.warn("Scanner camera error:", err);
        });
      } catch (err) {
        console.error("Failed to init Html5Qrcode:", err);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      isStopped = true;
      if (scannerInstance) {
        try {
          if (scannerInstance.isScanning || scannerInstance.getState() === 2) {
            scannerInstance.stop().then(() => scannerInstance.clear()).catch(() => {});
          } else {
            scannerInstance.clear();
          }
        } catch (e) {
          console.error("Error stopping scanner:", e);
        }
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
        {/* Modal Header */}
        <div className="p-4 bg-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-amber-300" />
            <h3 className="font-bold text-sm">Pindai QR Presensi Guru</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="p-4 bg-gray-900 flex flex-col items-center">
          <div 
            id={qrCodeId.current} 
            className="w-full min-h-[280px] bg-black rounded-2xl overflow-hidden relative shadow-inner"
          />
          <div className="mt-3 text-center">
            <p className="text-xs font-semibold text-gray-300 flex items-center justify-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              Arahkan ke QR Code di Pintu Kantor atau Ruang Kelas
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Mendukung QR Kehadiran Masuk/Pulang & QR KBM Kelas
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition"
          >
            Tutup Kamera
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PresensiGuru() {
  const [currentTab, setCurrentTab] = useState('saya'); // 'saya' | 'rekap'
  const [currentUser, setCurrentUser] = useState(null);
  const [isOperator, setIsOperator] = useState(false);
  const [canManageQrAndJam, setCanManageQrAndJam] = useState(false);

  // Master Jam Presensi Guru Aktif
  const [masterJamGuru, setMasterJamGuru] = useState({
    jam_masuk: '08:00',
    jam_pulang: '13:00',
    honor_kehadiran: 5000,
    honor_per_jp: 6500
  });

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScanProcessing, setIsScanProcessing] = useState(false);

  // ==== STATE PRESENSI SAYA ====
  const [myPresensi, setMyPresensi] = useState(null);
  const [myKbmList, setMyKbmList] = useState([]);
  const [isMyLoading, setIsMyLoading] = useState(true);

  // Modal Izin State
  const [isIzinModalOpen, setIsIzinModalOpen] = useState(false);
  const [izinForm, setIzinForm] = useState({ status: 'Sakit', alasan: '' });
  const [isSavingIzin, setIsSavingIzin] = useState(false);

  // Modal Pilih Kelas KBM Manual
  const [isKbmModalOpen, setIsKbmModalOpen] = useState(false);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

  // ==== STATE REKAP OPERATOR ====
  const [pegawai, setPegawai] = useState([]);
  const [presensiMap, setPresensiMap] = useState({});
  const [isLoadingRekap, setIsLoadingRekap] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tanggal, setTanggal] = useState(getLocalDate());

  // Modal Edit Presensi oleh Operator
  const [editOperatorModal, setEditOperatorModal] = useState(null); // { pegawai, presensi }
  const [editOperatorForm, setEditOperatorForm] = useState({ status: 'Hadir', waktu_datang: '', waktu_pulang: '', alasan: '' });
  const [isSavingOperatorEdit, setIsSavingOperatorEdit] = useState(false);

  // Parse time helpers
  const getTimeString = (d = new Date()) => {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const parseTimeToMinutes = (tStr) => {
    if (!tStr) return 0;
    const [h, m] = tStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getSlotTimeRange = (s) => {
    let startStr = s.master_jam?.waktu_mulai?.substring(0, 5);
    let endStr = s.master_jam?.waktu_selesai?.substring(0, 5);

    if ((!startStr || !endStr) && s.waktu) {
      const parts = s.waktu.split('-').map((p) => p.trim().replace('.', ':'));
      if (parts.length === 2) {
        startStr = startStr || parts[0];
        endStr = endStr || parts[1];
      }
    }

    const startMin = startStr ? parseTimeToMinutes(startStr) : 480;
    const endMin = endStr ? parseTimeToMinutes(endStr) : startMin + 40;
    return { startMin, endMin, startStr, endStr };
  };

  // Init User & Role
  useEffect(() => {
    const userStr = localStorage.getItem('user_guru');
    if (userStr) {
      const u = JSON.parse(userStr);
      setCurrentUser(u);
    } else {
      // Fallback query single active teacher jika tidak ada di localStorage saat testing
      const fetchInitialUser = async () => {
        const { data } = await supabase.from('data_guru').select('*').is('tanggal_keluar', null).limit(1).maybeSingle();
        if (data) setCurrentUser(data);
      };
      fetchInitialUser();
    }
  }, []);

  // Fetch Role & Master Jam
  useEffect(() => {
    if (currentUser) {
      checkRole();
      fetchMasterJam();
    }
  }, [currentUser]);

  // Fetch Data according to active Tab
  useEffect(() => {
    if (currentUser) {
      if (currentTab === 'saya') {
        fetchAllGuruData();
      } else {
        fetchRekapData();
      }
    }
  }, [currentTab, tanggal, currentUser]);

  const fetchMasterJam = async () => {
    try {
      const { data: jamData } = await supabase
        .from('master_jam_presensi_guru')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (jamData) {
        setMasterJamGuru(jamData);
      }
    } catch (err) {
      console.error('Error fetching master jam:', err);
    }
  };

  const checkRole = async () => {
    try {
      if (currentUser?.role === 'admin') {
        setIsOperator(true);
        setCanManageQrAndJam(true);
        return;
      }
      const { data } = await supabase.from('jabatan_guru').select('*').eq('guru_id', currentUser.id).maybeSingle();
      if (data) {
        const roles = [data.jabatan_utama, data.jabatan_lain_1, data.jabatan_lain_2, data.jabatan_lain_3].filter(Boolean);
        const hasOperator = roles.some(r => {
          const lower = (r || '').toLowerCase();
          return lower.includes('operator') || lower.includes('admin') || lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara');
        });
        setIsOperator(hasOperator);

        const hasQrJam = roles.some(r => {
          const lower = (r || '').toLowerCase();
          return lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara') || lower.includes('waka') || lower.includes('kurikulum') || lower.includes('operator') || lower.includes('admin');
        });
        setCanManageQrAndJam(hasQrJam);
      }
    } catch (e) {
      console.error('Error checking role:', e);
    }
  };

  // =========================================================================
  // LOGIKA DATA GURU (PRESENSI SAYA)
  // =========================================================================
  const fetchAllGuruData = async () => {
    if (!currentUser) return;
    setIsMyLoading(true);
    const today = getLocalDate();
    try {
      // 1. Fetch Kehadiran Sekolah
      const { data: presensi } = await supabase
        .from('presensi_guru')
        .select('*')
        .eq('guru_id', currentUser.id)
        .eq('tanggal', today)
        .maybeSingle();

      setMyPresensi(presensi || null);

      // 2. Fetch KBM Mengajar di Kelas
      const { data: kbm } = await supabase
        .from('presensi_kbm_guru')
        .select('*, data_kelas(nama_kelas), data_mapel(nama_mapel)')
        .eq('guru_id', currentUser.id)
        .eq('tanggal', today)
        .order('created_at', { ascending: false });

      setMyKbmList(kbm || []);
    } catch (e) {
      console.error('Fetch guru data error:', e);
    } finally {
      setIsMyLoading(false);
    }
  };

  // =========================================================================
  // LOGIKA AKSI KEHADIRAN SEKOLAH (MASUK & PULANG)
  // =========================================================================
  const handleAbsenMasukSekolah = async () => {
    if (!currentUser) return;
    const today = getLocalDate();
    const currentTime = getTimeString();
    const currentMin = parseTimeToMinutes(currentTime);

    const jamMasukMin = parseTimeToMinutes(masterJamGuru.jam_masuk || '08:00');
    const standardHonor = Number(masterJamGuru.honor_kehadiran) || 5000;

    const isLate = currentMin > jamMasukMin;
    const lateMinutes = isLate ? currentMin - jamMasukMin : 0;
    const initialHonor = isLate ? standardHonor * 0.5 : standardHonor;

    const recordPayload = {
      guru_id: currentUser.id,
      tanggal: today,
      waktu_datang: currentTime,
      status: 'Hadir',
      terlambat_menit: lateMinutes,
      honor_kehadiran: initialHonor
    };

    try {
      const { error } = await supabase.from('presensi_guru').upsert(recordPayload, { onConflict: 'guru_id,tanggal' });
      if (error) {
        await supabase.from('presensi_guru').insert(recordPayload);
      }

      await fetchAllGuruData();

      Swal.fire({
        icon: 'success',
        title: 'Absen Masuk Berhasil!',
        html: `
          <div class="text-left text-sm space-y-1 mt-2">
            <p><b>Waktu Datang:</b> ${currentTime} WIB</p>
            <p><b>Status:</b> ${isLate ? `<span class="text-red-600 font-bold">Terlambat ${lateMinutes} menit (Potongan 50%)</span>` : '<span class="text-emerald-600 font-bold">Tepat Waktu</span>'}</p>
            <p><b>Estimasi Honor Hadir:</b> Rp ${initialHonor.toLocaleString('id-ID')}</p>
          </div>
        `,
        confirmButtonColor: '#2a2c87'
      });
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Absen Masuk', text: err.message });
    }
  };

  const handleAbsenPulangSekolah = async () => {
    if (!currentUser || !myPresensi?.waktu_datang) {
      Swal.fire({ icon: 'warning', title: 'Belum Absen Masuk', text: 'Anda belum melakukan absen masuk hari ini.' });
      return;
    }

    const today = getLocalDate();
    const currentTime = getTimeString();
    const currentMin = parseTimeToMinutes(currentTime);

    const jamPulangMin = parseTimeToMinutes(masterJamGuru.jam_pulang || '13:00');
    const standardHonor = Number(masterJamGuru.honor_kehadiran) || 5000;

    const isEarly = currentMin < jamPulangMin;
    const earlyMinutes = isEarly ? jamPulangMin - currentMin : 0;
    const wasLate = (myPresensi.terlambat_menit || 0) > 0;

    let finalHonor = 0;
    if (wasLate && isEarly) {
      finalHonor = 0;
    } else if (wasLate || isEarly) {
      finalHonor = standardHonor * 0.5;
    } else {
      finalHonor = standardHonor;
    }

    try {
      const { error } = await supabase
        .from('presensi_guru')
        .update({
          waktu_pulang: currentTime,
          pulang_cepat_menit: earlyMinutes,
          honor_kehadiran: finalHonor
        })
        .eq('id', myPresensi.id);

      if (error) throw error;

      await fetchAllGuruData();

      let infoDesc = '';
      if (wasLate && isEarly) {
        infoDesc = `<span class="text-red-600 font-bold">Terlambat Masuk & Pulang Cepat (Honor Hadir Hangus: Rp 0)</span>`;
      } else if (wasLate) {
        infoDesc = `<span class="text-amber-600 font-bold">Terlambat Masuk (Honor 50%: Rp ${finalHonor.toLocaleString('id-ID')})</span>`;
      } else if (isEarly) {
        infoDesc = `<span class="text-amber-600 font-bold">Pulang Lebih Awal ${earlyMinutes} menit (Honor 50%: Rp ${finalHonor.toLocaleString('id-ID')})</span>`;
      } else {
        infoDesc = `<span class="text-emerald-600 font-bold">Tepat Waktu (Honor Penuh: Rp ${finalHonor.toLocaleString('id-ID')})</span>`;
      }

      Swal.fire({
        icon: 'success',
        title: 'Absen Pulang Berhasil!',
        html: `
          <div class="text-left text-sm space-y-1 mt-2">
            <p><b>Waktu Pulang:</b> ${currentTime} WIB</p>
            <p><b>Status Evaluasi:</b> ${infoDesc}</p>
          </div>
        `,
        confirmButtonColor: '#2a2c87'
      });
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Absen Pulang', text: err.message });
    }
  };

  // =========================================================================
  // LOGIKA UNIVERSAL QR SCANNER (SESUAI MOBILE APP)
  // =========================================================================
  const handleUniversalQrScan = async (qrString) => {
    if (isScanProcessing) return;
    setIsScanProcessing(true);

    try {
      let payload;
      try {
        payload = JSON.parse(qrString);
      } catch (e) {
        Swal.fire({ icon: 'warning', title: 'QR Tidak Valid', text: 'Format QR Code tidak dikenali oleh sistem presensi SMP IT HM.' });
        return;
      }

      if (payload.app !== 'SMPITHM') {
        Swal.fire({ icon: 'warning', title: 'QR Tidak Sesuai', text: 'QR Code ini bukan stiker presensi resmi SMP IT Hidayatul Mubtadi-ien.' });
        return;
      }

      const today = getLocalDate();
      const currentTime = getTimeString();
      const currentMin = parseTimeToMinutes(currentTime);

      // CASE 1: KEHADIRAN SEKOLAH (MASUK / PULANG)
      if (payload.type === 'GURU_KEHADIRAN') {
        setIsScannerOpen(false);
        if (payload.action === 'MASUK') {
          await handleAbsenMasukSekolah();
        } else if (payload.action === 'PULANG') {
          await handleAbsenPulangSekolah();
        }
      }

      // CASE 2: KBM MENGAJAR DI KELAS (MASUK / KELUAR)
      else if (payload.type === 'GURU_KBM') {
        setIsScannerOpen(false);
        const kelasId = payload.kelas_id;
        const namaKelas = payload.nama_kelas || `Kelas ${kelasId}`;

        if (payload.action === 'MASUK') {
          await executeKbmMasuk(kelasId, namaKelas);
        } else if (payload.action === 'KELUAR') {
          await executeKbmKeluar(kelasId, namaKelas);
        }
      }
    } catch (err) {
      console.error('QR Scan Error:', err);
      Swal.fire({ icon: 'error', title: 'Gagal Memproses QR', text: err.message });
    } finally {
      setIsScanProcessing(false);
    }
  };

  // =========================================================================
  // LOGIKA KBM MENGAJAR DI KELAS (MASUK & SELESAI)
  // =========================================================================
  const executeKbmMasuk = async (kelasId, namaKelas) => {
    const today = getLocalDate();
    const currentTime = getTimeString();
    const currentMin = parseTimeToMinutes(currentTime);
    const todayName = getOperationalDayName();

    const { data: scheduleList } = await supabase
      .from('jadwal_pelajaran')
      .select('*, master_jam(*), data_mapel(*), data_guru(*)')
      .eq('kelas_id', kelasId)
      .eq('hari', todayName);

    const sortedSchedules = (scheduleList || []).sort((a, b) => {
      const uA = Number(a.master_jam?.urutan) || Number(a.jam_ke) || 999;
      const uB = Number(b.master_jam?.urutan) || Number(b.jam_ke) || 999;
      return uA - uB;
    });

    const lessonSlots = sortedSchedules.filter((s) => !s.is_istirahat && !s.master_jam?.is_istirahat);

    if (lessonSlots.length === 0) {
      Swal.fire({ icon: 'info', title: 'Jadwal Tidak Ditemukan', text: `Tidak ada jadwal pelajaran di ${namaKelas} pada hari ${todayName}.` });
      return;
    }

    // Cari slot yang aktif
    const scoredSlots = lessonSlots.map((s) => {
      const { startMin, endMin } = getSlotTimeRange(s);
      const isCurrentlyActive = currentMin >= startMin - 15 && currentMin <= endMin;
      const isMySlot = Number(s.guru_id) === Number(currentUser.id);
      const dist = Math.abs(currentMin - startMin);
      return { slot: s, startMin, endMin, isCurrentlyActive, isMySlot, dist };
    });

    const activeNow = scoredSlots.filter((item) => item.isCurrentlyActive);
    let matchedJadwal = null;

    if (activeNow.length > 0) {
      const myActive = activeNow.find((item) => item.isMySlot);
      if (myActive) {
        matchedJadwal = myActive.slot;
      } else {
        activeNow.sort((a, b) => a.dist - b.dist);
        matchedJadwal = activeNow[0].slot;
      }
    }

    if (!matchedJadwal) {
      const upcoming = scoredSlots.filter((item) => item.startMin > currentMin);
      if (upcoming.length > 0) {
        const myUpcoming = upcoming.find((item) => item.isMySlot);
        matchedJadwal = myUpcoming ? myUpcoming.slot : upcoming[0].slot;
      }
    }

    if (!matchedJadwal) {
      scoredSlots.sort((a, b) => a.dist - b.dist);
      matchedJadwal = scoredSlots[0]?.slot || lessonSlots[0];
    }

    const scheduledGuruId = matchedJadwal?.guru_id;
    const isPengganti = scheduledGuruId ? Number(scheduledGuruId) !== Number(currentUser.id) : false;
    const targetGuruId = isPengganti ? scheduledGuruId : currentUser.id;

    // Hitung estimasi JP berturut-turut
    const targetGuruSlots = lessonSlots.filter((s) => Number(s.guru_id) === Number(targetGuruId));
    const startIdx = targetGuruSlots.findIndex((s) => s.id === matchedJadwal?.id);
    const validStartIdx = startIdx >= 0 ? startIdx : 0;
    const remainingBlockSlots = targetGuruSlots.slice(validStartIdx);

    const estimatedJp = Math.max(1, remainingBlockSlots.length);
    const startJamName = matchedJadwal?.master_jam?.nama_jam || matchedJadwal?.jam_ke || '1';
    const endJamName = remainingBlockSlots[remainingBlockSlots.length - 1]?.master_jam?.nama_jam || remainingBlockSlots[remainingBlockSlots.length - 1]?.jam_ke || startJamName;
    const jamDisplay = startJamName === endJamName ? `Jam ${startJamName}` : `Jam ${startJamName} - ${endJamName}`;

    const proceedSaveKbm = async (isInval) => {
      const standardJpHonor = Number(masterJamGuru.honor_per_jp) || 6500;
      let lateMinutes = 0;
      if (matchedJadwal?.master_jam?.waktu_mulai) {
        const startMin = parseTimeToMinutes(matchedJadwal.master_jam.waktu_mulai.substring(0, 5));
        if (currentMin > startMin) {
          lateMinutes = currentMin - startMin;
        }
      }

      const netHonorKbm = standardJpHonor * estimatedJp;

      const { error: kbmErr } = await supabase.from('presensi_kbm_guru').insert({
        guru_id: currentUser.id,
        guru_asli_id: isInval ? scheduledGuruId : null,
        is_pengganti: isInval,
        jadwal_id: matchedJadwal?.id || null,
        kelas_id: kelasId,
        mapel_id: matchedJadwal?.mapel_id || null,
        tanggal: today,
        jam_ke: jamDisplay,
        jumlah_jp: estimatedJp,
        waktu_masuk: currentTime,
        terlambat_menit: lateMinutes,
        honor_kbm: netHonorKbm,
        status: 'Masuk'
      });

      if (kbmErr) throw kbmErr;

      await fetchAllGuruData();

      Swal.fire({
        icon: 'success',
        title: 'KBM Mengajar Dimulai!',
        html: `
          <div class="text-left text-sm space-y-1 mt-2">
            <p><b>Kelas:</b> ${namaKelas}</p>
            <p><b>Mata Pelajaran:</b> ${matchedJadwal?.data_mapel?.nama_mapel || '-'}</p>
            <p><b>Jadwal:</b> ${jamDisplay} (${estimatedJp} JP)</p>
            <p><b>Waktu Masuk:</b> ${currentTime} WIB</p>
            ${isInval ? `<p class="text-amber-600 font-bold">Status: Guru Pengganti (Inval: ${matchedJadwal?.data_guru?.nama || 'Guru Lain'})</p>` : ''}
            <p><b>Estimasi Honor:</b> Rp ${Math.round(netHonorKbm).toLocaleString('id-ID')} (Penuh)</p>
          </div>
        `,
        confirmButtonColor: '#2a2c87'
      });
    };

    if (isPengganti) {
      Swal.fire({
        title: 'Konfirmasi Guru Pengganti (Inval)',
        html: `Jadwal di <b>${namaKelas}</b> saat ini terdaftar untuk <b>${matchedJadwal?.data_guru?.nama || 'Guru Lain'}</b>.<br/><br/>Apakah Anda mengisi jam ini sebagai <b>Guru Pengganti (Inval)</b>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Saya Pengganti',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#2a2c87'
      }).then((res) => {
        if (res.isConfirmed) {
          proceedSaveKbm(true);
        }
      });
    } else {
      await proceedSaveKbm(false);
    }
  };

  const executeKbmKeluar = async (kelasId, namaKelas, explicitSessionId = null) => {
    const today = getLocalDate();
    const currentTime = getTimeString();
    const currentMin = parseTimeToMinutes(currentTime);

    let query = supabase
      .from('presensi_kbm_guru')
      .select('*')
      .eq('guru_id', currentUser.id)
      .eq('tanggal', today)
      .eq('status', 'Masuk');

    if (explicitSessionId) {
      query = query.eq('id', explicitSessionId);
    } else if (kelasId) {
      query = query.eq('kelas_id', kelasId);
    }

    const { data: activeKbm } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (!activeKbm) {
      Swal.fire({ icon: 'warning', title: 'Tidak Ditemukan', text: `Anda belum melakukan KBM Masuk di ${namaKelas || 'kelas ini'} hari ini.` });
      return;
    }

    const masukMin = parseTimeToMinutes(activeKbm.waktu_masuk);
    const durasi = Math.max(0, currentMin - masukMin);

    const todayName = getOperationalDayName();
    const { data: scheduleList } = await supabase
      .from('jadwal_pelajaran')
      .select('*, master_jam(*), data_mapel(*), data_guru(*)')
      .eq('kelas_id', activeKbm.kelas_id)
      .eq('hari', todayName);

    // ISOLASI GURU TARGET: jadwal guru lain diabaikan
    const targetGuruId = activeKbm.is_pengganti ? activeKbm.guru_asli_id : activeKbm.guru_id;
    const targetGuruSlots = (scheduleList || [])
      .filter((s) =>
        Number(s.guru_id) === Number(targetGuruId) &&
        !s.is_istirahat &&
        !s.master_jam?.is_istirahat
      )
      .sort((a, b) => {
        const uA = Number(a.master_jam?.urutan) || Number(a.jam_ke) || 999;
        const uB = Number(b.master_jam?.urutan) || Number(b.jam_ke) || 999;
        return uA - uB;
      });

    let finalJp = Number(activeKbm.jumlah_jp) || 1;
    let jamDisplay = activeKbm.jam_ke || 'Jam 1';

    if (targetGuruSlots.length > 0) {
      let startIdx = targetGuruSlots.findIndex((s) => s.id === activeKbm.jadwal_id);
      if (startIdx < 0) {
        startIdx = targetGuruSlots.findIndex((s) => {
          const { startMin: sMin, endMin: eMin } = getSlotTimeRange(s);
          return masukMin >= sMin - 20 && masukMin <= eMin + 15;
        });
        if (startIdx < 0) startIdx = 0;
      }

      const coveredSlots = [targetGuruSlots[startIdx]];
      for (let i = startIdx + 1; i < targetGuruSlots.length; i++) {
        const slot = targetGuruSlots[i];
        const { startMin: slotStartMin } = getSlotTimeRange(slot);
        if (currentMin >= slotStartMin - 5) {
          coveredSlots.push(slot);
        } else {
          break;
        }
      }

      finalJp = Math.max(1, coveredSlots.length);
      const startJam = coveredSlots[0]?.master_jam?.nama_jam || coveredSlots[0]?.jam_ke || '1';
      const endJam = coveredSlots[coveredSlots.length - 1]?.master_jam?.nama_jam || coveredSlots[coveredSlots.length - 1]?.jam_ke || startJam;
      jamDisplay = startJam === endJam ? `Jam ${startJam}` : `Jam ${startJam} - ${endJam}`;
    }

    const standardJpHonor = Number(masterJamGuru.honor_per_jp) || 6500;
    const finalHonor = finalJp * standardJpHonor;

    const { error: updateErr } = await supabase.from('presensi_kbm_guru').update({
      waktu_keluar: currentTime,
      durasi_menit: durasi,
      jumlah_jp: finalJp,
      honor_kbm: finalHonor,
      jam_ke: jamDisplay,
      status: 'Selesai'
    }).eq('id', activeKbm.id);

    if (updateErr) throw updateErr;

    await fetchAllGuruData();

    Swal.fire({
      icon: 'success',
      title: 'KBM Selesai!',
      html: `
        <div class="text-left text-sm space-y-1 mt-2">
          <p><b>Waktu Mengajar:</b> ${activeKbm.waktu_masuk} - ${currentTime} (${durasi} menit)</p>
          <p><b>Jam Terhitung:</b> ${jamDisplay} (${finalJp} JP)</p>
          <p><b>Honor KBM:</b> Rp ${finalHonor.toLocaleString('id-ID')} (Penuh)</p>
        </div>
      `,
      confirmButtonColor: '#2a2c87'
    });
  };

  // Handle open manual KBM modal
  const handleOpenManualKbmModal = async () => {
    setIsLoadingSchedules(true);
    setIsKbmModalOpen(true);
    const todayName = getOperationalDayName();
    try {
      const { data } = await supabase
        .from('jadwal_pelajaran')
        .select('*, data_kelas(nama_kelas), data_mapel(nama_mapel), master_jam(*), data_guru(nama)')
        .eq('hari', todayName)
        .order('jam_ke');

      setTodaySchedules(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  // Submit Izin / Sakit
  const handleSaveIzin = async () => {
    if (!izinForm.alasan.trim()) {
      Swal.fire({ icon: 'warning', title: 'Alasan Diperlukan', text: 'Mohon tuliskan alasan izin atau sakit secara jelas.' });
      return;
    }

    setIsSavingIzin(true);
    const today = getLocalDate();
    try {
      const payload = {
        guru_id: currentUser.id,
        tanggal: today,
        status: izinForm.status,
        alasan: izinForm.alasan
      };

      const { error } = await supabase.from('presensi_guru').upsert(payload, { onConflict: 'guru_id,tanggal' });
      if (error) {
        await supabase.from('presensi_guru').insert(payload);
      }

      setIsIzinModalOpen(false);
      await fetchAllGuruData();

      Swal.fire({
        icon: 'success',
        title: 'Tersimpan!',
        text: `Surat keterangan ${izinForm.status} berhasil disimpan di sistem.`
      });
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.message });
    } finally {
      setIsSavingIzin(false);
    }
  };

  // =========================================================================
  // LOGIKA REKAP OPERATOR
  // =========================================================================
  const fetchRekapData = async () => {
    setIsLoadingRekap(true);
    try {
      const { data: dataPegawai } = await supabase
        .from('data_guru')
        .select('id, nama')
        .is('tanggal_keluar', null)
        .order('nama');

      setPegawai(dataPegawai || []);

      const { data: dataPresensi } = await supabase
        .from('presensi_guru')
        .select('*')
        .eq('tanggal', tanggal);

      const map = {};
      if (dataPresensi) {
        dataPresensi.forEach(p => {
          map[p.guru_id] = p;
        });
      }
      setPresensiMap(map);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingRekap(false);
    }
  };

  const changeDate = (days) => {
    const d = new Date(tanggal);
    d.setDate(d.getDate() + days);
    setTanggal(getLocalDate(d));
  };

  const handleOpenEditOperator = (peg, pres) => {
    setEditOperatorModal({ pegawai: peg, presensi: pres });
    setEditOperatorForm({
      status: pres?.status || 'Hadir',
      waktu_datang: pres?.waktu_datang || '',
      waktu_pulang: pres?.waktu_pulang || '',
      alasan: pres?.alasan || ''
    });
  };

  const handleSaveOperatorEdit = async () => {
    if (!editOperatorModal?.pegawai) return;
    setIsSavingOperatorEdit(true);
    try {
      const pegId = editOperatorModal.pegawai.id;
      const payload = {
        guru_id: pegId,
        tanggal: tanggal,
        status: editOperatorForm.status,
        waktu_datang: editOperatorForm.status === 'Hadir' ? editOperatorForm.waktu_datang : null,
        waktu_pulang: editOperatorForm.status === 'Hadir' ? editOperatorForm.waktu_pulang : null,
        alasan: editOperatorForm.alasan || null
      };

      const { error } = await supabase.from('presensi_guru').upsert(payload, { onConflict: 'guru_id,tanggal' });
      if (error) {
        await supabase.from('presensi_guru').insert(payload);
      }

      setEditOperatorModal(null);
      await fetchRekapData();

      Swal.fire({
        icon: 'success',
        title: 'Berhasil Diperbarui',
        text: `Data presensi ${editOperatorModal.pegawai.nama} berhasil diperbarui oleh operator.`,
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Memperbarui', text: err.message });
    } finally {
      setIsSavingOperatorEdit(false);
    }
  };

  const handleExportCSV = () => {
    if (pegawai.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nama Pegawai,Status,Jam Datang,Terlambat (Menit),Jam Pulang,Pulang Cepat (Menit),Honor Hadir,Keterangan\n";

    pegawai.forEach(peg => {
      const p = presensiMap[peg.id];
      const status = p?.status || 'Belum Absen';
      const datang = p?.waktu_datang || '-';
      const telat = p?.terlambat_menit || 0;
      const pulang = p?.waktu_pulang || '-';
      const cepat = p?.pulang_cepat_menit || 0;
      const honor = p?.honor_kehadiran || 0;
      const ket = p?.alasan || '-';

      const row = `"${peg.nama}","${status}","${datang}","${telat}","${pulang}","${cepat}","${honor}","${ket}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Presensi_Guru_${tanggal}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Kalkulasi Total Honor Hari Ini
  const honorKehadiranHariIni = Number(myPresensi?.honor_kehadiran) || 0;
  const honorKbmHariIni = myKbmList.reduce((sum, k) => sum + (Number(k.honor_kbm) || 0), 0);
  const totalHonorHariIni = honorKehadiranHariIni + honorKbmHariIni;

  // Filtered Pegawai Rekap
  const filteredPegawai = pegawai.filter(p => p.nama?.toLowerCase().includes(searchTerm.toLowerCase()));
  const stats = {
    hadir: Object.values(presensiMap).filter(p => p.status === 'Hadir').length,
    izin: Object.values(presensiMap).filter(p => p.status === 'Izin').length,
    sakit: Object.values(presensiMap).filter(p => p.status === 'Sakit').length,
    alpa: Object.values(presensiMap).filter(p => p.status === 'Alpa').length,
    belum: Math.max(0, pegawai.length - Object.keys(presensiMap).length)
  };

  return (
    <div className="flex flex-col gap-6 pb-14 max-w-7xl mx-auto">
      {/* ========================================================================= */}
      {/* TOP HEADER & ACTION LINKS */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2.5">
              <Clock className="text-primary" /> Presensi Guru & KBM Mengajar
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Sistem terpadu presensi kehadiran kantor, jam pelajaran KBM di kelas, dan evaluasi honor.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/rekap-honor-guru"
              className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl font-bold text-xs transition shadow-xs"
            >
              <DollarSign size={15} /> Rekap Slip Honor
            </Link>
            {canManageQrAndJam && (
              <>
                <Link
                  to="/cetak-qr-presensi-guru"
                  className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 px-4 py-2 rounded-xl font-bold text-xs transition shadow-xs"
                >
                  <QrCode size={15} /> Cetak QR Stiker
                </Link>
                <Link
                  to="/master-jam-guru"
                  className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2 rounded-xl font-bold text-xs transition shadow-xs"
                >
                  <Clock size={15} /> Jam & Standar
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Tab Selector - Styled exactly as Presensi Siswa */}
        <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
          <div className="flex flex-wrap bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setCurrentTab('saya')}
              className={`px-5 py-2 text-xs font-bold flex items-center gap-2 rounded-lg transition-all ${
                currentTab === 'saya'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserCheck size={16} /> Presensi Saya
            </button>
            {isOperator && (
              <button
                type="button"
                onClick={() => setCurrentTab('rekap')}
                className={`px-5 py-2 text-xs font-bold flex items-center gap-2 rounded-lg transition-all ${
                  currentTab === 'rekap'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText size={16} /> Rekap Operator
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PRESENSI SAYA (UNIFIED MIRRORING MOBILE APP) */}
      {/* ========================================================================= */}
      {currentTab === 'saya' && (
        <div className="space-y-6">
          {/* 1. HERO UNIVERSAL SCANNER CARD */}
          <div className="bg-gradient-to-r from-primary to-blue-900 text-white p-6 md:p-8 rounded-3xl shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5 z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
                <QrCode size={34} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black">Pindai QR Presensi</h3>
                  <Sparkles size={18} className="text-amber-300 animate-pulse" />
                </div>
                <p className="text-blue-100 text-xs md:text-sm mt-1 max-w-xl">
                  Arahkan kamera ke QR Code di Pintu Kantor Sekolah atau Pintu Ruang Kelas. Satu scanner otomatis mendeteksi Kehadiran Sekolah maupun KBM Mengajar.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 z-10 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="w-full md:w-auto bg-white hover:bg-gray-100 text-primary px-6 py-3.5 rounded-2xl font-black text-sm shadow-md hover:shadow-xl transition flex items-center justify-center gap-2"
              >
                <Camera size={18} /> Buka Scanner Kamera
              </button>
            </div>

            {/* Subtle background decoration */}
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          </div>

          {/* 2. RINGKASAN ESTIMASI HONOR HARI INI */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-black">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Total Estimasi Honor Hari Ini</p>
                <h4 className="text-2xl font-black text-emerald-600">
                  Rp {totalHonorHariIni.toLocaleString('id-ID')}
                </h4>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-600 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200">
              <span className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-emerald-500" /> Kehadiran Kantor: 
                <span className="text-gray-900 font-black">Rp {honorKehadiranHariIni.toLocaleString('id-ID')}</span>
              </span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} className="text-blue-500" /> KBM ({myKbmList.length} Sesi): 
                <span className="text-gray-900 font-black">Rp {honorKbmHariIni.toLocaleString('id-ID')}</span>
              </span>
            </div>
          </div>

          {/* 3. GRID 2 KOLOM: KEHADIRAN SEKOLAH & KBM KELAS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* KARTU 1: KEHADIRAN SEKOLAH */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Kehadiran Sekolah Hari Ini</h4>
                    <p className="text-[11px] text-gray-400">
                      Standar Jam: {masterJamGuru.jam_masuk?.substring(0, 5) || '08:00'} - {masterJamGuru.jam_pulang?.substring(0, 5) || '13:00'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">
                  {getOperationalDate().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>

              {isMyLoading ? (
                <div className="py-8 text-center text-gray-400 flex items-center justify-center gap-2 text-xs">
                  <RefreshCw size={16} className="animate-spin text-primary" /> Memuat data kehadiran...
                </div>
              ) : !myPresensi ? (
                <div className="text-center py-6 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-3">
                  <Clock size={32} className="mx-auto text-gray-400" />
                  <div>
                    <h5 className="font-bold text-gray-700 text-sm">Belum Absen Masuk Hari Ini</h5>
                    <p className="text-xs text-gray-400 mt-0.5 max-w-sm mx-auto">
                      Silakan pindai stiker QR di gerbang/kantor atau klik tombol absen masuk otomatis di bawah.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleAbsenMasukSekolah}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                    >
                      <LogIn size={15} /> Absen Masuk Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsIzinModalOpen(true)}
                      className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <AlertCircle size={15} className="text-amber-500" /> Izin / Sakit
                    </button>
                  </div>
                </div>
              ) : myPresensi.status === 'Hadir' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Waktu Masuk */}
                    <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-2xl">
                      <p className="text-[11px] font-bold text-gray-500 uppercase">Jam Masuk</p>
                      <h5 className="text-2xl font-black text-gray-800 font-mono mt-1">
                        {myPresensi.waktu_datang || '--:--'}
                      </h5>
                      <div className="mt-2">
                        {myPresensi.terlambat_menit > 0 ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                            Telat {myPresensi.terlambat_menit}m (Potongan 50%)
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                            Tepat Waktu
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Waktu Pulang */}
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                      <p className="text-[11px] font-bold text-gray-500 uppercase">Jam Pulang</p>
                      <h5 className="text-2xl font-black text-gray-800 font-mono mt-1">
                        {myPresensi.waktu_pulang || '--:--'}
                      </h5>
                      <div className="mt-2">
                        {myPresensi.waktu_pulang ? (
                          myPresensi.pulang_cepat_menit > 0 ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                              Cepat {myPresensi.pulang_cepat_menit}m
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                              Tepat Waktu
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-gray-200 text-gray-600">
                            Belum Pulang
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tombol Absen Pulang jika belum */}
                  {!myPresensi.waktu_pulang ? (
                    <button
                      type="button"
                      onClick={handleAbsenPulangSekolah}
                      className="w-full py-3 bg-primary hover:bg-blue-900 text-white rounded-2xl font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
                    >
                      <LogOut size={16} /> Absen Pulang Sekarang
                    </button>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                      Presensi kehadiran sekolah hari ini telah tuntas tercatat.
                    </div>
                  )}
                </div>
              ) : (
                /* Status Izin / Sakit */
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                    <AlertCircle size={18} />
                    Status: {myPresensi.status.toUpperCase()}
                  </div>
                  <p className="text-xs text-amber-900 italic bg-white/80 p-3 rounded-xl border border-amber-200">
                    "{myPresensi.alasan || '-'}"
                  </p>
                  <p className="text-[11px] text-amber-700">Surat keterangan Anda tercatat di database sekolah.</p>
                </div>
              )}
            </div>

            {/* KARTU 2: KBM MENGAJAR DI KELAS */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Presensi KBM Mengajar di Kelas</h4>
                    <p className="text-[11px] text-gray-400">
                      Standar Honor: Rp {Number(masterJamGuru.honor_per_jp || 6500).toLocaleString('id-ID')} / JP
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenManualKbmModal}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 transition"
                >
                  + Mulai KBM
                </button>
              </div>

              {myKbmList.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-2">
                  <BookOpen size={32} className="mx-auto text-gray-300" />
                  <p className="text-xs font-bold text-gray-600">Belum ada sesi KBM yang tercatat hari ini.</p>
                  <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                    Pindai QR stiker kelas saat memasuki ruang atau klik "+ Mulai KBM" untuk memilih jadwal.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {myKbmList.map((kbm) => {
                    const isMasuk = kbm.status === 'Masuk';
                    return (
                      <div 
                        key={kbm.id} 
                        className={`p-4 rounded-2xl border transition ${
                          isMasuk ? 'bg-amber-50/70 border-amber-200' : 'bg-gray-50/70 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-sm text-gray-800">
                                {kbm.data_kelas?.nama_kelas || `Kelas ${kbm.kelas_id}`}
                              </h5>
                              <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-white text-gray-700 border border-gray-200">
                                {kbm.jam_ke || `${kbm.jumlah_jp || 1} JP`}
                              </span>
                              {kbm.is_pengganti && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500 text-white">
                                  INVAL
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-primary font-semibold mt-0.5">
                              {kbm.data_mapel?.nama_mapel || 'Pelajaran Umum'}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-black text-emerald-600">
                              Rp {Number(kbm.honor_kbm || 0).toLocaleString('id-ID')}
                            </span>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {kbm.jumlah_jp || 1} JP
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-600 pt-3 mt-3 border-t border-gray-200/60">
                          <div>
                            <span>Jam: <b>{kbm.waktu_masuk}</b> s/d <b>{kbm.waktu_keluar || 'Sedang Mengajar...'}</b></span>
                            {kbm.durasi_menit > 0 && <span className="text-gray-400"> ({kbm.durasi_menit} mnt)</span>}
                          </div>

                          {isMasuk && (
                            <button
                              type="button"
                              onClick={() => executeKbmKeluar(kbm.kelas_id, kbm.data_kelas?.nama_kelas, kbm.id)}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shadow-xs transition"
                            >
                              Selesaikan Sesi Ini
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REKAP OPERATOR (DASHBOARD PEMANTAUAN PRESENSI GURU) */}
      {/* ========================================================================= */}
      {currentTab === 'rekap' && isOperator && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Tanggal Switcher */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeDate(-1)}
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition"
                title="Hari Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => changeDate(1)}
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition"
                title="Hari Berikutnya"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setTanggal(getLocalDate())}
                className="px-3 py-2 bg-blue-50 text-primary hover:bg-blue-100 font-bold rounded-xl text-xs transition"
              >
                Hari Ini
              </button>
            </div>

            {/* Search & Export */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search size={15} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama guru..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                type="button"
                onClick={fetchRekapData}
                disabled={isLoadingRekap}
                className="p-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl transition"
                title="Segarkan Rekap"
              >
                <RefreshCw size={15} className={isLoadingRekap ? "animate-spin text-primary" : ""} />
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>

          {/* 5 Stats KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Hadir</p>
              <h4 className="text-2xl font-black text-emerald-600 mt-1">{stats.hadir}</h4>
              <p className="text-[10px] text-gray-400">Pegawai tepat/telat</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Sakit</p>
              <h4 className="text-2xl font-black text-amber-600 mt-1">{stats.sakit}</h4>
              <p className="text-[10px] text-gray-400">Ada surat keterangan</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Izin</p>
              <h4 className="text-2xl font-black text-blue-600 mt-1">{stats.izin}</h4>
              <p className="text-[10px] text-gray-400">Izin resmi</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Alpa</p>
              <h4 className="text-2xl font-black text-red-600 mt-1">{stats.alpa}</h4>
              <p className="text-[10px] text-gray-400">Tanpa keterangan</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs col-span-2 md:col-span-1">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Belum Absen</p>
              <h4 className="text-2xl font-black text-gray-500 mt-1">{stats.belum}</h4>
              <p className="text-[10px] text-gray-400">Dari total {pegawai.length} guru</p>
            </div>
          </div>

          {/* Table Pegawai */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">No</th>
                    <th className="px-5 py-3.5">Nama Guru / Pegawai</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Jam Datang</th>
                    <th className="px-5 py-3.5">Jam Pulang</th>
                    <th className="px-5 py-3.5">Honor Hadir</th>
                    <th className="px-5 py-3.5">Keterangan</th>
                    <th className="px-5 py-3.5 text-center">Aksi Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingRekap ? (
                    <tr>
                      <td colSpan="8" className="px-5 py-12 text-center text-gray-400 font-medium">
                        <RefreshCw size={20} className="animate-spin text-primary mx-auto mb-2" />
                        Memuat data rekap presensi...
                      </td>
                    </tr>
                  ) : filteredPegawai.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-5 py-8 text-center text-gray-400">
                        Tidak ada data pegawai yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredPegawai.map((peg, idx) => {
                      const p = presensiMap[peg.id];
                      const status = p?.status || 'Belum Absen';

                      let badgeClass = 'bg-gray-100 text-gray-600';
                      if (status === 'Hadir') badgeClass = 'bg-emerald-100 text-emerald-800';
                      else if (status === 'Izin') badgeClass = 'bg-blue-100 text-blue-800';
                      else if (status === 'Sakit') badgeClass = 'bg-amber-100 text-amber-800';
                      else if (status === 'Alpa') badgeClass = 'bg-red-100 text-red-800';

                      return (
                        <tr key={peg.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3.5 text-gray-400 font-semibold">{idx + 1}</td>
                          <td className="px-5 py-3.5 font-bold text-gray-900">{peg.nama}</td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${badgeClass}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono">
                            {p?.waktu_datang ? (
                              <div>
                                <span>{p.waktu_datang}</span>
                                {p.terlambat_menit > 0 && (
                                  <span className="ml-1.5 text-[10px] text-red-600 font-bold">
                                    (Telat {p.terlambat_menit}m)
                                  </span>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-5 py-3.5 font-mono">
                            {p?.waktu_pulang ? (
                              <div>
                                <span>{p.waktu_pulang}</span>
                                {p.pulang_cepat_menit > 0 && (
                                  <span className="ml-1.5 text-[10px] text-amber-600 font-bold">
                                    (Cepat {p.pulang_cepat_menit}m)
                                  </span>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-emerald-700">
                            {p?.honor_kehadiran ? `Rp ${Number(p.honor_kehadiran).toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 italic max-w-xs truncate">
                            {p?.alasan || '-'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenEditOperator(peg, p)}
                              className="px-2.5 py-1.5 bg-gray-100 hover:bg-primary hover:text-white rounded-lg text-gray-600 font-bold transition flex items-center justify-center gap-1 mx-auto"
                              title="Edit Presensi Pegawai Ini"
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: UNIVERSAL QR SCANNER KAMERA */}
      {/* ========================================================================= */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleUniversalQrScan}
        isProcessing={isScanProcessing}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: IZIN / SAKIT GURU */}
      {/* ========================================================================= */}
      {isIzinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={20} /> Pengajuan Izin / Sakit
              </h4>
              <button onClick={() => setIsIzinModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Jenis Keterangan</label>
              <select
                value={izinForm.status}
                onChange={(e) => setIzinForm({ ...izinForm, status: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin Tidak Masuk</option>
                <option value="Dinas Luar">Dinas Luar / Tugas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Alasan Lengkap *</label>
              <textarea
                rows="3"
                value={izinForm.alasan}
                onChange={(e) => setIzinForm({ ...izinForm, alasan: e.target.value })}
                placeholder="Tuliskan keterangan detail izin/sakit..."
                className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsIzinModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSavingIzin}
                onClick={handleSaveIzin}
                className="px-5 py-2 bg-primary hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingIzin ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Simpan Keterangan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PILIH KBM DARI JADWAL HARI INI */}
      {/* ========================================================================= */}
      {isKbmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <BookOpen className="text-purple-600" size={20} /> Mulai Sesi KBM Mengajar
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">Pilih kelas dari jadwal aktif hari {getOperationalDayName()}</p>
              </div>
              <button onClick={() => setIsKbmModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {isLoadingSchedules ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                <RefreshCw size={20} className="animate-spin text-primary mx-auto mb-2" />
                Memuat jadwal pelajaran...
              </div>
            ) : todaySchedules.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                Tidak ada jadwal KBM yang terdaftar pada hari ini.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {todaySchedules.map((sch) => {
                  const isMine = Number(sch.guru_id) === Number(currentUser?.id);
                  return (
                    <div
                      key={sch.id}
                      className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 hover:bg-purple-50/40 hover:border-purple-200 transition flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-gray-800">
                            {sch.data_kelas?.nama_kelas || `Kelas ${sch.kelas_id}`}
                          </h5>
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-white border border-gray-200 text-gray-600">
                            Jam {sch.master_jam?.nama_jam || sch.jam_ke}
                          </span>
                          {isMine ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                              Jadwal Saya
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                              Inval: {sch.data_guru?.nama || 'Guru Lain'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-purple-700 font-semibold mt-1">
                          {sch.data_mapel?.nama_mapel || 'Pelajaran Umum'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsKbmModalOpen(false);
                          executeKbmMasuk(sch.kelas_id, sch.data_kelas?.nama_kelas);
                        }}
                        className="px-3 py-1.5 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-xs transition"
                      >
                        Mulai Sesi
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsKbmModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDIT MANUAL OLEH OPERATOR */}
      {/* ========================================================================= */}
      {editOperatorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <Edit3 className="text-primary" size={18} /> Edit Presensi Pegawai
                </h4>
                <p className="text-xs text-primary font-bold mt-0.5">{editOperatorModal.pegawai.nama}</p>
              </div>
              <button onClick={() => setEditOperatorModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Status Kehadiran</label>
              <select
                value={editOperatorForm.status}
                onChange={(e) => setEditOperatorForm({ ...editOperatorForm, status: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Hadir">Hadir</option>
                <option value="Izin">Izin</option>
                <option value="Sakit">Sakit</option>
                <option value="Alpa">Alpa / Tanpa Keterangan</option>
              </select>
            </div>

            {editOperatorForm.status === 'Hadir' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Jam Datang</label>
                  <input
                    type="time"
                    value={editOperatorForm.waktu_datang}
                    onChange={(e) => setEditOperatorForm({ ...editOperatorForm, waktu_datang: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Jam Pulang</label>
                  <input
                    type="time"
                    value={editOperatorForm.waktu_pulang}
                    onChange={(e) => setEditOperatorForm({ ...editOperatorForm, waktu_pulang: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Keterangan / Catatan Operator</label>
              <textarea
                rows="2"
                value={editOperatorForm.alasan}
                onChange={(e) => setEditOperatorForm({ ...editOperatorForm, alasan: e.target.value })}
                placeholder="Catatan izin / alasan perubahan..."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditOperatorModal(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSavingOperatorEdit}
                onClick={handleSaveOperatorEdit}
                className="px-5 py-2 bg-primary hover:bg-blue-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingOperatorEdit ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
