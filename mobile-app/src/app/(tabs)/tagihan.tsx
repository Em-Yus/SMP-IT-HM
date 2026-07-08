import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { Wallet, CheckCircle, ReceiptText, AlertCircle, TrendingUp, History } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TagihanScreen() {
  const [activeTab, setActiveTab] = useState<'tagihan' | 'riwayat'>('tagihan');
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [rincianBiaya, setRincianBiaya] = useState<any[]>([]);
  const [riwayatBayar, setRiwayatBayar] = useState<any[]>([]);
  
  // Nominal State
  const [totalTagihan, setTotalTagihan] = useState(0);
  const [totalTerbayar, setTotalTerbayar] = useState(0);
  const [sisaTagihan, setSisaTagihan] = useState(0);

  useEffect(() => {
    fetchKeuangan();
  }, []);

  const fetchKeuangan = async () => {
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

      if (!user || !user.id) {
        setLoading(false);
        return;
      }

      // 1. Tentukan Tingkat Siswa
      let tingkatSiswa = 7;
      if (user.kelas) {
        const kls = user.kelas.toString().toLowerCase();
        if (kls.includes('7') || kls.includes('vii')) tingkatSiswa = 7;
        else if (kls.includes('8') || kls.includes('viii')) tingkatSiswa = 8;
        else if (kls.includes('9') || kls.includes('ix')) tingkatSiswa = 9;
      }

      // 2. Tentukan Tipe Siswa
      let tipeSiswa = 'Siswa Baru';
      if (user.status_siswa) {
        const statusLower = user.status_siswa.toLowerCase();
        if (statusLower === 'baru') {
          tipeSiswa = 'Siswa Baru';
        } else if (statusLower === 'pindahan') {
          if (tingkatSiswa === 8) tipeSiswa = 'Pindahan Kelas 8';
          else if (tingkatSiswa === 9) tipeSiswa = 'Pindahan Kelas 9';
          else tipeSiswa = 'Siswa Baru'; 
        } else {
          tipeSiswa = user.status_siswa;
        }
      }

      // 3. Fetch Tahun/Semester dari Saldo Terakhir atau Default
      const { data: saldoData } = await supabase
        .from('tb_saldo_siswa')
        .select('*')
        .eq('siswa_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const tahunPelajaran = saldoData?.tahun_pelajaran || '2025/2026';
      const semester = saldoData?.semester || 'Tahunan';
      const saldoAwal = Number(saldoData?.saldo_sebelumnya) || 0;
      const subsidi = Number(saldoData?.subsidi_pip) || 0;

      // 4. Fetch Biaya Pengembangan Mutu
      const { data: configData } = await supabase
        .from('biaya_pengembangan_mutu')
        .select('data_anggaran')
        .eq('tahun_pelajaran', tahunPelajaran)
        .eq('semester', semester)
        .eq('tipe_siswa', tipeSiswa)
        .maybeSingle();

      let extractedItems: any[] = [];
      let calculatedTagihan = 0;
      
      if (configData && configData.data_anggaran) {
        configData.data_anggaran.forEach((item: any) => {
          const cost = item[`tingkat${tingkatSiswa}`] || item[`kelas${tingkatSiswa}`] || 0;
          if (cost > 0) {
            extractedItems.push({
              id: item.id,
              uraian: item.uraian,
              biaya: cost
            });
            calculatedTagihan += cost;
          }
        });
      }
      setRincianBiaya(extractedItems);
      setTotalTagihan(calculatedTagihan);

      // 5. Fetch Riwayat Pembayaran
      const { data: pemasukan } = await supabase
        .from('tb_pemasukan_siswa')
        .select('*')
        .eq('siswa_id', user.id)
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });

      const pemasukanList = pemasukan || [];
      setRiwayatBayar(pemasukanList);
      
      const totalPemasukan = pemasukanList.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
      
      // 6. Kalkulasi Final
      const totalBayarFinal = totalPemasukan + saldoAwal + subsidi;
      const sisa = calculatedTagihan - totalBayarFinal;
      
      setTotalTerbayar(totalBayarFinal);
      setSisaTagihan(sisa > 0 ? sisa : 0);
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const formatRupiah = (number: any) => {
    return `Rp ${Number(number || 0).toLocaleString('id-ID')}`;
  };

  const formatDate = (dateString: any) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  const isLunas = sisaTagihan <= 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Keuangan Anda</Text>
        <Text style={styles.headerSubtitle}>Sisa tagihan dan riwayat transaksi</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Hero Card - Sisa Tagihan */}
        <Animatable.View animation="bounceInDown" duration={800} delay={100}>
          <LinearGradient
            colors={isLunas ? ['#10b981', '#059669'] : ['#ef4444', '#b91c1c']} // Green if lunas, Red if not
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Wallet size={120} color="#fff" style={styles.heroIconBg} />
            <Text style={styles.heroTitle}>{isLunas ? 'LUNAS' : 'Sisa Tagihan'}</Text>
            <Text style={styles.heroValue}>{formatRupiah(sisaTagihan)}</Text>
            
            <View style={styles.heroFooter}>
              <View style={styles.heroFooterItem}>
                <Text style={styles.footerLabel}>Total Tagihan</Text>
                <Text style={styles.footerAmount}>{formatRupiah(totalTagihan)}</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroFooterItem}>
                <Text style={styles.footerLabel}>Telah Dibayar</Text>
                <Text style={styles.footerAmount}>{formatRupiah(totalTerbayar)}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animatable.View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'tagihan' && styles.tabActive]}
            onPress={() => setActiveTab('tagihan')}
          >
            <ReceiptText size={18} color={activeTab === 'tagihan' ? '#ef4444' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'tagihan' && styles.tabTextActive]}>Rincian Tagihan</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'riwayat' && styles.tabActive]}
            onPress={() => setActiveTab('riwayat')}
          >
            <History size={18} color={activeTab === 'riwayat' ? '#ef4444' : '#6b7280'} />
            <Text style={[styles.tabText, activeTab === 'riwayat' && styles.tabTextActive]}>Riwayat Setoran</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content: Rincian Tagihan */}
        {activeTab === 'tagihan' && (
          <View>
            {rincianBiaya.length === 0 ? (
              <Animatable.View animation="fadeIn" style={styles.emptyBox}>
                <ReceiptText size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>Tidak ada rincian biaya.</Text>
              </Animatable.View>
            ) : (
              rincianBiaya.map((item, idx) => (
                <Animatable.View 
                  key={`tagihan-${idx}`} 
                  animation="fadeInUp" 
                  delay={100 + (idx * 50)}
                  duration={400}
                >
                  <View style={styles.rincianCard}>
                    <View style={styles.iconContainerBlue}>
                      <TrendingUp size={20} color="#3b82f6" />
                    </View>
                    <View style={styles.rincianInfo}>
                      <Text style={styles.rincianUraian}>{item.uraian}</Text>
                      <Text style={styles.rincianAmount}>{formatRupiah(item.biaya)}</Text>
                    </View>
                  </View>
                </Animatable.View>
              ))
            )}
          </View>
        )}

        {/* Tab Content: Riwayat Pemasukan */}
        {activeTab === 'riwayat' && (
          <View>
            {riwayatBayar.length === 0 ? (
              <Animatable.View animation="fadeIn" style={styles.emptyBox}>
                <AlertCircle size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>Belum ada riwayat setoran.</Text>
              </Animatable.View>
            ) : (
              riwayatBayar.map((item, idx) => (
                <Animatable.View 
                  key={`riwayat-${idx}`} 
                  animation="fadeInUp" 
                  delay={100 + (idx * 50)}
                  duration={400}
                >
                  <View style={styles.rincianCard}>
                    <View style={styles.iconContainerGreen}>
                      <CheckCircle size={20} color="#10b981" />
                    </View>
                    <View style={styles.rincianInfo}>
                      <Text style={styles.rincianAmount}>{formatRupiah(item.nominal)}</Text>
                      <Text style={styles.rincianDate}>{formatDate(item.tanggal)}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusLunas}>LUNAS</Text>
                    </View>
                  </View>
                </Animatable.View>
              ))
            )}
          </View>
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
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  contentContainer: {
    padding: 20,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
    elevation: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    marginBottom: 24,
  },
  heroIconBg: {
    position: 'absolute',
    right: -20,
    bottom: -30,
    opacity: 0.1,
    transform: [{ rotate: '-15deg' }]
  },
  heroTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  heroValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    borderRadius: 16,
  },
  heroFooterItem: {
    flex: 1,
  },
  heroDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },
  footerLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginBottom: 4,
  },
  footerAmount: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    padding: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#ef4444',
  },
  emptyBox: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  rincianCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  iconContainerBlue: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff', // blue-50
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconContainerGreen: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5', // emerald-50
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rincianInfo: {
    flex: 1,
  },
  rincianUraian: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  rincianAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  rincianDate: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  statusLunas: {
    fontSize: 11,
    fontWeight: '900',
    color: '#10b981',
  }
});
