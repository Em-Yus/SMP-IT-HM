import React, { useState, useEffect } from 'react';
import {   View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity , DeviceEventEmitter , ToastAndroid, Platform } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { UserCheck, UserX, UserMinus, ChevronLeft, CalendarCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { router } from 'expo-router';

export default function PresensiScreen() {
  const [loading, setLoading] = useState(true);
  const [presensiData, setPresensiData] = useState<any[]>([]);
  
  // Statistik
  const [statHadir, setStatHadir] = useState(0);
  const [statIzin, setStatIzin] = useState(0);
  const [statSakit, setStatSakit] = useState(0);
  const [statTerlambat, setStatTerlambat] = useState(0);
  const [statBolos, setStatBolos] = useState(0);
  const [statAlpa, setStatAlpa] = useState(0);

  useEffect(() => {
    fetchPresensi();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\(tabs)\presensi.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchPresensi();
  
    });

    return () => listener.remove();
  }, []);

  const fetchPresensi = async () => {
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

      if (!user) {
        setLoading(false);
        return;
      }

      const nipd = user.nipd || user.nisn || user.nis;

      if (nipd) {
        const { data: presensi } = await supabase
          .from('presensi_siswa')
          .select('*')
          .eq('nipd', nipd)
          .order('tanggal', { ascending: false });
          
        if (presensi) {
          setPresensiData(presensi);
          
          let h = 0, i = 0, s = 0, t = 0, b = 0, a = 0;
          presensi.forEach(p => {
            const status = (p.status || '').toLowerCase();
            if (status.includes('hadir')) h++;
            else if (status.includes('izin')) i++;
            else if (status.includes('sakit')) s++;
            else if (status.includes('terlambat')) t++;
            else if (status.includes('bolos')) b++;
            else a++;
          });
          
          setStatHadir(h);
          setStatIzin(i);
          setStatSakit(s);
          setStatTerlambat(t);
          setStatBolos(b);
          setStatAlpa(a);
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('hadir')) return '#10b981'; // green
    if (s.includes('izin')) return '#8b5cf6'; // purple
    if (s.includes('sakit')) return '#f59e0b'; // amber
    if (s.includes('terlambat')) return '#f97316'; // orange
    if (s.includes('bolos')) return '#6366f1'; // indigo
    return '#ef4444'; // red
  };
  
  const getStatusIcon = (status: string, color: string) => {
    const s = status.toLowerCase();
    if (s.includes('hadir')) return <UserCheck size={20} color={color} />;
    if (s.includes('izin')) return <UserMinus size={20} color={color} />;
    if (s.includes('sakit')) return <UserMinus size={20} color={color} />;
    if (s.includes('bolos')) return <UserX size={20} color={color} />;
    return <UserX size={20} color={color} />;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // Asumsi format YYYY-MM-DD
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Rekap Presensi</Text>
          <Text style={styles.headerSubtitle}>Riwayat kehadiran Anda</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : (
          <>
            {/* Kartu Statistik Kehadiran */}
            <Animatable.View animation="fadeInDown" duration={600} style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#10b981' }]}>{statHadir}</Text>
                <Text style={styles.statLabel}>Hadir</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{statIzin}</Text>
                <Text style={styles.statLabel}>Izin</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#f59e0b' }]}>{statSakit}</Text>
                <Text style={styles.statLabel}>Sakit</Text>
              </View>
              
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#f97316' }]}>{statTerlambat}</Text>
                <Text style={styles.statLabel}>Terlambat</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#6366f1' }]}>{statBolos}</Text>
                <Text style={styles.statLabel}>Bolos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#ef4444' }]}>{statAlpa}</Text>
                <Text style={styles.statLabel}>Alfa</Text>
              </View>
            </Animatable.View>

            {/* Riwayat Detail */}
            <Text style={styles.sectionTitle}>Riwayat Detail</Text>
            
            {presensiData.length === 0 ? (
              <Animatable.View animation="fadeIn" style={styles.emptyBox}>
                <LinearGradient
                  colors={['#ecfdf5', '#d1fae5']}
                  style={styles.emptyIconBg}
                >
                  <CalendarCheck size={48} color="#10b981" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>Belum Ada Presensi</Text>
                <Text style={styles.emptyText}>Data kehadiran Anda belum dimasukkan atau Anda belum pernah melakukan absensi.</Text>
              </Animatable.View>
            ) : (
              presensiData.map((item, idx) => {
                const color = getStatusColor(item.status || '');
                return (
                  <Animatable.View 
                    key={`presensi-${item.id || idx}`} 
                    animation="fadeInUp" 
                    delay={idx * 50}
                    duration={400}
                  >
                    <View style={styles.card}>
                      <View style={[styles.cardIcon, { backgroundColor: color + '15' }]}>
                        {getStatusIcon(item.status || '', color)}
                      </View>
                      <View style={styles.cardContent}>
                        <Text style={styles.dateText}>{formatDate(item.tanggal)}</Text>
                        <Text style={styles.timeText}>Masuk: {item.waktu_masuk || '-'} | Pulang: {item.waktu_pulang || '-'}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                        <Text style={[styles.statusText, { color: color }]}>
                          {(item.status || 'TIDAK DIKETAHUI').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </Animatable.View>
                );
              })
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#daffcc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#daffcc',
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
    marginLeft: -8,
    backgroundColor: '#daffcc',
    borderRadius: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  contentContainer: {
    padding: 20,
  },
  centerBox: {
    marginTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 15,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statBox: {
    width: '33%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 16,
    paddingLeft: 4,
  },
  emptyBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 11,
  }
});
