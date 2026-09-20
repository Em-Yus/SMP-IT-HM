import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, UserCircle, X, Plus, Edit, UserMinus, Save, Filter, CheckSquare, Square } from 'lucide-react-native';
import { router } from 'expo-router';
import CustomDatePicker from '../components/CustomDatePicker';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type Siswa = {
  id?: number;
  nama: string | undefined;
  kelas: string | undefined;
  nisn: string | undefined;
  nipd: string | undefined;
  nik: string | undefined;
  jenis_kelamin: string | undefined;
  tempat_lahir: string | undefined;
  tanggal_lahir: string | undefined;
  alamat_detail: string | undefined;
  rt: string | undefined;
  rw: string | undefined;
  desa: string | undefined;
  kecamatan: string | undefined;
  kabupaten: string | undefined;
  provinsi: string | undefined;
  angkatan: string | undefined;
  tahun_ajaran: string | undefined;
  tanggal_masuk: string | undefined;
  status_siswa: string | undefined;
  sekolah_asal: string | undefined;
  nama_ayah: string | undefined;
  nama_ibu: string | undefined;
  nama_wali: string | undefined;
  wa_ortu: string | undefined;
  wa_siswa: string | undefined;
  status_keaktifan: string | undefined;
  foto_url: string | undefined;
  tanggal_non_aktif: string | undefined;
};

const DEFAULT_FORM: Siswa = {
  id: 0,
  nama: '',
  kelas: '',
  nisn: '',
  nipd: '',
  nik: '',
  jenis_kelamin: 'L',
  tempat_lahir: '',
  tanggal_lahir: '',
  alamat_detail: '',
  rt: '',
  rw: '',
  desa: '',
  kecamatan: '',
  kabupaten: '',
  provinsi: '',
  angkatan: '',
  tahun_ajaran: '',
  tanggal_masuk: '',
  status_siswa: 'Baru',
  sekolah_asal: '',
  nama_ayah: '',
  nama_ibu: '',
  nama_wali: '',
  wa_ortu: '',
  wa_siswa: '',
  status_keaktifan: 'Aktif',
  foto_url: '',
  tanggal_non_aktif: '',
};

