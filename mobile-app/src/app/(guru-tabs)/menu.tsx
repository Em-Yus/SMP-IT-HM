import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, DeviceEventEmitter, Platform, ToastAndroid, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../../services/supabaseClient';
import {
  Users, UserCheck, BookOpen, Clock, FileText, Award,
  CreditCard, Wallet, Settings, Megaphone, CheckSquare,
  GraduationCap, ClipboardList, UserPlus,
  Building, Monitor, Activity, UserMinus, Target, Briefcase, School, Mail, DollarSign, Search,
  CalendarDays, FileQuestion, Eye, BookOpenCheck, QrCode
} from 'lucide-react-native';

const menuGroups = [
  {
    title: 'AKADEMIK & PRESENSI',
    items: [
      { name: 'Jadwal Mengajar', icon: Clock, route: '/(guru-tabs)/jadwal' },
      { name: 'Presensi Pegawai', icon: UserCheck, route: '/(guru-tabs)/presensi' },
      { name: 'Cetak QR Presensi', icon: QrCode, route: '/qr-presensi-guru' },
      { name: 'Presensi Siswa', icon: Users, route: '/presensi-siswa' },
      { name: 'Input Nilai', icon: FileText, route: '/input-nilai' },
      { name: 'Catatan Wali', icon: ClipboardList, route: '/catatan-wali' },
      { name: 'Cetak Rapor', icon: GraduationCap, route: '/rapor' },
      { name: 'Kelas Mengaji', icon: BookOpen, route: '/mengaji' },
    ]
  },
  {
    title: 'MASTER DATA',
    items: [
      { name: 'Identitas Lembaga', icon: Building, route: '/identitas' },
      { name: 'Data Pegawai', icon: Users, route: '/data-pegawai' },
      { name: 'Data Jabatan', icon: Briefcase, route: '/data-jabatan' },
      { name: 'Data Ruang', icon: Building, route: '/data-ruang' },
      { name: 'Data Kelas', icon: School, route: '/data-kelas' },
      { name: 'Mata Pelajaran', icon: BookOpen, route: '/mata-pelajaran' },
      { name: 'Tujuan Pembelajaran', icon: Target, route: '/tujuan-pembelajaran' },
      { name: 'Data Surat', icon: Mail, route: '/data-surat' },
      { name: 'Master Jam Presensi', icon: Clock, route: '/master-jam-presensi' },
      { name: 'Master Jam Guru', icon: Clock, route: '/master-jam-guru' },
      { name: 'Pegawai Nonaktif', icon: UserMinus, route: '/data-pegawai-nonaktif' },
      { name: 'Data Periodik Siswa', icon: Activity, route: '/data-periodik' },
    ]
  },
  {
    title: 'KESISWAAN & ADMIN',
    items: [
      { name: 'Cetak Kartu', icon: CreditCard, route: '/kartu-siswa' },
      { name: 'Data Siswa', icon: Users, route: '/data-siswa' },
      { name: 'Siswa Nonaktif', icon: UserMinus, route: '/data-siswa-nonaktif' },
      { name: 'Prestasi Siswa', icon: Award, route: '/prestasi-siswa' },
      { name: 'Ekstrakurikuler', icon: Activity, route: '/ekstrakurikuler' },
      { name: 'Kokurikuler (P5)', icon: BookOpen, route: '/kokurikuler' },
      { name: 'SPMB', icon: UserPlus, route: '/pendaftaran-spmb' },
      { name: 'Verifikasi PPDB', icon: CheckSquare, route: '/verifikasi-ppdb' },
    ]
  },
  {
    title: 'KEUANGAN',
    items: [
      { name: 'Rekap Honor Guru', icon: DollarSign, route: '/rekap-honor-guru' },
      { name: 'Biaya Mutu', icon: Settings, route: '/biaya-mutu' },
      { name: 'Tagihan Siswa', icon: Wallet, route: '/tagihan-siswa' },
      { name: 'Rekap Bayar', icon: FileText, route: '/rekap' },
      { name: 'Pemasukan', icon: DollarSign, route: '/pemasukan-lainnya' },
    ]
  },
  {
    title: 'UJIAN',
    items: [
      { name: 'SOP', icon: ClipboardList, route: '/ujian/tata-tertib' },
      { name: 'Jadwal Ujian', icon: CalendarDays, route: '/ujian/jadwal' },
    ]
  },
  {
    title: 'PORTAL CMS',
    items: [
      { name: 'Pengumuman', icon: Megaphone, route: '/pengumuman' },
      { name: 'Galeri Website', icon: Monitor, route: '/galeri-website' },
      { name: 'Pengaturan Aplikasi', icon: Settings, route: '/pengaturan-aplikasi' },
    ]
  }
];

