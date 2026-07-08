import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, RefreshCw, UserX, Info, X, UserCheck } from 'lucide-react';
import Swal from 'sweetalert2';

export default function DataPegawaiNonaktif() {
  const [dataPegawai, setDataPegawai] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // State Modals
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedGuruDetail, setSelectedGuruDetail] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_guru')
        .select('*')
        .not('tanggal_keluar', 'is', null)
        .order('nama', { ascending: true });

      if (error) throw error;
      setDataPegawai(data || []);
    } catch (err) {
      console.error('SupaError:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: `Gagal mengambil data pegawai: ${err.message || JSON.stringify(err)}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers for Detail ---
  const handleOpenDetail = (guru) => {
    setSelectedGuruDetail(guru);
    setIsDetailModalOpen(true);
  };

  const handleReactivate = (guru) => {
    Swal.fire({
      title: `Aktifkan Kembali?`,
      html: `Apakah Anda yakin ingin mengaktifkan kembali <b>${guru.nama}</b>?<br><br>Pegawai ini akan dikembalikan ke daftar Pegawai Aktif.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Aktifkan',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('data_guru')
            .update({ tanggal_keluar: null })
            .eq('id', guru.id);
          
          if (error) throw error;
          
          Swal.fire('Berhasil!', 'Pegawai berhasil diaktifkan kembali.', 'success');
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire('Gagal!', 'Terjadi kesalahan saat mengaktifkan pegawai.', 'error');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const filteredData = dataPegawai.filter(item => {
    const keyword = searchTerm.toLowerCase();
    const matchName = (item.nama || '').toLowerCase().includes(keyword);
    const matchNuptk = (item.nuptk || '').toLowerCase().includes(keyword);
    return matchName || matchNuptk;
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-red-600 flex items-center gap-2">
            <UserX className="text-red-600" /> Data Pegawai Nonaktif
          </h2>
          <p className="text-gray-500 text-sm mt-1">Daftar pegawai dan guru yang sudah tidak aktif (keluar/pensiun).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={fetchData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama atau NUPTK..." 
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:bg-white outline-none text-sm font-medium transition text-gray-800"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">NUPTK/NIP</th>
                <th className="px-6 py-4">Tanggal Keluar</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                    Tidak ada data pegawai nonaktif.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-red-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-800">{item.nama}</td>
                    <td className="px-6 py-4 text-gray-600">{item.nuptk || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{item.tanggal_keluar || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
                        Nonaktif
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleOpenDetail(item)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition" title="Detail Pegawai">
                          <Info size={18} />
                        </button>
                        <button onClick={() => handleReactivate(item)} className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded transition" title="Aktifkan Kembali">
                          <UserCheck size={18} />
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

      {/* --- MODAL DETAIL PEGAWAI --- */}
      {isDetailModalOpen && selectedGuruDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-red-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Info size={20} /> Detail Pegawai Nonaktif</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                   <span className="text-gray-500 font-bold text-3xl">{selectedGuruDetail.nama?.charAt(0) || '?'}</span>
                </div>
                <h4 className="text-xl font-bold text-gray-800 text-center">{selectedGuruDetail.nama}</h4>
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold mt-2">Nonaktif sejak {selectedGuruDetail.tanggal_keluar || '-'}</span>
              </div>
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">NUPTK</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.nuptk || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">NIP</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.nip || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Jenis Kelamin</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.jenis_kelamin || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Nomor HP</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.no_hp || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Alamat</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.alamat || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
