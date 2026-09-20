import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { ChevronLeft, Save, CheckSquare, Square } from 'lucide-react-native';
import { router } from 'expo-router';

export default function InputNilai() {
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const [filterTahun, setFilterTahun] = useState(defaultTahun);
  const [filterSemester, setFilterSemester] = useState('Ganjil');
  
  const [dataKelas, setDataKelas] = useState<any[]>([]);
  const [dataMapel, setDataMapel] = useState<any[]>([]);
  const [rawMapels, setRawMapels] = useState<any[]>([]);
  const [myPembelajaran, setMyPembelajaran] = useState<any[]>([]);

  const [selectedKelasJson, setSelectedKelasJson] = useState('');
  const [selectedMapelJson, setSelectedMapelJson] = useState('');

  const [dataTP, setDataTP] = useState<any[]>([]);
  const [dataNilai, setDataNilai] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMasterData();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\input-nilai.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchMasterData();
  
    });

    return () => listener.remove();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [resKelas, resMapel] = await Promise.all([
        supabase.from('data_kelas').select('id, nama_kelas, tingkat').order('nama_kelas', { ascending: true }),
        supabase.from('data_mapel').select('id, nama_mapel').order('urutan', { ascending: true })
      ]);

      let kelases = resKelas.data || [];
      let mapels = resMapel.data || [];
      setRawMapels(mapels);

      const userSession = await AsyncStorage.getItem('user_guru');
      if (userSession) {
        const userObj = JSON.parse(userSession);
        if (userObj?.id) {
          const { data: pembData } = await supabase.from('pembelajaran').select('kelas_id, mapel_id').eq('guru_id', userObj.id);
          
          if (pembData && pembData.length > 0) {
            setMyPembelajaran(pembData);
            const myKelasIds = [...new Set(pembData.map(p => Number(p.kelas_id)))];
            const myMapelIds = [...new Set(pembData.map(p => Number(p.mapel_id)))];
            
            kelases = kelases.filter(k => myKelasIds.includes(k.id));
            mapels = mapels.filter(m => myMapelIds.includes(m.id));
          } else {
            kelases = []; mapels = [];
          }
        }
      }
      setDataKelas(kelases);
      setDataMapel(mapels);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedKelasJson && myPembelajaran.length > 0) {
      const kelasObj = JSON.parse(selectedKelasJson);
      const allowedMapelIds = myPembelajaran.filter(p => Number(p.kelas_id) === kelasObj.id).map(p => Number(p.mapel_id));
      setDataMapel(rawMapels.filter(m => allowedMapelIds.includes(m.id)));
      
      if (selectedMapelJson) {
        const mapelObj = JSON.parse(selectedMapelJson);
        if (!allowedMapelIds.includes(mapelObj.id)) setSelectedMapelJson('');
      }
    } else if (!selectedKelasJson && myPembelajaran.length > 0) {
      const allMyMapelIds = [...new Set(myPembelajaran.map(p => Number(p.mapel_id)))];
      setDataMapel(rawMapels.filter(m => allMyMapelIds.includes(m.id)));
    }
  }, [selectedKelasJson, myPembelajaran, rawMapels]);

  const fetchSiswaDanNilai = async () => {
    if (!selectedKelasJson || !selectedMapelJson) return Alert.alert('Perhatian', 'Pilih Kelas dan Mata Pelajaran terlebih dahulu!');

    const kelasObj = JSON.parse(selectedKelasJson);
    const mapelObj = JSON.parse(selectedMapelJson);

    setIsLoading(true);
    try {
      const { data: tpData } = await supabase
        .from('tujuan_pembelajaran')
        .select('id, tujuan_pembelajaran')
        .eq('id_mapel', mapelObj.id)
        .eq('id_kelas', String(kelasObj.tingkat))
        .eq('semester', filterSemester)
        .eq('tahun_pelajaran', filterTahun)
        .eq('status', true);
        
      setDataTP(tpData || []);

      const { data: siswaData, error: siswaError } = await supabase
        .from('data_siswa')
        .select('id, nipd, nisn, nama')
        .eq('kelas', kelasObj.nama)
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (siswaError) throw siswaError;
      if (!siswaData || siswaData.length === 0) {
        setDataNilai([]);
        return Alert.alert('Info', 'Tidak ada siswa yang terdaftar di kelas ini.');
      }

      const nipdList = siswaData.map(s => s.nipd);
      const { data: existingNilai, error: nilaiError } = await supabase
        .from('nilai_siswa')
        .select('*')
        .eq('tahun_ajaran', filterTahun)
        .eq('semester', filterSemester)
        .eq('id_kelas', String(kelasObj.id))
        .eq('id_mapel', String(mapelObj.id))
        .in('nipd', nipdList);

      if (nilaiError) throw nilaiError;

      const combinedData = siswaData.map(siswa => {
        const nilaiSiswa = (existingNilai || []).filter(n => n.nipd === siswa.nipd);
        const tugas1 = nilaiSiswa.find(n => n.jenis_nilai === 'Tugas 1');
        const tugas2 = nilaiSiswa.find(n => n.jenis_nilai === 'Tugas 2');
        const tugas3 = nilaiSiswa.find(n => n.jenis_nilai === 'Tugas 3');
        const tugas4 = nilaiSiswa.find(n => n.jenis_nilai === 'Tugas 4');
        const pts = nilaiSiswa.find(n => n.jenis_nilai === 'PTS');
        const pas = nilaiSiswa.find(n => n.jenis_nilai === 'PAS');
        
        let rawCapaian = (tugas1?.id_tujuan_pemb || tugas2?.id_tujuan_pemb || tugas3?.id_tujuan_pemb || tugas4?.id_tujuan_pemb || pts?.id_tujuan_pemb || pas?.id_tujuan_pemb);
        let optimal = [];
        let peningkatan = [];
        if (rawCapaian) {
          try {
            const parsed = JSON.parse(rawCapaian);
            optimal = parsed.optimal || [];
            peningkatan = parsed.peningkatan || [];
          } catch(e) {}
        }

        return {
          id_siswa: siswa.id,
          nipd: siswa.nipd,
          nisn: siswa.nisn,
          nama_lengkap: siswa.nama,
          nilai_tugas_1: tugas1 ? String(tugas1.nilai_siswa) : '',
          nilai_tugas_2: tugas2 ? String(tugas2.nilai_siswa) : '',
          nilai_tugas_3: tugas3 ? String(tugas3.nilai_siswa) : '',
          nilai_tugas_4: tugas4 ? String(tugas4.nilai_siswa) : '',
          nilai_pts: pts ? String(pts.nilai_siswa) : '',
          nilai_pas: pas ? String(pas.nilai_siswa) : '',
          capaian_optimal: optimal,
          capaian_peningkatan: peningkatan
        };
      });

      setDataNilai(combinedData);
    } catch (err: any) {
      Alert.alert('Error', `Gagal memuat data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (index: number, field: string, value: string) => {
    const newData = [...dataNilai];
    newData[index][field] = value;
    setDataNilai(newData);
  };

  const handleCheckboxChange = (index: number, listName: string, tpId: number) => {
    const newData = [...dataNilai];
    const currentList = newData[index][listName] || [];
    if (currentList.includes(tpId)) {
      newData[index][listName] = currentList.filter((id: number) => id !== tpId);
    } else {
      newData[index][listName] = [...currentList, tpId];
    }
    setDataNilai(newData);
  };

  const handleSimpan = async () => {
    if (dataNilai.length === 0) return;
    setIsSaving(true);
    try {
      const kelasObj = JSON.parse(selectedKelasJson);
      const mapelObj = JSON.parse(selectedMapelJson);
      const payload: any[] = [];
      const nik_guru = 'admin'; 

      dataNilai.forEach(siswa => {
        let capaianValue = null;
        if (siswa.capaian_optimal?.length || siswa.capaian_peningkatan?.length) {
          capaianValue = JSON.stringify({ optimal: siswa.capaian_optimal || [], peningkatan: siswa.capaian_peningkatan || [] });
        }

        const baseRow = {
          tahun_ajaran: filterTahun, semester: filterSemester,
          id_kelas: String(kelasObj.id), id_mapel: String(mapelObj.id),
          nipd: siswa.nipd, id_tujuan_pemb: capaianValue, nik_guru
        };

        if (siswa.nilai_tugas_1 !== '') payload.push({ ...baseRow, jenis_nilai: 'Tugas 1', nilai_siswa: parseInt(siswa.nilai_tugas_1) || 0 });
        if (siswa.nilai_tugas_2 !== '') payload.push({ ...baseRow, jenis_nilai: 'Tugas 2', nilai_siswa: parseInt(siswa.nilai_tugas_2) || 0 });
        if (siswa.nilai_tugas_3 !== '') payload.push({ ...baseRow, jenis_nilai: 'Tugas 3', nilai_siswa: parseInt(siswa.nilai_tugas_3) || 0 });
        if (siswa.nilai_tugas_4 !== '') payload.push({ ...baseRow, jenis_nilai: 'Tugas 4', nilai_siswa: parseInt(siswa.nilai_tugas_4) || 0 });
        if (siswa.nilai_pts !== '') payload.push({ ...baseRow, jenis_nilai: 'PTS', nilai_siswa: parseInt(siswa.nilai_pts) || 0 });
        if (siswa.nilai_pas !== '') payload.push({ ...baseRow, jenis_nilai: 'PAS', nilai_siswa: parseInt(siswa.nilai_pas) || 0 });
      });

      if (payload.length > 0) {
        const nipdList = [...new Set(payload.map(p => p.nipd))];
        const jenisList = [...new Set(payload.map(p => p.jenis_nilai))];
        
        await supabase.from('nilai_siswa').delete()
          .eq('tahun_ajaran', filterTahun)
          .eq('semester', filterSemester)
          .eq('id_kelas', String(kelasObj.id))
          .eq('id_mapel', String(mapelObj.id))
          .in('nipd', nipdList)
          .in('jenis_nilai', jenisList);

        const { error } = await supabase.from('nilai_siswa').insert(payload);
        if (error) throw error;
      }
      Alert.alert('Berhasil', 'Data nilai berhasil disimpan.');
    } catch (err: any) {
      Alert.alert('Error', `Gagal menyimpan nilai: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const ranksMap: any = {};
  if (dataNilai.length > 0) {
    const scoredData = dataNilai.map(item => {
      const scores = [
        parseFloat(item.nilai_tugas_1), parseFloat(item.nilai_tugas_2),
        parseFloat(item.nilai_tugas_3), parseFloat(item.nilai_tugas_4),
        parseFloat(item.nilai_pts), parseFloat(item.nilai_pas)
      ].filter(v => !isNaN(v));

      const total = scores.reduce((sum, v) => sum + v, 0);
      const avg = scores.length > 0 ? (total / scores.length) : 0;
      return { nipd: item.nipd, avg: avg };
    });
    scoredData.sort((a, b) => b.avg - a.avg);
    let currentRank = 1;
    scoredData.forEach((sd, index) => {
      if (index > 0 && sd.avg < scoredData[index-1].avg) currentRank = index + 1;
      ranksMap[sd.nipd] = { rank: currentRank, avg: sd.avg };
    });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Input Nilai</Text>
        </View>
        <Text style={styles.headerSubtitle}>Masukkan nilai akademik siswa.</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        
        {/* SECTION 1: FILTER (Tidak Sticky) */}
        <View style={styles.filterCard}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Tahun Ajaran</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={filterTahun} onValueChange={(v) => { setFilterTahun(v); setDataNilai([]); }}>
                  <Picker.Item label={`${currentYear-1}/${currentYear}`} value={`${currentYear-1}/${currentYear}`} />
                  <Picker.Item label={`${currentYear}/${currentYear+1}`} value={`${currentYear}/${currentYear+1}`} />
                </Picker>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Semester</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={filterSemester} onValueChange={(v) => { setFilterSemester(v); setDataNilai([]); }}>
                  <Picker.Item label="Ganjil" value="Ganjil" />
                  <Picker.Item label="Genap" value="Genap" />
                </Picker>
              </View>
            </View>
          </View>

          <Text style={styles.filterLabel}>Kelas</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedKelasJson} onValueChange={(v) => { setSelectedKelasJson(v); setDataNilai([]); }}>
              <Picker.Item label="-- Pilih Kelas --" value="" />
              {dataKelas.map((k, idx) => <Picker.Item key={idx} label={k.nama_kelas} value={JSON.stringify({id: k.id, nama: k.nama_kelas, tingkat: k.tingkat})} />)}
            </Picker>
          </View>

          <Text style={styles.filterLabel}>Mata Pelajaran</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedMapelJson} onValueChange={(v) => { setSelectedMapelJson(v); setDataNilai([]); }}>
              <Picker.Item label="-- Pilih Mapel --" value="" />
              {dataMapel.map((m, idx) => <Picker.Item key={idx} label={m.nama_mapel} value={JSON.stringify({id: m.id, nama: m.nama_mapel})} />)}
            </Picker>
          </View>

          <TouchableOpacity style={styles.btnFetch} onPress={fetchSiswaDanNilai} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnFetchText}>Tampilkan Siswa</Text>}
          </TouchableOpacity>
        </View>

        {/* SECTION 2: TABLE CONTAINER (Sticky padding/margin trick to allow smooth scrolling) */}
        <View />

        {/* SECTION 3: THE ACTUAL TABLE */}
        {dataNilai.length > 0 && (
          <View style={styles.tableCardWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View style={styles.tableBox}>
                
                {/* TABLE HEADER */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>No</Text>
                  <Text style={[styles.thCell, { width: 200 }]}>Nama Siswa</Text>
                  <Text style={[styles.thCell, { width: 70, textAlign: 'center' }]}>Tugas 1</Text>
                  <Text style={[styles.thCell, { width: 70, textAlign: 'center' }]}>Tugas 2</Text>
                  <Text style={[styles.thCell, { width: 70, textAlign: 'center' }]}>Tugas 3</Text>
                  <Text style={[styles.thCell, { width: 70, textAlign: 'center' }]}>Tugas 4</Text>
                  <Text style={[styles.thCell, { width: 70, textAlign: 'center' }]}>PTS</Text>
                  <Text style={[styles.thCell, { width: 70, textAlign: 'center' }]}>PAS</Text>
                  <Text style={[styles.thCell, { width: 70, textAlign: 'center' }]}>Rapor</Text>
                  <Text style={[styles.thCell, { width: 60, textAlign: 'center' }]}>Rank</Text>
                  <Text style={[styles.thCell, { width: 300 }]}>TP Optimal (Hijau)</Text>
                  <Text style={[styles.thCell, { width: 300 }]}>TP Peningkatan (Merah)</Text>
                </View>

                {/* TABLE BODY */}
                {dataNilai.map((item, idx) => (
                  <View key={item.id_siswa} style={styles.tableRow}>
                    <Text style={[styles.tdCell, { width: 40, textAlign: 'center', alignSelf: 'flex-start' }]}>{idx + 1}</Text>
                    
                    <View style={[styles.tdCell, { width: 200, alignSelf: 'flex-start' }]}>
                      <Text style={styles.studentName}>{item.nama_lengkap}</Text>
                      <Text style={styles.studentSub}>{item.nisn} / {item.nipd}</Text>
                    </View>

                    <View style={[styles.tdCell, { width: 70, alignSelf: 'flex-start' }]}>
                      <TextInput 
                        style={styles.scoreInput} keyboardType="numeric" 
                        value={item.nilai_tugas_1} onChangeText={t => handleInputChange(idx, 'nilai_tugas_1', t)} 
                      />
                    </View>

                    <View style={[styles.tdCell, { width: 70, alignSelf: 'flex-start' }]}>
                      <TextInput 
                        style={styles.scoreInput} keyboardType="numeric" 
                        value={item.nilai_tugas_2} onChangeText={t => handleInputChange(idx, 'nilai_tugas_2', t)} 
                      />
                    </View>

                    <View style={[styles.tdCell, { width: 70, alignSelf: 'flex-start' }]}>
                      <TextInput 
                        style={styles.scoreInput} keyboardType="numeric" 
                        value={item.nilai_tugas_3} onChangeText={t => handleInputChange(idx, 'nilai_tugas_3', t)} 
                      />
                    </View>

                    <View style={[styles.tdCell, { width: 70, alignSelf: 'flex-start' }]}>
                      <TextInput 
                        style={styles.scoreInput} keyboardType="numeric" 
                        value={item.nilai_tugas_4} onChangeText={t => handleInputChange(idx, 'nilai_tugas_4', t)} 
                      />
                    </View>

                    <View style={[styles.tdCell, { width: 70, alignSelf: 'flex-start' }]}>
                      <TextInput 
                        style={styles.scoreInput} keyboardType="numeric" 
                        value={item.nilai_pts} onChangeText={t => handleInputChange(idx, 'nilai_pts', t)} 
                      />
                    </View>

                    <View style={[styles.tdCell, { width: 70, alignSelf: 'flex-start' }]}>
                      <TextInput 
                        style={styles.scoreInput} keyboardType="numeric" 
                        value={item.nilai_pas} onChangeText={t => handleInputChange(idx, 'nilai_pas', t)} 
                      />
                    </View>

                    <View style={[styles.tdCell, { width: 70, alignItems: 'center', alignSelf: 'flex-start', paddingTop: 6 }]}>
                      <Text style={styles.raporText}>{ranksMap[item.nipd]?.avg?.toFixed(1) || '-'}</Text>
                    </View>

                    <View style={[styles.tdCell, { width: 60, alignItems: 'center', alignSelf: 'flex-start', paddingTop: 6 }]}>
                      <Text style={styles.rankText}>{ranksMap[item.nipd]?.rank || '-'}</Text>
                    </View>

                    {/* CAPAIAN OPTIMAL */}
                    <View style={[styles.tdCell, { width: 300 }]}>
                      {dataTP.length === 0 ? <Text style={styles.emptyTP}>Belum ada TP</Text> : dataTP.map(tp => (
                        <TouchableOpacity key={tp.id} style={styles.tpCheckboxRow} onPress={() => handleCheckboxChange(idx, 'capaian_optimal', tp.id)}>
                          {item.capaian_optimal?.includes(tp.id) ? <CheckSquare color="#10b981" size={18} /> : <Square color="#d1d5db" size={18} />}
                          <Text style={styles.tpText}>{tp.tujuan_pembelajaran}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* CAPAIAN PENINGKATAN */}
                    <View style={[styles.tdCell, { width: 300 }]}>
                      {dataTP.length === 0 ? <Text style={styles.emptyTP}>Belum ada TP</Text> : dataTP.map(tp => (
                        <TouchableOpacity key={tp.id} style={styles.tpCheckboxRow} onPress={() => handleCheckboxChange(idx, 'capaian_peningkatan', tp.id)}>
                          {item.capaian_peningkatan?.includes(tp.id) ? <CheckSquare color="#ef4444" size={18} /> : <Square color="#d1d5db" size={18} />}
                          <Text style={styles.tpText}>{tp.tujuan_pembelajaran}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                  </View>
                ))}

              </View>
            </ScrollView>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Save Button */}
      {dataNilai.length > 0 && (
        <View style={styles.floatingAction}>
          <TouchableOpacity style={styles.btnSaveFull} onPress={handleSimpan} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <><Save color="#fff" size={20} /><Text style={styles.btnSaveFullText}>Simpan Semua Nilai</Text></>}
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

  tableCardWrapper: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tableBox: { minWidth: 1000 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#eef2ff', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#c7d2fe' },
  thCell: { fontSize: 13, fontWeight: 'bold', color: '#1e3a8a', paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tdCell: { paddingHorizontal: 8, justifyContent: 'center' },
  
  studentName: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  studentSub: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  
  scoreInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, fontSize: 13, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', width: '100%' },
  raporText: { fontSize: 16, fontWeight: 'bold', color: '#2a2c87' },
  rankText: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },

  tpCheckboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  tpText: { flex: 1, fontSize: 12, color: '#4b5563', lineHeight: 18 },
  emptyTP: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },

  floatingAction: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  btnSaveFull: { backgroundColor: '#2a2c87', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  btnSaveFullText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
