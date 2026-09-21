import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
  Modal,
  Switch
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  ChevronLeft,
  Calendar,
  Clock,
  Eye,
  BookOpenCheck,
  FileQuestion,
  Search,
  Plus,
  Edit3,
  Trash2,
  Printer,
  FileText,
  X,
  Check,
  CalendarDays,
  Settings,
  ShieldAlert,
  Camera,
  Layers,
  Award,
  ChevronRight,
  School,
  Building,
  Users,
  Shuffle,
  CheckSquare,
  Square,
  RotateCcw
} from 'lucide-react-native';
import { supabase } from '../../../services/supabaseClient';
import { getOperationalDate, getOperationalDayName, getLocalDate } from '../../utils/dateUtils';

export default function UjianJadwal() {
  const insets = useSafeAreaInsets();

  // Data State
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [mapelList, setMapelList] = useState<any[]>([]);
  const [ruangList, setRuangList] = useState<any[]>([]);
  const [bankSoalList, setBankSoalList] = useState<any[]>([]);
  const [pembelajaranList, setPembelajaranList] = useState<any[]>([]);
  const [activePanitia, setActivePanitia] = useState<any>(null);
  const [activeSop, setActiveSop] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOperatorOrPanitiaCore, setIsOperatorOrPanitiaCore] = useState(false);
  const [isWakaKurikulum, setIsWakaKurikulum] = useState(false);
  const [taughtMapelIds, setTaughtMapelIds] = useState<string[]>([]);

  // Page States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printingRekap, setPrintingRekap] = useState(false);

  // Filters (18.00 Rollover)
  const [filterHari, setFilterHari] = useState<string>(() => getOperationalDayName());
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Tambah / Edit Jadwal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // DateTimePicker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerField, setTimePickerField] = useState<'jam_mulai' | 'jam_selesai' | null>(null);
  const [timePickerDate, setTimePickerDate] = useState(new Date());

  // Form State (Disimplifikasi: tanpa input Guru Pengampu, Ruang, dan Pengawas)
  const initialForm = {
    id: null as string | null,
    nama_ujian: '',
    jenis_ujian: 'PSTS',
    tanggal_ujian: getLocalDate(),
    hari: getOperationalDayName(),
    jam_mulai: '07:30',
    jam_selesai: '09:00',
    durasi_menit: 90,
    mapel_id: '',
    status: 'terjadwal',
    acak_soal: true,
    acak_opsi: true,
    wajib_dijawab: false,
    mode_berkelanjutan: true,
  };
  const [formData, setFormData] = useState(initialForm);

  // Modal Popup Kelas (Untuk Tombol Soal & Nilai)
  const [isKelasModalOpen, setIsKelasModalOpen] = useState(false);
  const [targetKelasAction, setTargetKelasAction] = useState<'soal' | 'nilai' | null>(null);
  const [selectedKelasId, setSelectedKelasId] = useState<string>('');
  const [availableKelasForModal, setAvailableKelasForModal] = useState<any[]>([]);
  const [activeJadwalItem, setActiveJadwalItem] = useState<any>(null);

  // Modal Popup Ruang (Untuk Tombol Awasi, Hadir Peserta, Hadir Pengawas & Berita Acara)
  const [isRuangModalOpen, setIsRuangModalOpen] = useState(false);
  const [targetRuangAction, setTargetRuangAction] = useState<'awasi' | 'hadir' | 'hadir_pengawas' | 'berita_acara' | null>(null);
  const [selectedRuangId, setSelectedRuangId] = useState<string>('');

  // Modal Pengaturan Ruang Peserta
  const [isRuangPesertaModalOpen, setIsRuangPesertaModalOpen] = useState(false);
  const [targetJadwalForRuang, setTargetJadwalForRuang] = useState<any>(null);
  const [modeRuang, setModeRuang] = useState<'default' | 'acak' | 'custom'>('default');
  const [selectedActiveRuangIds, setSelectedActiveRuangIds] = useState<string[]>([]);
  const [siswaPesertaList, setSiswaPesertaList] = useState<any[]>([]);
  const [alokasiRuangMap, setAlokasiRuangMap] = useState<Record<string, string>>({});
  const [customTargetRuangId, setCustomTargetRuangId] = useState<string>('');
  const [loadingRuangPeserta, setLoadingRuangPeserta] = useState(false);
  const [savingRuangPeserta, setSavingRuangPeserta] = useState(false);
  const [searchSiswaRuang, setSearchSiswaRuang] = useState('');
  const [filterKelasRuang, setFilterKelasRuang] = useState('Semua');

  // Modal Pengaturan Ujian CBT
  const [isPengaturanModalOpen, setIsPengaturanModalOpen] = useState(false);
  const [savingPengaturan, setSavingPengaturan] = useState(false);
  const [pengaturanData, setPengaturanData] = useState({
    id: null as number | null,
    tampilkan_kamera: true,
    blokir_menengok: true,
    blokir_pindah_tab: true,
    durasi_blokir_detik: 300,
    menit_tombol_selesai: 15,
    tampilkan_hasil: false,
    tampilkan_ranking: false,
    waktu_fleksibel: false,
  });

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchUserInfo(), fetchMetadata(), fetchJadwal(), fetchPengaturan()]);
    } catch (err) {
      console.error('Error init jadwal page:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user_guru');
      if (userStr) {
        const u = JSON.parse(userStr);
        setCurrentUser(u);

        // 1. Cek Jabatan Guru
        const { data: jg } = await supabase
          .from('jabatan_guru')
          .select('jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3')
          .eq('guru_id', u.id)
          .maybeSingle();

        // 2. Cek Struktur Panitia CBT
        const { data: panitia } = await supabase
          .from('cbt_struktur_panitia')
          .select('*')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        const roles: string[] = [];
        if (jg) {
          [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3].forEach(r => {
            if (r) roles.push(r);
          });
        }

        const isOp = u.role === 'admin' || roles.some(r => {
          const l = (r || '').toLowerCase();
          return l.includes('operator') || l.includes('admin');
        });

        const isKetua = Boolean(
          (panitia?.ketua_panitia_guru_id && Number(panitia.ketua_panitia_guru_id) === Number(u.id)) ||
          roles.some(r => {
            const l = (r || '').toLowerCase();
            return l.includes('ketua panitia') || l.includes('ketua ujian');
          })
        );
        const isSekretaris = Boolean(
          (panitia?.sekretaris_guru_id && Number(panitia.sekretaris_guru_id) === Number(u.id)) ||
          roles.some(r => {
            const l = (r || '').toLowerCase();
            return l.includes('sekretaris panitia') || l.includes('sekretaris ujian');
          })
        );

        // Core OPS / Panitia (Operator, Ketua Panitia, Sekretaris Panitia)
        const isCore = isOp || isKetua || isSekretaris;

        // Waka Kurikulum (Hanya Kurikulum, bukan Wakasek Kesiswaan atau waka lainnya)
        const isWaka = !isCore && roles.some(r => {
          const l = (r || '').toLowerCase();
          return l.includes('kurikulum');
        });

        setIsOperatorOrPanitiaCore(isCore);
        setIsWakaKurikulum(isWaka);

        // 3. Mapel yang diampu guru DARI TABEL PEMBELAJARAN
        const mapelIdsSet = new Set<string>();
        try {
          const [pemRes, jadRes] = await Promise.all([
            supabase.from('pembelajaran').select('mapel_id, kelas_id').eq('guru_id', u.id),
            supabase.from('jadwal_pelajaran').select('mapel_id').eq('guru_id', u.id)
          ]);
          (pemRes.data || []).forEach((p: any) => { if (p.mapel_id) mapelIdsSet.add(String(p.mapel_id)); });
          (jadRes.data || []).forEach((j: any) => { if (j.mapel_id) mapelIdsSet.add(String(j.mapel_id)); });
        } catch (err) {
          console.error('Error fetching guru mapel from pembelajaran:', err);
        }
        setTaughtMapelIds(Array.from(mapelIdsSet));
      }
    } catch (e) {
      console.error('Error fetchUserInfo:', e);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [kRes, mRes, rRes, bRes, sRes, pRes] = await Promise.all([
        supabase.from('data_kelas').select('id, nama_kelas, ruang_id').order('nama_kelas'),
        supabase.from('data_mapel').select('id, nama_mapel').order('nama_mapel'),
        supabase.from('data_ruang').select('id, nama_ruang').order('nama_ruang'),
        supabase.from('cbt_bank_soal').select('id, judul, total_soal, tingkat_kelas, mapel_id').order('judul'),
        supabase.from('cbt_sop_persetujuan').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('pembelajaran').select('id, guru_id, kelas_id, mapel_id'),
      ]);

      if (kRes.data) {
        setKelasList(kRes.data);
        if (kRes.data.length > 0 && !selectedKelasId) {
          setSelectedKelasId(String(kRes.data[0].id));
        }
      }
      if (mRes.data) setMapelList(mRes.data);
      if (rRes.data) {
        setRuangList(rRes.data);
        if (rRes.data.length > 0 && !selectedRuangId) {
          setSelectedRuangId(String(rRes.data[0].id));
        }
      }
      if (bRes.data) setBankSoalList(bRes.data);
      if (sRes.data) setActiveSop(sRes.data);
      if (pRes.data) setPembelajaranList(pRes.data);
    } catch (e) {
      console.error('Error fetchMetadata:', e);
    }
  };

  const fetchJadwal = async () => {
    try {
      const { data, error } = await supabase
        .from('cbt_jadwal_ujian')
        .select(`
          *,
          data_mapel(id, nama_mapel),
          data_kelas(id, nama_kelas),
          data_ruang(id, nama_ruang),
          guru_pengampu:data_guru!cbt_jadwal_ujian_guru_id_fkey(id, nama, nip),
          pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(id, nama, nip),
          cbt_bank_soal(id, judul, total_soal)
        `)
        .order('tanggal_ujian', { ascending: false })
        .order('jam_mulai', { ascending: true });

      if (error) throw error;
      setJadwalList(data || []);
    } catch (err: any) {
      console.error('Error fetchJadwal:', err);
      Alert.alert('Gagal Memuat', err.message || 'Terjadi kesalahan sistem.');
    }
  };

  const fetchPengaturan = async () => {
    try {
      const { data, error } = await supabase
        .from('cbt_pengaturan_ujian')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setPengaturanData({
          id: data.id,
          tampilkan_kamera: data.tampilkan_kamera !== false,
          blokir_menengok: data.blokir_menengok !== false,
          blokir_pindah_tab: data.blokir_pindah_tab !== false,
          durasi_blokir_detik: data.durasi_blokir_detik || 300,
          menit_tombol_selesai: data.menit_tombol_selesai ?? 15,
          tampilkan_hasil: !!data.tampilkan_hasil,
          tampilkan_ranking: !!data.tampilkan_ranking,
          waktu_fleksibel: !!data.waktu_fleksibel,
        });
      }
    } catch (e) {
      console.error('Error load pengaturan cbt:', e);
    }
  };

  const handleSavePengaturan = async () => {
    try {
      setSavingPengaturan(true);
      const payload: any = {
        tampilkan_kamera: pengaturanData.tampilkan_kamera,
        blokir_menengok: pengaturanData.blokir_menengok,
        blokir_pindah_tab: pengaturanData.blokir_pindah_tab,
        durasi_blokir_detik: Number(pengaturanData.durasi_blokir_detik) || 300,
        menit_tombol_selesai: Number(pengaturanData.menit_tombol_selesai) || 15,
        tampilkan_hasil: pengaturanData.tampilkan_hasil,
        tampilkan_ranking: pengaturanData.tampilkan_ranking,
        waktu_fleksibel: pengaturanData.waktu_fleksibel,
        updated_at: new Date().toISOString(),
      };

      if (pengaturanData.id) {
        const { error } = await supabase.from('cbt_pengaturan_ujian').update(payload).eq('id', pengaturanData.id);
        if (error) throw error;
      } else {
        const { data: newRow, error } = await supabase.from('cbt_pengaturan_ujian').insert([payload]).select().single();
        if (error) throw error;
        if (newRow) setPengaturanData(prev => ({ ...prev, id: newRow.id }));
      }

      Alert.alert('Berhasil', 'Pengaturan sistem ujian CBT berhasil disimpan.');
      setIsPengaturanModalOpen(false);
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal menyimpan pengaturan ujian.');
    } finally {
      setSavingPengaturan(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await initData();
  };

  const calculateHari = (dateString: string) => {
    if (!dateString) return 'Senin';
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(dateString);
    return days[d.getDay()] || 'Senin';
  };

  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const dayName = calculateHari(dateStr);
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${dayName}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  // Time Picker Helper & Calculation
  const openTimePicker = (field: 'jam_mulai' | 'jam_selesai') => {
    setTimePickerField(field);
    const timeValue = formData[field] || (field === 'jam_mulai' ? '07:30' : '09:00');
    const d = new Date();
    if (timeValue && timeValue.includes(':')) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      d.setHours(hours || 0, minutes || 0, 0, 0);
    }
    setTimePickerDate(d);
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (event.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    if (selectedDate && timePickerField) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      setFormData(prev => {
        const next = { ...prev, [timePickerField]: timeStr };
        const m = timePickerField === 'jam_mulai' ? timeStr : next.jam_mulai;
        const s = timePickerField === 'jam_selesai' ? timeStr : next.jam_selesai;
        if (m && s && m.includes(':') && s.includes(':')) {
          const [h1, min1] = m.split(':').map(Number);
          const [h2, min2] = s.split(':').map(Number);
          const diff = (h2 * 60 + min2) - (h1 * 60 + min1);
          if (diff > 0) {
            next.durasi_menit = diff;
          }
        }
        return next;
      });
      setTimePickerDate(selectedDate);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      const str = `${yyyy}-${mm}-${dd}`;
      setFormData(prev => ({
        ...prev,
        tanggal_ujian: str,
        hari: calculateHari(str),
      }));
    }
  };

  // Save Jadwal: Otomatis mendeteksi kelas dan guru pengampu dari tabel pembelajaran
  const handleSaveJadwal = async () => {
    if (!formData.nama_ujian.trim()) {
      Alert.alert('Validasi', 'Nama sesi ujian wajib diisi.');
      return;
    }
    if (!formData.mapel_id) {
      Alert.alert('Validasi', 'Silakan pilih mata pelajaran.');
      return;
    }

    try {
      setSaving(true);

      // 1. Deteksi otomatis kelas & guru pengampu dari tabel pembelajaran
      const { data: pembData } = await supabase
        .from('pembelajaran')
        .select('guru_id, kelas_id')
        .eq('mapel_id', formData.mapel_id);

      const detectedGuruId = pembData && pembData.length > 0 ? pembData[0].guru_id : null;
      const detectedKelasId = pembData && pembData.length === 1 ? pembData[0].kelas_id : null;

      // 2. Deteksi bank soal yang cocok untuk mapel ini jika ada
      let detectedBankId = null;
      const matchingBank = bankSoalList.find(b => Number(b.mapel_id) === Number(formData.mapel_id));
      if (matchingBank) {
        detectedBankId = matchingBank.id;
      }

      const payload: any = {
        nama_ujian: formData.nama_ujian.trim(),
        jenis_ujian: formData.jenis_ujian,
        tanggal_ujian: formData.tanggal_ujian,
        hari: calculateHari(formData.tanggal_ujian),
        jam_mulai: formData.jam_mulai,
        jam_selesai: formData.jam_selesai,
        durasi_menit: Number(formData.durasi_menit) || 90,
        mapel_id: formData.mapel_id || null,
        guru_id: detectedGuruId,
        kelas_id: detectedKelasId,
        ruang_id: null,
        pengawas_guru_id: null,
        bank_soal_id: detectedBankId,
        status: formData.status || 'terjadwal',
        acak_soal: formData.acak_soal ?? true,
        acak_opsi: formData.acak_opsi ?? true,
        wajib_dijawab: formData.wajib_dijawab ?? false,
        mode_berkelanjutan: formData.mode_berkelanjutan ?? true,
        sop_id: activeSop?.id || null,
      };

      if (formData.id) {
        const { error } = await supabase.from('cbt_jadwal_ujian').update(payload).eq('id', formData.id);
        if (error) throw error;
        Alert.alert('Berhasil', 'Jadwal ujian berhasil diperbarui.');
      } else {
        const { error } = await supabase.from('cbt_jadwal_ujian').insert([payload]);
        if (error) throw error;
        Alert.alert(
          'Berhasil',
          pembData && pembData.length > 0
            ? `Jadwal ujian baru berhasil ditambahkan. Terdeteksi otomatis pada ${pembData.length} kelas di tabel pembelajaran.`
            : 'Jadwal ujian baru berhasil ditambahkan.'
        );
      }

      setIsModalOpen(false);
      setFormData(initialForm);
      await fetchJadwal();
    } catch (err: any) {
      Alert.alert('Gagal', err.message || 'Gagal menyimpan jadwal ujian.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Jadwal
  const handleDeleteJadwal = (id: string, nama: string) => {
    Alert.alert(
      'Hapus Jadwal Ujian?',
      `Yakin ingin menghapus sesi ujian "${nama}"? Seluruh data sesi siswa terkait akan ikut terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('cbt_jadwal_ujian').delete().eq('id', id);
              if (error) throw error;
              Alert.alert('Sukses', 'Jadwal ujian berhasil dihapus.');
              await fetchJadwal();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Gagal menghapus jadwal.');
            }
          }
        }
      ]
    );
  };

  // Popup Handler: Tombol Soal & Nilai -> Modal Pilih Kelas (Menyesuaikan tabel pembelajaran & guru)
  const handleOpenKelasModal = (jadwal: any, action: 'soal' | 'nilai') => {
    setActiveJadwalItem(jadwal);
    setTargetKelasAction(action);

    const mapelId = Number(jadwal.mapel_id);
    const pembForMapel = pembelajaranList.filter(p => Number(p.mapel_id) === mapelId);

    let targetKelasList = kelasList;

    // 1. Jika Guru Mapel yang sedang login:
    // Tampilkan HANYA kelas-kelas yang diampunya untuk mapel tersebut
    if (!isOperatorOrPanitiaCore && !isWakaKurikulum && currentUser?.id) {
      const myClassesForThisMapel = pembForMapel
        .filter(p => Number(p.guru_id) === Number(currentUser.id))
        .map(p => Number(p.kelas_id));

      if (myClassesForThisMapel.length > 0) {
        targetKelasList = kelasList.filter(k => myClassesForThisMapel.includes(Number(k.id)));
      } else if (pembForMapel.length > 0) {
        const allClassesForThisMapel = pembForMapel.map(p => Number(p.kelas_id));
        targetKelasList = kelasList.filter(k => allClassesForThisMapel.includes(Number(k.id)));
      }
    } else {
      // 2. Jika Operator / Panitia / Waka Kurikulum:
      // Tampilkan seluruh kelas yang memiliki mapel tersebut di tabel pembelajaran
      if (pembForMapel.length > 0) {
        const allClassesForThisMapel = pembForMapel.map(p => Number(p.kelas_id));
        const matched = kelasList.filter(k => allClassesForThisMapel.includes(Number(k.id)));
        if (matched.length > 0) {
          targetKelasList = matched;
        }
      }
    }

    setAvailableKelasForModal(targetKelasList);
    if (targetKelasList.length > 0) {
      setSelectedKelasId(String(targetKelasList[0].id));
    } else if (kelasList.length > 0) {
      setSelectedKelasId(String(kelasList[0].id));
    }

    setIsKelasModalOpen(true);
  };

  const handleConfirmKelasModal = () => {
    if (!selectedKelasId) {
      Alert.alert('Peringatan', 'Silakan pilih kelas terlebih dahulu.');
      return;
    }
    setIsKelasModalOpen(false);

    if (targetKelasAction === 'soal') {
      const matchingBank = bankSoalList.find(b => Number(b.mapel_id) === Number(activeJadwalItem?.mapel_id));
      const bankIdToUse = activeJadwalItem?.bank_soal_id || matchingBank?.id || '';

      router.push({
        pathname: '/ujian/soal' as any,
        params: {
          bankSoalId: bankIdToUse,
          kelasId: selectedKelasId,
          mapelId: activeJadwalItem?.mapel_id || '',
          jadwalId: activeJadwalItem?.id || '',
        },
      });
    } else if (targetKelasAction === 'nilai') {
      router.push({
        pathname: '/ujian/nilai' as any,
        params: {
          jadwalId: activeJadwalItem?.id || '',
          kelasId: selectedKelasId,
        },
      });
    }
  };

  // Popup Handler: Tombol Awasi, Hadir, Hadir Pengawas, Berita Acara -> Modal Pilih Ruangan
  const handleOpenRuangModal = (jadwal: any, action: 'awasi' | 'hadir' | 'hadir_pengawas' | 'berita_acara') => {
    setActiveJadwalItem(jadwal);
    setTargetRuangAction(action);
    if (ruangList.length > 0 && !selectedRuangId) {
      setSelectedRuangId(String(ruangList[0].id));
    }
    setIsRuangModalOpen(true);
  };

  const handleConfirmRuangModal = () => {
    if (!selectedRuangId) {
      Alert.alert('Peringatan', 'Silakan pilih ruangan terlebih dahulu.');
      return;
    }
    const item = activeJadwalItem;
    const ruangId = selectedRuangId;
    const action = targetRuangAction;
    setIsRuangModalOpen(false);

    if (action === 'awasi') {
      router.push({
        pathname: '/ujian/awasi' as any,
        params: {
          jadwalId: item.id,
          ruangId: ruangId,
        },
      });
    } else if (action === 'hadir') {
      handlePrintHadir(item, ruangId);
    } else if (action === 'hadir_pengawas') {
      handlePrintHadirPengawas(item, ruangId);
    } else if (action === 'berita_acara') {
      handlePrintBeritaAcara(item, ruangId);
    }
  };

  // Cetak Rekapitulasi Jadwal Ujian Resmi (Header Button)
  const handlePrintRekap = async () => {
    try {
      setPrintingRekap(true);
      const [lembagaRes, panitiaRes, sopRes, guruRes] = await Promise.all([
        supabase.from('data_lembaga').select('*').limit(1).maybeSingle(),
        supabase.from('cbt_struktur_panitia').select('*').order('id', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cbt_sop_persetujuan').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('data_guru').select('id, nama, nip'),
      ]);

      const lembaga = lembagaRes.data || {};
      const sop = sopRes.data || activeSop || {};
      const panitia = panitiaRes.data || {};
      const allGuru = guruRes.data || [];

      // Cari Nama Ketua Panitia & Kepala Sekolah
      let ketuaNama = 'Ketua Panitia';
      let ketuaNip = '-';
      if (panitia.ketua_panitia_guru_id) {
        const found = allGuru.find((g: any) => Number(g.id) === Number(panitia.ketua_panitia_guru_id));
        if (found) {
          ketuaNama = found.nama;
          ketuaNip = found.nip || '-';
        }
      }

      let kepsekNama = lembaga.kepala_sekolah || 'Kepala Sekolah';
      let kepsekNip = lembaga.nip_kepala_sekolah || '-';

      // Urutkan jadwal berdasarkan tanggal dan jam
      const sorted = [...jadwalList].sort((a, b) => {
        return (a.tanggal_ujian || '').localeCompare(b.tanggal_ujian || '') || (a.jam_mulai || '').localeCompare(b.jam_mulai || '');
      });

      const rowsHtml = sorted.map((j: any, idx: number) => `
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

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Jadwal Pelaksanaan Ujian CBT - ${lembaga.nama_lembaga || 'SMP IT HM'}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.3; }
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

      // Langsung kirim ke printer via print dialog (bukan simpan/share PDF)
      await Print.printAsync({ html: htmlContent });
    } catch (e: any) {
      console.error('Error print rekap:', e);
      Alert.alert('Gagal Mencetak', e.message || 'Terjadi kesalahan saat mencetak jadwal.');
    } finally {
      setPrintingRekap(false);
    }
  };

  // Print PDF Hadir Peserta (Menyesuaikan Ruangan Terpilih)
  const handlePrintHadir = async (jadwal: any, ruangId: string) => {
    try {
      setPrintingId(jadwal.id);
      const selectedRuang = ruangList.find((r) => String(r.id) === String(ruangId)) || jadwal.data_ruang;

      const [siswaRes, lembagaRes, panitiaRes, sopRes] = await Promise.all([
        supabase
          .from('data_siswa')
          .select('id, nama_lengkap, nipd, nisn, kelas')
          .order('kelas', { ascending: true })
          .order('nama_lengkap', { ascending: true }),
        supabase.from('data_lembaga').select('*').limit(1).maybeSingle(),
        supabase.from('cbt_struktur_panitia').select('*').order('id', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cbt_sop_persetujuan').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const siswaList = siswaRes.data || [];
      const lembaga = lembagaRes.data || {};
      const sop = sopRes.data || activeSop || {};
      const panitia = panitiaRes.data || {};

      let ketuaNama = 'Ketua Panitia';
      let ketuaNip = '-';
      if (panitia.ketua_panitia_guru_id) {
        const { data: gData } = await supabase.from('data_guru').select('nama, nip').eq('id', panitia.ketua_panitia_guru_id).maybeSingle();
        if (gData) {
          ketuaNama = gData.nama || ketuaNama;
          ketuaNip = gData.nip || ketuaNip;
        }
      }

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

      const rowsHtml = siswaList.map((s: any, idx: number) => `
        <tr style="height:32px;">
          <td style="border:1px solid #000; text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="border:1px solid #000; text-align:center; font-family:monospace;">${s.nipd || '-'}</td>
          <td style="border:1px solid #000; text-align:center; font-family:monospace;">${s.nisn || '-'}</td>
          <td style="border:1px solid #000; padding:0 8px; font-weight:600;">${s.nama_lengkap || '-'}</td>
          <td style="border:1px solid #000; text-align:center;">${s.kelas || '-'}</td>
          <td style="border:1px solid #000; text-align:center;">${selectedRuang?.nama_ruang || 'Lab CBT'}</td>
          <td style="border:1px solid #000; padding:0 6px; width:70px; font-size:10px; color:#555;">${idx % 2 === 0 ? `${idx + 1}. .........` : ''}</td>
          <td style="border:1px solid #000; padding:0 6px; width:70px; font-size:10px; color:#555;">${idx % 2 !== 0 ? `${idx + 1}. .........` : ''}</td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Daftar Hadir Peserta - ${jadwal.nama_ujian}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.3; }
            .header-table { width: 100%; border-collapse: collapse; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
            .kop-title { font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 0; }
            .kop-sub { font-size: 9pt; margin: 2px 0; }
            .doc-title { text-align: center; font-weight: bold; text-decoration: underline; font-size: 13pt; text-transform: uppercase; margin: 10px 0 2px 0; }
            .meta-table { width: 100%; margin: 10px 0 14px 0; font-size: 10.5pt; }
            .meta-table td { padding: 2px 4px; }
            .content-table { width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 9.5pt; font-family: Arial, sans-serif; }
            .content-table th { border: 1px solid #000; background-color: #f1f5f9; padding: 6px 4px; font-weight: bold; text-align: center; }
            .ttd-container { margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; }
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

          <div class="doc-title">DAFTAR HADIR PESERTA ${jadwal.jenis_ujian || 'CBT'}</div>
          <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 12px;">TAHUN AJARAN ${sop.tahun_ajaran || '2025/2026'}</div>

          <table class="meta-table">
            <tr>
              <td style="width: 18%;">Mata Pelajaran</td>
              <td style="width: 32%;">: <strong>${jadwal.data_mapel?.nama_mapel || jadwal.nama_ujian}</strong></td>
              <td style="width: 18%;">Hari / Tanggal</td>
              <td style="width: 32%;">: ${formatDateIndo(jadwal.tanggal_ujian)}</td>
            </tr>
            <tr>
              <td>Ruang Ujian</td>
              <td>: <strong>${selectedRuang?.nama_ruang || 'Lab CBT'}</strong></td>
              <td>Waktu Ujian</td>
              <td>: ${jadwal.jam_mulai?.substring(0, 5)} - ${jadwal.jam_selesai?.substring(0, 5)} WIB (${jadwal.durasi_menit} Menit)</td>
            </tr>
          </table>

          <table class="content-table">
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th style="width: 75px;">NIPD</th>
                <th style="width: 85px;">NISN</th>
                <th style="text-align: left; padding-left: 8px;">Nama Peserta</th>
                <th style="width: 60px;">Kelas</th>
                <th style="width: 75px;">Ruang</th>
                <th colspan="2" style="width: 140px;">Tanda Tangan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:15px;">Tidak ada data peserta.</td></tr>'}
            </tbody>
          </table>

          <div class="ttd-container">
            <div class="ttd-box">
              <p style="margin: 0; font-weight: bold;">Pengawas Ruang Ujian,</p>
              <div style="height: 65px;"></div>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${jadwal.pengawas?.nama || '( ........................................... )'}</p>
              <p style="margin: 2px 0 0 0; font-size: 9pt; color: #444;">NIP. ${jadwal.pengawas?.nip || '-'}</p>
            </div>
            <div class="ttd-box">
              <p style="margin: 0;">${sop.titimangsa_tempat || 'Compreng'}, ${formatDateIndo(sop.titimangsa_tanggal || jadwal.tanggal_ujian)}</p>
              <p style="margin: 2px 0 0 0; font-weight: bold;">Ketua Panitia ${jadwal.jenis_ujian || 'CBT'},</p>
              ${ttdKetuaHtml}
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${ketuaNama}</p>
              <p style="margin: 2px 0 0 0; font-size: 9pt; color: #444;">NIP. ${ketuaNip}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Langsung kirim ke printer
      await Print.printAsync({ html: htmlContent });
    } catch (e: any) {
      console.error('Error print daftar hadir:', e);
      Alert.alert('Gagal Mencetak', e.message || 'Terjadi kesalahan cetak.');
    } finally {
      setPrintingId(null);
    }
  };

  // Print PDF Berita Acara (Menyesuaikan Ruangan Terpilih)
  const handlePrintBeritaAcara = async (jadwal: any, ruangId: string) => {
    try {
      setPrintingId(jadwal.id);
      const selectedRuang = ruangList.find((r) => String(r.id) === String(ruangId)) || jadwal.data_ruang;

      const [lembagaRes, panitiaRes, sopRes, sesiRes] = await Promise.all([
        supabase.from('data_lembaga').select('*').limit(1).maybeSingle(),
        supabase.from('cbt_struktur_panitia').select('*').order('id', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cbt_sop_persetujuan').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cbt_sesi_siswa').select('id, status').eq('jadwal_id', jadwal.id),
      ]);

      const lembaga = lembagaRes.data || {};
      const sop = sopRes.data || activeSop || {};
      const panitia = panitiaRes.data || {};
      const sesiList = sesiRes.data || [];
      const totalHadir = sesiList.filter((s: any) => s.status === 'selesai' || s.status === 'sedang_ujian').length;

      let ketuaNama = 'Ketua Panitia';
      let ketuaNip = '-';
      if (panitia.ketua_panitia_guru_id) {
        const { data: gData } = await supabase.from('data_guru').select('nama, nip').eq('id', panitia.ketua_panitia_guru_id).maybeSingle();
        if (gData) {
          ketuaNama = gData.nama || ketuaNama;
          ketuaNip = gData.nip || ketuaNip;
        }
      }

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

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Berita Acara - ${jadwal.nama_ujian}</title>
          <style>
            @page { size: A4 portrait; margin: 18mm; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 11.5pt; color: #000; line-height: 1.5; }
            .header-table { width: 100%; border-collapse: collapse; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 16px; }
            .kop-title { font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 0; }
            .kop-sub { font-size: 9pt; margin: 2px 0; }
            .doc-title { text-align: center; font-weight: bold; text-decoration: underline; font-size: 13.5pt; text-transform: uppercase; margin: 12px 0 2px 0; }
            .meta-list { margin: 14px 0; }
            .meta-row { display: flex; margin-bottom: 4px; }
            .meta-label { width: 220px; font-weight: 500; }
            .meta-val { flex: 1; font-weight: bold; }
            .catatan-box { border: 1px solid #333; background-color: #fafafa; padding: 12px; border-radius: 4px; min-height: 80px; margin: 14px 0; font-size: 10.5pt; }
            .ttd-container { margin-top: 36px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .ttd-box { width: 45%; text-align: center; font-size: 11pt; }
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

          <div class="doc-title">BERITA ACARA PELAKSANAAN UJIAN ${jadwal.jenis_ujian || 'CBT'}</div>
          <div style="text-align: center; font-size: 10.5pt; font-weight: bold; margin-bottom: 16px;">TAHUN AJARAN ${sop.tahun_ajaran || '2025/2026'}</div>

          <p style="text-align: justify; text-indent: 28px;">
            Pada hari ini <strong>${calculateHari(jadwal.tanggal_ujian)}</strong> tanggal <strong>${formatDateIndo(jadwal.tanggal_ujian)}</strong>,
            telah diselenggarakan Ujian Berbasis Komputer (CBT) untuk mata pelajaran <strong>${jadwal.data_mapel?.nama_mapel || jadwal.nama_ujian}</strong>
            pada satuan pendidikan <strong>${lembaga.nama_lembaga || 'SMP IT Hidayatul Mubtadi-ien'}</strong> dengan rincian sebagai berikut:
          </p>

          <div class="meta-list">
            <div class="meta-row"><div class="meta-label">1. Sesi Ujian / Jenis</div><div class="meta-val">: ${jadwal.nama_ujian} (${jadwal.jenis_ujian || 'CBT'})</div></div>
            <div class="meta-row"><div class="meta-label">2. Ruang Ujian</div><div class="meta-val">: ${selectedRuang?.nama_ruang || 'Lab CBT'}</div></div>
            <div class="meta-row"><div class="meta-label">3. Waktu Pelaksanaan</div><div class="meta-val">: Pukul ${jadwal.jam_mulai?.substring(0, 5)} s.d. ${jadwal.jam_selesai?.substring(0, 5)} WIB (${jadwal.durasi_menit} Menit)</div></div>
            <div class="meta-row"><div class="meta-label">4. Jumlah Peserta Hadir</div><div class="meta-val">: ${totalHadir > 0 ? `${totalHadir} Siswa` : 'Tercatat sesuai presensi'}</div></div>
          </div>

          <p style="font-weight: bold; margin-bottom: 4px;">Catatan Selama Ujian Berlangsung:</p>
          <div class="catatan-box">
            Pelaksanaan ujian CBT berlangsung tertib, aman, dan terkendali. Tidak ditemukan kendala teknis ataupun kecurangan pada sistem proctoring ruang ujian.
          </div>

          <p style="text-align: justify;">
            Demikian berita acara pelaksanaan ujian ini dibuat dengan sesungguhnya dan penuh tanggung jawab untuk dipergunakan sebagaimana mestinya.
          </p>

          <div class="ttd-container">
            <div class="ttd-box">
              <p style="margin: 0; font-weight: bold;">Pengawas Ruang Ujian,</p>
              <div style="height: 65px;"></div>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${jadwal.pengawas?.nama || '( ........................................... )'}</p>
              <p style="margin: 2px 0 0 0; font-size: 9.5pt; color: #444;">NIP. ${jadwal.pengawas?.nip || '-'}</p>
            </div>
            <div class="ttd-box">
              <p style="margin: 0;">${sop.titimangsa_tempat || 'Compreng'}, ${formatDateIndo(sop.titimangsa_tanggal || jadwal.tanggal_ujian)}</p>
              <p style="margin: 2px 0 0 0; font-weight: bold;">Ketua Panitia ${jadwal.jenis_ujian || 'CBT'},</p>
              ${ttdKetuaHtml}
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${ketuaNama}</p>
              <p style="margin: 2px 0 0 0; font-size: 9.5pt; color: #444;">NIP. ${ketuaNip}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Langsung kirim ke printer
      await Print.printAsync({ html: htmlContent });
    } catch (e: any) {
      console.error('Error print berita acara:', e);
      Alert.alert('Gagal Mencetak', e.message || 'Terjadi kesalahan cetak.');
    } finally {
      setPrintingId(null);
    }
  };

  // Print PDF/Cetak Langsung Hadir Pengawas (Menyesuaikan Ruangan Terpilih)
  const handlePrintHadirPengawas = async (jadwal: any, ruangId: string) => {
    try {
      setPrintingId(jadwal.id);
      const selectedRuang = ruangList.find((r) => String(r.id) === String(ruangId)) || jadwal.data_ruang;

      const [lembagaRes, panitiaRes, sopRes, guruRes, allJadwalRes] = await Promise.all([
        supabase.from('data_lembaga').select('*').limit(1).maybeSingle(),
        supabase.from('cbt_struktur_panitia').select('*').order('id', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cbt_sop_persetujuan').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('data_guru').select('id, nama, nip'),
        supabase.from('cbt_jadwal_ujian').select(`
          *,
          data_mapel(nama_mapel),
          data_ruang(nama_ruang),
          pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(id, nama, nip)
        `).order('tanggal_ujian', { ascending: true }).order('jam_mulai', { ascending: true })
      ]);

      const lembaga = lembagaRes.data || {};
      const sop = sopRes.data || activeSop || {};
      const panitia = panitiaRes.data || {};
      const allGuru = guruRes.data || [];
      const allJadwals = allJadwalRes.data || [];

      let ketuaNama = 'Ketua Panitia';
      let ketuaNip = '-';
      if (panitia.ketua_panitia_guru_id) {
        const found = allGuru.find((g: any) => Number(g.id) === Number(panitia.ketua_panitia_guru_id));
        if (found) {
          ketuaNama = found.nama;
          ketuaNip = found.nip || '-';
        }
      }

      let kepsekNama = lembaga.kepala_sekolah || 'Kepala Sekolah';
      let kepsekNip = lembaga.nip_kepala_sekolah || '-';

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

      const targetList = allJadwals.filter(j => String(j.id) === String(jadwal.id) || (j.tanggal_ujian === jadwal.tanggal_ujian));
      const listToRender = targetList.length > 0 ? targetList : [jadwal];

      const rowsHtml = listToRender.map((item: any, idx: number) => `
        <tr style="height:38px;">
          <td style="border:1px solid #000; text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="border:1px solid #000; padding:0 8px; font-weight:600;">${item.hari || calculateHari(item.tanggal_ujian)}, ${formatDateIndo(item.tanggal_ujian)}</td>
          <td style="border:1px solid #000; padding:0 8px; font-weight:bold;">${item.pengawas?.nama || 'Guru Pengawas'}</td>
          <td style="border:1px solid #000; text-align:center;">${selectedRuang?.nama_ruang || item.data_ruang?.nama_ruang || 'Lab CBT'}</td>
          <td style="border:1px solid #000; padding:0 8px;">${item.data_mapel?.nama_mapel || item.nama_ujian}</td>
          <td style="border:1px solid #000; padding:0 8px; font-size:10pt; color:#64748b;">${idx + 1}. ....................</td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Daftar Hadir Pengawas - ${lembaga.nama_lembaga || 'SMP IT HM'}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; line-height: 1.3; }
            .header-table { width: 100%; border-collapse: collapse; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
            .kop-title { font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 0; }
            .kop-sub { font-size: 9pt; margin: 2px 0; }
            .doc-title { text-align: center; font-weight: bold; text-decoration: underline; font-size: 13pt; text-transform: uppercase; margin: 12px 0 2px 0; }
            .content-table { width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 10pt; font-family: Arial, sans-serif; margin-top: 14px; }
            .content-table th { border: 1px solid #000; background-color: #f1f5f9; padding: 7px 4px; font-weight: bold; text-align: center; }
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

          <div class="doc-title">DAFTAR HADIR PENGAWAS UJIAN ${jadwal.jenis_ujian || 'CBT'}</div>
          <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 12px;">TAHUN AJARAN ${sop.tahun_ajaran || '2025/2026'}</div>

          <table class="content-table">
            <thead>
              <tr>
                <th style="width: 32px;">No</th>
                <th style="width: 130px; text-align: left; padding-left: 8px;">Hari / Tanggal</th>
                <th style="text-align: left; padding-left: 8px;">Nama Pengawas</th>
                <th style="width: 90px;">Ruang</th>
                <th style="width: 140px; text-align: left; padding-left: 8px;">Mata Pelajaran</th>
                <th style="width: 110px;">Tanda Tangan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="ttd-container">
            <div class="ttd-box">
              <p style="margin: 0; font-weight: bold;">Ketua Panitia CBT,</p>
              ${ttdKetuaHtml}
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${ketuaNama}</p>
              <p style="margin: 2px 0 0 0; font-size: 9pt; color: #444;">NIP. ${ketuaNip}</p>
            </div>
            <div class="ttd-box">
              <p style="margin: 0;">${sop.titimangsa_tempat || 'Compreng'}, ${formatDateIndo(sop.titimangsa_tanggal || jadwal.tanggal_ujian)}</p>
              <p style="margin: 2px 0 0 0; font-weight: bold;">Kepala Sekolah,</p>
              <div style="height: 65px;"></div>
              <p style="margin: 0; font-weight: bold; text-decoration: underline;">${kepsekNama}</p>
              <p style="margin: 2px 0 0 0; font-size: 9pt; color: #444;">NIP. ${kepsekNip}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await Print.printAsync({ html: htmlContent });
    } catch (e: any) {
      console.error('Error print daftar hadir pengawas:', e);
      Alert.alert('Gagal Mencetak', e.message || 'Terjadi kesalahan cetak daftar hadir pengawas.');
    } finally {
      setPrintingId(null);
    }
  };

  // Helper: Pemetaan Default Ruang Berdasarkan Kelas Asal Siswa (Bukan Kantor)
  const getRuangDefaultForSiswa = (siswa: any, kList: any[], rList: any[]) => {
    const sKelas = (siswa?.kelas || '').trim().toLowerCase();

    // 1. Cek dari data_kelas yang memiliki ruang_id bukan kantor/teras
    const matchedK = (kList || []).find((k: any) => (k.nama_kelas || '').trim().toLowerCase() === sKelas);
    if (matchedK && matchedK.ruang_id) {
      const foundR = (rList || []).find((r: any) => Number(r.id) === Number(matchedK.ruang_id));
      if (
        foundR &&
        !foundR.nama_ruang.toLowerCase().includes('kantor') &&
        !foundR.nama_ruang.toLowerCase().includes('teras')
      ) {
        return String(foundR.id);
      }
    }

    const nonKantor = (rList || []).filter((r: any) => {
      const nr = (r.nama_ruang || '').toLowerCase();
      return !nr.includes('kantor') && !nr.includes('teras');
    });

    // 2. Pencocokan cerdas teks nama kelas dengan nama ruang
    if (sKelas.includes('vii') || sKelas.startsWith('7')) {
      const r7 = nonKantor.find(
        (r: any) => r.nama_ruang.toLowerCase().includes('7') || r.nama_ruang.toLowerCase().includes('vii')
      );
      if (r7) return String(r7.id);
    }
    if (sKelas.includes('viii') || sKelas.startsWith('8')) {
      const r8 = nonKantor.find(
        (r: any) => r.nama_ruang.toLowerCase().includes('8') || r.nama_ruang.toLowerCase().includes('viii')
      );
      if (r8) return String(r8.id);
    }
    if (sKelas.includes('ix-a') || sKelas.includes('9-a') || sKelas.includes('9a')) {
      const r9a = nonKantor.find((r: any) => {
        const nr = r.nama_ruang.toLowerCase().replace(/[\s-]/g, '');
        return nr.includes('9a') || nr.includes('ixa');
      });
      if (r9a) return String(r9a.id);
    }
    if (sKelas.includes('ix-b') || sKelas.includes('9-b') || sKelas.includes('9b')) {
      const r9b = nonKantor.find((r: any) => {
        const nr = r.nama_ruang.toLowerCase().replace(/[\s-]/g, '');
        return nr.includes('9b') || nr.includes('ixb');
      });
      if (r9b) return String(r9b.id);
    }
    if (sKelas.includes('ix') || sKelas.startsWith('9')) {
      const r9 = nonKantor.find(
        (r: any) => r.nama_ruang.toLowerCase().includes('9') || r.nama_ruang.toLowerCase().includes('ix')
      );
      if (r9) return String(r9.id);
    }

    if (matchedK && matchedK.ruang_id) return String(matchedK.ruang_id);
    if (nonKantor.length > 0) return String(nonKantor[0].id);
    return rList?.[0] ? String(rList[0].id) : '1';
  };

  // Pengaturan Ruang Peserta Handlers
  const handleOpenPengaturanRuang = async (jadwal?: any) => {
    const target = jadwal || activeJadwalItem || (filteredJadwal.length > 0 ? filteredJadwal[0] : jadwalList[0]);
    if (!target) {
      Alert.alert('Peringatan', 'Tidak ada jadwal ujian yang dipilih.');
      return;
    }
    setTargetJadwalForRuang(target);
    setActiveJadwalItem(target);
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

      const { data: existingAlloc } = await supabase
        .from('cbt_peserta_ruang')
        .select('siswa_id, ruang_id')
        .eq('jadwal_id', target.id);

      const currentMode = (target.mode_ruang as 'default' | 'acak' | 'custom') || 'default';
      setModeRuang(currentMode);

      const allRIds = (ruangList || []).map((r: any) => String(r.id));
      setSelectedActiveRuangIds(allRIds);

      const newMap: Record<string, string> = {};
      if (existingAlloc && existingAlloc.length > 0) {
        existingAlloc.forEach((a: any) => {
          newMap[String(a.siswa_id)] = String(a.ruang_id);
        });
      } else {
        allSiswa.forEach((s: any) => {
          const targetRId = getRuangDefaultForSiswa(s, kelasList, ruangList);
          newMap[String(s.id)] = String(targetRId);
        });
      }
      setAlokasiRuangMap(newMap);

      // Inisialisasi ruangan target untuk mode custom (prioritas ruang kelas non kantor)
      const firstClassroom = (ruangList || []).find((r: any) => !r.nama_ruang.toLowerCase().includes('kantor')) || ruangList?.[0];
      if (firstClassroom) {
        setCustomTargetRuangId(String(firstClassroom.id));
      }
    } catch (err: any) {
      console.error('Error open pengaturan ruang peserta:', err);
      Alert.alert('Gagal Memuat', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoadingRuangPeserta(false);
    }
  };

  const handleAcakRuangan = () => {
    if (selectedActiveRuangIds.length === 0) {
      Alert.alert('Peringatan', 'Silakan centang minimal 1 ruangan untuk pengacakan.');
      return;
    }
    const shuffled = [...siswaPesertaList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const newMap: Record<string, string> = {};
    shuffled.forEach((s, idx) => {
      const rId = selectedActiveRuangIds[idx % selectedActiveRuangIds.length];
      newMap[String(s.id)] = String(rId);
    });
    setAlokasiRuangMap(newMap);
    Alert.alert('Berhasil Diacak', `${shuffled.length} peserta telah diacak merata ke ${selectedActiveRuangIds.length} ruangan terpilih.`);
  };

  const handleResetToDefault = () => {
    const defMap: Record<string, string> = {};
    siswaPesertaList.forEach((s: any) => {
      const targetRId = getRuangDefaultForSiswa(s, kelasList, ruangList);
      defMap[String(s.id)] = String(targetRId);
    });
    setAlokasiRuangMap(defMap);
  };

  const handleSavePengaturanRuang = async () => {
    if (!targetJadwalForRuang?.id) return;
    try {
      setSavingRuangPeserta(true);

      await supabase
        .from('cbt_jadwal_ujian')
        .update({ mode_ruang: modeRuang })
        .eq('id', targetJadwalForRuang.id);

      // Hapus alokasi lama untuk jadwal ini agar alokasi baru tersimpan bersih
      await supabase
        .from('cbt_peserta_ruang')
        .delete()
        .eq('jadwal_id', targetJadwalForRuang.id);

      const payload = Object.entries(alokasiRuangMap)
        .filter(([_, rId]) => Boolean(rId))
        .map(([sId, rId], idx) => ({
          jadwal_id: targetJadwalForRuang.id,
          siswa_id: Number(sId),
          ruang_id: Number(rId),
          nomor_meja: idx + 1,
        }));

      if (payload.length > 0) {
        const { error } = await supabase
          .from('cbt_peserta_ruang')
          .insert(payload);
        if (error) throw error;
      }

      Alert.alert('Sukses', `Pengaturan ruang peserta berhasil disimpan dengan mode ${modeRuang.toUpperCase()}!`);
      setIsRuangPesertaModalOpen(false);
      fetchJadwal();
    } catch (err: any) {
      console.error('Error save ruang peserta:', err);
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan saat menyimpan pengaturan ruang.');
    } finally {
      setSavingRuangPeserta(false);
    }
  };

  // Helper Hak Akses Melihat Kartu
  const userCanSeeCard = (item: any) => {
    // 1. Operator, Ketua Panitia, Sekretaris Panitia, dan Waka Kurikulum melihat semua card
    if (isOperatorOrPanitiaCore || isWakaKurikulum) {
      return true;
    }
    // 2. Guru Mapel: hanya mata pelajaran yang diampunya saja (berdasarkan tabel pembelajaran)
    const isTaughtByMe = taughtMapelIds.includes(String(item.mapel_id)) || Number(item.guru_id) === Number(currentUser?.id);
    // 3. Pengawas: hanya mata pelajaran yang diawasinya saja
    const isSupervisedByMe = Number(item.pengawas_guru_id) === Number(currentUser?.id);

    return isTaughtByMe || isSupervisedByMe;
  };

  // Filter List Jadwal
  const accessibleJadwal = jadwalList.filter(userCanSeeCard);

  const filteredJadwal = accessibleJadwal.filter((item) => {
    if (filterHari !== 'Semua') {
      const itemHari = item.hari || calculateHari(item.tanggal_ujian);
      if (itemHari.toLowerCase() !== filterHari.toLowerCase()) {
        return false;
      }
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const nama = (item.nama_ujian || '').toLowerCase();
      const mapel = (item.data_mapel?.nama_mapel || '').toLowerCase();
      return nama.includes(q) || mapel.includes(q);
    }
    return true;
  });

  const canManagePengaturan = isOperatorOrPanitiaCore || isWakaKurikulum;
  const canManageJadwal = isOperatorOrPanitiaCore;
  const canPrintJadwal = isOperatorOrPanitiaCore || isWakaKurikulum;
  const showHeaderActions = canManageJadwal || canManagePengaturan || canPrintJadwal;

  return (
    <View style={styles.container}>
      {/* Header Halaman (Tombol-tombol di bagian bawah header agar rapi) */}
      <LinearGradient colors={['#2a2c87', '#3b3e9e']} style={styles.header}>
        {/* Baris Atas Header: Tombol Back & Judul */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Jadwal Ujian CBT</Text>
            <Text style={styles.headerSubtitle}>Manajemen pelaksanaan ujian & kontrol pengawas</Text>
          </View>
        </View>

        {/* Baris Bawah Header: Tombol-tombol Aksi Manajemen Ujian (Icon Only) */}
        {showHeaderActions && (
          <View style={styles.headerActionsRow}>
            {canManageJadwal && (
              <TouchableOpacity
                style={styles.headerActionBtnPrimary}
                onPress={() => {
                  setFormData(initialForm);
                  setIsModalOpen(true);
                }}
                accessibilityLabel="Tambah Jadwal Ujian"
              >
                <Plus size={20} color="#2a2c87" />
              </TouchableOpacity>
            )}

            {canManagePengaturan && (
              <TouchableOpacity
                style={styles.headerActionBtnSecondary}
                onPress={() => setIsPengaturanModalOpen(true)}
                accessibilityLabel="Pengaturan Ujian CBT"
              >
                <Settings size={19} color="#fff" />
              </TouchableOpacity>
            )}

            {canManagePengaturan && (
              <TouchableOpacity
                style={styles.headerActionBtnRoom}
                onPress={() => handleOpenPengaturanRuang(null)}
                accessibilityLabel="Pengaturan Ruang Peserta"
              >
                <Building size={19} color="#fff" />
              </TouchableOpacity>
            )}

            {canPrintJadwal && (
              <TouchableOpacity
                style={styles.headerActionBtnPrint}
                onPress={handlePrintRekap}
                disabled={printingRekap}
                accessibilityLabel="Cetak Jadwal Ujian"
              >
                {printingRekap ? (
                  <ActivityIndicator size="small" color="#1e293b" />
                ) : (
                  <Printer size={19} color="#1e293b" />
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </LinearGradient>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama sesi ujian atau mata pelajaran..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Navigasi Hari Ujian (Senin s/d Sabtu) dengan Penanda */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((hari) => {
            const count = hari === 'Semua'
              ? accessibleJadwal.length
              : accessibleJadwal.filter(j => (j.hari || calculateHari(j.tanggal_ujian)).toLowerCase() === hari.toLowerCase()).length;
            const isActive = filterHari === hari;
            const todayName = getOperationalDayName();
            const isHariIni = todayName.toLowerCase() === hari.toLowerCase();
            const hasUserSchedule = count > 0 && hari !== 'Semua';

            return (
              <TouchableOpacity
                key={hari}
                style={[
                  styles.tabBtn,
                  isActive && styles.tabBtnActive,
                  hasUserSchedule && !isActive && styles.tabBtnWithSchedule
                ]}
                onPress={() => setFilterHari(hari)}
              >
                {hasUserSchedule && !isActive && (
                  <View style={styles.tabScheduleDot} />
                )}
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {hari === 'Semua' ? 'Semua Hari' : hari} {count > 0 ? `(${count})` : ''}
                </Text>
                {isHariIni && (
                  <View style={[styles.todayBadge, isActive && { backgroundColor: '#85c226' }]}>
                    <Text style={[styles.todayText, isActive && { color: '#000' }]}>Hari Ini</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Konten Daftar Card Sesi */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2a2c87" />
          <Text style={styles.loadingText}>Memuat jadwal ujian CBT...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2a2c87']} />}
        >
          {filteredJadwal.length === 0 ? (
            <View style={styles.emptyCard}>
              <Calendar size={48} color="#9ca3af" />
              <Text style={styles.emptyTitle}>Tidak Ada Jadwal</Text>
              <Text style={styles.emptySubtitle}>
                {canManageJadwal
                  ? 'Belum ada jadwal ujian. Klik "+ Jadwal" di header atas untuk membuat sesi baru.'
                  : 'Tidak ada jadwal ujian yang sesuai dengan filter atau penugasan Anda.'}
              </Text>
            </View>
          ) : (
            filteredJadwal.map((jadwal) => {
              const isBerlangsung = jadwal.status === 'berlangsung';
              const isSelesai = jadwal.status === 'selesai';
              const isPrinting = printingId === jadwal.id;

              // Hak Akses Tombol per Card
              const isTaughtByMe = taughtMapelIds.includes(String(jadwal.mapel_id)) || Number(jadwal.guru_id) === Number(currentUser?.id);
              const isSupervisedByMe = Number(jadwal.pengawas_guru_id) === Number(currentUser?.id);

              const isAssignedProctor = Number(currentUser?.id) === Number(jadwal.pengawas_guru_id);
              const canProctorThis = isOperatorOrPanitiaCore || isWakaKurikulum || isAssignedProctor;
              const showSoalBtn = isOperatorOrPanitiaCore || (!isWakaKurikulum && isTaughtByMe);
              const showAwasiBtn = canProctorThis;
              const showNilaiBtn = isOperatorOrPanitiaCore || isWakaKurikulum || isTaughtByMe || isAssignedProctor;
              const showHadirPengawasBtn = canProctorThis;
              const showDocBtns = isOperatorOrPanitiaCore || isAssignedProctor || isWakaKurikulum;
              const showCrudBtns = isOperatorOrPanitiaCore;

              return (
                <View key={jadwal.id} style={styles.card}>
                  {/* Header Card: Jenis Ujian & Status */}
                  <View style={styles.cardHeader}>
                    <View style={styles.badgeJenis}>
                      <Text style={styles.badgeJenisText}>{jadwal.jenis_ujian || 'CBT'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={[
                          styles.statusBadge,
                          isBerlangsung
                            ? { backgroundColor: '#dcfce7' }
                            : isSelesai
                              ? { backgroundColor: '#f1f5f9' }
                              : { backgroundColor: '#eff6ff' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isBerlangsung
                              ? { color: '#16a34a' }
                              : isSelesai
                                ? { color: '#64748b' }
                                : { color: '#2563eb' },
                          ]}
                        >
                          ● {jadwal.status ? jadwal.status.toUpperCase() : 'TERJADWAL'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Nama Mata Pelajaran */}
                  <Text style={styles.mapelTitle}>{jadwal.data_mapel?.nama_mapel || jadwal.nama_ujian}</Text>

                  {/* Informasi Tanggal & Waktu (Ringkas, Rapi, Bebas Clutter) */}
                  <View style={styles.cardDateTimeBox}>
                    <View style={styles.dateTimeItem}>
                      <Calendar size={14} color="#2a2c87" />
                      <Text style={styles.dateTimeText}>{formatDateIndo(jadwal.tanggal_ujian)}</Text>
                    </View>
                    <View style={styles.dateTimeDivider} />
                    <View style={styles.dateTimeItem}>
                      <Clock size={14} color="#0284c7" />
                      <Text style={styles.dateTimeText}>
                        {jadwal.jam_mulai?.substring(0, 5)} - {jadwal.jam_selesai?.substring(0, 5)} ({jadwal.durasi_menit}m)
                      </Text>
                    </View>
                  </View>

                  {/* Baris Tombol Utama: Soal, Awasi, Nilai */}
                  {(showSoalBtn || showAwasiBtn || showNilaiBtn) && (
                    <View style={styles.actionRow}>
                      {showSoalBtn && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]}
                          onPress={() => handleOpenKelasModal(jadwal, 'soal')}
                        >
                          <FileQuestion size={14} color="#fff" />
                          <Text style={styles.actionBtnTextWhite}>Soal</Text>
                        </TouchableOpacity>
                      )}

                      {showAwasiBtn && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#dc2626' }]}
                          onPress={() => handleOpenRuangModal(jadwal, 'awasi')}
                        >
                          <Eye size={14} color="#fff" />
                          <Text style={styles.actionBtnTextWhite}>Awasi</Text>
                        </TouchableOpacity>
                      )}

                      {showNilaiBtn && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#2a2c87' }]}
                          onPress={() => handleOpenKelasModal(jadwal, 'nilai')}
                        >
                          <BookOpenCheck size={14} color="#fff" />
                          <Text style={styles.actionBtnTextWhite}>Nilai</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Baris Tombol Dokumen: Hadir Peserta, Hadir Pengawas & Berita Acara */}
                  {(showDocBtns || showHadirPengawasBtn) && (
                    <View style={[styles.actionRow, { marginTop: 6 }]}>
                      {showDocBtns && (
                        <TouchableOpacity
                          style={[styles.docBtn, isPrinting && { opacity: 0.5 }]}
                          disabled={isPrinting}
                          onPress={() => handleOpenRuangModal(jadwal, 'hadir')}
                        >
                          {isPrinting ? (
                            <ActivityIndicator size="small" color="#475569" />
                          ) : (
                            <Printer size={13} color="#475569" />
                          )}
                          <Text style={styles.docBtnText}>Hadir Peserta</Text>
                        </TouchableOpacity>
                      )}

                      {showHadirPengawasBtn && (
                        <TouchableOpacity
                          style={[styles.docBtn, isPrinting && { opacity: 0.5 }]}
                          disabled={isPrinting}
                          onPress={() => handleOpenRuangModal(jadwal, 'hadir_pengawas')}
                        >
                          {isPrinting ? (
                            <ActivityIndicator size="small" color="#475569" />
                          ) : (
                            <Printer size={13} color="#475569" />
                          )}
                          <Text style={styles.docBtnText}>Hadir Pengawas</Text>
                        </TouchableOpacity>
                      )}

                      {showDocBtns && (
                        <TouchableOpacity
                          style={[styles.docBtn, isPrinting && { opacity: 0.5 }]}
                          disabled={isPrinting}
                          onPress={() => handleOpenRuangModal(jadwal, 'berita_acara')}
                        >
                          {isPrinting ? (
                            <ActivityIndicator size="small" color="#475569" />
                          ) : (
                            <FileText size={13} color="#475569" />
                          )}
                          <Text style={styles.docBtnText}>Berita Acara</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Baris Tombol CRUD: Edit & Hapus (Khusus Operator & Panitia) */}
                  {showCrudBtns && (
                    <View style={styles.crudRow}>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => {
                          setFormData({
                            id: jadwal.id,
                            nama_ujian: jadwal.nama_ujian || '',
                            jenis_ujian: jadwal.jenis_ujian || 'PSTS',
                            tanggal_ujian: jadwal.tanggal_ujian || new Date().toISOString().split('T')[0],
                            hari: jadwal.hari || calculateHari(jadwal.tanggal_ujian),
                            jam_mulai: jadwal.jam_mulai?.substring(0, 5) || '07:30',
                            jam_selesai: jadwal.jam_selesai?.substring(0, 5) || '09:00',
                            durasi_menit: jadwal.durasi_menit || 90,
                            mapel_id: jadwal.mapel_id || '',
                            status: jadwal.status || 'terjadwal',
                            acak_soal: jadwal.acak_soal ?? true,
                            acak_opsi: jadwal.acak_opsi ?? true,
                            wajib_dijawab: jadwal.wajib_dijawab ?? false,
                            mode_berkelanjutan: jadwal.mode_berkelanjutan ?? true,
                          });
                          setIsModalOpen(true);
                        }}
                      >
                        <Edit3 size={13} color="#2563eb" />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteJadwal(jadwal.id, jadwal.nama_ujian)}
                      >
                        <Trash2 size={13} color="#dc2626" />
                        <Text style={styles.deleteBtnText}>Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ========================================================
          POPUP MODAL PILIH KELAS (Menyesuaikan Tabel Pembelajaran)
      ======================================================== */}
      <Modal visible={isKelasModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.popupCard}>
            <View style={styles.popupHeader}>
              <View style={styles.popupIconCirclePurple}>
                <School size={20} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupTitle}>
                  {targetKelasAction === 'soal' ? 'Pilih Kelas - Paket Soal' : 'Pilih Kelas - Daftar Nilai'}
                </Text>
                <Text style={styles.popupSubtitle}>
                  {activeJadwalItem?.data_mapel?.nama_mapel || activeJadwalItem?.nama_ujian}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsKelasModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.popupBody}>
              <Text style={styles.popupLabel}>Pilih Kelas Siswa :</Text>
              {availableKelasForModal.length === 0 ? (
                <View style={styles.emptyKelasNotice}>
                  <Text style={styles.emptyKelasNoticeText}>
                    Belum ada kelas yang terdaftar pada mata pelajaran ini di tabel pembelajaran.
                  </Text>
                </View>
              ) : (
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedKelasId}
                    onValueChange={(val) => setSelectedKelasId(val)}
                    style={styles.picker}
                    dropdownIconColor="#2a2c87"
                  >
                    {availableKelasForModal.map((k) => (
                      <Picker.Item key={k.id} label={`Kelas ${k.nama_kelas}`} value={String(k.id)} />
                    ))}
                  </Picker>
                </View>
              )}
            </View>

            <View style={styles.popupFooter}>
              <TouchableOpacity
                style={styles.popupCancelBtn}
                onPress={() => setIsKelasModalOpen(false)}
              >
                <Text style={styles.popupCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.popupSubmitBtn,
                  { backgroundColor: '#7c3aed' },
                  availableKelasForModal.length === 0 && { opacity: 0.5 }
                ]}
                disabled={availableKelasForModal.length === 0}
                onPress={handleConfirmKelasModal}
              >
                <Text style={styles.popupSubmitBtnText}>Lanjutkan</Text>
                <ChevronRight size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          POPUP MODAL PILIH RUANGAN (Untuk Awasi, Hadir, Berita Acara)
      ======================================================== */}
      <Modal visible={isRuangModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.popupCard}>
            <View style={styles.popupHeader}>
              <View style={styles.popupIconCircleRed}>
                <Building size={20} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupTitle}>
                  {targetRuangAction === 'awasi'
                    ? 'Pilih Ruangan Pengawasan'
                    : targetRuangAction === 'hadir'
                      ? 'Pilih Ruang - Hadir Peserta'
                      : targetRuangAction === 'hadir_pengawas'
                        ? 'Pilih Ruang - Hadir Pengawas'
                        : 'Pilih Ruang - Berita Acara'}
                </Text>
                <Text style={styles.popupSubtitle}>
                  {activeJadwalItem?.data_mapel?.nama_mapel || activeJadwalItem?.nama_ujian}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsRuangModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.popupBody}>
              <Text style={styles.popupLabel}>Pilih Ruang Ujian :</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedRuangId}
                  onValueChange={(val) => setSelectedRuangId(val)}
                  style={styles.picker}
                  dropdownIconColor="#dc2626"
                >
                  {ruangList.map((r) => (
                    <Picker.Item key={r.id} label={r.nama_ruang} value={String(r.id)} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.popupFooter}>
              <TouchableOpacity
                style={styles.popupCancelBtn}
                onPress={() => setIsRuangModalOpen(false)}
              >
                <Text style={styles.popupCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.popupSubmitBtn, { backgroundColor: '#dc2626' }]}
                onPress={handleConfirmRuangModal}
              >
                <Text style={styles.popupSubmitBtnText}>
                  {targetRuangAction === 'awasi' ? 'Masuk Pengawasan' : 'Cetak Dokumen'}
                </Text>
                <ChevronRight size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL PENGATURAN UJIAN CBT
      ======================================================== */}
      <Modal visible={isPengaturanModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Settings size={20} color="#2a2c87" />
                <Text style={styles.modalTitle}>Pengaturan Sistem Ujian CBT</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPengaturanModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.pengaturanSectionHeader}>Sistem Keamanan & AI Proctoring</Text>

              {/* Tampilkan Kamera */}
              <View style={styles.settingItemRow}>
                <View style={styles.settingItemLeft}>
                  <Camera size={20} color="#2a2c87" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingItemTitle}>Kamera Pengawas Siswa</Text>
                    <Text style={styles.settingItemDesc}>Wajibkan siswa menyalakan kamera proctoring saat ujian</Text>
                  </View>
                </View>
                <Switch
                  value={pengaturanData.tampilkan_kamera}
                  onValueChange={(val) => setPengaturanData({ ...pengaturanData, tampilkan_kamera: val })}
                  trackColor={{ false: '#cbd5e1', true: '#85c226' }}
                />
              </View>

              {/* Blokir Menengok */}
              <View style={styles.settingItemRow}>
                <View style={styles.settingItemLeft}>
                  <ShieldAlert size={20} color="#dc2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingItemTitle}>Deteksi Menengok AI</Text>
                    <Text style={styles.settingItemDesc}>Peringatan & blokir otomatis saat siswa menoleh ke samping</Text>
                  </View>
                </View>
                <Switch
                  value={pengaturanData.blokir_menengok}
                  onValueChange={(val) => setPengaturanData({ ...pengaturanData, blokir_menengok: val })}
                  trackColor={{ false: '#cbd5e1', true: '#85c226' }}
                />
              </View>

              {/* Blokir Pindah Tab */}
              <View style={styles.settingItemRow}>
                <View style={styles.settingItemLeft}>
                  <Layers size={20} color="#ea580c" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingItemTitle}>Anti Pindah Tab & Layar</Text>
                    <Text style={styles.settingItemDesc}>Blokir jika siswa berpindah aplikasi atau tab browser</Text>
                  </View>
                </View>
                <Switch
                  value={pengaturanData.blokir_pindah_tab}
                  onValueChange={(val) => setPengaturanData({ ...pengaturanData, blokir_pindah_tab: val })}
                  trackColor={{ false: '#cbd5e1', true: '#85c226' }}
                />
              </View>

              <Text style={styles.pengaturanSectionHeader}>Kebijakan Timer & Tampilan Hasil</Text>

              {/* Waktu Fleksibel */}
              <View style={styles.settingItemRow}>
                <View style={styles.settingItemLeft}>
                  <Clock size={20} color="#0284c7" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingItemTitle}>Waktu Mulai Fleksibel</Text>
                    <Text style={styles.settingItemDesc}>Siswa dapat mulai sewaktu-waktu selama hari ujian aktif</Text>
                  </View>
                </View>
                <Switch
                  value={pengaturanData.waktu_fleksibel}
                  onValueChange={(val) => setPengaturanData({ ...pengaturanData, waktu_fleksibel: val })}
                  trackColor={{ false: '#cbd5e1', true: '#85c226' }}
                />
              </View>

              {/* Tampilkan Hasil */}
              <View style={styles.settingItemRow}>
                <View style={styles.settingItemLeft}>
                  <Award size={20} color="#16a34a" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingItemTitle}>Tampilkan Nilai ke Siswa</Text>
                    <Text style={styles.settingItemDesc}>Siswa dapat melihat skor akhir setelah selesai</Text>
                  </View>
                </View>
                <Switch
                  value={pengaturanData.tampilkan_hasil}
                  onValueChange={(val) => setPengaturanData({ ...pengaturanData, tampilkan_hasil: val })}
                  trackColor={{ false: '#cbd5e1', true: '#85c226' }}
                />
              </View>

              {/* Tampilkan Ranking */}
              <View style={styles.settingItemRow}>
                <View style={styles.settingItemLeft}>
                  <Award size={20} color="#ca8a04" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingItemTitle}>Tampilkan Peringkat Siswa</Text>
                    <Text style={styles.settingItemDesc}>Siswa dapat melihat posisi peringkat nilainya</Text>
                  </View>
                </View>
                <Switch
                  value={pengaturanData.tampilkan_ranking}
                  onValueChange={(val) => setPengaturanData({ ...pengaturanData, tampilkan_ranking: val })}
                  trackColor={{ false: '#cbd5e1', true: '#85c226' }}
                />
              </View>

              {/* Durasi Blokir Pelanggaran */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Durasi Blokir Pelanggaran :</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={pengaturanData.durasi_blokir_detik}
                    onValueChange={(val) => setPengaturanData({ ...pengaturanData, durasi_blokir_detik: Number(val) })}
                    style={styles.picker}
                  >
                    <Picker.Item label="60 Detik (1 Menit)" value={60} />
                    <Picker.Item label="180 Detik (3 Menit)" value={180} />
                    <Picker.Item label="300 Detik (5 Menit - Default)" value={300} />
                    <Picker.Item label="600 Detik (10 Menit)" value={600} />
                  </Picker>
                </View>
              </View>

              {/* Batas Minimal Tombol Selesai Muncul */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tombol Selesai Muncul Setelah :</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={pengaturanData.menit_tombol_selesai}
                    onValueChange={(val) => setPengaturanData({ ...pengaturanData, menit_tombol_selesai: Number(val) })}
                    style={styles.picker}
                  >
                    <Picker.Item label="Langsung Muncul (0 Menit)" value={0} />
                    <Picker.Item label="10 Menit Ujian Berjalan" value={10} />
                    <Picker.Item label="15 Menit Ujian Berjalan (Default)" value={15} />
                    <Picker.Item label="30 Menit Ujian Berjalan" value={30} />
                  </Picker>
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={[
              styles.modalFooter,
              { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 36 : 24) + 12 }
            ]}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsPengaturanModalOpen(false)}
                disabled={savingPengaturan}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSavePengaturan}
                disabled={savingPengaturan}
              >
                {savingPengaturan ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.modalSubmitText}>Simpan Pengaturan</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL PENGATURAN RUANG PESERTA (Default, Acak, Custom)
      ======================================================== */}
      <Modal visible={isRuangPesertaModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '92%' }]}>
            {/* Header Modal */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' }}>
                  <Building size={18} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Pengaturan Ruang Peserta</Text>
                  <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }} numberOfLines={1}>
                    {targetJadwalForRuang?.data_mapel?.nama_mapel || targetJadwalForRuang?.nama_ujian || 'Ujian CBT'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsRuangPesertaModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingRuangPeserta ? (
              <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#2a2c87" />
                <Text style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>Memuat data peserta & ruangan...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Mode Selector Tabs */}
                <View style={styles.modeTabsRow}>
                  <TouchableOpacity
                    style={[styles.modeTabBtn, modeRuang === 'default' && styles.modeTabBtnActive]}
                    onPress={() => {
                      setModeRuang('default');
                      handleResetToDefault();
                    }}
                  >
                    <School size={14} color={modeRuang === 'default' ? '#fff' : '#475569'} />
                    <Text style={[styles.modeTabBtnText, modeRuang === 'default' && styles.modeTabBtnTextActive]}>
                      Default (Kelas)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeTabBtn, modeRuang === 'acak' && styles.modeTabBtnActive]}
                    onPress={() => setModeRuang('acak')}
                  >
                    <Shuffle size={14} color={modeRuang === 'acak' ? '#fff' : '#475569'} />
                    <Text style={[styles.modeTabBtnText, modeRuang === 'acak' && styles.modeTabBtnTextActive]}>
                      Acak Ruangan
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeTabBtn, modeRuang === 'custom' && styles.modeTabBtnActive]}
                    onPress={() => setModeRuang('custom')}
                  >
                    <Users size={14} color={modeRuang === 'custom' ? '#fff' : '#475569'} />
                    <Text style={[styles.modeTabBtnText, modeRuang === 'custom' && styles.modeTabBtnTextActive]}>
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 1. Mode Default: Info Card & Breakdown */}
                {modeRuang === 'default' && (
                  <View style={{ marginTop: 14 }}>
                    <View style={styles.infoBoxBlue}>
                      <Text style={styles.infoBoxBlueTitle}>Mode Default (Sesuai Kelas Siswa)</Text>
                      <Text style={styles.infoBoxBlueDesc}>
                        Siswa secara otomatis ditempatkan di ruang ujian yang sesuai dengan kelas aslinya (bukan ruang kantor).
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8 }}>
                      <Text style={[styles.inputLabel, { marginBottom: 0 }]}>Ringkasan Pembagian Ruang Kelas :</Text>
                      <TouchableOpacity
                        style={styles.btnResetDefault}
                        onPress={() => {
                          handleResetToDefault();
                          Alert.alert('Berhasil', 'Alokasi ruang seluruh siswa telah dikembalikan ke ruang kelas masing-masing.');
                        }}
                      >
                        <RotateCcw size={12} color="#2a2c87" />
                        <Text style={styles.btnResetDefaultText}>Terapkan Ulang</Text>
                      </TouchableOpacity>
                    </View>

                    {kelasList.map(k => {
                      const count = siswaPesertaList.filter(s => (s.kelas || '').toLowerCase() === (k.nama_kelas || '').toLowerCase()).length;
                      const dummySiswa = { kelas: k.nama_kelas };
                      const defaultRuangId = getRuangDefaultForSiswa(dummySiswa, kelasList, ruangList);
                      const r = ruangList.find(ru => String(ru.id) === String(defaultRuangId));
                      return (
                        <View key={k.id} style={styles.roomSummaryRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>Kelas {k.nama_kelas}</Text>
                            <Text style={{ fontSize: 11, color: '#64748b' }}>{count} Siswa Terdaftar</Text>
                          </View>
                          <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#2a2c87' }}>{r?.nama_ruang || 'Lab CBT'}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 2. Mode Acak: Checkboxes Ruangan & Tombol Acak */}
                {modeRuang === 'acak' && (
                  <View style={{ marginTop: 14 }}>
                    <View style={styles.infoBoxBlue}>
                      <Text style={styles.infoBoxBlueTitle}>Mode Acak Ruangan (Distribusi Merata)</Text>
                      <Text style={styles.infoBoxBlueDesc}>
                        Pilih ruangan yang digunakan ujian, lalu klik tombol "Acak Ruangan Sekarang" untuk mendistribusikan seluruh siswa secara acak.
                      </Text>
                    </View>

                    <Text style={[styles.inputLabel, { marginTop: 14 }]}>Pilih Ruangan yang Aktif / Digunakan :</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                      {ruangList.map(r => {
                        const isChecked = selectedActiveRuangIds.includes(String(r.id));
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.ruangCheckChip, isChecked && styles.ruangCheckChipActive]}
                            onPress={() => {
                              if (isChecked) {
                                setSelectedActiveRuangIds(prev => prev.filter(id => id !== String(r.id)));
                              } else {
                                setSelectedActiveRuangIds(prev => [...prev, String(r.id)]);
                              }
                            }}
                          >
                            {isChecked ? <CheckSquare size={14} color="#fff" /> : <Square size={14} color="#64748b" />}
                            <Text style={[styles.ruangCheckChipText, isChecked && styles.ruangCheckChipTextActive]}>
                              {r.nama_ruang}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={styles.acakActionBtn}
                      onPress={handleAcakRuangan}
                    >
                      <Shuffle size={16} color="#fff" />
                      <Text style={styles.acakActionBtnText}>Acak Ruangan Sekarang</Text>
                    </TouchableOpacity>

                    {/* Ringkasan Hasil Acak */}
                    <Text style={[styles.inputLabel, { marginTop: 16 }]}>Hasil Alokasi per Ruangan :</Text>
                    {ruangList.filter(r => selectedActiveRuangIds.includes(String(r.id))).map(r => {
                      const count = Object.values(alokasiRuangMap).filter(rId => String(rId) === String(r.id)).length;
                      return (
                        <View key={r.id} style={styles.roomSummaryRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>{r.nama_ruang}</Text>
                            <Text style={{ fontSize: 11, color: '#64748b' }}>Ruang Ujian</Text>
                          </View>
                          <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0' }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#047857' }}>{count} Siswa</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 3. Mode Custom: Konsep Ceklis Ruang Ngaji */}
                {modeRuang === 'custom' && (() => {
                  const filteredSiswa = siswaPesertaList.filter(s => {
                    const matchKls = filterKelasRuang === 'Semua' || (s.kelas || '').toLowerCase() === filterKelasRuang.toLowerCase();
                    const matchQuery = !searchSiswaRuang || (s.nama || '').toLowerCase().includes(searchSiswaRuang.toLowerCase()) || (s.nisn || '').includes(searchSiswaRuang);
                    return matchKls && matchQuery;
                  });

                  const activeRoom = ruangList.find(r => String(r.id) === String(customTargetRuangId));
                  const activeRoomCount = Object.values(alokasiRuangMap).filter(rId => String(rId) === String(customTargetRuangId)).length;
                  const allFilteredChecked = filteredSiswa.length > 0 && filteredSiswa.every(s => alokasiRuangMap[String(s.id)] === customTargetRuangId);

                  const toggleCheckAll = () => {
                    if (!customTargetRuangId) {
                      Alert.alert('Peringatan', 'Silakan pilih Ruangan Target terlebih dahulu di bagian atas.');
                      return;
                    }
                    setAlokasiRuangMap(prev => {
                      const next = { ...prev };
                      if (allFilteredChecked) {
                        filteredSiswa.forEach(s => {
                          if (next[String(s.id)] === customTargetRuangId) {
                            delete next[String(s.id)];
                          }
                        });
                      } else {
                        filteredSiswa.forEach(s => {
                          next[String(s.id)] = customTargetRuangId;
                        });
                      }
                      return next;
                    });
                  };

                  return (
                    <View style={{ marginTop: 14 }}>
                      <View style={styles.infoBoxBlue}>
                        <Text style={styles.infoBoxBlueTitle}>Mode Custom (Ceklis Peserta per Ruangan)</Text>
                        <Text style={styles.infoBoxBlueDesc}>
                          Pilih Ruangan Target di bawah, lalu centang siswa untuk menempatkannya ke ruangan tersebut secara instan.
                        </Text>
                      </View>

                      {/* 1. Pilih Ruangan Target (Horizontal Scroll Chips) */}
                      <Text style={[styles.inputLabel, { marginTop: 14 }]}>Pilih Ruangan Target :</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {ruangList.map(r => {
                            const isSelected = String(r.id) === String(customTargetRuangId);
                            const count = Object.values(alokasiRuangMap).filter(rId => String(rId) === String(r.id)).length;
                            return (
                              <TouchableOpacity
                                key={r.id}
                                style={[styles.customTargetChip, isSelected && styles.customTargetChipActive]}
                                onPress={() => setCustomTargetRuangId(String(r.id))}
                              >
                                <School size={13} color={isSelected ? '#fff' : '#2a2c87'} />
                                <Text style={[styles.customTargetChipText, isSelected && styles.customTargetChipTextActive]}>
                                  {r.nama_ruang}
                                </Text>
                                <View style={[styles.customTargetCounter, isSelected && styles.customTargetCounterActive]}>
                                  <Text style={[styles.customTargetCounterText, isSelected && styles.customTargetCounterTextActive]}>
                                    {count}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>

                      {/* 2. Banner Ruangan Terpilih */}
                      {activeRoom && (
                        <View style={styles.activeRoomBanner}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.activeRoomBannerLabel}>Ruangan Target Aktif :</Text>
                            <Text style={styles.activeRoomBannerName}>{activeRoom.nama_ruang}</Text>
                          </View>
                          <View style={styles.activeRoomBadge}>
                            <Users size={12} color="#047857" />
                            <Text style={styles.activeRoomBadgeText}>{activeRoomCount} Peserta Terpilih</Text>
                          </View>
                        </View>
                      )}

                      {/* 3. Search & Filter Bar */}
                      <View style={{ marginTop: 10, marginBottom: 8 }}>
                        <TextInput
                          style={[styles.searchInput, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12 }]}
                          placeholder="Cari nama siswa atau NISN..."
                          placeholderTextColor="#9ca3af"
                          value={searchSiswaRuang}
                          onChangeText={setSearchSiswaRuang}
                        />
                      </View>

                      {/* Filter Tab Kelas */}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {['Semua', ...kelasList.map(k => k.nama_kelas)].map(kls => {
                            const isActive = filterKelasRuang === kls;
                            return (
                              <TouchableOpacity
                                key={kls}
                                style={[styles.filterChipSm, isActive && styles.filterChipSmActive]}
                                onPress={() => setFilterKelasRuang(kls)}
                              >
                                <Text style={[styles.filterChipSmText, isActive && styles.filterChipSmTextActive]}>
                                  {kls === 'Semua' ? 'Semua Kelas' : `Kelas ${kls}`}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>

                      {/* Tombol Centang Semua Filtered */}
                      <View style={styles.actionCheckAllRow}>
                        <TouchableOpacity
                          style={[styles.btnCheckAll, allFilteredChecked && styles.btnCheckAllActive]}
                          onPress={toggleCheckAll}
                        >
                          {allFilteredChecked ? (
                            <CheckSquare size={16} color="#2a2c87" />
                          ) : (
                            <Square size={16} color="#64748b" />
                          )}
                          <Text style={[styles.btnCheckAllText, allFilteredChecked && styles.btnCheckAllTextActive]}>
                            {allFilteredChecked ? 'Batal Semua (Filtered)' : `Centang Semua (${filteredSiswa.length})`}
                          </Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>
                          {filteredSiswa.filter(s => alokasiRuangMap[String(s.id)] === customTargetRuangId).length} dari {filteredSiswa.length} dicentang
                        </Text>
                      </View>

                      {/* 4. Daftar Siswa Menggunakan Ceklis */}
                      <View style={{ gap: 8, marginBottom: 16 }}>
                        {filteredSiswa.length === 0 ? (
                          <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: '#9ca3af' }}>Tidak ada siswa ditemukan.</Text>
                          </View>
                        ) : (
                          filteredSiswa.map(s => {
                            const isChecked = alokasiRuangMap[String(s.id)] === customTargetRuangId;
                            const curRuangId = alokasiRuangMap[String(s.id)];
                            const curRuang = ruangList.find(r => String(r.id) === String(curRuangId));

                            return (
                              <TouchableOpacity
                                key={s.id}
                                style={[styles.customCheckItem, isChecked && styles.customCheckItemActive]}
                                onPress={() => {
                                  if (!customTargetRuangId) {
                                    Alert.alert('Peringatan', 'Silakan pilih Ruangan Target terlebih dahulu di bagian atas.');
                                    return;
                                  }
                                  setAlokasiRuangMap(prev => {
                                    const next = { ...prev };
                                    if (next[String(s.id)] === customTargetRuangId) {
                                      delete next[String(s.id)];
                                    } else {
                                      next[String(s.id)] = customTargetRuangId;
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <View style={{ marginRight: 10 }}>
                                  {isChecked ? (
                                    <CheckSquare size={20} color="#10b981" />
                                  ) : (
                                    <Square size={20} color="#94a3b8" />
                                  )}
                                </View>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                  <Text style={[styles.customCheckItemName, isChecked && { color: '#065f46' }]}>
                                    {s.nama}
                                  </Text>
                                  <Text style={styles.customCheckItemSub}>
                                    Kelas {s.kelas || '-'} • NISN: {s.nisn || '-'}
                                  </Text>
                                </View>
                                <View>
                                  {isChecked ? (
                                    <View style={styles.badgeRuangIni}>
                                      <Text style={styles.badgeRuangIniText}>✓ Ruang Ini</Text>
                                    </View>
                                  ) : curRuang ? (
                                    <View style={styles.badgeRuangLain}>
                                      <Text style={styles.badgeRuangLainText}>{curRuang.nama_ruang}</Text>
                                    </View>
                                  ) : (
                                    <View style={styles.badgeRuangNone}>
                                      <Text style={styles.badgeRuangNoneText}>Belum Diatur</Text>
                                    </View>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View style={[
              styles.modalFooter,
              { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 36 : 24) + 12 }
            ]}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsRuangPesertaModalOpen(false)}
                disabled={savingRuangPeserta}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingRuangPeserta && { opacity: 0.6 }]}
                onPress={handleSavePengaturanRuang}
                disabled={savingRuangPeserta}
              >
                {savingRuangPeserta ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Check size={16} color="#fff" />
                )}
                <Text style={styles.modalSubmitBtnText}>Simpan Ruang</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL TAMBAH / EDIT JADWAL CBT (Disimplifikasi)
      ======================================================== */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Calendar size={20} color="#2a2c87" />
                <Text style={styles.modalTitle}>
                  {formData.id ? 'Edit Jadwal Ujian CBT' : 'Buat Jadwal Ujian CBT Baru'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Nama Sesi Ujian */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nama Sesi Ujian *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Misal: PSTS Ganjil - Bahasa Indonesia"
                  value={formData.nama_ujian}
                  onChangeText={(val) => setFormData({ ...formData, nama_ujian: val })}
                />
              </View>

              {/* Jenis Ujian Dropdown */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Jenis Ujian *</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={formData.jenis_ujian}
                    onValueChange={(val) => setFormData({ ...formData, jenis_ujian: val })}
                    style={styles.picker}
                    dropdownIconColor="#2a2c87"
                  >
                    <Picker.Item label="PSTS (Penilaian Sumatif Tengah Semester)" value="PSTS" />
                    <Picker.Item label="PSAS (Penilaian Sumatif Akhir Semester)" value="PSAS" />
                    <Picker.Item label="PSAT (Penilaian Sumatif Akhir Tahun)" value="PSAT" />
                    <Picker.Item label="PSAJ (Penilaian Sumatif Akhir Jenjang)" value="PSAJ" />
                    <Picker.Item label="Tugas / Penilaian Harian" value="Tugas" />
                  </Picker>
                </View>
              </View>

              {/* Tanggal & Hari Pelaksanaan (Menggunakan Date Picker) */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Tanggal & Hari Pelaksanaan *</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.dateIconWrapper}>
                    <CalendarDays size={20} color="#2a2c87" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.datePickerText}>{formatDateIndo(formData.tanggal_ujian)}</Text>
                    <Text style={styles.datePickerSubtext}>
                      Hari: <Text style={styles.datePickerHariHighlight}>{calculateHari(formData.tanggal_ujian)}</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Waktu Pelaksanaan (Menggunakan Time Picker) */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Jam Mulai *</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => openTimePicker('jam_mulai')}
                  >
                    <Clock size={16} color="#2a2c87" />
                    <Text style={styles.timePickerButtonText}>{formData.jam_mulai || '07:30'} WIB</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Jam Selesai *</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => openTimePicker('jam_selesai')}
                  >
                    <Clock size={16} color="#2a2c87" />
                    <Text style={styles.timePickerButtonText}>{formData.jam_selesai || '09:00'} WIB</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.formGroup, { flex: 0.85 }]}>
                  <Text style={styles.label}>Durasi</Text>
                  <View style={styles.durasiBox}>
                    <Text style={styles.durasiBoxText}>{formData.durasi_menit} Mnt</Text>
                  </View>
                </View>
              </View>

              {/* Mata Pelajaran Dropdown */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Mata Pelajaran *</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={formData.mapel_id}
                    onValueChange={(val) => setFormData({ ...formData, mapel_id: val })}
                    style={styles.picker}
                    dropdownIconColor="#2a2c87"
                  >
                    <Picker.Item label="-- Pilih Mata Pelajaran --" value="" />
                    {mapelList.map((m) => (
                      <Picker.Item key={m.id} label={m.nama_mapel} value={m.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={[
              styles.modalFooter,
              { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 36 : 24) + 12 }
            ]}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsModalOpen(false)}
                disabled={saving}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSaveJadwal}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.modalSubmitText}>
                      {formData.id ? 'Simpan Perubahan' : 'Buat Jadwal'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Date & Time Picker Dialogs */}
        {showDatePicker && (
          <DateTimePicker
            value={new Date(formData.tanggal_ujian || new Date())}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={timePickerDate}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 4,
    shadowColor: '#2a2c87',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerActionBtnPrimary: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerActionBtnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerActionBtnRoom: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    backgroundColor: '#0284c7',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerActionBtnPrint: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    backgroundColor: '#85c226',
    borderRadius: 12,
    elevation: 2,
  },
  roomBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  roomBadgeBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
  },
  // Ruang Peserta Modal Styles
  modeTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  modeTabBtnActive: {
    backgroundColor: '#2a2c87',
  },
  modeTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  modeTabBtnTextActive: {
    color: '#fff',
  },
  infoBoxBlue: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoBoxBlueTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 2,
  },
  infoBoxBlueDesc: {
    fontSize: 11,
    color: '#3b82f6',
    lineHeight: 16,
  },
  roomSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  ruangCheckChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  ruangCheckChipActive: {
    backgroundColor: '#2a2c87',
    borderColor: '#2a2c87',
  },
  ruangCheckChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  ruangCheckChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  acakActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 2,
  },
  acakActionBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  filterChipSm: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipSmActive: {
    backgroundColor: '#2a2c87',
    borderColor: '#2a2c87',
  },
  filterChipSmText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipSmTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  btnResetDefault: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  btnResetDefaultText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2a2c87',
  },
  customTargetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  customTargetChipActive: {
    backgroundColor: '#2a2c87',
    borderColor: '#2a2c87',
  },
  customTargetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  customTargetChipTextActive: {
    color: '#fff',
  },
  customTargetCounter: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  customTargetCounterActive: {
    backgroundColor: '#3b82f6',
  },
  customTargetCounterText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
  },
  customTargetCounterTextActive: {
    color: '#fff',
  },
  activeRoomBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 4,
  },
  activeRoomBannerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
  },
  activeRoomBannerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065f46',
    marginTop: 2,
  },
  activeRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  activeRoomBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  actionCheckAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  btnCheckAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  btnCheckAllActive: {},
  btnCheckAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  btnCheckAllTextActive: {
    color: '#2a2c87',
  },
  customCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customCheckItemActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  customCheckItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  customCheckItemSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  badgeRuangIni: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  badgeRuangIniText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#15803d',
  },
  badgeRuangLain: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  badgeRuangLainText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  badgeRuangNone: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  badgeRuangNoneText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#b91c1c',
  },
  filterSection: {
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
    paddingVertical: 8,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: {
    backgroundColor: '#2a2c87',
  },
  tabBtnWithSchedule: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  tabScheduleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
    marginRight: 2,
  },
  todayBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  todayText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16a34a',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeJenis: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeJenisText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2a2c87',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mapelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  cardDateTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTimeDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#cbd5e1',
  },
  dateTimeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnTextWhite: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#fff',
  },
  docBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  docBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  crudRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#dc2626',
  },

  // Popup Modal Center Styles
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    padding: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  popupIconCirclePurple: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupIconCircleRed: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  popupSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  popupBody: {
    paddingVertical: 16,
  },
  popupLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptyKelasNotice: {
    padding: 12,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  emptyKelasNoticeText: {
    fontSize: 12,
    color: '#c2410c',
    textAlign: 'center',
    lineHeight: 16,
  },
  popupFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  popupCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  popupSubmitBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  popupSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Modal Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  pengaturanSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 10,
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  settingItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1e293b',
  },
  settingItemDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  formGroup: {
    marginTop: 14,
    marginBottom: 6,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1e293b',
    backgroundColor: '#fff',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: {
    height: 50,
    color: '#1e293b',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  dateIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerText: {
    fontSize: 13.5,
    color: '#1e293b',
    fontWeight: '700',
  },
  datePickerSubtext: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  datePickerHariHighlight: {
    fontWeight: '800',
    color: '#2a2c87',
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
  },
  timePickerButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  durasiBox: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durasiBoxText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563eb',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 32,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#2a2c87',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
});
