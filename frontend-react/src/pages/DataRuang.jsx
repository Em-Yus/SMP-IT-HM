import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { DoorOpen, Plus, RefreshCw, Edit, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function DataRuang() {
  const [dataRuang, setDataRuang] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_ruang')
        .select('*')
        .order('kode_ruang', { ascending: true });

      if (error) throw error;
      setDataRuang(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data ruang' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    Swal.fire({
      title: 'Tambah Ruang',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Kode Ruang</label>
            <input id="swal-kode" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Misal: R01">
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Nama Ruang</label>
            <input id="swal-nama" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" placeholder="Misal: Ruang Kelas X-A">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2a2c87',
      preConfirm: () => {
        const kode = document.getElementById('swal-kode').value;
        const nama = document.getElementById('swal-nama').value;
        if (!kode || !nama) {
          Swal.showValidationMessage('Kode dan Nama Ruang wajib diisi');
          return false;
        }
        return { kode_ruang: kode, nama_ruang: nama };
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('data_ruang')
            .insert([result.value]);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Ruang baru telah ditambahkan.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat menambahkan data.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleEdit = (item) => {
    Swal.fire({
      title: 'Edit Ruang',
      html: `
        <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Kode Ruang</label>
            <input id="swal-kode" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" value="${item.kode_ruang || ''}">
          </div>
          <div>
            <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Nama Ruang</label>
            <input id="swal-nama" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" value="${item.nama_ruang || ''}">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Simpan Perubahan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#85c226',
      preConfirm: () => {
        const kode = document.getElementById('swal-kode').value;
        const nama = document.getElementById('swal-nama').value;
        if (!kode || !nama) {
          Swal.showValidationMessage('Kode dan Nama Ruang wajib diisi');
          return false;
        }
        return { kode_ruang: kode, nama_ruang: nama };
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('data_ruang')
            .update(result.value)
            .eq('id', item.id);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data ruang telah diperbarui.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat memperbarui data.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Apakah Anda yakin?',
      text: "Data ruang ini akan dihapus permanen!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('data_ruang')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Data ruang telah dihapus.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menghapus ruang. Pastikan ruang tidak sedang digunakan oleh entitas lain.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <DoorOpen className="text-primary" /> Data Ruang
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola master data ruang kelas dan laboratorium.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleAdd} className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Ruang
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
                <th className="px-6 py-4">No</th>
                <th className="px-6 py-4">Kode Ruang</th>
                <th className="px-6 py-4">Nama Ruang</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : dataRuang.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-gray-400">
                    Belum ada data ruang.
                  </td>
                </tr>
              ) : (
                dataRuang.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{item.kode_ruang}</td>
                    <td className="px-6 py-4 text-gray-600">{item.nama_ruang}</td>
                    <td className="px-6 py-4 text-center flex justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="text-yellow-600 hover:text-yellow-700 bg-yellow-50 px-2.5 py-1.5 rounded-md font-medium transition flex items-center gap-1 text-xs"
                      >
                        <Edit size={14} /> Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700 bg-red-50 px-2.5 py-1.5 rounded-md font-medium transition flex items-center gap-1 text-xs"
                      >
                        <Trash2 size={14} /> Hapus
                      </button>
                    </td>
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
