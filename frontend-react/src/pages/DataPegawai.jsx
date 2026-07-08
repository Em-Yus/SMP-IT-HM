import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, Plus, RefreshCw, Briefcase, FileDown, Info, Book, X, Save, CheckCircle, UserMinus, ShieldCheck, Edit, Contact, Camera, Upload, User } from 'lucide-react';
import { menusConfig } from '../utils/menuConfig';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';

export default function DataPegawai() {
  const [dataPegawai, setDataPegawai] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Data Referensi
  const [dataKelas, setDataKelas] = useState([]);
  const [dataMapel, setDataMapel] = useState([]);
  const [dataJabatanList, setDataJabatanList] = useState([]);

  // State Modals
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedGuruDetail, setSelectedGuruDetail] = useState(null);

  // Edit Pegawai
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editFotoFile, setEditFotoFile] = useState(null);
  const [editFotoPreview, setEditFotoPreview] = useState(null);
  const [editFormData, setEditFormData] = useState({
    id: '', nik: '', nama: '', nip: '', nuptk: '', niy: '', no_wa: '',
    tempat_lahir: '', tanggal_lahir: '', nama_ibu: '', agama: 'Islam',
    status_perkawinan: 'Belum Kawin', pendidikan: '', alamat: '',
    status_pegawai: 'GTY/PTY', tanggal_masuk: '', foto_url: ''
  });

  const [isJabatanModalOpen, setIsJabatanModalOpen] = useState(false);
  const [selectedGuruJabatan, setSelectedGuruJabatan] = useState(null);
  const [jabatanForm, setJabatanForm] = useState({
    id: null,
    jabatan_utama: '',
    jabatan_lain_1: '',
    jabatan_lain_2: '',
    jabatan_lain_3: '',
    hak_akses: []
  });
  const [isSavingJabatan, setIsSavingJabatan] = useState(false);

  const [isPembelajaranModalOpen, setIsPembelajaranModalOpen] = useState(false);
  const [selectedGuruPembelajaran, setSelectedGuruPembelajaran] = useState(null);
  // Bentuk state: { [kelas_id]: [mapel_id_1, mapel_id_2, ...] }
  const [pembelajaranSelection, setPembelajaranSelection] = useState({});
  const [isSavingPembelajaran, setIsSavingPembelajaran] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_guru')
        .select('*')
        .is('tanggal_keluar', null)
        .order('nama', { ascending: true });

      if (error) throw error;
      setDataPegawai(data || []);
    } catch (err) {
      console.error('SupaError:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: `Gagal mengambil data pegawai: ${err.message || JSON.stringify(err)}` });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReferensi = async () => {
    try {
      const [resKelas, resMapel, resJabatan] = await Promise.all([
        supabase.from('data_kelas').select('*').order('nama_kelas', { ascending: true }),
        supabase.from('data_mapel').select('*').order('urutan', { ascending: true }),
        supabase.from('data_jabatan').select('*').order('nama_jabatan', { ascending: true })
      ]);
      if (resKelas.data) setDataKelas(resKelas.data);
      if (resMapel.data) setDataMapel(resMapel.data);
      if (resJabatan.data) setDataJabatanList(resJabatan.data);
    } catch (err) {
      console.error("Gagal load referensi:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchReferensi();
  }, []);

  // --- Handlers for Detail ---
  const handleOpenDetail = (guru) => {
    setSelectedGuruDetail(guru);
    setIsDetailModalOpen(true);
  };

  const handleDeactivate = (guru) => {
    Swal.fire({
      title: `Nonaktifkan Pegawai?`,
      html: `Apakah Anda yakin ingin menonaktifkan <b>${guru.nama}</b>?<br><br>
             Pegawai yang dinonaktifkan akan dipindahkan ke daftar Pegawai Nonaktif.
             <br><br>
             <div style="text-align: left;">
               <label style="font-size: 14px; font-weight: bold; color: #4b5563;">Tanggal Keluar / Nonaktif</label>
               <input id="swal-tgl-keluar" type="date" class="swal2-input" style="margin: 5px 0 0 0; width: 100%; box-sizing: border-box;" value="${new Date().toISOString().split('T')[0]}">
             </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Nonaktifkan',
      cancelButtonText: 'Batal',
      preConfirm: () => {
        return document.getElementById('swal-tgl-keluar').value;
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase
            .from('data_guru')
            .update({ tanggal_keluar: result.value })
            .eq('id', guru.id);
          
          if (error) throw error;
          
          Swal.fire('Berhasil!', 'Pegawai berhasil dinonaktifkan.', 'success');
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire('Gagal!', 'Terjadi kesalahan saat menonaktifkan pegawai.', 'error');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // --- Handlers for Edit Pegawai ---
  const handleEditClick = (guru) => {
    setEditFormData({
      id: guru.id,
      nik: guru.nik || '',
      nama: guru.nama || '',
      nip: guru.nip || '',
      nuptk: guru.nuptk || '',
      niy: guru.niy || '',
      no_wa: guru.no_wa || '',
      tempat_lahir: guru.tempat_lahir || '',
      tanggal_lahir: guru.tanggal_lahir || '',
      nama_ibu: guru.nama_ibu || '',
      agama: guru.agama || 'Islam',
      status_perkawinan: guru.status_perkawinan || 'Belum Kawin',
      pendidikan: guru.pendidikan || '',
      alamat: guru.alamat || '',
      status_pegawai: guru.status_pegawai || 'GTY/PTY',
      tanggal_masuk: guru.tanggal_masuk || '',
      foto_url: guru.foto_url || ''
    });
    setEditFotoFile(null);
    setEditFotoPreview(guru.foto_url || null);
    setIsEditModalOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;
    
    // Auto propercase based on user feedback
    if (['nama', 'tempat_lahir', 'nama_ibu', 'alamat', 'pendidikan'].includes(name)) {
      finalValue = value.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    } else if (name === 'nik') {
      finalValue = value.replace(/[^0-9]/g, '');
    }

    setEditFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleEditFotoDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    processEditFotoFile(file);
  };

  const processEditFotoFile = (file) => {
    if (!file) return;
    if (!file.type.match('image/(jpeg|png)')) {
      Swal.fire('Format Salah!', 'Hanya file JPG/PNG yang diizinkan.', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Swal.fire('Terlalu Besar!', 'Ukuran foto maksimal 2MB.', 'warning');
      return;
    }
    
    setEditFotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setEditFotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const resetEditFoto = (e) => {
    if (e) e.stopPropagation();
    setEditFotoFile(null);
    setEditFotoPreview(null);
    setEditFormData(prev => ({ ...prev, foto_url: null })); // clear existing URL if they want to remove it
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSavingEdit(true);

    try {
      let updated_foto_url = editFormData.foto_url;
      
      if (editFotoFile) {
        const fileExt = editFotoFile.name.split('.').pop().toLowerCase();
        const fileName = `guru_${editFormData.nik}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('foto_guru')
          .upload(fileName, editFotoFile, { cacheControl: '3600', upsert: false });
          
        if (uploadError) throw new Error('Gagal mengupload foto: ' + uploadError.message);
        
        const { data: pub } = supabase.storage.from('foto_guru').getPublicUrl(fileName);
        updated_foto_url = pub.publicUrl;
      } else if (!editFotoPreview) {
        updated_foto_url = null; // Photo was removed
      }

      const payload = { ...editFormData, foto_url: updated_foto_url };
      // Remove ID from payload to avoid updating PK
      const guruId = payload.id;
      delete payload.id;

      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null;
      });

      const { error } = await supabase.from('data_guru').update(payload).eq('id', guruId);
      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Data Pegawai berhasil diperbarui.',
        timer: 1500,
        showConfirmButton: false
      });
      
      setIsEditModalOpen(false);
      fetchData(); // refresh table
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: err.message || 'Terjadi kesalahan sistem.'
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // --- Handlers for Jabatan ---
  const handleOpenJabatan = async (guru) => {
    setSelectedGuruJabatan(guru);
    setJabatanForm({ id: null, jabatan_utama: '', jabatan_lain_1: '', jabatan_lain_2: '', jabatan_lain_3: '', hak_akses: [] });
    setIsJabatanModalOpen(true);
    
    // Fetch current jabatan if exists
    try {
      const { data, error } = await supabase
        .from('jabatan_guru')
        .select('*')
        .eq('guru_id', guru.id)
        .maybeSingle(); 
      
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
      
      if (data) {
        setJabatanForm({
          id: data.id,
          jabatan_utama: data.jabatan_utama || '',
          jabatan_lain_1: data.jabatan_lain_1 || '',
          jabatan_lain_2: data.jabatan_lain_2 || '',
          jabatan_lain_3: data.jabatan_lain_3 || '',
          hak_akses: data.hak_akses || []
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat data jabatan: pastikan tabel jabatan_guru sudah dibuat sesuai rencana (lihat Implementation Plan).', 'error');
    }
  };

  const handleSaveJabatan = async () => {
    if (!jabatanForm.jabatan_utama) {
      Swal.fire('Peringatan', 'Jabatan utama harus diisi', 'warning');
      return;
    }
    
    setIsSavingJabatan(true);
    try {
      const payload = {
        guru_id: selectedGuruJabatan.id,
        jabatan_utama: jabatanForm.jabatan_utama,
        jabatan_lain_1: jabatanForm.jabatan_lain_1,
        jabatan_lain_2: jabatanForm.jabatan_lain_2,
        jabatan_lain_3: jabatanForm.jabatan_lain_3,
        hak_akses: jabatanForm.hak_akses
      };

      let error;
      if (jabatanForm.id) {
        const res = await supabase.from('jabatan_guru').update(payload).eq('id', jabatanForm.id);
        error = res.error;
      } else {
        const res = await supabase.from('jabatan_guru').insert([payload]);
        error = res.error;
      }

      if (error) throw error;
      Swal.fire('Berhasil', 'Data jabatan berhasil disimpan', 'success');
      setIsJabatanModalOpen(false);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal menyimpan data jabatan: pastikan tabel jabatan_guru sudah dibuat.', 'error');
    } finally {
      setIsSavingJabatan(false);
    }
  };

  const handleAksesToggle = (path) => {
    setJabatanForm(prev => {
      const current = prev.hak_akses || [];
      if (current.includes(path)) {
        return { ...prev, hak_akses: current.filter(p => p !== path) };
      } else {
        return { ...prev, hak_akses: [...current, path] };
      }
    });
  };

  // --- Handlers for Pembelajaran ---
  const handleOpenPembelajaran = async (guru) => {
    setSelectedGuruPembelajaran(guru);
    setPembelajaranSelection({});
    setIsPembelajaranModalOpen(true);

    try {
      const { data, error } = await supabase
        .from('pembelajaran')
        .select('*')
        .eq('guru_id', guru.id);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const selection = {};
        data.forEach(item => {
          if (!selection[item.kelas_id]) {
            selection[item.kelas_id] = [];
          }
          selection[item.kelas_id].push(item.mapel_id);
        });
        setPembelajaranSelection(selection);
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat data pembelajaran: pastikan tabel pembelajaran sudah dibuat sesuai rencana (lihat Implementation Plan).', 'error');
    }
  };

  const handleKelasToggle = (kelas_id) => {
    setPembelajaranSelection(prev => {
      const newSel = { ...prev };
      if (newSel[kelas_id]) {
        delete newSel[kelas_id];
      } else {
        newSel[kelas_id] = [];
      }
      return newSel;
    });
  };

  const handleMapelToggle = (kelas_id, mapel_id) => {
    setPembelajaranSelection(prev => {
      const newSel = { ...prev };
      if (!newSel[kelas_id]) return prev; // Should not happen

      if (newSel[kelas_id].includes(mapel_id)) {
        newSel[kelas_id] = newSel[kelas_id].filter(id => id !== mapel_id);
      } else {
        newSel[kelas_id] = [...newSel[kelas_id], mapel_id];
      }
      return newSel;
    });
  };

  const handleSavePembelajaran = async () => {
    setIsSavingPembelajaran(true);
    try {
      // 1. Delete existing for this guru
      const delRes = await supabase.from('pembelajaran').delete().eq('guru_id', selectedGuruPembelajaran.id);
      if (delRes.error) throw delRes.error;

      // 2. Prepare inserts
      const payload = [];
      Object.keys(pembelajaranSelection).forEach(kelas_id => {
        pembelajaranSelection[kelas_id].forEach(mapel_id => {
          payload.push({
            guru_id: selectedGuruPembelajaran.id,
            kelas_id: kelas_id,
            mapel_id: mapel_id
          });
        });
      });

      // 3. Insert if there are any
      if (payload.length > 0) {
        const insRes = await supabase.from('pembelajaran').insert(payload);
        if (insRes.error) throw insRes.error;
      }

      Swal.fire('Berhasil', 'Data pembelajaran berhasil disimpan', 'success');
      setIsPembelajaranModalOpen(false);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal menyimpan data pembelajaran: pastikan tabel pembelajaran sudah dibuat.', 'error');
    } finally {
      setIsSavingPembelajaran(false);
    }
  };


  const filteredData = dataPegawai.filter(item => {
    const keyword = searchTerm.toLowerCase();
    const matchName = (item.nama || '').toLowerCase().includes(keyword);
    const matchNuptk = (item.nuptk || '').toLowerCase().includes(keyword);
    return matchName || matchNuptk;
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Briefcase className="text-primary" /> Data Guru & Pegawai
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola data seluruh guru dan staf administrasi sekolah.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/pendaftaran-guru" className="bg-primary hover:bg-blue-900 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Pegawai
          </Link>
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <FileDown size={16} /> Export
          </button>
          <button onClick={fetchData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama atau NUPTK..." 
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:bg-white outline-none text-sm font-medium transition text-primary"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Nama Lengkap</th>
                <th className="px-6 py-4">NUPTK/NIP</th>
                <th className="px-6 py-4">Status</th>
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
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-gray-400">
                    Tidak ada data pegawai.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-800">{item.nama}</td>
                    <td className="px-6 py-4 text-gray-600">{item.nuptk || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">
                        Aktif
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEditClick(item)} className="text-amber-600 bg-amber-50 hover:bg-amber-100 p-1.5 rounded transition" title="Edit Pegawai">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleOpenDetail(item)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition" title="Detail Pegawai">
                          <Info size={18} />
                        </button>
                        <button onClick={() => handleOpenJabatan(item)} className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded transition" title="Atur Jabatan">
                          <Briefcase size={18} />
                        </button>
                        <button onClick={() => handleOpenPembelajaran(item)} className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded transition" title="Atur Pembelajaran / Jam Mengajar">
                          <Book size={18} />
                        </button>
                        <button onClick={() => handleDeactivate(item)} className="text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded transition" title="Nonaktifkan Pegawai">
                          <UserMinus size={18} />
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

      {/* --- MODAL DETAIL PEGAWAI --- */}
      {isDetailModalOpen && selectedGuruDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-primary p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Info size={20} /> Detail Pegawai</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                   <span className="text-gray-500 font-bold text-3xl">{selectedGuruDetail.nama?.charAt(0) || '?'}</span>
                </div>
                <h4 className="text-xl font-bold text-gray-800 text-center">{selectedGuruDetail.nama}</h4>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold mt-2">Aktif Mengajar</span>
              </div>
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">NUPTK</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.nuptk || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">NIP</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.nip || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Jenis Kelamin</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.jenis_kelamin || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Nomor HP</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.no_hp || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Alamat</p>
                  <p className="font-medium text-gray-800">{selectedGuruDetail.alamat || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL JABATAN --- */}
      {isJabatanModalOpen && selectedGuruJabatan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Briefcase size={20} /> Atur Jabatan</h3>
              <button onClick={() => setIsJabatanModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <p className="text-sm text-indigo-800 font-medium">Pegawai: <span className="font-bold">{selectedGuruJabatan.nama}</span></p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Jabatan Utama <span className="text-red-500">*</span></label>
                  <select 
                    value={jabatanForm.jabatan_utama}
                    onChange={(e) => setJabatanForm({...jabatanForm, jabatan_utama: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Pilih Jabatan --</option>
                    {dataJabatanList.map(j => (
                      <option key={j.id} value={j.nama_jabatan}>{j.nama_jabatan}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Jabatan Tambahan 1 (Opsional)</label>
                  <select 
                    value={jabatanForm.jabatan_lain_1}
                    onChange={(e) => setJabatanForm({...jabatanForm, jabatan_lain_1: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Kosong --</option>
                    {dataJabatanList.map(j => (
                      <option key={j.id} value={j.nama_jabatan}>{j.nama_jabatan}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Jabatan Tambahan 2 (Opsional)</label>
                  <select 
                    value={jabatanForm.jabatan_lain_2}
                    onChange={(e) => setJabatanForm({...jabatanForm, jabatan_lain_2: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Kosong --</option>
                    {dataJabatanList.map(j => (
                      <option key={j.id} value={j.nama_jabatan}>{j.nama_jabatan}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Jabatan Tambahan 3 (Opsional)</label>
                  <select 
                    value={jabatanForm.jabatan_lain_3}
                    onChange={(e) => setJabatanForm({...jabatanForm, jabatan_lain_3: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Kosong --</option>
                    {dataJabatanList.map(j => (
                      <option key={j.id} value={j.nama_jabatan}>{j.nama_jabatan}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200 pt-6">
                <div className="mb-4">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2"><ShieldCheck size={18} className="text-indigo-600" /> Hak Akses Khusus (Opsional)</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Centang menu tambahan khusus untuk guru ini. Hak akses dasar dari jabatannya akan otomatis diberikan oleh sistem tanpa perlu dicentang di sini.
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
                              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                              checked={(jabatanForm.hak_akses || []).includes(item.to)}
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
              <button onClick={() => setIsJabatanModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition">Batal</button>
              <button onClick={handleSaveJabatan} disabled={isSavingJabatan} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
                {isSavingJabatan ? 'Menyimpan...' : <><Save size={18} /> Simpan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL PEMBELAJARAN --- */}
      {isPembelajaranModalOpen && selectedGuruPembelajaran && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-emerald-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Book size={20} /> Atur Pembelajaran (Kelas & Mapel)</h3>
              <button onClick={() => setIsPembelajaranModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-50">
              <div className="mb-6 bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-800 font-medium">Pegawai: <span className="font-bold">{selectedGuruPembelajaran.nama}</span></p>
                  <p className="text-xs text-emerald-600 mt-1">Pilih kelas yang diajar, lalu pilih mata pelajarannya.</p>
                </div>
              </div>

              <div className="space-y-4">
                {dataKelas.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Data kelas belum tersedia.</p>
                ) : (
                  dataKelas.map(kelas => {
                    const idKelas = kelas.id || kelas.id_kelas; // sesuaikan dengan PK di tabel data_kelas
                    const isChecked = pembelajaranSelection.hasOwnProperty(idKelas);
                    
                    return (
                      <div key={idKelas} className={`border rounded-xl bg-white transition-all overflow-hidden ${isChecked ? 'border-emerald-500 shadow-sm' : 'border-gray-200'}`}>
                        {/* Header Kelas */}
                        <div 
                          className={`p-3 flex items-center gap-3 cursor-pointer ${isChecked ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                          onClick={() => handleKelasToggle(idKelas)}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}>
                            {isChecked && <CheckCircle size={14} />}
                          </div>
                          <span className={`font-semibold ${isChecked ? 'text-emerald-700' : 'text-gray-700'}`}>Kelas {kelas.nama_kelas}</span>
                        </div>

                        {/* Mapel Checkboxes */}
                        {isChecked && (
                          <div className="p-4 border-t border-emerald-100 bg-white">
                            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Pilih Mata Pelajaran di Kelas {kelas.nama_kelas}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {dataMapel.map(mapel => {
                                const isMapelChecked = (pembelajaranSelection[idKelas] || []).includes(mapel.id);
                                return (
                                  <label key={mapel.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border ${isMapelChecked ? 'border-emerald-200 bg-emerald-50/50' : 'border-transparent hover:bg-gray-50'}`}>
                                    <input 
                                      type="checkbox" 
                                      checked={isMapelChecked}
                                      onChange={() => handleMapelToggle(idKelas, mapel.id)}
                                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                    />
                                    <span className={`text-sm ${isMapelChecked ? 'font-medium text-emerald-800' : 'text-gray-600'}`}>{mapel.nama_mapel}</span>
                                  </label>
                                );
                              })}
                            </div>
                            {(pembelajaranSelection[idKelas] || []).length === 0 && (
                              <p className="text-xs text-red-500 mt-2 font-medium">⚠️ Anda belum memilih mapel untuk kelas ini.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center gap-2 shadow-inner">
              <span className="text-sm font-medium text-gray-500">
                {Object.keys(pembelajaranSelection).length} Kelas Terpilih
              </span>
              <div className="flex gap-2">
                <button onClick={() => setIsPembelajaranModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition">Batal</button>
                <button onClick={handleSavePembelajaran} disabled={isSavingPembelajaran} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition flex items-center gap-2">
                  {isSavingPembelajaran ? 'Menyimpan...' : <><Save size={18} /> Simpan Pembelajaran</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT PEGAWAI --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-amber-500 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Edit size={20} /> Edit Data Pegawai</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-50">
              <form id="editPegawaiForm" onSubmit={handleSaveEdit} className="space-y-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                
                {/* IDENTITAS UTAMA */}
                <section>
                  <h3 className="text-lg font-bold text-primary mb-4 border-b pb-2 flex items-center gap-2">
                    <Contact size={20} /> Identitas Pegawai
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">NIK <span className="text-red-500">*</span></label>
                      <input type="text" name="nik" value={editFormData.nik} onChange={handleEditChange} required maxLength="16" minLength="16" pattern="[0-9]{16}" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="16 digit NIK" inputMode="numeric" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Nama Lengkap (dengan Gelar) <span className="text-red-500">*</span></label>
                      <input type="text" name="nama" value={editFormData.nama} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">NIP (Jika Ada)</label>
                      <input type="text" name="nip" value={editFormData.nip} onChange={handleEditChange} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="-" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">NUPTK (Jika Ada)</label>
                      <input type="text" name="nuptk" value={editFormData.nuptk} onChange={handleEditChange} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="-" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">NIY (Nomor Induk Yayasan)</label>
                      <input type="text" name="niy" value={editFormData.niy} onChange={handleEditChange} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="-" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Nomor WhatsApp <span className="text-red-500">*</span></label>
                      <input type="tel" name="no_wa" value={editFormData.no_wa} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="08xxxxxxxxxx" />
                    </div>
                  </div>
                </section>

                {/* DATA PRIBADI */}
                <section>
                  <h3 className="text-lg font-bold text-primary mb-4 border-b pb-2 flex items-center gap-2">
                    <User size={20} /> Data Pribadi
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Tempat Lahir <span className="text-red-500">*</span></label>
                      <input type="text" name="tempat_lahir" value={editFormData.tempat_lahir} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Tanggal Lahir <span className="text-red-500">*</span></label>
                      <input type="date" name="tanggal_lahir" value={editFormData.tanggal_lahir} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Nama Ibu Kandung <span className="text-red-500">*</span></label>
                      <input type="text" name="nama_ibu" value={editFormData.nama_ibu} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Agama <span className="text-red-500">*</span></label>
                      <select name="agama" value={editFormData.agama} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="Islam">Islam</option>
                        <option value="Kristen">Kristen</option>
                        <option value="Katolik">Katolik</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Buddha">Buddha</option>
                        <option value="Konghucu">Konghucu</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Status Perkawinan <span className="text-red-500">*</span></label>
                      <select name="status_perkawinan" value={editFormData.status_perkawinan} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="Belum Kawin">Belum Kawin</option>
                        <option value="Kawin">Kawin</option>
                        <option value="Cerai Hidup">Cerai Hidup</option>
                        <option value="Cerai Mati">Cerai Mati</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Pendidikan Terakhir <span className="text-red-500">*</span></label>
                      <select name="pendidikan" value={editFormData.pendidikan} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="">-- Pilih --</option>
                        <option value="SMA/SMK/MA">SMA / SMK / MA</option>
                        <option value="D1">D1</option>
                        <option value="D2">D2</option>
                        <option value="D3">D3</option>
                        <option value="S1/D4">S1 / D4</option>
                        <option value="S2">S2</option>
                        <option value="S3">S3</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold mb-1">Alamat Lengkap <span className="text-red-500">*</span></label>
                      <textarea name="alamat" value={editFormData.alamat} onChange={handleEditChange} required rows="2" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"></textarea>
                    </div>
                  </div>
                </section>

                {/* KEPEGAWAIAN */}
                <section>
                  <h3 className="text-lg font-bold text-primary mb-4 border-b pb-2 flex items-center gap-2">
                    <Briefcase size={20} /> Kepegawaian
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Status Pegawai <span className="text-red-500">*</span></label>
                      <select name="status_pegawai" value={editFormData.status_pegawai} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <option value="GTY/PTY">GTY / PTY (Tetap Yayasan)</option>
                        <option value="GTT/PTT">GTT / PTT (Tidak Tetap)</option>
                        <option value="Honor Daerah">Honor Daerah</option>
                        <option value="PNS">PNS DPK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Tanggal Masuk <span className="text-red-500">*</span></label>
                      <input type="date" name="tanggal_masuk" value={editFormData.tanggal_masuk} onChange={handleEditChange} required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                  </div>
                </section>

                {/* FOTO */}
                <section>
                  <h3 className="text-lg font-bold text-primary mb-4 border-b pb-2 flex items-center gap-2">
                    <Camera size={20} /> Foto Profil
                  </h3>
                  <div 
                    className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 text-center cursor-pointer transition hover:border-amber-400 hover:bg-amber-50 relative"
                    onClick={() => document.getElementById('editFotoInput').click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleEditFotoDrop}
                  >
                    <input type="file" id="editFotoInput" accept="image/jpeg,image/png" className="hidden" onChange={handleEditFotoDrop} />
                    
                    {!editFotoPreview ? (
                      <div>
                        <Upload size={36} className="mx-auto text-gray-400 mb-2" />
                        <p className="font-semibold text-gray-600 text-sm">Klik atau seret foto baru ke sini</p>
                        <p className="text-xs text-gray-400 mt-1">Biarkan kosong jika tidak ingin mengubah foto</p>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <img src={editFotoPreview} className="w-24 h-32 object-cover mx-auto rounded-lg border-2 border-amber-200 shadow-md" alt="Preview" />
                        <p className="text-xs text-amber-600 mt-2 font-semibold flex items-center justify-center gap-1">
                          <CheckCircle size={14} /> Foto siap digunakan
                        </p>
                        <button type="button" onClick={resetEditFoto} className="mt-2 text-xs text-red-500 hover:underline relative z-10">
                          Hapus foto
                        </button>
                      </div>
                    )}
                  </div>
                </section>

              </form>
            </div>
            <div className="p-4 border-t border-gray-100 bg-white flex justify-end items-center gap-2 shadow-inner">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition">Batal</button>
              <button type="submit" form="editPegawaiForm" disabled={isSavingEdit} className="px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition flex items-center gap-2 shadow-md">
                {isSavingEdit ? 'Menyimpan...' : <><Save size={18} /> Simpan Perubahan</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
