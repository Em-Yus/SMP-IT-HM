import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, Activity, X, Save, Edit3 } from 'lucide-react-native';
import { router } from 'expo-router';

export default function DataPeriodikSiswa() {
  // Filters
  const [kelasOptions, setKelasOptions] = useState<string[]>([]);
  const [activeKelas, setActiveKelas] = useState('');
  
  const tahunOptions = ['2024/2025', '2025/2026', '2026/2027', '2027/2028'];
  const [activeTahun, setActiveTahun] = useState('2026/2027');
  
  const semesterOptions = ['Ganjil', 'Genap'];
  const [activeSemester, setActiveSemester] = useState('Ganjil');
  
  // Data
  const [dataSiswa, setDataSiswa] = useState<any[]>([]);
  const [dataPeriodik, setDataPeriodik] = useState<any>({});
  
  // States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    tinggi_badan: '',
    berat_badan: '',
    kondisi_mata: '',
    kondisi_telinga: '',
    gigi: '',
    kecakapan: '',
    lain_lain: ''
  });

  useEffect(() => {
    fetchKelas();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\data-periodik.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchKelas();
  
    });

    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (activeKelas) {
      fetchData();
    }
  }, [activeKelas, activeTahun, activeSemester]);

  const fetchKelas = async () => {
    try {
      const { data, error } = await supabase
        .from('data_kelas')
        .select('nama_kelas')
        .order('nama_kelas', { ascending: true });

      if (error) throw error;
      
      const options = data.map(k => k.nama_kelas);
      setKelasOptions(options);
      if (options.length > 0) {
        setActiveKelas(options[0]);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching kelas:', err);
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: siswa, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('id, nama, nisn, nipd, jenis_kelamin')
        .eq('kelas', activeKelas)
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (errSiswa) throw errSiswa;
      setDataSiswa(siswa || []);

      if (siswa && siswa.length > 0) {
        const siswaIds = siswa.map(s => s.id);
        const { data: periodik, error: errPeriodik } = await supabase
          .from('data_periodik')
          .select('*')
          .in('id_siswa', siswaIds)
          .eq('tahun_ajaran', activeTahun)
          .eq('semester', activeSemester);
          
        if (errPeriodik) throw errPeriodik;

        const periodikMap: any = {};
        periodik?.forEach(p => {
          periodikMap[p.id_siswa] = p;
        });
        setDataPeriodik(periodikMap);
      } else {
        setDataPeriodik({});
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = dataSiswa.filter(s => 
    s.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nisn?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openModal = (siswa: any) => {
    setSelectedSiswa(siswa);
    const pData = dataPeriodik[siswa.id];
    
    setFormData({
      tinggi_badan: pData?.tinggi_badan ? pData.tinggi_badan.toString() : '',
      berat_badan: pData?.berat_badan ? pData.berat_badan.toString() : '',
      kondisi_mata: pData?.kondisi_mata || '',
      kondisi_telinga: pData?.kondisi_telinga || '',
      gigi: pData?.gigi || '',
      kecakapan: pData?.kecakapan || '',
      lain_lain: pData?.lain_lain || ''
    });
    
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedSiswa) return;
    setSaving(true);
    
    try {
      const pData = dataPeriodik[selectedSiswa.id];
      const dataToSave = {
        id_siswa: selectedSiswa.id,
        tahun_ajaran: activeTahun,
        semester: activeSemester,
        tinggi_badan: formData.tinggi_badan ? parseFloat(formData.tinggi_badan) : null,
        berat_badan: formData.berat_badan ? parseFloat(formData.berat_badan) : null,
        kondisi_mata: formData.kondisi_mata,
        kondisi_telinga: formData.kondisi_telinga,
        gigi: formData.gigi,
        kecakapan: formData.kecakapan,
        lain_lain: formData.lain_lain
      };

      if (pData && pData.id) {
        // Update
        const { error } = await supabase
          .from('data_periodik')
          .update(dataToSave)
          .eq('id', pData.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('data_periodik')
          .insert([dataToSave]);
        if (error) throw error;
      }

      Alert.alert('Sukses', 'Data periodik berhasil disimpan!');
      setModalVisible(false);
      fetchData(); // Refresh data
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const pData = dataPeriodik[item.id];
    return (
      <TouchableOpacity style={styles.card} onPress={() => openModal(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.nameText}>{item.nama}</Text>
          <Text style={styles.subText}>NISN: {item.nisn || '-'}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Tinggi</Text>
            <Text style={styles.statValue}>{pData?.tinggi_badan ? `${pData.tinggi_badan} cm` : '-'}</Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Berat</Text>
            <Text style={styles.statValue}>{pData?.berat_badan ? `${pData.berat_badan} kg` : '-'}</Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Aksi</Text>
            <View style={styles.actionBtn}>
              <Edit3 size={16} color="#1E257F" />
              <Text style={styles.actionText}>Edit</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderModal = () => {
    if (!selectedSiswa) return null;

    return (
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Ubah Data Periodik</Text>
                <Text style={styles.modalSubtitle}>{selectedSiswa.nama}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6C757D" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroupRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Tinggi Badan (cm)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.tinggi_badan}
                    onChangeText={(v) => setFormData({...formData, tinggi_badan: v})}
                    keyboardType="numeric"
                    placeholder="Contoh: 160"
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Berat Badan (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.berat_badan}
                    onChangeText={(v) => setFormData({...formData, berat_badan: v})}
                    keyboardType="numeric"
                    placeholder="Contoh: 50"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Kondisi Mata</Text>
              <TextInput
                style={styles.input}
                value={formData.kondisi_mata}
                onChangeText={(v) => setFormData({...formData, kondisi_mata: v})}
                placeholder="Contoh: Normal / Minus"
              />

              <Text style={styles.inputLabel}>Kondisi Telinga</Text>
              <TextInput
                style={styles.input}
                value={formData.kondisi_telinga}
                onChangeText={(v) => setFormData({...formData, kondisi_telinga: v})}
                placeholder="Contoh: Normal"
              />

              <Text style={styles.inputLabel}>Gigi</Text>
              <TextInput
                style={styles.input}
                value={formData.gigi}
                onChangeText={(v) => setFormData({...formData, gigi: v})}
                placeholder="Contoh: Bersih, tidak berlubang"
              />

              <Text style={styles.inputLabel}>Kecakapan</Text>
              <TextInput
                style={styles.input}
                value={formData.kecakapan}
                onChangeText={(v) => setFormData({...formData, kecakapan: v})}
                placeholder="Contoh: Berenang, Menari"
              />

              <Text style={styles.inputLabel}>Lain-lain</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={formData.lain_lain}
                onChangeText={(v) => setFormData({...formData, lain_lain: v})}
                multiline
                placeholder="Keterangan tambahan..."
              />
            </ScrollView>
            
            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Save size={20} color="#fff" style={{marginRight: 8}} />
                  <Text style={styles.saveButtonText}>Simpan Data</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Periodik Siswa</Text>
      </View>

      <View style={styles.filtersContainer}>
        {/* Row 1: TA & Semester */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <View style={styles.pillGroup}>
              {tahunOptions.map((thn, idx) => (
                <TouchableOpacity 
                  key={`thn-${idx}`} 
                  style={[styles.pill, activeTahun === thn && styles.pillActive]}
                  onPress={() => setActiveTahun(thn)}
                >
                  <Text style={[styles.pillText, activeTahun === thn && styles.pillTextActive]}>{thn}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <View style={styles.pillGroup}>
              {semesterOptions.map((sem, idx) => (
                <TouchableOpacity 
                  key={`sem-${idx}`} 
                  style={[styles.pill, activeSemester === sem && styles.pillActive]}
                  onPress={() => setActiveSemester(sem)}
                >
                  <Text style={[styles.pillText, activeSemester === sem && styles.pillTextActive]}>{sem}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Row 3: Kelas */}
        <View style={[styles.filterRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <View style={styles.pillGroup}>
              {kelasOptions.map((kelas, idx) => (
                <TouchableOpacity 
                  key={`kls-${idx}`} 
                  style={[styles.pill, activeKelas === kelas && styles.pillKelasActive]}
                  onPress={() => setActiveKelas(kelas)}
                >
                  <Text style={[styles.pillText, activeKelas === kelas && styles.pillTextActive]}>{kelas}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={20} color="#6C757D" style={styles.searchIcon} />
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
          <ActivityIndicator size="large" color="#1E257F" />
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Activity size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>Tidak ada data siswa ditemukan di kelas {activeKelas}.</Text>
            </View>
          }
        />
      )}
      
      {renderModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#1E257F',
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
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterRow: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
    paddingBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillActive: {
    backgroundColor: '#F2FBEB',
    borderColor: '#84D43F',
  },
  pillKelasActive: {
    backgroundColor: '#ECEEFF',
    borderColor: '#1E257F',
  },
  pillText: {
    color: '#6C757D',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#1A1818',
    fontWeight: 'bold',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 12,
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1818',
  },
  subText: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 4,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#ADB5BD',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1818',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECEEFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: {
    color: '#1E257F',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  dividerVertical: {
    width: 1,
    height: '100%',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: '#ADB5BD',
    textAlign: 'center',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1818',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
  },
  modalBody: {
    marginBottom: 20,
  },
  inputGroupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1818',
  },
  saveButton: {
    backgroundColor: '#1E257F',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
