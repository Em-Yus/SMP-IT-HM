import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Linking, DeviceEventEmitter, ToastAndroid } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { CalendarDays, Wallet, Award, Clock, ChevronRight, Megaphone, Bell, Trophy, Book, FileText, Tent, Laptop } from 'lucide-react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getOperationalDayName } from '../../utils/dateUtils';
import { scheduleSiswaReminders } from '../../services/scheduleNotificationHelper';

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
  const [activeCbtExam, setActiveCbtExam] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>({
    kehadiran: 0,
    tagihan: 0,
    jadwal: [],
    rataRata: 0
  });

  useEffect(() => {
    fetchSessionAndData();
    
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in Dashboard Siswa');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchSessionAndData();
    });

    return () => listener.remove();
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
        scheduleDailyReminder();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const scheduleDailyReminder = async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const existing = scheduled.find(n => n.content.title === "siapkan buku pelajaran besok!");
      
      if (!existing) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "siapkan buku pelajaran besok!",
            body: "Jangan lupa periksa jadwal pelajaran untuk hari esok.",
            sound: true,
            data: { route: '/(tabs)/jadwal?besok=true' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: 20,
            minute: 0,
          } as any,
        });
        console.log('Daily reminder scheduled for 20:00');
      }
    } catch (e) {
      console.log('Error scheduling daily reminder:', e);
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
        const semester = 'Tahunan';
        const now = new Date();
        const currentYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
        const defaultTahun = `${currentYear}/${currentYear + 1}`;
        const tahunPelajaran = user.tahun_ajaran || defaultTahun;

        let tingkatSiswa = 7;
        if (user.kelas) {
          // Pertama coba ambil dari tabel data_kelas dengan ilike (case-insensitive)
          const { data: kelasData } = await supabase.from('data_kelas').select('tingkat').ilike('nama_kelas', user.kelas).maybeSingle();
          if (kelasData?.tingkat) {
            tingkatSiswa = kelasData.tingkat;
          } else {
            // Fallback: Ekstrak angka dari nama kelas (misal "9a" -> 9)
            const match = String(user.kelas).match(/\d+/);
            if (match) {
              tingkatSiswa = parseInt(match[0], 10);
            }
          }
        }


        // Tentukan Tipe Siswa berdasarkan status_siswa di data_siswa
        let tipeSiswa = 'Siswa Baru';
        if (user.status_siswa) {
          const statusLower = String(user.status_siswa).toLowerCase();
          if (statusLower === 'baru') {
            tipeSiswa = 'Siswa Baru';
          } else if (statusLower === 'pindahan') {
            // Hitung tingkat saat siswa MASUK berdasarkan selisih tahun
            const now = new Date();
            const currentSchoolYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
            const entryYear = parseInt((tahunPelajaran || '').split('/')[0]) || currentSchoolYear;
            const yearsPassed = Math.max(0, currentSchoolYear - entryYear);
            const entryTingkat = Math.max(7, tingkatSiswa - yearsPassed);
            tipeSiswa = `Pindahan Kelas ${entryTingkat}`;
          } else {
            tipeSiswa = user.status_siswa;
          }
        }

        // A. Total Biaya (pakai tahunPelajaran dari data_siswa)
        const { data: configData } = await supabase.from('biaya_pengembangan_mutu').select('data_anggaran')
          .eq('tahun_pelajaran', tahunPelajaran).eq('semester', semester).eq('tipe_siswa', tipeSiswa).maybeSingle();
        let totalBiaya = 0;
        if (configData?.data_anggaran) {
          configData.data_anggaran.forEach((item: any) => {
            const cost = item[`tingkat${tingkatSiswa}`] || item[`kelas${tingkatSiswa}`] || 0;
            totalBiaya += Number(cost);
          });
        }

        // B. Total Pemasukan (pakai tahunPelajaran yang sama)
        const { data: pemasukanData } = await supabase.from('tb_pemasukan_siswa').select('nominal')
          .eq('siswa_id', user.id).eq('tahun_pelajaran', tahunPelajaran).eq('semester', semester);
        const totalPemasukan = (pemasukanData || []).reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);

        // C. Saldo & Subsidi (pakai tahunPelajaran yang sama)
        const { data: saldoData } = await supabase.from('tb_saldo_siswa').select('saldo_sebelumnya, subsidi_pip')
          .eq('siswa_id', user.id).eq('tahun_pelajaran', tahunPelajaran).eq('semester', semester).maybeSingle();
        const saldoSblm = Number(saldoData?.saldo_sebelumnya) || 0;
        const subsidi = Number(saldoData?.subsidi_pip) || 0;

        totalTagihan = totalBiaya + saldoSblm - subsidi - totalPemasukan;
        if (totalTagihan < 0) totalTagihan = 0;
      } catch (e) {
        console.error('Error calculating tagihan:', e);
      }

      // 3. Jadwal Hari Ini (pergantian hari pukul 18.00 WIB)
      const today = getOperationalDayName();
      
      let jadwalHariIni: any[] = [];
      if (user.kelas) {
        const { data: dataKelasRes } = await supabase
          .from('data_kelas')
          .select('id')
          .eq('nama_kelas', user.kelas)
          .maybeSingle();

        if (dataKelasRes) {
          scheduleSiswaReminders(dataKelasRes.id);
          const { data: jadwal } = await supabase
            .from('jadwal_pelajaran')
            .select('jam_ke, waktu, is_istirahat, data_mapel(nama_mapel), data_guru(nama), master_jam(urutan, waktu_mulai, waktu_selesai)')
            .eq('hari', today)
            .or(`kelas_id.eq.${dataKelasRes.id},is_istirahat.eq.true`);
            
          if (jadwal) {
             const j = jadwal as any[];
             j.sort((a,b) => (a.master_jam?.urutan || 999) - (b.master_jam?.urutan || 999));
             const top5 = j.slice(0, 5);
             jadwalHariIni = top5.map((item: any) => ({
               jam_ke: item.jam_ke,
               waktu: item.master_jam?.waktu_mulai 
                 ? `${item.master_jam.waktu_mulai.substring(0, 5)} - ${item.master_jam.waktu_selesai?.substring(0, 5)}`
                 : item.waktu,
               mapel: item.is_istirahat ? 'ISTIRAHAT' : (item.data_mapel?.nama_mapel || '-'),
               guru: item.is_istirahat ? '-' : (item.data_guru?.nama || '-'),
               is_istirahat: item.is_istirahat
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

      // 5. Cek Ujian CBT Aktif Hari Ini & Terdaftar
      try {
        let kelasId = user.kelas_id;
        let tingkatSiswa: string | null = null;
        if (user.kelas) {
          const { data: kData } = await supabase.from('data_kelas').select('id, tingkat').ilike('nama_kelas', user.kelas).maybeSingle();
          if (kData) {
            kelasId = kData.id;
            if (kData.tingkat) tingkatSiswa = String(kData.tingkat);
          }
        }

        if (!tingkatSiswa && user.kelas) {
          const upper = user.kelas.toUpperCase().trim();
          if (upper.includes('VII') && !upper.includes('VIII')) tingkatSiswa = '7';
          else if (upper.includes('VIII')) tingkatSiswa = '8';
          else if (upper.includes('IX')) tingkatSiswa = '9';
          else {
            const m = upper.match(/\b([789])\b/);
            if (m) tingkatSiswa = m[1];
          }
        }

        // Cek alokasi ruangan siswa di cbt_peserta_ruang
        let allocatedJadwalIds: number[] = [];
        if (user.id) {
          const { data: pRuangData } = await supabase
            .from('cbt_peserta_ruang')
            .select('jadwal_id')
            .eq('siswa_id', user.id);
          if (pRuangData && pRuangData.length > 0) {
            allocatedJadwalIds = pRuangData.map((p: any) => Number(p.jadwal_id)).filter(Boolean);
          }
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        let cbtQuery = supabase
          .from('cbt_jadwal_ujian')
          .select(`
            id, nama_ujian, jenis_ujian, tanggal_ujian, jam_mulai, jam_selesai, durasi_menit, status,
            mapel_id, bank_soal_id,
            data_mapel(nama_mapel),
            cbt_bank_soal(id, tingkat_kelas)
          `);

        // Filter jadwal hari ini atau yang sedang aktif
        if (allocatedJadwalIds.length > 0) {
          cbtQuery = cbtQuery.or(`id.in.(${allocatedJadwalIds.join(',')}),tanggal_ujian.eq.${todayStr}`);
        } else {
          cbtQuery = cbtQuery.eq('tanggal_ujian', todayStr);
          if (kelasId) {
            cbtQuery = cbtQuery.or(`kelas_id.eq.${kelasId},kelas_id.is.null`);
          } else {
            cbtQuery = cbtQuery.is('kelas_id', null);
          }
        }

        const { data: jadwals } = await cbtQuery;

        if (jadwals && jadwals.length > 0) {
          const active = jadwals.find((j: any) => {
            // Prioritas 1: Jika siswa dialokasikan di peserta_ruang untuk jadwal ini
            const isAllocated = allocatedJadwalIds.includes(Number(j.id));

            const isToday = j.tanggal_ujian === todayStr;
            const mulai = j.jam_mulai?.slice(0, 5) || '00:00';
            const selesai = j.jam_selesai?.slice(0, 5) || '23:59';
            const inTime = isToday && (currentTime >= mulai && currentTime <= selesai);
            const isStatusActive = j.status === 'aktif' || j.status === 'berlangsung';

            if (!inTime && !isStatusActive) return false;

            if (isAllocated) return true;

            // Jika bukan via peserta ruang, cek bank soal
            const bTingkat = j.cbt_bank_soal?.tingkat_kelas;
            if (!bTingkat || bTingkat === 'Semua' || bTingkat === tingkatSiswa) return true;

            return false;
          });
          setActiveCbtExam(active || null);
        } else {
          setActiveCbtExam(null);
        }
      } catch (cbtErr) {
        console.error('Error checking active CBT exam:', cbtErr);
      }
      
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
          <Bell size={24} color="#6C757D" />
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
          <LinearGradient colors={['#3740A1', '#1E257F']} style={styles.card} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
            <CalendarDays size={80} color="#fff" style={styles.cardIconBg} />
            <Text style={styles.cardTitle}>Kehadiran Anda</Text>
            <Text style={styles.cardValue}>{metrics.kehadiran}%</Text>
            <Text style={styles.cardSubtitle}>Sepanjang masa akademik</Text>
          </LinearGradient>
        </Animatable.View>

        {/* Tagihan */}
        <Animatable.View animation="bounceInRight" delay={200} duration={800}>
          <LinearGradient colors={['#FFC736', '#FFB703']} style={styles.card} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
            <Wallet size={80} color="#fff" style={styles.cardIconBg} />
            <Text style={styles.cardTitle}>Tagihan Aktif</Text>
            <Text style={styles.cardValue} numberOfLines={1}>{formatRupiah(metrics.tagihan)}</Text>
            <Text style={styles.cardSubtitle}>Segera lakukan pembayaran</Text>
          </LinearGradient>
        </Animatable.View>

        {/* Nilai */}
        <Animatable.View animation="bounceInRight" delay={300} duration={800}>
          <LinearGradient colors={['#9EEA5A', '#84D43F']} style={styles.card} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
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
          {/* Menu Ujian CBT (Selalu Muncul Permanen) */}
          <TouchableOpacity 
            style={[
              styles.quickAccessBtn, 
              activeCbtExam && { borderColor: '#ef4444', borderWidth: 1.5, backgroundColor: '#FFF5F5' }
            ]} 
            onPress={() => {
              if (activeCbtExam) {
                router.push({ pathname: '/cbt-ujian' as any, params: { jadwalId: activeCbtExam.id } });
              } else {
                router.push('/cbt-jadwal-siswa' as any);
              }
            }}
          >
            <View style={[styles.qaIconBox, { backgroundColor: activeCbtExam ? '#FEE2E2' : '#FEE2E2' }]}>
              <Laptop size={24} color="#dc2626" />
            </View>
            <Text style={[styles.qaText, { color: '#dc2626', fontWeight: 'bold' }]}>
              Ujian CBT
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/nilai')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#ECEEFF' }]}>
              <Award size={24} color="#1E257F" />
            </View>
            <Text style={styles.qaText}>Nilai</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/jadwal')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#F2FBEB' }]}>
              <CalendarDays size={24} color="#84D43F" />
            </View>
            <Text style={styles.qaText}>Jadwal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/rapor')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#FCECEE' }]}>
              <FileText size={24} color="#E63946" />
            </View>
            <Text style={styles.qaText}>Rapor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/mengaji')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#E5F7FB' }]}>
              <Book size={24} color="#00B4D8" />
            </View>
            <Text style={styles.qaText}>Mengaji</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/prestasi')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#FFF8E5' }]}>
              <Trophy size={24} color="#FFB703" />
            </View>
            <Text style={styles.qaText}>Prestasi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={() => router.push('/ekskul' as any)}>
            <View style={[styles.qaIconBox, { backgroundColor: '#E9F9F8' }]}>
              <Tent size={24} color="#2EC4B6" />
            </View>
            <Text style={styles.qaText}>Ekskul</Text>
          </TouchableOpacity>
        </View>

        {/* Banner Ujian Aktif */}
        {activeCbtExam && (
          <TouchableOpacity
            style={styles.activeExamBanner}
            onPress={() => router.push({ pathname: '/cbt-ujian' as any, params: { jadwalId: activeCbtExam.id } })}
            activeOpacity={0.85}
          >
            <View style={styles.activeExamHeader}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeExamBadgeText}>Ujian CBT Sedang Berlangsung</Text>
            </View>
            <Text style={styles.activeExamTitle}>
              {activeCbtExam.data_mapel?.nama_mapel || activeCbtExam.nama_ujian}
            </Text>
            <Text style={styles.activeExamSub}>
              Pukul {activeCbtExam.jam_mulai?.slice(0, 5)} - {activeCbtExam.jam_selesai?.slice(0, 5)} WIB • Klik untuk Memulai
            </Text>
          </TouchableOpacity>
        )}
      </Animatable.View>

      {/* Jadwal Hari Ini */}
      <Animatable.View animation="fadeInUp" delay={400} duration={600} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Clock size={18} color="#1E257F" />
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
    backgroundColor: '#F8F9FA',
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
    color: '#1A1818',
  },
  subtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#FCECEE',
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
    width: '30%',
    backgroundColor: '#FFFFFF',
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
    color: '#1A1818',
  },
  section: {
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1818', marginLeft: 8 },
  linkText: { fontSize: 13, color: '#1E257F', fontWeight: 'bold' },
  emptyBox: { backgroundColor: '#F1F3F5', padding: 20, borderRadius: 8, alignItems: 'center' },
  emptyText: { color: '#ADB5BD', fontSize: 13 },
  logoutText: {
    color: '#E63946',
    fontWeight: 'bold',
  },
  warningBanner: {
    backgroundColor: '#E63946',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  warningTitle: {
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningBtnText: {
    color: '#E63946',
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
    backgroundColor: '#FFF8E5',
    borderColor: '#FFEDC2',
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
  timeBoxNormal: { backgroundColor: '#ECEEFF' },
  timeBoxIstirahat: { backgroundColor: '#FFE399' },
  jadwalTime: { fontSize: 12, fontWeight: 'bold' },
  timeNormal: { color: '#1E257F' },
  timeIstirahat: { color: '#FFB703' },
  jadwalInfo: { flex: 1 },
  jadwalMapel: { fontSize: 14, fontWeight: 'bold', color: '#1A1818' },
  mapelIstirahat: { color: '#FFB703' },
  jadwalGuru: { fontSize: 12, color: '#6C757D', marginTop: 2 },
  jadwalBadge: { backgroundColor: '#F1F3F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  jadwalBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#6C757D' },
  pengumumanItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#1E257F',
    lineHeight: 20,
  },
  pengumumanDateBadge: {
    backgroundColor: '#FFB703',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pengumumanDate: { fontSize: 9, fontWeight: 'bold', color: '#FFFFFF' },
  pengumumanText: { fontSize: 13, color: '#6C757D', lineHeight: 20 },
  activeExamBanner: {
    marginTop: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  activeExamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  activeExamBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#DC2626',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeExamTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#991B1B',
  },
  activeExamSub: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
});
