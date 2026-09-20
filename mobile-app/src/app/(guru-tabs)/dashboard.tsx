import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, DeviceEventEmitter, ToastAndroid, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../../../services/supabaseClient';
import { Users, BookOpen, Clock, Activity, Calendar } from 'lucide-react-native';
import { getOperationalDayName } from '../../utils/dateUtils';
import { scheduleGuruReminders } from '../../services/scheduleNotificationHelper';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function DashboardGuru() {
  const [userData, setUserData] = useState<any>(null);
  const [isNotificationDenied, setIsNotificationDenied] = useState(false);
  
  // Widget Data States
  const [totalGuru, setTotalGuru] = useState(0);
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [jabatan, setJabatan] = useState<string>('');

  const [siswaData, setSiswaData] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    const fetchUser = async () => {
      const userStr = await AsyncStorage.getItem('user_guru');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setUserData(parsed);
        if (parsed?.id) {
          registerPushToken(parsed.id);
          scheduleClassReminders(parsed.id);
          fetchDashboardStats(parsed.id);
        }
      }
    };
    fetchUser();

    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in Dashboard Guru');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchUser();
    });

    return () => listener.remove();
  }, []);

  const fetchDashboardStats = async (guruId: any) => {
    try {
      // 1. Get jabatan utama
      const { data: jabatanGuru } = await supabase
        .from('jabatan_guru')
        .select('*')
        .eq('guru_id', guruId)
        .maybeSingle();

      if (jabatanGuru && jabatanGuru.jabatan_utama) {
        setJabatan(jabatanGuru.jabatan_utama);
      }

      // 2. Mock or fetch simple stats for widgets
      const { count: countGuru } = await supabase
        .from('data_guru')
        .select('*', { count: 'exact', head: true })
        .is('tanggal_keluar', null);
      setTotalGuru(countGuru || 0);

      const { data: dataSiswaAll, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('kelas, jenis_kelamin')
        .eq('status_keaktifan', 'Aktif');

      if (errSiswa) {
        console.error('Error fetching data siswa:', errSiswa);
      }

      if (dataSiswaAll) {
         setTotalSiswa(dataSiswaAll.length);
         setSiswaData(dataSiswaAll);
         
         const uniqueClasses = [...new Set(dataSiswaAll.map(s => String(s.kelas)).filter(c => c && c !== 'null' && c !== 'undefined'))].sort() as string[];
         setAvailableClasses(uniqueClasses);
         setSelectedClasses(uniqueClasses);
      }

    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    }
  };

  const registerForPushNotificationsAsync = async () => {
    let token;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        setIsNotificationDenied(true);
        return null;
      } else {
        setIsNotificationDenied(false);
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        console.warn('Project ID not found in app.json');
      }
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    }
    return token;
  };

  const registerPushToken = async (guruId: any) => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token && guruId) {
        const pseudoNipd = `GURU_${guruId}`;
        const { data: existing } = await supabase.from('user_push_tokens').select('id').eq('nipd', pseudoNipd).maybeSingle();
        if (existing) {
          await supabase.from('user_push_tokens').update({ expo_push_token: token }).eq('id', existing.id);
        } else {
          await supabase.from('user_push_tokens').insert({ nipd: pseudoNipd, expo_push_token: token });
        }
      }
    } catch (e) {
      console.log('Push Token Registration Error:', e);
    }
  };

  const scheduleClassReminders = async (guruId: any) => {
    try {
      if (guruId) {
        await scheduleGuruReminders(guruId);
      }
    } catch (e) {
      console.log('Error scheduling class reminders:', e);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 10) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const filteredSiswa = siswaData.filter(s => selectedClasses.includes(String(s.kelas)));
  const totalL = filteredSiswa.filter(s => {
    const jk = s.jenis_kelamin?.toLowerCase() || '';
    return jk.startsWith('l');
  }).length;
  
  const totalP = filteredSiswa.filter(s => {
    const jk = s.jenis_kelamin?.toLowerCase() || '';
    return jk.startsWith('p');
  }).length;

  const classBreakdown: Record<string, { L: number, P: number }> = {};
  selectedClasses.forEach(c => classBreakdown[c] = { L: 0, P: 0 });
  filteredSiswa.forEach(s => {
    const cls = String(s.kelas);
    const jk = s.jenis_kelamin?.toLowerCase() || '';
    if (classBreakdown[cls]) {
      if (jk.startsWith('l')) classBreakdown[cls].L++;
      if (jk.startsWith('p')) classBreakdown[cls].P++;
    }
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2a2c87', '#3b3e9e']}
        style={styles.header}
      >
        <Text style={styles.welcomeText}>{getGreeting()},</Text>
        <Text style={styles.nameText}>{userData?.nama || 'Guru'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{jabatan || 'Pegawai / Guru'}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ringkasan Informasi</Text>
        </View>

        <View style={styles.widgetGrid}>
          <View style={[styles.widgetCard, { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }]}>
            <View style={[styles.widgetIcon, { backgroundColor: '#4f46e5' }]}>
              <Users size={20} color="#ffffff" />
            </View>
            <Text style={styles.widgetValue}>{totalSiswa}</Text>
            <Text style={styles.widgetLabel}>Total Siswa Aktif</Text>
          </View>
          
          <View style={[styles.widgetCard, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
            <View style={[styles.widgetIcon, { backgroundColor: '#059669' }]}>
              <BookOpen size={20} color="#ffffff" />
            </View>
            <Text style={styles.widgetValue}>{totalGuru}</Text>
            <Text style={styles.widgetLabel}>Total Guru & Staf</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Users size={20} color="#2a2c87" />
            <Text style={styles.infoTitle}>Statistik Siswa per Kelas</Text>
          </View>
          <Text style={{fontWeight: 'bold', marginBottom: 8, color: '#374151', fontSize: 13}}>Filter Kelas:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
            {availableClasses.map(c => {
               const isSelected = selectedClasses.includes(c);
               return (
                 <TouchableOpacity 
                   key={c} 
                   style={[styles.chip, isSelected && styles.chipActive]}
                   onPress={() => {
                     if (isSelected) {
                       setSelectedClasses(selectedClasses.filter(cls => cls !== c));
                     } else {
                       setSelectedClasses([...selectedClasses, c]);
                     }
                   }}
                 >
                   <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>Kelas {c}</Text>
                 </TouchableOpacity>
               );
            })}
          </ScrollView>

          <View style={{flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 8, marginBottom: 8}}>
            <Text style={{fontWeight: 'bold', color: '#4b5563', flex: 1, fontSize: 13}}>Kelas</Text>
            <Text style={{fontWeight: 'bold', color: '#4b5563', width: 45, textAlign: 'center', fontSize: 13}}>L</Text>
            <Text style={{fontWeight: 'bold', color: '#4b5563', width: 45, textAlign: 'center', fontSize: 13}}>P</Text>
            <Text style={{fontWeight: 'bold', color: '#4b5563', width: 55, textAlign: 'right', fontSize: 13}}>Total</Text>
          </View>
          {selectedClasses.sort().map(c => (
            <View key={c} style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9fafb'}}>
              <Text style={{color: '#374151', flex: 1, fontSize: 13}}>Kelas {c}</Text>
              <Text style={{color: '#2a2c87', width: 45, textAlign: 'center', fontSize: 13, fontWeight: '500'}}>{classBreakdown[c]?.L || 0}</Text>
              <Text style={{color: '#ea580c', width: 45, textAlign: 'center', fontSize: 13, fontWeight: '500'}}>{classBreakdown[c]?.P || 0}</Text>
              <Text style={{color: '#374151', width: 55, textAlign: 'right', fontSize: 13, fontWeight: 'bold'}}>{(classBreakdown[c]?.L || 0) + (classBreakdown[c]?.P || 0)}</Text>
            </View>
          ))}
          {selectedClasses.length === 0 && (
             <Text style={{textAlign: 'center', color: '#9ca3af', marginVertical: 10, fontSize: 13}}>Pilih minimal satu kelas</Text>
          )}

          <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTopWidth: 2, borderTopColor: '#e5e7eb'}}>
            <Text style={{fontWeight: 'bold', color: '#1f2937', flex: 1, fontSize: 13}}>KESELURUHAN</Text>
            <Text style={{fontWeight: 'bold', color: '#2a2c87', width: 45, textAlign: 'center', fontSize: 14}}>{totalL}</Text>
            <Text style={{fontWeight: 'bold', color: '#ea580c', width: 45, textAlign: 'center', fontSize: 14}}>{totalP}</Text>
            <Text style={{fontWeight: 'bold', color: '#059669', width: 55, textAlign: 'right', fontSize: 14}}>{totalL + totalP}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Calendar size={20} color="#2a2c87" />
            <Text style={styles.infoTitle}>Agenda Hari Ini</Text>
          </View>
          <Text style={styles.infoText}>Tidak ada agenda khusus hari ini. Cek jadwal mengajar di tab Jadwal.</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Activity size={20} color="#eab308" />
            <Text style={styles.infoTitle}>Status Sistem</Text>
          </View>
          <Text style={styles.infoText}>Semua layanan berjalan normal. Untuk mengakses menu operasional, ketuk tombol Menu utama di tengah bawah.</Text>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#2a2c87',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  welcomeText: {
    color: '#a5b4fc',
    fontSize: 16,
    fontWeight: '500',
  },
  nameText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  roleText: {
    color: '#daffcc',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    marginTop: -20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  widgetGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  widgetCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  widgetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  widgetValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  widgetLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: '#1E257F',
    borderColor: '#1E257F',
  },
  chipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ffffff',
  },
});
