import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../../services/supabaseClient';
import { 
  DollarSign, ChevronLeft, Calendar, Printer, Search, Eye, FileText, 
  X, CheckCircle, Clock, Award, ShieldCheck, User, Edit3, Save, 
  Settings, Plus, Trash2, Sparkles, CheckSquare, Square, ChevronDown 
} from 'lucide-react-native';
import { router } from 'expo-router';
import { 
  terbilang, 
  bulanNames, 
  formatPeriodeBulan, 
  generateSingleSlipHtml, 
  generateCompletePrintPage, 
  SingleSlipData 
} from '../utils/slipHonorHelper';

export default function RekapHonorGuruScreen() {
  const [guruList, setGuruList] = useState<any[]>([]);
  const [jabatanGuruMap, setJabatanGuruMap] = useState<Record<number, any>>({});
  const [dataJabatanList, setDataJabatanList] = useState<any[]>([]);
  const [presensiGuruList, setPresensiGuruList] = useState<any[]>([]);
  const [presensiKbmList, setPresensiKbmList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [mapelList, setMapelList] = useState<any[]>([]);
  const [apresiasiKinerjaMap, setApresiasiKinerjaMap] = useState<Record<number, { id?: number; nominal: number; keteranganList: string[] }>>({});
  const [dataLembaga, setDataLembaga] = useState<any>(null);

  const [canEditApresiasi, setCanEditApresiasi] = useState(false);
  const [canViewAll, setCanViewAll] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBulanList, setSelectedBulanList] = useState<number[]>([new Date().getMonth() + 1]);
  const [selectedTahun, setSelectedTahun] = useState<number>(new Date().getFullYear());
  const [monthModalOpen, setMonthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Guru Checklist Filter State
  const [selectedGuruIdList, setSelectedGuruIdList] = useState<any[]>([]);
  const [guruModalOpen, setGuruModalOpen] = useState(false);
  const [guruSearchModal, setGuruSearchModal] = useState('');

  // Modal State Detail
  const [selectedGuruDetail, setSelectedGuruDetail] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Modal State Apresiasi Kinerja
  const [apresiasiModalOpen, setApresiasiModalOpen] = useState(false);
  const [apresiasiForm, setApresiasiForm] = useState<{ guru_id: number; guru_nama: string; nominal: string; keterangan: string; bulan: number }>({
    guru_id: 0,
    guru_nama: '',
    nominal: '',
    keterangan: '',
    bulan: new Date().getMonth() + 1
  });
  const [isSavingApresiasi, setIsSavingApresiasi] = useState(false);
  const [masterJenisApresiasi, setMasterJenisApresiasi] = useState<any[]>([]);
  const [crudMasterModalOpen, setCrudMasterModalOpen] = useState(false);
  const [editingJenis, setEditingJenis] = useState<any>(null);
  const [jenisForm, setJenisForm] = useState<{ nama_apresiasi: string; nominal_default: string }>({
    nama_apresiasi: '',
    nominal_default: ''
  });
  const [isSavingJenis, setIsSavingJenis] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedBulanList, selectedTahun]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 0. Cek hak akses:
      const userStr = await AsyncStorage.getItem('user_guru');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          setCurrentUser(userObj);
          let authorizedToViewAll = userObj?.role === 'admin';

          if (userObj?.id) {
            const { data: jData } = await supabase.from('jabatan_guru').select('*').eq('guru_id', userObj.id).maybeSingle();
            if (jData) {
              const roles = [jData.jabatan_utama, jData.jabatan_lain_1, jData.jabatan_lain_2, jData.jabatan_lain_3].filter(Boolean);
              authorizedToViewAll = roles.some((r: string) => {
                const lower = (r || '').toLowerCase();
                return lower.includes('operator') || lower.includes('bendahara') || lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('admin');
              });
            }
          }
          setCanViewAll(authorizedToViewAll);
          setCanEditApresiasi(authorizedToViewAll);
        } catch (e) {
          console.error('Error parse user_guru:', e);
        }
      }

      const { data: lembaga } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (lembaga) setDataLembaga(lembaga);

      const { data: guru, error: errGuru } = await supabase
        .from('data_guru')
        .select('*')
        .is('tanggal_keluar', null)
        .order('nama', { ascending: true });
      if (errGuru) throw errGuru;
      setGuruList(guru || []);
      setSelectedGuruIdList((prev) => {
        if (prev.length === 0 && guru && guru.length > 0) {
          return guru.map((g: any) => g.id);
        }
        return prev;
      });

      const { data: jabatan } = await supabase.from('data_jabatan').select('*');
      setDataJabatanList(jabatan || []);

      const { data: jGuru } = await supabase.from('jabatan_guru').select('*');
      const jMap: Record<number, any> = {};
      (jGuru || []).forEach((jg) => {
        jMap[jg.guru_id] = jg;
      });
      setJabatanGuruMap(jMap);

      // Fetch Kelas
      const { data: kelas } = await supabase.from('data_kelas').select('*');
      setKelasList(kelas || []);

      // Fetch Mapel & Jadwal
      const { data: mapel } = await supabase.from('data_mapel').select('*');
      setMapelList(mapel || []);

      const { data: jadwal } = await supabase.from('jadwal_pelajaran').select('*').is('is_istirahat', false);
      setJadwalList(jadwal || []);

      const safeBulanList = selectedBulanList.length > 0 ? selectedBulanList : [new Date().getMonth() + 1];
      const minMonth = Math.min(...safeBulanList);
      const maxMonth = Math.max(...safeBulanList);
      const startMonthStr = `${selectedTahun}-${String(minMonth).padStart(2, '0')}-01`;
      const endMonthStr = `${selectedTahun}-${String(maxMonth).padStart(2, '0')}-31`;

      const { data: presensi } = await supabase
        .from('presensi_guru')
        .select('*')
        .gte('tanggal', startMonthStr)
        .lte('tanggal', endMonthStr);

      const filteredPresensi = (presensi || []).filter((p) => {
        if (!p.tanggal) return false;
        const m = parseInt(p.tanggal.substring(5, 7), 10);
        return safeBulanList.includes(m);
      });
      setPresensiGuruList(filteredPresensi);

      const { data: kbm } = await supabase
        .from('presensi_kbm_guru')
        .select('*')
        .gte('tanggal', startMonthStr)
        .lte('tanggal', endMonthStr);

      const filteredKbm = (kbm || []).filter((k) => {
        if (!k.tanggal) return false;
        const m = parseInt(k.tanggal.substring(5, 7), 10);
        return safeBulanList.includes(m);
      });
      setPresensiKbmList(filteredKbm);

      // Fetch Apresiasi Kinerja Guru
      const { data: apresiasiList } = await supabase
        .from('apresiasi_kinerja_guru')
        .select('*')
        .in('bulan', safeBulanList)
        .eq('tahun', selectedTahun);

      const apMap: Record<number, { id?: number; nominal: number; keteranganList: string[] }> = {};
      (apresiasiList || []).forEach((item: any) => {
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
      await fetchMasterJenis();

    } catch (err: any) {
      console.error('Fetch error:', err);
      Alert.alert('Error', 'Gagal mengambil data rekap honor.');
    } finally {
      setLoading(false);
    }
  };

  // Helper membuat keterangan jadwal mengajar (e.g. - Informatika : 12 JP/Pekan \n - Nahwu Kelas 7 : 2 JP/Pekan)
  const getGuruMapelKeterangan = (guruId: number): string => {
    const myJadwal = (jadwalList || []).filter((j) => String(j.guru_id) === String(guruId));
    if (myJadwal.length === 0) return '';

    const mapelNameMap: Record<number, string> = {};
    (mapelList || []).forEach((m) => {
      mapelNameMap[m.id] = m.nama_mapel;
    });

    const kelasNameMap: Record<number, string> = {};
    (kelasList || []).forEach((k) => {
      kelasNameMap[k.id] = k.nama_kelas;
    });

    const grouped: Record<string, { totalJp: number; classes: Set<string> }> = {};
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
  const calculateTeacherHonor = (guruId: number) => {
    const jg = jabatanGuruMap[guruId];
    const numBulan = selectedBulanList.length || 1;

    // 1. Tunjangan Jabatan (Operator, Tata Usaha, Kepala Sekolah, Panitia, dsb)
    let tunjanganJabatanPerBulan = 0;
    const jabatanNames: string[] = [];

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

    let volNgaji: string | number = '';
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
      // 6-row slip components
      rowJabatan,
      rowMapel,
      rowNgaji,
      rowKehadiran,
      rowWali,
      rowApresiasi
    };
  };

  // Batasi hanya akun yang login jika bukan Operator, Bendahara, atau Kepala Sekolah
  const availableGuru = canViewAll
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

  const totalHonorSeluruh = filteredGuru.reduce((sum, g) => {
    const calc = calculateTeacherHonor(g.id);
    return sum + calc.totalHonorBersih;
  }, 0);

  // Guru checklist filter actions
  const toggleGuru = (guruId: any) => {
    if (selectedGuruIdList.includes(guruId)) {
      if (selectedGuruIdList.length === 1) {
        Alert.alert('Perhatian', 'Minimal satu guru harus dipilih.');
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
      Alert.alert('Reset Pilihan', 'Disisakan 1 guru terpilih.');
    }
  };

  const getGuruFilterSummary = (): string => {
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

  // Month checklist filter actions
  const toggleBulan = (bulanNum: number) => {
    if (selectedBulanList.includes(bulanNum)) {
      if (selectedBulanList.length === 1) {
        Alert.alert('Perhatian', 'Minimal satu bulan harus dipilih.');
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

  const getBulanFilterSummary = (): string => {
    if (selectedBulanList.length === 1) {
      return bulanNames[selectedBulanList[0] - 1];
    }
    if (selectedBulanList.length === 12) {
      return 'Semua Bulan (12)';
    }
    const sorted = [...selectedBulanList].sort((a, b) => a - b);
    return `${bulanNames[sorted[0] - 1].substring(0, 3)} - ${bulanNames[sorted[sorted.length - 1] - 1].substring(0, 3)} (${selectedBulanList.length} Bln)`;
  };

  const openDetail = (guru: any) => {
    const calc = calculateTeacherHonor(guru.id);
    setSelectedGuruDetail({ ...guru, ...calc });
    setDetailModalOpen(true);
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
      console.error('Fetch master jenis error:', e);
    }
  };

  const openEditApresiasi = (guru: any) => {
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

  const handleJenisSelect = (selectedNama: string) => {
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

  const handleSaveJenis = async () => {
    if (!jenisForm.nama_apresiasi.trim()) {
      Alert.alert('Perhatian', 'Nama jenis apresiasi tidak boleh kosong.');
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
        Alert.alert('Berhasil', 'Jenis apresiasi berhasil diperbarui.');
      } else {
        const { error } = await supabase
          .from('master_jenis_apresiasi')
          .insert({
            nama_apresiasi: jenisForm.nama_apresiasi.trim(),
            nominal_default: numNominal
          });
        if (error) throw error;
        Alert.alert('Berhasil', 'Jenis apresiasi baru berhasil ditambahkan.');
      }
      setEditingJenis(null);
      setJenisForm({ nama_apresiasi: '', nominal_default: '' });
      await fetchMasterJenis();
    } catch (err: any) {
      console.error('Save jenis error:', err);
      Alert.alert('Gagal', err.message || 'Gagal menyimpan jenis apresiasi.');
    } finally {
      setIsSavingJenis(false);
    }
  };

  const handleDeleteJenis = (id: number, nama: string) => {
    Alert.alert(
      'Hapus Pilihan?',
      `Yakin ingin menghapus opsi "${nama}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('master_jenis_apresiasi').delete().eq('id', id);
              if (error) throw error;
              await fetchMasterJenis();
            } catch (err: any) {
              Alert.alert('Gagal', err.message || 'Gagal menghapus jenis apresiasi.');
            }
          }
        }
      ]
    );
  };

  const handleSaveApresiasi = async () => {
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

      setApresiasiModalOpen(false);
      Alert.alert('Berhasil', `Apresiasi kinerja untuk ${apresiasiForm.guru_nama} berhasil disimpan.`);
      fetchData();
    } catch (err: any) {
      console.error('Save apresiasi error:', err);
      Alert.alert('Gagal', 'Gagal menyimpan apresiasi kinerja.');
    } finally {
      setIsSavingApresiasi(false);
    }
  };

  // Print single slip (Format Gambar 1)
  const printSingleSlip = async (guru: any) => {
    let Print: any;
    try {
      Print = require('expo-print');
    } catch (e) {
      Alert.alert('Perhatian', 'Fitur cetak membutuhkan modul expo-print.');
      return;
    }

    const calc = calculateTeacherHonor(guru.id);
    const slipData: SingleSlipData = {
      guruNama: guru.nama,
      rowJabatan: calc.rowJabatan,
      rowMapel: calc.rowMapel,
      rowNgaji: calc.rowNgaji,
      rowKehadiran: calc.rowKehadiran,
      rowWali: calc.rowWali,
      rowApresiasi: calc.rowApresiasi,
      totalHonor: calc.totalHonorBersih
    };
    const periodeText = formatPeriodeBulan(selectedBulanList, selectedTahun);
    const singleHtml = generateSingleSlipHtml(slipData, dataLembaga, periodeText);
    const fullHtml = generateCompletePrintPage(singleHtml);

    try {
      await Print.printAsync({ html: fullHtml });
    } catch (e) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak slip.');
    }
  };

  // Print all slips (Format Gambar 2: Menyambung dalam 1 lembar HVS/A4, nomor diulang dari 1 tiap slip)
  const printAllSlips = async () => {
    let Print: any;
    try {
      Print = require('expo-print');
    } catch (e) {
      Alert.alert('Perhatian', 'Fitur cetak membutuhkan modul expo-print.');
      return;
    }

    if (filteredGuru.length === 0) {
      Alert.alert('Info', 'Tidak ada data guru untuk dicetak.');
      return;
    }

    const periodeText = formatPeriodeBulan(selectedBulanList, selectedTahun);
    const allSlipsHtml = filteredGuru.map((guru) => {
      const calc = calculateTeacherHonor(guru.id);
      const slipData: SingleSlipData = {
        guruNama: guru.nama,
        rowJabatan: calc.rowJabatan,
        rowMapel: calc.rowMapel,
        rowNgaji: calc.rowNgaji,
        rowKehadiran: calc.rowKehadiran,
        rowWali: calc.rowWali,
        rowApresiasi: calc.rowApresiasi,
        totalHonor: calc.totalHonorBersih
      };
      return generateSingleSlipHtml(slipData, dataLembaga, periodeText);
    }).join('\n');

    const fullHtml = generateCompletePrintPage(allSlipsHtml);

    try {
      await Print.printAsync({ html: fullHtml });
    } catch (e) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak semua slip.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rekap Honorarium Guru</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Month & Year Filter Checklist Trigger */}
      <View style={styles.filterCard}>
        <View style={styles.filterHeaderRow}>
          <Calendar size={16} color="#1E257F" />
          <Text style={styles.filterTitle}>Periode Honor Guru:</Text>
        </View>
        <View style={styles.filterDropdownRow}>
          {/* Multi-Month Touchable Selector */}
          <TouchableOpacity 
            style={[styles.pickerWrapper, { flex: 3, paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'center' }]}
            onPress={() => setMonthModalOpen(true)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E257F' }} numberOfLines={1}>
                  {getBulanFilterSummary()}
                </Text>
                <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                  {selectedBulanList.length} Bulan (Ketuk ganti)
                </Text>
              </View>
              <ChevronDown size={16} color="#1E257F" />
            </View>
          </TouchableOpacity>

          {/* Year Picker */}
          <View style={[styles.pickerWrapper, { flex: 2 }]}>
            <Picker
              selectedValue={selectedTahun}
              onValueChange={(val) => setSelectedTahun(Number(val))}
              style={styles.picker}
              dropdownIconColor="#1E257F"
            >
              {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                <Picker.Item key={yr} label={String(yr)} value={yr} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Multi-Guru Checklist Filter Trigger */}
        {canViewAll && (
          <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
              <User size={15} color="#1E257F" />
              <Text style={styles.filterTitle}>Filter Guru:</Text>
            </View>
            <TouchableOpacity 
              style={[styles.pickerWrapper, { paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'center' }]}
              onPress={() => setGuruModalOpen(true)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E257F' }} numberOfLines={1}>
                    Guru: {getGuruFilterSummary()}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>
                    {selectedGuruIdList.length === availableGuru.length 
                      ? `Semua guru terpilih (${availableGuru.length})` 
                      : `${selectedGuruIdList.length} dari ${availableGuru.length} guru terpilih (Ketuk ganti)`}
                  </Text>
                </View>
                <ChevronDown size={16} color="#1E257F" />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Total Budget Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            {canViewAll ? `Total Anggaran Honor (${getBulanFilterSummary()} ${selectedTahun})` : `Total Honor Anda (${getBulanFilterSummary()} ${selectedTahun})`}
          </Text>
          <Text style={styles.summaryValue}>Rp {totalHonorSeluruh.toLocaleString('id-ID')}</Text>
          <View style={styles.summaryMetaRow}>
            <Text style={styles.summaryMetaText}>• Hadir: Rp 5rb</Text>
            <Text style={styles.summaryMetaText}>• KBM: Rp 6.500/JP</Text>
            <Text style={styles.summaryMetaText}>• Ngaji: Rp 200rb/100rb</Text>
          </View>

          {canViewAll && (
            <TouchableOpacity style={styles.btnCetakSemua} onPress={printAllSlips}>
              <Printer size={15} color="#065F46" />
              <Text style={styles.btnCetakSemuaText}>Cetak Semua Slip Gaji ({filteredGuru.length} Guru)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Box (Khusus Operator / Bendahara / Kepala Sekolah) */}
        {canViewAll && (
          <View style={styles.searchBox}>
            <Search size={18} color="#9ca3af" />
            <TextInput
              placeholder="Cari nama guru atau NIP..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#1E257F" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.guruList}>
            {filteredGuru.map((guru) => {
              const calc = calculateTeacherHonor(guru.id);
              return (
                <View key={guru.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guruName}>{guru.nama}</Text>
                      <Text style={styles.guruNip}>
                        {calc.namaJabatanUtama} {calc.isGuruNgaji ? '• Guru Ngaji' : ''} {guru.nip ? `• NIP: ${guru.nip}` : ''}
                      </Text>
                    </View>
                    <View style={styles.totalBadge}>
                      <Text style={styles.totalBadgeText}>Rp {calc.totalHonorBersih.toLocaleString('id-ID')}</Text>
                    </View>
                  </View>

                  <View style={styles.breakdownGrid}>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Kehadiran</Text>
                      <Text style={styles.breakdownVal}>{calc.totalHariHadir} Hari</Text>
                      <Text style={styles.breakdownSub}>Rp {calc.totalHonorKehadiran.toLocaleString('id-ID')}</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>KBM</Text>
                      <Text style={styles.breakdownVal}>{calc.totalJp} JP</Text>
                      <Text style={styles.breakdownSub}>Rp {calc.totalHonorKbm.toLocaleString('id-ID')}</Text>
                    </View>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Tunjangan</Text>
                      <Text style={styles.breakdownVal}>{calc.tunjanganJabatan > 0 ? 'Ada' : '-'}</Text>
                      <Text style={styles.breakdownSub}>Rp {calc.tunjanganJabatan.toLocaleString('id-ID')}</Text>
                    </View>
                    {calc.isGuruNgaji && (
                      <View style={styles.breakdownItem}>
                        <Text style={styles.breakdownLabel}>Guru Ngaji</Text>
                        <Text style={styles.breakdownVal}>Tetap</Text>
                        <Text style={[styles.breakdownSub, { color: '#0d9488' }]}>Rp {calc.honorGuruNgaji.toLocaleString('id-ID')}</Text>
                      </View>
                    )}
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Apresiasi</Text>
                      <Text style={styles.breakdownVal}>{calc.apresiasiKinerja > 0 ? 'Ada' : '-'}</Text>
                      <Text style={[styles.breakdownSub, { color: '#7c3aed' }]}>Rp {calc.apresiasiKinerja.toLocaleString('id-ID')}</Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    {canEditApresiasi && (
                      <TouchableOpacity style={styles.btnApresiasi} onPress={() => openEditApresiasi(guru)}>
                        <Edit3 size={13} color="#7c3aed" />
                        <Text style={styles.btnApresiasiText}>Apresiasi</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.btnDetail} onPress={() => openDetail(guru)}>
                      <Eye size={13} color="#1E257F" />
                      <Text style={styles.btnDetailText}>Rincian</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSlip} onPress={() => printSingleSlip(guru)}>
                      <Printer size={13} color="#059669" />
                      <Text style={styles.btnSlipText}>Slip Gaji</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Filter Checklist Bulan */}
      <Modal
        visible={monthModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMonthModalOpen(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Pilih Bulan Rekapitulasi</Text>
                <Text style={styles.modalSub}>Bisa mencentang lebih dari satu bulan</Text>
              </View>
              <TouchableOpacity onPress={() => setMonthModalOpen(false)}>
                <X color="#6C757D" size={22} />
              </TouchableOpacity>
            </View>

            {/* Quick Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={handleSelectAllBulan}
                style={{ flex: 1, backgroundColor: '#ECFDF5', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#065F46' }}>Pilih Semua</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSelectCurrentBulan}
                style={{ flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#374151' }}>Bulan Ini</Text>
              </TouchableOpacity>
            </View>

            {/* 12 Months Checklist Grid */}
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {bulanNames.map((bName, idx) => {
                  const bNum = idx + 1;
                  const isChecked = selectedBulanList.includes(bNum);
                  return (
                    <TouchableOpacity
                      key={bNum}
                      onPress={() => toggleBulan(bNum)}
                      style={{
                        width: '48%',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        backgroundColor: isChecked ? '#059669' : '#F9FAFB',
                        borderWidth: 1,
                        borderColor: isChecked ? '#059669' : '#E5E7EB'
                      }}
                    >
                      {isChecked ? (
                        <CheckSquare size={16} color="#fff" />
                      ) : (
                        <Square size={16} color="#9CA3AF" />
                      )}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: isChecked ? '#fff' : '#374151'
                        }}
                      >
                        {bName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>
                Terpilih: <Text style={{ fontWeight: 'bold', color: '#1F2937' }}>{selectedBulanList.length} Bulan</Text>
              </Text>
              <TouchableOpacity
                style={[styles.btnSave, { backgroundColor: '#1E257F' }]}
                onPress={() => setMonthModalOpen(false)}
              >
                <Text style={styles.btnSaveText}>Terapkan & Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Filter Checklist Guru */}
      <Modal
        visible={guruModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setGuruModalOpen(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalCardCenter, { maxHeight: '82%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Pilih Guru Rekap</Text>
                <Text style={styles.modalSub}>Centang guru yang ingin ditampilkan & dicetak</Text>
              </View>
              <TouchableOpacity onPress={() => setGuruModalOpen(false)}>
                <X color="#6C757D" size={22} />
              </TouchableOpacity>
            </View>

            {/* Quick Search inside Modal */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F9FAFB',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
              marginBottom: 10
            }}>
              <Search size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
              <TextInput
                placeholder="Cari guru..."
                value={guruSearchModal}
                onChangeText={setGuruSearchModal}
                style={{ flex: 1, fontSize: 13, color: '#1F2937', padding: 0 }}
              />
              {guruSearchModal ? (
                <TouchableOpacity onPress={() => setGuruSearchModal('')}>
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Quick Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={handleSelectAllGuru}
                style={{ flex: 1, backgroundColor: '#ECFDF5', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#065F46' }}>
                  Pilih Semua ({availableGuru.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClearAllGuru}
                style={{ flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#374151' }}>Reset (Pilih 1)</Text>
              </TouchableOpacity>
            </View>

            {/* Guru Checklist List */}
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={true}>
              <View style={{ gap: 6 }}>
                {availableGuru
                  .filter((g) => 
                    !guruSearchModal ||
                    g.nama?.toLowerCase().includes(guruSearchModal.toLowerCase()) ||
                    g.nip?.toLowerCase().includes(guruSearchModal.toLowerCase())
                  )
                  .map((g) => {
                    const isChecked = selectedGuruIdList.includes(g.id);
                    const jg = jabatanGuruMap[g.id];
                    const jabTitle = jg?.jabatan_utama || 'Guru';
                    return (
                      <TouchableOpacity
                        key={g.id}
                        onPress={() => toggleGuru(g.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 9,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          backgroundColor: isChecked ? '#ECEEFF' : '#F9FAFB',
                          borderWidth: 1,
                          borderColor: isChecked ? '#1E257F' : '#E5E7EB'
                        }}
                      >
                        {isChecked ? (
                          <CheckSquare size={18} color="#1E257F" />
                        ) : (
                          <Square size={18} color="#9CA3AF" />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: isChecked ? '700' : '600',
                              color: isChecked ? '#1E257F' : '#1F2937'
                            }}
                            numberOfLines={1}
                          >
                            {g.nama}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#6B7280' }} numberOfLines={1}>
                            {jabTitle} {g.nip ? `• NIP: ${g.nip}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>

            <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>
                Terpilih: <Text style={{ fontWeight: 'bold', color: '#1F2937' }}>{selectedGuruIdList.length} Guru</Text>
              </Text>
              <TouchableOpacity
                style={[styles.btnSave, { backgroundColor: '#1E257F' }]}
                onPress={() => setGuruModalOpen(false)}
              >
                <Text style={styles.btnSaveText}>Terapkan & Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Edit Apresiasi Kinerja (Khusus Kepala Sekolah & Bendahara) */}
      <Modal
        visible={apresiasiModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setApresiasiModalOpen(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Apresiasi Kinerja Guru</Text>
                <Text style={styles.modalSub}>{apresiasiForm.guru_nama}</Text>
              </View>
              <TouchableOpacity onPress={() => setApresiasiModalOpen(false)}>
                <X color="#6C757D" size={22} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bulan Rekap *</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={apresiasiForm.bulan}
                  onValueChange={(val) => setApresiasiForm({ ...apresiasiForm, bulan: Number(val) })}
                  style={styles.picker}
                  dropdownIconColor="#7c3aed"
                >
                  {selectedBulanList.map((b) => (
                    <Picker.Item key={b} label={`${bulanNames[b - 1]} ${selectedTahun}`} value={b} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.inputLabel}>Jenis Apresiasi *</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => setCrudMasterModalOpen(true)}
                >
                  <Settings size={13} color="#7c3aed" />
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#7c3aed' }}>Kelola Pilihan</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={apresiasiForm.keterangan}
                  onValueChange={(itemValue) => handleJenisSelect(itemValue)}
                  style={styles.picker}
                  dropdownIconColor="#7c3aed"
                >
                  <Picker.Item label="-- Pilih Jenis Apresiasi --" value="" color="#9CA3AF" />
                  {masterJenisApresiasi.map((item) => (
                    <Picker.Item
                      key={item.id}
                      label={`${item.nama_apresiasi}${Number(item.nominal_default) > 0 ? ` (Rp ${Number(item.nominal_default).toLocaleString('id-ID')})` : ''}`}
                      value={item.nama_apresiasi}
                    />
                  ))}
                  {apresiasiForm.keterangan && !masterJenisApresiasi.some((m) => m.nama_apresiasi === apresiasiForm.keterangan) && (
                    <Picker.Item label={`${apresiasiForm.keterangan} (Kustom)`} value={apresiasiForm.keterangan} />
                  )}
                </Picker>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nominal Apresiasi (Rp) *</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="Contoh: 150000"
                value={apresiasiForm.nominal}
                onChangeText={(val) => setApresiasiForm({ ...apresiasiForm, nominal: val })}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setApresiasiModalOpen(false)}
                disabled={isSavingApresiasi}
              >
                <Text style={styles.btnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSave}
                onPress={handleSaveApresiasi}
                disabled={isSavingApresiasi}
              >
                {isSavingApresiasi ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Save size={14} color="#fff" />
                    <Text style={styles.btnSaveText}>Simpan</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal CRUD Master Jenis Apresiasi */}
      <Modal
        visible={crudMasterModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setCrudMasterModalOpen(false);
          setEditingJenis(null);
          setJenisForm({ nama_apresiasi: '', nominal_default: '' });
        }}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalCardCenter, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} color="#7c3aed" />
                  <Text style={styles.modalTitle}>Master Jenis Apresiasi</Text>
                </View>
                <Text style={styles.modalSub}>Kelola opsi standar & nominal default</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setCrudMasterModalOpen(false);
                  setEditingJenis(null);
                  setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                }}
              >
                <X color="#6C757D" size={22} />
              </TouchableOpacity>
            </View>

            {/* Form Tambah / Edit */}
            <View style={styles.crudFormBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#065F46', textTransform: 'uppercase' }}>
                  {editingJenis ? 'Edit Jenis Apresiasi' : 'Tambah Opsi Baru'}
                </Text>
                {editingJenis && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditingJenis(null);
                      setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                    }}
                  >
                    <Text style={{ fontSize: 11, color: '#6B7280', textDecorationLine: 'underline' }}>Batal Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.textInput, { marginBottom: 8, backgroundColor: '#fff' }]}
                placeholder="Nama Opsi (Cth: Pembimbing Olimpiade)"
                value={jenisForm.nama_apresiasi}
                onChangeText={(t) => setJenisForm({ ...jenisForm, nama_apresiasi: t })}
              />
              <TextInput
                style={[styles.textInput, { marginBottom: 8, backgroundColor: '#fff' }]}
                placeholder="Nominal Standar (Rp, Cth: 150000)"
                keyboardType="numeric"
                value={jenisForm.nominal_default}
                onChangeText={(t) => setJenisForm({ ...jenisForm, nominal_default: t })}
              />
              <TouchableOpacity
                style={[styles.btnSave, { alignSelf: 'flex-end', backgroundColor: '#059669' }]}
                onPress={handleSaveJenis}
                disabled={isSavingJenis}
              >
                {isSavingJenis ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    {editingJenis ? <Save size={13} color="#fff" /> : <Plus size={13} color="#fff" />}
                    <Text style={styles.btnSaveText}>{editingJenis ? 'Perbarui Opsi' : 'Simpan Opsi'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Daftar Opsi */}
            <Text style={[styles.inputLabel, { marginTop: 6, marginBottom: 8 }]}>
              Daftar Opsi Tersedia ({masterJenisApresiasi.length})
            </Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {masterJenisApresiasi.length === 0 ? (
                <Text style={styles.emptyText}>Belum ada master opsi apresiasi.</Text>
              ) : (
                masterJenisApresiasi.map((item) => (
                  <View key={item.id} style={styles.crudItemRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.crudItemTitle}>{item.nama_apresiasi}</Text>
                      <Text style={styles.crudItemSub}>
                        Standar: Rp {(Number(item.nominal_default) || 0).toLocaleString('id-ID')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={{ padding: 6, backgroundColor: '#EEF2FF', borderRadius: 8 }}
                        onPress={() => {
                          setEditingJenis(item);
                          setJenisForm({
                            nama_apresiasi: item.nama_apresiasi,
                            nominal_default: item.nominal_default ? String(item.nominal_default) : ''
                          });
                        }}
                      >
                        <Edit3 size={15} color="#4338CA" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ padding: 6, backgroundColor: '#FEE2E2', borderRadius: 8 }}
                        onPress={() => handleDeleteJenis(item.id, item.nama_apresiasi)}
                      >
                        <Trash2 size={15} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', alignItems: 'flex-end' }}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => {
                  setCrudMasterModalOpen(false);
                  setEditingJenis(null);
                  setJenisForm({ nama_apresiasi: '', nominal_default: '' });
                }}
              >
                <Text style={styles.btnCancelText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Rincian */}
      <Modal
        visible={detailModalOpen && !!selectedGuruDetail}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Rincian Log Presensi</Text>
                <Text style={styles.modalSub}>{selectedGuruDetail?.nama}</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailModalOpen(false)}>
                <X color="#6C757D" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Summary */}
              <View style={styles.modalSummary}>
                <View style={styles.modalSumRow}>
                  <Text style={styles.modalSumLabel}>Honor Kehadiran:</Text>
                  <Text style={styles.modalSumVal}>Rp {selectedGuruDetail?.totalHonorKehadiran?.toLocaleString('id-ID')}</Text>
                </View>
                <View style={styles.modalSumRow}>
                  <Text style={styles.modalSumLabel}>Honor KBM Mengajar:</Text>
                  <Text style={styles.modalSumVal}>Rp {selectedGuruDetail?.totalHonorKbm?.toLocaleString('id-ID')}</Text>
                </View>
                <View style={styles.modalSumRow}>
                  <Text style={styles.modalSumLabel}>Tunjangan Jabatan:</Text>
                  <Text style={styles.modalSumVal}>Rp {selectedGuruDetail?.tunjanganJabatan?.toLocaleString('id-ID')}</Text>
                </View>
                {selectedGuruDetail?.isGuruNgaji && (
                  <View style={styles.modalSumRow}>
                    <Text style={[styles.modalSumLabel, { color: '#0d9488' }]}>Honor Guru Ngaji (Tetap):</Text>
                    <Text style={[styles.modalSumVal, { color: '#0d9488' }]}>Rp {selectedGuruDetail?.honorGuruNgaji?.toLocaleString('id-ID')}</Text>
                  </View>
                )}
                {selectedGuruDetail?.apresiasiKinerja > 0 && (
                  <View style={styles.modalSumRow}>
                    <Text style={[styles.modalSumLabel, { color: '#7c3aed' }]}>Apresiasi Kinerja:</Text>
                    <Text style={[styles.modalSumVal, { color: '#7c3aed' }]}>Rp {selectedGuruDetail?.apresiasiKinerja?.toLocaleString('id-ID')}</Text>
                  </View>
                )}
                {selectedGuruDetail?.keteranganApresiasi ? (
                  <Text style={styles.modalSumKet}>Catatan: "{selectedGuruDetail?.keteranganApresiasi}"</Text>
                ) : null}
                <View style={[styles.modalSumRow, { borderTopWidth: 1, borderTopColor: '#A7F3D0', paddingTop: 6, marginTop: 4 }]}>
                  <Text style={[styles.modalSumLabel, { fontWeight: 'bold', color: '#065F46' }]}>Total Bersih:</Text>
                  <Text style={[styles.modalSumVal, { fontWeight: '900', color: '#065F46', fontSize: 14 }]}>
                    Rp {selectedGuruDetail?.totalHonorBersih?.toLocaleString('id-ID')}
                  </Text>
                </View>
              </View>

              {/* Log Kehadiran */}
              <Text style={styles.logSectionTitle}>Log Kehadiran ({selectedGuruDetail?.totalHariHadir} Hari Hadir)</Text>
              {selectedGuruDetail?.myPresensi?.length === 0 ? (
                <Text style={styles.emptyText}>Tidak ada catatan kehadiran bulan ini.</Text>
              ) : (
                selectedGuruDetail?.myPresensi?.map((p: any, i: number) => (
                  <View key={i} style={styles.logRow}>
                    <View>
                      <Text style={styles.logDate}>{p.tanggal}</Text>
                      <Text style={styles.logTime}>{p.waktu_datang || '--:--'} s/d {p.waktu_pulang || '--:--'}</Text>
                    </View>
                    <Text style={styles.logMoney}>Rp {(Number(p.honor_kehadiran) || 0).toLocaleString('id-ID')}</Text>
                  </View>
                ))
              )}

              {/* Log KBM */}
              <Text style={[styles.logSectionTitle, { marginTop: 14 }]}>Log Mengajar KBM ({selectedGuruDetail?.totalJp} JP)</Text>
              {selectedGuruDetail?.myKbm?.length === 0 ? (
                <Text style={styles.emptyText}>Tidak ada catatan jam mengajar bulan ini.</Text>
              ) : (
                selectedGuruDetail?.myKbm?.map((k: any, i: number) => (
                  <View key={i} style={styles.logRow}>
                    <View>
                      <Text style={styles.logDate}>{k.tanggal} (Jam Ke: {k.jam_ke || '1'})</Text>
                      <Text style={styles.logTime}>{k.waktu_masuk} - {k.waktu_keluar || '...'} {k.is_pengganti ? '[Inval]' : ''}</Text>
                    </View>
                    <Text style={[styles.logMoney, { color: '#4338ca' }]}>Rp {((Number(k.jumlah_jp) || 1) * 6500).toLocaleString('id-ID')}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: '#1E257F',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: { padding: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  filterCard: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4B5563',
    textTransform: 'uppercase'
  },
  filterDropdownRow: {
    flexDirection: 'row',
    gap: 10
  },
  pickerWrapper: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 52
  },
  picker: {
    width: '100%',
    height: 52,
    color: '#1F2937'
  },
  content: { padding: 16, paddingBottom: 60 },
  summaryCard: {
    backgroundColor: '#059669',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4
  },
  summaryLabel: { color: '#D1FAE5', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  summaryValue: { color: '#fff', fontSize: 24, fontWeight: '900', marginVertical: 4 },
  summaryMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  summaryMetaText: { color: '#A7F3D0', fontSize: 11 },
  btnCetakSemua: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  btnCetakSemuaText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#065F46'
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14
  },
  searchInput: { flex: 1, fontSize: 13, color: '#1F2937' },
  guruList: { gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  guruName: { fontSize: 15, fontWeight: 'bold', color: '#1F2937' },
  guruNip: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  totalBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  totalBadgeText: { fontSize: 13, fontWeight: '900', color: '#065F46' },
  breakdownGrid: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 8,
    gap: 4
  },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownLabel: { fontSize: 8, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase' },
  breakdownVal: { fontSize: 11, fontWeight: 'bold', color: '#1F2937', marginTop: 2 },
  breakdownSub: { fontSize: 9, color: '#059669', fontWeight: '600' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 12 },
  btnApresiasi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE'
  },
  btnApresiasiText: { fontSize: 11, fontWeight: 'bold', color: '#7C3AED' },
  btnDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8
  },
  btnDetailText: { fontSize: 11, fontWeight: 'bold', color: '#1E257F' },
  btnSlip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8
  },
  btnSlipText: { fontSize: 11, fontWeight: 'bold', color: '#059669' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCardCenter: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  modalSub: { fontSize: 12, color: '#6B7280' },
  modalSummary: { backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  modalSumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalSumLabel: { fontSize: 12, color: '#374151' },
  modalSumVal: { fontSize: 12, fontWeight: 'bold', color: '#1F2937' },
  modalSumKet: { fontSize: 11, fontStyle: 'italic', color: '#6B7280', marginTop: 2, marginBottom: 4 },
  logSectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#374151', textTransform: 'uppercase', marginBottom: 8 },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 10, borderRadius: 10, marginBottom: 6 },
  logDate: { fontSize: 12, fontWeight: 'bold', color: '#1F2937' },
  logTime: { fontSize: 10, color: '#6B7280' },
  logMoney: { fontSize: 12, fontWeight: 'bold', color: '#059669' },
  emptyText: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#374151', marginBottom: 4 },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1F2937'
  },
  inputHint: { fontSize: 10, color: '#9CA3AF', marginTop: 3 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  btnCancel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6' },
  btnCancelText: { fontSize: 12, fontWeight: 'bold', color: '#4B5563' },
  btnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#059669'
  },
  btnSaveText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  crudFormBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10
  },
  crudItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  crudItemTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  crudItemSub: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 2
  }
});
