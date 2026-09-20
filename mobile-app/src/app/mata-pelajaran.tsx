import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, BookOpen, X, Plus, Edit, Trash2, Save } from 'lucide-react-native';
import { router } from 'expo-router';

export type Mapel = {
  id?: number;
  nama_mapel: string;
  kode_mapel: string | undefined;
  kelompok: string | undefined;
  urutan: number | string | undefined;
};

const DEFAULT_FORM: Mapel = {
  nama_mapel: '', kode_mapel: '', kelompok: '', urutan: ''
};

export default function MataPelajaran() {
  const [dataMapel, setDataMapel] = useState<Array<Mapel>>([]);
  const [filteredData, setFilteredData] = useState<Array<Mapel>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedMapel, setSelectedMapel] = useState<Mapel | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Mapel>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMapel();

    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\mata-pelajaran.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchMapel();

    });

    return () => listener.remove();
  }, []);

  const fetchMapel = async () => {
    try {
      const { data, error } = await supabase
        .from('data_mapel')
        .select('*')
        .order('urutan', { ascending: true });

      if (error) throw error;
      if (data) {
        setDataMapel(data);
        setFilteredData(data);
      }
    } catch (err) {
      console.error('Error fetching data mapel:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text) {
      const filtered = dataMapel.filter(p =>
        p.nama_mapel.toLowerCase().includes(text.toLowerCase()) ||
        p.kode_mapel?.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(dataMapel);
    }
  };

  const openDetail = (mapel: Mapel) => {
    setSelectedMapel(mapel);
    setIsEditing(false);
    setModalVisible(true);
  };

  const openAddForm = () => {
    setSelectedMapel(undefined);
    setFormData(DEFAULT_FORM);
    setIsEditing(true);
    setModalVisible(true);
  };

  const openEditForm = () => {
    if (selectedMapel) {
      setFormData({
        ...selectedMapel,
        urutan: selectedMapel.urutan?.toString() || ''
      });
      setIsEditing(true);
    }
  };

  const handleDelete = () => {
    if (!selectedMapel) return;
    Alert.alert(
      "Hapus Mata Pelajaran",
      `Yakin ingin menghapus mapel ${selectedMapel.nama_mapel} secara permanen?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Hapus",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('data_mapel')
                .delete()
                .eq('id', selectedMapel.id);

              if (error) throw error;
              Alert.alert("Sukses", "Mata pelajaran berhasil dihapus.");
              setModalVisible(false);
              fetchMapel();
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
    if (!formData.nama_mapel) {
      Alert.alert("Error", "Nama Mapel wajib diisi!");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        nama_mapel: formData.nama_mapel,
        kode_mapel: formData.kode_mapel || null,
        kelompok: formData.kelompok || null,
      };

      if (formData.urutan) {
        payload.urutan = parseInt(formData.urutan as string, 10);
      } else {
        payload.urutan = null;
      }

      if (formData.id) {
        // Update
        const { error } = await supabase
          .from('data_mapel')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
        Alert.alert("Sukses", "Data mapel berhasil diperbarui!");
      } else {
        // Insert
        const { error } = await supabase
          .from('data_mapel')
          .insert([payload]);
        if (error) throw error;
        Alert.alert("Sukses", "Mata pelajaran baru berhasil ditambahkan!");
      }
      setModalVisible(false);
      fetchMapel();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Mapel }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.cardLeft}>
        <View style={styles.iconWrapper}>
          <BookOpen size={24} color="#1E257F" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{item.nama_mapel}</Text>
          <Text style={styles.subText}>{item.kode_mapel || '-'} | Kelompok {item.kelompok || '-'}</Text>
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
        <Text style={styles.headerTitle}>Mata Pelajaran</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search color="#9ca3af" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama atau kode mapel..."
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
              <Text style={styles.emptyText}>Tidak ada data mapel ditemukan.</Text>
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
                {isEditing ? (formData.id ? 'Edit Mapel' : 'Tambah Mapel') : 'Detail Mapel'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#6C757D" size={24} />
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.inputLabel}>Nama Mata Pelajaran *</Text>
                <TextInput style={styles.inputField} value={formData.nama_mapel} onChangeText={(t) => setFormData({ ...formData, nama_mapel: t })} placeholder="Cth: Matematika" />

                <Text style={styles.inputLabel}>Kode Mapel</Text>
                <TextInput style={styles.inputField} value={formData.kode_mapel} onChangeText={(t) => setFormData({ ...formData, kode_mapel: t })} placeholder="Cth: MTK" />

                <Text style={styles.inputLabel}>Kelompok</Text>
                <TextInput style={styles.inputField} value={formData.kelompok} onChangeText={(t) => setFormData({ ...formData, kelompok: t })} placeholder="Cth: A (Muatan Nasional)" />

                <Text style={styles.inputLabel}>Urutan Tampil (Angka)</Text>
                <TextInput style={styles.inputField} value={formData.urutan as string} onChangeText={(t) => setFormData({ ...formData, urutan: t })} keyboardType="numeric" placeholder="Cth: 1" />

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
            ) : selectedMapel ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.avatarContainer}>
                  <View style={[styles.iconWrapper, { width: 80, height: 80, borderRadius: 40 }]}>
                    <BookOpen size={40} color="#1E257F" />
                  </View>
                  <Text style={styles.detailName}>{selectedMapel.nama_mapel}</Text>
                  <Text style={styles.detailBadge}>Kode: {selectedMapel.kode_mapel || '-'}</Text>
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
                    <Text style={styles.infoTitle}>Kelompok Mapel</Text>
                    <Text style={styles.infoValue}>{selectedMapel.kelompok || 'Belum diatur'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Urutan Tampil</Text>
                    <Text style={styles.infoValue}>{selectedMapel.urutan || '-'}</Text>
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
    position: 'absolute', bottom: 64, right: 24, backgroundColor: '#84D43F',
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
  saveButton: { backgroundColor: '#1E257F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 32, marginBottom: 40 },
  saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, marginLeft: 8 }
});
