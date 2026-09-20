import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Clock, Search, QrCode, CheckCircle, AlertCircle, Calendar, Edit3, 
  XCircle, FileText, PieChart, Filter, Settings, AlertTriangle, 
  ChevronLeft, ChevronRight, Printer, Send, Eye, X, ShieldAlert, 
  Info, CalendarDays, ArrowUpDown, Download, Check, Sparkles, RefreshCw 
} from 'lucide-react';
import Swal from 'sweetalert2';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats, Html5Qrcode } from 'html5-qrcode';
import CryptoJS from 'crypto-js';
import { Link } from 'react-router-dom';
import { getOperationalDate, getOperationalDayIndex, getLocalDate } from '../utils/dateUtils';
import KopSurat from '../components/KopSurat';

export default function PresensiSiswa() {
  const [currentTab, setCurrentTab] = useState('scan'); // 'scan' | 'manual' | 'rekap' | 'peringatan'
  const [tanggal, setTanggal] = useState(getLocalDate());
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);

  // Settings Kedisiplinan & Master Jam Global
  const [tipeHari, setTipeHari] = useState('reguler');
  const [jamMasuk, setJamMasuk] = useState('07:00');
  const [jamPulang, setJamPulang] = useState('13:00');
  const [masterOpsi, setMasterOpsi] = useState([]);

  useEffect(() => {
    const fetchMasterOpsi = async () => {
      try {
        const { data, error } = await supabase.from('master_jam_presensi').select('*').order('id', { ascending: true });
        if (!error && data && data.length > 0) {
          setMasterOpsi(data);
          const active = data.find(d => d.is_active) || data[0];
          if (active) {
            setTipeHari(active.id.toString());
            setJamMasuk((active.jam_masuk || '07:00').substring(0, 5));
            const isJumat = getOperationalDayIndex() === 5;
            setJamPulang(isJumat ? '10:40' : (active.jam_pulang || '13:00').substring(0, 5));
          }
        }
      } catch (err) {
        console.log('Using default fallback:', err);
      }
    };
    fetchMasterOpsi();
  }, []);

  // Manual Mode State
  const [siswaList, setSiswaList] = useState([]);
  const [isManualLoading, setIsManualLoading] = useState(false);

  // Bulk Izin State
  const [manualKelas, setManualKelas] = useState('');
  const [manualStatus, setManualStatus] = useState('Sakit');
  const [manualAlasan, setManualAlasan] = useState('');
  const [selectedSiswaIds, setSelectedSiswaIds] = useState([]);
  const [availableKelas, setAvailableKelas] = useState([]);

  // Rekap Advanced Filter State
  const [rekapFilterMode, setRekapFilterMode] = useState('harian'); // 'harian' | 'mingguan' | 'bulanan' | 'semester'
  const [rekapTanggal, setRekapTanggal] = useState(getLocalDate());
  const [rekapWeekOffset, setRekapWeekOffset] = useState(0); // 0 = current week
  const [rekapBulan, setRekapBulan] = useState(new Date().getMonth() + 1);
  const [rekapTahun, setRekapTahun] = useState(new Date().getFullYear());
  const [rekapFilterKelas, setRekapFilterKelas] = useState('');
  const [rekapFilterStatus, setRekapFilterStatus] = useState('');
  const [rekapSearch, setRekapSearch] = useState('');

  const [rekapData, setRekapData] = useState([]);
  const [isRekapLoading, setIsRekapLoading] = useState(false);
  const [rekapStats, setRekapStats] = useState({ hadir: 0, izin: 0, terlambat: 0, bolos: 0 });

  // Peringatan Kedisiplinan State
  const [peringatanFilterMode, setPeringatanFilterMode] = useState('semua'); // 'semua' | '7_hari' | 'mingguan' | '30_hari' | 'bulanan'
  const [peringatanWeekOffset, setPeringatanWeekOffset] = useState(0);
  const [peringatanBulan, setPeringatanBulan] = useState(new Date().getMonth() + 1);
  const [peringatanTahun, setPeringatanTahun] = useState(new Date().getFullYear());
  const [peringatanFilterKelas, setPeringatanFilterKelas] = useState('');
  const [peringatanFilterKategori, setPeringatanFilterKategori] = useState('semua'); // 'semua' | 'bolos_alfa' | 'terlambat'
  const [peringatanSearch, setPeringatanSearch] = useState('');
  const [peringatanList, setPeringatanList] = useState([]);
  const [isPeringatanLoading, setIsPeringatanLoading] = useState(false);
  const [warningSummary, setWarningSummary] = useState({ totalSiswa: 0, count7Days: 0, count30Days: 0, mingguanCount: 0, bulananCount: 0, totalKasus: 0 });
  const [selectedViolator, setSelectedViolator] = useState(null);
  const [suratPeringatanModal, setSuratPeringatanModal] = useState(null);
  const [isSendingWa, setIsSendingWa] = useState(false);

  // Identitas Lembaga & Kepala Sekolah dari Database
  const [dataLembaga, setDataLembaga] = useState({
    nama_lembaga: 'SMP IT Hidayatul Mubtadi-ien',
    npsn: '70004822',
    alamat: 'Dusun Sukaseneng RT 025 RW 010 Desa Compreng Kec. Compreng Kab. Subang',
    kepala_sekolah: 'Abdul Manaf, S.Pd',
    nip_kepsek: '-'
  });
  const [dataKepsek, setDataKepsek] = useState({
    nama: 'Abdul Manaf, S.Pd',
    nip: '',
    nuptk: '',
    niy: '',
    nipLabel: ''
  });

  const fetchLembagaAndKepsek = async () => {
    try {
      // 1. Fetch data_lembaga
      const { data: lemb } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (lemb) {
        setDataLembaga(lemb);
      }

      // 2. Fetch data_guru for Kepala Sekolah (via jabatan_guru or by nama)
      let kepsekGuru = null;
      try {
        const { data: jg } = await supabase
          .from('jabatan_guru')
          .select('guru_id, jabatan_utama')
          .ilike('jabatan_utama', '%kepala sekolah%')
          .limit(1)
          .maybeSingle();

        if (jg?.guru_id) {
          const { data: g } = await supabase
            .from('data_guru')
            .select('id, nama, nip, nuptk, niy, no_wa')
            .eq('id', jg.guru_id)
            .maybeSingle();
          if (g) kepsekGuru = g;
        }
      } catch (e) {
        console.warn('Gagal fetch jabatan_guru:', e);
      }

      // Fallback query data_guru by name from data_lembaga.kepala_sekolah
      if (!kepsekGuru && lemb?.kepala_sekolah) {
        const cleanName = lemb.kepala_sekolah.split(',')[0].trim();
        const { data: g } = await supabase
          .from('data_guru')
          .select('id, nama, nip, nuptk, niy, no_wa')
          .ilike('nama', `%${cleanName}%`)
          .limit(1)
          .maybeSingle();
        if (g) kepsekGuru = g;
      }

      if (kepsekGuru) {
        let nipLabel = '';
        if (kepsekGuru.nip && kepsekGuru.nip !== '-') {
          nipLabel = `NIP. ${kepsekGuru.nip}`;
        } else if (kepsekGuru.niy && kepsekGuru.niy !== '-') {
          nipLabel = `NIY. ${kepsekGuru.niy}`;
        } else if (kepsekGuru.nuptk && kepsekGuru.nuptk !== '-') {
          nipLabel = `NUPTK. ${kepsekGuru.nuptk}`;
        }

        setDataKepsek({
          nama: kepsekGuru.nama || lemb?.kepala_sekolah || 'Abdul Manaf, S.Pd',
          nip: kepsekGuru.nip || '',
          nuptk: kepsekGuru.nuptk || '',
          niy: kepsekGuru.niy || '',
          nipLabel
        });
      } else if (lemb?.kepala_sekolah) {
        setDataKepsek({
          nama: lemb.kepala_sekolah,
          nip: lemb.nip_kepsek && lemb.nip_kepsek !== '-' ? lemb.nip_kepsek : '',
          nuptk: '',
          niy: '',
          nipLabel: lemb.nip_kepsek && lemb.nip_kepsek !== '-' ? `NIP. ${lemb.nip_kepsek}` : ''
        });
      }
    } catch (err) {
      console.error('Error fetching data lembaga/kepsek:', err);
    }
  };

  // Fetch initial master kelas & lembaga on mount
  useEffect(() => {
    fetchLembagaAndKepsek();
    const fetchInitialKelas = async () => {
      try {
        const { data: dataKelas } = await supabase.from('data_kelas').select('nama_kelas').order('nama_kelas');
        if (dataKelas && dataKelas.length > 0) {
          setAvailableKelas(dataKelas.map(k => k.nama_kelas));
        } else {
          const { data: dataSiswa } = await supabase.from('data_siswa').select('kelas').ilike('status_keaktifan', 'aktif');
          if (dataSiswa) {
            setAvailableKelas([...new Set(dataSiswa.map(s => s.kelas).filter(Boolean))].sort());
          }
        }
      } catch (err) {
        console.error('Error fetching initial kelas:', err);
      }
    };
    fetchInitialKelas();
  }, []);

  useEffect(() => {
    if (currentTab === 'manual') {
      fetchSiswaData();
    } else if (currentTab === 'rekap') {
      fetchRekapData();
    } else if (currentTab === 'peringatan') {
      fetchPeringatanData();
    }
  }, [
    currentTab, 
    rekapFilterMode, 
    rekapTanggal, 
    rekapWeekOffset, 
    rekapBulan, 
    rekapTahun, 
    peringatanFilterMode, 
    peringatanWeekOffset, 
    peringatanBulan, 
    peringatanTahun, 
    peringatanFilterKategori
  ]);

  // Load badge count on mount
  useEffect(() => {
    fetchPeringatanData();
  }, []);

  // One-time effect untuk merestore kolom kelas pada siswa yang Lulus menjadi 'IX'
  useEffect(() => {
    const restoreKelasLulus = async () => {
      try {
        await supabase
          .from('data_siswa')
          .update({ kelas: 'IX' })
          .ilike('status_keaktifan', 'lulus')
          .is('kelas', null);
      } catch (e) {
        console.error(e);
      }
    };
    restoreKelasLulus();
  }, []);

  const sendWhatsAppNotification = (nama, kelas, wa_ortu, status, waktu) => {
    try {
      console.log("Fonnte: Mulai mengirim WA untuk", nama);
      const token = import.meta.env.VITE_FONNTE_TOKEN;
      console.log("Fonnte Token loaded:", token ? "YES" : "NO");
      
      if (!token) return; // Jika belum disetting di .env, lewati saja

      // Bersihkan karakter selain angka (menghapus spasi, strip, tanda plus, dll)
      let noWa = (wa_ortu || '').toString().replace(/\D/g, '');
      console.log("Fonnte: Nomor raw dari DB:", wa_ortu, "-> Bersih:", noWa);
      
      // (Opsional) Jika Fonnte butuh format 62, ubah awalan 0 menjadi 62
      if (noWa.startsWith('0')) {
        noWa = '62' + noWa.substring(1);
      }

      console.log("Fonnte: Nomor final dikirim:", noWa);
      if (!noWa || noWa.length < 9) {
         console.log("Fonnte: Batal kirim, nomor tidak valid");
         return;
      }

      // Generate Random ID untuk variasi pesan agar tidak terdeteksi spam/pesan berulang
      const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const pesan = `*NOTIFIKASI ABSENSI SMP IT HM*\n\nYth. Bapak/Ibu Wali Murid,\nMemberitahukan bahwa ananda:\n\nNama: *${nama}*\nKelas: *${kelas}*\nStatus: *${status}*\nWaktu: *${waktu}*\n\nTerima kasih.\n\n_Ref: ${uniqueId}_`;

      const data = new URLSearchParams();
      data.append('target', noWa);
      data.append('message', pesan);
      
      // Mengatur delay Fonnte antara 15 hingga 30 detik untuk menghindari blokir
      const randomDelay = Math.floor(Math.random() * (30 - 15 + 1)) + 15;
      data.append('delay', randomDelay.toString());

      fetch('/api/fonnte/send', {
        method: 'POST',
        headers: {
          'Authorization': token
        },
        body: data
      })
      .then(res => res.json())
      .then(res => {
         console.log("Fonnte Response:", res);
      })
      .catch(err => console.error('Fonnte fetch error:', err));
    } catch (e) {
      console.error('Gagal menyiapkan kirim WA:', e);
    }
  };

  const sendPushNotification = async (nipd, title, body) => {
    try {
      const { data } = await supabase.from('user_push_tokens').select('expo_push_token').eq('nipd', nipd).maybeSingle();
      if (data && data.expo_push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: data.expo_push_token,
            sound: 'default',
            title: title,
            body: body,
            data: { route: '/dashboard' },
          }),
        });
      }
    } catch (e) {
      console.error('Gagal Push Notif:', e);
    }
  };

  const bulanNamaList = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Helper rentang minggu (Senin - Sabtu)
  const getWeekRangeByOffset = (offset = 0) => {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // 1: Senin, ..., 7: Minggu
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1 + (offset * 7));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const startStr = getLocalDate(monday);
    const endStr = getLocalDate(saturday);
    return { monday, saturday, startStr, endStr };
  };

  const formatWeekRangeLabel = (arg1, arg2) => {
    let monday, saturday;
    if (typeof arg1 === 'number') {
      const range = getWeekRangeByOffset(arg1);
      monday = range.monday;
      saturday = range.saturday;
    } else {
      monday = arg1;
      saturday = arg2;
    }
    if (!monday || !saturday) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${monday.getDate()} ${months[monday.getMonth()]} - ${saturday.getDate()} ${months[saturday.getMonth()]} ${saturday.getFullYear()}`;
  };

  const fetchRekapData = async () => {
    setIsRekapLoading(true);
    try {
      let startDateStr = '';
      let endDateStr = '';

      if (rekapFilterMode === 'harian') {
        startDateStr = rekapTanggal;
        endDateStr = rekapTanggal;
      } else if (rekapFilterMode === 'mingguan') {
        const { startStr, endStr } = getWeekRangeByOffset(rekapWeekOffset);
        startDateStr = startStr;
        endDateStr = endStr;
      } else if (rekapFilterMode === 'bulanan') {
        const firstDay = new Date(rekapTahun, rekapBulan - 1, 1);
        const lastDay = new Date(rekapTahun, rekapBulan, 0);
        startDateStr = getLocalDate(firstDay);
        endDateStr = getLocalDate(lastDay);
      } else if (rekapFilterMode === 'semester') {
        const m = new Date().getMonth();
        const y = new Date().getFullYear();
        if (m >= 6) {
          startDateStr = `${y}-07-01`;
          endDateStr = `${y}-12-31`;
        } else {
          startDateStr = `${y}-01-01`;
          endDateStr = `${y}-06-30`;
        }
      }

      let query = supabase
        .from('presensi_siswa')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('waktu_masuk', { ascending: false });

      if (startDateStr && endDateStr) {
        query = query.gte('tanggal', startDateStr).lte('tanggal', endDateStr);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Ambil NIPD unik dari data rekap
      const uniqueNipds = [...new Set((data || []).map(d => d.nipd).filter(Boolean))];
      
      let siswaMap = {};
      if (uniqueNipds.length > 0) {
        const { data: siswaData } = await supabase
          .from('data_siswa')
          .select('nipd, nama, kelas, wa_ortu')
          .in('nipd', uniqueNipds);
          
        if (siswaData) {
          siswaData.forEach(s => {
            siswaMap[s.nipd] = { nama: s.nama, kelas: s.kelas, wa_ortu: s.wa_ortu };
          });
        }
      }

      const todayStr = getLocalDate();
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const pulangMinutes = timeToMinutes(jamPulang);

      const finalData = (data || []).map(d => {
        let evalStatus = d.status || '';
        
        // Logika Bolos: absen masuk ada tapi pulang tidak ada, dan sudah melewati jam pulang atau hari sebelumnya
        if (d.waktu_masuk && !d.waktu_pulang) {
          const isPastDate = d.tanggal < todayStr;
          const isPastJamPulang = currentMinutes > pulangMinutes;
          
          if (isPastDate || (d.tanggal === todayStr && isPastJamPulang)) {
            evalStatus = 'Bolos';
          }
        }

        return {
          ...d,
          status: evalStatus,
          nama: siswaMap[d.nipd]?.nama || d.nama || 'Siswa Tidak Ditemukan',
          kelas: siswaMap[d.nipd]?.kelas || d.kelas || '-',
          wa_ortu: siswaMap[d.nipd]?.wa_ortu || ''
        };
      });

      setRekapData(finalData);

      let hadir = 0, izin = 0, terlambat = 0, bolos = 0;
      finalData.forEach(d => {
        const st = d.status || '';
        if (st.includes('Hadir')) hadir++;
        if (st.includes('Izin') || st.includes('Sakit') || st.includes('Dispensasi')) izin++;
        if (st.includes('Terlambat')) terlambat++;
        if (st.includes('Bolos') || st === 'Alfa') bolos++;
      });
      setRekapStats({ hadir, izin, terlambat, bolos });

    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal memuat data rekap.', 'error');
    } finally {
      setIsRekapLoading(false);
    }
  };

  const displayRekapData = useMemo(() => {
    return rekapData.filter(d => {
      if (rekapFilterKelas && d.kelas !== rekapFilterKelas) return false;
      if (rekapFilterStatus) {
        if (rekapFilterStatus === 'Hadir' && !d.status.includes('Hadir')) return false;
        if (rekapFilterStatus === 'Izin' && !(d.status.includes('Izin') || d.status.includes('Sakit') || d.status.includes('Dispensasi'))) return false;
        if (rekapFilterStatus === 'Terlambat' && !d.status.includes('Terlambat')) return false;
        if (rekapFilterStatus === 'Bolos' && !(d.status.includes('Bolos') || d.status === 'Alfa')) return false;
      }
      if (rekapSearch) {
        const q = rekapSearch.toLowerCase();
        const mNama = (d.nama || '').toLowerCase().includes(q);
        const mNipd = (d.nipd || '').includes(q);
        if (!mNama && !mNipd) return false;
      }
      return true;
    });
  }, [rekapData, rekapFilterKelas, rekapFilterStatus, rekapSearch]);

  // Fetch Data Peringatan Kedisiplinan Siswa
  const fetchPeringatanData = async () => {
    setIsPeringatanLoading(true);
    try {
      const todayObj = new Date();
      const todayStr = getLocalDate(todayObj);

      // Rentang 7 Hari Terakhir (rolling 7 hari)
      const d7 = new Date(todayObj);
      d7.setDate(todayObj.getDate() - 6);
      const start7Str = getLocalDate(d7);

      // Rentang 30 Hari Terakhir (rolling 30 hari)
      const d30 = new Date(todayObj);
      d30.setDate(todayObj.getDate() - 29);
      const start30Str = getLocalDate(d30);

      // Periode Bulan terpilih
      const firstDayMonth = new Date(peringatanTahun, peringatanBulan - 1, 1);
      const lastDayMonth = new Date(peringatanTahun, peringatanBulan, 0);
      const monthStartStr = getLocalDate(firstDayMonth);
      const monthEndStr = getLocalDate(lastDayMonth);

      // Periode Minggu terpilih (Senin - Sabtu)
      const { startStr: weekStartStr, endStr: weekEndStr } = getWeekRangeByOffset(peringatanWeekOffset);

      // Ambil batas tanggal minimum dan maksimum agar mencakup rentang minggu, bulan, 7 hari & 30 hari
      const allStarts = [start7Str, start30Str, weekStartStr, monthStartStr].sort();
      const allEnds = [todayStr, weekEndStr, monthEndStr].sort();
      const minDate = allStarts[0];
      const maxDate = allEnds[allEnds.length - 1];

      const { data: rawPresensi, error: errPresensi } = await supabase
        .from('presensi_siswa')
        .select('*')
        .in('status', ['Terlambat', 'Bolos', 'Alfa', 'Hadir (Blm Pulang)'])
        .gte('tanggal', minDate)
        .lte('tanggal', maxDate)
        .order('tanggal', { ascending: false });

      if (errPresensi) throw errPresensi;

      // Ambil data seluruh siswa aktif
      const { data: siswaData, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('nipd, nama, kelas, wa_ortu')
        .ilike('status_keaktifan', 'aktif');

      if (errSiswa) throw errSiswa;

      const siswaMap = {};
      (siswaData || []).forEach(s => {
        siswaMap[s.nipd] = s;
      });

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const pulangMinutes = timeToMinutes(jamPulang);

      const evaluasiList = (rawPresensi || []).map(d => {
        let st = d.status;
        if (st === 'Hadir (Blm Pulang)') {
          const isPastDate = d.tanggal < todayStr;
          const isPastJamPulang = currentMinutes > pulangMinutes;
          if (isPastDate || (d.tanggal === todayStr && isPastJamPulang)) {
            st = 'Bolos';
          }
        }
        return {
          ...d,
          status: st,
          nama: siswaMap[d.nipd]?.nama || d.nama || 'Siswa',
          kelas: siswaMap[d.nipd]?.kelas || d.kelas || '-',
          wa_ortu: siswaMap[d.nipd]?.wa_ortu || ''
        };
      }).filter(d => ['Terlambat', 'Bolos', 'Alfa'].includes(d.status));

      // Grouping per siswa (NIPD)
      const violatorMap = {};
      evaluasiList.forEach(p => {
        if (!violatorMap[p.nipd]) {
          violatorMap[p.nipd] = {
            nipd: p.nipd,
            nama: p.nama,
            kelas: p.kelas,
            wa_ortu: p.wa_ortu,
            violationsMonth: [],
            violationsWeek: [],
            violations7Days: [],
            violations30Days: [],
            allViolations: []
          };
        }

        // Cek masuk dalam bulan terpilih
        if (p.tanggal >= monthStartStr && p.tanggal <= monthEndStr) {
          violatorMap[p.nipd].violationsMonth.push(p);
        }

        // Cek masuk dalam minggu kalender terpilih
        if (p.tanggal >= weekStartStr && p.tanggal <= weekEndStr) {
          violatorMap[p.nipd].violationsWeek.push(p);
        }

        // Cek masuk dalam 7 hari terakhir
        if (p.tanggal >= start7Str && p.tanggal <= todayStr) {
          violatorMap[p.nipd].violations7Days.push(p);
        }

        // Cek masuk dalam 30 hari terakhir
        if (p.tanggal >= start30Str && p.tanggal <= todayStr) {
          violatorMap[p.nipd].violations30Days.push(p);
        }

        violatorMap[p.nipd].allViolations.push(p);
      });

      // Filter siswa yang melanggar ambang batas
      let result = [];
      let mCount = 0;
      let bCount = 0;
      let count7DaysTotal = 0;
      let count30DaysTotal = 0;
      let totalKasus = 0;

      Object.values(violatorMap).forEach(v => {
        const countMinggu = v.violationsWeek.length;
        const countBulan = v.violationsMonth.length;
        const count7Days = v.violations7Days.length;
        const count30Days = v.violations30Days.length;

        const isMingguan = countMinggu >= 3;
        const isBulanan = countBulan >= 6;
        const is7Days = count7Days >= 3;
        const is30Days = count30Days >= 6;

        if (isMingguan) mCount++;
        if (isBulanan) bCount++;
        if (is7Days) count7DaysTotal++;
        if (is30Days) count30DaysTotal++;

        if (isMingguan || isBulanan || is7Days || is30Days) {
          const candidateLists = [v.violations30Days, v.violationsMonth, v.violations7Days, v.violationsWeek];
          candidateLists.sort((a, b) => b.length - a.length);
          const vList = candidateLists[0] || v.allViolations;

          const jmlTerlambat = vList.filter(x => x.status === 'Terlambat').length;
          const jmlBolos = vList.filter(x => x.status === 'Bolos').length;
          const jmlAlfa = vList.filter(x => x.status === 'Alfa').length;
          totalKasus += vList.length;

          let levelPeringatan = '';
          if (isBulanan || is30Days) {
            levelPeringatan = 'Peringatan Bulanan (≥6x)';
          } else if (isMingguan || is7Days) {
            levelPeringatan = 'Peringatan Mingguan (≥3x)';
          } else {
            levelPeringatan = 'Peringatan Kedisiplinan';
          }

          result.push({
            nipd: v.nipd,
            nama: v.nama,
            kelas: v.kelas,
            wa_ortu: v.wa_ortu,
            countMinggu,
            countBulan,
            count7Days,
            count30Days,
            isMingguan,
            isBulanan,
            is7Days,
            is30Days,
            levelPeringatan,
            jmlTerlambat,
            jmlBolos,
            jmlAlfa,
            totalPelanggaran: Math.max(countBulan, countMinggu, count7Days, count30Days),
            violationsList: v.allViolations
          });
        }
      });

      // Sort pelanggaran terbanyak ke terendah
      result.sort((a, b) => b.totalPelanggaran - a.totalPelanggaran);

      setPeringatanList(result);
      setWarningSummary({
        totalSiswa: result.length,
        count7Days: count7DaysTotal,
        count30Days: count30DaysTotal,
        mingguanCount: mCount,
        bulananCount: bCount,
        totalKasus
      });

    } catch (e) {
      console.error('Gagal fetch data peringatan:', e);
      Swal.fire('Error', 'Gagal memuat data peringatan kedisiplinan.', 'error');
    } finally {
      setIsPeringatanLoading(false);
    }
  };

  const displayPeringatanList = useMemo(() => {
    return peringatanList.filter(item => {
      // Filter Mode Peringatan
      if (peringatanFilterMode === '7_hari' && !item.is7Days) return false;
      if (peringatanFilterMode === '30_hari' && !item.is30Days) return false;
      if (peringatanFilterMode === 'mingguan' && !item.isMingguan) return false;
      if (peringatanFilterMode === 'bulanan' && !item.isBulanan) return false;

      // Filter Kelas
      if (peringatanFilterKelas && item.kelas !== peringatanFilterKelas) return false;

      // Filter Kategori Pelanggaran
      if (peringatanFilterKategori === 'bolos_alfa' && (item.jmlBolos + item.jmlAlfa) === 0) return false;
      if (peringatanFilterKategori === 'terlambat' && item.jmlTerlambat === 0) return false;

      // Filter Search
      if (peringatanSearch) {
        const q = peringatanSearch.toLowerCase();
        const mNama = (item.nama || '').toLowerCase().includes(q);
        const mNipd = (item.nipd || '').includes(q);
        if (!mNama && !mNipd) return false;
      }

      return true;
    });
  }, [peringatanList, peringatanFilterMode, peringatanFilterKelas, peringatanFilterKategori, peringatanSearch]);

  const handleSendWaPeringatan = async (item) => {
    if (!item.wa_ortu) {
      Swal.fire('Informasi', `Nomor WhatsApp orang tua ${item.nama} belum terdaftar di Data Siswa.`, 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Kirim Peringatan WA?',
      html: `Kirim notifikasi peringatan pelanggaran presensi ke orang tua <b>${item.nama}</b> (${item.wa_ortu})?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Kirim Sekarang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2a2c87'
    });

    if (confirm.isConfirmed) {
      setIsSendingWa(true);
      try {
        const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const namaSekolah = (dataLembaga.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase();
        const pesan = `*SURAT PERINGATAN KEDISIPLINAN SISWA*\n*${namaSekolah}*\n\nYth. Bapak/Ibu Wali Murid dari:\nNama: *${item.nama}*\nKelas: *${item.kelas}*\n\nDengan ini kami memberitahukan bahwa ananda telah tercatat melanggar kedisiplinan presensi sekolah sebanyak *${item.totalPelanggaran} kali*:\n- Terlambat: ${item.jmlTerlambat}x\n- Bolos: ${item.jmlBolos}x\n- Alfa: ${item.jmlAlfa}x\n\nKategori Peringatan: *${item.levelPeringatan}*\n\nMohon kerja sama Bapak/Ibu untuk membimbing dan mengingatkan ananda agar dapat hadir tertib dan tepat waktu di sekolah.\n\nTerima kasih.\n_Ref: ${uniqueId}_`;

        const token = import.meta.env.VITE_FONNTE_TOKEN;
        if (token) {
          let noWa = (item.wa_ortu || '').toString().replace(/\D/g, '');
          if (noWa.startsWith('0')) noWa = '62' + noWa.substring(1);
          const data = new URLSearchParams();
          data.append('target', noWa);
          data.append('message', pesan);
          await fetch('/api/fonnte/send', {
            method: 'POST',
            headers: { 'Authorization': token },
            body: data
          });
        }
        Swal.fire('Terkirim!', `Pesan peringatan berhasil dikirimkan ke orang tua ${item.nama}.`, 'success');
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Gagal mengirim pesan WhatsApp.', 'error');
      } finally {
        setIsSendingWa(false);
      }
    }
  };

  const fetchSiswaData = async () => {
    setIsManualLoading(true);
    try {
      // Fetch Siswa
      const { data: dataSiswa, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('id, nipd, nama, kelas, status_keaktifan, wa_ortu')
        .ilike('status_keaktifan', 'aktif')
        .order('nama');

      if (errSiswa) throw errSiswa;

      // Fetch Presensi Hari Ini
      const { data: dataAbsen, error: errAbsen } = await supabase
        .from('presensi_siswa')
        .select('nipd')
        .eq('tanggal', tanggal);

      if (errAbsen) throw errAbsen;

      // Filter: Hanya siswa yang BELUM ada di tabel presensi_siswa pada tanggal ini
      const absenNipds = (dataAbsen || []).map(a => a.nipd);
      const siswaBelumAbsen = (dataSiswa || []).filter(s => !absenNipds.includes(s.nipd));

      setSiswaList(siswaBelumAbsen);

      // Fetch Kelas dari Supabase
      const { data: dataKelas, error: errKelas } = await supabase
        .from('data_kelas')
        .select('nama_kelas')
        .order('nama_kelas');

      if (!errKelas && dataKelas) {
        setAvailableKelas(dataKelas.map(k => k.nama_kelas));
      } else if (dataSiswa) {
        // Fallback jika gagal fetch kelas
        setAvailableKelas([...new Set(dataSiswa.map(s => s.kelas).filter(Boolean))].sort());
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal memuat data siswa/kelas.', 'error');
    } finally {
      setIsManualLoading(false);
    }
  };

  // Fungsi helper Tahun Ajaran & Semester
  const getTahunAjaranSemester = () => {
    const d = new Date(tanggal);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const semester = m >= 7 ? 'Ganjil' : 'Genap';
    const tahun_ajaran = m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
    return { tahun_ajaran, semester };
  };

  const filteredSiswa = manualKelas ? siswaList.filter(s => {
    if (!s.kelas) return false;
    return String(s.kelas).trim().toLowerCase() === String(manualKelas).trim().toLowerCase();
  }) : [];

  const toggleSiswaSelection = (nipd) => {
    setSelectedSiswaIds(prev =>
      prev.includes(nipd) ? prev.filter(id => id !== nipd) : [...prev, nipd]
    );
  };

  const handleSelectAll = () => {
    if (selectedSiswaIds.length === filteredSiswa.length && filteredSiswa.length > 0) {
      setSelectedSiswaIds([]);
    } else {
      setSelectedSiswaIds(filteredSiswa.map(s => s.nipd));
    }
  };

  const submitBulkManual = async () => {
    if (isProcessingRef.current) return;

    if (selectedSiswaIds.length === 0) {
      return Swal.fire('Peringatan', 'Belum ada siswa yang dipilih!', 'warning');
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    try {
      const { tahun_ajaran, semester } = getTahunAjaranSemester();
      const now = new Date();
      const jamSekarang = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const selectedSiswaList = filteredSiswa.filter(s => selectedSiswaIds.includes(s.nipd));

      const payloadArray = selectedSiswaList.map(siswa => ({
        nipd: siswa.nipd,
        nama: siswa.nama,
        kelas: siswa.kelas,
        tanggal: tanggal,
        waktu_masuk: jamSekarang,
        status: manualStatus,
        alasan: manualAlasan || '-',
        tahun_ajaran,
        semester
      }));

      // Lakukan pengecekan apakah mereka sudah ada absensinya hari ini
      // Hapus data lama (jika ada) untuk siswa dan tanggal yang sama agar tidak bentrok
      const nipdList = payloadArray.map(p => p.nipd);
      await supabase.from('presensi_siswa').delete().in('nipd', nipdList).eq('tanggal', tanggal);

      // Insert data presensi baru
      const { error } = await supabase
        .from('presensi_siswa')
        .insert(payloadArray);

      if (error) throw error;

      Swal.fire('Berhasil!', `Presensi ${manualStatus} untuk ${payloadArray.length} siswa berhasil disimpan.`, 'success');
      
      // Kirim Notifikasi WA ke masing-masing siswa yang dipilih secara background dengan JEDA (Anti-Spam)
      let currentDelayMs = 0;
      selectedSiswaList.forEach((siswa, index) => {
        // Tambahkan delay acak antara 15000ms hingga 30000ms untuk tiap pengiriman berikutnya
        const randomMs = Math.floor(Math.random() * (30000 - 15000 + 1)) + 15000;
        currentDelayMs += (index === 0 ? 0 : randomMs);
        
        setTimeout(() => {
          sendWhatsAppNotification(siswa.nama, siswa.kelas, siswa.wa_ortu, manualStatus, jamSekarang);
          sendPushNotification(siswa.nipd, `Presensi ${manualStatus}`, `Ananda ${siswa.nama} telah dicatat dengan status: ${manualStatus}.`);
        }, currentDelayMs);
      });

      // Reset form selection
      setSelectedSiswaIds([]);
      setManualAlasan('');

      // Refresh list agar yang barusan disubmit hilang dari layar
      fetchSiswaData();
    } catch (e) {
      console.error(e);
      const errorMsg = e.message || (typeof e === 'string' ? e : JSON.stringify(e));
      Swal.fire('Error', `Gagal memproses presensi: ${errorMsg}`, 'error');
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  const SECRET_KEY = import.meta.env.VITE_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
  };

  const changeTipeHari = (tipe) => {
    setTipeHari(tipe);
    const selected = masterOpsi.find(o => o.id.toString() === tipe.toString() || o.tipe_hari === tipe);
    if (selected) {
      setJamMasuk((selected.jam_masuk || '07:00').substring(0, 5));
      setJamPulang((selected.jam_pulang || '13:00').substring(0, 5));
    } else {
      if (tipe === 'reguler') {
        setJamMasuk('07:00');
        setJamPulang('13:00');
      } else if (tipe === 'ramadhan') {
        setJamMasuk('07:30');
        setJamPulang('11:30');
      } else if (tipe === 'spesial') {
        setJamMasuk('08:00');
        setJamPulang('11:00');
      }
    }
  };

  const processScanResult = async (decodedText) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    let nipd = '';
    try {
      const bytes = CryptoJS.AES.decrypt(decodedText, SECRET_KEY);
      nipd = bytes.toString(CryptoJS.enc.Utf8).trim();

      if (!nipd) {
        throw new Error('Hasil dekripsi kosong');
      }
    } catch (e) {
      console.error("Gagal mendeskripsi QR:", e);
      Swal.fire('Tidak Valid', 'QR Code tidak dikenali atau bukan format resmi.', 'error');

      // Delay to avoid spam
      setTimeout(() => setIsProcessing(false), 3000);
      return;
    }

    try {
      // 1. Cari data siswa berdasarkan NIPD
      const { data: dataSiswa, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('nipd, nama, kelas, wa_ortu')
        .eq('nipd', nipd)
        .maybeSingle();

      if (errSiswa) throw errSiswa;
      if (!dataSiswa) {
        Swal.fire('Tidak Ditemukan', `Siswa dengan NIPD ${nipd} tidak ditemukan.`, 'warning');
        setIsProcessing(false);
        return;
      }

      // 2. Cek apakah sudah absen masuk/pulang hari ini
      const { data: existingDataList, error: errCheck } = await supabase
        .from('presensi_siswa')
        .select('*')
        .eq('nipd', nipd)
        .eq('tanggal', tanggal)
        .order('created_at', { ascending: false })
        .limit(1);

      if (errCheck) throw errCheck;

      const existingData = existingDataList && existingDataList.length > 0 ? existingDataList[0] : null;

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const jM = timeToMinutes(jamMasuk);
      const jP = timeToMinutes(jamPulang);

      if (!existingData) {
        // Belum absen masuk
        let actStatus = 'Hadir (Blm Pulang)';
        if (timeToMinutes(currentTime) > jM) {
          actStatus = 'Terlambat';
        }

        const { tahun_ajaran, semester } = getTahunAjaranSemester();

        const payload = {
          nipd: dataSiswa.nipd,
          nama: dataSiswa.nama,
          kelas: dataSiswa.kelas,
          tanggal: tanggal,
          waktu_masuk: currentTime,
          status: actStatus,
          alasan: '-',
          tahun_ajaran,
          semester
        };
        const { error: errInsert } = await supabase.from('presensi_siswa').insert(payload);
        if (errInsert) throw errInsert;

        Swal.fire({
          icon: 'success',
          title: 'TAP MASUK BERHASIL',
          html: `<b class="text-xl">${dataSiswa.nama}</b><br><span class="text-primary font-bold">Waktu: ${currentTime}</span>`,
          timer: 2000,
          showConfirmButton: false
        });

        // Kirim Notifikasi WA Masuk/Terlambat
        sendWhatsAppNotification(dataSiswa.nama, dataSiswa.kelas, dataSiswa.wa_ortu, actStatus, currentTime);
        sendPushNotification(dataSiswa.nipd, 'Tap Masuk Berhasil', `Ananda ${dataSiswa.nama} telah melakukan tap masuk pada ${currentTime} dengan status: ${actStatus}.`);

      } else {
        // Sudah ada data presensi hari ini
        if (existingData.status.includes('Izin') || existingData.status.includes('Sakit') || existingData.status.includes('Dispensasi')) {
          Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'Siswa Berstatus Izin/Sakit!', showConfirmButton: false, timer: 2000 });
          return;
        }

        if (existingData.waktu_masuk && existingData.waktu_pulang) {
          Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'Sudah Absen Pulang!', showConfirmButton: false, timer: 2000 });
          return;
        }

        if (existingData.waktu_masuk) {
          const diffMins = timeToMinutes(currentTime) - timeToMinutes(existingData.waktu_masuk);
          if (diffMins < 5) {
            Swal.fire({ toast: true, position: 'top', icon: 'warning', title: 'Tap Terlalu Cepat!', showConfirmButton: false, timer: 2000 });
            return;
          }

          if (timeToMinutes(currentTime) < timeToMinutes('10:00')) {
            Swal.fire({ toast: true, position: 'top', icon: 'info', title: `Sudah Tap Masuk (${existingData.waktu_masuk}). Belum jam pulang!`, showConfirmButton: false, timer: 3000 });
            return;
          }

          // Absen pulang
          let actStatus = 'Hadir';
          const wMasuk = existingData.waktu_masuk;

          if (timeToMinutes(wMasuk) > jM) {
            actStatus = 'Terlambat';
          } else if (timeToMinutes(currentTime) < jP) {
            actStatus = 'Bolos';
          }

          const payload = {
            waktu_pulang: currentTime,
            status: actStatus
          };
          const { error: errUpdate } = await supabase
            .from('presensi_siswa')
            .update(payload)
            .eq('id', existingData.id);

          if (errUpdate) throw errUpdate;

          Swal.fire({
            icon: 'success',
            title: 'TAP PULANG BERHASIL',
            html: `<b class="text-xl">${dataSiswa.nama}</b><br><span class="text-primary font-bold">Waktu: ${currentTime}</span>`,
            timer: 2000,
            showConfirmButton: false
          });

          // Kirim Notifikasi WA Pulang/Bolos
          sendWhatsAppNotification(dataSiswa.nama, dataSiswa.kelas, dataSiswa.wa_ortu, actStatus, currentTime);
          sendPushNotification(dataSiswa.nipd, 'Tap Pulang Berhasil', `Ananda ${dataSiswa.nama} telah melakukan tap pulang pada ${currentTime}.`);
        }
      }
    } catch (e) {
      console.error("Gagal mencatat presensi:", e);
      const errorMsg = e.message || (typeof e === 'string' ? e : JSON.stringify(e));
      Swal.fire('Error', `Gagal memproses presensi: ${errorMsg}`, 'error');
    } finally {
      // Beri delay sedikit sebelum bisa scan lagi untuk menghindari spam
      setTimeout(() => {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }, 3000);
    }
  };

  const handleManualAction = async (siswa, status, keterangan) => {
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
    try {
      // Cek data existing
      const { data: existingDataList, error: errCheck } = await supabase
        .from('presensi_siswa')
        .select('id')
        .eq('nipd', siswa.nipd)
        .eq('tanggal', tanggal)
        .order('created_at', { ascending: false })
        .limit(1);

      const existingData = existingDataList && existingDataList.length > 0 ? existingDataList[0] : null;

      const payload = {
        nipd: siswa.nipd,
        nama: siswa.nama,
        kelas: siswa.kelas,
        tanggal: tanggal,
        status: status,
        alasan: keterangan || '-'
      };

      if (status === 'Hadir') {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        payload.waktu_masuk = currentTime;
      }

      let error = null;
      if (existingData) {
        const { error: errUpdate } = await supabase.from('presensi_siswa').update(payload).eq('id', existingData.id);
        error = errUpdate;
      } else {
        const { error: errInsert } = await supabase.from('presensi_siswa').insert(payload);
        error = errInsert;
      }

      if (error) throw error;

      Swal.fire('Berhasil!', `Status ${siswa.nama} berhasil diubah menjadi ${status}.`, 'success');
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal menyimpan presensi.', 'error');
    }
  };

  const openManualForm = (siswa) => {
    Swal.fire({
      title: `Input Presensi: ${siswa.nama}`,
      html: `
        <select id="swal-status" class="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4">
          <option value="Izin">Izin</option>
          <option value="Sakit">Sakit</option>
          <option value="Dispensasi">Dispensasi</option>
          <option value="Hadir">Hadir (Manual)</option>
        </select>
        <textarea id="swal-alasan" rows="3" placeholder="Keterangan / Alasan (Opsional)" class="w-full px-4 py-3 border border-gray-200 rounded-xl"></textarea>
      `,
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      preConfirm: () => {
        const status = document.getElementById('swal-status').value;
        const alasan = document.getElementById('swal-alasan').value;
        return { status, alasan };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        handleManualAction(siswa, result.value.status, result.value.alasan);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Clock className="text-primary" /> Presensi Siswa
          </h2>
          <p className="text-gray-500 text-sm mt-1">Sistem presensi QR Code dan input manual.</p>
        </div>
        <div className="flex flex-wrap bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setCurrentTab('scan')}
            className={`px-4 md:px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors ${currentTab === 'scan' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <QrCode size={16} /> Scan QR
          </button>
          <button
            onClick={() => setCurrentTab('manual')}
            className={`px-4 md:px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors border-l border-gray-100 ${currentTab === 'manual' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Edit3 size={16} /> Input Manual
          </button>
          <button
            onClick={() => setCurrentTab('rekap')}
            className={`px-4 md:px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors border-l border-gray-100 ${currentTab === 'rekap' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <FileText size={16} /> Rekap Data
          </button>
          <button
            onClick={() => setCurrentTab('peringatan')}
            className={`px-4 md:px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors border-l border-gray-100 relative ${currentTab === 'peringatan' ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'}`}
          >
            <ShieldAlert size={16} />
            <span>Peringatan Disiplin</span>
            {warningSummary.totalSiswa > 0 && (
              <span className={`px-2 py-0.5 text-[11px] rounded-full font-black ${currentTab === 'peringatan' ? 'bg-white text-red-600' : 'bg-red-600 text-white animate-pulse'}`}>
                {warningSummary.totalSiswa}
              </span>
            )}
          </button>
        </div>
      </div>

      {currentTab !== 'rekap' && currentTab !== 'peringatan' && (
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-gray-700">Tanggal Aktif:</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="date"
                value={tanggal}
                onChange={e => setTanggal(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50 font-bold"
              />
            </div>
          </div>

          {currentTab === 'scan' && (
            <>
              <div className="w-px h-8 bg-gray-200 hidden md:block"></div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">Tipe Hari:</label>
                <select
                  value={tipeHari}
                  onChange={(e) => changeTipeHari(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50 font-bold"
                >
                  {masterOpsi.length > 0 ? (
                    masterOpsi.map(m => (
                      <option key={m.id} value={m.id.toString()}>{m.tipe_hari}</option>
                    ))
                  ) : (
                    <>
                      <option value="reguler">Hari Reguler</option>
                      <option value="ramadhan">Bulan Ramadhan</option>
                      <option value="spesial">Hari Spesial/Event</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">Jam Masuk:</label>
                <input
                  type="time"
                  value={jamMasuk}
                  onChange={(e) => setJamMasuk(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50 font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">Jam Pulang:</label>
                <input
                  type="time"
                  value={jamPulang}
                  onChange={(e) => setJamPulang(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50 font-bold"
                />
              </div>

              <Link 
                to="/master-jam-presensi" 
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition whitespace-nowrap shadow-sm"
                title="Kelola Master Jam Presensi Global"
              >
                <Settings size={14} /> Master Opsi Jam
              </Link>
            </>
          )}
        </div>
      )}

      {currentTab === 'scan' && (
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-gray-100 max-w-3xl mx-auto w-full text-center">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Scanner QR Code</h3>
          <p className="text-gray-500 mb-8">Arahkan QR Code Kartu Pelajar ke kamera untuk presensi.</p>

          <div className="mx-auto overflow-hidden rounded-2xl border-4 border-dashed border-gray-200 p-2 max-w-md bg-gray-50 relative">
            <QrScanner onScan={processScanResult} isProcessing={isProcessing} />
            {isProcessing && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl z-10">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p className="font-bold text-primary">Memproses...</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-center gap-8">
            <div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 px-4 py-2 rounded-xl">
              <CheckCircle size={20} /> <span className="text-sm">Scan Masuk</span>
            </div>
            <div className="flex items-center gap-2 text-blue-600 font-medium bg-blue-50 px-4 py-2 rounded-xl">
              <CheckCircle size={20} /> <span className="text-sm">Scan Pulang</span>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'manual' && (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-4xl mx-auto">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Edit3 className="text-primary" /> Input Izin / Sakit Massal Siswa
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Kelas</label>
              <select
                value={manualKelas}
                onChange={e => {
                  setManualKelas(e.target.value);
                  setSelectedSiswaIds([]);
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary font-semibold text-primary outline-none bg-gray-50"
              >
                <option value="">-- Silahkan Pilih Kelas --</option>
                {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Status Keterangan</label>
              <select
                value={manualStatus}
                onChange={e => setManualStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary font-semibold text-orange-600 outline-none bg-gray-50"
              >
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin / Acara Keluarga</option>
                <option value="Dispensasi">Dispensasi Sekolah</option>
                <option value="Alfa">Alfa (Tanpa Keterangan)</option>
                <option value="Bolos">Bolos</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Keterangan Tambahan (Opsional)</label>
            <input
              type="text"
              value={manualAlasan}
              onChange={e => setManualAlasan(e.target.value)}
              placeholder="Contoh: Sakit demam, lomba antar sekolah, dll"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50"
            />
          </div>

          {manualKelas && (
            <div className="border-t border-gray-100 pt-6">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-primary">Daftar Siswa Kelas {manualKelas} (Centang yang Izin)</label>
                <button
                  onClick={handleSelectAll}
                  className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-lg font-bold text-gray-700 transition"
                >
                  {selectedSiswaIds.length === filteredSiswa.length && filteredSiswa.length > 0 ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 max-h-72 overflow-y-auto">
                {isManualLoading ? (
                  <p className="text-center text-gray-400 py-4">Memuat data siswa...</p>
                ) : filteredSiswa.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">Tidak ada siswa di kelas ini.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredSiswa.map(siswa => (
                      <label
                        key={siswa.id}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition ${selectedSiswaIds.includes(siswa.nipd) ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100 hover:border-orange-100'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSiswaIds.includes(siswa.nipd)}
                          onChange={() => toggleSiswaSelection(siswa.nipd)}
                          className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-800">{siswa.nama}</span>
                          <span className="text-xs text-gray-500 font-mono">{siswa.nipd}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={submitBulkManual}
                  disabled={selectedSiswaIds.length === 0 || isProcessing}
                  className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${selectedSiswaIds.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20'}`}
                >
                  {isProcessing ? (
                    <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</>
                  ) : (
                    <><Edit3 size={18} /> Simpan Presensi {manualStatus} untuk {selectedSiswaIds.length} Siswa</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB REKAP DATA */}
      {currentTab === 'rekap' && (
        <div className="flex flex-col gap-6">
          {/* Filter Bar Utama */}
          <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <PieChart className="text-primary" size={22} /> Rekap & Analisis Kehadiran Siswa
                </h3>
                <p className="text-xs text-gray-500 mt-1">Pilih rentang waktu untuk melihat analitik kehadiran siswa.</p>
              </div>

              {/* Mode Filter Toggle: Harian | Mingguan | Bulanan | Semester */}
              <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto">
                <button
                  onClick={() => setRekapFilterMode('harian')}
                  className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    rekapFilterMode === 'harian' ? 'bg-white text-primary shadow-sm font-black' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar size={14} /> Harian
                </button>
                <button
                  onClick={() => setRekapFilterMode('mingguan')}
                  className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    rekapFilterMode === 'mingguan' ? 'bg-white text-primary shadow-sm font-black' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <CalendarDays size={14} /> Mingguan
                </button>
                <button
                  onClick={() => setRekapFilterMode('bulanan')}
                  className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    rekapFilterMode === 'bulanan' ? 'bg-white text-primary shadow-sm font-black' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <PieChart size={14} /> Bulanan
                </button>
                <button
                  onClick={() => setRekapFilterMode('semester')}
                  className={`flex-1 md:flex-initial px-4 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    rekapFilterMode === 'semester' ? 'bg-white text-primary shadow-sm font-black' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText size={14} /> Semester
                </button>
              </div>
            </div>

            {/* Sub-bar: Pengaturan Tanggal Sesuai Mode */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-3">
                {rekapFilterMode === 'harian' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-500">Pilih Tanggal:</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={15} />
                      <input
                        type="date"
                        value={rekapTanggal}
                        onChange={e => setRekapTanggal(e.target.value)}
                        className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50 font-bold text-gray-700"
                      />
                    </div>
                    <button
                      onClick={() => setRekapTanggal(getLocalDate())}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
                    >
                      Hari Ini
                    </button>
                  </div>
                )}

                {rekapFilterMode === 'mingguan' && (
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                    <button
                      onClick={() => setRekapWeekOffset(prev => prev - 1)}
                      className="p-1 hover:bg-gray-200 rounded-lg text-gray-600 transition"
                      title="Pekan Sebelumnya"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-primary">
                      <CalendarDays size={15} className="text-primary" />
                      <span>{formatWeekRangeLabel(rekapWeekOffset)}</span>
                    </div>
                    <button
                      onClick={() => setRekapWeekOffset(prev => prev + 1)}
                      className="p-1 hover:bg-gray-200 rounded-lg text-gray-600 transition"
                      title="Pekan Berikutnya"
                    >
                      <ChevronRight size={16} />
                    </button>
                    {rekapWeekOffset !== 0 && (
                      <button
                        onClick={() => setRekapWeekOffset(0)}
                        className="ml-2 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg text-[11px] transition"
                      >
                        Pekan Ini
                      </button>
                    )}
                  </div>
                )}

                {rekapFilterMode === 'bulanan' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-500">Bulan & Tahun:</label>
                    <select
                      value={rekapBulan}
                      onChange={e => setRekapBulan(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50 font-bold text-gray-700"
                    >
                      {bulanNamaList.map((bln, idx) => (
                        <option key={idx + 1} value={idx + 1}>{bln}</option>
                      ))}
                    </select>
                    <select
                      value={rekapTahun}
                      onChange={e => setRekapTahun(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50 font-bold text-gray-700"
                    >
                      {[2024, 2025, 2026, 2027].map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>
                )}

                {rekapFilterMode === 'semester' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-xs font-bold">
                    <FileText size={15} />
                    <span>{getTahunAjaranSemester().semester} T.A. {getTahunAjaranSemester().tahun_ajaran}</span>
                  </div>
                )}
              </div>

              {/* Tombol Refresh Rekap */}
              <button
                onClick={fetchRekapData}
                disabled={isRekapLoading}
                className="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-xl text-xs flex items-center gap-1.5 transition ml-auto"
              >
                <RefreshCw size={14} className={isRekapLoading ? 'animate-spin' : ''} />
                <span>{isRekapLoading ? 'Memuat...' : 'Segarkan Data'}</span>
              </button>
            </div>

            {/* Filter Tambahan: Kelas, Status & Pencarian */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
              <select
                value={rekapFilterKelas}
                onChange={e => setRekapFilterKelas(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50 font-semibold text-gray-700"
              >
                <option value="">Semua Kelas</option>
                {availableKelas.map(k => <option key={k} value={k}>Kelas {k}</option>)}
              </select>

              <select
                value={rekapFilterStatus}
                onChange={e => setRekapFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50 font-semibold text-gray-700"
              >
                <option value="">Semua Status</option>
                <option value="Hadir">Hadir</option>
                <option value="Terlambat">Terlambat</option>
                <option value="Bolos">Bolos / Alfa</option>
                <option value="Izin">Izin / Sakit / Dispensasi</option>
              </select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  placeholder="Cari siswa atau NIPD..."
                  value={rekapSearch}
                  onChange={e => setRekapSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50"
                />
                {rekapSearch && (
                  <button 
                    onClick={() => setRekapSearch('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <span className="text-xs text-gray-500 font-semibold ml-auto">
                Menampilkan <strong>{displayRekapData.length}</strong> data presensi
              </span>
            </div>
          </div>

          {/* 4 Kartu KPI Kehadiran */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-2xl p-5 border border-green-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-green-600 uppercase mb-1">Hadir</p>
                <h4 className="text-3xl font-black text-gray-800">{rekapStats.hadir}</h4>
              </div>
              <CheckCircle size={36} className="text-green-200" />
            </div>
            <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-orange-600 uppercase mb-1">Izin / Sakit</p>
                <h4 className="text-3xl font-black text-gray-800">{rekapStats.izin}</h4>
              </div>
              <AlertCircle size={36} className="text-orange-200" />
            </div>
            <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-yellow-600 uppercase mb-1">Terlambat</p>
                <h4 className="text-3xl font-black text-gray-800">{rekapStats.terlambat}</h4>
              </div>
              <Clock size={36} className="text-yellow-200" />
            </div>
            <div className="bg-red-50 rounded-2xl p-5 border border-red-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-red-600 uppercase mb-1">Bolos / Alfa</p>
                <h4 className="text-3xl font-black text-gray-800">{rekapStats.bolos}</h4>
              </div>
              <XCircle size={36} className="text-red-200" />
            </div>
          </div>

          {/* Tabel Rekap Data Presensi */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">No</th>
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Siswa</th>
                    <th className="px-6 py-4">Masuk</th>
                    <th className="px-6 py-4">Pulang</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {isRekapLoading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <p className="font-bold text-gray-500">Memuat data rekap...</p>
                        </div>
                      </td>
                    </tr>
                  ) : displayRekapData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                        <p className="font-bold text-gray-600">Belum ada data presensi pada periode dan filter ini.</p>
                      </td>
                    </tr>
                  ) : (
                    displayRekapData.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-xs font-bold text-gray-400">{idx + 1}</td>
                        <td className="px-6 py-4 text-gray-700 font-bold text-xs">{log.tanggal}</td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{log.nama}</p>
                          <p className="text-[11px] text-gray-500 font-mono">{log.nipd} • Kls {log.kelas}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-primary font-bold">{log.waktu_masuk || '-'}</td>
                        <td className="px-6 py-4 font-mono text-red-500 font-bold">{log.waktu_pulang || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${
                            log.status.includes('Terlambat') ? 'bg-yellow-100 text-yellow-700' :
                            (log.status.includes('Bolos') || log.status === 'Alfa') ? 'bg-red-100 text-red-700' :
                            (log.status.includes('Izin') || log.status.includes('Sakit') || log.status.includes('Dispensasi')) ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 italic">{log.alasan || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB PERINGATAN DISIPLIN SISWA */}
      {currentTab === 'peringatan' && (
        <div className="flex flex-col gap-6">
          {/* Header Card & Rule Banner */}
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-700 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm mb-2">
                  <ShieldAlert size={14} /> Sistem Monitoring Kedisiplinan Siswa
                </div>
                <h3 className="text-2xl md:text-3xl font-black">Peringatan Disiplin & Ketidakhadiran</h3>
                <p className="text-white/80 text-sm mt-1 max-w-2xl">
                  Siswa yang terakumulasi melanggar <strong>≥ 3 kali dalam seminggu</strong> atau <strong>≥ 6 kali dalam sebulan</strong> (Alfa, Bolos, Terlambat) secara otomatis terjaring untuk penerbitan surat peringatan dan panggilan wali murid.
                </p>
              </div>
              <button
                onClick={fetchPeringatanData}
                disabled={isPeringatanLoading}
                className="px-4 py-2.5 bg-white text-red-700 hover:bg-gray-100 font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-md whitespace-nowrap self-start md:self-auto"
              >
                <RefreshCw size={14} className={isPeringatanLoading ? 'animate-spin' : ''} />
                <span>{isPeringatanLoading ? 'Memuat...' : 'Segarkan Data'}</span>
              </button>
            </div>
          </div>

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Total Siswa Terjaring</p>
                <h4 className="text-3xl font-black text-red-600">{warningSummary.totalSiswa}</h4>
                <p className="text-[11px] text-gray-400 mt-1">Siswa aktif</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                <ShieldAlert size={26} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-yellow-600 uppercase mb-1">Peringatan Mingguan</p>
                <h4 className="text-3xl font-black text-yellow-600">{warningSummary.mingguanCount}</h4>
                <p className="text-[11px] text-gray-400 mt-1">≥ 3x dlm 1 pekan</p>
              </div>
              <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-600">
                <AlertTriangle size={26} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-rose-600 uppercase mb-1">Peringatan Bulanan</p>
                <h4 className="text-3xl font-black text-rose-600">{warningSummary.bulananCount}</h4>
                <p className="text-[11px] text-gray-400 mt-1">≥ 6x dlm 1 bulan</p>
              </div>
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
                <AlertCircle size={26} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-primary uppercase mb-1">Total Kasus Pelanggaran</p>
                <h4 className="text-3xl font-black text-primary">{warningSummary.totalKasus}</h4>
                <p className="text-[11px] text-gray-400 mt-1">Insiden tercatat</p>
              </div>
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-primary">
                <PieChart size={26} />
              </div>
            </div>
          </div>

          {/* Filter Toolbar Peringatan */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Type toggle: Semua | 7 Hari Terakhir | Mingguan | 30 Hari Terakhir | Bulanan */}
              <div className="flex flex-wrap bg-gray-100 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setPeringatanFilterMode('semua')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${peringatanFilterMode === 'semua' ? 'bg-white text-red-600 shadow-sm font-black' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Semua Peringatan
                </button>
                <button
                  onClick={() => setPeringatanFilterMode('7_hari')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${peringatanFilterMode === '7_hari' ? 'bg-white text-amber-600 shadow-sm font-black' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  7 Hari Terakhir (≥ 3x)
                </button>
                <button
                  onClick={() => setPeringatanFilterMode('mingguan')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${peringatanFilterMode === 'mingguan' ? 'bg-white text-yellow-600 shadow-sm font-black' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Mingguan (≥ 3x)
                </button>
                <button
                  onClick={() => setPeringatanFilterMode('30_hari')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${peringatanFilterMode === '30_hari' ? 'bg-white text-rose-600 shadow-sm font-black' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  30 Hari Terakhir (≥ 6x)
                </button>
                <button
                  onClick={() => setPeringatanFilterMode('bulanan')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${peringatanFilterMode === 'bulanan' ? 'bg-white text-purple-600 shadow-sm font-black' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Bulanan (≥ 6x)
                </button>
              </div>

              {/* Dynamic Period Selector */}
              <div className="flex items-center gap-2">
                {peringatanFilterMode === '7_hari' && (
                  <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                    <Calendar size={14} className="text-amber-600" />
                    <span>Rolling 7 Hari Terakhir s.d. Hari Ini</span>
                  </div>
                )}

                {peringatanFilterMode === '30_hari' && (
                  <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                    <Calendar size={14} className="text-rose-600" />
                    <span>Rolling 30 Hari Terakhir s.d. Hari Ini</span>
                  </div>
                )}

                {peringatanFilterMode === 'mingguan' && (
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                    <button
                      onClick={() => setPeringatanWeekOffset(prev => prev - 1)}
                      className="p-1 hover:bg-gray-200 rounded-md text-gray-600 transition"
                      title="Pekan Sebelumnya"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-gray-800">
                      {formatWeekRangeLabel(peringatanWeekOffset)}
                    </span>
                    <button
                      onClick={() => setPeringatanWeekOffset(prev => prev + 1)}
                      className="p-1 hover:bg-gray-200 rounded-md text-gray-600 transition"
                      title="Pekan Berikutnya"
                    >
                      <ChevronRight size={16} />
                    </button>
                    {peringatanWeekOffset !== 0 && (
                      <button
                        onClick={() => setPeringatanWeekOffset(0)}
                        className="ml-1 px-2 py-0.5 bg-primary/10 text-primary font-bold rounded text-[11px]"
                      >
                        Pekan Ini
                      </button>
                    )}
                  </div>
                )}

                {(peringatanFilterMode === 'bulanan' || peringatanFilterMode === 'semua') && (
                  <div className="flex items-center gap-2">
                    <select
                      value={peringatanBulan}
                      onChange={e => setPeringatanBulan(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50 font-bold text-gray-700"
                    >
                      {bulanNamaList.map((bln, idx) => (
                        <option key={idx + 1} value={idx + 1}>{bln}</option>
                      ))}
                    </select>
                    <select
                      value={peringatanTahun}
                      onChange={e => setPeringatanTahun(parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50 font-bold text-gray-700"
                    >
                      {[2024, 2025, 2026, 2027].map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Sub Filters Row: Kelas, Kategori, Search */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
              <select
                value={peringatanFilterKelas}
                onChange={e => setPeringatanFilterKelas(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50 font-semibold text-gray-700"
              >
                <option value="">Semua Kelas</option>
                {availableKelas.map(k => <option key={k} value={k}>Kelas {k}</option>)}
              </select>

              <select
                value={peringatanFilterKategori}
                onChange={e => setPeringatanFilterKategori(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50 font-semibold text-gray-700"
              >
                <option value="semua">Semua Kategori Pelanggaran</option>
                <option value="bolos_alfa">Hanya Bolos & Alfa</option>
                <option value="terlambat">Hanya Terlambat</option>
              </select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="text"
                  placeholder="Cari siswa atau NIPD..."
                  value={peringatanSearch}
                  onChange={e => setPeringatanSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs bg-gray-50"
                />
                {peringatanSearch && (
                  <button 
                    onClick={() => setPeringatanSearch('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <span className="text-xs text-gray-500 font-semibold ml-auto">
                Menampilkan <strong>{displayPeringatanList.length}</strong> siswa
              </span>
            </div>
          </div>

          {/* Table of Violators */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">No</th>
                    <th className="px-6 py-4">Siswa</th>
                    <th className="px-6 py-4">Kategori Peringatan</th>
                    <th className="px-6 py-4">Rincian Pelanggaran</th>
                    <th className="px-6 py-4">Status Tindakan</th>
                    <th className="px-6 py-4 text-center">Aksi Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {isPeringatanLoading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="font-bold text-gray-500">Mengevaluasi pelanggaran kehadiran...</p>
                        </div>
                      </td>
                    </tr>
                  ) : displayPeringatanList.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle size={40} className="text-green-500" />
                          <h4 className="font-bold text-gray-700 text-base">Tidak Ada Pelanggaran Disiplin</h4>
                          <p className="text-xs text-gray-400 max-w-md">
                            Tidak ditemukan siswa yang melampaui batas ambang pelanggaran (&ge;3x mingguan atau &ge;6x bulanan) pada filter saat ini.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayPeringatanList.map((item, index) => (
                      <tr key={item.nipd} className="hover:bg-red-50/40 transition">
                        <td className="px-6 py-4 text-gray-500 font-bold text-xs">{index + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{item.nama}</span>
                            <span className="text-[11px] text-gray-500 font-mono">
                              NIPD: {item.nipd} • Kelas {item.kelas}
                            </span>
                            <span className="text-[10px] mt-0.5">
                              {item.wa_ortu ? (
                                <span className="text-emerald-600 font-semibold">WA Ortu: {item.wa_ortu}</span>
                              ) : (
                                <span className="text-gray-400 italic">Tanpa kontak WA</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {item.is7Days && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertTriangle size={12} /> 7 Hari: {item.count7Days}x
                              </span>
                            )}
                            {item.isMingguan && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-yellow-100 text-yellow-800 border border-yellow-200">
                                <AlertTriangle size={12} /> Mingguan: {item.countMinggu}x
                              </span>
                            )}
                            {item.is30Days && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertCircle size={12} /> 30 Hari: {item.count30Days}x
                              </span>
                            )}
                            {item.isBulanan && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                <AlertCircle size={12} /> Bulanan: {item.countBulan}x
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-200" title="Terlambat">
                              T: {item.jmlTerlambat}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200" title="Bolos">
                              B: {item.jmlBolos}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Alfa">
                              A: {item.jmlAlfa}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {item.isBulanan || (item.isMingguan && item.isBulanan) ? (
                            <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-red-600 text-white shadow-sm shadow-red-600/20">
                              Surat Panggilan (SP 2)
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-500 text-white shadow-sm shadow-amber-500/20">
                              Peringatan Lisan / SP 1
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedViolator(item)}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center gap-1 transition"
                              title="Lihat Detail Riwayat Pelanggaran"
                            >
                              <Eye size={13} /> Log
                            </button>

                            <button
                              onClick={() => setSuratPeringatanModal(item)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1 transition"
                              title="Cetak Surat Peringatan & Panggilan"
                            >
                              <Printer size={13} /> Surat
                            </button>

                            {item.wa_ortu && (
                              <button
                                onClick={() => handleSendWaPeringatan(item)}
                                disabled={isSendingWa}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs flex items-center gap-1 transition"
                                title="Kirim Notifikasi WA ke Orang Tua"
                              >
                                <Send size={13} /> WA
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: DETAIL LOG PELANGGARAN SISWA */}
      {selectedViolator && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-red-600 to-rose-700 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider">
                    Detail Log Pelanggaran
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-red-800 text-xs font-bold">
                    Kelas {selectedViolator.kelas}
                  </span>
                </div>
                <h3 className="text-2xl font-black">{selectedViolator.nama}</h3>
                <p className="text-white/80 text-xs font-mono mt-0.5">
                  NIPD: {selectedViolator.nipd} {selectedViolator.wa_ortu && `• WA: ${selectedViolator.wa_ortu}`}
                </p>
              </div>
              <button 
                onClick={() => setSelectedViolator(null)} 
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Breakdown Pelanggaran */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b border-gray-100 text-center">
              <div className="bg-yellow-50 p-2.5 rounded-xl border border-yellow-100">
                <span className="text-[11px] font-bold text-yellow-700 uppercase block">Terlambat</span>
                <span className="text-xl font-black text-yellow-800">{selectedViolator.jmlTerlambat}</span>
              </div>
              <div className="bg-red-50 p-2.5 rounded-xl border border-red-100">
                <span className="text-[11px] font-bold text-red-700 uppercase block">Bolos</span>
                <span className="text-xl font-black text-red-800">{selectedViolator.jmlBolos}</span>
              </div>
              <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                <span className="text-[11px] font-bold text-rose-700 uppercase block">Alfa</span>
                <span className="text-xl font-black text-rose-800">{selectedViolator.jmlAlfa}</span>
              </div>
            </div>

            {/* Tabel Log Riwayat Pelanggaran */}
            <div className="p-6 overflow-y-auto flex-1">
              <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                <Clock size={16} className="text-primary" /> Riwayat Pelanggaran Terdata
              </h4>
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50 text-gray-600 uppercase font-bold border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Masuk</th>
                      <th className="px-4 py-3">Pulang</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedViolator.violationsList && selectedViolator.violationsList.length > 0 ? (
                      selectedViolator.violationsList.map((v, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 font-bold text-gray-700">{v.tanggal}</td>
                          <td className="px-4 py-3 font-mono text-primary font-bold">{v.waktu_masuk || '-'}</td>
                          <td className="px-4 py-3 font-mono text-red-500 font-bold">{v.waktu_pulang || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              v.status === 'Terlambat' ? 'bg-yellow-100 text-yellow-800' :
                              v.status === 'Bolos' ? 'bg-red-100 text-red-800' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 italic">{v.alasan || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-4 py-6 text-center text-gray-400">Tidak ada rincian log pelanggaran.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-wrap justify-between items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const violator = selectedViolator;
                    setSelectedViolator(null);
                    setSuratPeringatanModal(violator);
                  }}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <Printer size={14} /> Cetak Surat Peringatan
                </button>
                {selectedViolator.wa_ortu && (
                  <button
                    onClick={() => handleSendWaPeringatan(selectedViolator)}
                    disabled={isSendingWa}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm shadow-emerald-600/20"
                  >
                    <Send size={14} /> Kirim Peringatan WA
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedViolator(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 font-bold text-gray-700 rounded-xl text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CETAK SURAT PERINGATAN & PANGGILAN RESMI SEKOLAH */}
      {suratPeringatanModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Top Toolbar (Non-printable) */}
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center print:hidden">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-yellow-400" size={20} />
                <h4 className="font-bold text-sm">Dokumen Surat Panggilan Orang Tua / Peringatan Kedisiplinan</h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow"
                >
                  <Printer size={15} /> Cetak / Print Dokumen
                </button>
                <button
                  onClick={() => setSuratPeringatanModal(null)}
                  className="p-2 text-gray-400 hover:text-white rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Paper Canvas */}
            <div className="p-8 md:p-12 overflow-y-auto bg-white text-gray-900 print:p-0 print:m-0" id="surat-resmi-cetak">
              {/* Kop Surat Resmi dari Database data_lembaga */}
              <KopSurat dataLembaga={dataLembaga} />

              {/* Nomor & Perihal */}
              <div className="flex justify-between items-start text-xs mb-6">
                <div>
                  <p><strong>Nomor</strong> : {`042/SMPIT-HM/BK-DISP/${new Date().getFullYear()}`}</p>
                  <p><strong>Lampiran</strong> : 1 (Satu) Lembar Rekap Kehadiran</p>
                  <p><strong>Perihal</strong> : <span className="font-bold underline">Surat Panggilan Orang Tua / Wali Murid</span></p>
                </div>
                <div className="text-right">
                  <p>Subang, {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p>
                </div>
              </div>

              {/* Kepada Yth */}
              <div className="text-xs mb-6">
                <p>Kepada Yth.</p>
                <p><strong>Bapak/Ibu Orang Tua / Wali Murid dari:</strong></p>
                <table className="mt-2 ml-4 text-xs">
                  <tbody>
                    <tr>
                      <td className="py-0.5 pr-4 font-semibold text-gray-600">Nama Siswa</td>
                      <td className="py-0.5 pr-2">:</td>
                      <td className="py-0.5 font-bold text-gray-900">{suratPeringatanModal.nama}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-4 font-semibold text-gray-600">NIPD</td>
                      <td className="py-0.5 pr-2">:</td>
                      <td className="py-0.5 font-mono">{suratPeringatanModal.nipd}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-4 font-semibold text-gray-600">Kelas</td>
                      <td className="py-0.5 pr-2">:</td>
                      <td className="py-0.5 font-bold">{suratPeringatanModal.kelas}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2">di Tempat</p>
              </div>

              {/* Isi Surat */}
              <div className="text-xs leading-relaxed text-justify space-y-3 mb-8">
                <p>
                  <em>Assalamu'alaikum Warahmatullahi Wabarakatuh,</em>
                </p>
                <p>
                  Dengan hormat, sehubungan dengan evaluasi ketertiban dan kedisiplinan belajar di {dataLembaga.nama_lembaga || 'SMP IT Hidayatul Mubtadi-ien'}, bersama surat ini kami menginformasikan bahwa ananda yang bersangkutan telah tercatat melakukan pelanggaran disiplin kehadiran dengan rincian akumulasi:
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 my-2">
                  <ul className="list-disc list-inside space-y-1 font-semibold text-gray-800">
                    {suratPeringatanModal.jmlTerlambat > 0 && (
                      <li>Terlambat Masuk Sekolah: <strong>{suratPeringatanModal.jmlTerlambat} kali</strong></li>
                    )}
                    {suratPeringatanModal.jmlBolos > 0 && (
                      <li>Bolos / Meninggalkan Sekolah Tanpa Izin: <strong>{suratPeringatanModal.jmlBolos} kali</strong></li>
                    )}
                    {suratPeringatanModal.jmlAlfa > 0 && (
                      <li>Alfa / Tanpa Keterangan: <strong>{suratPeringatanModal.jmlAlfa} kali</strong></li>
                    )}
                  </ul>
                  <p className="text-[11px] text-red-600 font-bold mt-2">
                    Status: {suratPeringatanModal.levelPeringatan || 'Peringatan Disiplin Siswa'}
                  </p>
                </div>
                <p>
                  Mengingat pentingnya proses pembinaan karakter dan kelancaran proses pembelajaran ananda di sekolah, maka kami mengharapkan kehadiran Bapak/Ibu Orang Tua / Wali ke sekolah untuk memenuhi panggilan ini:
                </p>
                <div className="ml-4 space-y-1">
                  <p><strong>Hari / Tanggal</strong> : Senin s.d. Kamis (Jam Kerja Sekolah)</p>
                  <p><strong>Waktu</strong> : Pukul 08.00 - 11.00 WIB</p>
                  <p><strong>Tempat</strong> : Ruang Bimbingan Konseling (BK) {dataLembaga.nama_lembaga || 'SMP IT Hidayatul Mubtadi-ien'}</p>
                  <p><strong>Menemui</strong> : Guru BK & Wali Kelas</p>
                </div>
                <p>
                  Demikian surat pemberitahuan dan panggilan ini kami sampaikan. Atas perhatian, pengertian, dan kerja sama yang baik dari Bapak/Ibu, kami ucapkan terima kasih.
                </p>
                <p>
                  <em>Wassalamu'alaikum Warahmatullahi Wabarakatuh.</em>
                </p>
              </div>

              {/* Tanda Tangan */}
              <div className="grid grid-cols-3 text-center text-xs gap-4 mt-8 pt-4">
                <div>
                  <p className="text-gray-500 mb-16">Wali Kelas {suratPeringatanModal.kelas},</p>
                  <p className="font-bold border-t border-gray-300 pt-1 inline-block min-w-[120px]">( ................................ )</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-16">Guru BK,</p>
                  <p className="font-bold border-t border-gray-300 pt-1 inline-block min-w-[120px]">( ................................ )</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-16">Kepala Sekolah,</p>
                  <p className="font-bold border-t border-gray-300 pt-1 inline-block min-w-[120px]">
                    {dataKepsek.nama || dataLembaga.kepala_sekolah || 'Abdul Manaf, S.Pd'}
                  </p>
                  {dataKepsek.nipLabel ? (
                    <p className="text-[11px] text-gray-600 mt-0.5">{dataKepsek.nipLabel}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for QR Scanner
function QrScanner({ onScan, isProcessing }) {
  const qrCodeId = useRef(`qr-reader-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
  const html5QrCode = useRef(null);
  const onScanRef = useRef(onScan);
  const isProcessingRef = useRef(isProcessing);
  const startPromiseRef = useRef(null);

  // Selalu update referensi agar tidak terjadi "stale closure"
  useEffect(() => {
    onScanRef.current = onScan;
    isProcessingRef.current = isProcessing;
  }, [onScan, isProcessing]);

  useEffect(() => {
    // Gunakan variabel lokal agar cleanup function merujuk pada instance yang tepat
    // (Mencegah bug kamera bocor akibat React Strict Mode yang memanggil ulang useEffect)
    const scannerInstance = new Html5Qrcode(qrCodeId.current);

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    };

    // Mulai kamera dan simpan promisenya
    const startPromise = scannerInstance.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        if (!isProcessingRef.current) {
          onScanRef.current(decodedText);
        }
      },
      (errorMessage) => {
        // Abaikan error parse saat tidak mendeteksi QR code
      }
    );

    startPromise.catch(err => {
      console.warn("Kamera dibatalkan atau gagal dimulai:", err);
    });

    return () => {
      // Fungsi untuk menghentikan kamera dengan aman untuk instance spesifik ini
      const stopAndClear = () => {
        try {
          if (scannerInstance.isScanning || scannerInstance.getState() === 2 /* SCANNING */) {
            scannerInstance.stop().then(() => {
              scannerInstance.clear();
            }).catch(console.error);
          } else {
            scannerInstance.clear();
          }
        } catch (e) {
          console.error("Gagal saat mencoba stop kamera:", e);
        }
      };

      // Jika start() masih berjalan saat unmount, tunggu sampai selesai lalu segera matikan
      if (startPromise) {
        startPromise
          .then(() => stopAndClear())
          .catch(() => stopAndClear());
      } else {
        stopAndClear();
      }
    };
  }, []);

  return (
    <div id={qrCodeId.current} className="w-full min-h-[300px] bg-black rounded-xl overflow-hidden flex items-center justify-center relative z-0">
      {/* Container video stream Html5Qrcode */}
    </div>
  );
}
