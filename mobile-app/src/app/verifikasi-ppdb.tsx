import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, Switch, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { ChevronLeft, Search, CheckCircle, XCircle, Clock, CheckSquare, Trash2, UserCheck, X } from 'lucide-react-native';
import { router } from 'expo-router';

export default function VerifikasiPPDB() {
  const [dataPendaftar, setDataPendaftar] = useState<any[]>([]);
  const [dataKelas, setDataKelas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Stats
  const [stats, setStats] = useState({ total: 0, lengkap: 0, kurang: 0, belum: 0 });

  // Modals
  const [modalCeklisVisible, setModalCeklisVisible] = useState(false);
  const [modalTerimaVisible, setModalTerimaVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Verifikasi State
  const [editCeklis, setEditCeklis] = useState({
    formulir: false, ijazah: false, pindah: false, kk: false,
    akta: false, rapor: false, ktp: false, foto: false, pip: false
  });
  const [isSavingVerif, setIsSavingVerif] = useState(false);

  // Terima Siswa State
  const [inputNIPD, setInputNIPD] = useState('');
  const [inputKelas, setInputKelas] = useState('');
  const [isSavingTerima, setIsSavingTerima] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resPendaftar, resKelas] = await Promise.all([
        supabase.from('ppdb_pendaftar').select('*').order('created_at', { ascending: false }),
        supabase.from('data_kelas').select('*').order('nama_kelas', { ascending: true })
      ]);

      if (resPendaftar.error) throw resPendaftar.error;
      const processedData = resPendaftar.data || [];

      setDataPendaftar(processedData);
      setDataKelas(resKelas.data || []);
      
      setStats({
        total: processedData.length,
        lengkap: processedData.filter(d => d.status_berkas === 'Lengkap').length,
        kurang: processedData.filter(d => d.status_berkas === 'Kurang').length,
        belum: processedData.filter(d => d.status_berkas === 'Belum Verifikasi').length
      });
    } catch (err) {
      Alert.alert('Error', 'Gagal memuat data pendaftar');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\verifikasi-ppdb.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchData();
  
    });

    return () => listener.remove();
  }, []);

  // --- DELETE ---
  const handleDelete = (id: number, nama: string) => {
    Alert.alert('Hapus Pendaftar?', `Anda yakin ingin menghapus data ${nama}?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
          setIsLoading(true);
          try {
            const { error } = await supabase.from('ppdb_pendaftar').delete().eq('id', id);
            if (error) throw error;
            fetchData();
          } catch (err) {
            Alert.alert('Error', 'Gagal menghapus data');
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  // --- VERIFIKASI ---
  const openVerifikasiModal = (item: any) => {
    setSelectedItem(item);
    setEditCeklis({
      formulir: item.ceklis_formulir === 'Ada',
      ijazah: item.ceklis_ijazah === 'Ada',
      pindah: item.ceklis_pindah === 'Ada',
      kk: item.ceklis_kk === 'Ada',
      akta: item.ceklis_akta === 'Ada',
      rapor: item.ceklis_rapor === 'Ada',
      ktp: item.ceklis_ktp === 'Ada',
      foto: item.ceklis_foto === 'Ada',
      pip: item.ceklis_pip === 'Ada'
    });
    setModalCeklisVisible(true);
  };

  const saveVerifikasi = async () => {
    setIsSavingVerif(true);
    try {
      const isLengkap = editCeklis.formulir && (editCeklis.ijazah || editCeklis.pindah) && editCeklis.kk && editCeklis.akta;
      const kesimpulanStatus = isLengkap ? "Lengkap" : "Kurang";

      const payload = {
        status_berkas: kesimpulanStatus,
        ceklis_formulir: editCeklis.formulir ? "Ada" : "Tidak",
        ceklis_ijazah: editCeklis.ijazah ? "Ada" : "Tidak",
        ceklis_pindah: editCeklis.pindah ? "Ada" : "Tidak",
        ceklis_kk: editCeklis.kk ? "Ada" : "Tidak",
        ceklis_akta: editCeklis.akta ? "Ada" : "Tidak",
        ceklis_rapor: editCeklis.rapor ? "Ada" : "Tidak",
        ceklis_ktp: editCeklis.ktp ? "Ada" : "Tidak",
        ceklis_foto: editCeklis.foto ? "Ada" : "Tidak",
        ceklis_pip: editCeklis.pip ? "Ada" : "Tidak"
      };

      const { error } = await supabase.from('ppdb_pendaftar').update(payload).eq('id', selectedItem.id);
      if (error) throw error;

      Alert.alert('Berhasil', 'Verifikasi berkas tersimpan.');
      setModalCeklisVisible(false);
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan verifikasi');
    } finally {
      setIsSavingVerif(false);
    }
  };

  // --- TERIMA SISWA ---
  const openTerimaModal = (item: any) => {
    if (item.status_berkas !== 'Lengkap') {
      Alert.alert('Belum Lengkap', 'Pastikan berkas fisik calon siswa sudah terverifikasi "Lengkap" sebelum diterima.');
      return;
    }
    setSelectedItem(item);
    setInputNIPD('');
    setInputKelas(dataKelas.length > 0 ? dataKelas[0].nama_kelas : '');
    setModalTerimaVisible(true);
  };

  const handleTerimaSiswa = async () => {
    if (!inputNIPD) return Alert.alert('Error', 'NIPD harus diisi!');
    if (!inputKelas) return Alert.alert('Error', 'Pilih kelas penempatan!');

    setIsSavingTerima(true);
    try {
      const { data: checkPendaftar, error: checkErr } = await supabase
        .from('ppdb_pendaftar')
        .select('id')
        .eq('id', selectedItem.id)
        .maybeSingle();

      if (checkErr) throw checkErr;
      
      if (!checkPendaftar) {
        Alert.alert('Error', 'Pendaftar ini mungkin sudah diverifikasi oleh operator lain.');
        fetchData();
        return;
      }

      const payloadSiswa = {
        nipd: inputNIPD,
        nik: selectedItem.nik,
        nisn: selectedItem.nisn,
        nama: selectedItem.nama,
        tempat_lahir: selectedItem.tempat_lahir,
        tanggal_lahir: selectedItem.tanggal_lahir,
        jenis_kelamin: selectedItem.jenis_kelamin,
        alamat_detail: selectedItem.alamat_detail,
        rt: selectedItem.rt, rw: selectedItem.rw,
        desa: selectedItem.desa, kecamatan: selectedItem.kecamatan,
        kabupaten: selectedItem.kabupaten, provinsi: selectedItem.provinsi,
        wa_siswa: selectedItem.wa_siswa, wa_ortu: selectedItem.wa_ortu,
        kelas: inputKelas,
        angkatan: selectedItem.angkatan,
        tahun_ajaran: selectedItem.tahun_ajaran,
        tanggal_masuk: selectedItem.tanggal_masuk,
        status_siswa: selectedItem.status_siswa,
        sekolah_asal: selectedItem.sekolah_asal,
        nama_ayah: selectedItem.nama_ayah,
        nama_ibu: selectedItem.nama_ibu,
        nama_wali: selectedItem.nama_wali,
        foto_url: selectedItem.foto_url,
        status_keaktifan: 'Aktif'
      };

      const { error: insertErr } = await supabase.from('data_siswa').insert([payloadSiswa]);
      if (insertErr) throw insertErr;

      const { error: deleteErr } = await supabase.from('ppdb_pendaftar').delete().eq('id', selectedItem.id);
      if (deleteErr) throw deleteErr;

      Alert.alert('Berhasil', `${selectedItem.nama} resmi menjadi siswa aktif.`);
      setModalTerimaVisible(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Gagal menerima siswa');
    } finally {
      setIsSavingTerima(false);
    }
  };

  const filteredData = dataPendaftar.filter(item => 
    item.nama?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.no_pendaftaran?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Verifikasi PPDB</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola kelengkapan & penerimaan siswa baru</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={[styles.statValue, { color: '#1f2937' }]}>{stats.total}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Lengkap</Text>
          <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.lengkap}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Kurang</Text>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.kurang}</Text>
        </View>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={20} color="#9ca3af" />
          <TextInput style={styles.searchInput} placeholder="Cari nama / no registrasi..." value={searchQuery} onChangeText={setSearchQuery} />
        </View>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
        ) : filteredData.length === 0 ? (
          <Text style={styles.emptyText}>Tidak ada pendaftar ditemukan.</Text>
        ) : (
          filteredData.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.regNo}>{item.no_pendaftaran}</Text>
                  <Text style={styles.studentName}>{item.nama}</Text>
                  <Text style={styles.schoolName}>Asal: {item.sekolah_asal}</Text>
                </View>
                
                {item.status_berkas === 'Lengkap' ? (
                  <View style={[styles.badge, styles.badgeLengkap]}><CheckCircle size={14} color="#059669" /><Text style={styles.badgeTextLengkap}>Lengkap</Text></View>
                ) : item.status_berkas === 'Kurang' ? (
                  <View style={[styles.badge, styles.badgeKurang]}><XCircle size={14} color="#dc2626" /><Text style={styles.badgeTextKurang}>Kurang</Text></View>
                ) : (
                  <View style={[styles.badge, styles.badgeBelum]}><Clock size={14} color="#d97706" /><Text style={styles.badgeTextBelum}>Belum Cek</Text></View>
                )}
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.actionBtn, styles.btnTrash]} onPress={() => handleDelete(item.id, item.nama)}>
                  <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnVerif]} onPress={() => openVerifikasiModal(item)}>
                  <CheckSquare size={18} color="#2a2c87" />
                  <Text style={styles.btnVerifText}>Verifikasi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnTerima]} onPress={() => openTerimaModal(item)}>
                  <UserCheck size={18} color="#fff" />
                  <Text style={styles.btnTerimaText}>Terima Siswa</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL CEKLIS BERKAS */}
      <Modal visible={modalCeklisVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verifikasi Berkas</Text>
              <TouchableOpacity onPress={() => setModalCeklisVisible(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>Calon Siswa: <Text style={{ fontWeight: 'bold' }}>{selectedItem?.nama}</Text></Text>
              
              <Text style={styles.sectionLabel}>Berkas Wajib</Text>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>Formulir Pendaftaran</Text><Switch value={editCeklis.formulir} onValueChange={v => setEditCeklis({...editCeklis, formulir: v})} trackColor={{ true: '#10b981' }} /></View>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>Ijazah / SKL</Text><Switch value={editCeklis.ijazah} onValueChange={v => setEditCeklis({...editCeklis, ijazah: v})} trackColor={{ true: '#10b981' }} /></View>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>Surat Pindah (Mutasi)</Text><Switch value={editCeklis.pindah} onValueChange={v => setEditCeklis({...editCeklis, pindah: v})} trackColor={{ true: '#10b981' }} /></View>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>FC Kartu Keluarga</Text><Switch value={editCeklis.kk} onValueChange={v => setEditCeklis({...editCeklis, kk: v})} trackColor={{ true: '#10b981' }} /></View>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>FC Akta Kelahiran</Text><Switch value={editCeklis.akta} onValueChange={v => setEditCeklis({...editCeklis, akta: v})} trackColor={{ true: '#10b981' }} /></View>

              <Text style={styles.sectionLabel}>Berkas Tambahan (Opsional)</Text>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>Rapor Sekolah</Text><Switch value={editCeklis.rapor} onValueChange={v => setEditCeklis({...editCeklis, rapor: v})} trackColor={{ true: '#10b981' }} /></View>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>FC KTP Orang Tua</Text><Switch value={editCeklis.ktp} onValueChange={v => setEditCeklis({...editCeklis, ktp: v})} trackColor={{ true: '#10b981' }} /></View>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>Pas Foto 3x4</Text><Switch value={editCeklis.foto} onValueChange={v => setEditCeklis({...editCeklis, foto: v})} trackColor={{ true: '#10b981' }} /></View>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>Buku/Kartu PIP</Text><Switch value={editCeklis.pip} onValueChange={v => setEditCeklis({...editCeklis, pip: v})} trackColor={{ true: '#10b981' }} /></View>
              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSaveModal} onPress={saveVerifikasi} disabled={isSavingVerif}>
                {isSavingVerif ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveModalText}>Simpan Hasil Verifikasi</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL TERIMA SISWA */}
      <Modal visible={modalTerimaVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Terima Siswa</Text>
              <TouchableOpacity onPress={() => setModalTerimaVisible(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>Pindahkan <Text style={{ fontWeight: 'bold' }}>{selectedItem?.nama}</Text> ke daftar siswa aktif.</Text>
              
              <Text style={styles.labelModal}>NIPD (Nomor Induk) *</Text>
              <TextInput style={styles.inputModal} value={inputNIPD} onChangeText={setInputNIPD} placeholder="Ketik NIPD..." />

              <Text style={styles.labelModal}>Pilih Kelas *</Text>
              <View style={styles.pickerWrapperModal}>
                <Picker selectedValue={inputKelas} onValueChange={setInputKelas}>
                  {dataKelas.map(k => (
                    <Picker.Item key={k.id} label={k.nama_kelas} value={k.nama_kelas} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSaveModal} onPress={handleTerimaSiswa} disabled={isSavingTerima}>
                {isSavingTerima ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveModalText}>Terima & Masukkan Kelas</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: '#e0e7ff', fontSize: 13 },
  
  statsContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  statBox: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  statLabel: { fontSize: 12, color: '#6b7280', fontWeight: 'bold' },
  statValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },

  searchSection: { paddingHorizontal: 16, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput: { flex: 1, paddingVertical: 6, marginLeft: 8, fontSize: 14, color: '#1f2937' },

  content: { flex: 1, paddingHorizontal: 16 },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 20, fontStyle: 'italic' },
  
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  regNo: { fontSize: 12, fontWeight: 'bold', color: '#6b7280', marginBottom: 2 },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  schoolName: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeLengkap: { backgroundColor: '#d1fae5' },
  badgeTextLengkap: { color: '#059669', fontSize: 11, fontWeight: 'bold' },
  badgeKurang: { backgroundColor: '#fee2e2' },
  badgeTextKurang: { color: '#dc2626', fontSize: 11, fontWeight: 'bold' },
  badgeBelum: { backgroundColor: '#fef3c7' },
  badgeTextBelum: { color: '#d97706', fontSize: 11, fontWeight: 'bold' },

  cardActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
  btnTrash: { backgroundColor: '#fef2f2', width: 44 },
  btnVerif: { flex: 1, backgroundColor: '#eef2ff' },
  btnVerifText: { color: '#2a2c87', fontSize: 13, fontWeight: 'bold' },
  btnTerima: { flex: 1, backgroundColor: '#10b981' },
  btnTerimaText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  modalBody: { padding: 20 },
  modalSubtitle: { fontSize: 14, color: '#4b5563', marginBottom: 20 },
  
  sectionLabel: { fontSize: 13, fontWeight: 'bold', color: '#6b7280', marginBottom: 12, marginTop: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  switchLabel: { fontSize: 15, color: '#1f2937', fontWeight: '500' },

  labelModal: { fontSize: 13, fontWeight: 'bold', color: '#4b5563', marginBottom: 8, marginTop: 16 },
  inputModal: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 15 },
  pickerWrapperModal: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },

  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  btnSaveModal: { backgroundColor: '#2a2c87', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnSaveModalText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
