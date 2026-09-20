import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { ChevronLeft, Search, Plus, Edit, Trash2, Tent, Users, User, X, Save, Filter } from 'lucide-react-native';
import { router } from 'expo-router';

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
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [deskripsiData, setDeskripsiData] = useState<Record<number, { predikat: string, deskripsi: string }>>({});
  const [initialCheckedIds, setInitialCheckedIds] = useState<Set<number>>(new Set());
  const [isSavingAnggota, setIsSavingAnggota] = useState(false);
  const [loadingAnggota, setLoadingAnggota] = useState(false);

  const fetchEkskul = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('data_ekskul').select('*').eq('tahun_ajaran', filterTA).eq('semester', filterSemester).order('nama_ekskul', { ascending: true });
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
    setIsAnggotaOpen(true);
    setLoadingAnggota(true);

    try {
      const { data: siswaData } = await supabase.from('data_siswa').select('id, nama, nipd, kelas').eq('status_keaktifan', 'Aktif').neq('kelas', 'Calon Siswa').order('nama', { ascending: true });
      setDataSiswa(siswaData || []);

      const { data: anggotaData } = await supabase.from('anggota_ekskul').select('id, siswa_id, predikat, deskripsi').eq('ekskul_id', item.id);
      
      const initChecked = new Set<number>();
      const initDeskripsi: Record<number, { predikat: string, deskripsi: string }> = {};
      
      anggotaData?.forEach(a => {
        initChecked.add(a.siswa_id);
        initDeskripsi[a.siswa_id] = { predikat: a.predikat || '', deskripsi: a.deskripsi || '' };
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
      return matchSearch && matchKelas;
    });
    setFilteredSiswa(filtered);
  }, [searchSiswa, filterKelas, dataSiswa]);

  const uniqueClasses = ['Semua', ...new Set(dataSiswa.map(item => item.kelas).filter(Boolean))].sort();

  const handleCheckSiswa = (id: number) => {
    const newChecked = new Set(checkedIds);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
      if (!deskripsiData[id]) {
        setDeskripsiData(prev => ({ ...prev, [id]: { predikat: '', deskripsi: '' } }));
      }
    }
    setCheckedIds(newChecked);
  };

  const handleDescChange = (id: number, field: 'predikat'|'deskripsi', val: string) => {
    setDeskripsiData(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: val }
    }));
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

      for (const sId of toAddOrUpdate) {
        const isNew = !initialCheckedIds.has(sId);
        const { predikat, deskripsi } = deskripsiData[sId] || { predikat: '', deskripsi: '' };
        const payload = {
          ekskul_id: selectedEkskul.id,
          siswa_id: sId,
          predikat,
          deskripsi
        };
        
        let err = null;
        if (isNew) {
          const { error } = await supabase.from('anggota_ekskul').insert([payload]);
          err = error;
        } else {
          const { error } = await supabase.from('anggota_ekskul').update(payload).eq('ekskul_id', selectedEkskul.id).eq('siswa_id', sId);
          err = error;
        }
        
        if (err) {
          console.error('Anggota save error:', err);
          throw err;
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


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
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
                <View style={styles.iconCircle}><Tent size={20} color="#2a2c87" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ekskulName}>{item.nama_ekskul}</Text>
                  <Text style={styles.ekskulPembina}>Pembina: {item.pembina_nama || '-'}</Text>
                </View>
                <View style={styles.badgeCount}>
                  <Users size={12} color="#059669" />
                  <Text style={styles.badgeCountText}>{item.jumlah_anggota || 0}</Text>
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
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Ekskul' : 'Tambah Ekskul'}</Text>
              <TouchableOpacity onPress={() => setIsFormOpen(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Nama Ekstrakurikuler *</Text>
                  <TextInput style={styles.inputModal} value={formData.nama_ekskul} onChangeText={t => setFormData({...formData, nama_ekskul: t})} placeholder="Cth: Pramuka, Futsal" />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Nama Pembina</Text>
                  <TextInput style={styles.inputModal} value={formData.pembina_nama} onChangeText={t => setFormData({...formData, pembina_nama: t})} placeholder="Nama Guru Pembina" />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.labelModal}>Hari</Text>
                    <TextInput style={styles.inputModal} value={formData.hari_pelaksanaan} onChangeText={t => setFormData({...formData, hari_pelaksanaan: t})} placeholder="Cth: Sabtu" />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.labelModal}>Jam</Text>
                    <TextInput style={styles.inputModal} value={formData.jam_pelaksanaan} onChangeText={t => setFormData({...formData, jam_pelaksanaan: t})} placeholder="Cth: 15.00" />
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
              <View>
                <Text style={styles.modalTitle}>Anggota & Nilai Ekskul</Text>
                <Text style={styles.modalSubtitle}>{selectedEkskul?.nama_ekskul} - {selectedEkskul?.semester}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAnggotaOpen(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>

            <View style={styles.searchSectionAnggota}>
              <View style={styles.searchBarAnggota}>
                <Search size={18} color="#9ca3af" />
                <TextInput style={styles.searchInput} placeholder="Cari nama siswa..." value={searchSiswa} onChangeText={setSearchSiswa} />
              </View>
              <View style={styles.pickerWrapperAnggota}>
                <Picker selectedValue={filterKelas} onValueChange={setFilterKelas} style={{ height: 40 }}>
                  {uniqueClasses.map(k => <Picker.Item key={k} label={k} value={k} />)}
                </Picker>
              </View>
            </View>

            <View style={styles.infoBar}>
              <Text style={styles.infoBarText}>Pilih siswa dan berikan Predikat/Deskripsi.</Text>
              <View style={styles.badgeInfo}><Text style={styles.badgeInfoText}>Terpilih: {checkedIds.size}</Text></View>
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
                        <Switch value={isChecked} onValueChange={() => handleCheckSiswa(siswa.id)} trackColor={{ true: '#10b981' }} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.siswaName}>{siswa.nama}</Text>
                          <Text style={styles.siswaDesc}>{siswa.kelas} • NIPD: {siswa.nipd}</Text>
                        </View>
                      </View>

                      {isChecked && (
                        <View style={styles.siswaInputs}>
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
                            placeholder="Deskripsi/Keterangan ekskul..." 
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

  cardActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  btnTrash: { backgroundColor: '#fef2f2', width: 44 },
  btnEdit: { backgroundColor: '#fffbeb', width: 44 },
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
  searchSectionAnggota: { flexDirection: 'row', padding: 16, gap: 8, backgroundColor: '#fff' },
  searchBarAnggota: { flex: 2, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput: { flex: 1, paddingVertical: 8, marginLeft: 8, fontSize: 14 },
  pickerWrapperAnggota: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, justifyContent: 'center' },
  
  infoBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#eef2ff' },
  infoBarText: { fontSize: 12, color: '#4f46e5', fontWeight: '500' },
  badgeInfo: { backgroundColor: '#c7d2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeInfoText: { fontSize: 11, color: '#312e81', fontWeight: 'bold' },

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
});
