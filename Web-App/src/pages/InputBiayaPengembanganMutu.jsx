import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';

const defaultItems = [
  { id: 1, uraian: 'PPDB', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 2, uraian: 'Daftar Ulang', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 3, uraian: 'SDP', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 4, uraian: 'MPLS', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 5, uraian: 'Attribut', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 6, uraian: 'Meeting Class', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 7, uraian: 'Jas', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 8, uraian: 'Kaos', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 9, uraian: 'Semester', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 10, uraian: 'Kitab', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 11, uraian: 'PHBI', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 20, uraian: 'PHBN', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 12, uraian: 'Sampul Raport', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 13, uraian: 'OSIS', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 21, uraian: 'Pramuka', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 14, uraian: 'UKS', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 15, uraian: 'Akhirussanah', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 16, uraian: 'Ijazah', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 17, uraian: 'Ujian Kelulusan', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 18, uraian: 'Zarkasi', tingkat7: 0, tingkat8: 0, tingkat9: 0 },
  { id: 19, uraian: 'TKA', tingkat7: 0, tingkat8: 0, tingkat9: 0 }
];

export default function InputBiayaPengembanganMutu() {
  const [tahunPelajaran, setTahunPelajaran] = useState('2025/2026');
  const [semester, setSemester] = useState('Tahunan');
  const [tipeSiswa, setTipeSiswa] = useState('Siswa Baru');
  const [anggaran, setAnggaran] = useState(defaultItems);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [recordId, setRecordId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [tahunPelajaran, semester, tipeSiswa]);

  const fetchData = async () => {
    if (!tahunPelajaran || !semester || !tipeSiswa) return;
    setIsLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from('biaya_pengembangan_mutu')
        .select('*')
        .eq('tahun_pelajaran', tahunPelajaran)
        .eq('semester', semester)
        .eq('tipe_siswa', tipeSiswa)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRecordId(data.id);
        if (data.data_anggaran && data.data_anggaran.length > 0) {
          setAnggaran(data.data_anggaran);
        } else {
          setAnggaran(defaultItems);
        }
      } else {
        setRecordId(null);
        
        // Ambil konfigurasi terakhir yang pernah disimpan sebagai template
        const { data: latestData } = await supabase
          .from('biaya_pengembangan_mutu')
          .select('data_anggaran')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestData && latestData.data_anggaran && latestData.data_anggaran.length > 0) {
          // Reset angkanya menjadi 0 agar siap diisi, tapi daftar itemnya mengikuti yang terakhir
          const templateItems = latestData.data_anggaran.map(item => ({
            ...item,
            tingkat7: 0,
            tingkat8: 0,
            tingkat9: 0
          }));
          setAnggaran(templateItems);
        } else {
          setAnggaran(defaultItems);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Gagal memuat data' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (id, field, value) => {
    // Remove non-numeric characters for valid parsing
    const numericValue = value.replace(/[^0-9]/g, '');
    const num = numericValue ? parseInt(numericValue, 10) : 0;
    
    setAnggaran(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: num } : item
    ));
  };

  const handleUraianChange = (id, value) => {
    setAnggaran(prev => prev.map(item => 
      item.id === id ? { ...item, uraian: value } : item
    ));
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      uraian: '',
      tingkat7: 0,
      tingkat8: 0,
      tingkat9: 0
    };
    setAnggaran([...anggaran, newItem]);
  };

  const handleDeleteItem = (id) => {
    setAnggaran(prev => prev.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const payload = {
        tahun_pelajaran: tahunPelajaran,
        semester: semester,
        tipe_siswa: tipeSiswa,
        data_anggaran: anggaran
      };

      if (recordId) {
        // Update
        const { error } = await supabase
          .from('biaya_pengembangan_mutu')
          .update(payload)
          .eq('id', recordId);
        if (error) throw error;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('biaya_pengembangan_mutu')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        if (data) setRecordId(data.id);
      }

      setMessage({ type: 'success', text: 'Data berhasil disimpan!' });
      
      // Auto clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving data:', error);
      setMessage({ type: 'error', text: 'Gagal menyimpan data: ' + error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Utility to format number as Rupiah
  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  };

  const totalTingkat7 = anggaran.reduce((sum, item) => sum + (item.tingkat7 || item.kelas7 || 0), 0);
  const totalTingkat8 = anggaran.reduce((sum, item) => sum + (item.tingkat8 || item.kelas8 || 0), 0);
  const totalTingkat9 = anggaran.reduce((sum, item) => sum + (item.tingkat9 || item.kelas9 || 0), 0);
  const grandTotal = totalTingkat7 + totalTingkat8 + totalTingkat9;

  return (
    <div className="flex flex-col h-full bg-bgSoft text-gray-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Input Biaya Pengembangan Mutu</h1>
          <p className="text-sm text-gray-500 mt-1">Konfigurasi biaya pengembangan mutu siswa berdasarkan kriteria</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="flex items-center justify-center w-full md:w-auto gap-2 bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-sm font-medium transition-all focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          <span>Simpan Data</span>
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div className="font-medium">{message.text}</div>
        </div>
      )}

      {/* Filters Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 md:gap-6">
          <div className="w-full">
            <label className="block text-sm font-bold text-gray-700 mb-2">Tahun Pelajaran</label>
            <select 
              value={tahunPelajaran} 
              onChange={(e) => setTahunPelajaran(e.target.value)} 
              className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 shadow-sm outline-none"
            >
              <option value="2023/2024">2023/2024</option>
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>
          </div>
          <div className="w-full">
            <label className="block text-sm font-semibold text-gray-700 mb-2 truncate">Tipe Siswa</label>
            <select
              value={tipeSiswa}
              onChange={(e) => setTipeSiswa(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
            >
              <option value="Siswa Baru">Siswa Baru</option>
              <option value="Pindahan Kelas 8">Pindahan Kelas 8</option>
              <option value="Pindahan Kelas 9">Pindahan Kelas 9</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center">
            <RefreshCw size={32} className="animate-spin text-primary" />
          </div>
        )}
        
        <div className="overflow-x-auto custom-scrollbar flex-1 w-full">
          <table className="w-full min-w-max text-sm text-left border-collapse">
            <thead className="bg-gray-50 text-gray-700 font-semibold sticky top-0 z-10">
              <tr>
                <th rowSpan={2} className="border-b border-r border-gray-200 px-4 py-3 text-center w-12 bg-gray-50">No.</th>
                <th rowSpan={2} className="border-b border-r border-gray-200 px-4 py-3 w-64 bg-gray-50 uppercase tracking-wide">URAIAN</th>
                <th colSpan={3} className="border-b border-r border-gray-200 px-4 py-3 text-center bg-blue-50/50 text-blue-600 uppercase tracking-wide">ANGGARAN</th>
                <th rowSpan={2} className="border-b border-gray-200 px-4 py-3 text-center w-16 bg-gray-50 uppercase tracking-wide">AKSI</th>
              </tr>
              <tr>
                <th className="border-b border-r border-gray-200 px-4 py-2.5 text-center bg-gray-50">TINGKAT 7</th>
                <th className="border-b border-r border-gray-200 px-4 py-2.5 text-center bg-gray-50">TINGKAT 8</th>
                <th className="border-b border-r border-gray-200 px-4 py-2.5 text-center bg-gray-50">TINGKAT 9</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {anggaran.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5 border-r border-gray-100 text-center text-gray-500 font-medium">
                    {index + 1}
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-100 font-medium text-gray-800">
                    <input
                      type="text"
                      value={item.uraian}
                      onChange={(e) => handleUraianChange(item.id, e.target.value)}
                      placeholder="Nama Uraian"
                      className="w-full px-3 py-1.5 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded transition-all outline-none bg-transparent hover:bg-white focus:bg-white"
                    />
                  </td>
                  {['tingkat7', 'tingkat8', 'tingkat9'].map((tingkatField) => (
                    <td key={tingkatField} className={`p-1.5 border-r border-gray-100`}>
                      <div className="relative flex items-center group">
                        <span className="absolute left-3 text-gray-400 font-medium pointer-events-none group-focus-within:text-blue-600 transition-colors">Rp</span>
                        <input
                          type="text"
                          value={item[tingkatField] === 0 ? '' : (item[tingkatField] || item[tingkatField.replace('tingkat','kelas')] || 0).toLocaleString('id-ID')}
                          onChange={(e) => handleInputChange(item.id, tingkatField, e.target.value)}
                          placeholder="0"
                          className="w-full text-right pl-9 pr-3 py-1.5 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded transition-all outline-none bg-transparent hover:bg-white focus:bg-white"
                        />
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Hapus Item"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-200">
              <tr>
                <td colSpan={2} className="px-4 py-3.5 border-r border-gray-200 text-center text-gray-700 tracking-wide">
                  JUMLAH
                </td>
                <td className="px-4 py-3.5 border-r border-gray-200 text-right text-blue-700 whitespace-nowrap">
                  {formatRupiah(totalTingkat7)}
                </td>
                <td className="px-4 py-3.5 border-r border-gray-200 text-right text-blue-700 whitespace-nowrap">
                  {formatRupiah(totalTingkat8)}
                </td>
                <td className="px-4 py-3.5 border-r border-gray-200 text-right text-blue-700 whitespace-nowrap">
                  {formatRupiah(totalTingkat9)}
                </td>
                <td className="bg-gray-100"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-4 bg-white border-t border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-sm w-full">
          <button
            onClick={handleAddItem}
            className="flex items-center justify-center w-full md:w-auto gap-2 text-primary hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 border md:border-none border-blue-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
            Tambah Item Uraian
          </button>
          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between sm:justify-end w-full md:w-auto gap-2">
            <span className="font-semibold text-gray-600">Total Keseluruhan:</span>
            <span className="text-lg sm:text-xl font-bold text-green-700 bg-green-50 px-3 py-1.5 sm:px-4 rounded-lg border border-green-200 whitespace-nowrap">
              {formatRupiah(grandTotal)}
            </span>
          </div>
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
