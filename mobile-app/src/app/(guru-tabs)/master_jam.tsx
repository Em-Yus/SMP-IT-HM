import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Clock, Plus, X, Edit, Trash2, Save } from 'lucide-react-native';
import * as Animatable from 'react-native-animatable';
import DateTimePicker from '@react-native-community/datetimepicker';

type MasterJamForm = {
  id?: string;
  nama_jam: string;
  waktu_mulai: string;
  waktu_selesai: string;
  urutan: string;
  is_istirahat: boolean;
};

const DEFAULT_FORM: MasterJamForm = {
  nama_jam: '', waktu_mulai: '', waktu_selesai: '', urutan: '', is_istirahat: false
};

export default function MasterJamScreen() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<MasterJamForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  
  // DateTimePicker State
  const [showPicker, setShowPicker] = useState(false);
  const [activeField, setActiveField] = useState<'waktu_mulai' | 'waktu_selesai' | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  useEffect(() => {
    initApp();
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      initApp();
    });
    return () => listener.remove();
  }, []);

  const initApp = async () => {
    await fetchData();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase
        .from('master_jam')
        .select('*')
        .order('urutan', { ascending: true });
      if (error) throw error;
      setData(result || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setFormData(DEFAULT_FORM);
    setIsEditing(false);
    setModalVisible(true);
  };

  const openEditForm = (item: any) => {
    setFormData({
      id: item.id,
      nama_jam: item.nama_jam,
      waktu_mulai: item.waktu_mulai.substring(0, 5),
      waktu_selesai: item.waktu_selesai.substring(0, 5),
      urutan: item.urutan.toString(),
      is_istirahat: item.is_istirahat
    });
    setIsEditing(true);
    setModalVisible(true);
  };

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

  const openPicker = (field: 'waktu_mulai' | 'waktu_selesai') => {
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

  const handleDelete = (id: string) => {
    Alert.alert(
      "Hapus Master Jam",
      "Apakah Anda yakin ingin menghapus data ini? Jadwal yang menggunakan jam ini akan ikut terhapus!",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Hapus", 
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase.from('master_jam').delete().eq('id', id);
            if (!error) {
              fetchData();
              DeviceEventEmitter.emit('globalRefresh'); // Refresh jadwal tabs
            } else {
              Alert.alert("Gagal", error.message);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!formData.nama_jam || !formData.waktu_mulai || !formData.waktu_selesai || !formData.urutan) {
      Alert.alert("Error", "Semua kolom wajib diisi.");
      return;
    }

    // Basic time format validation HH:MM
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(formData.waktu_mulai) || !timeRegex.test(formData.waktu_selesai)) {
       Alert.alert("Error", "Format waktu tidak valid (Gunakan format HH:MM, contoh 07:30)");
       return;
    }

    setSaving(true);
    try {
      const payload = {
        nama_jam: formData.nama_jam,
        waktu_mulai: formData.waktu_mulai + ':00',
        waktu_selesai: formData.waktu_selesai + ':00',
        urutan: parseInt(formData.urutan),
        is_istirahat: formData.is_istirahat
      };

      if (formData.id) {
        const { error } = await supabase.from('master_jam').update(payload).eq('id', formData.id);
        if (error) throw error;

        // Sinkronisasi otomatis ke jadwal_pelajaran yang menggunakan master_jam ini
        await supabase.from('jadwal_pelajaran').update({
          jam_ke: formData.nama_jam,
          waktu: `${formData.waktu_mulai} - ${formData.waktu_selesai}`,
          is_istirahat: formData.is_istirahat
        }).eq('master_jam_id', formData.id);
      } else {
        const { error } = await supabase.from('master_jam').insert([payload]);
        if (error) throw error;
      }
      
      setModalVisible(false);
      fetchData();
      DeviceEventEmitter.emit('globalRefresh'); // trigger other tabs to update references
    } catch (err: any) {
      Alert.alert("Gagal Menyimpan", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Master Jam Pelajaran</Text>
        <Text style={styles.headerSubtitle}>Kelola referensi jam sekolah</Text>
      </View>

      {/* Konten */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2a2c87" />
          <Text style={styles.loadingText}>Memuat Data...</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.centerBox}>
          <Clock size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>Belum ada data Master Jam.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {data.map((item, idx) => (
            <Animatable.View key={item.id} animation="fadeInUp" delay={idx * 50} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.badgeUrutan}>
                   <Text style={styles.badgeUrutanText}>{item.urutan}</Text>
                </View>
                <View style={styles.timeRow}>
                  <Clock size={12} color="#6b7280" />
                  <Text style={styles.timeText}>{item.waktu_mulai.substring(0,5)} - {item.waktu_selesai.substring(0,5)}</Text>
                </View>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.cardRight}>
                <Text style={[styles.jamTitle, item.is_istirahat && { color: '#f59e0b' }]}>
                  {item.nama_jam} {item.is_istirahat && '(Istirahat)'}
                </Text>
              </View>

              {/* CRUD Actions */}
              <View style={styles.actionCol}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openEditForm(item)}>
                  <Edit size={16} color="#4f46e5" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnDel} onPress={() => handleDelete(item.id)}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </Animatable.View>
          ))}
        </ScrollView>
      )}

      {/* FAB Add Button */}
      <TouchableOpacity style={styles.fab} onPress={openAddForm}>
        <Plus color="#fff" size={28} />
      </TouchableOpacity>

      {/* Form Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Master Jam' : 'Tambah Master Jam'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X color="#4b5563" size={24} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.inputLabel}>Nama Jam (mis. "1" atau "Istirahat")</Text>
              <TextInput style={styles.inputField} value={formData.nama_jam} onChangeText={(t) => setFormData({...formData, nama_jam: t})} placeholder="Masukkan nama jam" />

              <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Waktu Mulai</Text>
                  <TouchableOpacity style={styles.inputField} onPress={() => openPicker('waktu_mulai')}>
                    <Text style={{color: formData.waktu_mulai ? '#1f2937' : '#9ca3af', fontSize: 15}}>
                      {formData.waktu_mulai || '07:00'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.inputLabel}>Waktu Selesai</Text>
                  <TouchableOpacity style={styles.inputField} onPress={() => openPicker('waktu_selesai')}>
                    <Text style={{color: formData.waktu_selesai ? '#1f2937' : '#9ca3af', fontSize: 15}}>
                      {formData.waktu_selesai || '07:30'}
                    </Text>
                  </TouchableOpacity>
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

              <Text style={styles.inputLabel}>Urutan (Angka)</Text>
              <TextInput style={styles.inputField} value={formData.urutan} onChangeText={(t) => setFormData({...formData, urutan: t})} keyboardType="numeric" placeholder="1, 2, 3..." />

              <View style={styles.switchRow}>
                <TouchableOpacity 
                  style={[styles.checkbox, formData.is_istirahat && styles.checkboxActive]}
                  onPress={() => setFormData({...formData, is_istirahat: !formData.is_istirahat})}
                />
                <Text style={styles.switchLabel}>Ini adalah Jam Istirahat</Text>
              </View>

              <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <><Save color="#fff" size={20} /><Text style={styles.saveButtonText}>Simpan</Text></>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  emptyText: {
    marginTop: 12,
    color: '#9ca3af',
    fontSize: 15,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardLeft: {
    width: 90,
    alignItems: 'flex-start',
  },
  badgeUrutan: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgeUrutanText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4b5563',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
  },
  cardRight: {
    flex: 1,
  },
  jamTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  actionCol: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 10,
  },
  actionBtn: {
    backgroundColor: '#eef2ff',
    padding: 8,
    borderRadius: 8,
  },
  actionBtnDel: {
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2a2c87',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6,
    marginTop: 12,
  },
  inputField: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1f2937',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: '#85c226',
    borderColor: '#85c226',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  saveButton: {
    backgroundColor: '#2a2c87',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 30,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
