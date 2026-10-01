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
  Platform,
  Modal,
  Image
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
  Building,
  ShieldAlert,
  FileText,
  X,
  Check,
  XCircle
} from 'lucide-react-native';
import { supabase } from '../../services/supabaseClient';

export default function CbtJadwalSiswa() {
  const [siswa, setSiswa] = useState<any>(null);
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [sesiMap, setSesiMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'semua' | 'aktif' | 'selesai'>('semua');

  // State Review Lembar Koreksi Soal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReviewJadwal, setSelectedReviewJadwal] = useState<any>(null);
  const [selectedReviewSesi, setSelectedReviewSesi] = useState<any>(null);
  const [reviewSoalList, setReviewSoalList] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewTabFilter, setReviewTabFilter] = useState<'all' | 'pg' | 'isian' | 'esai'>('all');

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
        .select('id, judul, total_soal, mapel_id, tingkat_kelas')
        .or(`tingkat_kelas.eq.${tingkatSiswa || '0'},tingkat_kelas.eq.Semua`);

      // Ambil riwayat sesi ujian siswa terlebih dahulu
      const { data: sesiData } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('siswa_id', parsedSiswa.id);

      const mapping: Record<string, any> = {};
      sesiData?.forEach((s: any) => {
        mapping[s.jadwal_id] = s;
      });
      setSesiMap(mapping);

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const filteredJadwalByGrade = (jadwalData || []).filter((j: any) => {
        const sesi = mapping[j.id];

        // A. Validasi Kesesuaian Kelas:
        // Jika jadwal memiliki kelas_id tertentu (bukan Semua Kelas / null), pastikan kelas siswa cocok
        if (j.kelas_id && kelasId && Number(j.kelas_id) !== Number(kelasId)) {
          if (!pRuangMap.has(Number(j.id))) return false;
        }

        // B. Riwayat Ujian Selesai / Sedang Dikerjakan (selalu tampil)
        if (sesi?.status === 'selesai' || sesi?.status === 'mengerjakan' || sesi?.status === 'diblokir') {
          return true;
        }

        // C. Validasi Tanggal Ujian: Hanya tampil jika tanggal ujian adalah hari ini
        if (j.tanggal_ujian !== todayStr) {
          return false;
        }

        return true;
      }).map((j: any) => {
        const pr = pRuangMap.get(Number(j.id));
        // Cari bank soal yang cocok untuk tingkat kelas siswa
        const matchedBank = (availableBanks || []).find((b: any) =>
          Number(b.mapel_id) === Number(j.mapel_id) &&
          (String(b.tingkat_kelas) === String(tingkatSiswa) || String(b.tingkat_kelas) === 'Semua')
        );

        const effBank = matchedBank || (j.bank_soal_id ? (Array.isArray(j.cbt_bank_soal) ? j.cbt_bank_soal[0] : j.cbt_bank_soal) : null);

        return {
          ...j,
          cbt_bank_soal: effBank || j.cbt_bank_soal,
          ruang_nama: pr?.data_ruang?.nama_ruang || null,
          nomor_meja: pr?.nomor_meja || null
        };
      });

      setJadwalList(filteredJadwalByGrade);
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

    const now = new Date();
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (jadwal.jam_mulai && nowTimeStr < jadwal.jam_mulai.substring(0, 5)) {
      Alert.alert('Belum Waktunya', `Ujian ini baru dapat diakses pada pukul ${jadwal.jam_mulai.substring(0, 5)} WIB.`);
      return;
    }

    router.push({
      pathname: '/cbt-ujian' as any,
      params: { jadwalId: jadwal.id }
    });
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

  const handleOpenReviewModal = async (jadwalItem: any, sesiItem: any) => {
    try {
      setSelectedReviewJadwal(jadwalItem);
      setSelectedReviewSesi(sesiItem);
      setIsReviewModalOpen(true);
      setReviewLoading(true);
      setReviewTabFilter('all');

      let targetBankId = jadwalItem.bank_soal_id;
      if (!targetBankId && jadwalItem.cbt_bank_soal?.id) {
        targetBankId = jadwalItem.cbt_bank_soal.id;
      }

      if (!targetBankId) {
        const { data: bData } = await supabase
          .from('cbt_bank_soal')
          .select('id')
          .eq('mapel_id', jadwalItem.mapel_id)
          .order('id', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bData?.id) targetBankId = bData.id;
      }

      if (!targetBankId) {
        setReviewSoalList([]);
        setReviewLoading(false);
        return;
      }

      // 1. Ambil seluruh butir soal
      const { data: soals, error: sErr } = await supabase
        .from('cbt_soal')
        .select('*')
        .eq('bank_soal_id', targetBankId)
        .order('nomor_urut', { ascending: true });
      if (sErr) throw sErr;

      // 2. Ambil seluruh jawaban siswa untuk sesi ini
      const { data: answers, error: aErr } = await supabase
        .from('cbt_jawaban_siswa')
        .select('*')
        .eq('sesi_id', sesiItem.id);
      if (aErr) throw aErr;

      const answerMap = new Map();
      (answers || []).forEach((a: any) => answerMap.set(a.soal_id, a));

      // 3. Gabungkan butir soal dengan lembar koreksi
      const combined = (soals || []).map((s: any) => {
        const a = answerMap.get(s.id);
        const userAns = a?.jawaban_siswa ?? '';
        let isCorrect = a?.is_benar;
        let skorEarned = a?.skor_final_guru ?? a?.skor_ai ?? 0;

        if (s.jenis_soal === 'pg') {
          if (isCorrect === null || isCorrect === undefined) {
            isCorrect = String(userAns).trim().toUpperCase() === String(s.kunci_jawaban).trim().toUpperCase() && userAns !== '';
          }
          if (isCorrect && !skorEarned) {
            skorEarned = parseFloat(s.bobot_nilai || 1);
          }
        } else if (s.jenis_soal === 'isian') {
          if (isCorrect === null || isCorrect === undefined) {
            const keyAnsList = (s.kunci_jawaban || '').split(/[,;|]/).map((k: string) => k.trim().toLowerCase());
            isCorrect = userAns !== '' && (keyAnsList.includes(userAns.toLowerCase()) || userAns.toLowerCase() === (s.kunci_jawaban || '').trim().toLowerCase());
          }
          if (isCorrect && !skorEarned) {
            skorEarned = parseFloat(s.bobot_nilai || 1);
          }
        }

        let parsedOps = s.opsi_jawaban;
        if (typeof parsedOps === 'string') {
          try {
            parsedOps = JSON.parse(parsedOps);
          } catch (_e) {
            parsedOps = [];
          }
        }

        return {
          ...s,
          opsi_jawaban: parsedOps,
          jawaban_siswa: userAns,
          is_benar: isCorrect,
          skor_diperoleh: skorEarned,
          skor_ai: a?.skor_ai,
          feedback_ai: a?.feedback_ai,
          status_koreksi: a?.status_koreksi || 'selesai'
        };
      });

      setReviewSoalList(combined);
    } catch (err: any) {
      console.error('Error open review modal on mobile:', err);
      Alert.alert('Gagal Membuka Koreksi', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setReviewLoading(false);
    }
  };

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

              const now = new Date();
              const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              const jamMulaiStr = jadwal.jam_mulai ? jadwal.jam_mulai.substring(0, 5) : null;
              const jamSelesaiStr = jadwal.jam_selesai ? jadwal.jam_selesai.substring(0, 5) : null;
              const isBelumMulai = !isMengerjakan && !isSelesai && !isDiblokir && jamMulaiStr && (nowTimeStr < jamMulaiStr);
              const isLewatWaktu = !isMengerjakan && !isSelesai && !isDiblokir && jamSelesaiStr && (nowTimeStr > jamSelesaiStr);

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
                      <View style={[styles.statusBadge, {
                        backgroundColor: isLewatWaktu ? '#fee2e2' : isBelumMulai ? '#fef3c7' : '#eff6ff'
                      }]}>
                        <Text style={[styles.statusBadgeText, {
                          color: isLewatWaktu ? '#dc2626' : isBelumMulai ? '#d97706' : '#2563eb'
                        }]}>
                          {isLewatWaktu
                            ? 'Waktu Berakhir'
                            : isBelumMulai
                            ? `Mulai Pukul ${jamMulaiStr} WIB`
                            : 'Siap Dikerjakan'}
                        </Text>
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
                    <View style={{ gap: 8, marginTop: 14 }}>
                      <View style={[styles.resultBox, { marginTop: 0 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Award size={18} color="#16a34a" />
                          <Text style={styles.resultLabel}>Ujian Selesai Dikumpulkan</Text>
                        </View>
                        {sesi?.nilai_akhir !== null && sesi?.nilai_akhir !== undefined && (
                          <Text style={styles.resultScore}>Nilai: {Number(sesi.nilai_akhir).toFixed(1)}</Text>
                        )}
                      </View>

                      {/* Tombol Lihat Koreksian Soal */}
                      <TouchableOpacity
                        style={styles.reviewBtn}
                        onPress={() => handleOpenReviewModal(jadwal, sesi)}
                      >
                        <FileText size={15} color="#3740A1" />
                        <Text style={styles.reviewBtnText}>Lihat Koreksian Soal</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isLewatWaktu ? (
                    <View style={[styles.actionBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }]}>
                      <Lock size={16} color="#94a3b8" />
                      <Text style={[styles.actionBtnText, { color: '#94a3b8' }]}>
                        Waktu Ujian Telah Berakhir ({jamSelesaiStr} WIB)
                      </Text>
                    </View>
                  ) : isBelumMulai ? (
                    <View style={[styles.actionBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }]}>
                      <Lock size={16} color="#94a3b8" />
                      <Text style={[styles.actionBtnText, { color: '#94a3b8' }]}>
                        Ujian Dimulai Pukul {jamMulaiStr} WIB
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        isDiblokir
                          ? { backgroundColor: '#dc2626' }
                          : isMengerjakan
                          ? styles.actionBtnResume
                          : styles.actionBtnStart
                      ]}
                      onPress={() => handleStartExam(jadwal)}
                    >
                      {isDiblokir ? (
                        <>
                          <ShieldAlert size={18} color="#fff" />
                          <Text style={styles.actionBtnText}>Akses Terblokir • Lihat Status</Text>
                        </>
                      ) : (
                        <>
                          <PlayCircle size={18} color="#fff" />
                          <Text style={styles.actionBtnText}>
                            {isMengerjakan ? 'Lanjutkan Pengerjaan' : 'Mulai Kerjakan Ujian'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ========================================================
          MODAL REVIEW HASIL KOREKSIAN UJIAN SISWA (READ-ONLY)
      ======================================================== */}
      <Modal
        visible={isReviewModalOpen}
        animationType="slide"
        onRequestClose={() => setIsReviewModalOpen(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header Modal */}
          <LinearGradient colors={['#3740A1', '#1E257F']} style={styles.modalHeader}>
            <View style={styles.modalHeaderTop}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.modalIconWrap}>
                  <FileText size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Lembar Hasil Koreksi</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {selectedReviewJadwal?.data_mapel?.nama_mapel || selectedReviewJadwal?.nama_ujian}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsReviewModalOpen(false)}
              >
                <X size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Score Overview Cards */}
            <View style={styles.scoreCardsRow}>
              <View style={[styles.scoreCard, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                <Text style={[styles.scoreCardLabel, { color: '#166534' }]}>NILAI AKHIR</Text>
                <Text style={[styles.scoreCardValue, { color: '#14532d' }]}>
                  {selectedReviewSesi?.nilai_akhir !== null && selectedReviewSesi?.nilai_akhir !== undefined
                    ? Number(selectedReviewSesi.nilai_akhir).toFixed(1)
                    : '-'}
                </Text>
              </View>

              <View style={styles.scoreCard}>
                <Text style={styles.scoreCardLabel}>PG (/100)</Text>
                <Text style={styles.scoreCardValue}>
                  {selectedReviewSesi?.skor_pg !== null && selectedReviewSesi?.skor_pg !== undefined
                    ? Number(selectedReviewSesi.skor_pg).toFixed(0)
                    : '0'}
                </Text>
              </View>

              <View style={styles.scoreCard}>
                <Text style={styles.scoreCardLabel}>ISIAN (/100)</Text>
                <Text style={styles.scoreCardValue}>
                  {selectedReviewSesi?.skor_isian !== null && selectedReviewSesi?.skor_isian !== undefined
                    ? Number(selectedReviewSesi.skor_isian).toFixed(0)
                    : '0'}
                </Text>
              </View>

              <View style={styles.scoreCard}>
                <Text style={styles.scoreCardLabel}>ESAI (/100)</Text>
                <Text style={styles.scoreCardValue}>
                  {selectedReviewSesi?.skor_esai !== null && selectedReviewSesi?.skor_esai !== undefined
                    ? Number(selectedReviewSesi.skor_esai).toFixed(0)
                    : '0'}
                </Text>
              </View>
            </View>

            {/* Filter Tabs in Modal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalTabsScroll} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              <TouchableOpacity
                style={[styles.modalTabBtn, reviewTabFilter === 'all' && styles.modalTabBtnActive]}
                onPress={() => setReviewTabFilter('all')}
              >
                <Text style={[styles.modalTabText, reviewTabFilter === 'all' && styles.modalTabTextActive]}>
                  Semua ({reviewSoalList.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalTabBtn, reviewTabFilter === 'pg' && styles.modalTabBtnActive]}
                onPress={() => setReviewTabFilter('pg')}
              >
                <Text style={[styles.modalTabText, reviewTabFilter === 'pg' && styles.modalTabTextActive]}>
                  PG ({reviewSoalList.filter((s: any) => s.jenis_soal === 'pg').length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalTabBtn, reviewTabFilter === 'isian' && styles.modalTabBtnActive]}
                onPress={() => setReviewTabFilter('isian')}
              >
                <Text style={[styles.modalTabText, reviewTabFilter === 'isian' && styles.modalTabTextActive]}>
                  Isian ({reviewSoalList.filter((s: any) => s.jenis_soal === 'isian').length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalTabBtn, reviewTabFilter === 'esai' && styles.modalTabBtnActive]}
                onPress={() => setReviewTabFilter('esai')}
              >
                <Text style={[styles.modalTabText, reviewTabFilter === 'esai' && styles.modalTabTextActive]}>
                  Esai ({reviewSoalList.filter((s: any) => s.jenis_soal === 'esai').length})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </LinearGradient>

          {/* Modal Content - Question List */}
          {reviewLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#3740A1" />
              <Text style={styles.loadingText}>Memuat lembar koreksi...</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {reviewSoalList
                .filter((s: any) => reviewTabFilter === 'all' || s.jenis_soal === reviewTabFilter)
                .map((soal: any) => {
                  const isPg = soal.jenis_soal === 'pg';
                  const isIsian = soal.jenis_soal === 'isian';
                  const isEsai = soal.jenis_soal === 'esai';

                  return (
                    <View key={soal.id} style={styles.reviewCard}>
                      {/* Header Soal */}
                      <View style={styles.reviewCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.soalNumBadge}>
                            <Text style={styles.soalNumBadgeText}>{soal.nomor_urut}</Text>
                          </View>
                          <View style={[styles.soalTypeBadge, isPg ? styles.typePg : isIsian ? styles.typeIsian : styles.typeEsai]}>
                            <Text style={styles.soalTypeBadgeText}>
                              {isPg ? 'Pilihan Ganda' : isIsian ? 'Isian Singkat' : 'Esai'}
                            </Text>
                          </View>
                          <Text style={styles.bobotText}>Bobot: {soal.bobot_nilai} Poin</Text>
                        </View>

                        {/* Status Koreksi Badge */}
                        {isPg || isIsian ? (
                          soal.jawaban_siswa ? (
                            soal.is_benar ? (
                              <View style={[styles.statusPill, { backgroundColor: '#dcfce7' }]}>
                                <CheckCircle2 size={13} color="#16a34a" />
                                <Text style={[styles.statusPillText, { color: '#16a34a' }]}>
                                  Benar (+{Number(soal.bobot_nilai).toFixed(1)})
                                </Text>
                              </View>
                            ) : (
                              <View style={[styles.statusPill, { backgroundColor: '#fee2e2' }]}>
                                <XCircle size={13} color="#dc2626" />
                                <Text style={[styles.statusPillText, { color: '#dc2626' }]}>Salah (0)</Text>
                              </View>
                            )
                          ) : (
                            <View style={[styles.statusPill, { backgroundColor: '#f1f5f9' }]}>
                              <Text style={[styles.statusPillText, { color: '#64748b' }]}>Kosong (0)</Text>
                            </View>
                          )
                        ) : (
                          <View style={[styles.statusPill, { backgroundColor: '#f3e8ff' }]}>
                            <Text style={[styles.statusPillText, { color: '#7e22ce' }]}>
                              Skor: {Number(soal.skor_diperoleh || 0).toFixed(1)}/{Number(soal.bobot_nilai).toFixed(1)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Teks Pertanyaan */}
                      <Text style={styles.reviewPertanyaan}>{soal.pertanyaan}</Text>

                      {/* Gambar Soal jika ada */}
                      {soal.gambar_url && (
                        <Image
                          source={{ uri: soal.gambar_url }}
                          style={styles.reviewImage}
                          resizeMode="contain"
                        />
                      )}

                      {/* Opsi Pilihan Ganda */}
                      {isPg && Array.isArray(soal.opsi_jawaban) && (
                        <View style={{ gap: 8, marginTop: 8 }}>
                          {soal.opsi_jawaban.map((op: any) => {
                            const isChosen = String(soal.jawaban_siswa || '').trim().toUpperCase() === String(op.id).toUpperCase();
                            const isKey = String(soal.kunci_jawaban || '').trim().toUpperCase() === String(op.id).toUpperCase();

                            let cardStyle = styles.opsiCardNeutral;
                            let textStyle = styles.opsiTextNeutral;
                            let badgeLabel = null;

                            if (isChosen && isKey) {
                              cardStyle = styles.opsiCardCorrect;
                              textStyle = styles.opsiTextCorrect;
                              badgeLabel = 'Jawaban Anda (Benar) ✓';
                            } else if (isChosen && !isKey) {
                              cardStyle = styles.opsiCardWrong;
                              textStyle = styles.opsiTextWrong;
                              badgeLabel = 'Jawaban Anda (Salah) ✗';
                            } else if (!isChosen && isKey) {
                              cardStyle = styles.opsiCardKey;
                              textStyle = styles.opsiTextKey;
                              badgeLabel = 'Kunci Jawaban';
                            }

                            return (
                              <View key={op.id} style={[styles.opsiCard, cardStyle]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                  <View style={[styles.opsiLetterCircle, isChosen && isKey ? { backgroundColor: '#16a34a' } : isChosen ? { backgroundColor: '#dc2626' } : isKey ? { backgroundColor: '#22c55e' } : { backgroundColor: '#cbd5e1' }]}>
                                    <Text style={styles.opsiLetterText}>{op.id}</Text>
                                  </View>
                                  <Text style={[styles.opsiText, textStyle]}>{op.text}</Text>
                                </View>
                                {badgeLabel && (
                                  <View style={[styles.opsiBadgePill, isChosen && isKey ? { backgroundColor: '#bbf7d0' } : isChosen ? { backgroundColor: '#fecaca' } : { backgroundColor: '#dcfce7' }]}>
                                    <Text style={[styles.opsiBadgePillText, isChosen && isKey ? { color: '#166534' } : isChosen ? { color: '#991b1b' } : { color: '#15803d' }]}>
                                      {badgeLabel}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              {op.gambar_url && (
                                <Image source={{ uri: op.gambar_url }} style={styles.opsiImage} resizeMode="contain" />
                              )}
                            </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Isian Singkat */}
                      {isIsian && (
                        <View style={{ gap: 8, marginTop: 8 }}>
                          <View style={[styles.isianBox, soal.is_benar ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' } : { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                            <Text style={styles.isianBoxLabel}>Jawaban Anda:</Text>
                            <Text style={[styles.isianBoxValue, soal.is_benar ? { color: '#166534' } : { color: '#991b1b' }]}>
                              {soal.jawaban_siswa || '(Tidak dijawab)'}
                            </Text>
                          </View>
                          <View style={[styles.isianBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                            <Text style={[styles.isianBoxLabel, { color: '#92400e' }]}>Kunci Jawaban Resmi:</Text>
                            <Text style={[styles.isianBoxValue, { color: '#78350f' }]}>
                              {soal.kunci_jawaban}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* Esai */}
                      {isEsai && (
                        <View style={{ gap: 8, marginTop: 8 }}>
                          <View style={styles.esaiBox}>
                            <Text style={styles.isianBoxLabel}>Jawaban Uraian Anda:</Text>
                            <Text style={styles.esaiBoxValue}>
                              {soal.jawaban_siswa || '(Tidak ada jawaban uraian)'}
                            </Text>
                          </View>
                          {soal.rubrik_esai ? (
                            <View style={[styles.esaiBox, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                              <Text style={[styles.isianBoxLabel, { color: '#6b21a8' }]}>Rubrik Penilaian Guru:</Text>
                              <Text style={[styles.esaiBoxValue, { color: '#581c87' }]}>
                                {soal.rubrik_esai}
                              </Text>
                            </View>
                          ) : null}
                          <View style={[styles.esaiBox, { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={[styles.isianBoxLabel, { color: '#581c87' }]}>Evaluasi Semantik Model AI:</Text>
                              {soal.skor_ai !== null && soal.skor_ai !== undefined && (
                                <View style={{ backgroundColor: '#e9d5ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#581c87' }}>
                                    Skor AI: {soal.skor_ai} Poin
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.esaiBoxValue, { color: '#6b21a8' }]}>
                              {soal.feedback_ai || (soal.skor_ai !== null && soal.skor_ai !== undefined
                                ? `Model AI mengevaluasi kesesuaian uraian Anda dengan konsep kunci rubrik dan memberikan nilai ${soal.skor_ai} poin.`
                                : 'Model AI mencocokkan kemiripan semantik dengan rubrik penilaian.')}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={styles.readOnlyNote}>
                  Lembar koreksi ini hanya dapat dilihat (read-only) untuk evaluasi belajar peserta didik.
                </Text>
                <TouchableOpacity
                  style={styles.closeBottomBtn}
                  onPress={() => setIsReviewModalOpen(false)}
                >
                  <Text style={styles.closeBottomBtnText}>Tutup Lembar Koreksi</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#daffcc',
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
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  reviewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3740A1',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 44,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  modalHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scoreCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#3740A1',
    textTransform: 'uppercase',
  },
  scoreCardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  modalTabsScroll: {
    marginTop: 2,
  },
  modalTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modalTabBtnActive: {
    backgroundColor: '#fff',
  },
  modalTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  modalTabTextActive: {
    color: '#1E257F',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  soalNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#3740A1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soalNumBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  soalTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typePg: {
    backgroundColor: '#dbeafe',
  },
  typeIsian: {
    backgroundColor: '#fef3c7',
  },
  typeEsai: {
    backgroundColor: '#f3e8ff',
  },
  soalTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1e3a8a',
    textTransform: 'uppercase',
  },
  bobotText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reviewPertanyaan: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 20,
  },
  reviewImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginVertical: 8,
    backgroundColor: '#f8fafc',
  },
  opsiCard: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  opsiCardNeutral: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  opsiCardCorrect: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  opsiCardWrong: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  opsiCardKey: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  opsiLetterCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opsiLetterText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  opsiText: {
    fontSize: 13,
    flex: 1,
  },
  opsiTextNeutral: {
    color: '#475569',
  },
  opsiTextCorrect: {
    color: '#14532d',
    fontWeight: '700',
  },
  opsiTextWrong: {
    color: '#7f1d1d',
    fontWeight: '700',
  },
  opsiTextKey: {
    color: '#166534',
    fontWeight: '600',
  },
  opsiBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  opsiBadgePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  opsiImage: {
    width: 120,
    height: 70,
    borderRadius: 6,
    marginTop: 6,
    marginLeft: 28,
  },
  isianBox: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  isianBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
  },
  isianBoxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  esaiBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  esaiBoxValue: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginTop: 2,
  },
  readOnlyNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  closeBottomBtn: {
    backgroundColor: '#3740A1',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  closeBottomBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