export default function MenuScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [allowedRoutes, setAllowedRoutes] = useState<string[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const ROUTE_MAPPING: Record<string, string> = {
    '/data-lembaga': '/identitas',
    '/data-periodik-siswa': '/data-periodik',
    '/siswa-nonaktif': '/data-siswa-nonaktif',
    '/pegawai-nonaktif': '/data-pegawai-nonaktif',
    '/jadwal-guru': '/(guru-tabs)/jadwal',
    '/presensi-guru': '/(guru-tabs)/presensi',
    '/kelas-mengaji': '/mengaji',
    '/rapor-guru': '/rapor',
    '/input-biaya-pengembangan-mutu': '/biaya-mutu',
    '/rekap-bayar': '/rekap',
    '/admin/pendaftaran-spmb': '/pendaftaran-spmb',
    '/prestasi': '/prestasi-siswa',
    '/cms-pengumuman': '/pengumuman',
    '/cms-galeri': '/galeri-website',
    '/master-jam-guru': '/master-jam-guru',
    '/qr-presensi-guru': '/qr-presensi-guru',
    '/cetak-qr-presensi-guru': '/qr-presensi-guru',
    '/rekap-honor-guru': '/rekap-honor-guru',
    '/cbt/sop-ujian': '/ujian/tata-tertib',
    '/cbt-sop': '/ujian/tata-tertib',
    '/cbt/jadwal': '/ujian/jadwal',
    '/cbt-jadwal': '/ujian/jadwal',
  };

  const fetchUser = async () => {
    const userStr = await AsyncStorage.getItem('user_guru');
    if (userStr) {
      const parsed = JSON.parse(userStr);
      if (parsed?.id) {
        await fetchHakAkses(parsed.id);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUser();
    }, [])
  );

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      fetchUser();
    });

    return () => listener.remove();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUser();
    setRefreshing(false);
  };

  const fetchHakAkses = async (guruId: any) => {
    try {
      const { data: jabatanGuru } = await supabase.from('jabatan_guru').select('*').eq('guru_id', guruId).maybeSingle();
      if (!jabatanGuru) {
        setAllowedRoutes([]);
        return;
      }
      const roleNames = [];
      if (jabatanGuru.jabatan_utama) roleNames.push(jabatanGuru.jabatan_utama);
      if (jabatanGuru.jabatan_lain_1) roleNames.push(jabatanGuru.jabatan_lain_1);
      if (jabatanGuru.jabatan_lain_2) roleNames.push(jabatanGuru.jabatan_lain_2);
      if (jabatanGuru.jabatan_lain_3) roleNames.push(jabatanGuru.jabatan_lain_3);

      const hasQrAndJam = roleNames.some((r: string) => {
        const lower = (r || '').toLowerCase();
        return lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara') || lower.includes('waka') || lower.includes('kurikulum') || lower.includes('operator') || lower.includes('admin');
      });

      const { data: dataJabatan, error } = await supabase.from('data_jabatan').select('hak_akses').in('nama_jabatan', roleNames);

      const mergedAkses = new Set<string>();
      mergedAkses.add('/pengaturan-aplikasi');
      mergedAkses.add('/rekap-honor-guru'); // Semua guru dapat mengakses rekap honor masing-masing

      // Rule CBT:
      // Menu SOP muncul untuk Ketua Panitia ketika ditunjuk,
      // dan muncul untuk guru selain Ketua Panitia HANYA ketika dokumen SOP sudah ditandatangani Ketua Panitia
      try {
        let hasKetuaPanitia = false;
        let ketuaGuruId = null;

        // Ambil penunjukan Ketua Panitia langsung dari Data Pegawai (jabatan_guru)
        const { data: listGuruJabatan } = await supabase
          .from('jabatan_guru')
          .select('guru_id, jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3');

        const foundKetua = listGuruJabatan?.find((jg: any) => {
          const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
          return jRoles.some((r: any) => (r || '').toLowerCase().includes('ketua panitia'));
        });

        if (foundKetua) {
          hasKetuaPanitia = true;
          ketuaGuruId = foundKetua.guru_id;
        }

        // Cek Struktur Panitia (Ketua / Sekretaris / Bendahara)
        const { data: panitia } = await supabase
          .from('cbt_struktur_panitia')
          .select('*')
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();

        const isPanitiaMember = Boolean(
          (panitia && (
            Number(panitia.sekretaris_guru_id) === Number(guruId) ||
            Number(panitia.ketua_panitia_guru_id) === Number(guruId) ||
            Number(panitia.bendahara_guru_id) === Number(guruId)
          )) ||
          roleNames.some((r: string) => {
            const l = (r || '').toLowerCase();
            return l.includes('panitia') || l.includes('sekretaris') || l.includes('operator') || l.includes('admin') || l.includes('kurikulum');
          })
        );

        if (hasKetuaPanitia) {
          // HANYA akun yang ditunjuk sebagai Ketua Panitia yang diidentifikasi sebagai isKetuaUser
          const isKetuaUser = (Number(ketuaGuruId) === Number(guruId)) || roleNames.some((r: string) => {
            const l = (r || '').toLowerCase();
            return l.includes('ketua panitia');
          });

          // Cek apakah Ketua Panitia sudah menandatangani Halaman SOP
          const { data: sop } = await supabase
            .from('cbt_sop_persetujuan')
            .select('id, tanda_tangan_ketua, is_approved, is_tata_tertib_approved')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const isKetuaSignedSop = !!(sop && (sop.tanda_tangan_ketua || sop.is_approved || sop.is_tata_tertib_approved));

          // SOP & Jadwal terbuka jika user adalah Panitia (Ketua / Sekretaris / OPS) atau jika SOP sudah disahkan
          if (isKetuaUser || isPanitiaMember || isKetuaSignedSop) {
            mergedAkses.add('/ujian/tata-tertib'); // SOP
          }

          if (isPanitiaMember || isKetuaSignedSop) {
            mergedAkses.add('/ujian/jadwal'); // Jadwal Ujian
          }
        }
      } catch (cbtErr) {
        console.error('Error checking CBT menu rules in mobile:', cbtErr);
      }

      dataJabatan?.forEach((row: any) => {
        if (Array.isArray(row.hak_akses)) {
          row.hak_akses.forEach((dbRoute: string) => {
            const mobileRoute = ROUTE_MAPPING[dbRoute] || dbRoute;

            // KUNCI: Rute Ujian CBT (/ujian/ atau /cbt/) TIDAK BOLEH diambil dari data_jabatan
            // Rute Ujian secara eksklusif hanya diatur oleh aturan khusus CBT di atas
            if (mobileRoute.startsWith('/ujian/') || dbRoute.startsWith('/cbt/')) {
              return;
            }

            // Batasi QR & Jam khusus Kepala Sekolah, Bendahara, Waka Kurikulum, Operator, Admin
            if (mobileRoute === '/qr-presensi-guru' || mobileRoute === '/master-jam-guru') {
              if (hasQrAndJam) {
                mergedAkses.add(mobileRoute);
              }
            } else {
              mergedAkses.add(mobileRoute);
            }
          });
        }
      });

      if (hasQrAndJam) {
        mergedAkses.add('/qr-presensi-guru');
        mergedAkses.add('/master-jam-guru');
      }

      setAllowedRoutes(Array.from(mergedAkses));
    } catch (e) {
      console.error('Error in fetchHakAkses:', e);
      setAllowedRoutes(['/rekap-honor-guru', '/pengaturan-aplikasi']);
    }
  };

  const handleMenuPress = (menuName: string, route: string) => {
    const implementedRoutes = [
      '/rapor', '/rekap', '/kartu-siswa', '/identitas', '/data-siswa',
      '/data-periodik', '/data-siswa-nonaktif', '/data-pegawai', '/data-pegawai-nonaktif',
      '/data-jabatan', '/data-ruang', '/data-kelas', '/mata-pelajaran', '/data-surat',
      '/(guru-tabs)/jadwal', '/(guru-tabs)/presensi', '/presensi-siswa',
      '/master-jam-presensi', '/tujuan-pembelajaran', '/mengaji', '/input-nilai',
      '/catatan-wali', '/tagihan-siswa', '/biaya-mutu', '/pemasukan-lainnya',
      '/pendaftaran-spmb', '/verifikasi-ppdb', '/prestasi-siswa', '/ekstrakurikuler',
      '/kokurikuler', '/galeri-website', '/pengumuman', '/pengaturan-aplikasi',
      '/rekap-honor-guru', '/qr-presensi-guru', '/master-jam-guru',
      '/ujian/jadwal', '/ujian/tata-tertib', '/ujian/soal', '/ujian/awasi', '/ujian/nilai'
    ];

    if (implementedRoutes.includes(route)) {
      router.push(route as any);
    } else {
      Alert.alert('Info', `Fitur ${menuName} (Mobile) sedang dalam tahap pengembangan.`);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2a2c87', '#3b3e9e']} style={styles.header}>
        <Text style={styles.headerTitle}>Semua Menu</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2a2c87']} tintColor="#2a2c87" />
        }
      >
        <View style={styles.searchContainer}>
          <Search size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari menu (misal: presensi, nilai...)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>

        {menuGroups.map((group, index) => {
          const filteredItems = group.items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            const hasAccess = allowedRoutes ? allowedRoutes.includes(item.route) : false;
            return matchesSearch && hasAccess;
          });

          if (filteredItems.length === 0) return null;

          return (
            <View key={index} style={styles.groupContainer}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.grid}>
                {filteredItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={styles.menuItem}
                      onPress={() => handleMenuPress(item.name, item.route)}
                    >
                      <View style={styles.iconContainer}>
                        <Icon size={24} color="#2a2c87" />
                      </View>
                      <Text style={[styles.menuText, { textAlign: 'center' }]} numberOfLines={2}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
        {menuGroups.every(g => {
          return g.items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            const hasAccess = allowedRoutes ? allowedRoutes.includes(item.route) : false;
            return matchesSearch && hasAccess;
          }).length === 0;
        }) && (
          <Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>
            {allowedRoutes === null ? 'Memuat hak akses...' : 'Menu tidak ditemukan atau Anda tidak memiliki akses.'}
          </Text>
        )}
        <View style={{ height: 100 }} />
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
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  groupContainer: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 16,
  },
  menuItem: {
    width: '21%',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  menuText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '500',
    lineHeight: 14,
  }
});
