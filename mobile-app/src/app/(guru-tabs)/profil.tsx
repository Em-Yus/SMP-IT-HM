import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid, Image, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '../../../services/supabaseClient';
import { User, Phone, MapPin, Briefcase, Calendar, Save, Shield, CheckCircle, Edit2, X, ChevronDown, HelpCircle, Settings, Bell, Trash2, LogOut, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfilGuru() {
  const [guru, setGuru] = useState<any>(null);
  const [jabatan, setJabatan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isPushEnabled, setIsPushEnabled] = useState(true);

  useEffect(() => {
    fetchProfil();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\(guru-tabs)\profil.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchProfil();
  
    });

    return () => listener.remove();
  }, []);



  const fetchProfil = async () => {
    setIsLoading(true);
    try {
      const storedUser = await AsyncStorage.getItem('user_guru');
      if (!storedUser) {
        Alert.alert('Error', 'Sesi login tidak ditemukan');
        setIsLoading(false);
        return;
      }

      const userData = JSON.parse(storedUser);
      const guruId = userData.id;

      const { data: dataGuru, error: errorGuru } = await supabase
        .from('data_guru')
        .select('*')
        .eq('id', guruId)
        .single();

      if (errorGuru) throw errorGuru;

      if (dataGuru?.tanggal_keluar) {
        await AsyncStorage.removeItem('user_guru');
        Alert.alert('Akun Nonaktif', 'Akun Anda sudah dinonaktifkan oleh administrator.');
        router.replace('/login');
        return;
      }
      
      setGuru(dataGuru);
      setFormData(dataGuru);

      const { data: dataJabatan } = await supabase
        .from('jabatan_guru')
        .select('*')
        .eq('guru_id', guruId)
        .maybeSingle();

      if (dataJabatan) {
        setJabatan(dataJabatan);
      }
      
      const pushPref = await AsyncStorage.getItem('pref_push_notif');
      if (pushPref !== null) setIsPushEnabled(pushPref === 'true');
      
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal memuat profil');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePushNotif = async (value: boolean) => {
    setIsPushEnabled(value);
    await AsyncStorage.setItem('pref_push_notif', value.toString());
  };

  const handleLogout = async () => {
    Alert.alert(
      "Konfirmasi Keluar",
      "Apakah Anda yakin ingin keluar dari aplikasi?",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Keluar", 
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem('user_guru');
            router.replace('/login');
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!guru) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('data_guru')
        .update({
          no_wa: formData.no_wa,
          tempat_lahir: formData.tempat_lahir,
          tanggal_lahir: formData.tanggal_lahir,
          agama: formData.agama,
          status_perkawinan: formData.status_perkawinan,
          pendidikan: formData.pendidikan,
          alamat: formData.alamat,
          nama_ibu: formData.nama_ibu
        })
        .eq('id', guru.id);

      if (error) throw error;

      Alert.alert('Berhasil', 'Profil berhasil diperbarui');
      
      const storedUser = JSON.parse(await AsyncStorage.getItem('user_guru') || '{}');
      const updatedUser = { ...storedUser, ...formData };
      await AsyncStorage.setItem('user_guru', JSON.stringify(updatedUser));
      
      setGuru(formData);
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Gagal menyimpan profil');
    } finally {
      setIsSaving(false);
    }
  };



  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2a2c87" />
        <Text style={styles.loadingText}>Memuat Profil Anda...</Text>
      </View>
    );
  }

  if (!guru) {
    return (
      <View style={styles.loadingContainer}>
        <Shield size={60} color="#d1d5db" />
        <Text style={styles.loadingText}>Data Profil Tidak Ditemukan</Text>
      </View>
    );
  }

  const allRoles = [];
  if (jabatan) {
    if (jabatan.jabatan_utama) allRoles.push(jabatan.jabatan_utama);
    if (jabatan.jabatan_lain_1) allRoles.push(jabatan.jabatan_lain_1);
    if (jabatan.jabatan_lain_2) allRoles.push(jabatan.jabatan_lain_2);
    if (jabatan.jabatan_lain_3) allRoles.push(jabatan.jabatan_lain_3);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header Profile */}
        <LinearGradient 
          colors={['#1e1b4b', '#2a2c87', '#3f42b5']} 
          start={{x: 0, y: 0}} 
          end={{x: 1, y: 1}} 
          style={styles.headerCard}
        >
          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              {guru?.foto_url ? (
                <Image source={{ uri: guru.foto_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{getInitials(guru?.nama)}</Text>
              )}
            </View>
            <View style={styles.headerTextContent}>
              <View style={styles.nameRow}>
                <Text style={styles.guruName}>{guru.nama}</Text>
                {guru.status_pegawai === 'Aktif' && (
                  <View style={styles.activeBadge}>
                    <CheckCircle size={14} color="#34d399" />
                    <Text style={styles.activeText}>Aktif</Text>
                  </View>
                )}
              </View>
              <Text style={styles.guruNik}>NIK: {guru.nik || 'Belum Terdaftar'}</Text>
              <Text style={styles.guruSubtitle}>Portal Pegawai & Guru</Text>
            </View>
          </View>
          
          {/* Action Bar */}
          <View style={styles.headerFooter}>
            <TouchableOpacity 
              style={[styles.editToggleBtn, isEditing && styles.editToggleBtnActive]} 
              onPress={() => {
                if (isEditing) {
                  setFormData(guru);
                  setIsEditing(false);
                } else {
                  setIsEditing(true);
                }
              }}
            >
              {isEditing ? (
                <>
                  <X size={15} color="#ffffff" />
                  <Text style={[styles.editToggleText, styles.editToggleTextActive]}>Batal Mengubah</Text>
                </>
              ) : (
                <>
                  <Edit2 size={15} color="#ffffff" />
                  <Text style={styles.editToggleText}>Edit Profil</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Data Pribadi */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <User size={20} color="#2a2c87" />
            <Text style={styles.sectionTitle}>Data Pribadi</Text>
          </View>
          
          <View style={styles.sectionBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Lengkap (Read Only)</Text>
              <TextInput style={[styles.inputField, styles.inputDisabled]} value={guru.nama || ''} editable={false} />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Tempat Lahir</Text>
                <TextInput 
                  style={[styles.inputField, isEditing ? styles.inputActive : styles.inputDisabled]} 
                  value={formData.tempat_lahir || ''} 
                  onChangeText={(t) => setFormData({...formData, tempat_lahir: t})}
                  editable={isEditing} 
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Tgl Lahir (YYYY-MM-DD)</Text>
                <TextInput 
                  style={[styles.inputField, isEditing ? styles.inputActive : styles.inputDisabled]} 
                  value={formData.tanggal_lahir || ''} 
                  onChangeText={(t) => setFormData({...formData, tanggal_lahir: t})}
                  editable={isEditing} 
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>No WhatsApp</Text>
              <View style={styles.inputWithIcon}>
                <Phone size={18} color={isEditing ? "#2a2c87" : "#9ca3af"} style={styles.inputIcon} />
                <TextInput 
                  style={[styles.inputField, styles.inputFieldWithIcon, isEditing ? styles.inputActive : styles.inputDisabled]} 
                  value={formData.no_wa || ''} 
                  onChangeText={(t) => setFormData({...formData, no_wa: t})}
                  keyboardType="phone-pad"
                  editable={isEditing} 
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Agama</Text>
              <TextInput 
                style={[styles.inputField, isEditing ? styles.inputActive : styles.inputDisabled]} 
                value={formData.agama || ''} 
                onChangeText={(t) => setFormData({...formData, agama: t})}
                editable={isEditing} 
                placeholder="Islam / Kristen / dsb"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pendidikan Terakhir</Text>
              <TextInput 
                style={[styles.inputField, isEditing ? styles.inputActive : styles.inputDisabled]} 
                value={formData.pendidikan || ''} 
                onChangeText={(t) => setFormData({...formData, pendidikan: t})}
                editable={isEditing} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Status Perkawinan</Text>
              <TextInput 
                style={[styles.inputField, isEditing ? styles.inputActive : styles.inputDisabled]} 
                value={formData.status_perkawinan || ''} 
                onChangeText={(t) => setFormData({...formData, status_perkawinan: t})}
                editable={isEditing} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nama Ibu Kandung</Text>
              <TextInput 
                style={[styles.inputField, isEditing ? styles.inputActive : styles.inputDisabled]} 
                value={formData.nama_ibu || ''} 
                onChangeText={(t) => setFormData({...formData, nama_ibu: t})}
                editable={isEditing} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Alamat Lengkap</Text>
              <View style={styles.inputWithIcon}>
                <MapPin size={18} color={isEditing ? "#2a2c87" : "#9ca3af"} style={[styles.inputIcon, {top: 14}]} />
                <TextInput 
                  style={[styles.inputField, styles.inputFieldWithIcon, {height: 80, textAlignVertical: 'top'}, isEditing ? styles.inputActive : styles.inputDisabled]} 
                  value={formData.alamat || ''} 
                  onChangeText={(t) => setFormData({...formData, alamat: t})}
                  multiline
                  editable={isEditing} 
                />
              </View>
            </View>
          </View>
          
          {isEditing && (
            <View style={styles.saveActionArea}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Save size={20} color="#fff" />}
                <Text style={styles.saveBtnText}>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Data Kepegawaian */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Briefcase size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Data Kepegawaian</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>NIP</Text>
              <Text style={styles.infoValue}>{guru.nip || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>NUPTK</Text>
              <Text style={styles.infoValue}>{guru.nuptk || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>NIY</Text>
              <Text style={styles.infoValue}>{guru.niy || '-'}</Text>
            </View>
            <View style={[styles.infoRow, {borderBottomWidth: 0, paddingBottom: 0}]}>
              <Text style={styles.infoLabel}>Tanggal Masuk</Text>
              <Text style={styles.infoValue}>
                {guru.tanggal_masuk ? new Date(guru.tanggal_masuk).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Jabatan & Akses */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color="#8b5cf6" />
            <Text style={styles.sectionTitle}>Jabatan & Akses</Text>
          </View>
          <View style={styles.sectionBody}>
            {allRoles.length > 0 ? (
              <View style={styles.roleGrid}>
                {allRoles.map((role, idx) => (
                  <View key={idx} style={styles.roleBadge}>
                    <View style={styles.roleDot} />
                    <Text style={styles.roleText}>{role}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Belum ada jabatan khusus</Text>
            )}
          </View>
        </View>


        {/* Preferensi Aplikasi */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Settings size={20} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Preferensi Aplikasi</Text>
          </View>
          <View style={styles.sectionBody}>
            <View style={styles.prefItem}>
              <View style={styles.prefItemLeft}>
                <View style={[styles.prefIconContainer, { backgroundColor: '#eef2ff' }]}>
                  <Bell size={20} color="#4f46e5" />
                </View>
                <Text style={styles.prefItemText}>Notifikasi Pengingat</Text>
              </View>
              <Switch
                value={isPushEnabled}
                onValueChange={togglePushNotif}
                trackColor={{ false: "#d1d5db", true: "#a5b4fc" }}
                thumbColor={isPushEnabled ? "#4f46e5" : "#f3f4f6"}
              />
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.prefItem} onPress={() => Alert.alert("Bersihkan Cache", "Cache aplikasi telah dibersihkan.")}>
              <View style={styles.prefItemLeft}>
                <View style={[styles.prefIconContainer, { backgroundColor: '#fff7ed' }]}>
                  <Trash2 size={20} color="#ea580c" />
                </View>
                <Text style={styles.prefItemText}>Bersihkan Cache</Text>
              </View>
              <ChevronDown size={20} color="#9ca3af" style={{transform: [{rotate: '-90deg'}]}} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bantuan & Dukungan */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <HelpCircle size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>Bantuan & Dukungan</Text>
          </View>
          <View style={styles.sectionBody}>
            <TouchableOpacity style={styles.prefItem} onPress={() => Alert.alert('Bantuan', 'Silakan hubungi operator sekolah untuk bantuan lebih lanjut.')}>
              <View style={styles.prefItemLeft}>
                <View style={[styles.prefIconContainer, { backgroundColor: '#f0fdf4' }]}>
                  <HelpCircle size={20} color="#16a34a" />
                </View>
                <Text style={styles.prefItemText}>Pusat Bantuan</Text>
              </View>
              <ChevronDown size={20} color="#9ca3af" style={{transform: [{rotate: '-90deg'}]}} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 16 }}>Sistem Informasi Akademik v1.0.0</Text>

        <View style={{height: 40}} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 20, paddingTop: 60 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#475569', fontWeight: '600' },
  
  headerCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 24, elevation: 8, shadowColor: '#1e1b4b', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  headerContent: { padding: 22, flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#e0e7ff', borderWidth: 3, borderColor: '#ffffff', justifyContent: 'center', alignItems: 'center', marginRight: 16, elevation: 6, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.25, shadowRadius: 8, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarText: { fontSize: 30, fontWeight: '900', color: '#2a2c87' },
  headerTextContent: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  guruName: { fontSize: 20, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3, marginRight: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.4)', gap: 4 },
  activeText: { color: '#34d399', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  guruNik: { fontSize: 13, color: '#e0e7ff', marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '600' },
  guruSubtitle: { fontSize: 12, color: '#a5b4fc', marginTop: 3, fontStyle: 'italic' },
  headerFooter: { backgroundColor: 'rgba(0, 0, 0, 0.15)', borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.15)', paddingVertical: 12, paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'flex-end' },
  editToggleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.18)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  editToggleBtnActive: { backgroundColor: 'rgba(239, 68, 68, 0.85)', borderColor: '#ef4444' },
  editToggleText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13, letterSpacing: 0.3 },
  editToggleTextActive: { color: '#ffffff' },

  sectionCard: { backgroundColor: '#ffffff', borderRadius: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.03, shadowRadius: 12, elevation: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', letterSpacing: 0.3 },
  sectionBody: { padding: 20 },
  
  inputRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputField: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 14, color: '#1f2937', fontWeight: '500' },
  inputDisabled: { backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#f3f4f6' },
  inputActive: { borderColor: '#2a2c87', backgroundColor: '#fff' },
  inputWithIcon: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 12, top: 12, zIndex: 1 },
  inputFieldWithIcon: { paddingLeft: 40 },
  
  saveActionArea: { padding: 16, backgroundColor: '#eff6ff', borderTopWidth: 1, borderTopColor: '#dbeafe', alignItems: 'flex-end' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2c87', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, gap: 8 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  infoLabel: { fontSize: 11, fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 13, fontWeight: 'bold', color: '#374151', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3e8ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: '#e9d5ff' },
  roleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9333ea' },
  roleText: { color: '#7e22ce', fontWeight: 'bold', fontSize: 13 },
  emptyText: { color: '#9ca3af', fontStyle: 'italic', fontSize: 14 },
  
  prefItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12 },
  prefItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefIconContainer: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  prefItemText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 60 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', padding: 16, borderRadius: 16, marginTop: 8, borderWidth: 1, borderColor: '#fecaca', gap: 8 },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 }
});
