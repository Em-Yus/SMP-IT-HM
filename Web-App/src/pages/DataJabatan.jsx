import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Briefcase, Plus, RefreshCw, Trash2, Edit, Save, X, ShieldCheck, Filter, Award, Users } from 'lucide-react';
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
    honor: 0,
    hak_akses: []
  });

  // State Panitia Ujian CBT
  const [isPanitiaModalOpen, setIsPanitiaModalOpen] = useState(false);
  const [guruList, setGuruList] = useState([]);
  const [currentPanitia, setCurrentPanitia] = useState(null);
  const [isSavingPanitia, setIsSavingPanitia] = useState(false);
  const [panitiaForm, setPanitiaForm] = useState({
    id: null,
    tahun_ajaran: '2025/2026',
    semester: 'Genap',
    ketua_panitia_guru_id: '',
    sekretaris_guru_id: '',
    bendahara_guru_id: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resJabatan, resGuru, resGuruJabatan] = await Promise.all([
        supabase.from('data_jabatan').select('*').order('nama_jabatan', { ascending: true }),
        supabase.from('data_guru').select('id, nama').is('tanggal_keluar', null).order('nama', { ascending: true }),
        supabase.from('jabatan_guru').select('guru_id, jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3, data_guru:guru_id(nama)')
      ]);

      if (resJabatan.error) throw resJabatan.error;
      setDataJabatan(resJabatan.data || []);
      setGuruList(resGuru.data || []);

      const listGuruJabatan = resGuruJabatan.data || [];
      const foundKetua = listGuruJabatan.find(jg => {
        const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
        return jRoles.some(r => (r || '').toLowerCase().includes('ketua panitia'));
      });
      const foundSekretaris = listGuruJabatan.find(jg => {
        const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
        return jRoles.some(r => (r || '').toLowerCase().includes('sekretaris'));
      });
      const foundBendahara = listGuruJabatan.find(jg => {
        const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
        return jRoles.some(r => (r || '').toLowerCase().includes('bendahara panitia'));
      });

      if (foundKetua || foundSekretaris || foundBendahara) {
        if (foundKetua) {
          setCurrentPanitia({
            ketua_panitia_guru_id: foundKetua.guru_id,
            data_guru: foundKetua.data_guru
          });
        }
        setPanitiaForm(prev => ({
          ...prev,
          ketua_panitia_guru_id: foundKetua ? String(foundKetua.guru_id) : prev.ketua_panitia_guru_id,
          sekretaris_guru_id: foundSekretaris ? String(foundSekretaris.guru_id) : prev.sekretaris_guru_id,
          bendahara_guru_id: foundBendahara ? String(foundBendahara.guru_id) : prev.bendahara_guru_id,
        }));
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data jabatan' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePanitia = async () => {
    if (!panitiaForm.ketua_panitia_guru_id) {
      Swal.fire('Peringatan', 'Ketua Panitia Ujian wajib dipilih!', 'warning');
      return;
    }

    setIsSavingPanitia(true);
    try {
      const ketuaGuruId = Number(panitiaForm.ketua_panitia_guru_id);

      // 1. Simpan Ketua Panitia ke jabatan_guru
      const { data: existingJabatan } = await supabase
        .from('jabatan_guru')
        .select('*')
        .eq('guru_id', ketuaGuruId)
        .maybeSingle();

      if (existingJabatan) {
        const roles = [existingJabatan.jabatan_utama, existingJabatan.jabatan_lain_1, existingJabatan.jabatan_lain_2, existingJabatan.jabatan_lain_3];
        if (!roles.some(r => (r || '').toLowerCase().includes('ketua panitia'))) {
          const targetCol = !existingJabatan.jabatan_lain_1 ? 'jabatan_lain_1' : !existingJabatan.jabatan_lain_2 ? 'jabatan_lain_2' : 'jabatan_lain_3';
          await supabase.from('jabatan_guru').update({ [targetCol]: 'Ketua Panitia Ujian' }).eq('id', existingJabatan.id);
        }
      } else {
        await supabase.from('jabatan_guru').insert([{
          guru_id: ketuaGuruId,
          jabatan_utama: 'Ketua Panitia Ujian'
        }]);
      }

      // 2. Simpan Sekretaris Panitia ke jabatan_guru jika dipilih
      if (panitiaForm.sekretaris_guru_id) {
        const sekGuruId = Number(panitiaForm.sekretaris_guru_id);
        const { data: existingSek } = await supabase
          .from('jabatan_guru')
          .select('*')
          .eq('guru_id', sekGuruId)
          .maybeSingle();

        if (existingSek) {
          const roles = [existingSek.jabatan_utama, existingSek.jabatan_lain_1, existingSek.jabatan_lain_2, existingSek.jabatan_lain_3];
          if (!roles.some(r => (r || '').toLowerCase().includes('sekretaris'))) {
            const targetCol = !existingSek.jabatan_lain_1 ? 'jabatan_lain_1' : !existingSek.jabatan_lain_2 ? 'jabatan_lain_2' : 'jabatan_lain_3';
            await supabase.from('jabatan_guru').update({ [targetCol]: 'Sekretaris Panitia Ujian' }).eq('id', existingSek.id);
          }
        } else {
          await supabase.from('jabatan_guru').insert([{
            guru_id: sekGuruId,
            jabatan_utama: 'Sekretaris Panitia Ujian'
          }]);
        }
      }

      // 3. Simpan ke cbt_struktur_panitia
      await supabase.from('cbt_struktur_panitia').insert([{
        tahun_ajaran: panitiaForm.tahun_ajaran || '2025/2026',
        semester: panitiaForm.semester || 'Ganjil',
        ketua_panitia_guru_id: ketuaGuruId,
        sekretaris_guru_id: panitiaForm.sekretaris_guru_id ? Number(panitiaForm.sekretaris_guru_id) : null,
        bendahara_guru_id: panitiaForm.bendahara_guru_id ? Number(panitiaForm.bendahara_guru_id) : null,
      }]);

      Swal.fire('Berhasil', 'Struktur Panitia Ujian berhasil disimpan. Alur ujian sekarang aktif untuk Ketua dan Sekretaris Panitia.', 'success');
      setIsPanitiaModalOpen(false);
      fetchData();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e.message || 'Gagal menyimpan struktur panitia.', 'error');
    } finally {
      setIsSavingPanitia(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setFormJabatan({ id: null, nama_jabatan: '', deskripsi: '', kelompok_jabatan: '', honor: 0, hak_akses: [] });
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setFormJabatan({
      id: item.id,
      nama_jabatan: item.nama_jabatan || '',
      deskripsi: item.deskripsi || '',
      kelompok_jabatan: item.kelompok_jabatan || '',
      honor: item.honor || 0,
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
        honor: Number(formJabatan.honor) || 0,
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
          <button 
            onClick={() => setIsPanitiaModalOpen(true)} 
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm"
          >
            <Award size={16} /> Struktur Panitia Ujian
            {currentPanitia && (
              <span className="bg-amber-800 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">Aktif</span>
            )}
          </button>
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
                <th className="px-6 py-4">Tunjangan / Honor</th>
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
                    <td className="px-6 py-4 font-bold text-emerald-600">
                      Rp {(Number(item.honor) || 0).toLocaleString('id-ID')}
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tunjangan / Honor Jabatan (Rp)</label>
                  <input 
                    type="number" 
                    value={formJabatan.honor}
                    onChange={(e) => setFormJabatan({...formJabatan, honor: e.target.value})}
                    placeholder="Contoh: 250000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">Nominal honor/tunjangan bulanan untuk pemegang jabatan ini.</p>
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

      {/* Modal Struktur Panitia Ujian CBT */}
      {isPanitiaModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Award size={20} /> Struktur Panitia Ujian CBT
                </h3>
                <p className="text-amber-100 text-xs mt-0.5">
                  Menentukan penanggung jawab pelaksanaan ujian sekolah
                </p>
              </div>
              <button 
                onClick={() => setIsPanitiaModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
                <strong>Catatan Alur CBT:</strong> Menentukan Ketua Panitia di sini akan membuka akses menu ujian pertama kali (*Tata Tertib Pengawas*) untuk guru yang dipilih sebagai Ketua Panitia.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tahun Ajaran</label>
                  <input
                    type="text"
                    value={panitiaForm.tahun_ajaran}
                    onChange={(e) => setPanitiaForm({ ...panitiaForm, tahun_ajaran: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="2025/2026"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Semester</label>
                  <select
                    value={panitiaForm.semester}
                    onChange={(e) => setPanitiaForm({ ...panitiaForm, semester: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ketua Panitia Ujian <span className="text-red-500">*</span>
                </label>
                <select
                  value={panitiaForm.ketua_panitia_guru_id}
                  onChange={(e) => setPanitiaForm({ ...panitiaForm, ketua_panitia_guru_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                >
                  <option value="">-- Pilih Guru / Pegawai --</option>
                  {guruList.map(g => (
                    <option key={g.id} value={g.id}>{g.nama}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Sekretaris Panitia
                </label>
                <select
                  value={panitiaForm.sekretaris_guru_id}
                  onChange={(e) => setPanitiaForm({ ...panitiaForm, sekretaris_guru_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">-- Tidak Ada / Opsional --</option>
                  {guruList.map(g => (
                    <option key={g.id} value={g.id}>{g.nama}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Bendahara Panitia
                </label>
                <select
                  value={panitiaForm.bendahara_guru_id}
                  onChange={(e) => setPanitiaForm({ ...panitiaForm, bendahara_guru_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">-- Tidak Ada / Opsional --</option>
                  {guruList.map(g => (
                    <option key={g.id} value={g.id}>{g.nama}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button 
                onClick={() => setIsPanitiaModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition text-sm"
              >
                Batal
              </button>
              <button 
                onClick={handleSavePanitia}
                disabled={isSavingPanitia}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition text-sm flex items-center gap-2 shadow-sm"
              >
                {isSavingPanitia ? 'Menyimpan...' : <><Save size={16} /> Simpan Panitia</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
