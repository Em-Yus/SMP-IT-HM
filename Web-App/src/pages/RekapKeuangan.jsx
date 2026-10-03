import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  PieChart, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Printer, 
  RefreshCw, 
  Search, 
  Calendar, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function RekapKeuangan() {
  const [dataPemasukanSiswa, setDataPemasukanSiswa] = useState([]);
  const [dataPemasukanLainnya, setDataPemasukanLainnya] = useState([]);
  const [dataPengeluaran, setDataPengeluaran] = useState([]);
  const [dataLembaga, setDataLembaga] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const [tahunPelajaranFilter, setTahunPelajaranFilter] = useState(defaultTahun);
  const [semesterFilter, setSemesterFilter] = useState('Tahunan');
  const [filterType, setFilterType] = useState('semua'); // 'semua' | 'pemasukan' | 'pengeluaran'
  const [searchQuery, setSearchQuery] = useState('');

  // Date range defaults to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  const [activeTab, setActiveTab] = useState('arus_kas'); // 'arus_kas' | 'kategori'

  useEffect(() => {
    const fetchLembaga = async () => {
      const { data } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (data) setDataLembaga(data);
    };
    fetchLembaga();
  }, []);

  const fetchAllFinanceData = async () => {
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
      console.error('Error fetching rekap keuangan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllFinanceData();
  }, [tahunPelajaranFilter, semesterFilter, startDate, endDate]);

  // Totals
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

  // Breakdown per kategori pengeluaran
  const pengeluaranPerKategori = useMemo(() => {
    const map = {};
    dataPengeluaran.forEach(item => {
      const k = item.kategori || 'Lainnya';
      map[k] = (map[k] || 0) + (item.nominal || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [dataPengeluaran]);

  // Breakdown per sumber pemasukan
  const pemasukanPerSumber = useMemo(() => {
    const map = {
      'Pembayaran Tagihan Siswa': totalSiswa
    };
    dataPemasukanLainnya.forEach(item => {
      const k = item.sumber_dana || 'Lainnya';
      map[k] = (map[k] || 0) + (item.nominal || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [totalSiswa, dataPemasukanLainnya]);

  // Combined timeline of cash flow (Arus Kas)
  const unifiedTransactions = useMemo(() => {
    const list = [];

    // Siswa entries
    dataPemasukanSiswa.forEach(s => {
      list.push({
        id: `siswa_${s.id}`,
        tanggal: s.tanggal,
        tipe: 'masuk',
        kategori: 'Pemasukan Siswa',
        pihak: s.data_siswa?.nama ? `${s.data_siswa.nama} (${s.data_siswa.kelas || '-'})` : 'Siswa',
        keterangan: 'Pembayaran Tagihan / Mutu Siswa',
        nominal: s.nominal || 0,
      });
    });

    // Pemasukan Lainnya entries
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

    // Pengeluaran entries
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

    // Sort descending by tanggal
    list.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    // Filter
    return list.filter(item => {
      if (filterType === 'pemasukan' && item.tipe !== 'masuk') return false;
      if (filterType === 'pengeluaran' && item.tipe !== 'keluar') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ket = item.keterangan.toLowerCase();
        const pih = item.pihak.toLowerCase();
        const kat = item.kategori.toLowerCase();
        if (!ket.includes(q) && !pih.includes(q) && !kat.includes(q)) return false;
      }
      return true;
    });
  }, [dataPemasukanSiswa, dataPemasukanLainnya, dataPengeluaran, filterType, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/60 text-gray-800 font-sans min-h-screen pb-12 print:bg-white print:p-0">
      
      {/* HEADER & ACTIONS (Non-Printable) */}
      <div className="print:hidden mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black text-primary flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-primary rounded-xl">
                <PieChart size={22} />
              </div>
              <span>Rekap Keuangan Sekolah</span>
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Konsolidasi arus kas pemasukan dan pengeluaran secara real-time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint} 
              className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-xl font-bold shadow-xs transition flex items-center gap-2 text-xs cursor-pointer"
            >
              <Printer size={15} /> Cetak Laporan
            </button>
            <button 
              onClick={fetchAllFinanceData} 
              className="bg-white border border-gray-200 text-gray-700 px-3.5 py-2 rounded-xl font-bold shadow-xs hover:bg-gray-50 transition flex items-center gap-2 text-xs cursor-pointer"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* 3 Main KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Card 1: Total Pemasukan */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Total Pemasukan</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">
                  Rp {totalPemasukan.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <ArrowDownLeft size={22} />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
              <span>Siswa: Rp {totalSiswa.toLocaleString('id-ID')}</span>
              <span>Lainnya: Rp {totalLainnya.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Card 2: Total Pengeluaran */}
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">Total Pengeluaran</span>
                <span className="text-2xl font-black text-rose-600 mt-1 block">
                  Rp {totalPengeluaran.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <ArrowUpRight size={22} />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
              <span>{dataPengeluaran.length} transaksi tercatat</span>
              <span className="text-rose-600 font-bold">Dana Keluar</span>
            </div>
          </div>

          {/* Card 3: Saldo Kas Bersih */}
          <div className="bg-white p-5 rounded-2xl border border-primary/20 shadow-xs relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider block">Sisa Saldo Kas</span>
                <span className={`text-2xl font-black mt-1 block ${saldoKas >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                  Rp {saldoKas.toLocaleString('id-ID')}
                </span>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${saldoKas >= 0 ? 'bg-blue-50 text-primary' : 'bg-rose-50 text-rose-600'}`}>
                <Wallet size={22} />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold">
              <span className="text-gray-500">Status Keuangan:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${saldoKas >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {saldoKas >= 0 ? 'SURPLUS (KAS AMAN)' : 'DEFISIT'}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Bar & Tabs */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-200/80 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2.5 items-center">
            <span className="text-xs font-bold text-gray-600">Filter:</span>
            
            <select
              value={tahunPelajaranFilter}
              onChange={(e) => setTahunPelajaranFilter(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="2023/2024">2023/2024</option>
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>

            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="Tahunan">Tahunan</option>
              <option value="Semester Ganjil">Semester Ganjil</option>
              <option value="Semester Genap">Semester Genap</option>
            </select>

            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
              <span className="text-[11px] font-semibold text-gray-400">Tgl:</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none"
              />
              <span className="text-xs text-gray-400">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 outline-none"
              />
            </div>
          </div>

          {/* View Tab Buttons */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('arus_kas')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'arus_kas' ? 'bg-white text-primary shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Arus Kas Detail
            </button>
            <button
              onClick={() => setActiveTab('kategori')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'kategori' ? 'bg-white text-primary shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Rincian Kategori
            </button>
          </div>
        </div>

        {/* Tab 1: Arus Kas Detail */}
        {activeTab === 'arus_kas' && (
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterType('semua')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterType === 'semua' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Semua ({unifiedTransactions.length})
                </button>
                <button
                  onClick={() => setFilterType('pemasukan')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterType === 'pemasukan' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Pemasukan Saja
                </button>
                <button
                  onClick={() => setFilterType('pengeluaran')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterType === 'pengeluaran' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Pengeluaran Saja
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari transaksi / keterangan..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Table Arus Kas */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-24">Tanggal</th>
                    <th className="py-2.5 px-3 w-20 text-center">Arus</th>
                    <th className="py-2.5 px-3 w-32">Kategori / Pos</th>
                    <th className="py-2.5 px-3">Pihak / Keterangan</th>
                    <th className="py-2.5 px-3 text-right w-32">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <span>Mengkonsolidasi data keuangan...</span>
                      </td>
                    </tr>
                  ) : unifiedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        Tidak ada transaksi keuangan pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    unifiedTransactions.map((tx, idx) => {
                      const isMasuk = tx.tipe === 'masuk';
                      return (
                        <tr key={tx.id || idx} className="hover:bg-gray-50/80 transition">
                          <td className="py-2.5 px-3 text-center font-bold text-gray-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-gray-600 font-medium whitespace-nowrap">
                            {new Date(tx.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isMasuk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {isMasuk ? '+ Masuk' : '- Keluar'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-gray-700">
                            {tx.kategori}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-gray-800 block text-xs">
                              {tx.pihak}
                            </span>
                            <span className="text-gray-500 font-medium text-[11px]">
                              {tx.keterangan}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                            isMasuk ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {isMasuk ? '+' : '-'} Rp {(tx.nominal || 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="text-gray-500 font-medium">
                Pemasukan: <span className="font-bold text-emerald-700">Rp {totalPemasukan.toLocaleString('id-ID')}</span> • 
                Pengeluaran: <span className="font-bold text-rose-700">Rp {totalPengeluaran.toLocaleString('id-ID')}</span>
              </div>
              <div className="font-bold text-gray-700">
                Sisa Kas: <span className={`text-sm font-black ${saldoKas >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                  Rp {saldoKas.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Rincian Per Kategori */}
        {activeTab === 'kategori' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pemasukan by Source */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ArrowDownLeft size={16} className="text-emerald-600" />
                  <span>Rincian Sumber Pemasukan</span>
                </span>
                <span className="text-emerald-600 font-black">
                  Rp {totalPemasukan.toLocaleString('id-ID')}
                </span>
              </h3>

              <div className="space-y-3">
                {pemasukanPerSumber.map(([sumber, nominal]) => {
                  const pct = totalPemasukan > 0 ? Math.round((nominal / totalPemasukan) * 100) : 0;
                  return (
                    <div key={sumber} className="p-3 bg-gray-50/70 border border-gray-100 rounded-xl">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-gray-700">{sumber}</span>
                        <span className="font-black text-gray-900">
                          Rp {nominal.toLocaleString('id-ID')}{' '}
                          <span className="text-[10px] text-gray-400 font-semibold">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pengeluaran by Category */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-5">
              <h3 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-3 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ArrowUpRight size={16} className="text-rose-600" />
                  <span>Rincian Pos Pengeluaran</span>
                </span>
                <span className="text-rose-600 font-black">
                  Rp {totalPengeluaran.toLocaleString('id-ID')}
                </span>
              </h3>

              {pengeluaranPerKategori.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  Belum ada data pengeluaran pada periode ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {pengeluaranPerKategori.map(([kategori, nominal]) => {
                    const pct = totalPengeluaran > 0 ? Math.round((nominal / totalPengeluaran) * 100) : 0;
                    return (
                      <div key={kategori} className="p-3 bg-gray-50/70 border border-gray-100 rounded-xl">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-gray-700">{kategori}</span>
                          <span className="font-black text-gray-900">
                            Rp {nominal.toLocaleString('id-ID')}{' '}
                            <span className="text-[10px] text-gray-400 font-semibold">({pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PRINT VIEW (Official Financial Report) */}
      <div className="hidden print:block text-black p-4">
        {/* Kop Surat */}
        <div className="border-b-2 border-black pb-3 mb-4 text-center">
          <h1 className="text-xl font-bold uppercase tracking-wider">{dataLembaga?.nama_lembaga || 'SMP IT HASAN MUNADI'}</h1>
          <p className="text-xs">{dataLembaga?.alamat || 'Alamat Sekolah'} • Telp: {dataLembaga?.telepon || '-'}</p>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-base font-bold uppercase underline">LAPORAN REKAPITULASI KEUANGAN SEKOLAH</h2>
          <p className="text-xs text-gray-700 mt-1">
            Tahun Pelajaran: {tahunPelajaranFilter} • Semester: {semesterFilter}
          </p>
          <p className="text-xs text-gray-700">
            Periode: {new Date(startDate).toLocaleDateString('id-ID')} s/d {new Date(endDate).toLocaleDateString('id-ID')}
          </p>
        </div>

        {/* Ringkasan Eksekutif */}
        <table className="w-full text-xs border border-collapse border-black mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-left" colSpan={2}>RINGKASAN ARUS KAS</th>
              <th className="border border-black p-2 text-right">JUMLAH (RP)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 font-bold w-12">1.</td>
              <td className="border border-black p-2">Pemasukan Pembayaran Siswa</td>
              <td className="border border-black p-2 text-right font-semibold">Rp {totalSiswa.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">2.</td>
              <td className="border border-black p-2">Pemasukan Dana Lainnya (BOS / Donatur / Yayasan)</td>
              <td className="border border-black p-2 text-right font-semibold">Rp {totalLainnya.toLocaleString('id-ID')}</td>
            </tr>
            <tr className="bg-emerald-50/50 font-bold">
              <td className="border border-black p-2" colSpan={2}>TOTAL SELURUH PEMASUKAN</td>
              <td className="border border-black p-2 text-right">Rp {totalPemasukan.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">3.</td>
              <td className="border border-black p-2">Total Seluruh Pengeluaran Sekolah</td>
              <td className="border border-black p-2 text-right font-semibold text-rose-700">Rp {totalPengeluaran.toLocaleString('id-ID')}</td>
            </tr>
            <tr className="bg-gray-100 font-bold">
              <td className="border border-black p-2" colSpan={2}>SISA SALDO KAS BERSIH (SURPLUS / DEFISIT)</td>
              <td className="border border-black p-2 text-right">Rp {saldoKas.toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>

        {/* Tabel Rincian Transaksi */}
        <h3 className="text-xs font-bold uppercase mb-2">Rincian Buku Kas Masuk & Keluar:</h3>
        <table className="w-full text-[11px] border border-collapse border-black mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-1 text-center w-8">No</th>
              <th className="border border-black p-1 text-left w-20">Tanggal</th>
              <th className="border border-black p-1 text-center w-16">Arus</th>
              <th className="border border-black p-1 text-left w-28">Kategori</th>
              <th className="border border-black p-1 text-left">Keterangan / Uraian</th>
              <th className="border border-black p-1 text-right w-24">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {unifiedTransactions.map((tx, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1 text-center">{idx + 1}</td>
                <td className="border border-black p-1 whitespace-nowrap">
                  {new Date(tx.tanggal).toLocaleDateString('id-ID')}
                </td>
                <td className="border border-black p-1 text-center font-bold">
                  {tx.tipe === 'masuk' ? 'MASUK' : 'KELUAR'}
                </td>
                <td className="border border-black p-1">{tx.kategori}</td>
                <td className="border border-black p-1">{tx.pihak ? `${tx.pihak} - ` : ''}{tx.keterangan}</td>
                <td className="border border-black p-1 text-right font-semibold">
                  Rp {(tx.nominal || 0).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tanda Tangan */}
        <div className="flex justify-between items-center px-12 pt-6 text-xs">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-bold mb-16">Kepala Sekolah</p>
            <p className="font-bold underline">{dataLembaga?.nama_kepsek || '( ................................... )'}</p>
            <p>NIP. {dataLembaga?.nip_kepsek || '-'}</p>
          </div>
          <div className="text-center">
            <p>Bangkalan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-bold mb-16">Bendahara Sekolah</p>
            <p className="font-bold underline">( ................................... )</p>
          </div>
        </div>
      </div>

    </div>
  );
}
