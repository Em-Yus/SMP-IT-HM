import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import {
  ChevronLeft,
  FileQuestion,
  CheckCircle,
  BookOpen,
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Layers,
  HelpCircle,
  Image as ImageIcon,
} from 'lucide-react-native';
import { supabase } from '../../../services/supabaseClient';

export default function UjianSoal() {
  const { bankSoalId, mapelId, kelasId } = useLocalSearchParams<{
    bankSoalId?: string;
    mapelId?: string;
    kelasId?: string;
  }>();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [taughtMapelIds, setTaughtMapelIds] = useState<string[]>([]);
  const [isOperatorOrPanitia, setIsOperatorOrPanitia] = useState(false);

  const [bankList, setBankList] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>(bankSoalId || '');
  const [soalList, setSoalList] = useState<any[]>([]);
  const [mapelList, setMapelList] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingSoal, setLoadingSoal] = useState(false);
  const [savingSoal, setSavingSoal] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  // Modal State - Soal
  const [isModalSoalOpen, setIsModalSoalOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [soalForm, setSoalForm] = useState({
    id: null as number | null,
    nomor_urut: 1,
    jenis_soal: 'pg' as 'pg' | 'isian' | 'esai',
    pertanyaan: '',
    gambar_url: '',
    opsi_a: '',
    opsi_a_gambar: '',
    opsi_b: '',
    opsi_b_gambar: '',
    opsi_c: '',
    opsi_c_gambar: '',
    opsi_d: '',
    opsi_d_gambar: '',
    kunci_jawaban: 'A',
    rubrik_esai: '',
    bobot_nilai: '1',
  });

  // Modal State - Bank Soal Baru
  const [isModalBankOpen, setIsModalBankOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    id: null as number | null,
    kode_bank: '',
    judul: '',
    mapel_id: mapelId || '',
    tingkat_kelas: '7',
    deskripsi: '',
  });

  useEffect(() => {
    initPage();
  }, []);

  useEffect(() => {
    if (selectedBankId) {
      fetchSoal(selectedBankId);
    } else {
      setSoalList([]);
    }
  }, [selectedBankId]);

  const initPage = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchUserInfo(), fetchMetadata(), fetchBankSoal()]);
    } catch (err) {
      console.error('Error init soal page:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user_guru');
      if (userStr) {
        const u = JSON.parse(userStr);
        setCurrentUser(u);

        // Cek Jabatan & Panitia
        const [jgRes, panitiaRes, pemRes, jadRes] = await Promise.all([
          supabase
            .from('jabatan_guru')
            .select('jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3')
            .eq('guru_id', u.id)
            .maybeSingle(),
          supabase
            .from('cbt_struktur_panitia')
            .select('*')
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('pembelajaran').select('mapel_id').eq('guru_id', u.id),
          supabase.from('jadwal_pelajaran').select('mapel_id').eq('guru_id', u.id),
        ]);

        const roles: string[] = [];
        if (jgRes.data) {
          const jg = jgRes.data;
          [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3].forEach(r => {
            if (r) roles.push(r);
          });
        }

        const isOp = u.role === 'admin' || roles.some(r => {
          const l = (r || '').toLowerCase();
          return l.includes('operator') || l.includes('admin');
        });

        const isKurikulum = roles.some(r => (r || '').toLowerCase().includes('kurikulum'));

        const isKetua = Boolean(
          (panitiaRes.data?.ketua_panitia_guru_id && Number(panitiaRes.data.ketua_panitia_guru_id) === Number(u.id)) ||
          roles.some(r => (r || '').toLowerCase().includes('ketua panitia'))
        );

        const isSekretaris = Boolean(
          (panitiaRes.data?.sekretaris_guru_id && Number(panitiaRes.data.sekretaris_guru_id) === Number(u.id)) ||
          roles.some(r => (r || '').toLowerCase().includes('sekretaris panitia'))
        );

        setIsOperatorOrPanitia(isOp || isKurikulum || isKetua || isSekretaris);

        // Mapel yang diampu guru dari pembelajaran & jadwal_pelajaran
        const mapelSet = new Set<string>();
        (pemRes.data || []).forEach((p: any) => { if (p.mapel_id) mapelSet.add(String(p.mapel_id)); });
        (jadRes.data || []).forEach((j: any) => { if (j.mapel_id) mapelSet.add(String(j.mapel_id)); });
        setTaughtMapelIds(Array.from(mapelSet));
      }
    } catch (e) {
      console.error('Error fetchUserInfo in soal:', e);
    }
  };

  const fetchMetadata = async () => {
    try {
      const { data } = await supabase.from('data_mapel').select('id, nama_mapel').order('nama_mapel');
      if (data) setMapelList(data);
    } catch (e) {
      console.error('Error fetchMetadata in soal:', e);
    }
  };

  const fetchBankSoal = async () => {
    try {
      const { data, error } = await supabase
        .from('cbt_bank_soal')
        .select('*, data_mapel(nama_mapel)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = data || [];
      setBankList(list);

      // Tentukan bank yang dipilih saat pertama kali dibuka
      if (bankSoalId) {
        setSelectedBankId(bankSoalId);
      } else if (mapelId) {
        const found = list.find(b => Number(b.mapel_id) === Number(mapelId));
        if (found) {
          setSelectedBankId(String(found.id));
        } else if (list.length > 0) {
          setSelectedBankId(String(list[0].id));
        }
      } else if (list.length > 0) {
        setSelectedBankId(String(list[0].id));
      }
    } catch (e: any) {
      Alert.alert('Gagal Memuat', e.message || 'Gagal memuat bank soal.');
    }
  };

  const fetchSoal = async (bId: string) => {
    try {
      setLoadingSoal(true);
      const { data, error } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', bId)
        .order('nomor_urut', { ascending: true });

      if (error) throw error;
      setSoalList(data || []);
    } catch (e: any) {
      Alert.alert('Gagal Memuat Soal', e.message || 'Gagal memuat butir soal.');
    } finally {
      setLoadingSoal(false);
    }
  };

  const activeBank = bankList.find(b => String(b.id) === String(selectedBankId));

  // Cek Hak Akses CRUD: Guru Pengampu Mapel Bank Soal ATAU Operator / Panitia
  const isPengampu = activeBank && (
    taughtMapelIds.includes(String(activeBank.mapel_id)) ||
    (currentUser?.id && Number(activeBank.guru_id) === Number(currentUser.id))
  );

  const canCrud = isOperatorOrPanitia || Boolean(isPengampu);

  // Upload Gambar ke Supabase Bucket cbt_assets
  const pickAndUploadImage = async (field: 'gambar_url' | 'opsi_a_gambar' | 'opsi_b_gambar' | 'opsi_c_gambar' | 'opsi_d_gambar') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Aplikasi membutuhkan izin akses galeri untuk mengunggah gambar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset.base64) {
          Alert.alert('Error', 'Gagal membaca data gambar.');
          return;
        }

        setUploadingImage(true);
        const fileExt = asset.uri.split('.').pop() || 'jpg';
        const fileName = `cbt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `soal/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('cbt_assets')
          .upload(filePath, decode(asset.base64), {
            contentType: asset.mimeType || 'image/jpeg',
            upsert: true,
          });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('cbt_assets')
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData?.publicUrl;
        setSoalForm(prev => ({ ...prev, [field]: publicUrl }));
      }
    } catch (err: any) {
      console.error('Upload image error:', err);
      Alert.alert('Gagal Upload', err.message || 'Terjadi kesalahan saat mengunggah gambar.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Buka Modal Tambah Soal
  const handleOpenTambahSoal = () => {
    if (!activeBank) {
      Alert.alert('Peringatan', 'Silakan pilih atau buat paket bank soal terlebih dahulu.');
      return;
    }
    setSoalForm({
      id: null,
      nomor_urut: soalList.length + 1,
      jenis_soal: 'pg',
      pertanyaan: '',
      gambar_url: '',
      opsi_a: '',
      opsi_a_gambar: '',
      opsi_b: '',
      opsi_b_gambar: '',
      opsi_c: '',
      opsi_c_gambar: '',
      opsi_d: '',
      opsi_d_gambar: '',
      kunci_jawaban: 'A',
      rubrik_esai: '',
      bobot_nilai: '1',
    });
    setIsModalSoalOpen(true);
  };

  // Buka Modal Edit Soal
  const handleOpenEditSoal = (soal: any) => {
    let a = '';
    let b = '';
    let c = '';
    let d = '';
    let aImg = '';
    let bImg = '';
    let cImg = '';
    let dImg = '';

    if (Array.isArray(soal.opsi_jawaban)) {
      const oA = soal.opsi_jawaban.find((o: any) => o.id === 'A');
      const oB = soal.opsi_jawaban.find((o: any) => o.id === 'B');
      const oC = soal.opsi_jawaban.find((o: any) => o.id === 'C');
      const oD = soal.opsi_jawaban.find((o: any) => o.id === 'D');
      a = oA?.text || '';
      aImg = oA?.gambar_url || '';
      b = oB?.text || '';
      bImg = oB?.gambar_url || '';
      c = oC?.text || '';
      cImg = oC?.gambar_url || '';
      d = oD?.text || '';
      dImg = oD?.gambar_url || '';
    } else if (typeof soal.opsi_jawaban === 'object' && soal.opsi_jawaban !== null) {
      a = soal.opsi_jawaban['A'] || soal.opsi_jawaban['a'] || '';
      b = soal.opsi_jawaban['B'] || soal.opsi_jawaban['b'] || '';
      c = soal.opsi_jawaban['C'] || soal.opsi_jawaban['c'] || '';
      d = soal.opsi_jawaban['D'] || soal.opsi_jawaban['d'] || '';
    }

    setSoalForm({
      id: soal.id,
      nomor_urut: soal.nomor_urut || 1,
      jenis_soal: soal.jenis_soal || 'pg',
      pertanyaan: soal.pertanyaan || '',
      gambar_url: soal.gambar_url || '',
      opsi_a: a,
      opsi_a_gambar: aImg,
      opsi_b: b,
      opsi_b_gambar: bImg,
      opsi_c: c,
      opsi_c_gambar: cImg,
      opsi_d: d,
      opsi_d_gambar: dImg,
      kunci_jawaban: soal.kunci_jawaban || 'A',
      rubrik_esai: soal.rubrik_esai || '',
      bobot_nilai: String(soal.bobot_nilai || '1'),
    });
    setIsModalSoalOpen(true);
  };

  // Simpan Soal (Insert / Update)
  const handleSaveSoal = async () => {
    if (!soalForm.pertanyaan.trim()) {
      Alert.alert('Validasi', 'Teks pertanyaan wajib diisi.');
      return;
    }

    if (soalForm.jenis_soal === 'pg') {
      if (!soalForm.opsi_a.trim() && !soalForm.opsi_a_gambar) {
        Alert.alert('Validasi', 'Opsi A wajib memiliki teks atau gambar.');
        return;
      }
      if (!soalForm.opsi_b.trim() && !soalForm.opsi_b_gambar) {
        Alert.alert('Validasi', 'Opsi B wajib memiliki teks atau gambar.');
        return;
      }
      if (!soalForm.opsi_c.trim() && !soalForm.opsi_c_gambar) {
        Alert.alert('Validasi', 'Opsi C wajib memiliki teks atau gambar.');
        return;
      }
      if (!soalForm.opsi_d.trim() && !soalForm.opsi_d_gambar) {
        Alert.alert('Validasi', 'Opsi D wajib memiliki teks atau gambar.');
        return;
      }
      if (!soalForm.kunci_jawaban) {
        Alert.alert('Validasi', 'Silakan tentukan kunci jawaban.');
        return;
      }
    } else if (soalForm.jenis_soal === 'isian') {
      if (!soalForm.kunci_jawaban.trim()) {
        Alert.alert('Validasi', 'Kunci jawaban singkat wajib diisi.');
        return;
      }
    }

    setSavingSoal(true);
    try {
      const opsiArray = soalForm.jenis_soal === 'pg'
        ? [
            { id: 'A', text: soalForm.opsi_a.trim(), gambar_url: soalForm.opsi_a_gambar || null },
            { id: 'B', text: soalForm.opsi_b.trim(), gambar_url: soalForm.opsi_b_gambar || null },
            { id: 'C', text: soalForm.opsi_c.trim(), gambar_url: soalForm.opsi_c_gambar || null },
            { id: 'D', text: soalForm.opsi_d.trim(), gambar_url: soalForm.opsi_d_gambar || null },
          ]
        : [];

      const payload = {
        bank_soal_id: activeBank.id,
        nomor_urut: parseInt(String(soalForm.nomor_urut), 10) || 1,
        jenis_soal: soalForm.jenis_soal,
        pertanyaan: soalForm.pertanyaan.trim(),
        gambar_url: soalForm.gambar_url || null,
        opsi_jawaban: opsiArray,
        kunci_jawaban: soalForm.jenis_soal === 'esai' ? '' : soalForm.kunci_jawaban.trim(),
        rubrik_esai: soalForm.jenis_soal === 'esai' ? soalForm.rubrik_esai.trim() : '',
        bobot_nilai: parseFloat(soalForm.bobot_nilai) || 1.0,
      };

      if (soalForm.id) {
        const { error } = await supabase.from('cbt_soal').update(payload).eq('id', soalForm.id);
        if (error) throw error;
        Alert.alert('Sukses', 'Butir soal berhasil diperbarui.');
      } else {
        const { error } = await supabase.from('cbt_soal').insert([payload]);
        if (error) throw error;
        Alert.alert('Sukses', 'Butir soal baru berhasil ditambahkan.');
      }

      // Update total soal count di cbt_bank_soal
      const { count } = await supabase
        .from('cbt_soal')
        .select('*', { count: 'exact', head: true })
        .eq('bank_soal_id', activeBank.id);

      await supabase
        .from('cbt_bank_soal')
        .update({ total_soal: count || 0, updated_at: new Date().toISOString() })
        .eq('id', activeBank.id);

      setIsModalSoalOpen(false);
      fetchSoal(String(activeBank.id));
      fetchBankSoal();
    } catch (e: any) {
      Alert.alert('Gagal Menyimpan', e.message || 'Terjadi kesalahan saat menyimpan soal.');
    } finally {
      setSavingSoal(false);
    }
  };

  // Hapus Soal
  const handleDeleteSoal = (soal: any) => {
    Alert.alert(
      'Hapus Soal',
      `Apakah Anda yakin ingin menghapus soal nomor ${soal.nomor_urut}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('cbt_soal').delete().eq('id', soal.id);
              if (error) throw error;

              // Update total count
              const { count } = await supabase
                .from('cbt_soal')
                .select('*', { count: 'exact', head: true })
                .eq('bank_soal_id', activeBank.id);

              await supabase
                .from('cbt_bank_soal')
                .update({ total_soal: count || 0, updated_at: new Date().toISOString() })
                .eq('id', activeBank.id);

              Alert.alert('Sukses', 'Butir soal berhasil dihapus.');
              fetchSoal(String(activeBank.id));
              fetchBankSoal();
            } catch (e: any) {
              Alert.alert('Gagal Menghapus', e.message || 'Gagal menghapus butir soal.');
            }
          },
        },
      ]
    );
  };

  // Simpan Paket Bank Soal Baru
  const handleSaveBank = async () => {
    if (!bankForm.judul.trim()) {
      Alert.alert('Validasi', 'Judul bank soal wajib diisi.');
      return;
    }
    if (!bankForm.kode_bank.trim()) {
      Alert.alert('Validasi', 'Kode bank soal wajib diisi.');
      return;
    }
    if (!bankForm.mapel_id) {
      Alert.alert('Validasi', 'Silakan pilih mata pelajaran.');
      return;
    }

    setSavingBank(true);
    try {
      const payload = {
        kode_bank: bankForm.kode_bank.trim().toUpperCase(),
        judul: bankForm.judul.trim(),
        mapel_id: parseInt(String(bankForm.mapel_id), 10),
        tingkat_kelas: bankForm.tingkat_kelas,
        guru_id: currentUser?.id || null,
        deskripsi: bankForm.deskripsi.trim(),
        total_soal: 0,
      };

      const { data, error } = await supabase.from('cbt_bank_soal').insert([payload]).select().single();
      if (error) throw error;

      Alert.alert('Sukses', 'Paket bank soal berhasil dibuat.');
      setIsModalBankOpen(false);
      await fetchBankSoal();
      if (data?.id) {
        setSelectedBankId(String(data.id));
      }
    } catch (e: any) {
      Alert.alert('Gagal', e.message || 'Gagal membuat bank soal.');
    } finally {
      setSavingBank(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Halaman */}
      <LinearGradient colors={['#2a2c87', '#3b3e9e']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Bank Soal Ujian</Text>
            <Text style={styles.headerSubtitle}>
              {canCrud ? 'Kelola butir pertanyaan, kunci jawaban & rubrik' : 'Tinjau butir soal & kunci jawaban (Read-only)'}
            </Text>
          </View>

          {/* Tombol Buat Bank Baru jika Pengampu/Operator */}
          {canCrud && (
            <TouchableOpacity
              style={styles.headerAddBankBtn}
              onPress={() => {
                const defMapel = mapelId || (taughtMapelIds.length > 0 ? taughtMapelIds[0] : (mapelList[0]?.id || ''));
                const mObj = mapelList.find(m => String(m.id) === String(defMapel));
                const prefix = mObj?.nama_mapel ? mObj.nama_mapel.substring(0, 3).toUpperCase() : 'SOAL';
                setBankForm({
                  id: null,
                  kode_bank: `${prefix}-${new Date().getFullYear()}`,
                  judul: mObj?.nama_mapel ? `Bank Soal ${mObj.nama_mapel}` : 'Bank Soal Ujian',
                  mapel_id: String(defMapel),
                  tingkat_kelas: '7',
                  deskripsi: '',
                });
                setIsModalBankOpen(true);
              }}
            >
              <Layers size={14} color="#fff" />
              <Text style={styles.headerAddBankBtnText}>+ Bank</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Selector Paket Bank Soal (Chips) */}
      <View style={styles.bankChipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankChipsScroll}>
          {bankList.map((b) => {
            const isSelected = String(b.id) === String(selectedBankId);
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.bankChip, isSelected && styles.bankChipActive]}
                onPress={() => setSelectedBankId(String(b.id))}
              >
                <Text style={[styles.bankChipText, isSelected && styles.bankChipTextActive]}>
                  {b.judul || b.kode_bank}
                </Text>
              </TouchableOpacity>
            );
          })}
          {bankList.length === 0 && (
            <Text style={styles.emptyBankText}>Belum ada paket bank soal.</Text>
          )}
        </ScrollView>
      </View>

      {/* Banner Informasi Bank Soal Aktif & Tombol Tambah Soal */}
      {activeBank ? (
        <View style={styles.bankInfoBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bankInfoTitle}>{activeBank.judul}</Text>
            <Text style={styles.bankInfoMeta}>
              Mapel: {activeBank.data_mapel?.nama_mapel || '-'} • Kelas: {activeBank.tingkat_kelas || '-'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.bankBadge}>
              <Text style={styles.bankBadgeText}>{soalList.length} Soal</Text>
            </View>

            {/* Tombol Tambah Soal bagi Pengampu Mapel / Operator */}
            {canCrud && (
              <TouchableOpacity style={styles.addSoalBtn} onPress={handleOpenTambahSoal}>
                <Plus size={15} color="#fff" />
                <Text style={styles.addSoalBtnText}>+ Soal</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.emptyBankBanner}>
          <Text style={styles.emptyBankBannerText}>
            Pilih atau buat bank soal untuk melihat butir pertanyaan.
          </Text>
        </View>
      )}

      {/* Daftar Butir Soal */}
      {loading || loadingSoal ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2a2c87" />
          <Text style={styles.loadingText}>Memuat butir pertanyaan...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {soalList.length === 0 ? (
            <View style={styles.emptyCard}>
              <FileQuestion size={48} color="#9ca3af" />
              <Text style={styles.emptyTitle}>Bank Soal Masih Kosong</Text>
              <Text style={styles.emptySubtitle}>
                {canCrud
                  ? 'Belum ada butir pertanyaan. Klik tombol "+ Soal" di atas untuk menambahkan pertanyaan baru.'
                  : 'Belum ada butir pertanyaan yang diinputkan pada bank soal ini.'}
              </Text>
              {canCrud && (
                <TouchableOpacity style={styles.emptyAddBtn} onPress={handleOpenTambahSoal}>
                  <Plus size={16} color="#fff" />
                  <Text style={styles.emptyAddBtnText}>Tambah Soal Sekarang</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            soalList.map((soal, idx) => {
              return (
                <View key={soal.id} style={styles.soalCard}>
                  {/* Header Kartu Soal */}
                  <View style={styles.soalHeader}>
                    <View style={styles.numBadge}>
                      <Text style={styles.numBadgeText}>No. {soal.nomor_urut || idx + 1}</Text>
                    </View>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {soal.jenis_soal === 'pg'
                          ? 'Pilihan Ganda'
                          : soal.jenis_soal === 'isian'
                          ? 'Isian Singkat'
                          : 'Esai'}
                      </Text>
                    </View>
                    <Text style={styles.bobotText}>Bobot: {soal.bobot_nilai || 1}</Text>

                    {/* Tombol Aksi Edit & Hapus bagi Pengampu Mapel */}
                    {canCrud && (
                      <View style={styles.soalActionsRow}>
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => handleOpenEditSoal(soal)}
                        >
                          <Edit3 size={15} color="#2563eb" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => handleDeleteSoal(soal)}
                        >
                          <Trash2 size={15} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Pertanyaan */}
                  <Text style={styles.pertanyaanText}>{soal.pertanyaan}</Text>

                  {/* Gambar Soal Jika Ada */}
                  {soal.gambar_url ? (
                    <Image
                      source={{ uri: soal.gambar_url }}
                      style={{ width: '100%', height: 180, borderRadius: 8, marginVertical: 8, backgroundColor: '#f8fafc' }}
                      resizeMode="contain"
                    />
                  ) : null}

                  {/* Opsi PG */}
                  {soal.jenis_soal === 'pg' && (
                    <View style={styles.opsiList}>
                      {['A', 'B', 'C', 'D'].map((key) => {
                        let textVal = '';
                        let imgVal = '';
                        if (Array.isArray(soal.opsi_jawaban)) {
                          const found = soal.opsi_jawaban.find((o: any) => o.id === key);
                          textVal = found?.text || '';
                          imgVal = found?.gambar_url || '';
                        } else if (typeof soal.opsi_jawaban === 'object' && soal.opsi_jawaban !== null) {
                          textVal = soal.opsi_jawaban[key] || soal.opsi_jawaban[key.toLowerCase()] || '';
                        }
                        const isCorrect = (soal.kunci_jawaban || '').toUpperCase() === key;

                        return (
                          <View
                            key={key}
                            style={[styles.opsiItem, isCorrect && styles.opsiItemCorrect]}
                          >
                            <View style={[styles.opsiKey, isCorrect && styles.opsiKeyCorrect]}>
                              <Text style={[styles.opsiKeyText, isCorrect && styles.opsiKeyTextCorrect]}>
                                {key}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.opsiVal, isCorrect && styles.opsiValCorrect]}>
                                {textVal || `Pilihan ${key}`}
                              </Text>
                              {imgVal ? (
                                <Image
                                  source={{ uri: imgVal }}
                                  style={{ width: 120, height: 70, borderRadius: 6, marginTop: 4, backgroundColor: '#fff' }}
                                  resizeMode="contain"
                                />
                              ) : null}
                            </View>
                            {isCorrect && (
                              <CheckCircle size={16} color="#16a34a" style={{ marginLeft: 6 }} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Kunci Isian */}
                  {soal.jenis_soal === 'isian' && (
                    <View style={styles.kunciBox}>
                      <Text style={styles.kunciLabel}>Kunci Jawaban Singkat:</Text>
                      <Text style={styles.kunciVal}>{soal.kunci_jawaban || '-'}</Text>
                    </View>
                  )}

                  {/* Rubrik Esai */}
                  {soal.jenis_soal === 'esai' && (
                    <View style={styles.rubrikBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Sparkles size={14} color="#7c3aed" />
                        <Text style={styles.rubrikLabel}>Panduan Rubrik Penilaian:</Text>
                      </View>
                      <Text style={styles.rubrikVal}>{soal.rubrik_esai || '-'}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* =========================================================================
          MODAL FORM CRUD BUTIR SOAL (Khusus Guru Pengampu & Panitia)
      ========================================================================= */}
      <Modal
        visible={isModalSoalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalSoalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {soalForm.id ? `Edit Butir Soal No. ${soalForm.nomor_urut}` : 'Tambah Butir Soal Baru'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalSoalOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Pilihan Jenis Soal */}
              <Text style={styles.inputLabel}>Jenis Soal:</Text>
              <View style={styles.typeSelectorRow}>
                {[
                  { key: 'pg', label: 'Pilihan Ganda' },
                  { key: 'isian', label: 'Isian Singkat' },
                  { key: 'esai', label: 'Esai / Uraian' },
                ].map((t) => {
                  const isActive = soalForm.jenis_soal === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.typeSelectBtn, isActive && styles.typeSelectBtnActive]}
                      onPress={() => setSoalForm(prev => ({ ...prev, jenis_soal: t.key as any }))}
                    >
                      <Text style={[styles.typeSelectBtnText, isActive && styles.typeSelectBtnTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Input Nomor Urut & Bobot */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Nomor Urut:</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={String(soalForm.nomor_urut)}
                    onChangeText={(v) => setSoalForm(prev => ({ ...prev, nomor_urut: parseInt(v, 10) || 1 }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Bobot Nilai (Poin):</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={soalForm.bobot_nilai}
                    onChangeText={(v) => setSoalForm(prev => ({ ...prev, bobot_nilai: v }))}
                    placeholder="1"
                  />
                </View>
              </View>

              {/* Pertanyaan */}
              <Text style={styles.inputLabel}>Teks Pertanyaan Soal:</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                multiline
                numberOfLines={4}
                value={soalForm.pertanyaan}
                onChangeText={(v) => setSoalForm(prev => ({ ...prev, pertanyaan: v }))}
                placeholder="Tuliskan butir soal secara lengkap di sini..."
                textAlignVertical="top"
              />

              {/* Upload Gambar Soal (Untuk Semua Jenis Soal) */}
              <View style={{ marginTop: 8, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>Gambar Soal (Opsional - Semua Jenis):</Text>
                  {uploadingImage && <ActivityIndicator size="small" color="#2a2c87" />}
                </View>
                {soalForm.gambar_url ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <Image source={{ uri: soalForm.gambar_url }} style={{ width: 80, height: 60, borderRadius: 6, backgroundColor: '#fff' }} resizeMode="contain" />
                    <TouchableOpacity
                      onPress={() => setSoalForm(prev => ({ ...prev, gambar_url: '' }))}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fee2e2', borderRadius: 6 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>Hapus Gambar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => pickAndUploadImage('gambar_url')}
                    disabled={uploadingImage}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' }}
                  >
                    <ImageIcon size={16} color="#2563eb" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563eb' }}>Unggah Gambar Soal</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Form Khusus Pilihan Ganda (Opsi A - D, Gambar & Kunci) */}
              {soalForm.jenis_soal === 'pg' && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.inputLabel}>Pilihan Jawaban (A, B, C, D) & Kunci:</Text>
                  <Text style={styles.inputHint}>Klik bulatan huruf untuk menandai kunci jawaban yang benar. Gunakan ikon gambar untuk upload gambar opsi.</Text>

                  {[
                    { key: 'A', field: 'opsi_a', imgField: 'opsi_a_gambar' as const },
                    { key: 'B', field: 'opsi_b', imgField: 'opsi_b_gambar' as const },
                    { key: 'C', field: 'opsi_c', imgField: 'opsi_c_gambar' as const },
                    { key: 'D', field: 'opsi_d', imgField: 'opsi_d_gambar' as const },
                  ].map(({ key, field, imgField }) => {
                    const isKey = soalForm.kunci_jawaban === key;
                    const currentImg = (soalForm as any)[imgField];
                    return (
                      <View key={key} style={{ marginBottom: 10 }}>
                        <View style={styles.opsiInputRow}>
                          <TouchableOpacity
                            style={[styles.kunciSelectBtn, isKey && styles.kunciSelectBtnActive]}
                            onPress={() => setSoalForm(prev => ({ ...prev, kunci_jawaban: key }))}
                          >
                            <Text style={[styles.kunciSelectBtnText, isKey && styles.kunciSelectBtnTextActive]}>
                              {key}
                            </Text>
                          </TouchableOpacity>
                          <TextInput
                            style={[styles.textInput, { flex: 1 }, isKey && styles.textInputCorrect]}
                            value={(soalForm as any)[field]}
                            onChangeText={(v) => setSoalForm(prev => ({ ...prev, [field]: v }))}
                            placeholder={`Teks Pilihan ${key}`}
                          />
                          <TouchableOpacity
                            onPress={() => pickAndUploadImage(imgField)}
                            disabled={uploadingImage}
                            style={{
                              padding: 9,
                              borderRadius: 8,
                              backgroundColor: currentImg ? '#dcfce7' : '#f1f5f9',
                              borderWidth: 1,
                              borderColor: currentImg ? '#86efac' : '#e2e8f0',
                            }}
                          >
                            <ImageIcon size={16} color={currentImg ? '#16a34a' : '#64748b'} />
                          </TouchableOpacity>
                        </View>
                        {currentImg ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 44, marginTop: 4 }}>
                            <Image source={{ uri: currentImg }} style={{ width: 60, height: 40, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' }} resizeMode="contain" />
                            <TouchableOpacity onPress={() => setSoalForm(prev => ({ ...prev, [imgField]: '' }))}>
                              <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600' }}>Hapus gambar opsi</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Form Khusus Isian Singkat */}
              {soalForm.jenis_soal === 'isian' && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputLabel}>Kunci Jawaban Singkat:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={soalForm.kunci_jawaban}
                    onChangeText={(v) => setSoalForm(prev => ({ ...prev, kunci_jawaban: v }))}
                    placeholder="Contoh: Fotosintesis, 1945, Jakarta..."
                  />
                </View>
              )}

              {/* Form Khusus Esai */}
              {soalForm.jenis_soal === 'esai' && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputLabel}>Panduan Rubrik Penilaian:</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    multiline
                    numberOfLines={3}
                    value={soalForm.rubrik_esai}
                    onChangeText={(v) => setSoalForm(prev => ({ ...prev, rubrik_esai: v }))}
                    placeholder="Tuliskan kriteria jawaban yang dinilai lengkap dan benar..."
                    textAlignVertical="top"
                  />
                </View>
              )}
            </ScrollView>

            {/* Footer Modal Soal */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsModalSoalOpen(false)}
                disabled={savingSoal}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSaveSoal}
                disabled={savingSoal}
              >
                {savingSoal ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.modalSubmitBtnText}>Simpan Soal</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================================
          MODAL FORM TAMBAH PAKET BANK SOAL BARU
      ========================================================================= */}
      <Modal
        visible={isModalBankOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalBankOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buat Paket Bank Soal</Text>
              <TouchableOpacity onPress={() => setIsModalBankOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Mata Pelajaran:</Text>
              <View style={styles.mapelSelectChips}>
                {mapelList
                  .filter(m => isOperatorOrPanitia || taughtMapelIds.includes(String(m.id)))
                  .map(m => {
                    const isSel = String(bankForm.mapel_id) === String(m.id);
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.mapelChip, isSel && styles.mapelChipActive]}
                        onPress={() => {
                          const prefix = m.nama_mapel ? m.nama_mapel.substring(0, 3).toUpperCase() : 'SOAL';
                          setBankForm(prev => ({
                            ...prev,
                            mapel_id: String(m.id),
                            kode_bank: `${prefix}-${prev.tingkat_kelas}-${new Date().getFullYear()}`,
                            judul: `Bank Soal ${m.nama_mapel} Kelas ${prev.tingkat_kelas}`,
                          }));
                        }}
                      >
                        <Text style={[styles.mapelChipText, isSel && styles.mapelChipTextActive]}>
                          {m.nama_mapel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              <Text style={styles.inputLabel}>Tingkat Kelas:</Text>
              <View style={styles.typeSelectorRow}>
                {['7', '8', '9', 'Semua'].map((tk) => {
                  const isSel = bankForm.tingkat_kelas === tk;
                  return (
                    <TouchableOpacity
                      key={tk}
                      style={[styles.typeSelectBtn, isSel && styles.typeSelectBtnActive]}
                      onPress={() => setBankForm(prev => ({ ...prev, tingkat_kelas: tk }))}
                    >
                      <Text style={[styles.typeSelectBtnText, isSel && styles.typeSelectBtnTextActive]}>
                        Kelas {tk}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Judul Paket Bank Soal:</Text>
              <TextInput
                style={styles.textInput}
                value={bankForm.judul}
                onChangeText={(v) => setBankForm(prev => ({ ...prev, judul: v }))}
                placeholder="Contoh: PTS Matematika Kelas 7 Ganjil"
              />

              <Text style={styles.inputLabel}>Kode Bank Soal:</Text>
              <TextInput
                style={styles.textInput}
                value={bankForm.kode_bank}
                onChangeText={(v) => setBankForm(prev => ({ ...prev, kode_bank: v }))}
                placeholder="Contoh: MTK-7-PTS"
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Deskripsi / Catatan (Opsional):</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                multiline
                numberOfLines={3}
                value={bankForm.deskripsi}
                onChangeText={(v) => setBankForm(prev => ({ ...prev, deskripsi: v }))}
                placeholder="Deskripsi materi atau cakupan kompetensi dasar..."
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsModalBankOpen(false)}
                disabled={savingBank}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSaveBank}
                disabled={savingBank}
              >
                {savingBank ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.modalSubmitBtnText}>Buat Bank Soal</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  headerAddBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerAddBankBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  bankChipsContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  bankChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  bankChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  bankChipActive: {
    backgroundColor: '#2a2c87',
  },
  bankChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  bankChipTextActive: {
    color: '#fff',
  },
  emptyBankText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  bankInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  bankInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  bankInfoMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  bankBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  bankBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2a2c87',
  },
  addSoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2a2c87',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addSoalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  emptyBankBanner: {
    padding: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
  },
  emptyBankBannerText: {
    fontSize: 13,
    color: '#1e40af',
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
    paddingBottom: 40,
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
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2a2c87',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyAddBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  soalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  soalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  numBadge: {
    backgroundColor: '#2a2c87',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  numBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  typeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  bobotText: {
    fontSize: 12,
    color: '#64748b',
  },
  soalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pertanyaanText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    lineHeight: 21,
    marginBottom: 12,
  },
  opsiList: {
    gap: 8,
  },
  opsiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  opsiItemCorrect: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  opsiKey: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  opsiKeyCorrect: {
    backgroundColor: '#16a34a',
  },
  opsiKeyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  opsiKeyTextCorrect: {
    color: '#fff',
  },
  opsiVal: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
  },
  opsiValCorrect: {
    color: '#166534',
    fontWeight: '600',
  },
  kunciBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  kunciLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 2,
  },
  kunciVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  rubrikBox: {
    backgroundColor: '#f5f3ff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  rubrikLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6d28d9',
  },
  rubrikVal: {
    fontSize: 13,
    color: '#4c1d95',
    lineHeight: 18,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputHint: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  textInputCorrect: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  typeSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeSelectBtnActive: {
    backgroundColor: '#2a2c87',
    borderColor: '#2a2c87',
  },
  typeSelectBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  typeSelectBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  opsiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  kunciSelectBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  kunciSelectBtnActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  kunciSelectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  kunciSelectBtnTextActive: {
    color: '#fff',
  },
  mapelSelectChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  mapelChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapelChipActive: {
    backgroundColor: '#2a2c87',
    borderColor: '#2a2c87',
  },
  mapelChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  mapelChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2a2c87',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
