import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform, DeviceEventEmitter, ToastAndroid, Modal } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import CryptoJS from 'crypto-js';
import * as Animatable from 'react-native-animatable';
import { Clock, Search, QrCode, CheckCircle, AlertCircle, Calendar, FileText, ChevronLeft, ChevronRight, UserCheck, XCircle, PieChart, Filter, Settings, AlertTriangle, Send, Printer, CalendarDays, Eye, X, ShieldAlert } from 'lucide-react-native';
import { router } from 'expo-router';
import CustomDatePicker from '../components/CustomDatePicker';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getOperationalDate, getOperationalDayIndex, getLocalDate } from '../utils/dateUtils';

export default function PresensiSiswa() {
  const [currentTab, setCurrentTab] = useState<'scan' | 'manual' | 'rekap' | 'peringatan'>('scan');
  const [tanggal, setTanggal] = useState(getLocalDate());
  
  // Camera & Scan
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Settings Kedisiplinan & Master Jam Global
  const [jamMasuk, setJamMasuk] = useState('07:00');
  const [jamPulang, setJamPulang] = useState('13:00');
  const [namaOpsi, setNamaOpsi] = useState('Reguler');

  const fetchActiveMasterJam = async () => {
    try {
      const { data } = await supabase.from('master_jam_presensi').select('jam_masuk, jam_pulang, tipe_hari').eq('is_active', true).maybeSingle();
      if (data) {
        if (data.jam_masuk) setJamMasuk(data.jam_masuk.substring(0, 5));
        const isJumat = getOperationalDayIndex() === 5;
        setJamPulang(isJumat ? '10:40' : (data.jam_pulang ? data.jam_pulang.substring(0, 5) : '13:00'));
        if (data.tipe_hari) setNamaOpsi(data.tipe_hari);
      }
    } catch (err) {
      console.log('Error loading active master jam presensi:', err);
    }
  };

  useEffect(() => {
    fetchActiveMasterJam();
  }, []);

  // Manual Mode
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [manualKelas, setManualKelas] = useState('');
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([]);
  const [manualStatus, setManualStatus] = useState('Sakit');
  const [manualAlasan, setManualAlasan] = useState('');
  const [showManualDatePicker, setShowManualDatePicker] = useState(false);

  // Rekap Advanced Filter State
  const [rekapFilterMode, setRekapFilterMode] = useState<'harian' | 'mingguan' | 'bulanan' | 'semester'>('harian');
  const [rekapTanggal, setRekapTanggal] = useState(getLocalDate());
  const [rekapWeekOffset, setRekapWeekOffset] = useState(0);
  const [rekapBulan, setRekapBulan] = useState(new Date().getMonth() + 1);
  const [rekapTahun, setRekapTahun] = useState(new Date().getFullYear());
  const [rekapFilterKelas, setRekapFilterKelas] = useState('Semua');
  const [rekapFilterStatus, setRekapFilterStatus] = useState('Semua');
  const [rekapSearch, setRekapSearch] = useState('');
  const [availableRekapKelas, setAvailableRekapKelas] = useState<string[]>([]);
  const [rekapData, setRekapData] = useState<any[]>([]);
  const [isRekapLoading, setIsRekapLoading] = useState(false);

  // Peringatan Mode State
  const [peringatanFilterMode, setPeringatanFilterMode] = useState<'semua' | '7_hari' | 'mingguan' | '30_hari' | 'bulanan'>('semua');
  const [peringatanWeekOffset, setPeringatanWeekOffset] = useState(0);
  const [peringatanBulan, setPeringatanBulan] = useState(new Date().getMonth() + 1);
  const [peringatanTahun, setPeringatanTahun] = useState(new Date().getFullYear());
  const [peringatanFilterKelas, setPeringatanFilterKelas] = useState('Semua');
  const [peringatanSearch, setPeringatanSearch] = useState('');
  const [peringatanData, setPeringatanData] = useState<any[]>([]);
  const [isPeringatanLoading, setIsPeringatanLoading] = useState(false);
  const [warningSummary, setWarningSummary] = useState({ totalSiswa: 0, count7Days: 0, count30Days: 0, mingguanCount: 0, bulananCount: 0, totalKasus: 0 });
  const [selectedViolator, setSelectedViolator] = useState<any | null>(null);

  // Identitas Lembaga & Kepala Sekolah dari Database
  const [dataLembaga, setDataLembaga] = useState<any>({
    nama_lembaga: 'SMP IT Hidayatul Mubtadi-ien',
    nama_yayasan: 'Yayasan Hidayatul Mubtadi-ien',
    npsn: '70004822',
    akreditasi: 'C',
    alamat: 'Dusun Sukaseneng RT 025 RW 010 Desa Compreng Kec. Compreng Kab. Subang',
    kode_pos: '41258',
    telepon: '',
    email: '',
    website: '',
    logo_url: '',
    kepala_sekolah: 'Abdul Manaf, S.Pd',
    nip_kepsek: '-'
  });
  const [dataKepsek, setDataKepsek] = useState({
    nama: 'Abdul Manaf, S.Pd',
    nip: '',
    nuptk: '',
    niy: '',
    nipLabel: ''
  });

  const fetchLembagaAndKepsek = async () => {
    try {
      const { data: lemb } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (lemb) {
        setDataLembaga(lemb);
      }

      let kepsekGuru: any = null;
      try {
        const { data: jg } = await supabase
          .from('jabatan_guru')
          .select('guru_id, jabatan_utama')
          .ilike('jabatan_utama', '%kepala sekolah%')
          .limit(1)
          .maybeSingle();

        if (jg?.guru_id) {
          const { data: g } = await supabase
            .from('data_guru')
            .select('id, nama, nip, nuptk, niy, no_wa')
            .eq('id', jg.guru_id)
            .maybeSingle();
          if (g) kepsekGuru = g;
        }
      } catch (e) {
        console.warn('Gagal fetch jabatan_guru:', e);
      }

      if (!kepsekGuru && lemb?.kepala_sekolah) {
        const cleanName = lemb.kepala_sekolah.split(',')[0].trim();
        const { data: g } = await supabase
          .from('data_guru')
          .select('id, nama, nip, nuptk, niy, no_wa')
          .ilike('nama', `%${cleanName}%`)
          .limit(1)
          .maybeSingle();
        if (g) kepsekGuru = g;
      }

      if (kepsekGuru) {
        let nipLabel = '';
        if (kepsekGuru.nip && kepsekGuru.nip !== '-') {
          nipLabel = `NIP. ${kepsekGuru.nip}`;
        } else if (kepsekGuru.niy && kepsekGuru.niy !== '-') {
          nipLabel = `NIY. ${kepsekGuru.niy}`;
        } else if (kepsekGuru.nuptk && kepsekGuru.nuptk !== '-') {
          nipLabel = `NUPTK. ${kepsekGuru.nuptk}`;
        }

        setDataKepsek({
          nama: kepsekGuru.nama || lemb?.kepala_sekolah || 'Abdul Manaf, S.Pd',
          nip: kepsekGuru.nip || '',
          nuptk: kepsekGuru.nuptk || '',
          niy: kepsekGuru.niy || '',
          nipLabel
        });
      } else if (lemb?.kepala_sekolah) {
        setDataKepsek({
          nama: lemb.kepala_sekolah,
          nip: lemb.nip_kepsek && lemb.nip_kepsek !== '-' ? lemb.nip_kepsek : '',
          nuptk: '',
          niy: '',
          nipLabel: lemb.nip_kepsek && lemb.nip_kepsek !== '-' ? `NIP. ${lemb.nip_kepsek}` : ''
        });
      }
    } catch (err) {
      console.error('Error fetching data lembaga/kepsek:', err);
    }
  };

  const bulanNamaList = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const getWeekRangeByOffset = (offset = 0) => {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1 + (offset * 7));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const startStr = getLocalDate(monday);
    const endStr = getLocalDate(saturday);
    return { monday, saturday, startStr, endStr };
  };

  const formatWeekRangeLabel = (arg1: any, arg2?: any) => {
    let monday: Date, saturday: Date;
    if (typeof arg1 === 'number') {
      const range = getWeekRangeByOffset(arg1);
      monday = range.monday;
      saturday = range.saturday;
    } else {
      monday = arg1;
      saturday = arg2;
    }
    if (!monday || !saturday) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${monday.getDate()} ${months[monday.getMonth()]} - ${saturday.getDate()} ${months[saturday.getMonth()]} ${saturday.getFullYear()}`;
  };

  const SECRET_KEY = process.env.EXPO_PUBLIC_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";
  const FONNTE_TOKEN = process.env.EXPO_PUBLIC_FONNTE_TOKEN || "";

  useEffect(() => {
    if (currentTab === 'manual') fetchSiswaData();
    else if (currentTab === 'rekap') fetchRekapData();
    else if (currentTab === 'peringatan') fetchPeringatanData();
  }, [
    currentTab, 
    tanggal, 
    rekapFilterMode, 
    rekapTanggal, 
    rekapWeekOffset, 
    rekapBulan, 
    rekapTahun, 
    peringatanFilterMode, 
    peringatanWeekOffset, 
    peringatanBulan, 
    peringatanTahun
  ]);

  // Load badge & lembaga on mount
  useEffect(() => {
    fetchPeringatanData();
    fetchLembagaAndKepsek();
  }, []);

  useEffect(() => {
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in presensi-siswa.tsx');
      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }
      fetchActiveMasterJam();
      if (currentTab === 'manual') fetchSiswaData();
      else if (currentTab === 'rekap') fetchRekapData();
      else if (currentTab === 'peringatan') fetchPeringatanData();
    });
    return () => listener.remove();
  }, [
    currentTab, 
    tanggal, 
    rekapFilterMode, 
    rekapTanggal, 
    rekapWeekOffset, 
    rekapBulan, 
    rekapTahun, 
    peringatanFilterMode, 
    peringatanWeekOffset, 
    peringatanBulan, 
    peringatanTahun
  ]);

  // Helper Functions
  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
  };

  const getTahunAjaranSemester = () => {
    const d = new Date(tanggal);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const semester = m >= 7 ? 'Ganjil' : 'Genap';
    const tahun_ajaran = m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
    return { tahun_ajaran, semester };
  };

  const sendWhatsAppNotification = async (nama: string, kelas: string, wa_ortu: string, status: string, waktu: string) => {
    try {
      if (!FONNTE_TOKEN) {
        console.log("Fonnte Token tidak ada, skip WA.");
        return;
      }
      let noWa = (wa_ortu || '').toString().replace(/\D/g, '');
      if (noWa.startsWith('0')) noWa = '62' + noWa.substring(1);
      if (!noWa || noWa.length < 9) return;

      const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const pesan = `*NOTIFIKASI ABSENSI SMP IT HM*\n\nYth. Bapak/Ibu Wali Murid,\nMemberitahukan bahwa ananda:\n\nNama: *${nama}*\nKelas: *${kelas}*\nStatus: *${status}*\nWaktu: *${waktu}*\n\nTerima kasih.\n\n_Ref: ${uniqueId}_`;

      const formData = new FormData();
      formData.append('target', noWa);
      formData.append('message', pesan);
      const randomDelay = Math.floor(Math.random() * (30 - 15 + 1)) + 15;
      formData.append('delay', randomDelay.toString());

      fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 
          'Authorization': FONNTE_TOKEN
        },
        body: formData
      }).then(res => res.text()).then(text => console.log('Fonnte Res:', text)).catch(err => console.error('Fonnte API error:', err));
    } catch (e) {
      console.error('Gagal WA:', e);
    }
  };

  const sendPushNotification = async (nipd: string, title: string, body: string) => {
    try {
      const { data } = await supabase.from('user_push_tokens').select('expo_push_token').eq('nipd', nipd).maybeSingle();
      if (data && data.expo_push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: data.expo_push_token,
            sound: 'default',
            title: title,
            body: body,
            data: { route: '/dashboard' },
          }),
        });
      }
    } catch (e) {
      console.log('Gagal Push Notif:', e);
    }
  };

  // ===============================
  // SCAN LOGIC
  // ===============================

  const handleBarcodeScanned = async ({ type, data }: { type: string, data: string }) => {
    if (scanned || isProcessing) return;
    setScanned(true);
    setIsProcessing(true);

    let nipd = '';
    try {
      const bytes = CryptoJS.AES.decrypt(data, SECRET_KEY);
      nipd = bytes.toString(CryptoJS.enc.Utf8).trim();
      if (!nipd) throw new Error('Dekripsi kosong');
    } catch (e) {
      Alert.alert('Tidak Valid', 'QR Code tidak dikenali atau bukan format resmi aplikasi.');
      setTimeout(() => { setScanned(false); setIsProcessing(false); }, 3000);
      return;
    }

    try {
      const { data: dataSiswa, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('nipd, nama, kelas, wa_ortu')
        .eq('nipd', nipd)
        .maybeSingle();

      if (errSiswa || !dataSiswa) {
        Alert.alert('Tidak Ditemukan', `Siswa dengan NIPD ${nipd} tidak ada di database.`);
        setTimeout(() => { setScanned(false); setIsProcessing(false); }, 3000);
        return;
      }

      const { data: existingDataList, error: errCheck } = await supabase
        .from('presensi_siswa')
        .select('*')
        .eq('nipd', nipd)
        .eq('tanggal', tanggal)
        .order('created_at', { ascending: false })
        .limit(1);

      if (errCheck) throw errCheck;
      const existingData = existingDataList && existingDataList.length > 0 ? existingDataList[0] : null;

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const jM = timeToMinutes(jamMasuk);
      const jP = timeToMinutes(jamPulang);

      if (!existingData || ['Alfa', 'Bolos'].includes(existingData.status)) {
        let actStatus = 'Hadir (Blm Pulang)';
        if (timeToMinutes(currentTime) > jM) actStatus = 'Terlambat';

        const { tahun_ajaran, semester } = getTahunAjaranSemester();
        const payload = {
          nipd: dataSiswa.nipd,
          nama: dataSiswa.nama,
          kelas: dataSiswa.kelas,
          tanggal: tanggal,
          waktu_masuk: currentTime,
          status: actStatus,
          alasan: '-',
          tahun_ajaran,
          semester
        };
        
        if (!existingData) {
          const { error: errInsert } = await supabase.from('presensi_siswa').insert(payload);
          if (errInsert) throw errInsert;
        } else {
          const { error: errUpdate } = await supabase.from('presensi_siswa').update(payload).eq('id', existingData.id);
          if (errUpdate) throw errUpdate;
        }

        Alert.alert('TAP MASUK BERHASIL', `${dataSiswa.nama}\nWaktu: ${currentTime}`);
        sendWhatsAppNotification(dataSiswa.nama, dataSiswa.kelas, dataSiswa.wa_ortu, actStatus, currentTime);
        sendPushNotification(dataSiswa.nipd, 'Tap Masuk Berhasil', `Ananda ${dataSiswa.nama} telah melakukan tap masuk pada ${currentTime} dengan status: ${actStatus}.`);
      } else {
        if (existingData.status.includes('Izin') || existingData.status.includes('Sakit') || existingData.status.includes('Dispensasi')) {
          Alert.alert('Info', `Siswa ini sudah diabsen dengan status ${existingData.status} hari ini!`);
          setTimeout(() => { setScanned(false); setIsProcessing(false); }, 2000);
          return;
        }

        if (existingData.waktu_masuk && existingData.waktu_pulang) {
          Alert.alert('Info', 'Siswa sudah melakukan Tap Pulang hari ini!');
          setTimeout(() => { setScanned(false); setIsProcessing(false); }, 2000);
          return;
        }

        if (existingData.waktu_masuk) {
          const diffMins = timeToMinutes(currentTime) - timeToMinutes(existingData.waktu_masuk);
          if (diffMins < 5) {
            Alert.alert('Peringatan', 'Tap terlalu cepat! Beri jeda minimal 5 menit dari Tap Masuk sebelumnya.');
            setTimeout(() => { setScanned(false); setIsProcessing(false); }, 2000);
            return;
          }

          if (timeToMinutes(currentTime) < timeToMinutes('10:00')) {
            Alert.alert('Peringatan', `Ananda sudah Tap Masuk pada pukul ${existingData.waktu_masuk}. Saat ini belum waktunya Tap Pulang!`);
            setTimeout(() => { setScanned(false); setIsProcessing(false); }, 2000);
            return;
          }

          let actStatus = 'Hadir';
          if (timeToMinutes(existingData.waktu_masuk) > jM) actStatus = 'Terlambat';
          else if (timeToMinutes(currentTime) < jP) actStatus = 'Bolos';

          const { error: errUpdate } = await supabase
            .from('presensi_siswa')
            .update({ waktu_pulang: currentTime, status: actStatus })
            .eq('id', existingData.id);

          if (errUpdate) throw errUpdate;

          Alert.alert('TAP PULANG BERHASIL', `${dataSiswa.nama}\nWaktu: ${currentTime}`);
          sendWhatsAppNotification(dataSiswa.nama, dataSiswa.kelas, dataSiswa.wa_ortu, actStatus, currentTime);
          sendPushNotification(dataSiswa.nipd, 'Tap Pulang Berhasil', `Ananda ${dataSiswa.nama} telah melakukan tap pulang pada ${currentTime}.`);
        }
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', `Gagal memproses presensi: ${e.message}`);
    } finally {
      setTimeout(() => {
        setScanned(false);
        setIsProcessing(false);
      }, 3000);
    }
  };

  // ===============================
  // MANUAL LOGIC
  // ===============================
  const fetchSiswaData = async () => {
    setIsManualLoading(true);
    try {
      const { data: dataSiswa, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('id, nipd, nama, kelas, status_keaktifan, wa_ortu')
        .ilike('status_keaktifan', 'aktif')
        .order('nama');
      if (errSiswa) throw errSiswa;

      const { data: dataAbsen, error: errAbsen } = await supabase
        .from('presensi_siswa')
        .select('nipd')
        .eq('tanggal', tanggal);
      if (errAbsen) throw errAbsen;

      const absenNipds = (dataAbsen || []).map(a => a.nipd);
      const siswaBelumAbsen = (dataSiswa || []).filter(s => !absenNipds.includes(s.nipd));
      
      setSiswaList(siswaBelumAbsen);
      const uniqueKelas = [...new Set(siswaBelumAbsen.map(s => s.kelas).filter(Boolean))].sort() as string[];
      setAvailableKelas(uniqueKelas);
      if (uniqueKelas.length > 0 && !manualKelas) setManualKelas(uniqueKelas[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsManualLoading(false);
    }
  };

  const submitBulkManual = async () => {
    if (selectedSiswaIds.length === 0) return Alert.alert('Perhatian', 'Pilih minimal 1 siswa.');
    
    setIsProcessing(true);
    try {
      const { tahun_ajaran, semester } = getTahunAjaranSemester();
      const now = new Date();
      const jamSekarang = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const selectedSiswaList = siswaList.filter(s => selectedSiswaIds.includes(s.nipd));
      const payloadArray = selectedSiswaList.map(siswa => ({
        nipd: siswa.nipd,
        nama: siswa.nama,
        kelas: siswa.kelas,
        tanggal: tanggal,
        waktu_masuk: null,
        waktu_pulang: null,
        status: manualStatus,
        alasan: manualAlasan || '-',
        tahun_ajaran,
        semester
      }));

      // Hapus data lama (jika ada) agar tidak bentrok onConflict
      const nipdList = payloadArray.map(p => p.nipd);
      await supabase.from('presensi_siswa').delete().in('nipd', nipdList).eq('tanggal', tanggal);

      const { error } = await supabase.from('presensi_siswa').insert(payloadArray);
      if (error) throw error;

      Alert.alert('Berhasil', `Presensi ${manualStatus} untuk ${payloadArray.length} siswa berhasil disimpan.`);
      
      let delayMs = 0;
      selectedSiswaList.forEach((siswa, index) => {
        const randomMs = Math.floor(Math.random() * (15000)) + 15000;
        delayMs += (index === 0 ? 0 : randomMs);
        setTimeout(() => {
          sendWhatsAppNotification(siswa.nama, siswa.kelas, siswa.wa_ortu, manualStatus, jamSekarang);
        }, delayMs);
      });

      setSelectedSiswaIds([]);
      setManualAlasan('');
      fetchSiswaData();
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredSiswa = manualKelas ? siswaList.filter(s => String(s.kelas) === manualKelas) : [];

  // ===============================
  // REKAP LOGIC
  // ===============================
  // ===============================
  // REKAP LOGIC
  // ===============================
  const fetchRekapData = async () => {
    setIsRekapLoading(true);
    try {
      let startDateStr = '', endDateStr = '';

      if (rekapFilterMode === 'harian') {
        startDateStr = rekapTanggal;
        endDateStr = rekapTanggal;
      } else if (rekapFilterMode === 'mingguan') {
        const { startStr, endStr } = getWeekRangeByOffset(rekapWeekOffset);
        startDateStr = startStr;
        endDateStr = endStr;
      } else if (rekapFilterMode === 'bulanan') {
        const firstDay = new Date(rekapTahun, rekapBulan - 1, 1);
        const lastDay = new Date(rekapTahun, rekapBulan, 0);
        startDateStr = getLocalDate(firstDay);
        endDateStr = getLocalDate(lastDay);
      } else if (rekapFilterMode === 'semester') {
        const m = new Date().getMonth();
        const y = new Date().getFullYear();
        if (m >= 6) {
          startDateStr = `${y}-07-01`;
          endDateStr = `${y}-12-31`;
        } else {
          startDateStr = `${y}-01-01`;
          endDateStr = `${y}-06-30`;
        }
      }

      let query = supabase.from('presensi_siswa').select('*').order('tanggal', { ascending: false }).order('waktu_masuk', { ascending: false });
      if (startDateStr && endDateStr) query = query.gte('tanggal', startDateStr).lte('tanggal', endDateStr);

      const { data, error } = await query;
      if (error) throw error;
      const todayStr = getLocalDate();
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const pulangMinutes = timeToMinutes(jamPulang);

      const finalData = (data || []).map(d => {
        let evalStatus = d.status || '';
        
        if (d.waktu_masuk && !d.waktu_pulang) {
          const isHadirOrTerlambat = evalStatus.includes('Hadir') || evalStatus.includes('Terlambat');
          const isPastDate = d.tanggal < todayStr;
          const isPastJamPulang = currentMinutes > pulangMinutes;
          
          if (isHadirOrTerlambat && (isPastDate || (d.tanggal === todayStr && isPastJamPulang))) {
            evalStatus = 'Bolos';
          }
        }

        return {
          ...d,
          status: evalStatus
        };
      });

      setRekapData(finalData);

      const uniqueKelas = [...new Set(finalData.map(d => String(d.kelas)).filter(Boolean))].sort() as string[];
      setAvailableRekapKelas(uniqueKelas);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRekapLoading(false);
    }
  };

  const filteredRekapData = useMemo(() => {
    return rekapData.filter(d => {
      if (rekapFilterKelas !== 'Semua' && String(d.kelas) !== rekapFilterKelas) return false;
      if (rekapFilterStatus !== 'Semua') {
        if (rekapFilterStatus === 'Hadir' && !d.status.includes('Hadir')) return false;
        if (rekapFilterStatus === 'Terlambat' && !d.status.includes('Terlambat')) return false;
        if (rekapFilterStatus === 'Bolos' && !(d.status.includes('Bolos') || d.status === 'Alfa')) return false;
        if (rekapFilterStatus === 'Izin' && !(d.status.includes('Izin') || d.status.includes('Sakit') || d.status.includes('Dispensasi'))) return false;
      }
      if (rekapSearch) {
        const q = rekapSearch.toLowerCase();
        const mNama = (d.nama || '').toLowerCase().includes(q);
        const mNipd = (d.nipd || '').includes(q);
        if (!mNama && !mNipd) return false;
      }
      return true;
    });
  }, [rekapData, rekapFilterKelas, rekapFilterStatus, rekapSearch]);

  let rHadir = 0, rIzin = 0, rTerlambat = 0, rBolos = 0;
  filteredRekapData.forEach(d => {
    const st = d.status || '';
    if (st.includes('Hadir')) rHadir++;
    if (st.includes('Izin') || st.includes('Sakit') || st.includes('Dispensasi')) rIzin++;
    if (st.includes('Terlambat')) rTerlambat++;
    if (st.includes('Bolos') || st === 'Alfa') rBolos++;
  });

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    availableKelas.forEach(k => { if (k) set.add(String(k)); });
    availableRekapKelas.forEach(k => { if (k) set.add(String(k)); });
    peringatanData.forEach(p => { if (p.kelas) set.add(String(p.kelas)); });
    return Array.from(set).sort();
  }, [availableKelas, availableRekapKelas, peringatanData]);

  // ===============================
  // PERINGATAN LOGIC
  // ===============================
  const fetchPeringatanData = async () => {
    setIsPeringatanLoading(true);
    try {
      const todayObj = new Date();
      const todayStr = getLocalDate(todayObj);

      // Rentang 7 Hari Terakhir
      const d7 = new Date(todayObj);
      d7.setDate(todayObj.getDate() - 6);
      const start7Str = getLocalDate(d7);

      // Rentang 30 Hari Terakhir
      const d30 = new Date(todayObj);
      d30.setDate(todayObj.getDate() - 29);
      const start30Str = getLocalDate(d30);

      // Periode Bulan terpilih
      const firstDayMonth = new Date(peringatanTahun, peringatanBulan - 1, 1);
      const lastDayMonth = new Date(peringatanTahun, peringatanBulan, 0);
      const monthStartStr = getLocalDate(firstDayMonth);
      const monthEndStr = getLocalDate(lastDayMonth);

      // Periode Minggu terpilih (Senin - Sabtu)
      const { startStr: weekStartStr, endStr: weekEndStr } = getWeekRangeByOffset(peringatanWeekOffset);

      const allStarts = [start7Str, start30Str, weekStartStr, monthStartStr].sort();
      const allEnds = [todayStr, weekEndStr, monthEndStr].sort();
      const minDate = allStarts[0];
      const maxDate = allEnds[allEnds.length - 1];

      const { data: rawPresensi, error: errPresensi } = await supabase
        .from('presensi_siswa')
        .select('*')
        .in('status', ['Terlambat', 'Bolos', 'Alfa', 'Hadir (Blm Pulang)'])
        .gte('tanggal', minDate)
        .lte('tanggal', maxDate)
        .order('tanggal', { ascending: false });

      if (errPresensi) throw errPresensi;

      const { data: siswaData } = await supabase
        .from('data_siswa')
        .select('nipd, nama, kelas, wa_ortu')
        .ilike('status_keaktifan', 'aktif');

      const siswaMap: Record<string, any> = {};
      (siswaData || []).forEach(s => { siswaMap[s.nipd] = s; });

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const pulangMinutes = timeToMinutes(jamPulang);

      const evaluasiList = (rawPresensi || []).map(d => {
        let st = d.status;
        if (st === 'Hadir (Blm Pulang)') {
          const isPastDate = d.tanggal < todayStr;
          const isPastJamPulang = currentMinutes > pulangMinutes;
          if (isPastDate || (d.tanggal === todayStr && isPastJamPulang)) {
            st = 'Bolos';
          }
        }
        return {
          ...d,
          status: st,
          nama: siswaMap[d.nipd]?.nama || d.nama || 'Siswa',
          kelas: siswaMap[d.nipd]?.kelas || d.kelas || '-',
          wa_ortu: siswaMap[d.nipd]?.wa_ortu || ''
        };
      }).filter(d => ['Terlambat', 'Bolos', 'Alfa'].includes(d.status));

      const violatorMap: Record<string, any> = {};
      evaluasiList.forEach(p => {
        if (!violatorMap[p.nipd]) {
          violatorMap[p.nipd] = {
            nipd: p.nipd,
            nama: p.nama,
            kelas: p.kelas,
            wa_ortu: p.wa_ortu,
            violationsMonth: [],
            violationsWeek: [],
            violations7Days: [],
            violations30Days: [],
            allViolations: []
          };
        }
        if (p.tanggal >= monthStartStr && p.tanggal <= monthEndStr) violatorMap[p.nipd].violationsMonth.push(p);
        if (p.tanggal >= weekStartStr && p.tanggal <= weekEndStr) violatorMap[p.nipd].violationsWeek.push(p);
        if (p.tanggal >= start7Str && p.tanggal <= todayStr) violatorMap[p.nipd].violations7Days.push(p);
        if (p.tanggal >= start30Str && p.tanggal <= todayStr) violatorMap[p.nipd].violations30Days.push(p);
        violatorMap[p.nipd].allViolations.push(p);
      });

      let result: any[] = [];
      let mCount = 0, bCount = 0, count7DaysTotal = 0, count30DaysTotal = 0, totalKasus = 0;

      Object.values(violatorMap).forEach((v: any) => {
        const countMinggu = v.violationsWeek.length;
        const countBulan = v.violationsMonth.length;
        const count7Days = v.violations7Days.length;
        const count30Days = v.violations30Days.length;

        const isMingguan = countMinggu >= 3;
        const isBulanan = countBulan >= 6;
        const is7Days = count7Days >= 3;
        const is30Days = count30Days >= 6;

        if (isMingguan) mCount++;
        if (isBulanan) bCount++;
        if (is7Days) count7DaysTotal++;
        if (is30Days) count30DaysTotal++;

        if (isMingguan || isBulanan || is7Days || is30Days) {
          const candidateLists = [v.violations30Days, v.violationsMonth, v.violations7Days, v.violationsWeek];
          candidateLists.sort((a, b) => b.length - a.length);
          const vList = candidateLists[0] || v.allViolations;

          const jmlTerlambat = vList.filter((x: any) => x.status === 'Terlambat').length;
          const jmlBolos = vList.filter((x: any) => x.status === 'Bolos').length;
          const jmlAlfa = vList.filter((x: any) => x.status === 'Alfa').length;
          totalKasus += vList.length;

          let levelPeringatan = '';
          if (isBulanan || is30Days) {
            levelPeringatan = 'Peringatan Bulanan (≥6x)';
          } else if (isMingguan || is7Days) {
            levelPeringatan = 'Peringatan Mingguan (≥3x)';
          } else {
            levelPeringatan = 'Peringatan Kedisiplinan';
          }

          result.push({
            nipd: v.nipd,
            nama: v.nama,
            kelas: v.kelas,
            wa_ortu: v.wa_ortu,
            countMinggu,
            countBulan,
            count7Days,
            count30Days,
            isMingguan,
            isBulanan,
            is7Days,
            is30Days,
            levelPeringatan,
            jmlTerlambat,
            jmlBolos,
            jmlAlfa,
            totalPelanggaran: Math.max(countBulan, countMinggu, count7Days, count30Days),
            violationsList: v.allViolations
          });
        }
      });

      result.sort((a, b) => b.totalPelanggaran - a.totalPelanggaran);

      setPeringatanData(result);
      setWarningSummary({
        totalSiswa: result.length,
        count7Days: count7DaysTotal,
        count30Days: count30DaysTotal,
        mingguanCount: mCount,
        bulananCount: bCount,
        totalKasus
      });

    } catch (e) {
      console.error(e);
    } finally {
      setIsPeringatanLoading(false);
    }
  };

  const filteredPeringatanData = useMemo(() => {
    return peringatanData.filter(item => {
      if (peringatanFilterMode === '7_hari' && !item.is7Days) return false;
      if (peringatanFilterMode === '30_hari' && !item.is30Days) return false;
      if (peringatanFilterMode === 'mingguan' && !item.isMingguan) return false;
      if (peringatanFilterMode === 'bulanan' && !item.isBulanan) return false;

      if (peringatanFilterKelas !== 'Semua' && String(item.kelas) !== peringatanFilterKelas) return false;

      if (peringatanSearch) {
        const q = peringatanSearch.toLowerCase();
        const mNama = (item.nama || '').toLowerCase().includes(q);
        const mNipd = (item.nipd || '').includes(q);
        if (!mNama && !mNipd) return false;
      }

      return true;
    });
  }, [peringatanData, peringatanFilterMode, peringatanFilterKelas, peringatanSearch]);

  const sendSPWA = (siswa: any) => {
    const namaSekolah = (dataLembaga.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase();
    const text = `*SURAT PERINGATAN KEDISIPLINAN SISWA*\n*${namaSekolah}*\n\nYth. Bapak/Ibu Wali Murid dari:\nNama: *${siswa.nama}*\nKelas: *${siswa.kelas}*\n\nMemberitahukan bahwa ananda telah tercatat melanggar kedisiplinan presensi sekolah sebanyak *${siswa.totalPelanggaran} kali*:\n- Terlambat: ${siswa.jmlTerlambat}x\n- Bolos: ${siswa.jmlBolos}x\n- Alfa: ${siswa.jmlAlfa}x\n\nKategori Peringatan: *${siswa.levelPeringatan}*\n\nMohon bimbingan dan kerja sama Bapak/Ibu agar ananda hadir tertib dan tepat waktu di sekolah.\n\nTerima kasih.`;
    if (!siswa.wa_ortu) {
       Alert.alert('Gagal', 'Nomor WA orang tua tidak ditemukan.');
       return;
    }
    Alert.alert('Kirim SP', `Kirim Surat Peringatan via WA ke ortu ${siswa.nama} (${siswa.wa_ortu})?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Kirim', onPress: () => {
         let noWa = (siswa.wa_ortu || '').toString().replace(/\D/g, '');
         if (noWa.startsWith('0')) noWa = '62' + noWa.substring(1);
         const formData = new FormData();
         formData.append('target', noWa);
         formData.append('message', text);
         fetch('https://api.fonnte.com/send', {
           method: 'POST',
           headers: { 'Authorization': FONNTE_TOKEN },
           body: formData
         }).then(() => Alert.alert('Berhasil', 'Surat Peringatan telah dikirim via WhatsApp.'))
           .catch(() => Alert.alert('Gagal', 'Terjadi kesalahan pengiriman WA.'));
      }}
    ]);
  };

  const handleCetakSuratPeringatan = async (siswa: any) => {
    let Print;
    try {
      Print = require('expo-print');
    } catch (e) {
      Alert.alert('Update Diperlukan', 'Fitur cetak membutuhkan build APK terbaru. Silakan jalankan "eas build".');
      return;
    }

    // Pastikan data lembaga & kepala sekolah mutakhir dari database
    let currentLembaga = dataLembaga;
    let currentKepsek = dataKepsek;
    try {
      const { data: lemb } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (lemb) {
        currentLembaga = lemb;
        setDataLembaga(lemb);
      }
      const { data: jg } = await supabase
        .from('jabatan_guru')
        .select('guru_id, jabatan_utama')
        .ilike('jabatan_utama', '%kepala sekolah%')
        .limit(1)
        .maybeSingle();
      if (jg?.guru_id) {
        const { data: g } = await supabase
          .from('data_guru')
          .select('id, nama, nip, nuptk, niy')
          .eq('id', jg.guru_id)
          .maybeSingle();
        if (g) {
          let nipLabel = '';
          if (g.nip && g.nip !== '-') nipLabel = `NIP. ${g.nip}`;
          else if (g.niy && g.niy !== '-') nipLabel = `NIY. ${g.niy}`;
          else if (g.nuptk && g.nuptk !== '-') nipLabel = `NUPTK. ${g.nuptk}`;
          currentKepsek = { nama: g.nama, nip: g.nip || '', nuptk: g.nuptk || '', niy: g.niy || '', nipLabel };
          setDataKepsek(currentKepsek);
        }
      }
    } catch (e) {
      console.warn('Fallback to current state:', e);
    }

    const d = new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const tglSekarang = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: 'Times New Roman', serif; color: #111; line-height: 1.5; padding: 15px; }
            .kop { text-align: center; border-bottom: 3px double #111; padding-bottom: 8px; margin-bottom: 16px; }
            .kop h3 { margin: 0; font-size: 14px; text-transform: uppercase; font-weight: bold; }
            .kop h2 { margin: 2px 0; font-size: 20px; text-transform: uppercase; font-weight: bold; color: #1e1b4b; }
            .kop p { margin: 1px 0; font-size: 11px; color: #4b5563; }
            .title { font-size: 14px; font-weight: bold; text-decoration: underline; text-align: center; margin: 12px 0; }
            .content { font-size: 12px; text-align: justify; }
            .table { margin-left: 15px; margin-bottom: 12px; font-size: 12px; }
            .table td { padding: 2px 4px; }
            .rekap-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 12px; }
            .signatures { margin-top: 30px; display: flex; justify-content: space-between; text-align: center; font-size: 11px; }
          </style>
        </head>
        <body>
          <div style="width: 100%; margin-bottom: 16px; font-family: 'Times New Roman', serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
              <tr>
                <td width="75" align="center" valign="middle">
                  ${currentLembaga.logo_url ? `<img src="${currentLembaga.logo_url}" style="width: 70px; height: 70px; object-fit: contain; display: block;" />` : ''}
                </td>
                <td align="center" valign="middle" style="padding: 0 10px; line-height: 1.25;">
                  <div style="font-size: 13px; font-weight: bold; text-transform: uppercase; color: #111; letter-spacing: 0.5px; white-space: nowrap;">${(currentLembaga.nama_yayasan || 'YAYASAN HIDAYATUL MUBTADI-IEN').toUpperCase()}</div>
                  <div style="font-size: 19px; font-weight: 900; text-transform: uppercase; color: #000; letter-spacing: 0.5px; margin: 3px 0; white-space: nowrap;">${(currentLembaga.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase()}</div>
                  <div style="font-size: 12px; font-weight: bold; color: #222; white-space: nowrap;">NPSN: ${currentLembaga.npsn || '70004822'}</div>
                  <div style="font-size: 10.5px; color: #333; margin-top: 2px; white-space: nowrap;">${currentLembaga.alamat || 'Dusun Sukaseneng RT 025 RW 010 Desa Compreng Kec. Compreng Kab. Subang'}${currentLembaga.kode_pos ? ` - Kode Pos ${currentLembaga.kode_pos}` : ''}</div>
                  ${(currentLembaga.telepon || currentLembaga.email || currentLembaga.website) ? `
                    <div style="font-size: 9.5px; color: #444; margin-top: 2px; white-space: nowrap;">
                      ${[currentLembaga.telepon ? `Telp: ${currentLembaga.telepon}` : '', currentLembaga.email ? `Email: ${currentLembaga.email}` : '', (currentLembaga.website || '').replace(/^https?:\/\//i, '').replace(/\/$/, '') ? `Website: ${(currentLembaga.website || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')}` : ''].filter(Boolean).join(' • ')}
                    </div>
                  ` : ''}
                </td>
                <td width="75">&nbsp;</td>
              </tr>
            </table>
            <div style="border-top: 2.5px solid #000; width: 100%; margin-top: 8px;"></div>
            <div style="border-top: 1px solid #000; width: 100%; margin-top: 2px;"></div>
          </div>

          <table style="width: 100%; font-size: 12px; margin-bottom: 14px;">
            <tr>
              <td style="vertical-align: top;">
                <b>Nomor</b> : 042/SMPIT-HM/BK-DISP/${d.getFullYear()}<br>
                <b>Lampiran</b> : 1 (Satu) Lembar Rekap Presensi<br>
                <b>Perihal</b> : <u>Surat Panggilan Orang Tua / Wali Murid</u>
              </td>
              <td style="text-align: right; vertical-align: top;">
                Subang, ${tglSekarang}
              </td>
            </tr>
          </table>

          <div class="content">
            <p>Kepada Yth.<br><b>Bapak/Ibu Orang Tua / Wali dari:</b></p>
            <table class="table">
              <tr><td width="90">Nama Siswa</td><td width="10">:</td><td><b>${siswa.nama}</b></td></tr>
              <tr><td>NIPD</td><td>:</td><td>${siswa.nipd}</td></tr>
              <tr><td>Kelas</td><td>:</td><td>${siswa.kelas}</td></tr>
            </table>
            <p>di Tempat</p>

            <p><i>Assalamu'alaikum Warahmatullahi Wabarakatuh,</i></p>
            <p>Dengan hormat, sehubungan dengan evaluasi ketertiban dan kedisiplinan belajar di ${currentLembaga.nama_lembaga || 'SMP IT Hidayatul Mubtadi-ien'}, bersama surat ini kami memberitahukan bahwa ananda yang bersangkutan telah tercatat melakukan pelanggaran disiplin kehadiran sebagai berikut:</p>
            
            <div class="rekap-box">
              <ul>
                ${siswa.jmlTerlambat > 0 ? `<li>Terlambat Masuk Sekolah: <b>${siswa.jmlTerlambat} kali</b></li>` : ''}
                ${siswa.jmlBolos > 0 ? `<li>Bolos / Meninggalkan Sekolah: <b>${siswa.jmlBolos} kali</b></li>` : ''}
                ${siswa.jmlAlfa > 0 ? `<li>Alfa / Tanpa Keterangan: <b>${siswa.jmlAlfa} kali</b></li>` : ''}
              </ul>
              <p style="margin: 4px 0 0 0; color: #dc2626; font-weight: bold;">Status: ${siswa.levelPeringatan}</p>
            </div>

            <p>Mengingat pentingnya pembinaan karakter ananda, kami mengharapkan kehadiran Bapak/Ibu ke sekolah untuk memenuhi panggilan ini:</p>
            <table class="table" style="margin-left: 20px;">
              <tr><td width="110">Hari / Tanggal</td><td width="10">:</td><td>Senin s.d. Kamis (Jam Kerja Sekolah)</td></tr>
              <tr><td>Waktu</td><td>:</td><td>08.00 - 11.00 WIB</td></tr>
              <tr><td>Tempat</td><td>:</td><td>Ruang BK ${currentLembaga.nama_lembaga || 'SMP IT Hidayatul Mubtadi-ien'}</td></tr>
              <tr><td>Menemui</td><td>:</td><td>Guru BK & Wali Kelas</td></tr>
            </table>

            <p>Demikian surat ini kami sampaikan. Atas kerja sama dan perhatian Bapak/Ibu, kami ucapkan terima kasih.</p>
            <p><i>Wassalamu'alaikum Warahmatullahi Wabarakatuh.</i></p>
          </div>

          <table style="width: 100%; margin-top: 35px; text-align: center; font-size: 11px;">
            <tr>
              <td style="width: 33%;">
                <p>Wali Kelas ${siswa.kelas},</p>
                <br><br><br>
                <p>( ................................ )</p>
              </td>
              <td style="width: 33%;">
                <p>Guru BK,</p>
                <br><br><br>
                <p>( ................................ )</p>
              </td>
              <td style="width: 33%;">
                <p>Kepala Sekolah,</p>
                <br><br><br>
                <p><b>${currentKepsek.nama || currentLembaga.kepala_sekolah || 'Abdul Manaf, S.Pd'}</b></p>
                ${currentKepsek.nipLabel ? `<p style="font-size: 10px; margin-top: 4px;">${currentKepsek.nipLabel}</p>` : ''}
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    try {
      await Print.printAsync({ html });
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak surat.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ChevronLeft color="#fff" size={24} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Presensi Siswa</Text>
          <TouchableOpacity onPress={() => router.push('/master-jam-presensi' as any)} style={styles.settingsBtn}>
            <Settings color="#fff" size={22} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.tabWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
            <TouchableOpacity style={[styles.tabBtn, currentTab === 'scan' && styles.tabBtnActive]} onPress={() => setCurrentTab('scan')}>
              <QrCode size={16} color={currentTab === 'scan' ? '#2a2c87' : '#9ca3af'} />
              <Text style={[styles.tabText, currentTab === 'scan' && styles.tabTextActive]}>Scan QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, currentTab === 'manual' && styles.tabBtnActive]} onPress={() => setCurrentTab('manual')}>
              <CheckCircle size={16} color={currentTab === 'manual' ? '#2a2c87' : '#9ca3af'} />
              <Text style={[styles.tabText, currentTab === 'manual' && styles.tabTextActive]}>Manual</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, currentTab === 'rekap' && styles.tabBtnActive]} onPress={() => setCurrentTab('rekap')}>
              <FileText size={16} color={currentTab === 'rekap' ? '#2a2c87' : '#9ca3af'} />
              <Text style={[styles.tabText, currentTab === 'rekap' && styles.tabTextActive]}>Rekap</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, currentTab === 'peringatan' && styles.tabBtnActive]} onPress={() => setCurrentTab('peringatan')}>
              <AlertTriangle size={16} color={currentTab === 'peringatan' ? '#2a2c87' : '#9ca3af'} />
              <Text style={[styles.tabText, currentTab === 'peringatan' && styles.tabTextActive]}>Peringatan</Text>
              {warningSummary.totalSiswa > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{warningSummary.totalSiswa}</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* TAB SCAN */}
      {currentTab === 'scan' && (
        <View style={styles.content}>
          <TouchableOpacity onPress={() => router.push('/master-jam-presensi' as any)} style={styles.infoBar}>
            <Clock size={16} color="#2a2c87" />
            <Text style={styles.infoBarText}>
              Opsi: <Text style={{ fontWeight: '700' }}>{namaOpsi}</Text> (Masuk: {jamMasuk} | Pulang: {jamPulang})
            </Text>
            <Settings size={14} color="#6b7280" />
          </TouchableOpacity>
          <Text style={styles.scanTitle}>Arahkan Kartu QR Siswa ke Kamera</Text>
          {!permission ? (
            <ActivityIndicator size="large" color="#2a2c87" />
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={{ textAlign: 'center', marginBottom: 16 }}>Aplikasi membutuhkan akses kamera untuk memindai kartu absen.</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
                <Text style={styles.btnPrimaryText}>Izinkan Kamera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraWrapper}>
              <CameraView 
                style={styles.camera} 
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              />
              <View style={styles.overlayContainer}>
                {/* Dark Masking */}
                <View style={styles.maskRow}>
                  <View style={styles.maskSide} />
                </View>
                <View style={styles.maskCenterRow}>
                  <View style={styles.maskSide} />
                  <View style={styles.transparentHole}>
                    {/* Corner Brackets */}
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                    
                    {/* Animated Scanning Line */}
                    {!isProcessing && (
                      <Animatable.View 
                        animation={{
                          0: { translateY: 0 },
                          0.5: { translateY: 220 },
                          1: { translateY: 0 }
                        }}
                        iterationCount="infinite"
                        duration={3000}
                        easing="linear"
                        style={styles.scanLaser}
                      />
                    )}
                  </View>
                  <View style={styles.maskSide} />
                </View>
                <View style={styles.maskRow}>
                  <View style={styles.maskSide} />
                </View>
              </View>
            </View>
          )}
          {isProcessing && (
            <View style={styles.processingBadge}>
              <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Memproses...</Text>
            </View>
          )}
        </View>
      )}

      {/* TAB MANUAL */}
      {currentTab === 'manual' && (
        <View style={styles.contentManual}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kelasSelector}>
            {availableKelas.map(k => (
              <TouchableOpacity key={k} style={[styles.chip, manualKelas === k && styles.chipActive]} onPress={() => setManualKelas(k)}>
                <Text style={[styles.chipText, manualKelas === k && styles.chipTextActive]}>Kelas {k}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {isManualLoading ? (
            <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 40 }} />
          ) : (
            <>
              <View style={styles.bulkActionBox}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {['Sakit', 'Izin', 'Dispensasi', 'Alfa', 'Bolos'].map(s => (
                    <TouchableOpacity key={s} style={[styles.chipStatus, manualStatus === s && styles.chipStatusActive]} onPress={() => setManualStatus(s)}>
                      <Text style={[styles.chipStatusText, manualStatus === s && styles.chipStatusTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.inputField} placeholder="Keterangan opsional..." value={manualAlasan} onChangeText={setManualAlasan} />
                <TouchableOpacity style={styles.btnPrimary} onPress={submitBulkManual} disabled={isProcessing}>
                  {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Simpan {selectedSiswaIds.length} Siswa</Text>}
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.siswaList}>
                <TouchableOpacity style={styles.selectAllBtn} onPress={() => {
                  if (selectedSiswaIds.length === filteredSiswa.length && filteredSiswa.length > 0) setSelectedSiswaIds([]);
                  else setSelectedSiswaIds(filteredSiswa.map(s => s.nipd));
                }}>
                  <CheckCircle color={selectedSiswaIds.length === filteredSiswa.length && filteredSiswa.length > 0 ? '#10b981' : '#9ca3af'} size={20} />
                  <Text style={{ marginLeft: 8, fontWeight: 'bold', color: '#4b5563' }}>Pilih Semua</Text>
                </TouchableOpacity>

                {filteredSiswa.map(s => (
                  <TouchableOpacity key={s.nipd} style={styles.siswaCard} onPress={() => {
                    if (selectedSiswaIds.includes(s.nipd)) setSelectedSiswaIds(selectedSiswaIds.filter(id => id !== s.nipd));
                    else setSelectedSiswaIds([...selectedSiswaIds, s.nipd]);
                  }}>
                    <View style={[styles.checkbox, selectedSiswaIds.includes(s.nipd) && styles.checkboxActive]}>
                      {selectedSiswaIds.includes(s.nipd) && <CheckCircle color="#fff" size={16} />}
                    </View>
                    <View>
                      <Text style={styles.siswaName}>{s.nama}</Text>
                      <Text style={styles.siswaSub}>{s.nipd}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {filteredSiswa.length === 0 && <Text style={{ textAlign: 'center', marginTop: 20, color: '#9ca3af' }}>Semua siswa di kelas ini sudah diabsen hari ini.</Text>}
              </ScrollView>
            </>
          )}

          <TouchableOpacity style={[styles.fab, { left: 24, right: 'auto', bottom: 100, backgroundColor: '#1E257F' }]} onPress={() => setShowManualDatePicker(true)}>
            <Calendar color="#FFFFFF" size={28} />
          </TouchableOpacity>
          {showManualDatePicker && (
            <DateTimePicker
              value={new Date(tanggal)}
              mode="date"
              display="default"
              accentColor="#1E257F"
              textColor="#1E257F"
              onChange={(event, selectedDate) => {
                setShowManualDatePicker(false);
                if (event.type === 'set' && selectedDate) {
                  setTanggal(getLocalDate(selectedDate));
                }
              }}
            />
          )}
        </View>
      )}

      {/* TAB REKAP */}
      {currentTab === 'rekap' && (
        <ScrollView style={styles.contentRekapScroll} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={styles.rekapHeaderCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PieChart color="#2a2c87" size={20} />
                <Text style={styles.rekapHeaderTitle}>Rekap & Analisis Kehadiran</Text>
              </View>
              <TouchableOpacity onPress={fetchRekapData} disabled={isRekapLoading} style={styles.refreshBtnSmall}>
                <Text style={styles.refreshBtnSmallText}>{isRekapLoading ? 'Memuat...' : 'Segarkan'}</Text>
              </TouchableOpacity>
            </View>

            {/* Mode Filter Toggle: Harian | Mingguan | Bulanan | Semester */}
            <View style={styles.rekapModeContainer}>
              {(['harian', 'mingguan', 'bulanan', 'semester'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.rekapModeBtn, rekapFilterMode === mode && styles.rekapModeBtnActive]}
                  onPress={() => setRekapFilterMode(mode)}
                >
                  <Text style={[styles.rekapModeBtnText, rekapFilterMode === mode && styles.rekapModeBtnTextActive]}>
                    {mode === 'harian' ? 'Harian' : mode === 'mingguan' ? 'Mingguan' : mode === 'bulanan' ? 'Bulanan' : 'Semester'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sub Controls Tanggal / Periode Sesuai Mode */}
            <View style={{ marginTop: 12 }}>
              {rekapFilterMode === 'harian' && (
                <View>
                  <CustomDatePicker
                    value={rekapTanggal}
                    onChange={(d) => setRekapTanggal(d)}
                  />
                </View>
              )}

              {rekapFilterMode === 'mingguan' && (
                <View style={styles.navigatorRow}>
                  <TouchableOpacity
                    onPress={() => setRekapWeekOffset(prev => prev - 1)}
                    style={styles.navArrowBtn}
                  >
                    <ChevronLeft size={18} color="#4b5563" />
                  </TouchableOpacity>
                  <View style={styles.navLabelContainer}>
                    <CalendarDays size={15} color="#2a2c87" />
                    <Text style={styles.navLabelText}>{formatWeekRangeLabel(rekapWeekOffset)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setRekapWeekOffset(prev => prev + 1)}
                    style={styles.navArrowBtn}
                  >
                    <ChevronRight size={18} color="#4b5563" />
                  </TouchableOpacity>
                  {rekapWeekOffset !== 0 && (
                    <TouchableOpacity onPress={() => setRekapWeekOffset(0)} style={styles.resetNavBtn}>
                      <Text style={styles.resetNavBtnText}>Pekan Ini</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {rekapFilterMode === 'bulanan' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={[styles.pickerWrapper, { flex: 2 }]}>
                    <Picker
                      selectedValue={rekapBulan}
                      onValueChange={(val) => setRekapBulan(Number(val))}
                      style={{ color: '#1f2937' }}
                    >
                      {bulanNamaList.map((bln, idx) => (
                        <Picker.Item key={idx + 1} label={bln} value={idx + 1} style={{ fontSize: 13 }} />
                      ))}
                    </Picker>
                  </View>
                  <View style={[styles.pickerWrapper, { flex: 1 }]}>
                    <Picker
                      selectedValue={rekapTahun}
                      onValueChange={(val) => setRekapTahun(Number(val))}
                      style={{ color: '#1f2937' }}
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <Picker.Item key={y} label={String(y)} value={y} style={{ fontSize: 13 }} />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              {rekapFilterMode === 'semester' && (
                <View style={styles.semesterInfoCard}>
                  <FileText size={16} color="#2a2c87" />
                  <Text style={styles.semesterInfoText}>
                    Semester Aktif: {new Date().getMonth() >= 6 ? 'Semester Ganjil (Jul - Des)' : 'Semester Genap (Jan - Jun)'}
                  </Text>
                </View>
              )}
            </View>

            {/* Filter Kelas & Status */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <View style={[styles.pickerWrapper, { flex: 1 }]}>
                <Picker
                  selectedValue={rekapFilterKelas}
                  onValueChange={(v) => setRekapFilterKelas(v)}
                  style={{ color: '#1f2937' }}
                >
                  <Picker.Item label="Semua Kelas" value="Semua" style={{ fontSize: 13 }} />
                  {classOptions.map(k => (
                    <Picker.Item key={k} label={`Kelas ${k}`} value={k} style={{ fontSize: 13 }} />
                  ))}
                </Picker>
              </View>

              <View style={[styles.pickerWrapper, { flex: 1 }]}>
                <Picker
                  selectedValue={rekapFilterStatus}
                  onValueChange={(v) => setRekapFilterStatus(v)}
                  style={{ color: '#1f2937' }}
                >
                  <Picker.Item label="Semua Status" value="Semua" style={{ fontSize: 13 }} />
                  <Picker.Item label="Hadir" value="Hadir" style={{ fontSize: 13 }} />
                  <Picker.Item label="Terlambat" value="Terlambat" style={{ fontSize: 13 }} />
                  <Picker.Item label="Bolos / Alfa" value="Bolos" style={{ fontSize: 13 }} />
                  <Picker.Item label="Izin / Sakit" value="Izin" style={{ fontSize: 13 }} />
                </Picker>
              </View>
            </View>

            {/* Search Input */}
            <View style={styles.searchBar}>
              <Search size={16} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama atau NIPD siswa..."
                value={rekapSearch}
                onChangeText={setRekapSearch}
              />
              {rekapSearch ? (
                <TouchableOpacity onPress={() => setRekapSearch('')}>
                  <X size={16} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* 4 Stat KPI Boxes */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#059669' }]}>HADIR</Text>
                <Text style={styles.statValue}>{rHadir}</Text>
              </View>
              <CheckCircle size={28} color="#10b981" />
            </View>
            <View style={[styles.statBox, { backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#ea580c' }]}>IZIN/SAKIT</Text>
                <Text style={styles.statValue}>{rIzin}</Text>
              </View>
              <AlertCircle size={28} color="#f97316" />
            </View>
            <View style={[styles.statBox, { backgroundColor: '#fefce8', borderColor: '#fef08a' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#ca8a04' }]}>TERLAMBAT</Text>
                <Text style={styles.statValue}>{rTerlambat}</Text>
              </View>
              <Clock size={28} color="#eab308" />
            </View>
            <View style={[styles.statBox, { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#dc2626' }]}>BOLOS/ALFA</Text>
                <Text style={styles.statValue}>{rBolos}</Text>
              </View>
              <XCircle size={28} color="#ef4444" />
            </View>
          </View>

          {/* List of Rekap Presensi */}
          <View style={styles.rekapListContainer}>
            {isRekapLoading ? (
              <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 24 }} />
            ) : filteredRekapData.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Tidak ada data presensi pada filter ini.</Text>
              </View>
            ) : (
              filteredRekapData.map(d => {
                const st = d.status || '';
                const isHadir = st.includes('Hadir');
                const isTelat = st.includes('Terlambat');
                const isBolosAlfa = st.includes('Bolos') || st === 'Alfa';

                return (
                  <View key={d.id} style={styles.rekapCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rekapName}>{d.nama}</Text>
                      <Text style={styles.rekapSub}>
                        Kelas {d.kelas} • NIPD: {d.nipd || '-'}
                      </Text>
                      <Text style={styles.rekapDate}>
                        Tanggal: {d.tanggal}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                      <View style={[
                        styles.statusPill,
                        isHadir ? { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' } :
                        isTelat ? { backgroundColor: '#fef9c3', borderColor: '#fde047' } :
                        isBolosAlfa ? { backgroundColor: '#fef2f2', borderColor: '#fecaca' } :
                        { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }
                      ]}>
                        <Text style={[
                          styles.statusPillText,
                          isHadir ? { color: '#059669' } :
                          isTelat ? { color: '#ca8a04' } :
                          isBolosAlfa ? { color: '#dc2626' } :
                          { color: '#ea580c' }
                        ]}>
                          {d.status}
                        </Text>
                      </View>
                      <Text style={styles.timeSubText}>
                        {d.waktu_masuk ? `${d.waktu_masuk.substring(0, 5)}` : '-'} / {d.waktu_pulang ? `${d.waktu_pulang.substring(0, 5)}` : '-'}
                      </Text>
                      {d.alasan && d.alasan !== '-' ? (
                        <Text style={styles.alasanSubText}>{d.alasan}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* TAB PERINGATAN */}
      {currentTab === 'peringatan' && (
        <ScrollView style={styles.contentRekapScroll} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Header Banner */}
          <View style={styles.warningBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ShieldAlert size={16} color="#fff" />
              <Text style={styles.warningBannerBadge}>SISTEM MONITORING KEDISIPLINAN</Text>
            </View>
            <Text style={styles.warningBannerTitle}>Peringatan Disiplin Siswa</Text>
            <Text style={styles.warningBannerDesc}>
              Siswa melanggar ≥ 3x dlm seminggu / 7 hari atau ≥ 6x dlm sebulan / 30 hari (Alfa, Bolos, Terlambat) terjaring otomatis.
            </Text>
            <TouchableOpacity onPress={fetchPeringatanData} disabled={isPeringatanLoading} style={styles.warningBannerBtn}>
              <Text style={styles.warningBannerBtnText}>{isPeringatanLoading ? 'Memproses...' : 'Segarkan Evaluasi'}</Text>
            </TouchableOpacity>
          </View>

          {/* 6 KPI Stat Cards */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#dc2626' }]}>TOTAL SISWA</Text>
                <Text style={styles.statValue}>{warningSummary.totalSiswa}</Text>
              </View>
              <ShieldAlert size={28} color="#ef4444" />
            </View>
            <View style={[styles.statBox, { backgroundColor: '#fffbeb', borderColor: '#fef3c7' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#d97706' }]}>7 HARI (≥3x)</Text>
                <Text style={styles.statValue}>{warningSummary.count7Days}</Text>
              </View>
              <AlertTriangle size={28} color="#f59e0b" />
            </View>
            <View style={[styles.statBox, { backgroundColor: '#fefce8', borderColor: '#fef08a' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#ca8a04' }]}>MINGGUAN (≥3x)</Text>
                <Text style={styles.statValue}>{warningSummary.mingguanCount}</Text>
              </View>
              <AlertTriangle size={28} color="#eab308" />
            </View>
            <View style={[styles.statBox, { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#e11d48' }]}>30 HARI (≥6x)</Text>
                <Text style={styles.statValue}>{warningSummary.count30Days}</Text>
              </View>
              <AlertCircle size={28} color="#f43f5e" />
            </View>
            <View style={[styles.statBox, { backgroundColor: '#faf5ff', borderColor: '#f3e8ff' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#9333ea' }]}>BULANAN (≥6x)</Text>
                <Text style={styles.statValue}>{warningSummary.bulananCount}</Text>
              </View>
              <AlertCircle size={28} color="#a855f7" />
            </View>
            <View style={[styles.statBox, { backgroundColor: '#eef2ff', borderColor: '#e0e7ff' }]}>
              <View>
                <Text style={[styles.statLabel, { color: '#4f46e5' }]}>TOTAL KASUS</Text>
                <Text style={styles.statValue}>{warningSummary.totalKasus}</Text>
              </View>
              <PieChart size={28} color="#6366f1" />
            </View>
          </View>

          {/* Filter Toolbar Card */}
          <View style={styles.rekapHeaderCard}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#374151', marginBottom: 8 }}>Filter Periode Peringatan:</Text>
            
            {/* Filter Mode Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
              {[
                { id: 'semua', label: 'Semua' },
                { id: '7_hari', label: '7 Hari (≥3x)' },
                { id: 'mingguan', label: 'Mingguan (≥3x)' },
                { id: '30_hari', label: '30 Hari (≥6x)' },
                { id: 'bulanan', label: 'Bulanan (≥6x)' }
              ].map(tab => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.chipPeringatan, peringatanFilterMode === tab.id && styles.chipPeringatanActive]}
                  onPress={() => setPeringatanFilterMode(tab.id as any)}
                >
                  <Text style={[styles.chipPeringatanText, peringatanFilterMode === tab.id && styles.chipPeringatanTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Dynamic Period Navigator */}
            {peringatanFilterMode === '7_hari' && (
              <View style={styles.rollingInfoBadge}>
                <Calendar size={14} color="#d97706" />
                <Text style={styles.rollingInfoText}>Rolling 7 Hari Terakhir s.d. Hari Ini (Batas ≥ 3 kali)</Text>
              </View>
            )}

            {peringatanFilterMode === '30_hari' && (
              <View style={[styles.rollingInfoBadge, { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' }]}>
                <Calendar size={14} color="#e11d48" />
                <Text style={[styles.rollingInfoText, { color: '#9f1239' }]}>Rolling 30 Hari Terakhir s.d. Hari Ini (Batas ≥ 6 kali)</Text>
              </View>
            )}

            {peringatanFilterMode === 'mingguan' && (
              <View style={[styles.navigatorRow, { marginTop: 10 }]}>
                <TouchableOpacity
                  onPress={() => setPeringatanWeekOffset(prev => prev - 1)}
                  style={styles.navArrowBtn}
                >
                  <ChevronLeft size={18} color="#4b5563" />
                </TouchableOpacity>
                <View style={styles.navLabelContainer}>
                  <CalendarDays size={15} color="#d97706" />
                  <Text style={[styles.navLabelText, { color: '#92400e' }]}>{formatWeekRangeLabel(peringatanWeekOffset)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setPeringatanWeekOffset(prev => prev + 1)}
                  style={styles.navArrowBtn}
                >
                  <ChevronRight size={18} color="#4b5563" />
                </TouchableOpacity>
                {peringatanWeekOffset !== 0 && (
                  <TouchableOpacity onPress={() => setPeringatanWeekOffset(0)} style={styles.resetNavBtn}>
                    <Text style={styles.resetNavBtnText}>Pekan Ini</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {peringatanFilterMode === 'bulanan' && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <View style={[styles.pickerWrapper, { flex: 2 }]}>
                  <Picker
                    selectedValue={peringatanBulan}
                    onValueChange={(val) => setPeringatanBulan(Number(val))}
                    style={{ color: '#1f2937' }}
                  >
                    {bulanNamaList.map((bln, idx) => (
                      <Picker.Item key={idx + 1} label={bln} value={idx + 1} style={{ fontSize: 13 }} />
                    ))}
                  </Picker>
                </View>
                <View style={[styles.pickerWrapper, { flex: 1 }]}>
                  <Picker
                    selectedValue={peringatanTahun}
                    onValueChange={(val) => setPeringatanTahun(Number(val))}
                    style={{ color: '#1f2937' }}
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <Picker.Item key={y} label={String(y)} value={y} style={{ fontSize: 13 }} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            {/* Filter Kelas */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <View style={[styles.pickerWrapper, { flex: 1 }]}>
                <Picker
                  selectedValue={peringatanFilterKelas}
                  onValueChange={(v) => setPeringatanFilterKelas(v)}
                  style={{ color: '#1f2937' }}
                >
                  <Picker.Item label="Semua Kelas" value="Semua" style={{ fontSize: 13 }} />
                  {classOptions.map(k => (
                    <Picker.Item key={k} label={`Kelas ${k}`} value={k} style={{ fontSize: 13 }} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Search size={16} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari siswa terperingatkan..."
                value={peringatanSearch}
                onChangeText={setPeringatanSearch}
              />
              {peringatanSearch ? (
                <TouchableOpacity onPress={() => setPeringatanSearch('')}>
                  <X size={16} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* List of Violators */}
          <View style={styles.rekapListContainer}>
            {isPeringatanLoading ? (
              <ActivityIndicator size="large" color="#dc2626" style={{ marginTop: 24 }} />
            ) : filteredPeringatanData.length === 0 ? (
              <View style={styles.emptyBox}>
                <CheckCircle size={42} color="#10b981" />
                <Text style={[styles.emptyText, { fontWeight: 'bold', color: '#1f2937', marginTop: 8 }]}>Tidak Ada Pelanggaran Disiplin</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>
                  Tidak ada siswa yang mencapai ambang batas pelanggaran pada filter ini.
                </Text>
              </View>
            ) : (
              filteredPeringatanData.map((d) => (
                <View key={d.nipd} style={styles.violatorCard}>
                  {/* Top Row: Name & Level Badge */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.violatorName}>{d.nama}</Text>
                      <Text style={styles.violatorSub}>Kelas {d.kelas} • NIPD: {d.nipd}</Text>
                      {d.wa_ortu ? (
                        <Text style={styles.violatorWa}>WA: {d.wa_ortu}</Text>
                      ) : (
                        <Text style={[styles.violatorWa, { color: '#9ca3af', fontStyle: 'italic' }]}>Tanpa No WA</Text>
                      )}
                    </View>
                    <View style={styles.spLevelBadge}>
                      <Text style={styles.spLevelBadgeText}>{d.levelPeringatan}</Text>
                    </View>
                  </View>

                  {/* Threshold Indicators */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
                    {d.is7Days && (
                      <View style={[styles.triggerPill, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                        <Text style={[styles.triggerPillText, { color: '#b45309' }]}>7 Hari: {d.count7Days}x</Text>
                      </View>
                    )}
                    {d.isMingguan && (
                      <View style={[styles.triggerPill, { backgroundColor: '#fef9c3', borderColor: '#fef08a' }]}>
                        <Text style={[styles.triggerPillText, { color: '#a16207' }]}>Mingguan: {d.countMinggu}x</Text>
                      </View>
                    )}
                    {d.is30Days && (
                      <View style={[styles.triggerPill, { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' }]}>
                        <Text style={[styles.triggerPillText, { color: '#be123c' }]}>30 Hari: {d.count30Days}x</Text>
                      </View>
                    )}
                    {d.isBulanan && (
                      <View style={[styles.triggerPill, { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }]}>
                        <Text style={[styles.triggerPillText, { color: '#7e22ce' }]}>Bulanan: {d.countBulan}x</Text>
                      </View>
                    )}
                  </View>

                  {/* Violation Count Row */}
                  <View style={styles.violationCountsRow}>
                    <View style={[styles.miniBadge, { backgroundColor: '#fefce8', borderColor: '#fef08a' }]}>
                      <Text style={[styles.miniBadgeText, { color: '#a16207' }]}>Telat: {d.jmlTerlambat}</Text>
                    </View>
                    <View style={[styles.miniBadge, { backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
                      <Text style={[styles.miniBadgeText, { color: '#c2410c' }]}>Bolos: {d.jmlBolos}</Text>
                    </View>
                    <View style={[styles.miniBadge, { backgroundColor: '#fef2f2', borderColor: '#fee2e2' }]}>
                      <Text style={[styles.miniBadgeText, { color: '#b91c1c' }]}>Alfa: {d.jmlAlfa}</Text>
                    </View>
                    <View style={[styles.miniBadge, { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', marginLeft: 'auto' }]}>
                      <Text style={[styles.miniBadgeText, { color: '#374151', fontWeight: 'bold' }]}>Total: {d.totalPelanggaran}x</Text>
                    </View>
                  </View>

                  {/* Action Buttons Row */}
                  <View style={styles.violatorActionRow}>
                    <TouchableOpacity
                      onPress={() => setSelectedViolator(d)}
                      style={styles.actionBtnGray}
                    >
                      <Eye size={14} color="#374151" />
                      <Text style={styles.actionBtnGrayText}>Log</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleCetakSuratPeringatan(d)}
                      style={styles.actionBtnIndigo}
                    >
                      <Printer size={14} color="#4338ca" />
                      <Text style={styles.actionBtnIndigoText}>Surat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => sendSPWA(d)}
                      style={styles.actionBtnGreen}
                    >
                      <Send size={14} color="#fff" />
                      <Text style={styles.actionBtnGreenText}>Kirim SP</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* MODAL DETAIL LOG PELANGGARAN */}
      <Modal
        visible={!!selectedViolator}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedViolator(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                  <Text style={styles.modalHeaderSubtitle}>LOG PELANGGARAN</Text>
                  <Text style={[styles.modalHeaderSubtitle, { color: '#fef08a' }]}>KELAS {selectedViolator?.kelas}</Text>
                </View>
                <Text style={styles.modalHeaderTitle}>{selectedViolator?.nama}</Text>
                <Text style={styles.modalHeaderNipd}>
                  NIPD: {selectedViolator?.nipd} {selectedViolator?.wa_ortu ? `• WA: ${selectedViolator?.wa_ortu}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedViolator(null)} style={styles.modalCloseBtn}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Mini Summary Grid */}
            <View style={styles.modalSummaryGrid}>
              <View style={[styles.modalSummaryBox, { backgroundColor: '#fefce8' }]}>
                <Text style={[styles.modalSummaryLabel, { color: '#ca8a04' }]}>TERLAMBAT</Text>
                <Text style={[styles.modalSummaryValue, { color: '#a16207' }]}>{selectedViolator?.jmlTerlambat || 0}</Text>
              </View>
              <View style={[styles.modalSummaryBox, { backgroundColor: '#fff7ed' }]}>
                <Text style={[styles.modalSummaryLabel, { color: '#ea580c' }]}>BOLOS</Text>
                <Text style={[styles.modalSummaryValue, { color: '#c2410c' }]}>{selectedViolator?.jmlBolos || 0}</Text>
              </View>
              <View style={[styles.modalSummaryBox, { backgroundColor: '#fef2f2' }]}>
                <Text style={[styles.modalSummaryLabel, { color: '#dc2626' }]}>ALFA</Text>
                <Text style={[styles.modalSummaryValue, { color: '#b91c1c' }]}>{selectedViolator?.jmlAlfa || 0}</Text>
              </View>
            </View>

            {/* Violation List */}
            <ScrollView style={{ maxHeight: 280, padding: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 }}>
                Riwayat Kejadian Terdata:
              </Text>
              {selectedViolator?.violationsList && selectedViolator.violationsList.length > 0 ? (
                selectedViolator.violationsList.map((v: any, idx: number) => (
                  <View key={idx} style={styles.violationItemCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#111827' }}>{v.tanggal}</Text>
                      <View style={[
                        styles.violationItemTag,
                        v.status === 'Terlambat' ? { backgroundColor: '#fef9c3' } :
                        v.status === 'Bolos' ? { backgroundColor: '#fee2e2' } :
                        { backgroundColor: '#ffe4e6' }
                      ]}>
                        <Text style={[
                          styles.violationItemTagText,
                          v.status === 'Terlambat' ? { color: '#a16207' } :
                          v.status === 'Bolos' ? { color: '#b91c1c' } :
                          { color: '#be123c' }
                        ]}>
                          {v.status}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>
                        Jam: {v.waktu_masuk ? v.waktu_masuk.substring(0, 5) : '-'} s.d. {v.waktu_pulang ? v.waktu_pulang.substring(0, 5) : '-'}
                      </Text>
                      {v.alasan && v.alasan !== '-' && (
                        <Text style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>{v.alasan}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ color: '#9ca3af', textAlign: 'center', marginVertical: 16 }}>Tidak ada rincian riwayat.</Text>
              )}
            </ScrollView>

            {/* Modal Footer Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  const s = selectedViolator;
                  setSelectedViolator(null);
                  handleCetakSuratPeringatan(s);
                }}
                style={styles.modalFooterBtnIndigo}
              >
                <Printer size={15} color="#4338ca" />
                <Text style={styles.modalFooterBtnIndigoText}>Cetak Surat</Text>
              </TouchableOpacity>

              {selectedViolator?.wa_ortu ? (
                <TouchableOpacity
                  onPress={() => {
                    const s = selectedViolator;
                    setSelectedViolator(null);
                    sendSPWA(s);
                  }}
                  style={styles.modalFooterBtnGreen}
                >
                  <Send size={15} color="#fff" />
                  <Text style={styles.modalFooterBtnGreenText}>Kirim WA</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => setSelectedViolator(null)}
                style={styles.modalFooterBtnClose}
              >
                <Text style={styles.modalFooterBtnCloseText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  settingsBtn: { padding: 4, marginLeft: 'auto' },
  tabWrapper: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  tabContainer: { flexDirection: 'row', padding: 4, gap: 8 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, gap: 6 },
  tabBtnActive: { backgroundColor: '#fff' },
  tabText: { color: '#9ca3af', fontWeight: 'bold', fontSize: 13 },
  tabTextActive: { color: '#2a2c87' },
  
  content: { flex: 1, alignItems: 'center', paddingTop: 16 },
  infoBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e7ff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, gap: 8, marginBottom: 14, borderWidth: 1, borderColor: '#c7d2fe', width: '90%' },
  infoBarText: { fontSize: 13, color: '#1e1b4b', flex: 1 },
  scanTitle: { fontSize: 16, color: '#4b5563', fontWeight: '600', marginBottom: 20 },
  permissionBox: { padding: 24, backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 20 },
  btnPrimary: { backgroundColor: '#2a2c87', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  
  cameraWrapper: { width: 320, height: 420, borderRadius: 24, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  maskRow: { flex: 1 },
  maskCenterRow: { flexDirection: 'row', height: 220 },
  maskSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  transparentHole: { width: 220, height: 220, backgroundColor: 'transparent', position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#10b981' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  scanLaser: { width: '100%', height: 2, backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 4, elevation: 4 },
  
  processingBadge: { position: 'absolute', bottom: 40, backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, flexDirection: 'row', alignItems: 'center' },

  contentManual: { flex: 1 },
  kelasSelector: { maxHeight: 50, paddingHorizontal: 16, marginTop: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e5e7eb', marginRight: 8, height: 36, justifyContent: 'center' },
  chipActive: { backgroundColor: '#2a2c87' },
  chipText: { fontSize: 14, color: '#4b5563', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  
  bulkActionBox: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  chipStatus: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center' },
  chipStatusActive: { backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#4f46e5' },
  chipStatusText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipStatusTextActive: { color: '#4f46e5', fontWeight: 'bold' },
  inputField: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, marginBottom: 12 },
  
  siswaList: { padding: 16, paddingBottom: 40 },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: '#fff', padding: 12, borderRadius: 12 },
  siswaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db', marginRight: 16, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  siswaName: { fontSize: 15, fontWeight: 'bold', color: '#1f2937' },
  siswaSub: { fontSize: 12, color: '#6b7280' },

  tabBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  contentRekapScroll: { flex: 1, backgroundColor: '#f3f4f6' },
  rekapHeaderCard: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  rekapHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  refreshBtnSmall: { backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  refreshBtnSmallText: { fontSize: 11, fontWeight: 'bold', color: '#4b5563' },

  rekapModeContainer: { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: 4, borderRadius: 12, gap: 4 },
  rekapModeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  rekapModeBtnActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  rekapModeBtnText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  rekapModeBtnTextActive: { color: '#2a2c87', fontWeight: 'bold' },

  navigatorRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  navArrowBtn: { padding: 6 },
  navLabelContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  navLabelText: { fontSize: 12, fontWeight: 'bold', color: '#2a2c87' },
  resetNavBtn: { backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  resetNavBtnText: { fontSize: 10, fontWeight: 'bold', color: '#2a2c87' },

  pickerWrapper: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, height: 48, justifyContent: 'center' },
  semesterInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e7ff', padding: 12, borderRadius: 12, gap: 8 },
  semesterInfoText: { fontSize: 12, color: '#1e1b4b', fontWeight: '600' },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, height: 44, marginTop: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#1f2937', paddingVertical: 0 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 12, gap: 10 },
  statBox: { width: '48%', borderWidth: 1, padding: 12, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#1f2937' },

  rekapListContainer: { paddingHorizontal: 16, marginTop: 12 },
  emptyBox: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb', marginTop: 8 },
  emptyText: { fontSize: 13, color: '#6b7280' },

  rekapCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', elevation: 1 },
  rekapName: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  rekapSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rekapDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, marginBottom: 4 },
  statusPillText: { fontSize: 11, fontWeight: 'bold' },
  timeSubText: { fontSize: 11, color: '#4b5563', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '600' },
  alasanSubText: { fontSize: 10, color: '#9ca3af', fontStyle: 'italic', marginTop: 2 },

  warningBanner: { backgroundColor: '#dc2626', marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 18, shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  warningBannerBadge: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  warningBannerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  warningBannerDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 11, lineHeight: 16, marginTop: 4 },
  warningBannerBtn: { backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 10 },
  warningBannerBtnText: { color: '#dc2626', fontSize: 11, fontWeight: 'bold' },

  chipPeringatan: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#f3f4f6' },
  chipPeringatanActive: { backgroundColor: '#dc2626' },
  chipPeringatanText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
  chipPeringatanTextActive: { color: '#fff', fontWeight: 'bold' },

  rollingInfoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginTop: 10, gap: 6 },
  rollingInfoText: { fontSize: 11, color: '#92400e', fontWeight: '600' },

  violatorCard: { backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#fed7aa', elevation: 1 },
  violatorName: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  violatorSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  violatorWa: { fontSize: 11, color: '#059669', fontWeight: '600', marginTop: 2 },
  spLevelBadge: { backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  spLevelBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  triggerPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  triggerPillText: { fontSize: 10, fontWeight: 'bold' },

  violationCountsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  miniBadgeText: { fontSize: 11, fontWeight: '600' },

  violatorActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  actionBtnGray: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, gap: 4 },
  actionBtnGrayText: { color: '#374151', fontSize: 12, fontWeight: 'bold' },
  actionBtnIndigo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e7ff', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, gap: 4 },
  actionBtnIndigoText: { color: '#4338ca', fontSize: 12, fontWeight: 'bold' },
  actionBtnGreen: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25D366', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, gap: 4 },
  actionBtnGreenText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', width: '100%', maxWidth: 440, borderRadius: 20, overflow: 'hidden', maxHeight: '85%' },
  modalHeader: { backgroundColor: '#dc2626', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalHeaderSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  modalHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalHeaderNipd: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  modalCloseBtn: { padding: 4 },

  modalSummaryGrid: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', padding: 10, gap: 8 },
  modalSummaryBox: { flex: 1, padding: 8, borderRadius: 10, alignItems: 'center' },
  modalSummaryLabel: { fontSize: 10, fontWeight: 'bold' },
  modalSummaryValue: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },

  violationItemCard: { backgroundColor: '#f9fafb', padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  violationItemTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  violationItemTagText: { fontSize: 10, fontWeight: 'bold' },

  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 8 },
  modalFooterBtnIndigo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e7ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  modalFooterBtnIndigoText: { color: '#4338ca', fontSize: 12, fontWeight: 'bold' },
  modalFooterBtnGreen: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#25D366', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  modalFooterBtnGreenText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  modalFooterBtnClose: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e5e7eb', justifyContent: 'center' },
  modalFooterBtnCloseText: { color: '#374151', fontSize: 12, fontWeight: 'bold' },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2a2c87', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }
});
