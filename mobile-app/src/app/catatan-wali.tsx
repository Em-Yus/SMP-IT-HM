import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { ClipboardList, ChevronLeft, Save } from 'lucide-react-native';
import { router } from 'expo-router';

export default function CatatanWali() {
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const [filterTahun, setFilterTahun] = useState(defaultTahun);
  const [filterSemester, setFilterSemester] = useState('Ganjil');

  const [dataKelas, setDataKelas] = useState<any[]>([]);
  const [selectedKelasJson, setSelectedKelasJson] = useState('');

  const [dataSiswa, setDataSiswa] = useState<any[]>([]);
  const [catatanData, setCatatanData] = useState<any>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchKelas();

    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\catatan-wali.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchKelas();

    });

    return () => listener.remove();
  }, []);

  const fetchKelas = async () => {
    try {
      let { data } = await supabase.from('data_kelas').select('*').order('nama_kelas', { ascending: true });

      const userSession = await AsyncStorage.getItem('user_guru');
      const userPerms = await AsyncStorage.getItem('user_permissions');
      let permissions = [];
      if (userPerms) permissions = JSON.parse(userPerms);

      if (userSession) {
        const userObj = JSON.parse(userSession);
        if (userObj?.id) {
          const isAdmin = permissions.includes('*');
          if (!isAdmin && data) {
            data = data.filter(k => String(k.wali_kelas_id) === String(userObj.id));
          }
        }
      }
      setDataKelas(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFetchSiswa = async () => {
    if (!selectedKelasJson) return Alert.alert('Perhatian', 'Pilih Kelas terlebih dahulu!');

    const kelasObj = JSON.parse(selectedKelasJson);
    setIsLoading(true);
    try {
      const { data: siswaData, error } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('kelas', kelasObj.nama_kelas)
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (error) throw error;

      const nipdList = (siswaData || []).map(s => s.nipd);

      const { data: catatanDb } = await supabase
        .from('catatan_wali')
        .select('*')
        .in('nipd', nipdList)
        .eq('tahun_ajaran', filterTahun)
        .eq('semester', filterSemester);

      const initialCatatan: any = {};
      (siswaData || []).forEach(s => {
        const existing = catatanDb?.find(c => c.nipd === s.nipd);
        initialCatatan[s.nipd] = {
          id: existing?.id || null,
          catatan: existing?.catatan || '',
          kenaikan_kelas: existing?.kenaikan_kelas || ''
        };
      });

      setCatatanData(initialCatatan);
      setDataSiswa(siswaData || []);
    } catch (err: any) {
      Alert.alert('Error', `Gagal memuat data siswa: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCatatanChange = (nipd: string, field: string, value: string) => {
    setCatatanData((prev: any) => ({
      ...prev,
      [nipd]: { ...prev[nipd], [field]: value }
    }));
  };

  const handleSaveAll = async () => {
    if (dataSiswa.length === 0) return;
    setIsSaving(true);
    try {
      const promises = dataSiswa.map(async (siswa) => {
        const cData = catatanData[siswa.nipd];
        const payload = {
          nipd: siswa.nipd,
          tahun_ajaran: filterTahun,
          semester: filterSemester,
          catatan: cData?.catatan || '',
          kenaikan_kelas: filterSemester === 'Genap' ? (cData?.kenaikan_kelas || '') : null
        };

        if (cData?.id) {
          return supabase.from('catatan_wali').update(payload).eq('id', cData.id);
        } else {
          if (payload.catatan || payload.kenaikan_kelas) {
            return supabase.from('catatan_wali').insert([payload]);
          }
        }
      });

      await Promise.all(promises);
      Alert.alert('Berhasil', 'Semua catatan wali berhasil disimpan!');
      handleFetchSiswa();
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan catatan wali');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Catatan Wali Kelas</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola catatan akademik dan kenaikan kelas siswa.</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* SECTION 1: FILTER */}
        <View style={styles.filterCard}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Tahun Ajaran</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={filterTahun} onValueChange={(v) => { setFilterTahun(v); setDataSiswa([]); }}>
                  <Picker.Item label={`${currentYear - 1}/${currentYear}`} value={`${currentYear - 1}/${currentYear}`} />
                  <Picker.Item label={`${currentYear}/${currentYear + 1}`} value={`${currentYear}/${currentYear + 1}`} />
                </Picker>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Semester</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={filterSemester} onValueChange={(v) => { setFilterSemester(v); setDataSiswa([]); }}>
                  <Picker.Item label="Ganjil" value="Ganjil" />
                  <Picker.Item label="Genap" value="Genap" />
                </Picker>
              </View>
            </View>
          </View>

          <Text style={styles.filterLabel}>Kelas Wali</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedKelasJson} onValueChange={(v) => { setSelectedKelasJson(v); setDataSiswa([]); }}>
              <Picker.Item label="-- Pilih Kelas --" value="" />
              {dataKelas.map((k) => <Picker.Item key={k.id} label={k.nama_kelas} value={JSON.stringify(k)} />)}
            </Picker>
          </View>

          <TouchableOpacity style={styles.btnFetch} onPress={handleFetchSiswa} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnFetchText}>Tampilkan Siswa</Text>}
          </TouchableOpacity>
        </View>

        {/* SECTION 2: LIST CATATAN */}
        <View style={styles.listContainer}>
          {dataSiswa.map((siswa, idx) => {
            const cData = catatanData[siswa.nipd] || {};
            return (
              <View key={siswa.id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <View style={styles.numberBadge}><Text style={styles.numberText}>{idx + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{siswa.nama}</Text>
                    <Text style={styles.studentSub}>{siswa.nisn} / {siswa.nipd}</Text>
                  </View>
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Catatan Wali Kelas</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={4}
                    placeholder="Tulis pesan motivasi, pencapaian akademik..."
                    placeholderTextColor="#9ca3af"
                    value={cData.catatan}
                    onChangeText={(t) => handleCatatanChange(siswa.nipd, 'catatan', t)}
                    textAlignVertical="top"
                  />

                  {filterSemester === 'Genap' && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.inputLabel}>Status Kenaikan Kelas</Text>
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={cData.kenaikan_kelas}
                          onValueChange={(v) => handleCatatanChange(siswa.nipd, 'kenaikan_kelas', v)}
                        >
                          <Picker.Item label="-- Pilih Status --" value="" />
                          <Picker.Item label="Naik Kelas" value="Naik Kelas" />
                          <Picker.Item label="Naik Bersyarat" value="Naik Bersyarat" />
                          <Picker.Item label="Tidak Naik" value="Tidak Naik" />
                        </Picker>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Save Button */}
      {dataSiswa.length > 0 && (
        <View style={styles.floatingAction}>
          <TouchableOpacity style={styles.btnSaveFull} onPress={handleSaveAll} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <><Save color="#fff" size={20} /><Text style={styles.btnSaveFullText}>Simpan Semua Catatan</Text></>}
          </TouchableOpacity>
        </View>
      )}
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
  pickerWrapper: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  btnFetch: { backgroundColor: '#2a2c87', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnFetchText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  listContainer: { paddingBottom: 100 },
  studentCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  studentHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  numberBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  numberText: { fontSize: 13, fontWeight: 'bold', color: '#1e3a8a' },
  studentName: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  studentSub: { fontSize: 12, color: '#6b7280' },

  inputSection: { padding: 16 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' },
  textArea: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 14, color: '#1f2937', minHeight: 100 },

  floatingAction: { position: 'absolute', bottom: 50, left: 20, right: 20 },
  btnSaveFull: { backgroundColor: '#1e3a8a', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnSaveFullText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
