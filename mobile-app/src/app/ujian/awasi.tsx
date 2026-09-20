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
  Modal,
  TextInput,
  Platform
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Users,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Lock,
  Unlock,
  PlusCircle,
  MessageSquare,
  X,
  ShieldAlert
} from 'lucide-react-native';
import { supabase } from '../../../services/supabaseClient';

export default function UjianAwasi() {
  const { jadwalId } = useLocalSearchParams<{ jadwalId?: string }>();

  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>(jadwalId || '');
  const [selectedJadwal, setSelectedJadwal] = useState<any>(null);

  const [sesiList, setSesiList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Action Modal State
  const [selectedStudentSesi, setSelectedStudentSesi] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchJadwalList();
  }, []);

  useEffect(() => {
    if (selectedJadwalId) {
      fetchSesiData(selectedJadwalId);
      setupRealtime(selectedJadwalId);
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

  const fetchSesiData = async (jId: string) => {
    try {
      const { data: currentJadwal } = await supabase
        .from('cbt_jadwal_ujian')
        .select('*, data_mapel(nama_mapel), data_kelas(nama_kelas)')
        .eq('id', jId)
        .single();
      setSelectedJadwal(currentJadwal);

      // Ambil seluruh siswa di kelas terkait
      let siswaQuery = supabase.from('data_siswa').select('id, nama, nipd, nisn, kelas');
      if (currentJadwal?.data_kelas?.nama_kelas) {
        siswaQuery = siswaQuery.eq('kelas', currentJadwal.data_kelas.nama_kelas);
      }
      const { data: allSiswa } = await siswaQuery;

      // Ambil data sesi siswa
      const { data: sesiData, error: sesiErr } = await supabase
        .from('cbt_sesi_siswa')
        .select('*, data_siswa(nama, nipd, nisn, kelas)')
        .eq('jadwal_id', jId);

      if (sesiErr) throw sesiErr;

      // Gabungkan data siswa & sesi
      const sesiMap: Record<string, any> = {};
      sesiData?.forEach(s => {
        sesiMap[s.siswa_id] = s;
      });

      const combined = (allSiswa || []).map(sw => {
        const existingSesi = sesiMap[sw.id];
        return {
          siswa_id: sw.id,
          nama: sw.nama,
          nipd: sw.nipd,
          nisn: sw.nisn,
          kelas: sw.kelas,
          sesi: existingSesi || null,
          status: existingSesi?.status || 'belum_mulai',
          sisa_detik: existingSesi?.sisa_detik ?? (currentJadwal?.durasi_menit || 60) * 60,
          total_pelanggaran: existingSesi?.total_pelanggaran || 0
        };
      });

      setSesiList(combined);
    } catch (e: any) {
      console.error('Error fetchSesiData:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const setupRealtime = (jId: string) => {
    const channel = supabase
      .channel(`proctor_room_${jId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cbt_sesi_siswa',
          filter: `jadwal_id=eq.${jId}`
        },
        () => {
          fetchSesiData(jId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Proctor Actions
  const handleAddTime = async (menit: number) => {
    if (!selectedStudentSesi?.sesi?.id) {
      Alert.alert('Info', 'Siswa belum memulai sesi ujian.');
      return;
    }
    try {
      setActionLoading(true);
      const tambahDetik = menit * 60;
      const newSisa = (selectedStudentSesi.sisa_detik || 0) + tambahDetik;

      const { error } = await supabase
        .from('cbt_sesi_siswa')
        .update({ sisa_detik: newSisa })
        .eq('id', selectedStudentSesi.sesi.id);

      if (error) throw error;

      Alert.alert('Sukses', `Berhasil menambahkan waktu +${menit} menit.`);
      setShowActionModal(false);
      fetchSesiData(selectedJadwalId);
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePause = async () => {
    if (!selectedStudentSesi?.sesi?.id) return;
    const isPaused = selectedStudentSesi.status === 'dijeda';
    const nextStatus = isPaused ? 'mengerjakan' : 'dijeda';

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('cbt_sesi_siswa')
        .update({ status: nextStatus })
        .eq('id', selectedStudentSesi.sesi.id);

      if (error) throw error;
      Alert.alert('Sukses', `Sesi siswa berhasil di-${nextStatus === 'dijeda' ? 'jeda' : 'lanjutkan'}.`);
      setShowActionModal(false);
      fetchSesiData(selectedJadwalId);
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedStudentSesi?.sesi?.id) return;
    const isBlocked = selectedStudentSesi.status === 'diblokir';
    const nextStatus = isBlocked ? 'mengerjakan' : 'diblokir';

    Alert.alert(
      isBlocked ? 'Buka Blokir?' : 'Blokir Akses Siswa?',
      `Apakah Anda yakin ingin ${isBlocked ? 'membuka akses kembali' : 'memblokir pengerjaan ujian'} siswa ini?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Lakukan',
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const { error } = await supabase
                .from('cbt_sesi_siswa')
                .update({ status: nextStatus })
                .eq('id', selectedStudentSesi.sesi.id);

              if (error) throw error;
              setShowActionModal(false);
              fetchSesiData(selectedJadwalId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Stats
  const totalSiswa = sesiList.length;
  const mengerjakanCount = sesiList.filter(s => s.status === 'mengerjakan').length;
  const selesaiCount = sesiList.filter(s => s.status === 'selesai').length;
  const pelanggaranCount = sesiList.filter(s => s.total_pelanggaran > 0).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#2a2c87', '#3b3e9e']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ruang Pengawas CBT</Text>
        </View>
        <Text style={styles.headerSubtitle}>Live Proctoring & Remote Control Peserta Ujian</Text>
      </LinearGradient>

      {/* Selector Jadwal */}
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

      {/* Summary KPI Bar */}
      <View style={styles.kpiContainer}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiVal}>{totalSiswa}</Text>
          <Text style={styles.kpiLabel}>Peserta</Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{mengerjakanCount}</Text>
          <Text style={styles.kpiLabel}>Ujian</Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiVal, { color: '#2563eb' }]}>{selesaiCount}</Text>
          <Text style={styles.kpiLabel}>Selesai</Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiVal, { color: pelanggaranCount > 0 ? '#dc2626' : '#64748b' }]}>
            {pelanggaranCount}
          </Text>
          <Text style={styles.kpiLabel}>Pelanggaran</Text>
        </View>
      </View>

      {/* Student List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2a2c87" />
          <Text style={styles.loadingText}>Menghubungkan ke ruang ujian...</Text>
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
                fetchSesiData(selectedJadwalId);
              }}
              colors={['#2a2c87']}
            />
          }
        >
          {sesiList.map((item) => {
            const isMengerjakan = item.status === 'mengerjakan';
            const isSelesai = item.status === 'selesai';
            const isDijeda = item.status === 'dijeda';
            const isDiblokir = item.status === 'diblokir';
            const isBelumMulai = item.status === 'belum_mulai';

            return (
              <TouchableOpacity
                key={item.siswa_id}
                style={styles.studentCard}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedStudentSesi(item);
                  setShowActionModal(true);
                }}
              >
                <View style={styles.studentCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName} numberOfLines={1}>{item.nama}</Text>
                    <Text style={styles.studentNipd}>NISN: {item.nisn || item.nipd || '-'}</Text>
                  </View>

                  {/* Status Badge */}
                  {isMengerjakan && (
                    <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
                      <View style={styles.greenPulse} />
                      <Text style={[styles.badgeText, { color: '#16a34a' }]}>Mengerjakan</Text>
                    </View>
                  )}
                  {isSelesai && (
                    <View style={[styles.badge, { backgroundColor: '#eff6ff' }]}>
                      <CheckCircle2 size={12} color="#2563eb" />
                      <Text style={[styles.badgeText, { color: '#2563eb' }]}>Selesai</Text>
                    </View>
                  )}
                  {isDijeda && (
                    <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
                      <PauseCircle size={12} color="#d97706" />
                      <Text style={[styles.badgeText, { color: '#d97706' }]}>Dijeda</Text>
                    </View>
                  )}
                  {isDiblokir && (
                    <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
                      <Lock size={12} color="#dc2626" />
                      <Text style={[styles.badgeText, { color: '#dc2626' }]}>Diblokir</Text>
                    </View>
                  )}
                  {isBelumMulai && (
                    <View style={[styles.badge, { backgroundColor: '#f1f5f9' }]}>
                      <Text style={[styles.badgeText, { color: '#64748b' }]}>Belum Masuk</Text>
                    </View>
                  )}
                </View>

                {/* Sub row: Sisa waktu & Pelanggaran */}
                <View style={styles.subRow}>
                  {item.sesi ? (
                    <View style={styles.timeTag}>
                      <Clock size={12} color="#64748b" />
                      <Text style={styles.timeTagText}>
                        Sisa: {Math.max(0, Math.floor(item.sisa_detik / 60))} menit
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.notActiveText}>Belum memulai pengerjaan</Text>
                  )}

                  {item.total_pelanggaran > 0 && (
                    <View style={styles.violationTag}>
                      <AlertTriangle size={12} color="#dc2626" />
                      <Text style={styles.violationTagText}>{item.total_pelanggaran}x Pelanggaran AI</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Action Sheet Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Kontrol Pengawas</Text>
                <Text style={styles.sheetSub}>
                  {selectedStudentSesi?.nama} ({selectedStudentSesi?.kelas || '-'})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowActionModal(false)} style={styles.closeBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Quick Actions List */}
            <View style={styles.actionsContainer}>
              <Text style={styles.actionSectionTitle}>Penyesuaian Waktu Ujian</Text>
              <View style={styles.timeBtnRow}>
                <TouchableOpacity
                  style={styles.timeActionBtn}
                  onPress={() => handleAddTime(5)}
                  disabled={actionLoading}
                >
                  <PlusCircle size={16} color="#2a2c87" />
                  <Text style={styles.timeActionBtnText}>+5 Menit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeActionBtn}
                  onPress={() => handleAddTime(10)}
                  disabled={actionLoading}
                >
                  <PlusCircle size={16} color="#2a2c87" />
                  <Text style={styles.timeActionBtnText}>+10 Menit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timeActionBtn}
                  onPress={() => handleAddTime(15)}
                  disabled={actionLoading}
                >
                  <PlusCircle size={16} color="#2a2c87" />
                  <Text style={styles.timeActionBtnText}>+15 Menit</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.actionSectionTitle, { marginTop: 16 }]}>Manajemen Sesi Ujian</Text>
              {selectedStudentSesi?.status === 'dijeda' ? (
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: '#16a34a' }]}
                  onPress={handleTogglePause}
                  disabled={actionLoading}
                >
                  <PlayCircle size={18} color="#fff" />
                  <Text style={styles.primaryActionBtnText}>Lanjutkan Ujian Siswa</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: '#d97706' }]}
                  onPress={handleTogglePause}
                  disabled={actionLoading}
                >
                  <PauseCircle size={18} color="#fff" />
                  <Text style={styles.primaryActionBtnText}>Jeda Sesi Ujian</Text>
                </TouchableOpacity>
              )}

              {selectedStudentSesi?.status === 'diblokir' ? (
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: '#2563eb', marginTop: 10 }]}
                  onPress={handleToggleBlock}
                  disabled={actionLoading}
                >
                  <Unlock size={18} color="#fff" />
                  <Text style={styles.primaryActionBtnText}>Buka Akses Siswa</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: '#dc2626', marginTop: 10 }]}
                  onPress={handleToggleBlock}
                  disabled={actionLoading}
                >
                  <Lock size={18} color="#fff" />
                  <Text style={styles.primaryActionBtnText}>Blokir Akses Ujian Siswa</Text>
                </TouchableOpacity>
              )}
            </View>
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
  kpiContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    justifyContent: 'space-around',
  },
  kpiItem: {
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
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
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  studentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  studentNipd: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeTagText: {
    fontSize: 12,
    color: '#64748b',
  },
  notActiveText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  violationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  violationTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  sheetSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  actionsContainer: {
    gap: 8,
  },
  actionSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  timeBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ede9fe',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  timeActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2a2c87',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
