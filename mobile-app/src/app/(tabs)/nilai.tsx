import React, { useState, useEffect } from 'react';
import {   View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity , DeviceEventEmitter , ToastAndroid, Platform } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { BookOpen, Award, FileText, ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { router } from 'expo-router';

export default function NilaiScreen() {
  const [loading, setLoading] = useState(true);
  const [nilaiData, setNilaiData] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState('pelajaran');

  useEffect(() => {
    fetchNilai();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\(tabs)\nilai.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchNilai();
  
    });

    return () => listener.remove();
  }, []);

  const fetchNilai = async () => {
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

      // Gunakan nipd atau nisn atau nis untuk relasi nilai
      const nipd = user.nipd || user.nisn || user.nis;

      if (nipd) {
        // Fetch nilai
        const { data: nilaiRes } = await supabase
          .from('nilai_siswa')
          .select('*')
          .eq('nipd', nipd)
          .order('created_at', { ascending: false });
          
        // Fetch data_mapel to map names manually because there is no foreign key constraint
        const { data: mapelRes } = await supabase
          .from('data_mapel')
          .select('id, nama_mapel, urutan');
          
        if (nilaiRes) {
          const mapelDict: Record<string, {nama: string, urutan: number}> = {};
          if (mapelRes) {
            mapelRes.forEach((m: any) => {
              mapelDict[m.id.toString()] = { nama: m.nama_mapel, urutan: m.urutan || 999 };
            });
          }
          
          const formattedNilai = nilaiRes.map((n: any) => ({
            ...n,
            nama_mapel: mapelDict[n.id_mapel]?.nama || `Mapel ID: ${n.id_mapel}`,
            urutan_mapel: mapelDict[n.id_mapel]?.urutan || 999
          }));
          
          setNilaiData(formattedNilai);
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const sortedNilai = [...nilaiData].sort((a, b) => {
    if (sortOrder === 'pelajaran') {
      return (a.urutan_mapel || 999) - (b.urutan_mapel || 999);
    }
    if (sortOrder === 'jenis') {
      const orderMap: Record<string, number> = { 'Tugas': 1, 'PTS': 2, 'PAS': 3 };
      const valA = orderMap[a.jenis_nilai] || 99;
      const valB = orderMap[b.jenis_nilai] || 99;
      return valA - valB;
    }
    if (sortOrder === 'tertinggi') return (Number(b.nilai_siswa) || 0) - (Number(a.nilai_siswa) || 0);
    if (sortOrder === 'terendah') return (Number(a.nilai_siswa) || 0) - (Number(b.nilai_siswa) || 0);
    return 0;
  });

  const filterOptions = [
    { id: 'pelajaran', label: 'Pelajaran' },
    { id: 'jenis', label: 'Jenis Penilaian' },
    { id: 'tertinggi', label: 'Tertinggi' },
    { id: 'terendah', label: 'Terendah' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Nilai Akademik</Text>
          <Text style={styles.headerSubtitle}>Pantau pencapaian belajar Anda</Text>
        </View>
      </View>

      {/* Filter Row */}
      {!loading && nilaiData.length > 0 && (
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {filterOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.filterChip, sortOrder === opt.id && styles.filterChipActive]}
                onPress={() => setSortOrder(opt.id)}
              >
                <Text style={[styles.filterChipText, sortOrder === opt.id && styles.filterChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#2a2c87" />
          </View>
        ) : nilaiData.length === 0 ? (
          <Animatable.View animation="fadeIn" style={styles.emptyBox}>
            <LinearGradient
              colors={['#daffcc', '#e5e7eb']}
              style={styles.emptyIconBg}
            >
              <FileText size={48} color="#9ca3af" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Belum Ada Nilai</Text>
            <Text style={styles.emptyText}>Data nilai rapor atau ujian Anda belum dimasukkan oleh guru ke dalam sistem.</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => { setLoading(true); fetchNilai(); }}>
              <Text style={styles.refreshBtnText}>Segarkan Data</Text>
            </TouchableOpacity>
          </Animatable.View>
        ) : (
          sortedNilai.map((item, idx) => (
            <Animatable.View 
              key={`nilai-${item.id || idx}`} 
              animation="fadeInUp" 
              delay={idx * 50}
              duration={400}
            >
              <View style={styles.card}>
                <View style={styles.cardIcon}>
                  <BookOpen size={20} color="#2a2c87" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.mapelText}>{item.nama_mapel}</Text>
                  <Text style={styles.jenisText}>{item.jenis_nilai || 'Ulangan Harian'}</Text>
                </View>
                <View style={styles.nilaiBadge}>
                  <Text style={styles.nilaiText}>{item.nilai_siswa || '0'}</Text>
                </View>
              </View>
            </Animatable.View>
          ))
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
    paddingTop: 8,
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#daffcc',
  },
  filterScroll: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#daffcc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2a2c87',
    borderColor: '#2a2c87',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  centerBox: {
    marginTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 20,
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
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  refreshBtn: {
    backgroundColor: '#daffcc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  refreshBtnText: {
    color: '#85c226',
    fontWeight: 'bold',
    fontSize: 14,
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
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  mapelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  jenisText: {
    fontSize: 13,
    color: '#6b7280',
  },
  nilaiBadge: {
    backgroundColor: '#2a2c87',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  nilaiText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
