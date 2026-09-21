import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronLeft,
  Calendar,
  Clock,
  BookOpen,
  UserCheck,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  Lock,
  FileQuestion,
  Award,
  Building
} from 'lucide-react-native';
import { supabase } from '../../services/supabaseClient';

export default function CbtJadwalSiswa() {
  const [siswa, setSiswa] = useState<any>(null);
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [sesiMap, setSesiMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'semua' | 'aktif' | 'selesai'>('semua');

  useEffect(() => {
    loadSiswaAndJadwal();
  }, []);

  const loadSiswaAndJadwal = async () => {
    try {
      setLoading(true);
      const userStr = await AsyncStorage.getItem('user_siswa');
      if (!userStr) {
        Alert.alert('Perhatian', 'Sesi login siswa tidak ditemukan. Silakan login kembali.');
        router.replace('/login');
        return;
      }

      const parsedSiswa = JSON.parse(userStr);
      setSiswa(parsedSiswa);

      // Ambil data siswa segar dari Supabase
      const { data: dbSiswa } = await supabase
        .from('data_siswa')
        .select('id, nama, kelas, status_keaktifan')
        .eq('id', parsedSiswa.id)
        .maybeSingle();

      if (!dbSiswa || (dbSiswa.status_keaktifan && dbSiswa.status_keaktifan.toLowerCase() !== 'aktif')) {
        Alert.alert(
          'Akses Ditolak',
          `Akun Anda berstatus "${dbSiswa?.status_keaktifan || 'Nonaktif'}". Hanya siswa berstatus "Aktif" yang dapat melihat dan mengikuti ujian CBT.`,
          [{ text: 'Kembali', onPress: () => router.back() }]
        );
        setJadwalList([]);
        setLoading(false);
        return;
      }

      const kelasSiswa = dbSiswa?.kelas || parsedSiswa.kelas || '';

      // Tentukan kelasId dan tingkatSiswa
      let kelasId = null;
      let tingkatSiswa: string | null = null;
      if (kelasSiswa) {
        const { data: kelasData } = await supabase
          .from('data_kelas')
          .select('id, tingkat')
          .ilike('nama_kelas', kelasSiswa.trim())
          .maybeSingle();
        if (kelasData) {
          kelasId = kelasData.id;
          if (kelasData.tingkat) tingkatSiswa = String(kelasData.tingkat);
        }
      }

      if (!tingkatSiswa && kelasSiswa) {
        const upper = kelasSiswa.toUpperCase().trim();
        if (upper.includes('VII') && !upper.includes('VIII')) tingkatSiswa = '7';
        else if (upper.includes('VIII')) tingkatSiswa = '8';
        else if (upper.includes('IX')) tingkatSiswa = '9';
        else {
          const m = upper.match(/\b([789])\b/);
          if (m) tingkatSiswa = m[1];
        }
      }

      // 1. Cek apakah siswa ini terdaftar di cbt_peserta_ruang
      const { data: pRuangData } = await supabase
        .from('cbt_peserta_ruang')
        .select('jadwal_id, ruang_id, nomor_meja, data_ruang(nama_ruang)')
        .eq('siswa_id', parsedSiswa.id);

      const pRuangMap = new Map();
      (pRuangData || []).forEach((pr: any) => {
        pRuangMap.set(Number(pr.jadwal_id), pr);
      });
      const allocatedJadwalIds = Array.from(pRuangMap.keys());

      // 2. Ambil jadwal ujian yang relevan
      let query = supabase
        .from('cbt_jadwal_ujian')
        .select(`
          id, nama_ujian, jenis_ujian, tanggal_ujian, jam_mulai, jam_selesai, durasi_menit, status,
          mapel_id, data_mapel(nama_mapel),
          guru_id, data_guru:data_guru!cbt_jadwal_ujian_guru_id_fkey(nama),
          bank_soal_id, cbt_bank_soal(id, judul, total_soal, tingkat_kelas)
        `)
        .order('tanggal_ujian', { ascending: true })
        .order('jam_mulai', { ascending: true });

      if (allocatedJadwalIds.length > 0) {
        if (kelasId) {
          query = query.or(`id.in.(${allocatedJadwalIds.join(',')}),kelas_id.eq.${kelasId},kelas_id.is.null`);
        } else {
          query = query.or(`id.in.(${allocatedJadwalIds.join(',')}),kelas_id.is.null`);
        }
      } else if (kelasId) {
        query = query.or(`kelas_id.eq.${kelasId},kelas_id.is.null`);
      }

      const { data: jadwalData, error: jadwalErr } = await query;
      if (jadwalErr) throw jadwalErr;

      // Ambil bank soal yang cocok dengan tingkat kelas siswa
      const { data: availableBanks } = await supabase
        .from('cbt_bank_soal')
        .select('id, mapel_id, tingkat_kelas')
        .or(`tingkat_kelas.eq.${tingkatSiswa || '0'},tingkat_kelas.eq.Semua`);

      const availableMapelIds = new Set((availableBanks || []).map(b => Number(b.mapel_id)));
      const availableBankIds = new Set((availableBanks || []).map(b => Number(b.id)));

      const filteredJadwalByGrade = (jadwalData || []).filter((j: any) => {
        // Jika siswa dialokasikan di cbt_peserta_ruang, PASTI BERHAK MENGIKUTI
        if (pRuangMap.has(Number(j.id))) return true;

        if (j.bank_soal_id && availableBankIds.has(Number(j.bank_soal_id))) return true;
        if (j.mapel_id && availableMapelIds.has(Number(j.mapel_id))) return true;
        const bTingkat = Array.isArray(j.cbt_bank_soal)
          ? j.cbt_bank_soal[0]?.tingkat_kelas
          : j.cbt_bank_soal?.tingkat_kelas;
        if (!bTingkat || bTingkat === 'Semua') return true;
        return false;
      }).map((j: any) => {
        const pr = pRuangMap.get(Number(j.id));
        return {
          ...j,
          ruang_nama: pr?.data_ruang?.nama_ruang || null,
          nomor_meja: pr?.nomor_meja || null
        };
      });

      setJadwalList(filteredJadwalByGrade);

      // Ambil sesi ujian siswa untuk jadwal-jadwal ini
      if (jadwalData && jadwalData.length > 0 && parsedSiswa.id) {
        const jadwalIds = jadwalData.map(j => j.id);
        const { data: sesiData } = await supabase
          .from('cbt_sesi_siswa')
          .select('*')
          .eq('siswa_id', parsedSiswa.id)
          .in('jadwal_id', jadwalIds);

        const mapping: Record<string, any> = {};
        sesiData?.forEach(s => {
          mapping[s.jadwal_id] = s;
        });
        setSesiMap(mapping);
      }
    } catch (error: any) {
      console.error('Error load jadwal CBT siswa:', error);
      Alert.alert('Gagal Memuat', error.message || 'Terjadi kesalahan saat memuat jadwal.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSiswaAndJadwal();
  };

  const handleStartExam = (jadwal: any) => {
    const sesi = sesiMap[jadwal.id];
    if (sesi?.status === 'selesai') {
      Alert.alert('Info', 'Anda sudah menyelesaikan ujian ini.');
      return;
    }
    if (sesi?.status === 'diblokir') {
      Alert.alert('Perhatian', 'Akses ujian Anda telah diblokir oleh pengawas. Silakan hubungi pengawas ruang.');
      return;
    }

    Alert.alert(
      'Konfirmasi Mulai Ujian',
      `Mata Pelajaran: ${jadwal.data_mapel?.nama_mapel || jadwal.nama_ujian}\nDurasi: ${jadwal.durasi_menit} Menit\n\nPastikan kamera depan Anda aktif untuk pengawasan proctoring. Apakah Anda yakin ingin memulai sekarang?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Mulai Sekarang',
          onPress: () => {
            router.push({
              pathname: '/cbt-ujian' as any,
              params: { jadwalId: jadwal.id }
            });
          }
        }
      ]
    );
  };

  const filteredJadwal = jadwalList.filter(item => {
    const sesi = sesiMap[item.id];
    if (filterTab === 'selesai') {
      return sesi?.status === 'selesai';
    }
    if (filterTab === 'aktif') {
      return sesi?.status !== 'selesai';
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#3740A1', '#1E257F']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Jadwal Ujian CBT</Text>
        </View>
        <Text style={styles.headerSubtitle}>Computer-Based Test dengan Pengawasan AI</Text>

        {/* Siswa Card */}
        {siswa && (
          <View style={styles.studentCard}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarText}>
                {siswa.nama ? siswa.nama.charAt(0).toUpperCase() : 'S'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName} numberOfLines={1}>{siswa.nama || 'Siswa'}</Text>
              <Text style={styles.studentMeta}>
                Kelas {siswa.kelas || '-'} • NISN {siswa.nisn || siswa.nipd || '-'}
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, filterTab === 'semua' && styles.tabBtnActive]}
          onPress={() => setFilterTab('semua')}
        >
          <Text style={[styles.tabText, filterTab === 'semua' && styles.tabTextActive]}>
            Semua ({jadwalList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, filterTab === 'aktif' && styles.tabBtnActive]}
          onPress={() => setFilterTab('aktif')}
        >
          <Text style={[styles.tabText, filterTab === 'aktif' && styles.tabTextActive]}>
            Belum / Sedang Ujian
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, filterTab === 'selesai' && styles.tabBtnActive]}
          onPress={() => setFilterTab('selesai')}
        >
          <Text style={[styles.tabText, filterTab === 'selesai' && styles.tabTextActive]}>
            Selesai
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#3740A1" />
          <Text style={styles.loadingText}>Memuat jadwal ujian...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3740A1']} />}
        >
          {filteredJadwal.length === 0 ? (
            <View style={styles.emptyCard}>
              <FileQuestion size={54} color="#9ca3af" />
              <Text style={styles.emptyTitle}>Tidak Ada Jadwal Ujian</Text>
              <Text style={styles.emptySubtitle}>
                Saat ini belum ada jadwal ujian CBT yang sesuai dengan filter Anda.
              </Text>
            </View>
          ) : (
            filteredJadwal.map((jadwal) => {
              const sesi = sesiMap[jadwal.id];
              const isSelesai = sesi?.status === 'selesai';
              const isMengerjakan = sesi?.status === 'mengerjakan';
              const isDiblokir = sesi?.status === 'diblokir';

              return (
                <View key={jadwal.id} style={styles.jadwalCard}>
                  {/* Card Header */}
                  <View style={styles.jadwalHeaderRow}>
                    <View style={styles.badgeJenis}>
                      <Text style={styles.badgeJenisText}>{jadwal.jenis_ujian || 'Ujian CBT'}</Text>
                    </View>

                    {isSelesai && (
                      <View style={[styles.statusBadge, { backgroundColor: '#dcfce7' }]}>
                        <CheckCircle2 size={13} color="#16a34a" />
                        <Text style={[styles.statusBadgeText, { color: '#16a34a' }]}>Selesai</Text>
                      </View>
                    )}
                    {isMengerjakan && (
                      <View style={[styles.statusBadge, { backgroundColor: '#fef3c7' }]}>
                        <Clock size={13} color="#d97706" />
                        <Text style={[styles.statusBadgeText, { color: '#d97706' }]}>Sedang Mengerjakan</Text>
                      </View>
                    )}
                    {isDiblokir && (
                      <View style={[styles.statusBadge, { backgroundColor: '#fee2e2' }]}>
                        <Lock size={13} color="#dc2626" />
                        <Text style={[styles.statusBadgeText, { color: '#dc2626' }]}>Diblokir</Text>
                      </View>
                    )}
                    {!sesi && (
                      <View style={[styles.statusBadge, { backgroundColor: '#eff6ff' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#2563eb' }]}>Siap Dikerjakan</Text>
                      </View>
                    )}
                  </View>

                  {/* Title */}
                  <Text style={styles.mapelTitle}>{jadwal.data_mapel?.nama_mapel || jadwal.nama_ujian}</Text>
                  {jadwal.nama_ujian !== jadwal.data_mapel?.nama_mapel && (
                    <Text style={styles.namaUjianSubtitle}>{jadwal.nama_ujian}</Text>
                  )}

                  {/* Meta Items */}
                  <View style={styles.metaContainer}>
                    <View style={styles.metaRow}>
                      <Calendar size={15} color="#6b7280" />
                      <Text style={styles.metaText}>{jadwal.tanggal_ujian || 'Hari ini'}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Clock size={15} color="#6b7280" />
                      <Text style={styles.metaText}>
                        {jadwal.jam_mulai?.substring(0, 5)} - {jadwal.jam_selesai?.substring(0, 5)} WIB ({jadwal.durasi_menit} Menit)
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <BookOpen size={15} color="#6b7280" />
                      <Text style={styles.metaText}>
                        {jadwal.cbt_bank_soal?.total_soal ? `${jadwal.cbt_bank_soal.total_soal} Butir Soal` : 'Soal CBT'}
                      </Text>
                    </View>
                    {jadwal.ruang_nama && (
                      <View style={styles.metaRow}>
                        <Building size={15} color="#2563eb" />
                        <Text style={[styles.metaText, { color: '#1e40af', fontWeight: 'bold' }]}>
                          Ruang: {jadwal.ruang_nama}{jadwal.nomor_meja ? ` • Meja #${jadwal.nomor_meja}` : ''}
                        </Text>
                      </View>
                    )}
                    {jadwal.data_guru?.nama && (
                      <View style={styles.metaRow}>
                        <UserCheck size={15} color="#6b7280" />
                        <Text style={styles.metaText}>Pengampu: {jadwal.data_guru.nama}</Text>
                      </View>
                    )}
                  </View>

                  {/* Action or Result Box */}
                  {isSelesai ? (
                    <View style={styles.resultBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Award size={18} color="#16a34a" />
                        <Text style={styles.resultLabel}>Ujian Selesai Dikumpulkan</Text>
                      </View>
                      {sesi?.nilai_akhir !== null && sesi?.nilai_akhir !== undefined && (
                        <Text style={styles.resultScore}>Nilai: {Number(sesi.nilai_akhir).toFixed(1)}</Text>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isMengerjakan ? styles.actionBtnResume : styles.actionBtnStart,
                        isDiblokir && styles.actionBtnDisabled
                      ]}
                      disabled={isDiblokir}
                      onPress={() => handleStartExam(jadwal)}
                    >
                      <PlayCircle size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>
                        {isMengerjakan ? 'Lanjutkan Pengerjaan' : 'Mulai Kerjakan Ujian'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    marginLeft: 42,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 12,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#84D43F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    color: '#1E257F',
    fontWeight: '700',
    fontSize: 18,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  studentMeta: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: {
    backgroundColor: '#3740A1',
  },
  tabText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  jadwalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  jadwalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeJenis: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeJenisText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3740A1',
    textTransform: 'uppercase',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapelTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  namaUjianSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  metaContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#475569',
  },
  resultBox: {
    marginTop: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  resultScore: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803d',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  actionBtnStart: {
    backgroundColor: '#3740A1',
  },
  actionBtnResume: {
    backgroundColor: '#d97706',
  },
  actionBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
