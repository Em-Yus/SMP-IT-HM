import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Switch, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Target, Plus, Edit3, ChevronLeft, Trash2 } from 'lucide-react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

export default function TujuanPembelajaran() {
  const [dataTP, setDataTP] = useState<any[]>([]);
  const [dataMapel, setDataMapel] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  
  const [filterMapel, setFilterMapel] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterTahun, setFilterTahun] = useState(defaultTahun);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [formValues, setFormValues] = useState({ tujuan_pembelajaran: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMapel();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\tujuan-pembelajaran.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchMapel();
  
    });

    return () => listener.remove();
  }, []);

  const fetchMapel = async () => {
    try {
      const { data, error } = await supabase.from('data_mapel').select('id, nama_mapel').order('urutan', { ascending: true });
      if (error) throw error;
      setDataMapel(data || []);
      if (data && data.length > 0) setFilterMapel(data[0].id.toString());
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal memuat referensi mata pelajaran');
    }
  };

  const fetchTP = async () => {
    if (!filterMapel || !filterKelas || !filterSemester || !filterTahun) {
      Alert.alert('Perhatian', 'Silakan lengkapi pilihan filter (Mapel, Kelas, Semester, Tahun).');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tujuan_pembelajaran')
        .select(`*, data_mapel!inner(nama_mapel)`)
        .eq('id_mapel', filterMapel)
        .eq('id_kelas', filterKelas)
        .eq('semester', filterSemester)
        .eq('tahun_pelajaran', filterTahun)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setDataTP(data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal memuat data tujuan pembelajaran');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (item: any) => {
    try {
      const newStatus = !item.status;
      const { error } = await supabase.from('tujuan_pembelajaran').update({ status: newStatus }).eq('id', item.id);
      if (error) throw error;
      
      setDataTP(prev => prev.map(tp => tp.id === item.id ? { ...tp, status: newStatus } : tp));
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal merubah status');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Konfirmasi', 'Yakin ingin menghapus tujuan pembelajaran ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('tujuan_pembelajaran').delete().eq('id', id);
          if (error) throw error;
          fetchTP();
          Alert.alert('Berhasil', 'Data dihapus.');
        } catch (e) {
          Alert.alert('Error', 'Gagal menghapus data.');
        }
      }}
    ]);
  };

  const openAddModal = () => {
    if (!filterMapel || !filterKelas || !filterSemester || !filterTahun) {
      Alert.alert('Perhatian', 'Lengkapi semua filter terlebih dahulu.');
      return;
    }
    setEditingData(null);
    setFormValues({ tujuan_pembelajaran: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingData(item);
    setFormValues({ tujuan_pembelajaran: item.tujuan_pembelajaran });
    setIsModalOpen(true);
  };

  const saveTP = async () => {
    if (!formValues.tujuan_pembelajaran.trim()) {
      return Alert.alert('Peringatan', 'Tujuan pembelajaran tidak boleh kosong');
    }

    setIsSaving(true);
    try {
      const payload = {
        id_mapel: filterMapel,
        id_kelas: filterKelas,
        semester: filterSemester,
        tahun_pelajaran: filterTahun,
        tujuan_pembelajaran: formValues.tujuan_pembelajaran.trim()
      };

      if (editingData) {
        const { error } = await supabase.from('tujuan_pembelajaran').update(payload).eq('id', editingData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tujuan_pembelajaran').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      Alert.alert('Berhasil', 'Tujuan pembelajaran berhasil disimpan');
      fetchTP();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal menyimpan data');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Tujuan Pembelajaran</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola TP untuk penyusunan rapor dan bahan ajar.</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Filters */}
        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Mata Pelajaran</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={filterMapel} onValueChange={(v) => setFilterMapel(v)}>
              <Picker.Item label="Pilih Mata Pelajaran" value="" />
              {dataMapel.map(m => (
                <Picker.Item key={m.id} label={m.nama_mapel} value={m.id.toString()} />
              ))}
            </Picker>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Kelas</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={filterKelas} onValueChange={(v) => setFilterKelas(v)}>
                  <Picker.Item label="Pilih" value="" />
                  <Picker.Item label="VII" value="VII" />
                  <Picker.Item label="VIII" value="VIII" />
                  <Picker.Item label="IX" value="IX" />
                </Picker>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Semester</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={filterSemester} onValueChange={(v) => setFilterSemester(v)}>
                  <Picker.Item label="Pilih" value="" />
                  <Picker.Item label="Ganjil" value="Ganjil" />
                  <Picker.Item label="Genap" value="Genap" />
                </Picker>
              </View>
            </View>
          </View>

          <Text style={styles.filterLabel}>Tahun Pelajaran</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={filterTahun} onValueChange={(v) => setFilterTahun(v)}>
              <Picker.Item label={defaultTahun} value={defaultTahun} />
              <Picker.Item label={`${currentYear-2}/${currentYear-1}`} value={`${currentYear-2}/${currentYear-1}`} />
              <Picker.Item label={`${currentYear+1}/${currentYear+2}`} value={`${currentYear+1}/${currentYear+2}`} />
            </Picker>
          </View>

          <TouchableOpacity style={styles.btnFetch} onPress={fetchTP} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnFetchText}>Tampilkan Data TP</Text>}
          </TouchableOpacity>
        </View>

        {/* List Data */}
        <View style={styles.listContainer}>
          {dataTP.map((item, index) => (
            <View key={item.id} style={styles.tpCard}>
              <View style={styles.tpHeader}>
                <Text style={styles.tpIndex}>TP {index + 1}</Text>
                <View style={styles.tpActions}>
                  <Text style={{ fontSize: 12, color: item.status ? '#2EC4B6' : '#ADB5BD', marginRight: 8, fontWeight: 'bold' }}>{item.status ? 'Aktif' : 'Nonaktif'}</Text>
                  <Switch 
                    value={item.status} 
                    onValueChange={() => handleToggleStatus(item)}
                    trackColor={{ false: '#CBD5E1', true: '#2EC4B6' }}
                    thumbColor={item.status ? '#FFFFFF' : '#F8F9FA'}
                  />
                </View>
              </View>
              
              <Text style={styles.tpText}>{item.tujuan_pembelajaran}</Text>

              <View style={styles.tpFooter}>
                <TouchableOpacity style={styles.btnEdit} onPress={() => openEditModal(item)}>
                  <Edit3 size={16} color="#1E257F" />
                  <Text style={{ color: '#1E257F', marginLeft: 4, fontWeight: '600' }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnDelete} onPress={() => handleDelete(item.id)}>
                  <Trash2 size={16} color="#E63946" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {dataTP.length === 0 && !isLoading && (
            <Text style={{ textAlign: 'center', color: '#ADB5BD', marginTop: 20 }}>Belum ada Tujuan Pembelajaran yang ditambahkan.</Text>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Plus color="#fff" size={24} />
      </TouchableOpacity>

      {/* Form Modal */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingData ? 'Edit' : 'Tambah'} Tujuan Pembelajaran</Text>
            
            <Text style={styles.inputLabel}>Deskripsi TP</Text>
            <TextInput 
              style={styles.inputField}
              value={formValues.tujuan_pembelajaran}
              onChangeText={t => setFormValues({ tujuan_pembelajaran: t })}
              placeholder="Peserta didik mampu memahami..."
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.btnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={saveTP} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Simpan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { backgroundColor: '#1E257F', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { color: '#ECEEFF', fontSize: 13 },
  
  content: { flex: 1, padding: 16 },
  
  filterCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  filterLabel: { fontSize: 12, fontWeight: 'bold', color: '#6C757D', marginBottom: 4 },
  pickerWrapper: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  
  btnFetch: { backgroundColor: '#1E257F', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnFetchText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  listContainer: { paddingBottom: 80 },
  tpCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tpIndex: { fontSize: 12, fontWeight: 'bold', color: '#1E257F', backgroundColor: '#ECEEFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tpActions: { flexDirection: 'row', alignItems: 'center' },
  tpText: { fontSize: 15, color: '#1A1818', lineHeight: 22, marginBottom: 16 },
  tpFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, borderTopWidth: 1, borderTopColor: '#F8F9FA', paddingTop: 12 },
  btnEdit: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECEEFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnDelete: { backgroundColor: '#FDE8E9', padding: 6, borderRadius: 8 },

  fab: { position: 'absolute', right: 20, bottom: 48, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2a2c87', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1818', marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#6C757D', marginBottom: 8 },
  inputField: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16, fontSize: 15, color: '#1A1818', height: 120, textAlignVertical: 'top', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  btnCancel: { flex: 1, backgroundColor: '#F8F9FA', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnCancelText: { color: '#6C757D', fontSize: 15, fontWeight: 'bold' },
  btnSave: { flex: 1, backgroundColor: '#1E257F', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnSaveText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }
});
