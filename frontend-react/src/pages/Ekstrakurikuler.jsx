import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Tent, Plus, RefreshCw, Trash2, Edit, Users, Filter } from 'lucide-react';
import Swal from 'sweetalert2';
import EkskulFormModal from '../components/EkskulFormModal';
import AnggotaEkskulModal from '../components/AnggotaEkskulModal';

export default function Ekstrakurikuler() {
  const [dataEkskul, setDataEkskul] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAnggotaOpen, setIsAnggotaOpen] = useState(false);
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
            // Count members per ekskul_id
            const counts = {};
            anggota.forEach(a => {
               counts[a.ekskul_id] = (counts[a.ekskul_id] || 0) + 1;
            });
            
            // Assign count
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
           // Ensure initialTA is always in the list
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

  const handleDelete = async (id, nama) => {
    const result = await Swal.fire({
      title: 'Hapus Ekskul?',
      text: `Menghapus ekstrakurikuler ${nama} juga akan menghapus semua data pesertanya pada semester ini. Lanjutkan?`,
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

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2a2c87] flex items-center gap-2">
            <Tent className="text-[#85c226]" /> Data Ekstrakurikuler
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola jadwal ekskul dan input predikat/deskripsi anggota per semester.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={fetchEkskul} className="flex-1 md:flex-none justify-center bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={handleAdd} className="flex-1 md:flex-none justify-center bg-[#2a2c87] hover:bg-blue-900 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Ekskul
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 text-gray-600 font-bold">
           <Filter size={18} /> Filter Data:
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
           <select 
             value={filterTA} 
             onChange={(e) => setFilterTA(e.target.value)}
             className="w-full sm:w-auto flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:outline-none text-sm font-semibold"
           >
             {availableTA.map(ta => (
                <option key={ta} value={ta}>TA: {ta}</option>
             ))}
           </select>
           <select 
             value={filterSemester} 
             onChange={(e) => setFilterSemester(e.target.value)}
             className="w-full sm:w-auto flex-1 sm:flex-none px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:outline-none text-sm font-semibold"
           >
             <option value="Ganjil">Semester Ganjil</option>
             <option value="Genap">Semester Genap</option>
           </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar w-full">
          <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">No</th>
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
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                    Memuat data ekstrakurikuler...
                  </td>
                </tr>
              ) : dataEkskul.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                    Belum ada data ekstrakurikuler pada TA {filterTA} Semester {filterSemester}.
                  </td>
                </tr>
              ) : (
                dataEkskul.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 text-gray-500 font-medium">{idx + 1}</td>
                    <td className="px-6 py-4 font-bold text-[#2a2c87] text-base">{item.nama_ekskul}</td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{item.pembina_nama || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {item.hari_pelaksanaan && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-700">{item.hari_pelaksanaan}</span>}
                        {item.jam_pelaksanaan && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-600">{item.jam_pelaksanaan}</span>}
                        {!item.hari_pelaksanaan && !item.jam_pelaksanaan && <span className="text-gray-400 italic">Belum diatur</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 px-3 py-1 rounded-lg font-bold text-xs gap-1.5 border border-blue-100">
                         <Users size={14} /> {item.jumlah_anggota || 0} Siswa
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleAnggota(item)} className="text-blue-600 hover:text-white hover:bg-blue-600 font-bold bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs shadow-sm border border-blue-100 hover:border-transparent" title="Kelola Anggota">
                          <Users size={14} /> Kelola Nilai
                        </button>
                        <button onClick={() => handleEdit(item)} className="p-2 text-orange-500 bg-orange-50 hover:bg-orange-100 rounded-lg transition" title="Edit Data">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id, item.nama_ekskul)} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition" title="Hapus">
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

      <EkskulFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSuccess={() => {
          setIsFormOpen(false);
          fetchEkskul();
        }}
        initialData={selectedEkskul}
      />

      <AnggotaEkskulModal
        isOpen={isAnggotaOpen}
        onClose={() => {
          setIsAnggotaOpen(false);
          fetchEkskul(); // refresh untuk update jumlah anggota
        }}
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
