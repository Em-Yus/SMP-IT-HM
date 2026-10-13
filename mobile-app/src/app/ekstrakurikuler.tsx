import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, 
  Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Switch 
} from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { 
  ChevronLeft, Search, Plus, Edit, Trash2, Tent, Users, 
  X, Save, Filter, Printer, FileDown, CheckSquare, Square, CheckCircle 
} from 'lucide-react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

const EXPORT_COLUMNS = [
  { id: 'nama', label: 'Nama Lengkap', default: true },
  { id: 'nipd', label: 'NIPD', default: true },
  { id: 'nisn', label: 'NISN', default: true },
  { id: 'nik', label: 'NIK', default: false },
  { id: 'kelas', label: 'Kelas', default: true },
  { id: 'jenis_kelamin', label: 'Jenis Kelamin', default: true },
  { id: 'tempat_lahir', label: 'Tempat Lahir', default: true },
  { id: 'tanggal_lahir', label: 'Tanggal Lahir', default: true },
  { id: 'alamat_detail', label: 'Jalan/Dusun', default: false },
  { id: 'rt_rw', label: 'RT/RW', default: false },
  { id: 'desa', label: 'Desa/Kelurahan', default: false },
  { id: 'kecamatan', label: 'Kecamatan', default: false },
  { id: 'kabupaten', label: 'Kabupaten/Kota', default: false },
  { id: 'provinsi', label: 'Provinsi', default: false },
  { id: 'nama_ayah', label: 'Nama Ayah', default: false },
  { id: 'nama_ibu', label: 'Nama Ibu', default: false },
  { id: 'nama_wali', label: 'Nama Wali', default: false },
  { id: 'wa_ortu', label: 'No WA Ortu', default: false },
  { id: 'wa_siswa', label: 'No WA Siswa', default: false },
  { id: 'sekolah_asal', label: 'Sekolah Asal', default: false },
  { id: 'angkatan', label: 'Angkatan', default: false },
  { id: 'tahun_ajaran', label: 'Tahun Ajaran', default: false },
  { id: 'status_siswa', label: 'Status Siswa (Sifat)', default: false },
  { id: 'tanggal_masuk', label: 'Tanggal Masuk', default: false },
  { id: 'tingkat', label: 'Tingkat (Ramu/Rakit/Terap)', default: true },
  { id: 'predikat', label: 'Predikat', default: true },
  { id: 'deskripsi', label: 'Deskripsi Capaian', default: true }
];

