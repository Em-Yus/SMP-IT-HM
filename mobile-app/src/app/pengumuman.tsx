import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { ChevronLeft, Megaphone, Plus, Trash2, Edit, Save, X, EyeOff, Eye, Send } from 'lucide-react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { sendAnnouncementPushNotification } from '../services/pushNotificationService';
import { formatTargetBadge } from '../utils/pengumumanHelper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Pengumuman() {
  const insets = useSafeAreaInsets();
  const [dataPengumuman, setDataPengumuman] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Form State
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [target, setTarget] = useState('Semua');
  const [targetType, setTargetType] = useState('Semua');
  const [selectedKelas, setSelectedKelas] = useState('7');
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null);
  const [searchSiswaQuery, setSearchSiswaQuery] = useState('');
  const [status, setStatus] = useState('Aktif');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pengRes, kelasRes, siswaRes] = await Promise.all([
        supabase.from('cms_pengumuman').select('*').order('created_at', { ascending: false }),
        supabase.from('data_kelas').select('id, nama_kelas').order('id'),
        supabase.from('data_siswa').select('id, nama, nipd, nisn, kelas').order('nama'),
      ]);
      if (pengRes.error) throw pengRes.error;
      setDataPengumuman(pengRes.data || []);
      setKelasList(kelasRes.data || []);
      setSiswaList(siswaRes.data || []);
    } catch (err) {
      Alert.alert('Error', 'Gagal memuat data pengumuman.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\\app\\pengumuman.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchData();
    });

    return () => listener.remove();
  }, []);

  const openModal = (item: any = null) => {
    if (item) {
      setIsEditing(true);
      setEditId(item.id);
      setJudul(item.judul);
      setIsi(item.isi);
      setTarget(item.target);
      setStatus(item.status);

      const t = String(item.target || '').trim();
      if (t === 'Semua' || t === 'Publik') {
        setTargetType('Semua');
      } else if (t === 'Guru') {
        setTargetType('Guru');
      } else if (t === 'Siswa') {
        setTargetType('Siswa');
      } else if (t.startsWith('Kelas:')) {
        setTargetType('Kelas');
        setSelectedKelas(t.replace('Kelas:', '').trim());
      } else if (t.startsWith('Siswa:')) {
        setTargetType('Siswa_Spesifik');
        const matchId = t.match(/\[(\d+)\]/);
        if (matchId && matchId[1]) {
          const found = siswaList.find((s: any) => String(s.id) === matchId[1]);
          if (found) setSelectedSiswa(found);
        }
      }
    } else {
      setIsEditing(false);
      setEditId(null);
      setJudul('');
      setIsi('');
      setTarget('Semua');
      setTargetType('Semua');
      setStatus('Aktif');
      setSelectedKelas(kelasList[0]?.nama_kelas || '7');
      setSelectedSiswa(null);
      setSearchSiswaQuery('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!judul.trim() || !isi.trim()) {
      Alert.alert('Perhatian', 'Judul dan Isi pengumuman harus diisi!');
      return;
    }

    setIsSaving(true);
    try {
      const payload = { judul: judul.trim(), isi: isi.trim(), target, status };

      if (isEditing) {
        const { error } = await supabase.from('cms_pengumuman').update(payload).eq('id', editId);
        if (error) throw error;
        Alert.alert('Berhasil', 'Pengumuman berhasil diperbarui.');
      } else {
        const { error } = await supabase.from('cms_pengumuman').insert([payload]);
        if (error) throw error;

        // --- Push Notification ---
        if (status === 'Aktif') {
          const pushRes = await sendAnnouncementPushNotification({
            judul: payload.judul,
            isi: payload.isi,
            target: payload.target,
          });
          if (pushRes.success && pushRes.sentCount && pushRes.sentCount > 0) {
            let msg = `Pengumuman berhasil disimpan & terkirim ke ${pushRes.sentCount} perangkat (${payload.target}).`;
            if (pushRes.failedCount && pushRes.failedCount > 0) {
              msg += `\n(${pushRes.failedCount} perangkat gagal terkirim).`;
            }
            Alert.alert('Berhasil', msg);
          } else if (pushRes.failedCount && pushRes.failedCount > 0) {
            Alert.alert('Perhatian', `Pengumuman disimpan, namun notifikasi gagal terkirim ke ${pushRes.failedCount} perangkat.\nDetail: ${pushRes.errors?.[0] || ''}`);
          } else {
            Alert.alert('Berhasil', 'Pengumuman baru berhasil disimpan.');
          }
        } else {
          Alert.alert('Berhasil', 'Pengumuman baru berhasil disimpan (Status: Nonaktif/Arsip).');
        }
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan data.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Pengumuman?', 'Pengumuman yang dihapus tidak dapat dikembalikan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
          setIsLoading(true);
          try {
            await supabase.from('cms_pengumuman').delete().eq('id', id);
            fetchData();
          } catch (err) {
            Alert.alert('Error', 'Gagal menghapus pengumuman.');
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  const handleToggleStatus = async (item: any) => {
    const newStatus = item.status === 'Aktif' ? 'Arsip' : 'Aktif';
    try {
      await supabase.from('cms_pengumuman').update({ status: newStatus }).eq('id', item.id);
      fetchData();
    } catch (err) {
      Alert.alert('Gagal', 'Gagal mengubah status pengumuman.');
    }
  };

  const handleTestNotif = async () => {
    setIsSendingTest(true);
    try {
      const res = await sendAnnouncementPushNotification({
        judul: 'Uji Coba Pengumuman Mobile',
        isi: 'Ini adalah pesan uji coba dari tombol Test Notif Mobile App SMP IT HM.',
        target: 'Semua',
      });
      if (res.success && res.sentCount && res.sentCount > 0) {
        let msg = `Notifikasi uji coba berhasil dikirim ke ${res.sentCount} perangkat!`;
        if (res.failedCount && res.failedCount > 0) {
          msg += `\n(${res.failedCount} perangkat gagal, kemungkinan kendala FCM / beda project Expo).`;
        }
        Alert.alert('Hasil Pengiriman', msg);
      } else if (res.failedCount && res.failedCount > 0) {
        Alert.alert('Pengiriman Gagal', `Gagal mengirim ke ${res.failedCount} perangkat.\nDetail: ${res.errors?.[0] || res.error || ''}`);
      } else {
        Alert.alert('Info', 'Tidak ada perangkat aktif terdaftar.');
      }
    } catch (err: any) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat mengirim notifikasi.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
       const date = new Date(dateString);
       return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
       return dateString;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Pengumuman</Text>
        </View>
        <Text style={styles.headerSubtitle}>Kelola informasi untuk Siswa, Guru & Publik</Text>
      </View>

      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.btnTestNotif} onPress={handleTestNotif} disabled={isSendingTest}>
          {isSendingTest ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
          <Text style={styles.btnTestText}>Test Notif</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnAdd} onPress={() => openModal(null)}>
          <Plus size={18} color="#fff" />
          <Text style={styles.btnAddText}>Buat Pengumuman</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
        ) : dataPengumuman.length === 0 ? (
          <View style={styles.emptyState}>
             <Megaphone size={48} color="#d1d5db" />
             <Text style={styles.emptyText}>Belum ada pengumuman.</Text>
          </View>
        ) : (
          dataPengumuman.map((item) => (
            <View key={item.id} style={[styles.card, item.status === 'Arsip' && styles.cardArchived]}>
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, item.status === 'Aktif' ? styles.badgeActive : styles.badgeArchive]}>
                    <Text style={[styles.badgeText, item.status === 'Aktif' ? styles.badgeTextActive : styles.badgeTextArchive]}>{item.status}</Text>
                  </View>
                  {(() => {
                    const badge = formatTargetBadge(item.target);
                    return (
                      <View style={[styles.badgeTarget, { backgroundColor: badge.bg, borderColor: badge.border, borderWidth: 1 }]}>
                        <Text style={[styles.badgeTargetText, { color: badge.text }]}>{badge.label}</Text>
                      </View>
                    );
                  })()}
                </View>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
              </View>

              <Text style={styles.cardTitle}>{item.judul}</Text>
              <Text style={styles.cardContent} numberOfLines={3}>{item.isi}</Text>

              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.actionBtn, styles.btnToggle]} onPress={() => handleToggleStatus(item)}>
                  {item.status === 'Aktif' ? <EyeOff size={16} color="#6b7280" /> : <Eye size={16} color="#6b7280" />}
                  <Text style={styles.actionBtnText}>{item.status === 'Aktif' ? 'Arsip' : 'Aktifkan'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnEdit]} onPress={() => openModal(item)}>
                  <Edit size={16} color="#d97706" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnTrash]} onPress={() => handleDelete(item.id)}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* FORM MODAL */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Pengumuman' : 'Buat Pengumuman'}</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Judul Pengumuman *</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Judul info singkat..." 
                    value={judul} 
                    onChangeText={setJudul} 
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Isi Pengumuman *</Text>
                  <TextInput 
                    style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]} 
                    placeholder="Tuliskan detail pengumuman..." 
                    value={isi} 
                    onChangeText={setIsi} 
                    multiline
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Target Pembaca</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={targetType}
                      onValueChange={(val) => {
                        setTargetType(val);
                        if (val === 'Semua') setTarget('Semua');
                        else if (val === 'Guru') setTarget('Guru');
                        else if (val === 'Siswa') setTarget('Siswa');
                        else if (val === 'Kelas') {
                          const defK = selectedKelas || kelasList[0]?.nama_kelas || '7';
                          setTarget(`Kelas: ${defK}`);
                        } else if (val === 'Siswa_Spesifik') {
                          const s = selectedSiswa || siswaList[0];
                          if (s) {
                            setSelectedSiswa(s);
                            setTarget(`Siswa: [${s.id}] [${s.nipd}] ${s.nama} (${s.kelas || '-'})`);
                          }
                        }
                      }}
                    >
                      <Picker.Item label="Semua Pengguna (Guru & Siswa)" value="Semua" />
                      <Picker.Item label="Khusus Guru" value="Guru" />
                      <Picker.Item label="Semua Siswa (Seluruh Kelas)" value="Siswa" />
                      <Picker.Item label="Kelas Tertentu (Tingkat / Rombel)" value="Kelas" />
                      <Picker.Item label="Siswa Tertentu (1 Penerima Tunggal)" value="Siswa_Spesifik" />
                    </Picker>
                  </View>
                </View>

                {/* Sub-selector jika Target adalah Kelas Tertentu */}
                {targetType === 'Kelas' && (
                  <View style={styles.subSelectorBox}>
                    <Text style={styles.subSelectorLabel}>PILIH KELAS SASARAN :</Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={selectedKelas}
                        onValueChange={(val) => {
                          setSelectedKelas(val);
                          setTarget(`Kelas: ${val}`);
                        }}
                      >
                        <Picker.Item label="Tingkat Kelas 7 (Semua VII-A, VII-B, dst.)" value="7" />
                        <Picker.Item label="Tingkat Kelas 8 (Semua VIII-A, VIII-B, dst.)" value="8" />
                        <Picker.Item label="Tingkat Kelas 9 (Semua IX-A, IX-B, dst.)" value="9" />
                        {kelasList.map((k: any) => (
                          <Picker.Item key={k.id} label={`Kelas ${k.nama_kelas}`} value={k.nama_kelas} />
                        ))}
                      </Picker>
                    </View>
                    <Text style={styles.subSelectorHint}>
                      Pengumuman hanya akan muncul di aplikasi siswa kelas ini.
                    </Text>
                  </View>
                )}

                {/* Sub-selector jika Target adalah 1 Siswa Spesifik */}
                {targetType === 'Siswa_Spesifik' && (
                  <View style={[styles.subSelectorBox, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                    <Text style={[styles.subSelectorLabel, { color: '#6b21a8' }]}>PILIH 1 SISWA PENERIMA :</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: '#fff', fontSize: 13, marginBottom: 8 }]}
                      placeholder="Cari nama siswa / NIPD..."
                      value={searchSiswaQuery}
                      onChangeText={setSearchSiswaQuery}
                    />
                    <ScrollView style={{ maxHeight: 150, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e9d5ff' }} nestedScrollEnabled>
                      {siswaList
                        .filter((s: any) => {
                          if (!searchSiswaQuery.trim()) return true;
                          const q = searchSiswaQuery.toLowerCase();
                          return (
                            (s.nama || '').toLowerCase().includes(q) ||
                            (s.nipd || '').includes(q) ||
                            (s.nisn || '').includes(q) ||
                            (s.kelas || '').toLowerCase().includes(q)
                          );
                        })
                        .map((s: any) => {
                          const isSelected = selectedSiswa?.id === s.id;
                          return (
                            <TouchableOpacity
                              key={s.id}
                              style={[
                                styles.siswaSelectItem,
                                isSelected && { backgroundColor: '#f3e8ff' }
                              ]}
                              onPress={() => {
                                setSelectedSiswa(s);
                                setTarget(`Siswa: [${s.id}] [${s.nipd}] ${s.nama} (${s.kelas || '-'})`);
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.siswaSelectName, isSelected && { color: '#6b21a8', fontWeight: 'bold' }]}>{s.nama}</Text>
                                <Text style={styles.siswaSelectMeta}>Kelas: {s.kelas || '-'} • NIPD: {s.nipd || '-'}</Text>
                              </View>
                              {isSelected && (
                                <Text style={styles.siswaSelectBadge}>Terpilih</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>
                    {selectedSiswa && (
                      <View style={styles.selectedSiswaBadgeBox}>
                        <Text style={styles.selectedSiswaBadgeText}>
                          Penerima Tertuju: {selectedSiswa.nama} (Kelas {selectedSiswa.kelas || '-'})
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Status Penayangan</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker selectedValue={status} onValueChange={setStatus}>
                      <Picker.Item label="Aktif (Ditayangkan)" value="Aktif" />
                      <Picker.Item label="Arsip (Disembunyikan)" value="Arsip" />
                    </Picker>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
            
            <View style={[
              styles.modalFooter,
              { paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'android' ? 56 : 24) }
            ]}>
              <TouchableOpacity style={styles.btnSaveModal} onPress={handleSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <><Save size={20} color="#fff" /><Text style={styles.btnSaveModalText}>Simpan & Terbitkan</Text></>}
              </TouchableOpacity>
            </View>
          </View>
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
  
  actionSection: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 12 },
  btnTestNotif: { flex: 1, backgroundColor: '#eab308', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  btnTestText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  btnAdd: { flex: 2, backgroundColor: '#85c226', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  btnAddText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, backgroundColor: '#fff', borderRadius: 16 },
  emptyText: { color: '#9ca3af', marginTop: 12, fontStyle: 'italic' },
  
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardArchived: { opacity: 0.7, backgroundColor: '#f9fafb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeArchive: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  badgeTextActive: { color: '#166534' },
  badgeTextArchive: { color: '#6b7280' },
  
  badgeTarget: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTargetText: { fontSize: 11, fontWeight: 'bold', color: '#3730a3' },
  
  cardDate: { fontSize: 11, color: '#9ca3af' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 6 },
  cardContent: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 16 },

  cardActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, gap: 6 },
  btnToggle: { flex: 1, backgroundColor: '#f3f4f6' },
  actionBtnText: { fontSize: 12, fontWeight: 'bold', color: '#4b5563' },
  btnEdit: { backgroundColor: '#fffbeb', width: 44 },
  btnTrash: { backgroundColor: '#fef2f2', width: 44 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, flex: 1, marginTop: Platform.OS === 'android' ? 36 : 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  
  modalBody: { padding: 20 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#4b5563', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14 },
  pickerWrapper: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, overflow: 'hidden' },
  
  modalFooter: { paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff' },
  btnSaveModal: { backgroundColor: '#2a2c87', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnSaveModalText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  subSelectorBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 12, marginBottom: 16 },
  subSelectorLabel: { fontSize: 11, fontWeight: 'bold', color: '#92400e', marginBottom: 6, letterSpacing: 0.5 },
  subSelectorHint: { fontSize: 11, color: '#b45309', marginTop: 6 },
  siswaSelectItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f3e8ff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  siswaSelectName: { fontSize: 13, color: '#1f2937' },
  siswaSelectMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  siswaSelectBadge: { fontSize: 10, backgroundColor: '#7e22ce', color: '#fff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, fontWeight: 'bold' },
  selectedSiswaBadgeBox: { backgroundColor: '#f3e8ff', padding: 8, borderRadius: 8, marginTop: 8 },
  selectedSiswaBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#6b21a8' },
});
