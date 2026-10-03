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
  Image,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  MessageSquare,
  PlusCircle,
  PauseCircle,
  PlayCircle,
  Ban,
  RotateCcw,
  Lock,
  Unlock,
  X,
  Send,
  Plus,
  Pause,
  Play,
  Users,
  Check,
  Building,
  Clock,
  Search
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../services/supabaseClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 6) / 2;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.42);

export default function UjianAwasi() {
  const insets = useSafeAreaInsets();
  const { jadwalId, ruangId } = useLocalSearchParams<{ jadwalId?: string; ruangId?: string }>();

  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>(jadwalId || '');
  const [selectedJadwal, setSelectedJadwal] = useState<any>(null);

  // Ruangan yang aktif diawasi
  const [currentRuangId, setCurrentRuangId] = useState<string>(ruangId && ruangId !== 'semua' ? ruangId : '');
  const [ruangList, setRuangList] = useState<any[]>([]);
  const [availableRuangTabs, setAvailableRuangTabs] = useState<any[]>([]);
  const [isSwitchRuangModalOpen, setIsSwitchRuangModalOpen] = useState(false);

  // Filter Kelas yang aktif diawasi
  const [selectedKelas, setSelectedKelas] = useState<string>('semua');
  const [isSwitchKelasModalOpen, setIsSwitchKelasModalOpen] = useState(false);

  // Pencarian nama / NISN siswa
  const [searchQuery, setSearchQuery] = useState('');

  const [sesiList, setSesiList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Live Video Feed Siswa (Realtime stream)
  const [liveVideoFeeds, setLiveVideoFeeds] = useState<Record<string, any>>({});
  const [studentPresence, setStudentPresence] = useState<Record<string, any>>({});
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

  // Modal Tambah Waktu Ujian Dinamis
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [timeTargetStudent, setTimeTargetStudent] = useState<any>(null); // null = seluruh siswa aktif
  const [inputMinutes, setInputMinutes] = useState('10');

  useEffect(() => {
    fetchJadwalList();
  }, []);

  useEffect(() => {
    if (selectedJadwalId) {
      fetchSesiData(selectedJadwalId, currentRuangId);
      const cleanup = setupRealtime(selectedJadwalId);
      return cleanup;
    }
  }, [selectedJadwalId, currentRuangId]);

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
      setSelectedJadwalId(String(chosen));
      if (data) {
        setSelectedJadwal(data.find((j: any) => String(j.id) === String(chosen)) || null);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal memuat jadwal ujian.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logika Penentuan Ruangan Siswa (Sesuai instruksi):
   * 1. Cek terlebih dahulu ke pengaturan ruang ujian pada halaman jadwal ujian (cbt_peserta_ruang).
   * 2. Untuk pengaturan ruangan default: mengecek kelas siswa (data_siswa.kelas),
   *    sesuaikan ruangannya dengan melihat data kelas pada database (data_kelas.ruang_id).
   * 3. Tampilkan siswanya pada ruangan pada halaman pengawasan tersebut.
   */
  const fetchSesiData = async (jId: string, targetRuangId?: string) => {
    try {
      const activeRId = targetRuangId !== undefined ? targetRuangId : currentRuangId;

      const [jadwalRes, ruangRes, kelasRes, pRuangRes, siswaRes, sesiRes] = await Promise.all([
        supabase
          .from('cbt_jadwal_ujian')
          .select(`
            *,
            data_mapel(nama_mapel),
            data_kelas(id, nama_kelas),
            data_ruang(id, nama_ruang),
            pengawas:data_guru!cbt_jadwal_ujian_pengawas_guru_id_fkey(nama)
          `)
          .eq('id', jId)
          .single(),
        supabase.from('data_ruang').select('id, nama_ruang, kode_ruang').order('id'),
        supabase.from('data_kelas').select('id, nama_kelas, ruang_id, data_ruang(nama_ruang)').order('id'),
        supabase.from('cbt_peserta_ruang').select('siswa_id, ruang_id, nomor_meja, data_ruang(nama_ruang)').eq('jadwal_id', jId),
        supabase.from('data_siswa').select('id, nama, nipd, nisn, kelas, foto_url, status_keaktifan').eq('status_keaktifan', 'Aktif').neq('kelas', 'Calon Siswa').order('nama'),
        supabase.from('cbt_sesi_siswa').select('*').eq('jadwal_id', jId)
      ]);

      const currentJadwal = jadwalRes.data;
      setSelectedJadwal(currentJadwal);

      const rList = ruangRes.data || [];
      setRuangList(rList);
      const ruangMap: Record<string, string> = {};
      rList.forEach((r: any) => {
        ruangMap[String(r.id)] = r.nama_ruang;
      });

      const kList = kelasRes.data || [];
      const kelasMap: Record<string, { ruang_id: number; ruang_nama: string }> = {};
      kList.forEach((k: any) => {
        if (k.nama_kelas) {
          kelasMap[k.nama_kelas.trim().toLowerCase()] = {
            ruang_id: k.ruang_id,
            ruang_nama: k.data_ruang?.nama_ruang || ruangMap[String(k.ruang_id)] || `Ruang ${k.ruang_id}`
          };
        }
      });

      let pRuangData = pRuangRes.data || [];

      // Fallback: Jika jadwal ini belum memiliki entri cbt_peserta_ruang tersendiri,
      // gunakan alokasi ruang peserta terakhir yang sudah pernah disimpan di jadwal lain
      if (!pRuangData || pRuangData.length === 0) {
        const { data: latestPR } = await supabase
          .from('cbt_peserta_ruang')
          .select('jadwal_id')
          .order('id', { ascending: false })
          .limit(1);

        if (latestPR && latestPR.length > 0) {
          const fallbackJId = latestPR[0].jadwal_id;
          const { data: fbData } = await supabase
            .from('cbt_peserta_ruang')
            .select('siswa_id, ruang_id, nomor_meja, data_ruang(nama_ruang)')
            .eq('jadwal_id', fallbackJId);

          if (fbData && fbData.length > 0) {
            pRuangData = fbData;
          }
        }
      }

      const pRuangMap: Record<string, { ruang_id: number; nomor_meja?: number; ruang_nama: string }> = {};
      pRuangData.forEach((p: any) => {
        pRuangMap[String(p.siswa_id)] = {
          ruang_id: p.ruang_id,
          nomor_meja: p.nomor_meja,
          ruang_nama: p.data_ruang?.nama_ruang || ruangMap[String(p.ruang_id)] || `Ruang ${p.ruang_id}`
        };
      });

      const allActiveSiswa = siswaRes.data || [];

      // Helper Smart Ruang Matcher jika tidak ada di data_kelas langsung
      const getSmartRuang = (sKelas: string) => {
        const kLower = (sKelas || '').trim().toLowerCase();
        if (kLower.includes('vii') || kLower.startsWith('7')) {
          const r7 = rList.find((r: any) => r.nama_ruang.toLowerCase().includes('7') || r.nama_ruang.toLowerCase().includes('vii'));
          if (r7) return { id: r7.id, nama_ruang: r7.nama_ruang };
        }
        if (kLower.includes('viii') || kLower.startsWith('8')) {
          const r8 = rList.find((r: any) => r.nama_ruang.toLowerCase().includes('8') || r.nama_ruang.toLowerCase().includes('viii'));
          if (r8) return { id: r8.id, nama_ruang: r8.nama_ruang };
        }
        if (kLower.includes('ix') || kLower.startsWith('9')) {
          const r9 = rList.find((r: any) => r.nama_ruang.toLowerCase().includes('9') || r.nama_ruang.toLowerCase().includes('ix'));
          if (r9) return { id: r9.id, nama_ruang: r9.nama_ruang };
        }
        return { id: currentJadwal?.ruang_id || 1, nama_ruang: currentJadwal?.data_ruang?.nama_ruang || 'Ruang CBT' };
      };

      // Jika cbt_peserta_ruang memiliki data → jadikan source of truth mutlak (lepas dari kelas_id)
      // Hanya siswa yang terdaftar di pengaturan ruang yang ditampilkan.
      // Jika tidak ada → fallback ke logika kelas / heuristik.
      const hasPesertaRuang = pRuangData && pRuangData.length > 0;
      const targetSiswaList = hasPesertaRuang
        ? allActiveSiswa.filter((sw: any) => !!pRuangMap[String(sw.id)])
        : allActiveSiswa;

      // distinctRuangMap dipakai sebagai fallback saat tidak ada pengaturan ruang
      const distinctRuangMap = new Map<string, { id: string; nama: string; count: number }>();

      const mappedSiswa = targetSiswaList.map((sw: any) => {
        const pAlloc = pRuangMap[String(sw.id)];
        let finalRuangId: number | string = '';
        let finalRuangNama: string = '';

        // 1. Pengecekan terlebih dahulu ke pengaturan ruang ujian (cbt_peserta_ruang)
        if (pAlloc) {
          finalRuangId = pAlloc.ruang_id;
          finalRuangNama = pAlloc.ruang_nama;
        } else {
          // 2. Default: mengecek kelas siswa, sesuaikan ruangannya dengan melihat data_kelas pada database
          const sKelas = (sw.kelas || '').trim().toLowerCase();
          const kInfo = kelasMap[sKelas];
          if (kInfo && kInfo.ruang_id) {
            finalRuangId = kInfo.ruang_id;
            finalRuangNama = kInfo.ruang_nama;
          } else {
            const smart = getSmartRuang(sw.kelas);
            finalRuangId = smart.id;
            finalRuangNama = smart.nama_ruang;
          }
        }

        const rKey = String(finalRuangId);
        if (!distinctRuangMap.has(rKey)) {
          distinctRuangMap.set(rKey, { id: rKey, nama: finalRuangNama, count: 1 });
        } else {
          const item = distinctRuangMap.get(rKey)!;
          item.count += 1;
        }

        return {
          ...sw,
          ruang_id: finalRuangId,
          ruang_nama: finalRuangNama,
        };
      });

      // Kelompokkan siswa berdasarkan ruangan dan urutkan sesuai abjad nama siswa (A-Z)
      // Nomor meja dibedakan per ruangan, mulai dari 1 untuk setiap ruangan
      const siswaByRuang: Record<string, any[]> = {};
      mappedSiswa.forEach((sw: any) => {
        const rKey = String(sw.ruang_id);
        if (!siswaByRuang[rKey]) siswaByRuang[rKey] = [];
        siswaByRuang[rKey].push(sw);
      });

      const siswaWithNomorMeja: any[] = [];
      Object.keys(siswaByRuang).forEach((rKey) => {
        const listInRuang = siswaByRuang[rKey];
        listInRuang.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        listInRuang.forEach((sw, idx) => {
          sw.nomor_meja = idx + 1;
          siswaWithNomorMeja.push(sw);
        });
      });

      // Bangun daftar tab ruangan aktif
      // Jika ada pengaturan ruang → urutkan tab sesuai urutan ruang di cbt_peserta_ruang
      let orderedRuangEntries: { id: string; nama: string; count: number }[];
      if (hasPesertaRuang) {
        // Urutan sesuai kemunculan ruang di pRuangData (sesuai pengaturan ruang di jadwal)
        const orderedRuangMap = new Map<string, { id: string; nama: string; count: number }>();
        pRuangData.forEach((p: any) => {
          const key = String(p.ruang_id);
          if (!orderedRuangMap.has(key)) {
            const nama = p.data_ruang?.nama_ruang || ruangMap[String(p.ruang_id)] || `Ruang ${p.ruang_id}`;
            const count = siswaWithNomorMeja.filter((sw: any) => String(sw.ruang_id) === key).length;
            orderedRuangMap.set(key, { id: key, nama, count });
          }
        });
        orderedRuangEntries = Array.from(orderedRuangMap.values());
      } else {
        orderedRuangEntries = Array.from(distinctRuangMap.values());
      }

      const tabs = orderedRuangEntries;
      setAvailableRuangTabs(tabs);

      // Pastikan ruangan yang diawasi adalah ruangan spesifik (bukan 'semua' yang berat)
      let effectiveRId = activeRId;
      if ((!effectiveRId || effectiveRId === 'semua' || effectiveRId === 'all') && orderedRuangEntries.length > 0) {
        effectiveRId = orderedRuangEntries[0].id;
        setCurrentRuangId(effectiveRId);
      }

      // Sesi siswa
      const sesiData = sesiRes.data || [];
      const sesiMap: Record<string, any> = {};
      sesiData.forEach((s: any) => {
        sesiMap[s.siswa_id] = s;
      });

      // Filter siswa hanya untuk ruangan yang sedang diawasi (ringan & cepat)
      let filteredSiswa = siswaWithNomorMeja;
      if (effectiveRId && effectiveRId !== 'semua' && effectiveRId !== 'all') {
        filteredSiswa = siswaWithNomorMeja.filter((s: any) => String(s.ruang_id) === String(effectiveRId));
      }

      // Gabungkan dengan data sesi pengerjaan
      const combined = filteredSiswa.map((sw: any) => {
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
          ruang_id: sw.ruang_id,
          ruang_nama: sw.ruang_nama,
          sesi: existingSesi || null,
          status: existingSesi?.status || 'belum_mulai',
          sisa_detik: existingSesi?.sisa_detik ?? (currentJadwal?.durasi_menit || 90) * 60,
          total_pelanggaran: existingSesi?.total_pelanggaran || 0
        };
      });

      // Urutkan daftar sesi: jika satu ruangan urutkan nomor meja (1..N); jika semua ruangan urutkan nama ruangan lalu nomor meja
      combined.sort((a, b) => {
        if (String(a.ruang_id) !== String(b.ruang_id)) {
          return String(a.ruang_nama || '').localeCompare(String(b.ruang_nama || ''));
        }
        return (a.nomor_meja || 0) - (b.nomor_meja || 0);
      });

      setSesiList(combined);
    } catch (e: any) {
      console.error('Error fetchSesiData:', e);
      Alert.alert('Error', e.message || 'Gagal memuat data pengawasan.');
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
          fetchSesiData(jId, currentRuangId);
        }
      )
      .subscribe();

    const examChannel = supabase
      .channel(`cbt_exam_${jId}`)
      .on('broadcast', { event: 'student_video_feed' }, ({ payload }: any) => {
        if (payload?.siswaId) {
          const now = Date.now();
          if (payload.image) {
            setLiveVideoFeeds((prev) => ({
              ...prev,
              [payload.siswaId]: {
                image: payload.image,
                timestamp: payload.timestamp || now,
                faceStatus: payload.faceStatus || 'normal',
              },
            }));
          }
          setStudentPresence((prev) => ({
            ...prev,
            [payload.siswaId]: {
              timestamp: payload.timestamp || now,
              isOpen: payload.isOpen !== false,
              sisaDetik: payload.sisaDetik,
              lastUpdatedTs: now,
            },
          }));
        }
      })
      .on('broadcast', { event: 'student_presence' }, ({ payload }: any) => {
        if (payload?.siswaId) {
          const now = Date.now();
          setStudentPresence((prev) => ({
            ...prev,
            [payload.siswaId]: {
              timestamp: payload.timestamp || now,
              isOpen: payload.isOpen !== false,
              sisaDetik: payload.sisaDetik,
              lastUpdatedTs: now,
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

  // Helper mengecek siswa sedang aktif membuka layar ujian
  const isStudentPageOpen = (siswaId: any) => {
    const presence = studentPresence[String(siswaId)];
    if (!presence) return false;
    if (presence.isOpen === false) return false;
    return (nowTs - (presence.timestamp || 0)) < 10000;
  };

  // Helper sisa waktu berjalan dengan detik realtime
  const getLiveSisaDetik = (item: any) => {
    const presence = studentPresence[String(item.id)];
    if (presence?.sisaDetik !== undefined && presence.lastUpdatedTs) {
      if (item.status === 'mengerjakan') {
        const elapsed = Math.floor((nowTs - presence.lastUpdatedTs) / 1000);
        return Math.max(0, presence.sisaDetik - elapsed);
      }
      return presence.sisaDetik;
    }
    return item.sisa_detik || 0;
  };

  // Helper format detik ke MM:SS atau HH:MM:SS
  const formatTimeWithSeconds = (totalSeconds: number) => {
    if (totalSeconds === undefined || totalSeconds === null || totalSeconds < 0) return '00:00';
    const total = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  };

  // Buka Modal Tambah Waktu
  const handleOpenAddTimeModal = (student: any = null) => {
    setTimeTargetStudent(student);
    setInputMinutes('10');
    setIsTimeModalOpen(true);
  };

  const handleTimeSubmit = async () => {
    const mins = parseInt(inputMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert('Peringatan', 'Masukkan jumlah menit yang valid (minimal 1 menit).');
      return;
    }
    setIsTimeModalOpen(false);
    if (timeTargetStudent) {
      await handleAddTimeSingle(timeTargetStudent, mins);
    } else {
      await handleAddTimeGlobal(mins);
    }
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
      fetchSesiData(selectedJadwalId, currentRuangId);
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
      fetchSesiData(selectedJadwalId, currentRuangId);
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
      fetchSesiData(selectedJadwalId, currentRuangId);
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    }
  };

  // 5. Force Selesai Single
  const handleForceStopSingle = (student: any) => {
    if (!student?.sesi?.id) {
      Alert.alert('Info', 'Siswa belum memulai sesi ujian.');
      return;
    }
    Alert.alert(
      'Hentikan Ujian?',
      `Apakah Anda yakin ingin memaksa selesai ujian untuk ${student.nama}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Selesaikan',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('cbt_sesi_siswa')
                .update({ status: 'selesai' })
                .eq('id', student.sesi.id);
              if (error) throw error;
              Alert.alert('Sukses', `Ujian ${student.nama} telah dihentikan.`);
              fetchSesiData(selectedJadwalId, currentRuangId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // 5a. Mulai Lagi Ujian Single (untuk yang sudah selesai)
  const handleRestartSingle = (student: any) => {
    if (!student?.sesi?.id) {
      Alert.alert('Info', 'Siswa belum memiliki sesi ujian.');
      return;
    }
    Alert.alert(
      'Mulai Lagi Ujian?',
      `Apakah Anda yakin ingin mengizinkan ${student.nama} untuk melanjutkan ujian kembali?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Mulai Lagi',
          onPress: async () => {
            try {
              const updateData: any = {
                status: 'mengerjakan',
                waktu_selesai: null,
              };
              if (!student.sesi.sisa_detik || student.sesi.sisa_detik <= 0) {
                updateData.sisa_detik = (selectedJadwal?.durasi_menit || 90) * 60;
              }

              const { error } = await supabase
                .from('cbt_sesi_siswa')
                .update(updateData)
                .eq('id', student.sesi.id);

              if (error) throw error;
              Alert.alert('Sukses', `Ujian ${student.nama} berhasil diaktifkan kembali.`);
              fetchSesiData(selectedJadwalId, currentRuangId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          },
        },
      ]
    );
  };

  // 5b. Blokir / Buka Blokir Single
  const handleToggleBlockSingle = (student: any) => {
    if (!student?.sesi?.id) {
      Alert.alert('Info', 'Siswa belum memulai sesi ujian.');
      return;
    }

    const isBlocked = student.sesi.status === 'diblokir' || student.status === 'diblokir';

    Alert.alert(
      isBlocked ? 'Buka Blokir Siswa?' : 'Blokir Sesi Siswa?',
      isBlocked
        ? `Izinkan ${student.nama} untuk melanjutkan ujian kembali?`
        : `Siswa ${student.nama} akan diblokir dari lembar ujian.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: isBlocked ? 'Ya, Buka Blokir' : 'Ya, Blokir Siswa',
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('cbt_sesi_siswa')
                .update({ status: isBlocked ? 'mengerjakan' : 'diblokir' })
                .eq('id', student.sesi.id);
              if (error) throw error;
              Alert.alert(
                'Sukses',
                isBlocked
                  ? `Blokir ${student.nama} telah dibuka.`
                  : `Siswa ${student.nama} berhasil diblokir.`
              );
              fetchSesiData(selectedJadwalId, currentRuangId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          },
        },
      ]
    );
  };

  // Daftar kelas unik dari sesi
  const availableKelasList = React.useMemo(() => {
    const classes = Array.from(new Set(sesiList.map((s) => s.kelas).filter(Boolean))).sort();
    return ['semua', ...classes];
  }, [sesiList]);

  // Reset filter kelas jika kelas terpilih tidak ada di ruangan yang baru dipilih
  React.useEffect(() => {
    if (selectedKelas !== 'semua' && !availableKelasList.includes(selectedKelas)) {
      setSelectedKelas('semua');
    }
  }, [availableKelasList, selectedKelas]);

  // Filter siswa pengerjaan sesuai ruangan, kelas aktif, dan pencarian nama/NISN
  const filteredSesiList = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sesiList.filter((s) => {
      if (selectedKelas && selectedKelas !== 'semua' && s.kelas !== selectedKelas) {
        return false;
      }
      if (q) {
        const nama = (s.nama || s.nama_lengkap || '').toLowerCase();
        const nisn = (s.nisn || '').toLowerCase();
        const nipd = (s.nipd || '').toLowerCase();
        const meja = String(s.nomor_meja || '');
        if (!nama.includes(q) && !nisn.includes(q) && !nipd.includes(q) && meja !== q) {
          return false;
        }
      }
      return true;
    });
  }, [sesiList, selectedKelas, searchQuery]);

  // Penentuan nama ruangan yang tampil pada header
  const getSelectedRuangNama = () => {
    if (currentRuangId === 'semua' || currentRuangId === 'all') return 'Semua Ruangan';
    const foundR = ruangList.find(r => String(r.id) === String(currentRuangId));
    if (foundR) return foundR.nama_ruang;
    const foundTab = availableRuangTabs.find(t => String(t.id) === String(currentRuangId));
    if (foundTab) return foundTab.nama;
    return selectedJadwal?.data_ruang?.nama_ruang || 'Kelas 7';
  };

  const currentRuangNama = getSelectedRuangNama();
  const getActiveFilterLabel = () => {
    let label = currentRuangNama;
    if (selectedKelas !== 'semua') {
      label = `${selectedKelas} (${currentRuangNama})`;
    }
    if (searchQuery.trim()) {
      label += ` • Cari: "${searchQuery.trim()}"`;
    }
    return label;
  };

  // ==========================================
  // TINDAKAN SERENTAK / MASSAL (BOTTOM BAR)
  // Berlaku khusus untuk siswa yang ada dalam filter aktif
  // ==========================================

  // 1. Pesan Massal
  const handleOpenBroadcastMsg = () => {
    setMsgTarget(null);
    setPesanTeks('');
    setIsMsgModalOpen(true);
  };

  // 2. Tambah Waktu Semua (+10 Menit)
  const handleAddTimeGlobal = async (menit = 10) => {
    const activeSessions = filteredSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');
    if (activeSessions.length === 0) {
      Alert.alert('Info', `Tidak ada siswa yang sedang aktif ujian pada filter "${getActiveFilterLabel()}".`);
      return;
    }

    Alert.alert(
      `Tambah Waktu +${menit} Menit?`,
      `Waktu untuk ${activeSessions.length} siswa aktif pada filter "${getActiveFilterLabel()}" akan ditambah ${menit} menit.`,
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
              Alert.alert('Sukses', `+${menit} menit berhasil ditambahkan ke ${activeSessions.length} siswa (${getActiveFilterLabel()}).`);
              fetchSesiData(selectedJadwalId, currentRuangId);
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
    const activeSessions = filteredSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');
    if (activeSessions.length === 0) {
      Alert.alert('Info', `Tidak ada siswa yang sedang aktif ujian pada filter "${getActiveFilterLabel()}" untuk dijeda.`);
      return;
    }

    Alert.alert(
      'Jeda Seluruh Ujian di Filter?',
      `${activeSessions.length} siswa pada filter "${getActiveFilterLabel()}" akan dijeda pengerjaannya serentak.`,
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
              Alert.alert('Sukses', `Ujian untuk ${activeSessions.length} siswa (${getActiveFilterLabel()}) berhasil dijeda.`);
              fetchSesiData(selectedJadwalId, currentRuangId);
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
    const pausedSessions = filteredSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'dijeda');
    if (pausedSessions.length === 0) {
      Alert.alert('Info', `Tidak ada siswa dalam status dijeda pada filter "${getActiveFilterLabel()}".`);
      return;
    }

    Alert.alert(
      'Lanjutkan Seluruh Ujian di Filter?',
      `${pausedSessions.length} siswa pada filter "${getActiveFilterLabel()}" akan dilanjutkan kembali ujiannya.`,
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
              Alert.alert('Sukses', `Ujian untuk ${pausedSessions.length} siswa (${getActiveFilterLabel()}) berhasil dilanjutkan kembali.`);
              fetchSesiData(selectedJadwalId, currentRuangId);
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
    const activeSessions = filteredSesiList.filter(s => s.sesi?.id && (s.sesi?.status === 'mengerjakan' || s.sesi?.status === 'dijeda'));
    if (activeSessions.length === 0) {
      Alert.alert('Info', `Tidak ada siswa yang sedang aktif ujian pada filter "${getActiveFilterLabel()}".`);
      return;
    }

    Alert.alert(
      'Hentikan Seluruh Ujian di Filter?',
      `Sesi ujian untuk ${activeSessions.length} siswa pada filter "${getActiveFilterLabel()}" akan dipaksa selesai dan jawaban dikunci.`,
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
              Alert.alert('Selesai', `Ujian telah dihentikan untuk ${activeSessions.length} peserta (${getActiveFilterLabel()}).`);
              fetchSesiData(selectedJadwalId, currentRuangId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // 6. Blokir Semua Siswa
  const handleBlockAllGlobal = async () => {
    const activeSessions = filteredSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');
    if (activeSessions.length === 0) {
      Alert.alert('Info', `Tidak ada siswa yang sedang aktif ujian pada filter "${getActiveFilterLabel()}" untuk diblokir.`);
      return;
    }

    Alert.alert(
      'Blokir Seluruh Siswa Aktif di Filter?',
      `${activeSessions.length} siswa aktif pada filter "${getActiveFilterLabel()}" akan diblokir dari lembar pengerjaan soal.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Blokir Semua',
          style: 'destructive',
          onPress: async () => {
            try {
              const promises = activeSessions.map(s =>
                supabase.from('cbt_sesi_siswa').update({ status: 'diblokir' }).eq('id', s.sesi.id)
              );
              await Promise.all(promises);
              Alert.alert('Sukses', `${activeSessions.length} siswa aktif (${getActiveFilterLabel()}) telah diblokir.`);
              fetchSesiData(selectedJadwalId, currentRuangId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // 6b. Buka Blokir Semua Siswa
  const handleUnblockAllGlobal = async () => {
    const blockedSessions = filteredSesiList.filter(s => s.sesi?.id && (s.sesi?.status === 'diblokir' || s.status === 'diblokir'));
    if (blockedSessions.length === 0) {
      Alert.alert('Info', `Tidak ada siswa berstatus diblokir pada filter "${getActiveFilterLabel()}".`);
      return;
    }

    Alert.alert(
      'Buka Blokir Seluruh Siswa?',
      `${blockedSessions.length} siswa pada filter "${getActiveFilterLabel()}" akan dibuka blokirnya dan dapat melanjutkan ujian.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Buka Blokir Semua',
          onPress: async () => {
            try {
              const promises = blockedSessions.map(s =>
                supabase.from('cbt_sesi_siswa').update({ status: 'mengerjakan' }).eq('id', s.sesi.id)
              );
              await Promise.all(promises);
              Alert.alert('Sukses', `Blokir untuk ${blockedSessions.length} siswa (${getActiveFilterLabel()}) telah dibuka.`);
              fetchSesiData(selectedJadwalId, currentRuangId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // 7. Mulai Lagi Ujian Seluruh Siswa Selesai
  const handleRestartAllGlobal = async () => {
    const finishedSessions = filteredSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'selesai');
    if (finishedSessions.length === 0) {
      Alert.alert('Info', `Tidak ada siswa yang berstatus 'selesai' pada filter "${getActiveFilterLabel()}".`);
      return;
    }

    Alert.alert(
      'Mulai Lagi Ujian Seluruh Siswa Selesai?',
      `${finishedSessions.length} siswa yang telah selesai pada filter "${getActiveFilterLabel()}" akan diizinkan memulai/melanjutkan ujian kembali.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Mulai Lagi Semua',
          onPress: async () => {
            try {
              const durationSecs = (selectedJadwal?.durasi_menit || 90) * 60;
              const promises = finishedSessions.map(s => {
                const sisa = (!s.sesi?.sisa_detik || s.sesi?.sisa_detik <= 0) ? durationSecs : s.sesi.sisa_detik;
                return supabase.from('cbt_sesi_siswa').update({
                  status: 'mengerjakan',
                  waktu_selesai: null,
                  sisa_detik: sisa,
                }).eq('id', s.sesi.id);
              });
              await Promise.all(promises);
              Alert.alert('Sukses', `Ujian untuk ${finishedSessions.length} peserta telah diaktifkan kembali.`);
              fetchSesiData(selectedJadwalId, currentRuangId);
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          }
        }
      ]
    );
  };

  // Composite Tombol Utama #3: Toggle Jeda / Lanjutkan Semua
  const handleTogglePauseAllGlobal = () => {
    const pausedSessions = filteredSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'dijeda');
    const runningSessions = filteredSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');

    if (pausedSessions.length > 0 && runningSessions.length === 0) {
      handleResumeAllGlobal();
    } else if (runningSessions.length > 0 && pausedSessions.length === 0) {
      handlePauseAllGlobal();
    } else if (pausedSessions.length > 0 && runningSessions.length > 0) {
      Alert.alert(
        'Kontrol Jeda / Lanjutkan',
        `Terdapat ${runningSessions.length} siswa mengerjakan dan ${pausedSessions.length} siswa dijeda.`,
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Jeda Semua Aktif', onPress: handlePauseAllGlobal },
          { text: 'Lanjutkan Semua Dijeda', onPress: handleResumeAllGlobal },
        ]
      );
    } else {
      Alert.alert('Info', `Tidak ada siswa yang sedang aktif atau dijeda pada filter "${getActiveFilterLabel()}".`);
    }
  };

  // Composite Tombol Utama #4: Toggle Blokir / Buka Blokir Semua
  const handleToggleBlockAllGlobal = () => {
    const blockedSessions = filteredSesiList.filter(s => s.sesi?.id && (s.sesi?.status === 'diblokir' || s.status === 'diblokir'));
    const activeSessions = filteredSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'mengerjakan');

    if (blockedSessions.length > 0 && activeSessions.length === 0) {
      handleUnblockAllGlobal();
    } else if (activeSessions.length > 0 && blockedSessions.length === 0) {
      handleBlockAllGlobal();
    } else if (blockedSessions.length > 0 && activeSessions.length > 0) {
      Alert.alert(
        'Kontrol Blokir / Buka Blokir',
        `Terdapat ${activeSessions.length} siswa aktif dan ${blockedSessions.length} siswa diblokir.`,
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Buka Blokir Semua', onPress: handleUnblockAllGlobal },
          { text: 'Blokir Semua Aktif', style: 'destructive', onPress: handleBlockAllGlobal },
        ]
      );
    } else {
      Alert.alert('Info', `Tidak ada siswa yang aktif atau diblokir pada filter "${getActiveFilterLabel()}".`);
    }
  };

  // Composite Tombol Utama #5: Hentikan / Mulai Lagi Semua
  const handleStopOrRestartAllGlobal = () => {
    const finishedSessions = filteredSesiList.filter(s => s.sesi?.id && s.sesi?.status === 'selesai');
    const runningSessions = filteredSesiList.filter(s => s.sesi?.id && (s.sesi?.status === 'mengerjakan' || s.sesi?.status === 'dijeda'));

    if (finishedSessions.length > 0 && runningSessions.length === 0) {
      handleRestartAllGlobal();
    } else if (runningSessions.length > 0 && finishedSessions.length === 0) {
      handleStopAllGlobal();
    } else if (runningSessions.length > 0 && finishedSessions.length > 0) {
      Alert.alert(
        'Kontrol Selesai / Mulai Lagi',
        `Terdapat ${runningSessions.length} siswa aktif dan ${finishedSessions.length} siswa selesai.`,
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Hentikan Semua Aktif', style: 'destructive', onPress: handleStopAllGlobal },
          { text: 'Mulai Lagi yang Selesai', onPress: handleRestartAllGlobal },
        ]
      );
    } else {
      Alert.alert('Info', `Tidak ada siswa yang aktif atau selesai pada filter "${getActiveFilterLabel()}".`);
    }
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
        // Kirim ke siswa tunggal
        await supabase
          .from('cbt_sesi_siswa')
          .update({ pesan_pengawas: pesanTeks.trim() })
          .eq('id', msgTarget.sesi.id);
        Alert.alert('Terkirim', `Pesan berhasil dikirim ke ${msgTarget.nama}.`);
      } else {
        // Kirim massal khusus ke siswa dalam filter aktif
        const sessionIds = filteredSesiList.map(s => s.sesi?.id).filter(Boolean);
        if (sessionIds.length > 0) {
          const promises = sessionIds.map(id =>
            supabase.from('cbt_sesi_siswa').update({ pesan_pengawas: pesanTeks.trim() }).eq('id', id)
          );
          await Promise.all(promises);
        }
        Alert.alert('Terkirim', `Pesan masal telah disiarkan ke ${sessionIds.length} peserta (${getActiveFilterLabel()}).`);
      }
      setIsMsgModalOpen(false);
      setPesanTeks('');
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    } finally {
      setSendingMsg(false);
    }
  };

  // Statistik Ringkasan (KPIs) berdasarkan filter aktif
  const totalSiswa = filteredSesiList.length;
  const mengerjakanCount = filteredSesiList.filter(s => s.status === 'mengerjakan' && isStudentPageOpen(s.id)).length;
  const selesaiCount = filteredSesiList.filter(s => s.status === 'selesai').length;
  const diblokirCount = filteredSesiList.filter(s => s.status === 'diblokir').length;

  return (
    <View style={styles.container}>
      {/* =========================================================================
          1. HEADER DARK INDIGO (PERSIS GAMBAR REFERENSI)
      ========================================================================= */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {/* Tombol Back Kotak Rounded Transparan */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnSquare} activeOpacity={0.8}>
            <ChevronLeft color="#ffffff" size={26} />
          </TouchableOpacity>

          {/* Info Judul & Meta Pengawasan */}
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {selectedJadwal?.nama_ujian || 'PSTS IPA Ganjil'}
            </Text>

            {/* Nama Ruang - Otomatis terupdate dari filter yang aktif di halaman */}
            <Text style={styles.headerSubText} numberOfLines={1}>
              Ruang: {currentRuangNama}
            </Text>

            <Text style={styles.headerSubText} numberOfLines={1}>
              Mata Ujian: {selectedJadwal?.data_mapel?.nama_mapel || 'Ilmu Pengetahuan Alam'}
            </Text>
            <Text style={styles.headerSubText} numberOfLines={1}>
              Pengawas: {selectedJadwal?.pengawas?.nama || 'Muhamad Nadiri'}
            </Text>
          </View>
        </View>
      </View>

      {/* =========================================================================
          2. KPI CARDS BAR (TOTAL, AKTIF, SELESAI, TERBLOKIR) (PERSIS GAMBAR)
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

        {/* TERBLOKIR */}
        <View style={[styles.kpiBox, styles.kpiBoxAnomali]}>
          <Text style={[styles.kpiLabelText, { color: '#dc2626' }]}>TERBLOKIR</Text>
          <Text style={[styles.kpiValueText, { color: '#dc2626' }]}>{diblokirCount}</Text>
        </View>
      </View>

      {/* FILTER RUANG, KELAS & PENCARIAN NAMA (PERSIS VERSI WEB APP) */}
      <View style={styles.filtersWrapper}>
        <View style={styles.dropdownRow}>
          {/* Dropdown Ruang */}
          <TouchableOpacity
            style={styles.filterDropdownBtn}
            onPress={() => setIsSwitchRuangModalOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.filterBtnContent}>
              <Building size={14} color="#059669" />
              <Text style={styles.filterDropdownText} numberOfLines={1}>
                {currentRuangNama}
              </Text>
            </View>
            <ChevronDown size={14} color="#64748b" />
          </TouchableOpacity>

          {/* Dropdown Kelas */}
          <TouchableOpacity
            style={styles.filterDropdownBtn}
            onPress={() => setIsSwitchKelasModalOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.filterBtnContent}>
              <Users size={14} color="#059669" />
              <Text style={styles.filterDropdownText} numberOfLines={1}>
                {selectedKelas === 'semua' ? 'Semua Kelas' : `Kelas ${selectedKelas}`}
              </Text>
            </View>
            <ChevronDown size={14} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Pencarian Nama Siswa / NISN */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={15} color="#94a3b8" style={{ marginRight: 6 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari nama siswa / NISN..."
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.searchClearBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={14} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.searchResetBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.searchResetBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* =========================================================================
          3. GRID MULTI-CARD PENGAWASAN 2 KOLOM (PERSIS GAMBAR REFERENSI)
             - Foto profil atau live video streaming menjalar sebagai latar penuh (Layer 0)
             - Overlay Kelas & No. Meja (Kiri Atas)
             - Overlay Status Ujian & Waktu (Kanan Atas)
             - Overlay Nama Siswa & NISN/NIPD (Bawah)
             - 5 Tombol Aksi Mini (Bawah Card)
      ========================================================================= */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#231853" />
          <Text style={styles.loadingText}>Memuat ruang monitor pengawas...</Text>
        </View>
      ) : filteredSesiList.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginHorizontal: 20 }}>
            {searchQuery.trim()
              ? `Tidak ada siswa yang cocok dengan pencarian "${searchQuery}".`
              : `Tidak ada siswa pada filter ini (${getActiveFilterLabel()}).`}
          </Text>
          <TouchableOpacity
            style={styles.switchRoomPromptBtn}
            onPress={() => {
              setSelectedKelas('semua');
              setSearchQuery('');
              setIsSwitchRuangModalOpen(true);
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>Reset Filter / Pilih Ruangan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 130 + Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchSesiData(selectedJadwalId, currentRuangId);
              }}
              colors={['#231853']}
            />
          }
        >
          <View style={styles.studentGrid}>
            {filteredSesiList.map((item) => {
              const isMengerjakan = item.status === 'mengerjakan';
              const isSelesai = item.status === 'selesai';
              const isDijeda = item.status === 'dijeda';
              const isDiblokir = item.status === 'diblokir';
              const isPageOpen = isStudentPageOpen(item.id);
              const isAktif = isMengerjakan && isPageOpen;

              const statusLabel = isAktif
                ? 'Mengerjakan'
                : isSelesai
                ? 'Selesai'
                : isDijeda
                ? 'Dijeda'
                : isDiblokir
                ? 'Diblokir'
                : isMengerjakan
                ? 'Tidak Aktif'
                : 'Belum Mulai';

              const liveSisa = getLiveSisaDetik(item);
              const waktuLabel = item.sesi?.id ? formatTimeWithSeconds(liveSisa) : 'Waktu';

              const liveFeed = liveVideoFeeds[item.id];
              const isFeedRecent = liveFeed?.timestamp && (nowTs - liveFeed.timestamp < 15000);
              const hasLiveVideo = Boolean(liveFeed?.image && isFeedRecent);

              return (
                <View key={item.id} style={styles.cardContainer}>
                  {/* ── LAYER 0: Background Penuh (Live Video atau Foto Profil Siswa) ── */}
                  {hasLiveVideo ? (
                    <Image
                      source={{ uri: liveFeed.image }}
                      style={styles.cardFullBg}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                  ) : item.foto_url ? (
                    <Image
                      source={{ uri: item.foto_url }}
                      style={styles.cardFullBg}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                  ) : (
                    <View style={styles.cardFullPlaceholder}>
                      <Users size={52} color="#64748b" />
                    </View>
                  )}

                  {/* Efek Vignette / Gradient Gelap Atas & Bawah agar overlay terbaca jernih */}
                  <View style={styles.cardVignetteTop} />
                  <View style={styles.cardVignetteBottom} />

                  {/* Indikator Live Dot jika ada streaming kamera */}
                  {hasLiveVideo && <View style={styles.liveIndicatorDot} />}

                  {/* Peringatan Anomali */}
                  {hasLiveVideo && liveFeed?.faceStatus !== 'normal' && (
                    <View style={styles.anomalyBanner}>
                      <Text style={styles.anomalyText}>⚠ ANOMALI</Text>
                    </View>
                  )}

                  {/* ── LAYER 1: Overlay Kiri Atas (Kelas & No. Meja) ── */}
                  <View style={styles.cardTopLeftOverlay}>
                    {/* Pill 1: Kelas */}
                    <View style={styles.overlayPill}>
                      <Text style={styles.overlayPillText} numberOfLines={1}>
                        {item.kelas || 'Kelas'}
                      </Text>
                    </View>

                    {/* Pill 2: No. Meja */}
                    <View style={styles.overlayPill}>
                      <Text style={styles.overlayPillText} numberOfLines={1}>
                        {item.nomor_meja ? `No. Meja ${String(item.nomor_meja).padStart(2, '0')}` : 'No. Meja'}
                      </Text>
                    </View>
                  </View>

                  {/* ── LAYER 1: Overlay Kanan Atas (Status Ujian & Waktu Berdetik) ── */}
                  <View style={styles.cardTopRightOverlay}>
                    {/* Pill 1: Status Ujian */}
                    <View
                      style={[
                        styles.overlayPill,
                        isAktif
                          ? styles.pillMengerjakan
                          : isSelesai
                          ? styles.pillSelesai
                          : isDijeda
                          ? styles.pillDijeda
                          : isDiblokir
                          ? styles.pillDiblokir
                          : isMengerjakan
                          ? { backgroundColor: 'rgba(71, 85, 105, 0.85)' }
                          : null,
                      ]}
                    >
                      <Text style={styles.overlayPillText} numberOfLines={1}>
                        {statusLabel}
                      </Text>
                    </View>

                    {/* Pill 2: Waktu Berdetik */}
                    <View style={styles.overlayPill}>
                      <Text style={[styles.overlayPillText, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]} numberOfLines={1}>
                        {waktuLabel}
                      </Text>
                    </View>
                  </View>

                  {/* ── LAYER 2 & 3: Overlay Bawah (Nama Siswa, NISN/NIPD 2 Baris, 5 Tombol Aksi Mini) ── */}
                  <View style={styles.cardBottomOverlay}>
                    {/* Pita Nama Siswa */}
                    <View style={styles.overlayNameBand}>
                      <Text style={styles.overlayNameText} numberOfLines={1}>
                        {item.nama || 'Nama Siswa'}
                      </Text>
                    </View>

                    {/* Pita NISN & NIPD (2 Baris Terpisah agar nomor terlihat semua) */}
                    <View style={styles.overlayNipdBand}>
                      <Text style={styles.overlayNipdText} numberOfLines={1}>
                        NISN: {item.nisn || '-'}
                      </Text>
                      <Text style={styles.overlayNipdText} numberOfLines={1}>
                        NIPD: {item.nipd || '-'}
                      </Text>
                    </View>

                    {/* Baris 5 Tombol Aksi Mini di Kartu Siswa (Persis Web-App) */}
                    <View style={styles.cardActionRow}>
                      {/* 1. Chat (Biru Muda) */}
                      <TouchableOpacity
                        style={[styles.cardBtnCircle, styles.btnChat]}
                        onPress={() => handleOpenDirectMsg(item)}
                        activeOpacity={0.7}
                      >
                        <MessageSquare size={13} color="#0284c7" />
                      </TouchableOpacity>

                      {/* 2. Tambah Waktu (Hijau Emerald) */}
                      <TouchableOpacity
                        style={[styles.cardBtnCircle, styles.btnPlus]}
                        onPress={() => handleOpenAddTimeModal(item)}
                        activeOpacity={0.7}
                      >
                        <Plus size={14} color="#ffffff" strokeWidth={3} />
                      </TouchableOpacity>

                      {/* 3. Jeda / Lanjutkan (Toggle) */}
                      {isDijeda ? (
                        <TouchableOpacity
                          style={[styles.cardBtnCircle, styles.btnPlay]}
                          onPress={() => handleResumeSingle(item)}
                          activeOpacity={0.7}
                        >
                          <Play size={13} color="#ffffff" fill="#ffffff" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.cardBtnCircle, styles.btnPause]}
                          onPress={() => handlePauseSingle(item)}
                          activeOpacity={0.7}
                        >
                          <Pause size={13} color="#ffffff" />
                        </TouchableOpacity>
                      )}

                      {/* 4. Blokir / Buka Blokir (Gembok Terbuka Hijau / Gembok Tertutup Merah) */}
                      <TouchableOpacity
                        style={[
                          styles.cardBtnCircle,
                          { backgroundColor: isDiblokir ? '#dc2626' : '#16a34a' }
                        ]}
                        onPress={() => handleToggleBlockSingle(item)}
                        activeOpacity={0.7}
                      >
                        {isDiblokir ? (
                          <Lock size={13} color="#ffffff" />
                        ) : (
                          <Unlock size={13} color="#ffffff" />
                        )}
                      </TouchableOpacity>

                      {/* 5. Force Stop / Mulai Lagi (Panah Melingkar untuk Selesai) */}
                      {isSelesai ? (
                        <TouchableOpacity
                          style={[styles.cardBtnCircle, { backgroundColor: '#2563eb' }]}
                          onPress={() => handleRestartSingle(item)}
                          activeOpacity={0.7}
                        >
                          <RotateCcw size={13} color="#ffffff" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.cardBtnCircle, styles.btnStop]}
                          onPress={() => handleForceStopSingle(item)}
                          activeOpacity={0.7}
                        >
                          <Ban size={13} color="#ffffff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* =========================================================================
      {/* =========================================================================
          4. FIXED BOTTOM DOCKED ACTION BAR (5 TOMBOL UTAMA PERSIS KONSEP CARD SISWA)
      ========================================================================= */}
      {(() => {
        const isAnyPaused = filteredSesiList.some(s => s.sesi?.status === 'dijeda');
        const isAnyRunning = filteredSesiList.some(s => s.sesi?.status === 'mengerjakan');
        const isAnyBlocked = filteredSesiList.some(s => s.sesi?.status === 'diblokir' || s.status === 'diblokir');
        const isAllFinished = filteredSesiList.length > 0 && filteredSesiList.every(s => s.sesi?.status === 'selesai');

        return (
          <View
            style={[
              styles.bottomMassBar,
              { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 44 : 20) + 14 }
            ]}
          >
            {/* 1. Chat / Pesan Massal (Biru Muda) */}
            <TouchableOpacity
              style={[styles.massBtn, styles.massChatBtn]}
              onPress={handleOpenBroadcastMsg}
              activeOpacity={0.8}
            >
              <MessageSquare size={22} color="#0284c7" />
            </TouchableOpacity>

            {/* 2. Tambah Waktu Semua (Hijau Emerald) */}
            <TouchableOpacity
              style={[styles.massBtn, styles.massPlusBtn]}
              onPress={() => handleOpenAddTimeModal(null)}
              activeOpacity={0.8}
            >
              <PlusCircle size={22} color="#ffffff" />
            </TouchableOpacity>

            {/* 3. Jeda / Lanjutkan Semua (Orange / Hijau) */}
            <TouchableOpacity
              style={[styles.massBtn, isAnyPaused && !isAnyRunning ? styles.massPlayBtn : styles.massPauseBtn]}
              onPress={handleTogglePauseAllGlobal}
              activeOpacity={0.8}
            >
              {isAnyPaused && !isAnyRunning ? (
                <PlayCircle size={22} color="#ffffff" />
              ) : (
                <PauseCircle size={22} color="#ffffff" />
              )}
            </TouchableOpacity>

            {/* 4. Blokir / Buka Blokir Semua (Merah / Hijau) */}
            <TouchableOpacity
              style={[styles.massBtn, isAnyBlocked && !isAnyRunning ? styles.massUnlockBtn : styles.massLockBtn]}
              onPress={handleToggleBlockAllGlobal}
              activeOpacity={0.8}
            >
              {isAnyBlocked && !isAnyRunning ? (
                <Unlock size={22} color="#ffffff" />
              ) : (
                <Lock size={22} color="#ffffff" />
              )}
            </TouchableOpacity>

            {/* 5. Force Selesai / Mulai Lagi Semua (Merah / Biru) */}
            <TouchableOpacity
              style={[styles.massBtn, isAllFinished ? styles.massRestartBtn : styles.massStopBtn]}
              onPress={handleStopOrRestartAllGlobal}
              activeOpacity={0.8}
            >
              {isAllFinished ? (
                <RotateCcw size={22} color="#ffffff" />
              ) : (
                <Ban size={22} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* =========================================================================
          5. MODAL PILIH / BERALIH RUANGAN PENGAWASAN
      ========================================================================= */}
      <Modal
        visible={isSwitchRuangModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSwitchRuangModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Building size={18} color="#231853" />
                <Text style={styles.modalTitleText}>Pilih Ruangan Pengawasan</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSwitchRuangModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubText}>
              Pilih ruangan untuk memfilter tampilan monitor siswa ujian:
            </Text>

            <ScrollView style={{ maxHeight: 260 }}>
              {availableRuangTabs.map((tab) => {
                const isSelected = String(tab.id) === String(currentRuangId);
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.roomSelectOption,
                      isSelected && styles.roomSelectOptionActive,
                    ]}
                    onPress={() => {
                      setCurrentRuangId(String(tab.id));
                      setIsSwitchRuangModalOpen(false);
                      fetchSesiData(selectedJadwalId, String(tab.id));
                    }}
                  >
                    <Text
                      style={[
                        styles.roomSelectOptionText,
                        isSelected && styles.roomSelectOptionTextActive,
                      ]}
                    >
                      {tab.nama} ({tab.count} siswa)
                    </Text>
                    {isSelected && <Check size={18} color="#231853" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          MODAL PILIH KELAS (DROPDOWN MODAL SEPERTI WEB APP)
      ========================================================================= */}
      <Modal
        visible={isSwitchKelasModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSwitchKelasModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#231853" />
                <Text style={styles.modalTitleText}>Pilih Kelas Pengawasan</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSwitchKelasModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubText}>
              Pilih kelas untuk memfilter tampilan monitor siswa ujian:
            </Text>

            <ScrollView style={{ maxHeight: 260 }}>
              {availableKelasList.map((k) => {
                const isSelected = selectedKelas === k;
                const count = k === 'semua' ? sesiList.length : sesiList.filter((s) => s.kelas === k).length;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[
                      styles.roomSelectOption,
                      isSelected && styles.roomSelectOptionActive,
                    ]}
                    onPress={() => {
                      setSelectedKelas(k);
                      setIsSwitchKelasModalOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.roomSelectOptionText,
                        isSelected && styles.roomSelectOptionTextActive,
                      ]}
                    >
                      {k === 'semua' ? 'Semua Kelas' : `Kelas ${k}`} ({count} siswa)
                    </Text>
                    {isSelected && <Check size={18} color="#231853" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          6. MODAL KIRIM PESAN (DIRECT / BROADCAST)
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

      {/* =========================================================================
          7. MODAL TAMBAH WAKTU UJIAN DINAMIS
      ========================================================================= */}
      <Modal
        visible={isTimeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTimeModalOpen(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalCardCenter}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PlusCircle size={20} color="#16a34a" />
                <Text style={styles.modalTitleText}>Tambah Waktu Ujian</Text>
              </View>
              <TouchableOpacity onPress={() => setIsTimeModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubText}>
              {timeTargetStudent
                ? `Tambahkan durasi pengerjaan untuk ${timeTargetStudent.nama}:`
                : 'Tambahkan durasi pengerjaan untuk seluruh siswa aktif di ruangan:'}
            </Text>

            {/* Tombol Pilihan Cepat Menit */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {['5', '10', '15', '30'].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setInputMinutes(m)}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: inputMinutes === m ? '#16a34a' : '#f1f5f9',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: inputMinutes === m ? '#15803d' : '#e2e8f0',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: inputMinutes === m ? '#ffffff' : '#334155',
                    }}
                  >
                    +{m}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
              Atau ketik jumlah menit manual:
            </Text>

            <TextInput
              style={{
                backgroundColor: '#f8fafc',
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 12,
                padding: 12,
                fontSize: 16,
                fontWeight: 'bold',
                color: '#0f172a',
                textAlign: 'center',
                marginBottom: 16,
              }}
              keyboardType="number-pad"
              value={inputMinutes}
              onChangeText={setInputMinutes}
              placeholder="Contoh: 15"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setIsTimeModalOpen(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleTimeSubmit}
                style={[styles.modalSendBtn, { backgroundColor: '#16a34a' }]}
              >
                <PlusCircle size={16} color="#ffffff" />
                <Text style={styles.modalSendBtnText}>Tambahkan Waktu</Text>
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

  // 1. Header Dark Indigo
  header: {
    backgroundColor: '#231853',
    paddingTop: Platform.OS === 'ios' ? 48 : 34,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  ruangHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubText: {
    fontSize: 12.5,
    color: '#e2e8f0',
    marginTop: 1.5,
    fontWeight: '500',
  },

  // 2. KPI Cards Bar
  kpiRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    marginTop: 10,
    marginBottom: 6,
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
    fontSize: 19,
    fontWeight: '900',
    marginTop: 1,
  },

  // 3. Student Grid (2 Kolom)
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 1,
    paddingTop: 2,
    paddingBottom: 20,
  },
  studentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },

  // Card Container (2 Kolom) - Lengkungan Sudut Modern & Elegan
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffffff',
    marginBottom: 4,
    overflow: 'hidden',
    position: 'relative',
  },

  // Layer 0: Background Penuh
  cardFullBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  cardFullPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Vignette Gradient Gelap
  cardVignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cardVignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Indikator Live & Anomali
  liveIndicatorDot: {
    position: 'absolute',
    top: 6,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  anomalyBanner: {
    position: 'absolute',
    top: '38%',
    left: 10,
    right: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    borderRadius: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anomalyText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Layer 1: Overlay Kiri Atas
  cardTopLeftOverlay: {
    position: 'absolute',
    top: 5,
    left: 5,
    flexDirection: 'column',
    gap: 3,
    alignItems: 'flex-start',
  },

  // Layer 1: Overlay Kanan Atas
  cardTopRightOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'column',
    gap: 3,
    alignItems: 'flex-end',
  },

  // Overlay Pills
  overlayPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 9,
  },
  overlayPillText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  pillMengerjakan: {
    backgroundColor: 'rgba(22, 163, 74, 0.85)',
  },
  pillSelesai: {
    backgroundColor: 'rgba(147, 51, 234, 0.85)',
  },
  pillDijeda: {
    backgroundColor: 'rgba(217, 119, 6, 0.85)',
  },
  pillDiblokir: {
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
  },

  // Layer 2 & 3: Overlay Bawah
  cardBottomOverlay: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    right: 5,
    flexDirection: 'column',
  },
  overlayNameBand: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 7,
    marginBottom: 2,
  },
  overlayNameText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  overlayNipdBand: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
    marginBottom: 4,
  },
  overlayNipdText: {
    color: '#cbd5e1',
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Baris 5 Tombol Aksi Mini di Kartu
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 1,
    marginTop: 1,
  },
  cardBtnCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnChat: {
    backgroundColor: '#e0f2fe',
  },
  btnPlus: {
    backgroundColor: '#22c55e',
  },
  btnPause: {
    backgroundColor: '#f59e0b',
  },
  btnPlay: {
    backgroundColor: '#16a34a',
  },
  btnStop: {
    backgroundColor: '#ef4444',
  },

  // 4. Fixed Bottom Docked Action Bar (5 Tombol Serentak)
  bottomMassBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 44 : 26,
    gap: 10,
  },
  massBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  massChatBtn: {
    backgroundColor: '#e0f2fe',
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
  massLockBtn: {
    backgroundColor: '#dc2626',
  },
  massUnlockBtn: {
    backgroundColor: '#16a34a',
  },
  massStopBtn: {
    backgroundColor: '#be123c',
  },
  massRestartBtn: {
    backgroundColor: '#2563eb',
  },

  // Modal Styling di Tengah Layar (Pop Up Waktu Ditengah Layar)
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCardCenter: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 22,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
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
  switchRoomPromptBtn: {
    marginTop: 14,
    backgroundColor: '#231853',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },

  // Modal Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
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

  // Room Select Option
  roomSelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roomSelectOptionActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  roomSelectOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  roomSelectOptionTextActive: {
    color: '#231853',
    fontWeight: '800',
  },

  // Filter Wrapper & Dropdown Selectors
  filtersWrapper: {
    backgroundColor: '#ffffff',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterDropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 4,
  },
  filterDropdownText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
    padding: 0,
  },
  searchClearBtn: {
    padding: 2,
  },
  searchResetBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  // Kelas Filter Bar
  kelasFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  kelasFilterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginLeft: 4,
  },
  kelasFilterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 16,
  },
  kelasFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kelasFilterChipActive: {
    backgroundColor: '#231853',
    borderColor: '#231853',
  },
  kelasFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  kelasFilterTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
