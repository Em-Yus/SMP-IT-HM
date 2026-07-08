import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { router } from 'expo-router';
import { User, LogOut, MapPin, Calendar, BookOpen, GraduationCap, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfilScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
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

      if (user) {
        // Fetch fresh data from DB using the ID
        const { data } = await supabase.from('data_siswa').select('*').eq('id', user.id).maybeSingle();
        setUserData(data || user);
      }
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem('user_siswa');
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const formatDate = (dateString: any) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const avatarUrl = userData?.foto_url || 'https://ui-avatars.com/api/?name=' + (userData?.nama || 'Siswa') + '&background=random';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Profile (Digital ID Card) */}
      <Animatable.View animation="fadeInDown" duration={800} style={styles.headerContainer}>
        <LinearGradient
          colors={['#4f46e5', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerBg}
        >
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            </View>
            <Text style={styles.nameText}>{userData?.nama || 'Siswa'}</Text>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{userData?.kelas || 'Kelas -'}</Text>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>NISN: {userData?.nisn || '-'}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animatable.View>

      <View style={styles.contentContainer}>
        <Animatable.View animation="fadeInUp" delay={200} duration={600}>
          <Text style={styles.sectionTitle}>Data Pribadi</Text>
          <View style={styles.card}>
            <InfoRow icon={<MapPin size={20} color="#6b7280" />} label="Tempat Lahir" value={userData?.tempat_lahir || '-'} />
            <View style={styles.divider} />
            <InfoRow icon={<Calendar size={20} color="#6b7280" />} label="Tanggal Lahir" value={formatDate(userData?.tanggal_lahir)} />
            <View style={styles.divider} />
            <InfoRow icon={<User size={20} color="#6b7280" />} label="Jenis Kelamin" value={userData?.jenis_kelamin === 'L' ? 'Laki-laki' : userData?.jenis_kelamin === 'P' ? 'Perempuan' : '-'} />
          </View>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" delay={300} duration={600}>
          <Text style={styles.sectionTitle}>Data Sekolah</Text>
          <View style={styles.card}>
            <InfoRow icon={<BookOpen size={20} color="#6b7280" />} label="Status Siswa" value={userData?.status_siswa || '-'} />
            <View style={styles.divider} />
            <InfoRow icon={<GraduationCap size={20} color="#6b7280" />} label="Sekolah Asal" value={userData?.sekolah_asal || '-'} />
          </View>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" delay={400} duration={600}>
          <Text style={styles.sectionTitle}>Data Orang Tua</Text>
          <View style={styles.card}>
            <InfoRow icon={<Users size={20} color="#6b7280" />} label="Nama Ayah" value={userData?.nama_ayah || '-'} />
            <View style={styles.divider} />
            <InfoRow icon={<Users size={20} color="#6b7280" />} label="Nama Ibu" value={userData?.nama_ibu || '-'} />
          </View>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" delay={500} duration={600}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Keluar dari Aplikasi</Text>
          </TouchableOpacity>
        </Animatable.View>
        
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

const InfoRow = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>{icon}</View>
    <View style={styles.infoTextContainer}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerContainer: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  headerBg: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    padding: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  badgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    marginHorizontal: 8,
  },
  contentContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4b5563',
    marginBottom: 12,
    marginTop: 8,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 4,
    marginLeft: 56, // Align with text
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  }
});
