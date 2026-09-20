import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { DollarSign, ChevronLeft, Save, Plus, Trash2, Calendar, FileText } from 'lucide-react-native';
import { router } from 'expo-router';
import CustomDatePicker from '../components/CustomDatePicker';

export default function PemasukanLainnya() {
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  // Filters
  const [tahunPelajaranFilter, setTahunPelajaranFilter] = useState(defaultTahun);
  const [semesterFilter, setSemesterFilter] = useState('Tahunan');
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  // Data
  const [dataPemasukan, setDataPemasukan] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form Input
  const [inputTanggal, setInputTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [inputSumberDana, setInputSumberDana] = useState('BOS Reguler');
  const [inputSumberLainnya, setInputSumberLainnya] = useState('');
  const [inputKeterangan, setInputKeterangan] = useState('');
  const [inputNominal, setInputNominal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Layout Tab
  const [activeTab, setActiveTab] = useState<'tambah' | 'riwayat'>('tambah');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_pemasukan_lainnya')
        .select('*')
        .eq('tahun_pelajaran', tahunPelajaranFilter)
        .eq('semester', semesterFilter)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setDataPemasukan(data || []);
    } catch (err) {
      Alert.alert('Error', 'Gagal memuat data pemasukan');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tahunPelajaranFilter, semesterFilter, startDate, endDate]);

  const handleSubmit = async () => {
    if (!inputNominal) return Alert.alert('Peringatan', 'Nominal harus diisi');

    const nominalValue = parseInt(inputNominal.replace(/[^0-9]/g, ''));
    if (!nominalValue || nominalValue <= 0) return Alert.alert('Peringatan', 'Nominal tidak valid');

    const finalSumberDana = inputSumberDana === 'Lainnya' ? inputSumberLainnya.trim() : inputSumberDana;
    if (!finalSumberDana) return Alert.alert('Peringatan', 'Sumber dana harus diisi');

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('tb_pemasukan_lainnya').insert([{
        tanggal: inputTanggal,
        sumber_dana: finalSumberDana,
        keterangan: inputKeterangan.trim(),
        nominal: nominalValue,
        tahun_pelajaran: tahunPelajaranFilter,
        semester: semesterFilter
      }]);

      if (error) throw error;
      
      Alert.alert('Berhasil', 'Pemasukan berhasil dicatat');
      setInputKeterangan('');
      setInputNominal('');
      if (inputSumberDana === 'Lainnya') setInputSumberLainnya('');
      
      fetchData();
      setActiveTab('riwayat');
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Pemasukan?', 'Data yang dihapus tidak dapat dikembalikan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
          setIsLoading(true);
          try {
            const { error } = await supabase.from('tb_pemasukan_lainnya').delete().eq('id', id);
            if (error) throw error;
            fetchData();
          } catch (err) {
            Alert.alert('Error', 'Gagal menghapus data');
          } finally {
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  const formatRupiah = (num: number) => {
    return num.toLocaleString('id-ID');
  };

  const totalNominal = dataPemasukan.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Pemasukan Lainnya</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola dana BOS, donatur, & bantuan</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'tambah' && styles.tabActive]} onPress={() => setActiveTab('tambah')}>
          <Plus size={18} color={activeTab === 'tambah' ? '#2a2c87' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'tambah' && styles.tabTextActive]}>Tambah</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'riwayat' && styles.tabActive]} onPress={() => setActiveTab('riwayat')}>
          <FileText size={18} color={activeTab === 'riwayat' ? '#2a2c87' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'riwayat' && styles.tabTextActive]}>Data Riwayat</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        
        {activeTab === 'tambah' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Input Pemasukan Baru</Text>
            
            <CustomDatePicker
              label="Tanggal Masuk"
              value={inputTanggal}
              onChange={setInputTanggal}
            />

            <View style={styles.formGroup}>
              <Text style={styles.label}>Sumber Dana</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={inputSumberDana} onValueChange={setInputSumberDana}>
                  <Picker.Item label="BOS Reguler" value="BOS Reguler" />
                  <Picker.Item label="BOSDA" value="BOSDA" />
                  <Picker.Item label="Donatur" value="Donatur" />
                  <Picker.Item label="Koperasi Sekolah" value="Koperasi Sekolah" />
                  <Picker.Item label="Bantuan Pemerintah" value="Bantuan Pemerintah" />
                  <Picker.Item label="Lainnya (Ketik Manual)..." value="Lainnya" />
                </Picker>
              </View>
            </View>

            {inputSumberDana === 'Lainnya' && (
              <View style={styles.formGroup}>
                <TextInput style={styles.inputBox} placeholder="Ketik sumber dana..." value={inputSumberLainnya} onChangeText={setInputSumberLainnya} />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nominal (Rp)</Text>
              <TextInput 
                style={styles.inputBoxMoney} 
                keyboardType="numeric" 
                placeholder="0" 
                value={inputNominal} 
                onChangeText={(t) => {
                  const val = t.replace(/[^0-9]/g, '');
                  setInputNominal(val ? formatRupiah(parseInt(val)) : '');
                }} 
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Keterangan (Opsional)</Text>
              <TextInput style={styles.textArea} multiline numberOfLines={3} placeholder="Catatan tambahan..." value={inputKeterangan} onChangeText={setInputKeterangan} textAlignVertical="top" />
            </View>

            <TouchableOpacity style={styles.btnSave} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <><Save size={20} color="#fff" /><Text style={styles.btnSaveText}>Simpan Pemasukan</Text></>}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'riwayat' && (
          <View>
            <View style={styles.filterCard}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Tahun Pelajaran</Text>
                  <View style={styles.pickerWrapperSM}>
                    <Picker selectedValue={tahunPelajaranFilter} onValueChange={setTahunPelajaranFilter}>
                      <Picker.Item label={`${currentYear-1}/${currentYear}`} value={`${currentYear-1}/${currentYear}`} />
                      <Picker.Item label={`${currentYear}/${currentYear+1}`} value={`${currentYear}/${currentYear+1}`} />
                    </Picker>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Semester</Text>
                  <View style={styles.pickerWrapperSM}>
                    <Picker selectedValue={semesterFilter} onValueChange={setSemesterFilter}>
                      <Picker.Item label="Tahunan" value="Tahunan" />
                      <Picker.Item label="Ganjil" value="Ganjil" />
                      <Picker.Item label="Genap" value="Genap" />
                    </Picker>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Mulai Tgl</Text>
                  <TextInput style={styles.inputDateSM} value={startDate} onChangeText={setStartDate} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Sampai Tgl</Text>
                  <TextInput style={styles.inputDateSM} value={endDate} onChangeText={setEndDate} />
                </View>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Pemasukan Lainnya (Filter)</Text>
              <Text style={styles.summaryValue}>Rp {formatRupiah(totalNominal)}</Text>
            </View>

            {isLoading ? <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 20 }} /> : 
              dataPemasukan.length === 0 ? <Text style={styles.emptyText}>Tidak ada data pemasukan.</Text> :
              dataPemasukan.map((item, idx) => (
                <View key={item.id} style={styles.listItem}>
                  <View style={styles.listIcon}><DollarSign size={20} color="#10b981" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{item.sumber_dana}</Text>
                    <Text style={styles.listSub}>{new Date(item.tanggal).toLocaleDateString('id-ID')} • {item.keterangan || 'Tanpa keterangan'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.listAmount}>Rp {formatRupiah(item.nominal)}</Text>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.btnTrash}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            }
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: '#e0e7ff', fontSize: 13 },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', padding: 8, marginHorizontal: 16, marginTop: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 12 },
  tabActive: { backgroundColor: '#eff6ff' },
  tabText: { fontSize: 14, fontWeight: 'bold', color: '#9ca3af' },
  tabTextActive: { color: '#2a2c87' },

  content: { flex: 1, padding: 16 },
  
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 12 },
  
  formGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 6 },
  inputIconWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12 },
  inputField: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 15, color: '#1f2937' },
  pickerWrapper: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  inputBox: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 15, color: '#1f2937' },
  inputBoxMoney: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 24, fontWeight: 'bold', color: '#10b981', textAlign: 'right' },
  textArea: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 15, color: '#1f2937', minHeight: 80 },

  btnSave: { backgroundColor: '#2a2c87', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10, shadowColor: '#2a2c87', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnSaveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  filterCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  pickerWrapperSM: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden', height: 45, justifyContent: 'center' },
  inputDateSM: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, height: 45, fontSize: 13, color: '#1f2937' },
  
  summaryCard: { backgroundColor: '#10b981', borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  summaryLabel: { color: '#d1fae5', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  summaryValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 },

  emptyText: { textAlign: 'center', color: '#9ca3af', fontStyle: 'italic', marginTop: 20 },
  
  listItem: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  listIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  listTitle: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  listSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  listAmount: { fontSize: 14, fontWeight: 'bold', color: '#10b981', marginBottom: 8 },
  btnTrash: { alignSelf: 'flex-end', padding: 4 }
});
