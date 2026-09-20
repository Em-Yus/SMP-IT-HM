import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Alert,
  Modal,
  DeviceEventEmitter,
  PanResponder
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path, SvgXml } from 'react-native-svg';
import {
  ChevronLeft,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  Users,
  ArrowRight,
  FileSignature,
  Building,
  Lock,
  ChevronDown,
  X,
  Printer,
  Calendar,
  RotateCcw
} from 'lucide-react-native';
import { supabase } from '../../../services/supabaseClient';

function MobileSignatureCanvas({
  onSave,
  onDrawingChange,
  height = 160
}: {
  onSave: (sigData: string) => void;
  onDrawingChange?: (drawing: boolean) => void;
  height?: number;
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(300);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        onDrawingChange?.(true);
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => `${prev} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        onDrawingChange?.(false);
        setCurrentPath((latestCurrent) => {
          if (latestCurrent) {
            setPaths((prevPaths) => {
              const updated = [...prevPaths, latestCurrent];
              setHasDrawn(true);
              const w = canvasWidth > 0 ? canvasWidth : 320;
              const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${height}" width="${w}" height="${height}"><path d="${updated.join(' ')}" stroke="#1e3a8a" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
              onSave(svgData);
              return updated;
            });
          }
          return '';
        });
      },
      onPanResponderTerminate: () => {
        onDrawingChange?.(false);
      }
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
    setHasDrawn(false);
    onSave('');
  };

  return (
    <View
      style={[styles.canvasBox, { height }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setCanvasWidth(w);
      }}
    >
      <View {...panResponder.panHandlers} style={StyleSheet.absoluteFill}>
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((d, idx) => (
            <Path
              key={idx}
              d={d}
              stroke="#1e3a8a"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath ? (
            <Path
              d={currentPath}
              stroke="#1e3a8a"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      </View>

      {!hasDrawn && !currentPath && (
        <View style={styles.canvasPlaceholder} pointerEvents="none">
          <FileSignature size={22} color="#94a3b8" />
          <Text style={styles.canvasPlaceholderText}>Goreskan tanda tangan Anda di sini</Text>
        </View>
      )}

      {hasDrawn && (
        <TouchableOpacity style={styles.canvasResetBtn} onPress={handleClear} activeOpacity={0.7}>
          <RotateCcw size={13} color="#475569" />
          <Text style={styles.canvasResetBtnText}>Ulangi</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function UjianTataTertib() {
  const insets = useSafeAreaInsets();

  const [sopData, setSopData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isKetuaPanitia, setIsKetuaPanitia] = useState<boolean>(false);
  const [namaKetua, setNamaKetua] = useState<string>('Ketua Panitia Ujian');
  const [guruSigned, setGuruSigned] = useState<boolean>(false);
  const [hasReadToBottom, setHasReadToBottom] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lembaga, setLembaga] = useState<any>(null);

  // State Modal Pemilihan Jenis Ujian, Tanggal & TTD untuk Ketua Panitia
  const [showKetuaModal, setShowKetuaModal] = useState<boolean>(false);
  const [selectedJenisUjian, setSelectedJenisUjian] = useState<string>('PSAJ');
  const [tanggalPersetujuan, setTanggalPersetujuan] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [tempSignature, setTempSignature] = useState<string>('');
  const [isDrawingOnCanvas, setIsDrawingOnCanvas] = useState<boolean>(false);

  const JENIS_UJIAN_OPTIONS = [
    { label: 'Tugas (Tugas Mandiri / Terstruktur)', value: 'Tugas' },
    { label: 'PSTS (Penilaian Sumatif Tengah Semester)', value: 'PSTS' },
    { label: 'PSAS (Penilaian Sumatif Akhir Semester)', value: 'PSAS' },
    { label: 'PSAT (Penilaian Sumatif Akhir Tahun)', value: 'PSAT' },
    { label: 'PSAJ (Penilaian Sumatif Akhir Jenjang)', value: 'PSAJ' }
  ];

  const formatDateIndonesia = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    if (isNaN(m) || isNaN(d) || m < 1 || m > 12) return dateStr;
    return `${d} ${months[m - 1]} ${y}`;
  };

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate && event.type !== 'dismissed') {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      setTanggalPersetujuan(`${yyyy}-${mm}-${dd}`);
    }
  };

  useEffect(() => {
    fetchSop();
  }, []);

  const fetchSop = async () => {
    try {
      setLoading(true);

      const userStr = await AsyncStorage.getItem('user_guru');
      let parsedUser = null;
      if (userStr) {
        parsedUser = JSON.parse(userStr);
        setCurrentUser(parsedUser);
      }

      // 1. Data Lembaga (Kop Surat)
      const { data: lembagaData } = await supabase
        .from('data_lembaga')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (lembagaData) setLembaga(lembagaData);

      // 2. Ambil Ketua Panitia LANGSUNG dari Data Pegawai (jabatan_guru)
      const { data: listGuruJabatan, error: errJabatan } = await supabase
        .from('jabatan_guru')
        .select('guru_id, jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3');

      if (errJabatan) {
        console.error('Error fetch jabatan_guru in mobile:', errJabatan);
      }

      let ketuaName = 'Ketua Panitia Ujian';
      let ketuaGuruId: any = null;

      const foundKetua = (listGuruJabatan || []).find((jg: any) => {
        const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
        return jRoles.some((r: any) => (r || '').toLowerCase().includes('ketua panitia'));
      });

      if (foundKetua) {
        ketuaGuruId = foundKetua.guru_id;
        const { data: ketuaGuruData } = await supabase
          .from('data_guru')
          .select('nama')
          .eq('id', foundKetua.guru_id)
          .maybeSingle();
        if (ketuaGuruData?.nama) {
          ketuaName = ketuaGuruData.nama;
        }
      }

      setNamaKetua(ketuaName);

      // Cek apakah user saat ini adalah Ketua Panitia yang ditunjuk
      let isKetua = false;
      if (parsedUser?.id) {
        const currentUserId = Number(parsedUser.id);

        // A. Cek kecocokan langsung dengan ID Ketua Panitia dari Data Pegawai
        if (ketuaGuruId && Number(ketuaGuruId) === currentUserId) {
          isKetua = true;
        }

        // B. Cek dari daftar jabatan guru yang sudah diambil
        const userJabatanRow = (listGuruJabatan || []).find((jg: any) => Number(jg.guru_id) === currentUserId);
        if (userJabatanRow) {
          const uRoles = [
            userJabatanRow.jabatan_utama,
            userJabatanRow.jabatan_lain_1,
            userJabatanRow.jabatan_lain_2,
            userJabatanRow.jabatan_lain_3
          ];
          if (uRoles.some((r: any) => (r || '').toLowerCase().includes('ketua panitia'))) {
            isKetua = true;
          }
        }

        // C. Cek query langsung ke jabatan_guru untuk user saat ini (safety fallback)
        if (!isKetua) {
          const { data: directJabatan } = await supabase
            .from('jabatan_guru')
            .select('*')
            .eq('guru_id', currentUserId)
            .maybeSingle();

          if (directJabatan) {
            const dRoles = [
              directJabatan.jabatan_utama,
              directJabatan.jabatan_lain_1,
              directJabatan.jabatan_lain_2,
              directJabatan.jabatan_lain_3
            ];
            if (dRoles.some((r: any) => (r || '').toLowerCase().includes('ketua panitia'))) {
              isKetua = true;
            }
          }
        }

        // D. Cek role/jabatan dari session user
        const sessionRole = (parsedUser.role || parsedUser.jabatan || parsedUser.jabatan_utama || '').toLowerCase();
        if (sessionRole.includes('ketua panitia')) {
          isKetua = true;
        }
      }

      setIsKetuaPanitia(isKetua);

      // 3. SOP Data Aktif
      const { data: sop } = await supabase
        .from('cbt_sop_persetujuan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSopData(sop);
      if (sop?.jenis_ujian) {
        setSelectedJenisUjian(sop.jenis_ujian);
      }

      // 4. Guru Signed / Read Status
      if (sop?.id && parsedUser?.id) {
        const { data: guruSop } = await supabase
          .from('cbt_persetujuan_guru')
          .select('*')
          .eq('sop_id', sop.id)
          .eq('guru_id', parsedUser.id)
          .maybeSingle();

        if (guruSop && (guruSop.is_paham_sop || guruSop.tanda_tangan_guru)) {
          setGuruSigned(true);
          setHasReadToBottom(true);
        }
      }

      if (isKetua && (sop?.is_approved || sop?.is_tata_tertib_approved || sop?.tanda_tangan_ketua)) {
        setHasReadToBottom(true);
      }
    } catch (e) {
      console.error('Error fetchSop:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenKetuaModal = () => {
    setTempSignature('');
    if (sopData?.titimangsa_tanggal) {
      setTanggalPersetujuan(sopData.titimangsa_tanggal);
    } else {
      setTanggalPersetujuan(new Date().toISOString().split('T')[0]);
    }
    setShowKetuaModal(true);
  };

  const handleApproveTataTertib = async () => {
    if (!tempSignature) {
      Alert.alert(
        'Tanda Tangan Kosong',
        'Silakan goreskan tanda tangan Anda pada kanvas terlebih dahulu sebelum mengesahkan dokumen.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const todayStr = tanggalPersetujuan || new Date().toISOString().split('T')[0];

      let currentSopId = sopData?.id;
      const tempat = sopData?.titimangsa_tempat || (lembaga?.kecamatan ? `Kec. ${lembaga.kecamatan}` : 'Compreng');

      const sopPayload: any = {
        jenis_ujian: selectedJenisUjian || 'PSAJ',
        tahun_ajaran: sopData?.tahun_ajaran || '2025/2026',
        semester: sopData?.semester || 'Genap',
        is_tata_tertib_approved: true,
        is_approved: true,
        tanda_tangan_ketua: tempSignature,
        tanggal_pelaksanaan_mulai: todayStr,
        titimangsa_tempat: tempat,
        titimangsa_tanggal: todayStr,
        approved_at: new Date().toISOString()
      };

      if (currentSopId) {
        const { data: updData, error: updErr } = await supabase
          .from('cbt_sop_persetujuan')
          .update(sopPayload)
          .eq('id', currentSopId)
          .select()
          .single();
        if (updErr) throw updErr;
        setSopData(updData);
      } else {
        const { data: insData, error: insErr } = await supabase
          .from('cbt_sop_persetujuan')
          .insert([sopPayload])
          .select()
          .single();
        if (insErr) throw insErr;
        currentSopId = insData.id;
        setSopData(insData);
      }

      // Catat juga di cbt_persetujuan_guru untuk Ketua Panitia
      if (currentUser?.id && currentSopId) {
        await supabase
          .from('cbt_persetujuan_guru')
          .upsert({
            sop_id: currentSopId,
            guru_id: currentUser.id,
            is_paham_sop: true,
            tanggal_persetujuan: todayStr,
            signed_at: new Date().toISOString()
          }, { onConflict: 'sop_id,guru_id' });

        await AsyncStorage.setItem(`cbt_sop_approved_${currentUser.id}`, 'true');
      }

      DeviceEventEmitter.emit('globalRefresh');

      setShowKetuaModal(false);
      setHasReadToBottom(true);

      const jenisText = selectedJenisUjian === 'Tugas' ? 'Tugas' : selectedJenisUjian.toUpperCase();
      Alert.alert(
        'SOP Berhasil Disahkan',
        `Dokumen SOP & Tata Tertib ${jenisText} telah disahkan secara resmi! Tombol Cetak Dokumen dan akses Jadwal Ujian kini telah terbuka.`,
        [{ text: 'Buka Jadwal Ujian', onPress: () => router.replace('/ujian/jadwal' as any) }]
      );
    } catch (err: any) {
      console.error('Error handleApproveTataTertib:', err);
      Alert.alert('Gagal', err.message || 'Terjadi kesalahan saat mengesahkan tata tertib.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuruPahamSop = async () => {
    if (!sopData?.id || !currentUser?.id) {
      router.replace('/ujian/jadwal' as any);
      return;
    }
    try {
      setIsSubmitting(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('cbt_persetujuan_guru')
        .upsert(
          {
            sop_id: sopData.id,
            guru_id: currentUser.id,
            is_paham_sop: true,
            tanggal_persetujuan: todayStr,
            signed_at: new Date().toISOString()
          },
          { onConflict: 'sop_id,guru_id' }
        );

      if (error) throw error;

      setGuruSigned(true);
      await AsyncStorage.setItem(`cbt_sop_approved_${currentUser.id}`, 'true');
      router.replace('/ujian/jadwal' as any);
    } catch (err: any) {
      console.error(err);
      router.replace('/ujian/jadwal' as any);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintMobile = async () => {
    try {
      const logoHtml = lembaga?.logo_url ? `<img src="${lembaga.logo_url}" style="width: 50px; height: 50px; object-fit: contain;" />` : '';
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>SOP & Tata Tertib ${jenisUjianText}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 25px; color: #111; line-height: 1.45; font-size: 11px; }
            .header-table { width: 100%; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
            .school-name { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 0; }
            .school-sub { font-size: 10.5px; margin: 2px 0; color: #444; }
            .title-box { text-align: center; margin: 14px 0; }
            .doc-title { font-size: 13px; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin: 0; }
            .doc-sub { font-size: 11px; font-weight: bold; margin-top: 3px; }
            .section-title { font-size: 11.5px; font-weight: bold; text-transform: uppercase; margin: 14px 0 6px 0; font-family: sans-serif; background: #f1f5f9; padding: 5px 8px; border-radius: 4px; }
            .sub-title { font-size: 11px; font-weight: bold; margin: 8px 0 3px 0; }
            ol { margin: 0 0 10px 0; padding-left: 18px; }
            li { margin-bottom: 4px; text-align: justify; }
            .ttd-box { margin-top: 24px; float: right; width: 230px; text-align: center; }
            .ttd-space { height: 55px; display: flex; align-items: center; justify-content: center; }
            .ttd-name { font-weight: bold; text-decoration: underline; text-transform: uppercase; font-size: 11px; }
            .clearfix { clear: both; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="width: 60px; vertical-align: middle;">${logoHtml}</td>
              <td style="text-align: center; vertical-align: middle;">
                <div class="school-name">${lembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}</div>
                <div class="school-sub">${lembaga?.alamat || 'Kec. Compreng, Kab. Subang'}</div>
                <div class="school-sub">STANDAR OPERASIONAL PROSEDUR & TATA TERTIB ${jenisUjianText.toUpperCase()}</div>
              </td>
            </tr>
          </table>

          <div class="title-box">
            <div class="doc-title">STANDAR OPERASIONAL PROSEDUR (SOP) & TATA TERTIB ${jenisUjianText.toUpperCase()}</div>
            <div class="doc-sub">PENILAIAN ${jenisUjianText.toUpperCase()} TAHUN AJARAN ${sopData?.tahun_ajaran || '2025/2026'}</div>
          </div>

          <div class="section-title">BAGIAN I: TATA TERTIB PENGAWAS RUANG ${jenisUjianText.toUpperCase()}</div>
          <div class="sub-title">A. DI RUANG SEKRETARIAT / PANITIA ${jenisUjianText.toUpperCase()}</div>
          <ol>
            <li>30 Menit sebelum ${jenisUjianText} dimulai, Pengawas Ruang telah hadir di ruang sekretariat panitia ${jenisUjianText}.</li>
            <li>Pengawas Ruang menerima penjelasan dan pengarahan teknis pelaksanaan ${jenisUjianText} dari Ketua Panitia ${jenisUjianText}.</li>
            <li>Pengawas Ruang mengisi dan menandatangani pakta integritas pelaksanaan ${jenisUjianText} di hadapan Ketua Panitia ${jenisUjianText}.</li>
            <li>Pengawas Ruang menerima bahan pelaksanaan ${jenisUjianText} berupa amplop/berkas yang berisi daftar hadir peserta, lembar berita acara pelaksanaan ${jenisUjianText}, serta akses CBT.</li>
          </ol>

          <div class="sub-title">B. DI RUANG ${jenisUjianText.toUpperCase()}</div>
          <p style="font-style: italic; margin-bottom: 5px;">Pengawas masuk ke dalam ruang ${jenisUjianText} 15 (lima belas) menit sebelum waktu pelaksanaan untuk melakukan tugas secara berurutan:</p>
          <ol>
            <li>Memeriksa kesiapan fisik ruang ${jenisUjianText}, kebersihan, pencahayaan, serta kestabilan koneksi internet/jaringan;</li>
            <li>Memimpin Apel peserta ${jenisUjianText} dan memeriksa kerapihan serta kelengkapan seragam Peserta ${jenisUjianText};</li>
            <li>Meminta peserta ${jenisUjianText} untuk memasuki ruang dengan menunjukkan Kartu Peserta ${jenisUjianText}, meletakkan tas di bagian depan ruang ujian, serta menempati tempat duduk sesuai nomor yang telah ditentukan;</li>
            <li>Memeriksa dan memastikan setiap peserta ${jenisUjianText} hanya membawa 1 Smartphone, Kartu Peserta ${jenisUjianText}, dan 1 Ballpoint di tempat duduk masing-masing;</li>
            <li>Memeriksa dan memastikan aplikasi CBT / Link Soal ${jenisUjianText} telah siap diakses pada perangkat peserta;</li>
            <li>Membacakan tata tertib ${jenisUjianText} secara jelas di depan seluruh peserta;</li>
            <li>Memberikan kesempatan kepada peserta ${jenisUjianText} untuk mengecek kelengkapan soal dan tampilan pada aplikasi ujian;</li>
            <li>Mewajibkan peserta ${jenisUjianText} melengkapi isian identitas akun pada aplikasi CBT secara benar (dipandu langsung oleh pengawas ruang);</li>
            <li>Memastikan peserta ${jenisUjianText} telah mengisi identitas dengan benar sesuai kartu peserta ${jenisUjianText};</li>
            <li>Memastikan peserta ${jenisUjianText} menandatangani daftar hadir pelaksanaan ${jenisUjianText};</li>
            <li>Mengingatkan peserta agar terlebih dahulu membaca petunjuk cara menjawab soal ${jenisUjianText} dengan teliti;</li>
            <li>Memimpin doa bersama dan mengingatkan seluruh peserta untuk senantiasa bekerja secara mandiri dan jujur;</li>
            <li>Mempersilakan seluruh peserta ${jenisUjianText} untuk membuka menu Jadwal dan mulai mengerjakan soal;</li>
            <li>Selama ${jenisUjianText} berlangsung, pengawas ruang ${jenisUjianText} wajib menjaga ketertiban, memantau integritas pengerjaan, memberi peringatan kecurangan, melarang pihak tidak berkepentingan masuk, serta DILARANG merokok, mengobrol, membaca di luar tugas, tidur, atau memberi bantuan jawaban;</li>
            <li>10 (sepuluh) menit sebelum waktu ${jenisUjianText} selesai, pengawas ruang memberi peringatan kepada peserta bahwa waktu tersisa 10 menit;</li>
            <li>Setelah waktu ${jenisUjianText} selesai: mempersilakan berhenti, menekan tombol kirim jawaban di aplikasi CBT, memverifikasi seluruh respon jawaban ${jenisUjianText} masuk lengkap di sistem pengawas, dan menyusun berkas berita acara ke map panitia di ruang sekretariat.</li>
          </ol>

          <div class="section-title">BAGIAN II: TATA TERTIB PESERTA ${jenisUjianText.toUpperCase()}</div>
          <ol>
            <li>15 (lima belas) menit sebelum ${jenisUjianText} dimulai atau setelah tanda masuk dibunyikan, Peserta ${jenisUjianText} berbaris di depan ruangan untuk melaksanakan Apel.</li>
            <li>Peserta ${jenisUjianText} yang terlambat hadir hanya diperkenankan mengikuti ${jenisUjianText} setelah mendapat izin dari Penanggung Jawab / Ketua Panitia ${jenisUjianText}, tanpa diberikan perpanjangan waktu.</li>
            <li>Peserta ${jenisUjianText} hanya diperkenankan membawa 1 Smartphone, Kartu Peserta ${jenisUjianText}, dan 1 Ballpoint. Dilarang keras membawa kalkulator, tas, buku, dan catatan dalam bentuk apapun ke tempat duduk ruang ${jenisUjianText}.</li>
            <li>Jika terdapat kendala pada Smartphone atau aplikasi CBT saat ${jenisUjianText}, segera melaporkan secara tenang dan tertib kepada Pengawas Ruang atau Panitia ${jenisUjianText}.</li>
            <li>Peserta ${jenisUjianText} diharuskan mengisi Presensi / Daftar Hadir ${jenisUjianText} secara digital maupun lembar fisik yang disediakan oleh pengawas.</li>
            <li>Peserta ${jenisUjianText} mulai login ke aplikasi dan membuka soal setelah diperkenankan oleh Pengawas Ruang.</li>
            <li>Peserta ${jenisUjianText} yang memerlukan penjelasan teknis cara login atau mengalami kendala sistem untuk mengikuti ${jenisUjianText} dapat bertanya langsung kepada Pengawas Ruang.</li>
            <li>Selama ${jenisUjianText} berlangsung, peserta ${jenisUjianText} hanya dapat meninggalkan ruangan dengan izin dan pengawasan dari Pengawas Ruang ${jenisUjianText}, serta tidak melakukannya berulang kali.</li>
            <li>Peserta ${jenisUjianText} yang meninggalkan ruangan setelah membaca soal dan tidak kembali lagi sampai tanda selesai ${jenisUjianText} dibunyikan, dinyatakan telah selesai menempuh/mengikuti ${jenisUjianText} dan tidak mendapatkan nilai sama sekali (nilai 0) pada mata pelajaran yang terkait.</li>
            <li>Peserta ${jenisUjianText} yang telah selesai mengerjakan soal sebelum batas waktu ${jenisUjianText} berakhir tidak diperbolehkan meninggalkan ruangan hingga menekan tombol selesai dan mendapatkan izin dari pengawas ruang.</li>
            <li>Peserta ${jenisUjianText} wajib berhenti mengerjakan soal tepat setelah ada tanda berakhirnya waktu ${jenisUjianText}.</li>
            <li>Larangan keras: menanyakan jawaban, bekerja sama, memberi/menerima bantuan, melihat pekerjaan orang lain, membuka tab lain/browsing di internet, atau menukar Smartphone.</li>
          </ol>

          <div class="ttd-box">
            <div>${sopData?.titimangsa_tempat || (lembaga?.kecamatan ? `Kec. ${lembaga.kecamatan}` : 'Compreng')}, ${formatDateIndonesia(sopData?.titimangsa_tanggal || '')}</div>
            <div style="font-weight: bold; margin-top: 4px;">Mengetahui,<br>Ketua Panitia ${jenisUjianText}</div>
            <div class="ttd-space">
              ${sopData?.tanda_tangan_ketua ? (sopData.tanda_tangan_ketua.includes('<svg') ? `<div style="max-height: 50px; max-width: 150px; display: inline-block;">${sopData.tanda_tangan_ketua}</div>` : `<img src="${sopData.tanda_tangan_ketua}" style="max-height: 50px; max-width: 150px; object-fit: contain;" />`) : '<i>(Disahkan Secara Digital)</i>'}
            </div>
            <div class="ttd-name">${namaKetua || 'Ketua Pelaksana'}</div>
            <div style="font-size: 10px; color: #555;">Ketua Pelaksana ${jenisUjianText}</div>
          </div>
          <div class="clearfix"></div>
        </body>
        </html>
      `;
      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Gagal Mencetak', err.message || 'Terjadi kesalahan saat mencetak SOP.');
    }
  };

  const isKetuaSigned = !!(sopData?.is_approved || sopData?.is_tata_tertib_approved || sopData?.tanda_tangan_ketua);
  const jenisUjianRaw = (sopData?.jenis_ujian || selectedJenisUjian || 'PSAJ').trim();
  const jenisUjianText = jenisUjianRaw.toLowerCase() === 'tugas' ? 'Tugas' : jenisUjianRaw.toUpperCase();

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#2a2c87', '#3b3e9e']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>SOP & Tata Tertib {jenisUjianText}</Text>
          {isKetuaSigned && (
            <TouchableOpacity onPress={handlePrintMobile} style={styles.printHeaderBtn} accessibilityLabel="Cetak Dokumen">
              <Printer color="#fff" size={20} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerSubtitle} numberOfLines={1}>Pedoman Resmi Pelaksanaan {jenisUjianText} CBT</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#2a2c87" />
          <Text style={styles.loadingText}>Memuat Dokumen SOP Ujian...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 120 }
          ]}
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60) {
              setHasReadToBottom(true);
            }
          }}
          scrollEventThrottle={16}
        >
          {/* Kop Lembaga */}
          <View style={styles.kopCard}>
            {lembaga?.logo_url ? (
              <Image source={{ uri: lembaga.logo_url }} style={styles.kopLogo} resizeMode="contain" />
            ) : (
              <Building size={36} color="#2a2c87" />
            )}
            <View style={styles.kopTextContainer}>
              <Text style={styles.kopSchoolName}>{lembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}</Text>
              <Text style={styles.kopAddress}>{lembaga?.alamat || 'Kec. Compreng, Kab. Subang'}</Text>
              <Text style={styles.kopDocTitle}>STANDAR OPERASIONAL PROSEDUR & TATA TERTIB {jenisUjianText.toUpperCase()}</Text>
            </View>
          </View>

          {/* Status Persetujuan Card */}
          <View style={[styles.statusCard, !isKetuaSigned && { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
            <View style={[styles.statusIconBox, !isKetuaSigned && { backgroundColor: '#fef3c7' }]}>
              {isKetuaSigned ? (
                <ShieldCheck size={28} color="#16a34a" />
              ) : (
                <AlertTriangle size={24} color="#d97706" />
              )}
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={[styles.statusTitle, !isKetuaSigned && { color: '#b45309' }]}>
                {isKetuaSigned ? `SOP ${jenisUjianText} Telah Disahkan` : 'Menunggu Pengesahan Ketua Panitia'}
              </Text>
              <Text style={[styles.statusDesc, !isKetuaSigned && { color: '#92400e' }]}>
                Penilaian {jenisUjianText} • T.A. {sopData?.tahun_ajaran || '2025/2026'}
              </Text>
              {sopData?.titimangsa_tempat && (
                <Text style={styles.statusDate}>
                  Ditetapkan di {sopData.titimangsa_tempat}, {sopData.titimangsa_tanggal}
                </Text>
              )}
            </View>
          </View>

          {/* BAGIAN I: TATA TERTIB PENGAWAS RUANG */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <UserCheck size={18} color="#2a2c87" />
              <Text style={styles.sectionTitle}>BAGIAN I: TATA TERTIB PENGAWAS RUANG {jenisUjianText}</Text>
            </View>

            {/* A. DI RUANG SEKRETARIAT */}
            <Text style={styles.subHeading}>A. DI RUANG SEKRETARIAT / PANITIA {jenisUjianText.toUpperCase()}</Text>
            <View style={styles.ruleList}>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>1.</Text>
                <Text style={styles.ruleText}>30 Menit sebelum {jenisUjianText} dimulai, pengawas ruang telah hadir di ruang sekretariat panitia {jenisUjianText}.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>2.</Text>
                <Text style={styles.ruleText}>Pengawas ruang menerima penjelasan dan pengarahan teknis pelaksanaan {jenisUjianText} dari Ketua Panitia {jenisUjianText}.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>3.</Text>
                <Text style={styles.ruleText}>Pengawas ruang mengisi dan menandatangani pakta integritas di depan Ketua Panitia {jenisUjianText}.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>4.</Text>
                <Text style={styles.ruleText}>Pengawas ruang menerima berkas {jenisUjianText} berupa amplop berisi daftar hadir, berita acara pelaksanaan {jenisUjianText}, serta akses sesi CBT.</Text>
              </View>
            </View>

            {/* B. DI RUANG UJIAN */}
            <Text style={[styles.subHeading, { marginTop: 14 }]}>B. DI RUANG {jenisUjianText.toUpperCase()}</Text>
            <Text style={styles.subNote}>
              Pengawas masuk ke ruang {jenisUjianText} 15 (lima belas) menit sebelum waktu pelaksanaan untuk melakukan tugas secara berurutan:
            </Text>
            <View style={styles.ruleList}>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>1.</Text>
                <Text style={styles.ruleText}>Memeriksa kesiapan fisik ruang {jenisUjianText}, kebersihan, pencahayaan, dan kestabilan jaringan internet/server.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>2.</Text>
                <Text style={styles.ruleText}>Memimpin Apel dan memeriksa kerapihan serta kelengkapan seragam Peserta {jenisUjianText}.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>3.</Text>
                <Text style={styles.ruleText}>Meminta peserta memasuki ruang dengan menunjukkan Kartu Peserta {jenisUjianText}, menaruh tas di bagian depan ruang, serta menempati tempat duduk sesuai nomor meja.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>4.</Text>
                <Text style={styles.ruleText}>Memeriksa dan memastikan setiap peserta hanya membawa 1 Smartphone, Kartu Peserta {jenisUjianText}, dan Ballpoint di meja masing-masing.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>5.</Text>
                <Text style={styles.ruleText}>Memeriksa dan memastikan link soal / aplikasi ujian CBT {jenisUjianText} telah siap di perangkat peserta.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>6.</Text>
                <Text style={styles.ruleText}>Membacakan tata tertib {jenisUjianText} di depan seluruh peserta.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>7.</Text>
                <Text style={styles.ruleText}>Memberikan kesempatan kepada peserta untuk mengecek kelengkapan soal pada layar perangkat.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>8.</Text>
                <Text style={styles.ruleText}>Mewajibkan peserta melengkapi isian identitas akun CBT secara benar (dipandu langsung oleh pengawas).</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>9.</Text>
                <Text style={styles.ruleText}>Memastikan peserta mengisi identitas sesuai kartu peserta dan menandatangani daftar hadir {jenisUjianText}.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>10.</Text>
                <Text style={styles.ruleText}>Mengingatkan peserta membaca petunjuk soal {jenisUjianText}, memimpin doa, dan bekerja dengan jujur.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>11.</Text>
                <Text style={styles.ruleText}>Mempersilakan peserta membuka menu Jadwal dan mulai mengerjakan soal {jenisUjianText}.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>12.</Text>
                <Text style={styles.ruleText}>Menjaga ketertiban ruang {jenisUjianText}, menindak kecurangan, serta melarang orang tidak berkepentingan masuk.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>13.</Text>
                <Text style={styles.ruleText}>DILARANG merokok di ruang ujian, mengobrol, membaca di luar tugas, tidur, bermain HP pribadi, atau memberi petunjuk jawaban soal {jenisUjianText}.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>14.</Text>
                <Text style={styles.ruleText}>10 Menit sebelum {jenisUjianText} berakhir, memberi peringatan waktu tersisa 10 menit.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>15.</Text>
                <Text style={styles.ruleText}>Setelah waktu {jenisUjianText} berakhir: mempersilakan berhenti, menekan tombol kirim jawaban, memverifikasi seluruh respon jawaban {jenisUjianText} masuk lengkap di sistem pengawas, dan menyusun berkas berita acara ke map panitia.</Text>
              </View>
            </View>
          </View>

          {/* BAGIAN II: TATA TERTIB PESERTA */}
          <View style={[styles.sectionCard, { borderColor: '#bbf7d0' }]}>
            <View style={styles.sectionHeader}>
              <Users size={18} color="#16a34a" />
              <Text style={[styles.sectionTitle, { color: '#15803d' }]}>BAGIAN II: TATA TERTIB PESERTA {jenisUjianText}</Text>
            </View>
            <View style={styles.ruleList}>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>1.</Text>
                <Text style={styles.ruleText}>15 Menit sebelum {jenisUjianText} dimulai atau tanda masuk berbunyi, peserta berbaris untuk Apel.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>2.</Text>
                <Text style={styles.ruleText}>Peserta terlambat hanya boleh ikut {jenisUjianText} setelah mendapat izin Penanggung Jawab / Ketua Panitia {jenisUjianText}, tanpa perpanjangan waktu.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>3.</Text>
                <Text style={styles.ruleText}>Hanya diperkenankan membawa 1 Smartphone, Kartu Peserta {jenisUjianText}, dan 1 Ballpoint. Dilarang membawa kalkulator, buku, atau catatan ke tempat duduk.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>4.</Text>
                <Text style={styles.ruleText}>Jika terdapat kendala pada Smartphone atau aplikasi CBT {jenisUjianText}, segera lapor ke Pengawas Ruang secara tertib.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>5.</Text>
                <Text style={styles.ruleText}>Peserta wajib mengisi daftar hadir dan mulai login ke soal setelah diperkenankan oleh pengawas.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>6.</Text>
                <Text style={styles.ruleText}>Meninggalkan ruang selama {jenisUjianText} berlangsung hanya dengan izin pengawas dan tidak berulang kali.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>7.</Text>
                <Text style={styles.ruleText}>Peserta yang meninggalkan ruangan setelah membaca soal dan tidak kembali sampai selesai {jenisUjianText} dinyatakan selesai dan mendapatkan nilai nol (0).</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>8.</Text>
                <Text style={styles.ruleText}>Peserta yang selesai lebih cepat dilarang meninggalkan ruangan sebelum menekan tombol selesai dan diizinkan pengawas ruang.</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>9.</Text>
                <Text style={styles.ruleText}>Larangan keras: menanyakan jawaban ke siapapun, bekerja sama, memberi/menerima bantuan, membuka tab lain/browsing contekan di internet, atau menukar Smartphone.</Text>
              </View>
            </View>
          </View>

          {/* Pengesahan Ketua Panitia Card */}
          <View style={styles.ttdCard}>
            <Text style={styles.ttdDate}>
              {sopData?.titimangsa_tempat || (lembaga?.kecamatan ? `Kec. ${lembaga.kecamatan}` : 'Compreng')}, {formatDateIndonesia(sopData?.titimangsa_tanggal || new Date().toISOString().split('T')[0])}
            </Text>
            <Text style={styles.ttdRole}>Mengetahui, Ketua Panitia {jenisUjianText}</Text>
            <View style={styles.ttdBox}>
              {isKetuaSigned ? (
                sopData?.tanda_tangan_ketua ? (
                  sopData.tanda_tangan_ketua.startsWith('data:image/png') ||
                  sopData.tanda_tangan_ketua.startsWith('http') ? (
                    <Image
                      source={{ uri: sopData.tanda_tangan_ketua }}
                      style={{ width: 140, height: 60, resizeMode: 'contain' }}
                    />
                  ) : (
                    <SvgXml
                      xml={
                        sopData.tanda_tangan_ketua.startsWith('data:image/svg+xml')
                          ? decodeURIComponent(sopData.tanda_tangan_ketua.replace(/data:image\/svg\+xml;utf8,/, ''))
                          : sopData.tanda_tangan_ketua
                      }
                      width={140}
                      height={60}
                    />
                  )
                ) : (
                  <View style={styles.ttdBadge}>
                    <ShieldCheck size={18} color="#2a2c87" />
                    <Text style={styles.ttdBadgeText}>Dokumen Telah Disahkan</Text>
                  </View>
                )
              ) : (
                <Text style={styles.ttdWaiting}>(Belum Disahkan Ketua Panitia)</Text>
              )}
            </View>
            <Text style={styles.ttdName}>{namaKetua || 'Ketua Pelaksana'}</Text>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Ketua Pelaksana {jenisUjianText}</Text>
          </View>
        </ScrollView>
      )}

      {/* Sticky Bottom Actions */}
      {!loading && (
        <View style={[
          styles.footerActions,
          {
            paddingBottom: Platform.OS === 'android' 
              ? Math.max(insets.bottom, 28) + 16 
              : Math.max(insets.bottom, 20) + 10
          }
        ]}>
          {isKetuaPanitia && !isKetuaSigned ? (
            <TouchableOpacity
              style={styles.btnApprove}
              onPress={handleOpenKetuaModal}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <CheckCircle2 size={18} color="#fff" />
                  <Text style={styles.btnActionText}>Sahkan SOP & Tata Tertib {jenisUjianText} (Ketua Panitia)</Text>
                </>
              )}
            </TouchableOpacity>
          ) : !isKetuaSigned && !isKetuaPanitia ? (
            <View style={styles.btnDisabled}>
              <Lock size={18} color="#94a3b8" />
              <Text style={styles.btnDisabledText}>Menunggu Pengesahan Ketua Panitia</Text>
            </View>
          ) : !hasReadToBottom && !isKetuaPanitia ? (
            <View style={{ gap: 6, width: '100%' }}>
              <View style={styles.scrollHintBox}>
                <ChevronDown size={14} color="#b45309" />
                <Text style={styles.scrollHintText}>Gulir ke bawah hingga selesai membaca untuk melanjutkan</Text>
              </View>
              <View style={styles.btnDisabled}>
                <Lock size={18} color="#94a3b8" />
                <Text style={styles.btnDisabledText}>Gulir ke Bawah untuk Membaca</Text>
              </View>
            </View>
          ) : (
            <View style={styles.bottomRowButtons}>
              {/* Tombol Cetak Dokumen di Bagian Bawah */}
              {isKetuaSigned && (
                <TouchableOpacity
                  style={styles.btnPrintBottom}
                  onPress={handlePrintMobile}
                >
                  <Printer size={18} color="#2a2c87" />
                  <Text style={styles.btnPrintBottomText}>Cetak</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.btnNext, isKetuaSigned && { flex: 1 }]}
                onPress={handleGuruPahamSop}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.btnActionText}>Buka Jadwal Ujian</Text>
                    <ArrowRight size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Modal Pemilihan Jenis Ujian, Tanggal & Tanda Tangan untuk Ketua Panitia */}
      {showKetuaModal && (
        <Modal
          visible={showKetuaModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowKetuaModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Pengesahan SOP oleh Ketua Panitia</Text>
                  <Text style={styles.modalSubtitle}>Validasi dan tanda tangan resmi pedoman ujian CBT</Text>
                </View>
                <TouchableOpacity onPress={() => setShowKetuaModal(false)} style={{ padding: 4 }}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 14, paddingBottom: 10 }}
                scrollEnabled={!isDrawingOnCanvas}
              >
                {/* 1. Pilih Jenis Penilaian / Ujian */}
                <View>
                  <Text style={styles.inputLabel}>
                    Pilih Jenis Penilaian / Ujian <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <View style={styles.optionsContainer}>
                    {JENIS_UJIAN_OPTIONS.map((item) => {
                      const isSelected = selectedJenisUjian === item.value;
                      return (
                        <TouchableOpacity
                          key={item.value}
                          style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                          onPress={() => setSelectedJenisUjian(item.value)}
                        >
                          <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                          <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.inputHint}>
                    Seluruh teks pada dokumen SOP & Tata Tertib akan otomatis menggunakan nama jenis ujian yang Anda pilih.
                  </Text>
                </View>

                {/* 2. Pilihan Tanggal Titimangsa */}
                <View>
                  <Text style={styles.inputLabel}>
                    Tanggal Pengesahan Resmi <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Calendar size={18} color="#2a2c87" />
                    <Text style={styles.datePickerBtnText}>
                      {formatDateIndonesia(tanggalPersetujuan)}
                    </Text>
                    <ChevronDown size={16} color="#64748b" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={new Date(tanggalPersetujuan || new Date())}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onChangeDate}
                    />
                  )}
                </View>

                {/* 3. Kanvas Tanda Tangan Digital */}
                <View>
                  <Text style={styles.inputLabel}>
                    Goreskan Tanda Tangan Digital Ketua Panitia <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <MobileSignatureCanvas
                    height={160}
                    onSave={(sigData) => setTempSignature(sigData)}
                    onDrawingChange={(drawing) => setIsDrawingOnCanvas(drawing)}
                  />
                  <Text style={styles.inputHint}>
                    Gunakan jari Anda untuk membubuhkan tanda tangan resmi pada kotak kanvas di atas.
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => setShowKetuaModal(false)}
                >
                  <Text style={styles.btnCancelText}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnSubmitModal}
                  onPress={handleApproveTataTertib}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnSubmitModalText}>Simpan & Sahkan Dokumen</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  printHeaderBtn: {
    marginLeft: 'auto',
    padding: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    marginLeft: 42,
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
    gap: 14,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 12,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  statusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803d',
    flexWrap: 'wrap',
  },
  statusDesc: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  statusDate: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 2,
    fontStyle: 'italic',
    flexWrap: 'wrap',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignSelf: 'stretch',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  subHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2a2c87',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  subNote: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  ruleList: {
    gap: 8,
    alignSelf: 'stretch',
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    alignSelf: 'stretch',
    paddingRight: 4,
  },
  ruleNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2a2c87',
    width: 22,
    flexShrink: 0,
  },
  ruleText: {
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  kopCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  kopLogo: {
    width: 46,
    height: 46,
    flexShrink: 0,
  },
  kopTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  kopSchoolName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
    textTransform: 'uppercase',
    flexWrap: 'wrap',
  },
  kopAddress: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    flexWrap: 'wrap',
  },
  kopDocTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2a2c87',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  ttdCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  ttdDate: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  ttdRole: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  ttdBox: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  ttdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  ttdBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2a2c87',
  },
  ttdWaiting: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#94a3b8',
  },
  ttdName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    textDecorationLine: 'underline',
    flexWrap: 'wrap',
  },
  footerActions: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  bottomRowButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  btnPrintBottom: {
    backgroundColor: '#eff6ff',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  btnPrintBottomText: {
    color: '#2a2c87',
    fontSize: 13,
    fontWeight: '800',
  },
  scrollHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  scrollHintText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },
  btnApprove: {
    backgroundColor: '#2a2c87',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
  },
  btnNext: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
  },
  btnDisabled: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  btnDisabledText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  btnActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  datePickerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  canvasBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasPlaceholder: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  canvasPlaceholderText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  canvasResetBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  canvasResetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  optionsContainer: {
    gap: 8,
    marginVertical: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  optionItemSelected: {
    borderColor: '#2a2c87',
    backgroundColor: '#eff6ff',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#2a2c87',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2a2c87',
  },
  optionText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  optionTextSelected: {
    color: '#2a2c87',
    fontWeight: '800',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingBottom: Platform.OS === 'android' ? 16 : 8,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  btnSubmitModal: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2c87',
  },
  btnSubmitModalText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
});
