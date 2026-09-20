import React, { useState, useEffect } from 'react';
import {   View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity , DeviceEventEmitter , ToastAndroid, Platform } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { Tent, Users, Clock, User, CalendarDays } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EkskulScreen() {
  const [loading, setLoading] = useState(true);
  const [myEkskul, setMyEkskul] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchMyEkskul();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\(tabs)\ekskul.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchMyEkskul();
  
    });

    return () => listener.remove();
  }, []);

  const fetchMyEkskul = async () => {
    try {
      const localUserStr = await AsyncStorage.getItem('user_siswa');
      const { data: { session } } = await supabase.auth.getSession();
      
      let user = null;
      if (localUserStr) {
        user = JSON.parse(localUserStr);
      } else if (session?.user?.email) {
        const { data } = await supabase.from('data_siswa').select('*').eq('email', session.user.email).maybeSingle();
        user = data;
      }

      if (!user || !user.id) {
        setLoading(false);
        return;
      }

      // 1. Cari ekskul_id yang diikuti user (lengkap dengan data master ekskul)
      const { data: anggotaSaya } = await supabase
        .from('anggota_ekskul')
        .select('*, data_ekskul(*)')
        .eq('siswa_id', user.id);

      if (!anggotaSaya || anggotaSaya.length === 0) {
        setMyEkskul([]);
        setLoading(false);
        return;
      }

      const ekskulIds = anggotaSaya.map((a: any) => a.ekskul_id);

      // 2. Fetch semua anggota di ekskul-ekskul tersebut beserta nama dan kelas dari data_siswa
      const { data: semuaAnggota } = await supabase
        .from('anggota_ekskul')
        .select('ekskul_id, data_siswa(nama, kelas)')
        .in('ekskul_id', ekskulIds);

      // 3. Susun data
      const formattedData = anggotaSaya.map((ekskulData: any) => {
        const ekskulMaster = ekskulData.data_ekskul || {};
        
        // cari teman-teman (anggota) dan urutkan
        const anggota = (semuaAnggota || [])
          .filter((a: any) => a.ekskul_id === ekskulData.ekskul_id)
          .map((a: any) => ({
             nama_siswa: a.data_siswa?.nama,
             kelas: a.data_siswa?.kelas
          }))
          .sort((a: any, b: any) => (a.kelas || '').localeCompare(b.kelas || '') || (a.nama_siswa || '').localeCompare(b.nama_siswa || ''));

        return {
          ...ekskulMaster, // so it maps nama_ekskul, hari_pelaksanaan, dll
          predikat: ekskulData.predikat,
          deskripsi: ekskulData.deskripsi,
          anggota: anggota
        };
      });

      setMyEkskul(formattedData);
      
    } catch (err) {
      console.error('Error fetching ekskul:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    if (expandedId === id) setExpandedId(null);
    else setExpandedId(id);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2a2c87" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ekstrakurikuler</Text>
        <Text style={styles.headerSubtitle}>Kegiatan yang Anda ikuti</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {myEkskul.length === 0 ? (
          <Animatable.View animation="fadeIn" style={styles.emptyBox}>
            <Tent size={48} color="#d1d5db" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Anda belum terdaftar di ekstrakurikuler manapun.</Text>
          </Animatable.View>
        ) : (
          myEkskul.map((ekskul, idx) => {
            const isExpanded = expandedId === ekskul.id;
            return (
              <Animatable.View 
                key={ekskul.id} 
                animation="fadeInUp" 
                delay={100 + (idx * 50)} 
                duration={500}
                style={styles.cardWrapper}
              >
                <TouchableOpacity 
                  style={[styles.cardHeader, isExpanded && styles.cardHeaderExpanded]} 
                  activeOpacity={0.8}
                  onPress={() => toggleExpand(ekskul.id)}
                >
                  <LinearGradient
                    colors={['#2a2c87', '#1a1a54']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cardGradient}
                  >
                    <View style={styles.iconBox}>
                      <Tent size={24} color="#85c226" />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.ekskulName}>{ekskul.nama_ekskul}</Text>
                      <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                          <Users size={12} color="#85c226" />
                          <Text style={styles.badgeText}>{ekskul.anggota?.length || 0} Anggota</Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.cardBody}>
                    <View style={styles.detailRow}>
                      <User size={16} color="#6b7280" />
                      <Text style={styles.detailText}><Text style={styles.bold}>Pembina:</Text> {ekskul.pembina_nama || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <CalendarDays size={16} color="#6b7280" />
                      <Text style={styles.detailText}><Text style={styles.bold}>Hari:</Text> {ekskul.hari_pelaksanaan || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.detailText}><Text style={styles.bold}>Jam:</Text> {ekskul.jam_pelaksanaan || '-'}</Text>
                    </View>

                    <View style={styles.divider} />
                    
                    <Text style={styles.anggotaTitle}>Daftar Anggota</Text>
                    {ekskul.anggota.map((ang: any, aIdx: number) => (
                      <View key={aIdx} style={styles.anggotaItem}>
                        <View style={styles.anggotaAvatar}>
                          <Text style={styles.avatarText}>{ang.nama_siswa?.charAt(0) || '?'}</Text>
                        </View>
                        <View style={styles.anggotaInfo}>
                          <Text style={styles.anggotaName}>{ang.nama_siswa}</Text>
                          <Text style={styles.anggotaClass}>{ang.kelas}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Animatable.View>
            );
          })
        )}
        <View style={{ height: 30 }} />
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#daffcc',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2a2c87',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#6b7280',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  cardWrapper: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    width: '100%',
  },
  cardHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
  },
  ekskulName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardBody: {
    padding: 16,
    backgroundColor: '#fff',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#4b5563',
  },
  bold: {
    fontWeight: 'bold',
    color: '#1f2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,
  },
  anggotaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2a2c87',
    marginBottom: 12,
  },
  anggotaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  anggotaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f6f4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#85c226',
  },
  anggotaInfo: {
    flex: 1,
  },
  anggotaName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  anggotaClass: {
    fontSize: 12,
    color: '#6b7280',
  },
});
