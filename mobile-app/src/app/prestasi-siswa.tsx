import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Image, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { ChevronLeft, Search, Plus, Edit, Trash2, Trophy, Award, Target, User, Calendar, X, Save } from 'lucide-react-native';
import { router } from 'expo-router';

export default function PrestasiSiswa() {
  const [dataPrestasi, setDataPrestasi] = useState<any[]>([]);
  const [dataKelas, setDataKelas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form & Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tableName, setTableName] = useState('prestasi_siswa');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultTA = currentMonth >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const initialForm = {
    nipd: '', nama_siswa: '', kelas: '', nama_prestasi: '', jenis_prestasi: 'Akademik',
    tingkat: 'Sekolah', peringkat: 'Juara 1', tahun: currentYear.toString(),
    penyelenggara: '', keterangan: '', tahun_ajaran: defaultTA, semester: 'Ganjil'
  };
  
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let tName = 'prestasi_siswa';
      let { data, error } = await supabase.from(tName).select('*').order('created_at', { ascending: false });
      
      if (error) {
        tName = 'prestasi-siswa';
        const res2 = await supabase.from(tName).select('*').order('created_at', { ascending: false });
        if (res2.error) throw res2.error;
        data = res2.data;
      }
      setTableName(tName);
      setDataPrestasi(data || []);

      const { data: kls } = await supabase.from('data_kelas').select('*').order('nama_kelas', { ascending: true });
      if (kls) setDataKelas(kls);

    } catch (err) {
      Alert.alert('Error', 'Gagal memuat data prestasi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\prestasi-siswa.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchData();
  
    });

    return () => listener.remove();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const openAddModal = () => {
    setFormData(initialForm);
    setIsEditing(false);
    setSelectedId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setFormData({
      nipd: item.nipd || '', nama_siswa: item.nama_siswa || '', kelas: item.kelas || '',
      nama_prestasi: item.nama_prestasi || '', jenis_prestasi: item.jenis_prestasi || 'Akademik',
      tingkat: item.tingkat || 'Sekolah', peringkat: item.peringkat || 'Juara 1',
      tahun: item.tahun || currentYear.toString(), penyelenggara: item.penyelenggara || '',
      keterangan: item.keterangan || '', tahun_ajaran: item.tahun_ajaran || defaultTA, semester: item.semester || 'Ganjil'
    });
    setIsEditing(true);
    setSelectedId(item.id);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number, nama: string) => {
    Alert.alert('Hapus Prestasi?', `Hapus prestasi ${nama}?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
          setIsLoading(true);
          try {
            await supabase.from(tableName).delete().eq('id', id);
            fetchData();
          } catch (err) {
            Alert.alert('Error', 'Gagal menghapus data');
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  const handleSave = async () => {
    if (!formData.nipd || !formData.nama_siswa || !formData.nama_prestasi) {
      return Alert.alert('Error', 'NIPD, Nama Siswa, dan Nama Prestasi wajib diisi.');
    }

    setIsSaving(true);
    try {
      const payload = { ...formData, nama_siswa: formData.nama_siswa, nama_prestasi: formData.nama_prestasi }; // Proper case handling could be added here if needed

      if (isEditing) {
        await supabase.from(tableName).update(payload).eq('id', selectedId);
      } else {
        await supabase.from(tableName).insert([payload]);
      }
      
      Alert.alert('Berhasil', 'Data prestasi berhasil disimpan.');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan data prestasi');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredData = dataPrestasi.filter(item => 
    item.nama_siswa?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.nama_prestasi?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Prestasi Siswa</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola catatan prestasi akademik & non-akademik</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9ca3af" />
          <TextInput style={styles.searchInput} placeholder="Cari nama siswa atau prestasi..." value={searchQuery} onChangeText={setSearchQuery} />
        </View>
        <TouchableOpacity style={styles.btnAdd} onPress={openAddModal}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
        ) : filteredData.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada data prestasi ditemukan.</Text>
        ) : (
          filteredData.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  {item.foto_bukti ? (
                    <Image source={{ uri: item.foto_bukti }} style={styles.imgPreview} />
                  ) : (
                    <Trophy size={24} color="#d97706" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prestasiTitle}>{item.nama_prestasi}</Text>
                  <Text style={styles.studentName}>{item.nama_siswa} <Text style={{ color: '#9ca3af', fontWeight: 'normal' }}>({item.kelas || '-'})</Text></Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                <View style={styles.badge}><Award size={12} color="#059669" /><Text style={styles.badgeTextGreen}>{item.peringkat}</Text></View>
                <View style={[styles.badge, styles.badgeBlue]}><Target size={12} color="#2563eb" /><Text style={styles.badgeTextBlue}>{item.tingkat}</Text></View>
                <View style={[styles.badge, styles.badgePurple]}><Trophy size={12} color="#7c3aed" /><Text style={styles.badgeTextPurple}>{item.jenis_prestasi}</Text></View>
              </View>

              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Tahun:</Text><Text style={styles.infoValue}>{item.tahun}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Penyelenggara:</Text><Text style={styles.infoValue}>{item.penyelenggara || '-'}</Text></View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.actionBtn, styles.btnTrash]} onPress={() => handleDelete(item.id, item.nama_prestasi)}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnEdit]} onPress={() => openEditModal(item)}>
                  <Edit size={16} color="#2a2c87" />
                  <Text style={styles.btnEditText}>Edit Prestasi</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL ADD/EDIT */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Prestasi' : 'Tambah Prestasi Baru'}</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                
                <Text style={styles.sectionLabel}>Data Siswa</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.labelModal}>NIPD *</Text>
                    <TextInput style={styles.inputModal} value={formData.nipd} onChangeText={t => handleInputChange('nipd', t)} keyboardType="numeric" />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.labelModal}>Kelas</Text>
                    <View style={styles.pickerWrapperModal}>
                      <Picker selectedValue={formData.kelas} onValueChange={t => handleInputChange('kelas', t)}>
                        <Picker.Item label="-- Pilih --" value="" />
                        {dataKelas.map(k => <Picker.Item key={k.id} label={k.nama_kelas} value={k.nama_kelas} />)}
                      </Picker>
                    </View>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Nama Siswa *</Text>
                  <View style={styles.inputIconWrapper}>
                    <User size={18} color="#9ca3af" />
                    <TextInput style={styles.inputIcon} value={formData.nama_siswa} onChangeText={t => handleInputChange('nama_siswa', t)} />
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Data Prestasi</Text>
                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Nama Prestasi / Lomba *</Text>
                  <View style={styles.inputIconWrapper}>
                    <Trophy size={18} color="#9ca3af" />
                    <TextInput style={styles.inputIcon} value={formData.nama_prestasi} onChangeText={t => handleInputChange('nama_prestasi', t)} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.labelModal}>Jenis</Text>
                    <View style={styles.pickerWrapperModal}>
                      <Picker selectedValue={formData.jenis_prestasi} onValueChange={t => handleInputChange('jenis_prestasi', t)}>
                        <Picker.Item label="Akademik" value="Akademik" />
                        <Picker.Item label="Non-Akademik" value="Non-Akademik" />
                        <Picker.Item label="Keterampilan" value="Keterampilan" />
                      </Picker>
                    </View>
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.labelModal}>Peringkat</Text>
                    <View style={styles.pickerWrapperModal}>
                      <Picker selectedValue={formData.peringkat} onValueChange={t => handleInputChange('peringkat', t)}>
                        <Picker.Item label="Juara 1" value="Juara 1" />
                        <Picker.Item label="Juara 2" value="Juara 2" />
                        <Picker.Item label="Juara 3" value="Juara 3" />
                        <Picker.Item label="Juara Harapan" value="Juara Harapan" />
                        <Picker.Item label="Finalis" value="Finalis" />
                      </Picker>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.labelModal}>Tingkat</Text>
                    <View style={styles.pickerWrapperModal}>
                      <Picker selectedValue={formData.tingkat} onValueChange={t => handleInputChange('tingkat', t)}>
                        <Picker.Item label="Sekolah" value="Sekolah" />
                        <Picker.Item label="Kecamatan" value="Kecamatan" />
                        <Picker.Item label="Kab/Kota" value="Kabupaten/Kota" />
                        <Picker.Item label="Provinsi" value="Provinsi" />
                        <Picker.Item label="Nasional" value="Nasional" />
                        <Picker.Item label="Internasional" value="Internasional" />
                      </Picker>
                    </View>
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.labelModal}>Tahun</Text>
                    <TextInput style={styles.inputModal} value={formData.tahun} onChangeText={t => handleInputChange('tahun', t)} keyboardType="numeric" />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Penyelenggara</Text>
                  <TextInput style={styles.inputModal} value={formData.penyelenggara} onChangeText={t => handleInputChange('penyelenggara', t)} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Keterangan (Opsional)</Text>
                  <TextInput style={styles.textArea} value={formData.keterangan} onChangeText={t => handleInputChange('keterangan', t)} multiline numberOfLines={2} />
                </View>
                
                <View style={{ height: 40 }} />
              </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSaveModal} onPress={handleSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <><Save size={20} color="#fff" /><Text style={styles.btnSaveModalText}>Simpan Prestasi</Text></>}
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
  
  searchSection: { flexDirection: 'row', padding: 16, gap: 12 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  searchInput: { flex: 1, paddingVertical: 6, marginLeft: 8, fontSize: 14, color: '#1f2937' },
  btnAdd: { backgroundColor: '#10b981', width: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },

  content: { flex: 1, paddingHorizontal: 16 },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontStyle: 'italic' },
  
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  imgPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  prestasiTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#d1fae5' },
  badgeTextGreen: { color: '#059669', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  badgeBlue: { backgroundColor: '#dbeafe' },
  badgeTextBlue: { color: '#2563eb', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  badgePurple: { backgroundColor: '#f3e8ff' },
  badgeTextPurple: { color: '#7c3aed', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },

  infoRow: { flexDirection: 'row', backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 16 },
  infoLabel: { fontSize: 11, color: '#6b7280', fontWeight: 'bold', marginBottom: 2 },
  infoValue: { fontSize: 13, color: '#1f2937', fontWeight: '500' },

  cardActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  btnTrash: { backgroundColor: '#fef2f2', width: 48 },
  btnEdit: { flex: 1, backgroundColor: '#eef2ff' },
  btnEditText: { color: '#2a2c87', fontSize: 13, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  modalBody: { padding: 20 },
  
  sectionLabel: { fontSize: 13, fontWeight: 'bold', color: '#2a2c87', marginBottom: 16, marginTop: 8, textTransform: 'uppercase' },
  formGroup: { marginBottom: 16 },
  labelModal: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 8 },
  inputModal: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 14 },
  pickerWrapperModal: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  inputIconWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12 },
  inputIcon: { flex: 1, paddingVertical: 14, marginLeft: 8, fontSize: 14, color: '#1f2937' },
  textArea: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 14, textAlignVertical: 'top', minHeight: 80 },

  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  btnSaveModal: { backgroundColor: '#2a2c87', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnSaveModalText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
