import React, { useState, useEffect } from 'react';
import { Receipt, Search, RefreshCw, Printer, Calendar, Filter } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export default function RekapBayar() {
  const [dataPembayaran, setDataPembayaran] = useState([]);
  const [dataLembaga, setDataLembaga] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLembaga = async () => {
      const { data } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (data) setDataLembaga(data);
    };
    fetchLembaga();
  }, []);

  // Filters
  const [tahunPelajaran, setTahunPelajaran] = useState('2025/2026');
  const [semester, setSemester] = useState('Tahunan');
  
  // Date range defaults to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('tb_pemasukan_siswa')
        .select(`
          id,
          tanggal,
          nominal,
          tahun_pelajaran,
          semester,
          data_siswa (
            nipd,
            nama,
            kelas
          )
        `)
        .eq('tahun_pelajaran', tahunPelajaran)
        .eq('semester', semester)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setDataPembayaran(data || []);
    } catch (err) {
      console.error(err);
      setDataPembayaran([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tahunPelajaran, semester, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const totalNominal = dataPembayaran.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return (
    <div className="flex flex-col h-full bg-bgSoft text-gray-800 font-sans min-h-screen pb-10 print:bg-white print:p-0">
      
      {/* HEADER & FILTERS (Non-Printable) */}
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Receipt className="text-primary" /> Rekapitulasi Pembayaran
            </h2>
            <p className="text-gray-500 text-sm mt-1">Laporan histori pemasukan dana/tagihan siswa secara keseluruhan.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint} 
              className="bg-gray-800 border border-gray-700 text-white px-5 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-900 transition flex items-center gap-2 text-sm"
            >
              <Printer size={16} /> Cetak Laporan
            </button>
            <button 
              onClick={fetchData} 
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-end">
          <div className="flex-1 min-w-[200px] w-full">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Tahun Pelajaran</label>
            <select 
              value={tahunPelajaran} 
              onChange={(e) => setTahunPelajaran(e.target.value)} 
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none font-medium"
            >
              <option value="2023/2024">2023/2024</option>
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px] w-full">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Dari Tanggal</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Calendar size={16} className="text-gray-400" />
              </div>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block pl-10 p-2.5 outline-none font-medium" 
              />
            </div>
          </div>

          <div className="flex-1 min-w-[200px] w-full">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Sampai Tanggal</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Calendar size={16} className="text-gray-400" />
              </div>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block pl-10 p-2.5 outline-none font-medium" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* PRINT HEADER (Hidden by default, shown on print) */}
      <div className="hidden print:block mb-8">
        <div className="flex items-center gap-6 border-b-2 border-gray-800 pb-4 mb-2">
          {dataLembaga?.logo_url ? (
            <img src={dataLembaga.logo_url} alt="Logo Sekolah" className="w-20 h-20 object-contain" />
          ) : (
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400">Logo</div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-wider text-gray-900 uppercase">REKAPITULASI PEMASUKAN DANA</h1>
            <h2 className="text-2xl font-black text-gray-900 mt-1 uppercase">{dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}</h2>
            <p className="text-sm text-gray-500">{dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}</p>
          </div>
        </div>
        <div className="flex justify-between items-start text-sm">
          <div>
            <p><strong>Tahun Pelajaran:</strong> {tahunPelajaran}</p>
          </div>
          <div className="text-right">
            <p><strong>Periode:</strong> {new Date(startDate).toLocaleDateString('id-ID')} - {new Date(endDate).toLocaleDateString('id-ID')}</p>
          </div>
        </div>
      </div>

      {/* TABLE REKAP */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        
        {isLoading && (
          <div className="h-64 flex items-center justify-center print:hidden">
            <RefreshCw size={32} className="animate-spin text-primary" />
          </div>
        )}

        {!isLoading && (
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
              <thead className="bg-blue-50 text-blue-800 uppercase text-xs font-bold border-b-2 border-blue-200 print:bg-gray-100 print:text-gray-800 print:border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-center w-16">No</th>
                  <th className="px-6 py-4">Tanggal Masuk</th>
                  <th className="px-6 py-4 text-center">NIPD</th>
                  <th className="px-6 py-4">Nama Siswa</th>
                  <th className="px-6 py-4 text-center">Kelas</th>
                  <th className="px-6 py-4 text-right">Nominal Setoran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm print:divide-gray-400">
                {dataPembayaran.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-gray-400 font-medium">
                      Tidak ada pemasukan untuk periode / filter tersebut.
                    </td>
                  </tr>
                ) : (
                  dataPembayaran.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition print:break-inside-avoid">
                      <td className="px-6 py-3.5 text-center text-gray-500 font-medium">{idx + 1}</td>
                      <td className="px-6 py-3.5 font-medium text-gray-700">
                        {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-3.5 text-center text-gray-500">{item.data_siswa?.nipd || '-'}</td>
                      <td className="px-6 py-3.5 font-bold text-gray-800 uppercase">{item.data_siswa?.nama || 'Siswa Dihapus'}</td>
                      <td className="px-6 py-3.5 text-center font-semibold text-primary print:text-gray-800">{item.data_siswa?.kelas || '-'}</td>
                      <td className="px-6 py-3.5 text-right font-bold text-green-700 print:text-gray-900">
                        Rp {item.nominal?.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300 print:border-gray-800">
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-right text-gray-700 uppercase tracking-wider">
                    Total Pemasukan Keseluruhan
                  </td>
                  <td className="px-6 py-4 text-right text-lg text-primary print:text-gray-900">
                    Rp {totalNominal.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* PRINT FOOTER (Signature) */}
      <div className="hidden print:flex justify-end mt-12">
        <div className="text-center">
          <p className="mb-16 text-sm">Subang, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="font-bold border-b border-gray-800 pb-1 w-48 inline-block">Bendahara / Admin</p>
          <p className="text-xs text-gray-500 mt-1">Dicetak dari SIAKAD SMP IT HM</p>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

    </div>
  );
}
