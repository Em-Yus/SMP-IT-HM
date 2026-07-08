import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { Clock, User, BookOpen } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function JadwalScreen() {
  const [selectedHari, setSelectedHari] = useState('');
  const [jadwalData, setJadwalData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set hari ini secara default
    const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const today = daysMap[new Date().getDay()];
    // Jika hari ini minggu, arahkan ke Senin
    setSelectedHari(today === 'Minggu' ? 'Senin' : today);
  }, []);

  useEffect(() => {
    if (selectedHari) {
      fetchJadwal();
    }
  }, [selectedHari]);

  const fetchJadwal = async () => {
    setLoading(true);
    setJadwalData([]); // Kosongkan saat memuat untuk memicu animasi ulang
    
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

      if (!user || !user.kelas) {
        setLoading(false);
        return;
      }

      const { data: dataKelasRes } = await supabase
        .from('data_kelas')
        .select('id')
        .eq('nama_kelas', user.kelas)
        .maybeSingle();

      if (dataKelasRes) {
        const { data: jadwal } = await supabase
          .from('jadwal_pelajaran')
          .select('jam_ke, waktu, is_istirahat, data_mapel(nama_mapel), data_guru(nama)')
          .eq('hari', selectedHari)
          .or(`kelas_id.eq.${dataKelasRes.id},is_istirahat.eq.true`)
          .order('jam_ke', { ascending: true });
          
        if (jadwal) {
          const formattedJadwal = jadwal.map((j: any) => ({
            jam_ke: j.jam_ke,
            waktu: j.waktu,
            mapel: j.is_istirahat ? 'ISTIRAHAT' : (j.data_mapel?.nama_mapel || '-'),
            guru: j.is_istirahat ? '-' : (j.data_guru?.nama || '-'),
            is_istirahat: j.is_istirahat
          }));
          
          // Beri jeda sedikit agar animasi keluar masuk terasa
          setTimeout(() => {
            setJadwalData(formattedJadwal);
            setLoading(false);
          }, 150);
          return;
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jadwal Pelajaran</Text>
        <Text style={styles.headerSubtitle}>Lihat jadwal kelas Anda dalam seminggu</Text>
      </View>

      {/* Selektor Hari */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysContainer}
        >
          {DAYS.map((hari, idx) => {
            const isSelected = selectedHari === hari;
            return (
              <TouchableOpacity 
                key={idx}
                onPress={() => setSelectedHari(hari)}
                activeOpacity={0.8}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={['#4f46e5', '#3b82f6']} // indigo-600 to blue-500
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.dayButton, styles.dayButtonSelected]}
                  >
                    <Text style={styles.dayTextSelected}>{hari}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.dayButton}>
                    <Text style={styles.dayText}>{hari}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Konten Jadwal */}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : jadwalData.length === 0 ? (
          <Animatable.View animation="fadeIn" style={styles.emptyBox}>
            <Text style={styles.emptyText}>Tidak ada jadwal kelas pada hari {selectedHari}.</Text>
          </Animatable.View>
        ) : (
          jadwalData.map((item, idx) => (
            <Animatable.View 
              key={`${selectedHari}-${idx}`} 
              animation="fadeInUp" 
              delay={idx * 100} // Animasi beruntun (staggered)
              duration={500}
            >
              <View style={[styles.card, item.is_istirahat && styles.cardIstirahat]}>
                <View style={styles.timeSection}>
                  <View style={[styles.timeBadge, item.is_istirahat ? styles.badgeIstirahat : styles.badgeNormal]}>
                    <Text style={[styles.timeText, item.is_istirahat ? styles.textOrange : styles.textBlue]}>
                      Jam ke-{item.jam_ke}
                    </Text>
                  </View>
                  <View style={styles.timeRow}>
                    <Clock size={14} color="#6b7280" />
                    <Text style={styles.timeDetailText}>{item.waktu}</Text>
                  </View>
                </View>

                <View style={styles.infoSection}>
                  <View style={styles.infoRow}>
                    <BookOpen size={16} color={item.is_istirahat ? "#ea580c" : "#1f2937"} />
                    <Text style={[styles.mapelText, item.is_istirahat && styles.textOrange]}>
                      {item.mapel}
                    </Text>
                  </View>
                  {!item.is_istirahat && (
                    <View style={[styles.infoRow, { marginTop: 6 }]}>
                      <User size={16} color="#6b7280" />
                      <Text style={styles.guruText}>{item.guru}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Animatable.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb', // gray-50
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827', // gray-900
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  daysContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  dayButtonSelected: {
    borderWidth: 0,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  dayTextSelected: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  centerBox: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cardIstirahat: {
    backgroundColor: '#fff7ed', // orange-50
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  timeSection: {
    width: 90,
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
    paddingRight: 12,
    marginRight: 12,
    justifyContent: 'center',
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  badgeNormal: {
    backgroundColor: '#eff6ff', // blue-50
  },
  badgeIstirahat: {
    backgroundColor: '#ffedd5', // orange-100
  },
  timeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  textBlue: { color: '#2563eb' },
  textOrange: { color: '#ea580c' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeDetailText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapelText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  guruText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
});
