import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Search, ArrowLeft, Briefcase, X, Plus, Edit, Trash2, Save, Check, ShieldCheck } from 'lucide-react-native';
import { router } from 'expo-router';

export const menusConfig = [
  {
    group: "Menu Utama",
    items: [
      { to: "/dashboard-guru", label: "Dashboard" },
      { to: "/profil-guru", label: "Profil Saya" }
    ]
  },
  {
    group: "Master Data",
    items: [
      { to: "/data-lembaga", label: "Identitas Lembaga" },
      { to: "/data-siswa", label: "Data Siswa Aktif" },
      { to: "/data-periodik-siswa", label: "Data Periodik Siswa" },
      { to: "/siswa-nonaktif", label: "Siswa Nonaktif" },
      { to: "/data-pegawai", label: "Data Pegawai" },
      { to: "/pegawai-nonaktif", label: "Pegawai Nonaktif" },
      { to: "/data-jabatan", label: "Data Jabatan" },
      { to: "/data-kelas", label: "Data Kelas" },
      { to: "/data-ruang", label: "Data Ruang" },
      { to: "/master-jam", label: "Master Jam Pelajaran" },
      { to: "/master-jam-presensi", label: "Master Jam Presensi Siswa" },
      { to: "/master-jam-guru", label: "Master Jam Kerja Guru" },
      { to: "/mata-pelajaran", label: "Mata Pelajaran" },
      { to: "/data-surat", label: "Data Surat" }
    ]
  },
  {
    group: "Akademik & Presensi",
    items: [
      { to: "/jadwal-guru", label: "Jadwal Mengajar" },
      { to: "/presensi-guru", label: "Presensi Pegawai" },
      { to: "/qr-presensi-guru", label: "Cetak QR Absensi Guru" },
      { to: "/presensi-siswa", label: "Presensi Siswa" },
      { to: "/tujuan-pembelajaran", label: "Tujuan Pembelajaran" },
      { to: "/kelas-mengaji", label: "Kelas Mengaji" },
      { to: "/input-nilai", label: "Input Nilai" },
      { to: "/catatan-wali", label: "Catatan Wali Kelas" },
      { to: "/rapor-guru", label: "Cetak Rapor" }
    ]
  },
  {
    group: "Keuangan",
    items: [
      { to: "/rekap-honor-guru", label: "Rekap Honor Guru" },
      { to: "/tagihan-siswa", label: "Tagihan Siswa" },
      { to: "/rekap-bayar", label: "Rekap Bayar" },
      { to: "/input-biaya-pengembangan-mutu", label: "Biaya Pengembangan Mutu" },
      { to: "/pemasukan-lainnya", label: "Pemasukan Lainnya" }
    ]
  },
  {
    group: "Administrasi & Kesiswaan",
    items: [
      { to: "/surat-kepsek", label: "Surat Kepsek" },
      { to: "/surat-kesiswaan", label: "Surat Kesiswaan" },
      { to: "/kartu-siswa", label: "Cetak Kartu Siswa" },
      { to: "/admin/pendaftaran-spmb", label: "Pendaftaran SPMB" },
      { to: "/verifikasi-ppdb", label: "Verifikasi PPDB" },
      { to: "/prestasi", label: "Prestasi Siswa" },
      { to: "/ekstrakurikuler", label: "Ekstrakurikuler" },
      { to: "/kokurikuler", label: "Kokurikuler" }
    ]
  },
  {
    group: "Ujian",
    items: [
      { to: "/ujian/jadwal", label: "Jadwal Ujian" },
      { to: "/ujian/tata-tertib", label: "Tata Tertib Ujian" },
      { to: "/ujian/soal", label: "Soal Ujian" },
      { to: "/ujian/awasi", label: "Awasi Ujian" },
      { to: "/ujian/nilai", label: "Nilai Hasil Ujian" }
    ]
  },
  {
    group: "Portal CMS",
    items: [
      { to: "/cms-beranda", label: "Pengaturan Beranda" },
      { to: "/cms-galeri", label: "Galeri Website" },
      { to: "/cms-pengumuman", label: "Pengumuman" }
    ]
  }
];

