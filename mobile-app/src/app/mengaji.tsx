import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { BookOpen, Plus, Edit3, Trash2, Users, ChevronLeft, X, Search, CheckCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

export default function KelasMengaji() {
  const [dataKelas, setDataKelas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [ruangList, setRuangList] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Anggota
  const [isAnggotaOpen, setIsAnggotaOpen] = useState(false);
  const [selectedKelas, setSelectedKelas] = useState<any>(null);
  const [dataSiswa, setDataSiswa] = useState<any[]>([]);
  const [searchSiswa, setSearchSiswa] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [isSavingAnggota, setIsSavingAnggota] = useState(false);

  useEffect(() => {
    fetchData();
    fetchRuang();

    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\mengaji.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchData();
      fetchRuang();

    });

    return () => listener.remove();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('data_kelas_mengaji').select('*, data_ruang(nama_ruang)').order('nama_kelas', { ascending: true });
      if (error) throw error;
      setDataKelas(data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Gagal mengambil data kelas mengaji');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRuang = async () => {
    const { data } = await supabase.from('data_ruang').select('id, nama_ruang').order('nama_ruang');
    if (data) setRuangList(data);
  };

  // --- CRUD KELAS ---
  const openAddForm = () => {
    setEditingData(null);
    setFormData({});
    setIsFormOpen(true);
  };

  const openEditForm = (item: any) => {
    setEditingData(item);
    setFormData({ ...item, tingkat: item.tingkat ? item.tingkat.toString() : '' });
    setIsFormOpen(true);
  };

  const handleDelete = (item: any) => {
    Alert.alert('Hapus Kelas?', `Anda yakin ingin menghapus kelas ${item.nama_kelas}? Data siswa di kelas ini mungkin perlu diperbarui.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('data_kelas_mengaji').delete().eq('id', item.id);
            if (error) throw error;
            Alert.alert('Berhasil', 'Kelas dihapus');
            fetchData();
          } catch (e: any) {
            Alert.alert('Error', `Gagal menghapus: ${e.message}`);
          }
        }
      }
    ]);
  };

  const saveForm = async () => {
    if (!formData.nama_kelas) return Alert.alert('Peringatan', 'Nama Kelas wajib diisi');

    setIsSaving(true);
    try {
      const payload = {
        nama_kelas: formData.nama_kelas,
        tingkat: formData.tingkat ? parseInt(formData.tingkat, 10) : null,
        guru_pengajar: formData.guru_pengajar || null,
        ruang_id: formData.ruang_id || null
      };

      if (editingData) {
        const { error } = await supabase.from('data_kelas_mengaji').update(payload).eq('id', editingData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('data_kelas_mengaji').insert([payload]);
        if (error) throw error;
      }

      setIsFormOpen(false);
      Alert.alert('Berhasil', 'Data kelas disimpan');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- ANGGOTA KELAS ---
  const openAnggota = async (kelas: any) => {
    setSelectedKelas(kelas);
    setSearchSiswa('');
    setIsAnggotaOpen(true);

    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('id, nama, nipd, kelas_mengaji, status_keaktifan')
        .eq('status_keaktifan', 'Aktif')
        .neq('kelas', 'Calon Siswa')
        .order('nama', { ascending: true });

      if (error) throw error;
      setDataSiswa(data || []);

      const initialChecked = new Set<number>();
      (data || []).forEach(s => {
        if (s.kelas_mengaji === kelas.nama_kelas) initialChecked.add(s.id);
      });
      setCheckedIds(initialChecked);
    } catch (e) {
      Alert.alert('Error', 'Gagal memuat data siswa');
    }
  };

  const toggleAnggota = (id: number) => {
    const newChecked = new Set(checkedIds);
    if (newChecked.has(id)) newChecked.delete(id);
    else newChecked.add(id);
    setCheckedIds(newChecked);
  };

  const saveAnggota = async () => {
    setIsSavingAnggota(true);
    try {
      const currentMembers = dataSiswa.filter(s => s.kelas_mengaji === selectedKelas.nama_kelas).map(s => s.id);
      const toAdd = Array.from(checkedIds).filter(id => !currentMembers.includes(id));
      const toRemove = currentMembers.filter(id => !checkedIds.has(id));

      const promises = [];
      if (toAdd.length > 0) promises.push(supabase.from('data_siswa').update({ kelas_mengaji: selectedKelas.nama_kelas }).in('id', toAdd));
      if (toRemove.length > 0) promises.push(supabase.from('data_siswa').update({ kelas_mengaji: null }).in('id', toRemove));

      await Promise.all(promises);

      Alert.alert('Berhasil', 'Anggota kelas diperbarui');
      setIsAnggotaOpen(false);
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan anggota kelas');
    } finally {
      setIsSavingAnggota(false);
    }
  };

  const filteredSiswa = dataSiswa
    .filter(s => s.nama.toLowerCase().includes(searchSiswa.toLowerCase()) || (s.nipd && s.nipd.includes(searchSiswa)))
    .sort((a, b) => {
      const aChecked = checkedIds.has(a.id) ? -1 : 1;
      const bChecked = checkedIds.has(b.id) ? -1 : 1;
      if (aChecked !== bChecked) return aChecked - bChecked;
      return a.nama.localeCompare(b.nama);
    });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Kelas Mengaji</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola rombongan belajar dan anggota.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
        ) : dataKelas.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>Belum ada kelas mengaji.</Text>
        ) : (
          dataKelas.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBox}><BookOpen size={20} color="#2a2c87" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.className}>{item.nama_kelas}</Text>
                  <Text style={styles.classSub}>Pengajar: {item.guru_pengajar || 'Belum diatur'}</Text>
                </View>
              </View>
              <View style={styles.cardDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Tingkat</Text>
                  <Text style={styles.detailValue}>{item.tingkat || '-'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Ruang</Text>
                  <Text style={styles.detailValue}>{item.data_ruang?.nama_ruang || '-'}</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.btnActionAnggota} onPress={() => openAnggota(item)}>
                  <Users size={16} color="#1e3a8a" />
                  <Text style={styles.btnActionAnggotaText}>Anggota</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnActionEdit} onPress={() => openEditForm(item)}>
                  <Edit3 size={16} color="#84D43F" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnActionDelete} onPress={() => handleDelete(item)}>
                  <Trash2 size={16} color="#1e3a8a" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB Tambah */}
      <TouchableOpacity style={styles.fab} onPress={openAddForm}>
        <Plus color="#fff" size={24} />
      </TouchableOpacity>

      {/* Form Modal (Kelas) */}
      <Modal visible={isFormOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingData ? 'Edit' : 'Tambah'} Kelas Mengaji</Text>
              <TouchableOpacity onPress={() => setIsFormOpen(false)}><X color="#6b7280" size={24} /></TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={styles.inputLabel}>Nama Kelas *</Text>
              <TextInput style={styles.inputField} value={formData.nama_kelas} onChangeText={t => setFormData({ ...formData, nama_kelas: t })} placeholder="Contoh: Tahsin A" />

              <Text style={styles.inputLabel}>Tingkat (Angka)</Text>
              <TextInput style={styles.inputField} value={formData.tingkat} onChangeText={t => setFormData({ ...formData, tingkat: t })} placeholder="Contoh: 1" keyboardType="numeric" />

              <Text style={styles.inputLabel}>Nama Guru Pengajar</Text>
              <TextInput style={styles.inputField} value={formData.guru_pengajar} onChangeText={t => setFormData({ ...formData, guru_pengajar: t })} placeholder="Contoh: Ustadz Ahmad" />

              <Text style={styles.inputLabel}>Ruang Kelas</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={formData.ruang_id} onValueChange={v => setFormData({ ...formData, ruang_id: v })}>
                  <Picker.Item label="-- Pilih Ruang --" value="" />
                  {ruangList.map(r => <Picker.Item key={r.id} label={r.nama_ruang} value={r.id} />)}
                </Picker>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSaveFull} onPress={saveForm} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveFullText}>Simpan Kelas</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Anggota */}
      <Modal visible={isAnggotaOpen} transparent animationType="slide">
        <View style={styles.modalOverlayFull}>
          <View style={styles.modalContentFull}>
            <View style={styles.modalHeaderFull}>
              <View>
                <Text style={styles.modalTitle}>Anggota Kelas</Text>
                <Text style={styles.modalSubtitle}>{selectedKelas?.nama_kelas}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAnggotaOpen(false)}><X color="#fff" size={24} /></TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Search color="#9ca3af" size={20} />
              <TextInput style={styles.searchInput} placeholder="Cari nama atau NIPD..." value={searchSiswa} onChangeText={setSearchSiswa} />
            </View>

            <ScrollView contentContainerStyle={styles.anggotaList}>
              {filteredSiswa.map(s => (
                <TouchableOpacity key={s.id} style={styles.anggotaCard} onPress={() => toggleAnggota(s.id)}>
                  <View style={[styles.checkbox, checkedIds.has(s.id) && styles.checkboxActive]}>
                    {checkedIds.has(s.id) && <CheckCircle color="#fff" size={16} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.anggotaName}>{s.nama}</Text>
                    <Text style={styles.anggotaSub}>{s.nipd} {s.kelas_mengaji ? `• Saat ini: ${s.kelas_mengaji}` : '• Belum ada kelas'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {filteredSiswa.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20, color: '#9ca3af' }}>Siswa tidak ditemukan.</Text>}
            </ScrollView>

            <View style={styles.modalFooterFull}>
              <Text style={{ color: '#4b5563', fontWeight: 'bold' }}>{checkedIds.size} dipilih</Text>
              <TouchableOpacity style={styles.btnSaveAnggota} onPress={saveAnggota} disabled={isSavingAnggota}>
                {isSavingAnggota ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveAnggotaText}>Simpan Anggota</Text>}
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

  listContainer: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  className: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  classSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  cardDetails: { flexDirection: 'row', backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 16 },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 11, color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase' },
  detailValue: { fontSize: 14, color: '#4b5563', fontWeight: '600', marginTop: 4 },

  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  btnActionAnggota: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff', paddingVertical: 8, borderRadius: 8 },
  btnActionAnggotaText: { color: '#4f46e5', fontWeight: 'bold', marginLeft: 6, fontSize: 13 },
  btnActionEdit: { backgroundColor: '#fef3c7', padding: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnActionDelete: { backgroundColor: '#fef2f2', padding: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  fab: { position: 'absolute', right: 20, bottom: 64, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },

  // Modal Normal (Form Kelas)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#4b5563', marginBottom: 8, marginTop: 12 },
  inputField: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 15, color: '#1f2937' },
  pickerWrapper: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  modalActions: { marginTop: 24 },
  btnSaveFull: { backgroundColor: '#2a2c87', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnSaveFullText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Modal Full (Anggota)
  modalOverlayFull: { flex: 1, backgroundColor: '#f3f4f6' },
  modalContentFull: { flex: 1 },
  modalHeaderFull: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalSubtitle: { color: '#a5b4fc', fontSize: 14, marginTop: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 15 },
  anggotaList: { paddingHorizontal: 16, paddingBottom: 20 },
  anggotaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db', marginRight: 16, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  anggotaName: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  anggotaSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  modalFooterFull: { backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btnSaveAnggota: { backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnSaveAnggotaText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});
