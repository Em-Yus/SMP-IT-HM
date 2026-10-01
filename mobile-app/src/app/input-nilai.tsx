import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { ChevronLeft, Save, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Input Nilai</Text>
        </View>
        <Text style={styles.headerSubtitle}>Masukkan nilai akademik siswa.</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        
        {/* SECTION 1: FILTER (Card Filter Tetap) */}
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

        {/* SECTION 2: DAFTAR KARTU NILAI SISWA (Sesuai Desain Gambar) */}
        {dataNilai.length > 0 && (
          <View style={styles.cardListContainer}>
            {dataNilai.map((item, idx) => {
              const studentRank = ranksMap[item.nipd];
              const avgVal = studentRank?.avg;
              const avgDisplay = avgVal && avgVal > 0 ? (avgVal % 1 === 0 ? avgVal.toFixed(0) : avgVal.toFixed(1)) : '0';
              const rankDisplay = avgVal && avgVal > 0 ? String(studentRank?.rank || '0') : '0';

              return (
                <View key={item.id_siswa || item.nipd} style={styles.studentCard}>
                  {/* Baris Atas: Nama Siswa & NISN/NIPD (Kiri) | Rata-rata & Rank (Kanan) */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.studentInfoCol}>
                      <Text style={styles.studentNameTitle} numberOfLines={2}>
                        {idx + 1}. {item.nama_lengkap}
                      </Text>
                      <Text style={styles.studentNisnNipd}>
                        {item.nisn ? item.nisn : '-'} / {item.nipd ? item.nipd : '-'}
                      </Text>
                    </View>

                    <View style={styles.statBadgesRow}>
                      {/* Box Rata-rata */}
                      <View style={styles.statBoxCol}>
                        <Text style={styles.statLabel}>Rata-rata</Text>
                        <View style={styles.avgBox}>
                          <Text style={styles.avgText}>{avgDisplay}</Text>
                        </View>
                      </View>

                      {/* Box Rank */}
                      <View style={styles.statBoxCol}>
                        <Text style={styles.statLabel}>Rank</Text>
                        <View style={styles.rankBox}>
                          <Text style={styles.rankText}>{rankDisplay}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Baris Nilai: 6 Kolom Sejajar (Tugas 1, Tugas 2, Tugas 3, Tugas 4, UTS, UAS) */}
                  <View style={styles.scoresRow}>
                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>Tugas 1</Text>
                      <TextInput
                        style={styles.scoreInputField}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={item.nilai_tugas_1}
                        onChangeText={(t) => handleInputChange(idx, 'nilai_tugas_1', t)}
                      />
                    </View>

                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>Tugas 2</Text>
                      <TextInput
                        style={styles.scoreInputField}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={item.nilai_tugas_2}
                        onChangeText={(t) => handleInputChange(idx, 'nilai_tugas_2', t)}
                      />
                    </View>

                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>Tugas 3</Text>
                      <TextInput
                        style={styles.scoreInputField}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={item.nilai_tugas_3}
                        onChangeText={(t) => handleInputChange(idx, 'nilai_tugas_3', t)}
                      />
                    </View>

                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>Tugas 4</Text>
                      <TextInput
                        style={styles.scoreInputField}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={item.nilai_tugas_4}
                        onChangeText={(t) => handleInputChange(idx, 'nilai_tugas_4', t)}
                      />
                    </View>

                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>UTS</Text>
                      <TextInput
                        style={styles.scoreInputField}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={item.nilai_pts}
                        onChangeText={(t) => handleInputChange(idx, 'nilai_pts', t)}
                      />
                    </View>

                    <View style={styles.scoreCol}>
                      <Text style={styles.scoreLabel}>UAS</Text>
                      <TextInput
                        style={styles.scoreInputField}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        value={item.nilai_pas}
                        onChangeText={(t) => handleInputChange(idx, 'nilai_pas', t)}
                      />
                    </View>
                  </View>

                  {/* Tujuan Pembelajaran yang tercapai */}
                  <Text style={styles.tpSectionTitle}>Tujuan Pembelajaran yang tercapai</Text>
                  
                  <View style={styles.tpContainerBox}>
                    {dataTP.length === 0 ? (
                      <Text style={styles.emptyTPText}>Belum ada data Tujuan Pembelajaran untuk kelas dan mapel ini</Text>
                    ) : (
                      dataTP.map((tp) => {
                        const isChecked = item.capaian_optimal?.includes(tp.id);
                        return (
                          <TouchableOpacity
                            key={tp.id}
                            style={styles.tpItemRow}
                            onPress={() => handleCheckboxChange(idx, 'capaian_optimal', tp.id)}
                            activeOpacity={0.7}
                          >
                            {isChecked ? (
                              <CheckCircle2 size={18} color="#2563EB" />
                            ) : (
                              <View style={styles.uncheckedCircle} />
                            )}
                            <Text style={[styles.tpItemText, isChecked && styles.tpItemTextChecked]}>
                              {tp.tujuan_pembelajaran}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Spacer di bawah agar konten terbawah tidak tertutup tombol simpan */}
        <View style={{ height: 130 + bottomPadding }} />
      </ScrollView>

      {/* Floating Save Button - Diangkat ke atas agar tidak tertutup navigasi bawaan Android */}
      {dataNilai.length > 0 && (
        <View style={[styles.floatingAction, { bottom: bottomPadding + 14 }]}>
          <TouchableOpacity style={styles.btnSaveFull} onPress={handleSimpan} disabled={isSaving} activeOpacity={0.85}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save color="#fff" size={20} />
                <Text style={styles.btnSaveFullText}>Simpan Semua Nilai</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#1E257F', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: '#ECEEFF', fontSize: 13 },
  
  content: { flex: 1, padding: 16 },
  filterCard: { backgroundColor: '#fff', padding: 16, borderRadius: 18, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  filterLabel: { fontSize: 12, fontWeight: 'bold', color: '#6C757D', marginBottom: 4 },
  pickerWrapper: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  btnFetch: { backgroundColor: '#1E257F', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnFetchText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  cardListContainer: { gap: 16 },
  studentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  studentInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  studentNameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1818',
    letterSpacing: -0.3,
  },
  studentNisnNipd: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6C757D',
    marginTop: 2,
  },
  statBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statBoxCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1818',
    marginBottom: 3,
  },
  avgBox: {
    borderWidth: 1.5,
    borderColor: '#00B4D8',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 3,
    paddingHorizontal: 12,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avgText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#00B4D8',
  },
  rankBox: {
    borderWidth: 1.5,
    borderColor: '#2EC4B6',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 3,
    paddingHorizontal: 12,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2EC4B6',
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
    marginTop: 14,
  },
  scoreCol: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1818',
    marginBottom: 4,
  },
  scoreInputField: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 2,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1818',
    textAlign: 'center',
  },
  tpSectionTitle: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1818',
    marginTop: 14,
    marginBottom: 8,
  },
  tpContainerBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8F9FA',
    padding: 12,
  },
  emptyTPText: {
    fontSize: 12,
    color: '#ADB5BD',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 6,
  },
  tpItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 8,
  },
  uncheckedCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#ADB5BD',
    backgroundColor: '#ffffff',
  },
  tpItemText: {
    flex: 1,
    fontSize: 12,
    color: '#6C757D',
    lineHeight: 18,
  },
  tpItemTextChecked: {
    color: '#1A1818',
    fontWeight: '500',
  },
  floatingAction: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  btnSaveFull: {
    backgroundColor: '#1E257F',
    paddingVertical: 15,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1E257F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  btnSaveFullText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
