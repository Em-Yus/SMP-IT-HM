import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  DollarSign, Calendar, Filter, Printer, Download, User, Search, 
  Eye, FileText, CheckCircle, Clock, Award, ShieldCheck, X, Edit3, 
  Save, Sparkles, Settings, Plus, Trash2, CheckSquare, Square, ChevronDown, Check
} from 'lucide-react';
import Swal from 'sweetalert2';
import KopSurat from '../components/KopSurat';
import { 
  terbilang, 
  bulanNames, 
  formatPeriodeBulan, 
  generateSingleSlipHtml, 
  generateCompletePrintPage, 
  printHtmlViaIframe 
} from '../utils/slipHonorHelper';

export default function RekapHonorGuru() {
  const [guruList, setGuruList] = useState([]);
  const [jabatanGuruMap, setJabatanGuruMap] = useState({});
  const [dataJabatanList, setDataJabatanList] = useState([]);
  const [presensiGuruList, setPresensiGuruList] = useState([]);
  const [presensiKbmList, setPresensiKbmList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [jadwalList, setJadwalList] = useState([]);
  const [mapelList, setMapelList] = useState([]);
  const [dataLembaga, setDataLembaga] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBulanList, setSelectedBulanList] = useState([new Date().getMonth() + 1]);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  const [isBulanPickerOpen, setIsBulanPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const bulanPickerRef = useRef(null);

  // Filter Guru Checklist State
  const [selectedGuruIdList, setSelectedGuruIdList] = useState([]);
  const [isGuruPickerOpen, setIsGuruPickerOpen] = useState(false);
  const [guruSearchFilter, setGuruSearchFilter] = useState('');
  const guruPickerRef = useRef(null);

  // Apresiasi Kinerja State & Auth
  const [canEditApresiasi, setCanEditApresiasi] = useState(false);
  const [canViewAllHonors, setCanViewAllHonors] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [apresiasiKinerjaMap, setApresiasiKinerjaMap] = useState({});
  const [apresiasiModalOpen, setApresiasiModalOpen] = useState(false);
  const [apresiasiForm, setApresiasiForm] = useState({ guru_id: null, guru_nama: '', nominal: '', keterangan: '', bulan: new Date().getMonth() + 1 });
  const [isSavingApresiasi, setIsSavingApresiasi] = useState(false);
  const [masterJenisApresiasi, setMasterJenisApresiasi] = useState([]);
  const [crudMasterModalOpen, setCrudMasterModalOpen] = useState(false);
  const [editingJenis, setEditingJenis] = useState(null);
  const [jenisForm, setJenisForm] = useState({ nama_apresiasi: '', nominal_default: '' });
  const [isSavingJenis, setIsSavingJenis] = useState(false);

  // Modal Detail & Slip State
  const [selectedGuruDetail, setSelectedGuruDetail] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [allSlipsModalOpen, setAllSlipsModalOpen] = useState(false);

  // Click outside to close pickers
  useEffect(() => {
    function handleClickOutside(event) {
      if (bulanPickerRef.current && !bulanPickerRef.current.contains(event.target)) {
        setIsBulanPickerOpen(false);
      }
      if (guruPickerRef.current && !guruPickerRef.current.contains(event.target)) {
        setIsGuruPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedBulanList, selectedTahun]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 0. Cek Hak Akses Pengguna Login:
      const userSession = localStorage.getItem('user_guru');
      if (userSession) {
        try {
          const userObj = JSON.parse(userSession);
          setCurrentUser(userObj);
          let authorizedToViewAll = userObj?.role === 'admin';

          if (userObj?.id) {
            const { data: jData } = await supabase.from('jabatan_guru').select('*').eq('guru_id', userObj.id).maybeSingle();
            if (jData) {
              const roles = [jData.jabatan_utama, jData.jabatan_lain_1, jData.jabatan_lain_2, jData.jabatan_lain_3].filter(Boolean);
              authorizedToViewAll = roles.some((r) => {
                const lower = (r || '').toLowerCase();
                return lower.includes('operator') || lower.includes('bendahara') || lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('admin');
              });
            }
          }
          setCanViewAllHonors(authorizedToViewAll);
          setCanEditApresiasi(authorizedToViewAll);
        } catch (e) {
          console.error('Error parsing user session:', e);
        }
      }

      // 1. Fetch Lembaga
      const { data: lembaga } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (lembaga) setDataLembaga(lembaga);

      // 2. Fetch Active Teachers
      const { data: guru, error: errGuru } = await supabase
        .from('data_guru')
        .select('*')
        .is('tanggal_keluar', null)
        .order('nama', { ascending: true });
      if (errGuru) throw errGuru;
      setGuruList(guru || []);
      setSelectedGuruIdList((prev) => {
        if (prev.length === 0 && guru && guru.length > 0) {
          return guru.map((g) => g.id);
        }
        return prev;
      });

      // 3. Fetch Data Jabatan with Honor
      const { data: jabatan, error: errJab } = await supabase.from('data_jabatan').select('*');
      if (errJab) throw errJab;
      setDataJabatanList(jabatan || []);

      // 4. Fetch Jabatan Guru
      const { data: jGuru, error: errJGuru } = await supabase.from('jabatan_guru').select('*');
      if (errJGuru) throw errJGuru;
      const jMap = {};
      (jGuru || []).forEach((jg) => {
        jMap[jg.guru_id] = jg;
      });
      setJabatanGuruMap(jMap);

      // 5. Fetch Data Kelas (untuk deteksi wali kelas)
      const { data: kelas, error: errKelas } = await supabase.from('data_kelas').select('*');
      if (!errKelas) setKelasList(kelas || []);

      // 6. Fetch Jadwal & Mapel (untuk keterangan mapel per pekan di slip)
      const { data: mapel, error: errMapel } = await supabase.from('data_mapel').select('*');
      if (!errMapel) setMapelList(mapel || []);

      const { data: jadwal, error: errJadwal } = await supabase.from('jadwal_pelajaran').select('*').is('is_istirahat', false);
      if (!errJadwal) setJadwalList(jadwal || []);

      // 7. Fetch Presensi Kehadiran for selected months
      const safeBulanList = selectedBulanList.length > 0 ? selectedBulanList : [new Date().getMonth() + 1];
      const minMonth = Math.min(...safeBulanList);
      const maxMonth = Math.max(...safeBulanList);
      const startMonthStr = `${selectedTahun}-${String(minMonth).padStart(2, '0')}-01`;
      const endMonthStr = `${selectedTahun}-${String(maxMonth).padStart(2, '0')}-31`;

      const { data: presensi, error: errPresensi } = await supabase
        .from('presensi_guru')
        .select('*')
        .gte('tanggal', startMonthStr)
        .lte('tanggal', endMonthStr);
      if (errPresensi && errPresensi.code !== '42P01') throw errPresensi;

      const filteredPresensi = (presensi || []).filter((p) => {
        if (!p.tanggal) return false;
        const m = parseInt(p.tanggal.substring(5, 7), 10);
        return safeBulanList.includes(m);
      });
      setPresensiGuruList(filteredPresensi);

      // 8. Fetch Presensi KBM for selected months
      const { data: kbm, error: errKbm } = await supabase
        .from('presensi_kbm_guru')
        .select('*')
        .gte('tanggal', startMonthStr)
        .lte('tanggal', endMonthStr);
      if (errKbm && errKbm.code !== '42P01') throw errKbm;

      const filteredKbm = (kbm || []).filter((k) => {
        if (!k.tanggal) return false;
        const m = parseInt(k.tanggal.substring(5, 7), 10);
        return safeBulanList.includes(m);
      });
      setPresensiKbmList(filteredKbm);

      // 9. Fetch Apresiasi Kinerja Guru for selected months & year
      const { data: apresiasiList, error: errApresiasi } = await supabase
        .from('apresiasi_kinerja_guru')
        .select('*')
        .in('bulan', safeBulanList)
        .eq('tahun', selectedTahun);
      if (errApresiasi && errApresiasi.code !== '42P01') throw errApresiasi;

      const apMap = {};
      (apresiasiList || []).forEach((item) => {
        if (!apMap[item.guru_id]) {
          apMap[item.guru_id] = {
            id: item.id,
            nominal: 0,
            keteranganList: []
          };
        }
        apMap[item.guru_id].nominal += Number(item.nominal) || 0;
        if (item.keterangan && !apMap[item.guru_id].keteranganList.includes(item.keterangan)) {
          apMap[item.guru_id].keteranganList.push(item.keterangan);
        }
      });
      setApresiasiKinerjaMap(apMap);

      // 10. Fetch Master Jenis Apresiasi
      await fetchMasterJenis();

    } catch (err) {
      console.error('Error fetching rekap data:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat rekapitulasi honor guru.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper membuat keterangan jadwal mengajar (e.g. - Informatika : 12 JP/Pekan \n - Nahwu Kelas 7 : 2 JP/Pekan)
  const getGuruMapelKeterangan = (guruId) => {
    const myJadwal = (jadwalList || []).filter((j) => String(j.guru_id) === String(guruId));
    if (myJadwal.length === 0) return '';

    const mapelNameMap = {};
    (mapelList || []).forEach((m) => {
      mapelNameMap[m.id] = m.nama_mapel;
    });

    const kelasNameMap = {};
    (kelasList || []).forEach((k) => {
      kelasNameMap[k.id] = k.nama_kelas;
    });

    const grouped = {};
    myJadwal.forEach((j) => {
      const mName = mapelNameMap[j.mapel_id] || 'Mata Pelajaran';
      const kName = kelasNameMap[j.kelas_id] || '';
      if (!grouped[mName]) {
        grouped[mName] = { totalJp: 0, classes: new Set() };
      }
      grouped[mName].totalJp += 1;
      if (kName) grouped[mName].classes.add(kName);
    });

    const lines = Object.entries(grouped).map(([mName, info]) => {
      const classesArr = Array.from(info.classes);
      if (classesArr.length === 1) {
        const c = classesArr[0];
        const kelasLabel = c.startsWith('VII') ? 'Kelas 7' : c.startsWith('VIII') ? 'Kelas 8' : c.startsWith('IX') ? 'Kelas 9' : c;
        return `- ${mName} ${kelasLabel} : ${info.totalJp} JP/Pekan`;
      }
      return `- ${mName} : ${info.totalJp} JP/Pekan`;
    });

    return lines.join('\n');
  };

  // Helper perhitungan terperinci 6 baris komponen honor sesuai Gambar 1 & Gambar 2
  const calculateTeacherHonor = (guruId) => {
    const jg = jabatanGuruMap[guruId];
    const numBulan = selectedBulanList.length || 1;

    // 1. Tunjangan Jabatan (Operator, Tata Usaha, Kepala Sekolah, Panitia, dsb)
    let tunjanganJabatanPerBulan = 0;
    const jabatanNames = [];

    if (jg) {
      const rawRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3].filter(Boolean);
      const allRoles = [...new Set(rawRoles.map((r) => String(r).trim()).filter(Boolean))];

      allRoles.forEach((roleName) => {
        const lower = roleName.toLowerCase();
        if (lower.includes('ngaji') || lower.includes('wali kelas') || lower.includes('guru mata pelajaran')) return;
        const found = dataJabatanList.find((dj) => dj.nama_jabatan?.toLowerCase() === lower);
        const honorVal = found && found.honor ? Number(found.honor) : 0;
        if (honorVal > 0) {
          tunjanganJabatanPerBulan += honorVal;
          jabatanNames.push(found.nama_jabatan || roleName);
        }
      });
    }

    const tunjanganJabatanTotal = tunjanganJabatanPerBulan * numBulan;
    const rowJabatan = {
      vol: tunjanganJabatanPerBulan > 0 ? numBulan : '',
      satuan: tunjanganJabatanPerBulan > 0 ? 'Bulan' : '',
      nominal: tunjanganJabatanPerBulan > 0 ? tunjanganJabatanPerBulan : '',
      jumlah: tunjanganJabatanTotal > 0 ? tunjanganJabatanTotal : '',
      keterangan: jabatanNames.join(', ')
    };

    // 2. Guru Mapel (KBM)
    const myKbm = presensiKbmList.filter((k) => String(k.guru_id) === String(guruId));
    const totalJp = myKbm.reduce((sum, k) => sum + (Number(k.jumlah_jp) || 1), 0);
    const totalHonorKbm = totalJp * 6500;
    const totalJpInval = myKbm.filter((k) => k.is_pengganti).reduce((sum, k) => sum + (Number(k.jumlah_jp) || 1), 0);
    const mapelKeterangan = getGuruMapelKeterangan(guruId);

    const rowMapel = {
      vol: totalJp > 0 ? totalJp : '',
      satuan: totalJp > 0 ? 'Jam Pelajaran' : '',
      nominal: totalJp > 0 ? 6500 : '',
      jumlah: totalHonorKbm > 0 ? totalHonorKbm : '',
      keterangan: mapelKeterangan || (totalJp > 0 ? `Total KBM ${totalJp} JP` : '')
    };

    // 3. Guru Ngaji (Standar Rp 200.000 / bln, Khusus Rp 100.000 / bln -> Vol 1/2)
    let isGuruNgaji = false;
    let isNgajiKhusus = false;
    let honorNgajiPerBulan = 0;

    if (jg) {
      const rawRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3].filter(Boolean);
      rawRoles.forEach((r) => {
        const lower = String(r).toLowerCase();
        if (lower.includes('ngaji khusus')) {
          isNgajiKhusus = true;
          isGuruNgaji = true;
          honorNgajiPerBulan = 100000;
        } else if (lower.includes('ngaji')) {
          isGuruNgaji = true;
          if (!isNgajiKhusus) honorNgajiPerBulan = 200000;
        }
      });
    }

    let volNgaji = '';
    let totalHonorNgaji = 0;
    if (isGuruNgaji) {
      if (isNgajiKhusus) {
        volNgaji = numBulan === 1 ? '1/2' : (numBulan % 2 === 0 ? `${numBulan / 2}` : `${numBulan}/2`);
        totalHonorNgaji = numBulan * 100000;
      } else {
        volNgaji = numBulan;
        totalHonorNgaji = numBulan * 200000;
      }
    }

    const rowNgaji = {
      vol: volNgaji,
      satuan: isGuruNgaji ? 'Bulan' : '',
      nominal: isGuruNgaji ? honorNgajiPerBulan : '',
      jumlah: totalHonorNgaji > 0 ? totalHonorNgaji : '',
      keterangan: isGuruNgaji ? "Ngaji Al-Qur'an" : ''
    };

    // 4. Kehadiran
    const myPresensi = presensiGuruList.filter((p) => String(p.guru_id) === String(guruId));
    const totalHariHadir = myPresensi.filter((p) => p.status === 'Hadir').length;
    const totalHonorKehadiran = myPresensi.reduce((sum, p) => sum + (Number(p.honor_kehadiran) || 0), 0);

    const rowKehadiran = {
      vol: totalHariHadir > 0 ? totalHariHadir : '',
      satuan: totalHariHadir > 0 ? 'Hari' : '',
      nominal: totalHariHadir > 0 ? 5000 : '',
      jumlah: totalHonorKehadiran > 0 ? totalHonorKehadiran : '',
      keterangan: totalHariHadir > 0 ? 'Kehadiran Penuh Tanpa Potongan' : ''
    };

    // 5. Wali Kelas (Rp 75.000 / kelas / bulan)
    const myKelasWali = (kelasList || []).filter((k) => String(k.wali_kelas_id) === String(guruId));
    const isWaliKelas = myKelasWali.length > 0;
    const jumlahKelasWali = myKelasWali.length;
    const totalHonorWali = isWaliKelas ? (75000 * jumlahKelasWali * numBulan) : 0;

    const rowWali = {
      vol: isWaliKelas ? (numBulan === 1 ? jumlahKelasWali : numBulan * jumlahKelasWali) : '',
      satuan: isWaliKelas ? 'Bulan' : '',
      nominal: isWaliKelas ? 75000 : '',
      jumlah: totalHonorWali > 0 ? totalHonorWali : '',
      keterangan: isWaliKelas ? `${jumlahKelasWali} Kelas` : ''
    };

    // 6. Apresiasi Kinerja
    const apItem = apresiasiKinerjaMap[guruId] || { nominal: 0, keteranganList: [] };
    const apresiasiKinerja = Number(apItem.nominal) || 0;
    const keteranganApresiasi = (apItem.keteranganList || []).join(', ');

    const rowApresiasi = {
      vol: apresiasiKinerja > 0 ? 1 : '',
      satuan: apresiasiKinerja > 0 ? 'Kegiatan' : '',
      nominal: apresiasiKinerja > 0 ? apresiasiKinerja : '',
      jumlah: apresiasiKinerja > 0 ? apresiasiKinerja : '',
      keterangan: keteranganApresiasi
    };

    // Total Bersih Keseluruhan
    const totalHonorBersih = tunjanganJabatanTotal + totalHonorKbm + totalHonorNgaji + totalHonorKehadiran + totalHonorWali + apresiasiKinerja;

    const namaJabatanUtama = jg ? (jg.jabatan_utama || '-') : '-';

    return {
      namaJabatanUtama,
      isGuruNgaji,
      honorGuruNgaji: totalHonorNgaji,
      totalHariHadir,
      totalHonorKehadiran,
      totalJp,
      totalJpInval,
      totalHonorKbm,
      tunjanganJabatan: tunjanganJabatanTotal,
      apresiasiKinerja,
      keteranganApresiasi,
      totalHonorBersih,
      myPresensi,
      myKbm,
      // Slip 6-row data format
      rowJabatan,
      rowMapel,
      rowNgaji,
      rowKehadiran,
      rowWali,
      rowApresiasi
    };
  };

  // Batasan hak akses
  const availableGuru = canViewAllHonors
    ? guruList
    : currentUser
      ? guruList.filter((g) => String(g.id) === String(currentUser.id))
      : [];

  const filteredGuru = availableGuru.filter((g) => {
    const matchesSearch =
      g.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.nip?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGuru = selectedGuruIdList.length > 0 ? selectedGuruIdList.includes(g.id) : true;
    return matchesSearch && matchesGuru;
  });

  const totalHonorSeluruhGuru = filteredGuru.reduce((sum, g) => {
    const calc = calculateTeacherHonor(g.id);
    return sum + calc.totalHonorBersih;
  }, 0);

  // Month checklist handlers
  const toggleBulan = (bulanNum) => {
    if (selectedBulanList.includes(bulanNum)) {
      if (selectedBulanList.length === 1) {
        Swal.fire({
          icon: 'info',
          title: 'Perhatian',
          text: 'Minimal satu bulan harus dipilih.',
          timer: 1500,
          showConfirmButton: false
        });
        return;
      }
      setSelectedBulanList((prev) => prev.filter((b) => b !== bulanNum).sort((a, b) => a - b));
    } else {
      setSelectedBulanList((prev) => [...prev, bulanNum].sort((a, b) => a - b));
    }
  };

  const handleSelectAllBulan = () => {
    setSelectedBulanList([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  };

  const handleSelectCurrentBulan = () => {
    setSelectedBulanList([new Date().getMonth() + 1]);
  };

  // Guru checklist handlers
  const toggleGuru = (guruId) => {
    if (selectedGuruIdList.includes(guruId)) {
      if (selectedGuruIdList.length === 1) {
        Swal.fire({
          icon: 'info',
          title: 'Perhatian',
          text: 'Minimal satu guru harus dipilih.',
          timer: 1500,
          showConfirmButton: false
        });
        return;
      }
      setSelectedGuruIdList((prev) => prev.filter((id) => id !== guruId));
    } else {
      setSelectedGuruIdList((prev) => [...prev, guruId]);
    }
  };

  const handleSelectAllGuru = () => {
    setSelectedGuruIdList(availableGuru.map((g) => g.id));
  };

  const handleClearAllGuru = () => {
    if (availableGuru.length > 0) {
      setSelectedGuruIdList([availableGuru[0].id]);
      Swal.fire({
        icon: 'info',
        title: 'Reset Pilihan',
        text: 'Disisakan 1 guru terpilih.',
        timer: 1200,
        showConfirmButton: false
      });
    }
  };

  const getGuruFilterSummary = () => {
    if (!availableGuru || availableGuru.length === 0) return '0 Guru';
    if (selectedGuruIdList.length === availableGuru.length) {
      return `Semua (${availableGuru.length})`;
    }
    if (selectedGuruIdList.length === 1) {
      const found = availableGuru.find((g) => g.id === selectedGuruIdList[0]);
      return found ? found.nama.split(' ')[0] : '1 Guru';
    }
    return `${selectedGuruIdList.length} Guru`;
  };

  const periodeBulanDisplay = formatPeriodeBulan(selectedBulanList, selectedTahun);

  // Modal Detail & Slip actions
  const openDetail = (guru) => {
    const calc = calculateTeacherHonor(guru.id);
    setSelectedGuruDetail({ ...guru, ...calc });
    setDetailModalOpen(true);
  };

  const openSlip = (guru) => {
    const calc = calculateTeacherHonor(guru.id);
    setSelectedGuruDetail({ ...guru, ...calc });
    setSlipModalOpen(true);
  };

  // Print single slip
  const handlePrintSingleSlip = (guru) => {
    const calc = calculateTeacherHonor(guru.id);
    const slipData = {
      guruNama: guru.nama,
      rowJabatan: calc.rowJabatan,
      rowMapel: calc.rowMapel,
      rowNgaji: calc.rowNgaji,
      rowKehadiran: calc.rowKehadiran,
      rowWali: calc.rowWali,
      rowApresiasi: calc.rowApresiasi,
      totalHonor: calc.totalHonorBersih
    };
    const singleHtml = generateSingleSlipHtml(slipData, dataLembaga, periodeBulanDisplay);
    const fullHtml = generateCompletePrintPage(singleHtml);
    printHtmlViaIframe(fullHtml);
  };

  // Print all slips (continuous, multiple slips per sheet A4, each slip numbers from 1)
  const handlePrintAllSlips = () => {
    if (filteredGuru.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Data Kosong', text: 'Tidak ada data guru untuk dicetak.' });
      return;
    }
    const allSlipsHtml = filteredGuru.map((guru) => {
      const calc = calculateTeacherHonor(guru.id);
      const slipData = {
        guruNama: guru.nama,
        rowJabatan: calc.rowJabatan,
        rowMapel: calc.rowMapel,
        rowNgaji: calc.rowNgaji,
        rowKehadiran: calc.rowKehadiran,
        rowWali: calc.rowWali,
        rowApresiasi: calc.rowApresiasi,
        totalHonor: calc.totalHonorBersih
      };
      return generateSingleSlipHtml(slipData, dataLembaga, periodeBulanDisplay);
    }).join('\n');

    const fullHtml = generateCompletePrintPage(allSlipsHtml);
    printHtmlViaIframe(fullHtml);
  };

  // Apresiasi handlers
  const fetchMasterJenis = async () => {
    try {
      const { data, error } = await supabase
        .from('master_jenis_apresiasi')
        .select('*')
        .order('id', { ascending: true });
      if (!error && data) {
        setMasterJenisApresiasi(data);
      }
    } catch (e) {
      console.error('Error fetching master jenis:', e);
    }
  };

  const openEditApresiasi = (guru) => {
    const apItem = apresiasiKinerjaMap[guru.id] || { nominal: 0, keteranganList: [] };
    let initKet = (apItem.keteranganList && apItem.keteranganList[0]) || '';
    let initNom = apItem.nominal ? String(apItem.nominal) : '';

    if (!initKet && masterJenisApresiasi.length > 0) {
      initKet = masterJenisApresiasi[0].nama_apresiasi;
      if (!initNom && Number(masterJenisApresiasi[0].nominal_default) > 0) {
        initNom = String(masterJenisApresiasi[0].nominal_default);
      }
    }

    setApresiasiForm({
      guru_id: guru.id,
      guru_nama: guru.nama,
      nominal: initNom,
      keterangan: initKet,
      bulan: selectedBulanList[0] || (new Date().getMonth() + 1)
    });
    setApresiasiModalOpen(true);
  };

  const handleJenisSelect = (selectedNama) => {
    const matched = masterJenisApresiasi.find((m) => m.nama_apresiasi === selectedNama);
    let newNominal = apresiasiForm.nominal;
    if (matched && Number(matched.nominal_default) > 0) {
      if (!newNominal || Number(newNominal) === 0) {
        newNominal = String(matched.nominal_default);
      }
    }
    setApresiasiForm((prev) => ({
      ...prev,
      keterangan: selectedNama,
      nominal: newNominal
    }));
  };

  const handleSaveApresiasi = async (e) => {
    e.preventDefault();
    if (!apresiasiForm.guru_id) return;
    setIsSavingApresiasi(true);
    try {
      const numNominal = Number(apresiasiForm.nominal.toString().replace(/[^0-9]/g, '')) || 0;
      const targetBulan = Number(apresiasiForm.bulan) || selectedBulanList[0] || (new Date().getMonth() + 1);

      const { error } = await supabase
        .from('apresiasi_kinerja_guru')
        .upsert({
          guru_id: apresiasiForm.guru_id,
          bulan: targetBulan,
          tahun: selectedTahun,
          nominal: numNominal,
          keterangan: apresiasiForm.keterangan,
          updated_at: new Date().toISOString()
        }, { onConflict: 'guru_id,bulan,tahun' });
      
      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Tersimpan',
        text: `Apresiasi kinerja untuk ${apresiasiForm.guru_nama} berhasil disimpan.`,
        timer: 1500,
        showConfirmButton: false
      });
      setApresiasiModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving apresiasi:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal menyimpan apresiasi kinerja.' });
    } finally {
      setIsSavingApresiasi(false);
    }
  };

  const handleSaveJenis = async (e) => {
    e.preventDefault();
    if (!jenisForm.nama_apresiasi.trim()) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Nama jenis apresiasi wajib diisi.' });
      return;
    }
    setIsSavingJenis(true);
    try {
      const numNominal = Number(jenisForm.nominal_default.toString().replace(/[^0-9]/g, '')) || 0;
      if (editingJenis) {
        const { error } = await supabase
          .from('master_jenis_apresiasi')
          .update({
            nama_apresiasi: jenisForm.nama_apresiasi.trim(),
            nominal_default: numNominal
          })
          .eq('id', editingJenis.id);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jenis apresiasi diperbarui.', timer: 1200, showConfirmButton: false });
      } else {
        const { error } = await supabase
          .from('master_jenis_apresiasi')
          .insert({
            nama_apresiasi: jenisForm.nama_apresiasi.trim(),
            nominal_default: numNominal
          });
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jenis apresiasi baru ditambahkan.', timer: 1200, showConfirmButton: false });
      }
      setEditingJenis(null);
      setJenisForm({ nama_apresiasi: '', nominal_default: '' });
      await fetchMasterJenis();
    } catch (err) {
      console.error('Error saving jenis:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal menyimpan jenis apresiasi.' });
    } finally {
      setIsSavingJenis(false);
    }
  };

  const handleDeleteJenis = async (id, nama) => {
    const res = await Swal.fire({
      title: 'Hapus Jenis Apresiasi?',
      text: `Yakin ingin menghapus opsi "${nama}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (res.isConfirmed) {
      try {
        const { error } = await supabase.from('master_jenis_apresiasi').delete().eq('id', id);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Terhapus', text: 'Jenis apresiasi berhasil dihapus.', timer: 1200, showConfirmButton: false });
        await fetchMasterJenis();
      } catch (err) {
        console.error('Error deleting jenis:', err);
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal menghapus jenis apresiasi.' });
      }
    }
  };

  // Helper text ringkasan bulan terpilih
  const getBulanFilterSummary = () => {
    if (selectedBulanList.length === 1) {
      return bulanNames[selectedBulanList[0] - 1];
    }
    if (selectedBulanList.length === 12) {
      return 'Semua Bulan (12)';
    }
    const sorted = [...selectedBulanList].sort((a, b) => a - b);
    return `${bulanNames[sorted[0] - 1].substring(0, 3)} - ${bulanNames[sorted[sorted.length - 1] - 1].substring(0, 3)} (${selectedBulanList.length} Bln)`;
  };

  return (
    <div className="space-y-6">
      {/* Header (Hidden on Print) */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1818] flex items-center gap-2">
            <DollarSign className="text-[#1E257F]" /> Rekapitulasi Honorarium & Gaji Guru
          </h2>
          <p className="text-[#6C757D] text-sm mt-1">
            Laporan honor lengkap berdasarkan kehadiran (Rp 5.000/hari), jam mengajar KBM (Rp 6.500/JP), tunjangan jabatan, dan apresiasi kinerja.
          </p>
        </div>

        {/* Tombol Aksi Cetak Tetap di Kanan Header */}
        {canViewAllHonors && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setAllSlipsModalOpen(true)}
              className="flex items-center gap-2 bg-[#1E257F] hover:bg-[#1E257F]/90 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-[#1E257F]/20 transition"
              title="Cetak slip honor guru terpilih sekaligus menyambung dalam 1 lembar A4"
            >
              <Printer size={18} /> Cetak Semua Slip ({filteredGuru.length})
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-[#2EC4B6] hover:bg-[#2EC4B6]/90 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-[#2EC4B6]/20 transition"
              title="Cetak rekapitulasi tabel honor sekolah"
            >
              <FileText size={18} /> Cetak Rekap Sekolah
            </button>
          </div>
        )}
      </div>

      {/* Summary Banner (Hidden on Print) */}
      <div className="print:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-[#1E257F] to-[#2E3A99] rounded-2xl p-5 text-white shadow-lg shadow-[#1E257F]/20">
          <p className="text-[#ECEEFF] text-xs font-bold uppercase tracking-wider">
            {canViewAllHonors ? 'Total Anggaran Honor' : 'Total Honor Anda'}
          </p>
          <h3 className="text-2xl font-black mt-1">Rp {totalHonorSeluruhGuru.toLocaleString('id-ID')}</h3>
          <p className="text-[#ECEEFF]/80 text-xs mt-1" dangerouslySetInnerHTML={{ __html: `Periode ${periodeBulanDisplay} ${selectedTahun}` }} />
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <p className="text-[#6C757D] text-xs font-bold uppercase tracking-wider">
            {canViewAllHonors ? 'Total Guru Terdaftar' : 'Akun Terdaftar'}
          </p>
          <h3 className="text-2xl font-black text-[#1A1818] mt-1">
            {canViewAllHonors ? `${filteredGuru.length} Orang` : (currentUser?.nama || 'Akun Anda')}
          </h3>
          <p className="text-[#ADB5BD] text-xs mt-1">Status: Aktif Mengajar</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <p className="text-[#6C757D] text-xs font-bold uppercase tracking-wider">Standar Kehadiran</p>
          <h3 className="text-2xl font-black text-[#00B4D8] mt-1">Rp 5.000 <span className="text-xs font-normal text-[#6C757D]">/ hari</span></h3>
          <p className="text-[#6C757D] text-xs mt-1">Potong 50% jika telat/cepat</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm">
          <p className="text-[#6C757D] text-xs font-bold uppercase tracking-wider">Standar KBM Mengajar</p>
          <h3 className="text-2xl font-black text-[#1E257F] mt-1">Rp 6.500 <span className="text-xs font-normal text-[#6C757D]">/ JP</span></h3>
          <p className="text-[#2EC4B6] text-xs mt-1 font-semibold">✓ Penuh, tanpa potongan telat</p>
        </div>
        <div className="bg-[#F2FBEB] rounded-2xl p-5 border border-[#84D43F]/30 shadow-sm">
          <p className="text-[#1E257F] text-xs font-bold uppercase tracking-wider">Honor Guru Ngaji</p>
          <h3 className="text-2xl font-black text-[#1E257F] mt-1">Rp 200.000 <span className="text-xs font-normal text-[#6C757D]">/ bln</span></h3>
          <p className="text-[#84D43F] text-xs mt-1 font-semibold">✓ Khusus: Rp 100.000 (1/2 bln)</p>
        </div>
      </div>

      {/* Card Filter & Pencarian (Card Tersendiri - Sejajar) */}
      <div className="print:hidden bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Kolom Pencarian (Full sampai mentok ke filter) */}
        <div className="flex-1 w-full">
          {canViewAllHonors ? (
            <div className="flex items-center bg-[#F8F9FA] border border-[#E2E8F0] focus-within:border-[#1E257F] focus-within:ring-2 focus-within:ring-[#1E257F]/20 rounded-xl px-4 py-2.5 transition">
              <Search size={18} className="text-[#6C757D] mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Cari nama guru atau NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm outline-none bg-transparent text-[#1A1818] placeholder-[#ADB5BD]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[#ADB5BD] hover:text-[#1A1818] p-0.5 rounded transition"
                  title="Hapus pencarian"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#6C757D] py-1">
              <User size={18} className="text-[#1E257F] shrink-0" />
              <span>Menampilkan data honor untuk: <strong className="text-[#1A1818]">{currentUser?.nama || 'Guru'}</strong></span>
            </div>
          )}
        </div>

        {/* Filter-filter Sejajar dengan Pencarian */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {/* Multi-Guru Checklist Filter Trigger */}
          {canViewAllHonors && (
            <div className="relative" ref={guruPickerRef}>
              <button
                type="button"
                onClick={() => setIsGuruPickerOpen(!isGuruPickerOpen)}
                className="flex items-center gap-2 bg-[#F8F9FA] border border-[#E2E8F0] hover:border-[#1E257F] hover:bg-[#ECEEFF]/30 rounded-xl px-3.5 py-2.5 shadow-sm text-sm font-bold text-[#1A1818] transition"
                title="Pilih satu, beberapa, atau semua guru"
              >
                <User size={16} className="text-[#1E257F]" />
                <span className="truncate max-w-[130px]">Guru: {getGuruFilterSummary()}</span>
                <ChevronDown size={14} className={`text-[#6C757D] transition-transform ${isGuruPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Checklist Dropdown Popover */}
              {isGuruPickerOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#E2E8F0]">
                    <div>
                      <h4 className="font-black text-[#1A1818] text-xs uppercase tracking-wider">Pilih Guru Rekap</h4>
                      <p className="text-[11px] text-[#6C757D]">Centang guru yang ingin ditampilkan & dicetak</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGuruPickerOpen(false)}
                      className="p-1 text-[#6C757D] hover:text-[#1A1818] rounded-lg hover:bg-[#F1F3F5] transition"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Search inside Guru popover */}
                  <div className="mb-2.5 flex items-center bg-[#F8F9FA] border border-[#E2E8F0] rounded-xl px-3 py-1.5 focus-within:border-[#1E257F]">
                    <Search size={14} className="text-[#6C757D] mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="Cari nama guru..."
                      value={guruSearchFilter}
                      onChange={(e) => setGuruSearchFilter(e.target.value)}
                      className="w-full text-xs outline-none bg-transparent text-[#1A1818] placeholder-[#ADB5BD]"
                    />
                    {guruSearchFilter && (
                      <button type="button" onClick={() => setGuruSearchFilter('')} className="text-[#ADB5BD] hover:text-[#1A1818]">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <button
                      type="button"
                      onClick={handleSelectAllGuru}
                      className="flex-1 py-1 px-2 text-[11px] font-bold rounded-lg bg-[#ECEEFF] text-[#1E257F] hover:bg-[#1E257F] hover:text-white transition text-center"
                    >
                      Pilih Semua ({availableGuru.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllGuru}
                      className="flex-1 py-1 px-2 text-[11px] font-bold rounded-lg bg-[#F1F3F5] text-[#1A1818] hover:bg-[#E2E8F0] transition text-center"
                    >
                      Reset / Sisakan 1
                    </button>
                  </div>

                  {/* Scrollable Teachers Checklist */}
                  <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    {availableGuru
                      .filter((g) => g.nama?.toLowerCase().includes(guruSearchFilter.toLowerCase()) || g.nip?.toLowerCase().includes(guruSearchFilter.toLowerCase()))
                      .map((guru) => {
                        const isChecked = selectedGuruIdList.includes(guru.id);
                        const jg = jabatanGuruMap[guru.id];
                        const jabName = jg?.jabatan_utama || '-';
                        return (
                          <button
                            key={guru.id}
                            type="button"
                            onClick={() => toggleGuru(guru.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition text-left ${
                              isChecked
                                ? 'bg-[#ECEEFF] text-[#1E257F] border border-[#1E257F]/30'
                                : 'bg-[#F8F9FA] hover:bg-[#F1F3F5] text-[#1A1818] border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              {isChecked ? (
                                <CheckSquare size={16} className="shrink-0 text-[#1E257F]" />
                              ) : (
                                <Square size={16} className="shrink-0 text-[#ADB5BD]" />
                              )}
                              <div className="truncate">
                                <span className="font-bold block truncate">{guru.nama}</span>
                                <span className="text-[10px] text-[#6C757D] block truncate">{jabName}</span>
                              </div>
                            </div>
                            {guru.nip && (
                              <span className="text-[10px] font-mono text-[#ADB5BD] shrink-0">NIP: {guru.nip}</span>
                            )}
                          </button>
                        );
                      })}
                  </div>

                  {/* Popover Footer */}
                  <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                    <span className="text-[#6C757D] font-medium">
                      Terpilih: <strong className="text-[#1A1818]">{selectedGuruIdList.length} dari {availableGuru.length} Guru</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsGuruPickerOpen(false)}
                      className="px-3.5 py-1 bg-[#1E257F] hover:bg-[#1E257F]/90 text-white rounded-lg font-bold text-xs transition"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multi-Month Checklist Filter Trigger */}
          <div className="relative" ref={bulanPickerRef}>
            <button
              onClick={() => setIsBulanPickerOpen(!isBulanPickerOpen)}
              className="flex items-center gap-2 bg-[#F8F9FA] border border-[#E2E8F0] hover:border-[#1E257F] hover:bg-[#ECEEFF]/30 rounded-xl px-3.5 py-2.5 shadow-sm text-sm font-bold text-[#1A1818] transition"
              title="Pilih satu atau beberapa bulan rekap"
            >
              <Calendar size={16} className="text-[#1E257F]" />
              <span>Bulan: {getBulanFilterSummary()}</span>
              <ChevronDown size={14} className={`text-[#6C757D] transition-transform ${isBulanPickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Checklist Dropdown Popover */}
            {isBulanPickerOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E8F0]">
                  <div>
                    <h4 className="font-black text-[#1A1818] text-xs uppercase tracking-wider">Pilih Bulan Rekap</h4>
                    <p className="text-[11px] text-[#6C757D]">Bisa memilih beberapa bulan sekaligus</p>
                  </div>
                  <button
                    onClick={() => setIsBulanPickerOpen(false)}
                    className="p-1 text-[#6C757D] hover:text-[#1A1818] rounded-lg hover:bg-[#F1F3F5] transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={handleSelectAllBulan}
                    className="flex-1 py-1 px-2 text-[11px] font-bold rounded-lg bg-[#ECEEFF] text-[#1E257F] hover:bg-[#1E257F] hover:text-white transition text-center"
                  >
                    Pilih Semua
                  </button>
                  <button
                    onClick={handleSelectCurrentBulan}
                    className="flex-1 py-1 px-2 text-[11px] font-bold rounded-lg bg-[#F1F3F5] text-[#1A1818] hover:bg-[#E2E8F0] transition text-center"
                  >
                    Bulan Ini
                  </button>
                </div>

                {/* Grid 12 Months with Checkboxes */}
                <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {bulanNames.map((bName, idx) => {
                    const bNum = idx + 1;
                    const isChecked = selectedBulanList.includes(bNum);
                    return (
                      <button
                        key={bNum}
                        type="button"
                        onClick={() => toggleBulan(bNum)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition text-left ${
                          isChecked
                            ? 'bg-[#1E257F] text-white shadow-sm'
                            : 'bg-[#F8F9FA] hover:bg-[#F1F3F5] text-[#1A1818]'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare size={15} className="shrink-0 text-white" />
                        ) : (
                          <Square size={15} className="shrink-0 text-[#ADB5BD]" />
                        )}
                        <span className="truncate">{bName}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                  <span className="text-[#6C757D] font-medium">Terpilih: <strong className="text-[#1A1818]">{selectedBulanList.length} Bulan</strong></span>
                  <button
                    onClick={() => setIsBulanPickerOpen(false)}
                    className="px-3 py-1 bg-[#1E257F] hover:bg-[#1E257F]/90 text-white rounded-lg font-bold text-xs transition"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tahun Selector */}
          <div className="flex items-center gap-2 bg-[#F8F9FA] border border-[#E2E8F0] hover:border-[#1E257F] rounded-xl px-3 py-2 shadow-sm text-sm">
            <select
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(Number(e.target.value))}
              className="bg-transparent font-bold text-[#1A1818] outline-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            className="p-2.5 bg-[#F8F9FA] border border-[#E2E8F0] rounded-xl text-[#1E257F] hover:bg-[#ECEEFF] hover:border-[#1E257F] transition shadow-sm"
            title="Refresh Data"
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Main Table (Visible on Screen & Print Rekap Sekolah) */}
      <div className={`bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden print:border-none print:shadow-none ${slipModalOpen || allSlipsModalOpen ? 'print:hidden' : ''}`}>
        {/* Printable Letterhead Rekap */}
        <div className="hidden print:block mb-4">
          <KopSurat dataLembaga={dataLembaga} />
          <h3 className="text-sm font-bold uppercase mt-2 text-center underline text-[#1A1818]">
            REKAPITULASI HONORARIUM GURU - BULAN {getBulanFilterSummary().toUpperCase()} {selectedTahun}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F8F9FA] text-[#6C757D] uppercase text-[11px] font-bold tracking-wider border-b border-[#CBD5E1] print:bg-gray-100">
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Nama Guru & NIP</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4 text-center">Kehadiran (Hari)</th>
                <th className="py-3 px-4 text-right">Honor Kehadiran</th>
                <th className="py-3 px-4 text-center">Total KBM (JP)</th>
                <th className="py-3 px-4 text-right">Honor KBM</th>
                <th className="py-3 px-4 text-right">Tunj. Jabatan</th>
                <th className="py-3 px-4 text-right">Honor Guru Ngaji</th>
                <th className="py-3 px-4 text-right">Apresiasi Kinerja</th>
                <th className="py-3 px-4 text-right font-black text-[#1A1818]">Total Honor</th>
                <th className="py-3 px-4 text-center print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {isLoading ? (
                <tr>
                  <td colSpan="12" className="text-center py-12 text-[#ADB5BD]">
                    Memuat data rekapitulasi honor...
                  </td>
                </tr>
              ) : filteredGuru.length === 0 ? (
                <tr>
                  <td colSpan="12" className="text-center py-12 text-[#ADB5BD]">
                    Tidak ada data guru ditemukan.
                  </td>
                </tr>
              ) : (
                filteredGuru.map((guru, index) => {
                  const calc = calculateTeacherHonor(guru.id);
                  return (
                    <tr key={guru.id} className="hover:bg-[#F8F9FA]/70 transition">
                      <td className="py-3.5 px-4 font-mono text-[#ADB5BD]">{index + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-[#1A1818]">
                        {guru.nama}
                        {guru.nip && <span className="block text-[11px] font-normal text-[#6C757D]">NIP: {guru.nip}</span>}
                      </td>
                      <td className="py-3.5 px-4 text-[#6C757D]">
                        <span className="bg-[#ECEEFF] text-[#1E257F] px-2 py-0.5 rounded text-xs font-semibold">
                          {calc.namaJabatanUtama}
                        </span>
                        {calc.isGuruNgaji && (
                          <span className="block mt-1 text-[10px] text-[#1E257F] font-semibold bg-[#F2FBEB] border border-[#84D43F]/40 px-1.5 py-0.5 rounded w-fit">
                            Guru Ngaji
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-[#00B4D8]">
                        {calc.totalHariHadir} hari
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#1A1818]">
                        Rp {calc.totalHonorKehadiran.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-[#1E257F]">
                        {calc.totalJp} JP
                        {calc.totalJpInval > 0 && (
                          <span className="block text-[10px] text-[#FFB703]">({calc.totalJpInval} Inval)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#1A1818]">
                        Rp {calc.totalHonorKbm.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#1A1818]">
                        Rp {calc.tunjanganJabatan.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        {calc.isGuruNgaji ? (
                          <div>
                            <span className="font-bold text-[#1E257F]">Rp {calc.honorGuruNgaji.toLocaleString('id-ID')}</span>
                            <span className="block text-[10px] text-[#6C757D] font-normal">Tetap (Tanpa Potongan)</span>
                          </div>
                        ) : (
                          <span className="text-[#ADB5BD] font-normal">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        {canEditApresiasi ? (
                          <button
                            onClick={() => openEditApresiasi(guru)}
                            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F2FBEB] hover:bg-[#84D43F]/20 text-[#1A1818] text-xs font-bold transition border border-[#84D43F]"
                            title="Klik untuk mengubah apresiasi kinerja"
                          >
                            <span>Rp {calc.apresiasiKinerja.toLocaleString('id-ID')}</span>
                            <Edit3 size={12} className="text-[#1E257F] opacity-70 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <span className="font-semibold text-[#1A1818]">
                            Rp {calc.apresiasiKinerja.toLocaleString('id-ID')}
                          </span>
                        )}
                        {calc.keteranganApresiasi ? (
                          <span className="block text-[10px] text-[#6C757D] font-normal italic truncate max-w-[130px] ml-auto" title={calc.keteranganApresiasi}>
                            {calc.keteranganApresiasi}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-[#1E257F] text-sm bg-[#ECEEFF]/50">
                        Rp {calc.totalHonorBersih.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openDetail(guru)}
                            className="p-1.5 text-[#1E257F] hover:bg-[#ECEEFF] rounded-lg transition"
                            title="Lihat Rincian Log"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openSlip(guru)}
                            className="p-1.5 text-[#2EC4B6] hover:bg-[#2EC4B6]/10 rounded-lg transition"
                            title="Pratinjau & Cetak Slip"
                          >
                            <FileText size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8F9FA] font-black text-[#1A1818] border-t-2 border-[#CBD5E1]">
                <td colSpan="10" className="py-4 px-6 text-right uppercase tracking-wider text-xs">
                  Total Seluruh Honorarium Guru:
                </td>
                <td className="py-4 px-6 text-right font-mono text-base text-[#1E257F]">
                  Rp {totalHonorSeluruhGuru.toLocaleString('id-ID')}
                </td>
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Print Signatures */}
        <div className="hidden print:flex justify-between items-center mt-12 px-8 text-xs">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-bold mb-16">Kepala Sekolah</p>
            <p className="font-bold underline">{dataLembaga?.kepala_sekolah || 'Kepala Sekolah'}</p>
          </div>
          <div className="text-center">
            <p>Subang, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-bold mb-16">Bendahara / Admin</p>
            <p className="font-bold underline">___________________________</p>
          </div>
        </div>
      </div>

      {/* Modal Detail Log Kehadiran & KBM */}
      {detailModalOpen && selectedGuruDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-[#E2E8F0]">
            <div className="p-5 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8F9FA]">
              <div>
                <h3 className="font-bold text-[#1A1818] text-base">Rincian Log Kehadiran & Mengajar</h3>
                <p className="text-xs text-[#6C757D]">{selectedGuruDetail.nama} • Periode {getBulanFilterSummary()} {selectedTahun}</p>
              </div>
              <button 
                onClick={() => setDetailModalOpen(false)} 
                className="p-1 rounded-full hover:bg-[#F1F3F5] text-[#6C757D] hover:text-[#1A1818] transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="bg-[#F8F9FA] p-3 rounded-2xl border border-[#00B4D8]/30">
                  <p className="text-[10px] uppercase font-bold text-[#00B4D8]">Kehadiran</p>
                  <h4 className="text-lg font-black text-[#1A1818] mt-0.5">{selectedGuruDetail.totalHariHadir} Hari</h4>
                  <p className="text-xs text-[#00B4D8] font-mono">Rp {selectedGuruDetail.totalHonorKehadiran.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-[#ECEEFF] p-3 rounded-2xl border border-[#1E257F]/20">
                  <p className="text-[10px] uppercase font-bold text-[#1E257F]">Total KBM</p>
                  <h4 className="text-lg font-black text-[#1E257F] mt-0.5">{selectedGuruDetail.totalJp} JP</h4>
                  <p className="text-xs text-[#1E257F] font-mono">Rp {selectedGuruDetail.totalHonorKbm.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-[#F2FBEB] p-3 rounded-2xl border border-[#84D43F]/30">
                  <p className="text-[10px] uppercase font-bold text-[#1E257F]">Guru Ngaji</p>
                  <h4 className="text-lg font-black text-[#1E257F] mt-0.5">
                    {selectedGuruDetail.isGuruNgaji ? `Rp ${selectedGuruDetail.honorGuruNgaji.toLocaleString('id-ID')}` : '-'}
                  </h4>
                  <p className="text-[10px] text-[#84D43F] font-semibold">
                    {selectedGuruDetail.isGuruNgaji ? 'Tetap / Tanpa Potongan' : 'Bukan Guru Ngaji'}
                  </p>
                </div>
                <div className="bg-[#F8F9FA] p-3 rounded-2xl border border-[#E2E8F0]">
                  <p className="text-[10px] uppercase font-bold text-[#6C757D]">Apresiasi Kinerja</p>
                  <h4 className="text-lg font-black text-[#1A1818] mt-0.5">Rp {selectedGuruDetail.apresiasiKinerja.toLocaleString('id-ID')}</h4>
                  <p className="text-[10px] text-[#6C757D] truncate">{selectedGuruDetail.keteranganApresiasi || 'Reward Khusus'}</p>
                </div>
                <div className="bg-[#1E257F] p-3 rounded-2xl border border-[#1E257F] text-white">
                  <p className="text-[10px] uppercase font-bold text-[#ECEEFF]">Total Honor</p>
                  <h4 className="text-lg font-black text-white mt-0.5">Rp {selectedGuruDetail.totalHonorBersih.toLocaleString('id-ID')}</h4>
                  <p className="text-[10px] text-[#ECEEFF]">Bersih Diterima</p>
                </div>
              </div>

              {/* Log Kehadiran */}
              <div>
                <h4 className="font-bold text-xs uppercase text-[#6C757D] mb-2 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-[#00B4D8]" /> Log Kehadiran Sekolah
                </h4>
                <div className="bg-[#F8F9FA] rounded-2xl p-3 max-h-48 overflow-y-auto border border-[#E2E8F0]">
                  {selectedGuruDetail.myPresensi?.length === 0 ? (
                    <p className="text-xs text-[#ADB5BD] text-center py-3">Belum ada catatan kehadiran untuk bulan terpilih.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedGuruDetail.myPresensi?.map((p, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-[#E2E8F0] text-xs">
                          <div>
                            <span className="font-bold text-[#1A1818]">{p.tanggal}</span>
                            <span className="text-[#6C757D] ml-2">({p.waktu_datang || '--:--'} s/d {p.waktu_pulang || '--:--'})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.terlambat_menit > 0 && <span className="text-[10px] text-[#E63946] bg-[#E63946]/10 px-1.5 py-0.5 rounded font-semibold">Telat {p.terlambat_menit}m</span>}
                            {p.pulang_cepat_menit > 0 && <span className="text-[10px] text-[#FFB703] bg-[#FFB703]/10 px-1.5 py-0.5 rounded font-semibold">Cepat {p.pulang_cepat_menit}m</span>}
                            <span className="font-mono font-bold text-[#1E257F]">Rp {(Number(p.honor_kehadiran) || 0).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Log Mengajar KBM */}
              <div>
                <h4 className="font-bold text-xs uppercase text-[#6C757D] mb-2 flex items-center gap-1.5">
                  <Clock size={14} className="text-[#1E257F]" /> Log Jam Mengajar (KBM)
                </h4>
                <div className="bg-[#F8F9FA] rounded-2xl p-3 max-h-48 overflow-y-auto border border-[#E2E8F0]">
                  {selectedGuruDetail.myKbm?.length === 0 ? (
                    <p className="text-xs text-[#ADB5BD] text-center py-3">Belum ada catatan jam mengajar untuk bulan terpilih.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedGuruDetail.myKbm?.map((k, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-[#E2E8F0] text-xs">
                          <div>
                            <span className="font-bold text-[#1A1818]">{k.tanggal}</span>
                            <span className="text-[#1E257F] font-semibold ml-2">Jam Ke: {k.jam_ke || '1'}</span>
                            {k.is_pengganti && <span className="ml-1 text-[9px] bg-[#FFB703]/20 text-[#1A1818] px-1 rounded font-bold">Inval</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#6C757D] font-mono">{k.waktu_masuk} - {k.waktu_keluar || '...'}</span>
                            <span className="font-mono font-bold text-[#1E257F]">Rp {((Number(k.jumlah_jp) || 1) * 6500).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8F9FA] flex justify-end">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#F1F3F5] hover:bg-[#E2E8F0] font-bold text-xs text-[#1A1818] transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pratinjau Slip Honor (Single Slip) - Format Gambar 1 */}
      {slipModalOpen && selectedGuruDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-[#E2E8F0] flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8F9FA] shrink-0">
              <h3 className="font-bold text-[#1A1818] text-sm flex items-center gap-2">
                <FileText size={16} className="text-[#1E257F]" />
                Pratinjau Slip Honorarium Guru (Resmi)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintSingleSlip(selectedGuruDetail)}
                  className="flex items-center gap-1.5 bg-[#1E257F] hover:bg-[#1E257F]/90 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-[#1E257F]/20 transition"
                >
                  <Printer size={15} /> Cetak Slip Ini
                </button>
                <button 
                  onClick={() => setSlipModalOpen(false)} 
                  className="p-1 text-[#6C757D] hover:text-[#1A1818] rounded-lg hover:bg-[#F1F3F5] transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Slip Container Rendered Exactly Like Gambar 1 */}
            <div className="p-8 overflow-y-auto bg-[#F8F9FA] flex-1">
              <div 
                className="bg-white p-8 rounded-2xl shadow-sm border border-[#E2E8F0] max-w-2xl mx-auto"
                dangerouslySetInnerHTML={{
                  __html: generateSingleSlipHtml({
                    guruNama: selectedGuruDetail.nama,
                    rowJabatan: selectedGuruDetail.rowJabatan,
                    rowMapel: selectedGuruDetail.rowMapel,
                    rowNgaji: selectedGuruDetail.rowNgaji,
                    rowKehadiran: selectedGuruDetail.rowKehadiran,
                    rowWali: selectedGuruDetail.rowWali,
                    rowApresiasi: selectedGuruDetail.rowApresiasi,
                    totalHonor: selectedGuruDetail.totalHonorBersih
                  }, dataLembaga, periodeBulanDisplay)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Semua Slip - Format Gambar 2 (Menyambung dalam 1 lembar A4) */}
      {allSlipsModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
          <div className="p-4 bg-white border-b border-[#E2E8F0] flex justify-between items-center shadow-md shrink-0">
            <div>
              <h3 className="font-bold text-[#1A1818] text-base flex items-center gap-2">
                <Printer className="text-[#1E257F]" size={18} />
                Pratinjau Cetak Semua Slip Honor ({filteredGuru.length} Guru)
              </h3>
              <p className="text-xs text-[#6C757D] mt-0.5" dangerouslySetInnerHTML={{ __html: `Periode: ${periodeBulanDisplay} ${selectedTahun} • Slip terus menyambung selagi masih muat dalam 1 halaman HVS/A4 (Gambar 2)` }} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintAllSlips}
                className="flex items-center gap-2 bg-[#1E257F] hover:bg-[#1E257F]/90 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-[#1E257F]/20 transition"
              >
                <Printer size={16} /> Cetak Semua Sekarang
              </button>
              <button
                onClick={() => setAllSlipsModalOpen(false)}
                className="p-2 text-[#6C757D] hover:text-[#1A1818] rounded-xl hover:bg-[#F1F3F5] transition"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-[#F1F3F5]">
            <div className="max-w-2xl mx-auto space-y-4">
              <div 
                className="bg-white p-8 rounded-2xl shadow-sm border border-[#CBD5E1]"
                dangerouslySetInnerHTML={{
                  __html: filteredGuru.map((guru) => {
                    const calc = calculateTeacherHonor(guru.id);
                    return generateSingleSlipHtml({
                      guruNama: guru.nama,
                      rowJabatan: calc.rowJabatan,
                      rowMapel: calc.rowMapel,
                      rowNgaji: calc.rowNgaji,
                      rowKehadiran: calc.rowKehadiran,
                      rowWali: calc.rowWali,
                      rowApresiasi: calc.rowApresiasi,
                      totalHonor: calc.totalHonorBersih
                    }, dataLembaga, periodeBulanDisplay);
                  }).join('\n')
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Apresiasi Kinerja (Khusus Kepsek & Bendahara) */}
      {apresiasiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-[#E2E8F0]">
            <div className="p-5 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#ECEEFF] flex items-center justify-center text-[#1E257F]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[#1A1818] text-base">Apresiasi Kinerja Guru</h3>
                  <p className="text-xs text-[#6C757D]">{apresiasiForm.guru_nama}</p>
                </div>
              </div>
              <button 
                onClick={() => setApresiasiModalOpen(false)} 
                className="p-1 rounded-full hover:bg-[#F1F3F5] text-[#6C757D] hover:text-[#1A1818] transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveApresiasi} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1A1818] uppercase tracking-wider mb-1.5">
                  Bulan Rekap
                </label>
                <select
                  value={apresiasiForm.bulan}
                  onChange={(e) => setApresiasiForm((prev) => ({ ...prev, bulan: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-[#F8F9FA] border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#1A1818] focus:bg-white focus:ring-2 focus:ring-[#1E257F] outline-none"
                >
                  {selectedBulanList.map((b) => (
                    <option key={b} value={b}>{bulanNames[b - 1]} {selectedTahun}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#1A1818] uppercase tracking-wider">
                    Jenis Apresiasi *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCrudMasterModalOpen(true)}
                    className="text-xs text-[#1E257F] hover:text-[#1E257F]/80 font-bold flex items-center gap-1 hover:underline"
                  >
                    <Settings size={13} /> Kelola Opsi
                  </button>
                </div>
                <select
                  value={apresiasiForm.keterangan}
                  onChange={(e) => handleJenisSelect(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F8F9FA] border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#1A1818] focus:bg-white focus:ring-2 focus:ring-[#1E257F] outline-none"
                  required
                >
                  <option value="">-- Pilih Jenis Apresiasi --</option>
                  {masterJenisApresiasi.map((item) => (
                    <option key={item.id} value={item.nama_apresiasi}>
                      {item.nama_apresiasi} {Number(item.nominal_default) > 0 ? `(Rp ${Number(item.nominal_default).toLocaleString('id-ID')})` : ''}
                    </option>
                  ))}
                  {apresiasiForm.keterangan && !masterJenisApresiasi.some((m) => m.nama_apresiasi === apresiasiForm.keterangan) && (
                    <option value={apresiasiForm.keterangan}>{apresiasiForm.keterangan} (Kustom)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1818] uppercase tracking-wider mb-1.5">
                  Nominal Tambahan (Rp) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6C757D] font-bold text-sm">Rp</span>
                  <input
                    type="text"
                    value={apresiasiForm.nominal ? Number(apresiasiForm.nominal).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setApresiasiForm((prev) => ({ ...prev, nominal: raw }));
                    }}
                    placeholder="0"
                    className="w-full pl-12 pr-4 py-2.5 bg-[#F8F9FA] border border-[#E2E8F0] rounded-xl text-sm font-mono font-bold text-[#1A1818] focus:bg-white focus:ring-2 focus:ring-[#1E257F] outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApresiasiModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#6C757D] hover:bg-[#F1F3F5] transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingApresiasi}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1E257F] hover:bg-[#1E257F]/90 text-white text-xs font-bold shadow-md shadow-[#1E257F]/20 transition disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{isSavingApresiasi ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Master Jenis Apresiasi */}
      {crudMasterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#E2E8F0]">
            <div className="p-5 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8F9FA]">
              <h3 className="font-bold text-[#1A1818] text-base flex items-center gap-2">
                <Settings size={18} className="text-[#1E257F]" />
                Kelola Pilihan Master Apresiasi
              </h3>
              <button 
                onClick={() => setCrudMasterModalOpen(false)} 
                className="p-1 rounded-full hover:bg-[#F1F3F5] text-[#6C757D] hover:text-[#1A1818] transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleSaveJenis} className="bg-[#F8F9FA] p-4 rounded-2xl border border-[#E2E8F0] space-y-3">
                <h4 className="text-xs font-bold text-[#1A1818] uppercase tracking-wider">
                  {editingJenis ? 'Edit Jenis Apresiasi' : 'Tambah Jenis Apresiasi Baru'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6C757D] mb-1">Nama Apresiasi *</label>
                    <input
                      type="text"
                      placeholder="e.g. Pembimbing Olimpiade"
                      value={jenisForm.nama_apresiasi}
                      onChange={(e) => setJenisForm((prev) => ({ ...prev, nama_apresiasi: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#1E257F] text-[#1A1818]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6C757D] mb-1">Nominal Default (Opsional)</label>
                    <input
                      type="text"
                      placeholder="0"
                      value={jenisForm.nominal_default ? Number(jenisForm.nominal_default).toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setJenisForm((prev) => ({ ...prev, nominal_default: raw }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-[#1E257F] text-[#1A1818]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  {editingJenis && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingJenis(null);
                        setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#6C757D] hover:bg-[#E2E8F0] transition"
                    >
                      Batal Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingJenis}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#1E257F] hover:bg-[#1E257F]/90 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    <Plus size={14} />
                    <span>{editingJenis ? 'Perbarui' : 'Tambah Opsi'}</span>
                  </button>
                </div>
              </form>

              <div>
                <h4 className="text-xs font-bold text-[#6C757D] uppercase tracking-wider mb-2">
                  Daftar Pilihan Tersedia ({masterJenisApresiasi.length})
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {masterJenisApresiasi.length === 0 ? (
                    <p className="text-xs text-[#ADB5BD] text-center py-4">Belum ada master jenis apresiasi.</p>
                  ) : (
                    masterJenisApresiasi.map((item) => (
                      <div key={item.id} className="flex justify-between items-center bg-[#F8F9FA] p-2.5 rounded-xl border border-[#E2E8F0] text-xs">
                        <div>
                          <p className="font-bold text-[#1A1818]">{item.nama_apresiasi}</p>
                          <p className="text-[11px] text-[#1E257F] font-mono font-semibold">
                            Rp {(Number(item.nominal_default) || 0).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingJenis(item);
                              setJenisForm({
                                nama_apresiasi: item.nama_apresiasi,
                                nominal_default: item.nominal_default ? String(item.nominal_default) : ''
                              });
                            }}
                            className="p-1.5 text-[#1E257F] hover:bg-[#ECEEFF] rounded-lg transition"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteJenis(item.id, item.nama_apresiasi)}
                            className="p-1.5 text-[#E63946] hover:bg-[#E63946]/10 rounded-lg transition"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8F9FA] flex justify-end">
              <button
                type="button"
                onClick={() => setCrudMasterModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#1E257F] text-white hover:bg-[#1E257F]/90 font-bold text-xs transition"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
