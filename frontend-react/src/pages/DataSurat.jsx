import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Mail, RefreshCw, Search, Filter, ArrowDownUp } from 'lucide-react';
import Swal from 'sweetalert2';

export default function DataSurat() {
  const [dataSurat, setDataSurat] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters and Sorts
  const [filterJenis, setFilterJenis] = useState('');
  const [filterTahun, setFilterTahun] = useState('');
  const [sortOrder, setSortOrder] = useState('terbaru');

  useEffect(() => {
    fetchTableData();
  }, []);

  const fetchTableData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_surat')
        .select('*');

      if (error) throw error;
      
      const { data: dataSiswa } = await supabase.from('data_siswa').select('nipd, nama, id');
      const mapSiswa = {};
      if (dataSiswa) {
        dataSiswa.forEach(s => {
          if (s.nipd) mapSiswa[s.nipd] = s.nama;
          mapSiswa[s.id] = s.nama;
        });
      }
      
      const mappedData = (data || []).map(item => ({
        ...item,
        nama_siswa: mapSiswa[item.nipd] || item.nipd || '-'
      }));

      setDataSurat(mappedData);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat data surat', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique years
  const availableYears = [...new Set(dataSurat.map(item => item.tahun))].sort().reverse();

  // Filter and Sort Data
  let processedData = dataSurat.filter(item => {
    const term = searchTerm.toLowerCase();
    const noSurat = item.meta_data?.no_surat?.toLowerCase() || '';
    const nama = item.nama_siswa?.toLowerCase() || '';
    const matchSearch = noSurat.includes(term) || nama.includes(term);
    
    const matchJenis = filterJenis ? item.jenis_surat === filterJenis : true;
    const matchTahun = filterTahun ? item.tahun.toString() === filterTahun : true;

    return matchSearch && matchJenis && matchTahun;
  });

  processedData = processedData.sort((a, b) => {
    if (sortOrder === 'terbaru') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else if (sortOrder === 'terlama') {
      return new Date(a.created_at) - new Date(b.created_at);
    } else if (sortOrder === 'nourut_asc') {
      return a.nomor_urut - b.nomor_urut;
    } else if (sortOrder === 'nourut_desc') {
      return b.nomor_urut - a.nomor_urut;
    }
    return 0;
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Mail className="text-primary" /> Referensi Data Surat
          </h2>
          <p className="text-gray-500 text-sm mt-1">Daftar semua surat yang pernah dibuat sebagai acuan nomor surat.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTableData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col lg:flex-row gap-4 justify-between items-center">
        <div className="flex-1 w-full lg:w-1/3 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nomor surat atau nama siswa..." 
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:bg-white outline-none text-sm font-medium transition text-primary"
          />
        </div>
        
        <div className="flex w-full lg:w-auto gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[140px]">
            <Filter size={16} className="text-gray-400" />
            <select value={filterJenis} onChange={e => setFilterJenis(e.target.value)} className="w-full bg-transparent outline-none text-sm font-medium text-gray-600">
              <option value="">Semua Jenis</option>
              <option value="PENERIMAAN">Penerimaan</option>
              <option value="PINDAH">Pindah</option>
              <option value="KELULUSAN">Kelulusan</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[120px]">
            <Filter size={16} className="text-gray-400" />
            <select value={filterTahun} onChange={e => setFilterTahun(e.target.value)} className="w-full bg-transparent outline-none text-sm font-medium text-gray-600">
              <option value="">Semua Tahun</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[160px]">
            <ArrowDownUp size={16} className="text-gray-400" />
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="w-full bg-transparent outline-none text-sm font-medium text-gray-600">
              <option value="terbaru">Tanggal (Terbaru)</option>
              <option value="terlama">Tanggal (Terlama)</option>
              <option value="nourut_desc">No. Urut (Tertinggi)</option>
              <option value="nourut_asc">No. Urut (Terendah)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Nomor Surat</th>
                <th className="px-6 py-4">Tipe Surat</th>
                <th className="px-6 py-4 text-center">Tahun</th>
                <th className="px-6 py-4 text-center">No. Urut</th>
                <th className="px-6 py-4">Ditujukan / Nama Siswa</th>
                <th className="px-6 py-4">Tanggal Dicetak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-400">Memuat data...</td></tr>
              ) : processedData.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-400">Data surat tidak ditemukan.</td></tr>
              ) : (
                processedData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-800">{item.meta_data?.no_surat || '-'}</td>
                    <td className="px-6 py-4 font-bold text-primary">{item.jenis_surat}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium text-center">{item.tahun}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium text-center">{item.nomor_urut}</td>
                    <td className="px-6 py-4 text-gray-600">{item.nama_siswa}</td>
                    <td className="px-6 py-4 text-gray-600">{item.meta_data?.tgl_surat || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
