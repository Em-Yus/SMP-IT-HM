import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, DeviceEventEmitter, ToastAndroid, Dimensions, Animated, Easing } from 'react-native';
import { supabase } from '../../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckCircle, Clock, LogOut, FileText, UserCheck, ChevronLeft, ChevronRight, Edit, X, AlertCircle, Calendar, QrCode, BookOpen, DollarSign, Camera as CameraIcon, Award, ShieldCheck, Sparkles } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');
import { getOperationalDate, getOperationalDayName, getLocalDate } from '../../utils/dateUtils';

export default function PresensiGuruScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOperator, setIsOperator] = useState(false);
  const [activeView, setActiveView] = useState<'guru' | 'operator'>('guru');

  // MASTER SETTING JAM KERJA
  const [masterJamGuru, setMasterJamGuru] = useState<any>({
    jam_masuk: '08:00',
    jam_pulang: '13:00',
    honor_kehadiran: 5000,
    honor_per_jp: 6500
  });

  // CAMERA SCANNER STATE
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // PRESENSI DATA
  const [myPresensi, setMyPresensi] = useState<any>(null);
  const [loadingSaya, setLoadingSaya] = useState(true);
  const [myKbmList, setMyKbmList] = useState<any[]>([]);
  const [savingIzin, setSavingIzin] = useState(false);
  const [canManageQrAndJam, setCanManageQrAndJam] = useState(false);

  // REKAP OPERATOR
  const [pegawaiList, setPegawaiList] = useState<any[]>([]);
  const [presensiMap, setPresensiMap] = useState<Record<number, any>>({});
  const [tanggalRekap, setTanggalRekap] = useState(getLocalDate());
  const [loadingRekap, setLoadingRekap] = useState(false);
  const [searchRekap, setSearchRekap] = useState('');

  // MODALS
  const [izinModalVisible, setIzinModalVisible] = useState(false);
  const [izinForm, setIzinForm] = useState({ status: 'Sakit', alasan: '' });

  // SCANNER LASER ANIMATION
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scannerVisible) {
      laserAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 240,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [scannerVisible]);

  useEffect(() => {
    initApp();
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      initApp();
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (activeView === 'guru') {
        fetchAllGuruData();
      } else {
        fetchRekapData();
      }
    }
  }, [activeView, tanggalRekap, currentUser]);

  const initApp = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user_guru');
      if (userStr) {
        const u = JSON.parse(userStr);
        setCurrentUser(u);

        // Fetch Role
        if (u.role === 'admin') {
          setIsOperator(true);
          setCanManageQrAndJam(true);
        } else {
          const { data: jData } = await supabase.from('jabatan_guru').select('*').eq('guru_id', u.id).maybeSingle();
          if (jData) {
            const roles = [jData.jabatan_utama, jData.jabatan_lain_1, jData.jabatan_lain_2, jData.jabatan_lain_3].filter(Boolean);
            const hasOp = roles.some((r: string) => {
              const lower = (r || '').toLowerCase();
              return lower.includes('operator') || lower.includes('admin') || lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara');
            });
            setIsOperator(hasOp);

            const hasQrJam = roles.some((r: string) => {
              const lower = (r || '').toLowerCase();
              return lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara') || lower.includes('waka') || lower.includes('kurikulum') || lower.includes('operator') || lower.includes('admin');
            });
            setCanManageQrAndJam(hasQrJam);
          }
        }

        // Fetch Master Jam Kerja Guru Aktif
        const { data: jamData } = await supabase.from('master_jam_presensi_guru').select('*').eq('is_active', true).maybeSingle();
        if (jamData) {
          setMasterJamGuru(jamData);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTimeString = (d = new Date()) => {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const parseTimeToMinutes = (tStr: string) => {
    if (!tStr) return 0;
    const [h, m] = tStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getSlotTimeRange = (s: any) => {
    let startStr = s.master_jam?.waktu_mulai?.substring(0, 5);
    let endStr = s.master_jam?.waktu_selesai?.substring(0, 5);

    // Fallback: jika master_jam null, coba parsing dari string s.waktu (misal "08:00 - 08:40" atau "09.20 - 10.00")
    if ((!startStr || !endStr) && s.waktu) {
      const parts = s.waktu.split('-').map((p: string) => p.trim().replace('.', ':'));
      if (parts.length === 2) {
        startStr = startStr || parts[0];
        endStr = endStr || parts[1];
      }
    }

    const startMin = startStr ? parseTimeToMinutes(startStr) : 480; // default 08:00
    const endMin = endStr ? parseTimeToMinutes(endStr) : startMin + 40;
    return { startMin, endMin, startStr, endStr };
  };

  const fetchAllGuruData = async () => {
    if (!currentUser) return;
    setLoadingSaya(true);
    const today = getLocalDate();
    try {
      // 1. Fetch Kehadiran Sekolah
      const { data: presensi } = await supabase
        .from('presensi_guru')
        .select('*')
        .eq('guru_id', currentUser.id)
        .eq('tanggal', today)
        .maybeSingle();
      setMyPresensi(presensi || null);

      // 2. Fetch KBM Mengajar
      const { data: kbm } = await supabase
        .from('presensi_kbm_guru')
        .select('*, data_kelas(nama_kelas), data_mapel(nama_mapel)')
        .eq('guru_id', currentUser.id)
        .eq('tanggal', today)
        .order('created_at', { ascending: false });
      setMyKbmList(kbm || []);
    } catch (e) {
      console.error('Fetch guru data error:', e);
    } finally {
      setLoadingSaya(false);
    }
  };

  // ===============================
  // UNIVERSAL SCANNER HANDLER
  // ===============================
  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Izin Ditolak', 'Aplikasi memerlukan izin kamera untuk memindai QR Code Presensi.');
        return;
      }
    }
    setScanned(false);
    setIsProcessing(false);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isProcessing) return;
    setScanned(true);
    setIsProcessing(true);

    try {
      let payload: any;
      try {
        payload = JSON.parse(data);
      } catch (e) {
        Alert.alert('QR Tidak Valid', 'Format QR Code tidak dikenali oleh sistem presensi SMP IT HM.');
        setIsProcessing(false);
        setTimeout(() => setScanned(false), 2000);
        return;
      }

      if (payload.app !== 'SMPITHM') {
        Alert.alert('QR Tidak Sesuai', 'QR Code ini bukan stiker presensi resmi SMP IT Hidayatul Mubtadi-ien.');
        setIsProcessing(false);
        setTimeout(() => setScanned(false), 2000);
        return;
      }

      const today = getLocalDate();
      const currentTime = getTimeString();
      const currentMin = parseTimeToMinutes(currentTime);

      // ----------------------------------------------------
      // CASE 1: ABSEN KEHADIRAN SEKOLAH (MASUK / PULANG)
      // ----------------------------------------------------
      if (payload.type === 'GURU_KEHADIRAN') {
        const jamMasukMin = parseTimeToMinutes(masterJamGuru.jam_masuk || '08:00');
        const jamPulangMin = parseTimeToMinutes(masterJamGuru.jam_pulang || '13:00');
        const standardHonor = Number(masterJamGuru.honor_kehadiran) || 5000;

        if (payload.action === 'MASUK') {
          const isLate = currentMin > jamMasukMin;
          const lateMinutes = isLate ? currentMin - jamMasukMin : 0;
          const initialHonor = isLate ? standardHonor * 0.5 : standardHonor;

          const recordPayload = {
            guru_id: currentUser.id,
            tanggal: today,
            waktu_datang: currentTime,
            status: 'Hadir',
            terlambat_menit: lateMinutes,
            honor_kehadiran: initialHonor
          };

          const { error } = await supabase.from('presensi_guru').upsert(recordPayload, { onConflict: 'guru_id,tanggal' });
          if (error) {
            await supabase.from('presensi_guru').insert(recordPayload);
          }

          setScannerVisible(false);
          fetchAllGuruData();
          DeviceEventEmitter.emit('globalRefresh');

          Alert.alert(
            '✅ Absen Masuk Berhasil!',
            `Waktu: ${currentTime}\nStatus: ${isLate ? `Terlambat ${lateMinutes} menit (Potongan 50%)` : 'Tepat Waktu'}\nEstimasi Honor Hadir: Rp ${initialHonor.toLocaleString('id-ID')}`
          );
        } else if (payload.action === 'PULANG') {
          const { data: existingPresensi } = await supabase
            .from('presensi_guru')
            .select('*')
            .eq('guru_id', currentUser.id)
            .eq('tanggal', today)
            .maybeSingle();

          if (!existingPresensi || !existingPresensi.waktu_datang) {
            Alert.alert('Belum Absen Masuk', 'Anda belum melakukan scan Absen Masuk hari ini.');
            setIsProcessing(false);
            setScannerVisible(false);
            return;
          }

          const isEarly = currentMin < jamPulangMin;
          const earlyMinutes = isEarly ? jamPulangMin - currentMin : 0;
          const wasLate = (existingPresensi.terlambat_menit || 0) > 0;

          let finalHonor = 0;
          if (wasLate && isEarly) {
            finalHonor = 0;
          } else if (wasLate || isEarly) {
            finalHonor = standardHonor * 0.5;
          } else {
            finalHonor = standardHonor;
          }

          await supabase.from('presensi_guru').update({
            waktu_pulang: currentTime,
            pulang_cepat_menit: earlyMinutes,
            honor_kehadiran: finalHonor
          }).eq('id', existingPresensi.id);

          setScannerVisible(false);
          fetchAllGuruData();
          DeviceEventEmitter.emit('globalRefresh');

          let infoMsg = `Waktu Pulang: ${currentTime}\n`;
          if (wasLate && isEarly) {
            infoMsg += `Status: Terlambat Masuk & Pulang Cepat (Honor Hadir Hangus: Rp 0)`;
          } else if (wasLate) {
            infoMsg += `Status: Terlambat Masuk (Honor: Rp ${finalHonor.toLocaleString('id-ID')})`;
          } else if (isEarly) {
            infoMsg += `Status: Pulang Lebih Awal ${earlyMinutes} menit (Honor: Rp ${finalHonor.toLocaleString('id-ID')})`;
          } else {
            infoMsg += `Status: Tepat Waktu (Honor Penuh: Rp ${finalHonor.toLocaleString('id-ID')})`;
          }

          Alert.alert('👋 Absen Pulang Berhasil!', infoMsg);
        }
      }

      // ----------------------------------------------------
      // CASE 2: ABSEN KBM MENGAJAR KELAS (MASUK / KELUAR)
      // ----------------------------------------------------
      else if (payload.type === 'GURU_KBM') {
        const kelasId = payload.kelas_id;
        const namaKelas = payload.nama_kelas || `Kelas ${kelasId}`;

        if (payload.action === 'MASUK') {
          const todayName = getOperationalDayName();

          const { data: scheduleList } = await supabase
            .from('jadwal_pelajaran')
            .select('*, master_jam(*), data_mapel(*), data_guru(*)')
            .eq('kelas_id', kelasId)
            .eq('hari', todayName);

          const sortedSchedules = (scheduleList || []).sort((a: any, b: any) => {
            const uA = Number(a.master_jam?.urutan) || Number(a.jam_ke) || 999;
            const uB = Number(b.master_jam?.urutan) || Number(b.jam_ke) || 999;
            return uA - uB;
          });

          // Filter slot non-istirahat
          const lessonSlots = sortedSchedules.filter((s: any) => !s.is_istirahat && !s.master_jam?.is_istirahat);

          if (lessonSlots.length === 0) {
            Alert.alert('Jadwal Tidak Ditemukan', `Tidak ada jadwal pelajaran di ${namaKelas} pada hari ${todayName}.`);
            setIsProcessing(false);
            setScannerVisible(false);
            return;
          }

          // 1. Cari slot pelajaran yang sedang aktif / paling tepat di kelas ini
          const scoredSlots = lessonSlots.map((s: any) => {
            const { startMin, endMin } = getSlotTimeRange(s);
            const isCurrentlyActive = currentMin >= startMin - 15 && currentMin <= endMin;
            const isMySlot = Number(s.guru_id) === Number(currentUser.id);
            const dist = Math.abs(currentMin - startMin);
            return { slot: s, startMin, endMin, isCurrentlyActive, isMySlot, dist };
          });

          // A. Prioritas 1: Slot yang sedang aktif sekarang (currentMin berada di rentang startMin - 15 s/d endMin)
          const activeNow = scoredSlots.filter((item: any) => item.isCurrentlyActive);
          let matchedJadwal: any = null;

          if (activeNow.length > 0) {
            // Jika ada slot milik guru login sendiri yang aktif, utamakan miliknya
            const myActive = activeNow.find((item: any) => item.isMySlot);
            if (myActive) {
              matchedJadwal = myActive.slot;
            } else {
              // Jika bukan jadwalnya sendiri (akan jadi guru pengganti), pilih slot aktif terdekat
              activeNow.sort((a: any, b: any) => a.dist - b.dist);
              matchedJadwal = activeNow[0].slot;
            }
          }

          // B. Prioritas 2: Jika scan sebelum jam mulai (datang lebih awal / saat istirahat)
          if (!matchedJadwal) {
            const upcoming = scoredSlots.filter((item: any) => item.startMin > currentMin);
            if (upcoming.length > 0) {
              const myUpcoming = upcoming.find((item: any) => item.isMySlot);
              matchedJadwal = myUpcoming ? myUpcoming.slot : upcoming[0].slot;
            }
          }

          // C. Prioritas 3: Fallback ke slot terdekat di kelas ini
          if (!matchedJadwal) {
            scoredSlots.sort((a: any, b: any) => a.dist - b.dist);
            matchedJadwal = scoredSlots[0]?.slot || lessonSlots[0];
          }

          // 2. Evaluasi apakah guru login adalah guru asli atau guru pengganti (inval)
          const scheduledGuruId = matchedJadwal?.guru_id;
          const isPengganti = scheduledGuruId ? Number(scheduledGuruId) !== Number(currentUser.id) : false;
          const targetGuruId = isPengganti ? scheduledGuruId : currentUser.id;

          // Hitung estimasi blok multi-JP berturut-turut untuk targetGuruId
          const targetGuruSlots = lessonSlots.filter((s: any) => Number(s.guru_id) === Number(targetGuruId));
          const startIdx = targetGuruSlots.findIndex((s: any) => s.id === matchedJadwal?.id);
          const validStartIdx = startIdx >= 0 ? startIdx : 0;
          const remainingBlockSlots = targetGuruSlots.slice(validStartIdx);

          const estimatedJp = Math.max(1, remainingBlockSlots.length);
          const startJamName = matchedJadwal?.master_jam?.nama_jam || matchedJadwal?.jam_ke || '1';
          const endJamName = remainingBlockSlots[remainingBlockSlots.length - 1]?.master_jam?.nama_jam || remainingBlockSlots[remainingBlockSlots.length - 1]?.jam_ke || startJamName;
          const jamDisplay = startJamName === endJamName ? `Jam ${startJamName}` : `Jam ${startJamName} - ${endJamName}`;

          const proceedKbmMasuk = async (isInval: boolean) => {
            const standardJpHonor = Number(masterJamGuru.honor_per_jp) || 6500;

            let lateMinutes = 0;
            if (matchedJadwal?.master_jam?.waktu_mulai) {
              const startMin = parseTimeToMinutes(matchedJadwal.master_jam.waktu_mulai.substring(0, 5));
              if (currentMin > startMin) {
                lateMinutes = currentMin - startMin;
              }
            }

            // Honor KBM penuh dihitung untuk seluruh blok JP yang terjadwal
            const netHonorKbm = standardJpHonor * estimatedJp;

            const { error: kbmErr } = await supabase.from('presensi_kbm_guru').insert({
              guru_id: currentUser.id,
              guru_asli_id: isInval ? scheduledGuruId : null,
              is_pengganti: isInval,
              jadwal_id: matchedJadwal?.id || null,
              kelas_id: kelasId,
              mapel_id: matchedJadwal?.mapel_id || null,
              tanggal: today,
              jam_ke: jamDisplay,
              jumlah_jp: estimatedJp,
              waktu_masuk: currentTime,
              terlambat_menit: lateMinutes,
              honor_kbm: netHonorKbm,
              status: 'Masuk'
            });

            if (kbmErr) throw kbmErr;

            setScannerVisible(false);
            fetchAllGuruData();
            DeviceEventEmitter.emit('globalRefresh');

            Alert.alert(
              '📖 KBM Dimulai!',
              `Kelas: ${namaKelas}\nWaktu Masuk: ${currentTime}\nJadwal: ${jamDisplay} (${estimatedJp} JP)\n${isInval ? `Status: Guru Pengganti (Inval: ${matchedJadwal?.data_guru?.nama || 'Guru Lain'})\n` : ''}${lateMinutes > 0 ? `Catatan: Terlambat ${lateMinutes} menit (Tanpa Potongan)\n` : ''}Estimasi Honor KBM: Rp ${Math.round(netHonorKbm).toLocaleString('id-ID')} (Penuh)`
            );
          };

          if (isPengganti) {
            Alert.alert(
              'Konfirmasi Guru Pengganti (Inval)',
              `Jadwal di ${namaKelas} saat ini terdaftar untuk ${matchedJadwal?.data_guru?.nama || 'Guru Lain'}.\n\nApakah Anda mengisi jam ini sebagai Guru Pengganti (Inval)?`,
              [
                {
                  text: 'Batal',
                  style: 'cancel',
                  onPress: () => {
                    setIsProcessing(false);
                    setTimeout(() => setScanned(false), 1500);
                  }
                },
                {
                  text: 'Ya, Saya Pengganti',
                  onPress: () => proceedKbmMasuk(true)
                }
              ]
            );
          } else {
            await proceedKbmMasuk(false);
          }
        } else if (payload.action === 'KELUAR') {
          const { data: activeKbm } = await supabase
            .from('presensi_kbm_guru')
            .select('*')
            .eq('guru_id', currentUser.id)
            .eq('kelas_id', kelasId)
            .eq('tanggal', today)
            .eq('status', 'Masuk')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!activeKbm) {
            Alert.alert('Tidak Ditemukan', `Anda belum melakukan scan KBM Masuk di ${namaKelas} hari ini.`);
            setIsProcessing(false);
            setScannerVisible(false);
            return;
          }

          const masukMin = parseTimeToMinutes(activeKbm.waktu_masuk);
          const durasi = Math.max(0, currentMin - masukMin);

          // 1. Ambil seluruh jadwal kelas ini hari ini
          const todayName = getOperationalDayName();
          const { data: scheduleList } = await supabase
            .from('jadwal_pelajaran')
            .select('*, master_jam(*), data_mapel(*), data_guru(*)')
            .eq('kelas_id', kelasId)
            .eq('hari', todayName);

          // 2. ISOLASI GURU: HANYA ambil jadwal milik targetGuruId & BUKAN istirahat!
          // Jadwal milik Guru B, C, dst. 100% DIABAIKAN / TIDAK DIHITUNG!
          const targetGuruId = activeKbm.is_pengganti ? activeKbm.guru_asli_id : activeKbm.guru_id;
          const targetGuruSlots = (scheduleList || [])
            .filter((s: any) =>
              Number(s.guru_id) === Number(targetGuruId) &&
              !s.is_istirahat &&
              !s.master_jam?.is_istirahat
            )
            .sort((a: any, b: any) => {
              const uA = Number(a.master_jam?.urutan) || Number(a.jam_ke) || 999;
              const uB = Number(b.master_jam?.urutan) || Number(b.jam_ke) || 999;
              return uA - uB;
            });

          let finalJp = Number(activeKbm.jumlah_jp) || 1;
          let jamDisplay = activeKbm.jam_ke || 'Jam 1';

          if (targetGuruSlots.length > 0) {
            let startIdx = targetGuruSlots.findIndex((s: any) => s.id === activeKbm.jadwal_id);
            if (startIdx < 0) {
              startIdx = targetGuruSlots.findIndex((s: any) => {
                const { startMin: sMin, endMin: eMin } = getSlotTimeRange(s);
                return masukMin >= sMin - 20 && masukMin <= eMin + 15;
              });
              if (startIdx < 0) startIdx = 0;
            }

            const coveredSlots = [targetGuruSlots[startIdx]];

            for (let i = startIdx + 1; i < targetGuruSlots.length; i++) {
              const slot = targetGuruSlots[i];
              const { startMin: slotStartMin } = getSlotTimeRange(slot);
              // Jika guru berada di kelas sampai / memasuki jam pelajaran ke-i ini
              if (currentMin >= slotStartMin - 5) {
                coveredSlots.push(slot);
              } else {
                break; // Keluar sebelum jam berikutnya dimulai
              }
            }

            finalJp = Math.max(1, coveredSlots.length);
            const startJam = coveredSlots[0]?.master_jam?.nama_jam || coveredSlots[0]?.jam_ke || '1';
            const endJam = coveredSlots[coveredSlots.length - 1]?.master_jam?.nama_jam || coveredSlots[coveredSlots.length - 1]?.jam_ke || startJam;
            jamDisplay = startJam === endJam ? `Jam ${startJam}` : `Jam ${startJam} - ${endJam}`;
          }

          const standardJpHonor = Number(masterJamGuru.honor_per_jp) || 6500;
          const finalHonor = finalJp * standardJpHonor;

          await supabase.from('presensi_kbm_guru').update({
            waktu_keluar: currentTime,
            durasi_menit: durasi,
            jumlah_jp: finalJp,
            honor_kbm: finalHonor,
            jam_ke: jamDisplay,
            status: 'Selesai'
          }).eq('id', activeKbm.id);

          setScannerVisible(false);
          fetchAllGuruData();
          DeviceEventEmitter.emit('globalRefresh');

          Alert.alert(
            '✅ KBM Selesai!',
            `Kelas: ${namaKelas}\nWaktu: ${activeKbm.waktu_masuk} s/d ${currentTime} (${durasi} menit)\nJam Terhitung: ${jamDisplay} (${finalJp} JP)\nHonor KBM: Rp ${finalHonor.toLocaleString('id-ID')} (Penuh, jadwal guru lain tidak dihitung)`
          );
        }
      }
    } catch (err: any) {
      console.error('Scanner error:', err);
      Alert.alert('Gagal', err.message || 'Terjadi kesalahan pemrosesan QR.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setScanned(false), 2000);
    }
  };

  // ===============================
  // REKAP OPERATOR
  // ===============================
  const fetchRekapData = async () => {
    setLoadingRekap(true);
    try {
      const { data: dataPegawai } = await supabase.from('data_guru').select('id, nama').is('tanggal_keluar', null).order('nama');
      if (dataPegawai) setPegawaiList(dataPegawai);

      const { data: dataPresensi } = await supabase.from('presensi_guru').select('*').eq('tanggal', tanggalRekap);
      const map: any = {};
      if (dataPresensi) {
        dataPresensi.forEach((p: any) => map[p.guru_id] = p);
      }
      setPresensiMap(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRekap(false);
    }
  };

  const changeDate = (days: number) => {
    const d = new Date(tanggalRekap);
    d.setDate(d.getDate() + days);
    setTanggalRekap(getLocalDate(d));
  };

  const submitIzin = async () => {
    setSavingIzin(true);
    const today = getLocalDate();
    try {
      const { error } = await supabase.from('presensi_guru').insert({
        guru_id: currentUser.id,
        tanggal: today,
        status: izinForm.status,
        alasan: izinForm.alasan
      });
      if (error) throw error;
      Alert.alert('Sukses', `Data ${izinForm.status} berhasil disimpan.`);
      setIzinModalVisible(false);
      fetchAllGuruData();
    } catch (err: any) {
      Alert.alert('Gagal', err.message);
    } finally {
      setSavingIzin(false);
    }
  };

  // Kalkulasi Total Honor Hari Ini
  const honorKehadiranHariIni = Number(myPresensi?.honor_kehadiran) || 0;
  const honorKbmHariIni = myKbmList.reduce((sum, k) => sum + (Number(k.honor_kbm) || 0), 0);
  const totalHonorHariIni = honorKehadiranHariIni + honorKbmHariIni;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Presensi Guru</Text>
            <Text style={styles.headerSubtitle}>Presensi Kehadiran & KBM Mengajar</Text>
          </View>
        </View>

        {isOperator && (
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, activeView === 'guru' && styles.toggleBtnActive]}
              onPress={() => setActiveView('guru')}
            >
              <Text style={[styles.toggleBtnText, activeView === 'guru' && styles.toggleBtnTextActive]}>Presensi Saya</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, activeView === 'operator' && styles.toggleBtnActive]}
              onPress={() => setActiveView('operator')}
            >
              <Text style={[styles.toggleBtnText, activeView === 'operator' && styles.toggleBtnTextActive]}>Rekap Operator</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ================= TAMPILAN PRESENSI SAYA (UNIFIED 1 HALAMAN) ================= */}
      {activeView === 'guru' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* 1. TOMBOL HERO UNIVERSAL SCANNER (1 SCANNER UNTUK SEMUA) */}
          <TouchableOpacity
            style={styles.heroScannerCard}
            onPress={handleOpenScanner}
            activeOpacity={0.85}
          >
            <View style={styles.heroScannerLeft}>
              <View style={styles.heroIconCircle}>
                <QrCode color="#fff" size={32} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.heroTitle}>Pindai QR Presensi</Text>
                  <Sparkles size={16} color="#FBBF24" />
                </View>
                <Text style={styles.heroSubtitle}>
                  Arahkan ke QR Code di Pintu Kantor atau Ruang Kelas
                </Text>
              </View>
            </View>
            <View style={styles.heroScanBadge}>
              <CameraIcon size={16} color="#1E257F" />
              <Text style={styles.heroScanBadgeText}>Buka Kamera</Text>
            </View>
          </TouchableOpacity>

          {/* 2. RINGKASAN ESTIMASI HONOR HARI INI */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Honor Hari Ini</Text>
              <Text style={styles.summaryTotalVal}>Rp {totalHonorHariIni.toLocaleString('id-ID')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBreakdown}>
              <Text style={styles.summarySubVal}>• Kehadiran: Rp {honorKehadiranHariIni.toLocaleString('id-ID')}</Text>
              <Text style={styles.summarySubVal}>• KBM ({myKbmList.length} Sesi): Rp {honorKbmHariIni.toLocaleString('id-ID')}</Text>
            </View>
          </View>

          {/* 3. KARTU PRESENSI KEHADIRAN SEKOLAH */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <UserCheck size={20} color="#1E257F" />
                <Text style={styles.cardTitle}>Kehadiran Sekolah</Text>
              </View>
              <Text style={styles.cardDate}>
                {getOperationalDate().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
            </View>

            {loadingSaya ? (
              <ActivityIndicator size="small" color="#1E257F" style={{ marginVertical: 14 }} />
            ) : !myPresensi ? (
              <View style={styles.emptyStateBox}>
                <Clock size={28} color="#9CA3AF" />
                <Text style={styles.emptyStateTitle}>Belum Absen Masuk Hari Ini</Text>
                <Text style={styles.emptyStateDesc}>
                  Pindai QR stiker di pintu luar gerbang/kantor sebelum jam {masterJamGuru.jam_masuk?.substring(0, 5) || '08:00'} untuk honor Rp {(Number(masterJamGuru.honor_kehadiran) || 5000).toLocaleString('id-ID')}.
                </Text>
                <TouchableOpacity style={styles.btnIzinOutline} onPress={() => setIzinModalVisible(true)}>
                  <AlertCircle size={15} color="#4B5563" />
                  <Text style={styles.btnIzinText}>Saya Sedang Izin / Sakit</Text>
                </TouchableOpacity>
              </View>
            ) : myPresensi.status === 'Hadir' ? (
              <View>
                <View style={styles.timeGrid}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>Masuk</Text>
                    <Text style={styles.timeValue}>{myPresensi.waktu_datang}</Text>
                    {myPresensi.terlambat_menit > 0 ? (
                      <Text style={styles.badgeLate}>Telat {myPresensi.terlambat_menit}m</Text>
                    ) : (
                      <Text style={styles.badgeOnTime}>Tepat Waktu</Text>
                    )}
                  </View>
                  <View style={[styles.timeBox, !myPresensi.waktu_pulang && { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }]}>
                    <Text style={styles.timeLabel}>Pulang</Text>
                    <Text style={[styles.timeValue, !myPresensi.waktu_pulang && { color: '#9CA3AF' }]}>
                      {myPresensi.waktu_pulang || '--:--'}
                    </Text>
                    {myPresensi.waktu_pulang ? (
                      myPresensi.pulang_cepat_menit > 0 ? (
                        <Text style={styles.badgeEarly}>Cepat {myPresensi.pulang_cepat_menit}m</Text>
                      ) : (
                        <Text style={styles.badgeOnTime}>Tepat Waktu</Text>
                      )
                    ) : (
                      <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Mulai {masterJamGuru.jam_pulang?.substring(0, 5) || '13:00'}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.honorBadgeRow}>
                  <Text style={styles.honorBadgeLabel}>Honor Kehadiran Hari Ini:</Text>
                  <Text style={styles.honorBadgeVal}>Rp {honorKehadiranHariIni.toLocaleString('id-ID')}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.reasonBox}>
                <View style={[styles.badge, myPresensi.status === 'Sakit' ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#fef3c7' }]}>
                  <Text style={[styles.badgeText, myPresensi.status === 'Sakit' ? { color: '#ef4444' } : { color: '#d97706' }]}>
                    {myPresensi.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.reasonText}>{myPresensi.alasan || 'Tanpa keterangan'}</Text>
              </View>
            )}
          </View>

          {/* 4. KARTU PRESENSI MENGAJAR (KBM KELAS) */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BookOpen size={20} color="#1E257F" />
                <Text style={styles.cardTitle}>Sesi Mengajar KBM Hari Ini</Text>
              </View>
              <Text style={styles.kbmCounterText}>{myKbmList.length} Sesi</Text>
            </View>

            {loadingSaya ? (
              <ActivityIndicator size="small" color="#1E257F" style={{ marginVertical: 14 }} />
            ) : myKbmList.length === 0 ? (
              <View style={styles.emptyKbmBox}>
                <BookOpen size={28} color="#9CA3AF" />
                <Text style={styles.emptyStateTitle}>Belum Ada Sesi Mengajar Hari Ini</Text>
                <Text style={styles.emptyStateDesc}>
                  Pindai QR stiker di luar pintu ruang kelas saat masuk memulai KBM (Rp {(Number(masterJamGuru.honor_per_jp) || 6500).toLocaleString('id-ID')} / JP).
                </Text>
              </View>
            ) : (
              <View style={styles.kbmListContainer}>
                {myKbmList.map((kbm) => (
                  <View key={kbm.id} style={styles.kbmItemCard}>
                    <View style={styles.kbmItemHeader}>
                      <View>
                        <Text style={styles.kbmKelasTitle}>{kbm.data_kelas?.nama_kelas || `Kelas ${kbm.kelas_id}`}</Text>
                        <Text style={styles.kbmMapelTitle}>
                          {kbm.data_mapel?.nama_mapel || 'Mata Pelajaran'} • {kbm.jam_ke?.includes('JP') ? kbm.jam_ke : `${kbm.jam_ke || 'Jam 1'} (${kbm.jumlah_jp || 1} JP)`}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, kbm.status === 'Masuk' ? { backgroundColor: '#FEF3C7' } : { backgroundColor: '#D1FAE5' }]}>
                        <Text style={[styles.statusPillText, kbm.status === 'Masuk' ? { color: '#D97706' } : { color: '#065F46' }]}>
                          {kbm.status === 'Masuk' ? 'Sedang Mengajar' : 'Selesai'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.kbmItemMeta}>
                      <Text style={styles.kbmItemTime}>
                        Waktu: {kbm.waktu_masuk} s/d {kbm.waktu_keluar || '...'}
                      </Text>
                      {kbm.is_pengganti && (
                        <Text style={styles.invalBadge}>Guru Pengganti (Inval)</Text>
                      )}
                    </View>

                    <View style={styles.kbmItemHonorRow}>
                      <Text style={styles.kbmItemHonorLabel}>Honor KBM:</Text>
                      <Text style={styles.kbmItemHonorVal}>Rp {(Number(kbm.honor_kbm) || ((Number(kbm.jumlah_jp) || 1) * 6500)).toLocaleString('id-ID')}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 5. TAUTAN PENGATURAN & REKAP */}
          <View style={styles.quickLinksRow}>
            <TouchableOpacity style={styles.quickLinkBtn} onPress={() => router.push('/rekap-honor-guru' as any)}>
              <DollarSign size={16} color="#059669" />
              <Text style={styles.quickLinkText}>Rekap Slip Honor</Text>
            </TouchableOpacity>
            {canManageQrAndJam && (
              <>
                <TouchableOpacity style={styles.quickLinkBtn} onPress={() => router.push('/qr-presensi-guru' as any)}>
                  <QrCode size={16} color="#1E257F" />
                  <Text style={styles.quickLinkText}>Cetak Stiker QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickLinkBtn} onPress={() => router.push('/master-jam-guru' as any)}>
                  <Clock size={16} color="#D97706" />
                  <Text style={styles.quickLinkText}>Jam & Standar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* ================= TAMPILAN OPERATOR (REKAP PEGAWAI) ================= */}
      {activeView === 'operator' && (
        <View style={styles.rekapContainer}>
          <View style={styles.dateSelector}>
            <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}><ChevronLeft color="#4b5563" size={24} /></TouchableOpacity>
            <View style={styles.dateCenter}>
              <Calendar color="#1E257F" size={16} />
              <Text style={styles.dateCenterText}>{tanggalRekap}</Text>
            </View>
            <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateArrow}><ChevronRight color="#4b5563" size={24} /></TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <TextInput style={styles.searchInput} placeholder="Cari nama pegawai..." value={searchRekap} onChangeText={setSearchRekap} />
          </View>

          {loadingRekap ? (
            <ActivityIndicator size="large" color="#1E257F" style={{ marginTop: 20 }} />
          ) : (
            <ScrollView contentContainerStyle={styles.listContainer}>
              {pegawaiList.filter(p => p.nama.toLowerCase().includes(searchRekap.toLowerCase())).map(p => {
                const pr = presensiMap[p.id];
                const status = pr?.status || 'Belum Absen';
                return (
                  <View key={p.id} style={styles.rekapCard}>
                    <View style={styles.rekapCardLeft}>
                      <Text style={styles.rekapName}>{p.nama}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        <Text style={[styles.rekapStatus, { color: status === 'Hadir' ? '#10b981' : status === 'Belum Absen' ? '#9ca3af' : '#ef4444' }]}>{status}</Text>
                        {status === 'Hadir' && (
                          <Text style={styles.rekapTimeText}>{pr?.waktu_datang || '-'} s/d {pr?.waktu_pulang || '-'}</Text>
                        )}
                      </View>
                    </View>
                    {pr?.honor_kehadiran ? (
                      <Text style={styles.rekapHonorText}>Rp {(Number(pr.honor_kehadiran) || 0).toLocaleString('id-ID')}</Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ================= MODAL FULLSCREEN UNIVERSAL CAMERA SCANNER ================= */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />

          {/* Scanner Overlay UI */}
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setScannerVisible(false)} style={styles.closeCameraBtn}>
              <X color="#fff" size={24} />
            </TouchableOpacity>
            <Text style={styles.cameraHeaderTitle}>Scanner Presensi Guru</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.scannerCenter}>
            <View style={styles.scanTargetBox}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {!isProcessing && (
                <Animated.View
                  style={[
                    styles.scanLaser,
                    {
                      transform: [{ translateY: laserAnim }]
                    }
                  ]}
                />
              )}
            </View>

            <View style={styles.scanTipBox}>
              <Text style={styles.scanInstruction}>
                Arahkan ke Stiker QR di Gerbang / Kantor (Kehadiran) atau di Pintu Ruang Kelas (KBM)
              </Text>
              <Text style={styles.scanSubInstruction}>
                Sistem akan otomatis mendeteksi jenis presensi
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL IZIN / SAKIT ================= */}
      <Modal visible={izinModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Form Izin / Sakit</Text>
              <TouchableOpacity onPress={() => setIzinModalVisible(false)}><X color="#4b5563" size={24} /></TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity style={[styles.chip, izinForm.status === 'Sakit' && styles.chipActive]} onPress={() => setIzinForm({ ...izinForm, status: 'Sakit' })}>
                <Text style={[styles.chipText, izinForm.status === 'Sakit' && styles.chipTextActive]}>Sakit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, izinForm.status === 'Izin' && styles.chipActive]} onPress={() => setIzinForm({ ...izinForm, status: 'Izin' })}>
                <Text style={[styles.chipText, izinForm.status === 'Izin' && styles.chipTextActive]}>Izin</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Keterangan Tambahan</Text>
            <TextInput
              style={[styles.inputField, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Berikan alasan singkat..."
              value={izinForm.alasan}
              onChangeText={(t) => setIzinForm({ ...izinForm, alasan: t })}
              multiline
            />

            <TouchableOpacity style={styles.saveBtn} onPress={submitIzin} disabled={savingIzin}>
              {savingIzin ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Simpan Form</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { backgroundColor: '#1E257F', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: '#c7d2fe', fontSize: 12, marginTop: 2 },
  viewToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 4, marginTop: 14 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleBtnText: { color: '#c7d2fe', fontSize: 13, fontWeight: 'bold' },
  toggleBtnTextActive: { color: '#1E257F' },
  content: { padding: 16, paddingBottom: 80, gap: 14 },

  // HERO UNIVERSAL SCANNER CARD
  heroScannerCard: {
    backgroundColor: '#1E257F',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#1E257F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5
  },
  heroScannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  heroIconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#2EC4B6', justifyContent: 'center', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  heroSubtitle: { color: '#C7D2FE', fontSize: 11, marginTop: 2 },
  heroScanBadge: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20
  },
  heroScanBadgeText: { color: '#1E257F', fontSize: 12, fontWeight: 'bold' },

  // SUMMARY ESTIMATION BAR
  summaryBar: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center'
  },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: 11, fontWeight: 'bold', color: '#065F46', textTransform: 'uppercase' },
  summaryTotalVal: { fontSize: 18, fontWeight: '900', color: '#047857', marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#A7F3D0', marginHorizontal: 12 },
  summaryBreakdown: { flex: 1.2 },
  summarySubVal: { fontSize: 11, color: '#065F46', fontWeight: '500', marginVertical: 1 },

  // GENERIC CARD
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1F2937' },
  cardDate: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  kbmCounterText: { fontSize: 11, fontWeight: 'bold', color: '#1E257F', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },

  // TIME & ATTENDANCE BOX
  timeGrid: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 10 },
  timeBox: { flex: 1, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 14, padding: 10, alignItems: 'center' },
  timeLabel: { fontSize: 11, color: '#6B7280', fontWeight: 'bold', marginBottom: 2 },
  timeValue: { fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' },
  badgeOnTime: { fontSize: 10, color: '#059669', fontWeight: 'bold', marginTop: 3 },
  badgeLate: { fontSize: 10, color: '#DC2626', fontWeight: 'bold', marginTop: 3 },
  badgeEarly: { fontSize: 10, color: '#D97706', fontWeight: 'bold', marginTop: 3 },
  honorBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10 },
  honorBadgeLabel: { fontSize: 11, fontWeight: 'bold', color: '#065F46' },
  honorBadgeVal: { fontSize: 13, fontWeight: 'bold', color: '#047857' },

  // EMPTY STATES
  emptyStateBox: { alignItems: 'center', paddingVertical: 14 },
  emptyStateTitle: { fontSize: 13, fontWeight: 'bold', color: '#374151', marginTop: 8 },
  emptyStateDesc: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 4, paddingHorizontal: 10 },
  btnIzinOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F3F4F6' },
  btnIzinText: { fontSize: 12, color: '#4B5563', fontWeight: 'bold' },
  reasonBox: { alignItems: 'center', padding: 14, backgroundColor: '#F9FAFB', borderRadius: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 6 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  reasonText: { fontSize: 12, color: '#4B5563' },
  emptyKbmBox: { alignItems: 'center', paddingVertical: 16 },

  // KBM LIST
  kbmListContainer: { gap: 10 },
  kbmItemCard: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 12 },
  kbmItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kbmKelasTitle: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  kbmMapelTitle: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: 'bold' },
  kbmItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  kbmItemTime: { fontSize: 11, color: '#4B5563' },
  invalBadge: { fontSize: 10, color: '#D97706', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: 'bold' },
  kbmItemHonorRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  kbmItemHonorLabel: { fontSize: 11, color: '#6B7280' },
  kbmItemHonorVal: { fontSize: 12, fontWeight: 'bold', color: '#059669' },

  // QUICK LINKS
  quickLinksRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  quickLinkBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  quickLinkText: { fontSize: 10, fontWeight: 'bold', color: '#374151' },

  // OPERATOR REKAP STYLES
  rekapContainer: { flex: 1 },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  dateArrow: { padding: 6, backgroundColor: '#F3F4F6', borderRadius: 8 },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateCenterText: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  searchBox: { padding: 12, backgroundColor: '#fff' },
  searchInput: { backgroundColor: '#F3F4F6', padding: 10, borderRadius: 10, fontSize: 13 },
  listContainer: { padding: 12 },
  rekapCard: { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  rekapCardLeft: { flex: 1 },
  rekapName: { fontSize: 14, fontWeight: 'bold', color: '#1F2937' },
  rekapStatus: { fontSize: 11, fontWeight: 'bold' },
  rekapTimeText: { fontSize: 11, color: '#6B7280' },
  rekapHonorText: { fontSize: 13, fontWeight: 'bold', color: '#059669' },

  // FULLSCREEN CAMERA
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraHeader: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  closeCameraBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  cameraHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  scannerCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanTargetBox: { width: 250, height: 250, position: 'relative', overflow: 'hidden' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#10B981' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  scanLaser: { width: '100%', height: 2, backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 6, elevation: 6 },
  scanTipBox: { marginTop: 24, paddingHorizontal: 20, alignItems: 'center' },
  scanInstruction: { color: '#fff', fontSize: 12, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  scanSubInstruction: { color: '#A7F3D0', fontSize: 10, textAlign: 'center', marginTop: 6 },

  // MODAL IZIN
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#4B5563', marginBottom: 6 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#F3F4F6' },
  chipActive: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#1E257F' },
  chipText: { fontSize: 13, color: '#4B5563' },
  chipTextActive: { color: '#1E257F', fontWeight: 'bold' },
  inputField: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 13, color: '#1F2937' },
  saveBtn: { backgroundColor: '#1E257F', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});
