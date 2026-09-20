import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Platform, Alert, ScrollView } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Printer, Search, ArrowLeft, Users, Settings, Palette, CheckSquare, Square, X, Minus, Plus } from 'lucide-react-native';
import { router } from 'expo-router';
// import * as Print from 'expo-print'; // REMOVED TO PREVENT CRASH
import { Picker } from '@react-native-picker/picker';
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

export default function CetakKartu() {
  const [allSiswa, setAllSiswa] = useState<Siswa[]>([]);
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dataLembaga, setDataLembaga] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'siswa' | 'pengaturan'>('siswa');

  const [settings, setSettings] = useState({
    orientation: 'landscape',
    themeColor: '#2a2c87',
    warnaNama: '#000000',
    warnaIdentitas: '#374151',
    warnaTtd: '#000000',
    warnaJudul: '#2a2c87',
    showFields: {
      photo: true,
      qrcode: true,
      schoolLogo: true,
      signature: true
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Lembaga
      const { data: lembaga, error: errLembaga } = await supabase
        .from('data_lembaga')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (!errLembaga && lembaga) setDataLembaga(lembaga);

      // Fetch Siswa
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

      // Fetch Settings if exist
      const { data: savedSettings } = await supabase
        .from('id_card_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (savedSettings) {
        setSettings(prev => ({
          ...prev,
          orientation: savedSettings.orientasi || 'landscape',
          themeColor: savedSettings.warna_tema || '#2a2c87',
          warnaNama: savedSettings.warna_nama || '#000000',
          warnaIdentitas: savedSettings.warna_identitas || '#374151',
          warnaTtd: savedSettings.warna_ttd || '#000000',
          warnaJudul: savedSettings.warna_judul || savedSettings.warna_tema || '#2a2c87',
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
      Alert.alert('Gagal', 'Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSiswa = (id: number) => {
    setSelectedSiswaIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const toggleAllSiswa = (check: boolean) => {
    if (check) setSelectedSiswaIds(filteredSiswa.map(s => s.id));
    else setSelectedSiswaIds([]);
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const generateHTML = () => {
    const selectedStudents = allSiswa.filter(s => selectedSiswaIds.includes(s.id));

    const { themeColor, warnaNama, warnaIdentitas, warnaTtd, warnaJudul, showFields } = settings;
    const bgColor = themeColor;
    const kepalaSekolah = dataLembaga?.kepala_sekolah || 'Kepala Sekolah';

    // Pre-compute QR URLs outside template literals to avoid Hermes crash
    const qrMap: { [id: number]: string } = {};
    if (showFields.qrcode) {
      selectedStudents.forEach(s => {
        const raw = s.encryptedNipd || s.nipd || '';
        const encoded = encodeURIComponent(raw);
        qrMap[s.id] = 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=' + encoded;
      });
    }

    let cardsHTML = '';
    selectedStudents.forEach(s => {
      const addr = [s.alamat_detail, s.desa, s.kecamatan, s.kabupaten].filter(Boolean).join(', ');
      const ttl = ((s.tempat_lahir || '').toLowerCase()) + ', ' + formatDate(s.tanggal_lahir);
      const qrSrc = qrMap[s.id] || '';

      const photoHTML = (showFields.photo && s.foto_url)
        ? '<img src="' + s.foto_url + '" style="width:26mm;height:33mm;display:block;object-fit:cover;" />'
        : '<div style="width:26mm;height:33mm;background-color:#f3f4f6;"></div>';

      const logoSrc = dataLembaga?.logo_url || 'https://www.e-ujian.com/smpithm/logo';
      const logoHTML = showFields.schoolLogo
        ? '<img src="' + logoSrc + '" style="width:8mm;height:8mm;vertical-align:middle;margin-right:2mm;" />'
        : '';

      const qrHTML = (showFields.qrcode && qrSrc)
        ? '<img src="' + qrSrc + '" style="width:20mm;height:20mm;display:block;margin:2mm auto 1mm auto;" />'
        : '';

      const sigHTML = showFields.signature
        ? '<div style="font-size:5pt;color:' + warnaTtd + ';text-align:center;margin-top:3mm;"><div>Kepala Sekolah,</div><div style="height:10mm;"></div><div style="border-top:1px solid #9ca3af;padding-top:1mm;font-style:italic;">' + kepalaSekolah + '</div></div>'
        : '';

      const schoolName = (dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase();
      const schoolAddr = dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang';

      // FRONT CARD
      const frontCard = [
        '<div style="display:inline-block;vertical-align:top;width:55mm;height:87mm;border:0.5pt solid #d1d5db;background:white;overflow:hidden;margin:3mm;">',
        '  <div style="background:' + bgColor + ';height:2mm;width:100%;"></div>',
        '  <div style="padding:2mm 2.5mm 1mm 2.5mm;">',
        '    <div style="border-bottom:1.5pt solid ' + bgColor + ';padding-bottom:1mm;margin-bottom:2mm;">',
        '      ' + logoHTML,
        '      <span style="font-size:6.5pt;font-weight:bold;text-transform:uppercase;color:' + warnaJudul + ';">' + schoolName + '</span><br/>',
        '      <span style="font-size:4pt;color:' + warnaIdentitas + ';">' + schoolAddr + '</span>',
        '    </div>',
        '    <div style="text-align:center;margin-bottom:1.5mm;">' + photoHTML + '</div>',
        '    <div style="text-align:center;font-size:8pt;font-weight:bold;text-transform:uppercase;color:' + warnaNama + ';margin-bottom:0.5mm;">' + s.nama + '</div>',
        '    <div style="text-align:center;font-size:5pt;font-weight:bold;color:' + warnaIdentitas + ';border-bottom:0.5pt solid #e5e7eb;padding-bottom:1mm;margin-bottom:1.5mm;">PESERTA DIDIK</div>',
        '    <table style="width:100%;font-size:5pt;color:' + warnaIdentitas + ';border-collapse:collapse;">',
        '      <tr><td style="width:10mm;font-weight:bold;">NIPD</td><td style="width:3mm;">:</td><td style="font-weight:bold;">' + (s.nipd || '-') + '</td></tr>',
        '      <tr><td style="font-weight:bold;">NISN</td><td>:</td><td>' + (s.nisn || '-') + '</td></tr>',
        '      <tr><td style="font-weight:bold;vertical-align:top;">TTL</td><td style="vertical-align:top;">:</td><td>' + ttl + '</td></tr>',
        '      <tr><td style="font-weight:bold;vertical-align:top;">Alamat</td><td style="vertical-align:top;">:</td><td>' + (addr || '-') + '</td></tr>',
        '    </table>',
        sigHTML,
        '  </div>',
        '</div>',
      ].join('');

      // BACK CARD
      const backCard = [
        '<div style="display:inline-block;vertical-align:top;width:55mm;height:87mm;border:0.5pt solid #d1d5db;background:white;overflow:hidden;margin:3mm;">',
        '  <div style="background:' + bgColor + ';height:2mm;width:100%;"></div>',
        '  <div style="padding:3mm 3mm 2mm 3mm;">',
        '    <div style="font-size:7pt;font-weight:bold;text-transform:uppercase;color:' + bgColor + ';border-bottom:0.5pt solid #d1d5db;padding-bottom:1.5mm;margin-bottom:2mm;">Ketentuan Kartu</div>',
        '    <div style="font-size:5.5pt;color:' + warnaIdentitas + ';line-height:1.8;">',
        '      1. Kartu ini adalah identitas resmi peserta didik.<br/>',
        '      2. Wajib dibawa selama berada di sekolah.<br/>',
        '      3. Digunakan untuk presensi dan administrasi.<br/>',
        '      4. Jika hilang/rusak, segera melapor ke sekolah.',
        '    </div>',
        '    <div style="text-align:center;margin-top:3mm;">',
        qrHTML,
        '      <div style="font-size:4.5pt;font-weight:bold;color:#4b5563;text-align:center;">Scan QR Presensi</div>',
        '    </div>',
        '    <div style="font-size:4pt;font-style:italic;color:#9ca3af;text-align:center;margin-top:3mm;">** Berlaku selama menjadi siswa **</div>',
        '  </div>',
        '</div>',
      ].join('');

      cardsHTML += '<div style="page-break-inside:avoid;">' + frontCard + backCard + '</div>\n';
    });

    return '<!DOCTYPE html><html><head>'
      + '<meta name="viewport" content="width=device-width,initial-scale=1" />'
      + '<style>'
      + '@page{size:A4 portrait;margin:8mm;}'
      + 'body{margin:0;padding:0;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:sans-serif;}'
      + '</style>'
      + '</head><body>'
      + cardsHTML
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
        'Fitur cetak membutuhkan build APK terbaru karena ada penambahan modul sistem (expo-print). Silakan jalankan "eas build" untuk menggunakan fitur ini.'
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

  const saveSettings = async () => {
    try {
      const payload = {
        orientasi: settings.orientation,
        warna_tema: settings.themeColor,
        warna_nama: settings.warnaNama,
        warna_identitas: settings.warnaIdentitas,
        warna_ttd: settings.warnaTtd,
        warna_judul: settings.warnaJudul,
        tampil_foto: settings.showFields.photo,
        tampil_qr: settings.showFields.qrcode,
        tampil_logo: settings.showFields.schoolLogo,
        tampil_ttd: settings.showFields.signature,
      };

      // In mobile we just update the first row or insert
      const { data: existing } = await supabase.from('id_card_settings').select('id').limit(1).maybeSingle();
      if (existing) {
        await supabase.from('id_card_settings').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('id_card_settings').insert([payload]);
      }
      Alert.alert('Berhasil', 'Pengaturan berhasil disimpan');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal menyimpan pengaturan');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cetak Kartu Siswa</Text>
        </View>
        
        <TouchableOpacity style={styles.printBtnTop} onPress={handlePrint} disabled={selectedSiswaIds.length === 0}>
          <Printer size={20} color={selectedSiswaIds.length > 0 ? "#10b981" : "#9ca3af"} />
          <Text style={[styles.printBtnTextTop, { color: selectedSiswaIds.length > 0 ? "#10b981" : "#9ca3af" }]}>Cetak</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'siswa' && styles.tabBtnActive]} onPress={() => setActiveTab('siswa')}>
          <Users size={20} color={activeTab === 'siswa' ? '#daffcc' : 'rgba(255,255,255,0.7)'} />
          <Text style={[styles.tabText, activeTab === 'siswa' && styles.tabTextActive]}>Pilih Siswa ({selectedSiswaIds.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'pengaturan' && styles.tabBtnActive]} onPress={() => setActiveTab('pengaturan')}>
          <Palette size={20} color={activeTab === 'pengaturan' ? '#daffcc' : 'rgba(255,255,255,0.7)'} />
          <Text style={[styles.tabText, activeTab === 'pengaturan' && styles.tabTextActive]}>Pengaturan</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'siswa' ? (
        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Search size={20} color="#9ca3af" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama atau NIPD..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <View style={[styles.searchBox, { padding: 0, paddingLeft: 12, marginTop: 12 }]}>
              <Picker
                selectedValue={selectedKelas}
                onValueChange={(itemValue) => setSelectedKelas(itemValue)}
                style={{ flex: 1, height: 50, color: '#1f2937' }}
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
              <CheckSquare size={16} color="#4f46e5" />
              <Text style={{ color: '#4f46e5', fontWeight: 'bold', fontSize: 12 }}>Pilih Semua</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleAllSiswa(false)} style={styles.selectAllBtn}>
              <Square size={16} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 12 }}>Kosongkan</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2a2c87" />
            </View>
          ) : (
            <FlatList
              data={filteredSiswa}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.siswaRow, selectedSiswaIds.includes(item.id) && styles.siswaRowSelected]}
                  onPress={() => toggleSiswa(item.id)}
                >
                  {selectedSiswaIds.includes(item.id) ? (
                    <CheckSquare size={20} color="#4f46e5" style={{ marginRight: 12 }} />
                  ) : (
                    <Square size={20} color="#9ca3af" style={{ marginRight: 12 }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1f2937' }}>{item.nama}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>NIPD: {item.nipd || '-'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 20 }}>Tidak ada data</Text>}
            />
          )}
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>Orientasi Kartu</Text>
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

          <Text style={styles.sectionTitle}>Tampilan Elemen</Text>
          <View style={styles.elementsContainer}>
            {Object.entries({photo: 'Foto', qrcode: 'QR Code', schoolLogo: 'Logo', signature: 'Tanda Tangan'}).map(([key, label]) => (
              <TouchableOpacity 
                key={key} 
                style={styles.elementRow}
                onPress={() => setSettings(s => ({
                  ...s, 
                  showFields: { ...s.showFields, [key]: !s.showFields[key as keyof typeof s.showFields] }
                }))}
              >
                {settings.showFields[key as keyof typeof settings.showFields] ? 
                  <CheckSquare size={20} color="#10b981" /> : 
                  <Square size={20} color="#9ca3af" />
                }
                <Text style={styles.elementLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveSettingsBtn} onPress={saveSettings}>
            <Settings size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>Simpan Pengaturan Utama</Text>
          </TouchableOpacity>
          
          <Text style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
            Pengaturan warna khusus dan background saat ini hanya dapat diubah melalui aplikasi versi Web.
          </Text>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#2a2c87',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBack: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  printBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  printBtnTextTop: {
    fontWeight: 'bold',
    fontSize: 14,
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
  },
  tabTextActive: {
    color: '#daffcc',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  siswaRowSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#eff6ff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4b5563',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#4f46e5',
  },
  segmentText: {
    fontWeight: 'bold',
    color: '#6b7280',
  },
  segmentTextActive: {
    color: '#4f46e5',
  },
  elementsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 24,
    overflow: 'hidden',
  },
  elementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  elementLabel: {
    marginLeft: 12,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  saveSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  }
});
