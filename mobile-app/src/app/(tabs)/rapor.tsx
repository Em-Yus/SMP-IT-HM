import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { FileText, ChevronLeft, Award } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { router } from 'expo-router';

export default function RaporScreen() {
  const [loading, setLoading] = useState(true);
  const [raporData, setRaporData] = useState<any[]>([]);
  const [rataRata, setRataRata] = useState(0);

  useEffect(() => {
    fetchRapor();
  }, []);

  const fetchRapor = async () => {
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
        const { data: nilaiRes } = await supabase
          .from('nilai_siswa')
          .select('*')
          .eq('nipd', nipd);
          
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
          
          // Kelompokkan nilai berdasarkan mapel
          const mapelGroups: Record<string, any> = {};
          let totalScore = 0;
          let countScore = 0;

          nilaiRes.forEach((n: any) => {
            const idMapel = n.id_mapel;
            if (!mapelGroups[idMapel]) {
              mapelGroups[idMapel] = {
                id_mapel: idMapel,
                nama_mapel: mapelDict[idMapel]?.nama || `Mapel ID: ${idMapel}`,
                urutan: mapelDict[idMapel]?.urutan || 999,
                total: 0,
                count: 0
              };
            }
            const val = Number(n.nilai_siswa) || 0;
            mapelGroups[idMapel].total += val;
            mapelGroups[idMapel].count += 1;
            
            totalScore += val;
            countScore += 1;
          });

          const summary = Object.values(mapelGroups).map((g: any) => ({
            ...g,
            rataRata: Math.round(g.total / g.count)
          }));
          
          summary.sort((a, b) => a.urutan - b.urutan);
          
          setRaporData(summary);
          if (countScore > 0) {
            setRataRata(Math.round(totalScore / countScore));
          }
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Rapor Akademik</Text>
          <Text style={styles.headerSubtitle}>Ringkasan nilai rata-rata tiap pelajaran</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <Animatable.View animation="fadeInUp" duration={600}>
            {/* Hero Card */}
            <LinearGradient colors={['#6366f1', '#4338ca']} style={styles.heroCard} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
              <Award size={80} color="rgba(255,255,255,0.2)" style={styles.heroIconBg} />
              <Text style={styles.heroSubtitle}>Nilai Rata-rata Keseluruhan</Text>
              <Text style={styles.heroTitle}>{rataRata}</Text>
            </LinearGradient>

            <Text style={styles.sectionTitle}>Rapor per Pelajaran</Text>

            {raporData.length === 0 ? (
              <View style={styles.emptyBox}>
                <FileText size={48} color="#9ca3af" />
                <Text style={styles.emptyTitle}>Belum Ada Rapor</Text>
                <Text style={styles.emptyText}>Belum ada nilai yang bisa dirangkum menjadi rapor.</Text>
              </View>
            ) : (
              raporData.map((item, idx) => (
                <Animatable.View 
                  key={`rapor-${item.id_mapel}`} 
                  animation="fadeInUp" 
                  delay={idx * 50}
                  duration={400}
                >
                  <View style={styles.card}>
                    <View style={styles.cardContent}>
                      <Text style={styles.mapelText}>{item.nama_mapel}</Text>
                      <Text style={styles.jenisText}>{item.count} Penilaian</Text>
                    </View>
                    <View style={styles.nilaiBadge}>
                      <Text style={styles.nilaiText}>{item.rataRata}</Text>
                    </View>
                  </View>
                </Animatable.View>
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
  heroCard: {
    padding: 24, borderRadius: 24, overflow: 'hidden', position: 'relative', marginBottom: 24,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 10,
  },
  heroIconBg: { position: 'absolute', right: -10, bottom: -10, transform: [{ scale: 1.2 }] },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  heroTitle: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12, paddingLeft: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  cardContent: { flex: 1 },
  mapelText: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 },
  jenisText: { fontSize: 13, color: '#6b7280' },
  nilaiBadge: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  nilaiText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  emptyBox: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 24, marginTop: 10 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginTop: 16, marginBottom: 8 },
  emptyText: { color: '#6b7280', textAlign: 'center' },
});
