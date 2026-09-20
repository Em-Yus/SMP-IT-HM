import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { DollarSign, Calendar, Filter, Printer, Download, User, Search, Eye, FileText, CheckCircle, Clock, Award, ShieldCheck, X, Edit3, Save, Sparkles, Settings, Plus, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import KopSurat from '../components/KopSurat';

export default function RekapHonorGuru() {
  const [guruList, setGuruList] = useState([]);
  const [jabatanGuruMap, setJabatanGuruMap] = useState({});
  const [dataJabatanList, setDataJabatanList] = useState([]);
  const [presensiGuruList, setPresensiGuruList] = useState([]);
  const [presensiKbmList, setPresensiKbmList] = useState([]);
  const [dataLembaga, setDataLembaga] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBulan, setSelectedBulan] = useState(new Date().getMonth() + 1);
  const [selectedTahun, setSelectedTahun] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');

  // Apresiasi Kinerja State & Auth
  const [canEditApresiasi, setCanEditApresiasi] = useState(false);
  const [canViewAllHonors, setCanViewAllHonors] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [apresiasiKinerjaMap, setApresiasiKinerjaMap] = useState({});
  const [apresiasiModalOpen, setApresiasiModalOpen] = useState(false);
  const [apresiasiForm, setApresiasiForm] = useState({ guru_id: null, guru_nama: '', nominal: '', keterangan: '' });
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

  const bulanNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  useEffect(() => {
    fetchData();
  }, [selectedBulan, selectedTahun]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 0. Cek Hak Akses Pengguna Login:
      // Yang dapat melihat SEMUA NAMA hanya: Operator, Bendahara, dan Kepala Sekolah (serta Admin).
      // Guru lainnya hanya melihat data akun miliknya sendiri.
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

      // 3. Fetch Data Jabatan with Honor
      const { data: jabatan, error: errJab } = await supabase
        .from('data_jabatan')
        .select('*');
      if (errJab) throw errJab;
      setDataJabatanList(jabatan || []);

      // 4. Fetch Jabatan Guru
      const { data: jGuru, error: errJGuru } = await supabase
        .from('jabatan_guru')
        .select('*');
      if (errJGuru) throw errJGuru;

      const jMap = {};
      (jGuru || []).forEach((jg) => {
        jMap[jg.guru_id] = jg;
      });
      setJabatanGuruMap(jMap);

      // 5. Fetch Presensi Kehadiran for the month
      const startMonthStr = `${selectedTahun}-${String(selectedBulan).padStart(2, '0')}-01`;
      const endMonthStr = `${selectedTahun}-${String(selectedBulan).padStart(2, '0')}-31`;

      const { data: presensi, error: errPresensi } = await supabase
        .from('presensi_guru')
        .select('*')
        .gte('tanggal', startMonthStr)
        .lte('tanggal', endMonthStr);
      if (errPresensi && errPresensi.code !== '42P01') throw errPresensi;
      setPresensiGuruList(presensi || []);

      // 6. Fetch Presensi KBM for the month
      const { data: kbm, error: errKbm } = await supabase
        .from('presensi_kbm_guru')
        .select('*')
        .gte('tanggal', startMonthStr)
        .lte('tanggal', endMonthStr);
      if (errKbm && errKbm.code !== '42P01') throw errKbm;
      setPresensiKbmList(kbm || []);

      // 7. Fetch Apresiasi Kinerja Guru for this month & year
      const { data: apresiasiList, error: errApresiasi } = await supabase
        .from('apresiasi_kinerja_guru')
        .select('*')
        .eq('bulan', selectedBulan)
        .eq('tahun', selectedTahun);
      if (errApresiasi && errApresiasi.code !== '42P01') throw errApresiasi;

      const apMap = {};
      (apresiasiList || []).forEach((item) => {
        apMap[item.guru_id] = {
          id: item.id,
          nominal: Number(item.nominal) || 0,
          keterangan: item.keterangan || ''
        };
      });
      setApresiasiKinerjaMap(apMap);

      // 8. Fetch Master Jenis Apresiasi
      await fetchMasterJenis();

    } catch (err) {
      console.error('Error fetching rekap data:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat rekapitulasi honor guru.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper calculation for a teacher
  const calculateTeacherHonor = (guruId) => {
    const jg = jabatanGuruMap[guruId];
    
    // Standar honor Guru Ngaji dari data_jabatan
    const djNgaji = dataJabatanList.find((dj) => dj.nama_jabatan?.toLowerCase().includes('ngaji'));
    const defaultHonorNgaji = djNgaji && djNgaji.honor ? Number(djNgaji.honor) : 200000;

    // Calculate Tunjangan Jabatan & Honor Guru Ngaji
    let tunjanganJabatan = 0;
    let honorGuruNgaji = 0;
    let isGuruNgaji = false;
    let namaJabatanUtama = '-';

    if (jg) {
      namaJabatanUtama = jg.jabatan_utama || '-';
      const rawRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3].filter(Boolean);
      const allRoles = [...new Set(rawRoles.map((r) => (r ? String(r).trim() : '')).filter(Boolean))];

      allRoles.forEach((roleName) => {
        const lower = roleName.toLowerCase();
        const found = dataJabatanList.find((dj) => dj.nama_jabatan?.toLowerCase() === lower);
        const honorVal = found && found.honor ? Number(found.honor) : 0;

        if (lower.includes('ngaji')) {
          isGuruNgaji = true;
          honorGuruNgaji = honorVal > 0 ? honorVal : defaultHonorNgaji;
        } else {
          tunjanganJabatan += honorVal;
        }
      });
    }

    // Calculate Kehadiran
    const myPresensi = presensiGuruList.filter((p) => String(p.guru_id) === String(guruId));
    const totalHariHadir = myPresensi.filter((p) => p.status === 'Hadir').length;
    const totalHonorKehadiran = myPresensi.reduce((sum, p) => sum + (Number(p.honor_kehadiran) || 0), 0);

    // Calculate KBM (Mengacu pada jadwal, walaupun telat atau keluar lebih dulu di luar ketentuan KBM, tidak ada pemotongan honor sama sekali)
    const myKbm = presensiKbmList.filter((k) => String(k.guru_id) === String(guruId));
    const totalJp = myKbm.reduce((sum, k) => sum + (Number(k.jumlah_jp) || 1), 0);
    const totalHonorKbm = totalJp * 6500;
    const totalJpInval = myKbm.filter((k) => k.is_pengganti).reduce((sum, k) => sum + (Number(k.jumlah_jp) || 1), 0);

    // Apresiasi Kinerja
    const apItem = apresiasiKinerjaMap[guruId] || { nominal: 0, keterangan: '' };
    const apresiasiKinerja = Number(apItem.nominal) || 0;
    const keteranganApresiasi = apItem.keterangan || '';

    // Total Bersih: Kehadiran + KBM + Tunjangan Jabatan Lain + Honor Guru Ngaji (tanpa potongan walaupun tidak berangkat) + Apresiasi Kinerja
    const totalHonorBersih = totalHonorKehadiran + totalHonorKbm + tunjanganJabatan + honorGuruNgaji + apresiasiKinerja;

    return {
      namaJabatanUtama,
      isGuruNgaji,
      honorGuruNgaji,
      totalHariHadir,
      totalHonorKehadiran,
      totalJp,
      totalJpInval,
      totalHonorKbm,
      tunjanganJabatan,
      apresiasiKinerja,
      keteranganApresiasi,
      totalHonorBersih,
      myPresensi,
      myKbm
    };
  };

  // Jika bukan Operator, Bendahara, atau Kepala Sekolah, hanya tampilkan data akun yang sedang login
  const availableGuru = canViewAllHonors
    ? guruList
    : currentUser
      ? guruList.filter((g) => String(g.id) === String(currentUser.id))
      : [];

  const filteredGuru = availableGuru.filter((g) =>
    g.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.nip?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalHonorSeluruhGuru = filteredGuru.reduce((sum, g) => {
    const calc = calculateTeacherHonor(g.id);
    return sum + calc.totalHonorBersih;
  }, 0);

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
    const apItem = apresiasiKinerjaMap[guru.id] || { nominal: 0, keterangan: '' };
    let initKet = apItem.keterangan || '';
    let initNom = apItem.nominal ? String(apItem.nominal) : '';

    // Jika belum ada keterangan tapi master tersedia, gunakan opsi pertama dan auto-fill nominalnya jika ada
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
      keterangan: initKet
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

  const handleSaveApresiasi = async (e) => {
    e.preventDefault();
    if (!apresiasiForm.guru_id) return;
    setIsSavingApresiasi(true);
    try {
      const numNominal = Number(apresiasiForm.nominal.toString().replace(/[^0-9]/g, '')) || 0;
      const { error } = await supabase
        .from('apresiasi_kinerja_guru')
        .upsert({
          guru_id: apresiasiForm.guru_id,
          bulan: selectedBulan,
          tahun: selectedTahun,
          nominal: numNominal,
          keterangan: apresiasiForm.keterangan,
          updated_at: new Date().toISOString()
        }, { onConflict: 'guru_id,bulan,tahun' });
      
      if (error) throw error;

      setApresiasiKinerjaMap((prev) => ({
        ...prev,
        [apresiasiForm.guru_id]: {
          nominal: numNominal,
          keterangan: apresiasiForm.keterangan
        }
      }));

      Swal.fire({
        icon: 'success',
        title: 'Tersimpan',
        text: `Apresiasi kinerja untuk ${apresiasiForm.guru_nama} berhasil disimpan.`,
        timer: 1500,
        showConfirmButton: false
      });
      setApresiasiModalOpen(false);
    } catch (err) {
      console.error('Error saving apresiasi:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal menyimpan apresiasi kinerja.' });
    } finally {
      setIsSavingApresiasi(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header (Hidden on Print) */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="text-emerald-600" /> Rekapitulasi Honorarium & Gaji Guru
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Laporan honor lengkap berdasarkan kehadiran (Rp 5.000/hari), jam mengajar KBM (Rp 6.500/JP), tunjangan jabatan, dan apresiasi kinerja.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm text-sm">
            <Calendar size={16} className="text-gray-500" />
            <select
              value={selectedBulan}
              onChange={(e) => setSelectedBulan(Number(e.target.value))}
              className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer"
            >
              {bulanNames.map((b, idx) => (
                <option key={idx} value={idx + 1}>{b}</option>
              ))}
            </select>
            <select
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(Number(e.target.value))}
              className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer border-l pl-2"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchData}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition shadow-sm"
            title="Refresh Data"
          >
            <Filter size={18} />
          </button>
          {canViewAllHonors && (
            <>
              <button
                onClick={() => setAllSlipsModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-600/20 transition"
                title="Cetak slip honor seluruh guru sekaligus"
              >
                <Printer size={18} /> Cetak Semua Slip
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-md shadow-emerald-600/20 transition"
                title="Cetak rekapitulasi tabel honor sekolah"
              >
                <FileText size={18} /> Cetak Rekap Sekolah
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Banner (Hidden on Print) */}
      <div className="print:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg shadow-emerald-600/20">
          <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">
            {canViewAllHonors ? 'Total Anggaran Honor' : 'Total Honor Anda'}
          </p>
          <h3 className="text-2xl font-black mt-1">Rp {totalHonorSeluruhGuru.toLocaleString('id-ID')}</h3>
          <p className="text-emerald-200 text-xs mt-1">Periode {bulanNames[selectedBulan - 1]} {selectedTahun}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
            {canViewAllHonors ? 'Total Guru Terdaftar' : 'Akun Terdaftar'}
          </p>
          <h3 className="text-2xl font-black text-gray-800 mt-1">
            {canViewAllHonors ? `${filteredGuru.length} Orang` : (currentUser?.nama || 'Akun Anda')}
          </h3>
          <p className="text-gray-400 text-xs mt-1">Status: Aktif Mengajar</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Standar Kehadiran</p>
          <h3 className="text-2xl font-black text-blue-600 mt-1">Rp 5.000 <span className="text-xs font-normal text-gray-500">/ hari</span></h3>
          <p className="text-gray-400 text-xs mt-1">Potong 50% jika telat/cepat</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Standar KBM Mengajar</p>
          <h3 className="text-2xl font-black text-indigo-600 mt-1">Rp 6.500 <span className="text-xs font-normal text-gray-500">/ JP</span></h3>
          <p className="text-emerald-600 text-xs mt-1 font-semibold">✓ Penuh, tanpa potongan telat</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-teal-100 bg-teal-50/30 shadow-sm">
          <p className="text-teal-600 text-xs font-bold uppercase tracking-wider">Honor Guru Ngaji</p>
          <h3 className="text-2xl font-black text-teal-700 mt-1">Rp 200.000 <span className="text-xs font-normal text-gray-500">/ bln</span></h3>
          <p className="text-teal-600 text-xs mt-1 font-semibold">✓ Tetap, tanpa potongan</p>
        </div>
      </div>

      {/* Search Bar (Hidden on Print & Hidden if regular teacher) */}
      {canViewAllHonors && (
        <div className="print:hidden flex items-center bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm max-w-md">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Cari nama guru atau NIP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm outline-none bg-transparent"
          />
        </div>
      )}

      {/* Main Table (Visible on Screen & Print) */}
      <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:border-none print:shadow-none ${slipModalOpen || allSlipsModalOpen ? 'print:hidden' : ''}`}>
        {/* Printable Letterhead */}
        <div className="hidden print:block mb-4">
          <KopSurat dataLembaga={dataLembaga} />
          <h3 className="text-sm font-bold uppercase mt-2 text-center underline">
            REKAPITULASI HONORARIUM GURU - BULAN {bulanNames[selectedBulan - 1].toUpperCase()} {selectedTahun}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-gray-600 uppercase text-[11px] font-bold tracking-wider border-b border-gray-200 print:bg-gray-100">
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
                <th className="py-3 px-4 text-right font-black text-gray-800">Total Honor</th>
                <th className="py-3 px-4 text-center print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="12" className="text-center py-12 text-gray-400">
                    Memuat data rekapitulasi honor...
                  </td>
                </tr>
              ) : filteredGuru.length === 0 ? (
                <tr>
                  <td colSpan="12" className="text-center py-12 text-gray-400">
                    Tidak ada data guru ditemukan.
                  </td>
                </tr>
              ) : (
                filteredGuru.map((guru, index) => {
                  const calc = calculateTeacherHonor(guru.id);
                  return (
                    <tr key={guru.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-mono text-gray-400">{index + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-gray-800">
                        {guru.nama}
                        {guru.nip && <span className="block text-[11px] font-normal text-gray-400">NIP: {guru.nip}</span>}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">
                          {calc.namaJabatanUtama}
                        </span>
                        {calc.isGuruNgaji && (
                          <span className="block mt-1 text-[10px] text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded w-fit">
                            Guru Ngaji
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-blue-700">
                        {calc.totalHariHadir} hari
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-700">
                        Rp {calc.totalHonorKehadiran.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-indigo-700">
                        {calc.totalJp} JP
                        {calc.totalJpInval > 0 && (
                          <span className="block text-[10px] text-amber-600">({calc.totalJpInval} Inval)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-700">
                        Rp {calc.totalHonorKbm.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-700">
                        Rp {calc.tunjanganJabatan.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        {calc.isGuruNgaji ? (
                          <div>
                            <span className="font-bold text-teal-700">Rp {calc.honorGuruNgaji.toLocaleString('id-ID')}</span>
                            <span className="block text-[10px] text-teal-600 font-normal">Tetap (Tanpa Potongan)</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-normal">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        {canEditApresiasi ? (
                          <button
                            onClick={() => openEditApresiasi(guru)}
                            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition border border-emerald-200"
                            title="Klik untuk mengubah apresiasi kinerja (Hanya Kepsek & Bendahara)"
                          >
                            <span>Rp {calc.apresiasiKinerja.toLocaleString('id-ID')}</span>
                            <Edit3 size={12} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <span className="font-semibold text-gray-700">
                            Rp {calc.apresiasiKinerja.toLocaleString('id-ID')}
                          </span>
                        )}
                        {calc.keteranganApresiasi ? (
                          <span className="block text-[10px] text-gray-400 font-normal italic truncate max-w-[130px] ml-auto" title={calc.keteranganApresiasi}>
                            {calc.keteranganApresiasi}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 text-sm bg-emerald-50/40">
                        Rp {calc.totalHonorBersih.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openDetail(guru)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Lihat Rincian"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openSlip(guru)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Cetak Slip Gaji"
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
              <tr className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
                <td colSpan="9" className="py-4 px-6 text-right uppercase tracking-wider">
                  Total Seluruh Honorarium Guru:
                </td>
                <td className="py-4 px-6 text-right font-mono text-base text-emerald-800">
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

      {/* Modal Edit Apresiasi Kinerja (Khusus Kepsek & Bendahara) */}
      {apresiasiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-base">Apresiasi Kinerja</h3>
                  <p className="text-xs text-gray-500">{apresiasiForm.guru_nama}</p>
                </div>
              </div>
              <button onClick={() => setApresiasiModalOpen(false)} className="p-1 rounded-full hover:bg-gray-200 text-gray-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveApresiasi} className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Jenis Apresiasi *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCrudMasterModalOpen(true)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 hover:underline"
                  >
                    <Settings size={13} /> Kelola Jenis Opsi
                  </button>
                </div>
                <select
                  value={apresiasiForm.keterangan}
                  onChange={(e) => handleJenisSelect(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                <p className="text-[11px] text-gray-400 mt-1">
                  Pilih opsi dari daftar master agar seragam dan tanpa perlu mengetik manual.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nominal Apresiasi / Bonus (Rp) *
                </label>
                <input
                  type="text"
                  placeholder="Cth: 150000"
                  value={apresiasiForm.nominal}
                  onChange={(e) => setApresiasiForm({ ...apresiasiForm, nominal: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Otomatis terisi standar, dapat disesuaikan oleh Kepala Sekolah / Bendahara.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApresiasiModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-xs text-gray-600 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingApresiasi}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  <Save size={14} />
                  {isSavingApresiasi ? 'Menyimpan...' : 'Simpan Apresiasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal CRUD Master Jenis Apresiasi */}
      {crudMasterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Settings size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-base">Master Jenis Apresiasi</h3>
                  <p className="text-xs text-gray-500">Kelola daftar pilihan apresiasi dan nominal standar</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCrudMasterModalOpen(false);
                  setEditingJenis(null);
                  setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                }}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Form Tambah / Edit */}
              <form onSubmit={handleSaveJenis} className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                    {editingJenis ? 'Edit Jenis Apresiasi' : 'Tambah Jenis Apresiasi Baru'}
                  </h4>
                  {editingJenis && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingJenis(null);
                        setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nama Jenis Apresiasi (Cth: Pembimbing Olimpiade)"
                    value={jenisForm.nama_apresiasi}
                    onChange={(e) => setJenisForm({ ...jenisForm, nama_apresiasi: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Nominal Standar / Default (Rp, opsional)"
                    value={jenisForm.nominal_default}
                    onChange={(e) => setJenisForm({ ...jenisForm, nominal_default: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingJenis}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {editingJenis ? <Save size={13} /> : <Plus size={13} />}
                    {isSavingJenis ? 'Menyimpan...' : (editingJenis ? 'Perbarui Opsi' : 'Simpan Opsi Baru')}
                  </button>
                </div>
              </form>

              {/* Daftar Opsi Saat Ini */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Daftar Pilihan Standar ({masterJenisApresiasi.length})</h4>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-white">
                  {masterJenisApresiasi.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">Belum ada master jenis apresiasi.</div>
                  ) : (
                    masterJenisApresiasi.map((item) => (
                      <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{item.nama_apresiasi}</p>
                          <p className="text-xs font-mono text-emerald-600 font-bold">
                            Default: Rp {(Number(item.nominal_default) || 0).toLocaleString('id-ID')}
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
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteJenis(item.id, item.nama_apresiasi)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Hapus"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setCrudMasterModalOpen(false);
                  setEditingJenis(null);
                  setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Rincian Presensi Guru */}
      {detailModalOpen && selectedGuruDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Rincian Log Kehadiran & KBM</h3>
                <p className="text-xs text-gray-500 font-semibold">{selectedGuruDetail.nama} • {bulanNames[selectedBulan - 1]} {selectedTahun}</p>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="p-1 rounded-full hover:bg-gray-200 text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                  <p className="text-[10px] uppercase font-bold text-blue-600">Total Hadir</p>
                  <h4 className="text-lg font-black text-blue-900 mt-0.5">{selectedGuruDetail.totalHariHadir} Hari</h4>
                  <p className="text-xs text-blue-700 font-mono">Rp {selectedGuruDetail.totalHonorKehadiran.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] uppercase font-bold text-indigo-600">Total KBM</p>
                  <h4 className="text-lg font-black text-indigo-900 mt-0.5">{selectedGuruDetail.totalJp} JP</h4>
                  <p className="text-xs text-indigo-700 font-mono">Rp {selectedGuruDetail.totalHonorKbm.toLocaleString('id-ID')}</p>
                </div>
                <div className="bg-teal-50 p-3 rounded-2xl border border-teal-100">
                  <p className="text-[10px] uppercase font-bold text-teal-600">Guru Ngaji</p>
                  <h4 className="text-lg font-black text-teal-900 mt-0.5">
                    {selectedGuruDetail.isGuruNgaji ? `Rp ${selectedGuruDetail.honorGuruNgaji.toLocaleString('id-ID')}` : '-'}
                  </h4>
                  <p className="text-[10px] text-teal-700 font-semibold">
                    {selectedGuruDetail.isGuruNgaji ? 'Tetap / Tanpa Potongan' : 'Bukan Guru Ngaji'}
                  </p>
                </div>
                <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100">
                  <p className="text-[10px] uppercase font-bold text-purple-600">Apresiasi Kinerja</p>
                  <h4 className="text-lg font-black text-purple-900 mt-0.5">Rp {selectedGuruDetail.apresiasiKinerja.toLocaleString('id-ID')}</h4>
                  <p className="text-[10px] text-purple-700 truncate">{selectedGuruDetail.keteranganApresiasi || 'Reward Khusus'}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] uppercase font-bold text-emerald-600">Total Honor</p>
                  <h4 className="text-lg font-black text-emerald-900 mt-0.5">Rp {selectedGuruDetail.totalHonorBersih.toLocaleString('id-ID')}</h4>
                  <p className="text-[10px] text-emerald-700">Bersih Diterima</p>
                </div>
              </div>

              {/* Log Kehadiran */}
              <div>
                <h4 className="font-bold text-xs uppercase text-gray-500 mb-2 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-blue-600" /> Log Kehadiran Sekolah
                </h4>
                <div className="bg-gray-50 rounded-2xl p-3 max-h-48 overflow-y-auto border border-gray-100">
                  {selectedGuruDetail.myPresensi?.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">Belum ada catatan kehadiran bulan ini.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedGuruDetail.myPresensi?.map((p, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-gray-100 text-xs">
                          <div>
                            <span className="font-bold text-gray-800">{p.tanggal}</span>
                            <span className="text-gray-400 ml-2">({p.waktu_datang || '--:--'} s/d {p.waktu_pulang || '--:--'})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.terlambat_menit > 0 && <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Telat {p.terlambat_menit}m</span>}
                            {p.pulang_cepat_menit > 0 && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Cepat {p.pulang_cepat_menit}m</span>}
                            <span className="font-mono font-bold text-emerald-700">Rp {(Number(p.honor_kehadiran) || 0).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Log Mengajar KBM */}
              <div>
                <h4 className="font-bold text-xs uppercase text-gray-500 mb-2 flex items-center gap-1.5">
                  <Clock size={14} className="text-indigo-600" /> Log Jam Mengajar (KBM)
                </h4>
                <div className="bg-gray-50 rounded-2xl p-3 max-h-48 overflow-y-auto border border-gray-100">
                  {selectedGuruDetail.myKbm?.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">Belum ada catatan jam mengajar bulan ini.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedGuruDetail.myKbm?.map((k, i) => (
                        <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-gray-100 text-xs">
                          <div>
                            <span className="font-bold text-gray-800">{k.tanggal}</span>
                            <span className="text-indigo-600 font-semibold ml-2">Jam Ke: {k.jam_ke || '1'}</span>
                            {k.is_pengganti && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-bold">Inval</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-mono">{k.waktu_masuk} - {k.waktu_keluar || '...'}</span>
                            <span className="font-mono font-bold text-indigo-700">Rp {((Number(k.jumlah_jp) || 1) * 6500).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-xs text-gray-700 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Slip Gaji Guru (Printable Single Slip) */}
      {slipModalOpen && selectedGuruDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:bg-white print:p-0">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 print:border-none print:shadow-none">
            <div className="print:hidden p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm">Pratinjau Slip Honorarium Guru</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"
                >
                  <Printer size={14} /> Cetak Slip
                </button>
                <button onClick={() => setSlipModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Slip Paper Format */}
            <div className="p-6 text-xs text-gray-800 space-y-4">
              {/* Slip Header */}
              <div className="border-b-2 border-gray-800 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-12 shrink-0 flex items-center justify-center">
                    {dataLembaga?.logo_url ? (
                      <img 
                        src={dataLembaga.logo_url} 
                        alt="Logo" 
                        className="w-10 h-10 object-contain" 
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10" />
                    )}
                  </div>
                  <div className="flex-1 text-center">
                    <h4 className="text-[10px] font-bold text-gray-700 uppercase leading-tight">
                      {dataLembaga?.nama_yayasan || 'YAYASAN HIDAYATUL MUBTADI-IEN'}
                    </h4>
                    <h3 className="font-black text-sm uppercase tracking-wider text-gray-900 leading-tight mt-0.5">
                      {dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}
                    </h3>
                    <p className="text-[9px] text-gray-500 leading-tight mt-0.5">
                      {dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}
                    </p>
                  </div>
                  <div className="w-12 shrink-0" style={{ visibility: 'hidden' }} />
                </div>
                <div className="text-center mt-2">
                  <div className="inline-block bg-gray-800 text-white text-[10px] font-black uppercase px-3 py-0.5 rounded-full">
                    SLIP HONORARIUM GURU
                  </div>
                </div>
              </div>

              {/* Info Pegawai */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <p className="text-gray-400">Nama Guru:</p>
                  <p className="font-bold text-gray-900">{selectedGuruDetail.nama}</p>
                </div>
                <div>
                  <p className="text-gray-400">Jabatan:</p>
                  <p className="font-bold text-gray-900">
                    {selectedGuruDetail.namaJabatanUtama} {selectedGuruDetail.isGuruNgaji ? '(Guru Ngaji)' : ''}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">NIP / NIK:</p>
                  <p className="font-medium text-gray-700">{selectedGuruDetail.nip || selectedGuruDetail.nik || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Periode:</p>
                  <p className="font-bold text-emerald-700">{bulanNames[selectedBulan - 1]} {selectedTahun}</p>
                </div>
              </div>

              {/* Rincian Komponen Honor */}
              <div className="space-y-2 border-t border-b border-dashed border-gray-300 py-3">
                <div className="flex justify-between items-center">
                  <span>1. Honor Kehadiran ({selectedGuruDetail.totalHariHadir} hari)</span>
                  <span className="font-mono font-bold">Rp {selectedGuruDetail.totalHonorKehadiran.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>2. Honor Mengajar KBM ({selectedGuruDetail.totalJp} JP)</span>
                  <span className="font-mono font-bold">Rp {selectedGuruDetail.totalHonorKbm.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>3. Tunjangan Jabatan</span>
                  <span className="font-mono font-bold">Rp {selectedGuruDetail.tunjanganJabatan.toLocaleString('id-ID')}</span>
                </div>
                {selectedGuruDetail.isGuruNgaji && (
                  <div className="flex justify-between items-center text-teal-800">
                    <span>4. Honor Guru Ngaji <em className="text-[10px] text-teal-600 font-normal">(Tetap, tanpa potongan)</em></span>
                    <span className="font-mono font-bold">Rp {selectedGuruDetail.honorGuruNgaji.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {selectedGuruDetail.apresiasiKinerja > 0 && (
                  <div className="flex justify-between items-center text-emerald-800">
                    <span>
                      {selectedGuruDetail.isGuruNgaji ? '5' : '4'}. Apresiasi Kinerja {selectedGuruDetail.keteranganApresiasi ? `(${selectedGuruDetail.keteranganApresiasi})` : ''}
                    </span>
                    <span className="font-mono font-bold">Rp {selectedGuruDetail.apresiasiKinerja.toLocaleString('id-ID')}</span>
                  </div>
                )}
              </div>

              {/* Total Diterima */}
              <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <span className="font-black text-emerald-900 uppercase">Total Honor Diterima:</span>
                <span className="font-mono font-black text-base text-emerald-800">
                  Rp {selectedGuruDetail.totalHonorBersih.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Signature Area */}
              <div className="grid grid-cols-2 gap-4 pt-4 text-center text-[10px]">
                <div>
                  <p className="text-gray-500">Penerima,</p>
                  <div className="h-12"></div>
                  <p className="font-bold underline">{selectedGuruDetail.nama}</p>
                </div>
                <div>
                  <p className="text-gray-500">Bendahara Sekolah,</p>
                  <div className="h-12"></div>
                  <p className="font-bold underline">____________________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Semua Slip Gaji Guru */}
      {allSlipsModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm print:bg-white print:static print:inset-auto">
          <div className="print:hidden p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-md">
            <div>
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <Printer className="text-indigo-600" size={18} />
                Pratinjau Cetak Semua Slip Honor ({filteredGuru.length} Guru)
              </h3>
              <p className="text-xs text-gray-500">
                Periode: {bulanNames[selectedBulan - 1]} {selectedTahun} • Setiap slip otomatis dicetak per halaman (A5)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition"
              >
                <Printer size={16} /> Cetak Semua Sekarang
              </button>
              <button
                onClick={() => setAllSlipsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-100 print:bg-white print:p-0">
            <div className="max-w-xl mx-auto space-y-8 print:max-w-none print:space-y-0">
              {filteredGuru.map((guru) => {
                const calc = calculateTeacherHonor(guru.id);
                return (
                  <div
                    key={guru.id}
                    className="bg-white rounded-3xl p-6 text-xs text-gray-800 space-y-4 shadow-sm border border-gray-200 print:border-none print:shadow-none print:rounded-none print:p-8 print:break-after-page print:page-break-after-always"
                  >
                    {/* Slip Header */}
                    <div className="border-b-2 border-gray-800 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="w-12 shrink-0 flex items-center justify-center">
                          {dataLembaga?.logo_url ? (
                            <img 
                              src={dataLembaga.logo_url} 
                              alt="Logo" 
                              className="w-10 h-10 object-contain" 
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-10 h-10" />
                          )}
                        </div>
                        <div className="flex-1 text-center">
                          <h4 className="text-[10px] font-bold text-gray-700 uppercase leading-tight">
                            {dataLembaga?.nama_yayasan || 'YAYASAN HIDAYATUL MUBTADI-IEN'}
                          </h4>
                          <h3 className="font-black text-sm uppercase tracking-wider text-gray-900 leading-tight mt-0.5">
                            {dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}
                          </h3>
                          <p className="text-[9px] text-gray-500 leading-tight mt-0.5">
                            {dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}
                          </p>
                        </div>
                        <div className="w-12 shrink-0" style={{ visibility: 'hidden' }} />
                      </div>
                      <div className="text-center mt-2">
                        <div className="inline-block bg-gray-800 text-white text-[10px] font-black uppercase px-3 py-0.5 rounded-full">
                          SLIP HONORARIUM GURU
                        </div>
                      </div>
                    </div>

                    {/* Info Pegawai */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-gray-400">Nama Guru:</p>
                        <p className="font-bold text-gray-900">{guru.nama}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Jabatan:</p>
                        <p className="font-bold text-gray-900">
                          {calc.namaJabatanUtama} {calc.isGuruNgaji ? '(Guru Ngaji)' : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">NIP / NIK:</p>
                        <p className="font-medium text-gray-700">{guru.nip || guru.nik || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Periode:</p>
                        <p className="font-bold text-emerald-700">{bulanNames[selectedBulan - 1]} {selectedTahun}</p>
                      </div>
                    </div>

                    {/* Rincian Komponen Honor */}
                    <div className="space-y-2 border-t border-b border-dashed border-gray-300 py-3">
                      <div className="flex justify-between items-center">
                        <span>1. Honor Kehadiran ({calc.totalHariHadir} hari)</span>
                        <span className="font-mono font-bold">Rp {calc.totalHonorKehadiran.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>2. Honor Mengajar KBM ({calc.totalJp} JP)</span>
                        <span className="font-mono font-bold">Rp {calc.totalHonorKbm.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>3. Tunjangan Jabatan</span>
                        <span className="font-mono font-bold">Rp {calc.tunjanganJabatan.toLocaleString('id-ID')}</span>
                      </div>
                      {calc.isGuruNgaji && (
                        <div className="flex justify-between items-center text-teal-800">
                          <span>4. Honor Guru Ngaji <em className="text-[10px] text-teal-600 font-normal">(Tetap, tanpa potongan)</em></span>
                          <span className="font-mono font-bold">Rp {calc.honorGuruNgaji.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {calc.apresiasiKinerja > 0 && (
                        <div className="flex justify-between items-center text-emerald-800">
                          <span>
                            {calc.isGuruNgaji ? '5' : '4'}. Apresiasi Kinerja {calc.keteranganApresiasi ? `(${calc.keteranganApresiasi})` : ''}
                          </span>
                          <span className="font-mono font-bold">Rp {calc.apresiasiKinerja.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    {/* Total Diterima */}
                    <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                      <span className="font-black text-emerald-900 uppercase">Total Honor Diterima:</span>
                      <span className="font-mono font-black text-base text-emerald-800">
                        Rp {calc.totalHonorBersih.toLocaleString('id-ID')}
                      </span>
                    </div>

                    {/* Signature Area */}
                    <div className="grid grid-cols-2 gap-4 pt-4 text-center text-[10px]">
                      <div>
                        <p className="text-gray-500">Penerima,</p>
                        <div className="h-12"></div>
                        <p className="font-bold underline">{guru.nama}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Bendahara Sekolah,</p>
                        <div className="h-12"></div>
                        <p className="font-bold underline">____________________</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