export default function DataSiswaAktif() {
  const [dataSiswa, setDataSiswa] = useState<Array<Siswa>>([]);
  const [filteredData, setFilteredData] = useState<Array<Siswa>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelasFilter, setSelectedKelasFilter] = useState('Semua');
  const [filterGender, setFilterGender] = useState('Semua');
  const [sortBy, setSortBy] = useState('nama-asc');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'ringkasan'>('data');
  
  const [selectedSiswa, setSelectedSiswa] = useState<Siswa | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Siswa>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const EXPORT_COLUMNS_OPTIONS = [
    { id: 'nama', label: 'Nama Lengkap' },
    { id: 'nipd', label: 'NIPD' },
    { id: 'nisn', label: 'NISN' },
    { id: 'nik', label: 'NIK' },
    { id: 'kelas', label: 'Kelas' },
    { id: 'jenis_kelamin', label: 'Jenis Kelamin' },
    { id: 'tempat_lahir', label: 'Tempat Lahir' },
    { id: 'tanggal_lahir', label: 'Tanggal Lahir' },
    { id: 'alamat_detail', label: 'Jalan/Dusun' },
    { id: 'rt_rw', label: 'RT/RW' },
    { id: 'desa', label: 'Desa/Kelurahan' },
    { id: 'kecamatan', label: 'Kecamatan' },
    { id: 'kabupaten', label: 'Kabupaten/Kota' },
    { id: 'provinsi', label: 'Provinsi' },
    { id: 'nama_ayah', label: 'Nama Ayah' },
    { id: 'nama_ibu', label: 'Nama Ibu' },
    { id: 'nama_wali', label: 'Nama Wali' },
    { id: 'wa_ortu', label: 'No WA Ortu' },
    { id: 'wa_siswa', label: 'No WA Siswa' },
    { id: 'sekolah_asal', label: 'Sekolah Asal' },
    { id: 'angkatan', label: 'Angkatan' },
    { id: 'tahun_ajaran', label: 'Tahun Ajaran' },
    { id: 'status_siswa', label: 'Status Siswa (Sifat)' },
    { id: 'tanggal_masuk', label: 'Tanggal Masuk' },
  ];
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const defaultSelectedCols = ['nama', 'nipd', 'nisn', 'kelas', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'alamat_detail', 'nama_ayah', 'nama_ibu', 'wa_ortu'];
  const [selectedExportCols, setSelectedExportCols] = useState<string[]>(defaultSelectedCols);

  useEffect(() => {
    fetchSiswa();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\data-siswa.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchSiswa();
  
    });

    return () => listener.remove();
  }, []);

  const fetchSiswa = async () => {
    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('status_keaktifan', 'Aktif')
        .neq('kelas', 'Calon Siswa')
        .order('kelas', { ascending: true })
        .order('nama', { ascending: true });

      if (error) throw error;
      if (data) {
        setDataSiswa(data);
      }
    } catch (err) {
      console.error('Error fetching data siswa:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedKelasFilter, filterGender, sortBy, dataSiswa]);

  const applyFilters = () => {
    let result = [...dataSiswa];

    if (searchQuery) {
      const keyword = searchQuery.toLowerCase();
      result = result.filter(s => 
        (s.nama || '').toLowerCase().includes(keyword) ||
        (s.nisn || '').toLowerCase().includes(keyword) ||
        (s.kelas || '').toLowerCase().includes(keyword)
      );
    }

    if (selectedKelasFilter && selectedKelasFilter !== 'Semua') {
      result = result.filter(s => s.kelas === selectedKelasFilter);
    }

    if (filterGender === 'Laki-laki') {
      result = result.filter(s => s.jenis_kelamin === 'L' || (s.jenis_kelamin || '').toLowerCase().includes('laki'));
    } else if (filterGender === 'Perempuan') {
      result = result.filter(s => s.jenis_kelamin === 'P' || (s.jenis_kelamin || '').toLowerCase().includes('perempuan'));
    }

    result.sort((a, b) => {
      if (sortBy === 'nama-asc') return (a.nama || '').localeCompare(b.nama || '');
      if (sortBy === 'nama-desc') return (b.nama || '').localeCompare(a.nama || '');
      if (sortBy === 'nipd-asc') return (a.nipd || '').localeCompare(b.nipd || '');
      if (sortBy === 'nipd-desc') return (b.nipd || '').localeCompare(a.nipd || '');
      if (sortBy === 'kelas-asc') return (a.kelas || '').localeCompare(b.kelas || '');
      if (sortBy === 'kelas-desc') return (b.kelas || '').localeCompare(a.kelas || '');
      return 0;
    });

    setFilteredData(result);
  };

  const handleExportExcel = async () => {
    try {
      if (!filteredData || filteredData.length === 0) {
        Alert.alert('Info', 'Tidak ada data siswa untuk diekspor sesuai filter saat ini.');
        return;
      }
      
      const exportData = filteredData.map((s, index) => {
        const row: any = { 'No': index + 1 };
        if (selectedExportCols.includes('nama')) row['Nama Lengkap'] = s.nama || '-';
        if (selectedExportCols.includes('nipd')) row['NIPD'] = s.nipd || '-';
        if (selectedExportCols.includes('nisn')) row['NISN'] = s.nisn || '-';
        if (selectedExportCols.includes('nik')) row['NIK'] = s.nik || '-';
        if (selectedExportCols.includes('kelas')) row['Kelas'] = s.kelas || '-';
        if (selectedExportCols.includes('jenis_kelamin')) row['Jenis Kelamin'] = s.jenis_kelamin || '-';
        if (selectedExportCols.includes('tempat_lahir')) row['Tempat Lahir'] = s.tempat_lahir || '-';
        if (selectedExportCols.includes('tanggal_lahir')) row['Tanggal Lahir'] = s.tanggal_lahir || '-';
        if (selectedExportCols.includes('alamat_detail')) row['Jalan/Dusun'] = s.alamat_detail || '-';
        if (selectedExportCols.includes('rt_rw')) row['RT/RW'] = `RT ${s.rt || '-'}/RW ${s.rw || '-'}`;
        if (selectedExportCols.includes('desa')) row['Desa/Kelurahan'] = s.desa || '-';
        if (selectedExportCols.includes('kecamatan')) row['Kecamatan'] = s.kecamatan || '-';
        if (selectedExportCols.includes('kabupaten')) row['Kabupaten/Kota'] = s.kabupaten || '-';
        if (selectedExportCols.includes('provinsi')) row['Provinsi'] = s.provinsi || '-';
        if (selectedExportCols.includes('nama_ayah')) row['Nama Ayah'] = s.nama_ayah || '-';
        if (selectedExportCols.includes('nama_ibu')) row['Nama Ibu'] = s.nama_ibu || '-';
        if (selectedExportCols.includes('nama_wali')) row['Nama Wali'] = s.nama_wali || '-';
        if (selectedExportCols.includes('wa_ortu')) row['No WA Ortu'] = s.wa_ortu || '-';
        if (selectedExportCols.includes('wa_siswa')) row['No WA Siswa'] = s.wa_siswa || '-';
        if (selectedExportCols.includes('sekolah_asal')) row['Sekolah Asal'] = s.sekolah_asal || '-';
        if (selectedExportCols.includes('angkatan')) row['Angkatan'] = s.angkatan || '-';
        if (selectedExportCols.includes('tahun_ajaran')) row['Tahun Ajaran'] = s.tahun_ajaran || '-';
        if (selectedExportCols.includes('status_siswa')) row['Status Siswa (Sifat)'] = s.status_siswa || '-';
        if (selectedExportCols.includes('tanggal_masuk')) row['Tanggal Masuk'] = s.tanggal_masuk || '-';
        return row;
      });

      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(obj => Object.values(obj).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
      const csvString = `${headers}\n${rows}`;
      const fileUri = FileSystem.cacheDirectory + `Data_Siswa_${new Date().getTime()}.csv`;
      
      await FileSystem.writeAsStringAsync(fileUri, csvString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Bagikan CSV Data Siswa',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Error', 'Fitur berbagi tidak tersedia di perangkat ini.');
      }
      setExportModalVisible(false);
    } catch (err: any) {
      console.error("Export error:", err);
      Alert.alert('Error', 'Gagal membuat file CSV: ' + err.message);
    }
  };

  const openDetail = (siswa: Siswa) => {
    setSelectedSiswa(siswa);
    setIsEditing(false);
    setModalVisible(true);
  };

  const openAddForm = () => {
    setSelectedSiswa(undefined);
    setFormData({ ...DEFAULT_FORM, id: 0 });
    setIsEditing(true);
    setModalVisible(true);
  };

  const openEditForm = () => {
    if (selectedSiswa) {
      setFormData(selectedSiswa);
      setIsEditing(true);
    }
  };

  const handleDeactivate = () => {
    if (!selectedSiswa) return;
    Alert.alert(
      "Nonaktifkan Siswa",
      `Yakin ingin menonaktifkan ${selectedSiswa.nama}? Siswa ini akan dipindahkan ke daftar Nonaktif.`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Ya, Nonaktifkan", 
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('data_siswa')
                .update({ status_keaktifan: 'Lulus/Keluar' })
                .eq('id', selectedSiswa.id);
              
              if (error) throw error;
              Alert.alert("Sukses", "Siswa berhasil dinonaktifkan.");
              setModalVisible(false);
              fetchSiswa();
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
    if (!formData.nama || !formData.nipd) {
      Alert.alert("Error", "Nama dan NIPD wajib diisi!");
      return;
    }
    
    setSaving(true);
    try {
      const payload = { ...formData };
      if (payload.id === 0) {
        delete payload.id;
      }
      
      if (formData.id && formData.id !== 0) {
        // Update
        const { error } = await supabase
          .from('data_siswa')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
        Alert.alert("Sukses", "Data siswa berhasil diperbarui!");
      } else {
        // Insert
        const { error } = await supabase
          .from('data_siswa')
          .insert([payload]);
        if (error) throw error;
        Alert.alert("Sukses", "Siswa baru berhasil ditambahkan!");
      }
      setModalVisible(false);
      fetchSiswa();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Siswa }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.cardLeft}>
        <UserCircle size={40} color="#9ca3af" />
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{item.nama}</Text>
          <Text style={styles.subText}>NISN: {item.nisn || '-'} | NIPD: {item.nipd || '-'}</Text>
        </View>
      </View>
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>{item.kelas}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedSiswa) return null;
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? (formData.id ? 'Edit Siswa' : 'Tambah Siswa') : 'Detail Siswa'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            {isEditing ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* A. IDENTITAS UTAMA */}
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2a2c87', marginTop: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4 }}>A. IDENTITAS UTAMA</Text>
                
                <Text style={styles.inputLabel}>Nama Lengkap *</Text>
                <TextInput style={styles.inputField} value={formData.nama} onChangeText={(t) => setFormData({...formData, nama: t})} placeholder="Cth: Budi Santoso" />
                
                <Text style={styles.inputLabel}>NIPD (Nomor Induk) *</Text>
                <TextInput style={styles.inputField} value={formData.nipd} onChangeText={(t) => setFormData({...formData, nipd: t})} keyboardType="numeric" />
                
                <Text style={styles.inputLabel}>NISN</Text>
                <TextInput style={styles.inputField} value={formData.nisn} onChangeText={(t) => setFormData({...formData, nisn: t})} keyboardType="numeric" />
                
                <Text style={styles.inputLabel}>NIK / No KTP Siswa</Text>
                <TextInput style={styles.inputField} value={formData.nik} onChangeText={(t) => setFormData({...formData, nik: t})} keyboardType="numeric" />
                
                <Text style={styles.inputLabel}>Jenis Kelamin (L/P)</Text>
                <TextInput style={styles.inputField} value={formData.jenis_kelamin} onChangeText={(t) => setFormData({...formData, jenis_kelamin: t})} maxLength={1} placeholder="L atau P" />
                
                <Text style={styles.inputLabel}>Tempat Lahir</Text>
                <TextInput style={styles.inputField} value={formData.tempat_lahir} onChangeText={(t) => setFormData({...formData, tempat_lahir: t})} placeholder="Cth: Bandung" />
                
                <CustomDatePicker 
                  label="Tanggal Lahir" 
                  value={formData.tanggal_lahir} 
                  onChange={(t) => setFormData({...formData, tanggal_lahir: t})} 
                />
                
                {/* B. ALAMAT LENGKAP */}
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2a2c87', marginTop: 24, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4 }}>B. ALAMAT LENGKAP</Text>
                
                <Text style={styles.inputLabel}>Jalan / Dusun</Text>
                <TextInput style={styles.inputField} value={formData.alamat_detail} onChangeText={(t) => setFormData({...formData, alamat_detail: t})} placeholder="Jl. Raya / Dusun..." />
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>RT</Text>
                    <TextInput style={styles.inputField} value={formData.rt} onChangeText={(t) => setFormData({...formData, rt: t})} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>RW</Text>
                    <TextInput style={styles.inputField} value={formData.rw} onChangeText={(t) => setFormData({...formData, rw: t})} keyboardType="numeric" />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Desa / Kelurahan</Text>
                <TextInput style={styles.inputField} value={formData.desa} onChangeText={(t) => setFormData({...formData, desa: t})} />
                
                <Text style={styles.inputLabel}>Kecamatan</Text>
                <TextInput style={styles.inputField} value={formData.kecamatan} onChangeText={(t) => setFormData({...formData, kecamatan: t})} />
                
                <Text style={styles.inputLabel}>Kabupaten / Kota</Text>
                <TextInput style={styles.inputField} value={formData.kabupaten} onChangeText={(t) => setFormData({...formData, kabupaten: t})} />
                
                <Text style={styles.inputLabel}>Provinsi</Text>
                <TextInput style={styles.inputField} value={formData.provinsi} onChangeText={(t) => setFormData({...formData, provinsi: t})} />

                {/* C. DATA AKADEMIK */}
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2a2c87', marginTop: 24, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4 }}>C. DATA AKADEMIK</Text>
                
                <Text style={styles.inputLabel}>Kelas</Text>
                <TextInput style={styles.inputField} value={formData.kelas} onChangeText={(t) => setFormData({...formData, kelas: t})} placeholder="Cth: 7A" />

                <Text style={styles.inputLabel}>Tahun Ajaran Masuk</Text>
                <TextInput style={styles.inputField} value={formData.tahun_ajaran} onChangeText={(t) => setFormData({...formData, tahun_ajaran: t})} placeholder="Cth: 2024/2025" />

                <Text style={styles.inputLabel}>Status Siswa</Text>
                <TextInput style={styles.inputField} value={formData.status_siswa} onChangeText={(t) => setFormData({...formData, status_siswa: t})} placeholder="Baru / Pindahan" />

                <Text style={styles.inputLabel}>Sekolah Asal</Text>
                <TextInput style={styles.inputField} value={formData.sekolah_asal} onChangeText={(t) => setFormData({...formData, sekolah_asal: t})} />

                {/* D. ORANG TUA / WALI */}
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2a2c87', marginTop: 24, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4 }}>D. ORANG TUA / WALI</Text>

                <Text style={styles.inputLabel}>Nama Ayah</Text>
                <TextInput style={styles.inputField} value={formData.nama_ayah} onChangeText={(t) => setFormData({...formData, nama_ayah: t})} />

                <Text style={styles.inputLabel}>Nama Ibu</Text>
                <TextInput style={styles.inputField} value={formData.nama_ibu} onChangeText={(t) => setFormData({...formData, nama_ibu: t})} />

                <Text style={styles.inputLabel}>Nama Wali (Jika Ada)</Text>
                <TextInput style={styles.inputField} value={formData.nama_wali} onChangeText={(t) => setFormData({...formData, nama_wali: t})} />

                <Text style={styles.inputLabel}>No. WhatsApp Ortu</Text>
                <TextInput style={styles.inputField} value={formData.wa_ortu} onChangeText={(t) => setFormData({...formData, wa_ortu: t})} keyboardType="phone-pad" placeholder="Misal: 62812..." />
                
                {/* E. KONTAK SISWA & STATUS */}
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2a2c87', marginTop: 24, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4 }}>E. LAIN-LAIN</Text>

                <Text style={styles.inputLabel}>No. WhatsApp Siswa</Text>
                <TextInput style={styles.inputField} value={formData.wa_siswa} onChangeText={(t) => setFormData({...formData, wa_siswa: t})} keyboardType="phone-pad" placeholder="Misal: 62812..." />

                <Text style={styles.inputLabel}>Status Keaktifan</Text>
                <TextInput style={styles.inputField} value={formData.status_keaktifan} onChangeText={(t) => setFormData({...formData, status_keaktifan: t})} placeholder="Aktif / Lulus / Pindah / Keluar" />

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
            ) : selectedSiswa ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                {/* Aksi CRUD */}
                <View style={styles.crudActionRow}>
                  <TouchableOpacity style={styles.crudEditButton} onPress={openEditForm}>
                    <Edit color="#2a2c87" size={18} />
                    <Text style={styles.crudEditBtnText}>Edit Data</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.crudDeactivateButton} onPress={handleDeactivate}>
                    <UserMinus color="#ef4444" size={18} />
                    <Text style={styles.crudDeactivateBtnText}>Nonaktifkan</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nama Lengkap</Text>
                  <Text style={styles.detailValue}>{selectedSiswa.nama || '-'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>NISN / NIPD</Text>
                  <Text style={styles.detailValue}>{selectedSiswa.nisn || '-'} / {selectedSiswa.nipd || '-'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Kelas</Text>
                  <Text style={styles.detailValue}>{selectedSiswa.kelas || '-'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Jenis Kelamin</Text>
                  <Text style={styles.detailValue}>{selectedSiswa.jenis_kelamin === 'L' ? 'Laki-laki' : selectedSiswa.jenis_kelamin === 'P' ? 'Perempuan' : selectedSiswa.jenis_kelamin || '-'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tempat, Tgl Lahir</Text>
                  <Text style={styles.detailValue}>{selectedSiswa.tempat_lahir || '-'}, {selectedSiswa.tanggal_lahir || '-'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>No. WhatsApp</Text>
                  <Text style={styles.detailValue}>{selectedSiswa.wa_siswa || '-'}</Text>
                </View>
              </ScrollView>
            ) : null}
            
            {!isEditing && (
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButtonText}>Tutup</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Data Siswa Aktif</Text>
        </View>
      </View>
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'data' && styles.tabBtnActive]} onPress={() => setActiveTab('data')}>
          <Text style={[styles.tabText, activeTab === 'data' && styles.tabTextActive]}>Data Siswa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'ringkasan' && styles.tabBtnActive]} onPress={() => setActiveTab('ringkasan')}>
          <Text style={[styles.tabText, activeTab === 'ringkasan' && styles.tabTextActive]}>Ringkasan</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'data' ? (
        <>
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Search size={20} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama, NISN, atau kelas..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterBtn}>
                <Filter size={20} color="#2a2c87" />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2a2c87" />
            </View>
          ) : (
            <FlatList
              data={filteredData}
              keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Tidak ada data siswa aktif yang ditemukan.</Text>
                </View>
              }
            />
          )}
          
          <TouchableOpacity style={[styles.fab, { bottom: 120, backgroundColor: '#10b981' }]} onPress={() => setExportModalVisible(true)}>
            <Save color="#fff" size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={openAddForm}>
            <Plus color="#fff" size={28} />
          </TouchableOpacity>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.ringkasanContainer}>
          <View style={styles.ringkasanCardTotal}>
            <Text style={styles.ringkasanLabelTotal}>Total Siswa Aktif</Text>
            <Text style={styles.ringkasanValueTotal}>{dataSiswa.length}</Text>
          </View>
          
          <Text style={styles.ringkasanSectionTitle}>Berdasarkan Kelas</Text>
          <View style={styles.ringkasanGrid}>
            {Object.entries(
              dataSiswa.reduce((acc, curr) => {
                const kelas = curr.kelas || 'Belum Ada Kelas';
                acc[kelas] = (acc[kelas] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            )
            .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
            .map(([kelas, count]) => (
              <View key={kelas} style={styles.ringkasanBox}>
                <Text style={styles.ringkasanBoxLabel}>Kelas {kelas}</Text>
                <Text style={styles.ringkasanBoxValue}>{count}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      
      {renderDetailModal()}

      {/* Modal Filter */}
      <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter & Urutkan</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <X color="#4b5563" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Kelas</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={selectedKelasFilter} onValueChange={(itemValue) => setSelectedKelasFilter(itemValue)} style={{ height: 50, color: '#1f2937' }}>
                  <Picker.Item label="Semua Kelas" value="Semua" />
                  {Array.from(new Set(dataSiswa.map(s => s.kelas).filter(Boolean))).sort().map(kelas => (
                    <Picker.Item key={kelas} label={`Kelas ${kelas}`} value={kelas} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Jenis Kelamin</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={filterGender} onValueChange={(itemValue) => setFilterGender(itemValue)} style={{ height: 50, color: '#1f2937' }}>
                  <Picker.Item label="Semua Kelamin" value="Semua" />
                  <Picker.Item label="Laki-laki" value="Laki-laki" />
                  <Picker.Item label="Perempuan" value="Perempuan" />
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Urutkan Berdasarkan</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={sortBy} onValueChange={(itemValue) => setSortBy(itemValue)} style={{ height: 50, color: '#1f2937' }}>
                  <Picker.Item label="Nama (A-Z)" value="nama-asc" />
                  <Picker.Item label="Nama (Z-A)" value="nama-desc" />
                  <Picker.Item label="NIPD (Kecil-Besar)" value="nipd-asc" />
                  <Picker.Item label="NIPD (Besar-Kecil)" value="nipd-desc" />
                  <Picker.Item label="Kelas (A-Z)" value="kelas-asc" />
                  <Picker.Item label="Kelas (Z-A)" value="kelas-desc" />
                </Picker>
              </View>
              <TouchableOpacity style={[styles.closeButton, { marginTop: 24 }]} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.closeButtonText}>Terapkan Filter</Text>
              </TouchableOpacity>
              <View style={{height: 20}} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export Options Modal */}
      <Modal visible={exportModalVisible} transparent animationType="fade" onRequestClose={() => setExportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Opsi Ekspor Siswa</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#2a2c87',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBack: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  badgeContainer: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  badgeText: {
    color: '#4338ca',
    fontSize: 12,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalBody: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4b5563',
  },
  detailValue: {
    flex: 2,
    fontSize: 14,
    color: '#1f2937',
  },
  closeButton: {
    backgroundColor: '#2a2c87',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 48,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2a2c87',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  crudActionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
    marginTop: 10,
  },
  crudEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  crudEditBtnText: {
    color: '#2a2c87',
    fontWeight: 'bold',
    fontSize: 14,
  },
  crudDeactivateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  crudDeactivateBtnText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 14,
  },
  inputLabel: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 12,
  },
  inputField: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1f2937',
  },
  pickerContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden'
  },
  filterBtn: {
    padding: 8,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    marginLeft: 8
  },
  saveButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2c87',
    paddingHorizontal: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#daffcc',
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#daffcc',
    fontWeight: 'bold',
  },
  ringkasanContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  ringkasanCardTotal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981'
  },
  ringkasanLabelTotal: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ringkasanValueTotal: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  ringkasanSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  ringkasanGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ringkasanBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  ringkasanBoxLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  ringkasanBoxValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
  }
});
