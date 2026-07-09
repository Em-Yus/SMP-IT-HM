import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { CalendarDays, Wallet, Award, Clock, ChevronRight, Megaphone, Bell, Trophy, Book, FileText } from 'lucide-react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function DashboardScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [isNotificationDenied, setIsNotificationDenied] = useState(false);
  const [metrics, setMetrics] = useState<any>({
    kehadiran: 0,
    tagihan: 0,
    jadwal: [],
    rataRata: 0
  });

  useEffect(() => {
    fetchSessionAndData();
  }, []);

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

  const registerPushToken = async (userNipd: string) => {
    const token = await registerForPushNotificationsAsync();
    if (token && userNipd) {
      // Simpan token ke Supabase dengan cara yang lebih aman (tanpa butuh UNIQUE constraint)
      const { data: existing } = await supabase.from('user_push_tokens').select('id').eq('nipd', userNipd).maybeSingle();
      if (existing) {
        await supabase.from('user_push_tokens').update({ expo_push_token: token }).eq('id', existing.id);
      } else {
        await supabase.from('user_push_tokens').insert({ nipd: userNipd, expo_push_token: token });
      }
    }
  };

  const fetchSessionAndData = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const localUserStr = await AsyncStorage.getItem('user_siswa');
      const { data: { session } } = await supabase.auth.getSession();
      
      let siswaData = null;

      if (session) {
        const { data } = await supabase
          .from('data_siswa')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();
        siswaData = data;
      } else if (localUserStr) {
        siswaData = JSON.parse(localUserStr);
      }

      if (siswaData) {
        setUserData(siswaData);
        fetchDashboardData(siswaData);
        registerPushToken(siswaData.nipd);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDashboardData = async (user: any) => {
    try {
      // 1. Presensi
      const { data: presensi } = await supabase
        .from('presensi_siswa')
        .select('status')
        .eq('nipd', user.nipd);
      
      let kehadiranRate = 0;
      if (presensi && presensi.length > 0) {
        const hadir = presensi.filter(p => ['Hadir', 'Terlambat', 'H', 'T'].includes(p.status)).length;
        kehadiranRate = Math.round((hadir / presensi.length) * 100);
      }

      // 2. Tagihan Aktif
      let totalTagihan = 0;
      try {
        const d = new Date();
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const semester = 'Tahunan'; // Tagihan biasanya diset 'Tahunan'
        const tahunPelajaran = m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;

        let tingkatSiswa = 7;
        if (user.kelas) {
          const { data: kelasData } = await supabase.from('data_kelas').select('tingkat').eq('nama_kelas', user.kelas).maybeSingle();
          if (kelasData?.tingkat) tingkatSiswa = kelasData.tingkat;
        }

        let tipeSiswa = 'Siswa Baru';
        if (user.status_siswa) {
          const statusLower = String(user.status_siswa).toLowerCase();
          if (statusLower === 'baru') tipeSiswa = 'Siswa Baru';
          else if (statusLower === 'pindahan') {
            if (tingkatSiswa === 8) tipeSiswa = 'Pindahan Kelas 8';
            else if (tingkatSiswa === 9) tipeSiswa = 'Pindahan Kelas 9';
          } else {
            tipeSiswa = user.status_siswa;
          }
        }

        // A. Total Biaya
        const { data: configData } = await supabase.from('biaya_pengembangan_mutu').select('data_anggaran')
          .eq('tahun_pelajaran', tahunPelajaran).eq('semester', semester).eq('tipe_siswa', tipeSiswa).maybeSingle();
        let totalBiaya = 0;
        if (configData?.data_anggaran) {
          configData.data_anggaran.forEach((item: any) => {
            const cost = item[`tingkat${tingkatSiswa}`] || item[`kelas${tingkatSiswa}`] || 0;
            totalBiaya += Number(cost);
          });
        }

        // B. Total Pemasukan
        const { data: pemasukanData } = await supabase.from('tb_pemasukan_siswa').select('jumlah_bayar')
          .eq('siswa_id', user.id).eq('tahun_pelajaran', tahunPelajaran).eq('semester', semester);
        const totalPemasukan = (pemasukanData || []).reduce((sum, item) => sum + (Number(item.jumlah_bayar) || 0), 0);

        // C. Saldo & Subsidi
        const { data: saldoData } = await supabase.from('tb_saldo_siswa').select('saldo_sebelumnya, subsidi_pip')
          .eq('siswa_id', user.id).eq('tahun_pelajaran', tahunPelajaran).eq('semester', semester).maybeSingle();
        const saldoSblm = Number(saldoData?.saldo_sebelumnya) || 0;
        const subsidi = Number(saldoData?.subsidi_pip) || 0;

        totalTagihan = totalBiaya + saldoSblm - subsidi - totalPemasukan;
        if (totalTagihan < 0) totalTagihan = 0;
      } catch (e) {
        console.error('Error calculating tagihan:', e);
      }

      // 3. Jadwal Hari Ini
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const today = days[new Date().getDay()];
      
      let jadwalHariIni: any[] = [];
      if (user.kelas) {
        const { data: dataKelasRes } = await supabase
          .from('data_kelas')
          .select('id')
          .eq('nama_kelas', user.kelas)
          .maybeSingle();

        if (dataKelasRes) {
          const { data: jadwal } = await supabase
            .from('jadwal_pelajaran')
            .select('jam_ke, waktu, is_istirahat, data_mapel(nama_mapel), data_guru(nama)')
            .eq('hari', today)
            .or(`kelas_id.eq.${dataKelasRes.id},is_istirahat.eq.true`)
            .order('jam_ke', { ascending: true })
            .limit(5);
            
          if (jadwal) {
             jadwalHariIni = jadwal.map((j: any) => ({
               jam_ke: j.jam_ke,
               waktu: j.waktu,
               mapel: j.is_istirahat ? 'ISTIRAHAT' : (j.data_mapel?.nama_mapel || '-'),
               guru: j.is_istirahat ? '-' : (j.data_guru?.nama || '-'),
               is_istirahat: j.is_istirahat
             }));
          }
        }
      }

      // 4. Rata-rata Nilai
      const { data: nilaiSiswa } = await supabase
        .from('nilai_siswa')
        .select('nilai_siswa')
        .eq('nipd', user.nipd);
      
      let avgNilai: any = 0;
      if (nilaiSiswa && nilaiSiswa.length > 0) {
        const total = nilaiSiswa.reduce((sum, item) => sum + (Number(item.nilai_siswa) || 0), 0);
        avgNilai = (total / nilaiSiswa.length).toFixed(1);
      }

      setMetrics({
        kehadiran: kehadiranRate,
        tagihan: totalTagihan,
        jadwal: jadwalHariIni,
        rataRata: avgNilai
      });
      
    } catch (err) {
      console.error(err);
    }
  };


  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const formatRupiah = (number: any) => {
    return `Rp ${number?.toLocaleString('id-ID') || 0}`;
  };

  const formatDate = (dateString: any) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <Animatable.View animation="fadeInDown" duration={600} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Halo, {userData?.nama || 'Siswa'}! 👋</Text>
          <Text style={styles.subtitle}>Selamat datang di Portal Siswa SIAKAD.</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/pengumuman')}>
          <Bell size={24} color="#6b7280" />
        </TouchableOpacity>
      </Animatable.View>

      {/* Warning Banner for Push Notifications */}
      {isNotificationDenied && (
        <Animatable.View animation="zoomIn" duration={500} style={styles.warningBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Megaphone size={20} color="#fff" />
            <Text style={styles.warningTitle}>PENTING: Izin Notifikasi Ditolak!</Text>
          </View>
          <Text style={styles.warningText}>
            Anda mungkin akan melewatkan pengumuman darurat, jadwal penting, atau informasi tagihan.
          </Text>
          <TouchableOpacity 
            style={styles.warningBtn}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.warningBtnText}>Ketuk di sini untuk Mengaktifkan</Text>
          </TouchableOpacity>
        </Animatable.View>
      )}

      {/* Metrics Cards */}
      <View style={styles.metricsContainer}>
        {/* Kehadiran */}
        <Animatable.View animation="bounceInRight" delay={100} duration={800}>
          <LinearGradient colors={['#f59e0b', '#ea580c']} style={styles.card} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
            <CalendarDays size={80} color="#fff" style={styles.cardIconBg} />
            <Text style={styles.cardTitle}>Kehadiran Anda</Text>
            <Text style={styles.cardValue}>{metrics.kehadiran}%</Text>
            <Text style={styles.cardSubtitle}>Sepanjang masa akademik</Text>
          </LinearGradient>
        </Animatable.View>

        {/* Tagihan */}
        <Animatable.View animation="bounceInRight" delay={200} duration={800}>
          <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.card} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
            <Wallet size={80} color="#fff" style={styles.cardIconBg} />
            <Text style={styles.cardTitle}>Tagihan Aktif</Text>
            <Text style={styles.cardValue} numberOfLines={1}>{formatRupiah(metrics.tagihan)}</Text>
            <Text style={styles.cardSubtitle}>Segera lakukan pembayaran</Text>
          </LinearGradient>
        </Animatable.View>

        {/* Nilai */}
        <Animatable.View animation="bounceInRight" delay={300} duration={800}>
          <LinearGradient colors={['#10b981', '#047857']} style={styles.card} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
            <Award size={80} color="#fff" style={styles.cardIconBg} />
            <Text style={styles.cardTitle}>Rata-rata Nilai</Text>
            <Text style={styles.cardValue}>{metrics.rataRata}</Text>
            <Text style={styles.cardSubtitle}>Dari semua mata pelajaran</Text>
          </LinearGradient>
        </Animatable.View>
      </View>

      {/* Quick Access Menu */}
      <Animatable.View animation="fadeInUp" delay={350} duration={600} style={styles.quickAccessContainer}>
        <Text style={styles.sectionTitle}>Akses Cepat</Text>
        <View style={styles.quickAccessGrid}>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/nilai')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#eef2ff' }]}>
              <Award size={24} color="#4f46e5" />
            </View>
            <Text style={styles.qaText}>Nilai</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/presensi')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#ecfdf5' }]}>
              <CalendarDays size={24} color="#10b981" />
            </View>
            <Text style={styles.qaText}>Presensi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/rapor')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#fef2f2' }]}>
              <FileText size={24} color="#ef4444" />
            </View>
            <Text style={styles.qaText}>Rapor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/mengaji')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#fdf4ff' }]}>
              <Book size={24} color="#d946ef" />
            </View>
            <Text style={styles.qaText}>Mengaji</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/prestasi')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#fffbeb' }]}>
              <Trophy size={24} color="#f59e0b" />
            </View>
            <Text style={styles.qaText}>Prestasi</Text>
          </TouchableOpacity>
        </View>
      </Animatable.View>

      {/* Jadwal Hari Ini */}
      <Animatable.View animation="fadeInUp" delay={400} duration={600} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Clock size={18} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Jadwal Kelas Hari Ini</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/jadwal')}>
            <Text style={styles.linkText}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>

        {metrics.jadwal.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Tidak ada jadwal pelajaran hari ini.</Text>
          </View>
        ) : (
          metrics.jadwal.map((j: any, idx: number) => (
            <View key={idx} style={[styles.jadwalItem, j.is_istirahat && styles.jadwalIstirahat]}>
              <View style={[styles.jadwalTimeBox, j.is_istirahat ? styles.timeBoxIstirahat : styles.timeBoxNormal]}>
                <Text style={[styles.jadwalTime, j.is_istirahat ? styles.timeIstirahat : styles.timeNormal]}>{j.waktu}</Text>
              </View>
              <View style={styles.jadwalInfo}>
                <Text style={[styles.jadwalMapel, j.is_istirahat && styles.mapelIstirahat]}>{j.mapel}</Text>
                {!j.is_istirahat && <Text style={styles.jadwalGuru}>{j.guru}</Text>}
              </View>
              <View style={styles.jadwalBadge}>
                <Text style={styles.jadwalBadgeText}>Ke-{j.jam_ke}</Text>
              </View>
            </View>
          ))
        )}
      </Animatable.View>

      
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6', // gray-100
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#fee2e2', // red-100
    borderRadius: 8,
  },
  metricsContainer: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    padding: 24,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  cardIconBg: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    opacity: 0.15,
    transform: [{ scale: 1.2 }]
  },
  cardTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  cardValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  cardSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4 },
  quickAccessContainer: {
    marginBottom: 24,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  quickAccessBtn: {
    width: '30%', // Menyisakan 10% ruang untuk gap
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  qaIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  qaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginLeft: 8 },
  linkText: { fontSize: 13, color: '#4f46e5', fontWeight: 'bold' },
  emptyBox: { backgroundColor: '#f9fafb', padding: 20, borderRadius: 8, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 13 },
  logoutText: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  warningBanner: {
    backgroundColor: '#ef4444',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  warningTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  warningText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  warningBtn: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningBtnText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 14,
  },

  jadwalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  jadwalIstirahat: {
    backgroundColor: '#fff7ed', // orange-50
    borderColor: '#ffedd5', // orange-100
    borderRadius: 8,
    padding: 8,
  },
  jadwalTimeBox: {
    width: 60,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 12,
  },
  timeBoxNormal: { backgroundColor: '#eff6ff' },
  timeBoxIstirahat: { backgroundColor: '#ffedd5' },
  jadwalTime: { fontSize: 12, fontWeight: 'bold' },
  timeNormal: { color: '#2563eb' },
  timeIstirahat: { color: '#ea580c' },
  jadwalInfo: { flex: 1 },
  jadwalMapel: { fontSize: 14, fontWeight: 'bold', color: '#1f2937' },
  mapelIstirahat: { color: '#ea580c' },
  jadwalGuru: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  jadwalBadge: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  jadwalBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#9ca3af' },
  pengumumanItem: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 12,
  },
  pengumumanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  pengumumanTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e3a8a', // blue-900
    lineHeight: 20,
  },
  pengumumanDateBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pengumumanDate: { fontSize: 9, fontWeight: 'bold', color: '#fff' },
  pengumumanText: { fontSize: 13, color: '#4b5563', lineHeight: 20 },
});
