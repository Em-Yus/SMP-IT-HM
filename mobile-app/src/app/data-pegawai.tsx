import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Linking, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, UserCircle, X, Phone, Plus, Edit, UserMinus, Save, Book, CheckSquare, Square, Briefcase } from 'lucide-react-native';
import { router } from 'expo-router';
import CustomDatePicker from '../components/CustomDatePicker';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type Pegawai = {
  id?: number;
  nama: string | undefined;
  nik: string | undefined;
  nip: string | undefined;
  nuptk: string | undefined;
  niy: string | undefined;
  no_wa: string | undefined;
  tempat_lahir: string | undefined;
  tanggal_lahir: string | undefined;
  nama_ibu: string | undefined;
  agama: string | undefined;
  status_perkawinan: string | undefined;
  pendidikan: string | undefined;
  alamat: string | undefined;
  status_pegawai: string | undefined;
  tanggal_masuk: string | undefined;
  foto_url: string | undefined;
};

const DEFAULT_FORM: Pegawai = {
  nama: '', nik: '', nip: '', nuptk: '', niy: '', no_wa: '',
  tempat_lahir: '', tanggal_lahir: '', nama_ibu: '', agama: 'Islam', status_perkawinan: 'Belum Kawin', pendidikan: '', alamat: '', status_pegawai: 'GTY/PTY', tanggal_masuk: new Date().toISOString().split('T')[0], foto_url: ''
};

