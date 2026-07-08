import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { Trophy, ChevronLeft, Medal, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { router } from 'expo-router';

export default function PrestasiScreen() {
  const [loading, setLoading] = useState(true);
  const [prestasiData, setPrestasiData] = useState<any[]>([]);
  const [ekskulData, setEkskulData] = useState<any[]>([]);

  useEffect(() => {
    fetchPrestasi();
  }, []);

  const fetchPrestasi = async () => {
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
      const userId = user.id;

      if (nipd) {
        const { data: pres } = await supabase
          .from('prestasi_siswa')
          .select('*')
          .eq('nipd', nipd)
          .order('created_at', { ascending: false });
          
        if (pres) setPrestasiData(pres);
      }

      if (userId) {
        const { data: eks } = await supabase
          .from('anggota_ekskul')
          .select('*, data_ekskul(nama_ekskul)')
          .eq('siswa_id', userId);
          
        if (eks) setEkskulData(eks);
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Prestasi & Ekskul</Text>
          <Text style={styles.headerSubtitle}>Catatan pengembangan diri</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#f59e0b" />
          </View>
        ) : (
          <Animatable.View animation="fadeInUp" duration={600}>
            
            {/* Prestasi Section */}
            <View style={styles.sectionHeader}>
              <Trophy size={20} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Penghargaan & Prestasi</Text>
            </View>

            {prestasiData.length === 0 ? (
              <View style={styles.emptyBox}>
                <Medal size={48} color="#d1d5db" />
                <Text style={styles.emptyTitle}>Belum Ada Prestasi</Text>
                <Text style={styles.emptyText}>Terus bersemangat dan raih prestasi terbaikmu!</Text>
              </View>
            ) : (
              prestasiData.map((item, idx) => (
                <View key={`pres-${item.id || idx}`} style={styles.card}>
                  <View style={[styles.cardIcon, { backgroundColor: '#fef3c7' }]}>
                    <Trophy size={24} color="#f59e0b" />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.nama_prestasi}</Text>
                    <Text style={styles.cardSubtitle}>Peringkat: {item.peringkat || '-'}</Text>
                    <Text style={styles.cardDesc}>{item.tingkat} - {item.tahun}</Text>
                  </View>
                </View>
              ))
            )}

            <View style={{ height: 24 }} />

            {/* Ekskul Section */}
            <View style={styles.sectionHeader}>
              <Star size={20} color="#3b82f6" />
              <Text style={styles.sectionTitle}>Ekstrakurikuler</Text>
            </View>

            {ekskulData.length === 0 ? (
              <View style={styles.emptyBox}>
                <Star size={48} color="#d1d5db" />
                <Text style={styles.emptyTitle}>Belum Mengikuti Ekskul</Text>
                <Text style={styles.emptyText}>Anda belum terdaftar dalam kegiatan ekstrakurikuler manapun.</Text>
              </View>
            ) : (
              ekskulData.map((item, idx) => (
                <View key={`eks-${item.id || idx}`} style={styles.card}>
                  <View style={[styles.cardIcon, { backgroundColor: '#eff6ff' }]}>
                    <Star size={24} color="#3b82f6" />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.data_ekskul?.nama_ekskul || 'Ekstrakurikuler'}</Text>
                    <Text style={styles.cardDesc}>{item.deskripsi || 'Anggota Aktif'}</Text>
                  </View>
                  {item.predikat && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.predikat}</Text>
                    </View>
                  )}
                </View>
              ))
            )}

          </Animatable.View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 48, paddingHorizontal: 20, paddingBottom: 20,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backBtn: { padding: 8, marginRight: 12, marginLeft: -8, backgroundColor: '#f3f4f6', borderRadius: 12 },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  contentContainer: { padding: 20 },
  centerBox: { marginTop: 100, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937' },
  emptyBox: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 24, elevation: 1 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginTop: 12, marginBottom: 4 },
  emptyText: { color: '#6b7280', textAlign: 'center', fontSize: 13 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#4b5563', marginBottom: 2 },
  cardDesc: { fontSize: 13, color: '#6b7280' },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { color: '#2563eb', fontWeight: 'bold', fontSize: 12 },
});
