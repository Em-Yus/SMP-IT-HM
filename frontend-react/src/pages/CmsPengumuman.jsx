import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Megaphone, Plus, Trash2, Edit, Save, X, EyeOff, Eye } from 'lucide-react';
import Swal from 'sweetalert2';

export default function CmsPengumuman() {
  const [dataPengumuman, setDataPengumuman] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  // Form State
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [target, setTarget] = useState('Semua');
  const [status, setStatus] = useState('Aktif');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cms_pengumuman')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDataPengumuman(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat data pengumuman.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (item = null) => {
    if (item) {
      setIsEditing(true);
      setEditId(item.id);
      setJudul(item.judul);
      setIsi(item.isi);
      setTarget(item.target);
      setStatus(item.status);
    } else {
      setIsEditing(false);
      setEditId(null);
      setJudul('');
      setIsi('');
      setTarget('Semua');
      setStatus('Aktif');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!judul.trim() || !isi.trim()) {
      Swal.fire('Perhatian', 'Judul dan Isi pengumuman harus diisi!', 'warning');
      return;
    }

    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      const payload = {
        judul: judul.trim(),
        isi: isi.trim(),
        target,
        status
      };

      if (isEditing) {
        const { error } = await supabase.from('cms_pengumuman').update(payload).eq('id', editId);
        if (error) throw error;
        Swal.fire('Berhasil', 'Pengumuman berhasil diperbarui.', 'success');
      } else {
        const { error } = await supabase.from('cms_pengumuman').insert([payload]);
        if (error) throw error;

        // --- Trigger Push Notification ---
        if (status === 'Aktif' && (target === 'Semua' || target === 'Siswa')) {
          try {
            // Ambil semua token dari Supabase
            const { data: tokensData } = await supabase.from('user_push_tokens').select('expo_push_token');
            if (tokensData && tokensData.length > 0) {
              const validTokens = tokensData.filter(t => t.expo_push_token);
              if (validTokens.length > 0) {
                const messages = validTokens.map((t) => ({
                  to: t.expo_push_token,
                  sound: 'default',
                  title: '📢 ' + payload.judul,
                  body: payload.isi.length > 100 ? payload.isi.substring(0, 100) + '...' : payload.isi,
                  data: { route: '/pengumuman' },
                }));
                
                await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(messages),
                });
              }
            }
          } catch (pushErr) {
            console.error('Gagal mengirim notifikasi:', pushErr);
          }
        }
        // ---------------------------------

        Swal.fire('Berhasil', 'Pengumuman baru berhasil ditambahkan dan notifikasi dikirim.', 'success');
      }      
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire('Gagal', 'Terjadi kesalahan saat menyimpan data.', 'error');
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Hapus Pengumuman?',
      text: 'Pengumuman yang dihapus tidak dapat dikembalikan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
      Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const { error } = await supabase.from('cms_pengumuman').delete().eq('id', id);
        if (error) throw error;
        Swal.fire('Terhapus!', 'Pengumuman berhasil dihapus.', 'success');
        fetchData();
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal', 'Gagal menghapus pengumuman.', 'error');
      }
    }
  };

  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'Aktif' ? 'Arsip' : 'Aktif';
    try {
      const { error } = await supabase.from('cms_pengumuman').update({ status: newStatus }).eq('id', item.id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire('Gagal', 'Gagal mengubah status pengumuman.', 'error');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit' }).format(date);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2a2c87] flex items-center gap-2">
            <Megaphone className="text-[#85c226]" /> Kelola Pengumuman
          </h2>
          <p className="text-gray-500 text-sm mt-1">Buat pengumuman khusus untuk Siswa, Guru, atau Publik secara langsung.</p>
        </div>
        <div className="w-full md:w-auto">
          <button onClick={() => openModal()} className="w-full md:w-auto justify-center bg-[#85c226] hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={18} /> Buat Pengumuman Baru
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar w-full">
          <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Judul Pengumuman</th>
                <th className="px-6 py-4">Target Pembaca</th>
                <th className="px-6 py-4">Waktu Dibuat</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                    <div className="flex justify-center mb-2"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#85c226]"></div></div>
                    Memuat data pengumuman...
                  </td>
                </tr>
              ) : dataPengumuman.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center text-gray-400">
                    <Megaphone size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-bold text-gray-600">Belum ada pengumuman.</p>
                    <p className="text-sm mt-1">Gunakan tombol "Buat Pengumuman Baru" untuk memulai.</p>
                  </td>
                </tr>
              ) : (
                dataPengumuman.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800">{item.judul}</p>
                      <p className="text-xs text-gray-500 truncate max-w-xs" title={item.isi}>{item.isi}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                         item.target === 'Semua' ? 'bg-purple-100 text-purple-700' :
                         item.target === 'Publik' ? 'bg-blue-100 text-blue-700' :
                         item.target === 'Siswa' ? 'bg-green-100 text-green-700' :
                         'bg-orange-100 text-orange-700'
                      }`}>
                         {item.target}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium text-xs">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                         onClick={() => handleToggleStatus(item)}
                         className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border transition ${
                           item.status === 'Aktif' 
                             ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                             : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                         }`}
                         title="Klik untuk mengubah status"
                      >
                        {item.status === 'Aktif' ? <Eye size={12} /> : <EyeOff size={12} />}
                        {item.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition" title="Edit">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition" title="Hapus">
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all">
            <div className="bg-[#2a2c87] px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Megaphone size={20} className="text-[#85c226]" /> {isEditing ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}
              </h3>
              <button onClick={closeModal} className="text-white/70 hover:text-white transition">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Judul Pengumuman <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    placeholder="Contoh: Libur Nasional Idul Fitri"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226]"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div>
                     <label className="block text-sm font-bold text-gray-700 mb-1">Target Pembaca</label>
                     <select 
                       value={target}
                       onChange={(e) => setTarget(e.target.value)}
                       className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] font-medium"
                     >
                       <option value="Semua">Semua (Siswa, Guru, Publik)</option>
                       <option value="Siswa">Hanya Siswa (Muncul di Dashboard Siswa)</option>
                       <option value="Guru">Hanya Guru (Muncul di Dashboard Guru)</option>
                       <option value="Publik">Hanya Publik (Muncul di Beranda Utama)</option>
                     </select>
                   </div>
                   
                   <div>
                     <label className="block text-sm font-bold text-gray-700 mb-1">Status Penayangan</label>
                     <select 
                       value={status}
                       onChange={(e) => setStatus(e.target.value)}
                       className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] font-medium"
                     >
                       <option value="Aktif">Aktif (Ditayangkan)</option>
                       <option value="Arsip">Arsip (Disembunyikan)</option>
                     </select>
                   </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Isi Pengumuman <span className="text-red-500">*</span></label>
                  <textarea 
                    value={isi}
                    onChange={(e) => setIsi(e.target.value)}
                    placeholder="Ketikkan detail pengumuman di sini..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] min-h-[150px]"
                    required
                  ></textarea>
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition">
                  Batal
                </button>
                <button type="submit" className="px-6 py-2.5 text-white bg-[#2a2c87] hover:bg-blue-900 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center gap-2">
                  <Save size={18} /> Simpan Pengumuman
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}
