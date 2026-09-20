import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarDays, Clock, MapPin, Plus, X, Edit, Trash2, Save, Filter, Settings, User, ArrowUpDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { router } from 'expo-router';
import { getOperationalDayName } from '../../utils/dateUtils';
import { scheduleGuruReminders } from '../../services/scheduleNotificationHelper';

type JadwalForm = {
  id?: number;
  hari: string;
  master_jam_id: string;
  kelas_id: number | null;
  mapel_id: number | null;
  guru_id: number | null;
  is_istirahat: boolean;
};

const DEFAULT_FORM: JadwalForm = {
  hari: 'Senin', master_jam_id: '', kelas_id: null, mapel_id: null, guru_id: null, is_istirahat: false
};

// Helper menghitung menit mulai dari 00:00 untuk pengurutan kronologis yang akurat
const getTimeInMinutes = (item: any) => {
  if (item?.master_jam?.waktu_mulai) {
    const parts = item.master_jam.waktu_mulai.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  if (item?.waktu) {
    const startTimeStr = item.waktu.split('-')[0]?.trim();
    if (startTimeStr) {
      const parts = startTimeStr.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
    }
  }
  return (item?.master_jam?.urutan || parseInt(item?.jam_ke) || 999) * 60;
};

export default function JadwalGuru() {
  const [jadwal, setJadwal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const getHariIni = () => {
    const today = getOperationalDayName();
    return today === 'Minggu' ? 'Senin' : today;
  };

  const [activeHari, setActiveHari] = useState(getHariIni());
  const hariList = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // User and Role
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOperator, setIsOperator] = useState(false);
  const [selectedFilterGuru, setSelectedFilterGuru] = useState<number | null>(null);

  // References
  const [refKelas, setRefKelas] = useState<any[]>([]);
  const [refMapel, setRefMapel] = useState<any[]>([]);
  const [refGuru, setRefGuru] = useState<any[]>([]);
  const [refMasterJam, setRefMasterJam] = useState<any[]>([]);
  const [refPembelajaran, setRefPembelajaran] = useState<any[]>([]);

  // Filter & Urutan
  const [selectedFilterKelas, setSelectedFilterKelas] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'jam' | 'kelas' | 'mapel'>('jam');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<JadwalForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [pickerModal, setPickerModal] = useState<{visible: boolean, type: 'kelas'|'mapel'|'guru'|'filter'|'filterGuru'|'filterUrutan'|'master_jam', items: any[]}>({ visible: false, type: 'kelas', items: [] });

  useEffect(() => {
    initApp();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\(guru-tabs)\jadwal.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    initApp();
  
    });

    return () => listener.remove();
  }, []);

  const initApp = async () => {
    await checkRole();
    await fetchReferenceData();
    // fetchJadwal is called inside checkRole after we know the role
  };

  const checkRole = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user_guru');
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);

        const { data } = await supabase
          .from('jabatan_guru')
          .select('*')
          .eq('guru_id', user.id)
          .maybeSingle();

        const roles = data ? [data.jabatan_utama, data.jabatan_lain_1, data.jabatan_lain_2, data.jabatan_lain_3].filter(Boolean) : [];
        const canViewAll = user.role === 'admin' || roles.some((r: string) => {
          const lower = (r || '').toLowerCase();
          return lower.includes('operator') || lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('admin') || lower.includes('kurikulum');
        });

        if (canViewAll) {
          setIsOperator(true);
          setSelectedFilterGuru(null); // All by default for operator & kepala sekolah
          fetchJadwal(null);
        } else {
          setIsOperator(false);
          setSelectedFilterGuru(user.id);
          fetchJadwal(user.id);
        }

        scheduleGuruReminders(user.id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [resKelas, resMapel, resGuru, resMasterJam, resPembel] = await Promise.all([
        supabase.from('data_kelas').select('id, nama_kelas').order('nama_kelas'),
        supabase.from('data_mapel').select('id, nama_mapel').order('urutan', { ascending: true }),
        supabase.from('data_guru').select('id, nama').is('tanggal_keluar', null).order('nama'),
        supabase.from('master_jam').select('*').order('urutan', { ascending: true }),
        supabase.from('pembelajaran').select('kelas_id, mapel_id, guru_id')
      ]);
      if (resKelas.data) setRefKelas(resKelas.data);
      if (resMapel.data) setRefMapel(resMapel.data);
      if (resGuru.data) setRefGuru(resGuru.data);
      if (resMasterJam.data) setRefMasterJam(resMasterJam.data);
      if (resPembel.data) setRefPembelajaran(resPembel.data);
    } catch (err) {
      console.error('Ref fetch error:', err);
    }
  };

  const fetchJadwal = async (guruIdFilter: number | null, kelasIdFilter: number | null = selectedFilterKelas) => {
    setLoading(true);
    try {
      let query = supabase
        .from('jadwal_pelajaran')
        .select('*, data_kelas(nama_kelas, data_ruang(nama_ruang)), data_mapel(nama_mapel), data_guru(nama), master_jam(urutan, waktu_mulai, waktu_selesai)')
        .order('hari', { ascending: true });

      if (guruIdFilter) query = query.eq('guru_id', guruIdFilter);
      if (kelasIdFilter) query = query.eq('kelas_id', kelasIdFilter);

      const { data, error } = await query;
      if (error) throw error;
      
      const hariUrutan: Record<string, number> = { 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
      let finalData = data || [];
      finalData.sort((a, b) => {
        const hariDiff = (hariUrutan[a.hari] || 99) - (hariUrutan[b.hari] || 99);
        if (hariDiff !== 0) return hariDiff;

        // Sort by waktu mulai kronologis first
        const timeDiff = getTimeInMinutes(a) - getTimeInMinutes(b);
        if (timeDiff !== 0) return timeDiff;

        // Then by urutan master_jam
        const jamA = a.master_jam?.urutan || parseInt(a.jam_ke) || 999;
        const jamB = b.master_jam?.urutan || parseInt(b.jam_ke) || 999;
        if (jamA !== jamB) return jamA - jamB;

        // Then by ruang
        const ruangA = a.data_kelas?.data_ruang?.nama_ruang || a.data_kelas?.nama_kelas || 'Z';
        const ruangB = b.data_kelas?.data_ruang?.nama_ruang || b.data_kelas?.nama_kelas || 'Z';
        return ruangA.localeCompare(ruangB, undefined, { numeric: true, sensitivity: 'base' });
      });
      setJadwal(finalData);
    } catch (err) {
      console.error('Fetch jadwal error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterGuruChange = (id: number | null) => {
    setSelectedFilterGuru(id);
    fetchJadwal(id, selectedFilterKelas);
  };

  const handleFilterKelasChange = (id: number | null) => {
    setSelectedFilterKelas(id);
    fetchJadwal(selectedFilterGuru, id);
  };



  const openAddForm = () => {
    if (!isOperator) return;
    setFormData({ ...DEFAULT_FORM, hari: activeHari, guru_id: null });
    setIsEditing(false);
    setModalVisible(true);
  };

  const openEditForm = (item: any) => {
    if (!isOperator) return;
    setFormData({
      id: item.id,
      hari: item.hari,
      master_jam_id: item.master_jam_id || '',
      kelas_id: item.kelas_id,
      mapel_id: item.mapel_id,
      guru_id: item.guru_id,
      is_istirahat: item.is_istirahat
    });
    setIsEditing(true);
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    if (!isOperator) return;
    Alert.alert(
      "Hapus Jadwal",
      "Apakah Anda yakin ingin menghapus jadwal ini?",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Hapus", 
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase.from('jadwal_pelajaran').delete().eq('id', id);
            if (!error) {
              fetchJadwal(selectedFilterGuru, selectedFilterKelas);
              if (currentUser?.id) scheduleGuruReminders(currentUser.id);
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
    if (!isOperator) return;
    if (!formData.master_jam_id) {
      Alert.alert("Error", "Jam Pelajaran wajib dipilih.");
      return;
    }
    
    const selectedJam = refMasterJam.find(j => j.id === formData.master_jam_id);
    const isIstirahat = selectedJam?.is_istirahat || false;

    if (!isIstirahat) {
      if (!formData.kelas_id || !formData.mapel_id || !formData.guru_id) {
        Alert.alert("Error", "Kelas, Mapel, dan Guru wajib diisi untuk jam pelajaran.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        hari: formData.hari,
        master_jam_id: formData.master_jam_id,
        jam_ke: selectedJam?.nama_jam || '',
        waktu: `${(selectedJam?.waktu_mulai || '').substring(0,5)} - ${(selectedJam?.waktu_selesai || '').substring(0,5)}`,
        kelas_id: isIstirahat ? null : formData.kelas_id,
        mapel_id: isIstirahat ? null : formData.mapel_id,
        guru_id: isIstirahat ? null : formData.guru_id,
        is_istirahat: isIstirahat
      };

      if (formData.id) {
        const { error } = await supabase.from('jadwal_pelajaran').update(payload).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('jadwal_pelajaran').insert([payload]);
        if (error) throw error;
      }
      
      setModalVisible(false);
      fetchJadwal(selectedFilterGuru, selectedFilterKelas);
      if (currentUser?.id) scheduleGuruReminders(currentUser.id);
    } catch (err: any) {
      Alert.alert("Gagal Menyimpan", err.message);
    } finally {
      setSaving(false);
    }
  };

  const getLabel = (type: string, id: any) => {
    if (!id) return 'Pilih...';
    if (type === 'kelas') return refKelas.find(k => k.id === id)?.nama_kelas || 'Pilih...';
    if (type === 'mapel') return refMapel.find(m => m.id === id)?.nama_mapel || 'Pilih...';
    if (type === 'guru') return refGuru.find(g => g.id === id)?.nama || 'Pilih...';
    if (type === 'master_jam') {
      const jam = refMasterJam.find(m => m.id === id);
      if (jam) return `${jam.nama_jam} (${jam.waktu_mulai.substring(0,5)} - ${jam.waktu_selesai.substring(0,5)}) ${jam.is_istirahat ? ' - Istirahat' : ''}`;
      return 'Pilih...';
    }
    return 'Pilih...';
  };

  const jadwalHariIni = useMemo(() => {
    let list = jadwal.filter(j => j.hari === activeHari);
    list.sort((a, b) => {
      if (sortBy === 'kelas') {
        if (a.is_istirahat && !b.is_istirahat) return 1;
        if (!a.is_istirahat && b.is_istirahat) return -1;
        const kA = a.data_kelas?.nama_kelas || '';
        const kB = b.data_kelas?.nama_kelas || '';
        const kDiff = kA.localeCompare(kB, undefined, { numeric: true, sensitivity: 'base' });
        if (kDiff !== 0) return kDiff;

        const timeDiff = getTimeInMinutes(a) - getTimeInMinutes(b);
        if (timeDiff !== 0) return timeDiff;

        const jamA = a.master_jam?.urutan || parseInt(a.jam_ke) || 999;
        const jamB = b.master_jam?.urutan || parseInt(b.jam_ke) || 999;
        return jamA - jamB;
      }

      if (sortBy === 'mapel') {
        if (a.is_istirahat && !b.is_istirahat) return 1;
        if (!a.is_istirahat && b.is_istirahat) return -1;
        const mA = a.data_mapel?.nama_mapel || '';
        const mB = b.data_mapel?.nama_mapel || '';
        const mDiff = mA.localeCompare(mB, undefined, { numeric: true, sensitivity: 'base' });
        if (mDiff !== 0) return mDiff;

        const timeDiff = getTimeInMinutes(a) - getTimeInMinutes(b);
        if (timeDiff !== 0) return timeDiff;

        const jamA = a.master_jam?.urutan || parseInt(a.jam_ke) || 999;
        const jamB = b.master_jam?.urutan || parseInt(b.jam_ke) || 999;
        return jamA - jamB;
      }

      // Default: sortBy === 'jam' (Urutkan kronologis berdasarkan waktu mulai)
      const timeDiff = getTimeInMinutes(a) - getTimeInMinutes(b);
      if (timeDiff !== 0) return timeDiff;

      const jamA = a.master_jam?.urutan || parseInt(a.jam_ke) || 999;
      const jamB = b.master_jam?.urutan || parseInt(b.jam_ke) || 999;
      if (jamA !== jamB) return jamA - jamB;

      const kA = a.data_kelas?.nama_kelas || '';
      const kB = b.data_kelas?.nama_kelas || '';
      return kA.localeCompare(kB, undefined, { numeric: true, sensitivity: 'base' });
    });
    return list;
  }, [jadwal, activeHari, sortBy]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Jadwal Mengajar</Text>
        </View>
        
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {/* Tombol Filter Kelas */}
          <TouchableOpacity 
            style={styles.filterBtn}
            onPress={() => setPickerModal({ visible: true, type: 'filter', items: [{id: null, nama_kelas: 'Semua Kelas'}, ...refKelas] })}
          >
            <Text style={{ color: '#fff', fontSize: 13, marginRight: 6 }}>
              {selectedFilterKelas ? refKelas.find(k => k.id === selectedFilterKelas)?.nama_kelas : 'Semua Kelas'}
            </Text>
            <Filter size={16} color="#fff" />
          </TouchableOpacity>

          {/* Tombol Filter Guru (Operator) */}
          {isOperator && (
            <TouchableOpacity 
              style={styles.filterBtn}
              onPress={() => setPickerModal({ visible: true, type: 'filterGuru', items: [{id: null, nama: 'Semua Guru'}, ...refGuru] })}
            >
              <Text style={{ color: '#fff', fontSize: 13, marginRight: 6 }}>
                {selectedFilterGuru ? '1 Guru' : 'Semua Guru'}
              </Text>
              <User size={16} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Tombol Filter Urutan */}
          <TouchableOpacity 
            style={styles.filterBtn}
            onPress={() => setPickerModal({ 
              visible: true, 
              type: 'filterUrutan', 
              items: [
                { id: 'jam', label: 'Berdasarkan Jam' },
                { id: 'kelas', label: 'Berdasarkan Kelas' },
                { id: 'mapel', label: 'Berdasarkan Mata Pelajaran' }
              ] 
            })}
          >
            <Text style={{ color: '#fff', fontSize: 13, marginRight: 6 }}>
              {sortBy === 'jam' ? 'Urut: Jam' : sortBy === 'kelas' ? 'Urut: Kelas' : 'Urut: Mapel'}
            </Text>
            <ArrowUpDown size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {isOperator && selectedFilterGuru && (
          <Text style={styles.filterTextInfo}>
            Filter Guru: {refGuru.find(g => g.id === selectedFilterGuru)?.nama}
          </Text>
        )}
      </View>

      <View style={styles.daysContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {hariList.map((hari, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={[styles.dayTab, activeHari === hari && styles.dayTabActive]}
              onPress={() => setActiveHari(hari)}
            >
              <Text style={[styles.dayText, activeHari === hari && styles.dayTextActive]}>{hari}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2a2c87" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {jadwalHariIni.length === 0 ? (
            <View style={styles.emptyState}>
              <CalendarDays size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>Tidak ada jadwal mengajar pada hari {activeHari}.</Text>
            </View>
          ) : (
            jadwalHariIni.map((item, idx) => (
              <Animatable.View key={item.id} animation="fadeInUp" delay={idx * 100} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.jamKe}>Jam ke-{item.jam_ke}</Text>
                  <View style={styles.timeRow}>
                    <Clock size={12} color="#6b7280" />
                    <Text style={styles.timeText}>
                      {item.master_jam?.waktu_mulai 
                        ? `${item.master_jam.waktu_mulai.substring(0, 5)} - ${item.master_jam.waktu_selesai?.substring(0, 5)}` 
                        : (item.waktu || '-')}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.cardRight}>
                  {item.is_istirahat ? (
                    <Text style={[styles.mapelTitle, { color: '#f59e0b' }]}>ISTIRAHAT</Text>
                  ) : (
                    <>
                      <Text style={styles.mapelTitle}>{item.data_mapel?.nama_mapel || 'Mapel tidak diketahui'}</Text>
                      {isOperator && !selectedFilterGuru && (
                        <Text style={styles.guruSubtitle}>{item.data_guru?.nama}</Text>
                      )}
                      <View style={styles.locationRow}>
                        <View style={styles.badgeContainer}>
                          <Text style={styles.badgeText}>{item.data_kelas?.nama_kelas || '-'}</Text>
                        </View>
                        <View style={styles.ruangRow}>
                          <MapPin size={12} color="#9ca3af" />
                          <Text style={styles.ruangText}>{item.data_kelas?.data_ruang?.nama_ruang || '-'}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {/* CRUD Actions (Hanya Operator, Kepsek, Waka Kurikulum) */}
                {isOperator && (
                  <View style={styles.actionCol}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEditForm(item)}>
                      <Edit size={16} color="#4f46e5" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnDel} onPress={() => handleDelete(item.id)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </Animatable.View>
            ))
          )}
        </ScrollView>
      )}

      {/* FAB Add Button (Hanya Operator, Kepsek, Waka Kurikulum) */}
      {isOperator && (
        <TouchableOpacity style={styles.fab} onPress={openAddForm}>
          <Plus color="#fff" size={28} />
        </TouchableOpacity>
      )}

      {/* Form Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Jadwal' : 'Tambah Jadwal'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X color="#4b5563" size={24} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.inputLabel}>Hari</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {hariList.map(h => (
                  <TouchableOpacity 
                    key={h} 
                    style={[styles.chip, formData.hari === h && styles.chipActive]}
                    onPress={() => setFormData({...formData, hari: h})}
                  >
                    <Text style={[styles.chipText, formData.hari === h && styles.chipTextActive]}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Pilih Jam</Text>
                  <TouchableOpacity style={[styles.pickerSelector, { marginBottom: 0 }]} onPress={() => setPickerModal({ visible: true, type: 'master_jam', items: refMasterJam })}>
                    <Text style={styles.pickerSelectorText}>{getLabel('master_jam', formData.master_jam_id)}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={{ backgroundColor: '#eef2ff', padding: 12, borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => {
                    setModalVisible(false);
                    router.push('/(guru-tabs)/master_jam' as any);
                  }}
                >
                  <Settings size={20} color="#4f46e5" />
                </TouchableOpacity>
              </View>

              {(() => {
                const selectedJam = refMasterJam.find(j => j.id === formData.master_jam_id);
                if (selectedJam && !selectedJam.is_istirahat) {
                  return (
                    <>
                  <Text style={styles.inputLabel}>Kelas</Text>
                  <TouchableOpacity style={styles.pickerSelector} onPress={() => setPickerModal({ visible: true, type: 'kelas', items: refKelas })}>
                    <Text style={styles.pickerSelectorText}>{getLabel('kelas', formData.kelas_id)}</Text>
                  </TouchableOpacity>

                  <Text style={styles.inputLabel}>Mata Pelajaran</Text>
                  <TouchableOpacity style={styles.pickerSelector} onPress={() => setPickerModal({ visible: true, type: 'mapel', items: refMapel })}>
                    <Text style={styles.pickerSelectorText}>{getLabel('mapel', formData.mapel_id)}</Text>
                  </TouchableOpacity>

                  <Text style={styles.inputLabel}>Guru Pengajar</Text>
                  <TouchableOpacity style={styles.pickerSelector} onPress={() => {
                    if (isOperator) setPickerModal({ visible: true, type: 'guru', items: refGuru });
                  }} disabled={!isOperator}>
                    <Text style={[styles.pickerSelectorText, !isOperator && { color: '#9ca3af' }]}>
                      {getLabel('guru', formData.guru_id)}
                    </Text>
                  </TouchableOpacity>
                  {!isOperator && <Text style={styles.helperText}>Anda hanya dapat menambah jadwal untuk diri sendiri.</Text>}
                  </>
                  );
                }
                return null;
              })()}

              <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <><Save color="#fff" size={20} /><Text style={styles.saveButtonText}>Simpan Jadwal</Text></>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker Modal */}
      <Modal visible={pickerModal.visible} transparent={true} animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Pilih {pickerModal.type}</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {pickerModal.items.map((item, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.pickerItem}
                  onPress={() => {
                    if (pickerModal.type === 'filter') {
                      handleFilterKelasChange(item.id);
                    } else if (pickerModal.type === 'filterGuru') {
                      handleFilterGuruChange(item.id);
                    } else if (pickerModal.type === 'filterUrutan') {
                      setSortBy(item.id);
                    } else {
                      const newFormData = {...formData, [`${pickerModal.type}_id`]: item.id};
                      
                      // Auto-populate guru_id from pembelajaran if kelas & mapel are selected
                      if (pickerModal.type === 'kelas' || pickerModal.type === 'mapel') {
                        const kId = pickerModal.type === 'kelas' ? item.id : formData.kelas_id;
                        const mId = pickerModal.type === 'mapel' ? item.id : formData.mapel_id;
                        if (kId && mId) {
                          const pemb = refPembelajaran.find(p => p.kelas_id == kId && p.mapel_id == mId);
                          if (pemb && pemb.guru_id) {
                            newFormData.guru_id = pemb.guru_id;
                          } else {
                            if (isOperator) {
                              newFormData.guru_id = null;
                            }
                          }
                        }
                      }
                      
                      setFormData(newFormData);
                    }
                    setPickerModal({ ...pickerModal, visible: false });
                  }}
                >
                  <Text style={styles.pickerItemText}>{item.label || item.nama_kelas || item.nama_mapel || item.nama || (item.nama_jam ? `${item.nama_jam} (${item.waktu_mulai.substring(0,5)})` : '')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerCloseBtn} onPress={() => setPickerModal({...pickerModal, visible: false})}>
              <Text style={styles.pickerCloseText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  filterBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  filterTextInfo: { color: '#daffcc', fontSize: 13, marginTop: 4 },
  daysContainer: { backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dayTab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#f3f4f6' },
  dayTabActive: { backgroundColor: '#daffcc' },
  dayText: { color: '#6b7280', fontWeight: '600' },
  dayTextActive: { color: '#2a2c87', fontWeight: 'bold' },
  listContainer: { padding: 16, paddingBottom: 80 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#9ca3af', marginTop: 16 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardLeft: { flex: 1, justifyContent: 'center' },
  jamKe: { fontSize: 16, fontWeight: 'bold', color: '#2a2c87', marginBottom: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  divider: { width: 1, backgroundColor: '#e5e7eb', marginHorizontal: 12 },
  cardRight: { flex: 2.5, justifyContent: 'center' },
  mapelTitle: { fontSize: 15, fontWeight: 'bold', color: '#1f2937', marginBottom: 6 },
  guruSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badgeContainer: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#4338ca', fontSize: 11, fontWeight: 'bold' },
  ruangRow: { flexDirection: 'row', alignItems: 'center' },
  ruangText: { color: '#6b7280', fontSize: 11, marginLeft: 4 },
  actionCol: { justifyContent: 'space-around', alignItems: 'center', marginLeft: 8 },
  actionBtn: { padding: 6, backgroundColor: '#eef2ff', borderRadius: 6 },
  actionBtnDel: { padding: 6, backgroundColor: '#fee2e2', borderRadius: 6 },
  fab: { position: 'absolute', bottom: 48, right: 24, backgroundColor: '#2a2c87', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  
  // Modal Form
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '85%', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 6, marginTop: 12 },
  inputField: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f9fafb', color: '#1f2937' },
  helperText: { fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  chipText: { fontSize: 14, color: '#4b5563', fontWeight: '500' },
  chipTextActive: { color: '#4f46e5', fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: '#d1d5db', borderRadius: 6, marginRight: 10 },
  checkboxActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#4b5563' },
  pickerSelector: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#f9fafb' },
  pickerSelectorText: { fontSize: 16, color: '#1f2937' },
  saveButton: { backgroundColor: '#2a2c87', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 32, marginBottom: 40 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },

  // Picker Overlay
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  pickerContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  pickerTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerItemText: { fontSize: 16, color: '#1f2937', textAlign: 'center' },
  pickerCloseBtn: { marginTop: 16, paddingVertical: 12, backgroundColor: '#f3f4f6', borderRadius: 8 },
  pickerCloseText: { textAlign: 'center', fontWeight: 'bold', color: '#4b5563' }
});
