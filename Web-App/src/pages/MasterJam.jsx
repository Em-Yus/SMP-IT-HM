import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Clock, Plus, RefreshCw, Trash2, Edit } from 'lucide-react';
import Swal from 'sweetalert2';
import MasterJamFormModal from '../components/MasterJamFormModal';

export default function MasterJam() {
  const [dataJam, setDataJam] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJam, setSelectedJam] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('master_jam')
        .select('*')
        .order('urutan', { ascending: true });

      if (error) throw error;
      setDataJam(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data master jam' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setSelectedJam(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setSelectedJam(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Hapus Jam?',
      text: `Anda yakin ingin menghapus jam "${item.nama_jam}"? Jadwal yang menggunakan jam ini akan ikut terhapus.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from('master_jam').delete().eq('id', item.id);
        if (error) throw error;
        Swal.fire('Terhapus!', 'Master jam berhasil dihapus.', 'success');
        fetchData();
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus.', 'error');
      }
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    return timeStr.substring(0, 5);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Clock className="text-primary" /> Master Jam Pelajaran
          </h2>
          <p className="text-gray-500 text-sm mt-1">Atur urutan, nama jam, dan durasi pembelajaran sekolah.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAdd} className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Jam
          </button>
          <button onClick={fetchData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Urutan</th>
                <th className="px-6 py-4">Nama Jam</th>
                <th className="px-6 py-4">Waktu</th>
                <th className="px-6 py-4">Jenis</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">Memuat data...</td>
                </tr>
              ) : dataJam.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">Belum ada data master jam.</td>
                </tr>
              ) : (
                dataJam.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-bold text-gray-600 text-center w-16">{item.urutan}</td>
                    <td className="px-6 py-4 font-bold text-primary">{item.nama_jam}</td>
                    <td className="px-6 py-4 font-bold text-gray-700">{formatTime(item.waktu_mulai)} - {formatTime(item.waktu_selesai)}</td>
                    <td className="px-6 py-4">
                      {item.is_istirahat ? (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Istirahat</span>
                      ) : (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Pelajaran</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(item)} className="text-yellow-600 hover:text-yellow-800 font-medium bg-yellow-50 px-2.5 py-1.5 rounded-md hover:bg-yellow-100 transition flex items-center gap-1 text-xs" title="Edit">
                          <Edit size={14} /> Edit
                        </button>
                        <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800 font-medium bg-red-50 px-2.5 py-1.5 rounded-md hover:bg-red-100 transition flex items-center gap-1 text-xs" title="Hapus">
                          <Trash2 size={14} /> Hapus
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

      <MasterJamFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        data={selectedJam} 
        onSuccess={fetchData} 
      />
    </div>
  );
}
