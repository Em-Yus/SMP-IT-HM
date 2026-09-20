import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { ChevronLeft, Search, Plus, Edit, Trash2, BookOpen, Users, User, X, Save, Filter } from 'lucide-react-native';
import { router } from 'expo-router';

export default function Kokurikuler() {
  const [dataKokurikuler, setDataKokurikuler] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const initialTA = currentMonth >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  const initialSem = currentMonth >= 7 ? 'Ganjil' : 'Genap';
  const [filterTA, setFilterTA] = useState(initialTA);
  const [filterSemester, setFilterSemester] = useState(initialSem);
  const [availableTA, setAvailableTA] = useState([initialTA]);

  // Form Modal Kokurikuler
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProjek, setSelectedProjek] = useState<any>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [formData, setFormData] = useState({ nama_projek: '', tema: 'Gaya Hidup Berkelanjutan', koordinator_nama: '', deskripsi_projek: '' });

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

  const fetchKokurikuler = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('data_kokurikuler').select('*').eq('tahun_ajaran', filterTA).eq('semester', filterSemester).order('nama_projek', { ascending: true });
      if (error) throw error;
      
      const projekList = data || [];
      if (projekList.length > 0) {
        const projekIds = projekList.map(p => p.id);
        const { data: anggota } = await supabase.from('anggota_kokurikuler').select('kokurikuler_id').in('kokurikuler_id', projekIds);
        
        if (anggota) {
          const counts: any = {};
          anggota.forEach(a => counts[a.kokurikuler_id] = (counts[a.kokurikuler_id] || 0) + 1);
          projekList.forEach(p => p.jumlah_anggota = counts[p.id] || 0);
        }
      }
      setDataKokurikuler(projekList);

      const { data: taData } = await supabase.from('data_kokurikuler').select('tahun_ajaran');
      if (taData) {
        const uniqueTA = [...new Set(taData.map(item => item.tahun_ajaran).filter(Boolean))].sort().reverse();
        if (!uniqueTA.includes(initialTA)) uniqueTA.unshift(initialTA);
        setAvailableTA(uniqueTA);
      }
    } catch (err) {
      Alert.alert('Error', 'Gagal memuat data projek P5');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKokurikuler();
  }, [filterTA, filterSemester]);

  // --- KOKURIKULER CRUD ---
  const handleAdd = () => {
    setFormData({ nama_projek: '', tema: 'Gaya Hidup Berkelanjutan', koordinator_nama: '', deskripsi_projek: '' });
    setIsEditing(false);
    setSelectedProjek(null);
    setIsFormOpen(true);
  };

  const handleEdit = (item: any) => {
    setFormData({
      nama_projek: item.nama_projek || '', tema: item.tema || 'Gaya Hidup Berkelanjutan',
      koordinator_nama: item.koordinator_nama || '', deskripsi_projek: item.deskripsi_projek || ''
    });
    setIsEditing(true);
    setSelectedProjek(item);
    setIsFormOpen(true);
  };

  const handleDelete = (id: number, nama: string) => {
    Alert.alert('Hapus Projek?', `Menghapus projek "${nama}" juga akan menghapus data penilaian P5 anggotanya.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
          setIsLoading(true);
          try {
            await supabase.from('data_kokurikuler').delete().eq('id', id);
            fetchKokurikuler();
          } catch (err) {
            Alert.alert('Error', 'Gagal menghapus projek');
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  const saveKokurikuler = async () => {
    if (!formData.nama_projek) return Alert.alert('Peringatan', 'Nama Projek wajib diisi');
    setIsSavingForm(true);
    try {
      const payload = {
        ...formData,
        tahun_ajaran: selectedProjek ? selectedProjek.tahun_ajaran : filterTA,
        semester: selectedProjek ? selectedProjek.semester : filterSemester
      };

      if (isEditing) {
        await supabase.from('data_kokurikuler').update(payload).eq('id', selectedProjek.id);
      } else {
        await supabase.from('data_kokurikuler').insert([payload]);
      }
      
      Alert.alert('Berhasil', 'Data projek P5 disimpan.');
      setIsFormOpen(false);
      fetchKokurikuler();
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan projek');
    } finally {
      setIsSavingForm(false);
    }
  };

  // --- ANGGOTA CRUD ---
  const handleAnggota = async (item: any) => {
    setSelectedProjek(item);
    setSearchSiswa('');
    setFilterKelas('Semua');
    setIsAnggotaOpen(true);
    setLoadingAnggota(true);

    try {
      const { data: siswaData } = await supabase.from('data_siswa').select('id, nama, nipd, kelas').eq('status_keaktifan', 'Aktif').neq('kelas', 'Calon Siswa').order('nama', { ascending: true });
      setDataSiswa(siswaData || []);

      const { data: anggotaData } = await supabase.from('anggota_kokurikuler').select('id, siswa_id, predikat, deskripsi').eq('kokurikuler_id', item.id);
      
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
      Alert.alert('Error', 'Gagal memuat data anggota P5');
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
        await supabase.from('anggota_kokurikuler').delete().eq('kokurikuler_id', selectedProjek.id).in('siswa_id', toRemove);
      }

      for (const sId of toAddOrUpdate) {
        const isNew = !initialCheckedIds.has(sId);
        const { predikat, deskripsi } = deskripsiData[sId] || { predikat: '', deskripsi: '' };
        const payload = {
          kokurikuler_id: selectedProjek.id,
          siswa_id: sId,
          tahun_ajaran: selectedProjek.tahun_ajaran,
          semester: selectedProjek.semester,
          predikat,
          deskripsi
        };
        
        if (isNew) {
          await supabase.from('anggota_kokurikuler').insert([payload]);
        } else {
          await supabase.from('anggota_kokurikuler').update(payload).eq('kokurikuler_id', selectedProjek.id).eq('siswa_id', sId);
        }
      }

      Alert.alert('Berhasil', 'Anggota & Nilai P5 disimpan.');
      setIsAnggotaOpen(false);
      fetchKokurikuler();
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan anggota P5');
    } finally {
      setIsSavingAnggota(false);
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Projek P5 (Koku)</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola Projek Penguatan Profil Pelajar Pancasila</Text>
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
          <Text style={styles.btnAddText}>Buat Projek Baru</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
        ) : dataKokurikuler.length === 0 ? (
          <Text style={styles.emptyText}>Tidak ada projek pada TA ini.</Text>
        ) : (
          dataKokurikuler.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}><BookOpen size={20} color="#2a2c87" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.projekName}>{item.nama_projek}</Text>
                  <Text style={styles.projekKoordinator}>Koord: {item.koordinator_nama || '-'}</Text>
                </View>
                <View style={styles.badgeCount}>
                  <Users size={12} color="#059669" />
                  <Text style={styles.badgeCountText}>{item.jumlah_anggota || 0}</Text>
                </View>
              </View>

              <View style={styles.temaRow}>
                <Text style={styles.temaText}>{item.tema || 'Tema Umum'}</Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.actionBtn, styles.btnTrash]} onPress={() => handleDelete(item.id, item.nama_projek)}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnEdit]} onPress={() => handleEdit(item)}>
                  <Edit size={16} color="#d97706" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnAnggota]} onPress={() => handleAnggota(item)}>
                  <Users size={16} color="#fff" />
                  <Text style={styles.btnAnggotaText}>Kelola Penilaian</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL PROJEK P5 */}
      <Modal visible={isFormOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Projek' : 'Tambah Projek'}</Text>
              <TouchableOpacity onPress={() => setIsFormOpen(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Nama Projek *</Text>
                  <TextInput style={styles.inputModal} value={formData.nama_projek} onChangeText={t => setFormData({...formData, nama_projek: t})} placeholder="Cth: Daur Ulang Sampah" />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Tema Projek *</Text>
                  <View style={styles.pickerWrapperModal}>
                    <Picker selectedValue={formData.tema} onValueChange={t => setFormData({...formData, tema: t})}>
                      <Picker.Item label="Gaya Hidup Berkelanjutan" value="Gaya Hidup Berkelanjutan" />
                      <Picker.Item label="Kearifan Lokal" value="Kearifan Lokal" />
                      <Picker.Item label="Bhinneka Tunggal Ika" value="Bhinneka Tunggal Ika" />
                      <Picker.Item label="Bangunlah Jiwa dan Raganya" value="Bangunlah Jiwa dan Raganya" />
                      <Picker.Item label="Suara Demokrasi" value="Suara Demokrasi" />
                      <Picker.Item label="Berekayasa dan Berteknologi" value="Berekayasa dan Berteknologi untuk Membangun NKRI" />
                      <Picker.Item label="Kewirausahaan" value="Kewirausahaan" />
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Koordinator / Fasilitator</Text>
                  <TextInput style={styles.inputModal} value={formData.koordinator_nama} onChangeText={t => setFormData({...formData, koordinator_nama: t})} placeholder="Nama Guru Koordinator" />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.labelModal}>Deskripsi Projek</Text>
                  <TextInput style={[styles.inputModal, { minHeight: 80, textAlignVertical: 'top' }]} value={formData.deskripsi_projek} onChangeText={t => setFormData({...formData, deskripsi_projek: t})} placeholder="Tuliskan gambaran singkat projek..." multiline numberOfLines={3} />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSaveModal} onPress={saveKokurikuler} disabled={isSavingForm}>
                {isSavingForm ? <ActivityIndicator color="#fff" /> : <><Save size={20} color="#fff" /><Text style={styles.btnSaveModalText}>Simpan Projek</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL KELOLA ANGGOTA & NILAI P5 */}
      <Modal visible={isAnggotaOpen} transparent animationType="slide">
        <View style={styles.modalOverlayFull}>
          <View style={styles.modalContentFull}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Penilaian Siswa P5</Text>
                <Text style={styles.modalSubtitle}>{selectedProjek?.nama_projek} - {selectedProjek?.semester}</Text>
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
              <Text style={styles.infoBarText}>Pilih siswa dan berikan Penilaian Predikat.</Text>
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
                              <Picker.Item label="-- Predikat P5 --" value="" />
                              <Picker.Item label="Sangat Berkembang (SB)" value="Sangat Berkembang" />
                              <Picker.Item label="Berkembang Sesuai Harapan (BSH)" value="Berkembang Sesuai Harapan" />
                              <Picker.Item label="Mulai Berkembang (MB)" value="Mulai Berkembang" />
                              <Picker.Item label="Belum Berkembang (BB)" value="Belum Berkembang" />
                            </Picker>
                          </View>
                          <TextInput 
                            style={styles.inputNilai} 
                            placeholder="Catatan proses/deskripsi (Opsional)..." 
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
                {isSavingAnggota ? <ActivityIndicator color="#fff" /> : <><Save size={20} color="#fff" /><Text style={styles.btnSaveModalText}>Simpan Penilaian</Text></>}
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
  projekName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  projekKoordinator: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  badgeCount: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeCountText: { fontSize: 12, fontWeight: 'bold', color: '#059669' },

  temaRow: { backgroundColor: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#ecfccb', borderLeftWidth: 4, borderLeftColor: '#84cc16' },
  temaText: { fontSize: 12, color: '#4d7c0f', fontWeight: 'bold' },

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
  pickerWrapperModal: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  
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
