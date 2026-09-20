import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabaseClient';
import { QrCode, Printer, ChevronLeft, RefreshCw, DoorOpen, LogIn, LogOut, BookOpen, School, Filter, ShieldAlert, DollarSign } from 'lucide-react-native';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

export default function QrPresensiGuruScreen() {
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'semua' | 'kehadiran' | 'kbm'>('semua');
  const [dataLembaga, setDataLembaga] = useState<any>(null);

  useEffect(() => {
    checkRoleAndFetch();
  }, []);

  const checkRoleAndFetch = async () => {
    setLoading(true);
    try {
      const userStr = await AsyncStorage.getItem('user_guru');
      if (!userStr) {
        router.replace('/(auth)/login-guru' as any);
        return;
      }

      const userObj = JSON.parse(userStr);
      let allowed = userObj?.role === 'admin';

      if (!allowed && userObj?.id) {
        const { data: jData } = await supabase.from('jabatan_guru').select('*').eq('guru_id', userObj.id).maybeSingle();
        if (jData) {
          const roles = [jData.jabatan_utama, jData.jabatan_lain_1, jData.jabatan_lain_2, jData.jabatan_lain_3].filter(Boolean);
          allowed = roles.some((r: string) => {
            const lower = (r || '').toLowerCase();
            return lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara') || lower.includes('waka') || lower.includes('kurikulum') || lower.includes('operator') || lower.includes('admin');
          });
        }
      }

      setIsAuthorized(allowed);

      if (!allowed) {
        Alert.alert(
          'Akses Dibatasi',
          'Halaman Cetak QR Code hanya dapat diakses oleh Kepala Sekolah, Bendahara, dan Waka. Kurikulum.',
          [
            {
              text: 'Ke Halaman Honor',
              onPress: () => router.replace('/rekap-honor-guru' as any)
            }
          ]
        );
        setLoading(false);
        return;
      }

      const { data: lembaga } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (lembaga) setDataLembaga(lembaga);

      const { data: kelas, error } = await supabase
        .from('data_kelas')
        .select('*')
        .order('nama_kelas', { ascending: true });

      if (error) throw error;
      setKelasList(kelas || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      Alert.alert('Error', 'Gagal memuat data kelas.');
    } finally {
      setLoading(false);
    }
  };

  const getQrUrl = (payloadStr: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payloadStr)}`;
  };

  // Pre-generate list
  const qrKehadiranMasuk = {
    id: 'kehadiran-masuk',
    title: 'ABSEN KEHADIRAN: MASUK',
    posisi: 'Luar Pintu Gerbang / Kantor',
    deskripsi: 'Wajib scan saat tiba di sekolah (s/d 08:00) untuk honor hadir Rp 5.000',
    type: 'GURU_KEHADIRAN',
    action: 'MASUK',
    color: '#1e3a8a',
    payload: JSON.stringify({
      app: 'SMPITHM',
      type: 'GURU_KEHADIRAN',
      action: 'MASUK',
      label: 'Pintu Masuk Sekolah'
    })
  };

  const qrKehadiranPulang = {
    id: 'kehadiran-pulang',
    title: 'ABSEN KEHADIRAN: PULANG',
    posisi: 'Dalam Ruang Guru / Kantor',
    deskripsi: 'Wajib scan saat jam kerja selesai (mulai 13:00) sebelum pulang',
    type: 'GURU_KEHADIRAN',
    action: 'PULANG',
    color: '#047857',
    payload: JSON.stringify({
      app: 'SMPITHM',
      type: 'GURU_KEHADIRAN',
      action: 'PULANG',
      label: 'Pintu Keluar / Ruang Guru'
    })
  };

  const qrKbmList = kelasList.flatMap((k) => [
    {
      id: `kbm-masuk-${k.id}`,
      title: `KBM MASUK: KELAS ${k.nama_kelas}`,
      posisi: `Luar Pintu Kelas ${k.nama_kelas}`,
      deskripsi: `Guru Mapel / Pengganti scan saat MASUK kelas memulai KBM (${k.nama_kelas})`,
      type: 'GURU_KBM',
      action: 'MASUK',
      kelas_id: k.id,
      nama_kelas: k.nama_kelas,
      color: '#d97706',
      payload: JSON.stringify({
        app: 'SMPITHM',
        type: 'GURU_KBM',
        action: 'MASUK',
        kelas_id: k.id,
        nama_kelas: k.nama_kelas,
        posisi: `Luar Pintu Kelas ${k.nama_kelas}`
      })
    },
    {
      id: `kbm-keluar-${k.id}`,
      title: `KBM KELUAR: KELAS ${k.nama_kelas}`,
      posisi: `Dalam Ruang Kelas ${k.nama_kelas}`,
      deskripsi: `Guru Mapel / Pengganti scan saat SELESAI mengajar di kelas (${k.nama_kelas})`,
      type: 'GURU_KBM',
      action: 'KELUAR',
      kelas_id: k.id,
      nama_kelas: k.nama_kelas,
      color: '#7c3aed',
      payload: JSON.stringify({
        app: 'SMPITHM',
        type: 'GURU_KBM',
        action: 'KELUAR',
        kelas_id: k.id,
        nama_kelas: k.nama_kelas,
        posisi: `Dalam Ruang Kelas ${k.nama_kelas}`
      })
    }
  ]);

  let displayedQrs: any[] = [];
  if (activeTab === 'semua') {
    displayedQrs = [qrKehadiranMasuk, qrKehadiranPulang, ...qrKbmList];
  } else if (activeTab === 'kehadiran') {
    displayedQrs = [qrKehadiranMasuk, qrKehadiranPulang];
  } else if (activeTab === 'kbm') {
    displayedQrs = qrKbmList;
  }

  const handlePrintAll = async () => {
    let Print: any;
    try {
      Print = require('expo-print');
    } catch (e) {
      Alert.alert('Perhatian', 'Fitur cetak memerlukan build aplikasi terbaru.');
      return;
    }

    let cardsHTML = '';
    displayedQrs.forEach((item) => {
      const qrUrl = getQrUrl(item.payload);
      cardsHTML += `
        <div style="display: inline-block; width: 46%; margin: 1.5%; border: 2px solid #111827; border-radius: 12px; padding: 14px; text-align: center; vertical-align: top; box-sizing: border-box; page-break-inside: avoid; background: white;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
            <tr>
              ${dataLembaga?.logo_url ? `<td width="24" valign="middle"><img src="${dataLembaga.logo_url}" style="width: 22px; height: 22px; object-fit: contain;" /></td>` : ''}
              <td valign="middle" align="center" style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #111827;">
                ${dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}
              </td>
              ${dataLembaga?.logo_url ? `<td width="24">&nbsp;</td>` : ''}
            </tr>
          </table>
          <div style="background-color: ${item.color}; color: white; padding: 6px; border-radius: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">
            ${item.title}
          </div>
          <img src="${qrUrl}" style="width: 140px; height: 140px; margin: 4px auto; display: block;" />
          <div style="font-size: 10px; font-weight: bold; background: #f3f4f6; padding: 4px; border-radius: 4px; margin-top: 6px;">
            Lokasi: ${item.posisi}
          </div>
          <div style="font-size: 9px; color: #6b7280; margin-top: 4px;">
            ${item.deskripsi}
          </div>
          <div style="font-size: 8px; color: #9ca3af; margin-top: 6px; border-top: 1px dashed #d1d5db; padding-top: 4px;">
            SCAN DENGAN SIAKAD MOBILE
          </div>
        </div>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { font-family: sans-serif; margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <h2 style="text-align: center; font-size: 16px; margin-bottom: 15px; text-transform: uppercase;">
            Lembar Stiker QR Code Presensi Guru - ${dataLembaga?.nama_lembaga || 'SMP IT HM'}
          </h2>
          <div style="width: 100%;">
            ${cardsHTML}
          </div>
        </body>
      </html>
    `;

    try {
      await Print.printAsync({ html });
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak.');
    }
  };

  if (isAuthorized === false) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <ShieldAlert size={64} color="#ef4444" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 8, textAlign: 'center' }}>
          Akses Dibatasi
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
          Halaman Cetak QR Code hanya dapat diakses oleh Kepala Sekolah, Bendahara, dan Waka. Kurikulum.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#1E257F', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          onPress={() => router.replace('/rekap-honor-guru' as any)}
        >
          <DollarSign size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Buka Rekap Honor Saya</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Code Absensi Guru</Text>
        <TouchableOpacity onPress={handlePrintAll} style={styles.printHeaderBtn}>
          <Printer color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'semua' && styles.tabItemActive]}
          onPress={() => setActiveTab('semua')}
        >
          <Text style={[styles.tabText, activeTab === 'semua' && styles.tabTextActive]}>
            Semua ({2 + qrKbmList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'kehadiran' && styles.tabItemActive]}
          onPress={() => setActiveTab('kehadiran')}
        >
          <Text style={[styles.tabText, activeTab === 'kehadiran' && styles.tabTextActive]}>
            Kehadiran (2)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'kbm' && styles.tabItemActive]}
          onPress={() => setActiveTab('kbm')}
        >
          <Text style={[styles.tabText, activeTab === 'kbm' && styles.tabTextActive]}>
            KBM Kelas ({qrKbmList.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Banner Panduan */}
        <View style={styles.guideBanner}>
          <School size={20} color="#1e3a8a" />
          <View style={{ flex: 1 }}>
            <Text style={styles.guideTitle}>Petunjuk Tempel QR Code:</Text>
            <Text style={styles.guideText}>• Pintu Luar: Scan Kehadiran Masuk & KBM Masuk</Text>
            <Text style={styles.guideText}>• Pintu Dalam: Scan Kehadiran Pulang & KBM Keluar</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1E257F" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.qrGrid}>
            {displayedQrs.map((item) => {
              const qrUrl = getQrUrl(item.payload);
              return (
                <View key={item.id} style={styles.qrCard}>
                  <View style={[styles.qrTitleBadge, { backgroundColor: item.color }]}>
                    <Text style={styles.qrTitleText}>{item.title}</Text>
                  </View>

                  <View style={styles.qrImageContainer}>
                    <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                  </View>

                  <View style={styles.posisiBadge}>
                    <Text style={styles.posisiLabel}>Lokasi Penempelan:</Text>
                    <Text style={styles.posisiText}>{item.posisi}</Text>
                  </View>

                  <Text style={styles.deskripsiText}>{item.deskripsi}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button for Print */}
      <TouchableOpacity style={styles.fabPrint} onPress={handlePrintAll}>
        <Printer color="#fff" size={20} />
        <Text style={styles.fabPrintText}>Cetak Lembar QR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: '#1E257F',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: { padding: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  printHeaderBtn: { padding: 8 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6'
  },
  tabItemActive: { backgroundColor: '#1E257F' },
  tabText: { fontSize: 12, fontWeight: 'bold', color: '#4B5563' },
  tabTextActive: { color: '#fff' },
  content: { padding: 16, paddingBottom: 100 },
  guideBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16
  },
  guideTitle: { fontSize: 12, fontWeight: 'bold', color: '#1E3A8A' },
  guideText: { fontSize: 11, color: '#3B82F6', marginTop: 1 },
  qrGrid: { gap: 16 },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1F2937',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3
  },
  qrTitleBadge: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12
  },
  qrTitleText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  qrImageContainer: {
    width: 200,
    height: 200,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  qrImage: { width: 180, height: 180 },
  posisiBadge: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 6
  },
  posisiLabel: { fontSize: 9, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase' },
  posisiText: { fontSize: 12, fontWeight: 'bold', color: '#1F2937' },
  deskripsiText: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 4 },
  fabPrint: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  fabPrintText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});
