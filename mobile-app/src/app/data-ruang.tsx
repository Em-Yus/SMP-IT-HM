import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, X, Plus, Edit, Trash2, Save, Building } from 'lucide-react-native';
import { router } from 'expo-router';

export type Ruang = {
  id?: number;
  kode_ruang: string;
  nama_ruang: string;
};

const DEFAULT_FORM: Ruang = {
  kode_ruang: '', nama_ruang: ''
};

export default function DataRuang() {
  const [dataRuang, setDataRuang] = useState<Array<Ruang>>([]);
  const [filteredData, setFilteredData] = useState<Array<Ruang>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedRuang, setSelectedRuang] = useState<Ruang | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Ruang>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRuang();

    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in src\\app\\data-ruang.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchRuang();
    });

    return () => listener.remove();
  }, []);

  const fetchRuang = async () => {
    try {
      const { data, error } = await supabase
        .from('data_ruang')
        .select('*')
        .order('nama_ruang', { ascending: true });

      if (error) throw error;
      if (data) {
        setDataRuang(data);
        setFilteredData(data);
      }
    } catch (err) {
      console.error('Error fetching data ruang:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text) {
      const filtered = dataRuang.filter(p =>
        p.nama_ruang.toLowerCase().includes(text.toLowerCase()) ||
        p.kode_ruang.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(dataRuang);
    }
  };

  const openDetail = (ruang: Ruang) => {
    setSelectedRuang(ruang);
    setIsEditing(false);
    setModalVisible(true);
  };

  const openAddForm = () => {
    setSelectedRuang(undefined);
    setFormData(DEFAULT_FORM);
    setIsEditing(true);
    setModalVisible(true);
  };

  const openEditForm = () => {
    if (selectedRuang) {
      setFormData({
        ...selectedRuang
      });
      setIsEditing(true);
    }
  };

  const handleDelete = () => {
    if (!selectedRuang) return;
    Alert.alert(
      "Hapus Data",
      "Apakah Anda yakin ingin menghapus ruang ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase.from('data_ruang').delete().eq('id', selectedRuang.id);
              if (error) throw error;
              Alert.alert("Sukses", "Data ruang berhasil dihapus.");
              setModalVisible(false);
              fetchRuang();
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
    if (!formData.nama_ruang || !formData.kode_ruang) {
      Alert.alert("Error", "Kode Ruang dan Nama Ruang wajib diisi!");
      return;
    }

    setSaving(true);
    try {
      const { id, created_at, ...payload } = formData as any;

      if (formData.id) {
        const { error } = await supabase.from('data_ruang').update(payload).eq('id', formData.id);
        if (error) throw error;
        Alert.alert("Sukses", "Data ruang berhasil diperbarui!");
      } else {
        const { error } = await supabase.from('data_ruang').insert([payload]);
        if (error) throw error;
        Alert.alert("Sukses", "Data ruang baru berhasil ditambahkan!");
      }
      setModalVisible(false);
      fetchRuang();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Ruang }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.avatarContainerList}>
        <Building size={24} color="#2a2c87" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName}>{item.nama_ruang}</Text>
        <Text style={styles.cardSubtitle}>Kode: {item.kode_ruang}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Data Ruang</Text>
        </View>
        <View style={styles.searchContainer}>
          <Search color="#9ca3af" size={20} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari ruang..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2a2c87" />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id!.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada data ruang ditemukan.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openAddForm}>
        <Plus color="#fff" size={24} />
      </TouchableOpacity>

      {/* Modal Detail / Form */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? (formData.id ? 'Edit Ruang' : 'Tambah Ruang') : 'Detail Ruang'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#6b7280" size={24} />
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
                <Text style={styles.inputLabel}>Kode Ruang *</Text>
                <TextInput style={styles.inputField} value={formData.kode_ruang} onChangeText={(t) => setFormData({ ...formData, kode_ruang: t })} placeholder="Cth: R01" />

                <Text style={styles.inputLabel}>Nama Ruang *</Text>
                <TextInput style={styles.inputField} value={formData.nama_ruang} onChangeText={(t) => setFormData({ ...formData, nama_ruang: t })} placeholder="Cth: Ruang Kelas 1A" />

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
                <View style={{ height: 20 }} />
              </ScrollView>
            ) : selectedRuang ? (
              <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
                <View style={styles.detailAvatarContainer}>
                  <Building size={80} color="#2a2c87" />
                  <Text style={styles.detailName}>{selectedRuang.nama_ruang}</Text>
                  <Text style={styles.detailBadge}>{selectedRuang.kode_ruang}</Text>
                </View>

                <View style={styles.crudActionRow}>
                  <TouchableOpacity style={styles.crudEditButton} onPress={openEditForm}>
                    <Edit color="#2a2c87" size={18} />
                    <Text style={styles.crudEditBtnText}>Edit Data</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.crudDeleteButton} onPress={handleDelete}>
                    <Trash2 color="#ef4444" size={18} />
                    <Text style={styles.crudDeleteBtnText}>Hapus</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Informasi Ruang</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Nama Ruang</Text>
                    <Text style={styles.infoValue}>{selectedRuang.nama_ruang}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Kode Ruang</Text>
                    <Text style={styles.infoValue}>{selectedRuang.kode_ruang}</Text>
                  </View>
                </View>
                <View style={{ height: 40 }} />
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#1f2937' },
  listContainer: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  avatarContainerList: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardContent: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#6b7280' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#6b7280', fontSize: 16 },
  fab: { position: 'absolute', bottom: 84, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2a2c87', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', flexShrink: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputField: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1f2937', marginBottom: 16 },
  saveButton: { backgroundColor: '#2a2c87', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 12, marginTop: 8, gap: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  detailAvatarContainer: { alignItems: 'center', marginBottom: 24 },
  detailName: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginTop: 16, marginBottom: 4, textAlign: 'center' },
  detailBadge: { backgroundColor: '#eef2ff', color: '#4f46e5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, fontSize: 14, fontWeight: '500', overflow: 'hidden' },
  crudActionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  crudEditButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 12, gap: 8 },
  crudEditBtnText: { color: '#2a2c87', fontWeight: 'bold', fontSize: 15 },
  crudDeleteButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', paddingVertical: 12, borderRadius: 12, gap: 8 },
  crudDeleteBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 },
  infoGroup: { marginBottom: 24, backgroundColor: '#f9fafb', padding: 16, borderRadius: 16 },
  infoLabel: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 12, textTransform: 'uppercase' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  infoTitle: { fontSize: 14, color: '#6b7280' },
  infoValue: { fontSize: 14, color: '#1f2937', fontWeight: '500', flex: 1, textAlign: 'right' }
});
