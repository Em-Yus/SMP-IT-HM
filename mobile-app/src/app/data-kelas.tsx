import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, School, X, Plus, Edit, Trash2, Save, ShieldCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

export type Kelas = {
  id?: number;
  nama_kelas: string;
  tingkat: number | string | undefined;
  wali_kelas_id: number | undefined;
  wali_kelas_nama: string | undefined;
  ruang_id: number | undefined;
  data_ruang?: { nama_ruang: string };
};

const DEFAULT_FORM: Kelas = {
  nama_kelas: '', tingkat: '', wali_kelas_id: undefined, wali_kelas_nama: '', ruang_id: undefined
};

export default function DataKelas() {
  const [dataKelas, setDataKelas] = useState<Array<Kelas>>([]);
  const [filteredData, setFilteredData] = useState<Array<Kelas>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedKelas, setSelectedKelas] = useState<Kelas | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Kelas>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [refRuang, setRefRuang] = useState<any[]>([]);
  const [refGuru, setRefGuru] = useState<any[]>([]);

  useEffect(() => {
    fetchKelas();
    fetchReferences();

    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\\app\\data-kelas.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchKelas();
      fetchReferences();
    });

    return () => listener.remove();
  }, []);

  const fetchReferences = async () => {
    try {
      const [resRuang, resGuru] = await Promise.all([
        supabase.from('data_ruang').select('id, nama_ruang').order('nama_ruang'),
        supabase.from('data_guru').select('id, nama').is('tanggal_keluar', null).order('nama')
      ]);
      if (resRuang.error) throw resRuang.error;
      if (resRuang.data) setRefRuang(resRuang.data);

      if (resGuru.error) throw resGuru.error;
      if (resGuru.data) setRefGuru(resGuru.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchKelas = async () => {
    try {
      const { data, error } = await supabase
        .from('data_kelas')
        .select('*, data_ruang(nama_ruang)')
        .order('nama_kelas', { ascending: true });

      if (error) throw error;
      if (data) {
        setDataKelas(data);
        setFilteredData(data);
      }
    } catch (err) {
      console.error('Error fetching data kelas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text) {
      const filtered = dataKelas.filter(p =>
        p.nama_kelas.toLowerCase().includes(text.toLowerCase()) ||
        p.wali_kelas_nama?.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(dataKelas);
    }
  };

  const openDetail = (kelas: Kelas) => {
    setSelectedKelas(kelas);
    setIsEditing(false);
    setModalVisible(true);
  };

  const openAddForm = () => {
    setSelectedKelas(undefined);
    setFormData(DEFAULT_FORM);
    setIsEditing(true);
    setModalVisible(true);
  };

  const openEditForm = () => {
    if (selectedKelas) {
      setFormData({
        ...selectedKelas,
        tingkat: selectedKelas.tingkat?.toString() || ''
      });
      setIsEditing(true);
    }
  };

  const handleDelete = () => {
    if (!selectedKelas) return;
    Alert.alert(
      "Hapus Kelas",
      `Yakin ingin menghapus rombongan belajar ${selectedKelas.nama_kelas}? Data siswa di kelas ini mungkin perlu diperbarui.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Hapus",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('data_kelas')
                .delete()
                .eq('id', selectedKelas.id);

              if (error) throw error;
              Alert.alert("Sukses", "Kelas berhasil dihapus.");
              setModalVisible(false);
              fetchKelas();
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
    if (!formData.nama_kelas) {
      Alert.alert("Error", "Nama Kelas wajib diisi!");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        nama_kelas: formData.nama_kelas,
        wali_kelas_id: formData.wali_kelas_id || null,
        wali_kelas_nama: formData.wali_kelas_nama || null,
        ruang_id: formData.ruang_id || null,
      };

      if (formData.tingkat) {
        payload.tingkat = parseInt(formData.tingkat as string, 10);
      }

      if (formData.id) {
        // Update
        const { error } = await supabase
          .from('data_kelas')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
        Alert.alert("Sukses", "Data kelas berhasil diperbarui!");
      } else {
        // Insert
        const { error } = await supabase
          .from('data_kelas')
          .insert([payload]);
        if (error) throw error;
        Alert.alert("Sukses", "Kelas baru berhasil ditambahkan!");
      }
      setModalVisible(false);
      fetchKelas();
    } catch (err: any) {
      if (err.code === '23505') {
        Alert.alert("Gagal", "Nama kelas sudah ada di sistem.");
      } else {
        Alert.alert("Error", err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Kelas }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.cardLeft}>
        <View style={styles.iconWrapper}>
          <School size={24} color="#1E257F" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{item.nama_kelas}</Text>
          <Text style={styles.subText}>Wali: {item.wali_kelas_nama || 'Belum diatur'}</Text>
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
        <Text style={styles.headerTitle}>Data Kelas</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search color="#9ca3af" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama kelas atau wali..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1E257F" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id!.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada data kelas ditemukan.</Text>
            </View>
          }
        />
      )}

      {/* FAB Add Button */}
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
                {isEditing ? (formData.id ? 'Edit Kelas' : 'Tambah Kelas') : 'Detail Kelas'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#4b5563" size={24} />
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.inputLabel}>Nama Kelas *</Text>
                <TextInput style={styles.inputField} value={formData.nama_kelas} onChangeText={(t) => setFormData({ ...formData, nama_kelas: t })} placeholder="Cth: VII-A" />

                <Text style={styles.inputLabel}>Tingkat</Text>
                <TextInput style={styles.inputField} value={formData.tingkat as string} onChangeText={(t) => setFormData({ ...formData, tingkat: t })} keyboardType="numeric" placeholder="Cth: 7" />

                <Text style={styles.inputLabel}>Wali Kelas</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.wali_kelas_id}
                    onValueChange={(itemValue, itemIndex) => {
                      if (itemValue) {
                        const guru = refGuru.find(g => g.id === itemValue);
                        setFormData({ ...formData, wali_kelas_id: itemValue, wali_kelas_nama: guru ? guru.nama : '' });
                      } else {
                        setFormData({ ...formData, wali_kelas_id: undefined, wali_kelas_nama: '' });
                      }
                    }}
                  >
                    <Picker.Item label="Pilih Wali Kelas" value={null} />
                    {refGuru.map((g) => (
                      <Picker.Item key={g.id} label={g.nama} value={g.id} />
                    ))}
                  </Picker>
                </View>

                <Text style={styles.inputLabel}>Ruang Kelas</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.ruang_id}
                    onValueChange={(itemValue) => setFormData({ ...formData, ruang_id: itemValue })}
                  >
                    <Picker.Item label="Pilih Ruang Kelas" value={null} />
                    {refRuang.map((r) => (
                      <Picker.Item key={r.id} label={r.nama_ruang} value={r.id} />
                    ))}
                  </Picker>
                </View>

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
            ) : selectedKelas ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.avatarContainer}>
                  <View style={[styles.iconWrapper, { width: 80, height: 80, borderRadius: 40 }]}>
                    <School size={40} color="#1E257F" />
                  </View>
                  <Text style={styles.detailName}>{selectedKelas.nama_kelas}</Text>
                  <Text style={styles.detailBadge}>Tingkat {selectedKelas.tingkat || '-'}</Text>
                </View>

                {/* Aksi CRUD */}
                <View style={styles.crudActionRow}>
                  <TouchableOpacity style={styles.crudEditButton} onPress={openEditForm}>
                    <Edit color="#1E257F" size={18} />
                    <Text style={styles.crudEditBtnText}>Edit Data</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.crudDeactivateButton} onPress={handleDelete}>
                    <Trash2 color="#E63946" size={18} />
                    <Text style={styles.crudDeactivateBtnText}>Hapus</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Informasi Detail</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Wali Kelas</Text>
                    <Text style={styles.infoValue}>{selectedKelas.wali_kelas_nama || 'Belum diatur'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Ruang Kelas</Text>
                    <Text style={styles.infoValue}>{selectedKelas.data_ruang?.nama_ruang || 'Belum diatur'}</Text>
                  </View>
                </View>

              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: '#1E257F', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  backButton: { padding: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  searchContainer: {
    backgroundColor: '#1E257F', paddingHorizontal: 16, paddingBottom: 20,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24
  },
  searchBox: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingHorizontal: 16, alignItems: 'center', height: 48
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: '#1A1818' },
  listContainer: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrapper: { backgroundColor: '#ECEEFF', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  textContainer: { marginLeft: 16, flex: 1 },
  nameText: { fontSize: 16, fontWeight: 'bold', color: '#1A1818', marginBottom: 4 },
  subText: { fontSize: 14, color: '#6C757D' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#ADB5BD', textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 64, right: 24, backgroundColor: '#2a2c87',
    width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 6
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '80%', padding: 24
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1818' },
  avatarContainer: { alignItems: 'center', marginBottom: 16 },
  detailName: { fontSize: 22, fontWeight: 'bold', color: '#1A1818', marginTop: 12, textAlign: 'center' },
  detailBadge: { backgroundColor: '#ECEEFF', color: '#1E257F', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 14, fontWeight: '600', marginTop: 8 },
  crudActionRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24,
  },
  crudEditButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECEEFF',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  crudEditBtnText: { color: '#1E257F', fontWeight: 'bold', marginLeft: 6 },
  crudDeactivateButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDE8E9',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  crudDeactivateBtnText: { color: '#E63946', fontWeight: 'bold', marginLeft: 6 },
  infoGroup: { marginBottom: 24 },
  infoLabel: { fontSize: 16, fontWeight: 'bold', color: '#1E257F', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoTitle: { fontSize: 14, color: '#6C757D', flex: 1 },
  infoValue: { fontSize: 14, color: '#1A1818', fontWeight: '500', flex: 2, textAlign: 'right' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#6C757D', marginBottom: 6, marginTop: 12 },
  inputField: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F8F9FA', color: '#1A1818' },
  pickerContainer: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, backgroundColor: '#F8F9FA', marginBottom: 12 },
  saveButton: { backgroundColor: '#1E257F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 32, marginBottom: 40 },
  saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  infoBanner: { flexDirection: 'row', backgroundColor: '#ECEEFF', padding: 12, borderRadius: 8, marginTop: 16, alignItems: 'flex-start' },
  infoBannerText: { flex: 1, color: '#1E257F', fontSize: 13, marginLeft: 8, lineHeight: 18 }
});
