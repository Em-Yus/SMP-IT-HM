import React, { useEffect, useState } from 'react';
import {   View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView , DeviceEventEmitter , ToastAndroid, Platform } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, UserMinus, X } from 'lucide-react-native';
import { router } from 'expo-router';

export default function DataSiswaNonaktif() {
  const [dataSiswa, setDataSiswa] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [uniqueStatuses, setUniqueStatuses] = useState<string[]>([]);
  const [activeStatus, setActiveStatus] = useState('Semua');
  
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchSiswa();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\data-siswa-nonaktif.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchSiswa();
  
    });

    return () => listener.remove();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, activeStatus, dataSiswa]);

  const fetchSiswa = async () => {
    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('*')
        .neq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (error) throw error;
      if (data) {
        setDataSiswa(data);
        
        // Extract unique statuses
        const statuses = ['Semua', ...new Set(data.map(item => item.status_keaktifan).filter(Boolean))].sort();
        setUniqueStatuses(statuses as string[]);
      }
    } catch (err) {
      console.error('Error fetching data siswa:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = dataSiswa;
    
    if (activeStatus !== 'Semua') {
      filtered = filtered.filter(s => s.status_keaktifan === activeStatus);
    }

    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nisn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nipd?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredData(filtered);
  };

  const openDetail = (siswa: any) => {
    setSelectedSiswa(siswa);
    setModalVisible(true);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.cardLeft}>
        <UserMinus size={40} color="#fca5a5" />
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{item.nama}</Text>
          <Text style={styles.subText}>NISN: {item.nisn || '-'} | NIPD: {item.nipd || '-'}</Text>
        </View>
      </View>
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>{item.status_keaktifan || '-'}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedSiswa) return null;
    return (
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Siswa Nonaktif</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Nama Lengkap</Text>
                <Text style={styles.detailValue}>{selectedSiswa.nama || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>NISN / NIPD</Text>
                <Text style={styles.detailValue}>{selectedSiswa.nisn || '-'} / {selectedSiswa.nipd || '-'}</Text>
              </View>
              <View style={[styles.detailRow, { backgroundColor: '#fef2f2' }]}>
                <Text style={[styles.detailLabel, { color: '#dc2626' }]}>Status Keaktifan</Text>
                <Text style={[styles.detailValue, { color: '#dc2626', fontWeight: 'bold' }]}>{selectedSiswa.status_keaktifan || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kelas Terakhir</Text>
                <Text style={styles.detailValue}>{selectedSiswa.kelas || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Jenis Kelamin</Text>
                <Text style={styles.detailValue}>{selectedSiswa.jenis_kelamin === 'L' ? 'Laki-laki' : selectedSiswa.jenis_kelamin === 'P' ? 'Perempuan' : selectedSiswa.jenis_kelamin || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tempat, Tgl Lahir</Text>
                <Text style={styles.detailValue}>{selectedSiswa.tempat_lahir || '-'}, {selectedSiswa.tanggal_lahir || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>No. WhatsApp</Text>
                <Text style={styles.detailValue}>{selectedSiswa.wa_siswa || '-'}</Text>
              </View>
            </ScrollView>
            
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Siswa Nonaktif</Text>
      </View>

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {uniqueStatuses.map((status, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={[styles.pill, activeStatus === status && styles.pillActive]}
              onPress={() => setActiveStatus(status)}
            >
              <Text style={[styles.pillText, activeStatus === status && styles.pillTextActive]}>{status}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama atau NISN..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada data siswa nonaktif yang ditemukan.</Text>
            </View>
          }
        />
      )}
      
      {renderDetailModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#dc2626', // Red theme
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBack: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  pillText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  badgeContainer: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  badgeText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalBody: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4b5563',
  },
  detailValue: {
    flex: 2,
    fontSize: 14,
    color: '#1f2937',
  },
  closeButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
