import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { 
  CreditCard, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Calendar, 
  FileText, 
  ArrowUpRight,
  Tag,
  Building
} from 'lucide-react-native';
import { router } from 'expo-router';
import CustomDatePicker from '../components/CustomDatePicker';

export default function PengeluaranScreen() {
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
  const [dataPengeluaran, setDataPengeluaran] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form Input
  const [inputTanggal, setInputTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [inputKategori, setInputKategori] = useState('Operasional & Utilitas');
  const [inputKategoriLainnya, setInputKategoriLainnya] = useState('');
  const [inputPenerima, setInputPenerima] = useState('');
  const [inputKeterangan, setInputKeterangan] = useState('');
  const [inputNominal, setInputNominal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Layout Tab
  const [activeTab, setActiveTab] = useState<'tambah' | 'riwayat'>('tambah');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_pengeluaran')
        .select('*')
        .eq('tahun_pelajaran', tahunPelajaranFilter)
        .eq('semester', semesterFilter)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('tb_pengeluaran')) {
          setDataPengeluaran([]);
          return;
        }
        throw error;
      }
      setDataPengeluaran(data || []);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal memuat data pengeluaran');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tahunPelajaranFilter, semesterFilter, startDate, endDate]);

  const handleSubmit = async () => {
    if (!inputNominal) return Alert.alert('Peringatan', 'Nominal pengeluaran harus diisi');

    const nominalValue = parseInt(inputNominal.replace(/[^0-9]/g, ''), 10);
    if (!nominalValue || nominalValue <= 0) return Alert.alert('Peringatan', 'Nominal pengeluaran tidak valid');

    const finalKategori = inputKategori === 'Lainnya' ? inputKategoriLainnya.trim() : inputKategori;
    if (!finalKategori) return Alert.alert('Peringatan', 'Kategori pengeluaran harus diisi');

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('tb_pengeluaran').insert([{
        tanggal: inputTanggal,
        kategori: finalKategori,
        penerima: inputPenerima.trim() || null,
        keterangan: inputKeterangan.trim() || null,
        nominal: nominalValue,
        tahun_pelajaran: tahunPelajaranFilter,
        semester: semesterFilter
      }]);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('tb_pengeluaran')) {
          Alert.alert(
            'Tabel Belum Dibuat',
            'Tabel tb_pengeluaran belum dibuat di Supabase. Silakan jalankan script setup_tb_pengeluaran.sql di database.'
          );
          return;
        }
        throw error;
      }
      
      Alert.alert('Berhasil', 'Pengeluaran berhasil dicatat');
      setInputKeterangan('');
      setInputNominal('');
      setInputPenerima('');
      if (inputKategori === 'Lainnya') setInputKategoriLainnya('');
      
      fetchData();
      setActiveTab('riwayat');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Gagal menyimpan data pengeluaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Pengeluaran?', 'Data yang dihapus tidak dapat dikembalikan.', [
      { text: 'Batal', style: 'cancel' },
      { 
        text: 'Hapus', 
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('tb_pengeluaran').delete().eq('id', id);
            if (error) throw error;
            fetchData();
            Alert.alert('Terhapus', 'Data pengeluaran telah dihapus.');
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Gagal menghapus data');
          }
        }
      }
    ]);
  };

  const formatRupiah = (val: number) => {
    return (val || 0).toLocaleString('id-ID');
  };

  const totalNominal = dataPengeluaran.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Pengeluaran Sekolah</Text>
            <Text style={styles.headerSubtitle}>Catat dan kelola pos pengeluaran kas sekolah</Text>
          </View>
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'tambah' && styles.tabActive]}
          onPress={() => setActiveTab('tambah')}
        >
          <Plus size={16} color={activeTab === 'tambah' ? '#e11d48' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'tambah' && styles.tabTextActive]}>Catat Baru</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'riwayat' && styles.tabActive]}
          onPress={() => setActiveTab('riwayat')}
        >
          <FileText size={16} color={activeTab === 'riwayat' ? '#e11d48' : '#9ca3af'} />
          <Text style={[styles.tabText, activeTab === 'riwayat' && styles.tabTextActive]}>
            Riwayat ({dataPengeluaran.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'tambah' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Formulir Pengeluaran Kas</Text>

            {/* Tanggal */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Tanggal Pengeluaran *</Text>
              <CustomDatePicker 
                value={inputTanggal}
                onChange={setInputTanggal}
                placeholder="Pilih Tanggal"
              />
            </View>

            {/* Kategori Pengeluaran */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Kategori Pengeluaran *</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={inputKategori}
                  onValueChange={(val) => setInputKategori(val)}
                >
                  <Picker.Item label="Operasional & Utilitas" value="Operasional & Utilitas" />
                  <Picker.Item label="Gaji & Honorarium" value="Gaji & Honorarium" />
                  <Picker.Item label="Sarana & Prasarana" value="Sarana & Prasarana" />
                  <Picker.Item label="Kegiatan Kesiswaan" value="Kegiatan Kesiswaan" />
                  <Picker.Item label="Konsumsi & Jamuan" value="Konsumsi & Jamuan" />
                  <Picker.Item label="ATK & Cetak" value="ATK & Cetak" />
                  <Picker.Item label="Perlengkapan Lab / TI" value="Perlengkapan Lab / TI" />
                  <Picker.Item label="Pemeliharaan & Kebersihan" value="Pemeliharaan & Kebersihan" />
                  <Picker.Item label="Lainnya" value="Lainnya" />
                </Picker>
              </View>
            </View>

            {inputKategori === 'Lainnya' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Kategori Khusus (Ketik Manual) *</Text>
                <TextInput 
                  style={styles.inputBox}
                  placeholder="Ketik kategori pengeluaran..."
                  value={inputKategoriLainnya}
                  onChangeText={setInputKategoriLainnya}
                />
              </View>
            )}

            {/* Penerima */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Penerima / Toko / Vendor</Text>
              <TextInput 
                style={styles.inputBox}
                placeholder="Contoh: Toko ATK Berkah, Pak Ahmad..."
                value={inputPenerima}
                onChangeText={setInputPenerima}
              />
            </View>

            {/* Nominal */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nominal Pengeluaran (Rp) *</Text>
              <TextInput 
                style={styles.inputBoxMoney}
                placeholder="0"
                keyboardType="numeric"
                value={inputNominal ? `Rp ${formatRupiah(parseInt(inputNominal.replace(/[^0-9]/g, '') || '0', 10))}` : ''}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '');
                  setInputNominal(cleaned);
                }}
              />
            </View>

            {/* Keterangan */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Keterangan / Uraian</Text>
              <TextInput 
                style={styles.textArea}
                placeholder="Rincian barang, jasa, atau keperluan..."
                multiline
                numberOfLines={3}
                value={inputKeterangan}
                onChangeText={setInputKeterangan}
              />
            </View>

            <TouchableOpacity 
              style={[styles.btnSave, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Plus size={18} color="#fff" />
                  <Text style={styles.btnSaveText}>Simpan Pengeluaran</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'riwayat' && (
          <View>
            {/* Filter Card */}
            <View style={styles.filterCard}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Tahun Pelajaran</Text>
                  <View style={styles.pickerWrapperSM}>
                    <Picker selectedValue={tahunPelajaranFilter} onValueChange={setTahunPelajaranFilter}>
                      <Picker.Item label="2023/2024" value="2023/2024" />
                      <Picker.Item label="2024/2025" value="2024/2025" />
                      <Picker.Item label="2025/2026" value="2025/2026" />
                      <Picker.Item label="2026/2027" value="2026/2027" />
                    </Picker>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Semester</Text>
                  <View style={styles.pickerWrapperSM}>
                    <Picker selectedValue={semesterFilter} onValueChange={setSemesterFilter}>
                      <Picker.Item label="Tahunan" value="Tahunan" />
                      <Picker.Item label="Ganjil" value="Semester Ganjil" />
                      <Picker.Item label="Genap" value="Semester Genap" />
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

            {/* Total Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Pengeluaran (Filter)</Text>
              <Text style={styles.summaryValue}>Rp {formatRupiah(totalNominal)}</Text>
              <Text style={styles.summarySub}>{dataPengeluaran.length} transaksi pengeluaran</Text>
            </View>

            {isLoading ? (
              <ActivityIndicator size="large" color="#e11d48" style={{ marginTop: 20 }} />
            ) : dataPengeluaran.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada data pengeluaran pada periode ini.</Text>
            ) : (
              dataPengeluaran.map((item) => (
                <View key={item.id} style={styles.listItem}>
                  <View style={styles.listIcon}>
                    <ArrowUpRight size={20} color="#e11d48" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{item.kategori}</Text>
                    {item.penerima ? (
                      <Text style={styles.listRecipient}>Kepada: {item.penerima}</Text>
                    ) : null}
                    <Text style={styles.listSub}>
                      {new Date(item.tanggal).toLocaleDateString('id-ID')} • {item.keterangan || 'Tanpa keterangan'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.listAmount}>Rp {formatRupiah(item.nominal)}</Text>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.btnTrash}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#be123c', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: '#ffe4e6', fontSize: 12, marginTop: 2 },
  
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 6, 
    marginHorizontal: 16, 
    marginTop: 16, 
    borderRadius: 16, 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2 
  },
  tabBtn: { 
    flex: 1, 
    paddingVertical: 10, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 6, 
    borderRadius: 12 
  },
  tabActive: { backgroundColor: '#fff1f2' },
  tabText: { fontSize: 13, fontWeight: 'bold', color: '#9ca3af' },
  tabTextActive: { color: '#be123c' },

  content: { flex: 1, padding: 16 },
  
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 18, 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2 
  },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  
  formGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 6 },
  pickerWrapper: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden' },
  inputBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 14, color: '#1e293b' },
  inputBoxMoney: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 12, padding: 14, fontSize: 20, fontWeight: 'bold', color: '#be123c', textAlign: 'right' },
  textArea: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 14, color: '#1e293b', minHeight: 70 },

  btnSave: { 
    backgroundColor: '#be123c', 
    borderRadius: 12, 
    paddingVertical: 14, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 8, 
    marginTop: 8, 
    elevation: 3, 
    shadowColor: '#be123c', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 6 
  },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  filterCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14 },
  pickerWrapperSM: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', height: 42, justifyContent: 'center' },
  inputDateSM: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 10, height: 42, fontSize: 12, color: '#1e293b' },
  
  summaryCard: { 
    backgroundColor: '#be123c', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 14, 
    alignItems: 'center', 
    elevation: 3, 
    shadowColor: '#be123c', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 6 
  },
  summaryLabel: { color: '#ffe4e6', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  summaryValue: { color: '#fff', fontSize: 22, fontWeight: 'black', marginTop: 4 },
  summarySub: { color: '#ffe4e6', fontSize: 11, marginTop: 2 },

  emptyText: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', marginTop: 30, fontSize: 13 },
  
  listItem: { 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    padding: 14, 
    marginBottom: 10, 
    flexDirection: 'row', 
    alignItems: 'center', 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2 
  },
  listIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffe4e6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  listTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  listRecipient: { fontSize: 12, fontWeight: '600', color: '#be123c', marginTop: 1 },
  listSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  listAmount: { fontSize: 13, fontWeight: 'bold', color: '#be123c', marginBottom: 6 },
  btnTrash: { alignSelf: 'flex-end', padding: 4 }
});
