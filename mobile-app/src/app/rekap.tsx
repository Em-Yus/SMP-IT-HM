import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput as RNTextInput } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Receipt, Printer, ArrowLeft, Filter } from 'lucide-react-native';
import { router } from 'expo-router';
// import * as Print from 'expo-print'; // REMOVED TO PREVENT CRASH
import { Picker } from '@react-native-picker/picker';

export type Pembayaran = {
  id: number;
  tanggal: string;
  nominal: number;
  tahun_pelajaran: string;
  semester: string;
  data_siswa: {
    nipd: string;
    nama: string;
    kelas: string;
  };
};

export default function RekapPembayaran() {
  const [dataPembayaran, setDataPembayaran] = useState<Pembayaran[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataLembaga, setDataLembaga] = useState<any>(null);

  // Dynamic Tahun Pelajaran
  const [availableYears, setAvailableYears] = useState<string[]>(['2023/2024', '2024/2025', '2025/2026']);
  const [tahunPelajaran, setTahunPelajaran] = useState('2025/2026');
  
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);

  const [startDate, setStartDate] = useState<string>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [tahunPelajaran, startDate, endDate]);

  const fetchInitialData = async () => {
    try {
      // Fetch Lembaga for Print Header
      const { data: lembaga } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (lembaga) setDataLembaga(lembaga);

      // Fetch dynamic years from tb_pemasukan_siswa
      const { data: yearsData } = await supabase.from('tb_pemasukan_siswa').select('tahun_pelajaran');
      if (yearsData && yearsData.length > 0) {
        const uniqueYears = Array.from(new Set(yearsData.map(d => d.tahun_pelajaran).filter(Boolean))) as string[];
        if (uniqueYears.length > 0) {
          const sorted = uniqueYears.sort().reverse(); // Newest first
          setAvailableYears(sorted);
          if (lembaga?.tahun_pelajaran && sorted.includes(lembaga.tahun_pelajaran)) {
            setTahunPelajaran(lembaga.tahun_pelajaran);
          } else {
            setTahunPelajaran(sorted[0]);
          }
        }
      }
    } catch (e) {
      console.warn("Failed fetching dynamic years", e);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const startStr = startDate || '2000-01-01';
      const endStr = endDate || '2099-12-31';

      let query = supabase
        .from('tb_pemasukan_siswa')
        .select(`
          id,
          tanggal,
          nominal,
          tahun_pelajaran,
          semester,
          siswa_id,
          data_siswa (
            nipd,
            nama,
            kelas
          )
        `)
        .eq('tahun_pelajaran', tahunPelajaran)
        .gte('tanggal', startStr)
        .lte('tanggal', endStr)
        .order('tanggal', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.warn("Join query failed, falling back to manual fetch:", error.message);
        // Fallback without join
        const { data: rawData, error: err2 } = await supabase
          .from('tb_pemasukan_siswa')
          .select('*')
          .eq('tahun_pelajaran', tahunPelajaran)
          .gte('tanggal', startStr)
          .lte('tanggal', endStr)
          .order('tanggal', { ascending: false });

        if (err2) throw err2;

        const siswaIds = Array.from(new Set((rawData || []).map((p: any) => p.siswa_id).filter(Boolean)));
        let siswaMap: Record<number, any> = {};
        if (siswaIds.length > 0) {
          const { data: siswaList } = await supabase
            .from('data_siswa')
            .select('id, nama, nipd, kelas')
            .in('id', siswaIds);
          (siswaList || []).forEach((s: any) => { siswaMap[s.id] = s; });
        }

        const normalized = (rawData || []).map((item: any) => ({
          ...item,
          data_siswa: siswaMap[item.siswa_id] || { nipd: '-', nama: 'Siswa Dihapus', kelas: '-' }
        }));
        const uniqueKelas = [...new Set(normalized.map((item: any) => item.data_siswa?.kelas).filter(Boolean))].sort() as string[];
        setAvailableKelas(uniqueKelas);
        setDataPembayaran(normalized);
      } else {
        const normalized = (data || []).map((item: any) => {
          const siswa = Array.isArray(item.data_siswa) ? item.data_siswa[0] : item.data_siswa;
          return {
            ...item,
            data_siswa: siswa || { nipd: '-', nama: 'Siswa Dihapus', kelas: '-' }
          };
        });
        const uniqueKelas = [...new Set(normalized.map((item: any) => item.data_siswa?.kelas).filter(Boolean))].sort() as string[];
        setAvailableKelas(uniqueKelas);
        setDataPembayaran(normalized);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Gagal memuat data pembayaran.');
      setDataPembayaran([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDataPembayaran = filterKelas === 'Semua' 
    ? dataPembayaran 
    : dataPembayaran.filter(item => item.data_siswa?.kelas === filterKelas);

  const totalNominal = (filteredDataPembayaran || []).reduce((sum, item) => sum + (Number(item?.nominal) || 0), 0);

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount == null || isNaN(Number(amount))) return '0';
    return Math.round(Number(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const generateHTML = () => {
    const startStr = formatDateString(startDate);
    const endStr = formatDateString(endDate);

    let rowsHTML = '';
    if (filteredDataPembayaran.length === 0) {
      rowsHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">Tidak ada pemasukan untuk periode / filter tersebut.</td></tr>`;
    } else {
      filteredDataPembayaran.forEach((item, idx) => {
        rowsHTML += `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563;">${idx + 1}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #374151;">${formatDateString(item.tanggal)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #6b7280;">${item.data_siswa?.nipd || '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #1f2937; text-transform: uppercase;">${item.data_siswa?.nama || 'Siswa Dihapus'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #1f2937; font-weight: 600;">${item.data_siswa?.kelas || '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #047857; font-weight: bold;">Rp ${formatCurrency(item.nominal)}</td>
          </tr>
        `;
      });
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            @page { size: A4 portrait; margin: 20mm; }
            body { margin: 0; padding: 0; background-color: white; font-family: sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f3f4f6; color: #1f2937; padding: 12px 10px; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #374151; }
            td { font-size: 13px; }
          </style>
        </head>
        <body>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom: 2px solid #1f2937; padding-bottom: 16px; margin-bottom: 16px;">
            <tr>
              ${dataLembaga?.logo_url ? `
                <td width="90" valign="middle">
                  <img src="${dataLembaga.logo_url}" style="width: 70px; height: 70px; object-fit: contain;" />
                </td>
              ` : ''}
              <td valign="middle">
                <h1 style="font-size: 18px; font-weight: bold; letter-spacing: 1px; color: #111827; margin: 0; text-transform: uppercase;">REKAPITULASI PEMASUKAN DANA</h1>
                <h2 style="font-size: 22px; font-weight: 900; color: #111827; margin: 4px 0 0 0; text-transform: uppercase;">${(dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN').toUpperCase()}</h2>
                <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0;">${dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}</p>
              </td>
            </tr>
          </table>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
            <tr>
              <td style="font-size: 13px;"><strong>Tahun Pelajaran:</strong> ${tahunPelajaran}</td>
              <td align="right" style="font-size: 13px;"><strong>Periode:</strong> ${startStr} - ${endStr}</td>
            </tr>
          </table>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">No</th>
                <th style="text-align: left;">Tanggal Masuk</th>
                <th>NIPD</th>
                <th style="text-align: left;">Nama Siswa</th>
                <th>Kelas</th>
                <th style="text-align: right;">Nominal Setoran</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" style="padding: 16px 10px; text-align: right; font-weight: bold; color: #374151; text-transform: uppercase; border-top: 2px solid #d1d5db;">Total Pemasukan Keseluruhan</td>
                <td style="padding: 16px 10px; text-align: right; font-size: 16px; font-weight: bold; color: #111827; border-top: 2px solid #d1d5db;">Rp ${formatCurrency(totalNominal)}</td>
              </tr>
            </tfoot>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 50px;">
            <tr>
              <td align="right">
                <div style="text-align: center; display: inline-block;">
                  <p style="margin: 0 0 60px 0; font-size: 13px;">Subang, ${formatDateString(new Date().toISOString())}</p>
                  <p style="margin: 0; font-weight: bold; border-bottom: 1px solid #1f2937; padding-bottom: 4px; width: 180px;">Bendahara / Admin</p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280;">Dicetak dari SIAKAD SMP IT HM</p>
                </div>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  };


  const handlePrint = async () => {
    let Print;
    try {
      Print = require('expo-print');
    } catch (e) {
      Alert.alert(
        'Update Diperlukan',
        'Fitur cetak membutuhkan build APK terbaru. Silakan jalankan "eas build".'
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Rekap Pembayaran</Text>
            <Text style={styles.headerSubtitle}>Laporan pemasukan dana siswa</Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => setShowFilter(!showFilter)}>
            <Filter size={24} color={showFilter ? "#daffcc" : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePrint}>
            <Printer size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {showFilter && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Tahun Pelajaran</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={tahunPelajaran}
              onValueChange={(val) => setTahunPelajaran(val)}
              style={styles.picker}
            >
              {availableYears.map(year => (
                <Picker.Item key={year} label={year} value={year} />
              ))}
            </Picker>
          </View>

          <Text style={[styles.filterLabel, { marginTop: 12 }]}>Kelas</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={filterKelas}
              onValueChange={(val) => setFilterKelas(val)}
              style={styles.picker}
            >
              <Picker.Item label="Semua Kelas" value="Semua" />
              {availableKelas.map(k => (
                <Picker.Item key={k} label={`Kelas ${k}`} value={k} />
              ))}
            </Picker>
          </View>

          <View style={[styles.dateRow, { marginTop: 12 }]}>
            <View style={styles.dateCol}>
              <Text style={styles.filterLabel}>Dari (YYYY-MM-DD)</Text>
              <RNTextInput
                style={styles.dateInput}
                value={startDate}
                onChangeText={(t) => setStartDate(t)}
                placeholder="2025-01-01"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View style={styles.dateCol}>
              <Text style={styles.filterLabel}>Sampai (YYYY-MM-DD)</Text>
              <RNTextInput
                style={styles.dateInput}
                value={endDate}
                onChangeText={(t) => setEndDate(t)}
                placeholder="2025-12-31"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>
        </View>
      )}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Pemasukan Keseluruhan</Text>
        <Text style={styles.summaryValue}>Rp {formatCurrency(totalNominal)}</Text>
        <Text style={styles.summarySubtitle}>Periode: {formatDateString(startDate)} - {formatDateString(endDate)}</Text>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2a2c87" />
          </View>
        ) : (
          <FlatList
            data={filteredDataPembayaran}
            keyExtractor={(item, index) => item?.id?.toString() || index.toString()}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item, index }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Receipt size={16} color="#6b7280" />
                    <Text style={styles.cardDate}>{formatDateString(item.tanggal)}</Text>
                  </View>
                  <Text style={styles.cardNominal}>Rp {formatCurrency(item.nominal)}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{item.data_siswa?.nama || 'Siswa Dihapus'}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={styles.cardDetailText}>NIPD: {item.data_siswa?.nipd || '-'}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.data_siswa?.kelas || '-'}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Receipt size={48} color="#d1d5db" />
                <Text style={styles.emptyText}>Tidak ada riwayat pembayaran pada periode ini.</Text>
              </View>
            }
            refreshing={isLoading}
            onRefresh={fetchData}
          />
        )}
      </View>
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
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerBack: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#a5b4fc',
    fontSize: 12,
    marginTop: 2,
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 5,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pickerWrapper: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 16,
  },
  picker: {
    height: 50,
    color: '#1f2937',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCol: {
    flex: 1,
  },
  dateInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#10b981',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  summaryTitle: {
    color: '#d1fae5',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 6,
  },
  summarySubtitle: {
    color: '#a7f3d0',
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardDate: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '600',
  },
  cardNominal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#047857',
  },
  cardBody: {
    padding: 16,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  cardDetailText: {
    fontSize: 13,
    color: '#6b7280',
  },
  badge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#4338ca',
    fontSize: 11,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  }
});
