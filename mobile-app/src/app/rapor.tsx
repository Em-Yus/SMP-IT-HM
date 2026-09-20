import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { ChevronLeft, Printer, Search } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function RaporGuru() {
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const [filterTahun, setFilterTahun] = useState(defaultTahun);
  const [filterSemester, setFilterSemester] = useState('Ganjil');
  
  const [dataKelas, setDataKelas] = useState<any[]>([]);
  const [selectedKelasJson, setSelectedKelasJson] = useState('');
  
  const [dataSiswa, setDataSiswa] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    fetchMasterData();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      fetchMasterData();
    });

    return () => listener.remove();
  }, []);

  const fetchMasterData = async () => {
    try {
      let { data } = await supabase.from('data_kelas').select('*').order('nama_kelas', { ascending: true });
      
      const userSession = await AsyncStorage.getItem('user_guru');
      const userPerms = await AsyncStorage.getItem('user_permissions');
      let permissions: string[] = [];
      if (userPerms) permissions = JSON.parse(userPerms);

      if (userSession) {
        const userObj = JSON.parse(userSession);
        if (userObj?.id) {
           const isAdmin = permissions.includes('*');
           if (!isAdmin) {
              data = data?.filter(k => String(k.wali_kelas_id) === String(userObj.id)) || [];
           }
        }
      }
      setDataKelas(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFetchSiswa = async () => {
    if (!selectedKelasJson) {
      return Alert.alert('Perhatian', 'Pilih Kelas terlebih dahulu!');
    }

    const kelasObj = JSON.parse(selectedKelasJson);

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('kelas', kelasObj.nama_kelas)
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (error) throw error;
      setDataSiswa(data || []);
      if (!data || data.length === 0) {
        Alert.alert('Info', 'Tidak ada siswa aktif di kelas ini.');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', `Gagal memuat data siswa: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGlobalDataForPrint = async (targetNipds: string[], targetSiswaIds: string[]) => {
    const { data: lembagaData } = await supabase.from('data_lembaga').select('*').limit(1).single();
    const { data: mapelData } = await supabase.from('data_mapel').select('*').order('urutan', { ascending: true });
    
    const { data: nilaiData } = await supabase.from('nilai_siswa').select('*')
      .in('nipd', targetNipds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
    
    const tpIds: string[] = [];
    nilaiData?.forEach(n => {
      if (n.id_tujuan_pembelajaran) n.id_tujuan_pembelajaran.split(',').forEach((id: string) => tpIds.push(id.trim()));
    });
    let tpData: any[] = [];
    if (tpIds.length > 0) {
      const { data } = await supabase.from('tujuan_pembelajaran').select('id, tujuan_pembelajaran').in('id', [...new Set(tpIds)]);
      tpData = data || [];
    }
    
    const { data: ekskulData } = await supabase.from('anggota_ekskul')
      .select(`siswa_id, keterangan, data_ekskul ( nama_ekskul )`)
      .in('siswa_id', targetSiswaIds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
    
    const { data: kokuData } = await supabase.from('anggota_kokurikuler')
      .select(`siswa_id, data_kokurikuler ( nama_kegiatan )`)
      .in('siswa_id', targetSiswaIds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
    
    const { data: presensiData } = await supabase.from('presensi_siswa')
      .select('siswa_id, status')
      .in('siswa_id', targetSiswaIds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
    
    const { data: catatanData } = await supabase.from('catatan_wali')
      .select('*')
      .in('nipd', targetNipds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);

    return { lembagaData, mapelData, nilaiData, tpData, ekskulData, kokuData, presensiData, catatanData };
  };

  const generateHTML = (siswa: any, globals: any, kelasObj: any) => {
    const { lembagaData, mapelData, nilaiData, tpData, ekskulData, kokuData, presensiData, catatanData } = globals;

    const nilaiSiswa = nilaiData?.filter((n: any) => n.nipd === siswa.nipd) || [];
    
    const mapelWithNilai = (mapelData || []).map((m: any) => {
      const nilaiMapel = nilaiSiswa.filter((n: any) => String(n.id_mapel) === String(m.id));
      let total = 0;
      let count = 0;
      let tps: string[] = [];

      ['Tugas 1', 'Tugas 2', 'Tugas 3', 'Tugas 4', 'PTS', 'PAS'].forEach(jenis => {
        const n = nilaiMapel.find((x: any) => x.jenis_nilai === jenis);
        if (n && n.nilai_siswa !== null) {
          total += Number(n.nilai_siswa);
          count++;
        }
        if (n && n.id_tujuan_pembelajaran) {
          try {
             const parsed = JSON.parse(n.id_tujuan_pembelajaran);
             const optimal = parsed.optimal || [];
             optimal.forEach((id: any) => {
               const tpObj = tpData?.find((t: any) => String(t.id) === String(id));
               if (tpObj && !tps.includes(tpObj.tujuan_pembelajaran)) {
                 tps.push(tpObj.tujuan_pembelajaran);
               }
             });
          } catch(e) {}
        }
      });

      const nilaiAkhir = count > 0 ? Math.round(total / count) : null;
      let capaian_kompetensi = null;
      if (tps.length > 0) {
        capaian_kompetensi = `Mencapai Kompetensi dengan sangat baik dalam hal ${tps.join(', ')}.`;
      }

      return { ...m, nilai_akhir: nilaiAkhir, capaian_kompetensi };
    });

    const mapelWajib = mapelWithNilai.filter((m: any) => m.kelompok?.toLowerCase().includes('wajib') || !m.kelompok || m.kelompok === 'A' || m.kelompok === 'B');
    const mapelPilihan = mapelWithNilai.filter((m: any) => m.kelompok?.toLowerCase().includes('pilihan') || m.kelompok === 'C');

    const ekskulSiswa = ekskulData?.filter((e: any) => e.siswa_id === siswa.id) || [];
    const kokuSiswa = kokuData?.filter((k: any) => k.siswa_id === siswa.id) || [];
    
    const presensiSiswa = presensiData?.filter((p: any) => p.siswa_id === siswa.id) || [];
    const presensi = { sakit: 0, izin: 0, alpha: 0 };
    presensiSiswa.forEach((p: any) => {
      if (p.status === 'Sakit') presensi.sakit++;
      if (p.status === 'Izin') presensi.izin++;
      if (p.status === 'Alpha') presensi.alpha++;
    });

    const catatanSiswa = catatanData?.find((c: any) => c.nipd === siswa.nipd);

    const renderMapelRow = (m: any, index: number) => `
      <tr>
        <td class="border border-black px-2 py-1 text-center align-top">${index + 1}</td>
        <td class="border border-black px-2 py-1 align-top">${m.nama_mapel}</td>
        <td class="border border-black px-2 py-1 text-center align-top font-semibold">${m.nilai_akhir || '-'}</td>
        <td class="border border-black px-2 py-1 align-top text-justify text-sm">${m.capaian_kompetensi || '-'}</td>
      </tr>
    `;

    const renderFooter = (halaman: number) => `
      <div class="text-xs font-mono mt-auto pt-4 border-t-2 border-black flex justify-between w-full">
        <span>${kelasObj?.nama_kelas} | <span class="font-bold uppercase">${siswa?.nama}</span> | ${siswa?.nipd}</span>
        <span>Halaman : ${halaman}</span>
      </div>
    `;

    const dateString = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const lokasi = lembagaData?.alamat?.split('Kec.')[0]?.split('Desa ')[1]?.trim() || 'Subang';

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rapor ${siswa.nama}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              @page { size: A4; margin: 20mm; }
              body { font-family: serif; font-size: 11pt; }
              .page-break { page-break-after: always; }
          </style>
      </head>
      <body class="bg-white text-black">
          <!-- Page 1 -->
          <div class="page-break flex flex-col" style="min-height: 250mm;">
              <div class="flex-grow">
                  <div class="mb-4">
                      <table class="w-full text-sm">
                          <tr>
                              <td class="w-32 py-0.5">Nama Murid</td><td class="w-4 py-0.5">:</td><td class="py-0.5 uppercase font-semibold">${siswa?.nama}</td>
                              <td class="w-32 py-0.5 pl-4">Kelas</td><td class="w-4 py-0.5">:</td><td class="py-0.5">${kelasObj?.nama_kelas || '-'}</td>
                          </tr>
                          <tr>
                              <td class="py-0.5">NIS/NISN</td><td class="py-0.5">:</td><td class="py-0.5">${siswa?.nipd} / ${siswa?.nisn}</td>
                              <td class="py-0.5 pl-4">Fase</td><td class="py-0.5">:</td><td class="py-0.5">D</td>
                          </tr>
                          <tr>
                              <td class="py-0.5">Sekolah</td><td class="py-0.5">:</td><td class="py-0.5">${lembagaData?.nama_lembaga || ''}</td>
                              <td class="py-0.5 pl-4">Semester</td><td class="py-0.5">:</td><td class="py-0.5">${filterSemester === 'Ganjil' ? '1 (Ganjil)' : '2 (Genap)'}</td>
                          </tr>
                          <tr>
                              <td class="py-0.5 align-top">Alamat</td><td class="py-0.5 align-top">:</td><td class="py-0.5 capitalize">${lembagaData?.alamat || ''}</td>
                              <td class="py-0.5 pl-4 align-top">Tahun Ajaran</td><td class="py-0.5 align-top">:</td><td class="py-0.5 align-top">${filterTahun}</td>
                          </tr>
                      </table>
                  </div>

                  <h2 class="text-center font-bold text-lg mb-4 mt-6">LAPORAN HASIL BELAJAR</h2>

                  <table class="w-full border-collapse border border-black text-sm mb-4">
                      <thead>
                          <tr class="bg-gray-100 font-bold">
                              <th class="border border-black py-2 w-10 text-center">No</th>
                              <th class="border border-black py-2 w-48 text-center">Mata Pelajaran</th>
                              <th class="border border-black py-2 w-20 text-center">Nilai Akhir</th>
                              <th class="border border-black py-2 text-center">Capaian Kompetensi</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr><td colspan="4" class="border border-black px-2 py-1 font-bold bg-gray-50">Mata Pelajaran Wajib</td></tr>
                          ${mapelWajib.length > 0 ? mapelWajib.map(renderMapelRow).join('') : '<tr><td colspan="4" class="border border-black px-2 py-1 text-center italic">Tidak ada data</td></tr>'}
                          
                          <tr><td colspan="4" class="border border-black px-2 py-1 font-bold bg-gray-50">Mata Pelajaran Pilihan</td></tr>
                          ${mapelPilihan.length > 0 ? mapelPilihan.map(renderMapelRow).join('') : '<tr><td colspan="4" class="border border-black px-2 py-1 text-center italic">Tidak ada data</td></tr>'}
                      </tbody>
                  </table>
              </div>
              ${renderFooter(1)}
          </div>

          <!-- Page 2 -->
          <div class="flex flex-col pt-8" style="min-height: 250mm;">
              <div class="flex-grow">
                  <!-- KOKURIKULER -->
                  <table class="w-full border-collapse border border-black text-sm mb-6">
                      <thead>
                          <tr class="bg-gray-100 font-bold"><th class="border border-black py-2 text-center">Kokurikuler</th></tr>
                      </thead>
                      <tbody>
                          <tr>
                              <td class="border border-black px-4 py-4 min-h-[60px] align-top">
                                  ${kokuSiswa.length > 0 ? `<ul class="list-disc pl-5">${kokuSiswa.map((k: any) => `<li class="mb-1">${k.data_kokurikuler?.nama_kegiatan}</li>`).join('')}</ul>` : '<span class="italic text-gray-500">Tidak ada catatan kegiatan kokurikuler.</span>'}
                              </td>
                          </tr>
                      </tbody>
                  </table>

                  <!-- EKSKUL -->
                  <table class="w-full border-collapse border border-black text-sm mb-6">
                      <thead>
                          <tr class="bg-gray-100 font-bold">
                              <th class="border border-black py-2 w-10 text-center">No</th>
                              <th class="border border-black py-2 w-48 text-center">Ekstrakurikuler</th>
                              <th class="border border-black py-2 text-center">Keterangan</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${ekskulSiswa.length > 0 ? ekskulSiswa.map((e: any, i: number) => `
                          <tr>
                              <td class="border border-black px-2 py-1 text-center">${i + 1}</td>
                              <td class="border border-black px-2 py-1">${e.data_ekskul?.nama_ekskul}</td>
                              <td class="border border-black px-2 py-1">${e.keterangan || 'Baik'}</td>
                          </tr>`).join('') : '<tr><td class="border border-black px-2 py-1 text-center">1</td><td class="border border-black px-2 py-1">-</td><td class="border border-black px-2 py-1">-</td></tr>'}
                      </tbody>
                  </table>

                  <div class="flex gap-4 mb-6">
                      <div class="w-1/3">
                          <table class="w-full border-collapse border border-black text-sm">
                              <thead><tr class="bg-gray-100 font-bold"><th colspan="3" class="border border-black py-2 text-center">Ketidakhadiran</th></tr></thead>
                              <tbody>
                                  <tr><td class="border border-black px-2 py-1">Sakit</td><td class="border border-black px-2 py-1 text-center w-6">:</td><td class="border border-black px-2 py-1 text-right">${presensi.sakit} hari</td></tr>
                                  <tr><td class="border border-black px-2 py-1">Izin</td><td class="border border-black px-2 py-1 text-center">:</td><td class="border border-black px-2 py-1 text-right">${presensi.izin} hari</td></tr>
                                  <tr><td class="border border-black px-2 py-1">Tanpa Keterangan</td><td class="border border-black px-2 py-1 text-center">:</td><td class="border border-black px-2 py-1 text-right">${presensi.alpha} hari</td></tr>
                              </tbody>
                          </table>
                      </div>
                      <div class="w-2/3">
                          <table class="w-full border-collapse border border-black text-sm h-full">
                              <thead><tr class="bg-gray-100 font-bold"><th class="border border-black py-2 text-center">Catatan Wali Kelas</th></tr></thead>
                              <tbody>
                                  <tr><td class="border border-black px-3 py-2 align-top h-[76px]">${catatanSiswa?.catatan || ''}</td></tr>
                              </tbody>
                          </table>
                      </div>
                  </div>

                  ${filterSemester === 'Genap' ? `<div class="border border-black p-3 mb-6 text-center font-bold text-sm">Keterangan Kenaikan Kelas : ${catatanSiswa?.kenaikan_kelas || '...........................................'}</div>` : ''}

                  <!-- TANGGAPAN ORTU -->
                  <table class="w-full border-collapse border border-black text-sm mb-12">
                      <thead><tr class="bg-gray-100 font-bold"><th class="border border-black py-2 text-center">Tanggapan Orang Tua/Wali Murid</th></tr></thead>
                      <tbody><tr><td class="border border-black px-2 py-1 h-[80px]"></td></tr></tbody>
                  </table>

                  <div class="flex justify-between text-sm px-8 mb-4">
                      <div class="text-center w-48"><p class="mb-20">Orang Tua Murid</p><p class="border-b border-black inline-block w-full"></p></div>
                      <div class="text-center w-48"><p class="mb-20">${lokasi}, ${dateString}<br/>Wali Kelas</p><p class="border-b border-black inline-block w-full font-bold">${kelasObj?.wali_kelas_nama || ''}</p></div>
                  </div>
                  <div class="flex justify-center text-sm px-8 mb-8">
                      <div class="text-center w-64"><p class="mb-20">Mengetahui,<br/>Kepala Sekolah</p><p class="font-bold underline">${lembagaData?.kepala_sekolah || ''}</p><p>NIP. ${lembagaData?.nip_kepsek || '-'}</p></div>
                  </div>
              </div>
              ${renderFooter(2)}
          </div>
      </body>
      </html>
    `;
    return html;
  };

  const handleCetakRapor = async (siswa: any) => {
    setIsPrinting(true);
    try {
      const kelasObj = JSON.parse(selectedKelasJson);
      const globals = await fetchGlobalDataForPrint([siswa.nipd], [siswa.id]);
      
      const htmlContent = generateHTML(siswa, globals, kelasObj);
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });
      
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: `Rapor_${siswa.nama}.pdf` });
      
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', `Gagal memuat atau membagikan rapor: ${err.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Cetak Rapor</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola cetakan Laporan Hasil Belajar.</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.filterCard}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Tahun Ajaran</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={filterTahun} onValueChange={(v) => { setFilterTahun(v); setDataSiswa([]); }}>
                  <Picker.Item label={`${currentYear-1}/${currentYear}`} value={`${currentYear-1}/${currentYear}`} />
                  <Picker.Item label={`${currentYear}/${currentYear+1}`} value={`${currentYear}/${currentYear+1}`} />
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
              {dataKelas.map((k, idx) => <Picker.Item key={idx} label={k.nama_kelas} value={JSON.stringify(k)} />)}
            </Picker>
          </View>

          <TouchableOpacity style={styles.btnFetch} onPress={handleFetchSiswa} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <><Search color="#fff" size={20} /><Text style={styles.btnFetchText}>Tampilkan Siswa</Text></>}
          </TouchableOpacity>
        </View>

        {dataSiswa.length > 0 && (
          <View style={styles.listCard}>
             <Text style={styles.listHeaderTitle}>Daftar Siswa - Kelas {JSON.parse(selectedKelasJson).nama_kelas}</Text>
             {dataSiswa.map((siswa, idx) => (
                <View key={siswa.id} style={styles.studentItem}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentIndex}>{idx + 1}.</Text>
                    <View style={{flex: 1}}>
                       <Text style={styles.studentName}>{siswa.nama}</Text>
                       <Text style={styles.studentNipd}>{siswa.nipd} / {siswa.nisn}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.btnPrint} onPress={() => handleCetakRapor(siswa)} disabled={isPrinting}>
                     <Printer color="#10b981" size={18} />
                     <Text style={styles.btnPrintText}>Cetak</Text>
                  </TouchableOpacity>
                </View>
             ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {isPrinting && (
        <View style={styles.overlay}>
           <ActivityIndicator size="large" color="#ffffff" />
           <Text style={styles.overlayText}>Menyiapkan PDF Rapor...</Text>
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
  btnFetch: { backgroundColor: '#2a2c87', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 8 },
  btnFetchText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  listCard: { backgroundColor: '#fff', borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, padding: 16 },
  listHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 8 },
  studentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  studentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  studentIndex: { fontSize: 15, fontWeight: 'bold', color: '#9ca3af', width: 30 },
  studentName: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  studentNipd: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  btnPrint: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0', gap: 6 },
  btnPrintText: { color: '#10b981', fontWeight: 'bold', fontSize: 13 },
  
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  overlayText: { color: '#fff', marginTop: 12, fontSize: 16, fontWeight: 'bold' }
});
