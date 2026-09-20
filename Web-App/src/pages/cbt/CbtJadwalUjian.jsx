import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import {
  Calendar, Clock, BookOpen, Users, ShieldAlert, Plus, Edit3,
  Trash2, Video, Award, FileText, CheckCircle2, AlertTriangle,
  FileCheck, Printer, ArrowUpDown, Filter, LayoutGrid, List,
  Settings, Eye, ShieldCheck, X
} from 'lucide-react';
import CbtPengaturanUjianModal from '../../components/cbt/CbtPengaturanUjianModal';
import { getOperationalDate, getOperationalDayName, getLocalDate } from '../../utils/dateUtils';

export default function CbtJadwalUjian() {
  const navigate = useNavigate();

  const [jadwalList, setJadwalList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [mapelList, setMapelList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [ruangList, setRuangList] = useState([]);
  const [bankSoalList, setBankSoalList] = useState([]);
  const [pembelajaranList, setPembelajaranList] = useState([]);
  const [activePanitia, setActivePanitia] = useState(null);
  const [activeSop, setActiveSop] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isPengaturanModalOpen, setIsPengaturanModalOpen] = useState(false);

  // View & Filter States (Rollover 18.00)
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'list'
  const [filterHari, setFilterHari] = useState(() => getOperationalDayName());
  const [filterGuru, setFilterGuru] = useState('');
  const [sortBy, setSortBy] = useState('jam_asc'); // 'jam_asc' | 'jam_desc' | 'mapel_asc' | 'mapel_desc'

  // Modal Pilih Kelas (Untuk Tombol Soal Ujian)
  const [isKelasModalOpen, setIsKelasModalOpen] = useState(false);
  const [selectedJadwalForSoal, setSelectedJadwalForSoal] = useState(null);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [availableKelasList, setAvailableKelasList] = useState([]);

  // Modal Tambah / Edit Jadwal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    nama_ujian: '',
    jenis_ujian: 'PSTS',
    tanggal_ujian: getLocalDate(),
    hari: getOperationalDayName(),
    jam_mulai: '07:30',
    jam_selesai: '09:00',
    durasi_menit: 90,
    kelas_id: '',
    mapel_id: '',
    guru_id: '',
    ruang_id: '',
    pengawas_guru_id: '',
    bank_soal_id: '',
    status: 'terjadwal',
    acak_soal: true,
    acak_opsi: true,
    wajib_dijawab: false,
    mode_berkelanjutan: true,
    skema_konversi: 'asli',
    menit_tombol_selesai_aktif: 15,
  });

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    setLoading(true);
    try {
      const userSession = localStorage.getItem('user_guru');
      if (userSession) {
        const u = JSON.parse(userSession);
        setCurrentUser(u);

        // Ambil hak akses jabatan terkini dari jabatan_guru
        if (u.id) {
          const { data: jg } = await supabase
            .from('jabatan_guru')
            .select('jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3')
            .eq('guru_id', u.id)
            .maybeSingle();

          if (jg) {
            const freshRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3].filter(Boolean);
            setUserRoles(prev => Array.from(new Set([...prev, ...freshRoles])));
          }
        }
      }
      const storedRoles = localStorage.getItem('user_roles');
      if (storedRoles) {
        setUserRoles(prev => Array.from(new Set([...prev, ...JSON.parse(storedRoles)])));
      }

      await fetchInitialData();
    } catch (err) {
      console.error('Error init page:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [jadwals, panitiaRes, sopRes, kelasRes, mapelRes, guruRes, ruangRes, bankRes, pemRes] =
        await Promise.all([
          supabase
            .from('cbt_jadwal_ujian')
            .select(`
              *,
              data_kelas(nama_kelas),
              data_mapel(nama_mapel),
              guru_pengampu:data_guru!cbt_jadwal_ujian_guru_id_fkey(nama),
              pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama),
              data_ruang(nama_ruang),
              cbt_bank_soal(id, judul, total_soal)
            `)
            .order('tanggal_ujian', { ascending: true })
            .order('jam_mulai', { ascending: true }),
          supabase
            .from('cbt_struktur_panitia')
            .select('*')
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('cbt_sop_persetujuan')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('data_kelas').select('id, nama_kelas').order('nama_kelas'),
          supabase.from('data_mapel').select('id, nama_mapel').order('nama_mapel'),
          supabase.from('data_guru').select('id, nama').order('nama'),
          supabase.from('data_ruang').select('id, nama_ruang').order('nama_ruang'),
          supabase.from('cbt_bank_soal').select('id, judul, total_soal, tingkat_kelas, mapel_id').order('judul'),
          supabase.from('pembelajaran').select('kelas_id, mapel_id, guru_id'),
        ]);

      if (jadwals.data) setJadwalList(jadwals.data);
      if (panitiaRes.data) setActivePanitia(panitiaRes.data);
      if (sopRes.data) setActiveSop(sopRes.data);
      if (kelasRes.data) setKelasList(kelasRes.data);
      if (mapelRes.data) setMapelList(mapelRes.data);
      if (guruRes.data) setGuruList(guruRes.data);
      if (ruangRes.data) setRuangList(ruangRes.data);
      if (bankRes.data) setBankSoalList(bankRes.data);
      if (pemRes.data) setPembelajaranList(pemRes.data);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  const calculateHari = (dateString) => {
    if (!dateString) return getOperationalDayName();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(dateString);
    return days[d.getDay()] || 'Senin';
  };

  // Handler Buka Modal Pilih Kelas untuk Soal Ujian (Sama persis seperti Mobile App)
  const handleOpenSoalModal = (jadwal) => {
    setSelectedJadwalForSoal(jadwal);
    let filtered = [];
    if (isOPSOrPanitia) {
      filtered = kelasList;
    } else {
      const taughtKelasIds = (pembelajaranList || [])
        .filter(p => Number(p.guru_id) === Number(currentUser?.id) && Number(p.mapel_id) === Number(jadwal.mapel_id))
        .map(p => Number(p.kelas_id));
      filtered = kelasList.filter(k => taughtKelasIds.includes(Number(k.id)));
      if (filtered.length === 0) {
        filtered = kelasList.filter(k => Number(k.id) === Number(jadwal.kelas_id));
        if (filtered.length === 0) filtered = kelasList;
      }
    }
    setAvailableKelasList(filtered);
    setSelectedKelasId(filtered[0]?.id ? String(filtered[0].id) : (jadwal.kelas_id ? String(jadwal.kelas_id) : ''));
    setIsKelasModalOpen(true);
  };

  const handleConfirmKelasSoal = () => {
    if (!selectedKelasId) {
      Swal.fire('Peringatan', 'Silakan pilih kelas terlebih dahulu.', 'warning');
      return;
    }
    setIsKelasModalOpen(false);
    const matchingBank = bankSoalList.find(b => Number(b.mapel_id) === Number(selectedJadwalForSoal?.mapel_id));
    const bankIdToUse = selectedJadwalForSoal?.bank_soal_id || matchingBank?.id || '';
    navigate(`/cbt/bank-soal?bankId=${bankIdToUse}&mapelId=${selectedJadwalForSoal?.mapel_id || ''}&kelasId=${selectedKelasId}&jadwalId=${selectedJadwalForSoal?.id || ''}`);
  };

  // Cek Role OPS / Waka Kurikulum / Panitia CBT (Ketua & Sekretaris)
  const isOPSOrPanitia = Boolean(
    currentUser?.role === 'admin' ||
    userRoles.some(r => {
      const l = (r || '').toLowerCase();
      return (
        l.includes('operator') ||
        l.includes('kurikulum') ||
        l.includes('panitia') ||
        l.includes('admin')
      );
    }) ||
    (activePanitia?.sekretaris_guru_id && Number(activePanitia.sekretaris_guru_id) === Number(currentUser?.id)) ||
    (activePanitia?.ketua_panitia_guru_id && Number(activePanitia.ketua_panitia_guru_id) === Number(currentUser?.id))
  );

  // Auto-detect Guru Pengampu saat Mapel dipilih
  const autoDetectGuruPengampu = async (mapelId) => {
    if (!mapelId) return;
    try {
      const { data: jg } = await supabase
        .from('jadwal_guru')
        .select('guru_id')
        .eq('mapel_id', mapelId)
        .limit(1)
        .maybeSingle();

      if (jg?.guru_id) {
        setFormData(prev => ({ ...prev, guru_id: jg.guru_id }));
      }
    } catch (e) {
      console.error('Error autodetect guru:', e);
    }
  };

  const handleTanggalChange = (e) => {
    const val = e.target.value;
    setFormData(prev => ({
      ...prev,
      tanggal_ujian: val,
      hari: calculateHari(val)
    }));
  };

  const handleMapelChange = (e) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, mapel_id: val }));
    autoDetectGuruPengampu(val);
  };

  const handleSaveJadwal = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nama_ujian: formData.nama_ujian,
        jenis_ujian: formData.jenis_ujian,
        tanggal_ujian: formData.tanggal_ujian,
        hari: formData.hari || calculateHari(formData.tanggal_ujian),
        jam_mulai: formData.jam_mulai,
        jam_selesai: formData.jam_selesai,
        durasi_menit: parseInt(formData.durasi_menit, 10) || 90,
        kelas_id: formData.kelas_id || null,
        mapel_id: formData.mapel_id || null,
        guru_id: formData.guru_id || null,
        ruang_id: formData.ruang_id || null,
        pengawas_guru_id: formData.pengawas_guru_id || null,
        bank_soal_id: formData.bank_soal_id || null,
        status: formData.status,
        acak_soal: formData.acak_soal,
        acak_opsi: formData.acak_opsi,
        wajib_dijawab: formData.wajib_dijawab,
        mode_berkelanjutan: formData.mode_berkelanjutan,
        skema_konversi: formData.skema_konversi,
        menit_tombol_selesai_aktif: parseInt(formData.menit_tombol_selesai_aktif, 10) || 15,
        sop_id: activeSop?.id || null,
      };

      if (formData.id) {
        const { error } = await supabase.from('cbt_jadwal_ujian').update(payload).eq('id', formData.id);
        if (error) throw error;
        Swal.fire('Berhasil', 'Jadwal ujian berhasil diperbarui.', 'success');
      } else {
        const { error } = await supabase.from('cbt_jadwal_ujian').insert([payload]);
        if (error) throw error;
        Swal.fire('Berhasil', 'Jadwal ujian baru berhasil ditambahkan.', 'success');
      }

      setIsModalOpen(false);
      fetchInitialData();
    } catch (err) {
      Swal.fire('Gagal', err.message || 'Terjadi kesalahan saat menyimpan jadwal.', 'error');
    }
  };

  const handleDeleteJadwal = async (id) => {
    const res = await Swal.fire({
      title: 'Hapus Jadwal Ujian?',
      text: 'Data jadwal beserta seluruh sesi siswa terkait akan dihapus secara permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#d33',
    });
    if (res.isConfirmed) {
      const { error } = await supabase.from('cbt_jadwal_ujian').delete().eq('id', id);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        Swal.fire('Terhapus', 'Jadwal berhasil dihapus.', 'success');
        fetchInitialData();
      }
    }
  };

  // Filter & Urutan Jadwal
  const filteredJadwal = jadwalList
    .filter((j) => {
      if (filterHari !== 'Semua') {
        const itemHari = j.hari || calculateHari(j.tanggal_ujian);
        if (itemHari.toLowerCase() !== filterHari.toLowerCase()) return false;
      }
      if (filterGuru && String(j.guru_id) !== String(filterGuru)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'jam_asc') {
        return a.tanggal_ujian.localeCompare(b.tanggal_ujian) || a.jam_mulai.localeCompare(b.jam_mulai);
      }
      if (sortBy === 'jam_desc') {
        return b.tanggal_ujian.localeCompare(a.tanggal_ujian) || b.jam_mulai.localeCompare(a.jam_mulai);
      }
      if (sortBy === 'mapel_asc') {
        return (a.data_mapel?.nama_mapel || '').localeCompare(b.data_mapel?.nama_mapel || '');
      }
      if (sortBy === 'mapel_desc') {
        return (b.data_mapel?.nama_mapel || '').localeCompare(a.data_mapel?.nama_mapel || '');
      }
      return 0;
    });

  // Grouping berdasarkan Hari & Tanggal
  const groupedByDate = filteredJadwal.reduce((acc, item) => {
    const key = `${item.hari}, ${new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(item.tanggal_ujian))}`;

    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const handlePrintRekap = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Calendar size={28} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-primary">Jadwal Pelaksanaan CBT</h1>
              {activeSop?.is_approved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                  <CheckCircle2 size={13} /> SOP Aktif: {activeSop.jenis_ujian}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                  <AlertTriangle size={13} /> {activeSop?.jenis_ujian || 'CBT'} Aktif
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Penjadwalan komprehensif ujian, pengawasan AI, berita acara, dan daftar hadir resmi
            </p>
          </div>
        </div>

        {/* Tombol Kanan (Pada mobile terletak di bawah judul) */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
          {/* Tombol Tambah Jadwal: Khusus OPS / Waka Kurikulum / Panitia */}
          {isOPSOrPanitia && (
            <button
              onClick={() => {
                const today = getLocalDate();
                setFormData({
                  id: null,
                  nama_ujian: `${activeSop?.jenis_ujian || 'Ujian'} Mata Pelajaran`,
                  jenis_ujian: activeSop?.jenis_ujian || 'PSTS',
                  tanggal_ujian: today,
                  hari: getOperationalDayName(),
                  jam_mulai: '07:30',
                  jam_selesai: '09:00',
                  durasi_menit: 90,
                  kelas_id: kelasList[0]?.id || '',
                  mapel_id: mapelList[0]?.id || '',
                  guru_id: '',
                  ruang_id: ruangList[0]?.id || '',
                  pengawas_guru_id: '',
                  bank_soal_id: bankSoalList[0]?.id || '',
                  status: 'terjadwal',
                  acak_soal: true,
                  acak_opsi: true,
                  wajib_dijawab: false,
                  mode_berkelanjutan: true,
                  skema_konversi: 'asli',
                  menit_tombol_selesai_aktif: 15,
                });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <Plus size={16} />
              <span>Tambah Jadwal</span>
            </button>
          )}

          {/* Tombol Pengaturan Ujian - Khusus Operator, Waka Kurikulum, & Panitia */}
          {isOPSOrPanitia && (
            <button
              onClick={() => setIsPengaturanModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold text-xs rounded-xl border border-gray-200 transition"
            >
              <Settings size={16} className="text-gray-600" />
              <span>Pengaturan Ujian</span>
            </button>
          )}

          {/* Tombol Cetak Rekap */}
          {isOPSOrPanitia && (
            <button
              onClick={handlePrintRekap}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-lime-500 text-gray-900 font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Printer size={16} />
              <span>Cetak</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigasi Hari Ujian (Senin s/d Sabtu) */}
      <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2 overflow-x-auto">
        {['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((hari) => {
          const count = hari === 'Semua'
            ? jadwalList.length
            : jadwalList.filter(j => (j.hari || calculateHari(j.tanggal_ujian)).toLowerCase() === hari.toLowerCase()).length;

          const isActive = filterHari === hari;
          const todayName = getOperationalDayName();
          const isHariIni = todayName.toLowerCase() === hari.toLowerCase();

          return (
            <button
              key={hari}
              onClick={() => setFilterHari(hari)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span>{hari === 'Semua' ? 'Semua Hari' : hari}</span>
              {isHariIni && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${
                  isActive ? 'bg-secondary text-gray-900' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  Hari Ini
                </span>
              )}
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Sub-Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {/* Filter Guru */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
            <Filter size={14} /> Filter:
          </div>

          <select
            value={filterGuru}
            onChange={(e) => setFilterGuru(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl p-2 bg-gray-50 font-medium outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Semua Guru Pengampu</option>
            {guruList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nama || g.nama_guru}
              </option>
            ))}
          </select>
        </div>

        {/* Urutan & Tampilan Mode */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
            <ArrowUpDown size={14} /> Urutan:
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl p-2 bg-gray-50 font-medium outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="jam_asc">Jam (Paling Awal)</option>
            <option value="jam_desc">Jam (Paling Akhir)</option>
            <option value="mapel_asc">Mata Pelajaran (A - Z)</option>
            <option value="mapel_desc">Mata Pelajaran (Z - A)</option>
          </select>

          {/* Toggle Card vs List */}
          <div className="flex items-center border border-gray-200 rounded-xl p-1 bg-gray-50">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'card' ? 'bg-white shadow text-primary' : 'text-gray-400 hover:text-gray-700'
              }`}
              title="Tampilan Kartu"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list' ? 'bg-white shadow text-primary' : 'text-gray-400 hover:text-gray-700'
              }`}
              title="Tampilan Daftar"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Konten Jadwal per Hari */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-700">Belum Ada Jadwal Ujian</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            {isOPSOrPanitia
              ? 'Silakan klik tombol Tambah Jadwal di atas untuk memasukkan jadwal ujian baru.'
              : 'Jadwal ujian belum dipublikasikan oleh Panitia atau Operator.'}
          </p>
        </div>
      ) : (
        Object.entries(groupedByDate).map(([hariTanggal, items]) => (
          <div key={hariTanggal} className="space-y-3">
            {/* Header Grup Hari */}
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
              <h2 className="text-sm font-black text-gray-800 tracking-wide uppercase">
                {hariTanggal}
              </h2>
              <span className="text-xs text-gray-400 font-semibold">({items.length} Sesi Ujian)</span>
            </div>

            {/* Render Kartu / List */}
            <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
              {items.map((j) => {
                const isDiampu = Number(j.guru_id) === Number(currentUser?.id);
                const isDiawasi = Number(j.pengawas_guru_id) === Number(currentUser?.id);

                return (
                  <div
                    key={j.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Baris Status & Kelas */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-blue-50 text-primary text-xs font-black rounded-lg">
                            {j.data_kelas?.nama_kelas || 'Semua Kelas'}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded">
                            {j.data_ruang?.nama_ruang || 'Ruang CBT'}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${
                            j.status === 'berlangsung'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse'
                              : j.status === 'selesai'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          ● {j.status.toUpperCase()}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-gray-900 line-clamp-1">{j.nama_ujian}</h3>
                      <p className="text-xs font-semibold text-primary mt-0.5">
                        Mapel: {j.data_mapel?.nama_mapel || '-'}
                      </p>

                      {/* Metadata Waktu, Guru Pengampu, Pengawas */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-blue-500" />
                          <span>
                            {j.jam_mulai?.slice(0, 5)} - {j.jam_selesai?.slice(0, 5)} ({j.durasi_menit} mnt)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-emerald-500" />
                          <span className="truncate">Pengawas: {j.pengawas?.nama || j.pengawas?.nama_guru || '-'}</span>
                        </div>
                      </div>

                      <div className="mt-1 text-xs text-gray-600 flex items-center gap-1.5">
                        <Users size={14} className="text-amber-500" />
                        <span className="truncate">Guru Pengampu: {j.guru_pengampu?.nama || j.guru_pengampu?.nama_guru || '-'}</span>
                      </div>

                      {/* Bank Soal Terhubung */}
                      <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
                        <BookOpen size={13} className="text-purple-500" />
                        <span>
                          Bank Soal: <strong>{j.cbt_bank_soal?.judul || 'Belum dipilih'}</strong> (
                          {j.cbt_bank_soal?.total_soal || 0} butir)
                        </span>
                      </div>
                    </div>

                    {/* HAK AKSES PER ROLE PADA TOMBOL CARD JADWAL */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      {/* Skenario 1: OPS / Waka Kurikulum / Panitia -> 8 Tombol Lengkap */}
                      {isOPSOrPanitia ? (
                        <div className="space-y-2">
                          {/* Row Aksi Utama (Awasi Ujian, Nilai, Soal Ujian) */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              onClick={() => handleOpenSoalModal(j)}
                              className="py-2 px-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                              title="Soal Ujian"
                            >
                              <BookOpen size={13} /> Soal Ujian
                            </button>

                            <button
                              onClick={() => navigate(`/cbt/pengawas/${j.id}`)}
                              className="py-2 px-2 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                              title="Awasi Ujian"
                            >
                              <Video size={13} /> Awasi Ujian
                            </button>

                            <button
                              onClick={() => navigate(`/cbt/nilai/${j.id}`)}
                              className="py-2 px-2 bg-primary hover:bg-blue-900 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                              title="Daftar Nilai"
                            >
                              <Award size={13} /> Daftar Nilai
                            </button>
                          </div>

                          {/* Row Dokumen & Administrasi (Hadir Peserta, Hadir Pengawas, Berita Acara) */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              onClick={() => navigate(`/cbt/cetak/hadir-peserta/${j.id}`)}
                              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold text-[10px] rounded-lg flex items-center justify-center gap-1 transition"
                              title="Daftar Hadir Peserta"
                            >
                              <Printer size={12} /> Hadir Peserta
                            </button>

                            <button
                              onClick={() => navigate(`/cbt/cetak/hadir-pengawas/${j.id}`)}
                              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold text-[10px] rounded-lg flex items-center justify-center gap-1 transition"
                              title="Daftar Hadir Pengawas"
                            >
                              <Printer size={12} /> Hadir Pengawas
                            </button>

                            <button
                              onClick={() => navigate(`/cbt/cetak/berita-acara/${j.id}`)}
                              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold text-[10px] rounded-lg flex items-center justify-center gap-1 transition"
                              title="Berita Acara Ujian"
                            >
                              <FileText size={12} /> Berita Acara
                            </button>
                          </div>

                          {/* Row CRUD (Edit, Hapus) */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => {
                                setFormData({
                                  id: j.id,
                                  nama_ujian: j.nama_ujian,
                                  jenis_ujian: j.jenis_ujian,
                                  tanggal_ujian: j.tanggal_ujian,
                                  hari: j.hari,
                                  jam_mulai: j.jam_mulai?.slice(0, 5),
                                  jam_selesai: j.jam_selesai?.slice(0, 5),
                                  durasi_menit: j.durasi_menit,
                                  kelas_id: j.kelas_id || '',
                                  mapel_id: j.mapel_id || '',
                                  guru_id: j.guru_id || '',
                                  ruang_id: j.ruang_id || '',
                                  pengawas_guru_id: j.pengawas_guru_id || '',
                                  bank_soal_id: j.bank_soal_id || '',
                                  status: j.status,
                                  acak_soal: j.acak_soal,
                                  acak_opsi: j.acak_opsi,
                                  wajib_dijawab: j.wajib_dijawab,
                                  mode_berkelanjutan: j.mode_berkelanjutan,
                                  skema_konversi: j.skema_konversi,
                                  menit_tombol_selesai_aktif: j.menit_tombol_selesai_aktif,
                                });
                                setIsModalOpen(true);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-primary hover:bg-blue-50 rounded-lg transition"
                            >
                              <Edit3 size={13} /> Edit
                            </button>

                            <button
                              onClick={() => handleDeleteJadwal(j.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 size={13} /> Hapus
                            </button>
                          </div>
                        </div>
                      ) : isDiampu ? (
                        /* Skenario 2: Guru Mapel Diampu -> 3 Tombol */
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleOpenSoalModal(j)}
                            className="py-2 px-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                          >
                            <BookOpen size={14} /> Soal Ujian
                          </button>

                          <button
                            onClick={() => navigate(`/cbt/nilai/${j.id}`)}
                            className="py-2 px-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                          >
                            <Award size={14} /> Daftar Nilai
                          </button>

                          <button
                            onClick={() => navigate(`/cbt/cetak/hadir-peserta/${j.id}`)}
                            className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
                          >
                            <Printer size={14} /> Hadir Peserta
                          </button>
                        </div>
                      ) : isDiawasi ? (
                        /* Skenario 3: Guru Mapel Diawasi -> 4 Tombol */
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button
                            onClick={() => navigate(`/cbt/pengawas/${j.id}`)}
                            className="py-2 px-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                          >
                            <Video size={14} /> Awasi Ujian
                          </button>

                          <button
                            onClick={() => navigate(`/cbt/nilai/${j.id}`)}
                            className="py-2 px-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                          >
                            <Award size={14} /> Daftar Nilai
                          </button>

                          <button
                            onClick={() => navigate(`/cbt/cetak/hadir-peserta/${j.id}`)}
                            className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
                          >
                            <Printer size={14} /> Hadir Peserta
                          </button>

                          <button
                            onClick={() => navigate(`/cbt/cetak/berita-acara/${j.id}`)}
                            className="py-2 px-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition"
                          >
                            <FileText size={14} /> Berita Acara
                          </button>
                        </div>
                      ) : (
                        /* Guru Umum / Pengunjung Jadwal */
                        <div className="text-center py-1 text-[11px] text-gray-400 font-medium">
                          Readonly Jadwal Ujian
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal Pengaturan Ujian CBT */}
      <CbtPengaturanUjianModal
        isOpen={isPengaturanModalOpen}
        onClose={() => setIsPengaturanModalOpen(false)}
        onSaved={() => fetchInitialData()}
      />

      {/* Pop-up Form Tambah / Edit Jadwal Ujian (OPS/Panitia) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-8 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Calendar size={20} />
              <span>{formData.id ? 'Edit Jadwal Ujian CBT' : 'Buat Jadwal Ujian CBT Baru'}</span>
            </h3>

            <form onSubmit={handleSaveJadwal} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Sesi Ujian *</label>
                <input
                  type="text"
                  placeholder="Misal: PSTS Ganjil - Bahasa Indonesia Kelas 7"
                  value={formData.nama_ujian}
                  onChange={(e) => setFormData({ ...formData, nama_ujian: e.target.value })}
                  className="w-full text-xs font-semibold border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {/* Mata Pelajaran */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mata Pelajaran *</label>
                <select
                  value={formData.mapel_id}
                  onChange={handleMapelChange}
                  className="w-full text-xs border rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">-- Pilih Mapel --</option>
                  {mapelList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nama_mapel}
                    </option>
                  ))}
                </select>
              </div>

              {/* Guru Pengampu (Otomatis terisi dari jadwal kelas/mapel) & Pengawas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Guru Pengampu <span className="text-[10px] text-primary font-normal">(Otomatis/Manual)</span>
                  </label>
                  <select
                    value={formData.guru_id}
                    onChange={(e) => setFormData({ ...formData, guru_id: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Pilih Guru Pengampu --</option>
                    {guruList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nama || g.nama_guru}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Pengawas Ujian (Proctor)</label>
                  <select
                    value={formData.pengawas_guru_id}
                    onChange={(e) => setFormData({ ...formData, pengawas_guru_id: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Pilih Pengawas --</option>
                    {guruList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nama || g.nama_guru}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tanggal & Hari Otomatis */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Ujian *</label>
                  <input
                    type="date"
                    value={formData.tanggal_ujian}
                    onChange={handleTanggalChange}
                    className="w-full text-xs border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Hari <span className="text-[10px] text-green-600 font-normal">(Otomatis)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.hari}
                    readOnly
                    className="w-full text-xs border rounded-xl p-2.5 bg-gray-50 font-bold text-gray-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Durasi (Menit)</label>
                  <input
                    type="number"
                    min="10"
                    max="240"
                    value={formData.durasi_menit}
                    onChange={(e) => setFormData({ ...formData, durasi_menit: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              {/* Waktu Pelaksanaan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={formData.jam_mulai}
                    onChange={(e) => setFormData({ ...formData, jam_mulai: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={formData.jam_selesai}
                    onChange={(e) => setFormData({ ...formData, jam_selesai: e.target.value })}
                    className="w-full text-xs border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              {/* Ruang Ujian */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ruang Ujian</label>
                <select
                  value={formData.ruang_id}
                  onChange={(e) => setFormData({ ...formData, ruang_id: e.target.value })}
                  className="w-full text-xs border rounded-xl p-2.5 bg-white outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Pilih Ruang (Default: Lab CBT) --</option>
                  {ruangList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nama_ruang}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  Simpan Jadwal Ujian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pilih Kelas sebelum Masuk ke Soal Ujian (Sama seperti Mobile App) */}
      {isKelasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-primary font-bold">
                <BookOpen size={20} />
                <span>Pilih Kelas untuk Soal Ujian</span>
              </div>
              <button
                onClick={() => setIsKelasModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500 font-medium">Mata Pelajaran:</p>
                <p className="text-sm font-bold text-gray-800">
                  {selectedJadwalForSoal?.data_mapel?.nama_mapel || selectedJadwalForSoal?.nama_ujian || 'Mata Pelajaran'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Pilih Kelas yang Diampu / Dituju:
                </label>
                <select
                  value={selectedKelasId}
                  onChange={(e) => setSelectedKelasId(e.target.value)}
                  className="w-full text-xs font-semibold border rounded-xl p-3 bg-white outline-none focus:ring-2 focus:ring-primary shadow-sm"
                >
                  {availableKelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      Kelas {k.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-gray-400">
                Memilih kelas akan mengarahkan Anda ke pengelolaan bank soal & butir soal untuk kelas tersebut.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsKelasModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmKelasSoal}
                className="px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <BookOpen size={14} />
                <span>Lanjut ke Soal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
