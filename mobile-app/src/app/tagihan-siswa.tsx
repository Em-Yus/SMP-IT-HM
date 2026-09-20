import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, Modal, Animated } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import CryptoJS from 'crypto-js';
import { Wallet, ChevronLeft, QrCode, Search, User, X, CheckCircle, Plus, Trash2, Camera, Calendar } from 'lucide-react-native';
import { router } from 'expo-router';
import CustomDatePicker from '../components/CustomDatePicker';

const SECRET_KEY = process.env.EXPO_PUBLIC_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

export default function TagihanSiswa() {
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const [tahunPelajaran, setTahunPelajaran] = useState(defaultTahun);
  const [semester] = useState('Tahunan'); // Standard based on web app for Keuangan

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannerAnim = useRef(new Animated.Value(0)).current;

  // Search State
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Data State
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null);
  const [biayaItems, setBiayaItems] = useState<any[]>([]);
  const [pemasukanList, setPemasukanList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form Saldo
  const [saldo, setSaldo] = useState(0);
  const [subsidi, setSubsidi] = useState(0);
  const [isSavingSaldo, setIsSavingSaldo] = useState(false);
  const [isEditSaldo, setIsEditSaldo] = useState(false);

  // Form Pemasukan
  const [inputTanggal, setInputTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [inputNominal, setInputNominal] = useState('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'rincian' | 'bayar' | 'riwayat'>('rincian');

  useEffect(() => {
    if (isCameraOpen) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scannerAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(scannerAnim, { toValue: 0, duration: 2000, useNativeDriver: true })
        ])
      ).start();
    }
  }, [isCameraOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchInput.trim().length >= 2) {
        setIsSearching(true);
        try {
          const { data, error } = await supabase.from('data_siswa').select('*').ilike('nama', `%${searchInput}%`).limit(10);
          if (error) throw error;
          setSearchResults(data || []);
          setShowDropdown(true);
        } catch (err) {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  const decryptNIPD = (encryptedText: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || encryptedText;
    } catch (e) {
      return encryptedText;
    }
  };



  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setIsCameraOpen(false);
    setIsLoading(true);
    const nipdToSearch = decryptNIPD(data);

    try {
      const { data: siswaData, error } = await supabase.from('data_siswa').select('*').eq('nipd', nipdToSearch).maybeSingle();
      if (error) throw error;
      if (!siswaData) {
        Alert.alert('Gagal', `Siswa dengan NIPD: ${nipdToSearch} tidak ditemukan.`);
        return;
      }
      await processSelectSiswa(siswaData);
    } catch (err) {
      console.log('Error scan:', err);
      Alert.alert('Error', 'Gagal memproses data QR.');
    } finally {
      setIsLoading(false);
    }
  };

  const processSelectSiswa = async (siswa: any) => {
    if (siswa.status_siswa?.toLowerCase() === 'cabang') {
      Alert.alert('Siswa Cabang', 'Urusan pembayaran siswa ini pada cabang lain.');
      return;
    }
    setShowDropdown(false);
    setSearchInput('');
    setSelectedSiswa(siswa);

    // Pakai tahun_ajaran dari data_siswa
    const tahun = siswa.tahun_ajaran || defaultTahun;
    setTahunPelajaran(tahun);

    await loadLedger(siswa);
  };

  const loadLedger = async (siswa: any = selectedSiswa) => {
    setIsLoading(true);
    try {
      // 1. Baca tahun_ajaran dari data_siswa
      const tahunPelajaranSiswa = siswa.tahun_ajaran || defaultTahun;

      // 2. Baca kelas siswa -> tentukan tingkat
      let tingkatSiswa = 7;
      if (siswa.kelas) {
        const { data: kelasData } = await supabase.from('data_kelas').select('id, tingkat').ilike('nama_kelas', siswa.kelas).maybeSingle();
        if (kelasData?.tingkat) {
          tingkatSiswa = kelasData.tingkat;
        } else {
          const match = String(siswa.kelas).match(/\d+/);
          if (match) tingkatSiswa = parseInt(match[0], 10);
        }
      }

      // 3. Tentukan Tipe Siswa berdasarkan status_siswa di data_siswa
      let tipeSiswa = 'Siswa Baru';
      if (siswa.status_siswa) {
        const statusLower = String(siswa.status_siswa).toLowerCase();
        if (statusLower === 'baru') {
          tipeSiswa = 'Siswa Baru';
        } else if (statusLower === 'pindahan') {
          // Hitung tingkat saat siswa MASUK berdasarkan selisih tahun ajaran
          const entryYear = parseInt((tahunPelajaranSiswa || '').split('/')[0]) || 0;
          const defaultYear = parseInt((defaultTahun || '').split('/')[0]) || entryYear;
          const yearsPassed = Math.max(0, defaultYear - entryYear);
          const entryTingkat = Math.max(7, tingkatSiswa - yearsPassed);
          tipeSiswa = `Pindahan Kelas ${entryTingkat}`;
        } else {
          tipeSiswa = siswa.status_siswa;
        }
      }

      // A. Load Rincian Biaya (pakai tahunPelajaranSiswa dari data_siswa)
      const { data: configData } = await supabase
        .from('biaya_pengembangan_mutu')
        .select('data_anggaran')
        .eq('tahun_pelajaran', tahunPelajaranSiswa)
        .eq('semester', semester)
        .eq('tipe_siswa', tipeSiswa)
        .maybeSingle();

      let extractedItems: any[] = [];
      if (configData?.data_anggaran) {
        configData.data_anggaran.forEach((item: any) => {
          const cost = item[`tingkat${tingkatSiswa}`] || item[`kelas${tingkatSiswa}`] || 0;
          if (cost > 0) extractedItems.push({ id: item.id, uraian: item.uraian, biaya: cost });
        });
      }
      setBiayaItems(extractedItems);

      // B. Load Riwayat Pemasukan (pakai tahunPelajaranSiswa yang sama)
      const { data: pemasukanData } = await supabase
        .from('tb_pemasukan_siswa')
        .select('*')
        .eq('siswa_id', siswa.id)
        .eq('tahun_pelajaran', tahunPelajaranSiswa)
        .eq('semester', semester)
        .order('tanggal', { ascending: true })
        .order('created_at', { ascending: true });

      setPemasukanList(pemasukanData || []);

      // C. Load Saldo & Subsidi (pakai tahunPelajaranSiswa yang sama)
      const { data: saldoData } = await supabase
        .from('tb_saldo_siswa')
        .select('*')
        .eq('siswa_id', siswa.id)
        .eq('tahun_pelajaran', tahunPelajaranSiswa)
        .eq('semester', semester)
        .maybeSingle();

      setSaldo(saldoData?.saldo_sebelumnya || 0);
      setSubsidi(saldoData?.subsidi_pip || 0);
      setIsEditSaldo(false);

    } catch (err) {
      Alert.alert('Error', 'Gagal memuat buku besar keuangan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSaldo = async () => {
    if (!selectedSiswa) return;
    setIsSavingSaldo(true);
    try {
      const payload = {
        siswa_id: selectedSiswa.id,
        tahun_pelajaran: tahunPelajaran, semester: semester,
        saldo_sebelumnya: saldo, subsidi_pip: subsidi,
        updated_at: new Date().toISOString()
      };

      const { data: existData } = await supabase.from('tb_saldo_siswa').select('id').eq('siswa_id', selectedSiswa.id).eq('tahun_pelajaran', tahunPelajaran).eq('semester', semester).maybeSingle();

      if (existData) await supabase.from('tb_saldo_siswa').update(payload).eq('id', existData.id);
      else await supabase.from('tb_saldo_siswa').insert([payload]);

      Alert.alert('Berhasil', 'Data saldo diperbarui.');
      setIsEditSaldo(false);
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan saldo.');
    } finally {
      setIsSavingSaldo(false);
    }
  };

  const handleAddPemasukan = async () => {
    if (!selectedSiswa) return Alert.alert('Peringatan', 'Pilih siswa terlebih dahulu.');
    if (!inputTanggal || !inputNominal) return Alert.alert('Peringatan', 'Isi nominal terlebih dahulu.');

    const nominalInt = parseInt(inputNominal.replace(/[^0-9]/g, ''), 10);
    if (!nominalInt || nominalInt <= 0) return;

    setIsLoading(true);
    try {
      const payload = {
        siswa_id: selectedSiswa.id, tahun_pelajaran: tahunPelajaran, semester: semester,
        tanggal: inputTanggal, nominal: nominalInt
      };
      await supabase.from('tb_pemasukan_siswa').insert([payload]);
      setInputNominal('');
      Alert.alert('Berhasil', 'Pembayaran berhasil dicatat!');
      loadLedger(selectedSiswa);
    } catch (err) {
      Alert.alert('Error', 'Gagal menyimpan pembayaran.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePemasukan = (id: number) => {
    Alert.alert('Hapus Riwayat?', 'Setoran ini akan dihapus permanen.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive', onPress: async () => {
          setIsLoading(true);
          try {
            await supabase.from('tb_pemasukan_siswa').delete().eq('id', id);
            loadLedger(selectedSiswa);
          } catch (err) {
            Alert.alert('Error', 'Gagal menghapus riwayat.');
          } finally {
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const { status } = await requestCameraPermission();
      if (status !== 'granted') return Alert.alert('Izin Ditolak', 'Dibutuhkan izin kamera untuk memindai kartu.');
    }
    setIsCameraOpen(true);
  };

  // Kalkulasi Keuangan
  const totalHarusDibayar = biayaItems.reduce((sum, item) => sum + item.biaya, 0);
  const totalPemasukan = pemasukanList.reduce((sum, item) => sum + item.nominal, 0);
  const totalSudahBayar = totalPemasukan + saldo + subsidi;
  const selisih = totalHarusDibayar - totalSudahBayar;

  let remainingAlloc = totalSudahBayar;
  const allocatedItems = biayaItems.map(item => {
    let statusText = '';
    let isLunas = false;
    let sisa = 0;

    if (remainingAlloc >= item.biaya) {
      statusText = 'Lunas';
      isLunas = true;
      remainingAlloc -= item.biaya;
    } else if (remainingAlloc > 0) {
      sisa = item.biaya - remainingAlloc;
      statusText = `Sisa Rp ${sisa.toLocaleString('id-ID')}`;
      remainingAlloc = 0;
    } else {
      sisa = item.biaya;
      statusText = `Rp ${item.biaya.toLocaleString('id-ID')}`;
    }
    return { ...item, statusText, isLunas, sisa };
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Tagihan Siswa</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola pembayaran & buku besar.</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBarContainer}>
          <Search size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Ketik nama siswa..."
            value={searchInput}
            onChangeText={setSearchInput}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
          />
          {isSearching && <ActivityIndicator size="small" color="#2a2c87" />}
          <TouchableOpacity onPress={openCamera} style={styles.scanBtn}>
            <QrCode size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {showDropdown && searchResults.length > 0 && (
          <View style={styles.dropdown}>
            {searchResults.map(s => (
              <TouchableOpacity key={s.id} style={styles.dropdownItem} onPress={() => processSelectSiswa(s)}>
                <Text style={styles.dropdownName}>{s.nama}</Text>
                <Text style={styles.dropdownSub}>{s.nipd} • Kelas {s.kelas || '-'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {!selectedSiswa && !isLoading && (
          <View style={styles.emptyState}>
            <Wallet size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Cari atau scan kartu siswa untuk melihat tagihan.</Text>
          </View>
        )}

        {isLoading && !isCameraOpen && (
          <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
        )}

        {selectedSiswa && !isLoading && (
          <View>
            <View style={styles.studentCard}>
              <View style={styles.studentHeader}>
                <View style={styles.avatar}><User size={24} color="#2a2c87" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{selectedSiswa.nama}</Text>
                  <Text style={styles.studentInfo}>{selectedSiswa.nipd} • Kelas {selectedSiswa.kelas || '-'}</Text>
                </View>
                <View style={[styles.statusBadge, selectedSiswa.status_keaktifan === 'Aktif' ? styles.statusAktif : styles.statusNonAktif]}>
                  <Text style={styles.statusText}>{selectedSiswa.status_keaktifan || 'Nonaktif'}</Text>
                </View>
              </View>

              <View style={styles.financeSummaryRow}>
                <View style={styles.financeBox}>
                  <Text style={styles.financeLabel}>Total Tagihan</Text>
                  <Text style={styles.financeValue}>Rp {totalHarusDibayar.toLocaleString('id-ID')}</Text>
                </View>
                <View style={styles.financeBox}>
                  <Text style={styles.financeLabel}>Sisa Tagihan</Text>
                  <Text style={[styles.financeValue, selisih > 0 ? { color: '#ef4444' } : { color: '#10b981' }]}>
                    {selisih > 0 ? `Rp ${selisih.toLocaleString('id-ID')}` : 'LUNAS'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Custom Tab Bar */}
            <View style={styles.tabContainer}>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'rincian' && styles.tabActive]} onPress={() => setActiveTab('rincian')}>
                <Text style={[styles.tabText, activeTab === 'rincian' && styles.tabTextActive]}>Rincian</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'bayar' && styles.tabActive]} onPress={() => setActiveTab('bayar')}>
                <Text style={[styles.tabText, activeTab === 'bayar' && styles.tabTextActive]}>Bayar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'riwayat' && styles.tabActive]} onPress={() => setActiveTab('riwayat')}>
                <Text style={[styles.tabText, activeTab === 'riwayat' && styles.tabTextActive]}>Riwayat</Text>
              </TouchableOpacity>
            </View>

            {/* TAB: RINCIAN ALOKASI */}
            {activeTab === 'rincian' && (
              <View style={styles.cardBlock}>
                <View style={styles.saldoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.saldoLabel}>Saldo Sebelumnya</Text>
                    {isEditSaldo ? (
                      <TextInput style={styles.saldoInput} keyboardType="numeric" value={String(saldo)} onChangeText={t => setSaldo(Number(t))} />
                    ) : (
                      <Text style={styles.saldoValue}>Rp {saldo.toLocaleString('id-ID')}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.saldoLabel}>Subsidi PIP/Lainnya</Text>
                    {isEditSaldo ? (
                      <TextInput style={styles.saldoInput} keyboardType="numeric" value={String(subsidi)} onChangeText={t => setSubsidi(Number(t))} />
                    ) : (
                      <Text style={styles.saldoValue}>Rp {subsidi.toLocaleString('id-ID')}</Text>
                    )}
                  </View>
                </View>
                {isEditSaldo ? (
                  <TouchableOpacity style={styles.btnSimpanSaldo} onPress={handleSaveSaldo} disabled={isSavingSaldo}>
                    <Text style={styles.btnSimpanSaldoText}>{isSavingSaldo ? 'Menyimpan...' : 'Simpan Saldo'}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.btnEditSaldo} onPress={() => setIsEditSaldo(true)}>
                    <Text style={styles.btnEditSaldoText}>Edit Saldo/Subsidi</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Alokasi Pembayaran (Waterfall)</Text>

                {allocatedItems.length === 0 ? <Text style={styles.emptyTP}>Belum ada tagihan terkonfigurasi.</Text> : allocatedItems.map((item, idx) => (
                  <View key={item.id} style={styles.waterfallItem}>
                    <View style={styles.waterfallLeft}>
                      <View style={[styles.waterfallIndicator, item.isLunas ? { backgroundColor: '#10b981' } : { backgroundColor: '#ef4444' }]} />
                      <View>
                        <Text style={styles.waterfallName}>{item.uraian}</Text>
                        <Text style={styles.waterfallTarget}>Tarif: Rp {item.biaya.toLocaleString('id-ID')}</Text>
                      </View>
                    </View>
                    <View style={[styles.waterfallStatusBadge, item.isLunas ? styles.badgeLunas : styles.badgeHutang]}>
                      <Text style={[styles.waterfallStatusText, item.isLunas ? { color: '#10b981' } : { color: '#ef4444' }]}>{item.statusText}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB: BAYAR */}
            {activeTab === 'bayar' && (
              <View style={styles.cardBlock}>
                <Text style={styles.sectionTitle}>Catat Pembayaran Baru</Text>
                <CustomDatePicker
                  label="Tanggal Setor"
                  value={inputTanggal}
                  onChange={setInputTanggal}
                />
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nominal (Rp)</Text>
                  <TextInput style={styles.inputFieldBig} keyboardType="numeric" placeholder="Contoh: 500000" value={inputNominal} onChangeText={setInputNominal} />
                </View>
                <TouchableOpacity style={styles.btnBayar} onPress={handleAddPemasukan}>
                  <Plus color="#fff" size={20} />
                  <Text style={styles.btnBayarText}>Tambah Pembayaran</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAB: RIWAYAT */}
            {activeTab === 'riwayat' && (
              <View style={styles.cardBlock}>
                <Text style={styles.sectionTitle}>Riwayat Pembayaran</Text>
                {pemasukanList.length === 0 ? <Text style={styles.emptyTP}>Belum ada riwayat pembayaran.</Text> : pemasukanList.map((pem, idx) => (
                  <View key={pem.id} style={styles.historyRow}>
                    <View style={styles.historyIcon}><CheckCircle size={20} color="#10b981" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyDate}>{new Date(pem.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                      <Text style={styles.historyAmount}>Rp {pem.nominal.toLocaleString('id-ID')}</Text>
                    </View>
                    <TouchableOpacity style={styles.btnDelHistory} onPress={() => handleDeletePemasukan(pem.id)}>
                      <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Kamera Scanner Modal */}
      <Modal visible={isCameraOpen} transparent animationType="slide">
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>Scan Kartu Pelajar</Text>
            <TouchableOpacity onPress={() => setIsCameraOpen(false)} style={styles.closeBtn}><X color="#fff" size={24} /></TouchableOpacity>
          </View>
          <CameraView
            style={styles.cameraView}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          >
            <View style={styles.scanMask}>
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <Animated.View style={[styles.scanLaser, {
                  transform: [{
                    translateY: scannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] })
                  }]
                }]} />
              </View>
            </View>
          </CameraView>
        </View>
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

  searchSection: { padding: 16, zIndex: 10 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  searchInput: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, fontSize: 15, color: '#1f2937' },
  scanBtn: { backgroundColor: '#10b981', padding: 10, borderRadius: 12, marginLeft: 8 },

  dropdown: { position: 'absolute', top: 75, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 10, zIndex: 10, maxHeight: 250 },
  dropdownItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownName: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  dropdownSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  content: { flex: 1, paddingHorizontal: 16, zIndex: 1 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#9ca3af', marginTop: 16, textAlign: 'center', paddingHorizontal: 40 },

  studentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  studentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  studentInfo: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusAktif: { backgroundColor: '#d1fae5' },
  statusNonAktif: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },

  financeSummaryRow: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  financeBox: { flex: 1, backgroundColor: '#f9fafb', padding: 12, borderRadius: 12, alignItems: 'center' },
  financeLabel: { fontSize: 11, color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  financeValue: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },

  tabContainer: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: 'bold', color: '#6b7280' },
  tabTextActive: { color: '#2a2c87' },

  cardBlock: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 },

  saldoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  saldoLabel: { fontSize: 11, color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  saldoValue: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  saldoInput: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, fontSize: 14, color: '#1f2937' },
  btnEditSaldo: { alignItems: 'center', paddingVertical: 10, backgroundColor: '#f3f4f6', borderRadius: 8, marginBottom: 16 },
  btnEditSaldoText: { color: '#4b5563', fontWeight: 'bold', fontSize: 13 },
  btnSimpanSaldo: { alignItems: 'center', paddingVertical: 10, backgroundColor: '#10b981', borderRadius: 8, marginBottom: 16 },
  btnSimpanSaldoText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 8 },

  waterfallItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  waterfallLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  waterfallIndicator: { width: 8, height: 36, borderRadius: 4, marginRight: 12 },
  waterfallName: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  waterfallTarget: { fontSize: 12, color: '#9ca3af' },
  waterfallStatusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeLunas: { backgroundColor: '#d1fae5' },
  badgeHutang: { backgroundColor: '#fee2e2' },
  waterfallStatusText: { fontSize: 12, fontWeight: 'bold' },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#4b5563', marginBottom: 8 },
  inputIconWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12 },
  inputFieldIcon: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 15 },
  inputFieldBig: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, fontSize: 24, fontWeight: 'bold', color: '#1f2937', textAlign: 'center' },
  btnBayar: { backgroundColor: '#2a2c87', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnBayarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  historyRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 12 },
  historyIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  historyDate: { fontSize: 12, color: '#6b7280' },
  historyAmount: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  btnDelHistory: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 8 },

  emptyTP: { color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },

  cameraOverlay: { flex: 1, backgroundColor: '#000' },
  cameraHeader: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cameraTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  cameraView: { flex: 1 },
  scanMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 220, height: 220, backgroundColor: 'transparent', position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#10b981' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  scanLaser: { width: '100%', height: 2, backgroundColor: '#10b981', position: 'absolute', shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 5, elevation: 5 }
});