export default function Ekstrakurikuler() {
  const [dataEkskul, setDataEkskul] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const initialTA = currentMonth >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  const initialSem = currentMonth >= 7 ? 'Ganjil' : 'Genap';
  const [filterTA, setFilterTA] = useState(initialTA);
  const [filterSemester, setFilterSemester] = useState(initialSem);
  const [availableTA, setAvailableTA] = useState([initialTA]);

  // Form Modal Ekskul
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedEkskul, setSelectedEkskul] = useState<any>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [formData, setFormData] = useState({ nama_ekskul: '', pembina_nama: '', hari_pelaksanaan: '', jam_pelaksanaan: '' });

  // Form Modal Anggota
  const [isAnggotaOpen, setIsAnggotaOpen] = useState(false);
  const [dataSiswa, setDataSiswa] = useState<any[]>([]);
  const [filteredSiswa, setFilteredSiswa] = useState<any[]>([]);
  const [searchSiswa, setSearchSiswa] = useState('');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterTab, setFilterTab] = useState<'semua' | 'terpilih'>('semua');
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [deskripsiData, setDeskripsiData] = useState<Record<number, { predikat: string; deskripsi: string; tingkat: string[] }>>({});
  const [initialCheckedIds, setInitialCheckedIds] = useState<Set<number>>(new Set());
  const [isSavingAnggota, setIsSavingAnggota] = useState(false);
  const [loadingAnggota, setLoadingAnggota] = useState(false);

  // Modal Cetak & Ekspor
  const [isCetakModalOpen, setIsCetakModalOpen] = useState(false);
  const [selectedEkskulForCetak, setSelectedEkskulForCetak] = useState<any>(null);
  const [selectedExportCols, setSelectedExportCols] = useState<string[]>(
    EXPORT_COLUMNS.filter(c => c.default).map(c => c.id)
  );
  const [isExporting, setIsExporting] = useState(false);

  const fetchEkskul = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_ekskul')
        .select('*')
        .eq('tahun_ajaran', filterTA)
        .eq('semester', filterSemester)
        .order('nama_ekskul', { ascending: true });
        
      if (error) throw error;
      
      const ekskulList = data || [];
      if (ekskulList.length > 0) {
        const ekskulIds = ekskulList.map(e => e.id);
        const { data: anggota } = await supabase.from('anggota_ekskul').select('ekskul_id').in('ekskul_id', ekskulIds);
        
        if (anggota) {
          const counts: any = {};
          anggota.forEach(a => counts[a.ekskul_id] = (counts[a.ekskul_id] || 0) + 1);
          ekskulList.forEach(e => e.jumlah_anggota = counts[e.id] || 0);
        }
      }
      setDataEkskul(ekskulList);

      const { data: taData } = await supabase.from('data_ekskul').select('tahun_ajaran');
      if (taData) {
        const uniqueTA = [...new Set(taData.map(item => item.tahun_ajaran).filter(Boolean))].sort().reverse();
        if (!uniqueTA.includes(initialTA)) uniqueTA.unshift(initialTA);
        setAvailableTA(uniqueTA);
      }
    } catch (err) {
      Alert.alert('Error', 'Gagal memuat ekstrakurikuler');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEkskul();
  }, [filterTA, filterSemester]);

  // --- EKSKUL CRUD ---
  const handleAdd = () => {
    setFormData({ nama_ekskul: '', pembina_nama: '', hari_pelaksanaan: '', jam_pelaksanaan: '' });
    setIsEditing(false);
    setSelectedEkskul(null);
    setIsFormOpen(true);
  };

  const handleEdit = (item: any) => {
    setFormData({
      nama_ekskul: item.nama_ekskul || '', pembina_nama: item.pembina_nama || '',
      hari_pelaksanaan: item.hari_pelaksanaan || '', jam_pelaksanaan: item.jam_pelaksanaan || ''
    });
    setIsEditing(true);
    setSelectedEkskul(item);
    setIsFormOpen(true);
  };

  const handleDelete = (id: number, nama: string) => {
    Alert.alert('Hapus Ekskul?', `Menghapus ekstrakurikuler ${nama} juga akan menghapus data anggotanya.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
          setIsLoading(true);
          try {
            await supabase.from('data_ekskul').delete().eq('id', id);
            fetchEkskul();
          } catch (err) {
            Alert.alert('Error', 'Gagal menghapus ekskul');
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  const saveEkskul = async () => {
    if (!formData.nama_ekskul) return Alert.alert('Peringatan', 'Nama ekstrakurikuler wajib diisi');
    setIsSavingForm(true);
    try {
      const payload = {
        ...formData,
        tahun_ajaran: selectedEkskul ? selectedEkskul.tahun_ajaran : filterTA,
        semester: selectedEkskul ? selectedEkskul.semester : filterSemester
      };

      let err = null;
      if (isEditing) {
        const { error } = await supabase.from('data_ekskul').update(payload).eq('id', selectedEkskul.id);
        err = error;
      } else {
        const { error } = await supabase.from('data_ekskul').insert([payload]);
        err = error;
      }
      
      if (err) {
        console.error('Ekskul save error:', err);
        throw err;
      }
      
      Alert.alert('Berhasil', 'Data ekstrakurikuler disimpan.');
      setIsFormOpen(false);
      fetchEkskul();
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan ekskul');
    } finally {
      setIsSavingForm(false);
    }
  };

  // --- ANGGOTA CRUD ---
  const handleAnggota = async (item: any) => {
    setSelectedEkskul(item);
    setSearchSiswa('');
    setFilterKelas('Semua');
    setFilterTab('semua');
    setIsAnggotaOpen(true);
    setLoadingAnggota(true);

    try {
      const { data: siswaData } = await supabase
        .from('data_siswa')
        .select('id, nama, nipd, kelas')
        .eq('status_keaktifan', 'Aktif')
        .neq('kelas', 'Calon Siswa')
        .order('nama', { ascending: true });
        
      setDataSiswa(siswaData || []);

      let membersData: any[] = [];
      try {
        const { data, error } = await supabase
          .from('anggota_ekskul')
          .select('id, siswa_id, predikat, deskripsi, tingkat')
          .eq('ekskul_id', item.id);
        if (error) throw error;
        membersData = data || [];
      } catch {
        const { data } = await supabase
          .from('anggota_ekskul')
          .select('id, siswa_id, predikat, deskripsi')
          .eq('ekskul_id', item.id);
        membersData = data || [];
      }
      
      const initChecked = new Set<number>();
      const initDeskripsi: Record<number, { predikat: string; deskripsi: string; tingkat: string[] }> = {};
      
      membersData.forEach(a => {
        initChecked.add(a.siswa_id);
        let parsedTingkat: string[] = [];
        let rawDesc = a.deskripsi || '';

        if (a.tingkat) {
          if (Array.isArray(a.tingkat)) {
            parsedTingkat = a.tingkat;
          } else if (typeof a.tingkat === 'string') {
            try {
              const p = JSON.parse(a.tingkat);
              parsedTingkat = Array.isArray(p) ? p : [a.tingkat];
            } catch {
              parsedTingkat = a.tingkat.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
        } else if (rawDesc) {
          const match = rawDesc.match(/^\[Tingkat:\s*([^\]]+)\]\s*/i);
          if (match) {
            parsedTingkat = match[1].split(',').map((s: string) => s.trim()).filter(Boolean);
            rawDesc = rawDesc.replace(match[0], '');
          }
        }

        initDeskripsi[a.siswa_id] = {
          predikat: a.predikat || '',
          deskripsi: rawDesc,
          tingkat: parsedTingkat
        };
      });
      
      setCheckedIds(initChecked);
      setInitialCheckedIds(new Set(initChecked));
      setDeskripsiData(initDeskripsi);
    } catch (err) {
      Alert.alert('Error', 'Gagal memuat data anggota');
    } finally {
      setLoadingAnggota(false);
    }
  };

  useEffect(() => {
    if (!dataSiswa) return;
    const lowerKeyword = searchSiswa.toLowerCase();
    const filtered = dataSiswa.filter(s => {
      const matchSearch = (s.nama && s.nama.toLowerCase().includes(lowerKeyword)) || (s.nipd && s.nipd.toLowerCase().includes(lowerKeyword));
      const matchKelas = filterKelas === 'Semua' ? true : s.kelas === filterKelas;
      const matchTab = filterTab === 'semua' ? true : checkedIds.has(s.id);
      return matchSearch && matchKelas && matchTab;
    });
    setFilteredSiswa(filtered);
  }, [searchSiswa, filterKelas, filterTab, dataSiswa, checkedIds]);

  const uniqueClasses = ['Semua', ...new Set(dataSiswa.map(item => item.kelas).filter(Boolean))].sort();

  const handleCheckSiswa = (id: number) => {
    const newChecked = new Set(checkedIds);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
      if (!deskripsiData[id]) {
        setDeskripsiData(prev => ({ ...prev, [id]: { predikat: '', deskripsi: '', tingkat: [] } }));
      }
    }
    setCheckedIds(newChecked);
  };

  const handleDescChange = (id: number, field: 'predikat'|'deskripsi', val: string) => {
    setDeskripsiData(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { predikat: '', deskripsi: '', tingkat: [] }), [field]: val }
    }));
  };

  const handleToggleTingkat = (sId: number, level: string) => {
    setDeskripsiData(prev => {
      const cur = prev[sId] || { predikat: '', deskripsi: '', tingkat: [] };
      const curTingkat = cur.tingkat || [];
      const updated = curTingkat.includes(level)
        ? curTingkat.filter(l => l !== level)
        : [...curTingkat, level];
      return {
        ...prev,
        [sId]: { ...cur, tingkat: updated }
      };
    });
  };

  const saveAnggota = async () => {
    setIsSavingAnggota(true);
    try {
      const currentChecked = Array.from(checkedIds);
      const initialChecked = Array.from(initialCheckedIds);
      
      const toRemove = initialChecked.filter(id => !checkedIds.has(id));
      const toAddOrUpdate = currentChecked;

      if (toRemove.length > 0) {
        await supabase.from('anggota_ekskul').delete().eq('ekskul_id', selectedEkskul.id).in('siswa_id', toRemove);
      }

      const formatPayload = (sId: number, includeTingkatCol: boolean) => {
        const item = deskripsiData[sId] || { predikat: '', deskripsi: '', tingkat: [] };
        const tingkatArr = item.tingkat || [];
        const tingkatStr = tingkatArr.join(', ');
        let cleanDesc = item.deskripsi || '';

        if (!includeTingkatCol && tingkatStr) {
          cleanDesc = `[Tingkat: ${tingkatStr}] ${cleanDesc}`.trim();
        }

        const payload: any = {
          ekskul_id: selectedEkskul.id,
          siswa_id: sId,
          predikat: item.predikat || '',
          deskripsi: cleanDesc
        };

        if (includeTingkatCol) {
          payload.tingkat = tingkatStr;
        }

        return payload;
      };

      const executeSave = async (includeTingkatCol: boolean) => {
        for (const sId of toAddOrUpdate) {
          const isNew = !initialCheckedIds.has(sId);
          const payload = formatPayload(sId, includeTingkatCol);
          if (isNew) {
            const { error } = await supabase.from('anggota_ekskul').insert([payload]);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('anggota_ekskul').update(payload).eq('ekskul_id', selectedEkskul.id).eq('siswa_id', sId);
            if (error) throw error;
          }
        }
      };

      try {
        await executeSave(true);
      } catch (saveErr: any) {
        if (saveErr?.code === '42703' || String(saveErr?.message || '').toLowerCase().includes('tingkat')) {
          await executeSave(false);
        } else {
          throw saveErr;
        }
      }

      Alert.alert('Berhasil', 'Anggota & Nilai Ekstrakurikuler disimpan.');
      setIsAnggotaOpen(false);
      fetchEkskul();
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan anggota');
    } finally {
      setIsSavingAnggota(false);
    }
  };

  // --- CETAK & EKSPOR DATA ANGGOTA ---
  const handleOpenCetak = (item: any) => {
    setSelectedEkskulForCetak(item);
    setSelectedExportCols(EXPORT_COLUMNS.filter(c => c.default).map(c => c.id));
    setIsCetakModalOpen(true);
  };

  const toggleExportCol = (id: string) => {
    if (selectedExportCols.includes(id)) {
      setSelectedExportCols(selectedExportCols.filter(col => col !== id));
    } else {
      setSelectedExportCols([...selectedExportCols, id]);
    }
  };

  const toggleAllExportCols = () => {
    if (selectedExportCols.length === EXPORT_COLUMNS.length) {
      setSelectedExportCols([]);
    } else {
      setSelectedExportCols(EXPORT_COLUMNS.map(c => c.id));
    }
  };

  const fetchMembersWithFullData = async (ekskulId: any) => {
    let members: any[] = [];
    try {
      const { data, error } = await supabase
        .from('anggota_ekskul')
        .select('id, siswa_id, predikat, deskripsi, tingkat, data_siswa(*)')
        .eq('ekskul_id', ekskulId);
      if (error) throw error;
      members = data || [];
    } catch {
      const { data } = await supabase
        .from('anggota_ekskul')
        .select('id, siswa_id, predikat, deskripsi, data_siswa(*)')
        .eq('ekskul_id', ekskulId);
      members = data || [];
    }

    const normalized = (members || []).map((m: any) => {
      let t = m.tingkat;
      let d = m.deskripsi || '';
      if (!t && d) {
        const match = d.match(/^\[Tingkat:\s*([^\]]+)\]\s*/i);
        if (match) {
          t = match[1];
          d = d.replace(match[0], '');
        }
      }
      if (Array.isArray(t)) t = t.join(', ');
      return { ...m, tingkat: t || '', deskripsi: d };
    });

    return normalized.sort((a: any, b: any) => {
      const klsA = a.data_siswa?.kelas || '';
      const klsB = b.data_siswa?.kelas || '';
      if (klsA !== klsB) return klsA.localeCompare(klsB);
      return (a.data_siswa?.nama || '').localeCompare(b.data_siswa?.nama || '');
    });
  };

  // 1. Ekspor File Excel / CSV
  const handleExportCSV = async () => {
    if (selectedExportCols.length === 0) {
      Alert.alert('Peringatan', 'Pilih minimal satu kolom untuk diekspor.');
      return;
    }

    setIsExporting(true);
    try {
      const members = await fetchMembersWithFullData(selectedEkskulForCetak.id);
      if (members.length === 0) {
        Alert.alert('Data Kosong', 'Belum ada anggota terdaftar pada ekstrakurikuler ini.');
        setIsExporting(false);
        return;
      }

      const activeCols = EXPORT_COLUMNS.filter(c => selectedExportCols.includes(c.id));
      const headers = ['No', ...activeCols.map(c => c.label)].join(',');

      const rows = members.map((m: any, idx: number) => {
        const s = m.data_siswa || {};
        const values: (string | number)[] = [idx + 1];

        activeCols.forEach(col => {
          let val = '-';
          if (col.id === 'tingkat') val = m.tingkat || '-';
          else if (col.id === 'predikat') val = m.predikat || '-';
          else if (col.id === 'deskripsi') val = m.deskripsi || '-';
          else if (col.id === 'rt_rw') val = `RT ${s.rt || '-'}/RW ${s.rw || '-'}`;
          else if (col.id === 'jenis_kelamin') val = s.jenis_kelamin === 'L' ? 'Laki-laki' : s.jenis_kelamin === 'P' ? 'Perempuan' : (s.jenis_kelamin || '-');
          else if (col.id === 'tanggal_lahir' || col.id === 'tanggal_masuk') val = s[col.id] ? new Date(s[col.id]).toLocaleDateString('id-ID') : '-';
          else val = s[col.id] || '-';

          values.push(`"${String(val).replace(/"/g, '""')}"`);
        });

        return values.join(',');
      }).join('\n');

      // Add UTF-8 BOM so Excel opens indonesian characters properly
      const csvContent = `\uFEFF${headers}\n${rows}`;
      const safeName = (selectedEkskulForCetak.nama_ekskul || 'Ekskul').replace(/[^a-zA-Z0-9]/g, '_');
      const fileUri = `${FileSystem.cacheDirectory}Data_Anggota_${safeName}_${new Date().getTime()}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: `Ekspor Anggota ${selectedEkskulForCetak.nama_ekskul}`,
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Info', 'Fitur sharing tidak tersedia pada perangkat ini.');
      }

      setIsCetakModalOpen(false);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal mengekspor data: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Cetak Dokumen via Print PDF
  const handlePrintPDF = async () => {
    if (selectedExportCols.length === 0) {
      Alert.alert('Peringatan', 'Pilih minimal satu kolom untuk dicetak.');
      return;
    }

    setIsExporting(true);
    try {
      const [members, { data: lembaga }] = await Promise.all([
        fetchMembersWithFullData(selectedEkskulForCetak.id),
        supabase.from('data_lembaga').select('*').maybeSingle()
      ]);

      if (members.length === 0) {
        Alert.alert('Data Kosong', 'Belum ada anggota terdaftar pada ekstrakurikuler ini.');
        setIsExporting(false);
        return;
      }

      const activeCols = EXPORT_COLUMNS.filter(c => selectedExportCols.includes(c.id));
      const namaLembaga = lembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN';
      const alamatLembaga = lembaga?.alamat || 'Jl. Raya Compreng - Subang, Jawa Barat';
      const logoUrl = lembaga?.logo || 'https://www.e-ujian.com/smpithm/logo';
      const npsn = lembaga?.npsn ? `NPSN: ${lembaga.npsn}` : '';
      const email = lembaga?.email ? `Email: ${lembaga.email}` : '';
      const kontak = [npsn, email].filter(Boolean).join(' | ');

      const tglFormatted = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const tableRows = members.map((m: any, idx: number) => {
        const s = m.data_siswa || {};
        const cells = activeCols.map(col => {
          let val = '-';
          if (col.id === 'tingkat') val = m.tingkat || '-';
          else if (col.id === 'predikat') val = m.predikat || '-';
          else if (col.id === 'deskripsi') val = m.deskripsi || '-';
          else if (col.id === 'rt_rw') val = `RT ${s.rt || '-'}/RW ${s.rw || '-'}`;
          else if (col.id === 'jenis_kelamin') val = s.jenis_kelamin === 'L' ? 'L' : s.jenis_kelamin === 'P' ? 'P' : (s.jenis_kelamin || '-');
          else if (col.id === 'tanggal_lahir' || col.id === 'tanggal_masuk') val = s[col.id] ? new Date(s[col.id]).toLocaleDateString('id-ID') : '-';
          else val = s[col.id] || '-';

          const isCenter = ['nipd', 'nisn', 'nik', 'kelas', 'jenis_kelamin', 'tanggal_lahir', 'predikat', 'tingkat'].includes(col.id);
          return `<td class="${isCenter ? 'center' : ''}">${val}</td>`;
        }).join('');

        return `<tr><td class="center">${idx + 1}</td>${cells}</tr>`;
      }).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; margin: 0; padding: 0; }
            .kop { display: flex; align-items: center; justify-content: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 14px; text-align: center; }
            .kop img { width: 68px; height: 68px; object-fit: contain; margin-right: 14px; }
            .kop h2 { font-size: 11pt; margin: 0; text-transform: uppercase; font-weight: normal; }
            .kop h1 { font-size: 14pt; margin: 2px 0; font-weight: bold; text-transform: uppercase; }
            .kop p { font-size: 8.5pt; margin: 0; font-style: italic; }
            .judul { text-align: center; margin: 12px 0; }
            .judul h3 { font-size: 12pt; text-decoration: underline; margin: 0; text-transform: uppercase; }
            .judul p { font-size: 9.5pt; font-weight: bold; margin: 3px 0 0 0; }
            .meta { width: 100%; font-size: 9.5pt; margin-bottom: 12px; }
            .meta td { padding: 2px 4px; vertical-align: top; }
            .meta td.lbl { width: 130px; font-weight: bold; }
            table.data { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 18px; }
            table.data th, table.data td { border: 1px solid #000; padding: 4px 6px; }
            table.data th { background-color: #f1f5f9; text-align: center; font-weight: bold; text-transform: uppercase; }
            .center { text-align: center; }
            .sig-section { display: flex; justify-content: space-between; margin-top: 24px; page-break-inside: avoid; }
            .sig-box { width: 45%; text-align: center; font-size: 10pt; }
            .sig-space { height: 60px; }
            .sig-name { font-weight: bold; text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="kop">
            <img src="${logoUrl}" alt="Logo" />
            <div>
              <h2>YAYASAN PONDOK PESANTREN HIDAYATUL MUBTADI-IEN</h2>
              <h1>${namaLembaga}</h1>
              <p>${alamatLembaga}</p>
              ${kontak ? `<p>${kontak}</p>` : ''}
            </div>
          </div>

          <div class="judul">
            <h3>DAFTAR ANGGOTA EKSTRAKURIKULER</h3>
            <p>TAHUN AJARAN ${selectedEkskulForCetak.tahun_ajaran} • SEMESTER ${(selectedEkskulForCetak.semester || '').toUpperCase()}</p>
          </div>

          <table class="meta">
            <tr>
              <td class="lbl">Nama Ekskul</td><td>:</td><td><strong>${selectedEkskulForCetak.nama_ekskul}</strong></td>
              <td class="lbl">Pembina</td><td>:</td><td>${selectedEkskulForCetak.pembina_nama || '-'}</td>
            </tr>
            <tr>
              <td class="lbl">Jadwal</td><td>:</td><td>${selectedEkskulForCetak.hari_pelaksanaan || '-'} (${selectedEkskulForCetak.jam_pelaksanaan || '-'})</td>
              <td class="lbl">Total Anggota</td><td>:</td><td><strong>${members.length} Siswa</strong></td>
            </tr>
          </table>

          <table class="data">
            <thead>
              <tr>
                <th style="width: 25px;">No</th>
                ${activeCols.map(c => `<th>${c.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="sig-section">
            <div class="sig-box">
              <p>Mengetahui,<br>Kepala Sekolah</p>
              <div class="sig-space"></div>
              <p class="sig-name">${lembaga?.kepala_sekolah || 'Ustadz Iwan Supriyanto, S.Pd.I'}</p>
              <p>NIY/NIP. ${lembaga?.nip_kepsek || '-'}</p>
            </div>
            <div class="sig-box">
              <p>Compreng, ${tglFormatted}<br>Pembina Ekstrakurikuler</p>
              <div class="sig-space"></div>
              <p class="sig-name">${selectedEkskulForCetak.pembina_nama || '....................................'}</p>
              <p>NIP/NIY. -</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await Print.printAsync({ html });
      setIsCetakModalOpen(false);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal mencetak PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ekstrakurikuler</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola program ekskul & anggota per semester</Text>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <View style={[styles.pickerWrapper, { flex: 1 }]}>
            <Picker selectedValue={filterTA} onValueChange={setFilterTA} style={styles.picker}>
              {availableTA.map(ta => <Picker.Item key={ta} label={`TA: ${ta}`} value={ta} />)}
            </Picker>
          </View>
          <View style={[styles.pickerWrapper, { flex: 1 }]}>
            <Picker selectedValue={filterSemester} onValueChange={setFilterSemester} style={styles.picker}>
              <Picker.Item label="Ganjil" value="Ganjil" />
              <Picker.Item label="Genap" value="Genap" />
            </Picker>
          </View>
        </View>
        <TouchableOpacity style={styles.btnAdd} onPress={handleAdd}>
          <Plus size={20} color="#fff" />
          <Text style={styles.btnAddText}>Tambah Ekskul</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
        ) : dataEkskul.length === 0 ? (
          <Text style={styles.emptyText}>Tidak ada ekstrakurikuler pada TA ini.</Text>
        ) : (
          dataEkskul.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Tent size={20} color="#2a2c87" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ekskulName}>{item.nama_ekskul}</Text>
                  <Text style={styles.ekskulPembina}>Pembina: {item.pembina_nama || '-'}</Text>
                </View>
                <View style={styles.badgeCount}>
                  <Users size={12} color="#059669" />
                  <Text style={styles.badgeCountText}>{item.jumlah_anggota || 0} Siswa</Text>
                </View>
              </View>

              <View style={styles.jadwalRow}>
                <Text style={styles.jadwalText}>Jadwal: {item.hari_pelaksanaan || '-'} ({item.jam_pelaksanaan || '-'})</Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.actionBtn, styles.btnTrash]} onPress={() => handleDelete(item.id, item.nama_ekskul)}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnEdit]} onPress={() => handleEdit(item)}>
                  <Edit size={16} color="#d97706" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnCetakAction]} onPress={() => handleOpenCetak(item)}>
                  <Printer size={16} color="#4f46e5" />
                  <Text style={styles.btnCetakActionText}>Cetak</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnAnggota]} onPress={() => handleAnggota(item)}>
                  <Users size={16} color="#fff" />
                  <Text style={styles.btnAnggotaText}>Kelola Anggota</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL EKSKUL */}
      <Modal visible={isFormOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%', flexShrink: 1 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{isEditing ? 'Edit Ekskul' : 'Tambah Ekskul'}</Text>
                <Text style={styles.modalSubtitle}>Periode: TA {filterTA} ({filterSemester})</Text>
              </View>
              <TouchableOpacity onPress={() => setIsFormOpen(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.labelModal}>Nama Ekstrakurikuler *</Text>
                <TextInput 
                  style={styles.inputModal} 
                  value={formData.nama_ekskul} 
                  onChangeText={t => setFormData({...formData, nama_ekskul: t})} 
                  placeholder="Cth: Pramuka, Futsal" 
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.labelModal}>Nama Pembina</Text>
                <TextInput 
                  style={styles.inputModal} 
                  value={formData.pembina_nama} 
                  onChangeText={t => setFormData({...formData, pembina_nama: t})} 
                  placeholder="Nama Guru Pembina" 
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.labelModal}>Hari</Text>
                  <TextInput 
                    style={styles.inputModal} 
                    value={formData.hari_pelaksanaan} 
                    onChangeText={t => setFormData({...formData, hari_pelaksanaan: t})} 
                    placeholder="Cth: Sabtu" 
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.labelModal}>Jam</Text>
                  <TextInput 
                    style={styles.inputModal} 
                    value={formData.jam_pelaksanaan} 
                    onChangeText={t => setFormData({...formData, jam_pelaksanaan: t})} 
                    placeholder="Cth: 15.00" 
                  />
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSaveModal} onPress={saveEkskul} disabled={isSavingForm}>
                {isSavingForm ? <ActivityIndicator color="#fff" /> : <><Save size={20} color="#fff" /><Text style={styles.btnSaveModalText}>Simpan Ekskul</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL KELOLA ANGGOTA & NILAI */}
      <Modal visible={isAnggotaOpen} transparent animationType="slide">
        <View style={styles.modalOverlayFull}>
          <View style={styles.modalContentFull}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Anggota & Nilai Ekskul</Text>
                <Text style={styles.modalSubtitle}>{selectedEkskul?.nama_ekskul} • {selectedEkskul?.semester}</Text>
              </View>
              <TouchableOpacity 
                style={styles.btnCetakHeader} 
                onPress={() => {
                  setIsAnggotaOpen(false);
                  handleOpenCetak(selectedEkskul);
                }}
              >
                <Printer size={16} color="#4f46e5" />
                <Text style={styles.btnCetakHeaderText}>Cetak</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsAnggotaOpen(false)} style={{ marginLeft: 8 }}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Tab Filter Anggota: Semua vs Terpilih */}
            <View style={styles.tabSectionAnggota}>
              <TouchableOpacity 
                style={[styles.tabBtn, filterTab === 'semua' && styles.tabBtnActive]} 
                onPress={() => setFilterTab('semua')}
              >
                <Text style={[styles.tabBtnText, filterTab === 'semua' && styles.tabBtnTextActive]}>
                  Semua Siswa ({dataSiswa.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabBtn, filterTab === 'terpilih' && styles.tabBtnActiveGreen]} 
                onPress={() => setFilterTab('terpilih')}
              >
                <CheckCircle size={13} color={filterTab === 'terpilih' ? '#fff' : '#059669'} />
                <Text style={[styles.tabBtnText, filterTab === 'terpilih' && styles.tabBtnTextActive]}>
                  Terpilih ({checkedIds.size})
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchSectionAnggota}>
              <View style={styles.searchBarAnggota}>
                <Search size={18} color="#9ca3af" />
                <TextInput 
                  style={styles.searchInput} 
                  placeholder="Cari nama atau NIPD..." 
                  value={searchSiswa} 
                  onChangeText={setSearchSiswa} 
                />
              </View>
              <View style={styles.pickerWrapperAnggota}>
                <Picker selectedValue={filterKelas} onValueChange={setFilterKelas} style={{ height: 40 }}>
                  {uniqueClasses.map(k => <Picker.Item key={k} label={k === 'Semua' ? 'Semua' : `Kls ${k}`} value={k} />)}
                </Picker>
              </View>
            </View>

            <ScrollView style={styles.modalBodyFull} keyboardShouldPersistTaps="handled">
              {loadingAnggota ? (
                <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
              ) : filteredSiswa.length === 0 ? (
                <Text style={styles.emptyText}>Tidak ada siswa ditemukan.</Text>
              ) : (
                filteredSiswa.map(siswa => {
                  const isChecked = checkedIds.has(siswa.id);
                  return (
                    <View key={siswa.id} style={[styles.siswaRow, isChecked && styles.siswaRowActive]}>
                      <View style={styles.siswaRowHeader}>
                        <Switch 
                          value={isChecked} 
                          onValueChange={() => handleCheckSiswa(siswa.id)} 
                          trackColor={{ true: '#10b981' }} 
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.siswaName}>{siswa.nama}</Text>
                          <Text style={styles.siswaDesc}>{siswa.kelas} • NIPD: {siswa.nipd || '-'}</Text>
                        </View>
                      </View>

                      {isChecked && (
                        <View style={styles.siswaInputs}>
                          {/* Pilihan Tingkat Ekskul / Pramuka */}
                          <View style={styles.tingkatContainer}>
                            <Text style={styles.tingkatLabel}>Tingkat Ekskul (Pramuka):</Text>
                            <View style={styles.tingkatChipsRow}>
                              {['Ramu', 'Rakit', 'Terap'].map((lvl) => {
                                const isLvlChecked = (deskripsiData[siswa.id]?.tingkat || []).includes(lvl);
                                return (
                                  <TouchableOpacity
                                    key={lvl}
                                    style={[styles.tingkatChip, isLvlChecked && styles.tingkatChipActive]}
                                    onPress={() => handleToggleTingkat(siswa.id, lvl)}
                                  >
                                    <Text style={[styles.tingkatChipText, isLvlChecked && styles.tingkatChipTextActive]}>
                                      {isLvlChecked ? `✓ ${lvl}` : lvl}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>

                          <View style={styles.pickerWrapperNilai}>
                            <Picker 
                              selectedValue={deskripsiData[siswa.id]?.predikat || ''} 
                              onValueChange={(val: string) => handleDescChange(siswa.id, 'predikat', val)}
                              style={{ height: 40 }}
                            >
                              <Picker.Item label="-- Predikat --" value="" />
                              <Picker.Item label="Sangat Baik" value="Sangat Baik" />
                              <Picker.Item label="Baik" value="Baik" />
                              <Picker.Item label="Cukup" value="Cukup" />
                              <Picker.Item label="Kurang" value="Kurang" />
                            </Picker>
                          </View>
                          <TextInput 
                            style={styles.inputNilai} 
                            placeholder="Deskripsi / Capaian kompetensi..." 
                            value={deskripsiData[siswa.id]?.deskripsi || ''}
                            onChangeText={(val: string) => handleDescChange(siswa.id, 'deskripsi', val)}
                            multiline
                          />
                        </View>
                      )}
                    </View>
                  );
                })
              )}
              <View style={{ height: 80 }} />
            </ScrollView>

            <View style={styles.modalFooterFixed}>
              <TouchableOpacity style={styles.btnSaveModal} onPress={saveAnggota} disabled={isSavingAnggota}>
                {isSavingAnggota ? <ActivityIndicator color="#fff" /> : <><Save size={20} color="#fff" /><Text style={styles.btnSaveModalText}>Simpan Anggota & Nilai</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CETAK & EKSPOR DATA ANGGOTA */}
      <Modal visible={isCetakModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cetak & Ekspor Data Anggota</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedEkskulForCetak?.nama_ekskul} • TA {selectedEkskulForCetak?.tahun_ajaran} ({selectedEkskulForCetak?.semester})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsCetakModalOpen(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.exportHeaderBar}>
              <TouchableOpacity style={styles.toggleAllBtn} onPress={toggleAllExportCols}>
                {selectedExportCols.length === EXPORT_COLUMNS.length ? (
                  <CheckSquare size={18} color="#2a2c87" />
                ) : (
                  <Square size={18} color="#6b7280" />
                )}
                <Text style={styles.toggleAllText}>
                  {selectedExportCols.length === EXPORT_COLUMNS.length ? 'Batalkan Pilih Semua' : 'Pilih Semua Kolom'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.colCountText}>
                {selectedExportCols.length}/{EXPORT_COLUMNS.length} terpilih
              </Text>
            </View>

            <ScrollView style={{ padding: 16 }}>
              <View style={styles.colGrid}>
                {EXPORT_COLUMNS.map(col => {
                  const isChecked = selectedExportCols.includes(col.id);
                  const isHighlight = col.id === 'predikat' || col.id === 'deskripsi';
                  return (
                    <TouchableOpacity
                      key={col.id}
                      style={[
                        styles.colChip, 
                        isChecked && (isHighlight ? styles.colChipHighlight : styles.colChipActive)
                      ]}
                      onPress={() => toggleExportCol(col.id)}
                    >
                      {isChecked ? (
                        <CheckSquare size={16} color={isHighlight ? '#059669' : '#2a2c87'} />
                      ) : (
                        <Square size={16} color="#9ca3af" />
                      )}
                      <Text style={[styles.colChipText, isChecked && styles.colChipTextActive]}>
                        {col.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.exportFooter}>
              <TouchableOpacity 
                style={[styles.btnExportAction, { backgroundColor: '#4f46e5' }]} 
                onPress={handlePrintPDF}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Printer size={18} color="#fff" />
                    <Text style={styles.btnExportActionText}>Cetak Dokumen (PDF)</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.btnExportAction, { backgroundColor: '#059669' }]} 
                onPress={handleExportCSV}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <FileDown size={18} color="#fff" />
                    <Text style={styles.btnExportActionText}>Ekspor Excel (CSV)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: '#e0e7ff', fontSize: 13 },
  
  filterSection: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  filterRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  pickerWrapper: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, height: 48, justifyContent: 'center' },
  picker: { height: 48 },
  btnAdd: { backgroundColor: '#2a2c87', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  btnAddText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  content: { flex: 1, padding: 16 },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontStyle: 'italic' },
  
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  ekskulName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  ekskulPembina: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  badgeCount: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeCountText: { fontSize: 12, fontWeight: 'bold', color: '#059669' },

  jadwalRow: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 16 },
  jadwalText: { fontSize: 13, color: '#4b5563', fontWeight: '500' },

  cardActions: { flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 14, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  btnTrash: { backgroundColor: '#fef2f2', width: 40 },
  btnEdit: { backgroundColor: '#fffbeb', width: 40 },
  btnCetakAction: { backgroundColor: '#eef2ff', paddingHorizontal: 12 },
  btnCetakActionText: { color: '#4f46e5', fontSize: 13, fontWeight: 'bold' },
  btnAnggota: { flex: 1, backgroundColor: '#10b981' },
  btnAnggotaText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  modalSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  modalBody: { padding: 20 },
  
  formGroup: { marginBottom: 16 },
  labelModal: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 8 },
  inputModal: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 14 },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' },
  btnSaveModal: { backgroundColor: '#2a2c87', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnSaveModalText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Modal Full Anggota
  modalOverlayFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: 50 },
  modalContentFull: { flex: 1, backgroundColor: '#f3f4f6', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  
  btnCetakHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eef2ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#c7d2fe' },
  btnCetakHeaderText: { color: '#4f46e5', fontWeight: 'bold', fontSize: 12 },

  tabSectionAnggota: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', gap: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabBtnActive: { backgroundColor: '#2a2c87' },
  tabBtnActiveGreen: { backgroundColor: '#10b981' },
  tabBtnText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
  tabBtnTextActive: { color: '#fff', fontWeight: 'bold' },

  searchSectionAnggota: { flexDirection: 'row', padding: 16, gap: 8, backgroundColor: '#fff' },
  searchBarAnggota: { flex: 2, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput: { flex: 1, paddingVertical: 8, marginLeft: 8, fontSize: 14 },
  pickerWrapperAnggota: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, justifyContent: 'center' },

  modalBodyFull: { flex: 1, padding: 16 },
  siswaRow: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  siswaRowActive: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  siswaRowHeader: { flexDirection: 'row', alignItems: 'center' },
  siswaName: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  siswaDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  
  siswaInputs: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 12 },
  pickerWrapperNilai: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 },
  inputNilai: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 13, minHeight: 60, textAlignVertical: 'top' },

  modalFooterFixed: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 5 },

  // Modal Cetak & Ekspor
  exportHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  toggleAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleAllText: { fontSize: 13, fontWeight: 'bold', color: '#2a2c87' },
  colCountText: { fontSize: 12, color: '#6b7280' },
  colGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 20 },
  colChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  colChipActive: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  colChipHighlight: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  colChipText: { fontSize: 12, color: '#4b5563' },
  colChipTextActive: { fontWeight: 'bold', color: '#1f2937' },
  exportFooter: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 10 },
  btnExportAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  btnExportActionText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Tingkat Selector
  tingkatContainer: { marginBottom: 2 },
  tingkatLabel: { fontSize: 11, fontWeight: '700', color: '#4b5563', marginBottom: 5 },
  tingkatChipsRow: { flexDirection: 'row', gap: 8 },
  tingkatChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  tingkatChipActive: { backgroundColor: '#ecfdf5', borderColor: '#10b981' },
  tingkatChipText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  tingkatChipTextActive: { color: '#065f46', fontWeight: 'bold' }
});
