import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import {
  Calendar, Clock, BookOpen, Users, ShieldAlert, Plus, Edit3,
  Trash2, Video, Award, FileText, CheckCircle2, AlertTriangle, AlertCircle,
  FileCheck, Printer, ArrowUpDown, Filter, LayoutGrid, List,
  Settings, Eye, ShieldCheck, X, Building, Shuffle, Check,
  Search, RotateCcw, ChevronDown, UserCheck
} from 'lucide-react';
import CbtPengaturanUjianModal from '../../components/cbt/CbtPengaturanUjianModal';
import { getOperationalDate, getOperationalDayName, getLocalDate } from '../../utils/dateUtils';

// Komponen Dropdown dengan Fitur Pencarian Real-Time (Searchable Select)
function SearchableSelect({
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  icon: Icon,
  options = [],
  value,
  onChange,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, searchTerm]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm('');
        }}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border text-xs font-semibold rounded-xl transition shadow-2xs cursor-pointer ${
          isOpen
            ? 'border-indigo-600 ring-2 ring-indigo-500/20 text-gray-900'
            : value
            ? 'border-indigo-300 bg-indigo-50/40 text-indigo-950 font-bold'
            : 'border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {Icon && <Icon size={14} className={value ? 'text-indigo-600' : 'text-gray-400'} />}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setIsOpen(false);
              }}
              className="p-0.5 hover:bg-gray-200 text-gray-400 hover:text-gray-700 rounded-full transition cursor-pointer"
              title="Hapus filter"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
          <div className="p-2 border-b border-gray-100 bg-gray-50/70">
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-gray-800"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition cursor-pointer ${
                !value
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{placeholder}</span>
              {!value && <Check size={13} className="text-indigo-600" />}
            </button>

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400 italic">
                Tidak ditemukan hasil untuk "{searchTerm}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-gray-700 hover:bg-indigo-50/60'
                    }`}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {isSelected && <Check size={13} className="text-white shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [sortBy, setSortBy] = useState('jam_asc');

  // Filter Status Kelengkapan Soal (Guru Pengampu & Mata Pelajaran)
  const [filterStatusGuru, setFilterStatusGuru] = useState('');
  const [filterStatusMapel, setFilterStatusMapel] = useState('');

  // States Pengaturan Ruang Peserta
  const [isRuangPesertaModalOpen, setIsRuangPesertaModalOpen] = useState(false);
  const [targetJadwalForRuang, setTargetJadwalForRuang] = useState(null);
  const [applyToAllJadwal, setApplyToAllJadwal] = useState(true);
  const [modeRuang, setModeRuang] = useState('default'); // 'default' | 'acak' | 'custom'
  const [selectedActiveRuangIds, setSelectedActiveRuangIds] = useState([]);
  const [siswaPesertaList, setSiswaPesertaList] = useState([]);
  const [alokasiRuangMap, setAlokasiRuangMap] = useState({});
  const [customTargetRuangId, setCustomTargetRuangId] = useState('');
  const [loadingRuangPeserta, setLoadingRuangPeserta] = useState(false);
  const [savingRuangPeserta, setSavingRuangPeserta] = useState(false);
  const [searchSiswaRuang, setSearchSiswaRuang] = useState('');
  const [filterKelasRuang, setFilterKelasRuang] = useState('Semua');

  // States Pengaturan Pengawas Setiap Ruangan
  const [isPengawasRuangModalOpen, setIsPengawasRuangModalOpen] = useState(false);
  const [targetJadwalForPengawas, setTargetJadwalForPengawas] = useState(null);
  const [pengawasRuangList, setPengawasRuangList] = useState([]);
  const [loadingPengawasRuang, setLoadingPengawasRuang] = useState(false);
  const [savingPengawasRuang, setSavingPengawasRuang] = useState(false);
  const [globalPengawasId, setGlobalPengawasId] = useState('');
  const [jadwalPengawasRuangMap, setJadwalPengawasRuangMap] = useState({});

  // States Modal Pilih Ruangan Sebelum Masuk Pengawasan Ujian
  const [isPilihRuangAwasiModalOpen, setIsPilihRuangAwasiModalOpen] = useState(false);
  const [targetJadwalForAwasi, setTargetJadwalForAwasi] = useState(null);
  const [selectedRuangIdForAwasi, setSelectedRuangIdForAwasi] = useState('');
  const [availableRuangForAwasi, setAvailableRuangForAwasi] = useState([]);

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
          supabase.from('data_kelas').select('id, nama_kelas, ruang_id').order('nama_kelas'),
          supabase.from('data_mapel').select('id, nama_mapel').order('nama_mapel'),
          supabase.from('data_guru').select('id, nama').order('nama'),
          supabase.from('data_ruang').select('id, nama_ruang').order('nama_ruang'),
          supabase.from('cbt_bank_soal').select('id, judul, total_soal, tingkat_kelas, mapel_id, jenis_ujian, pengawas_guru_id, pengawas:data_guru!cbt_bank_soal_pengawas_guru_id_fkey(nama)').order('judul'),
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

      // Fetch penugasan pengawas per ruangan dari cbt_berita_acara
      const { data: baData } = await supabase
        .from('cbt_berita_acara')
        .select('jadwal_id, ruang_id, pengawas_guru_id, data_guru(id, nama), data_ruang(id, nama_ruang)');

      const pMap = {};
      (baData || []).forEach((item) => {
        if (item.jadwal_id && item.pengawas_guru_id) {
          if (!pMap[item.jadwal_id]) pMap[item.jadwal_id] = [];
          pMap[item.jadwal_id].push({
            ruang_id: item.ruang_id,
            nama_ruang: item.data_ruang?.nama_ruang || `Ruang ${item.ruang_id}`,
            guru_id: item.pengawas_guru_id,
            guru_nama: item.data_guru?.nama || '-'
          });
        }
      });
      setJadwalPengawasRuangMap(pMap);
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
    const kObj = kelasList.find(k => String(k.id) === String(selectedKelasId));
    let tingkat = kObj?.tingkat ? String(kObj.tingkat) : '';
    if (!tingkat && kObj?.nama_kelas) {
      const u = kObj.nama_kelas.toUpperCase();
      if (u.includes('VII') && !u.includes('VIII')) tingkat = '7';
      else if (u.includes('VIII')) tingkat = '8';
      else if (u.includes('IX')) tingkat = '9';
    }
    const jenisUjian = selectedJadwalForSoal?.jenis_ujian || 'PSTS';
    const matchingBank = bankSoalList.find(b =>
      Number(b.mapel_id) === Number(selectedJadwalForSoal?.mapel_id) &&
      (String(b.tingkat_kelas) === tingkat || String(b.tingkat_kelas) === 'Semua') &&
      (!b.jenis_ujian || String(b.jenis_ujian).toUpperCase() === String(jenisUjian).toUpperCase())
    );
    const bankIdToUse = matchingBank?.id || '';
    navigate(`/cbt/bank-soal?bankId=${bankIdToUse}&mapelId=${selectedJadwalForSoal?.mapel_id || ''}&kelasId=${selectedKelasId}&tingkat=${tingkat}&jenisUjian=${encodeURIComponent(jenisUjian)}&jadwalId=${selectedJadwalForSoal?.id || ''}`);
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
  };

  // Komputasi Status Kelengkapan Soal Seluruh Mata Pelajaran Ujian
  const statusKelengkapanSoalSemua = useMemo(() => {
    if (!jadwalList || jadwalList.length === 0) return null;

    const sudahAda = [];
    const belumAda = [];

    // Kumpulkan seluruh mapel unik yang ada dalam jadwal ujian
    const mapelInJadwal = [];
    const seenMapel = new Set();
    jadwalList.forEach(j => {
      if (j.mapel_id && !seenMapel.has(Number(j.mapel_id))) {
        seenMapel.add(Number(j.mapel_id));
        mapelInJadwal.push({
          mapelId: Number(j.mapel_id),
          mapelNama: j.data_mapel?.nama_mapel || j.nama_ujian,
          jadwal: j
        });
      }
    });

    mapelInJadwal.sort((a, b) => a.mapelNama.localeCompare(b.mapelNama));

    const tingkatList = ['7', '8', '9'];

    mapelInJadwal.forEach(({ mapelId, mapelNama, jadwal }) => {
      const jenisUjian = jadwal.jenis_ujian || 'PSTS';
      tingkatList.forEach(tk => {
        const matchedBanks = (bankSoalList || []).filter(b =>
          Number(b.mapel_id) === mapelId &&
          (String(b.tingkat_kelas) === tk || String(b.tingkat_kelas) === 'Semua') &&
          (!b.jenis_ujian || String(b.jenis_ujian).toUpperCase() === String(jenisUjian).toUpperCase())
        );

        const totalSoal = matchedBanks.reduce((sum, b) => sum + (Number(b.total_soal) || 0), 0);
        const bankUtama = matchedBanks[0];
        const pengawasNama = bankUtama?.pengawas?.nama || bankUtama?.data_guru?.nama || null;

        // Cari kelas yang sesuai dengan tingkat tk
        const classesInTingkat = (kelasList || []).filter(k => {
          let grade = k.tingkat ? String(k.tingkat) : '';
          if (!grade && k.nama_kelas) {
            const u = k.nama_kelas.toUpperCase();
            if (u.includes('VII') && !u.includes('VIII')) grade = '7';
            else if (u.includes('VIII')) grade = '8';
            else if (u.includes('IX')) grade = '9';
          }
          return grade === tk;
        }).map(k => Number(k.id));

        // Cari pembelajaran mapel & kelas terkait
        const matchingPemb = (pembelajaranList || []).filter(p =>
          Number(p.mapel_id) === mapelId && classesInTingkat.includes(Number(p.kelas_id))
        );

        const guruIdsSet = new Set();
        matchingPemb.forEach(p => {
          if (p.guru_id) guruIdsSet.add(Number(p.guru_id));
        });

        // Fallback jika belum diatur di pembelajaran
        if (guruIdsSet.size === 0) {
          if (jadwal.guru_id) guruIdsSet.add(Number(jadwal.guru_id));
          if (bankUtama?.guru_id) guruIdsSet.add(Number(bankUtama.guru_id));
        }

        const guruPengampuArr = Array.from(guruIdsSet).map(gId => {
          const found = (guruList || []).find(g => Number(g.id) === gId);
          return found ? { id: found.id, nama: found.nama || found.nama_guru } : null;
        }).filter(Boolean);

        const guruPengampuNama = guruPengampuArr.map(g => g.nama).join(', ') || jadwal.guru_pengampu?.nama || null;

        const infoItem = {
          tingkat: tk,
          mapelId,
          mapelNama,
          bankId: bankUtama?.id || null,
          bankJudul: bankUtama?.judul || null,
          totalSoal,
          pengawasNama,
          guruPengampuArr,
          guruPengampuNama,
          guruIds: Array.from(guruIdsSet),
          jadwalId: jadwal.id,
          jenisUjian: jenisUjian,
          jadwal: jadwal,
        };

        if (totalSoal > 0) {
          sudahAda.push(infoItem);
        } else {
          belumAda.push(infoItem);
        }
      });
    });

    return {
      totalMapel: mapelInJadwal.length,
      sudahAda,
      belumAda
    };
  }, [jadwalList, bankSoalList, kelasList, pembelajaranList, guruList]);

  // Pilihan Dropdown Filter Mata Pelajaran pada Status Kelengkapan Soal
  const statusMapelFilterOptions = useMemo(() => {
    if (!statusKelengkapanSoalSemua) return [];
    const all = [...statusKelengkapanSoalSemua.sudahAda, ...statusKelengkapanSoalSemua.belumAda];
    const map = new Map();
    all.forEach(item => {
      if (!map.has(String(item.mapelId))) {
        map.set(String(item.mapelId), item.mapelNama);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [statusKelengkapanSoalSemua]);

  // Pilihan Dropdown Filter Guru Pengampu pada Status Kelengkapan Soal
  const statusGuruFilterOptions = useMemo(() => {
    if (!statusKelengkapanSoalSemua) return [];
    const all = [...statusKelengkapanSoalSemua.sudahAda, ...statusKelengkapanSoalSemua.belumAda];
    const map = new Map();
    all.forEach(item => {
      (item.guruPengampuArr || []).forEach(g => {
        if (!map.has(String(g.id))) {
          map.set(String(g.id), g.nama);
        }
      });
    });
    // Jika ada guru di data_guru yang belum muncul di item, tetap sediakan dari guruList
    if (guruList && guruList.length > 0) {
      guruList.forEach(g => {
        if (!map.has(String(g.id))) {
          map.set(String(g.id), g.nama || g.nama_guru);
        }
      });
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [statusKelengkapanSoalSemua, guruList]);

  // Item yang telah difilter berdasarkan Guru Pengampu & Mapel
  const filteredStatusSudahAda = useMemo(() => {
    if (!statusKelengkapanSoalSemua) return [];
    return statusKelengkapanSoalSemua.sudahAda.filter(item => {
      if (filterStatusMapel && String(item.mapelId) !== String(filterStatusMapel)) return false;
      if (filterStatusGuru && !item.guruIds.includes(Number(filterStatusGuru))) return false;
      return true;
    });
  }, [statusKelengkapanSoalSemua, filterStatusMapel, filterStatusGuru]);

  const filteredStatusBelumAda = useMemo(() => {
    if (!statusKelengkapanSoalSemua) return [];
    return statusKelengkapanSoalSemua.belumAda.filter(item => {
      if (filterStatusMapel && String(item.mapelId) !== String(filterStatusMapel)) return false;
      if (filterStatusGuru && !item.guruIds.includes(Number(filterStatusGuru))) return false;
      return true;
    });
  }, [statusKelengkapanSoalSemua, filterStatusMapel, filterStatusGuru]);

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
        kelas_id: null,
        mapel_id: formData.mapel_id || null,
        guru_id: null,
        ruang_id: null,
        pengawas_guru_id: null,
        bank_soal_id: null,
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

  const handlePrintRekap = async () => {
    try {
      const [lembagaRes, panitiaRes, sopRes, guruRes] = await Promise.all([
        supabase.from('data_lembaga').select('*').limit(1).maybeSingle(),
        supabase.from('cbt_struktur_panitia').select('*').order('id', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cbt_sop_persetujuan').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('data_guru').select('id, nama, nip'),
      ]);

      const lembaga = lembagaRes.data || {};
      const sop = sopRes.data || activeSop || {};
      const panitia = panitiaRes.data || activePanitia || {};
      const allGuru = guruRes.data || [];

      let ketuaNama = 'Ketua Panitia';
      let ketuaNip = '-';
      if (panitia.ketua_panitia_guru_id) {
        const found = allGuru.find((g) => Number(g.id) === Number(panitia.ketua_panitia_guru_id));
        if (found) {
          ketuaNama = found.nama;
          ketuaNip = found.nip || '-';
        }
      }

      const kepsekNama = lembaga.kepala_sekolah || 'Kepala Sekolah';
      const kepsekNip = lembaga.nip_kepala_sekolah || '-';

      const sorted = [...jadwalList].sort((a, b) => {
        return (a.tanggal_ujian || '').localeCompare(b.tanggal_ujian || '') || (a.jam_mulai || '').localeCompare(b.jam_mulai || '');
      });

      const formatDateIndo = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      };

      const rowsHtml = sorted.map((j, idx) => `
        <tr style="height:32px; ${idx % 2 === 1 ? 'background-color:#f9fafb;' : ''}">
          <td style="border:1px solid #000; text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="border:1px solid #000; padding:0 8px; font-weight:600;">${formatDateIndo(j.tanggal_ujian)}</td>
          <td style="border:1px solid #000; text-align:center; font-family:monospace;">${j.jam_mulai?.substring(0, 5)} - ${j.jam_selesai?.substring(0, 5)}</td>
          <td style="border:1px solid #000; text-align:center;">${j.durasi_menit}m</td>
          <td style="border:1px solid #000; text-align:center; font-weight:bold;">${j.jenis_ujian || 'CBT'}</td>
          <td style="border:1px solid #000; padding:0 8px; font-weight:700;">${j.data_mapel?.nama_mapel || j.nama_ujian}</td>
        </tr>
      `).join('');

      let ttdKetuaHtml = '';
      if (sop?.tanda_tangan_ketua) {
        if (sop.tanda_tangan_ketua.startsWith('<svg')) {
          ttdKetuaHtml = `<div style="height:65px; display:flex; align-items:center; justify-content:center;">${sop.tanda_tangan_ketua}</div>`;
        } else {
          ttdKetuaHtml = `<img src="${sop.tanda_tangan_ketua}" style="max-height:65px; max-width:160px; object-fit:contain;" />`;
        }
      } else {
        ttdKetuaHtml = '<div style="height:65px;"></div>';
      }

      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Jadwal Pelaksanaan Ujian CBT - ${lembaga.nama_lembaga || 'SMP IT HM'}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.3; margin: 0; padding: 20px; }
            .header-table { width: 100%; border-collapse: collapse; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
            .kop-title { font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 0; }
            .kop-sub { font-size: 9pt; margin: 2px 0; }
            .doc-title { text-align: center; font-weight: bold; text-decoration: underline; font-size: 13pt; text-transform: uppercase; margin: 12px 0 2px 0; }
            .content-table { width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 10pt; font-family: Arial, sans-serif; margin-top: 14px; }
            .content-table th { border: 1px solid #000; background-color: #f1f5f9; padding: 6px 4px; font-weight: bold; text-align: center; }
            .ttd-container { margin-top: 35px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .ttd-box { width: 45%; text-align: center; font-size: 10.5pt; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="width: 75px; text-align: center; vertical-align: middle;">
                ${lembaga.logo_url ? `<img src="${lembaga.logo_url}" style="width: 65px; height: 65px; object-fit: contain;" />` : ''}
              </td>
              <td style="text-align: center; vertical-align: middle;">
                <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase;">${lembaga.nama_yayasan || 'YAYASAN HIDAYATUL MUBTADI-IEN'}</div>
                <div class="kop-title">${lembaga.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}</div>
                <div class="kop-sub">NPSN: ${lembaga.npsn || '70004822'} | ${lembaga.alamat || 'Subang, Jawa Barat'}</div>
                <div class="kop-sub" style="font-size: 8pt; color: #444;">Telp: ${lembaga.telepon || '-'} | Email: ${lembaga.email || '-'}</div>
              </td>
            </tr>
          </table>

          <div class="doc-title">JADWAL PELAKSANAAN UJIAN BERBASIS KOMPUTER (CBT)</div>
          <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 12px;">TAHUN AJARAN ${sop.tahun_ajaran || '2025/2026'}</div>

          <table class="content-table">
            <thead>
              <tr>
                <th style="width: 32px;">No</th>
                <th style="width: 150px; text-align: left; padding-left: 8px;">Hari, Tanggal</th>
                <th style="width: 95px;">Waktu (WIB)</th>
                <th style="width: 55px;">Durasi</th>
                <th style="width: 65px;">Jenis</th>
                <th style="text-align: left; padding-left: 8px;">Mata Pelajaran</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:15px;">Belum ada jadwal ujian yang terdaftar.</td></tr>'}
            </tbody>
          </table>

          <div class="ttd-container">
            <div class="ttd-box">
              <p style="margin: 0;">Mengetahui,</p>
              <p style="margin: 2px 0 0 0; font-weight: bold;">Kepala Sekolah,</p>
              <div style="height: 65px;"></div>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${kepsekNama}</p>
              <p style="margin: 2px 0 0 0; font-size: 9pt; color: #444;">NIP. ${kepsekNip}</p>
            </div>
            <div class="ttd-box">
              <p style="margin: 0;">${sop.titimangsa_tempat || 'Compreng'}, ${formatDateIndo(sop.titimangsa_tanggal || new Date().toISOString().split('T')[0])}</p>
              <p style="margin: 2px 0 0 0; font-weight: bold;">Ketua Panitia CBT,</p>
              ${ttdKetuaHtml}
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${ketuaNama}</p>
              <p style="margin: 2px 0 0 0; font-size: 9pt; color: #444;">NIP. ${ketuaNip}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      let iframe = document.getElementById('print-rekap-iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'print-rekap-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(printHtml);
      doc.close();
      iframe.contentWindow.focus();
      setTimeout(() => {
        iframe.contentWindow.print();
      }, 500);
    } catch (e) {
      console.error('Error print rekap on web:', e);
      window.print();
    }
  };

  // Helper: Pemetaan Default Ruang Berdasarkan Kelas Asal Siswa (Prioritas data_kelas)
  const getRuangDefaultForSiswa = (siswa, kList, rList) => {
    const sKelas = (siswa?.kelas || '').trim().toLowerCase();

    // 1. Cek dari data_kelas: jika kelas siswa memiliki ruang_id di data_kelas, gunakan langsung!
    const matchedK = (kList || []).find((k) => (k.nama_kelas || '').trim().toLowerCase() === sKelas);
    if (matchedK && matchedK.ruang_id) {
      const foundR = (rList || []).find((r) => Number(r.id) === Number(matchedK.ruang_id));
      if (foundR) {
        return String(foundR.id);
      }
    }

    // Ruangan non-kantor umum (hanya mengecualikan ruang yang bernama persis kantor/teras kantor)
    const validRuang = (rList || []).filter((r) => {
      const nr = (r.nama_ruang || '').trim().toLowerCase();
      return nr !== 'kantor' && nr !== 'teras' && nr !== 'teras kantor';
    });

    // 2. Pencocokan cerdas teks nama kelas dengan nama ruang (jika di data_kelas belum diatur)
    if (sKelas.includes('vii') || sKelas.startsWith('7')) {
      const r7 = validRuang.find(
        (r) => r.nama_ruang.toLowerCase().includes('7') || r.nama_ruang.toLowerCase().includes('vii')
      );
      if (r7) return String(r7.id);
    }
    if (sKelas.includes('viii') || sKelas.startsWith('8')) {
      const r8 = validRuang.find(
        (r) => r.nama_ruang.toLowerCase().includes('8') || r.nama_ruang.toLowerCase().includes('viii')
      );
      if (r8) return String(r8.id);
    }
    if (sKelas.includes('ix-a') || sKelas.includes('9-a') || sKelas.includes('9a')) {
      const r9a = validRuang.find((r) => {
        const nr = r.nama_ruang.toLowerCase().replace(/[\s-]/g, '');
        return nr.includes('9a') || nr.includes('ixa');
      });
      if (r9a) return String(r9a.id);
    }
    if (sKelas.includes('ix-b') || sKelas.includes('9-b') || sKelas.includes('9b')) {
      const r9b = validRuang.find((r) => {
        const nr = r.nama_ruang.toLowerCase().replace(/[\s-]/g, '');
        return nr.includes('9b') || nr.includes('ixb');
      });
      if (r9b) return String(r9b.id);
    }
    if (sKelas.includes('ix-c') || sKelas.includes('9-c') || sKelas.includes('9c')) {
      const r9c = validRuang.find((r) => {
        const nr = r.nama_ruang.toLowerCase().replace(/[\s-]/g, '');
        return nr.includes('9c') || nr.includes('ixc');
      });
      if (r9c) return String(r9c.id);
    }
    if (sKelas.includes('ix') || sKelas.startsWith('9')) {
      const r9 = validRuang.find(
        (r) => r.nama_ruang.toLowerCase().includes('9') || r.nama_ruang.toLowerCase().includes('ix')
      );
      if (r9) return String(r9.id);
    }

    if (matchedK && matchedK.ruang_id) return String(matchedK.ruang_id);
    if (validRuang.length > 0) return String(validRuang[0].id);
    return rList?.[0] ? String(rList[0].id) : '1';
  };

  // Handlers Pengaturan Ruang Peserta
  const handleOpenRuangPesertaModal = async (jadwal) => {
    const target = jadwal || (jadwalList.length > 0 ? jadwalList[0] : null);
    if (!target) {
      Swal.fire('Peringatan', 'Tidak ada jadwal ujian yang dipilih.', 'warning');
      return;
    }
    setTargetJadwalForRuang(target);
    setApplyToAllJadwal(true);
    setIsRuangPesertaModalOpen(true);
    setLoadingRuangPeserta(true);

    try {
      const { data: sData } = await supabase
        .from('data_siswa')
        .select('id, nama, nipd, nisn, kelas, status_keaktifan')
        .eq('status_keaktifan', 'Aktif')
        .neq('kelas', 'Calon Siswa')
        .order('kelas', { ascending: true })
        .order('nama', { ascending: true });

      const allSiswa = sData || [];
      setSiswaPesertaList(allSiswa);

      // Coba ambil alokasi untuk target spesifik terlebih dahulu
      let { data: existingAlloc } = await supabase
        .from('cbt_peserta_ruang')
        .select('siswa_id, ruang_id, jadwal_id')
        .eq('jadwal_id', target.id);

      // Jika jadwal spesifik ini belum memiliki alokasi, cari alokasi yang sudah pernah diatur dari jadwal mana pun
      if (!existingAlloc || existingAlloc.length === 0) {
        const { data: anyAlloc } = await supabase
          .from('cbt_peserta_ruang')
          .select('siswa_id, ruang_id, jadwal_id')
          .order('id', { ascending: false });
        if (anyAlloc && anyAlloc.length > 0) {
          const fallbackJId = anyAlloc[0].jadwal_id;
          existingAlloc = anyAlloc.filter(a => a.jadwal_id === fallbackJId);
        }
      }

      const currentMode = target.mode_ruang || 'default';
      setModeRuang(currentMode);

      const allRIds = (ruangList || []).map((r) => String(r.id));
      setSelectedActiveRuangIds(allRIds);

      const newMap = {};
      if (existingAlloc && existingAlloc.length > 0) {
        existingAlloc.forEach((a) => {
          newMap[String(a.siswa_id)] = String(a.ruang_id);
        });
      } else {
        allSiswa.forEach((s) => {
          const targetRId = getRuangDefaultForSiswa(s, kelasList, ruangList);
          newMap[String(s.id)] = String(targetRId);
        });
      }
      setAlokasiRuangMap(newMap);

      // Inisialisasi ruangan target untuk mode custom (prioritas ruang kelas non kantor)
      const firstClassroom = (ruangList || []).find((r) => !r.nama_ruang.toLowerCase().includes('kantor')) || ruangList?.[0];
      if (firstClassroom) {
        setCustomTargetRuangId(String(firstClassroom.id));
      }
    } catch (err) {
      console.error('Error open pengaturan ruang peserta on web:', err);
    } finally {
      setLoadingRuangPeserta(false);
    }
  };

  const handleAcakRuangan = () => {
    if (selectedActiveRuangIds.length === 0) {
      Swal.fire('Peringatan', 'Silakan pilih minimal 1 ruangan untuk pengacakan.', 'warning');
      return;
    }
    const shuffled = [...siswaPesertaList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const newMap = {};
    shuffled.forEach((s, idx) => {
      const rId = selectedActiveRuangIds[idx % selectedActiveRuangIds.length];
      newMap[String(s.id)] = String(rId);
    });
    setAlokasiRuangMap(newMap);
    Swal.fire('Berhasil Diacak', `${shuffled.length} peserta telah diacak merata ke ${selectedActiveRuangIds.length} ruangan aktif.`, 'success');
  };

  const handleResetToDefault = () => {
    const defMap = {};
    siswaPesertaList.forEach((s) => {
      const targetRId = getRuangDefaultForSiswa(s, kelasList, ruangList);
      defMap[String(s.id)] = String(targetRId);
    });
    setAlokasiRuangMap(defMap);
  };

  const handleSavePengaturanRuang = async () => {
    if (!targetJadwalForRuang?.id && (!jadwalList || jadwalList.length === 0)) return;
    try {
      setSavingRuangPeserta(true);

      const targetJadwalIds = applyToAllJadwal
        ? (jadwalList || []).map((j) => j.id)
        : [targetJadwalForRuang.id];

      // Update mode_ruang di cbt_jadwal_ujian
      await supabase
        .from('cbt_jadwal_ujian')
        .update({ mode_ruang: modeRuang })
        .in('id', targetJadwalIds);

      // Hapus alokasi lama untuk jadwal-jadwal target
      await supabase
        .from('cbt_peserta_ruang')
        .delete()
        .in('jadwal_id', targetJadwalIds);

      const payload = [];
      targetJadwalIds.forEach((jId) => {
        Object.entries(alokasiRuangMap)
          .filter(([_, rId]) => Boolean(rId))
          .forEach(([sId, rId], idx) => {
            payload.push({
              jadwal_id: jId,
              siswa_id: Number(sId),
              ruang_id: Number(rId),
              nomor_meja: idx + 1,
            });
          });
      });

      if (payload.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < payload.length; i += batchSize) {
          const batch = payload.slice(i, i + batchSize);
          const { error } = await supabase.from('cbt_peserta_ruang').insert(batch);
          if (error) throw error;
        }
      }

      Swal.fire(
        'Sukses',
        `Pengaturan ruang peserta berhasil disimpan dengan mode ${modeRuang.toUpperCase()}${
          targetJadwalIds.length > 1 ? ` untuk ${targetJadwalIds.length} jadwal pelaksanaan ujian` : ''
        }!`,
        'success'
      );
      setIsRuangPesertaModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error('Error save ruang peserta:', err);
      Swal.fire('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setSavingRuangPeserta(false);
    }
  };

  // Handlers Pengaturan Pengawas Setiap Ruangan
  const handleOpenPengawasRuangModal = async (jadwal) => {
    if (!jadwal) return;
    setTargetJadwalForPengawas(jadwal);
    setIsPengawasRuangModalOpen(true);
    setLoadingPengawasRuang(true);
    setGlobalPengawasId('');

    try {
      // 1. Ambil data ruangan yang terasosiasi dengan jadwal ini (cbt_peserta_ruang)
      let { data: pRuangData } = await supabase
        .from('cbt_peserta_ruang')
        .select('ruang_id')
        .eq('jadwal_id', jadwal.id);

      // Jika jadwal spesifik ini belum memiliki entri cbt_peserta_ruang, 
      // gunakan alokasi ruang peserta yang sudah diatur di halaman jadwal ujian
      if (!pRuangData || pRuangData.length === 0) {
        const { data: fallbackPRuang } = await supabase
          .from('cbt_peserta_ruang')
          .select('ruang_id');
        if (fallbackPRuang && fallbackPRuang.length > 0) {
          pRuangData = fallbackPRuang;
        }
      }

      const pesertaPerRuang = {};
      if (pRuangData && pRuangData.length > 0) {
        pRuangData.forEach((p) => {
          if (p.ruang_id) {
            pesertaPerRuang[p.ruang_id] = (pesertaPerRuang[p.ruang_id] || 0) + 1;
          }
        });
      }

      // 2. Ambil penugasan pengawas yang sudah tersimpan di cbt_berita_acara
      const { data: existingBA } = await supabase
        .from('cbt_berita_acara')
        .select('ruang_id, pengawas_guru_id')
        .eq('jadwal_id', jadwal.id);

      const existingPengawasMap = {};
      (existingBA || []).forEach((ba) => {
        if (ba.ruang_id) {
          existingPengawasMap[ba.ruang_id] = ba.pengawas_guru_id;
        }
      });

      // 3. Susun daftar ruangan berdasarkan pengaturan ruang ujian yang sudah ada
      const hasPesertaAllocation = Object.keys(pesertaPerRuang).length > 0;
      const targetRuangList = hasPesertaAllocation
        ? (ruangList || []).filter((r) => (pesertaPerRuang[r.id] || 0) > 0 || existingPengawasMap[r.id])
        : (ruangList || []).filter((r) => !r.nama_ruang.toLowerCase().includes('kantor'));

      const rooms = (targetRuangList.length > 0 ? targetRuangList : (ruangList || [])).map((r) => {
        const pesertaCount = pesertaPerRuang[r.id] || 0;
        const assignedGuruId = existingPengawasMap[r.id] || (existingBA?.length ? '' : (jadwal.pengawas_guru_id || ''));
        return {
          ruang_id: r.id,
          nama_ruang: r.nama_ruang,
          kode_ruang: r.kode_ruang || '',
          jumlah_peserta: pesertaCount,
          pengawas_guru_id: assignedGuruId ? String(assignedGuruId) : ''
        };
      });

      rooms.sort((a, b) => {
        return a.nama_ruang.localeCompare(b.nama_ruang, undefined, { numeric: true });
      });

      setPengawasRuangList(rooms);
    } catch (err) {
      console.error('Error open pengawas ruang modal:', err);
      Swal.fire('Error', 'Gagal memuat data pengawas ruangan.', 'error');
    } finally {
      setLoadingPengawasRuang(false);
    }
  };

  const handleSavePengawasRuang = async () => {
    if (!targetJadwalForPengawas) return;
    setSavingPengawasRuang(true);
    try {
      const upsertPayload = pengawasRuangList
        .filter((item) => Boolean(item.pengawas_guru_id) || item.jumlah_peserta > 0)
        .map((item) => ({
          jadwal_id: targetJadwalForPengawas.id,
          ruang_id: Number(item.ruang_id),
          pengawas_guru_id: item.pengawas_guru_id ? Number(item.pengawas_guru_id) : null
        }));

      if (upsertPayload.length > 0) {
        const { error: upsertErr } = await supabase
          .from('cbt_berita_acara')
          .upsert(upsertPayload, { onConflict: 'jadwal_id, ruang_id' });
        if (upsertErr) throw upsertErr;
      }

      const firstAssigned = pengawasRuangList.find((item) => Boolean(item.pengawas_guru_id));
      if (firstAssigned) {
        await supabase
          .from('cbt_jadwal_ujian')
          .update({ pengawas_guru_id: Number(firstAssigned.pengawas_guru_id) })
          .eq('id', targetJadwalForPengawas.id);
      }

      Swal.fire({
        icon: 'success',
        title: 'Pengawas Ruangan Disimpan',
        text: `Pengawas berhasil diatur untuk setiap ruangan pada sesi ujian "${targetJadwalForPengawas.nama_ujian}".`,
        timer: 1800,
        showConfirmButton: false
      });

      setIsPengawasRuangModalOpen(false);
      await fetchInitialData();
    } catch (err) {
      console.error('Error save pengawas ruang:', err);
      Swal.fire('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setSavingPengawasRuang(false);
    }
  };

  // Handler Buka Modal Pilih Ruangan Sebelum Awasi Ujian
  const handleOpenAwasiModal = async (jadwal) => {
    setTargetJadwalForAwasi(jadwal);
    // Ambil daftar ruangan yang memiliki peserta di cbt_peserta_ruang
    let { data: prData } = await supabase
      .from('cbt_peserta_ruang')
      .select('ruang_id, data_ruang(nama_ruang)')
      .eq('jadwal_id', jadwal.id);

    if (!prData || prData.length === 0) {
      const { data: latestPR } = await supabase
        .from('cbt_peserta_ruang')
        .select('jadwal_id')
        .order('id', { ascending: false })
        .limit(1);
      if (latestPR && latestPR.length > 0) {
        const { data: fbData } = await supabase
          .from('cbt_peserta_ruang')
          .select('ruang_id, data_ruang(nama_ruang)')
          .eq('jadwal_id', latestPR[0].jadwal_id);
        if (fbData && fbData.length > 0) prData = fbData;
      }
    }

    const mapR = new Map();
    (prData || []).forEach((p) => {
      if (p.ruang_id && !mapR.has(String(p.ruang_id))) {
        mapR.set(String(p.ruang_id), p.data_ruang?.nama_ruang || `Ruang ${p.ruang_id}`);
      }
    });

    let list = Array.from(mapR.entries()).map(([id, nama_ruang]) => ({ id, nama_ruang }));
    if (list.length === 0) {
      list = (ruangList || []).map((r) => ({ id: String(r.id), nama_ruang: r.nama_ruang }));
    }

    setAvailableRuangForAwasi(list);
    setSelectedRuangIdForAwasi(list[0]?.id || '1');
    setIsPilihRuangAwasiModalOpen(true);
  };

  const handleConfirmAwasi = () => {
    if (!targetJadwalForAwasi) return;
    setIsPilihRuangAwasiModalOpen(false);
    navigate(`/cbt/pengawas/${targetJadwalForAwasi.id}?ruangId=${selectedRuangIdForAwasi}`);
  };



  const todayName = getOperationalDayName();

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
                  kelas_id: '',
                  mapel_id: mapelList[0]?.id || '',
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

          {/* Tombol Pengaturan Ruang Peserta */}
          {isOPSOrPanitia && (
            <button
              onClick={() => handleOpenRuangPesertaModal(null)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-xl border border-blue-200 shadow-sm transition"
              title="Pengaturan Ruang Peserta Ujian"
            >
              <Building size={16} className="text-blue-600" />
              <span>Ruang Peserta</span>
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
            : jadwalList.filter(j => (String(j?.hari || calculateHari(j?.tanggal_ujian) || '')).toLowerCase() === hari.toLowerCase()).length;

          const isActive = filterHari === hari;
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
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs ${
                    isActive
                      ? 'bg-[#85c226] text-gray-950 ring-2 ring-white/50'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
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
                          {(String(j?.hari || calculateHari(j?.tanggal_ujian) || '')).toLowerCase() === todayName.toLowerCase() && (
                            <span className="px-2 py-0.5 bg-[#85c226] text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-xs animate-pulse">
                              Hari Ini
                            </span>
                          )}
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
                          <UserCheck size={14} className="text-teal-600 shrink-0" />
                          <span className="truncate">
                            Pengawas: {(() => {
                              const rProctors = jadwalPengawasRuangMap[j.id];
                              if (rProctors && rProctors.length > 0) {
                                return rProctors.map(rp => `${rp.nama_ruang} (${rp.guru_nama})`).join(' • ');
                              }
                              return j.pengawas?.nama || j.pengawas?.nama_guru || '-';
                            })()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1 text-xs text-gray-600 flex items-center gap-1.5">
                        <Users size={14} className="text-amber-500" />
                        <span className="truncate">Guru Pengampu: {j.guru_pengampu?.nama || j.guru_pengampu?.nama_guru || '-'}</span>
                      </div>

                      {/* Bank Soal Terhubung (Dinamis per tingkat untuk 1 Card Semua Kelas) */}
                      {(() => {
                        const mapelBanks = (bankSoalList || []).filter(b => Number(b.mapel_id) === Number(j.mapel_id));
                        const totalSoalAll = mapelBanks.reduce((sum, b) => sum + (Number(b.total_soal) || 0), 0);
                        return (
                          <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
                            <BookOpen size={13} className="text-purple-500 shrink-0" />
                            <span className="truncate">
                              Bank Soal:{' '}
                              {mapelBanks.length > 0 ? (
                                <>
                                  <strong>{mapelBanks.map(b => `Kls ${b.tingkat_kelas} (${b.total_soal || 0} butir)`).join(' • ')}</strong>
                                  <span className="text-gray-400 ml-1">({totalSoalAll} butir)</span>
                                </>
                              ) : j.cbt_bank_soal?.judul ? (
                                <strong>{j.cbt_bank_soal.judul} ({j.cbt_bank_soal.total_soal || 0} butir)</strong>
                              ) : (
                                <span className="text-rose-500 font-medium">Belum ada paket bank soal</span>
                              )}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* HAK AKSES PER ROLE PADA TOMBOL CARD JADWAL */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      {/* Skenario 1: OPS / Waka Kurikulum / Panitia -> 8 Tombol Lengkap */}
                      {isOPSOrPanitia ? (
                        <div className="space-y-2">
                          {/* Row Aksi Utama (Soal Ujian, Awasi, Pengawas Ruang) */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              onClick={() => handleOpenSoalModal(j)}
                              className="py-2 px-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                              title="Soal Ujian"
                            >
                              <BookOpen size={13} /> Soal Ujian
                            </button>

                            <button
                              onClick={() => handleOpenAwasiModal(j)}
                              className="py-2 px-2 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                              title="Awasi Ujian"
                            >
                              <Video size={13} /> Awasi Ujian
                            </button>

                            <button
                              onClick={() => handleOpenPengawasRuangModal(j)}
                              className="py-2 px-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                              title="Atur Pengawas Setiap Ruangan"
                            >
                              <UserCheck size={13} /> Pengawas
                            </button>
                          </div>

                          {/* Tombol Daftar Nilai */}
                          <button
                            onClick={() => navigate(`/cbt/nilai/${j.id}`)}
                            className="w-full py-1.5 px-3 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
                            title="Daftar Nilai"
                          >
                            <Award size={14} />
                            <span>Daftar Nilai</span>
                          </button>

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
                        /* Skenario 2: Guru Mapel Diampu -> Soal, Pengawas */
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleOpenSoalModal(j)}
                              className="py-2 px-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                            >
                              <BookOpen size={14} /> Soal Ujian
                            </button>

                            <button
                              onClick={() => handleOpenPengawasRuangModal(j)}
                              className="py-2 px-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
                              title="Atur Pengawas Setiap Ruangan"
                            >
                              <UserCheck size={14} /> Pengawas
                            </button>
                          </div>

                          <button
                            onClick={() => navigate(`/cbt/nilai/${j.id}`)}
                            className="w-full py-1.5 px-3 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
                            title="Daftar Nilai"
                          >
                            <Award size={14} />
                            <span>Daftar Nilai</span>
                          </button>


                        </div>
                      ) : isDiawasi ? (
                        /* Skenario 3: Guru Pengawas -> Awasi, Nilai */
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleOpenAwasiModal(j)}
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

      {/* Widget Pemantauan Kelengkapan Soal Seluruh Mata Pelajaran Ujian (Diletakkan di Urutan Terakhir Halaman) */}
      {statusKelengkapanSoalSemua && (
        <div className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs">
                <FileCheck size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-gray-900">
                    Status Kelengkapan Soal Seluruh Mata Pelajaran Ujian
                  </h3>
                  <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {statusKelengkapanSoalSemua.totalMapel} Mapel Terjadwal
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Monitoring kesiapan paket bank soal per tingkat kelas (7, 8, 9) untuk seluruh mata pelajaran yang diujikan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>{filteredStatusSudahAda.length} Sudah Ada Soal</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 shadow-2xs">
                <AlertCircle size={14} className="text-rose-600" />
                <span>{filteredStatusBelumAda.length} Belum Ada Soal</span>
              </span>
            </div>
          </div>

          {/* Filter Bar Pencarian Guru Pengampu & Mata Pelajaran */}
          <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 shrink-0">
              <Filter size={15} className="text-indigo-600" />
              <span>Filter Status Soal:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-2xl">
              {/* Filter Guru Pengampu (Searchable Dropdown) */}
              <SearchableSelect
                placeholder="Semua Guru Pengampu"
                searchPlaceholder="Ketik untuk mencari nama guru..."
                icon={Users}
                options={statusGuruFilterOptions}
                value={filterStatusGuru}
                onChange={setFilterStatusGuru}
              />

              {/* Filter Mata Pelajaran (Searchable Dropdown) */}
              <SearchableSelect
                placeholder="Semua Mata Pelajaran"
                searchPlaceholder="Ketik untuk mencari mata pelajaran..."
                icon={BookOpen}
                options={statusMapelFilterOptions}
                value={filterStatusMapel}
                onChange={setFilterStatusMapel}
              />
            </div>

            {/* Tombol Reset Filter */}
            {(filterStatusGuru || filterStatusMapel) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatusGuru('');
                  setFilterStatusMapel('');
                }}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Kolom 1: Sudah Ada Soal */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 bg-emerald-50/80 px-3.5 py-2 rounded-xl border border-emerald-100">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Mata Pelajaran & Kelas Siap ({filteredStatusSudahAda.length})</span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                  Siap Diujikan
                </span>
              </div>

              {filteredStatusSudahAda.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
                  {filterStatusGuru || filterStatusMapel
                    ? 'Tidak ada paket soal siap yang cocok dengan filter pencarian.'
                    : 'Belum ada paket soal yang selesai dibuat.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredStatusSudahAda.map((item, idx) => (
                    <div
                      key={`sudah-${idx}`}
                      className="p-3 bg-white hover:bg-emerald-50/30 rounded-2xl border border-emerald-100/90 shadow-2xs flex items-center justify-between gap-3 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800">
                            Kelas {item.tingkat}
                          </span>
                          <span className="text-xs font-bold text-gray-800">{item.mapelNama}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-gray-700">{item.bankJudul || 'Paket CBT'}</span>
                          {item.guruPengampuNama && (
                            <span className="text-amber-700 font-medium">
                              • Guru: {item.guruPengampuNama}
                            </span>
                          )}
                          {item.pengawasNama && (
                            <span className="text-indigo-600 font-semibold">• Pengawas: {item.pengawasNama}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.totalSoal} Soal
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(`/cbt/bank-soal?bankId=${item.bankId || ''}&mapelId=${item.mapelId}&tingkat=${item.tingkat}&jadwalId=${item.jadwalId}&jenisUjian=${encodeURIComponent(item.jenisUjian || 'PSTS')}`)}
                          className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Lihat Bank Soal"
                        >
                          <BookOpen size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kolom 2: Belum Ada Soal */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-rose-800 bg-rose-50/80 px-3.5 py-2 rounded-xl border border-rose-100">
                <span className="flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-rose-600" />
                  <span>Belum Ada Soal ({filteredStatusBelumAda.length})</span>
                </span>
                <span className="text-[11px] font-semibold text-rose-700 bg-white px-2 py-0.5 rounded-lg border border-rose-200">
                  Perlu Dibuat
                </span>
              </div>

              {filteredStatusBelumAda.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-emerald-200 rounded-2xl text-xs text-emerald-700 font-semibold bg-emerald-50/30">
                  {filterStatusGuru || filterStatusMapel
                    ? 'Tidak ada mata pelajaran belum ada soal yang cocok dengan filter pencarian.'
                    : '🎉 Luar biasa! Seluruh mata pelajaran dan kelas telah memiliki butir soal lengkap.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredStatusBelumAda.map((item, idx) => (
                    <div
                      key={`belum-${idx}`}
                      className="p-3 bg-white hover:bg-rose-50/30 rounded-2xl border border-rose-200/80 shadow-2xs flex items-center justify-between gap-3 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800">
                            Kelas {item.tingkat}
                          </span>
                          <span className="text-xs font-bold text-gray-800">{item.mapelNama}</span>
                        </div>
                        <div className="text-[11px] text-rose-600 font-medium mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span>{item.bankJudul ? `Paket ada (${item.totalSoal} butir soal)` : 'Paket bank soal belum dibuat'}</span>
                          {item.guruPengampuNama && (
                            <span className="text-amber-700 font-semibold">
                              • Guru: {item.guruPengampuNama}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/cbt/bank-soal?bankId=${item.bankId || ''}&mapelId=${item.mapelId}&tingkat=${item.tingkat}&jadwalId=${item.jadwalId}&jenisUjian=${encodeURIComponent(item.jenisUjian || 'PSTS')}`)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Buat Soal</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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
      {/* Modal Pengaturan Ruang Peserta (Default, Acak, Custom) */}
      {isRuangPesertaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                  <Building size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-800">Pengaturan Ruang Peserta</h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {applyToAllJadwal
                      ? `Semua Jadwal Ujian CBT (${jadwalList.length} Jadwal Terhubung)`
                      : (targetJadwalForRuang?.data_mapel?.nama_mapel || targetJadwalForRuang?.nama_ujian || 'Ujian CBT')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRuangPesertaModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {loadingRuangPeserta ? (
                <div className="py-16 text-center text-gray-400 font-medium text-xs">
                  Memuat data siswa & ruangan...
                </div>
              ) : (
                <>
                  {/* Mode Tabs */}
                  <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1.5 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => {
                        setModeRuang('default');
                        handleResetToDefault();
                      }}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                        modeRuang === 'default'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-gray-600 hover:bg-white/60'
                      }`}
                    >
                      <span>Default (Kelas)</span>
                    </button>
                    <button
                      onClick={() => setModeRuang('acak')}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                        modeRuang === 'acak'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-gray-600 hover:bg-white/60'
                      }`}
                    >
                      <Shuffle size={14} />
                      <span>Acak Ruangan</span>
                    </button>
                    <button
                      onClick={() => setModeRuang('custom')}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                        modeRuang === 'custom'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-gray-600 hover:bg-white/60'
                      }`}
                    >
                      <Users size={14} />
                      <span>Custom</span>
                    </button>
                  </div>

                  {/* Mode 1: Default (Sesuai Kelas Masing-masing Siswa) */}
                  {modeRuang === 'default' && (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900">
                        <p className="font-bold">Mode Default (Sesuai Kelas Siswa)</p>
                        <p className="text-[11px] text-blue-700 mt-0.5">
                          Setiap siswa otomatis ditempatkan di ruang kelasnya masing-masing (bukan kantor).
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-700">Ringkasan Penempatan Ruang Kelas :</p>
                          <button
                            type="button"
                            onClick={handleResetToDefault}
                            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            <RotateCcw size={12} /> Terapkan Ulang Ruang Kelas
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {kelasList.map((k) => {
                            const count = siswaPesertaList.filter(
                              (s) => (s.kelas || '').toLowerCase() === (k.nama_kelas || '').toLowerCase()
                            ).length;
                            const sampleSiswa = siswaPesertaList.find(
                              (s) => (s.kelas || '').toLowerCase() === (k.nama_kelas || '').toLowerCase()
                            );
                            const rId = sampleSiswa
                              ? (alokasiRuangMap[String(sampleSiswa.id)] || getRuangDefaultForSiswa(sampleSiswa, kelasList, ruangList))
                              : getRuangDefaultForSiswa({ kelas: k.nama_kelas }, kelasList, ruangList);
                            const r = ruangList.find((ru) => String(ru.id) === String(rId));
                            return (
                              <div
                                key={k.id}
                                className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between"
                              >
                                <div>
                                  <p className="text-xs font-black text-gray-800">Kelas {k.nama_kelas}</p>
                                  <p className="text-[11px] text-gray-500">{count} Siswa Terdaftar</p>
                                </div>
                                <span className="px-2.5 py-1 bg-white border border-gray-200 text-primary font-bold text-xs rounded-lg flex items-center gap-1">
                                  <Building size={12} className="text-blue-600" />
                                  {r?.nama_ruang || 'Ruang Kelas'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Acak Ruangan */}
                  {modeRuang === 'acak' && (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900">
                        <p className="font-bold">Mode Acak Ruangan (Distribusi Merata)</p>
                        <p className="text-[11px] text-blue-700 mt-0.5">
                          Pilih ruangan-ruangan yang aktif digunakan, lalu klik tombol "Acak Ruangan Sekarang".
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-gray-700 mb-2">Pilih Ruangan yang Aktif :</p>
                        <div className="flex flex-wrap gap-2">
                          {ruangList.map((r) => {
                            const isChecked = selectedActiveRuangIds.includes(String(r.id));
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  if (isChecked) {
                                    setSelectedActiveRuangIds((prev) => prev.filter((id) => id !== String(r.id)));
                                  } else {
                                    setSelectedActiveRuangIds((prev) => [...prev, String(r.id)]);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
                                  isChecked
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <span className="w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px]">
                                  {isChecked ? '✓' : ''}
                                </span>
                                <span>{r.nama_ruang}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleAcakRuangan}
                          className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
                        >
                          <Shuffle size={15} />
                          <span>Acak Ruangan Sekarang</span>
                        </button>
                      </div>

                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-bold text-gray-700">Hasil Distribusi per Ruangan :</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {ruangList
                            .filter((r) => selectedActiveRuangIds.includes(String(r.id)))
                            .map((r) => {
                              const count = Object.values(alokasiRuangMap).filter(
                                (rId) => String(rId) === String(r.id)
                              ).length;
                              return (
                                <div
                                  key={r.id}
                                  className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between"
                                >
                                  <div>
                                    <p className="text-xs font-black text-gray-800">{r.nama_ruang}</p>
                                    <p className="text-[11px] text-gray-500">Ruang Ujian CBT</p>
                                  </div>
                                  <span className="px-2.5 py-1 bg-emerald-600 text-white font-extrabold text-xs rounded-lg">
                                    {count} Siswa
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 3: Custom (UI/UX & Logika Checklist Seperti Ruang Ngaji) */}
                  {modeRuang === 'custom' && (
                    <div className="space-y-4">
                      {/* Pilihan Ruangan Tujuan */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                          <Building size={14} className="text-primary" />
                          <span>Pilih Ruangan Tujuan Penempatan :</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {ruangList.map((r) => {
                            const isSelected = String(customTargetRuangId) === String(r.id);
                            const countInThisRoom = Object.values(alokasiRuangMap).filter(
                              (rId) => String(rId) === String(r.id)
                            ).length;
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setCustomTargetRuangId(String(r.id))}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                <span>{r.nama_ruang}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {countInThisRoom}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Info Ruangan Aktif */}
                      <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs text-blue-900">
                        <div>
                          <p className="font-bold">
                            Ruangan Aktif: {ruangList.find((r) => String(r.id) === String(customTargetRuangId))?.nama_ruang || 'Pilih Ruangan'}
                          </p>
                          <p className="text-[11px] text-blue-700 mt-0.5">
                            Centang siswa di bawah untuk menempatkannya ke ruangan ini (cukup gunakan checklist).
                          </p>
                        </div>
                        <div className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 text-primary font-black text-xs shadow-xs">
                          {Object.values(alokasiRuangMap).filter((rId) => String(rId) === String(customTargetRuangId)).length} Dicentang
                        </div>
                      </div>

                      {/* Filter & Search */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                          <input
                            type="text"
                            placeholder="Cari nama, NISN, atau kelas..."
                            value={searchSiswaRuang}
                            onChange={(e) => setSearchSiswaRuang(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <select
                          value={filterKelasRuang}
                          onChange={(e) => setFilterKelasRuang(e.target.value)}
                          className="text-xs border border-gray-200 rounded-xl p-2.5 bg-white font-bold text-gray-700 outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="Semua">Semua Kelas</option>
                          {kelasList.map((k) => (
                            <option key={k.id} value={k.nama_kelas}>
                              Kelas {k.nama_kelas}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Tabel Siswa dengan Checklist */}
                      {(() => {
                        const filteredSiswa = siswaPesertaList.filter((s) => {
                          const matchKls =
                            filterKelasRuang === 'Semua' ||
                            (s.kelas || '').toLowerCase() === filterKelasRuang.toLowerCase();
                          const matchQuery =
                            !searchSiswaRuang ||
                            (s.nama || '').toLowerCase().includes(searchSiswaRuang.toLowerCase()) ||
                            (s.nisn || '').includes(searchSiswaRuang) ||
                            (s.nipd || '').includes(searchSiswaRuang);
                          return matchKls && matchQuery;
                        });

                        const isAllFilteredChecked =
                          filteredSiswa.length > 0 &&
                          filteredSiswa.every((s) => String(alokasiRuangMap[String(s.id)]) === String(customTargetRuangId));

                        const handleToggleAll = (checked) => {
                          setAlokasiRuangMap((prev) => {
                            const next = { ...prev };
                            filteredSiswa.forEach((s) => {
                              if (checked) {
                                next[String(s.id)] = String(customTargetRuangId);
                              } else if (String(next[String(s.id)]) === String(customTargetRuangId)) {
                                delete next[String(s.id)];
                              }
                            });
                            return next;
                          });
                        };

                        const handleToggleSiswa = (siswaId) => {
                          setAlokasiRuangMap((prev) => {
                            const next = { ...prev };
                            const cur = String(next[String(siswaId)]);
                            if (cur === String(customTargetRuangId)) {
                              delete next[String(siswaId)];
                            } else {
                              next[String(siswaId)] = String(customTargetRuangId);
                            }
                            return next;
                          });
                        };

                        return (
                          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0 z-10 border-b border-gray-200">
                                <tr>
                                  <th className="p-2.5 w-12 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isAllFilteredChecked}
                                      onChange={(e) => handleToggleAll(e.target.checked)}
                                      className="w-4 h-4 cursor-pointer text-primary rounded"
                                    />
                                  </th>
                                  <th className="p-2.5">Nama Siswa</th>
                                  <th className="p-2.5">Kelas Asal</th>
                                  <th className="p-2.5">Ruang Saat Ini</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {filteredSiswa.length === 0 ? (
                                  <tr>
                                    <td colSpan={4} className="p-6 text-center text-gray-400">
                                      Tidak ada siswa yang sesuai pencarian.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredSiswa.map((s) => {
                                    const assignedRuangId = alokasiRuangMap[String(s.id)];
                                    const isChecked = String(assignedRuangId) === String(customTargetRuangId);
                                    const assignedRuang = ruangList.find((r) => String(r.id) === String(assignedRuangId));

                                    return (
                                      <tr
                                        key={s.id}
                                        onClick={() => handleToggleSiswa(s.id)}
                                        className={`cursor-pointer transition hover:bg-blue-50/60 ${
                                          isChecked ? 'bg-blue-50/40' : ''
                                        }`}
                                      >
                                        <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleSiswa(s.id)}
                                            className="w-4 h-4 cursor-pointer text-primary rounded"
                                          />
                                        </td>
                                        <td className="p-2.5 font-bold text-gray-800">
                                          <div>{s.nama}</div>
                                          <div className="text-[10px] text-gray-400 font-mono">
                                            NISN: {s.nisn || '-'} • NIPD: {s.nipd || '-'}
                                          </div>
                                        </td>
                                        <td className="p-2.5 font-semibold text-gray-600">Kelas {s.kelas}</td>
                                        <td className="p-2.5">
                                          {isChecked ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                              ✓ {assignedRuang?.nama_ruang || 'Ruang Ini'}
                                            </span>
                                          ) : assignedRuang ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
                                              {assignedRuang.nama_ruang}
                                            </span>
                                          ) : (
                                            <span className="text-gray-400 italic text-[11px]">Belum ada ruang</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 bg-blue-50/70 hover:bg-blue-100/70 px-3 py-1.5 rounded-xl border border-blue-200 transition">
                <input
                  type="checkbox"
                  checked={applyToAllJadwal}
                  onChange={(e) => setApplyToAllJadwal(e.target.checked)}
                  className="w-4 h-4 text-primary rounded focus:ring-primary cursor-pointer"
                />
                <span>Terapkan ke <b>Semua Jadwal Ujian CBT</b> ({jadwalList.length} jadwal)</span>
              </label>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsRuangPesertaModalOpen(false)}
                  disabled={savingRuangPeserta}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePengaturanRuang}
                  disabled={savingRuangPeserta}
                  className="px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  {savingRuangPeserta ? 'Menyimpan...' : 'Simpan Alokasi Ruang'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN PENGAWAS SETIAP RUANGAN */}
      {isPengawasRuangModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col my-8 border border-gray-100 max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-teal-700 to-emerald-800 text-white flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <UserCheck size={22} className="text-teal-200" />
                  <h3 className="text-lg font-bold">Atur Pengawas Setiap Ruangan</h3>
                </div>
                <p className="text-xs text-teal-100 mt-1">
                  {targetJadwalForPengawas?.nama_ujian} • {targetJadwalForPengawas?.data_mapel?.nama_mapel}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="bg-black/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-white/10">
                    {targetJadwalForPengawas?.hari}, {targetJadwalForPengawas?.tanggal_ujian}
                  </span>
                  <span className="bg-black/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-white/10">
                    {targetJadwalForPengawas?.jam_mulai?.slice(0, 5)} - {targetJadwalForPengawas?.jam_selesai?.slice(0, 5)} WIB
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPengawasRuangModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Quick Bulk Assign Bar */}
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-bold text-teal-900 mb-1">
                    Terapkan Satu Pengawas ke Semua Ruangan:
                  </label>
                  <select
                    value={globalPengawasId}
                    onChange={(e) => setGlobalPengawasId(e.target.value)}
                    className="w-full bg-white border border-teal-300 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    <option value="">-- Pilih Guru Pengawas Serentak --</option>
                    {guruList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nama}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!globalPengawasId) {
                      Swal.fire('Peringatan', 'Silakan pilih guru pengawas terlebih dahulu.', 'warning');
                      return;
                    }
                    setPengawasRuangList(prev => prev.map(item => ({
                      ...item,
                      pengawas_guru_id: String(globalPengawasId)
                    })));
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer mt-auto"
                >
                  <Check size={14} /> Terapkan ke Semua
                </button>
              </div>

              {/* Room List */}
              {loadingPengawasRuang ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                  <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs font-semibold">Memuat daftar ruangan dan penugasan pengawas...</p>
                </div>
              ) : pengawasRuangList.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <Building size={36} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-semibold">Tidak ada data ruangan ditemukan.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 px-1 font-semibold">
                    <span>Ruangan Ujian ({pengawasRuangList.length} Ruang Tersedia)</span>
                    <span>Guru Pengawas Ruang</span>
                  </div>

                  {pengawasRuangList.map((item, index) => {
                    const isAssigned = Boolean(item.pengawas_guru_id);
                    return (
                      <div
                        key={item.ruang_id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isAssigned
                            ? 'bg-white border-teal-200 shadow-xs'
                            : 'bg-gray-50/60 border-gray-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Ruang Info */}
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isAssigned ? 'bg-teal-100 text-teal-800' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-900 text-sm">{item.nama_ruang}</h4>
                                {item.kode_ruang && (
                                  <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                                    {item.kode_ruang}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {item.jumlah_peserta > 0 ? (
                                  <span className="text-emerald-600 font-semibold">{item.jumlah_peserta} Peserta Terdaftar</span>
                                ) : (
                                  <span>Ruangan Opsional / Cadangan</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Proctor Select */}
                          <div className="w-full sm:w-64">
                            <select
                              value={item.pengawas_guru_id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPengawasRuangList(prev => prev.map(p => 
                                  p.ruang_id === item.ruang_id ? { ...p, pengawas_guru_id: val } : p
                                ));
                              }}
                              className={`w-full text-xs font-semibold rounded-xl px-3 py-2 border outline-none transition cursor-pointer ${
                                isAssigned 
                                  ? 'border-teal-400 bg-teal-50/30 text-teal-950 font-bold focus:ring-2 focus:ring-teal-500' 
                                  : 'border-gray-300 bg-white text-gray-600 focus:ring-2 focus:ring-primary'
                              }`}
                            >
                              <option value="">-- Pilih Pengawas --</option>
                              {guruList.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.nama}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsPengawasRuangModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePengawasRuang}
                disabled={savingPengawasRuang}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check size={16} />
                <span>{savingPengawasRuang ? 'Menyimpan...' : 'Simpan Pengawas Ruangan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup Pilih Ruangan Pengawasan */}
      {isPilihRuangAwasiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
                  <Video size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Pilih Ruang Pengawasan</h3>
                  <p className="text-xs text-red-100 font-medium mt-0.5">
                    {targetJadwalForAwasi?.data_mapel?.nama_mapel || targetJadwalForAwasi?.nama_ujian}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPilihRuangAwasiModalOpen(false)}
                className="p-1.5 hover:bg-white/20 text-white/80 hover:text-white rounded-full transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Pilih Ruang Ujian yang Diawasi :
                </label>
                <div className="relative">
                  <Building size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedRuangIdForAwasi}
                    onChange={(e) => setSelectedRuangIdForAwasi(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:bg-white transition"
                  >
                    {availableRuangForAwasi.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nama_ruang}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-2">
                  Anda akan masuk ke monitor pengawasan khusus ruangan ini sehingga sistem bekerja sangat ringan dan cepat.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsPilihRuangAwasiModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmAwasi}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Video size={14} /> Mulai Awasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}