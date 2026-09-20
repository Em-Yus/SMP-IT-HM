import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Receipt, Search, RefreshCw, Printer, Calendar, Trash2, Plus, Save } from 'lucide-react';
import Swal from 'sweetalert2';

export default function InputPemasukanLainnya() {
  // Main Data
  const [dataPemasukan, setDataPemasukan] = useState([]);
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
  const [tahunPelajaranFilter, setTahunPelajaranFilter] = useState('2025/2026');
  const [semesterFilter, setSemesterFilter] = useState('Tahunan');

  // Date range defaults to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  // Form Input
  const [inputTanggal, setInputTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [inputSumberDana, setInputSumberDana] = useState('BOS Reguler');
  const [inputSumberLainnya, setInputSumberLainnya] = useState('');
  const [inputKeterangan, setInputKeterangan] = useState('');
  const [inputNominal, setInputNominal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tb_pemasukan_lainnya')
        .select('*')
        .eq('tahun_pelajaran', tahunPelajaranFilter)
        .eq('semester', semesterFilter)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setDataPemasukan(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat data pemasukan', 'error');
      setDataPemasukan([]);
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

    const nominalValue = parseInt(inputNominal.replace(/[^0-9]/g, ''));
    if (!nominalValue || nominalValue <= 0) {
      Swal.fire('Gagal', 'Nominal tidak valid', 'error');
      return;
    }

    const finalSumberDana = inputSumberDana === 'Lainnya' ? inputSumberLainnya.trim() : inputSumberDana;
    
    if (!finalSumberDana) {
      Swal.fire('Gagal', 'Sumber dana harus diisi', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('tb_pemasukan_lainnya')
        .insert([{
          tanggal: inputTanggal,
          sumber_dana: finalSumberDana,
          keterangan: inputKeterangan.trim(),
          nominal: nominalValue,
          tahun_pelajaran: tahunPelajaranFilter,
          semester: semesterFilter
        }]);

      if (error) throw error;
      
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Pemasukan berhasil dicatat',
        timer: 1500,
        showConfirmButton: false
      });
      
      // Reset form
      setInputKeterangan('');
      setInputNominal('');
      if (inputSumberDana === 'Lainnya') {
        setInputSumberLainnya('');
      }
      
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal menyimpan data', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: 'Hapus Pemasukan?',
      text: "Data yang dihapus tidak dapat dikembalikan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (confirm.isConfirmed) {
      try {
        const { error } = await supabase.from('tb_pemasukan_lainnya').delete().eq('id', id);
        if (error) throw error;
        fetchData();
        Swal.fire('Terhapus!', 'Data pemasukan telah dihapus.', 'success');
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Gagal menghapus data', 'error');
      }
    }
  };

  const totalNominal = dataPemasukan.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return (
    <div className="flex flex-col h-full bg-bgSoft text-gray-800 font-sans min-h-screen pb-10 print:bg-white print:p-0">
      
      {/* HEADER & ACTIONS (Non-Printable) */}
      <div className="print:hidden mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Receipt className="text-primary" /> Pemasukan Dana Lainnya
            </h2>
            <p className="text-gray-500 text-sm mt-1">Kelola pemasukan sekolah di luar tagihan siswa (BOS, Donatur, dll).</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form Input Container */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-primary" /> Input Pemasukan Baru
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal Masuk</label>
                <input 
                  type="date" 
                  value={inputTanggal}
                  onChange={(e) => setInputTanggal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none font-medium" 
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Sumber Dana</label>
                <select 
                  value={inputSumberDana}
                  onChange={(e) => setInputSumberDana(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none font-medium mb-2"
                >
                  <option value="BOS Reguler">BOS Reguler</option>
                  <option value="BOSDA">BOSDA</option>
                  <option value="Donatur">Donatur</option>
                  <option value="Koperasi Sekolah">Koperasi Sekolah</option>
                  <option value="Bantuan Pemerintah">Bantuan Pemerintah</option>
                  <option value="Lainnya">Lainnya (Ketik Manual)...</option>
                </select>
                
                {inputSumberDana === 'Lainnya' && (
                  <input 
                    type="text" 
                    value={inputSumberLainnya}
                    onChange={(e) => setInputSumberLainnya(e.target.value)}
                    placeholder="Sebutkan sumber dana..."
                    className="w-full border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none"
                    required
                  />
                )}
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Nominal (Rp)</label>
                <input 
                  type="text" 
                  value={inputNominal}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    if (val) {
                      setInputNominal(parseInt(val).toLocaleString('id-ID'));
                    } else {
                      setInputNominal('');
                    }
                  }}
                  placeholder="Contoh: 15.000.000"
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none font-bold text-right"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Keterangan (Opsional)</label>
                <textarea 
                  value={inputKeterangan}
                  onChange={(e) => setInputKeterangan(e.target.value)}
                  placeholder="Catatan atau rincian..."
                  className="w-full border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none h-20 resize-none"
                ></textarea>
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-2.5 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                Simpan Data
              </button>
            </form>
          </div>

          {/* Filters Container */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
            <div>
               <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                 <Search size={18} className="text-gray-400" /> Filter Laporan
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Tahun Pelajaran</label>
                    <select 
                      value={tahunPelajaranFilter} 
                      onChange={(e) => setTahunPelajaranFilter(e.target.value)} 
                      className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none font-medium"
                    >
                      <option value="2023/2024">2023/2024</option>
                      <option value="2024/2025">2024/2025</option>
                      <option value="2025/2026">2025/2026</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Dari Tanggal</label>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none font-medium" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Sampai Tanggal</label>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none font-medium" 
                    />
                  </div>
               </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
               <div className="text-sm text-blue-700 font-semibold mb-1">Catatan:</div>
               <p className="text-xs text-blue-600">Pastikan Tahun Pelajaran di filter sesuai dengan tujuan input dana agar laporan menjadi akurat.</p>
            </div>
          </div>
          
        </div>
      </div>

      {/* PRINT HEADER (Hidden by default, shown on print) */}
      <div className="hidden print:block mb-8 mt-4">
        <div className="flex items-center gap-6 border-b-2 border-gray-800 pb-4 mb-2">
          {dataLembaga?.logo_url ? (
            <img src={dataLembaga.logo_url} alt="Logo Sekolah" className="w-20 h-20 object-contain" />
          ) : (
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400">Logo</div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-wider text-gray-900 uppercase">LAPORAN PEMASUKAN DANA LAINNYA</h1>
            <h2 className="text-2xl font-black text-gray-900 mt-1 uppercase">{dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}</h2>
            <p className="text-sm text-gray-500">{dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}</p>
          </div>
        </div>
        <div className="flex justify-between items-start text-sm">
          <div>
            <p><strong>Tahun Pelajaran:</strong> {tahunPelajaranFilter}</p>
          </div>
          <div className="text-right">
            <p><strong>Periode:</strong> {new Date(startDate).toLocaleDateString('id-ID')} - {new Date(endDate).toLocaleDateString('id-ID')}</p>
          </div>
        </div>
      </div>

      {/* TABLE REKAP */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none print:mt-4">
        
        {isLoading && (
          <div className="h-40 flex items-center justify-center print:hidden">
            <RefreshCw size={32} className="animate-spin text-primary" />
          </div>
        )}

        {!isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold border-b border-gray-300 print:bg-gray-100 print:text-gray-800 print:border-gray-800">
                <tr>
                  <th className="px-5 py-4 text-center w-16">No</th>
                  <th className="px-5 py-4">Tanggal Masuk</th>
                  <th className="px-5 py-4">Sumber Dana</th>
                  <th className="px-5 py-4">Keterangan</th>
                  <th className="px-5 py-4 text-right">Nominal</th>
                  <th className="px-5 py-4 text-center print:hidden w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm print:divide-gray-400">
                {dataPemasukan.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-gray-400 font-medium">
                      Belum ada data pemasukan lainnya.
                    </td>
                  </tr>
                ) : (
                  dataPemasukan.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition print:break-inside-avoid">
                      <td className="px-5 py-3 text-center text-gray-500 font-medium">{idx + 1}</td>
                      <td className="px-5 py-3 font-medium text-gray-700">
                        {new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3 font-bold text-gray-800 uppercase">{item.sumber_dana}</td>
                      <td className="px-5 py-3 text-gray-600 text-xs whitespace-normal max-w-xs">{item.keterangan || '-'}</td>
                      <td className="px-5 py-3 text-right font-bold text-green-700 print:text-gray-900">
                        Rp {item.nominal?.toLocaleString('id-ID')}
                      </td>
                      <td className="px-5 py-3 text-center print:hidden">
                         <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition" title="Hapus">
                            <Trash2 size={16} />
                         </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300 print:border-gray-800">
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-right text-gray-700 uppercase tracking-wider">
                    Total Pemasukan Keseluruhan
                  </td>
                  <td className="px-5 py-4 text-right text-lg text-primary print:text-gray-900">
                    Rp {totalNominal.toLocaleString('id-ID')}
                  </td>
                  <td className="print:hidden"></td>
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
          <p className="font-bold border-b border-gray-800 pb-1 w-48 inline-block">Bendahara Sekolah</p>
          <p className="text-xs text-gray-500 mt-1">SIAKAD SMP IT HM</p>
        </div>
      </div>

    </div>
  );
}
