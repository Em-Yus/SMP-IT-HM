import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../../services/supabaseClient';
import {
  CalendarDays,
  Award,
  BookOpen,
  Trophy,
  Tent,
  FileText,
  GraduationCap,
  ClipboardCheck,
  Wallet,
  Megaphone,
  UserCircle,
  Laptop,
  Search,
  ChevronRight,
  Sparkles,
  LayoutGrid,
  List,
} from 'lucide-react-native';
import * as Animatable from 'react-native-animatable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MenuItem {
  name: string;
  desc?: string;
  icon: any;
  route: string;
  color: string;
  bgColor: string;
  isCbt?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export default function SiswaMenuScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [activeCbtExam, setActiveCbtExam] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const loadData = async () => {
    try {
      const savedLayout = await AsyncStorage.getItem('@siswa_menu_layout');
      if (savedLayout === 'list' || savedLayout === 'grid') {
        setViewMode(savedLayout);
      }

      const userStr = await AsyncStorage.getItem('user_siswa');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setUserData(parsed);
        checkActiveExam(parsed);
      }
    } catch (e) {
      console.error('Error loadData menu siswa:', e);
    }
  };

  const handleToggleViewMode = async (mode: 'grid' | 'list') => {
    setViewMode(mode);
    await AsyncStorage.setItem('@siswa_menu_layout', mode);
  };

  const checkActiveExam = async (user: any) => {
    try {
      const isAktif = (user?.status_keaktifan || '').trim().toLowerCase() === 'aktif';
      if (!isAktif) {
        setActiveCbtExam(null);
        return;
      }

      let allocatedJadwalIds: number[] = [];
      if (user.id) {
        const { data: pRuangData } = await supabase
          .from('cbt_peserta_ruang')
          .select('jadwal_id')
          .eq('siswa_id', user.id);
        if (pRuangData && pRuangData.length > 0) {
          allocatedJadwalIds = pRuangData.map((p: any) => Number(p.jadwal_id)).filter(Boolean);
        }
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      let cbtQuery = supabase
        .from('cbt_jadwal_ujian')
        .select(`
          id, nama_ujian, jenis_ujian, tanggal_ujian, jam_mulai, jam_selesai, durasi_menit, status,
          data_mapel(nama_mapel)
        `);

      if (allocatedJadwalIds.length > 0) {
        cbtQuery = cbtQuery.or(`id.in.(${allocatedJadwalIds.join(',')}),tanggal_ujian.eq.${todayStr}`);
      } else {
        cbtQuery = cbtQuery.eq('tanggal_ujian', todayStr);
      }

      const { data: jadwals } = await cbtQuery;
      if (jadwals && jadwals.length > 0) {
        const active = jadwals.find((j: any) => {
          const isAllocated = allocatedJadwalIds.includes(Number(j.id));
          const isToday = j.tanggal_ujian === todayStr;
          const mulai = j.jam_mulai?.slice(0, 5) || '00:00';
          const selesai = j.jam_selesai?.slice(0, 5) || '23:59';
          const inTime = isToday && (currentTime >= mulai && currentTime <= selesai);
          const isStatusActive = j.status === 'aktif' || j.status === 'berlangsung';
          return (inTime || isStatusActive) || isAllocated;
        });
        setActiveCbtExam(active || null);
      } else {
        setActiveCbtExam(null);
      }
    } catch (e) {
      console.error('Error checkActiveExam in menu:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const menuGroups: MenuGroup[] = [
    {
      title: 'UJIAN & AKADEMIK',
      items: [
        {
          name: 'Ujian CBT',
          desc: activeCbtExam ? 'Ujian sedang berlangsung' : 'Jadwal & pelaksanaan tes',
          icon: Laptop,
          route: activeCbtExam ? `/cbt-ujian?jadwalId=${activeCbtExam.id}` : '/cbt-jadwal-siswa',
          color: '#dc2626',
          bgColor: '#fee2e2',
          isCbt: true,
        },
        {
          name: 'Jadwal Pelajaran',
          desc: 'Jadwal kelas mingguan',
          icon: CalendarDays,
          route: '/jadwal',
          color: '#16a34a',
          bgColor: '#dcfce7',
        },
        {
          name: 'Nilai Akademik',
          desc: 'Rekap tugas & ujian',
          icon: Award,
          route: '/nilai',
          color: '#3740A1',
          bgColor: '#e0e7ff',
        },
        {
          name: 'Cetak Rapor',
          desc: 'Laporan capaian belajar',
          icon: GraduationCap,
          route: '/rapor',
          color: '#e11d48',
          bgColor: '#ffe4e6',
        },
      ],
    },
    {
      title: 'KEISLAMAN & KESISWAAN',
      items: [
        {
          name: 'Kelas Mengaji',
          desc: 'Tahsin & Tahfidz Quran',
          icon: BookOpen,
          route: '/mengaji',
          color: '#0284c7',
          bgColor: '#e0f2fe',
        },
        {
          name: 'Prestasi Siswa',
          desc: 'Penghargaan & lomba',
          icon: Trophy,
          route: '/prestasi',
          color: '#d97706',
          bgColor: '#fef3c7',
        },
        {
          name: 'Ekstrakurikuler',
          desc: 'Kegiatan minat & bakat',
          icon: Tent,
          route: '/ekskul',
          color: '#0d9488',
          bgColor: '#ccfbf1',
        },
        {
          name: 'Presensi Kehadiran',
          desc: 'Catatan hadir harian',
          icon: ClipboardCheck,
          route: '/(tabs)/presensi',
          color: '#4f46e5',
          bgColor: '#ede9fe',
        },
      ],
    },
    {
      title: 'KEUANGAN & INFORMASI',
      items: [
        {
          name: 'Tagihan Siswa',
          desc: 'Biaya mutu & riwayat bayar',
          icon: Wallet,
          route: '/(tabs)/tagihan',
          color: '#ca8a04',
          bgColor: '#fef9c3',
        },
        {
          name: 'Pengumuman Sekolah',
          desc: 'Informasi dan warta madrasah',
          icon: Megaphone,
          route: '/pengumuman',
          color: '#ea580c',
          bgColor: '#ffedd5',
        },
        {
          name: 'Profil Akun',
          desc: 'Data diri siswa & keamanan',
          icon: UserCircle,
          route: '/(tabs)/profil',
          color: '#64748b',
          bgColor: '#f1f5f9',
        },
      ],
    },
  ];

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  const filteredGroups = menuGroups
    .map((grp) => {
      const filtered = grp.items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.desc && item.desc.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      return { ...grp, items: filtered };
    })
    .filter((grp) => grp.items.length > 0);

  return (
    <View style={styles.container}>
      {/* Header Gradien Modern */}
      <LinearGradient colors={['#1E257F', '#3740A1']} style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.badgeSiswa}>
              <Sparkles size={12} color="#fde047" />
              <Text style={styles.badgeSiswaText}>PORTAL MENU SISWA</Text>
            </View>
            <Text style={styles.headerTitle}>Layanan & Fitur</Text>
            <Text style={styles.headerSubtitle}>
              {userData?.nama || 'Siswa'} {userData?.kelas ? `• Kelas ${userData.kelas}` : ''}
            </Text>
          </View>
        </View>

        {/* Row Pencarian & Pengatur Tampilan Menu (Grid / List) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <View style={[styles.searchBox, { flex: 1 }]}>
            <Search size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Cari menu, layanan, atau fitur..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Pengatur Tampilan Menu (Grid / List) */}
          <View style={styles.viewToggleGroup}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
              onPress={() => handleToggleViewMode('grid')}
              activeOpacity={0.7}
            >
              <LayoutGrid size={18} color={viewMode === 'grid' ? '#1E257F' : 'rgba(255, 255, 255, 0.7)'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => handleToggleViewMode('list')}
              activeOpacity={0.7}
            >
              <List size={18} color={viewMode === 'list' ? '#1E257F' : 'rgba(255, 255, 255, 0.7)'} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Konten Menu */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1E257F']} />
        }
      >
        {/* Banner Ujian Aktif jika Ada */}
        {activeCbtExam && (
          <Animatable.View animation="pulse" iterationCount="infinite" duration={2500}>
            <TouchableOpacity
              style={styles.activeExamBanner}
              activeOpacity={0.88}
              onPress={() => router.push({ pathname: '/cbt-ujian' as any, params: { jadwalId: activeCbtExam.id } })}
            >
              <View style={styles.activeExamTop}>
                <View style={styles.activeExamDot} />
                <Text style={styles.activeExamBadgeText}>UJIAN CBT SEDANG BERLANGSUNG</Text>
              </View>
              <Text style={styles.activeExamTitle}>
                {activeCbtExam.data_mapel?.nama_mapel || activeCbtExam.nama_ujian}
              </Text>
              <Text style={styles.activeExamSub}>
                Ketuk di sini untuk langsung mengerjakan lembar ujian!
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        )}

        {/* Daftar Grup Menu */}
        {filteredGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Tidak ditemukan menu dengan kata kunci "{searchQuery}".</Text>
          </View>
        ) : (
          filteredGroups.map((group, gIdx) => (
            <View key={gIdx} style={styles.groupContainer}>
              <Text style={styles.groupHeaderTitle}>{group.title}</Text>
              {viewMode === 'grid' ? (
                <View style={styles.menuGrid}>
                  {group.items.map((item, iIdx) => {
                    const IconComp = item.icon;
                    return (
                      <TouchableOpacity
                        key={iIdx}
                        style={styles.gridMenuItem}
                        activeOpacity={0.7}
                        onPress={() => handleNavigate(item.route)}
                      >
                        <View style={[styles.gridIconContainer, { backgroundColor: item.bgColor }]}>
                          <IconComp size={24} color={item.color} />
                          {item.isCbt && activeCbtExam && (
                            <View style={styles.gridActiveBadgeDot} />
                          )}
                        </View>
                        <Text style={styles.gridMenuText} numberOfLines={2}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.cardGrid}>
                  {group.items.map((item, iIdx) => {
                    const IconComp = item.icon;
                    return (
                      <TouchableOpacity
                        key={iIdx}
                        style={[
                          styles.menuCard,
                          item.isCbt && activeCbtExam && styles.menuCardCbtActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handleNavigate(item.route)}
                      >
                        <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                          <IconComp size={24} color={item.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.menuName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.desc && (
                            <Text style={styles.menuDesc} numberOfLines={1}>
                              {item.desc}
                            </Text>
                          )}
                        </View>
                        <ChevronRight size={16} color="#cbd5e1" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ))
        )}
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
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badgeSiswa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeSiswaText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#c7d2fe',
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  activeExamBanner: {
    backgroundColor: '#fee2e2',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    shadowColor: '#ef4444',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  activeExamTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  activeExamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  activeExamBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 0.5,
  },
  activeExamTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991b1b',
    marginTop: 2,
  },
  activeExamSub: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 4,
  },
  groupContainer: {
    marginBottom: 20,
  },
  groupHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardGrid: {
    gap: 10,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  menuCardCbtActive: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
    backgroundColor: '#fff5f5',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  menuDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },

  // Pengatur Tampilan Segmented Switcher
  viewToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  viewToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
  },
  viewToggleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },

  // Grid Layout Styles (Mengikuti Gaya Menu Guru)
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  gridMenuItem: {
    width: '21.5%',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  gridActiveBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc2626',
    borderWidth: 2,
    borderColor: '#fff',
  },
  gridMenuText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 14,
  },
});
