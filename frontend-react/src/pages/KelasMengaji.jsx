import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { BookOpen, Plus, RefreshCw, Trash2, Edit, Users } from 'lucide-react';
import Swal from 'sweetalert2';
import KelasMengajiFormModal from '../components/KelasMengajiFormModal';
import AnggotaKelasMengajiModal from '../components/AnggotaKelasMengajiModal';

export default function KelasMengaji() {
  const [dataKelas, setDataKelas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnggotaModalOpen, setIsAnggotaModalOpen] = useState(false);
  const [selectedKelas, setSelectedKelas] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_kelas_mengaji')
        .select('*, data_ruang(nama_ruang)')
        .order('nama_kelas', { ascending: true });

      if (error) throw error;
      setDataKelas(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data kelas mengaji' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setSelectedKelas(null);
    setIsModalOpen(true);
  };

  const handleEdit = (kelas) => {
    setSelectedKelas(kelas);
    setIsModalOpen(true);
  };

  const handleAnggota = (kelas) => {
    setSelectedKelas(kelas);
    setIsAnggotaModalOpen(true);
  };

  const handleDelete = async (item) => {
    if (!item.nama_kelas) {
       Swal.fire('Error', 'Data kelas tidak valid.', 'error');
       return;
    }

    const result = await Swal.fire({
      title: 'Hapus Kelas?',
      text: `Anda yakin ingin menghapus kelas ${item.nama_kelas}? Data siswa di kelas ini mungkin perlu diperbarui.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
      try {
        let query = supabase.from('data_kelas_mengaji').delete();
        
        if (item.id) query = query.eq('id', item.id);
        else query = query.eq('nama_kelas', item.nama_kelas);

        // Tambahkan .select() untuk memverifikasi penghapusan
        const { data, error } = await query.select();
        
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Izin akses ditolak oleh RLS Supabase. Data tidak terhapus.");
        }
        
        Swal.fire('Terhapus!', 'Kelas Mengaji berhasil dihapus.', 'success');
        fetchData();
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal Menghapus', `Pastikan kelas ini tidak sedang digunakan oleh data siswa. Detail: ${err.message}`, 'error');
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <BookOpen className="text-primary" /> Kelas Mengaji
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola rombongan belajar dan guru kelas mengaji.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAdd} className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Kelas
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
                <th className="px-6 py-4">Nama Kelas</th>
                <th className="px-6 py-4">Tingkat</th>
                <th className="px-6 py-4">Ruang</th>
                <th className="px-6 py-4">Guru Pengajar</th>
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
              ) : dataKelas.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                    Tidak ada data kelas mengaji.
                  </td>
                </tr>
              ) : (
                dataKelas.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-bold text-primary">{item.nama_kelas}</td>
                    <td className="px-6 py-4 text-gray-600">{item.tingkat || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{item.data_ruang?.nama_ruang || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{item.guru_pengajar || 'Belum diatur'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleAnggota(item)} className="text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-2.5 py-1.5 rounded-md hover:bg-indigo-100 transition flex items-center gap-1 text-xs" title="Atur Anggota">
                          <Users size={14} /> Anggota
                        </button>
                        <button onClick={() => handleEdit(item)} className="text-yellow-600 hover:text-yellow-800 font-medium bg-yellow-50 px-2.5 py-1.5 rounded-md hover:bg-yellow-100 transition flex items-center gap-1 text-xs" title="Edit Data">
                          <Edit size={14} /> Edit
                        </button>
                        <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800 font-medium bg-red-50 px-2.5 py-1.5 rounded-md hover:bg-red-100 transition flex items-center gap-1 text-xs" title="Hapus Kelas">
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

      <KelasMengajiFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        kelasData={selectedKelas}
        onSuccess={fetchData}
      />

      <AnggotaKelasMengajiModal 
        isOpen={isAnggotaModalOpen}
        onClose={() => setIsAnggotaModalOpen(false)}
        kelasData={selectedKelas}
      />
    </div>
  );
}
