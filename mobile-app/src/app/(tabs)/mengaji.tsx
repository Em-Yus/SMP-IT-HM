import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { Book, ChevronLeft, MapPin, User, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { router } from 'expo-router';

export default function MengajiScreen() {
  const [loading, setLoading] = useState(true);
  const [kelasData, setKelasData] = useState<any>(null);
  const [namaKelas, setNamaKelas] = useState<string>('');

  useEffect(() => {
    fetchMengajiData();
  }, []);

  const fetchMengajiData = async () => {
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

      const userKelasMengaji = user.kelas_mengaji;
      setNamaKelas(userKelasMengaji || 'Belum Ditentukan');

      if (userKelasMengaji) {
        const { data } = await supabase
          .from('data_kelas_mengaji')
          .select('*, data_ruang(nama_ruang)')
          .eq('nama_kelas', userKelasMengaji)
          .maybeSingle();
          
        if (data) setKelasData(data);
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
          <Text style={styles.headerTitle}>Kelas Mengaji</Text>
          <Text style={styles.headerSubtitle}>Informasi penempatan mengaji</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : (
          <Animatable.View animation="fadeInUp" duration={600}>
            {/* Hero Card */}
            <LinearGradient colors={['#10b981', '#047857']} style={styles.heroCard} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
              <Book size={80} color="rgba(255,255,255,0.2)" style={styles.heroIconBg} />
              <Text style={styles.heroSubtitle}>Kelas Anda Saat Ini</Text>
              <Text style={styles.heroTitle}>{namaKelas}</Text>
              
              <View style={styles.badgeContainer}>
                <View style={styles.badge}>
                  <Star size={14} color="#f59e0b" />
                  <Text style={styles.badgeText}>Tingkat {kelasData?.tingkat || '-'}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Info Details */}
            <Text style={styles.sectionTitle}>Detail Kelas</Text>
            
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={[styles.iconBox, { backgroundColor: '#eef2ff' }]}>
                  <User size={24} color="#4f46e5" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Pengajar (Ust/Ustz)</Text>
                  <Text style={styles.infoValue}>{kelasData?.guru_pengajar || 'Belum Ditentukan'}</Text>
                </View>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.infoRow}>
                <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
                  <MapPin size={24} color="#10b981" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Ruangan</Text>
                  <Text style={styles.infoValue}>{kelasData?.data_ruang?.nama_ruang || 'TBD'}</Text>
                </View>
              </View>
            </View>

          </Animatable.View>
        )}
        <View style={{ height: 40 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
    marginLeft: -8,
    backgroundColor: '#f3f4f6',
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
  heroCard: {
    padding: 24,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  heroIconBg: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    transform: [{ scale: 1.2 }],
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
    paddingLeft: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 16,
  },
});
