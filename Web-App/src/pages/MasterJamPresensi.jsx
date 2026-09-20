import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Clock, Plus, RefreshCw, Trash2, Edit, CheckCircle, AlertCircle, X, Check } from 'lucide-react';
import Swal from 'sweetalert2';

export default function MasterJamPresensi() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    tipe_hari: '',
    jam_masuk: '07:00',
    jam_pulang: '13:00',
    keterangan: '',
    is_active: false
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setTableMissing(false);
    try {
      const { data: result, error } = await supabase
        .from('master_jam_presensi')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205') {
          setTableMissing(true);
          setData([]);
          return;
        }
        throw error;
      }
      setData(result || []);
    } catch (err) {
      console.error('Error fetching master_jam_presensi:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data master jam presensi' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setSelectedItem(null);
    setFormData({
      tipe_hari: '',
      jam_masuk: '07:00',
      jam_pulang: '13:00',
      keterangan: '',
      is_active: data.length === 0 // otomatis aktif jika pertama
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      tipe_hari: item.tipe_hari || '',
      jam_masuk: (item.jam_masuk || '07:00').substring(0, 5),
      jam_pulang: (item.jam_pulang || '13:00').substring(0, 5),
      keterangan: item.keterangan || '',
      is_active: item.is_active || false
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.tipe_hari || !formData.jam_masuk || !formData.jam_pulang) {
      Swal.fire({ icon: 'warning', title: 'Data Kurang Lengkap', text: 'Tipe hari, jam masuk, dan jam pulang wajib diisi!' });
      return;
    }

    setIsSaving(true);
    try {
      // Jika disetel sebagai aktif, nonaktifkan yang lain dulu
      if (formData.is_active) {
        await supabase.from('master_jam_presensi').update({ is_active: false }).neq('id', 0);
      }

      const payload = {
        tipe_hari: formData.tipe_hari,
        jam_masuk: formData.jam_masuk,
        jam_pulang: formData.jam_pulang,
        keterangan: formData.keterangan,
        is_active: formData.is_active
      };

      if (selectedItem && selectedItem.id) {
        const { error } = await supabase.from('master_jam_presensi').update(payload).eq('id', selectedItem.id);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Opsi jam presensi berhasil diperbarui.', timer: 1500, showConfirmButton: false });
      } else {
        const { error } = await supabase.from('master_jam_presensi').insert([payload]);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Opsi jam presensi berhasil ditambahkan.', timer: 1500, showConfirmButton: false });
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Save error:', err);
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetActive = async (item) => {
    if (item.is_active) return;
    const res = await Swal.fire({
      title: 'Aktifkan Opsi Ini?',
      text: `Seluruh sistem presensi (Web & Mobile) akan otomatis mengikuti aturan "${item.tipe_hari}" (Masuk: ${item.jam_masuk}, Pulang: ${item.jam_pulang}).`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2a2c87',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Aktifkan!',
      cancelButtonText: 'Batal'
    });

    if (res.isConfirmed) {
      try {
        await supabase.from('master_jam_presensi').update({ is_active: false }).neq('id', 0);
        const { error } = await supabase.from('master_jam_presensi').update({ is_active: true }).eq('id', item.id);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Aktif!', text: `Opsi "${item.tipe_hari}" kini diterapkan di seluruh sistem.`, timer: 2000, showConfirmButton: false });
        fetchData();
      } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengubah status aktif.' });
      }
    }
  };

  const handleDelete = async (item) => {
    if (item.is_active) {
      Swal.fire({ icon: 'warning', title: 'Tidak Dapat Dihapus', text: 'Opsi jam ini sedang AKTIF digunakan. Silakan aktifkan opsi lain terlebih dahulu sebelum menghapus.' });
      return;
    }

    const result = await Swal.fire({
      title: 'Hapus Opsi Jam?',
      text: `Anda yakin ingin menghapus opsi "${item.tipe_hari}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from('master_jam_presensi').delete().eq('id', item.id);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Terhapus!', text: 'Opsi jam berhasil dihapus.', timer: 1500, showConfirmButton: false });
        fetchData();
      } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan saat menghapus data.' });
      }
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Clock className="text-primary" /> Master Jam Presensi Global
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Atur aturan jam masuk & jam pulang presensi siswa secara terpusat untuk seluruh perangkat Web Admin dan Mobile App.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleOpenAdd} 
            disabled={tableMissing}
            className={`px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm ${tableMissing ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-primary hover:bg-blue-900 text-white'}`}
          >
            <Plus size={16} /> Tambah Opsi Jadwal
          </button>
          <button 
            onClick={fetchData} 
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg shadow-sm flex items-start gap-3">
          <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="text-amber-800 font-bold text-base">Tabel Master Jam Presensi Belum Dibuat di Database</h3>
            <p className="text-amber-700 text-sm mt-1">
              Agar fitur manajemen jam presensi terpusat ini berfungsi, silakan jalankan script SQL yang tersedia pada file <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">setup_master_jam_presensi.sql</code> di menu SQL Editor Supabase Anda.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Tipe Hari / Jadwal</th>
                <th className="px-6 py-4">Batas Jam Masuk</th>
                <th className="px-6 py-4">Batas Jam Pulang</th>
                <th className="px-6 py-4">Keterangan</th>
                <th className="px-6 py-4 text-center">Status Aktif</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">Memuat data...</td>
                </tr>
              ) : data.length === 0 && !tableMissing ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">Belum ada data opsi jam presensi.</td>
                </tr>
              ) : tableMissing ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">Tabel belum tersedia di Supabase.</td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 transition ${item.is_active ? 'bg-indigo-50/40 font-medium' : ''}`}>
                    <td className="px-6 py-4 font-bold text-primary flex items-center gap-2">
                      {item.tipe_hari}
                      {item.is_active && <CheckCircle size={16} className="text-emerald-500" title="Aktif saat ini" />}
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-semibold font-mono text-base">
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-200">
                        {item.jam_masuk?.substring(0, 5)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-semibold font-mono text-base">
                      <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md border border-purple-200">
                        {item.jam_pulang?.substring(0, 5)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs max-w-xs truncate" title={item.keterangan || '-'}>
                      {item.keterangan || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          AKTIF DIGUNAKAN
                        </span>
                      ) : (
                        <button 
                          onClick={() => handleSetActive(item)} 
                          className="px-3 py-1 bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 border border-gray-200 hover:border-emerald-300 rounded-full text-xs font-semibold transition shadow-sm"
                        >
                          Gunakan Jadwal Ini
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenEdit(item)} 
                          className="text-yellow-600 hover:text-yellow-800 font-medium bg-yellow-50 px-2.5 py-1.5 rounded-md hover:bg-yellow-100 transition flex items-center gap-1 text-xs" 
                          title="Edit"
                        >
                          <Edit size={14} /> Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(item)} 
                          className="text-red-600 hover:text-red-800 font-medium bg-red-50 px-2.5 py-1.5 rounded-md hover:bg-red-100 transition flex items-center gap-1 text-xs" 
                          title="Hapus"
                        >
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-fadeIn">
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3">
              {selectedItem ? 'Edit Opsi Jam Presensi' : 'Tambah Opsi Jam Presensi'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Tipe Hari / Nama Opsi <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={formData.tipe_hari}
                  onChange={(e) => setFormData({ ...formData, tipe_hari: e.target.value })}
                  placeholder="Contoh: Hari Reguler / Ramadhan"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Batas Jam Masuk <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="time" 
                    value={formData.jam_masuk}
                    onChange={(e) => setFormData({ ...formData, jam_masuk: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm font-bold bg-blue-50 text-blue-800 font-mono"
                    required
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Lewat jam ini = Terlambat</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Batas Jam Pulang <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="time" 
                    value={formData.jam_pulang}
                    onChange={(e) => setFormData({ ...formData, jam_pulang: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm font-bold bg-purple-50 text-purple-800 font-mono"
                    required
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Sebelum jam ini = Bolos</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea 
                  rows="2"
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  placeholder="Catatan atau deskripsi penggunaan jadwal ini..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <input 
                  type="checkbox" 
                  id="chk_active" 
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  disabled={selectedItem && selectedItem.is_active} // jika sudah aktif, tidak bisa dichecklist off di sini
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <label htmlFor="chk_active" className="text-sm font-semibold text-gray-800 cursor-pointer">
                  Jadikan Jadwal Aktif Saat Ini
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-sm transition"
                  disabled={isSaving}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-primary hover:bg-blue-900 text-white font-bold rounded-lg text-sm transition flex items-center gap-2 shadow-md"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Simpan Data
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
