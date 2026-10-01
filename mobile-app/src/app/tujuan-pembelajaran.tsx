import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  Switch, 
  DeviceEventEmitter, 
  ToastAndroid 
} from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Target, Plus, Edit3, ChevronLeft, Trash2, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TujuanPembelajaran() {
  const [dataTP, setDataTP] = useState<any[]>([]);
  const [dataMapel, setDataMapel] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const defaultTahun = currentMonth >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  const defaultSemester = (currentMonth >= 6 && currentMonth <= 11) ? 'Ganjil' : 'Genap';
  
  const [filterMapel, setFilterMapel] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterSemester, setFilterSemester] = useState(defaultSemester);
  const [filterTahun, setFilterTahun] = useState(defaultTahun);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [formValues, setFormValues] = useState({ tujuan_pembelajaran: '' });
  const [isSaving, setIsSaving] = useState(false);

  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20) + 16;

  useEffect(() => {
    fetchMapel();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in src/app/tujuan-pembelajaran.tsx');
      if (Platform.OS === 'android') { 
        ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); 
      }
      fetchMapel();
    });

    return () => listener.remove();
  }, []);

  const fetchMapel = async () => {
    try {
      const { data, error } = await supabase.from('data_mapel').select('id, nama_mapel').order('urutan', { ascending: true });
      if (error) throw error;
      setDataMapel(data || []);
      if (data && data.length > 0 && !filterMapel) {
        setFilterMapel(data[0].id.toString());
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal memuat referensi mata pelajaran');
    }
  };

  const fetchTP = async () => {
    if (!filterMapel || !filterKelas || !filterSemester || !filterTahun) {
      Alert.alert('Perhatian', 'Silakan lengkapi pilihan filter (Mata Pelajaran, Tingkat, Semester, dan Tahun Pelajaran).');
      return;
    }

    setIsLoading(true);
    try {
      // Mendukung pencarian id_kelas dalam format angka (7, 8, 9) maupun romawi (VII, VIII, IX)
      const kelasValues = filterKelas === '7' ? ['7', 'VII'] :
                          filterKelas === '8' ? ['8', 'VIII'] :
                          filterKelas === '9' ? ['9', 'IX'] : [filterKelas];

      const { data, error } = await supabase
        .from('tujuan_pembelajaran')
        .select('*')
        .eq('id_mapel', Number(filterMapel))
        .in('id_kelas', kelasValues)
        .eq('semester', filterSemester)
        .eq('tahun_pelajaran', filterTahun)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setDataTP(data || []);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', `Gagal memuat data tujuan pembelajaran: ${e.message || 'Terjadi kesalahan'}`);
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
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Gagal menghapus data');
        }
      }}
    ]);
  };

  const openAddModal = () => {
    if (!filterMapel || !filterKelas || !filterSemester || !filterTahun) {
      Alert.alert('Perhatian', 'Silakan pilih Mata Pelajaran, Tingkat, Semester, dan Tahun Pelajaran terlebih dahulu.');
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
      const payload: any = {
        id_mapel: Number(filterMapel),
        id_kelas: filterKelas, // Disimpan sebagai tingkat: '7', '8', atau '9'
        semester: filterSemester,
        tahun_pelajaran: filterTahun,
        tujuan_pembelajaran: formValues.tujuan_pembelajaran.trim()
      };

      if (editingData) {
        const { error } = await supabase.from('tujuan_pembelajaran').update(payload).eq('id', editingData.id);
        if (error) throw error;
      } else {
        payload.status = true;
        const { error } = await supabase.from('tujuan_pembelajaran').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      Alert.alert('Berhasil', 'Tujuan pembelajaran berhasil disimpan');
      fetchTP();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', `Gagal menyimpan data: ${e.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tujuan Pembelajaran</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola TP untuk penyusunan rapor dan bahan ajar.</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Filters */}
        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Mata Pelajaran</Text>
          <View style={styles.pickerWrapper}>
            <Picker 
              selectedValue={filterMapel} 
              onValueChange={(v) => { setFilterMapel(v); setDataTP([]); }}
            >
              <Picker.Item label="-- Pilih Mata Pelajaran --" value="" />
              {dataMapel.map(m => (
                <Picker.Item key={m.id} label={m.nama_mapel} value={m.id.toString()} />
              ))}
            </Picker>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Filter Tingkat (Menggantikan Kelas) */}
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Tingkat</Text>
              <View style={styles.pickerWrapper}>
                <Picker 
                  selectedValue={filterKelas} 
                  onValueChange={(v) => { setFilterKelas(v); setDataTP([]); }}
                >
                  <Picker.Item label="Pilih Tingkat" value="" />
                  <Picker.Item label="Tingkat 7" value="7" />
                  <Picker.Item label="Tingkat 8" value="8" />
                  <Picker.Item label="Tingkat 9" value="9" />
                </Picker>
              </View>
            </View>

            {/* Filter Semester */}
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Semester</Text>
              <View style={styles.pickerWrapper}>
                <Picker 
                  selectedValue={filterSemester} 
                  onValueChange={(v) => { setFilterSemester(v); setDataTP([]); }}
                >
                  <Picker.Item label="Pilih Semester" value="" />
                  <Picker.Item label="Ganjil" value="Ganjil" />
                  <Picker.Item label="Genap" value="Genap" />
                </Picker>
              </View>
            </View>
          </View>

          <Text style={styles.filterLabel}>Tahun Pelajaran</Text>
          <View style={styles.pickerWrapper}>
            <Picker 
              selectedValue={filterTahun} 
              onValueChange={(v) => { setFilterTahun(v); setDataTP([]); }}
            >
              <Picker.Item label={`${currentYear-1}/${currentYear}`} value={`${currentYear-1}/${currentYear}`} />
              <Picker.Item label={`${currentYear}/${currentYear+1}`} value={`${currentYear}/${currentYear+1}`} />
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
                  <Text style={{ fontSize: 12, color: item.status ? '#2EC4B6' : '#ADB5BD', marginRight: 8, fontWeight: 'bold' }}>
                    {item.status ? 'Aktif' : 'Nonaktif'}
                  </Text>
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
            <Text style={{ textAlign: 'center', color: '#ADB5BD', marginTop: 20 }}>
              Belum ada Tujuan Pembelajaran yang ditambahkan.
            </Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB - Elevated safely above navigation bar */}
      <TouchableOpacity style={[styles.fab, { bottom: fabBottom }]} onPress={openAddModal} activeOpacity={0.85}>
        <Plus color="#fff" size={24} />
      </TouchableOpacity>

      {/* Form Modal (Popup Ditengah Layar) */}
      <Modal 
        visible={isModalOpen} 
        transparent 
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlayCenter}
        >
          <View style={styles.modalCardCenter}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {editingData ? 'Edit' : 'Tambah'} Tujuan Pembelajaran
                </Text>
                <Text style={styles.modalSubtitle}>
                  Tingkat {filterKelas} • Semester {filterSemester}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X color="#6C757D" size={20} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Deskripsi Tujuan Pembelajaran *</Text>
            <TextInput 
              style={styles.inputField}
              value={formValues.tujuan_pembelajaran}
              onChangeText={t => setFormValues({ tujuan_pembelajaran: t })}
              placeholder="Contoh: Peserta didik mampu memahami dan menerapkan..."
              placeholderTextColor="#ADB5BD"
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.btnCancel} 
                onPress={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                <Text style={styles.btnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.btnSave} 
                onPress={saveTP} 
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnSaveText}>
                    {editingData ? 'Simpan Perubahan' : 'Tambah TP'}
                  </Text>
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { backgroundColor: '#1E257F', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { color: '#ECEEFF', fontSize: 13 },
  
  content: { flex: 1, padding: 16 },
  
  filterCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  filterLabel: { fontSize: 12, fontWeight: 'bold', color: '#6C757D', marginBottom: 4 },
  pickerWrapper: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  
  btnFetch: { backgroundColor: '#1E257F', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnFetchText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  listContainer: { paddingBottom: 80 },
  tpCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tpIndex: { fontSize: 12, fontWeight: 'bold', color: '#1E257F', backgroundColor: '#ECEEFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tpActions: { flexDirection: 'row', alignItems: 'center' },
  tpText: { fontSize: 15, color: '#1A1818', lineHeight: 22, marginBottom: 16 },
  tpFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, borderTopWidth: 1, borderTopColor: '#F8F9FA', paddingTop: 12 },
  btnEdit: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECEEFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  btnDelete: { backgroundColor: '#FDE8E9', padding: 6, borderRadius: 8 },

  fab: { 
    position: 'absolute', 
    right: 20, 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#1E257F', 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#1E257F', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.35, 
    shadowRadius: 6, 
    elevation: 6 
  },

  modalOverlayCenter: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.55)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  modalCardCenter: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 22, 
    width: '100%', 
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 8,
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#1A1818' 
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
  },
  inputLabel: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    color: '#1A1818', 
    marginBottom: 8 
  },
  inputField: { 
    backgroundColor: '#F8F9FA', 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    borderRadius: 12, 
    padding: 14, 
    fontSize: 14, 
    color: '#1A1818', 
    minHeight: 110, 
    textAlignVertical: 'top', 
    marginBottom: 20 
  },
  modalActions: { 
    flexDirection: 'row', 
    gap: 12 
  },
  btnCancel: { 
    flex: 1, 
    backgroundColor: '#F1F3F5', 
    paddingVertical: 13, 
    borderRadius: 12, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: { 
    color: '#6C757D', 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  btnSave: { 
    flex: 1.3, 
    backgroundColor: '#1E257F', 
    paddingVertical: 13, 
    borderRadius: 12, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSaveText: { 
    color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: 'bold' 
  }
});
