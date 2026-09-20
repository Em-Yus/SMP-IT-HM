import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabaseClient';
import { Clock, Plus, X, Edit, Trash2, Save, ChevronLeft, CheckCircle, AlertCircle, RefreshCw, DollarSign, ShieldAlert } from 'lucide-react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

type MasterJamGuruForm = {
  id?: number;
  tipe_hari: string;
  jam_masuk: string;
  jam_pulang: string;
  honor_kehadiran: number;
  honor_per_jp: number;
  keterangan: string;
  is_active: boolean;
};

const DEFAULT_FORM: MasterJamGuruForm = {
  tipe_hari: '',
  jam_masuk: '08:00',
  jam_pulang: '13:00',
  honor_kehadiran: 5000,
  honor_per_jp: 6500,
  keterangan: '',
  is_active: false
};

export default function MasterJamGuruScreen() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<MasterJamGuruForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // DateTimePicker State
  const [showPicker, setShowPicker] = useState(false);
  const [activeField, setActiveField] = useState<'jam_masuk' | 'jam_pulang' | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate && activeField) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      setFormData(prev => ({
        ...prev,
        [activeField]: timeString
      }));
      setPickerDate(selectedDate);
    }
  };

  const openPicker = (field: 'jam_masuk' | 'jam_pulang') => {
    setActiveField(field);
    const timeValue = formData[field];
    
    let defaultDate = new Date();
    if (timeValue) {
      const [hours, minutes] = timeValue.split(':');
      defaultDate.setHours(parseInt(hours, 10));
      defaultDate.setMinutes(parseInt(minutes, 10));
      defaultDate.setSeconds(0);
    }
    
    setPickerDate(defaultDate);
    setShowPicker(true);
  };

  useEffect(() => {
    checkRoleAndFetch();
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      checkRoleAndFetch();
    });
    return () => listener.remove();
  }, []);

  const checkRoleAndFetch = async () => {
    setLoading(true);
    try {
      const userStr = await AsyncStorage.getItem('user_guru');
      if (!userStr) {
        router.replace('/(auth)/login-guru' as any);
        return;
      }

      const userObj = JSON.parse(userStr);
      let allowed = userObj?.role === 'admin';

      if (!allowed && userObj?.id) {
        const { data: jData } = await supabase.from('jabatan_guru').select('*').eq('guru_id', userObj.id).maybeSingle();
        if (jData) {
          const roles = [jData.jabatan_utama, jData.jabatan_lain_1, jData.jabatan_lain_2, jData.jabatan_lain_3].filter(Boolean);
          allowed = roles.some((r: string) => {
            const lower = (r || '').toLowerCase();
            return lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara') || lower.includes('waka') || lower.includes('kurikulum') || lower.includes('operator') || lower.includes('admin');
          });
        }
      }

      setIsAuthorized(allowed);

      if (!allowed) {
        Alert.alert(
          'Akses Dibatasi',
          'Halaman Jam & Standar hanya dapat diakses oleh Kepala Sekolah, Bendahara, dan Waka. Kurikulum.',
          [
            {
              text: 'Ke Halaman Honor',
              onPress: () => router.replace('/rekap-honor-guru' as any)
            }
          ]
        );
        setLoading(false);
        return;
      }

      await fetchData();
    } catch (err: any) {
      console.error('Fetch error:', err);
      Alert.alert('Error', 'Gagal memeriksa hak akses.');
      setLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase
        .from('master_jam_presensi_guru')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setData(result || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      Alert.alert('Error', 'Gagal mengambil data master jam kerja guru.');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setFormData({
      ...DEFAULT_FORM,
      is_active: data.length === 0
    });
    setIsEditing(false);
    setModalVisible(true);
  };

  const openEditForm = (item: any) => {
    setFormData({
      id: item.id,
      tipe_hari: item.tipe_hari || '',
      jam_masuk: (item.jam_masuk || '08:00').substring(0, 5),
      jam_pulang: (item.jam_pulang || '13:00').substring(0, 5),
      honor_kehadiran: Number(item.honor_kehadiran) || 5000,
      honor_per_jp: Number(item.honor_per_jp) || 6500,
      keterangan: item.keterangan || '',
      is_active: item.is_active || false
    });
    setIsEditing(true);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.tipe_hari || !formData.jam_masuk || !formData.jam_pulang) {
      Alert.alert('Perhatian', 'Tipe hari, jam masuk, dan jam pulang wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      if (formData.is_active) {
        await supabase.from('master_jam_presensi_guru').update({ is_active: false }).neq('id', 0);
      }

      const payload = {
        tipe_hari: formData.tipe_hari,
        jam_masuk: formData.jam_masuk,
        jam_pulang: formData.jam_pulang,
        honor_kehadiran: Number(formData.honor_kehadiran) || 5000,
        honor_per_jp: Number(formData.honor_per_jp) || 6500,
        keterangan: formData.keterangan,
        is_active: formData.is_active
      };

      if (isEditing && formData.id) {
        const { error } = await supabase.from('master_jam_presensi_guru').update(payload).eq('id', formData.id);
        if (error) throw error;
        Alert.alert('Sukses', 'Jadwal jam kerja guru berhasil diperbarui.');
      } else {
        const { error } = await supabase.from('master_jam_presensi_guru').insert([payload]);
        if (error) throw error;
        Alert.alert('Sukses', 'Jadwal jam kerja guru baru berhasil ditambahkan.');
      }

      setModalVisible(false);
      fetchData();
      DeviceEventEmitter.emit('globalRefresh');
    } catch (err: any) {
      console.error('Save error:', err);
      Alert.alert('Error', err.message || 'Gagal menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: any) => {
    try {
      await supabase.from('master_jam_presensi_guru').update({ is_active: false }).neq('id', 0);
      const { error } = await supabase.from('master_jam_presensi_guru').update({ is_active: true }).eq('id', item.id);
      if (error) throw error;

      Alert.alert('Berhasil', `Opsi "${item.tipe_hari}" kini diaktifkan untuk guru.`);
      fetchData();
      DeviceEventEmitter.emit('globalRefresh');
    } catch (err: any) {
      Alert.alert('Error', 'Gagal mengubah status aktif.');
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert(
      'Konfirmasi Hapus',
      `Apakah Anda yakin ingin menghapus opsi "${item.tipe_hari}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('master_jam_presensi_guru').delete().eq('id', item.id);
              if (error) throw error;
              fetchData();
              DeviceEventEmitter.emit('globalRefresh');
            } catch (err: any) {
              Alert.alert('Error', 'Gagal menghapus opsi jadwal.');
            }
          }
        }
      ]
    );
  };

  if (isAuthorized === false) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <ShieldAlert size={64} color="#ef4444" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 8, textAlign: 'center' }}>
          Akses Dibatasi
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
          Halaman Master Jam & Standar hanya dapat diakses oleh Kepala Sekolah, Bendahara, dan Waka. Kurikulum.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#1E257F', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          onPress={() => router.replace('/rekap-honor-guru' as any)}
        >
          <DollarSign size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Buka Rekap Honor Saya</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jam Kerja & Standar Honor</Text>
        <TouchableOpacity onPress={checkRoleAndFetch} style={styles.refreshButton}>
          <RefreshCw color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Banner Ketentuan */}
        <View style={styles.banner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <DollarSign size={18} color="#1e3a8a" />
            <Text style={styles.bannerTitle}>Ketentuan Honor Presensi Guru</Text>
          </View>
          <Text style={styles.bannerText}>• Kehadiran: Rp 5.000 / hari (potong 50% jika telat / pulang cepat).</Text>
          <Text style={styles.bannerText}>• KBM Mengajar: Rp 6.500 / JP (Penuh sesuai jadwal, tanpa potongan).</Text>
          <Text style={styles.bannerText}>• Guru Pengganti (Inval) otomatis menerima honor KBM yang digantikan.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1E257F" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.listContainer}>
            {data.map((item) => (
              <View key={item.id} style={[styles.card, item.is_active && styles.activeCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.badgeWrapper}>
                    <Text style={styles.tipeHariText}>{item.tipe_hari}</Text>
                    {item.is_active && (
                      <View style={styles.activeBadge}>
                        <CheckCircle size={12} color="#059669" />
                        <Text style={styles.activeBadgeText}>Aktif Digunakan</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEditForm(item)} style={styles.actionBtn}>
                      <Edit size={16} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Time Display */}
                <View style={styles.timeRow}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>Jam Masuk</Text>
                    <Text style={[styles.timeVal, { color: '#1d4ed8' }]}>
                      {item.jam_masuk.substring(0, 5)}
                    </Text>
                  </View>
                  <View style={styles.timeDivider} />
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>Jam Pulang</Text>
                    <Text style={[styles.timeVal, { color: '#d97706' }]}>
                      {item.jam_pulang.substring(0, 5)}
                    </Text>
                  </View>
                </View>

                {/* Honor Info */}
                <View style={styles.honorRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.honorLabel}>Honor Hadir</Text>
                    <Text style={styles.honorValue}>Rp {(Number(item.honor_kehadiran) || 5000).toLocaleString('id-ID')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.honorLabel}>Honor per JP</Text>
                    <Text style={[styles.honorValue, { color: '#4338ca' }]}>Rp {(Number(item.honor_per_jp) || 6500).toLocaleString('id-ID')}</Text>
                  </View>
                </View>

                {item.keterangan ? (
                  <Text style={styles.keteranganText}>{item.keterangan}</Text>
                ) : null}

                {!item.is_active && (
                  <TouchableOpacity
                    style={styles.activateBtn}
                    onPress={() => handleToggleActive(item)}
                  >
                    <Text style={styles.activateBtnText}>Gunakan Jadwal Ini</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB Add */}
      <TouchableOpacity style={styles.fab} onPress={openAddForm}>
        <Plus color="#fff" size={28} />
      </TouchableOpacity>

      {/* Modal Add / Edit */}
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
                {isEditing ? 'Edit Jam Kerja Guru' : 'Tambah Jam Kerja Guru'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#6C757D" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.inputLabel}>Tipe Hari / Nama Jadwal *</Text>
              <TextInput
                style={styles.inputField}
                value={formData.tipe_hari}
                onChangeText={(t) => setFormData({ ...formData, tipe_hari: t })}
                placeholder="Cth: Hari Reguler (Normal), Ramadhan..."
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Jam Masuk *</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => openPicker('jam_masuk')}
                  >
                    <Clock size={16} color="#1E257F" />
                    <Text style={styles.timePickerText}>{formData.jam_masuk}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Jam Pulang *</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => openPicker('jam_pulang')}
                  >
                    <Clock size={16} color="#1E257F" />
                    <Text style={styles.timePickerText}>{formData.jam_pulang}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Honor Hadir (Rp)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={formData.honor_kehadiran?.toString()}
                    onChangeText={(t) => setFormData({ ...formData, honor_kehadiran: Number(t.replace(/[^0-9]/g, '')) || 0 })}
                    keyboardType="numeric"
                    placeholder="5000"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Honor / JP (Rp)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={formData.honor_per_jp?.toString()}
                    onChangeText={(t) => setFormData({ ...formData, honor_per_jp: Number(t.replace(/[^0-9]/g, '')) || 0 })}
                    keyboardType="numeric"
                    placeholder="6500"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Keterangan (Opsional)</Text>
              <TextInput
                style={[styles.inputField, { height: 70, textAlignVertical: 'top' }]}
                value={formData.keterangan}
                onChangeText={(t) => setFormData({ ...formData, keterangan: t })}
                multiline
                placeholder="Catatan tambahan..."
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchTitle}>Jadikan Jadwal Aktif</Text>
                  <Text style={styles.switchSubtitle}>Jam ini akan otomatis dipakai sebagai batas absensi & honor guru saat ini.</Text>
                </View>
                <Switch
                  value={formData.is_active}
                  onValueChange={(val) => setFormData({ ...formData, is_active: val })}
                  trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
                  thumbColor={formData.is_active ? '#059669' : '#f4f3f4'}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Save color="#fff" size={20} />
                    <Text style={styles.saveButtonText}>Simpan Jadwal</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DateTimePicker Component */}
      {showPicker && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: '#1E257F',
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: { padding: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  refreshButton: { padding: 8 },
  content: { padding: 16, paddingBottom: 100 },
  banner: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16
  },
  bannerTitle: { fontSize: 13, fontWeight: 'bold', color: '#1E3A8A' },
  bannerText: { fontSize: 11, color: '#3B82F6', marginTop: 2 },
  listContainer: { gap: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  activeCard: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  badgeWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  tipeHariText: { fontSize: 15, fontWeight: 'bold', color: '#1F2937' },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4
  },
  activeBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#065F46' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6, backgroundColor: '#F3F4F6', borderRadius: 8 },
  timeRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  timeBox: { flex: 1, alignItems: 'center' },
  timeLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  timeVal: { fontSize: 18, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2 },
  timeDivider: { width: 1, height: 28, backgroundColor: '#E5E7EB' },
  honorRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 4
  },
  honorLabel: { fontSize: 11, color: '#6B7280' },
  honorValue: { fontSize: 13, fontWeight: 'bold', color: '#059669', marginTop: 1 },
  keteranganText: { fontSize: 12, color: '#6B7280', marginTop: 10, fontStyle: 'italic' },
  activateBtn: {
    marginTop: 12,
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center'
  },
  activateBtnText: { fontSize: 12, fontWeight: 'bold', color: '#4B5563' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E257F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E257F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '90%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#1F2937' },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#4B5563', marginBottom: 6, marginTop: 10 },
  inputField: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937'
  },
  formRow: { flexDirection: 'row' },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12
  },
  timePickerText: { fontSize: 16, fontWeight: 'bold', color: '#1E257F' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  switchTitle: { fontSize: 13, fontWeight: 'bold', color: '#065F46' },
  switchSubtitle: { fontSize: 11, color: '#047857', marginTop: 2 },
  saveButton: {
    backgroundColor: '#1E257F',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});