export type Jabatan = {
  id?: number;
  nama_jabatan: string;
  deskripsi: string | undefined;
  kelompok_jabatan: string | undefined;
  honor?: number;
  hak_akses: string[];
};

const DEFAULT_FORM: Jabatan = {
  nama_jabatan: '', deskripsi: '', kelompok_jabatan: '', honor: 0, hak_akses: []
};

export default function DataJabatan() {
  const [dataJabatan, setDataJabatan] = useState<Array<Jabatan>>([]);
  const [filteredData, setFilteredData] = useState<Array<Jabatan>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedJabatan, setSelectedJabatan] = useState<Jabatan | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Jabatan>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJabatan();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\data-jabatan.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchJabatan();
  
    });

    return () => listener.remove();
  }, []);

  const fetchJabatan = async () => {
    try {
      const { data, error } = await supabase
        .from('data_jabatan')
        .select('*')
        .order('nama_jabatan', { ascending: true });

      if (error) throw error;
      if (data) {
        setDataJabatan(data);
        setFilteredData(data);
      }
    } catch (err) {
      console.error('Error fetching data jabatan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text) {
      const filtered = dataJabatan.filter(p => 
        p.nama_jabatan.toLowerCase().includes(text.toLowerCase()) ||
        p.kelompok_jabatan?.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(dataJabatan);
    }
  };

  const openDetail = (jabatan: Jabatan) => {
    setSelectedJabatan(jabatan);
    setIsEditing(false);
    setModalVisible(true);
  };

  const openAddForm = () => {
    setSelectedJabatan(undefined);
    setFormData(DEFAULT_FORM);
    setIsEditing(true);
    setModalVisible(true);
  };

  const openEditForm = () => {
    if (selectedJabatan) {
      setFormData(selectedJabatan);
      setIsEditing(true);
    }
  };

  const handleDelete = () => {
    if (!selectedJabatan) return;
    Alert.alert(
      "Hapus Jabatan",
      `Yakin ingin menghapus jabatan ${selectedJabatan.nama_jabatan} secara permanen?`,
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Ya, Hapus", 
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('data_jabatan')
                .delete()
                .eq('id', selectedJabatan.id);
              
              if (error) throw error;
              Alert.alert("Sukses", "Jabatan berhasil dihapus.");
              setModalVisible(false);
              fetchJabatan();
            } catch (err: any) {
              Alert.alert("Error", err.message);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!formData.nama_jabatan) {
      Alert.alert("Error", "Nama Jabatan wajib diisi!");
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        nama_jabatan: formData.nama_jabatan,
        deskripsi: formData.deskripsi,
        kelompok_jabatan: formData.kelompok_jabatan || null,
        honor: Number(formData.honor) || 0,
        hak_akses: formData.hak_akses
      };

      if (formData.id) {
        // Update
        const { error } = await supabase
          .from('data_jabatan')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
        Alert.alert("Sukses", "Data jabatan berhasil diperbarui!");
      } else {
        // Insert
        const { error } = await supabase
          .from('data_jabatan')
          .insert([payload]);
        if (error) throw error;
        Alert.alert("Sukses", "Jabatan baru berhasil ditambahkan!");
      }
      setModalVisible(false);
      fetchJabatan();
    } catch (err: any) {
      if (err.code === '23505') {
        Alert.alert("Gagal", "Nama jabatan sudah ada di sistem.");
      } else {
        Alert.alert("Error", err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Jabatan }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
      <View style={styles.cardLeft}>
        <View style={styles.iconWrapper}>
          <Briefcase size={24} color="#1E257F" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{item.nama_jabatan}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={styles.subText}>{item.kelompok_jabatan || 'Tanpa Kelompok'}</Text>
            {item.honor ? (
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#059669' }}>
                • Rp {(Number(item.honor) || 0).toLocaleString('id-ID')}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Jabatan</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search color="#9ca3af" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama jabatan..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1E257F" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id!.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Tidak ada data jabatan ditemukan.</Text>
            </View>
          }
        />
      )}

      {/* FAB Add Button */}
      <TouchableOpacity style={styles.fab} onPress={openAddForm}>
        <Plus color="#fff" size={28} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? (formData.id ? 'Edit Jabatan' : 'Tambah Jabatan') : 'Detail Jabatan'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#6C757D" size={24} />
              </TouchableOpacity>
            </View>
            
            {isEditing ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.inputLabel}>Nama Jabatan *</Text>
                <TextInput style={styles.inputField} value={formData.nama_jabatan} onChangeText={(t) => setFormData({...formData, nama_jabatan: t})} placeholder="Cth: Kepala Sekolah" />
                
                <Text style={styles.inputLabel}>Kelompok Jabatan</Text>
                <TextInput style={styles.inputField} value={formData.kelompok_jabatan} onChangeText={(t) => setFormData({...formData, kelompok_jabatan: t})} placeholder="Cth: Manajemen" />
                
                <Text style={styles.inputLabel}>Tunjangan / Honor Jabatan (Rp)</Text>
                <TextInput 
                  style={styles.inputField} 
                  value={formData.honor?.toString()} 
                  onChangeText={(t) => setFormData({...formData, honor: Number(t.replace(/[^0-9]/g, '')) || 0})} 
                  keyboardType="numeric" 
                  placeholder="Cth: 250000" 
                />

                <Text style={styles.inputLabel}>Deskripsi</Text>
                <TextInput style={[styles.inputField, { height: 80, textAlignVertical: 'top' }]} value={formData.deskripsi} onChangeText={(t) => setFormData({...formData, deskripsi: t})} multiline placeholder="Deskripsi tugas..." />

                <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <ShieldCheck color="#1E257F" size={20} />
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1A1818', marginLeft: 8 }}>Hak Akses Bawaan (Default)</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#6C757D', marginBottom: 16 }}>
                    Centang menu-menu yang secara otomatis bisa diakses oleh siapa pun yang memiliki jabatan ini.
                  </Text>
                  
                  {menusConfig.map((group, gIdx) => (
                    <View key={gIdx} style={styles.aksesGroup}>
                      <Text style={styles.aksesGroupTitle}>{group.group}</Text>
                      {group.items.map((item, iIdx) => {
                        const isChecked = formData.hak_akses.includes(item.to);
                        return (
                          <TouchableOpacity 
                            key={iIdx} 
                            style={styles.aksesRow}
                            onPress={() => {
                              setFormData(prev => {
                                const current = prev.hak_akses || [];
                                if (isChecked) {
                                  return { ...prev, hak_akses: current.filter(path => path !== item.to) };
                                } else {
                                  return { ...prev, hak_akses: [...current, item.to] };
                                }
                              });
                            }}
                          >
                            <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
                              {isChecked && <Check color="#fff" size={14} />}
                            </View>
                            <Text style={styles.aksesLabel}>{item.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>

                <TouchableOpacity 
                  style={[styles.saveButton, saving && { opacity: 0.7 }]} 
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Save color="#fff" size={20} />
                      <Text style={styles.saveButtonText}>Simpan Data</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            ) : selectedJabatan ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.avatarContainer}>
                  <View style={[styles.iconWrapper, { width: 80, height: 80, borderRadius: 40 }]}>
                    <Briefcase size={40} color="#1E257F" />
                  </View>
                  <Text style={styles.detailName}>{selectedJabatan.nama_jabatan}</Text>
                  <Text style={styles.detailBadge}>{selectedJabatan.kelompok_jabatan || 'Tanpa Kelompok'}</Text>
                </View>

                {/* Aksi CRUD */}
                <View style={styles.crudActionRow}>
                  <TouchableOpacity style={styles.crudEditButton} onPress={openEditForm}>
                    <Edit color="#1E257F" size={18} />
                    <Text style={styles.crudEditBtnText}>Edit Data</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.crudDeactivateButton} onPress={handleDelete}>
                    <Trash2 color="#E63946" size={18} />
                    <Text style={styles.crudDeactivateBtnText}>Hapus</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Informasi Detail</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Tunjangan / Honor</Text>
                    <Text style={[styles.infoValue, { color: '#059669', fontWeight: 'bold' }]}>
                      Rp {(Number(selectedJabatan.honor) || 0).toLocaleString('id-ID')}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Deskripsi</Text>
                    <Text style={styles.infoValue}>{selectedJabatan.deskripsi || '-'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoTitle}>Hak Akses Menu</Text>
                    <Text style={styles.infoValue}>
                      {selectedJabatan.hak_akses && selectedJabatan.hak_akses.length > 0 
                        ? `${selectedJabatan.hak_akses.length} menu diizinkan` 
                        : 'Belum diatur'}
                    </Text>
                  </View>
                </View>

              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: '#1E257F', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  backButton: { padding: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  searchContainer: {
    backgroundColor: '#1E257F', paddingHorizontal: 16, paddingBottom: 20,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24
  },
  searchBox: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingHorizontal: 16, alignItems: 'center', height: 48
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: '#1A1818' },
  listContainer: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrapper: { backgroundColor: '#ECEEFF', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  textContainer: { marginLeft: 16, flex: 1 },
  nameText: { fontSize: 16, fontWeight: 'bold', color: '#1A1818', marginBottom: 4 },
  subText: { fontSize: 14, color: '#6C757D' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#ADB5BD', textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 48, right: 24, backgroundColor: '#2a2c87',
    width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 6
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '80%', padding: 24
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1818' },
  avatarContainer: { alignItems: 'center', marginBottom: 16 },
  detailName: { fontSize: 22, fontWeight: 'bold', color: '#1A1818', marginTop: 12, textAlign: 'center' },
  detailBadge: { backgroundColor: '#ECEEFF', color: '#1E257F', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 14, fontWeight: '600', marginTop: 8 },
  crudActionRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24,
  },
  crudEditButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECEEFF',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  crudEditBtnText: { color: '#1E257F', fontWeight: 'bold', marginLeft: 6 },
  crudDeactivateButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDE8E9',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  crudDeactivateBtnText: { color: '#E63946', fontWeight: 'bold', marginLeft: 6 },
  infoGroup: { marginBottom: 24 },
  infoLabel: { fontSize: 16, fontWeight: 'bold', color: '#1E257F', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoTitle: { fontSize: 14, color: '#6C757D', flex: 1 },
  infoValue: { fontSize: 14, color: '#1A1818', fontWeight: '500', flex: 2, textAlign: 'right' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#6C757D', marginBottom: 6, marginTop: 12 },
  inputField: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#F8F9FA', color: '#1A1818' },
  aksesGroup: { backgroundColor: '#F8F9FA', borderRadius: 8, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  aksesGroupTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E257F', marginBottom: 8 },
  aksesRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: '#CBD5E1', borderRadius: 6, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#1E257F', borderColor: '#1E257F' },
  aksesLabel: { fontSize: 14, color: '#6C757D', flex: 1 },
  saveButton: { backgroundColor: '#1E257F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 32, marginBottom: 40 },
  saveButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  infoBanner: { flexDirection: 'row', backgroundColor: '#ECEEFF', padding: 12, borderRadius: 8, marginTop: 16, alignItems: 'flex-start' },
  infoBannerText: { flex: 1, color: '#1E257F', fontSize: 13, marginLeft: 8, lineHeight: 18 }
});
