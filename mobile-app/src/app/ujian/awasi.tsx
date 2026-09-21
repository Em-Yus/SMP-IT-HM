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
  Platform,
  Image
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ChevronLeft,
  RefreshCw,
  MessageSquare,
  PlusCircle,
  PauseCircle,
  PlayCircle,
  Ban,
  Unlock,
  X,
  Send
} from 'lucide-react-native';
import { supabase } from '../../../services/supabaseClient';

export default function UjianAwasi() {
  const { jadwalId, ruangId } = useLocalSearchParams<{ jadwalId?: string; ruangId?: string }>();

  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>(jadwalId || '');
  const [selectedJadwal, setSelectedJadwal] = useState<any>(null);

  const [sesiList, setSesiList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Live Video Feed Siswa
  const [liveVideoFeeds, setLiveVideoFeeds] = useState<Record<string, any>>({});
  const [nowTs, setNowTs] = useState<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);

  // Modal Kirim Pesan
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [msgTarget, setMsgTarget] = useState<any>(null); // null = Pesan Massal
  const [pesanTeks, setPesanTeks] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    fetchJadwalList();
  }, []);

  useEffect(() => {
    if (selectedJadwalId) {
      fetchSesiData(selectedJadwalId);
      const cleanup = setupRealtime(selectedJadwalId);
      return cleanup;
    }
  }, [selectedJadwalId]);

  const fetchJadwalList = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cbt_jadwal_ujian')
        .select(`
          *,
          data_mapel(nama_mapel),
          data_kelas(nama_kelas),
          data_ruang(id, nama_ruang),
          pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama)
        `)
        .order('tanggal_ujian', { ascending: false });

      if (error) throw error;
      setJadwalList(data || []);

      const chosen = selectedJadwalId || (data && data[0]?.id) || '';
      setSelectedJadwalId(chosen);
      if (data) {
        setSelectedJadwal(data.find(j => String(j.id) === String(chosen)) || null);
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
        .select(`
          *,
          data_mapel(nama_mapel),
          data_kelas(nama_kelas),
          data_ruang(id, nama_ruang),
          pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama)
        `)
        .eq('id', jId)
        .single();
      setSelectedJadwal(currentJadwal);

      // 1. Cek apakah ada alokasi siswa di cbt_peserta_ruang
      let allSiswa: any[] = [];
      let pQuery = supabase
        .from('cbt_peserta_ruang')
        .select(`
          siswa_id,
          ruang_id,
          nomor_meja,
          data_ruang(nama_ruang),
          data_siswa:siswa_id(id, nama, nipd, nisn, kelas, foto_url, status_keaktifan)
        `)
        .eq('jadwal_id', jId);

      if (ruangId && ruangId !== 'semua') {
        pQuery = pQuery.eq('ruang_id', ruangId);
      }

      const { data: pRuangData } = await pQuery;

      if (pRuangData && pRuangData.length > 0) {
        allSiswa = pRuangData
          .filter((p: any) => p.data_siswa && (!p.data_siswa.status_keaktifan || p.data_siswa.status_keaktifan === 'Aktif'))
          .map((p: any) => ({
            ...p.data_siswa,
            ruang_id: p.ruang_id,
            ruang_nama: p.data_ruang?.nama_ruang || 'Ruang CBT',
            nomor_meja: p.nomor_meja
          }));
      }

      // 2. Jika belum ada alokasi khusus, ambil dari kelas jadwal
      if (allSiswa.length === 0) {
        let siswaQuery = supabase
          .from('data_siswa')
          .select('id, nama, nipd, nisn, kelas, foto_url, status_keaktifan')
          .eq('status_keaktifan', 'Aktif')
          .neq('kelas', 'Calon Siswa')
          .order('nama');

        if (currentJadwal?.data_kelas?.nama_kelas) {
          siswaQuery = siswaQuery.eq('kelas', currentJadwal.data_kelas.nama_kelas);
        }

        const { data: fallbackSiswa } = await siswaQuery;
        allSiswa = (fallbackSiswa || []).map((s: any) => ({
          ...s,
          ruang_id: currentJadwal?.ruang_id || 1,
          ruang_nama: currentJadwal?.data_ruang?.nama_ruang || 'Kelas 7',
          nomor_meja: null
        }));
      }

      // 3. Ambil sesi pengerjaan siswa
      const { data: sesiData, error: sesiErr } = await supabase
        .from('cbt_sesi_siswa')
        .select('*')
        .eq('jadwal_id', jId);

      if (sesiErr) throw sesiErr;

      const sesiMap: Record<string, any> = {};
      sesiData?.forEach((s: any) => {
        sesiMap[s.siswa_id] = s;
      });

      const combined = (allSiswa || []).map((sw: any) => {
        const existingSesi = sesiMap[sw.id];
        return {
          siswa_id: sw.id,
          id: sw.id,
          nama: sw.nama,
          nipd: sw.nipd,
          nisn: sw.nisn,
          kelas: sw.kelas,
          foto_url: sw.foto_url,
          nomor_meja: sw.nomor_meja,
          ruang_nama: sw.ruang_nama,
          sesi: existingSesi || null,
          status: existingSesi?.status || 'belum_mulai',
          sisa_detik: existingSesi?.sisa_detik ?? (currentJadwal?.durasi_menit || 90) * 60,
          total_pelanggaran: existingSesi?.total_pelanggaran || 0
        };
      });

      setSesiList(combined);
    } catch (e: any) {
      console.error('Error fetchSesiData:', e);
    } finally {
      setRefreshing(false);
      setLoading(false);
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

    const examChannel = supabase
      .channel(`cbt_exam_${jId}`)
      .on('broadcast', { event: 'student_video_feed' }, ({ payload }: any) => {
        if (payload?.siswaId) {
          setLiveVideoFeeds((prev) => ({
            ...prev,
            [payload.siswaId]: {
              image: payload.image,
              timestamp: payload.timestamp || Date.now(),
              faceStatus: payload.faceStatus || 'normal',
            },
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(examChannel);
    };
  };

  // ==========================================
  // TINDAKAN PER SISWA (5 MINI BUTTONS)
  // ==========================================

  // 1. Pesan ke siswa
  const handleOpenDirectMsg = (student: any) => {
    setMsgTarget(student);
    setPesanTeks('');
    setIsMsgModalOpen(true);
  };

  // 2. Tambah waktu siswa (+10 Menit)
  const handleAddTimeSingle = async (student: any, menit = 10) => {
    if (!student?.sesi?.id) {
      Alert.alert('Info', 'Siswa belum memulai sesi ujian.');
      return;
    }
    try {
      const addedSeconds = menit * 60;
      const newSisa = (student.sisa_detik || 0) + addedSeconds;

      const { error } = await supabase
        .from('cbt_sesi_siswa')
        .update({ sisa_detik: newSisa })
        .eq('id', student.sesi.id);

      if (error) throw error;
      Alert.alert('Berhasil', `+${menit} menit telah ditambahkan untuk ${student.nama}.`);
      fetchSesiData(selectedJadwalId);
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    }
  };

  // 3. Jeda siswa
  const handlePauseSingle = async (student: any) => {
    if (!student?.sesi?.id) {
      Alert.alert('Info', 'Siswa belum memulai sesi ujian.');
      return;
    }
    try {
      const { error } = await supabase
        .from('cbt_sesi_siswa')
        .update({ status: 'dijeda' })
        .eq('id', student.sesi.id);

      if (error) throw error;
      Alert.alert('Berhasil', `Ujian ${student.nama} berhasil dijeda.`);
      fetchSesiData(selectedJadwalId);
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    }
  };

  // 4. Lanjutkan siswa
  const handleResumeSingle = async (student: any) => {
    if (!student?.sesi?.id) {
      Alert.alert('Info', 'Siswa belum memulai sesi ujian.');
      return;
    }
    try {
      const { error } = await supabase
        .from('cbt_sesi_siswa')
        .update({ status: 'mengerjakan' })
        .eq('id', student.sesi.id);

      if (error) throw error;
      Alert.alert('Berhasil', `Ujian ${student.nama} berhasil dilanjutkan.`);
      fetchSesiData(selectedJadwalId);
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    }
  };

  // 5. Blokir / Buka Blokir siswa
  const handleToggleBlockSingle = (student: any) => {
    if (!student?.sesi?.id) {
      Alert.alert('Info', 'Siswa belum memulai sesi ujian.');
      return;
    }
    const isBlocked = student.status === 'diblokir';
    Alert.alert(
      isBlocked ? 'Buka Blokir Ujian?' : 'Blokir Akses Ujian?',
      isBlocked
        ? `Apakah Anda yakin ingin membuka blokir dan mengizinkan ${student.nama} melanjutkan ujian?`
        : `Apakah Anda yakin ingin memblokir akses ujian ${student.nama}? Layar ujian siswa akan terkunci.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: isBlocked ? 'Ya, Buka Blokir' : 'Ya, Blokir',
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const nextStatus = isBlocked ? 'mengerjakan' : 'diblokir';
              const { error } = await supabase
                .from('cbt_sesi_siswa')
                .update({ status: nextStatus })
                .eq('id', student.sesi.id);

              if (error) throw error;
              Alert.alert('Sukses', `Siswa berhasil di-${isBlocked ? 'buka blokir' : 'blokir'}.`);
              fetchSesiData(selectedJadwalId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // ==========================================
  // TINDAKAN SERENTAK / MASSAL (BOTTOM BAR)
  // ==========================================

  // 1. Pesan Massal
  const handleOpenBroadcastMsg = () => {
    setMsgTarget(null);
    setPesanTeks('');
    setIsMsgModalOpen(true);
  };

  // 2. Tambah Waktu Semua (+10 Menit)
  const handleAddTimeGlobal = async (menit = 10) => {
    const activeSessions = sesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');
    if (activeSessions.length === 0) {
      Alert.alert('Info', 'Tidak ada siswa yang sedang aktif ujian.');
      return;
    }

    Alert.alert(
      `Tambah Waktu +${menit} Menit?`,
      `Waktu untuk ${activeSessions.length} siswa yang aktif akan ditambah ${menit} menit.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Tambahkan',
          onPress: async () => {
            try {
              const promises = activeSessions.map(s => {
                const newSisa = (s.sisa_detik || 0) + menit * 60;
                return supabase.from('cbt_sesi_siswa').update({ sisa_detik: newSisa }).eq('id', s.sesi.id);
              });
              await Promise.all(promises);
              Alert.alert('Sukses', `+${menit} menit berhasil ditambahkan ke semua siswa.`);
              fetchSesiData(selectedJadwalId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // 3. Jeda Semua
  const handlePauseAllGlobal = async () => {
    const activeSessions = sesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');
    if (activeSessions.length === 0) {
      Alert.alert('Info', 'Tidak ada siswa yang sedang aktif ujian untuk dijeda.');
      return;
    }

    Alert.alert(
      'Jeda Seluruh Ujian?',
      `${activeSessions.length} siswa akan dijeda pengerjaannya serentak.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Jeda Semua',
          onPress: async () => {
            try {
              const promises = activeSessions.map(s =>
                supabase.from('cbt_sesi_siswa').update({ status: 'dijeda' }).eq('id', s.sesi.id)
              );
              await Promise.all(promises);
              Alert.alert('Sukses', 'Seluruh sesi ujian berhasil dijeda.');
              fetchSesiData(selectedJadwalId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // 4. Lanjutkan Semua
  const handleResumeAllGlobal = async () => {
    const pausedSessions = sesiList.filter(s => s.sesi?.id && s.sesi?.status === 'dijeda');
    if (pausedSessions.length === 0) {
      Alert.alert('Info', 'Tidak ada siswa yang sedang dalam status dijeda.');
      return;
    }

    Alert.alert(
      'Lanjutkan Seluruh Ujian?',
      `${pausedSessions.length} siswa akan dilanjutkan kembali ujiannya.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Lanjutkan',
          onPress: async () => {
            try {
              const promises = pausedSessions.map(s =>
                supabase.from('cbt_sesi_siswa').update({ status: 'mengerjakan' }).eq('id', s.sesi.id)
              );
              await Promise.all(promises);
              Alert.alert('Sukses', 'Seluruh ujian berhasil dilanjutkan kembali.');
              fetchSesiData(selectedJadwalId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // 5. Hentikan Semua
  const handleStopAllGlobal = async () => {
    const activeSessions = sesiList.filter(s => s.sesi?.id && (s.sesi?.status === 'mengerjakan' || s.sesi?.status === 'dijeda'));
    if (activeSessions.length === 0) {
      Alert.alert('Info', 'Tidak ada siswa yang sedang aktif ujian.');
      return;
    }

    Alert.alert(
      'Hentikan Seluruh Ujian?',
      `Seluruh sesi ujian (${activeSessions.length} siswa) akan dipaksa selesai dan jawaban dikunci.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hentikan Ujian',
          style: 'destructive',
          onPress: async () => {
            try {
              const promises = activeSessions.map(s =>
                supabase.from('cbt_sesi_siswa').update({ status: 'selesai' }).eq('id', s.sesi.id)
              );
              await Promise.all(promises);
              Alert.alert('Selesai', 'Ujian telah dihentikan untuk semua peserta.');
              fetchSesiData(selectedJadwalId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // Kirim Pesan Modal Submit
  const handleSendMessageSubmit = async () => {
    if (!pesanTeks.trim()) {
      Alert.alert('Peringatan', 'Silakan masukkan teks pesan.');
      return;
    }
    try {
      setSendingMsg(true);
      if (msgTarget?.sesi?.id) {
        // Kirim ke 1 siswa
        const { error } = await supabase.from('cbt_pesan_pengawas').insert([
          {
            jadwal_id: selectedJadwalId,
            sesi_id: msgTarget.sesi.id,
            siswa_id: msgTarget.id,
            pesan: pesanTeks.trim(),
            tipe: 'peringatan'
          }
        ]);
        if (error) throw error;
        Alert.alert('Terkirim', `Pesan peringatan berhasil dikirim ke ${msgTarget.nama}.`);
      } else {
        // Kirim massal ke seluruh ruangan
        const { error } = await supabase.from('cbt_pesan_pengawas').insert([
          {
            jadwal_id: selectedJadwalId,
            sesi_id: null,
            siswa_id: null,
            pesan: pesanTeks.trim(),
            tipe: 'pengumuman'
          }
        ]);
        if (error) throw error;
        Alert.alert('Terkirim', 'Pesan massal berhasil disiarkan ke seluruh siswa.');
      }
      setIsMsgModalOpen(false);
      setPesanTeks('');
    } catch (err: any) {
      Alert.alert('Gagal', err.message || 'Gagal mengirim pesan.');
    } finally {
      setSendingMsg(false);
    }
  };

  // Stats
  const totalSiswa = sesiList.length;
  const mengerjakanCount = sesiList.filter(s => s.status === 'mengerjakan').length;
  const selesaiCount = sesiList.filter(s => s.status === 'selesai').length;
  const pelanggaranCount = sesiList.reduce((acc, s) => acc + (s.total_pelanggaran || 0), 0);

  return (
    <View style={styles.container}>
      {/* =========================================================================
          1. HEADER DARK PURPLE / NAVY (PERSIS GAMBAR 2)
      ========================================================================= */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {/* Tombol Back Kotak */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnSquare}>
            <ChevronLeft color="#fff" size={26} />
          </TouchableOpacity>

          {/* Info Judul & Meta Ujian */}
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {selectedJadwal?.nama_ujian || 'PSTS IPA Ganjil'}
            </Text>
            <Text style={styles.headerSubText} numberOfLines={1}>
              Ruang: {selectedJadwal?.data_ruang?.nama_ruang || 'Kelas 7'}
            </Text>
            <Text style={styles.headerSubText} numberOfLines={1}>
              Mata Ujian: {selectedJadwal?.data_mapel?.nama_mapel || 'Ilmu Pengetahuan Alam'}
            </Text>
            <Text style={styles.headerSubText} numberOfLines={1}>
              Pengawas: {selectedJadwal?.pengawas?.nama || 'Muhamad Nadiri'}
            </Text>
          </View>

          {/* Tombol Refresh Bulat Besar Putih */}
          <TouchableOpacity
            style={styles.refreshCircleBtn}
            onPress={() => {
              setRefreshing(true);
              fetchSesiData(selectedJadwalId);
            }}
            activeOpacity={0.8}
          >
            <RefreshCw color="#1c1444" size={26} />
          </TouchableOpacity>
        </View>

        {/* Carousel / Dots Indicator di Bawah Header */}
        <Text style={styles.carouselDotsText}>— • • • •</Text>
      </View>

      {/* =========================================================================
          2. KPI CARDS BAR (TOTAL, AKTIF, SELESAI, ANOMALI) (PERSIS GAMBAR 2)
      ========================================================================= */}
      <View style={styles.kpiRow}>
        {/* TOTAL */}
        <View style={[styles.kpiBox, styles.kpiBoxTotal]}>
          <Text style={[styles.kpiLabelText, { color: '#2563eb' }]}>TOTAL</Text>
          <Text style={[styles.kpiValueText, { color: '#2563eb' }]}>{totalSiswa}</Text>
        </View>

        {/* AKTIF */}
        <View style={[styles.kpiBox, styles.kpiBoxAktif]}>
          <Text style={[styles.kpiLabelText, { color: '#16a34a' }]}>AKTIF</Text>
          <Text style={[styles.kpiValueText, { color: '#16a34a' }]}>{mengerjakanCount}</Text>
        </View>

        {/* SELESAI */}
        <View style={[styles.kpiBox, styles.kpiBoxSelesai]}>
          <Text style={[styles.kpiLabelText, { color: '#9333ea' }]}>SELESAI</Text>
          <Text style={[styles.kpiValueText, { color: '#9333ea' }]}>{selesaiCount}</Text>
        </View>

        {/* ANOMALI */}
        <View style={[styles.kpiBox, styles.kpiBoxAnomali]}>
          <Text style={[styles.kpiLabelText, { color: '#e11d48' }]}>ANOMALI</Text>
          <Text style={[styles.kpiValueText, { color: '#e11d48' }]}>{pelanggaranCount}</Text>
        </View>
      </View>

      {/* =========================================================================
          3. STUDENT GRID LIST (2 KOLOM, PERSIS GAMBAR 2)
      ========================================================================= */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#231853" />
          <Text style={styles.loadingText}>Memuat ruang monitor pengawas...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchSesiData(selectedJadwalId);
              }}
              colors={['#231853']}
            />
          }
        >
          <View style={styles.studentGrid}>
            {sesiList.map((item) => {
              const isMengerjakan = item.status === 'mengerjakan';
              const isSelesai = item.status === 'selesai';
              const isDijeda = item.status === 'dijeda';
              const isDiblokir = item.status === 'diblokir';
              const sisaMenit = Math.max(0, Math.floor((item.sisa_detik || 0) / 60));

              const statusLabel = isMengerjakan
                ? 'Aktif'
                : isSelesai
                ? 'Selesai'
                : isDijeda
                ? 'Dijeda'
                : isDiblokir
                ? 'Diblokir'
                : 'Belum Mulai';

              const waktuLabel = item.sesi?.sisa_detik ? `${sisaMenit}m` : 'Waktu';

              const liveFeed = liveVideoFeeds[item.id];
              const isFeedRecent = liveFeed?.timestamp && (nowTs - liveFeed.timestamp < 15000);
              const hasLiveVideo = Boolean(liveFeed?.image && isFeedRecent);

              return (
                <View key={item.id} style={styles.card}>
                  {/* Baris Atas: Kelas, Meja, Avatar Lingkaran, Status, Waktu */}
                  <View style={styles.cardTopRow}>
                    {/* Kiri: Pill Kelas & No. Meja */}
                    <View style={styles.cardPillCol}>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText} numberOfLines={1}>
                          {item.kelas || 'Kelas'}
                        </Text>
                      </View>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText} numberOfLines={1}>
                          {item.nomor_meja ? `Meja ${item.nomor_meja}` : 'No. Meja'}
                        </Text>
                      </View>
                    </View>

                    {/* Tengah: Lingkaran Avatar / Video Live Siswa */}
                    <View
                      style={[
                        styles.avatarCircle,
                        hasLiveVideo && (liveFeed?.faceStatus !== 'normal' ? styles.avatarCircleAnomaly : styles.avatarCircleLive),
                      ]}
                    >
                      {hasLiveVideo ? (
                        <Image source={{ uri: liveFeed.image }} style={styles.avatarImage} />
                      ) : item.foto_url ? (
                        <Image source={{ uri: item.foto_url }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.avatarPlaceholder} />
                      )}
                      {hasLiveVideo && <View style={styles.liveDot} />}
                    </View>

                    {/* Kanan: Pill Status Ujian & Waktu */}
                    <View style={styles.cardPillCol}>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText} numberOfLines={1}>
                          {statusLabel}
                        </Text>
                      </View>
                      <View style={styles.metaPill}>
                        <Text style={styles.metaPillText} numberOfLines={1}>
                          {waktuLabel}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Bagian Tengah: Latar Lengkung Siluet Gelap + Pill Nama Siswa + Pill NISN/NIPD */}
                  <View style={styles.cardMiddleSection}>
                    {/* Siluet Lengkungan Latar Belakang */}
                    <View style={styles.cardArchSilhouette} />

                    {/* Pill Nama Siswa */}
                    <View style={styles.namaPill}>
                      <Text style={styles.namaPillText} numberOfLines={1}>
                        {item.nama || 'Nama Siswa'}
                      </Text>
                    </View>

                    {/* Pill NISN/NIPD */}
                    <View style={styles.nipdPill}>
                      <Text style={styles.nipdPillText} numberOfLines={1}>
                        {item.nisn || item.nipd || 'NISN/NIPD'}
                      </Text>
                    </View>
                  </View>

                  {/* Bagian Bawah: 5 Tombol Aksi Mini (Persis Gambar 2) */}
                  <View style={styles.cardBottomActions}>
                    {/* 1. Mini Chat (Sky Blue) */}
                    <TouchableOpacity
                      style={[styles.miniActionBtn, styles.miniChatBtn]}
                      onPress={() => handleOpenDirectMsg(item)}
                      activeOpacity={0.7}
                    >
                      <MessageSquare size={11} color="#2563eb" />
                    </TouchableOpacity>

                    {/* 2. Mini Plus (+10 Menit) */}
                    <TouchableOpacity
                      style={[styles.miniActionBtn, styles.miniPlusBtn]}
                      onPress={() => handleAddTimeSingle(item, 10)}
                      activeOpacity={0.7}
                    >
                      <PlusCircle size={11} color="#16a34a" />
                    </TouchableOpacity>

                    {/* 3. Mini Pause (Jeda) */}
                    <TouchableOpacity
                      style={[styles.miniActionBtn, styles.miniPauseBtn]}
                      onPress={() => handlePauseSingle(item)}
                      activeOpacity={0.7}
                    >
                      <PauseCircle size={11} color="#ea580c" />
                    </TouchableOpacity>

                    {/* 4. Mini Play (Lanjutkan) */}
                    <TouchableOpacity
                      style={[styles.miniActionBtn, styles.miniPlayBtn]}
                      onPress={() => handleResumeSingle(item)}
                      activeOpacity={0.7}
                    >
                      <PlayCircle size={11} color="#16a34a" />
                    </TouchableOpacity>

                    {/* 5. Mini Blokir / Buka Blokir */}
                    <TouchableOpacity
                      style={[
                        styles.miniActionBtn,
                        isDiblokir ? styles.miniUnlockBtn : styles.miniBanBtn
                      ]}
                      onPress={() => handleToggleBlockSingle(item)}
                      activeOpacity={0.7}
                    >
                      {isDiblokir ? (
                        <Unlock size={11} color="#16a34a" />
                      ) : (
                        <Ban size={11} color="#e11d48" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* =========================================================================
          4. FIXED BOTTOM ACTION BAR (5 TOMBOL SERENTAK, PERSIS GAMBAR 2)
      ========================================================================= */}
      <View style={styles.bottomMassBar}>
        {/* 1. Chat / Pesan Massal */}
        <TouchableOpacity
          style={[styles.massBtn, styles.massChatBtn]}
          onPress={handleOpenBroadcastMsg}
          activeOpacity={0.8}
        >
          <MessageSquare size={22} color="#2563eb" />
        </TouchableOpacity>

        {/* 2. +10 Menit Semua */}
        <TouchableOpacity
          style={[styles.massBtn, styles.massPlusBtn]}
          onPress={() => handleAddTimeGlobal(10)}
          activeOpacity={0.8}
        >
          <PlusCircle size={22} color="#ffffff" />
        </TouchableOpacity>

        {/* 3. Jeda Semua */}
        <TouchableOpacity
          style={[styles.massBtn, styles.massPauseBtn]}
          onPress={handlePauseAllGlobal}
          activeOpacity={0.8}
        >
          <PauseCircle size={22} color="#ffffff" />
        </TouchableOpacity>

        {/* 4. Lanjutkan Semua */}
        <TouchableOpacity
          style={[styles.massBtn, styles.massPlayBtn]}
          onPress={handleResumeAllGlobal}
          activeOpacity={0.8}
        >
          <PlayCircle size={22} color="#ffffff" />
        </TouchableOpacity>

        {/* 5. Hentikan Ujian */}
        <TouchableOpacity
          style={[styles.massBtn, styles.massStopBtn]}
          onPress={handleStopAllGlobal}
          activeOpacity={0.8}
        >
          <Ban size={22} color="#e11d48" />
        </TouchableOpacity>
      </View>

      {/* =========================================================================
          5. MODAL KIRIM PESAN (DIRECT / BROADCAST)
      ========================================================================= */}
      <Modal
        visible={isMsgModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMsgModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={18} color="#231853" />
                <Text style={styles.modalTitleText}>
                  {msgTarget ? `Kirim Pesan ke ${msgTarget.nama}` : 'Kirim Pesan Masal Seluruh Ruangan'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsMsgModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubText}>
              {msgTarget
                ? 'Pesan peringatan akan tampil langsung di layar ujian siswa bersangkutan.'
                : 'Peringatan akan disiarkan ke seluruh perangkat peserta di ruangan ini.'}
            </Text>

            <TextInput
              style={styles.modalTextInput}
              multiline
              numberOfLines={4}
              placeholder="Contoh: Harap tertib, jangan berbicara atau menoleh selama ujian!"
              value={pesanTeks}
              onChangeText={setPesanTeks}
              textAlignVertical="top"
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsMsgModalOpen(false)}
                disabled={sendingMsg}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSendBtn}
                onPress={handleSendMessageSubmit}
                disabled={sendingMsg}
              >
                {sendingMsg ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={15} color="#fff" />
                    <Text style={styles.modalSendBtnText}>Kirim Pesan</Text>
                  </>
                )}
              </TouchableOpacity>
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
    backgroundColor: '#ffffff',
  },

  // 1. Header Dark Purple / Navy
  header: {
    backgroundColor: '#231853',
    paddingTop: Platform.OS === 'ios' ? 48 : 34,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backBtnSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 21,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSubText: {
    fontSize: 12,
    color: '#e2e8f0',
    marginTop: 1.5,
    fontWeight: '500',
  },
  refreshCircleBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  carouselDotsText: {
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 13,
    letterSpacing: 4,
    marginTop: 8,
    fontWeight: 'bold',
  },

  // 2. KPI Cards Bar
  kpiRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  kpiBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBoxTotal: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  kpiBoxAktif: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  kpiBoxSelesai: {
    backgroundColor: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  kpiBoxAnomali: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  kpiLabelText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiValueText: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 1,
  },

  // 3. Student Grid (2 Kolom)
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 24,
  },
  studentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48.8%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // Card Top Row
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 4,
  },
  cardPillCol: {
    flex: 1,
    gap: 3,
  },
  metaPill: {
    backgroundColor: '#64748b',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#cbd5e1',
  },
  avatarCircleLive: {
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  avatarCircleAnomaly: {
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  liveDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    borderWidth: 1,
    borderColor: '#ffffff',
  },

  // Card Middle Section
  cardMiddleSection: {
    position: 'relative',
    paddingTop: 4,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardArchSilhouette: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 0,
    height: 42,
    backgroundColor: '#475569',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  namaPill: {
    width: '92%',
    backgroundColor: '#64748b',
    borderRadius: 10,
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginBottom: 3,
    zIndex: 2,
  },
  namaPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  nipdPill: {
    width: '92%',
    backgroundColor: '#64748b',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignItems: 'center',
    zIndex: 2,
  },
  nipdPillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },

  // Card Bottom Mini Actions (5 Tombol)
  cardBottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  miniActionBtn: {
    padding: 5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniChatBtn: {
    backgroundColor: '#dbeafe',
  },
  miniPlusBtn: {
    backgroundColor: '#bbf7d0',
  },
  miniPauseBtn: {
    backgroundColor: '#fed7aa',
  },
  miniPlayBtn: {
    backgroundColor: '#bbf7d0',
  },
  miniBanBtn: {
    backgroundColor: '#fecdd3',
  },
  miniUnlockBtn: {
    backgroundColor: '#bbf7d0',
  },

  // 4. Fixed Bottom Action Bar (5 Tombol Serentak)
  bottomMassBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 26 : 14,
  },
  massBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  massChatBtn: {
    backgroundColor: '#dbeafe',
  },
  massPlusBtn: {
    backgroundColor: '#00e676',
  },
  massPauseBtn: {
    backgroundColor: '#ff9100',
  },
  massPlayBtn: {
    backgroundColor: '#16a34a',
  },
  massStopBtn: {
    backgroundColor: '#fecdd3',
  },

  // Center Box
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
    fontWeight: '500',
  },

  // 5. Modal Kirim Pesan
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 26,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 16,
  },
  modalTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 90,
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#231853',
  },
  modalSendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
