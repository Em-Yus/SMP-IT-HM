import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { Clock, Plus, RefreshCw, Trash2, Edit, CheckCircle, AlertCircle, X, Check, DollarSign, ShieldAlert } from 'lucide-react';
import Swal from 'sweetalert2';

export default function MasterJamGuru() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    tipe_hari: '',
    jam_masuk: '08:00',
    jam_pulang: '13:00',
    honor_kehadiran: 5000,
    honor_per_jp: 6500,
    keterangan: '',
    is_active: false
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkRoleAndFetch();
  }, []);

  const checkRoleAndFetch = async () => {
    setIsLoading(true);
    const userSession = localStorage.getItem('user_guru');
    if (!userSession) {
      navigate('/login-guru');
      return;
    }

    try {
      const userObj = JSON.parse(userSession);
      let allowed = userObj?.role === 'admin';

      if (!allowed && userObj?.id) {
        const { data: jData } = await supabase.from('jabatan_guru').select('*').eq('guru_id', userObj.id).maybeSingle();
        if (jData) {
          const roles = [jData.jabatan_utama, jData.jabatan_lain_1, jData.jabatan_lain_2, jData.jabatan_lain_3].filter(Boolean);
          allowed = roles.some(r => {
            const lower = (r || '').toLowerCase();
            return lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara') || lower.includes('waka') || lower.includes('kurikulum') || lower.includes('operator') || lower.includes('admin');
          });
        }
      }

      setIsAuthorized(allowed);

      if (!allowed) {
        Swal.fire({
          icon: 'warning',
          title: 'Akses Dibatasi',
          text: 'Menu Jam & Standar hanya dapat diakses oleh Kepala Sekolah, Bendahara, dan Waka. Kurikulum.',
          confirmButtonColor: '#1e3a8a',
          confirmButtonText: 'Buka Halaman Honor'
        }).then(() => {
          navigate('/rekap-honor-guru');
        });
        setIsLoading(false);
        return;
      }

      const { data: result, error } = await supabase
        .from('master_jam_presensi_guru')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setData(result || []);
    } catch (err) {
      console.error('Error fetching master_jam_presensi_guru:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data master jam kerja guru.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setSelectedItem(null);
    setFormData({
      tipe_hari: '',
      jam_masuk: '08:00',
      jam_pulang: '13:00',
      honor_kehadiran: 5000,
      honor_per_jp: 6500,
      keterangan: '',
      is_active: data.length === 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      tipe_hari: item.tipe_hari || '',
      jam_masuk: (item.jam_masuk || '08:00').substring(0, 5),
      jam_pulang: (item.jam_pulang || '13:00').substring(0, 5),
      honor_kehadiran: item.honor_kehadiran || 5000,
      honor_per_jp: item.honor_per_jp || 6500,
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
      if (formData.is_active) {
        await supabase.from('master_jam_presensi_guru').update({ is_active: false }).neq('id', 0);
      }

      const payload = {
        tipe_hari: formData.tipe_hari,
        jam_masuk: formData.jam_masuk,
        jam_pulang: formData.jam_pulang,
        honor_kehadiran: Number(formData.honor_kehadiran) || 5000,
        honor_per_jp: Number(formData.honor_per_jp) || 6500,
        keterangan: formData.keterangan,
        is_active: formData.is_active
      };

      if (selectedItem && selectedItem.id) {
        const { error } = await supabase.from('master_jam_presensi_guru').update(payload).eq('id', selectedItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('master_jam_presensi_guru').insert([payload]);
        if (error) throw error;
      }

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Jadwal jam kerja guru berhasil disimpan.', timer: 1500, showConfirmButton: false });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetActive = async (item) => {
    try {
      await supabase.from('master_jam_presensi_guru').update({ is_active: false }).neq('id', 0);
      const { error } = await supabase.from('master_jam_presensi_guru').update({ is_active: true }).eq('id', item.id);
      if (error) throw error;

      Swal.fire({ icon: 'success', title: 'Berhasil Diaktifkan', text: `Opsi "${item.tipe_hari}" kini aktif sebagai jam presensi guru.`, timer: 1500, showConfirmButton: false });
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengaktifkan jadwal.' });
    }
  };

  const handleDelete = (item) => {
    Swal.fire({
      title: 'Hapus Opsi Jadwal?',
      text: `Apakah Anda yakin ingin menghapus "${item.tipe_hari}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const { error } = await supabase.from('master_jam_presensi_guru').delete().eq('id', item.id);
          if (error) throw error;

          Swal.fire({ icon: 'success', title: 'Dihapus', text: 'Opsi jadwal berhasil dihapus.', timer: 1500, showConfirmButton: false });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menghapus data.' });
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Memeriksa hak akses & data...</p>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-3xl border border-red-100 shadow-sm text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">Akses Dibatasi</h3>
        <p className="text-sm text-gray-600 mb-6">
          Halaman Master Jam & Standar hanya dapat diakses oleh Kepala Sekolah, Bendahara, dan Waka. Kurikulum.
        </p>
        <button
          onClick={() => navigate('/rekap-honor-guru')}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition shadow"
        >
          <DollarSign size={18} /> Buka Rekap Honor Saya
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Clock className="text-primary" /> Master Jam Kerja & Standar Honor Guru
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Atur jam wajib kehadiran guru (masuk/pulang) dan standar nominal honor per hari / per jam pelajaran (JP).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={checkRoleAndFetch}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-primary hover:bg-blue-900 text-white px-4 py-2.5 rounded-xl font-semibold shadow-md shadow-blue-500/10 transition"
          >
            <Plus size={18} /> Tambah Jam Kerja
          </button>
        </div>
      </div>

      {/* Info Card Ketentuan */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
        <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-2">
          <DollarSign size={18} className="text-primary" /> Ketentuan Honor & Absensi Guru
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-800">
          <div className="bg-white/80 p-3 rounded-xl border border-blue-100">
            <p className="font-bold text-primary mb-1">1. Absen Kehadiran Sekolah (Hadir & Pulang):</p>
            <ul className="list-disc pl-4 space-y-1 text-gray-700">
              <li>Hadir tepat waktu & pulang sesuai jadwal: <b>Rp 5.000,- / hari</b>.</li>
              <li>Terlambat ATAU Pulang sebelum waktunya: dipotong 50% (<b>Rp 2.500,-</b>).</li>
              <li>Terlambat DAN Pulang sebelum waktunya: <b>Rp 0,- (Hangus)</b>.</li>
            </ul>
          </div>
          <div className="bg-white/80 p-3 rounded-xl border border-blue-100">
            <p className="font-bold text-primary mb-1">2. Absen Mengisi Pelajaran (KBM Kelas):</p>
            <ul className="list-disc pl-4 space-y-1 text-gray-700">
              <li>Honor mengajar 1 Jam Pelajaran (JP): <b>Rp 6.500,-</b> mengacu pada jadwal KBM.</li>
              <li>Walaupun terlambat atau keluar lebih dulu di luar ketentuan KBM, <b>TIDAK ADA pemotongan honor sama sekali (dibayar penuh)</b>.</li>
              <li>Guru pengganti (inval) otomatis berhak atas honor KBM yang digantikan.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-b border-gray-100">
                <th className="py-4 px-6">Tipe Hari / Opsi</th>
                <th className="py-4 px-6">Jam Masuk</th>
                <th className="py-4 px-6">Jam Pulang</th>
                <th className="py-4 px-6">Honor Kehadiran</th>
                <th className="py-4 px-6">Honor per JP</th>
                <th className="py-4 px-6">Keterangan</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-gray-400">
                    <RefreshCw className="animate-spin inline mr-2 text-primary" size={20} />
                    Memuat data jadwal kerja guru...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-gray-400">
                    Belum ada opsi jam kerja guru yang dibuat.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-gray-50/60 ${item.is_active ? 'bg-emerald-50/40' : ''}`}
                  >
                    <td className="py-4 px-6 font-semibold text-gray-800">
                      {item.tipe_hari}
                      {item.is_active && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          <Check size={10} /> Aktif Sekarang
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        {item.jam_masuk.substring(0, 5)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                        {item.jam_pulang.substring(0, 5)}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-emerald-600">
                      Rp {(Number(item.honor_kehadiran) || 5000).toLocaleString('id-ID')}
                    </td>
                    <td className="py-4 px-6 font-bold text-indigo-600">
                      Rp {(Number(item.honor_per_jp) || 6500).toLocaleString('id-ID')}
                    </td>
                    <td className="py-4 px-6 text-gray-500 max-w-xs truncate">
                      {item.keterangan || '-'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {item.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle size={14} /> Digunakan
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetActive(item)}
                          className="text-xs bg-gray-100 hover:bg-emerald-600 hover:text-white text-gray-600 px-3 py-1 rounded-full font-medium transition"
                        >
                          Aktifkan
                        </button>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus"
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

      {/* Modal Tambah / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Clock className="text-primary" size={20} />
                {selectedItem ? 'Edit Jam Kerja Guru' : 'Tambah Jam Kerja Guru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Tipe Hari / Nama Jadwal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Hari Reguler (Normal), Ramadhan, dll."
                  value={formData.tipe_hari}
                  onChange={(e) => setFormData({ ...formData, tipe_hari: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                    Jam Masuk <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.jam_masuk}
                    onChange={(e) => setFormData({ ...formData, jam_masuk: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                    Jam Pulang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.jam_pulang}
                    onChange={(e) => setFormData({ ...formData, jam_pulang: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono font-bold bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                    Honor Kehadiran (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.honor_kehadiran}
                    onChange={(e) => setFormData({ ...formData, honor_kehadiran: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-bold text-emerald-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                    Honor per JP (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.honor_per_jp}
                    onChange={(e) => setFormData({ ...formData, honor_per_jp: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-bold text-indigo-600 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Keterangan (Opsional)
                </label>
                <textarea
                  rows="2"
                  placeholder="Catatan tambahan untuk jadwal ini..."
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
                ></textarea>
              </div>

              <div className="flex items-center gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="is_active" className="text-xs text-emerald-900 font-semibold cursor-pointer">
                  Jadikan Jadwal Aktif Sekarang (Default Guru)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold text-sm transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-900 text-white font-semibold text-sm shadow-md transition flex items-center gap-2"
                >
                  {isSaving ? <RefreshCw className="animate-spin" size={16} /> : null}
                  {isSaving ? 'Menyimpan...' : 'Simpan Jam Kerja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
