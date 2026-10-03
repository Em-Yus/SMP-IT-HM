import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, 
  TextInput, Platform, Alert, ScrollView, Image, Modal 
} from 'react-native';
// @ts-ignore
import { supabase } from '../../services/supabaseClient';
import { 
  Printer, Search, ArrowLeft, Users, Settings, Palette, CheckSquare, Square, 
  X, Sun, Moon, Image as ImageIcon, Trash2, Eye, Check, Sliders, Layers, RefreshCw
} from 'lucide-react-native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.EXPO_PUBLIC_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

export type Siswa = {
  id: number;
  nama: string;
  nisn: string;
  nipd: string;
  foto_url: string;
  kelas: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  alamat_detail: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  encryptedNipd?: string;
};

// 16 curated color presets matching modern design standards
const COLOR_PRESETS = [
  '#2a2c87', // Primary Navy Blue
  '#1e3a8a', // Deep Indigo
  '#2563eb', // Royal Blue
  '#0284c7', // Sky Blue
  '#0d9488', // Teal
  '#059669', // Emerald
  '#15803d', // Green
  '#d97706', // Amber / Gold
  '#dc2626', // Crimson Red
  '#b91c1c', // Dark Red
  '#7c3aed', // Purple
  '#db2777', // Rose Pink
  '#111827', // Dark Slate
  '#374151', // Charcoal Gray
  '#6b7280', // Medium Gray
  '#000000', // Pure Black
  '#ffffff', // Pure White
];

