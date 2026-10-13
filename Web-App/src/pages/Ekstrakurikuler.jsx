import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Tent, Plus, RefreshCw, Trash2, Edit, Users, Filter, Printer, Search, Award, Calendar, BookOpen } from 'lucide-react';
import Swal from 'sweetalert2';
import EkskulFormModal from '../components/EkskulFormModal';
import AnggotaEkskulModal from '../components/AnggotaEkskulModal';
import CetakAnggotaEkskulModal from '../components/CetakAnggotaEkskulModal';

export default function Ekstrakurikuler() {
  const [dataEkskul, setDataEkskul] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAnggotaOpen, setIsAnggotaOpen] = useState(false);
  const [isCetakOpen, setIsCetakOpen] = useState(false);
  const [selectedEkskul, setSelectedEkskul] = useState(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const initialTA = currentMonth >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  const initialSem = currentMonth >= 7 ? 'Ganjil' : 'Genap';

  const [filterTA, setFilterTA] = useState(initialTA);
  const [filterSemester, setFilterSemester] = useState(initialSem);
  
  // For dropdown options
  const [availableTA, setAvailableTA] = useState([initialTA]);

  const fetchEkskul = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_ekskul')
        .select('*')
        .eq('tahun_ajaran', filterTA)
        .eq('semester', filterSemester)
        .order('nama_ekskul', { ascending: true });

      if (error) throw error;
      
      // Hitung jumlah anggota untuk setiap ekskul
      const ekskulList = data || [];
      if (ekskulList.length > 0) {
        const ekskulIds = ekskulList.map(e => e.id);
        const { data: anggota, error: errAnggota } = await supabase
          .from('anggota_ekskul')
          .select('ekskul_id')
          .in('ekskul_id', ekskulIds);
        
        if (!errAnggota && anggota) {
          const counts = {};
          anggota.forEach(a => {
            counts[a.ekskul_id] = (counts[a.ekskul_id] || 0) + 1;
          });
          
          ekskulList.forEach(e => {
            e.jumlah_anggota = counts[e.id] || 0;
          });
        }
      }
      
      setDataEkskul(ekskulList);
      
      // Fetch available Tahun Ajaran to populate the dropdown
      const { data: taData } = await supabase.from('data_ekskul').select('tahun_ajaran');
      if (taData) {
        const uniqueTA = [...new Set(taData.map(item => item.tahun_ajaran).filter(Boolean))].sort().reverse();
        if (uniqueTA.length > 0) {
          if (!uniqueTA.includes(initialTA)) uniqueTA.unshift(initialTA);
          setAvailableTA(uniqueTA);
        }
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data ekstrakurikuler' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEkskul();
  }, [filterTA, filterSemester]);

  const handleAdd = () => {
    setSelectedEkskul(null);
    setIsFormOpen(true);
  };

  const handleEdit = (ekskul) => {
    setSelectedEkskul(ekskul);
    setIsFormOpen(true);
  };

  const handleAnggota = (ekskul) => {
    setSelectedEkskul(ekskul);
    setIsAnggotaOpen(true);
  };

  const handleCetak = (ekskul) => {
    setSelectedEkskul(ekskul);
    setIsCetakOpen(true);
  };

  const handleDelete = async (id, nama) => {
    const result = await Swal.fire({
      title: 'Hapus Ekskul?',
      text: `Menghapus ekstrakurikuler ${nama} juga akan menghapus data anggotanya pada semester ini. Lanjutkan?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
      Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
      try {
        const { error } = await supabase.from('data_ekskul').delete().eq('id', id);
        if (error) throw error;
        
        Swal.fire('Terhapus!', 'Data ekstrakurikuler berhasil dihapus.', 'success');
        fetchEkskul();
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus data.', 'error');
      }
    }
  };

  // Filtered by search term
  const filteredEkskul = dataEkskul.filter(item => {
    const q = searchTerm.toLowerCase();
    const matchNama = (item.nama_ekskul || '').toLowerCase().includes(q);
    const matchPembina = (item.pembina_nama || '').toLowerCase().includes(q);
    const matchHari = (item.hari_pelaksanaan || '').toLowerCase().includes(q);
    return matchNama || matchPembina || matchHari;
  });

  const totalAnggotaKeseluruhan = dataEkskul.reduce((acc, curr) => acc + (curr.jumlah_anggota || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2a2c87] flex items-center gap-2">
            <Tent className="text-[#85c226]" size={28} /> Ekstrakurikuler
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Kelola program ekskul & anggota per semester, serta cetak data anggota lengkap.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <button 
            onClick={fetchEkskul} 
            className="flex-1 md:flex-none justify-center bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-bold shadow-xs hover:bg-gray-50 transition flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
          <button 
            onClick={handleAdd} 
            className="flex-1 md:flex-none justify-center bg-[#2a2c87] hover:bg-blue-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition flex items-center gap-2 text-sm"
          >
            <Plus size={18} /> Tambah Ekskul
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2a2c87] flex items-center justify-center shrink-0">
            <Tent size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Total Program Ekskul</p>
            <h3 className="text-2xl font-black text-[#2a2c87] mt-0.5">{dataEkskul.length}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Total Anggota Terdaftar</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-0.5">{totalAnggotaKeseluruhan} <span className="text-xs font-semibold text-gray-400">Siswa</span></h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase">Periode Aktif</p>
            <h3 className="text-base font-bold text-gray-800 mt-0.5">TA {filterTA} ({filterSemester})</h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="Cari nama ekskul atau pembina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:bg-white text-sm outline-none transition"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase shrink-0">
            <Filter size={15} /> Filter TA:
          </div>
          <select 
            value={filterTA} 
            onChange={(e) => setFilterTA(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-200 bg-gray-50 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:bg-white text-sm font-semibold outline-none cursor-pointer"
          >
            {availableTA.map(ta => (
              <option key={ta} value={ta}>TA: {ta}</option>
            ))}
          </select>
          <select 
            value={filterSemester} 
            onChange={(e) => setFilterSemester(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-gray-200 bg-gray-50 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:bg-white text-sm font-semibold outline-none cursor-pointer"
          >
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar w-full">
          <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50/80 text-gray-600 uppercase text-xs font-bold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-16 text-center">No</th>
                <th className="px-6 py-4">Nama Ekstrakurikuler</th>
                <th className="px-6 py-4">Pembina</th>
                <th className="px-6 py-4">Jadwal Pelaksanaan</th>
                <th className="px-6 py-4 text-center">Anggota</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2a2c87] mb-2"></div>
                      <span>Memuat data ekstrakurikuler...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEkskul.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400 font-medium">
                    {searchTerm 
                      ? 'Tidak ada ekstrakurikuler yang sesuai dengan pencarian.' 
                      : `Belum ada data ekstrakurikuler pada TA ${filterTA} Semester ${filterSemester}.`}
                  </td>
                </tr>
              ) : (
                filteredEkskul.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-gray-500 font-medium text-center">{idx + 1}</td>
                    <td className="px-6 py-4 font-bold text-[#2a2c87] text-base">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2a2c87] flex items-center justify-center shrink-0 font-bold">
                          <Tent size={16} />
                        </div>
                        <span>{item.nama_ekskul}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{item.pembina_nama || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {item.hari_pelaksanaan && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-700">
                            {item.hari_pelaksanaan}
                          </span>
                        )}
                        {item.jam_pelaksanaan && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-600">
                            {item.jam_pelaksanaan}
                          </span>
                        )}
                        {!item.hari_pelaksanaan && !item.jam_pelaksanaan && (
                          <span className="text-gray-400 italic text-xs">Belum diatur</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-bold text-xs gap-1.5 border border-emerald-100">
                        <Users size={14} /> {item.jumlah_anggota || 0} Siswa
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Kelola Anggota Button */}
                        <button 
                          onClick={() => handleAnggota(item)} 
                          className="text-emerald-700 hover:text-white hover:bg-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs shadow-xs border border-emerald-200 hover:border-transparent" 
                          title="Kelola Anggota & Nilai"
                        >
                          <Users size={14} /> Kelola Anggota
                        </button>

                        {/* Cetak Data Anggota Button */}
                        <button 
                          onClick={() => handleCetak(item)} 
                          className="text-indigo-700 hover:text-white hover:bg-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs shadow-xs border border-indigo-200 hover:border-transparent" 
                          title="Cetak & Ekspor Data Anggota"
                        >
                          <Printer size={14} /> Cetak Anggota
                        </button>

                        {/* Edit Button */}
                        <button 
                          onClick={() => handleEdit(item)} 
                          className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition border border-amber-200" 
                          title="Edit Ekskul"
                        >
                          <Edit size={16} />
                        </button>

                        {/* Delete Button */}
                        <button 
                          onClick={() => handleDelete(item.id, item.nama_ekskul)} 
                          className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition border border-red-200" 
                          title="Hapus Ekskul"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah/Edit Ekskul */}
      <EkskulFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSuccess={() => {
          setIsFormOpen(false);
          fetchEkskul();
        }}
        initialData={selectedEkskul}
        defaultTA={filterTA}
        defaultSemester={filterSemester}
      />

      {/* Modal Kelola Anggota */}
      <AnggotaEkskulModal
        isOpen={isAnggotaOpen}
        onClose={() => {
          setIsAnggotaOpen(false);
          fetchEkskul();
        }}
        ekskulData={selectedEkskul}
        onOpenCetak={(ekskul) => {
          setSelectedEkskul(ekskul);
          setIsCetakOpen(true);
        }}
      />

      {/* Modal Cetak & Ekspor Data Anggota */}
      <CetakAnggotaEkskulModal
        isOpen={isCetakOpen}
        onClose={() => setIsCetakOpen(false)}
        ekskulData={selectedEkskul}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}
