import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, ActivityIndicator, 
  TouchableOpacity, DeviceEventEmitter, ToastAndroid, Platform, Modal 
} from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import { 
  UserCheck, UserX, UserMinus, ChevronLeft, ChevronRight, 
  CalendarCheck, Calendar, Filter, Clock, Award, ShieldAlert,
  AlertCircle, RefreshCw, Check
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PresensiScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 44);

  const [loading, setLoading] = useState(true);
  const [presensiData, setPresensiData] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);

  // Filter Mode: 'harian' | 'mingguan' | 'bulanan' | 'semester'
  const nowMonth = new Date().getMonth() + 1;
  const nowYear = new Date().getFullYear();
  const [filterMode, setFilterMode] = useState<'harian' | 'mingguan' | 'bulanan' | 'semester'>('bulanan');
  const [filterTanggal, setFilterTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [filterWeekOffset, setFilterWeekOffset] = useState(0); // 0 = current week
  const [filterBulan, setFilterBulan] = useState(nowMonth);
  const [filterTahun, setFilterTahun] = useState(nowYear);
  const [filterSemester, setFilterSemester] = useState<'ganjil' | 'genap'>(nowMonth >= 7 ? 'ganjil' : 'genap');
  const [filterTahunSemester, setFilterTahunSemester] = useState(nowYear);

  // Filter Status: 'semua' | 'Hadir' | 'Dispensasi' | 'Izin' | 'Sakit' | 'Terlambat' | 'Bolos' | 'Alfa'
  const [filterStatus, setFilterStatus] = useState('semua');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showSemesterModal, setShowSemesterModal] = useState(false);

  // Statistik Kehadiran
  const [stats, setStats] = useState({
    hadir: 0,
    dispensasi: 0,
    izin: 0,
    sakit: 0,
    terlambat: 0,
    bolos: 0,
    alfa: 0
  });

  const months = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
    { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
  ];

  const statusOptions = [
    { value: 'semua', label: 'Semua Status' },
    { value: 'Hadir', label: 'Hadir' },
    { value: 'Dispensasi', label: 'Dispensasi' },
    { value: 'Izin', label: 'Izin' },
    { value: 'Sakit', label: 'Sakit' },
    { value: 'Terlambat', label: 'Terlambat' },
    { value: 'Bolos', label: 'Bolos' },
    { value: 'Alfa', label: 'Alfa' }
  ];

  useEffect(() => {
    loadUserAndFetch();
  
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in (tabs)/presensi.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      loadUserAndFetch();
    });

    return () => listener.remove();
  }, [filterMode, filterTanggal, filterWeekOffset, filterBulan, filterTahun, filterSemester, filterTahunSemester]);

  // Hitung rentang tanggal
  const dateRange = useMemo(() => {
    if (filterMode === 'harian') {
      const d = new Date(filterTanggal);
      const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      return { startDate: filterTanggal, endDate: filterTanggal, label };
    } else if (filterMode === 'mingguan') {
      const now = new Date();
      now.setDate(now.getDate() + filterWeekOffset * 7);
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const startDate = monday.toISOString().split('T')[0];
      const endDate = sunday.toISOString().split('T')[0];
      const label = `${monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
      return { startDate, endDate, label };
    } else if (filterMode === 'semester') {
      let startDate, endDate, label;
      if (filterSemester === 'ganjil') {
        startDate = `${filterTahunSemester}-07-01`;
        endDate = `${filterTahunSemester}-12-31`;
        label = `Sem. Ganjil ${filterTahunSemester}/${filterTahunSemester + 1}`;
      } else {
        startDate = `${filterTahunSemester}-01-01`;
        endDate = `${filterTahunSemester}-06-30`;
        label = `Sem. Genap ${filterTahunSemester - 1}/${filterTahunSemester}`;
      }
      return { startDate, endDate, label };
    } else {
      const startDate = `${filterTahun}-${String(filterBulan).padStart(2, '0')}-01`;
      const lastDay = new Date(filterTahun, filterBulan, 0).getDate();
      const endDate = `${filterTahun}-${String(filterBulan).padStart(2, '0')}-${lastDay}`;
      const monthName = months.find(m => m.value === filterBulan)?.label || '';
      const label = `${monthName} ${filterTahun}`;
      return { startDate, endDate, label };
    }
  }, [filterMode, filterTanggal, filterWeekOffset, filterBulan, filterTahun, filterSemester, filterTahunSemester]);

  const loadUserAndFetch = async () => {
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
        setUserData(user);
        fetchPresensi(user.nipd || user.nisn || user.nis);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchPresensi = async (nipd: string) => {
    if (!nipd) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('presensi_siswa')
        .select('*')
        .eq('nipd', nipd)
        .gte('tanggal', dateRange.startDate)
        .lte('tanggal', dateRange.endDate)
        .order('tanggal', { ascending: false });
        
      if (error) throw error;

      const list = data || [];
      setPresensiData(list);
      
      let h = 0, disp = 0, i = 0, s = 0, t = 0, b = 0, a = 0;
      list.forEach((p: any) => {
        const status = (p.status || '').toLowerCase();
        if (status.includes('dispensasi')) disp++;
        else if (status.includes('hadir') && !status.includes('terlambat')) h++;
        else if (status.includes('izin')) i++;
        else if (status.includes('sakit')) s++;
        else if (status.includes('terlambat')) t++;
        else if (status.includes('bolos')) b++;
        else a++;
      });
      
      setStats({
        hadir: h,
        dispensasi: disp,
        izin: i,
        sakit: s,
        terlambat: t,
        bolos: b,
        alfa: a
      });
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // Navigasi tanggal harian
  const changeDateHarian = (offsetDays: number) => {
    const cur = new Date(filterTanggal);
    cur.setDate(cur.getDate() + offsetDays);
    setFilterTanggal(cur.toISOString().split('T')[0]);
  };

  // Filter data sesuai status dropdown
  const filteredPresensi = useMemo(() => {
    if (filterStatus === 'semua') return presensiData;
    return presensiData.filter((item: any) => {
      const st = (item.status || '').toLowerCase();
      if (filterStatus === 'Hadir') return st.includes('hadir') && !st.includes('terlambat');
      if (filterStatus === 'Dispensasi') return st.includes('dispensasi');
      if (filterStatus === 'Izin') return st.includes('izin');
      if (filterStatus === 'Sakit') return st.includes('sakit');
      if (filterStatus === 'Terlambat') return st.includes('terlambat');
      if (filterStatus === 'Bolos') return st.includes('bolos');
      if (filterStatus === 'Alfa') return st.includes('alfa') || st.includes('alpha') || st.includes('tanpa keterangan');
      return true;
    });
  }, [presensiData, filterStatus]);

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('dispensasi')) return '#0ea5e9'; // cyan / sky blue
    if (s.includes('hadir') && !s.includes('terlambat')) return '#10b981'; // green
    if (s.includes('izin')) return '#8b5cf6'; // purple
    if (s.includes('sakit')) return '#f59e0b'; // amber
    if (s.includes('terlambat')) return '#f97316'; // orange
    if (s.includes('bolos')) return '#6366f1'; // indigo
    return '#ef4444'; // red
  };
  
  const getStatusIcon = (status: string, color: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('dispensasi')) return <Award size={20} color={color} />;
    if (s.includes('hadir') && !s.includes('terlambat')) return <UserCheck size={20} color={color} />;
    if (s.includes('izin') || s.includes('sakit')) return <UserMinus size={20} color={color} />;
    if (s.includes('terlambat')) return <Clock size={20} color={color} />;
    if (s.includes('bolos')) return <ShieldAlert size={20} color={color} />;
    return <UserX size={20} color={color} />;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      {/* HEADER AMAN DARI STATUS BAR */}
      <LinearGradient
        colors={['#1E257F', '#2a349c']}
        style={[styles.header, { paddingTop: topPadding + 8 }]}
      >
        <Animatable.View animation="fadeInDown" duration={600}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Presensi Siswa</Text>
              <Text style={styles.headerSubtitle}>
                Periode: <Text style={{ color: '#84D43F', fontWeight: 'bold' }}>{dateRange.label}</Text>
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.refreshBtn} 
              onPress={() => loadUserAndFetch()}
              disabled={loading}
              activeOpacity={0.7}
            >
              <RefreshCw size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* BAGIAN BAWAH HEADER: FILTER [HARIAN, MINGGUAN, BULANAN] & STATUS DROPDOWN */}
          <View style={styles.filterSection}>
            {/* Pill Tab [Harian, Mingguan, Bulanan] */}
            <View style={styles.pillContainer}>
              <TouchableOpacity
                style={[styles.pillBtn, filterMode === 'harian' && styles.pillBtnActive]}
                onPress={() => setFilterMode('harian')}
              >
                <Text style={[styles.pillText, filterMode === 'harian' && styles.pillTextActive]}>Harian</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, filterMode === 'mingguan' && styles.pillBtnActive]}
                onPress={() => setFilterMode('mingguan')}
              >
                <Text style={[styles.pillText, filterMode === 'mingguan' && styles.pillTextActive]}>Mingguan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, filterMode === 'bulanan' && styles.pillBtnActive]}
                onPress={() => setFilterMode('bulanan')}
              >
                <Text style={[styles.pillText, filterMode === 'bulanan' && styles.pillTextActive]}>Bulanan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, filterMode === 'semester' && styles.pillBtnActive]}
                onPress={() => setFilterMode('semester')}
              >
                <Text style={[styles.pillText, filterMode === 'semester' && styles.pillTextActive]}>Semester</Text>
              </TouchableOpacity>
            </View>

            {/* Baris Kontrol Sub-Filter & Dropdown Status */}
            <View style={styles.filterSubRow}>
              {/* Kontrol Navigasi Periode */}
              {filterMode === 'harian' && (
                <View style={styles.periodNavigator}>
                  <TouchableOpacity style={styles.navArrowBtn} onPress={() => changeDateHarian(-1)}>
                    <ChevronLeft size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.navLabel} numberOfLines={1}>{dateRange.label}</Text>
                  <TouchableOpacity style={styles.navArrowBtn} onPress={() => changeDateHarian(1)}>
                    <ChevronRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {filterMode === 'mingguan' && (
                <View style={styles.periodNavigator}>
                  <TouchableOpacity style={styles.navArrowBtn} onPress={() => setFilterWeekOffset(prev => prev - 1)}>
                    <ChevronLeft size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.navLabel} numberOfLines={1}>
                    {filterWeekOffset === 0 ? 'Minggu Ini' : `${Math.abs(filterWeekOffset)} Mgg Lalu`}
                  </Text>
                  <TouchableOpacity 
                    style={[styles.navArrowBtn, filterWeekOffset >= 0 && { opacity: 0.4 }]} 
                    onPress={() => setFilterWeekOffset(prev => prev + 1)}
                    disabled={filterWeekOffset >= 0}
                  >
                    <ChevronRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {filterMode === 'bulanan' && (
                <TouchableOpacity 
                  style={styles.monthSelectorBtn} 
                  onPress={() => setShowMonthModal(true)}
                  activeOpacity={0.8}
                >
                  <Calendar size={14} color="#FFFFFF" />
                  <Text style={styles.monthSelectorText} numberOfLines={1}>{dateRange.label}</Text>
                </TouchableOpacity>
              )}

              {filterMode === 'semester' && (
                <TouchableOpacity 
                  style={styles.monthSelectorBtn} 
                  onPress={() => setShowSemesterModal(true)}
                  activeOpacity={0.8}
                >
                  <Calendar size={14} color="#FFFFFF" />
                  <Text style={styles.monthSelectorText} numberOfLines={1}>{dateRange.label}</Text>
                </TouchableOpacity>
              )}

              {/* Dropdown Status */}
              <TouchableOpacity
                style={styles.statusDropdownBtn}
                onPress={() => setShowStatusModal(true)}
                activeOpacity={0.8}
              >
                <Filter size={13} color="#FFFFFF" />
                <Text style={styles.statusDropdownText} numberOfLines={1}>
                  {filterStatus === 'semua' ? 'Semua Status' : filterStatus}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animatable.View>
      </LinearGradient>

      {/* KONTEN UTAMA */}
      <ScrollView 
        contentContainerStyle={styles.contentContainer} 
        showsVerticalScrollIndicator={false}
      >
        {/* 1. INFORMASI PADA BAGIAN PALING ATAS HALAMAN (KARTU STATISTIK + INFORMASI DISPENSASI) */}
        <Animatable.View animation="fadeInDown" duration={600} style={styles.statsCardGrid}>
          {/* Hadir */}
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: '#ECFDF5' }]}>
              <UserCheck size={16} color="#10B981" />
            </View>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.hadir}</Text>
            <Text style={styles.statLabel}>Hadir</Text>
          </View>

          {/* Dispensasi (BARU DITAMBAHKAN) */}
          <View style={[styles.statBox, styles.statBoxDispensasi]}>
            <View style={[styles.statIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <Award size={16} color="#0284C7" />
            </View>
            <Text style={[styles.statValue, { color: '#0284C7' }]}>{stats.dispensasi}</Text>
            <Text style={[styles.statLabel, { color: '#0284C7', fontWeight: 'bold' }]}>Dispensasi</Text>
          </View>

          {/* Izin */}
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <UserMinus size={16} color="#8B5CF6" />
            </View>
            <Text style={[styles.statValue, { color: '#8B5CF6' }]}>{stats.izin}</Text>
            <Text style={styles.statLabel}>Izin</Text>
          </View>

          {/* Sakit */}
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <AlertCircle size={16} color="#F59E0B" />
            </View>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.sakit}</Text>
            <Text style={styles.statLabel}>Sakit</Text>
          </View>

          {/* Terlambat */}
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: '#FFEDD5' }]}>
              <Clock size={16} color="#F97316" />
            </View>
            <Text style={[styles.statValue, { color: '#F97316' }]}>{stats.terlambat}</Text>
            <Text style={styles.statLabel}>Terlambat</Text>
          </View>

          {/* Bolos */}
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <ShieldAlert size={16} color="#6366F1" />
            </View>
            <Text style={[styles.statValue, { color: '#6366F1' }]}>{stats.bolos}</Text>
            <Text style={styles.statLabel}>Bolos</Text>
          </View>

          {/* Alfa */}
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <UserX size={16} color="#EF4444" />
            </View>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.alfa}</Text>
            <Text style={styles.statLabel}>Alfa</Text>
          </View>
        </Animatable.View>

        {/* RIWAYAT DETAIL PRESENSI */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Riwayat Kehadiran</Text>
          <Text style={styles.sectionCountText}>
            {filteredPresensi.length} catatan
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#1E257F" />
            <Text style={{ marginTop: 10, color: '#6C757D', fontSize: 13 }}>Memuat data presensi...</Text>
          </View>
        ) : filteredPresensi.length === 0 ? (
          <Animatable.View animation="fadeIn" style={styles.emptyBox}>
            <View style={styles.emptyIconBg}>
              <CalendarCheck size={40} color="#1E257F" />
            </View>
            <Text style={styles.emptyTitle}>Tidak Ada Presensi</Text>
            <Text style={styles.emptyText}>
              {filterStatus !== 'semua'
                ? `Tidak ada data dengan status "${filterStatus}" pada periode ini.`
                : 'Belum ada catatan kehadiran pada periode yang dipilih.'}
            </Text>
          </Animatable.View>
        ) : (
          filteredPresensi.map((item: any, idx: number) => {
            const color = getStatusColor(item.status || '');
            const isDisp = (item.status || '').toLowerCase().includes('dispensasi');
            return (
              <Animatable.View 
                key={`presensi-${item.id || idx}`} 
                animation="fadeInUp" 
                delay={idx * 30}
                duration={350}
              >
                <View style={[styles.card, isDisp && styles.cardDispensasi]}>
                  <View style={[styles.cardIcon, { backgroundColor: color + '15' }]}>
                    {getStatusIcon(item.status || '', color)}
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.dateText}>{formatDate(item.tanggal)}</Text>
                    <Text style={styles.timeText}>
                      Masuk: {item.waktu_masuk || '-'} | Pulang: {item.waktu_pulang || '-'}
                    </Text>
                    {item.alasan && item.alasan !== '-' ? (
                      <Text style={styles.alasanText} numberOfLines={2}>
                        Ket: {item.alasan}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: color + '15', borderColor: color + '30' }]}>
                    <Text style={[styles.statusText, { color: color }]}>
                      {(item.status || 'TIDAK DIKETAHUI').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </Animatable.View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL DROPDOWN PILIHAN STATUS */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Filter Status</Text>
            <View style={styles.modalDivider} />
            {statusOptions.map(opt => {
              const isSelected = filterStatus === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.modalOption, isSelected && styles.modalOptionActive]}
                  onPress={() => {
                    setFilterStatus(opt.value);
                    setShowStatusModal(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {isSelected && <Check size={18} color="#1E257F" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL PILIHAN BULAN & TAHUN */}
      <Modal
        visible={showMonthModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMonthModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Bulan ({filterTahun})</Text>
            <View style={styles.modalDivider} />
            <ScrollView style={{ maxHeight: 320 }}>
              {months.map(m => {
                const isSelected = filterBulan === m.value;
                return (
                  <TouchableOpacity
                    key={m.value}
                    style={[styles.modalOption, isSelected && styles.modalOptionActive]}
                    onPress={() => {
                      setFilterBulan(m.value);
                      setShowMonthModal(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                      {m.label} {filterTahun}
                    </Text>
                    {isSelected && <Check size={18} color="#1E257F" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL PILIHAN SEMESTER & TAHUN */}
      <Modal
        visible={showSemesterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSemesterModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowSemesterModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Semester & Tahun</Text>
            <View style={styles.modalDivider} />
            <ScrollView style={{ maxHeight: 320 }}>
              {[
                { sem: 'ganjil', tahun: filterTahunSemester, label: `Sem. Ganjil ${filterTahunSemester}/${filterTahunSemester + 1} (Jul - Des)` },
                { sem: 'genap', tahun: filterTahunSemester, label: `Sem. Genap ${filterTahunSemester - 1}/${filterTahunSemester} (Jan - Jun)` },
                { sem: 'ganjil', tahun: filterTahunSemester - 1, label: `Sem. Ganjil ${filterTahunSemester - 1}/${filterTahunSemester} (Tahun Lalu)` },
                { sem: 'genap', tahun: filterTahunSemester - 1, label: `Sem. Genap ${filterTahunSemester - 2}/${filterTahunSemester - 1} (Tahun Lalu)` },
              ].map((opt, idx) => {
                const isSelected = filterSemester === opt.sem && filterTahunSemester === opt.tahun;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.modalOption, isSelected && styles.modalOptionActive]}
                    onPress={() => {
                      setFilterSemester(opt.sem as any);
                      setFilterTahunSemester(opt.tahun);
                      setShowSemesterModal(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                      {opt.label}
                    </Text>
                    {isSelected && <Check size={18} color="#1E257F" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#1E257F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#D0D6F9',
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    gap: 8,
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    padding: 3,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 9,
  },
  pillBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D0D6F9',
  },
  pillTextActive: {
    color: '#1E257F',
    fontWeight: 'bold',
  },
  filterSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  periodNavigator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  navArrowBtn: {
    padding: 4,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  monthSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  monthSelectorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusDropdownText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  contentContainer: {
    padding: 16,
  },
  statsCardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  statBoxDispensasi: {
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  statIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 10,
    color: '#6C757D',
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1818',
  },
  sectionCountText: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
  },
  centerBox: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 1,
    marginTop: 20,
  },
  emptyIconBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ECEEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1818',
    marginBottom: 6,
  },
  emptyText: {
    color: '#6C757D',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardDispensasi: {
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  dateText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1818',
    marginBottom: 3,
  },
  timeText: {
    fontSize: 11,
    color: '#6C757D',
  },
  alasanText: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1818',
    marginBottom: 10,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  modalOptionActive: {
    backgroundColor: '#ECEEFF',
  },
  modalOptionText: {
    fontSize: 14,
    color: '#1A1818',
  },
  modalOptionTextActive: {
    color: '#1E257F',
    fontWeight: 'bold',
  },
});