export default function CetakKartu() {
  const [allSiswa, setAllSiswa] = useState<Siswa[]>([]);
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dataLembaga, setDataLembaga] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'siswa' | 'pengaturan'>('siswa');
  const [previewSide, setPreviewSide] = useState<'depan' | 'belakang'>('depan');

  // Settings State matching Web App exactly
  const [settings, setSettings] = useState({
    orientation: 'landscape' as 'landscape' | 'portrait',
    themeColor: '#2a2c87',
    warnaNama: '#000000',
    warnaIdentitas: '#374151',
    warnaTtd: '#000000',
    warnaJudul: '#2a2c87',
    cardTheme: 'light' as 'light' | 'dark',
    mirrorPVC: false,
    bgImage: null as string | null,
    bgImageBack: null as string | null,
    showFields: {
      photo: true,
      qrcode: true,
      schoolLogo: true,
      signature: true
    }
  });

  // State for Color Picker Modal
  const [activeColorKey, setActiveColorKey] = useState<null | 'themeColor' | 'warnaJudul' | 'warnaNama' | 'warnaIdentitas' | 'warnaTtd'>(null);
  const [tempHex, setTempHex] = useState('');

  // State for background uploading and settings saving
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Lembaga
      const { data: lembaga, error: errLembaga } = await supabase
        .from('data_lembaga')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (!errLembaga && lembaga) setDataLembaga(lembaga);

      // 2. Fetch Siswa Aktif
      const { data: siswa, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('id, nama, nisn, nipd, foto_url, kelas, tempat_lahir, tanggal_lahir, alamat_detail, desa, kecamatan, kabupaten')
        .neq('kelas', 'Calon Siswa')
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (errSiswa) throw errSiswa;
      
      const processedData = (siswa || []).map((s: any) => {
        let enc = s.nipd || "NO-DATA";
        try {
          if (CryptoJS && CryptoJS.AES) {
            enc = CryptoJS.AES.encrypt(s.nipd || "NO-DATA", SECRET_KEY).toString();
          }
        } catch (e) {
          enc = s.nipd || "NO-DATA";
        }
        return {
          ...s,
          nama: s.nama || 'Tanpa Nama',
          nipd: s.nipd || '-',
          nisn: s.nisn || '-',
          kelas: s.kelas || '-',
          foto_url: s.foto_url || '',
          encryptedNipd: enc
        };
      });
      setAllSiswa(processedData);

      // 3. Fetch ID Card Settings from Supabase
      const { data: savedSettings } = await supabase
        .from('id_card_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (savedSettings) {
        setSettings(prev => ({
          ...prev,
          orientation: (savedSettings.orientasi === 'portrait' ? 'portrait' : 'landscape'),
          themeColor: savedSettings.warna_tema || '#2a2c87',
          warnaNama: savedSettings.warna_nama || '#000000',
          warnaIdentitas: savedSettings.warna_identitas || '#374151',
          warnaTtd: savedSettings.warna_ttd || '#000000',
          warnaJudul: savedSettings.warna_judul || savedSettings.warna_tema || '#2a2c87',
          cardTheme: (savedSettings.tema_kartu === 'dark' ? 'dark' : 'light'),
          mirrorPVC: savedSettings.mirror_pvc ?? false,
          bgImage: savedSettings.bg_depan || null,
          bgImageBack: savedSettings.bg_belakang || null,
          showFields: {
            photo: savedSettings.tampil_foto ?? true,
            qrcode: savedSettings.tampil_qr ?? true,
            schoolLogo: savedSettings.tampil_logo ?? true,
            signature: savedSettings.tampil_ttd ?? true
          }
        }));
      }

    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal memuat data dari server.');
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueKelas = Array.from(new Set(allSiswa.map(s => s.kelas).filter(Boolean))).sort();

  const filteredSiswa = allSiswa.filter(s => {
    const nama = (s.nama || '').toLowerCase();
    const nipd = (s.nipd || '').toLowerCase();
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch = nama.includes(query) || nipd.includes(query);
    const matchesKelas = selectedKelas ? s.kelas === selectedKelas : true;
    return matchesSearch && matchesKelas;
  });

  const toggleSiswa = (id: number) => {
    setSelectedSiswaIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const toggleAllSiswa = (check: boolean) => {
    if (check) {
      // Pilih hanya siswa yang saat ini sedang tampil pada filter
      setSelectedSiswaIds(filteredSiswa.map(s => s.id));
    } else {
      // Kosongkan siswa yang ada pada filter yang sedang aktif
      setSelectedSiswaIds(prev => prev.filter(id => !filteredSiswa.some(s => s.id === id)));
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Upload Background Image via ImagePicker
  const handleBgUpload = async (type: 'front' | 'back') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Dibutuhkan', 'Aplikasi membutuhkan izin akses galeri foto untuk memilih gambar background.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setIsUploadingBg(true);
      const asset = result.assets[0];
      const fileExt = asset.uri.split('.').pop() || 'jpg';
      const fileName = `bg_${type}_${Date.now()}.${fileExt}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('id-card-backgrounds')
        .upload(fileName, blob, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('id-card-backgrounds')
        .getPublicUrl(fileName);

      if (type === 'front') {
        setSettings(prev => ({ ...prev, bgImage: urlData.publicUrl }));
      } else {
        setSettings(prev => ({ ...prev, bgImageBack: urlData.publicUrl }));
      }

      Alert.alert('Berhasil', `Background ${type === 'front' ? 'depan' : 'belakang'} berhasil diunggah.`);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal Mengunggah', err.message || 'Terjadi kesalahan saat mengunggah background.');
    } finally {
      setIsUploadingBg(false);
    }
  };

  const removeBgImage = (type: 'front' | 'back') => {
    if (type === 'front') {
      setSettings(prev => ({ ...prev, bgImage: null }));
    } else {
      setSettings(prev => ({ ...prev, bgImageBack: null }));
    }
  };

  // Open Color Picker Modal
  const openColorPicker = (key: 'themeColor' | 'warnaJudul' | 'warnaNama' | 'warnaIdentitas' | 'warnaTtd') => {
    setActiveColorKey(key);
    setTempHex(settings[key] || '#000000');
  };

  const applyColor = () => {
    if (activeColorKey) {
      let finalHex = tempHex.trim();
      if (!finalHex.startsWith('#')) finalHex = '#' + finalHex;
      setSettings(prev => ({ ...prev, [activeColorKey]: finalHex }));
      setActiveColorKey(null);
    }
  };

  // Save Settings to Supabase id_card_settings table
  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = {
        orientasi: settings.orientation,
        warna_tema: settings.themeColor,
        warna_nama: settings.warnaNama,
        warna_identitas: settings.warnaIdentitas,
        warna_ttd: settings.warnaTtd,
        warna_judul: settings.warnaJudul,
        bg_depan: settings.bgImage,
        bg_belakang: settings.bgImageBack,
        mirror_pvc: settings.mirrorPVC,
        tema_kartu: settings.cardTheme,
        tampil_foto: settings.showFields.photo,
        tampil_qr: settings.showFields.qrcode,
        tampil_logo: settings.showFields.schoolLogo,
        tampil_ttd: settings.showFields.signature,
      };

      const { data: existing } = await supabase
        .from('id_card_settings')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from('id_card_settings').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('id_card_settings').insert([payload]);
        if (error) throw error;
      }

      Alert.alert('Tersimpan!', 'Pengaturan kartu berhasil disimpan dan diselaraskan.');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', err.message || 'Gagal menyimpan pengaturan ke database.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Reset to default colors
  const resetToDefault = () => {
    Alert.alert(
      'Reset Pengaturan',
      'Kembalikan semua warna dan pengaturan kartu ke standar default?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            setSettings(prev => ({
              ...prev,
              orientation: 'landscape',
              themeColor: '#2a2c87',
              warnaNama: '#000000',
              warnaIdentitas: '#374151',
              warnaTtd: '#000000',
              warnaJudul: '#2a2c87',
              cardTheme: 'light',
              mirrorPVC: false,
              showFields: {
                photo: true,
                qrcode: true,
                schoolLogo: true,
                signature: true
              }
            }));
          }
        }
      ]
    );
  };

  // HTML Generator exactly synchronized with Web App
  const generateHTML = () => {
    const selectedStudents = allSiswa.filter(s => selectedSiswaIds.includes(s.id));

    const { themeColor, warnaNama, warnaIdentitas, warnaTtd, warnaJudul, showFields, orientation, cardTheme, mirrorPVC, bgImage, bgImageBack } = settings;
    const isLandscape = orientation === 'landscape';
    const isDark = cardTheme === 'dark';
    const bgColor = themeColor;
    const kepalaSekolah = dataLembaga?.kepala_sekolah || 'Kepala Sekolah';
    const schoolName = (dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase();
    const schoolAddr = dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang';
    const logoSrc = dataLembaga?.logo_url || 'https://www.e-ujian.com/smpithm/logo';

    // Pre-compute high-resolution QR URLs
    const qrMap: { [id: number]: string } = {};
    if (showFields.qrcode) {
      selectedStudents.forEach(s => {
        const raw = s.encryptedNipd || s.nipd || '';
        const encoded = encodeURIComponent(raw);
        qrMap[s.id] = 'https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=' + encoded;
      });
    }

    const studentsPerPage = 5;
    const pages: typeof selectedStudents[] = [];
    for (let i = 0; i < selectedStudents.length; i += studentsPerPage) {
      pages.push(selectedStudents.slice(i, i + studentsPerPage));
    }

    let sheetsHTML = '';

    pages.forEach(pageStudents => {
      let rowsHTML = '';

      pageStudents.forEach(s => {
        const addr = [s.alamat_detail, s.desa, s.kecamatan, s.kabupaten].filter(Boolean).join(' - ').toLowerCase();
        const ttl = ((s.tempat_lahir || '-').toLowerCase()) + ', ' + formatDate(s.tanggal_lahir);
        const qrSrc = qrMap[s.id] || '';

        const bgDepanHTML = bgImage
          ? '<div style="position:absolute;inset:0;z-index:0;background-image:url(\'' + bgImage + '\');background-size:cover;background-position:center;background-repeat:no-repeat;background-color:' + bgColor + '15;"></div>'
          : '<div style="position:absolute;inset:0;z-index:0;background-color:' + bgColor + '10;"></div>';

        const bgBelakangHTML = bgImageBack
          ? '<div style="position:absolute;inset:0;z-index:0;background-image:url(\'' + bgImageBack + '\');background-size:cover;background-position:center;background-repeat:no-repeat;background-color:' + bgColor + '15;"></div>'
          : '<div style="position:absolute;inset:0;z-index:0;background-color:' + bgColor + '10;"></div>';

        let frontCardContent = '';
        let backCardContent = '';

        if (isLandscape) {
          // ===============================
          // LANDSCAPE CARD (87.6mm x 56mm)
          // ===============================
          const photoHTML = (showFields.photo && s.foto_url)
            ? '<img src="' + s.foto_url + '" style="width:22mm;height:28mm;object-fit:cover;display:block;" />'
            : '<div style="width:22mm;height:28mm;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:6pt;background:#f3f4f6;">No Photo</div>';

          const logoHTML = showFields.schoolLogo
            ? '<img src="' + logoSrc + '" style="width:8mm;height:8mm;object-fit:contain;flex-shrink:0;margin-right:2mm;" />'
            : '';

          const sigHTML = showFields.signature
            ? '<div style="margin-top:auto;display:flex;justify-content:flex-end;width:100%;padding-right:1mm;">'
              + '<div style="text-align:center;">'
              + '<div style="font-size:4.5pt;color:' + warnaTtd + ';">Kepala Sekolah,</div>'
              + '<div style="height:6mm;"></div>'
              + '<div style="font-size:5pt;font-style:italic;font-family:serif;border-bottom:0.5pt solid #9ca3af;color:' + warnaTtd + ';">' + kepalaSekolah + '</div>'
              + '</div></div>'
            : '';

          // FRONT
          frontCardContent = [
            '<div style="width:87.6mm;height:56mm;position:relative;overflow:hidden;border:0.5pt solid ' + (isDark ? '#374151' : '#e5e7eb') + ';border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);background:' + (isDark ? '#1f2937' : '#ffffff') + ';box-sizing:border-box;">',
            bgDepanHTML,
            '  <div style="position:absolute;top:0;left:0;height:100%;width:1.5mm;background-color:' + bgColor + ';z-index:10;"></div>',
            '  <div style="display:flex;flex-direction:column;height:100%;width:100%;padding:3mm 3mm 2.5mm 4mm;box-sizing:border-box;position:relative;z-index:1;">',
            '    <div style="display:flex;align-items:center;width:100%;margin-bottom:1.5mm;border-bottom:2pt solid ' + bgColor + '60;padding-bottom:1mm;">',
            '      ' + logoHTML,
            '      <div style="display:flex;flex-direction:column;text-align:left;width:100%;">',
            '        <span style="font-size:7.5pt;font-weight:800;text-transform:uppercase;line-height:1.2;color:' + warnaJudul + ';">' + schoolName + '</span>',
            '        <span style="font-size:5pt;font-weight:500;line-height:1.2;margin-top:1px;color:' + warnaIdentitas + ';">' + schoolAddr + '</span>',
            '      </div>',
            '    </div>',
            '    <div style="display:flex;flex:1;gap:3mm;align-items:center;">',
            '      <div style="width:22mm;height:28mm;border-radius:6px;border:1.5pt solid ' + (isDark ? '#4b5563' : 'white') + ';box-shadow:0 2px 4px rgba(0,0,0,0.15);overflow:hidden;background-color:#f3f4f6;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' + photoHTML + '</div>',
            '      <div style="flex:1;display:flex;flex-direction:column;height:100%;justify-content:flex-start;padding-top:1mm;">',
            '        <div style="font-size:9.5pt;font-weight:800;text-transform:uppercase;line-height:1.2;border-bottom:0.5pt solid ' + (isDark ? '#4b5563' : '#e5e7eb') + ';padding-bottom:0.5mm;margin-bottom:1mm;color:' + warnaNama + ';">' + s.nama + '</div>',
            '        <table style="width:100%;font-size:5.5pt;line-height:1.4;color:' + warnaIdentitas + ';border-collapse:collapse;">',
            '          <tr><td style="width:11mm;font-weight:bold;vertical-align:top;">NIPD</td><td style="width:2mm;vertical-align:top;">:</td><td style="font-weight:bold;vertical-align:top;">' + (s.nipd || '-') + '</td></tr>',
            '          <tr><td style="font-weight:bold;vertical-align:top;">NISN</td><td style="vertical-align:top;">:</td><td style="vertical-align:top;">' + (s.nisn || '-') + '</td></tr>',
            '          <tr><td style="font-weight:bold;vertical-align:top;">Kelas</td><td style="vertical-align:top;">:</td><td style="font-weight:bold;vertical-align:top;">' + (s.kelas || '-') + '</td></tr>',
            '          <tr><td style="font-weight:bold;vertical-align:top;">TTL</td><td style="vertical-align:top;">:</td><td style="text-transform:capitalize;vertical-align:top;">' + ttl + '</td></tr>',
            '          <tr><td style="font-weight:bold;vertical-align:top;">Alamat</td><td style="vertical-align:top;">:</td><td style="text-transform:capitalize;vertical-align:top;">' + (addr || '-') + '</td></tr>',
            '        </table>',
            sigHTML,
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
          ].join('');

          // BACK
          const qrHTML = (showFields.qrcode && qrSrc)
            ? '<div style="background:white;padding:1.5mm;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,0.05);border:0.5pt solid #e5e7eb;display:flex;align-items:center;justify-content:center;width:35mm;height:35mm;box-sizing:border-box;"><img src="' + qrSrc + '" style="width:32mm;height:32mm;display:block;" /></div>'
            : '';

          backCardContent = [
            '<div style="width:87.6mm;height:56mm;position:relative;overflow:hidden;border:0.5pt solid ' + (isDark ? '#374151' : '#e5e7eb') + ';border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);background:' + (isDark ? '#1f2937' : '#ffffff') + ';box-sizing:border-box;">',
            bgBelakangHTML,
            '  <div style="position:absolute;top:0;right:0;height:100%;width:1.5mm;background-color:' + bgColor + ';z-index:10;"></div>',
            '  <div style="display:flex;align-items:center;height:100%;width:100%;padding:2.5mm 3.5mm 2.5mm 3mm;gap:2mm;box-sizing:border-box;position:relative;z-index:1;">',
            '    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-left:1mm;">',
            '      <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;margin-bottom:1.5mm;border-bottom:1pt solid #d1d5db;padding-bottom:0.5mm;display:inline-block;width:fit-content;color:' + bgColor + ';">Ketentuan Kartu</div>',
            '      <ol style="font-size:5.5pt;line-height:1.5;color:' + warnaIdentitas + ';margin:0;padding-left:3.5mm;">',
            '        <li>Kartu ini adalah identitas resmi peserta didik.</li>',
            '        <li>Wajib dibawa dan dipakai selama berada di sekolah.</li>',
            '        <li>Digunakan untuk presensi kehadiran & administrasi.</li>',
            '        <li>Apabila hilang atau rusak, melapor kepada pihak sekolah.</li>',
            '      </ol>',
            '      <div style="font-size:5pt;font-style:italic;margin-top:2.5mm;font-weight:500;color:' + warnaIdentitas + ';">** Berlaku selama menjadi siswa **</div>',
            '    </div>',
            '    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;border-left:0.5pt solid ' + (isDark ? '#4b5563' : '#e5e7eb') + ';padding-left:2.5mm;padding-right:1mm;min-width:38mm;">',
            qrHTML,
            '    </div>',
            '  </div>',
            '</div>'
          ].join('');

        } else {
          // ===============================
          // PORTRAIT CARD (56mm x 87.6mm)
          // ===============================
          const photoHTML = (showFields.photo && s.foto_url)
            ? '<img src="' + s.foto_url + '" style="width:23mm;height:29mm;object-fit:cover;display:block;" />'
            : '<div style="width:23mm;height:29mm;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:6pt;background:#f3f4f6;">No Photo</div>';

          const logoHTML = showFields.schoolLogo
            ? '<img src="' + logoSrc + '" style="width:7mm;height:7mm;object-fit:contain;flex-shrink:0;margin-right:1.5mm;" />'
            : '';

          const sigHTML = showFields.signature
            ? '<div style="margin-top:auto;display:flex;justify-content:flex-end;width:100%;padding-right:1mm;box-sizing:border-box;">'
              + '<div style="text-align:center;">'
              + '<div style="font-size:4.5pt;color:' + warnaTtd + ';">Kepala Sekolah,</div>'
              + '<div style="height:6mm;"></div>'
              + '<div style="font-size:5pt;font-style:italic;font-family:serif;border-bottom:0.5pt solid #9ca3af;color:' + warnaTtd + ';">' + kepalaSekolah + '</div>'
              + '</div></div>'
            : '';

          // FRONT (Portrait, rotated 90deg in card-wrapper)
          frontCardContent = [
            '<div class="print-rotate-90" style="width:56mm;height:87.6mm;position:relative;overflow:hidden;border:0.5pt solid ' + (isDark ? '#374151' : '#e5e7eb') + ';border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);background:' + (isDark ? '#1f2937' : '#ffffff') + ';box-sizing:border-box;transform-origin:center;flex-shrink:0;">',
            bgDepanHTML,
            '  <div style="position:absolute;top:0;left:0;width:100%;height:1.5mm;background-color:' + bgColor + ';z-index:10;"></div>',
            '  <div style="display:flex;flex-direction:column;height:100%;width:100%;padding:3mm 2.5mm 2.5mm 2.5mm;box-sizing:border-box;position:relative;z-index:1;">',
            '    <div style="display:flex;align-items:center;width:100%;margin-bottom:1.5mm;">',
            '      ' + logoHTML,
            '      <div style="display:flex;flex-direction:column;text-align:left;border-bottom:1.5pt solid ' + bgColor + ';padding-bottom:0.5mm;width:100%;">',
            '        <span style="font-size:6.5pt;font-weight:800;text-transform:uppercase;line-height:1.2;color:' + warnaJudul + ';">' + schoolName + '</span>',
            '        <span style="font-size:4.5pt;font-weight:500;line-height:1.2;margin-top:1px;color:' + warnaIdentitas + ';">' + schoolAddr + '</span>',
            '      </div>',
            '    </div>',
            '    <div style="display:flex;flex-direction:column;align-items:center;flex:1;width:100%;">',
            '      <div style="width:23mm;height:29mm;border-radius:6px;border:1.5pt solid ' + (isDark ? '#4b5563' : 'white') + ';box-shadow:0 2px 4px rgba(0,0,0,0.15);overflow:hidden;background-color:#f3f4f6;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5mm auto;flex-shrink:0;">' + photoHTML + '</div>',
            '      <div style="font-size:8.5pt;font-weight:bold;text-align:center;text-transform:uppercase;line-height:1.2;width:100%;color:' + warnaNama + ';">' + s.nama + '</div>',
            '      <div style="font-size:5.5pt;font-weight:bold;letter-spacing:0.5px;border-bottom:0.5pt solid ' + (isDark ? '#4b5563' : '#e5e7eb') + ';padding-bottom:0.5mm;margin:0.5mm auto 1mm auto;text-align:center;width:65%;color:' + warnaIdentitas + ';">PESERTA DIDIK</div>',
            '      <table style="width:100%;font-size:5pt;line-height:1.3;color:' + warnaIdentitas + ';border-collapse:collapse;">',
            '        <tr><td style="width:10mm;font-weight:bold;vertical-align:top;">NIPD</td><td style="width:2mm;vertical-align:top;">:</td><td style="font-weight:bold;vertical-align:top;">' + (s.nipd || '-') + '</td></tr>',
            '        <tr><td style="font-weight:bold;vertical-align:top;">NISN</td><td style="vertical-align:top;">:</td><td style="vertical-align:top;">' + (s.nisn || '-') + '</td></tr>',
            '        <tr><td style="font-weight:bold;vertical-align:top;">Kelas</td><td style="vertical-align:top;">:</td><td style="font-weight:bold;vertical-align:top;">' + (s.kelas || '-') + '</td></tr>',
            '        <tr><td style="font-weight:bold;vertical-align:top;">TTL</td><td style="vertical-align:top;">:</td><td style="text-transform:capitalize;vertical-align:top;">' + ttl + '</td></tr>',
            '        <tr><td style="font-weight:bold;vertical-align:top;">Alamat</td><td style="vertical-align:top;">:</td><td style="text-transform:capitalize;vertical-align:top;">' + (addr || '-') + '</td></tr>',
            '      </table>',
            sigHTML,
            '    </div>',
            '  </div>',
            '</div>'
          ].join('');

          // BACK (Portrait, rotated -90deg in card-wrapper)
          const qrHTML = (showFields.qrcode && qrSrc)
            ? '<div style="background:white;padding:1.5mm;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);border:0.5pt solid #e5e7eb;display:flex;align-items:center;justify-content:center;width:36mm;height:36mm;box-sizing:border-box;"><img src="' + qrSrc + '" style="width:33mm;height:33mm;display:block;" /></div>'
            : '';

          backCardContent = [
            '<div class="print-rotate-minus-90" style="width:56mm;height:87.6mm;position:relative;overflow:hidden;border:0.5pt solid ' + (isDark ? '#374151' : '#e5e7eb') + ';border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05);background:' + (isDark ? '#1f2937' : '#ffffff') + ';box-sizing:border-box;display:flex;flex-direction:column;text-align:center;padding:3.5mm 3mm 2.5mm 3mm;transform-origin:center;flex-shrink:0;">',
            bgBelakangHTML,
            '  <div style="position:absolute;top:0;left:0;width:100%;height:1.5mm;background-color:' + bgColor + ';z-index:10;"></div>',
            '  <div style="font-size:7.5pt;font-weight:bold;text-transform:uppercase;margin-bottom:1.5mm;border-bottom:1pt solid #d1d5db;padding-bottom:0.5mm;display:inline-block;margin-left:auto;margin-right:auto;color:' + bgColor + ';">Ketentuan Kartu</div>',
            '  <ol style="font-size:5.5pt;line-height:1.5;color:' + warnaIdentitas + ';margin:0;padding-left:4mm;text-align:left;">',
            '    <li>Kartu ini adalah identitas resmi peserta didik.</li>',
            '    <li>Wajib dibawa dan dipakai selama berada di sekolah.</li>',
            '    <li>Digunakan untuk presensi kehadiran & administrasi.</li>',
            '    <li>Apabila hilang/rusak, segera melapor.</li>',
            '  </ol>',
            '  <div style="font-size:4.5pt;font-style:italic;margin-top:2mm;font-weight:500;text-align:center;color:' + warnaIdentitas + ';">** Berlaku selama menjadi siswa **</div>',
            '  <div style="margin-top:auto;display:flex;flex-direction:column;align-items:center;margin-bottom:1.5mm;">',
            qrHTML,
            '  </div>',
            '</div>'
          ].join('');
        }

        const mirrorStyle = mirrorPVC ? 'transform:scaleX(-1);' : '';

        rowsHTML += '<div class="card-row">'
          + '<div class="card-wrapper" style="' + mirrorStyle + '">' + frontCardContent + '</div>'
          + '<div class="card-wrapper" style="' + mirrorStyle + '">' + backCardContent + '</div>'
          + '</div>\n';
      });

      sheetsHTML += '<div class="a4-sheet">\n' + rowsHTML + '</div>\n';
    });

    return '<!DOCTYPE html><html><head>'
      + '<meta name="viewport" content="width=device-width,initial-scale=1" />'
      + '<style>'
      + '@page{size:A4 portrait;margin:0;}'
      + '*{box-sizing:border-box;}'
      + 'body{margin:0;padding:0;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}'
      + '.a4-sheet{width:210mm;height:297mm;min-height:297mm;max-height:297mm;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:4.5mm;box-sizing:border-box;page-break-after:always;break-after:page;background:white;margin:0 auto;}'
      + '.card-row{display:flex;justify-content:center;align-items:center;width:100%;gap:8mm;page-break-inside:avoid;break-inside:avoid;margin-bottom:2mm;}'
      + '.card-wrapper{width:87.6mm;height:56mm;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;box-sizing:border-box;}'
      + '.print-rotate-90{transform:rotate(90deg);}'
      + '.print-rotate-minus-90{transform:rotate(-90deg);}'
      + '</style>'
      + '</head><body>'
      + sheetsHTML
      + '</body></html>';
  };

  const handlePrint = async () => {
    if (selectedSiswaIds.length === 0) {
      Alert.alert('Info', 'Pilih minimal satu siswa untuk dicetak.');
      return;
    }
    
    let Print;
    try {
      Print = require('expo-print');
    } catch (e) {
      Alert.alert(
        'Update Diperlukan',
        'Fitur cetak membutuhkan modul sistem (expo-print). Silakan jalankan build APK terbaru untuk mencetak langsung.'
      );
      return;
    }

    try {
      const html = generateHTML();
      await Print.printAsync({ html });
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak.');
    }
  };

  // Demo student for live preview
  const sampleStudent: Siswa = allSiswa.find(s => selectedSiswaIds.includes(s.id)) || allSiswa[0] || {
    id: 9999,
    nama: 'MUHAMMAD FAIZ ABDULLAH',
    nisn: '0089123456',
    nipd: '232407001',
    foto_url: '',
    kelas: 'VII-A',
    tempat_lahir: 'Subang',
    tanggal_lahir: '2010-05-15',
    alamat_detail: 'Dsn. Sukaseneng RT 02/01',
    desa: 'Sukaseneng',
    kecamatan: 'Compreng',
    kabupaten: 'Subang',
    encryptedNipd: 'DEMO_ENCRYPTED_NIPD'
  };

  const isLandscape = settings.orientation === 'landscape';
  const isDark = settings.cardTheme === 'dark';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Cetak Kartu Siswa</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Konsep & Layout Standar Web</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.printBtnTop, selectedSiswaIds.length === 0 && { opacity: 0.6 }]} 
          onPress={handlePrint} 
          disabled={selectedSiswaIds.length === 0}
        >
          <Printer size={18} color={selectedSiswaIds.length > 0 ? "#10b981" : "#9ca3af"} />
          <Text style={[styles.printBtnTextTop, { color: selectedSiswaIds.length > 0 ? "#10b981" : "#9ca3af" }]}>
            Cetak ({selectedSiswaIds.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'siswa' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('siswa')}
        >
          <Users size={18} color={activeTab === 'siswa' ? '#daffcc' : 'rgba(255,255,255,0.7)'} />
          <Text style={[styles.tabText, activeTab === 'siswa' && styles.tabTextActive]}>
            Pilih Siswa ({selectedSiswaIds.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'pengaturan' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('pengaturan')}
        >
          <Palette size={18} color={activeTab === 'pengaturan' ? '#daffcc' : 'rgba(255,255,255,0.7)'} />
          <Text style={[styles.tabText, activeTab === 'pengaturan' && styles.tabTextActive]}>
            Pengaturan Kartu
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'siswa' ? (
        /* TAB 1: PILIH SISWA */
        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Search size={18} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama atau NIPD..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9ca3af"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.searchBox, { padding: 0, paddingLeft: 12, marginTop: 10 }]}>
              <Picker
                selectedValue={selectedKelas}
                onValueChange={(itemValue) => setSelectedKelas(itemValue)}
                style={{ flex: 1, height: 48, color: '#1f2937' }}
                dropdownIconColor="#6b7280"
              >
                <Picker.Item label="Semua Kelas" value="" />
                {uniqueKelas.map(kelas => (
                  <Picker.Item key={kelas} label={`Kelas ${kelas}`} value={kelas} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.selectAllRow}>
            <TouchableOpacity onPress={() => toggleAllSiswa(true)} style={styles.selectAllBtn}>
              <CheckSquare size={16} color="#2a2c87" />
              <Text style={{ color: '#2a2c87', fontWeight: 'bold', fontSize: 13 }}>Pilih Semua Filter</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleAllSiswa(false)} style={styles.selectAllBtn}>
              <Square size={16} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>Kosongkan</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2a2c87" />
              <Text style={{ color: '#6b7280', marginTop: 12, fontSize: 13 }}>Memuat data siswa...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredSiswa}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              renderItem={({ item }) => {
                const isSelected = selectedSiswaIds.includes(item.id);
                return (
                  <TouchableOpacity 
                    style={[styles.siswaRow, isSelected && styles.siswaRowSelected]}
                    onPress={() => toggleSiswa(item.id)}
                    activeOpacity={0.7}
                  >
                    {isSelected ? (
                      <CheckSquare size={22} color="#2a2c87" style={{ marginRight: 12 }} />
                    ) : (
                      <Square size={22} color="#9ca3af" style={{ marginRight: 12 }} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.siswaNama, isSelected && { color: '#2a2c87' }]}>{item.nama}</Text>
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                        <Text style={styles.siswaSub}>NIPD: {item.nipd || '-'}</Text>
                        <Text style={styles.siswaSub}>Kelas: {item.kelas || '-'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 40, padding: 20 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 14 }}>Tidak ada siswa yang sesuai.</Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        /* TAB 2: PENGATURAN KARTU (SELARAS DENGAN WEB APP) */
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          
          {/* 1. PRATINJAU KARTU SISWA (LIVE INTERACTIVE PREVIEW) */}
          <View style={styles.cardSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.sectionTitle}>Pratinjau Kartu Siswa</Text>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>Tampilan langsung sesuai hasil cetakan web</Text>
              </View>
              
              <View style={styles.previewToggleContainer}>
                <TouchableOpacity 
                  style={[styles.previewToggleBtn, previewSide === 'depan' && styles.previewToggleBtnActive]}
                  onPress={() => setPreviewSide('depan')}
                >
                  <Text style={[styles.previewToggleText, previewSide === 'depan' && styles.previewToggleTextActive]}>Depan</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.previewToggleBtn, previewSide === 'belakang' && styles.previewToggleBtnActive]}
                  onPress={() => setPreviewSide('belakang')}
                >
                  <Text style={[styles.previewToggleText, previewSide === 'belakang' && styles.previewToggleTextActive]}>Belakang</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Container Pratinjau Skala Visual */}
            <View style={styles.previewCardOuter}>
              {settings.mirrorPVC && (
                <View style={styles.mirrorBadge}>
                  <Text style={styles.mirrorBadgeText}>Mirror PVC Aktif (Cetak Dibalik)</Text>
                </View>
              )}

              {previewSide === 'depan' ? (
                /* KARTU DEPAN */
                isLandscape ? (
                  // Landscape Front Preview
                  <View style={[
                    styles.cardBoxLandscape, 
                    { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' },
                    settings.mirrorPVC && { transform: [{ scaleX: -1 }] }
                  ]}>
                    {/* Background */}
                    {settings.bgImage ? (
                      <Image source={{ uri: settings.bgImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: settings.themeColor + '10' }]} />
                    )}
                    {/* Accent Left Stripe */}
                    <View style={{ position: 'absolute', top: 0, left: 0, width: 5, height: '100%', backgroundColor: settings.themeColor, zIndex: 10 }} />

                    {/* Content */}
                    <View style={{ flex: 1, padding: 8, paddingLeft: 12, zIndex: 1 }}>
                      {/* Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: settings.themeColor + '60', paddingBottom: 4, marginBottom: 6 }}>
                        {settings.showFields.schoolLogo && (
                          <Image 
                            source={{ uri: dataLembaga?.logo_url || "https://www.e-ujian.com/smpithm/logo" }} 
                            style={{ width: 26, height: 26, marginRight: 6 }} 
                            resizeMode="contain" 
                          />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', color: settings.warnaJudul }} numberOfLines={1}>
                            {dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}
                          </Text>
                          <Text style={{ fontSize: 6.5, fontWeight: '500', color: settings.warnaIdentitas }} numberOfLines={1}>
                            {dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}
                          </Text>
                        </View>
                      </View>

                      {/* Body */}
                      <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        {settings.showFields.photo && (
                          <View style={[styles.photoBox, { borderColor: isDark ? '#4b5563' : '#ffffff' }]}>
                            {sampleStudent.foto_url ? (
                              <Image source={{ uri: sampleStudent.foto_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                              <Text style={{ fontSize: 7, color: '#9ca3af' }}>No Photo</Text>
                            )}
                          </View>
                        )}
                        <View style={{ flex: 1, justifyContent: 'flex-start' }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: settings.warnaNama, borderBottomWidth: 0.5, borderBottomColor: isDark ? '#4b5563' : '#e5e7eb', paddingBottom: 2, marginBottom: 3 }} numberOfLines={1}>
                            {sampleStudent.nama}
                          </Text>
                          <Text style={{ fontSize: 6.5, color: settings.warnaIdentitas, fontWeight: '600' }}>NIPD  : {sampleStudent.nipd || '-'}</Text>
                          <Text style={{ fontSize: 6.5, color: settings.warnaIdentitas }}>NISN  : {sampleStudent.nisn || '-'}</Text>
                          <Text style={{ fontSize: 6.5, color: settings.warnaIdentitas, fontWeight: 'bold' }}>Kelas : {sampleStudent.kelas || '-'}</Text>
                          <Text style={{ fontSize: 6.5, color: settings.warnaIdentitas }}>TTL     : {sampleStudent.tempat_lahir || '-'}, {formatDate(sampleStudent.tanggal_lahir)}</Text>
                          <Text style={{ fontSize: 6.5, color: settings.warnaIdentitas }} numberOfLines={1}>Alamat: {sampleStudent.desa || sampleStudent.alamat_detail || '-'}</Text>

                          {settings.showFields.signature && (
                            <View style={{ marginTop: 'auto', alignSelf: 'flex-end', alignItems: 'center' }}>
                              <Text style={{ fontSize: 5, color: settings.warnaTtd }}>Kepala Sekolah,</Text>
                              <Text style={{ fontSize: 5.5, fontStyle: 'italic', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', borderBottomWidth: 0.5, borderBottomColor: '#9ca3af', color: settings.warnaTtd, marginTop: 4 }}>
                                {dataLembaga?.kepala_sekolah || 'Kepala Sekolah'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  // Portrait Front Preview
                  <View style={[
                    styles.cardBoxPortrait, 
                    { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' },
                    settings.mirrorPVC && { transform: [{ scaleX: -1 }] }
                  ]}>
                    {/* Background */}
                    {settings.bgImage ? (
                      <Image source={{ uri: settings.bgImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: settings.themeColor + '10' }]} />
                    )}
                    {/* Accent Top Stripe */}
                    <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, backgroundColor: settings.themeColor, zIndex: 10 }} />

                    {/* Content */}
                    <View style={{ flex: 1, padding: 8, paddingTop: 10, zIndex: 1 }}>
                      {/* Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: settings.themeColor, paddingBottom: 3, marginBottom: 6 }}>
                        {settings.showFields.schoolLogo && (
                          <Image 
                            source={{ uri: dataLembaga?.logo_url || "https://www.e-ujian.com/smpithm/logo" }} 
                            style={{ width: 20, height: 20, marginRight: 4 }} 
                            resizeMode="contain" 
                          />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, fontWeight: '800', textTransform: 'uppercase', color: settings.warnaJudul }} numberOfLines={1}>
                            {dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}
                          </Text>
                          <Text style={{ fontSize: 5, color: settings.warnaIdentitas }} numberOfLines={1}>
                            {dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}
                          </Text>
                        </View>
                      </View>

                      {/* Photo & Name */}
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        {settings.showFields.photo && (
                          <View style={[styles.photoBoxPortrait, { borderColor: isDark ? '#4b5563' : '#ffffff' }]}>
                            {sampleStudent.foto_url ? (
                              <Image source={{ uri: sampleStudent.foto_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                              <Text style={{ fontSize: 6, color: '#9ca3af' }}>No Photo</Text>
                            )}
                          </View>
                        )}
                        <Text style={{ fontSize: 8.5, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', color: settings.warnaNama }} numberOfLines={1}>
                          {sampleStudent.nama}
                        </Text>
                        <Text style={{ fontSize: 5.5, fontWeight: 'bold', color: settings.warnaIdentitas, borderBottomWidth: 0.5, borderBottomColor: isDark ? '#4b5563' : '#e5e7eb', paddingBottom: 1, marginBottom: 4, width: '70%', textAlign: 'center' }}>
                          PESERTA DIDIK
                        </Text>

                        <View style={{ width: '100%', paddingHorizontal: 4 }}>
                          <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas }}>NIPD  : {sampleStudent.nipd || '-'}</Text>
                          <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas }}>NISN  : {sampleStudent.nisn || '-'}</Text>
                          <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas, fontWeight: 'bold' }}>Kelas : {sampleStudent.kelas || '-'}</Text>
                          <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas }}>TTL     : {sampleStudent.tempat_lahir || '-'}, {formatDate(sampleStudent.tanggal_lahir)}</Text>
                          <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas }} numberOfLines={1}>Alamat: {sampleStudent.desa || '-'}</Text>
                        </View>

                        {settings.showFields.signature && (
                          <View style={{ marginTop: 'auto', alignSelf: 'flex-end', alignItems: 'center', paddingRight: 4 }}>
                            <Text style={{ fontSize: 4.5, color: settings.warnaTtd }}>Kepala Sekolah,</Text>
                            <Text style={{ fontSize: 5, fontStyle: 'italic', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', borderBottomWidth: 0.5, borderBottomColor: '#9ca3af', color: settings.warnaTtd, marginTop: 4 }}>
                              {dataLembaga?.kepala_sekolah || 'Kepala Sekolah'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )
              ) : (
                /* KARTU BELAKANG */
                isLandscape ? (
                  // Landscape Back Preview
                  <View style={[
                    styles.cardBoxLandscape, 
                    { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' },
                    settings.mirrorPVC && { transform: [{ scaleX: -1 }] }
                  ]}>
                    {/* Background */}
                    {settings.bgImageBack ? (
                      <Image source={{ uri: settings.bgImageBack }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: settings.themeColor + '10' }]} />
                    )}
                    {/* Accent Right Stripe */}
                    <View style={{ position: 'absolute', top: 0, right: 0, width: 5, height: '100%', backgroundColor: settings.themeColor, zIndex: 10 }} />

                    {/* Content */}
                    <View style={{ flex: 1, flexDirection: 'row', padding: 8, paddingRight: 12, alignItems: 'center', zIndex: 1 }}>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={{ fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', color: settings.themeColor, borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 2, marginBottom: 4, alignSelf: 'flex-start' }}>
                          Ketentuan Kartu
                        </Text>
                        <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas, lineHeight: 9 }}>1. Kartu ini adalah identitas resmi.</Text>
                        <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas, lineHeight: 9 }}>2. Wajib dibawa dan dipakai di sekolah.</Text>
                        <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas, lineHeight: 9 }}>3. Digunakan untuk presensi kehadiran.</Text>
                        <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas, lineHeight: 9 }}>4. Apabila hilang, segera melapor.</Text>
                        <Text style={{ fontSize: 5, fontStyle: 'italic', color: settings.warnaIdentitas, marginTop: 6 }}>** Berlaku selama menjadi siswa **</Text>
                      </View>

                      {/* QR Code Container */}
                      <View style={{ alignItems: 'center', justifyContent: 'center', borderLeftWidth: 0.5, borderLeftColor: isDark ? '#4b5563' : '#e5e7eb', paddingLeft: 8 }}>
                        {settings.showFields.qrcode && (
                          <View style={styles.qrContainerLandscape}>
                            <Image 
                              source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(sampleStudent.encryptedNipd || sampleStudent.nipd || '') }} 
                              style={{ width: 54, height: 54 }} 
                              resizeMode="contain" 
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ) : (
                  // Portrait Back Preview
                  <View style={[
                    styles.cardBoxPortrait, 
                    { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' },
                    settings.mirrorPVC && { transform: [{ scaleX: -1 }] }
                  ]}>
                    {/* Background */}
                    {settings.bgImageBack ? (
                      <Image source={{ uri: settings.bgImageBack }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: settings.themeColor + '10' }]} />
                    )}
                    {/* Accent Top Stripe */}
                    <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, backgroundColor: settings.themeColor, zIndex: 10 }} />

                    {/* Content */}
                    <View style={{ flex: 1, padding: 8, paddingTop: 10, alignItems: 'center', zIndex: 1 }}>
                      <Text style={{ fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase', color: settings.themeColor, borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 1, marginBottom: 4 }}>
                        Ketentuan Kartu
                      </Text>
                      <View style={{ width: '100%', paddingHorizontal: 2 }}>
                        <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas, lineHeight: 8.5 }}>1. Identitas resmi peserta didik.</Text>
                        <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas, lineHeight: 8.5 }}>2. Wajib dibawa saat di sekolah.</Text>
                        <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas, lineHeight: 8.5 }}>3. Digunakan untuk presensi & admin.</Text>
                        <Text style={{ fontSize: 5.5, color: settings.warnaIdentitas, lineHeight: 8.5 }}>4. Apabila hilang, segera melapor.</Text>
                      </View>
                      <Text style={{ fontSize: 4.5, fontStyle: 'italic', color: settings.warnaIdentitas, marginTop: 4, textAlign: 'center' }}>
                        ** Berlaku selama menjadi siswa **
                      </Text>

                      {/* QR Box (no text under QR) */}
                      {settings.showFields.qrcode && (
                        <View style={[styles.qrContainerPortrait, { marginTop: 'auto', marginBottom: 4 }]}>
                          <Image 
                            source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(sampleStudent.encryptedNipd || sampleStudent.nipd || '') }} 
                            style={{ width: 62, height: 62 }} 
                            resizeMode="contain" 
                          />
                        </View>
                      )}
                    </View>
                  </View>
                )
              )}
            </View>
          </View>

          {/* 2. ORIENTASI & TEMA KARTU (LIGHT / DARK) */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Orientasi & Tema Tampilan</Text>
            
            {/* Orientasi Buttons */}
            <View style={styles.row}>
              <TouchableOpacity 
                style={[styles.segmentBtn, settings.orientation === 'landscape' && styles.segmentBtnActive]}
                onPress={() => setSettings(s => ({...s, orientation: 'landscape'}))}
              >
                <Text style={[styles.segmentText, settings.orientation === 'landscape' && styles.segmentTextActive]}>Landscape</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.segmentBtn, settings.orientation === 'portrait' && styles.segmentBtnActive]}
                onPress={() => setSettings(s => ({...s, orientation: 'portrait'}))}
              >
                <Text style={[styles.segmentText, settings.orientation === 'portrait' && styles.segmentTextActive]}>Portrait</Text>
              </TouchableOpacity>
            </View>

            {/* Tema Mode Kartu (Light / Dark) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginTop: 4 }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1f2937' }}>Mode Tema Kartu</Text>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>
                  {settings.cardTheme === 'dark' ? 'Tema Gelap (Dark Mode)' : 'Tema Terang (Light Mode)'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  style={[styles.themeModeBtn, settings.cardTheme === 'light' && styles.themeModeBtnActive]}
                  onPress={() => setSettings(s => ({...s, cardTheme: 'light'}))}
                >
                  <Sun size={18} color={settings.cardTheme === 'light' ? '#f59e0b' : '#9ca3af'} />
                  <Text style={[styles.themeModeText, settings.cardTheme === 'light' && { color: '#f59e0b', fontWeight: 'bold' }]}>Terang</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.themeModeBtn, settings.cardTheme === 'dark' && styles.themeModeBtnActive]}
                  onPress={() => setSettings(s => ({...s, cardTheme: 'dark'}))}
                >
                  <Moon size={18} color={settings.cardTheme === 'dark' ? '#6366f1' : '#9ca3af'} />
                  <Text style={[styles.themeModeText, settings.cardTheme === 'dark' && { color: '#6366f1', fontWeight: 'bold' }]}>Gelap</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 3. WARNA TEMA & WARNA TEKS KHUSUS (MATCHING WEB APP) */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Pengaturan Warna</Text>
            <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
              Ketuk untuk mengubah warna aksen dan teks kartu
            </Text>

            {/* Warna Tema Aksen */}
            <TouchableOpacity 
              style={styles.colorRowItem} 
              onPress={() => openColorPicker('themeColor')}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.colorCircle, { backgroundColor: settings.themeColor }]} />
                <View>
                  <Text style={styles.colorRowTitle}>Warna Tema Aksen</Text>
                  <Text style={styles.colorRowSub}>Garis tepi, aksen header, judul ketentuan</Text>
                </View>
              </View>
              <Text style={styles.colorHexCode}>{settings.themeColor.toUpperCase()}</Text>
            </TouchableOpacity>

            {/* Warna Judul */}
            <TouchableOpacity 
              style={styles.colorRowItem} 
              onPress={() => openColorPicker('warnaJudul')}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.colorCircle, { backgroundColor: settings.warnaJudul }]} />
                <View>
                  <Text style={styles.colorRowTitle}>Warna Judul Lembaga</Text>
                  <Text style={styles.colorRowSub}>Nama sekolah pada kop kartu</Text>
                </View>
              </View>
              <Text style={styles.colorHexCode}>{settings.warnaJudul.toUpperCase()}</Text>
            </TouchableOpacity>

            {/* Warna Nama Siswa */}
            <TouchableOpacity 
              style={styles.colorRowItem} 
              onPress={() => openColorPicker('warnaNama')}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.colorCircle, { backgroundColor: settings.warnaNama }]} />
                <View>
                  <Text style={styles.colorRowTitle}>Warna Nama Siswa</Text>
                  <Text style={styles.colorRowSub}>Nama lengkap pemegang kartu</Text>
                </View>
              </View>
              <Text style={styles.colorHexCode}>{settings.warnaNama.toUpperCase()}</Text>
            </TouchableOpacity>

            {/* Warna Identitas & Teks */}
            <TouchableOpacity 
              style={styles.colorRowItem} 
              onPress={() => openColorPicker('warnaIdentitas')}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.colorCircle, { backgroundColor: settings.warnaIdentitas }]} />
                <View>
                  <Text style={styles.colorRowTitle}>Warna Identitas & Teks</Text>
                  <Text style={styles.colorRowSub}>NIPD, NISN, TTL, alamat, poin ketentuan</Text>
                </View>
              </View>
              <Text style={styles.colorHexCode}>{settings.warnaIdentitas.toUpperCase()}</Text>
            </TouchableOpacity>

            {/* Warna TTD Kepala Sekolah */}
            <TouchableOpacity 
              style={styles.colorRowItem} 
              onPress={() => openColorPicker('warnaTtd')}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.colorCircle, { backgroundColor: settings.warnaTtd }]} />
                <View>
                  <Text style={styles.colorRowTitle}>Warna Tanda Tangan</Text>
                  <Text style={styles.colorRowSub}>Teks jabatan & nama Kepala Sekolah</Text>
                </View>
              </View>
              <Text style={styles.colorHexCode}>{settings.warnaTtd.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          {/* 4. BACKGROUND KARTU (DEPAN & BELAKANG) */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Background Kartu Kustom</Text>
            <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
              Unggah background custom untuk sisi depan dan belakang
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* BG Depan */}
              <View style={styles.bgBoxContainer}>
                <Text style={styles.bgBoxLabel}>BG Depan</Text>
                {settings.bgImage ? (
                  <View style={styles.bgPreviewThumbWrapper}>
                    <Image source={{ uri: settings.bgImage }} style={styles.bgPreviewThumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.bgDeleteBtn} onPress={() => removeBgImage('front')}>
                      <Trash2 size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.bgPlaceholder}>
                    <ImageIcon size={22} color="#9ca3af" />
                    <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Default Tint</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.bgUploadBtn} 
                  onPress={() => handleBgUpload('front')}
                  disabled={isUploadingBg}
                >
                  <ImageIcon size={14} color="#2a2c87" />
                  <Text style={styles.bgUploadBtnText}>
                    {settings.bgImage ? 'Ganti' : 'Pilih Foto'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* BG Belakang */}
              <View style={styles.bgBoxContainer}>
                <Text style={styles.bgBoxLabel}>BG Belakang</Text>
                {settings.bgImageBack ? (
                  <View style={styles.bgPreviewThumbWrapper}>
                    <Image source={{ uri: settings.bgImageBack }} style={styles.bgPreviewThumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.bgDeleteBtn} onPress={() => removeBgImage('back')}>
                      <Trash2 size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.bgPlaceholder}>
                    <ImageIcon size={22} color="#9ca3af" />
                    <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Default Tint</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.bgUploadBtn} 
                  onPress={() => handleBgUpload('back')}
                  disabled={isUploadingBg}
                >
                  <ImageIcon size={14} color="#2a2c87" />
                  <Text style={styles.bgUploadBtnText}>
                    {settings.bgImageBack ? 'Ganti' : 'Pilih Foto'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {isUploadingBg && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <ActivityIndicator size="small" color="#2a2c87" />
                <Text style={{ fontSize: 12, color: '#2a2c87' }}>Mengunggah background...</Text>
              </View>
            )}
          </View>

          {/* 5. TAMPILAN ELEMEN KARTU */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Tampilan Elemen</Text>
            <View style={styles.elementsContainer}>
              {Object.entries({
                photo: 'Foto Peserta Didik', 
                qrcode: 'QR Code (Ukuran Besar Tanpa Teks Bawah)', 
                schoolLogo: 'Logo Lembaga / Sekolah', 
                signature: 'Tanda Tangan Kepala Sekolah'
              }).map(([key, label]) => (
                <TouchableOpacity 
                  key={key} 
                  style={styles.elementRow}
                  activeOpacity={0.7}
                  onPress={() => setSettings(s => ({
                    ...s, 
                    showFields: { ...s.showFields, [key]: !s.showFields[key as keyof typeof s.showFields] }
                  }))}
                >
                  {settings.showFields[key as keyof typeof settings.showFields] ? 
                    <CheckSquare size={20} color="#2a2c87" /> : 
                    <Square size={20} color="#9ca3af" />
                  }
                  <Text style={styles.elementLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 6. MATERIAL CETAK (MIRROR PVC) */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Material Cetak</Text>
            
            <TouchableOpacity 
              style={[styles.mirrorPvcContainer, settings.mirrorPVC && styles.mirrorPvcContainerActive]}
              activeOpacity={0.8}
              onPress={() => setSettings(s => ({ ...s, mirrorPVC: !s.mirrorPVC }))}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                {settings.mirrorPVC ? (
                  <CheckSquare size={22} color="#c2410c" />
                ) : (
                  <Square size={22} color="#9ca3af" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mirrorPvcTitle, settings.mirrorPVC && { color: '#c2410c' }]}>
                    Mirror PVC (Pencerminan Cetak)
                  </Text>
                  <Text style={styles.mirrorPvcDesc}>
                    Aktifkan jika mencetak di bahan PVC transparan / lembaran mirror agar hasil cetak terbalik dan terbaca tepat dari sisi glossy.
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* 7. ACTION BUTTONS */}
          <View style={{ gap: 10, marginTop: 8 }}>
            <TouchableOpacity 
              style={styles.saveSettingsBtn} 
              onPress={saveSettings}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Settings size={18} color="#fff" />
              )}
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 15 }}>
                {isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Kartu'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.resetBtn} 
              onPress={resetToDefault}
            >
              <RefreshCw size={16} color="#6b7280" />
              <Text style={{ color: '#6b7280', fontWeight: '600', marginLeft: 8, fontSize: 13 }}>
                Reset Pengaturan ke Default
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}

      {/* COLOR PICKER MODAL */}
      <Modal 
        visible={activeColorKey !== null} 
        transparent 
        animationType="fade"
        onRequestClose={() => setActiveColorKey(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={styles.modalTitle}>
                {activeColorKey === 'themeColor' && 'Pilih Warna Tema Aksen'}
                {activeColorKey === 'warnaJudul' && 'Pilih Warna Judul Lembaga'}
                {activeColorKey === 'warnaNama' && 'Pilih Warna Nama Siswa'}
                {activeColorKey === 'warnaIdentitas' && 'Pilih Warna Identitas'}
                {activeColorKey === 'warnaTtd' && 'Pilih Warna Tanda Tangan'}
              </Text>
              <TouchableOpacity onPress={() => setActiveColorKey(null)}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Current Swatch & Hex Input */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <View style={[styles.largeSwatch, { backgroundColor: tempHex || '#000000' }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Kode Warna HEX</Text>
                <TextInput
                  style={styles.hexInput}
                  value={tempHex}
                  onChangeText={setTempHex}
                  placeholder="#000000"
                  autoCapitalize="characters"
                  maxLength={9}
                />
              </View>
            </View>

            {/* Preset Color Palette Grid */}
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#4b5563', marginBottom: 8 }}>
              Pilihan Warna Populer:
            </Text>
            <View style={styles.paletteGrid}>
              {COLOR_PRESETS.map(hex => (
                <TouchableOpacity 
                  key={hex} 
                  style={[
                    styles.paletteCircle, 
                    { backgroundColor: hex },
                    tempHex.toLowerCase() === hex.toLowerCase() && styles.paletteCircleActive
                  ]}
                  onPress={() => setTempHex(hex)}
                >
                  {tempHex.toLowerCase() === hex.toLowerCase() && (
                    <Check size={14} color={hex === '#ffffff' ? '#000' : '#fff'} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Modal Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setActiveColorKey(null)}
              >
                <Text style={{ color: '#4b5563', fontWeight: 'bold' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalApplyBtn}
                onPress={applyColor}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Terapkan</Text>
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
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#2a2c87',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBack: {
    padding: 8,
    marginRight: 6,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: 'bold',
  },
  printBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  printBtnTextTop: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2c87',
    paddingHorizontal: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#daffcc',
  },
  tabText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#daffcc',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 14,
    color: '#1f2937',
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  siswaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  siswaRowSelected: {
    borderColor: '#2a2c87',
    backgroundColor: '#f0f3ff',
  },
  siswaNama: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  siswaSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  cardSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  previewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  previewToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewToggleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  previewToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  previewToggleTextActive: {
    color: '#2a2c87',
    fontWeight: 'bold',
  },
  previewCardOuter: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 210,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    position: 'relative',
  },
  mirrorBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#fdba74',
    zIndex: 20,
  },
  mirrorBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#c2410c',
  },
  // Landscape Card Preview Container (~320 x 205 dp)
  cardBoxLandscape: {
    width: 310,
    height: 198,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // Portrait Card Preview Container (~190 x 297 dp)
  cardBoxPortrait: {
    width: 190,
    height: 297,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photoBox: {
    width: 60,
    height: 76,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoBoxPortrait: {
    width: 58,
    height: 74,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  qrContainerLandscape: {
    backgroundColor: '#ffffff',
    padding: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrContainerPortrait: {
    backgroundColor: '#ffffff',
    padding: 4,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#2a2c87',
  },
  segmentText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#6b7280',
  },
  segmentTextActive: {
    color: '#2a2c87',
  },
  themeModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  themeModeBtnActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  themeModeText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  colorRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  colorRowTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  colorRowSub: {
    fontSize: 11,
    color: '#6b7280',
  },
  colorHexCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bgBoxContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  bgBoxLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 6,
  },
  bgPreviewThumbWrapper: {
    width: '100%',
    height: 70,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  bgPreviewThumb: {
    width: '100%',
    height: '100%',
  },
  bgDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 4,
    borderRadius: 4,
  },
  bgPlaceholder: {
    width: '100%',
    height: 70,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bgUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#2a2c87',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    width: '100%',
    justifyContent: 'center',
  },
  bgUploadBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2a2c87',
  },
  elementsContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
    overflow: 'hidden',
  },
  elementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  elementLabel: {
    marginLeft: 12,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  mirrorPvcContainer: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  mirrorPvcContainerActive: {
    backgroundColor: '#ffedd5',
    borderColor: '#fb923c',
  },
  mirrorPvcTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#9a3412',
  },
  mirrorPvcDesc: {
    fontSize: 11,
    color: '#c2410c',
    marginTop: 2,
    lineHeight: 15,
  },
  saveSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2c87',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#2a2c87',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  largeSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  hexInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-start',
  },
  paletteCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  paletteCircleActive: {
    borderWidth: 2.5,
    borderColor: '#2a2c87',
    transform: [{ scale: 1.1 }],
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalApplyBtn: {
    flex: 1,
    backgroundColor: '#2a2c87',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
});
