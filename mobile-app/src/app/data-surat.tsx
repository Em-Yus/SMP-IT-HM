import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, Mail, X, Filter, ArrowDownUp } from 'lucide-react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

export type Surat = {
  id: number;
  nipd: string;
  jenis_surat: string;
  tahun: number;
  nomor_urut: number;
  meta_data: { no_surat: string } | null;
  created_at: string;
  nama_siswa?: string;
};

export default function DataSurat() {
  const [dataSurat, setDataSurat] = useState<Array<Surat>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [filterJenis, setFilterJenis] = useState('');
  const [filterTahun, setFilterTahun] = useState('');
  const [sortOrder, setSortOrder] = useState('terbaru');
  
  const [selectedSurat, setSelectedSurat] = useState<Surat | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  useEffect(() => {
    fetchData();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\data-surat.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchData();
  
    });

    return () => listener.remove();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase.from('data_surat').select('*');
      if (error) throw error;
      
      const { data: dataSiswa } = await supabase.from('data_siswa').select('nipd, nama, id');
      const mapSiswa: Record<string, string> = {};
      if (dataSiswa) {
        dataSiswa.forEach(s => {
          if (s.nipd) mapSiswa[s.nipd] = s.nama;
          mapSiswa[s.id.toString()] = s.nama;
        });
      }
      
      const mappedData = (data || []).map(item => ({
        ...item,
        nama_siswa: mapSiswa[item.nipd] || item.nipd || '-'
      }));

      setDataSurat(mappedData);
    } catch (err) {
      console.error('Error fetching data surat:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (surat: Surat) => {
    setSelectedSurat(surat);
    setModalVisible(true);
  };

  const availableYears = [...new Set(dataSurat.map(item => item.tahun))].sort().reverse();

  let processedData = dataSurat.filter(item => {
    const term = searchTerm.toLowerCase();
    const noSurat = item.meta_data?.no_surat?.toLowerCase() || '';
    const nama = item.nama_siswa?.toLowerCase() || '';
    const matchSearch = noSurat.includes(term) || nama.includes(term);
    
    const matchJenis = filterJenis ? item.jenis_surat === filterJenis : true;
    const matchTahun = filterTahun ? item.tahun.toString() === filterTahun : true;

    return matchSearch && matchJenis && matchTahun;
  });

  processedData = processedData.sort((a, b) => {
    if (sortOrder === 'terbaru') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortOrder === 'terlama') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortOrder === 'nourut_asc') {
      return a.nomor_urut - b.nomor_urut;
    } else if (sortOrder === 'nourut_desc') {
      return b.nomor_urut - a.nomor_urut;
    }
    return 0;
  });

  const renderItem = ({ item }: { item: Surat }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconWrapper, 
          item.jenis_surat === 'PENERIMAAN' ? { backgroundColor: '#F2FBEB' } : 
          item.jenis_surat === 'PINDAH' ? { backgroundColor: '#FDE8E9' } : 
          { backgroundColor: '#ECEEFF' }]}>
          <Mail size={24} color={
            item.jenis_surat === 'PENERIMAAN' ? '#84D43F' : 
            item.jenis_surat === 'PINDAH' ? '#E63946' : 
            '#1E257F'
          } />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.nameText} numberOfLines={1}>{item.meta_data?.no_surat || 'Tanpa Nomor Surat'}</Text>
          <Text style={styles.subText}>Kepada: {item.nama_siswa}</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeText}>{item.jenis_surat}</Text>
            <Text style={styles.badgeTextSmall}>Tahun: {item.tahun}</Text>
          </View>
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
        <Text style={styles.headerTitle}>Data Surat</Text>
        <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterButton}>
          <Filter color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search color="#9ca3af" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari no surat atau nama siswa..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1E257F" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={processedData}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada data surat ditemukan.</Text>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter & Urutan</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <X color="#6C757D" size={24} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.filterLabel}>Jenis Surat</Text>
            <View style={styles.chipRow}>
              {['', 'PENERIMAAN', 'PINDAH', 'KELULUSAN'].map(jenis => (
                <TouchableOpacity 
                  key={jenis} 
                  style={[styles.chip, filterJenis === jenis && styles.chipActive]}
                  onPress={() => setFilterJenis(jenis)}
                >
                  <Text style={[styles.chipText, filterJenis === jenis && styles.chipTextActive]}>
                    {jenis || 'Semua'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Tahun Pembuatan</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRowScroll}>
              <TouchableOpacity 
                  style={[styles.chip, filterTahun === '' && styles.chipActive]}
                  onPress={() => setFilterTahun('')}
              >
                <Text style={[styles.chipText, filterTahun === '' && styles.chipTextActive]}>Semua</Text>
              </TouchableOpacity>
              {availableYears.map(tahun => (
                <TouchableOpacity 
                  key={tahun} 
                  style={[styles.chip, filterTahun === tahun.toString() && styles.chipActive]}
                  onPress={() => setFilterTahun(tahun.toString())}
                >
                  <Text style={[styles.chipText, filterTahun === tahun.toString() && styles.chipTextActive]}>
                    {tahun}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>Urutkan Berdasarkan</Text>
            <View style={styles.chipRow}>
              {[
                { val: 'terbaru', label: 'Terbaru' },
                { val: 'terlama', label: 'Terlama' },
                { val: 'nourut_desc', label: 'No Urut Tertinggi' },
                { val: 'nourut_asc', label: 'No Urut Terendah' }
              ].map(sort => (
                <TouchableOpacity 
                  key={sort.val} 
                  style={[styles.chip, sortOrder === sort.val && styles.chipActive]}
                  onPress={() => setSortOrder(sort.val)}
                >
                  <Text style={[styles.chipText, sortOrder === sort.val && styles.chipTextActive]}>
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.applyFilterBtn} onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.applyFilterBtnText}>Terapkan Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlayCentered}>
          <View style={styles.modalContentCentered}>
            <View style={styles.modalHeaderCentered}>
              <Text style={styles.modalTitle}>Detail Surat</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#6C757D" size={24} />
              </TouchableOpacity>
            </View>
            
            {selectedSurat && (
              <View>
                <View style={styles.detailAvatarContainer}>
                  <Mail size={48} color="#1E257F" />
                </View>
                
                <View style={styles.detailInfoBox}>
                  <Text style={styles.detailLabel}>Nomor Surat</Text>
                  <Text style={styles.detailValueLg}>{selectedSurat.meta_data?.no_surat || '-'}</Text>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailLabel}>Jenis Surat</Text>
                    <Text style={styles.detailValue}>{selectedSurat.jenis_surat}</Text>
                  </View>
                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailLabel}>Tahun</Text>
                    <Text style={styles.detailValue}>{selectedSurat.tahun}</Text>
                  </View>
                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailLabel}>Nomor Urut</Text>
                    <Text style={styles.detailValue}>{selectedSurat.nomor_urut}</Text>
                  </View>
                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailLabel}>Ditujukan Ke</Text>
                    <Text style={styles.detailValue}>{selectedSurat.nama_siswa}</Text>
                  </View>
                </View>

                <View style={styles.detailInfoBox}>
                  <Text style={styles.detailLabel}>Tanggal Pembuatan Surat</Text>
                  <Text style={styles.detailValue}>{new Date(selectedSurat.created_at).toLocaleString('id-ID')}</Text>
                </View>
                
                <Text style={styles.detailNote}>
                  *Data surat ini di-generate dari web app (Pendaftaran SPMB, Pindah, atau Kelulusan) dan hanya bersifat referensi (Read-Only).
                </Text>
              </View>
            )}
          </View>
        </View>
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
  filterButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
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
  iconWrapper: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  textContainer: { marginLeft: 16, flex: 1 },
  nameText: { fontSize: 15, fontWeight: 'bold', color: '#1A1818', marginBottom: 4 },
  subText: { fontSize: 13, color: '#6C757D', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badgeText: { fontSize: 11, fontWeight: 'bold', color: '#6C757D', backgroundColor: '#F8F9FA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeTextSmall: { fontSize: 11, color: '#6C757D', backgroundColor: '#F8F9FA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#ADB5BD', textAlign: 'center' },
  
  // Filter Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  filterModalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1818' },
  filterLabel: { fontSize: 14, fontWeight: 'bold', color: '#6C757D', marginBottom: 10, marginTop: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRowScroll: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, marginHorizontal: -4, paddingHorizontal: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#ECEEFF', borderColor: '#1E257F' },
  chipText: { fontSize: 13, color: '#6C757D', fontWeight: '500' },
  chipTextActive: { color: '#1E257F', fontWeight: 'bold' },
  applyFilterBtn: { backgroundColor: '#1E257F', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 24, marginBottom: 8 },
  applyFilterBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

  // Detail Modal Centered
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContentCentered: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
  },
  modalHeaderCentered: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailAvatarContainer: { alignItems: 'center', marginBottom: 20, padding: 16, backgroundColor: '#ECEEFF', borderRadius: 16, alignSelf: 'center' },
  detailInfoBox: { backgroundColor: '#F8F9FA', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  detailGridItem: { flex: 1, minWidth: '45%', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  detailLabel: { fontSize: 12, color: '#6C757D', marginBottom: 4 },
  detailValue: { fontSize: 14, color: '#1A1818', fontWeight: 'bold' },
  detailValueLg: { fontSize: 16, color: '#1A1818', fontWeight: 'bold' },
  detailNote: { fontSize: 11, color: '#ADB5BD', fontStyle: 'italic', textAlign: 'center', marginTop: 12, lineHeight: 16 }
});
