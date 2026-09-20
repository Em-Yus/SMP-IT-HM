import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, Plus, RefreshCw, Search, Edit, Trash2, X, Upload, Save, ImageIcon } from 'lucide-react';
import Swal from 'sweetalert2';

export default function Prestasi() {
  const [dataPrestasi, setDataPrestasi] = useState([]);
  const [dataKelas, setDataKelas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const initialFormState = {
    nipd: '',
    nama_siswa: '',
    kelas: '',
    nama_prestasi: '',
    jenis_prestasi: 'Akademik',
    tingkat: 'Sekolah',
    peringkat: 'Juara 1',
    tahun: new Date().getFullYear().toString(),
    penyelenggara: '',
    keterangan: '',
    tahun_ajaran: '',
    semester: 'Ganjil',
    foto_bukti: null
  };
  const [formData, setFormData] = useState(initialFormState);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
    fetchKelas();
    generateTahunAjaran();
  }, []);

  const generateTahunAjaran = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    let ta = '';
    if (currentMonth >= 7) {
      ta = `${currentYear}/${currentYear + 1}`;
    } else {
      ta = `${currentYear - 1}/${currentYear}`;
    }
    setFormData(prev => ({ ...prev, tahun_ajaran: ta }));
  };

  const fetchKelas = async () => {
    try {
      const { data, error } = await supabase.from('data_kelas').select('*').order('nama_kelas', { ascending: true });
      if (!error && data) setDataKelas(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('prestasi_siswa') // Gunakan _ (underscore) standar postgresql
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback jika nama tabelnya prestasi-siswa
        const { data: data2, error: error2 } = await supabase
          .from('prestasi-siswa')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error2) throw error2;
        setDataPrestasi(data2 || []);
      } else {
        setDataPrestasi(data || []);
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data prestasi' });
    } finally {
      setIsLoading(false);
    }
  };

  const toProperCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (['nama_siswa', 'nama_prestasi', 'penyelenggara', 'keterangan'].includes(name)) {
      setFormData({ ...formData, [name]: toProperCase(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        Swal.fire({ icon: 'warning', title: 'File Terlalu Besar', text: 'Maksimal ukuran foto adalah 2MB' });
        e.target.value = '';
        return;
      }
      setFotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddModal = () => {
    setFormData(initialFormState);
    generateTahunAjaran();
    setFotoFile(null);
    setFotoPreview(null);
    setIsEditing(false);
    setSelectedId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setFormData({
      nipd: item.nipd || '',
      nama_siswa: item.nama_siswa || '',
      kelas: item.kelas || '',
      nama_prestasi: item.nama_prestasi || '',
      jenis_prestasi: item.jenis_prestasi || 'Akademik',
      tingkat: item.tingkat || 'Sekolah',
      peringkat: item.peringkat || 'Juara 1',
      tahun: item.tahun || new Date().getFullYear().toString(),
      penyelenggara: item.penyelenggara || '',
      keterangan: item.keterangan || '',
      tahun_ajaran: item.tahun_ajaran || '',
      semester: item.semester || 'Ganjil',
      foto_bukti: item.foto_bukti || null
    });
    setFotoFile(null);
    setFotoPreview(item.foto_bukti || null);
    setIsEditing(true);
    setSelectedId(item.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Hapus Data Prestasi?',
      text: "Data yang dihapus tidak dapat dikembalikan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
      Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
      try {
        // Coba delete dari prestasi_siswa, jika gagal prestasi-siswa
        let { error } = await supabase.from('prestasi_siswa').delete().eq('id', id);
        if (error) {
          const { error: err2 } = await supabase.from('prestasi-siswa').delete().eq('id', id);
          if (err2) throw err2;
        }
        
        Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success');
        fetchData();
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal!', 'Gagal menghapus data.', 'error');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      let fotoUrl = formData.foto_bukti;

      // Upload Foto jika ada
      if (fotoFile) {
        const fileExt = fotoFile.name.split('.').pop();
        const fileName = `${Date.now()}_prestasi.${fileExt}`;
        const filePath = `prestasi/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('berkas_ppdb')
          .upload(filePath, fotoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('berkas_ppdb')
          .getPublicUrl(filePath);

        fotoUrl = urlData.publicUrl;
      }

      const payload = {
        nipd: formData.nipd,
        nama_siswa: formData.nama_siswa,
        kelas: formData.kelas,
        nama_prestasi: formData.nama_prestasi,
        jenis_prestasi: formData.jenis_prestasi,
        tingkat: formData.tingkat,
        peringkat: formData.peringkat,
        tahun: formData.tahun,
        penyelenggara: formData.penyelenggara,
        keterangan: formData.keterangan,
        tahun_ajaran: formData.tahun_ajaran,
        semester: formData.semester,
        foto_bukti: fotoUrl
      };

      let tableToUse = 'prestasi_siswa';
      
      // Deteksi tabel mana yang valid
      const { error: checkErr } = await supabase.from('prestasi_siswa').select('id').limit(1);
      if (checkErr) tableToUse = 'prestasi-siswa';

      if (isEditing) {
        const { error } = await supabase.from(tableToUse).update(payload).eq('id', selectedId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableToUse).insert([payload]);
        if (error) throw error;
      }

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data prestasi berhasil disimpan!' });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat menyimpan data.' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredData = dataPrestasi.filter(item => 
    (item.nama_siswa || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.nama_prestasi || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.kelas || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2a2c87] flex items-center gap-2">
            <Trophy className="text-[#85c226]" /> Data Prestasi Siswa
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola pencatatan dan publikasi prestasi akademik maupun non-akademik.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama siswa atau prestasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#85c226]"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
           <button onClick={fetchData} className="flex-1 md:flex-none justify-center bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 text-sm shadow-sm">
             <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
           </button>
           <button onClick={openAddModal} className="flex-1 md:flex-none justify-center bg-[#2a2c87] hover:bg-blue-900 text-white px-4 py-2.5 rounded-xl font-bold shadow-sm transition flex items-center gap-2 text-sm">
             <Plus size={16} /> Tambah Prestasi
           </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">No</th>
                <th className="px-6 py-4">Siswa</th>
                <th className="px-6 py-4">Nama Prestasi</th>
                <th className="px-6 py-4">Kategori & Tingkat</th>
                <th className="px-6 py-4">Peringkat</th>
                <th className="px-6 py-4">Bukti</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-gray-400">Memuat data...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-gray-400">Belum ada data prestasi ditemukan.</td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 text-gray-500 font-medium">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-800">{item.nama_siswa}</div>
                      <div className="text-xs text-gray-500 mt-0.5">NIPD: {item.nipd || '-'} | Kelas: <span className="font-semibold text-gray-700">{item.kelas || '-'}</span></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#2a2c87]">{item.nama_prestasi}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Tahun: {item.tahun} | Penyelenggara: {item.penyelenggara || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 uppercase">{item.jenis_prestasi}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">{item.tingkat}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-extrabold bg-[#85c226]/10 text-[#85c226]">
                        🏆 {item.peringkat}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.foto_bukti ? (
                        <a href={item.foto_bukti} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 block shadow-sm hover:opacity-80 transition">
                           <img src={item.foto_bukti} alt="Bukti" className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditModal(item)} className="p-2 text-orange-500 bg-orange-50 hover:bg-orange-100 rounded-lg transition" title="Edit">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition" title="Hapus">
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

      {/* Modal Popup Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-[#2a2c87] flex items-center gap-2">
                <Trophy size={24} className="text-[#85c226]" />
                {isEditing ? 'Edit Data Prestasi' : 'Tambah Prestasi Baru'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col">
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 flex-1 max-h-[70vh] overflow-y-auto custom-scrollbar">
                
                {/* Kolom Kiri: Biodata & Prestasi Dasar */}
                <div className="space-y-5">
                   <h3 className="font-bold text-gray-700 border-b pb-2 text-sm uppercase">Data Siswa</h3>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Nama Siswa <span className="text-red-500">*</span></label>
                        <input type="text" name="nama_siswa" required value={formData.nama_siswa} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="Contoh: Ahmad Faisal" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">NIPD</label>
                        <input type="text" name="nipd" value={formData.nipd} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="Nomor Induk" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Kelas <span className="text-red-500">*</span></label>
                        <select name="kelas" required value={formData.kelas} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm">
                          <option value="">-- Pilih Kelas --</option>
                          {dataKelas.map(k => (
                            <option key={k.id} value={k.nama_kelas}>{k.nama_kelas}</option>
                          ))}
                          <option value="Lulus">Lulus / Alumni</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Tahun <span className="text-red-500">*</span></label>
                        <input type="number" name="tahun" required value={formData.tahun} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="2026" />
                      </div>
                   </div>

                   <h3 className="font-bold text-gray-700 border-b pb-2 text-sm uppercase mt-6">Detail Perlombaan</h3>
                   
                   <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">Nama Prestasi/Lomba <span className="text-red-500">*</span></label>
                      <input type="text" name="nama_prestasi" required value={formData.nama_prestasi} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="Contoh: Juara 1 Olimpiade Matematika" />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Jenis Prestasi <span className="text-red-500">*</span></label>
                        <select name="jenis_prestasi" required value={formData.jenis_prestasi} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm">
                          <option value="Akademik">Akademik</option>
                          <option value="Non-Akademik">Non-Akademik</option>
                          <option value="Olahraga">Olahraga</option>
                          <option value="Seni">Seni</option>
                          <option value="Keagamaan">Keagamaan</option>
                          <option value="Pramuka">Pramuka</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Tingkat <span className="text-red-500">*</span></label>
                        <select name="tingkat" required value={formData.tingkat} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm">
                          <option value="Sekolah">Sekolah / Antar Kelas</option>
                          <option value="Kecamatan">Kecamatan</option>
                          <option value="Kabupaten">Kabupaten / Kota</option>
                          <option value="Provinsi">Provinsi</option>
                          <option value="Nasional">Nasional</option>
                          <option value="Internasional">Internasional</option>
                        </select>
                      </div>
                   </div>
                </div>

                {/* Kolom Kanan: Peringkat, Penyelenggara, Bukti */}
                <div className="space-y-5">
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Peringkat/Juara <span className="text-red-500">*</span></label>
                        <input type="text" name="peringkat" required value={formData.peringkat} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm font-bold text-[#85c226]" placeholder="Juara 1" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Tahun Ajaran <span className="text-red-500">*</span></label>
                        <input type="text" name="tahun_ajaran" required value={formData.tahun_ajaran} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="2026/2027" />
                      </div>
                   </div>

                   <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">Penyelenggara Instansi/Kepanitiaan</label>
                      <input type="text" name="penyelenggara" value={formData.penyelenggara} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="Contoh: Dinas Pendidikan Subang" />
                   </div>
                   
                   <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">Keterangan Tambahan</label>
                      <textarea name="keterangan" rows="2" value={formData.keterangan} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="Catatan tambahan (Opsional)"></textarea>
                   </div>

                   <h3 className="font-bold text-gray-700 border-b pb-2 text-sm uppercase mt-6">Bukti / Piagam (Opsional)</h3>
                   <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0 relative group cursor-pointer" onClick={() => fileInputRef.current.click()}>
                        {fotoPreview ? (
                          <>
                            <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                              <Edit size={20} className="text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center text-gray-400">
                             <Upload size={24} className="mb-1" />
                             <span className="text-[10px] font-bold">Unggah</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 leading-relaxed mb-2">Unggah foto piagam, piala, atau dokumentasi saat penyerahan penghargaan. <br/>Format: JPG/PNG, Maks: 2MB.</p>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current.click()} className="text-xs font-bold px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">Pilih Gambar...</button>
                        {(fotoFile || formData.foto_bukti) && (
                          <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null); setFormData(s => ({...s, foto_bukti: null})) }} className="text-xs font-bold px-4 py-2 text-red-500 hover:underline ml-2">Hapus Bukti</button>
                        )}
                      </div>
                   </div>

                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3 mt-auto">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">Batal</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#2a2c87] hover:bg-blue-900 shadow-lg flex items-center gap-2 transition disabled:opacity-70">
                  {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                  {isSaving ? 'Menyimpan...' : 'Simpan Prestasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
}
