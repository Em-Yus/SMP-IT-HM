import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Target, Search, Plus, RefreshCw, Edit3, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export default function TujuanPembelajaran() {
  const [dataTP, setDataTP] = useState([]);
  const [dataMapel, setDataMapel] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  const [filterMapel, setFilterMapel] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterTahun, setFilterTahun] = useState(defaultTahun);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [formValues, setFormValues] = useState({ tujuan_pembelajaran: '' });

  useEffect(() => {
    fetchMapel();
  }, []);

  const fetchMapel = async () => {
    try {
      const { data, error } = await supabase
        .from('data_mapel')
        .select('id, nama_mapel')
        .order('urutan', { ascending: true });
      if (error) throw error;
      setDataMapel(data || []);
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal memuat referensi mata pelajaran', 'error');
    }
  };

  const fetchTP = async () => {
    if (!filterMapel || !filterKelas || !filterSemester || !filterTahun) {
      Swal.fire({
        icon: 'warning',
        title: 'Perhatian',
        text: 'Silakan pilih Mata Pelajaran, Tingkat Kelas, Semester, dan Tahun Pelajaran terlebih dahulu.'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tujuan_pembelajaran')
        .select(`
          *,
          data_mapel!inner (
            nama_mapel
          )
        `)
        .eq('id_mapel', filterMapel)
        .eq('id_kelas', filterKelas)
        .eq('semester', filterSemester)
        .eq('tahun_pelajaran', filterTahun)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setDataTP(data || []);
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal memuat data tujuan pembelajaran', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const newStatus = !item.status;
      const { error } = await supabase
        .from('tujuan_pembelajaran')
        .update({ status: newStatus })
        .eq('id', item.id);
      
      if (error) throw error;
      
      setDataTP(prev => prev.map(tp => tp.id === item.id ? { ...tp, status: newStatus } : tp));
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Status diubah menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}`,
        showConfirmButton: false,
        timer: 1500
      });
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal merubah status', 'error');
    }
  };

  const openAddModal = () => {
    if (!filterMapel || !filterKelas || !filterSemester || !filterTahun) {
      Swal.fire({ icon: 'warning', text: 'Pilih semua filter terlebih dahulu sebelum menambahkan data.' });
      return;
    }
    setEditingData(null);
    setFormValues({ tujuan_pembelajaran: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingData(item);
    setFormValues({ tujuan_pembelajaran: item.tujuan_pembelajaran });
    setIsModalOpen(true);
  };

  const saveTP = async () => {
    if (!formValues.tujuan_pembelajaran.trim()) {
      return Swal.fire('Peringatan', 'Tujuan pembelajaran tidak boleh kosong', 'warning');
    }

    try {
      Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const payload = {
        id_mapel: filterMapel,
        id_kelas: filterKelas,
        semester: filterSemester,
        tahun_pelajaran: filterTahun,
        tujuan_pembelajaran: formValues.tujuan_pembelajaran.trim()
      };

      if (editingData) {
        const { error } = await supabase.from('tujuan_pembelajaran').update(payload).eq('id', editingData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tujuan_pembelajaran').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      Swal.fire('Berhasil', 'Tujuan pembelajaran berhasil disimpan', 'success');
      fetchTP();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal menyimpan data', 'error');
    }
  };

  const handleDelete = (item) => {
    Swal.fire({
      title: 'Hapus Data?',
      text: "Tujuan pembelajaran ini akan dihapus permanen.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const { error } = await supabase.from('tujuan_pembelajaran').delete().eq('id', item.id);
          if (error) throw error;
          Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success');
          setDataTP(prev => prev.filter(tp => tp.id !== item.id));
        } catch (e) {
          console.error(e);
          Swal.fire('Error', 'Gagal menghapus data', 'error');
        }
      }
    });
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Target className="text-primary" /> Tujuan Pembelajaran
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola data Tujuan Pembelajaran (TP) untuk E-Rapor.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={openAddModal}
            className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Tambah TP
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4">
        <select 
          value={filterMapel} onChange={e => { setFilterMapel(e.target.value); setDataTP([]); }}
          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm font-semibold"
        >
          <option value="">-- Pilih Mata Pelajaran --</option>
          {dataMapel.map(m => (
            <option key={m.id} value={m.id}>{m.nama_mapel}</option>
          ))}
        </select>

        <select 
          value={filterKelas} onChange={e => { setFilterKelas(e.target.value); setDataTP([]); }}
          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm font-semibold"
        >
          <option value="">-- Pilih Tingkat --</option>
          <option value="7">Tingkat 7</option>
          <option value="8">Tingkat 8</option>
          <option value="9">Tingkat 9</option>
        </select>

        <select 
          value={filterSemester} onChange={e => { setFilterSemester(e.target.value); setDataTP([]); }}
          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm font-semibold"
        >
          <option value="">-- Pilih Semester --</option>
          <option value="Ganjil">Ganjil</option>
          <option value="Genap">Genap</option>
        </select>

        <select 
          value={filterTahun} onChange={e => { setFilterTahun(e.target.value); setDataTP([]); }}
          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none text-sm font-semibold"
        >
          <option value={`${currentYear - 1}/${currentYear}`}>{currentYear - 1}/{currentYear}</option>
          <option value={`${currentYear}/${currentYear + 1}`}>{currentYear}/{currentYear + 1}</option>
          <option value={`${currentYear + 1}/${currentYear + 2}`}>{currentYear + 1}/{currentYear + 2}</option>
        </select>

        <button 
          onClick={fetchTP}
          className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 text-sm whitespace-nowrap"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Tampilkan
        </button>
      </div>



      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center text-gray-400 gap-3 py-16">
              <p>Memuat data...</p>
            </div>
          ) : dataTP.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 gap-3 py-16">
              <Target size={48} className="opacity-20" />
              <p>Tidak ada data tujuan pembelajaran.</p>
              <p className="text-xs">Pastikan filter sudah dipilih dengan benar atau tambah data baru.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">No</th>
                  <th className="px-6 py-4">Tujuan Pembelajaran</th>
                  <th className="px-6 py-4 w-40 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataTP.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 text-center font-bold text-gray-500 text-sm">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-800 leading-relaxed">{item.tujuan_pembelajaran}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-2 justify-center">
                        <label className="flex items-center cursor-pointer">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              className="sr-only" 
                              checked={item.status} 
                              onChange={() => handleToggleStatus(item)} 
                            />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${item.status ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${item.status ? 'transform translate-x-4' : ''}`}></div>
                          </div>
                          <span className={`ml-3 text-xs font-bold ${item.status ? 'text-green-600' : 'text-gray-400'}`}>
                            {item.status ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                           <button onClick={() => openEditModal(item)} className="text-gray-400 hover:text-blue-600 p-1 bg-gray-100 hover:bg-blue-50 rounded" title="Edit">
                             <Edit3 size={14} />
                           </button>
                           <button onClick={() => handleDelete(item)} className="text-gray-400 hover:text-red-600 p-1 bg-gray-100 hover:bg-red-50 rounded" title="Hapus">
                             <Trash2 size={14} />
                           </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Target size={18} className="text-primary"/> 
                {editingData ? 'Edit Tujuan Pembelajaran' : 'Tambah Tujuan Pembelajaran'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition">
                <XCircle size={20}/>
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-100 mb-4 font-medium flex flex-wrap gap-x-4 gap-y-1">
                <span>Mapel: <b>{dataMapel.find(m => m.id == filterMapel)?.nama_mapel || '-'}</b></span>
                <span>Tingkat: <b>{filterKelas}</b></span>
                <span>Semester: <b>{filterSemester}</b></span>
              </div>
              
              <label className="block text-sm font-bold text-gray-700 mb-2">Teks Tujuan Pembelajaran</label>
              <textarea 
                rows="4" 
                value={formValues.tujuan_pembelajaran}
                onChange={e => setFormValues({ ...formValues, tujuan_pembelajaran: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm resize-none"
                placeholder="Contoh: Peserta didik mampu mengidentifikasi ciri-ciri makhluk hidup..."
              ></textarea>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm transition">
                Batal
              </button>
              <button onClick={saveTP} className="px-6 py-2 font-bold text-white bg-primary hover:bg-blue-800 rounded-lg text-sm shadow-md transition flex items-center gap-2">
                <CheckCircle2 size={16} /> Simpan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
