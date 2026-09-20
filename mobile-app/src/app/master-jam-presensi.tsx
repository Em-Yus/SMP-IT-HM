import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, Switch } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Clock, Plus, X, Edit, Trash2, Save, ChevronLeft, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

type MasterOpsiForm = {
  id?: number;
  tipe_hari: string;
  jam_masuk: string;
  jam_pulang: string;
  keterangan: string;
  is_active: boolean;
};

const DEFAULT_FORM: MasterOpsiForm = {
  tipe_hari: '',
  jam_masuk: '07:00',
  jam_pulang: '13:00',
  keterangan: '',
  is_active: false
};

export default function MasterJamPresensiScreen() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<MasterOpsiForm>(DEFAULT_FORM);
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
    fetchData();
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      fetchData();
    });
    return () => listener.remove();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const { data: result, error } = await supabase
        .from('master_jam_presensi')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205') {
          setTableMissing(true);
          setData([]);
          return;
        }
        throw error;
      }
      setData(result || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      Alert.alert('Error', 'Gagal mengambil data master jam presensi.');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setFormData({
      ...DEFAULT_FORM,
      is_active: data.length === 0 // otomatis aktif jika data pertama
    });
    setIsEditing(false);
    setModalVisible(true);
  };

  const openEditForm = (item: any) => {
    setFormData({
      id: item.id,
      tipe_hari: item.tipe_hari || '',
      jam_masuk: (item.jam_masuk || '07:00').substring(0, 5),
      jam_pulang: (item.jam_pulang || '13:00').substring(0, 5),
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
        await supabase.from('master_jam_presensi').update({ is_active: false }).neq('id', 0);
      }

      const payload = {
        tipe_hari: formData.tipe_hari,
        jam_masuk: formData.jam_masuk,
        jam_pulang: formData.jam_pulang,
        keterangan: formData.keterangan,
        is_active: formData.is_active
      };

      if (isEditing && formData.id) {
        const { error } = await supabase.from('master_jam_presensi').update(payload).eq('id', formData.id);
        if (error) throw error;
        Alert.alert('Berhasil', 'Opsi jam presensi berhasil diperbarui.');
      } else {
        const { error } = await supabase.from('master_jam_presensi').insert([payload]);
        if (error) throw error;
        Alert.alert('Berhasil', 'Opsi jam presensi berhasil ditambahkan.');
      }

      setModalVisible(false);
      fetchData();
      DeviceEventEmitter.emit('globalRefresh');
    } catch (err: any) {
      console.error('Save error:', err);
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (item: any) => {
    if (item.is_active) return;
    Alert.alert(
      'Aktifkan Opsi Ini?',
      `Seluruh sistem presensi siswa akan otomatis mengikuti aturan "${item.tipe_hari}" (Masuk: ${item.jam_masuk}, Pulang: ${item.jam_pulang}).`,
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Ya, Aktifkan!', 
          onPress: async () => {
            try {
              await supabase.from('master_jam_presensi').update({ is_active: false }).neq('id', 0);
              const { error } = await supabase.from('master_jam_presensi').update({ is_active: true }).eq('id', item.id);
              if (error) throw error;
              Alert.alert('Aktif!', `Opsi "${item.tipe_hari}" kini diterapkan di seluruh sistem.`);
              fetchData();
              DeviceEventEmitter.emit('globalRefresh');
            } catch (err: any) {
              console.error(err);
              Alert.alert('Gagal', 'Gagal mengubah status aktif.');
            }
          } 
        }
      ]
    );
  };

  const handleDelete = (item: any) => {
    if (item.is_active) {
      Alert.alert('Tidak Dapat Dihapus', 'Opsi jam ini sedang AKTIF digunakan. Silakan aktifkan opsi lain terlebih dahulu sebelum menghapus.');
      return;
    }

    Alert.alert(
      'Hapus Opsi?',
      `Anda yakin ingin menghapus opsi "${item.tipe_hari}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('master_jam_presensi').delete().eq('id', item.id);
              if (error) throw error;
              Alert.alert('Terhapus!', 'Opsi jam berhasil dihapus.');
              fetchData();
            } catch (err: any) {
              console.error('Delete error:', err);
              Alert.alert('Gagal', 'Terjadi kesalahan saat menghapus data.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#FFFFFF" size={26} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Master Jam Presensi</Text>
        <TouchableOpacity onPress={openAddForm} disabled={tableMissing} style={[styles.addButton, tableMissing && { opacity: 0.4 }]}>
          <Plus color="#FFFFFF" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.subdesc}>
          Atur aturan jam masuk & jam pulang presensi siswa secara terpusat untuk seluruh aplikasi web dan HP.
        </Text>

        {tableMissing && (
          <View style={styles.warningBox}>
            <View style={styles.warningHeader}>
              <AlertCircle size={20} color="#b45309" />
              <Text style={styles.warningTitle}>Tabel Belum Tersedia di Supabase</Text>
            </View>
            <Text style={styles.warningDesc}>
              Silakan jalankan script SQL pembatas jam presensi (<Text style={{ fontWeight: 'bold' }}>setup_master_jam_presensi.sql</Text>) melalui menu SQL Editor Supabase Anda.
            </Text>
          </View>
        )}

        {loading ? (
          <View style={{ marginTop: 40 }}>
            <ActivityIndicator size="large" color="#2a2c87" />
            <Text style={{ textAlign: 'center', marginTop: 10, color: '#6b7280', fontSize: 14 }}>Memuat data master...</Text>
          </View>
        ) : data.length === 0 && !tableMissing ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Belum ada data opsi jam presensi.</Text>
            <TouchableOpacity style={styles.addFirstBtn} onPress={openAddForm}>
              <Plus size={18} color="#fff" />
              <Text style={styles.addFirstText}>Tambah Opsi Sekarang</Text>
            </TouchableOpacity>
          </View>
        ) : (
          data.map((item) => (
            <View key={item.id} style={[styles.card, item.is_active && styles.cardActive]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cardTitle}>{item.tipe_hari}</Text>
                    {item.is_active && <CheckCircle size={18} color="#10b981" />}
                  </View>
                  {!!item.keterangan && <Text style={styles.cardDesc}>{item.keterangan}</Text>}
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEditForm(item)} style={styles.iconBtn}>
                    <Edit size={18} color="#f59e0b" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.timeContainer}>
                <View style={styles.timeBox}>
                  <Text style={styles.timeLabel}>Batas Jam Masuk</Text>
                  <Text style={[styles.timeValue, { color: '#1e40af' }]}>{item.jam_masuk?.substring(0, 5)}</Text>
                  <Text style={styles.timeNote}>Lewat = Terlambat</Text>
                </View>

                <View style={styles.timeBox}>
                  <Text style={styles.timeLabel}>Batas Jam Pulang</Text>
                  <Text style={[styles.timeValue, { color: '#6b21a8' }]}>{item.jam_pulang?.substring(0, 5)}</Text>
                  <Text style={styles.timeNote}>Sebelum = Bolos</Text>
                </View>
              </View>

              <View style={styles.statusFooter}>
                {item.is_active ? (
                  <View style={styles.badgeActive}>
                    <Text style={styles.badgeActiveText}>⚡ AKTIF DIGUNAKAN SAAT INI</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.btnActivate} onPress={() => handleSetActive(item)}>
                    <Text style={styles.btnActivateText}>Gunakan Jadwal Ini</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* MODAL FORM */}
      <Modal visible={modalVisible} animationType="fade" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Opsi Jam Presensi' : 'Tambah Opsi Presensi'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Nama Opsi Presensi <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TextInput 
                style={styles.inputField} 
                value={formData.tipe_hari} 
                onChangeText={(t) => setFormData({ ...formData, tipe_hari: t })}
                placeholder="Pilih cepat di bawah atau ketik manual..." 
                placeholderTextColor="#9ca3af"
              />
              <View style={styles.chipRow}>
                {['Hari Reguler', 'Bulan Ramadhan', 'Event / Kegiatan', 'Ujian Sekolah'].map(item => (
                  <TouchableOpacity 
                    key={item} 
                    style={[styles.chip, formData.tipe_hari === item && styles.chipActive]}
                    onPress={() => setFormData({ ...formData, tipe_hari: item })}
                  >
                    <Text style={[styles.chipText, formData.tipe_hari === item && styles.chipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{flexDirection: 'row', gap: 12, marginTop: 16}}>
                <View style={{flex: 1}}>
                  <Text style={styles.label}>Batas Jam Masuk</Text>
                  <TouchableOpacity style={[styles.inputField, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', alignItems: 'center', paddingVertical: 14 }]} onPress={() => openPicker('jam_masuk')}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                      <Clock size={16} color="#1e40af" />
                      <Text style={{color: '#1e40af', fontSize: 18, fontWeight: 'bold'}}>
                        {formData.jam_masuk || '07:00'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.fieldHint}>Tap untuk ubah via Jam</Text>
                </View>

                <View style={{flex: 1}}>
                  <Text style={styles.label}>Batas Jam Pulang</Text>
                  <TouchableOpacity style={[styles.inputField, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff', alignItems: 'center', paddingVertical: 14 }]} onPress={() => openPicker('jam_pulang')}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                      <Clock size={16} color="#6b21a8" />
                      <Text style={{color: '#6b21a8', fontSize: 18, fontWeight: 'bold'}}>
                        {formData.jam_pulang || '13:00'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.fieldHint}>Tap untuk ubah via Jam</Text>
                </View>
              </View>

              {showPicker && (
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={handleTimeChange}
                />
              )}

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Langsung Aktifkan Jadwal Ini</Text>
                <Switch 
                  value={formData.is_active} 
                  onValueChange={(val) => setFormData({ ...formData, is_active: val })}
                  disabled={isEditing && formData.is_active}
                  trackColor={{ false: '#d1d5db', true: '#10b981' }}
                  thumbColor={formData.is_active ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)} disabled={saving}>
                <Text style={styles.btnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={18} color="#fff" />}
                <Text style={styles.btnSaveText}>{saving ? 'Menyimpan...' : 'Simpan Data'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#2a2c87',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  addButton: { padding: 4 },
  content: { padding: 16 },
  subdesc: { fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 18 },
  
  warningBox: { backgroundColor: '#fef3c7', borderLeftWidth: 4, borderLeftColor: '#f59e0b', padding: 14, borderRadius: 8, marginBottom: 16 },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  warningTitle: { fontWeight: '700', color: '#92400e', fontSize: 15 },
  warningDesc: { color: '#b45309', fontSize: 13, lineHeight: 18 },

  emptyBox: { backgroundColor: '#fff', padding: 30, borderRadius: 12, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  emptyText: { color: '#64748b', fontSize: 14, marginBottom: 16 },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2c87', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  addFirstText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  cardActive: { borderColor: '#10b981', borderWidth: 1.5, backgroundColor: '#fbfefc' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  cardDesc: { fontSize: 12, color: '#64748b', marginTop: 3 },
  cardActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { padding: 6, backgroundColor: '#f8fafc', borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  
  timeContainer: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  timeBox: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  timeLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  timeValue: { fontSize: 22, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  timeNote: { fontSize: 10, color: '#94a3b8', marginTop: 2 },

  statusFooter: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  badgeActive: { backgroundColor: '#d1fae5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#6ee7b7', width: '100%', alignItems: 'center' },
  badgeActiveText: { color: '#065f46', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  btnActivate: { backgroundColor: '#f1f5f9', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', width: '100%', alignItems: 'center' },
  btnActivateText: { color: '#334155', fontWeight: '600', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12, marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalCloseBtn: { padding: 4 },
  modalForm: { maxHeight: 450 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  inputField: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1e293b', backgroundColor: '#ffffff' },
  fieldHint: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#f1f5f9', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#2a2c87', borderColor: '#2a2c87' },
  chipTime: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  chipTimeActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#ffffff', fontWeight: '700' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  btnCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  btnCancelText: { color: '#475569', fontWeight: '600', fontSize: 14 },
  btnSave: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2c87', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, gap: 8 },
  btnSaveText: { color: '#fff', fontWeight: '600', fontSize: 14 }
});
