import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  CalendarDays, 
  Plus, 
  RefreshCw, 
  Printer, 
  Edit, 
  Trash2, 
  Clock, 
  MapPin, 
  User, 
  BookOpen, 
  Filter, 
  LayoutGrid, 
  ListFilter, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  ArrowUpDown 
} from 'lucide-react';
import Swal from 'sweetalert2';
import { getOperationalDayName } from '../utils/dateUtils';

// Helper menghitung menit mulai dari 00:00 untuk pengurutan kronologis yang akurat
const getTimeInMinutes = (item) => {
  if (item?.master_jam?.waktu_mulai) {
    const parts = item.master_jam.waktu_mulai.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  if (item?.waktu) {
    const startTimeStr = item.waktu.split('-')[0]?.trim();
    if (startTimeStr) {
      const parts = startTimeStr.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
    }
  }
  return (item?.master_jam?.urutan || parseInt(item?.jam_ke) || 999) * 60;
};

export default function JadwalGuru() {
  const [dataJadwal, setDataJadwal] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Operational day initialization
  const getHariIni = () => {
    const today = getOperationalDayName();
    return today === 'Minggu' ? 'Senin' : today;
  };
  const hariIniOperasional = getHariIni();
  const hariList = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Filters, Sorting & Tabs
  const [activeHari, setActiveHari] = useState(hariIniOperasional);
  const [selectedFilterGuru, setSelectedFilterGuru] = useState('');
  const [selectedFilterKelas, setSelectedFilterKelas] = useState('');
  const [sortBy, setSortBy] = useState('jam'); // 'jam' | 'kelas' | 'mapel'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // User & Permission State
  const [currentUser, setCurrentUser] = useState(null);
  const [hasCrudAccess, setHasCrudAccess] = useState(false);

  // References
  const [refKelas, setRefKelas] = useState([]);
  const [refMapel, setRefMapel] = useState([]);
  const [refGuru, setRefGuru] = useState([]);
  const [refPembelajaran, setRefPembelajaran] = useState([]);
  const [refMasterJam, setRefMasterJam] = useState([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    hari: 'Senin',
    master_jam_id: '',
    kelas_id: '',
    mapel_id: '',
    guru_id: '',
    is_istirahat: false
  });
  const [autoFilledGuru, setAutoFilledGuru] = useState(false);

  // Fetch Reference Data
  const fetchReferenceData = async () => {
    try {
      const [resKelas, resMapel, resGuru, resPembelajaran, resMasterJam] = await Promise.all([
        supabase.from('data_kelas').select('id, nama_kelas, ruang_id, data_ruang(nama_ruang)').order('nama_kelas'),
        supabase.from('data_mapel').select('id, nama_mapel').order('urutan', { ascending: true }),
        supabase.from('data_guru').select('id, nama').is('tanggal_keluar', null).order('nama'),
        supabase.from('pembelajaran').select('kelas_id, mapel_id, guru_id'),
        supabase.from('master_jam').select('*').order('urutan', { ascending: true })
      ]);
      if (resKelas.data) setRefKelas(resKelas.data);
      if (resMapel.data) setRefMapel(resMapel.data);
      if (resGuru.data) setRefGuru(resGuru.data);
      if (resPembelajaran.data) setRefPembelajaran(resPembelajaran.data);
      if (resMasterJam.data) setRefMasterJam(resMasterJam.data);
    } catch (err) {
      console.error('Gagal mengambil referensi:', err);
    }
  };

  // Fetch Schedules
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('jadwal_pelajaran')
        .select('*, data_kelas(nama_kelas, data_ruang(nama_ruang)), data_mapel(nama_mapel), data_guru(nama), master_jam(urutan, nama_jam, waktu_mulai, waktu_selesai, is_istirahat)')
        .order('hari', { ascending: true });

      if (error) throw error;

      const hariUrutan = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
      const sortedData = (data || []).sort((a, b) => {
        const hDiff = (hariUrutan[a.hari] || 99) - (hariUrutan[b.hari] || 99);
        if (hDiff !== 0) return hDiff;

        // 1. Sort kronologis berdasarkan waktu mulai
        const timeDiff = getTimeInMinutes(a) - getTimeInMinutes(b);
        if (timeDiff !== 0) return timeDiff;

        // 2. Sort nomor urutan master_jam
        const urutA = a.master_jam?.urutan || parseInt(a.jam_ke) || 999;
        const urutB = b.master_jam?.urutan || parseInt(b.jam_ke) || 999;
        if (urutA !== urutB) return urutA - urutB;

        // 3. Ruang sort
        const ruangA = a.data_kelas?.data_ruang?.nama_ruang || a.data_kelas?.nama_kelas || 'Z';
        const ruangB = b.data_kelas?.data_ruang?.nama_ruang || b.data_kelas?.nama_kelas || 'Z';
        return ruangA.localeCompare(ruangB, undefined, { numeric: true, sensitivity: 'base' });
      });

      setDataJadwal(sortedData);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data jadwal pelajaran.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Check Role & Permissions on mount
  useEffect(() => {
    const checkRoleAndInit = async () => {
      try {
        const storedUser = localStorage.getItem('user_guru');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setCurrentUser(userData);

          if (userData && userData.id) {
            const { data } = await supabase
              .from('jabatan_guru')
              .select('*')
              .eq('guru_id', userData.id)
              .maybeSingle();

            const roles = data ? [data.jabatan_utama, data.jabatan_lain_1, data.jabatan_lain_2, data.jabatan_lain_3].filter(Boolean) : [];
            
            // Only Operator Sekolah, Kepala Sekolah, Waka Kurikulum, or Admin can perform CRUD
            const canManage = userData.role === 'admin' || roles.some(r => {
              const lower = (r || '').toLowerCase();
              return lower.includes('operator') || lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('admin') || lower.includes('kurikulum');
            });

            setHasCrudAccess(canManage);

            if (canManage) {
              setSelectedFilterGuru(''); // All teachers by default for authorized managers
            } else {
              setSelectedFilterGuru(userData.id.toString()); // Locked to self for regular teachers
            }
          }
        }
      } catch (e) {
        console.error('Error verifying user role:', e);
      }
    };

    checkRoleAndInit();
    fetchReferenceData();
    fetchData();
  }, []);

  // Filtered and sorted schedules computation
  const filteredJadwal = useMemo(() => {
    const list = dataJadwal.filter(item => {
      // Filter by Hari (unless 'Semua Hari')
      if (activeHari !== 'Semua Hari' && item.hari !== activeHari) return false;

      // Filter by Guru (Istirahat always visible unless filtered by specific guru that wouldn't teach it)
      if (selectedFilterGuru) {
        if (!item.is_istirahat && item.guru_id?.toString() !== selectedFilterGuru.toString()) {
          return false;
        }
      }

      // Filter by Kelas
      if (selectedFilterKelas) {
        if (!item.is_istirahat && item.kelas_id?.toString() !== selectedFilterKelas.toString()) {
          return false;
        }
      }

      return true;
    });

    const hariUrutan = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };

    list.sort((a, b) => {
      // If 'Semua Hari', always sort by hari first
      if (activeHari === 'Semua Hari') {
        const hDiff = (hariUrutan[a.hari] || 99) - (hariUrutan[b.hari] || 99);
        if (hDiff !== 0) return hDiff;
      }

      if (sortBy === 'kelas') {
        // Istirahat placed at the end or together
        if (a.is_istirahat && !b.is_istirahat) return 1;
        if (!a.is_istirahat && b.is_istirahat) return -1;
        const kA = a.data_kelas?.nama_kelas || '';
        const kB = b.data_kelas?.nama_kelas || '';
        const kDiff = kA.localeCompare(kB, undefined, { numeric: true, sensitivity: 'base' });
        if (kDiff !== 0) return kDiff;

        // Secondary sort by waktu mulai
        const timeDiff = getTimeInMinutes(a) - getTimeInMinutes(b);
        if (timeDiff !== 0) return timeDiff;

        const urutA = a.master_jam?.urutan || parseInt(a.jam_ke) || 999;
        const urutB = b.master_jam?.urutan || parseInt(b.jam_ke) || 999;
        return urutA - urutB;
      }

      if (sortBy === 'mapel') {
        if (a.is_istirahat && !b.is_istirahat) return 1;
        if (!a.is_istirahat && b.is_istirahat) return -1;
        const mA = a.data_mapel?.nama_mapel || '';
        const mB = b.data_mapel?.nama_mapel || '';
        const mDiff = mA.localeCompare(mB, undefined, { numeric: true, sensitivity: 'base' });
        if (mDiff !== 0) return mDiff;

        // Secondary sort by waktu mulai
        const timeDiff = getTimeInMinutes(a) - getTimeInMinutes(b);
        if (timeDiff !== 0) return timeDiff;

        const urutA = a.master_jam?.urutan || parseInt(a.jam_ke) || 999;
        const urutB = b.master_jam?.urutan || parseInt(b.jam_ke) || 999;
        return urutA - urutB;
      }

      // Default: sortBy === 'jam' (Urutkan secara kronologis berdasarkan waktu mulai)
      const timeDiff = getTimeInMinutes(a) - getTimeInMinutes(b);
      if (timeDiff !== 0) return timeDiff;

      // Secondary sort: urutan master_jam
      const urutA = a.master_jam?.urutan || parseInt(a.jam_ke) || 999;
      const urutB = b.master_jam?.urutan || parseInt(b.jam_ke) || 999;
      if (urutA !== urutB) return urutA - urutB;

      // Tertiary sort by kelas
      const kA = a.data_kelas?.nama_kelas || '';
      const kB = b.data_kelas?.nama_kelas || '';
      return kA.localeCompare(kB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return list;
  }, [dataJadwal, activeHari, selectedFilterGuru, selectedFilterKelas, sortBy]);

  // Counts per day for badges
  const dayCounts = useMemo(() => {
    const counts = {};
    hariList.forEach(h => {
      counts[h] = dataJadwal.filter(j => {
        if (j.hari !== h) return false;
        if (selectedFilterGuru && !j.is_istirahat && j.guru_id?.toString() !== selectedFilterGuru.toString()) return false;
        if (selectedFilterKelas && !j.is_istirahat && j.kelas_id?.toString() !== selectedFilterKelas.toString()) return false;
        return true;
      }).length;
    });
    return counts;
  }, [dataJadwal, selectedFilterGuru, selectedFilterKelas]);

  // Open Form Modal for Create
  const handleOpenAdd = () => {
    if (!hasCrudAccess) {
      Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Hanya Operator Sekolah, Kepala Sekolah, dan Waka Kurikulum yang dapat menambah jadwal.'
      });
      return;
    }

    setFormData({
      id: null,
      hari: activeHari !== 'Semua Hari' ? activeHari : 'Senin',
      master_jam_id: '',
      kelas_id: '',
      mapel_id: '',
      guru_id: '',
      is_istirahat: false
    });
    setAutoFilledGuru(false);
    setIsEditing(false);
    setModalOpen(true);
  };

  // Open Form Modal for Edit
  const handleOpenEdit = (item) => {
    if (!hasCrudAccess) {
      Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Hanya Operator Sekolah, Kepala Sekolah, dan Waka Kurikulum yang dapat mengubah jadwal.'
      });
      return;
    }

    setFormData({
      id: item.id,
      hari: item.hari,
      master_jam_id: item.master_jam_id || '',
      kelas_id: item.kelas_id ? item.kelas_id.toString() : '',
      mapel_id: item.mapel_id ? item.mapel_id.toString() : '',
      guru_id: item.guru_id ? item.guru_id.toString() : '',
      is_istirahat: item.is_istirahat || false
    });
    setAutoFilledGuru(false);
    setIsEditing(true);
    setModalOpen(true);
  };

  // Auto-fill guru from pembelajaran mapping
  const handleKelasOrMapelChange = (field, value) => {
    const nextKelasId = field === 'kelas_id' ? value : formData.kelas_id;
    const nextMapelId = field === 'mapel_id' ? value : formData.mapel_id;

    let updatedGuruId = formData.guru_id;
    let autoSelected = false;

    if (nextKelasId && nextMapelId) {
      const matchPembel = refPembelajaran.find(
        p => p.kelas_id?.toString() === nextKelasId.toString() && p.mapel_id?.toString() === nextMapelId.toString()
      );
      if (matchPembel && matchPembel.guru_id) {
        updatedGuruId = matchPembel.guru_id.toString();
        autoSelected = true;
      }
    }

    setFormData(prev => ({
      ...prev,
      [field]: value,
      guru_id: updatedGuruId
    }));
    setAutoFilledGuru(autoSelected);
  };

  // Handle master_jam change (detect is_istirahat)
  const handleMasterJamChange = (jamId) => {
    const selectedJam = refMasterJam.find(j => j.id === jamId);
    const isIstirahat = selectedJam?.is_istirahat || false;
    setFormData(prev => ({
      ...prev,
      master_jam_id: jamId,
      is_istirahat: isIstirahat,
      ...(isIstirahat ? { kelas_id: '', mapel_id: '', guru_id: '' } : {})
    }));
  };

  // Save Schedule (Create / Update) - Selaras dengan Logika Mobile App
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!hasCrudAccess) return;

    if (!formData.master_jam_id) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Jam Pelajaran wajib dipilih!' });
      return;
    }

    const selectedJam = refMasterJam.find(j => j.id === formData.master_jam_id);
    if (!selectedJam) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Data Jam Pelajaran tidak valid.' });
      return;
    }

    const isIstirahat = selectedJam?.is_istirahat || formData.is_istirahat || false;

    if (!isIstirahat) {
      if (!formData.kelas_id || !formData.mapel_id || !formData.guru_id) {
        Swal.fire({ 
          icon: 'warning', 
          title: 'Data Belum Lengkap', 
          text: 'Kelas, Mata Pelajaran, dan Guru wajib diisi untuk jam pelajaran.' 
        });
        return;
      }
    }

    const payload = {
      hari: formData.hari,
      master_jam_id: formData.master_jam_id,
      jam_ke: selectedJam?.nama_jam || '',
      waktu: `${(selectedJam?.waktu_mulai || '').substring(0, 5)} - ${(selectedJam?.waktu_selesai || '').substring(0, 5)}`,
      kelas_id: isIstirahat ? null : (formData.kelas_id ? parseInt(formData.kelas_id) : null),
      mapel_id: isIstirahat ? null : (formData.mapel_id ? parseInt(formData.mapel_id) : null),
      guru_id: isIstirahat ? null : (formData.guru_id ? parseInt(formData.guru_id) : null),
      is_istirahat: isIstirahat
    };

    setFormSaving(true);
    try {
      if (formData.id) {
        const { error } = await supabase.from('jadwal_pelajaran').update(payload).eq('id', formData.id);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jadwal pelajaran berhasil diperbarui.', timer: 1500, showConfirmButton: false });
      } else {
        const { error } = await supabase.from('jadwal_pelajaran').insert([payload]);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jadwal pelajaran baru berhasil ditambahkan.', timer: 1500, showConfirmButton: false });
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Schedule
  const handleDelete = (id) => {
    if (!hasCrudAccess) {
      Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Hanya Operator Sekolah, Kepala Sekolah, dan Waka Kurikulum yang dapat menghapus jadwal.'
      });
      return;
    }

    Swal.fire({
      title: 'Hapus Jadwal?',
      text: 'Data jadwal pelajaran ini akan dihapus secara permanen!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase.from('jadwal_pelajaran').delete().eq('id', id);
          if (error) throw error;
          Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Jadwal telah dihapus.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal menghapus jadwal.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-schedule, #printable-schedule * {
            visibility: visible;
          }
          #printable-schedule {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-bl-full -z-0 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <CalendarDays size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">Jadwal Mengajar Guru</h2>
              <p className="text-gray-500 text-xs md:text-sm">
                Kelola jadwal pelajaran mingguan, plotting guru pengampu, dan ruang kelas.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 w-full md:w-auto">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'cards' 
                  ? 'bg-white text-primary shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Tampilan Kartu (Responsif)"
            >
              <LayoutGrid size={14} /> Kartu
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'table' 
                  ? 'bg-white text-primary shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Tampilan Tabel"
            >
              <ListFilter size={14} /> Tabel
            </button>
          </div>

          <button
            onClick={fetchData}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-primary" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handlePrint}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            title="Cetak Jadwal"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Cetak</span>
          </button>

          {hasCrudAccess && (
            <button
              onClick={handleOpenAdd}
              className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition flex items-center gap-1.5 ml-auto md:ml-0"
            >
              <Plus size={16} /> Tambah Jadwal
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Filter Guru */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium w-full sm:w-auto">
            <User size={14} className="text-gray-400 shrink-0" />
            <span className="text-gray-500 font-semibold uppercase shrink-0">Guru:</span>
            {hasCrudAccess ? (
              <select
                value={selectedFilterGuru}
                onChange={(e) => setSelectedFilterGuru(e.target.value)}
                className="bg-transparent font-semibold text-gray-800 outline-none w-full sm:w-auto cursor-pointer"
              >
                <option value="">Semua Guru (Tampilkan Semua)</option>
                {refGuru.map(g => (
                  <option key={g.id} value={g.id}>{g.nama}</option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-primary truncate max-w-[200px]">
                {currentUser?.nama || 'Saya'}
              </span>
            )}
          </div>

          {/* Filter Kelas */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium w-full sm:w-auto">
            <BookOpen size={14} className="text-gray-400 shrink-0" />
            <span className="text-gray-500 font-semibold uppercase shrink-0">Kelas:</span>
            <select
              value={selectedFilterKelas}
              onChange={(e) => setSelectedFilterKelas(e.target.value)}
              className="bg-transparent font-semibold text-gray-800 outline-none w-full sm:w-auto cursor-pointer"
            >
              <option value="">Semua Kelas</option>
              {refKelas.map(k => (
                <option key={k.id} value={k.id}>{k.nama_kelas}</option>
              ))}
            </select>
          </div>

          {/* Filter Urutan */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium w-full sm:w-auto">
            <ArrowUpDown size={14} className="text-gray-400 shrink-0" />
            <span className="text-gray-500 font-semibold uppercase shrink-0">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent font-semibold text-gray-800 outline-none w-full sm:w-auto cursor-pointer"
            >
              <option value="jam">Berdasarkan Jam</option>
              <option value="kelas">Berdasarkan Kelas</option>
              <option value="mapel">Berdasarkan Mata Pelajaran</option>
            </select>
          </div>

          {(selectedFilterGuru || selectedFilterKelas || sortBy !== 'jam') && (
            <button
              onClick={() => {
                if (hasCrudAccess) setSelectedFilterGuru('');
                setSelectedFilterKelas('');
                setSortBy('jam');
              }}
              className="text-xs text-gray-400 hover:text-red-500 font-semibold transition underline"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Quick Info / Permission Pill */}
        <div className="flex items-center gap-2 shrink-0">
          {hasCrudAccess ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles size={12} /> Akses Kelola Jadwal
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
              Mode Lihat (Read-Only)
            </span>
          )}
        </div>
      </div>

      {/* Day Tabs (Senin - Sabtu & Semua Hari) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          {hariList.map((hari) => {
            const isActive = activeHari === hari;
            const isToday = hari === hariIniOperasional;
            const count = dayCounts[hari] || 0;

            return (
              <button
                key={hari}
                onClick={() => setActiveHari(hari)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition relative ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-transparent text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{hari}</span>
                {isToday && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isActive ? 'bg-accent text-primary' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Hari Ini
                  </span>
                )}
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* Tab Semua Hari */}
          <button
            onClick={() => setActiveHari('Semua Hari')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition ${
              activeHari === 'Semua Hari'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-transparent text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>Semua Hari</span>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeHari === 'Semua Hari' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {dataJadwal.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Schedule Display (Cards or Table) */}
      <div id="printable-schedule">
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
            <RefreshCw size={32} className="animate-spin text-primary mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">Memuat jadwal pelajaran...</p>
          </div>
        ) : filteredJadwal.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <CalendarDays size={32} />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">
              Tidak ada jadwal {activeHari !== 'Semua Hari' ? `pada hari ${activeHari}` : ''}
            </h3>
            <p className="text-gray-400 text-xs max-w-md mx-auto mb-5">
              {selectedFilterGuru || selectedFilterKelas 
                ? 'Tidak ada jadwal yang cocok dengan kriteria filter yang dipilih.'
                : 'Belum ada agenda jadwal mengajar yang terdaftar.'}
            </p>
            {hasCrudAccess && (
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 bg-primary hover:bg-blue-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm"
              >
                <Plus size={14} /> Tambah Jadwal Sekarang
              </button>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          /* Card Grid View (Responsive like Mobile App) */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredJadwal.map((item) => {
              const isIstirahat = item.is_istirahat;

              return (
                <div
                  key={item.id}
                  className={`relative rounded-2xl p-5 border transition duration-200 flex flex-col justify-between ${
                    isIstirahat 
                      ? 'bg-amber-50/60 border-amber-200 shadow-sm' 
                      : 'bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {activeHari === 'Semua Hari' && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-700">
                            {item.hari}
                          </span>
                        )}
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isIstirahat ? 'bg-amber-200 text-amber-900' : 'bg-primary/10 text-primary'
                        }`}>
                          Jam ke-{item.jam_ke}
                        </span>
                        <div className="flex items-center gap-1 text-gray-500 text-xs font-medium">
                          <Clock size={12} className="text-gray-400" />
                          <span>{item.master_jam?.waktu_mulai ? `${item.master_jam.waktu_mulai.substring(0, 5)} - ${item.master_jam.waktu_selesai?.substring(0, 5)}` : (item.waktu || '-')}</span>
                        </div>
                      </div>

                      {/* Action buttons (CRUD only for authorized roles) */}
                      {hasCrudAccess && (
                        <div className="flex items-center gap-1 shrink-0 no-print">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition"
                            title="Edit Jadwal"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Hapus Jadwal"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Body */}
                    {isIstirahat ? (
                      <div className="py-3 text-center">
                        <span className="text-amber-700 font-extrabold text-sm uppercase tracking-wider bg-amber-100 px-3 py-1 rounded-full">
                          ☕ ISTIRAHAT
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        <h4 className="font-bold text-gray-800 text-base leading-snug">
                          {item.data_mapel?.nama_mapel || 'Mata Pelajaran Tidak Diketahui'}
                        </h4>

                        {/* Guru Pengampu */}
                        <div className="flex items-center gap-2 text-gray-600 text-xs font-semibold">
                          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                            <User size={12} />
                          </div>
                          <span className="truncate">{item.data_guru?.nama || '-'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer (Class & Room Badges) */}
                  {!isIstirahat && (
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg text-xs border border-indigo-100">
                          {item.data_kelas?.nama_kelas || '-'}
                        </span>
                        <div className="flex items-center gap-1 text-gray-500 text-xs font-medium">
                          <MapPin size={12} className="text-gray-400" />
                          <span>{item.data_kelas?.data_ruang?.nama_ruang || '-'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-4">Hari & Jam</th>
                    <th className="px-5 py-4">Kelas</th>
                    <th className="px-5 py-4">Mata Pelajaran</th>
                    <th className="px-5 py-4">Guru Pengampu</th>
                    <th className="px-5 py-4">Ruang</th>
                    {hasCrudAccess && <th className="px-5 py-4 text-center no-print">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs md:text-sm">
                  {filteredJadwal.map((item, idx) => {
                    const isIstirahat = item.is_istirahat;

                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-gray-50 transition ${isIstirahat ? 'bg-amber-50/50' : ''}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-gray-800 flex items-center gap-2">
                            <span>{item.hari}</span>
                            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                              Jam ke-{item.jam_ke}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock size={11} /> {item.master_jam?.waktu_mulai ? `${item.master_jam.waktu_mulai.substring(0, 5)} - ${item.master_jam.waktu_selesai?.substring(0, 5)}` : (item.waktu || '-')}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {isIstirahat ? (
                            <span className="text-amber-600 font-bold italic">ISTIRAHAT</span>
                          ) : (
                            <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded text-xs">
                              {item.data_kelas?.nama_kelas || '-'}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 font-bold text-gray-800">
                          {isIstirahat ? '-' : (item.data_mapel?.nama_mapel || '-')}
                        </td>

                        <td className="px-5 py-3.5 text-gray-600 font-medium">
                          {isIstirahat ? '-' : (item.data_guru?.nama || '-')}
                        </td>

                        <td className="px-5 py-3.5 text-gray-500">
                          {isIstirahat ? '-' : (item.data_kelas?.data_ruang?.nama_ruang || '-')}
                        </td>

                        {hasCrudAccess && (
                          <td className="px-5 py-3.5 text-center no-print">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Edit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Hapus"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Jadwal (React Modal) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {isEditing ? 'Edit Jadwal Mengajar' : 'Tambah Jadwal Mengajar'}
                </h3>
                <p className="text-xs text-gray-500">
                  {isEditing ? 'Perbarui informasi jadwal pelajaran' : 'Tambahkan slot jadwal mengajar baru'}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSchedule} className="space-y-4">
              {/* Pilihan Hari */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Hari</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {hariList.map(h => (
                    <button
                      type="button"
                      key={h}
                      onClick={() => setFormData({ ...formData, hari: h })}
                      className={`py-2 text-xs font-bold rounded-xl transition ${
                        formData.hari === h
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Jam */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Pilih Jam Pelajaran
                </label>
                <select
                  value={formData.master_jam_id}
                  onChange={(e) => handleMasterJamChange(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-primary focus:bg-white transition"
                >
                  <option value="">-- Pilih Jam Pelajaran --</option>
                  {refMasterJam.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.nama_jam} ({j.waktu_mulai?.substring(0, 5)} - {j.waktu_selesai?.substring(0, 5)}) {j.is_istirahat ? '☕ [Istirahat]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notice jika jam istirahat */}
              {formData.is_istirahat ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-2.5 text-amber-800 text-xs font-medium">
                  <AlertCircle size={18} className="text-amber-600 shrink-0" />
                  <span>Slot ini diatur sebagai <strong>Jam Istirahat</strong>. Kelas, Mapel, dan Guru tidak perlu diisi.</span>
                </div>
              ) : (
                <>
                  {/* Kelas */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Kelas</label>
                    <select
                      value={formData.kelas_id}
                      onChange={(e) => handleKelasOrMapelChange('kelas_id', e.target.value)}
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-primary focus:bg-white transition"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {refKelas.map(k => (
                        <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mata Pelajaran */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Mata Pelajaran</label>
                    <select
                      value={formData.mapel_id}
                      onChange={(e) => handleKelasOrMapelChange('mapel_id', e.target.value)}
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-primary focus:bg-white transition"
                    >
                      <option value="">-- Pilih Mata Pelajaran --</option>
                      {refMapel.map(m => (
                        <option key={m.id} value={m.id}>{m.nama_mapel}</option>
                      ))}
                    </select>
                  </div>

                  {/* Guru Pengampu */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-600 uppercase">Guru Pengampu</label>
                      {autoFilledGuru && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Otomatis dari Pembelajaran
                        </span>
                      )}
                    </div>
                    <select
                      value={formData.guru_id}
                      onChange={(e) => {
                        setFormData({ ...formData, guru_id: e.target.value });
                        setAutoFilledGuru(false);
                      }}
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-primary focus:bg-white transition"
                    >
                      <option value="">-- Pilih Guru Pengampu --</option>
                      {refGuru.map(g => (
                        <option key={g.id} value={g.id}>{g.nama}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={formSaving}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-900 text-white text-xs font-bold shadow-md shadow-primary/20 transition flex items-center gap-2"
                >
                  {formSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    'Simpan Jadwal'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
