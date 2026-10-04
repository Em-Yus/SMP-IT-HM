import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Megaphone, Plus, Trash2, Edit, Save, X, EyeOff, Eye, Search, UserCheck } from 'lucide-react';
import Swal from 'sweetalert2';
import { sendAnnouncementPushNotification } from '../services/pushNotificationService';
import { formatTargetBadge } from '../utils/pengumumanHelper';

export default function CmsPengumuman() {
  const [dataPengumuman, setDataPengumuman] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // Form State
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [target, setTarget] = useState('Semua');
  const [targetType, setTargetType] = useState('Semua');
  const [selectedKelas, setSelectedKelas] = useState('7');
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [searchSiswaQuery, setSearchSiswaQuery] = useState('');
  const [status, setStatus] = useState('Aktif');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pengumumanRes, kelasRes, siswaRes] = await Promise.all([
        supabase.from('cms_pengumuman').select('*').order('created_at', { ascending: false }),
        supabase.from('data_kelas').select('id, nama_kelas').order('id'),
        supabase.from('data_siswa').select('id, nama, nipd, nisn, kelas').order('nama'),
      ]);

      if (pengumumanRes.error) throw pengumumanRes.error;
      setDataPengumuman(pengumumanRes.data || []);
      setKelasList(kelasRes.data || []);
      setSiswaList(siswaRes.data || []);
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
      setStatus(item.status);
      setTarget(item.target);

      const t = String(item.target || '').trim();
      if (t === 'Semua' || t === 'Publik') {
        setTargetType('Semua');
      } else if (t === 'Guru') {
        setTargetType('Guru');
      } else if (t === 'Siswa') {
        setTargetType('Siswa');
      } else if (t.startsWith('Kelas:')) {
        setTargetType('Kelas');
        setSelectedKelas(t.replace('Kelas:', '').trim());
      } else if (t.startsWith('Siswa:')) {
        setTargetType('Siswa_Spesifik');
        const matchId = t.match(/\[(\d+)\]/);
        if (matchId && matchId[1]) {
          const found = siswaList.find((s) => String(s.id) === matchId[1]);
          if (found) setSelectedSiswa(found);
        }
      }
    } else {
      setIsEditing(false);
      setEditId(null);
      setJudul('');
      setIsi('');
      setTarget('Semua');
      setTargetType('Semua');
      setStatus('Aktif');
      setSelectedKelas(kelasList[0]?.nama_kelas || '7');
      setSelectedSiswa(null);
      setSearchSiswaQuery('');
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
        if (status === 'Aktif') {
          const pushRes = await sendAnnouncementPushNotification({
            judul: payload.judul,
            isi: payload.isi,
            target: payload.target,
          });
          if (pushRes.success && pushRes.sentCount > 0) {
            let detailMsg = `Pengumuman berhasil disimpan & terkirim ke ${pushRes.sentCount} perangkat (${payload.target}).`;
            if (pushRes.failedCount > 0) {
              detailMsg += `<br><small class="text-gray-500">${pushRes.failedCount} perangkat lain belum terkirim (kendala konfigurasi project/FCM).</small>`;
            }
            Swal.fire({
              title: 'Berhasil',
              html: detailMsg,
              icon: 'success',
            });
          } else if (pushRes.failedCount > 0) {
            Swal.fire({
              title: 'Tersimpan',
              html: `Pengumuman disimpan, namun notifikasi gagal dikirim ke ${pushRes.failedCount} perangkat.<br><small class="text-red-500">${pushRes.errors?.[0] || ''}</small>`,
              icon: 'warning',
            });
          } else {
            Swal.fire('Berhasil', 'Pengumuman baru berhasil ditambahkan.', 'success');
          }
        } else {
          Swal.fire('Berhasil', 'Pengumuman baru berhasil ditambahkan (Status: Nonaktif/Arsip).', 'success');
        }
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
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
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
        <div className="w-full md:w-auto flex gap-2 mt-4 sm:mt-0">
          <button
            onClick={async () => {
              Swal.fire({ title: 'Mengirim notifikasi uji coba...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
              const result = await sendAnnouncementPushNotification({
                judul: 'Uji Coba Web CMS',
                isi: 'Ini pesan uji coba pengumuman dari Web CMS SMP IT HM.',
                target: 'Semua',
              });
              if (result.success && result.sentCount > 0) {
                let msg = `Notifikasi berhasil terkirim ke <b>${result.sentCount}</b> perangkat!`;
                if (result.failedCount > 0) {
                  msg += `<br><br><span class="text-sm text-gray-500">Catatan: <b>${result.failedCount}</b> perangkat belum terkirim karena perbedaan project / FCM belum terhubung:<br><span class="text-xs text-red-500">${result.errors?.[0] || ''}</span></span>`;
                }
                Swal.fire({
                  title: 'Hasil Pengiriman',
                  html: msg,
                  icon: result.failedCount > 0 ? 'info' : 'success',
                });
              } else if (result.failedCount > 0) {
                Swal.fire({
                  title: 'Pengiriman Gagal',
                  html: `Gagal mengirim ke ${result.failedCount} perangkat.<br><span class="text-xs text-red-500">${result.errors?.[0] || result.error || ''}</span>`,
                  icon: 'error',
                });
              } else {
                Swal.fire('Info', 'Tidak ada perangkat terdaftar yang aktif.', 'info');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition shadow-lg shadow-yellow-500/30"
          >
            <Megaphone size={18} />
            <span className="hidden sm:inline">Test Notif</span>
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[#85c226] text-white rounded-xl hover:bg-[#73a81f] transition shadow-lg shadow-[#85c226]/30"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Pengumuman Baru</span>
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
                      {(() => {
                        const badge = formatTargetBadge(item.target);
                        return (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${badge.color}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium text-xs">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border transition ${item.status === 'Aktif'
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

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Target Pembaca</label>
                      <select
                        value={targetType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTargetType(val);
                          if (val === 'Semua') setTarget('Semua');
                          else if (val === 'Guru') setTarget('Guru');
                          else if (val === 'Siswa') setTarget('Siswa');
                          else if (val === 'Kelas') {
                            const defK = selectedKelas || kelasList[0]?.nama_kelas || '7';
                            setTarget(`Kelas: ${defK}`);
                          } else if (val === 'Siswa_Spesifik') {
                            const s = selectedSiswa || siswaList[0];
                            if (s) {
                              setSelectedSiswa(s);
                              setTarget(`Siswa: [${s.id}] [${s.nipd}] ${s.nama} (${s.kelas || '-'})`);
                            }
                          }
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] font-medium"
                      >
                        <option value="Semua">Semua Pengguna (Guru, Siswa, Publik)</option>
                        <option value="Guru">Khusus Guru</option>
                        <option value="Siswa">Semua Siswa (Seluruh Kelas)</option>
                        <option value="Kelas">Kelas Tertentu (Tingkat / Rombel)</option>
                        <option value="Siswa_Spesifik">Siswa Tertentu (1 Penerima Tunggal)</option>
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

                  {/* Sub-Selector jika Target adalah Kelas Tertentu */}
                  {targetType === 'Kelas' && (
                    <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2 animate-in fade-in duration-150">
                      <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
                        Pilih Kelas Sasaran Ujian / Pengumuman :
                      </label>
                      <select
                        value={selectedKelas}
                        onChange={(e) => {
                          setSelectedKelas(e.target.value);
                          setTarget(`Kelas: ${e.target.value}`);
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-amber-300 rounded-xl font-semibold text-gray-800 focus:ring-2 focus:ring-amber-500 text-sm"
                      >
                        <optgroup label="Tingkat Kelas (Mencakup Semua Rombel)">
                          <option value="7">Tingkat Kelas 7 (Semua VII-A, VII-B, dst.)</option>
                          <option value="8">Tingkat Kelas 8 (Semua VIII-A, VIII-B, dst.)</option>
                          <option value="9">Tingkat Kelas 9 (Semua IX-A, IX-B, IX-C, dst.)</option>
                        </optgroup>
                        <optgroup label="Rombel Spesifik">
                          {kelasList.map((k) => (
                            <option key={k.id} value={k.nama_kelas}>
                              Kelas {k.nama_kelas}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <p className="text-[11.5px] text-amber-800 font-medium">
                        Pengumuman ini hanya akan dapat dilihat oleh siswa di kelas yang dipilih. Siswa di kelas lain tidak akan mendapatkan atau melihat pengumuman ini.
                      </p>
                    </div>
                  )}

                  {/* Sub-Selector jika Target adalah 1 Siswa Spesifik */}
                  {targetType === 'Siswa_Spesifik' && (
                    <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl space-y-3 animate-in fade-in duration-150">
                      <label className="block text-xs font-bold text-purple-900 uppercase tracking-wider">
                        Pilih 1 Siswa Penerima :
                      </label>
                      <div className="relative">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400" />
                        <input
                          type="text"
                          placeholder="Cari nama siswa, NIPD, atau kelas..."
                          value={searchSiswaQuery}
                          onChange={(e) => setSearchSiswaQuery(e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 font-medium"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-purple-200 rounded-xl bg-white divide-y divide-purple-50 custom-scrollbar">
                        {siswaList
                          .filter((s) => {
                            if (!searchSiswaQuery.trim()) return true;
                            const q = searchSiswaQuery.toLowerCase();
                            return (
                              (s.nama || '').toLowerCase().includes(q) ||
                              (s.nipd || '').includes(q) ||
                              (s.nisn || '').includes(q) ||
                              (s.kelas || '').toLowerCase().includes(q)
                            );
                          })
                          .map((s) => {
                            const isSelected = selectedSiswa?.id === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSiswa(s);
                                  setTarget(`Siswa: [${s.id}] [${s.nipd}] ${s.nama} (${s.kelas || '-'})`);
                                }}
                                className={`w-full text-left p-2.5 flex items-center justify-between text-xs transition cursor-pointer ${
                                  isSelected ? 'bg-purple-100 font-bold text-purple-900' : 'hover:bg-purple-50/60 text-gray-700'
                                }`}
                              >
                                <div>
                                  <p className="font-semibold text-gray-800">{s.nama}</p>
                                  <p className="text-[11px] text-gray-500">Kelas: {s.kelas || '-'} • NIPD: {s.nipd || '-'}</p>
                                </div>
                                {isSelected && (
                                  <span className="px-2 py-0.5 bg-purple-600 text-white text-[10px] rounded-full font-bold">
                                    Terpilih
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                      {selectedSiswa && (
                        <div className="flex items-center gap-2 text-xs font-bold text-purple-900 bg-purple-100 px-3 py-2 rounded-xl">
                          <UserCheck size={16} className="text-purple-700" />
                          <span>Penerima Tertuju: {selectedSiswa.nama} (Kelas {selectedSiswa.kelas || '-'})</span>
                        </div>
                      )}
                    </div>
                  )}
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
