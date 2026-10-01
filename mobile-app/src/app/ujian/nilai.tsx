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
  Platform,
  Modal,
  Image
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
  FileSpreadsheet,
  Sparkles,
  X,
  Save,
  Check,
  AlertCircle
} from 'lucide-react-native';
import { supabase } from '../../../services/supabaseClient';
import { calculateCbtFinalScore } from '../../services/cbt/scoringService';

const parseOpsiJawaban = (rawOpsi: any): Array<{ id: string; text: string; gambar_url?: string }> => {
  if (!rawOpsi) return [];
  let parsed = rawOpsi;
  if (typeof rawOpsi === 'string') {
    try {
      parsed = JSON.parse(rawOpsi);
    } catch (_e) {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
};

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

  // State Modal Tinjau & Koreksi AI Guru
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<any[]>([]);
  const [tempScores, setTempScores] = useState<Record<number, string>>({});
  const [savingScores, setSavingScores] = useState(false);

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

      // Ambil sesi nilai siswa beserta data siswa
      const { data: sesiData, error: sesiErr } = await supabase
        .from('cbt_sesi_siswa')
        .select(`
          *,
          data_siswa(id, nama, nipd, nisn, kelas)
        `)
        .eq('jadwal_id', jId);

      if (sesiErr) throw sesiErr;

      const sesiMap: Record<string, any> = {};
      sesiData?.forEach(s => {
        sesiMap[s.siswa_id] = s;
      });

      // Kumpulkan siswa: gabungkan siswa dari kelas target dan siswa yang sudah ada sesi ujiannya
      const studentMap = new Map();
      (allSiswa || []).forEach(sw => {
        studentMap.set(Number(sw.id), sw);
      });

      (sesiData || []).forEach(s => {
        if (s.data_siswa) {
          const matchKelas = targetKelas
            ? (s.data_siswa.kelas || '').trim().toLowerCase() === targetKelas.trim().toLowerCase()
            : true;
          if (matchKelas && !studentMap.has(Number(s.siswa_id))) {
            studentMap.set(Number(s.siswa_id), s.data_siswa);
          }
        }
      });

      const combined = Array.from(studentMap.values()).map(sw => {
        const s = sesiMap[sw.id];
        return {
          id: s?.id,
          siswa_id: sw.id,
          nama: sw.nama,
          nipd: sw.nipd,
          nisn: sw.nisn,
          kelas: sw.kelas,
          status: s?.status || 'belum_mulai',
          skor_pg: s?.skor_pg !== null && s?.skor_pg !== undefined ? parseFloat(s.skor_pg) : null,
          skor_isian: s?.skor_isian !== null && s?.skor_isian !== undefined ? parseFloat(s.skor_isian) : null,
          skor_esai: s?.skor_esai !== null && s?.skor_esai !== undefined ? parseFloat(s.skor_esai) : null,
          nilai_akhir: s?.nilai_akhir !== null && s?.nilai_akhir !== undefined ? parseFloat(s.nilai_akhir) : null,
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

  const openReviewModal = async (item: any) => {
    try {
      setSelectedStudent(item);
      setIsReviewModalOpen(true);
      setReviewLoading(true);

      let targetBankId = selectedJadwal?.bank_soal_id;
      if (!targetBankId && selectedJadwal?.mapel_id) {
        const { data: qBank } = await supabase
          .from('cbt_bank_soal')
          .select('id')
          .eq('mapel_id', selectedJadwal.mapel_id)
          .order('id', { ascending: false })
          .limit(1);
        if (qBank && qBank.length > 0) {
          targetBankId = qBank[0].id;
        }
      }

      let fetchedSoals: any[] = [];
      if (targetBankId) {
        const { data: qSoal } = await supabase
          .from('cbt_soal')
          .select('*')
          .eq('bank_soal_id', targetBankId)
          .order('nomor_urut', { ascending: true });
        fetchedSoals = qSoal || [];
      }
      setSoalList(fetchedSoals);

      let fetchedAnswers: any[] = [];
      if (item.id && !String(item.id).startsWith('draft_')) {
        const { data: aData } = await supabase
          .from('cbt_jawaban_siswa')
          .select('*')
          .eq('sesi_id', item.id);
        fetchedAnswers = aData || [];
      }
      setStudentAnswers(fetchedAnswers);

      const initScores: Record<number, string> = {};
      fetchedSoals.forEach((s: any) => {
        const a = fetchedAnswers.find((ans: any) => Number(ans.soal_id) === Number(s.id));
        const scoreVal = a?.skor_final_guru !== null && a?.skor_final_guru !== undefined
          ? parseFloat(a.skor_final_guru)
          : a?.skor_ai !== null && a?.skor_ai !== undefined
          ? parseFloat(a.skor_ai)
          : 0;
        initScores[s.id] = String(scoreVal);
      });
      setTempScores(initScores);
    } catch (e: any) {
      console.error('Error openReviewModal:', e);
      Alert.alert('Gagal Memuat Soal', e.message || 'Terjadi kesalahan sistem.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSaveGuruReview = async () => {
    if (!selectedStudent) return;
    try {
      setSavingScores(true);
      let totalSkorPg = 0;
      let maxBobotPg = 0;
      let countPg = 0;

      let totalSkorIsian = 0;
      let maxBobotIsian = 0;
      let countIsian = 0;

      let totalSkorEsai = 0;
      let maxBobotEsai = 0;
      let countEsai = 0;

      for (const soal of soalList) {
        const bobot = parseFloat(soal.bobot_nilai || 1);
        const newScore = parseFloat(tempScores[soal.id] || '0') || 0;

        if (soal.jenis_soal === 'pg') {
          countPg++;
          maxBobotPg += bobot;
          totalSkorPg += newScore;
        } else if (soal.jenis_soal === 'isian') {
          countIsian++;
          maxBobotIsian += bobot;
          totalSkorIsian += newScore;
        } else {
          countEsai++;
          maxBobotEsai += bobot;
          totalSkorEsai += newScore;
        }

        const ans = studentAnswers.find((a: any) => Number(a.soal_id) === Number(soal.id));
        if (ans) {
          await supabase
            .from('cbt_jawaban_siswa')
            .update({
              skor_final_guru: newScore,
              status_koreksi: 'manual_guru',
              updated_at: new Date().toISOString()
            })
            .eq('id', ans.id);
        } else if (selectedStudent.id && !String(selectedStudent.id).startsWith('draft_')) {
          await supabase
            .from('cbt_jawaban_siswa')
            .insert({
              sesi_id: selectedStudent.id,
              soal_id: soal.id,
              jawaban_siswa: '',
              skor_final_guru: newScore,
              status_koreksi: 'manual_guru',
              updated_at: new Date().toISOString()
            });
        }
      }

      const skema = selectedJadwal?.skema_konversi || selectedJadwal?.cbt_bank_soal?.skema_konversi || 'asli';
      const scoreResult = calculateCbtFinalScore({
        skorPg: totalSkorPg,
        maxBobotPg: maxBobotPg,
        countPg: countPg,

        skorIsian: totalSkorIsian,
        maxBobotIsian: maxBobotIsian,
        countIsian: countIsian,

        skorEsai: totalSkorEsai,
        maxBobotEsai: maxBobotEsai,
        countEsai: countEsai,

        skemaKonversi: skema,
        kkm: 75,
      });

      const final100 = scoreResult.finalScore;

      if (selectedStudent.id && !String(selectedStudent.id).startsWith('draft_')) {
        await supabase
          .from('cbt_sesi_siswa')
          .update({
            skor_pg: totalSkorPg,
            skor_isian: totalSkorIsian,
            skor_esai: totalSkorEsai,
            nilai_akhir: final100,
          })
          .eq('id', selectedStudent.id);
      }

      Alert.alert('Berhasil', `Koreksi tersimpan! Nilai akhir diperbarui menjadi ${final100}.`);
      setIsReviewModalOpen(false);
      fetchNilaiData(selectedJadwalId);
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSavingScores(false);
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

                  {/* Tombol Tinjau AI & Koreksi */}
                  {isSelesai && (
                    <TouchableOpacity
                      style={styles.tinjauBtn}
                      onPress={() => openReviewModal(item)}
                    >
                      <Sparkles size={14} color="#3740A1" />
                      <Text style={styles.tinjauBtnText}>Tinjau AI & Koreksi</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal Review & Koreksi AI oleh Guru */}
      <Modal
        visible={isReviewModalOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsReviewModalOpen(false)}
      >
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#2a2c87', '#3b3e9e']} style={styles.modalHeader}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={18} color="#fde047" />
                  <Text style={styles.modalTitleText}>Koreksi & Verifikasi Nilai AI</Text>
                </View>
                <Text style={styles.modalSubText}>
                  Siswa: {selectedStudent?.nama} ({selectedStudent?.nisn || selectedStudent?.nipd || '-'}) • {selectedStudent?.kelas || '-'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsReviewModalOpen(false)}
              >
                <X size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {reviewLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#2a2c87" />
              <Text style={styles.loadingText}>Memuat lembar pengerjaan siswa...</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {soalList.length === 0 ? (
                <View style={styles.emptyCard}>
                  <AlertCircle size={40} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>Soal Ujian Belum Dibuat</Text>
                  <Text style={styles.emptySubtitle}>Tidak ada butir soal pada jadwal ujian ini.</Text>
                </View>
              ) : (
                soalList.map((soal: any) => {
                  const ans = studentAnswers.find((a: any) => Number(a.soal_id) === Number(soal.id));
                  const currentScore = tempScores[soal.id] !== undefined ? tempScores[soal.id] : '0';
                  const userAns = ans?.jawaban_siswa;
                  const hasAnswered = userAns !== undefined && userAns !== null && String(userAns).trim() !== '';

                  const opsiList = parseOpsiJawaban(soal.opsi_jawaban);
                  const chosenOpsi = opsiList.find(
                    (o) => String(o.id).trim().toUpperCase() === String(userAns).trim().toUpperCase()
                  );
                  const keyOpsi = opsiList.find(
                    (o) => String(o.id).trim().toUpperCase() === String(soal.kunci_jawaban).trim().toUpperCase()
                  );

                  const isPg = soal.jenis_soal === 'pg';
                  const isIsian = soal.jenis_soal === 'isian';
                  const isEsai = soal.jenis_soal === 'esai';

                  return (
                    <View key={soal.id} style={styles.modalSoalCard}>
                      {/* Soal Header */}
                      <View style={styles.modalSoalCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <View style={styles.modalSoalNumBadge}>
                            <Text style={styles.modalSoalNumText}>{soal.nomor_urut}</Text>
                          </View>
                          <Text style={styles.modalSoalMetaText}>
                            {soal.jenis_soal.toUpperCase()} • Bobot: {soal.bobot_nilai} Poin
                          </Text>
                        </View>
                        <View style={styles.modalScoreInputWrap}>
                          <Text style={styles.modalScoreInputLabel}>Skor Guru:</Text>
                          <TextInput
                            style={styles.modalScoreInput}
                            keyboardType="numeric"
                            value={currentScore}
                            onChangeText={(text) =>
                              setTempScores({ ...tempScores, [soal.id]: text })
                            }
                          />
                        </View>
                      </View>

                      {/* Question Text & Image */}
                      <Text style={styles.modalPertanyaanText}>{soal.pertanyaan}</Text>
                      {soal.gambar_url ? (
                        <Image source={{ uri: soal.gambar_url }} style={styles.modalSoalImage} resizeMode="contain" />
                      ) : null}

                      {/* PG Question View */}
                      {isPg && (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <View style={styles.answerBox}>
                            <Text style={styles.answerBoxLabel}>Jawaban Siswa:</Text>
                            {hasAnswered ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <View style={[styles.badgePill, ans?.is_benar ? styles.badgeSuccess : styles.badgeDanger]}>
                                  <Text style={[styles.badgePillText, ans?.is_benar ? styles.badgeSuccessText : styles.badgeDangerText]}>
                                    Pilihan {userAns} {ans?.is_benar ? '(Benar) ✓' : '(Salah) ✗'}
                                  </Text>
                                </View>
                                {chosenOpsi?.text ? (
                                  <Text style={styles.answerValueText}>{chosenOpsi.text}</Text>
                                ) : null}
                              </View>
                            ) : (
                              <Text style={styles.notAnsweredText}>(Siswa tidak menjawab)</Text>
                            )}
                          </View>
                          <View style={styles.keyBox}>
                            <Text style={styles.keyBoxLabel}>Kunci Jawaban Resmi:</Text>
                            <Text style={styles.keyValueText}>
                              Pilihan {soal.kunci_jawaban} {keyOpsi?.text ? `(${keyOpsi.text})` : ''}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Isian Question View */}
                      {isIsian && (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <View style={styles.answerBox}>
                            <Text style={styles.answerBoxLabel}>Jawaban Siswa:</Text>
                            {hasAnswered ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={[styles.answerValueText, { fontWeight: '800' }]}>"{userAns}"</Text>
                                <View style={[styles.badgePill, ans?.is_benar ? styles.badgeSuccess : styles.badgeDanger]}>
                                  <Text style={[styles.badgePillText, ans?.is_benar ? styles.badgeSuccessText : styles.badgeDangerText]}>
                                    {ans?.is_benar ? 'Benar ✓' : 'Salah ✗'}
                                  </Text>
                                </View>
                              </View>
                            ) : (
                              <Text style={styles.notAnsweredText}>(Siswa tidak menjawab)</Text>
                            )}
                          </View>
                          <View style={styles.keyBox}>
                            <Text style={styles.keyBoxLabel}>Kunci Jawaban Resmi:</Text>
                            <Text style={styles.keyValueText}>"{soal.kunci_jawaban || '-'}"</Text>
                          </View>
                        </View>
                      )}

                      {/* Esai Question View */}
                      {isEsai && (
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <View style={styles.answerBox}>
                            <Text style={styles.answerBoxLabel}>Jawaban Uraian Siswa:</Text>
                            {hasAnswered ? (
                              <Text style={styles.esaiAnswerText}>{userAns}</Text>
                            ) : (
                              <Text style={styles.notAnsweredText}>(Siswa tidak menjawab)</Text>
                            )}
                          </View>
                          {soal.rubrik_esai ? (
                            <View style={styles.rubrikBox}>
                              <Text style={styles.rubrikBoxLabel}>Rubrik Penilaian Guru:</Text>
                              <Text style={styles.rubrikValueText}>{soal.rubrik_esai}</Text>
                            </View>
                          ) : null}
                          <View style={styles.aiEvalBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Sparkles size={13} color="#7c3aed" />
                                <Text style={styles.aiEvalBoxLabel}>Evaluasi Semantik Model AI:</Text>
                              </View>
                              {ans?.skor_ai !== null && ans?.skor_ai !== undefined && (
                                <View style={styles.aiScoreBadge}>
                                  <Text style={styles.aiScoreBadgeText}>
                                    Rekomendasi AI: {ans.skor_ai} / {soal.bobot_nilai} Poin
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.aiEvalText}>
                              {ans?.feedback_ai ||
                                (ans?.skor_ai !== null && ans?.skor_ai !== undefined
                                  ? `Model AI mengevaluasi kesesuaian uraian siswa dengan kata kunci rubrik dan merekomendasikan skor ${ans.skor_ai} poin.`
                                  : 'Model AI mencocokkan kemiripan semantik dengan rubrik guru.')}
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

          {/* Bottom Actions */}
          <View style={styles.modalBottomBar}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsReviewModalOpen(false)}
            >
              <Text style={styles.modalCancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSaveGuruReview}
              disabled={savingScores}
            >
              {savingScores ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Save size={16} color="#fff" />
                  <Text style={styles.modalSaveBtnText}>Simpan Penilaian</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  tinjauBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 8,
    paddingVertical: 7,
    marginTop: 10,
  },
  tinjauBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3740A1',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  modalSubText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  modalSoalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  modalSoalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  modalSoalNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#2a2c87',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSoalNumText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  modalSoalMetaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  modalScoreInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modalScoreInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  modalScoreInput: {
    width: 50,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 12,
    fontWeight: '800',
    color: '#2a2c87',
    textAlign: 'center',
  },
  modalPertanyaanText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 19,
  },
  modalSoalImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  answerBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  answerBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  answerValueText: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '600',
  },
  notAnsweredText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#dc2626',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  badgeSuccessText: {
    color: '#15803d',
  },
  badgeDanger: {
    backgroundColor: '#fee2e2',
  },
  badgeDangerText: {
    color: '#b91c1c',
  },
  keyBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 2,
  },
  keyBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    textTransform: 'uppercase',
  },
  keyValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#14532d',
  },
  rubrikBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 2,
  },
  rubrikBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1e40af',
    textTransform: 'uppercase',
  },
  rubrikValueText: {
    fontSize: 11,
    color: '#1e3a8a',
    lineHeight: 16,
  },
  aiEvalBox: {
    backgroundColor: '#faf5ff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    gap: 3,
  },
  aiEvalBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6b21a8',
    textTransform: 'uppercase',
  },
  aiScoreBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiScoreBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6b21a8',
  },
  aiEvalText: {
    fontSize: 11,
    color: '#581c87',
    lineHeight: 16,
  },
  esaiAnswerText: {
    fontSize: 12,
    color: '#1e293b',
    lineHeight: 18,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalBottomBar: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  modalSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2a2c87',
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