export default function DataPegawai() {
  const [dataPegawai, setDataPegawai] = useState<Array<Pegawai>>([]);
  const [filteredData, setFilteredData] = useState<Array<Pegawai>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedPegawai, setSelectedPegawai] = useState<Pegawai | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Pegawai>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const EXPORT_COLUMNS_OPTIONS = [
    { id: 'nama', label: 'Nama Lengkap' },
    { id: 'nik', label: 'NIK' },
    { id: 'nip', label: 'NIP' },
    { id: 'nuptk', label: 'NUPTK' },
    { id: 'niy', label: 'NIY' },
    { id: 'tempat_lahir', label: 'Tempat Lahir' },
    { id: 'tanggal_lahir', label: 'Tanggal Lahir' },
    { id: 'nama_ibu', label: 'Nama Ibu' },
    { id: 'agama', label: 'Agama' },
    { id: 'status_perkawinan', label: 'Status Perkawinan' },
    { id: 'pendidikan', label: 'Pendidikan' },
    { id: 'alamat', label: 'Alamat Lengkap' },
    { id: 'status_pegawai', label: 'Status Pegawai' },
    { id: 'tanggal_masuk', label: 'Tanggal Masuk' },
    { id: 'no_wa', label: 'No WhatsApp' },
  ];
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedExportCols, setSelectedExportCols] = useState<string[]>(
    EXPORT_COLUMNS_OPTIONS.map(c => c.id)
  );

  // Pembelajaran
  const [refKelas, setRefKelas] = useState<any[]>([]);
  const [refMapel, setRefMapel] = useState<any[]>([]);
  const [pembelajaranModalVisible, setPembelajaranModalVisible] = useState(false);
  const [pembelajaranSelection, setPembelajaranSelection] = useState<Record<number, number[]>>({});
  const [savingPembelajaran, setSavingPembelajaran] = useState(false);

  // Jabatan
  const [refJabatan, setRefJabatan] = useState<any[]>([]);
  const [jabatanModalVisible, setJabatanModalVisible] = useState(false);
  const [jabatanForm, setJabatanForm] = useState({ jabatan_utama: '', jabatan_lain_1: '', jabatan_lain_2: '', jabatan_lain_3: '' });
  const [savingJabatan, setSavingJabatan] = useState(false);

  useEffect(() => {
    fetchPegawai();
    fetchReferensi();

    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\data-pegawai.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchPegawai();

    });

    return () => listener.remove();
  }, []);

  const fetchPegawai = async () => {
    try {
      const { data, error } = await supabase
        .from('data_guru')
        .select('*')
        .is('tanggal_keluar', null)
        .order('nama', { ascending: true });

      if (error) throw error;
      if (data) {
        setDataPegawai(data);
        setFilteredData(data);
      }
    } catch (err) {
      console.error('Error fetching data pegawai:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferensi = async () => {
    try {
      const [resKelas, resMapel, resJabatan] = await Promise.all([
        supabase.from('data_kelas').select('*').order('nama_kelas'),
        supabase.from('data_mapel').select('*').order('urutan', { ascending: true }),
        supabase.from('data_jabatan').select('*').order('nama_jabatan', { ascending: true })
      ]);
      if (resKelas.data) setRefKelas(resKelas.data);
      if (resMapel.data) setRefMapel(resMapel.data);
      if (resJabatan.data) setRefJabatan(resJabatan.data);
    } catch (err) {
      console.error("Gagal load referensi:", err);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text) {
      const filtered = dataPegawai.filter(p =>
        p.nama?.toLowerCase().includes(text.toLowerCase()) ||
        p.nik?.toLowerCase().includes(text.toLowerCase()) ||
        p.status_pegawai?.toLowerCase().includes(text.toLowerCase()) ||
        p.pendidikan?.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(dataPegawai);
    }
  };

  const handleExportExcel = async () => {
    try {
      if (!dataPegawai || dataPegawai.length === 0) {
        Alert.alert('Info', 'Tidak ada data pegawai untuk diekspor.');
        return;
      }

      const exportData = dataPegawai.map((p, index) => {
        const row: any = { 'No': index + 1 };
        if (selectedExportCols.includes('nama')) row['Nama'] = p.nama || '-';
        if (selectedExportCols.includes('nik')) row['NIK'] = p.nik || '-';
        if (selectedExportCols.includes('nip')) row['NIP'] = p.nip || '-';
        if (selectedExportCols.includes('nuptk')) row['NUPTK'] = p.nuptk || '-';
        if (selectedExportCols.includes('niy')) row['NIY'] = p.niy || '-';
        if (selectedExportCols.includes('tempat_lahir')) row['Tempat Lahir'] = p.tempat_lahir || '-';
        if (selectedExportCols.includes('tanggal_lahir')) row['Tanggal Lahir'] = p.tanggal_lahir || '-';
        if (selectedExportCols.includes('nama_ibu')) row['Nama Ibu'] = p.nama_ibu || '-';
        if (selectedExportCols.includes('agama')) row['Agama'] = p.agama || '-';
        if (selectedExportCols.includes('status_perkawinan')) row['Status Perkawinan'] = p.status_perkawinan || '-';
        if (selectedExportCols.includes('pendidikan')) row['Pendidikan'] = p.pendidikan || '-';
        if (selectedExportCols.includes('alamat')) row['Alamat'] = p.alamat || '-';
        if (selectedExportCols.includes('status_pegawai')) row['Status Pegawai'] = p.status_pegawai || '-';
        if (selectedExportCols.includes('tanggal_masuk')) row['Tanggal Masuk'] = p.tanggal_masuk || '-';
        if (selectedExportCols.includes('no_wa')) row['No WhatsApp'] = p.no_wa || '-';
        return row;
      });

      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(obj => Object.values(obj).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
      const csvString = `${headers}\n${rows}`;
      const fileUri = FileSystem.cacheDirectory + 'Data_Pegawai.csv';

      await FileSystem.writeAsStringAsync(fileUri, csvString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Bagikan CSV Data Pegawai',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Error', 'Fitur berbagi tidak tersedia di perangkat ini.');
      }
      setExportModalVisible(false);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Gagal membuat file CSV: ' + (err as any).message);
    }
  };

  const openDetail = (pegawai: Pegawai) => {
    setSelectedPegawai(pegawai);
    setIsEditing(false);
    setModalVisible(true);
  };

  const openAddForm = () => {
    setSelectedPegawai(undefined);
    setFormData(DEFAULT_FORM);
    setIsEditing(true);
    setModalVisible(true);
  };

  const openEditForm = () => {
    if (selectedPegawai) {
      setFormData(selectedPegawai);
      setIsEditing(true);
    }
  };

  const handleDeactivate = () => {
    if (!selectedPegawai) return;
    Alert.alert(
      "Nonaktifkan Pegawai",
      `Yakin ingin menonaktifkan ${selectedPegawai.nama}? Pegawai ini akan dipindahkan ke daftar Nonaktif.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Nonaktifkan",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const today = new Date().toISOString().split('T')[0];
              const { error } = await supabase
                .from('data_guru')
                .update({ tanggal_keluar: today })
                .eq('id', selectedPegawai.id);

              if (error) throw error;
              Alert.alert("Sukses", "Pegawai berhasil dinonaktifkan.");
              setModalVisible(false);
              fetchPegawai();
            } catch (err: any) {
              Alert.alert("Error", err.message);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!formData.nama || !formData.nik) {
      Alert.alert("Error", "Nama dan NIK wajib diisi!");
      return;
    }

    setSaving(true);
    try {
      if (formData.id) {
        // Update
        const { error } = await supabase
          .from('data_guru')
          .update(formData)
          .eq('id', formData.id);
        if (error) throw error;
        Alert.alert("Sukses", "Data pegawai berhasil diperbarui!");
      } else {
        // Insert
        const { error } = await supabase
          .from('data_guru')
          .insert([formData]);
        if (error) throw error;
        Alert.alert("Sukses", "Pegawai baru berhasil ditambahkan!");
      }
      setModalVisible(false);
      fetchPegawai();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };
  const handleOpenPembelajaran = async () => {
    if (!selectedPegawai) return;
    setPembelajaranModalVisible(true);
    try {
      const { data, error } = await supabase
        .from('pembelajaran')
        .select('*')
        .eq('guru_id', selectedPegawai.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const selection: Record<number, number[]> = {};
        data.forEach(item => {
          if (!selection[item.kelas_id]) {
            selection[item.kelas_id] = [];
          }
          selection[item.kelas_id].push(item.mapel_id);
        });
        setPembelajaranSelection(selection);
      } else {
        setPembelajaranSelection({});
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal memuat data pembelajaran.');
    }
  };

  const handleKelasToggle = (kelas_id: number) => {
    setPembelajaranSelection(prev => {
      const newSel = { ...prev };
      if (newSel[kelas_id]) {
        delete newSel[kelas_id];
      } else {
        newSel[kelas_id] = [];
      }
      return newSel;
    });
  };

  const handleMapelToggle = (kelas_id: number, mapel_id: number) => {
    setPembelajaranSelection(prev => {
      const newSel = { ...prev };
      if (!newSel[kelas_id]) return prev;
      if (newSel[kelas_id].includes(mapel_id)) {
        newSel[kelas_id] = newSel[kelas_id].filter(id => id !== mapel_id);
      } else {
        newSel[kelas_id] = [...newSel[kelas_id], mapel_id];
      }
      return newSel;
    });
  };

  const handleSavePembelajaran = async () => {
    if (!selectedPegawai) return;
    setSavingPembelajaran(true);
    try {
      const delRes = await supabase.from('pembelajaran').delete().eq('guru_id', selectedPegawai.id);
      if (delRes.error) throw delRes.error;

      const payload: any[] = [];
      Object.keys(pembelajaranSelection).forEach(kId => {
        const kelas_id = parseInt(kId);
        pembelajaranSelection[kelas_id].forEach(mapel_id => {
          payload.push({ guru_id: selectedPegawai.id, kelas_id, mapel_id });
        });
      });

      if (payload.length > 0) {
        const insRes = await supabase.from('pembelajaran').insert(payload);
        if (insRes.error) throw insRes.error;
      }

      Alert.alert('Sukses', 'Data pembelajaran berhasil disimpan');
      setPembelajaranModalVisible(false);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message);
    } finally {
      setSavingPembelajaran(false);
    }
  };

  const handleOpenJabatan = async () => {
    if (!selectedPegawai) return;
    setJabatanModalVisible(true);
    try {
      const { data, error } = await supabase
        .from('jabatan_guru')
        .select('*')
        .eq('guru_id', selectedPegawai.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setJabatanForm({
          jabatan_utama: data.jabatan_utama || '',
          jabatan_lain_1: data.jabatan_lain_1 || '',
          jabatan_lain_2: data.jabatan_lain_2 || '',
          jabatan_lain_3: data.jabatan_lain_3 || ''
        });
      } else {
        setJabatanForm({ jabatan_utama: '', jabatan_lain_1: '', jabatan_lain_2: '', jabatan_lain_3: '' });
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal memuat data jabatan.');
    }
  };

  const handleSaveJabatan = async () => {
    if (!selectedPegawai) return;
    if (!jabatanForm.jabatan_utama) {
      Alert.alert('Error', 'Jabatan Utama wajib dipilih!');
      return;
    }
    setSavingJabatan(true);
    try {
      const { data: existing } = await supabase
        .from('jabatan_guru')
        .select('id')
        .eq('guru_id', selectedPegawai.id)
        .maybeSingle();

      const payload = {
        guru_id: selectedPegawai.id,
        jabatan_utama: jabatanForm.jabatan_utama,
        jabatan_lain_1: jabatanForm.jabatan_lain_1 || null,
        jabatan_lain_2: jabatanForm.jabatan_lain_2 || null,
        jabatan_lain_3: jabatanForm.jabatan_lain_3 || null,
      };

      if (existing) {
        const { error } = await supabase.from('jabatan_guru').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('jabatan_guru').insert([payload]);
        if (error) throw error;
      }

      Alert.alert('Sukses', 'Data jabatan berhasil disimpan');
      setJabatanModalVisible(false);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message);
    } finally {
      setSavingJabatan(false);
    }
  };

  const handleWhatsApp = (phone: string | undefined) => {
    if (!phone) {
      Alert.alert('Info', 'Nomor WhatsApp tidak tersedia.');
      return;
    }
    let formattedPhone = phone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }
    const url = `whatsapp://send?phone=${formattedPhone}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Aplikasi WhatsApp tidak terinstal di perangkat ini.');
      }
    });
  };

  const renderItem = ({ item }: { item: Pegawai }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.cardLeft}>
        <UserCircle size={40} color="#9ca3af" />
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{item.nama}</Text>
          <Text style={styles.subText}>{item.status_pegawai || 'Status Belum Diatur'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Pegawai</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search color="#9ca3af" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama, NIK, status..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id!.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada data pegawai ditemukan.</Text>
            </View>
          }
        />
      )}

      {/* FAB Add Button */}
      <TouchableOpacity style={[styles.fab, { bottom: 128, backgroundColor: '#2a2c87' }]} onPress={() => setExportModalVisible(true)}>
        <Save color="#fff" size={24} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.fab} onPress={openAddForm}>
        <Plus color="#fff" size={28} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? (formData.id ? 'Edit Pegawai' : 'Tambah Pegawai') : 'Detail Pegawai'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#4b5563" size={24} />
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.inputLabel}>Nama Lengkap (dengan Gelar) *</Text>
                <TextInput style={styles.inputField} value={formData.nama} onChangeText={(t) => setFormData({ ...formData, nama: t })} placeholder="Cth: Budi Santoso, S.Pd" />

                <Text style={styles.inputLabel}>NIK *</Text>
                <TextInput style={styles.inputField} value={formData.nik} onChangeText={(t) => setFormData({ ...formData, nik: t })} keyboardType="numeric" placeholder="16 digit NIK" />

                <Text style={styles.inputLabel}>NIP (Jika Ada)</Text>
                <TextInput style={styles.inputField} value={formData.nip} onChangeText={(t) => setFormData({ ...formData, nip: t })} keyboardType="numeric" placeholder="-" />

                <Text style={styles.inputLabel}>NIY (Jika Ada)</Text>
                <TextInput style={styles.inputField} value={formData.niy} onChangeText={(t) => setFormData({ ...formData, niy: t })} keyboardType="numeric" placeholder="-" />

                <Text style={styles.inputLabel}>NUPTK (Jika Ada)</Text>
                <TextInput style={styles.inputField} value={formData.nuptk} onChangeText={(t) => setFormData({ ...formData, nuptk: t })} keyboardType="numeric" placeholder="-" />

                <Text style={styles.inputLabel}>Nomor WhatsApp *</Text>
                <TextInput style={styles.inputField} value={formData.no_wa} onChangeText={(t) => setFormData({ ...formData, no_wa: t })} keyboardType="phone-pad" placeholder="08xxxxxxxxxx" />

                <Text style={styles.inputLabel}>Tempat Lahir *</Text>
                <TextInput style={styles.inputField} value={formData.tempat_lahir} onChangeText={(t) => setFormData({ ...formData, tempat_lahir: t })} placeholder="Cth: Jakarta" />

                <Text style={styles.inputLabel}>Tanggal Lahir *</Text>
                <CustomDatePicker value={formData.tanggal_lahir || ''} onChange={(d) => setFormData({ ...formData, tanggal_lahir: d })} />

                <Text style={styles.inputLabel}>Nama Ibu Kandung *</Text>
                <TextInput style={styles.inputField} value={formData.nama_ibu} onChangeText={(t) => setFormData({ ...formData, nama_ibu: t })} placeholder="Cth: Siti Aminah" />

                <Text style={styles.inputLabel}>Agama</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={formData.agama} onValueChange={(itemValue) => setFormData({ ...formData, agama: itemValue })}>
                    <Picker.Item label="Islam" value="Islam" />
                    <Picker.Item label="Kristen" value="Kristen" />
                    <Picker.Item label="Katolik" value="Katolik" />
                    <Picker.Item label="Hindu" value="Hindu" />
                    <Picker.Item label="Buddha" value="Buddha" />
                    <Picker.Item label="Konghucu" value="Konghucu" />
                  </Picker>
                </View>

                <Text style={styles.inputLabel}>Status Perkawinan</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={formData.status_perkawinan} onValueChange={(itemValue) => setFormData({ ...formData, status_perkawinan: itemValue })}>
                    <Picker.Item label="Belum Kawin" value="Belum Kawin" />
                    <Picker.Item label="Kawin" value="Kawin" />
                    <Picker.Item label="Cerai Hidup" value="Cerai Hidup" />
                    <Picker.Item label="Cerai Mati" value="Cerai Mati" />
                  </Picker>
                </View>

                <Text style={styles.inputLabel}>Pendidikan Terakhir</Text>
                <TextInput style={styles.inputField} value={formData.pendidikan} onChangeText={(t) => setFormData({ ...formData, pendidikan: t })} placeholder="Cth: S1 Pendidikan Agama Islam" />

                <Text style={styles.inputLabel}>Alamat Lengkap</Text>
                <TextInput style={[styles.inputField, { height: 80 }]} value={formData.alamat} onChangeText={(t) => setFormData({ ...formData, alamat: t })} placeholder="Alamat domisili saat ini" multiline textAlignVertical="top" />

                <Text style={styles.inputLabel}>Status Pegawai</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={formData.status_pegawai} onValueChange={(itemValue) => setFormData({ ...formData, status_pegawai: itemValue })}>
                    <Picker.Item label="GTY/PTY" value="GTY/PTY" />
                    <Picker.Item label="GTT/PTT" value="GTT/PTT" />
                    <Picker.Item label="PNS" value="PNS" />
                    <Picker.Item label="PNS Depag" value="PNS Depag" />
                    <Picker.Item label="PNS Diperbantukan" value="PNS Diperbantukan" />
                    <Picker.Item label="Honor Daerah" value="Honor Daerah" />
                    <Picker.Item label="Tenaga Honor Sekolah" value="Tenaga Honor Sekolah" />
                  </Picker>
                </View>

                <Text style={styles.inputLabel}>Tanggal Masuk</Text>
                <CustomDatePicker value={formData.tanggal_masuk || ''} onChange={(d) => setFormData({ ...formData, tanggal_masuk: d })} />


                <TouchableOpacity
                  style={[styles.saveButton, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Save color="#fff" size={20} />
                      <Text style={styles.saveButtonText}>Simpan Data</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            ) : selectedPegawai ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.avatarContainer}>
                  <UserCircle size={80} color="#2a2c87" />
                  <Text style={styles.detailName}>{selectedPegawai.nama}</Text>
                  <Text style={styles.detailBadge}>{selectedPegawai.status_pegawai}</Text>
                </View>

                <View style={[styles.crudActionRow, { flexWrap: 'wrap' }]}>
                  <TouchableOpacity style={styles.crudEditButton} onPress={openEditForm}>
                    <Edit color="#2a2c87" size={18} />
                    <Text style={styles.crudEditBtnText}>Edit Data</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.crudEditButton, { backgroundColor: '#eef2ff' }]} onPress={handleOpenPembelajaran}>
                    <Book color="#4f46e5" size={18} />
                    <Text style={[styles.crudEditBtnText, { color: '#4f46e5' }]}>Pelajaran</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.crudEditButton, { backgroundColor: '#fffbeb' }]} onPress={handleOpenJabatan}>
                    <Briefcase color="#d97706" size={18} />
                    <Text style={[styles.crudEditBtnText, { color: '#d97706' }]}>Atur Jabatan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.crudDeactivateButton} onPress={handleDeactivate}>
                    <UserMinus color="#ef4444" size={18} />
                    <Text style={styles.crudDeactivateBtnText}>Nonaktifkan</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Informasi Pribadi</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>NIK</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.nik || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Tempat, Tgl Lahir</Text>
                    <Text style={styles.infoValue}>
                      {selectedPegawai.tempat_lahir || '-'}, {selectedPegawai.tanggal_lahir || '-'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Pendidikan</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.pendidikan || '-'}</Text>
                  </View>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Informasi Akademik</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>NUPTK</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.nuptk || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>NIP</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.nip || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>NIY</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.niy || '-'}</Text>
                  </View>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Kontak & Alamat</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Alamat</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.alamat || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>No. WhatsApp</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.no_wa || '-'}</Text>
                  </View>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Data Tambahan</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Nama Ibu Kandung</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.nama_ibu || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Agama</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.agama || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Status Perkawinan</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.status_perkawinan || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Tanggal Masuk</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.tanggal_masuk || '-'}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.waButton}
                  onPress={() => handleWhatsApp(selectedPegawai.no_wa)}
                >
                  <Phone color="#fff" size={20} />
                  <Text style={styles.waButtonText}>Hubungi via WhatsApp</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL PEMBELAJARAN */}
      <Modal visible={pembelajaranModalVisible} transparent={true} animationType="slide" onRequestClose={() => setPembelajaranModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Atur Pelajaran</Text>
              <TouchableOpacity onPress={() => setPembelajaranModalVisible(false)}><X color="#4b5563" size={24} /></TouchableOpacity>
            </View>
            <Text style={{ marginBottom: 16, color: '#6b7280' }}>
              Pilih kelas dan mata pelajaran yang diajar oleh {selectedPegawai?.nama}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {refKelas.map(k => {
                const isActive = !!pembelajaranSelection[k.id];
                return (
                  <View key={k.id} style={styles.kelasCard}>
                    <TouchableOpacity style={styles.kelasHeader} onPress={() => handleKelasToggle(k.id)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {isActive ? <CheckSquare color="#4f46e5" size={20} /> : <Square color="#9ca3af" size={20} />}
                        <Text style={[styles.kelasHeaderText, isActive && { color: '#4f46e5' }]}>{k.nama_kelas}</Text>
                      </View>
                    </TouchableOpacity>

                    {isActive && (
                      <View style={styles.mapelList}>
                        {refMapel.map(m => {
                          const isMapelActive = pembelajaranSelection[k.id]?.includes(m.id);
                          return (
                            <TouchableOpacity key={m.id} style={styles.mapelItem} onPress={() => handleMapelToggle(k.id, m.id)}>
                              {isMapelActive ? <CheckSquare color="#10b981" size={18} /> : <Square color="#d1d5db" size={18} />}
                              <Text style={[styles.mapelText, isMapelActive && { color: '#10b981', fontWeight: 'bold' }]}>{m.nama_mapel}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}

              <TouchableOpacity style={[styles.saveButton, savingPembelajaran && { opacity: 0.7 }]} onPress={handleSavePembelajaran} disabled={savingPembelajaran}>
                {savingPembelajaran ? <ActivityIndicator color="#fff" /> : (
                  <><Save color="#fff" size={20} /><Text style={styles.saveButtonText}>Simpan Pembelajaran</Text></>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL JABATAN */}
      <Modal visible={jabatanModalVisible} transparent={true} animationType="slide" onRequestClose={() => setJabatanModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Atur Jabatan</Text>
              <TouchableOpacity onPress={() => setJabatanModalVisible(false)}><X color="#4b5563" size={24} /></TouchableOpacity>
            </View>
            <Text style={{ marginBottom: 16, color: '#6b7280' }}>
              Pilih jabatan fungsional atau struktural untuk {selectedPegawai?.nama}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.inputLabel}>Jabatan Utama *</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={jabatanForm.jabatan_utama} onValueChange={(itemValue) => setJabatanForm({ ...jabatanForm, jabatan_utama: itemValue })}>
                  <Picker.Item label="-- Pilih Jabatan Utama --" value="" />
                  {refJabatan.map(j => <Picker.Item key={j.id} label={j.nama_jabatan} value={j.nama_jabatan} />)}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Jabatan Lain 1 (Opsional)</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={jabatanForm.jabatan_lain_1} onValueChange={(itemValue) => setJabatanForm({ ...jabatanForm, jabatan_lain_1: itemValue })}>
                  <Picker.Item label="-- (Kosong) --" value="" />
                  {refJabatan.map(j => <Picker.Item key={j.id} label={j.nama_jabatan} value={j.nama_jabatan} />)}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Jabatan Lain 2 (Opsional)</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={jabatanForm.jabatan_lain_2} onValueChange={(itemValue) => setJabatanForm({ ...jabatanForm, jabatan_lain_2: itemValue })}>
                  <Picker.Item label="-- (Kosong) --" value="" />
                  {refJabatan.map(j => <Picker.Item key={j.id} label={j.nama_jabatan} value={j.nama_jabatan} />)}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Jabatan Lain 3 (Opsional)</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={jabatanForm.jabatan_lain_3} onValueChange={(itemValue) => setJabatanForm({ ...jabatanForm, jabatan_lain_3: itemValue })}>
                  <Picker.Item label="-- (Kosong) --" value="" />
                  {refJabatan.map(j => <Picker.Item key={j.id} label={j.nama_jabatan} value={j.nama_jabatan} />)}
                </Picker>
              </View>

              <TouchableOpacity style={[styles.saveButton, savingJabatan && { opacity: 0.7 }]} onPress={handleSaveJabatan} disabled={savingJabatan}>
                {savingJabatan ? <ActivityIndicator color="#fff" /> : (
                  <><Save color="#fff" size={20} /><Text style={styles.saveButtonText}>Simpan Jabatan</Text></>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Export Options Modal */}
      <Modal visible={exportModalVisible} transparent animationType="fade" onRequestClose={() => setExportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Opsi Ekspor Pegawai</Text>
              <TouchableOpacity onPress={() => setExportModalVisible(false)}>
                <X color="#4b5563" size={24} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              Pilih kolom mana saja yang ingin Anda sertakan di dalam file CSV.
            </Text>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity
                style={{ backgroundColor: '#e0e7ff', padding: 8, borderRadius: 8, flex: 1, alignItems: 'center' }}
                onPress={() => setSelectedExportCols(EXPORT_COLUMNS_OPTIONS.map(c => c.id))}
              >
                <Text style={{ color: '#4f46e5', fontWeight: 'bold' }}>Pilih Semua</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: '#fee2e2', padding: 8, borderRadius: 8, flex: 1, alignItems: 'center' }}
                onPress={() => setSelectedExportCols([])}
              >
                <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Batal Pilih</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {EXPORT_COLUMNS_OPTIONS.map((col) => {
                const isSelected = selectedExportCols.includes(col.id);
                return (
                  <TouchableOpacity
                    key={col.id}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedExportCols(prev => prev.filter(id => id !== col.id));
                      } else {
                        setSelectedExportCols(prev => [...prev, col.id]);
                      }
                    }}
                  >
                    {isSelected ? <CheckSquare color="#10b981" size={20} /> : <Square color="#9ca3af" size={20} />}
                    <Text style={{ marginLeft: 12, fontSize: 15, color: '#374151' }}>{col.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, { marginTop: 24, backgroundColor: '#10b981' }]}
              onPress={handleExportExcel}
            >
              <Save color="#fff" size={20} />
              <Text style={styles.saveButtonText}>Ekspor Sekarang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  backButton: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  searchContainer: {
    backgroundColor: '#2a2c87', paddingHorizontal: 16, paddingBottom: 20,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24
  },
  searchBox: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 16, alignItems: 'center', height: 48
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: '#1f2937' },
  listContainer: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  textContainer: { marginLeft: 12, flex: 1 },
  nameText: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  subText: { fontSize: 14, color: '#6b7280' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9ca3af', textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 64, right: 24, backgroundColor: '#4f46e5',
    width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 6
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '90%', padding: 24
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  avatarContainer: { alignItems: 'center', marginBottom: 16 },
  detailName: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginTop: 12, textAlign: 'center' },
  detailBadge: { backgroundColor: '#dbeafe', color: '#2a2c87', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 14, fontWeight: '600', marginTop: 8 },
  crudActionRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24,
  },
  crudEditButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e7ff',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  crudEditBtnText: { color: '#2a2c87', fontWeight: 'bold', marginLeft: 6 },
  crudDeactivateButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  crudDeactivateBtnText: { color: '#ef4444', fontWeight: 'bold', marginLeft: 6 },
  infoGroup: { marginBottom: 24 },
  infoLabel: { fontSize: 16, fontWeight: 'bold', color: '#2a2c87', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoTitle: { fontSize: 14, color: '#6b7280', flex: 1 },
  infoValue: { fontSize: 14, color: '#1f2937', fontWeight: '500', flex: 2, textAlign: 'right' },
  waButton: { backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 12, marginBottom: 40 },
  waButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 6, marginTop: 12 },
  inputField: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f9fafb', color: '#1f2937' },
  pickerContainer: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, backgroundColor: '#f9fafb', overflow: 'hidden' },
  saveButton: { backgroundColor: '#2a2c87', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 32, marginBottom: 40 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  kelasCard: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  kelasHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  kelasHeaderText: { fontSize: 16, fontWeight: 'bold', color: '#4b5563', marginLeft: 12 },
  mapelList: { padding: 16, backgroundColor: '#f9fafb' },
  mapelItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  mapelText: { fontSize: 14, color: '#4b5563', marginLeft: 12 }
});
