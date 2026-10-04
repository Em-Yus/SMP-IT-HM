import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  TextInput,
  Platform 
} from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { Picker } from '@react-native-picker/picker';
import { 
  PieChart, 
  ChevronLeft, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Wallet, 
  Calendar,
  Layers,
  Search,
  Printer
} from 'lucide-react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function RekapKeuanganScreen() {
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  // Filters
  const [tahunPelajaranFilter, setTahunPelajaranFilter] = useState(defaultTahun);
  const [semesterFilter, setSemesterFilter] = useState('Tahunan');
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [activeTab, setActiveTab] = useState<'arus_kas' | 'kategori'>('arus_kas');

  // Date Picker States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeDatePickerField, setActiveDatePickerField] = useState<'start' | 'end'>('start');

  const parseDateString = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      if (activeDatePickerField === 'start') {
        setStartDate(dateStr);
      } else {
        setEndDate(dateStr);
      }
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Pilih Tanggal';
    const d = parseDateString(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const handleQuickPreset = (preset: 'today' | 'this_month' | 'this_year') => {
    const t = new Date();
    if (preset === 'today') {
      const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const fDay = new Date(t.getFullYear(), t.getMonth(), 1);
      const lDay = new Date(t.getFullYear(), t.getMonth() + 1, 0);
      const startStr = `${fDay.getFullYear()}-${String(fDay.getMonth() + 1).padStart(2, '0')}-${String(fDay.getDate()).padStart(2, '0')}`;
      const endStr = `${lDay.getFullYear()}-${String(lDay.getMonth() + 1).padStart(2, '0')}-${String(lDay.getDate()).padStart(2, '0')}`;
      setStartDate(startStr);
      setEndDate(endStr);
    } else if (preset === 'this_year') {
      const startStr = `${t.getFullYear()}-01-01`;
      const endStr = `${t.getFullYear()}-12-31`;
      setStartDate(startStr);
      setEndDate(endStr);
    }
  };

  // Data
  const [dataPemasukanSiswa, setDataPemasukanSiswa] = useState<any[]>([]);
  const [dataPemasukanLainnya, setDataPemasukanLainnya] = useState<any[]>([]);
  const [dataPengeluaran, setDataPengeluaran] = useState<any[]>([]);
  const [dataLembaga, setDataLembaga] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    supabase.from('data_lembaga').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) setDataLembaga(data);
    });
  }, []);

  const fetchFinanceData = async () => {
    setIsLoading(true);
    try {
      // 1. Pemasukan Siswa
      let qSiswa = supabase
        .from('tb_pemasukan_siswa')
        .select(`
          id,
          tanggal,
          nominal,
          tahun_pelajaran,
          semester,
          data_siswa (nama, kelas)
        `)
        .eq('tahun_pelajaran', tahunPelajaranFilter)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);

      if (semesterFilter !== 'Tahunan') {
        qSiswa = qSiswa.eq('semester', semesterFilter);
      }

      // 2. Pemasukan Lainnya
      let qLain = supabase
        .from('tb_pemasukan_lainnya')
        .select('*')
        .eq('tahun_pelajaran', tahunPelajaranFilter)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);

      if (semesterFilter !== 'Tahunan') {
        qLain = qLain.eq('semester', semesterFilter);
      }

      // 3. Pengeluaran
      let qKeluar = supabase
        .from('tb_pengeluaran')
        .select('*')
        .eq('tahun_pelajaran', tahunPelajaranFilter)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate);

      if (semesterFilter !== 'Tahunan') {
        qKeluar = qKeluar.eq('semester', semesterFilter);
      }

      const [resSiswa, resLain, resKeluar] = await Promise.allSettled([
        qSiswa,
        qLain,
        qKeluar
      ]);

      const siswaData = resSiswa.status === 'fulfilled' && !resSiswa.value.error ? (resSiswa.value.data || []) : [];
      const lainData = resLain.status === 'fulfilled' && !resLain.value.error ? (resLain.value.data || []) : [];
      const keluarData = resKeluar.status === 'fulfilled' && !resKeluar.value.error ? (resKeluar.value.data || []) : [];

      setDataPemasukanSiswa(siswaData);
      setDataPemasukanLainnya(lainData);
      setDataPengeluaran(keluarData);
    } catch (err) {
      console.error('Error fetching rekap keuangan mobile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [tahunPelajaranFilter, semesterFilter, startDate, endDate]);

  const totalSiswa = useMemo(() => {
    return dataPemasukanSiswa.reduce((sum, item) => sum + (item.nominal || 0), 0);
  }, [dataPemasukanSiswa]);

  const totalLainnya = useMemo(() => {
    return dataPemasukanLainnya.reduce((sum, item) => sum + (item.nominal || 0), 0);
  }, [dataPemasukanLainnya]);

  const totalPemasukan = totalSiswa + totalLainnya;

  const totalPengeluaran = useMemo(() => {
    return dataPengeluaran.reduce((sum, item) => sum + (item.nominal || 0), 0);
  }, [dataPengeluaran]);

  const saldoKas = totalPemasukan - totalPengeluaran;

  const formatRupiah = (val: number) => {
    return (val || 0).toLocaleString('id-ID');
  };

  // Unified Transactions
  const unifiedTransactions = useMemo(() => {
    const list: any[] = [];

    dataPemasukanSiswa.forEach(s => {
      list.push({
        id: `siswa_${s.id}`,
        tanggal: s.tanggal,
        tipe: 'masuk',
        kategori: 'Pemasukan Siswa',
        pihak: s.data_siswa?.nama ? `${s.data_siswa.nama} (${s.data_siswa.kelas || '-'})` : 'Siswa',
        keterangan: 'Pembayaran Tagihan / Mutu',
        nominal: s.nominal || 0,
      });
    });

    dataPemasukanLainnya.forEach(l => {
      list.push({
        id: `lain_${l.id}`,
        tanggal: l.tanggal,
        tipe: 'masuk',
        kategori: l.sumber_dana || 'Pemasukan Lainnya',
        pihak: l.sumber_dana || 'Donatur / BOS',
        keterangan: l.keterangan || '-',
        nominal: l.nominal || 0,
      });
    });

    dataPengeluaran.forEach(k => {
      list.push({
        id: `keluar_${k.id}`,
        tanggal: k.tanggal,
        tipe: 'keluar',
        kategori: k.kategori || 'Pengeluaran',
        pihak: k.penerima || 'Vendor / Pihak Ketiga',
        keterangan: k.keterangan || '-',
        nominal: k.nominal || 0,
      });
    });

    list.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    return list.filter(item => {
      if (filterType === 'masuk' && item.tipe !== 'masuk') return false;
      if (filterType === 'keluar' && item.tipe !== 'keluar') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ket = (item.keterangan || '').toLowerCase();
        const pih = (item.pihak || '').toLowerCase();
        const kat = (item.kategori || '').toLowerCase();
        if (!ket.includes(q) && !pih.includes(q) && !kat.includes(q)) return false;
      }
      return true;
    });
  }, [dataPemasukanSiswa, dataPemasukanLainnya, dataPengeluaran, filterType, searchQuery]);

  // Breakdown per kategori pengeluaran
  const pengeluaranPerKategori = useMemo(() => {
    const map: Record<string, number> = {};
    dataPengeluaran.forEach(item => {
      const k = item.kategori || 'Lainnya';
      map[k] = (map[k] || 0) + (item.nominal || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [dataPengeluaran]);

  const handlePrintReport = async () => {
    try {
      let Print: any = null;
      try {
        Print = require('expo-print');
      } catch (e) {
        console.warn('expo-print not found:', e);
      }

      if (!Print || !Print.printAsync) {
        Alert.alert('Perhatian', 'Fitur cetak membutuhkan modul expo-print.');
        return;
      }

      const rowsHTML = unifiedTransactions.map((tx, idx) => `
        <tr>
          <td style="border:1px solid #000;padding:4px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #000;padding:4px;white-space:nowrap;">${new Date(tx.tanggal).toLocaleDateString('id-ID')}</td>
          <td style="border:1px solid #000;padding:4px;text-align:center;font-weight:bold;color:${tx.tipe === 'masuk' ? '#047857' : '#be123c'};">${tx.tipe === 'masuk' ? 'MASUK' : 'KELUAR'}</td>
          <td style="border:1px solid #000;padding:4px;">${tx.kategori}</td>
          <td style="border:1px solid #000;padding:4px;">${tx.pihak ? `<b>${tx.pihak}</b> - ` : ''}${tx.keterangan || '-'}</td>
          <td style="border:1px solid #000;padding:4px;text-align:right;font-weight:bold;color:${tx.tipe === 'masuk' ? '#047857' : '#be123c'};">${tx.tipe === 'masuk' ? '+' : '-'} Rp ${(tx.nominal || 0).toLocaleString('id-ID')}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: Helvetica, Arial, sans-serif; padding: 15px; color: #000; }
            h1 { font-size: 16px; margin: 0; text-transform: uppercase; text-align: center; }
            p { font-size: 11px; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
            th { border: 1px solid #000; background: #f3f4f6; padding: 6px 4px; text-align: left; }
            .kop { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; text-align: center; }
            .summary-box { width: 100%; border: 1px solid #000; margin-bottom: 15px; font-size: 11px; }
            .summary-box td { padding: 6px 8px; border: 1px solid #000; }
          </style>
        </head>
        <body>
          <div class="kop">
            <h1>${dataLembaga?.nama_lembaga || 'SMP IT HASAN MUNADI'}</h1>
            <p>${dataLembaga?.alamat || 'Alamat Sekolah'} • Telp: ${dataLembaga?.telepon || '-'}</p>
          </div>

          <div style="text-align:center;margin-bottom:12px;">
            <h2 style="font-size:13px;text-decoration:underline;margin:0;text-transform:uppercase;">LAPORAN LENGKAP KEUANGAN SEKOLAH</h2>
            <p style="font-size:10px;color:#444;">Tahun Pelajaran: ${tahunPelajaranFilter} • Semester: ${semesterFilter}</p>
            <p style="font-size:10px;color:#444;">Periode: ${new Date(startDate).toLocaleDateString('id-ID')} s/d ${new Date(endDate).toLocaleDateString('id-ID')}</p>
          </div>

          <table class="summary-box">
            <tr style="background:#f3f4f6;font-weight:bold;">
              <td colspan="2">RINGKASAN ARUS KAS</td>
              <td style="text-align:right;">JUMLAH (RP)</td>
            </tr>
            <tr>
              <td style="width:25px;text-align:center;font-weight:bold;">1.</td>
              <td>Total Pemasukan Siswa</td>
              <td style="text-align:right;font-weight:bold;color:#047857;">Rp ${totalSiswa.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td style="width:25px;text-align:center;font-weight:bold;">2.</td>
              <td>Total Pemasukan Dana Lainnya (BOS / Donatur)</td>
              <td style="text-align:right;font-weight:bold;color:#047857;">Rp ${totalLainnya.toLocaleString('id-ID')}</td>
            </tr>
            <tr style="background:#ecfdf5;font-weight:bold;">
              <td colspan="2">TOTAL SELURUH PEMASUKAN</td>
              <td style="text-align:right;color:#047857;">Rp ${totalPemasukan.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td style="width:25px;text-align:center;font-weight:bold;">3.</td>
              <td>Total Seluruh Pengeluaran Kas</td>
              <td style="text-align:right;font-weight:bold;color:#be123c;">Rp ${totalPengeluaran.toLocaleString('id-ID')}</td>
            </tr>
            <tr style="background:#f3f4f6;font-weight:bold;">
              <td colspan="2">SISA SALDO KAS BERSIH (${saldoKas >= 0 ? 'SURPLUS' : 'DEFISIT'})</td>
              <td style="text-align:right;color:${saldoKas >= 0 ? '#1e3a8a' : '#be123c'};">Rp ${saldoKas.toLocaleString('id-ID')}</td>
            </tr>
          </table>

          <p style="font-weight:bold;font-size:11px;margin-top:12px;">Rincian Buku Kas Pemasukan & Pengeluaran (${unifiedTransactions.length} Transaksi):</p>
          <table>
            <thead>
              <tr>
                <th style="width:20px;text-align:center;">No</th>
                <th style="width:65px;">Tanggal</th>
                <th style="width:50px;text-align:center;">Arus</th>
                <th style="width:90px;">Kategori</th>
                <th>Pihak / Keterangan</th>
                <th style="width:85px;text-align:right;">Nominal</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML || '<tr><td colspan="6" style="text-align:center;padding:10px;">Tidak ada transaksi</td></tr>'}
            </tbody>
          </table>

          <div style="margin-top:25px;display:flex;justify-content:space-between;font-size:10px;">
            <div style="text-align:center;width:40%;">
              <p>Mengetahui,</p>
              <p style="font-weight:bold;margin-bottom:45px;">Kepala Sekolah</p>
              <p style="font-weight:bold;text-decoration:underline;">${dataLembaga?.nama_kepsek || '( ................................... )'}</p>
              <p>NIP. ${dataLembaga?.nip_kepsek || '-'}</p>
            </div>
            <div style="text-align:center;width:40%;">
              <p>Bangkalan, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="font-weight:bold;margin-bottom:45px;">Bendahara Sekolah</p>
              <p style="font-weight:bold;text-decoration:underline;">( ................................... )</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err: any) {
      console.error('Print report error:', err);
      Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak laporan: ' + err.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Laporan Keuangan</Text>
            <Text style={styles.headerSubtitle}>Laporan Lengkap Pemasukan & Pengeluaran</Text>
          </View>
          <TouchableOpacity onPress={handlePrintReport} style={styles.printBtn} activeOpacity={0.8}>
            <Printer size={16} color="#2a2c87" />
            <Text style={styles.printBtnText}>Cetak</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 3 SUMMARY CARDS */}
        <View style={styles.kpiRow}>
          {/* Total Pemasukan */}
          <View style={[styles.kpiCard, { borderColor: '#d1fae5' }]}>
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: '#047857' }]}>Pemasukan</Text>
              <View style={[styles.kpiIcon, { backgroundColor: '#ecfdf5' }]}>
                <ArrowDownLeft size={16} color="#10b981" />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>Rp {formatRupiah(totalPemasukan)}</Text>
            <Text style={styles.kpiSub}>Siswa: {formatRupiah(totalSiswa)}</Text>
          </View>

          {/* Total Pengeluaran */}
          <View style={[styles.kpiCard, { borderColor: '#ffe4e6' }]}>
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiLabel, { color: '#be123c' }]}>Pengeluaran</Text>
              <View style={[styles.kpiIcon, { backgroundColor: '#fff1f2' }]}>
                <ArrowUpRight size={16} color="#e11d48" />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: '#e11d48' }]}>Rp {formatRupiah(totalPengeluaran)}</Text>
            <Text style={styles.kpiSub}>{dataPengeluaran.length} pos keluar</Text>
          </View>
        </View>

        {/* Saldo Kas Banner */}
        <View style={[styles.saldoCard, saldoKas < 0 && { backgroundColor: '#be123c' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.saldoLabel}>Sisa Saldo Kas Bersih</Text>
              <Text style={styles.saldoValue}>Rp {formatRupiah(saldoKas)}</Text>
            </View>
            <View style={styles.saldoBadge}>
              <Text style={styles.saldoBadgeText}>{saldoKas >= 0 ? 'SURPLUS' : 'DEFISIT'}</Text>
            </View>
          </View>
        </View>

        {/* FILTER BAR */}
        <View style={styles.filterCard}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tahun Pelajaran</Text>
              <View style={styles.pickerWrapperSM}>
                <Picker selectedValue={tahunPelajaranFilter} onValueChange={setTahunPelajaranFilter}>
                  <Picker.Item label="2023/2024" value="2023/2024" />
                  <Picker.Item label="2024/2025" value="2024/2025" />
                  <Picker.Item label="2025/2026" value="2025/2026" />
                  <Picker.Item label="2026/2027" value="2026/2027" />
                </Picker>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Semester</Text>
              <View style={styles.pickerWrapperSM}>
                <Picker selectedValue={semesterFilter} onValueChange={setSemesterFilter}>
                  <Picker.Item label="Tahunan" value="Tahunan" />
                  <Picker.Item label="Ganjil" value="Semester Ganjil" />
                  <Picker.Item label="Genap" value="Semester Genap" />
                </Picker>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Mulai Tgl</Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                activeOpacity={0.7}
                onPress={() => {
                  setActiveDatePickerField('start');
                  setShowDatePicker(true);
                }}
              >
                <Calendar size={15} color="#2a2c87" style={{ marginRight: 6 }} />
                <Text style={styles.datePickerBtnText}>{formatDisplayDate(startDate)}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sampai Tgl</Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                activeOpacity={0.7}
                onPress={() => {
                  setActiveDatePickerField('end');
                  setShowDatePicker(true);
                }}
              >
                <Calendar size={15} color="#2a2c87" style={{ marginRight: 6 }} />
                <Text style={styles.datePickerBtnText}>{formatDisplayDate(endDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick presets */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TouchableOpacity style={styles.quickPresetChip} onPress={() => handleQuickPreset('today')}>
              <Text style={styles.quickPresetChipText}>Hari Ini</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickPresetChip} onPress={() => handleQuickPreset('this_month')}>
              <Text style={styles.quickPresetChipText}>Bulan Ini</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickPresetChip} onPress={() => handleQuickPreset('this_year')}>
              <Text style={styles.quickPresetChipText}>1 Tahun</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TABS VIEW */}
        <View style={styles.subTabContainer}>
          <TouchableOpacity 
            style={[styles.subTabBtn, activeTab === 'arus_kas' && styles.subTabActive]}
            onPress={() => setActiveTab('arus_kas')}
          >
            <Text style={[styles.subTabText, activeTab === 'arus_kas' && styles.subTabTextActive]}>
              Arus Kas Detail ({unifiedTransactions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.subTabBtn, activeTab === 'kategori' && styles.subTabActive]}
            onPress={() => setActiveTab('kategori')}
          >
            <Text style={[styles.subTabText, activeTab === 'kategori' && styles.subTabTextActive]}>
              Rincian Kategori
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'arus_kas' && (
          <View>
            {/* Filter Type Pills */}
            <View style={styles.pillRow}>
              <TouchableOpacity 
                style={[styles.pill, filterType === 'semua' && styles.pillActive]}
                onPress={() => setFilterType('semua')}
              >
                <Text style={[styles.pillText, filterType === 'semua' && styles.pillTextActive]}>Semua</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.pill, filterType === 'masuk' && styles.pillActiveGreen]}
                onPress={() => setFilterType('masuk')}
              >
                <Text style={[styles.pillText, filterType === 'masuk' && styles.pillTextActiveGreen]}>Masuk (+)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.pill, filterType === 'keluar' && styles.pillActiveRed]}
                onPress={() => setFilterType('keluar')}
              >
                <Text style={[styles.pillText, filterType === 'keluar' && styles.pillTextActiveRed]}>Keluar (-)</Text>
              </TouchableOpacity>
            </View>

            {/* Transaction List */}
            {isLoading ? (
              <ActivityIndicator size="large" color="#2a2c87" style={{ marginTop: 24 }} />
            ) : unifiedTransactions.length === 0 ? (
              <Text style={styles.emptyText}>Tidak ada transaksi keuangan pada filter ini.</Text>
            ) : (
              unifiedTransactions.map((tx) => {
                const isMasuk = tx.tipe === 'masuk';
                return (
                  <View key={tx.id} style={styles.txItem}>
                    <View style={[styles.txIcon, isMasuk ? styles.txIconGreen : styles.txIconRed]}>
                      {isMasuk ? (
                        <ArrowDownLeft size={18} color="#059669" />
                      ) : (
                        <ArrowUpRight size={18} color="#e11d48" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle}>{tx.kategori}</Text>
                      <Text style={styles.txParty}>{tx.pihak}</Text>
                      <Text style={styles.txSub}>
                        {new Date(tx.tanggal).toLocaleDateString('id-ID')} • {tx.keterangan}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txAmount, isMasuk ? styles.txAmountGreen : styles.txAmountRed]}>
                        {isMasuk ? '+' : '-'} Rp {formatRupiah(tx.nominal)}
                      </Text>
                      <View style={[styles.txBadge, isMasuk ? styles.txBadgeGreen : styles.txBadgeRed]}>
                        <Text style={[styles.txBadgeText, isMasuk ? { color: '#059669' } : { color: '#e11d48' }]}>
                          {isMasuk ? 'Masuk' : 'Keluar'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'kategori' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Rincian Pos Pengeluaran</Text>
            {pengeluaranPerKategori.length === 0 ? (
              <Text style={styles.emptyText}>Belum ada data pengeluaran.</Text>
            ) : (
              pengeluaranPerKategori.map(([kat, nom]) => {
                const pct = totalPengeluaran > 0 ? Math.round((nom / totalPengeluaran) * 100) : 0;
                return (
                  <View key={kat} style={styles.catItem}>
                    <View style={styles.catHeader}>
                      <Text style={styles.catTitle}>{kat}</Text>
                      <Text style={styles.catValue}>Rp {formatRupiah(nom)} ({pct}%)</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DateTimePicker Dialog */}
      {showDatePicker && (
        <DateTimePicker
          value={
            activeDatePickerField === 'start'
              ? parseDateString(startDate)
              : parseDateString(endDate)
          }
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#2a2c87', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { color: '#e0e7ff', fontSize: 12, marginTop: 2 },

  content: { flex: 1, padding: 16 },

  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  kpiCard: { 
    flex: 1, 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    padding: 12, 
    borderWidth: 1,
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2 
  },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  kpiLabel: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  kpiIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  kpiValue: { fontSize: 15, fontWeight: 'black', marginBottom: 2 },
  kpiSub: { fontSize: 10, color: '#64748b' },

  saldoCard: { 
    backgroundColor: '#2a2c87', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 14, 
    elevation: 3, 
    shadowColor: '#2a2c87', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 6 
  },
  saldoLabel: { color: '#e0e7ff', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  saldoValue: { color: '#fff', fontSize: 22, fontWeight: 'black', marginTop: 2 },
  saldoBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  saldoBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  filterCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
  pickerWrapperSM: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', height: 40, justifyContent: 'center' },
  inputDateSM: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 10, height: 40, fontSize: 12, color: '#1e293b' },
  datePickerBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 10, height: 40, flexDirection: 'row', alignItems: 'center' },
  datePickerBtnText: { fontSize: 12, color: '#1e293b', fontWeight: '600' },
  quickPresetChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  quickPresetChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },

  subTabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', padding: 4, borderRadius: 12, marginBottom: 12 },
  subTabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  subTabActive: { backgroundColor: '#fff' },
  subTabText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  subTabTextActive: { color: '#2a2c87' },

  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  pillActive: { backgroundColor: '#2a2c87', borderColor: '#2a2c87' },
  pillActiveGreen: { backgroundColor: '#059669', borderColor: '#059669' },
  pillActiveRed: { backgroundColor: '#e11d48', borderColor: '#e11d48' },
  pillText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  pillTextActive: { color: '#fff' },
  pillTextActiveGreen: { color: '#fff' },
  pillTextActiveRed: { color: '#fff' },

  txItem: { 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    padding: 12, 
    marginBottom: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2 
  },
  txIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  txIconGreen: { backgroundColor: '#ecfdf5' },
  txIconRed: { backgroundColor: '#fff1f2' },
  txTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  txParty: { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 1 },
  txSub: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  txAmount: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  txAmountGreen: { color: '#059669' },
  txAmountRed: { color: '#e11d48' },
  txBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  txBadgeGreen: { backgroundColor: '#ecfdf5' },
  txBadgeRed: { backgroundColor: '#fff1f2' },
  txBadgeText: { fontSize: 9, fontWeight: 'bold' },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
  catItem: { marginBottom: 12 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catTitle: { fontSize: 12, fontWeight: 'bold', color: '#334155' },
  catValue: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  progressBar: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#e11d48', borderRadius: 3 },

  emptyText: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', marginTop: 30, fontSize: 13 },
  printBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#fff', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  printBtnText: { color: '#2a2c87', fontSize: 12, fontWeight: 'bold' }
});
