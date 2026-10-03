import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { CreditCard, Search, RefreshCw, Printer, Calendar, Trash2, Plus, AlertCircle, Tag, ArrowUpRight } from 'lucide-react';
import Swal from 'sweetalert2';

export default function Pengeluaran() {
  // Main Data
  const [dataPengeluaran, setDataPengeluaran] = useState([]);
  const [dataLembaga, setDataLembaga] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tableNotExists, setTableNotExists] = useState(false);

  useEffect(() => {
    const fetchLembaga = async () => {
      const { data } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (data) setDataLembaga(data);
    };
    fetchLembaga();
  }, []);

  // Filters
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const [tahunPelajaranFilter, setTahunPelajaranFilter] = useState(defaultTahun);
  const [semesterFilter, setSemesterFilter] = useState('Tahunan');
  const [filterKategori, setFilterKategori] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Date range defaults to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  // Form Input
  const [inputTanggal, setInputTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [inputKategori, setInputKategori] = useState('Operasional & Utilitas');
  const [inputKategoriLainnya, setInputKategoriLainnya] = useState('');
  const [inputPenerima, setInputPenerima] = useState('');
  const [inputKeterangan, setInputKeterangan] = useState('');
  const [inputNominal, setInputNominal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_pengeluaran')
        .select('*')
        .eq('tahun_pelajaran', tahunPelajaranFilter)
        .eq('semester', semesterFilter)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('tb_pengeluaran')) {
          setTableNotExists(true);
          setDataPengeluaran([]);
          return;
        }
        throw error;
      }

      setTableNotExists(false);
      setDataPengeluaran(data || []);
    } catch (err) {
      console.error('Error fetching pengeluaran:', err);
      Swal.fire('Error', 'Gagal memuat data pengeluaran', 'error');
      setDataPengeluaran([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tahunPelajaranFilter, semesterFilter, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputNominal) return;

    const nominalValue = parseInt(inputNominal.replace(/[^0-9]/g, ''), 10);
    if (!nominalValue || nominalValue <= 0) {
      Swal.fire('Gagal', 'Nominal pengeluaran tidak valid', 'error');
      return;
    }

    const finalKategori = inputKategori === 'Lainnya' ? inputKategoriLainnya.trim() : inputKategori;
    if (!finalKategori) {
      Swal.fire('Gagal', 'Kategori pengeluaran harus diisi', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('tb_pengeluaran')
        .insert([{
          tanggal: inputTanggal,
          kategori: finalKategori,
          penerima: inputPenerima.trim() || null,
          keterangan: inputKeterangan.trim() || null,
          nominal: nominalValue,
          tahun_pelajaran: tahunPelajaranFilter,
          semester: semesterFilter
        }]);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('tb_pengeluaran')) {
          setTableNotExists(true);
          throw new Error('Tabel tb_pengeluaran belum dibuat di Supabase.');
        }
        throw error;
      }

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Pengeluaran berhasil dicatat',
        timer: 1500,
        showConfirmButton: false
      });

      // Reset form
      setInputKeterangan('');
      setInputNominal('');
      setInputPenerima('');
      if (inputKategori === 'Lainnya') {
        setInputKategoriLainnya('');
      }

      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'Gagal menyimpan data pengeluaran', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: 'Hapus Pengeluaran?',
      text: 'Data yang dihapus tidak dapat dikembalikan!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (confirm.isConfirmed) {
      try {
        const { error } = await supabase.from('tb_pengeluaran').delete().eq('id', id);
        if (error) throw error;
        fetchData();
        Swal.fire('Terhapus!', 'Data pengeluaran telah dihapus.', 'success');
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Gagal menghapus data', 'error');
      }
    }
  };

  const filteredData = useMemo(() => {
    return dataPengeluaran.filter(item => {
      if (filterKategori !== 'Semua' && item.kategori !== filterKategori) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ket = (item.keterangan || '').toLowerCase();
        const pen = (item.penerima || '').toLowerCase();
        const kat = (item.kategori || '').toLowerCase();
        if (!ket.includes(q) && !pen.includes(q) && !kat.includes(q)) return false;
      }
      return true;
    });
  }, [dataPengeluaran, filterKategori, searchQuery]);

  const totalNominal = filteredData.reduce((sum, item) => sum + (item.nominal || 0), 0);
  const avgNominal = filteredData.length > 0 ? Math.round(totalNominal / filteredData.length) : 0;

  const kategoriOptions = [
    'Gaji & Honorarium',
    'Operasional & Utilitas',
    'Sarana & Prasarana',
    'Kegiatan Kesiswaan',
    'Konsumsi & Jamuan',
    'ATK & Cetak',
    'Perlengkapan Lab / TI',
    'Pemeliharaan & Kebersihan',
    'Lainnya'
  ];

  const getKategoriBadgeColor = (kat) => {
    const k = (kat || '').toLowerCase();
    if (k.includes('gaji') || k.includes('honor')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (k.includes('operasional') || k.includes('utilitas')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (k.includes('sarana')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (k.includes('kegiatan')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (k.includes('konsumsi')) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (k.includes('atk')) return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/60 text-gray-800 font-sans min-h-screen pb-12 print:bg-white print:p-0">
      
      {/* HEADER & ACTIONS (Non-Printable) */}
      <div className="print:hidden mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black text-primary flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <CreditCard size={22} />
              </div>
              <span>Pengeluaran Sekolah</span>
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Catat dan pantau seluruh pos pengeluaran kas sekolah (Operasional, Sarana, Kegiatan, dll).
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
              onClick={fetchData} 
              className="bg-white border border-gray-200 text-gray-700 px-3.5 py-2 rounded-xl font-bold shadow-xs hover:bg-gray-50 transition flex items-center gap-2 text-xs cursor-pointer"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {tableNotExists && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-amber-600" />
            <div className="text-xs">
              <span className="font-bold block text-sm">Tabel Pengeluaran Belum Diinisialisasi</span>
              Tabel <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">tb_pengeluaran</code> belum dibuat di Supabase.
              Silakan jalankan script file <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">setup_tb_pengeluaran.sql</code> di Supabase SQL Editor untuk mengaktifkan pencatatan.
            </div>
          </div>
        )}

        {/* Ringkasan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Pengeluaran</span>
              <span className="text-2xl font-black text-rose-600 mt-1 block">
                Rp {totalNominal.toLocaleString('id-ID')}
              </span>
              <span className="text-[11px] text-gray-400 font-medium">Periode filter aktif</span>
            </div>
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              <ArrowUpRight size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Banyak Transaksi</span>
              <span className="text-2xl font-black text-primary mt-1 block">
                {filteredData.length} <span className="text-sm font-semibold text-gray-400">data</span>
              </span>
              <span className="text-[11px] text-gray-400 font-medium">Tercatat di sistem</span>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-primary rounded-2xl flex items-center justify-center">
              <Calendar size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Rata-Rata / Transaksi</span>
              <span className="text-2xl font-black text-slate-700 mt-1 block">
                Rp {avgNominal.toLocaleString('id-ID')}
              </span>
              <span className="text-[11px] text-gray-400 font-medium">Per pengeluaran</span>
            </div>
            <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center">
              <Tag size={22} />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-200/80 mb-6 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2.5 items-center">
            <span className="text-xs font-bold text-gray-600">Filter Periode:</span>
            
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

          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="Semua">Semua Kategori</option>
              {kategoriOptions.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid Input & Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form Input Container */}
          <div className="lg:col-span-1 bg-white rounded-2xl shadow-xs border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2 text-sm">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Plus size={16} />
              </div>
              <span>Input Pengeluaran Baru</span>
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal Pengeluaran *</label>
                <input 
                  type="date" 
                  value={inputTanggal}
                  onChange={(e) => setInputTanggal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl focus:ring-1 focus:ring-primary p-2.5 outline-none font-semibold" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Kategori Pos *</label>
                <select 
                  value={inputKategori}
                  onChange={(e) => setInputKategori(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl focus:ring-1 focus:ring-primary p-2.5 outline-none font-semibold mb-2"
                >
                  {kategoriOptions.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                
                {inputKategori === 'Lainnya' && (
                  <input 
                    type="text" 
                    value={inputKategoriLainnya}
                    onChange={(e) => setInputKategoriLainnya(e.target.value)}
                    placeholder="Sebutkan kategori pengeluaran..."
                    className="w-full border border-gray-200 text-gray-900 text-xs rounded-xl focus:ring-1 focus:ring-primary p-2.5 outline-none font-semibold"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Penerima / Vendor / Toko</label>
                <input 
                  type="text" 
                  value={inputPenerima}
                  onChange={(e) => setInputPenerima(e.target.value)}
                  placeholder="Contoh: Toko Berkah, Pak Ahmad, PLN..."
                  className="w-full bg-white border border-gray-200 text-gray-900 text-xs rounded-xl focus:ring-1 focus:ring-primary p-2.5 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Nominal (Rp) *</label>
                <input 
                  type="text" 
                  value={inputNominal}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    if (val) {
                      setInputNominal(parseInt(val, 10).toLocaleString('id-ID'));
                    } else {
                      setInputNominal('');
                    }
                  }}
                  placeholder="Contoh: 1.500.000"
                  className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-1 focus:ring-primary p-2.5 outline-none font-black text-right text-rose-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Keterangan / Uraian</label>
                <textarea 
                  value={inputKeterangan}
                  onChange={(e) => setInputKeterangan(e.target.value)}
                  placeholder="Rincian barang/jasa atau keperluan pengeluaran..."
                  className="w-full border border-gray-200 text-gray-900 text-xs rounded-xl focus:ring-1 focus:ring-primary p-2.5 outline-none h-20 resize-none font-medium"
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Plus size={16} />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}</span>
              </button>
            </form>
          </div>

          {/* Table Container */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xs border border-gray-200 flex flex-col overflow-hidden">
            {/* Table Header with Search */}
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Daftar Transaksi Pengeluaran</h3>
                <p className="text-[11px] text-gray-400 font-medium">Menampilkan {filteredData.length} data sesuai filter.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari keterangan / penerima..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-24">Tanggal</th>
                    <th className="py-2.5 px-3 w-32">Kategori</th>
                    <th className="py-2.5 px-3">Penerima & Uraian</th>
                    <th className="py-2.5 px-3 text-right w-28">Nominal</th>
                    <th className="py-2.5 px-3 text-center w-12">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <span>Memuat data pengeluaran...</span>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        Belum ada data pengeluaran pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-gray-50/80 transition">
                        <td className="py-2.5 px-3 text-center font-bold text-gray-400">{index + 1}</td>
                        <td className="py-2.5 px-3 text-gray-600 font-medium whitespace-nowrap">
                          {new Date(item.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getKategoriBadgeColor(item.kategori)}`}>
                            {item.kategori}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.penerima && (
                            <span className="font-bold text-gray-800 block text-xs">
                              {item.penerima}
                            </span>
                          )}
                          <span className="text-gray-600 font-medium text-[11px]">
                            {item.keterangan || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-600 whitespace-nowrap">
                          Rp {(item.nominal || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs">
              <span className="font-bold text-gray-600">Total Periode:</span>
              <span className="font-black text-rose-600 text-sm">
                Rp {totalNominal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PRINT VIEW (Only shown when printed) */}
      <div className="hidden print:block text-black p-4">
        {/* Kop Surat */}
        <div className="border-b-2 border-black pb-3 mb-4 text-center">
          <h1 className="text-xl font-bold uppercase tracking-wider">{dataLembaga?.nama_lembaga || 'SMP IT HASAN MUNADI'}</h1>
          <p className="text-xs">{dataLembaga?.alamat || 'Alamat Sekolah'} • Telp: {dataLembaga?.telepon || '-'}</p>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-base font-bold uppercase underline">LAPORAN PENGELUARAN KAS SEKOLAH</h2>
          <p className="text-xs text-gray-700 mt-1">
            Tahun Pelajaran: {tahunPelajaranFilter} • Semester: {semesterFilter}
          </p>
          <p className="text-xs text-gray-700">
            Periode: {new Date(startDate).toLocaleDateString('id-ID')} s/d {new Date(endDate).toLocaleDateString('id-ID')}
          </p>
        </div>

        <table className="w-full text-xs border border-collapse border-black mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-1.5 text-center w-8">No</th>
              <th className="border border-black p-1.5 text-left w-20">Tanggal</th>
              <th className="border border-black p-1.5 text-left w-32">Kategori</th>
              <th className="border border-black p-1.5 text-left">Penerima / Keperluan</th>
              <th className="border border-black p-1.5 text-right w-28">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                <td className="border border-black p-1.5 whitespace-nowrap">
                  {new Date(item.tanggal).toLocaleDateString('id-ID')}
                </td>
                <td className="border border-black p-1.5">{item.kategori}</td>
                <td className="border border-black p-1.5">
                  {item.penerima ? `${item.penerima} - ` : ''}{item.keterangan || '-'}
                </td>
                <td className="border border-black p-1.5 text-right font-semibold">
                  Rp {(item.nominal || 0).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td colSpan={4} className="border border-black p-1.5 text-right uppercase">Total Pengeluaran:</td>
              <td className="border border-black p-1.5 text-right">Rp {totalNominal.toLocaleString('id-ID')}</td>
            </tr>
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
