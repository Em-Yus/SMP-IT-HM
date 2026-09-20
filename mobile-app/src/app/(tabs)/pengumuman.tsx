import React, { useState, useEffect } from 'react';
import {   View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity , DeviceEventEmitter , ToastAndroid, Platform } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { Bell, ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Animatable from 'react-native-animatable';

export default function PengumumanScreen() {
  const [loading, setLoading] = useState(true);
  const [pengumumanData, setPengumumanData] = useState<any[]>([]);

  useEffect(() => {
    fetchPengumuman();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + 'src\app\(tabs)\pengumuman.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
    fetchPengumuman();
  
    });

    return () => listener.remove();
  }, []);

  const fetchPengumuman = async () => {
    try {
      const { data, error } = await supabase
        .from('cms_pengumuman')
        .select('*')
        .eq('status', 'Aktif')
        .in('target', ['Siswa', 'Semua'])
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setPengumumanData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: any) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Pengumuman</Text>
          <Text style={styles.headerSubtitle}>Informasi dan berita terbaru sekolah</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#f59e0b" />
          </View>
        ) : pengumumanData.length === 0 ? (
          <View style={styles.emptyBox}>
            <Bell size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Belum Ada Pengumuman</Text>
            <Text style={styles.emptyText}>Tidak ada informasi terbaru dari sekolah saat ini.</Text>
          </View>
        ) : (
          pengumumanData.map((item, index) => (
            <Animatable.View 
              key={item.id} 
              animation="fadeInUp" 
              delay={index * 100}
              duration={400} 
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.judul}</Text>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Text style={styles.cardContent}>{item.isi}</Text>
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
  },
  centerBox: {
    marginTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 24,
  },
  dateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  divider: {
    height: 1,
    backgroundColor: '#daffcc',
    marginBottom: 12,
  },
  cardContent: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
  },
});
