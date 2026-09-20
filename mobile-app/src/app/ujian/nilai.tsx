import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Platform
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  ChevronLeft,
  BookOpenCheck,
  Search,
  Download,
  Award,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  FileSpreadsheet
} from 'lucide-react-native';
import { supabase } from '../../../services/supabaseClient';

export default function UjianNilai() {
  const { jadwalId, kelasId } = useLocalSearchParams<{ jadwalId?: string; kelasId?: string }>();

  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>(jadwalId || '');
  const [selectedJadwal, setSelectedJadwal] = useState<any>(null);

  const [nilaiList, setNilaiList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchJadwalList();
  }, []);

  useEffect(() => {
    if (selectedJadwalId) {
      fetchNilaiData(selectedJadwalId);
    }
  }, [selectedJadwalId]);

  const fetchJadwalList = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cbt_jadwal_ujian')
        .select('*, data_mapel(nama_mapel), data_kelas(nama_kelas)')
        .order('tanggal_ujian', { ascending: false });

      if (error) throw error;
      setJadwalList(data || []);

      const chosen = selectedJadwalId || (data && data[0]?.id) || '';
      setSelectedJadwalId(chosen);
      if (data) {
        setSelectedJadwal(data.find(j => j.id === chosen) || null);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal memuat jadwal ujian.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNilaiData = async (jId: string) => {
    try {
      const { data: currentJadwal } = await supabase
        .from('cbt_jadwal_ujian')
        .select('*, data_mapel(nama_mapel), data_kelas(nama_kelas)')
        .eq('id', jId)
        .single();
      setSelectedJadwal(currentJadwal);

      // Ambil seluruh siswa di kelas terkait (menyesuaikan kelas terpilih)
      let targetKelas = currentJadwal?.data_kelas?.nama_kelas;
      if (kelasId) {
        const { data: kRow } = await supabase.from('data_kelas').select('nama_kelas').eq('id', kelasId).maybeSingle();
        if (kRow?.nama_kelas) {
          targetKelas = kRow.nama_kelas;
        }
      }
      let siswaQuery = supabase.from('data_siswa').select('id, nama, nipd, nisn, kelas').order('nama', { ascending: true });
      if (targetKelas) {
        siswaQuery = siswaQuery.eq('kelas', targetKelas);
      }
      const { data: allSiswa } = await siswaQuery;

      // Ambil sesi nilai siswa
      const { data: sesiData, error: sesiErr } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('jadwal_id', jId);

      if (sesiErr) throw sesiErr;

      const sesiMap: Record<string, any> = {};
      sesiData?.forEach(s => {
        sesiMap[s.siswa_id] = s;
      });

      const combined = (allSiswa || []).map(sw => {
        const s = sesiMap[sw.id];
        return {
          siswa_id: sw.id,
          nama: sw.nama,
          nipd: sw.nipd,
          nisn: sw.nisn,
          kelas: sw.kelas,
          status: s?.status || 'belum_mulai',
          skor_pg: s?.skor_pg ?? null,
          skor_isian: s?.skor_isian ?? null,
          skor_esai: s?.skor_esai ?? null,
          nilai_akhir: s?.nilai_akhir ?? null,
          waktu_selesai: s?.waktu_selesai || null
        };
      });

      setNilaiList(combined);
    } catch (e: any) {
      console.error('Error fetchNilaiData:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Metrics
  const stats = useMemo(() => {
    const scores = nilaiList
      .map(n => n.nilai_akhir)
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    const total = scores.length;
    if (total === 0) {
      return { avg: 0, max: 0, min: 0, selesaiCount: 0, totalSiswa: nilaiList.length };
    }

    const sum = scores.reduce((a, b) => a + Number(b), 0);
    const avg = (sum / total).toFixed(1);
    const max = Math.max(...scores.map(Number)).toFixed(1);
    const min = Math.min(...scores.map(Number)).toFixed(1);
    const selesaiCount = nilaiList.filter(n => n.status === 'selesai').length;

    return { avg, max, min, selesaiCount, totalSiswa: nilaiList.length };
  }, [nilaiList]);

  // Export CSV
  const handleExportCsv = async () => {
    if (nilaiList.length === 0) {
      Alert.alert('Info', 'Tidak ada data nilai untuk diekspor.');
      return;
    }

    try {
      setIsExporting(true);
      const examName = selectedJadwal?.nama_ujian || 'Ujian_CBT';
      const className = selectedJadwal?.data_kelas?.nama_kelas || 'Kelas';

      const headers = ['No', 'Nama Siswa', 'NISN', 'NIPD', 'Kelas', 'Skor PG', 'Skor Isian', 'Skor Esai', 'Nilai Akhir', 'Status'];
      const rows = nilaiList.map((item, idx) => [
        idx + 1,
        `"${item.nama}"`,
        `"${item.nisn || '-'}"`,
        `"${item.nipd || '-'}"`,
        `"${item.kelas || '-'}"`,
        item.skor_pg !== null ? Number(item.skor_pg).toFixed(1) : '-',
        item.skor_isian !== null ? Number(item.skor_isian).toFixed(1) : '-',
        item.skor_esai !== null ? Number(item.skor_esai).toFixed(1) : '-',
        item.nilai_akhir !== null ? Number(item.nilai_akhir).toFixed(1) : '-',
        item.status === 'selesai' ? 'Selesai' : item.status === 'mengerjakan' ? 'Sedang Ujian' : 'Belum Ujian'
      ].join(','));

      const csvContent = `${headers.join(',')}\n${rows.join('\n')}`;
      const fileName = `Rekap_Nilai_${examName.replace(/[^a-zA-Z0-9]/g, '_')}_${className}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          dialogTitle: 'Bagikan Rekap Nilai CBT',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        Alert.alert('Sukses', `File berhasil disimpan ke ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert('Gagal Ekspor', err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredNilai = nilaiList.filter(item => {
    if (searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase();
    const nama = (item.nama || '').toLowerCase();
    const nisn = (item.nisn || '').toLowerCase();
    const nipd = (item.nipd || '').toLowerCase();
    return nama.includes(q) || nisn.includes(q) || nipd.includes(q);
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#2a2c87', '#3b3e9e']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nilai Hasil Ujian</Text>
        </View>
        <Text style={styles.headerSubtitle}>Rekapitulasi skor hasil pengerjaan siswa</Text>
      </LinearGradient>

      {/* Jadwal Selector Chips */}
      {jadwalList.length > 0 && (
        <View style={styles.jadwalChipsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jadwalChipsScroll}>
            {jadwalList.map(j => {
              const active = j.id === selectedJadwalId;
              return (
                <TouchableOpacity
                  key={j.id}
                  style={[styles.jadwalChip, active && styles.jadwalChipActive]}
                  onPress={() => setSelectedJadwalId(j.id)}
                >
                  <Text style={[styles.jadwalChipText, active && styles.jadwalChipTextActive]}>
                    {j.data_mapel?.nama_mapel || j.nama_ujian} ({j.data_kelas?.nama_kelas || 'Semua'})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Summary KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Award size={18} color="#2a2c87" />
          <Text style={styles.kpiValue}>{stats.avg}</Text>
          <Text style={styles.kpiLabel}>Rata-Rata</Text>
        </View>
        <View style={styles.kpiCard}>
          <TrendingUp size={18} color="#16a34a" />
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{stats.max}</Text>
          <Text style={styles.kpiLabel}>Tertinggi</Text>
        </View>
        <View style={styles.kpiCard}>
          <Users size={18} color="#2563eb" />
          <Text style={[styles.kpiValue, { color: '#2563eb' }]}>
            {stats.selesaiCount}/{stats.totalSiswa}
          </Text>
          <Text style={styles.kpiLabel}>Selesai</Text>
        </View>
      </View>

      {/* Search & Export Action */}
      <View style={styles.filterBar}>
        <View style={styles.searchBar}>
          <Search size={16} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari siswa, NISN..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExportCsv}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <FileSpreadsheet size={16} color="#fff" />
              <Text style={styles.exportBtnText}>Ekspor</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Content List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2a2c87" />
          <Text style={styles.loadingText}>Memuat rekap nilai...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchNilaiData(selectedJadwalId);
              }}
              colors={['#2a2c87']}
            />
          }
        >
          {filteredNilai.length === 0 ? (
            <View style={styles.emptyCard}>
              <Award size={48} color="#9ca3af" />
              <Text style={styles.emptyTitle}>Data Nilai Tidak Ditemukan</Text>
              <Text style={styles.emptySubtitle}>Tidak ada siswa yang sesuai dengan filter pencarian.</Text>
            </View>
          ) : (
            filteredNilai.map((item, idx) => {
              const isSelesai = item.status === 'selesai';
              const isMengerjakan = item.status === 'mengerjakan';

              return (
                <View key={item.siswa_id} style={styles.nilaiCard}>
                  <View style={styles.nilaiCardHeader}>
                    <View style={styles.idxBadge}>
                      <Text style={styles.idxBadgeText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{item.nama}</Text>
                      <Text style={styles.studentMeta}>
                        NISN: {item.nisn || item.nipd || '-'} • Kelas: {item.kelas || '-'}
                      </Text>
                    </View>

                    {/* Final Score Badge */}
                    {isSelesai && item.nilai_akhir !== null ? (
                      <View style={styles.scoreBadge}>
                        <Text style={styles.scoreBadgeText}>
                          {Number(item.nilai_akhir).toFixed(1)}
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.statusBadge,
                          isMengerjakan ? { backgroundColor: '#fef3c7' } : { backgroundColor: '#f1f5f9' }
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isMengerjakan ? { color: '#d97706' } : { color: '#94a3b8' }
                          ]}
                        >
                          {isMengerjakan ? 'Sedang Ujian' : 'Belum Mulai'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Sub breakdown: PG, Isian, Esai */}
                  {isSelesai && (
                    <View style={styles.breakdownRow}>
                      <View style={styles.breakdownItem}>
                        <Text style={styles.breakdownLabel}>Skor PG</Text>
                        <Text style={styles.breakdownVal}>
                          {item.skor_pg !== null ? Number(item.skor_pg).toFixed(1) : '-'}
                        </Text>
                      </View>
                      <View style={styles.breakdownDivider} />
                      <View style={styles.breakdownItem}>
                        <Text style={styles.breakdownLabel}>Skor Isian</Text>
                        <Text style={styles.breakdownVal}>
                          {item.skor_isian !== null ? Number(item.skor_isian).toFixed(1) : '-'}
                        </Text>
                      </View>
                      <View style={styles.breakdownDivider} />
                      <View style={styles.breakdownItem}>
                        <Text style={styles.breakdownLabel}>Skor Esai</Text>
                        <Text style={styles.breakdownVal}>
                          {item.skor_esai !== null ? Number(item.skor_esai).toFixed(1) : '-'}
                        </Text>
                      </View>
                    </View>
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
  jadwalChipsBar: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  jadwalChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  jadwalChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  jadwalChipActive: {
    backgroundColor: '#2a2c87',
  },
  jadwalChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  jadwalChipTextActive: {
    color: '#fff',
  },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
    paddingVertical: 8,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  exportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
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
    marginTop: 4,
  },
  nilaiCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  nilaiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  idxBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idxBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  studentMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  scoreBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  scoreBadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803d',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 10,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
  },
  breakdownDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
  },
});
