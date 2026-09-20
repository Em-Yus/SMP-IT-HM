import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, DeviceEventEmitter, ToastAndroid, Platform, Modal, KeyboardAvoidingView, TextInput, Alert } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { router } from 'expo-router';
import { User, LogOut, MapPin, Calendar, BookOpen, GraduationCap, Users, Edit, X, Save, Map, Phone } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomDatePicker from '../../components/CustomDatePicker';

export default function ProfilScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal & Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in src\\app\\(tabs)\\profil.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchProfile();
    });

    return () => listener.remove();
  }, []);

  const fetchProfile = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const localUserStr = await AsyncStorage.getItem('user_siswa');
      const { data: { session } } = await supabase.auth.getSession();
      
      let user = null;
      if (localUserStr) {
        user = JSON.parse(localUserStr);
      } else if (session?.user?.email) {
        const { data } = await supabase.from('data_siswa').select('*').eq('email', session.user.email).maybeSingle();
        user = data;
      }

      if (user) {
        const { data } = await supabase.from('data_siswa').select('*').eq('id', user.id).maybeSingle();
        setUserData(data || user);
      }
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem('user_siswa');
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const formatDate = (dateString: any) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const openEditForm = () => {
    setFormData(userData);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formData.nama) {
      Alert.alert("Error", "Nama wajib diisi!");
      return;
    }
    
    setSaving(true);
    try {
      const payload = { ...formData };
      
      const { error } = await supabase
        .from('data_siswa')
        .update(payload)
        .eq('id', userData.id);
        
      if (error) throw error;
      
      ToastAndroid.show("Profil berhasil diperbarui", ToastAndroid.SHORT);
      setIsEditing(false);
      
      // Update local storage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('user_siswa', JSON.stringify(payload));
      
      fetchProfile();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2a2c87" />
      </View>
    );
  }

  const avatarUrl = userData?.foto_url || 'https://ui-avatars.com/api/?name=' + (userData?.nama || 'Siswa') + '&background=random';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Profile */}
        <Animatable.View animation="fadeInDown" duration={800} style={styles.headerContainer}>
          <LinearGradient
            colors={['#2a2c87', '#85c226']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerBg}
          >
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              </View>
              <Text style={styles.nameText}>{userData?.nama || 'Siswa'}</Text>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{userData?.kelas || 'Kelas -'}</Text>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>NISN: {userData?.nisn || '-'}</Text>
              </View>

              <TouchableOpacity style={styles.editBtnTop} onPress={openEditForm}>
                <Edit size={16} color="#fff" />
                <Text style={styles.editBtnTopText}>Edit Profil</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animatable.View>

        <View style={styles.contentContainer}>
          <Animatable.View animation="fadeInUp" delay={200} duration={600}>
            <Text style={styles.sectionTitle}>Identitas Utama</Text>
            <View style={styles.card}>
              <InfoRow icon={<MapPin size={20} color="#6b7280" />} label="Tempat Lahir" value={userData?.tempat_lahir || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Calendar size={20} color="#6b7280" />} label="Tanggal Lahir" value={formatDate(userData?.tanggal_lahir)} />
              <View style={styles.divider} />
              <InfoRow icon={<User size={20} color="#6b7280" />} label="Jenis Kelamin" value={userData?.jenis_kelamin === 'L' ? 'Laki-laki' : userData?.jenis_kelamin === 'P' ? 'Perempuan' : '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<User size={20} color="#6b7280" />} label="NIPD" value={userData?.nipd || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<User size={20} color="#6b7280" />} label="NIK" value={userData?.nik || '-'} />
            </View>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" delay={250} duration={600}>
            <Text style={styles.sectionTitle}>Alamat Lengkap</Text>
            <View style={styles.card}>
              <InfoRow icon={<Map size={20} color="#6b7280" />} label="Jalan / Dusun" value={userData?.alamat_detail || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Map size={20} color="#6b7280" />} label="RT / RW" value={`${userData?.rt || '-'} / ${userData?.rw || '-'}`} />
              <View style={styles.divider} />
              <InfoRow icon={<Map size={20} color="#6b7280" />} label="Desa / Kelurahan" value={userData?.desa || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Map size={20} color="#6b7280" />} label="Kecamatan" value={userData?.kecamatan || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Map size={20} color="#6b7280" />} label="Kabupaten / Kota" value={userData?.kabupaten || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Map size={20} color="#6b7280" />} label="Provinsi" value={userData?.provinsi || '-'} />
            </View>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" delay={300} duration={600}>
            <Text style={styles.sectionTitle}>Data Akademik</Text>
            <View style={styles.card}>
              <InfoRow icon={<BookOpen size={20} color="#6b7280" />} label="Status Siswa" value={userData?.status_siswa || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<GraduationCap size={20} color="#6b7280" />} label="Sekolah Asal" value={userData?.sekolah_asal || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Calendar size={20} color="#6b7280" />} label="Tahun Ajaran Masuk" value={userData?.tahun_ajaran || '-'} />
            </View>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" delay={400} duration={600}>
            <Text style={styles.sectionTitle}>Orang Tua / Wali</Text>
            <View style={styles.card}>
              <InfoRow icon={<Users size={20} color="#6b7280" />} label="Nama Ayah" value={userData?.nama_ayah || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Users size={20} color="#6b7280" />} label="Nama Ibu" value={userData?.nama_ibu || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Users size={20} color="#6b7280" />} label="Nama Wali" value={userData?.nama_wali || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Phone size={20} color="#6b7280" />} label="No. WA Ortu" value={userData?.wa_ortu || '-'} />
              <View style={styles.divider} />
              <InfoRow icon={<Phone size={20} color="#6b7280" />} label="No. WA Siswa" value={userData?.wa_siswa || '-'} />
            </View>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" delay={500} duration={600}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={20} color="#ef4444" />
              <Text style={styles.logoutText}>Keluar dari Aplikasi</Text>
            </TouchableOpacity>
          </Animatable.View>
          
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditing}
        onRequestClose={() => setIsEditing(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profil</Text>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* A. IDENTITAS UTAMA */}
              <Text style={styles.sectionHeader}>A. IDENTITAS UTAMA</Text>
              
              <Text style={styles.inputLabel}>Nama Lengkap *</Text>
              <TextInput style={styles.inputField} value={formData?.nama} onChangeText={(t) => setFormData({...formData, nama: t})} />
              
              <Text style={styles.inputLabel}>NIPD (Nomor Induk) - Tidak bisa diubah</Text>
              <TextInput style={[styles.inputField, {backgroundColor: '#f3f4f6'}]} value={formData?.nipd} editable={false} />
              
              <Text style={styles.inputLabel}>NISN - Tidak bisa diubah</Text>
              <TextInput style={[styles.inputField, {backgroundColor: '#f3f4f6'}]} value={formData?.nisn} editable={false} />
              
              <Text style={styles.inputLabel}>NIK / No KTP Siswa</Text>
              <TextInput style={styles.inputField} value={formData?.nik} onChangeText={(t) => setFormData({...formData, nik: t})} keyboardType="numeric" />
              
              <Text style={styles.inputLabel}>Jenis Kelamin (L/P)</Text>
              <TextInput style={styles.inputField} value={formData?.jenis_kelamin} onChangeText={(t) => setFormData({...formData, jenis_kelamin: t})} maxLength={1} placeholder="L atau P" />
              
              <Text style={styles.inputLabel}>Tempat Lahir</Text>
              <TextInput style={styles.inputField} value={formData?.tempat_lahir} onChangeText={(t) => setFormData({...formData, tempat_lahir: t})} />
              
              <CustomDatePicker 
                label="Tanggal Lahir" 
                value={formData?.tanggal_lahir} 
                onChange={(t) => setFormData({...formData, tanggal_lahir: t})} 
              />
              
              {/* B. ALAMAT LENGKAP */}
              <Text style={styles.sectionHeader}>B. ALAMAT LENGKAP</Text>
              
              <Text style={styles.inputLabel}>Jalan / Dusun</Text>
              <TextInput style={styles.inputField} value={formData?.alamat_detail} onChangeText={(t) => setFormData({...formData, alamat_detail: t})} />
              
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>RT</Text>
                  <TextInput style={styles.inputField} value={formData?.rt} onChangeText={(t) => setFormData({...formData, rt: t})} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>RW</Text>
                  <TextInput style={styles.inputField} value={formData?.rw} onChangeText={(t) => setFormData({...formData, rw: t})} keyboardType="numeric" />
                </View>
              </View>

              <Text style={styles.inputLabel}>Desa / Kelurahan</Text>
              <TextInput style={styles.inputField} value={formData?.desa} onChangeText={(t) => setFormData({...formData, desa: t})} />
              
              <Text style={styles.inputLabel}>Kecamatan</Text>
              <TextInput style={styles.inputField} value={formData?.kecamatan} onChangeText={(t) => setFormData({...formData, kecamatan: t})} />
              
              <Text style={styles.inputLabel}>Kabupaten / Kota</Text>
              <TextInput style={styles.inputField} value={formData?.kabupaten} onChangeText={(t) => setFormData({...formData, kabupaten: t})} />
              
              <Text style={styles.inputLabel}>Provinsi</Text>
              <TextInput style={styles.inputField} value={formData?.provinsi} onChangeText={(t) => setFormData({...formData, provinsi: t})} />

              {/* C. DATA AKADEMIK */}
              <Text style={styles.sectionHeader}>C. DATA AKADEMIK</Text>
              
              <Text style={styles.inputLabel}>Kelas - Tidak bisa diubah</Text>
              <TextInput style={[styles.inputField, {backgroundColor: '#f3f4f6'}]} value={formData?.kelas} editable={false} />

              <Text style={styles.inputLabel}>Tahun Ajaran Masuk</Text>
              <TextInput style={styles.inputField} value={formData?.tahun_ajaran} onChangeText={(t) => setFormData({...formData, tahun_ajaran: t})} />

              <Text style={styles.inputLabel}>Status Siswa</Text>
              <TextInput style={styles.inputField} value={formData?.status_siswa} onChangeText={(t) => setFormData({...formData, status_siswa: t})} />

              <Text style={styles.inputLabel}>Sekolah Asal</Text>
              <TextInput style={styles.inputField} value={formData?.sekolah_asal} onChangeText={(t) => setFormData({...formData, sekolah_asal: t})} />

              {/* D. ORANG TUA / WALI */}
              <Text style={styles.sectionHeader}>D. ORANG TUA / WALI</Text>

              <Text style={styles.inputLabel}>Nama Ayah</Text>
              <TextInput style={styles.inputField} value={formData?.nama_ayah} onChangeText={(t) => setFormData({...formData, nama_ayah: t})} />

              <Text style={styles.inputLabel}>Nama Ibu</Text>
              <TextInput style={styles.inputField} value={formData?.nama_ibu} onChangeText={(t) => setFormData({...formData, nama_ibu: t})} />

              <Text style={styles.inputLabel}>Nama Wali (Jika Ada)</Text>
              <TextInput style={styles.inputField} value={formData?.nama_wali} onChangeText={(t) => setFormData({...formData, nama_wali: t})} />

              <Text style={styles.inputLabel}>No. WhatsApp Ortu</Text>
              <TextInput style={styles.inputField} value={formData?.wa_ortu} onChangeText={(t) => setFormData({...formData, wa_ortu: t})} keyboardType="phone-pad" />
              
              {/* E. KONTAK SISWA & STATUS */}
              <Text style={styles.sectionHeader}>E. LAIN-LAIN</Text>

              <Text style={styles.inputLabel}>No. WhatsApp Siswa</Text>
              <TextInput style={styles.inputField} value={formData?.wa_siswa} onChangeText={(t) => setFormData({...formData, wa_siswa: t})} keyboardType="phone-pad" />

              <TouchableOpacity 
                style={[styles.saveButton, saving && { opacity: 0.7 }]} 
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Save color="#fff" size={20} />
                    <Text style={styles.saveButtonText}>Simpan Profil</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const InfoRow = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>{icon}</View>
    <View style={styles.infoTextContainer}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#daffcc',
  },
  headerContainer: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#2a2c87',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  headerBg: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    padding: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  badgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    marginHorizontal: 8,
  },
  editBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    gap: 8,
  },
  editBtnTopText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  contentContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4b5563',
    marginBottom: 12,
    marginTop: 8,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#daffcc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#daffcc',
    marginVertical: 4,
    marginLeft: 56,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Modal Edit Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  sectionHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#2a2c87',
    marginTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  inputLabel: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 12,
  },
  inputField: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
