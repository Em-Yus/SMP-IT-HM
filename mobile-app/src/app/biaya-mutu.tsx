import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { Settings, ChevronLeft, Save, Plus, Trash2 } from 'lucide-react-native';
import { router } from 'expo-router';

const defaultItems = [
  { id: 1, uraian: 'PPDB', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 2, uraian: 'Daftar Ulang', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 3, uraian: 'SDP', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 4, uraian: 'MPLS', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 5, uraian: 'Attribut', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 6, uraian: 'Meeting Class', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 7, uraian: 'Jas', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 8, uraian: 'Kaos', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 9, uraian: 'Semester', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 10, uraian: 'Kitab', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 11, uraian: 'PHBI', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 12, uraian: 'Sampul Raport', tingkat7: 0, tingkat8: 0, tingkat9: 0 }
];

export default function BiayaMutu() {
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const [tahunPelajaran, setTahunPelajaran] = useState(defaultTahun);
  const [semester] = useState('Tahunan');
  const [tipeSiswa, setTipeSiswa] = useState('Siswa Baru');
  
  const [anggaran, setAnggaran] = useState<any[]>(defaultItems);
  const [recordId, setRecordId] = useState<number | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tahunPelajaran, tipeSiswa]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('biaya_pengembangan_mutu')
        .select('*')
        .eq('tahun_pelajaran', tahunPelajaran)
        .eq('semester', semester)
        .eq('tipe_siswa', tipeSiswa)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRecordId(data.id);
        if (data.data_anggaran && data.data_anggaran.length > 0) {
          setAnggaran(data.data_anggaran);
        } else {
          setAnggaran(defaultItems);
        }
      } else {
        setRecordId(null);
        const { data: latestData } = await supabase.from('biaya_pengembangan_mutu').select('data_anggaran').order('created_at', { ascending: false }).limit(1).maybeSingle();
        
        if (latestData && latestData.data_anggaran && latestData.data_anggaran.length > 0) {
          const templateItems = latestData.data_anggaran.map((item: any) => ({ ...item, tingkat7: 0, tingkat8: 0, tingkat9: 0 }));
          setAnggaran(templateItems);
        } else {
          setAnggaran(defaultItems);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', `Gagal memuat data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (id: number, field: string, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    const num = numericValue ? parseInt(numericValue, 10) : 0;
    setAnggaran(prev => prev.map(item => item.id === id ? { ...item, [field]: num } : item));
  };

  const handleUraianChange = (id: number, value: string) => {
    setAnggaran(prev => prev.map(item => item.id === id ? { ...item, uraian: value } : item));
  };

  const handleAddItem = () => {
    const newItem = { id: Date.now(), uraian: '', tingkat7: 0, tingkat8: 0, tingkat9: 0 };
    setAnggaran([...anggaran, newItem]);
  };

  const handleDeleteItem = (id: number) => {
    Alert.alert('Hapus?', 'Uraian ini akan dihapus dari daftar.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => setAnggaran(prev => prev.filter(item => item.id !== id)) }
    ]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = { tahun_pelajaran: tahunPelajaran, semester: semester, tipe_siswa: tipeSiswa, data_anggaran: anggaran };
      if (recordId) {
        await supabase.from('biaya_pengembangan_mutu').update(payload).eq('id', recordId);
      } else {
        const { data } = await supabase.from('biaya_pengembangan_mutu').insert([payload]).select().single();
        if (data) setRecordId(data.id);
      }
      Alert.alert('Berhasil', 'Data biaya pengembangan mutu tersimpan!');
    } catch (err: any) {
      Alert.alert('Error', `Gagal menyimpan: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const grandTotal = anggaran.reduce((sum, item) => sum + (item.tingkat7 || 0) + (item.tingkat8 || 0) + (item.tingkat9 || 0), 0);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Konfigurasi Keuangan</Text>
        </View>
        <Text style={styles.headerSubtitle}>Atur besaran Biaya Pengembangan Mutu</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        
        {/* SECTION 1: FILTER */}
        <View style={styles.filterCard}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Tahun Pelajaran</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={tahunPelajaran} onValueChange={(v) => setTahunPelajaran(v)}>
                  <Picker.Item label={`${currentYear-1}/${currentYear}`} value={`${currentYear-1}/${currentYear}`} />
                  <Picker.Item label={`${currentYear}/${currentYear+1}`} value={`${currentYear}/${currentYear+1}`} />
                </Picker>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Tipe Siswa</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={tipeSiswa} onValueChange={(v) => setTipeSiswa(v)}>
                  <Picker.Item label="Siswa Baru" value="Siswa Baru" />
                  <Picker.Item label="Pindahan Kls 8" value="Pindahan Kelas 8" />
                  <Picker.Item label="Pindahan Kls 9" value="Pindahan Kelas 9" />
                </Picker>
              </View>
            </View>
          </View>
        </View>

        <View />

        {/* SECTION 2: TABLE */}
        <View style={styles.tableCardWrapper}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2a2c87" />
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.tableBox}>
              
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.thCell, { width: 50, textAlign: 'center' }]}>No</Text>
                <Text style={[styles.thCell, { width: 200 }]}>Uraian Pembayaran</Text>
                <Text style={[styles.thCell, { width: 120, textAlign: 'center' }]}>Kelas 7</Text>
                <Text style={[styles.thCell, { width: 120, textAlign: 'center' }]}>Kelas 8</Text>
                <Text style={[styles.thCell, { width: 120, textAlign: 'center' }]}>Kelas 9</Text>
                <Text style={[styles.thCell, { width: 60, textAlign: 'center' }]}>Aksi</Text>
              </View>

              {anggaran.map((item, idx) => (
                <View key={item.id} style={styles.tableRow}>
                  <Text style={[styles.tdCell, { width: 50, textAlign: 'center', alignSelf: 'center', fontWeight: 'bold', color: '#6b7280' }]}>{idx + 1}</Text>
                  
                  <View style={[styles.tdCell, { width: 200, justifyContent: 'center' }]}>
                    <TextInput style={styles.textInputUraian} value={item.uraian} onChangeText={t => handleUraianChange(item.id, t)} placeholder="Nama Tagihan..." />
                  </View>

                  <View style={[styles.tdCell, { width: 120, justifyContent: 'center' }]}>
                    <TextInput style={styles.textInputUang} keyboardType="numeric" value={String(item.tingkat7)} onChangeText={t => handleInputChange(item.id, 'tingkat7', t)} />
                  </View>

                  <View style={[styles.tdCell, { width: 120, justifyContent: 'center' }]}>
                    <TextInput style={styles.textInputUang} keyboardType="numeric" value={String(item.tingkat8)} onChangeText={t => handleInputChange(item.id, 'tingkat8', t)} />
                  </View>

                  <View style={[styles.tdCell, { width: 120, justifyContent: 'center' }]}>
                    <TextInput style={styles.textInputUang} keyboardType="numeric" value={String(item.tingkat9)} onChangeText={t => handleInputChange(item.id, 'tingkat9', t)} />
                  </View>

                  <View style={[styles.tdCell, { width: 60, alignItems: 'center', justifyContent: 'center' }]}>
                    <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.btnDel}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.btnAddRow} onPress={handleAddItem}>
                <Plus size={16} color="#10b981" />
                <Text style={styles.btnAddRowText}>Tambah Baris Uraian</Text>
              </TouchableOpacity>

              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Grand Total (Akumulasi Tarif)</Text>
                <Text style={styles.grandTotalValue}>Rp {grandTotal.toLocaleString('id-ID')}</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Save Button */}
      <View style={styles.floatingAction}>
        <TouchableOpacity style={styles.btnSaveFull} onPress={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? <ActivityIndicator color="#fff" /> : <><Save color="#fff" size={20} /><Text style={styles.btnSaveFullText}>Simpan Konfigurasi</Text></>}
        </TouchableOpacity>
      </View>
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
  
  content: { flex: 1, padding: 16 },
  filterCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  filterLabel: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 4 },
  pickerWrapper: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },

  tableCardWrapper: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, position: 'relative' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  tableBox: { minWidth: 670 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#eef2ff', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#c7d2fe' },
  thCell: { fontSize: 13, fontWeight: 'bold', color: '#1e3a8a', paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tdCell: { paddingHorizontal: 4 },
  
  textInputUraian: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, fontSize: 14, color: '#1f2937' },
  textInputUang: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, fontSize: 14, fontWeight: 'bold', color: '#1f2937', textAlign: 'center' },
  btnDel: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 8 },

  btnAddRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#f8fafc', gap: 8 },
  btnAddRowText: { color: '#10b981', fontWeight: 'bold', fontSize: 14 },

  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#f9fafb' },
  grandTotalLabel: { fontSize: 13, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' },
  grandTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },

  floatingAction: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  btnSaveFull: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnSaveFullText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
