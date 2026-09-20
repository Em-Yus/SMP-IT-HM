import React, { useEffect, useState } from 'react';
import {   View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert , DeviceEventEmitter , ToastAndroid, Platform } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, UserX, X, UserCheck } from 'lucide-react-native';
import { router } from 'expo-router';

export type Pegawai = {
  id?: number;
  nama: string | undefined;
  nik: string | undefined;
  nip: string | undefined;
  nuptk: string | undefined;
  niy: string | undefined;
  no_wa: string | undefined;
  tempat_lahir: string | undefined;
  tanggal_lahir: string | undefined;
  pendidikan: string | undefined;
  alamat: string | undefined;
  status_pegawai: string | undefined;
  tanggal_keluar: string | undefined;
};

export default function DataPegawaiNonaktif() {
  const [dataPegawai, setDataPegawai] = useState<Array<Pegawai>>([]);
  const [filteredData, setFilteredData] = useState<Array<Pegawai>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedPegawai, setSelectedPegawai] = useState<Pegawai | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchPegawai();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\data-pegawai-nonaktif.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchPegawai();
  
    });

    return () => listener.remove();
  }, []);

  const fetchPegawai = async () => {
    try {
      const { data, error } = await supabase
        .from('data_guru')
        .select('*')
        .not('tanggal_keluar', 'is', null)
        .order('nama', { ascending: true });

      if (error) throw error;
      if (data) {
        setDataPegawai(data);
        setFilteredData(data);
      }
    } catch (err) {
      console.error('Error fetching data pegawai nonaktif:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text) {
      const filtered = dataPegawai.filter(p => 
        p.nama?.toLowerCase().includes(text.toLowerCase()) ||
        p.nuptk?.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(dataPegawai);
    }
  };

  const openDetail = (pegawai: Pegawai) => {
    setSelectedPegawai(pegawai);
    setModalVisible(true);
  };

  const handleReactivate = () => {
    if (!selectedPegawai) return;
    Alert.alert(
      "Aktifkan Kembali?",
      `Yakin ingin mengaktifkan kembali ${selectedPegawai.nama}? Pegawai ini akan dikembalikan ke daftar Aktif.`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Ya, Aktifkan", 
          style: "default",
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('data_guru')
                .update({ tanggal_keluar: null })
                .eq('id', selectedPegawai.id);
              
              if (error) throw error;
              Alert.alert("Sukses", "Pegawai berhasil diaktifkan kembali.");
              setModalVisible(false);
              fetchPegawai();
            } catch (err: any) {
              Alert.alert("Error", err.message);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Pegawai }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.cardLeft}>
        <UserX size={40} color="#ef4444" />
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{item.nama}</Text>
          <Text style={styles.subText}>Keluar: {item.tanggal_keluar || '-'}</Text>
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
        <Text style={styles.headerTitle}>Pegawai Nonaktif</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search color="#9ca3af" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama, NUPTK..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#ef4444" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id!.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada data pegawai nonaktif ditemukan.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Pegawai</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#4b5563" size={24} />
              </TouchableOpacity>
            </View>
            
            {selectedPegawai && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.avatarContainer}>
                  <UserX size={80} color="#ef4444" />
                  <Text style={styles.detailName}>{selectedPegawai.nama}</Text>
                  <Text style={styles.detailBadge}>Nonaktif (Keluar: {selectedPegawai.tanggal_keluar})</Text>
                </View>

                {/* Aksi CRUD */}
                <View style={styles.crudActionRow}>
                  <TouchableOpacity style={styles.crudReactivateButton} onPress={handleReactivate}>
                    <UserCheck color="#10b981" size={18} />
                    <Text style={styles.crudReactivateBtnText}>Aktifkan Kembali</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Informasi Pribadi</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>NIK</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.nik || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Tempat, Tgl Lahir</Text>
                    <Text style={styles.infoValue}>
                      {selectedPegawai.tempat_lahir || '-'}, {selectedPegawai.tanggal_lahir || '-'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Informasi Akademik</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>NUPTK</Text>
                    <Text style={styles.infoValue}>{selectedPegawai.nuptk || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>NIP / NIY</Text>
                    <Text style={styles.infoValue}>
                      {selectedPegawai.nip || '-'} / {selectedPegawai.niy || '-'}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#ef4444', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  backButton: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  searchContainer: {
    backgroundColor: '#ef4444', paddingHorizontal: 16, paddingBottom: 20,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24
  },
  searchBox: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 16, alignItems: 'center', height: 48
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: '#1f2937' },
  listContainer: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  textContainer: { marginLeft: 12, flex: 1 },
  nameText: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  subText: { fontSize: 14, color: '#6b7280' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9ca3af', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '80%', padding: 24
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  avatarContainer: { alignItems: 'center', marginBottom: 16 },
  detailName: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginTop: 12, textAlign: 'center' },
  detailBadge: { backgroundColor: '#fee2e2', color: '#ef4444', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 14, fontWeight: '600', marginTop: 8 },
  crudActionRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24,
  },
  crudReactivateButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#d1fae5',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  crudReactivateBtnText: { color: '#10b981', fontWeight: 'bold', marginLeft: 6 },
  infoGroup: { marginBottom: 24 },
  infoLabel: { fontSize: 16, fontWeight: 'bold', color: '#ef4444', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoTitle: { fontSize: 14, color: '#6b7280', flex: 1 },
  infoValue: { fontSize: 14, color: '#1f2937', fontWeight: '500', flex: 2, textAlign: 'right' },
});
