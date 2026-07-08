import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Briefcase, Plus, RefreshCw, Trash2, Edit, Save, X, ShieldCheck, Filter } from 'lucide-react';
import { menusConfig } from '../utils/menuConfig';
import Swal from 'sweetalert2';

export default function DataJabatan() {
  const [dataJabatan, setDataJabatan] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('nama_jabatan');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formJabatan, setFormJabatan] = useState({
    id: null,
    nama_jabatan: '',
    deskripsi: '',
    kelompok_jabatan: '',
    hak_akses: []
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_jabatan')
        .select('*')
        .order('nama_jabatan', { ascending: true });

      if (error) throw error;
      setDataJabatan(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data jabatan' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setFormJabatan({ id: null, nama_jabatan: '', deskripsi: '', kelompok_jabatan: '', hak_akses: [] });
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setFormJabatan({
      id: item.id,
      nama_jabatan: item.nama_jabatan || '',
      deskripsi: item.deskripsi || '',
      kelompok_jabatan: item.kelompok_jabatan || '',
      hak_akses: item.hak_akses || []
    });
    setIsModalOpen(true);
  };

  const handleAksesToggle = (path) => {
    setFormJabatan(prev => {
      const current = prev.hak_akses || [];
      if (current.includes(path)) {
        return { ...prev, hak_akses: current.filter(p => p !== path) };
      } else {
        return { ...prev, hak_akses: [...current, path] };
      }
    });
  };

  const handleSave = async () => {
    if (!formJabatan.nama_jabatan) {
      Swal.fire('Peringatan', 'Nama Jabatan wajib diisi!', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nama_jabatan: formJabatan.nama_jabatan,
        deskripsi: formJabatan.deskripsi,
        kelompok_jabatan: formJabatan.kelompok_jabatan || null,
        hak_akses: formJabatan.hak_akses
      };

      let error;
      if (formJabatan.id) {
        const res = await supabase.from('data_jabatan').update(payload).eq('id', formJabatan.id);
        error = res.error;
      } else {
        const res = await supabase.from('data_jabatan').insert([payload]);
        error = res.error;
      }

      if (error) {
        if (error.code === '23505') throw new Error('Nama jabatan sudah ada.');
        throw error;
      }

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data jabatan berhasil disimpan.', timer: 1500, showConfirmButton: false });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat menyimpan data.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Apakah Anda yakin?',
      text: "Data jabatan ini akan dihapus permanen!",
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
            .from('data_jabatan')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Data jabatan telah dihapus.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan saat menghapus data.' });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const sortedData = [...dataJabatan].sort((a, b) => {
    if (sortBy === 'nama_jabatan') {
      return a.nama_jabatan.localeCompare(b.nama_jabatan);
    }
    if (sortBy === 'kelompok_jabatan') {
      const g1 = a.kelompok_jabatan || 'Z';
      const g2 = b.kelompok_jabatan || 'Z';
      return g1.localeCompare(g2);
    }
    if (sortBy === 'modify') {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }
    return 0;
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Briefcase className="text-primary" /> Master Data Jabatan
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola daftar jabatan yang tersedia untuk pegawai sekolah.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm text-sm">
            <Filter size={16} className="text-gray-500" />
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent focus:outline-none text-gray-700 cursor-pointer"
            >
              <option value="nama_jabatan">Nama Jabatan</option>
              <option value="kelompok_jabatan">Kelompok Jabatan</option>
              <option value="modify">Terbaru (Modify)</option>
            </select>
          </div>
          <button onClick={handleAdd} className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Jabatan
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
                <th className="px-6 py-4">Nama Jabatan</th>
                <th className="px-6 py-4">Kelompok</th>
                <th className="px-6 py-4">Deskripsi</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="3" className="px-6 py-10 text-center text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : dataJabatan.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-10 text-center text-gray-400">
                    Tidak ada data jabatan.
                  </td>
                </tr>
              ) : (
                sortedData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-800">{item.nama_jabatan}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {item.kelompok_jabatan ? (
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-blue-100">
                          {item.kelompok_jabatan}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.deskripsi || '-'}</td>
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-primary p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Briefcase size={20} /> {formJabatan.id ? 'Edit' : 'Tambah'} Jabatan</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Jabatan <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={formJabatan.nama_jabatan}
                    onChange={(e) => setFormJabatan({...formJabatan, nama_jabatan: e.target.value})}
                    placeholder="Contoh: Kepala Sekolah"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Kelompok Jabatan</label>
                  <select
                    value={formJabatan.kelompok_jabatan}
                    onChange={(e) => setFormJabatan({...formJabatan, kelompok_jabatan: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                  >
                    <option value="">-- Pilih Kelompok Jabatan --</option>
                    <option value="Manajemen Kependidikan">Manajemen Kependidikan</option>
                    <option value="Pendidik">Pendidik</option>
                    <option value="Staff lain">Staff lain</option>
                    <option value="Murid">Murid</option>
                    <option value="Wali Murid">Wali Murid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Deskripsi (Opsional)</label>
                  <input 
                    type="text" 
                    value={formJabatan.deskripsi}
                    onChange={(e) => setFormJabatan({...formJabatan, deskripsi: e.target.value})}
                    placeholder="Contoh: Pimpinan lembaga"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200 pt-6">
                <div className="mb-4">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2"><ShieldCheck size={18} className="text-primary" /> Hak Akses Bawaan (Default)</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Centang menu-menu yang secara otomatis bisa diakses oleh siapa pun yang memiliki jabatan ini.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {menusConfig.map((group, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">{group.group}</p>
                      <div className="space-y-2">
                        {group.items.map((item, iIdx) => (
                          <label key={iIdx} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded transition">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                              checked={(formJabatan.hak_akses || []).includes(item.to)}
                              onChange={() => handleAksesToggle(item.to)}
                            />
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              {item.icon && <item.icon size={14} className="text-gray-400" />}
                              {item.label}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition">Batal</button>
              <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-blue-900 transition flex items-center gap-2">
                {isSaving ? 'Menyimpan...' : <><Save size={18} /> Simpan</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
