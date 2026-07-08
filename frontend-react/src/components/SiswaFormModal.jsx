import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { X, Save, Contact, User, Briefcase, Camera, Upload, CheckCircle } from 'lucide-react';

export default function SiswaFormModal({ isOpen, onClose, siswaData, onSuccess }) {
  const [formData, setFormData] = useState({
    nipd: '', nik: '', nisn: '', nama: '', tempat_lahir: '', tanggal_lahir: '',
    jenis_kelamin: '', alamat_detail: '', rt: '', rw: '', desa: '', kecamatan: '',
    kabupaten: '', provinsi: '', wa_siswa: '', kelas: '', angkatan: '',
    tahun_ajaran: '', tanggal_masuk: '', status_siswa: 'Baru', sekolah_asal: '',
    nama_ayah: '', nama_ibu: '', nama_wali: '', wa_ortu: '', foto_url: '',
    status_keaktifan: 'Aktif', tanggal_non_aktif: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [kelasList, setKelasList] = useState([]);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  // Constants for dropdowns
  const currentYear = new Date().getFullYear();
  const angkatanOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 3; y++) {
    angkatanOptions.push(y);
  }

  const currentMonth = new Date().getMonth();
  let activeTaStartYear = (currentMonth < 6) ? currentYear - 1 : currentYear;
  const taOptions = [];
  for (let y = activeTaStartYear - 5; y <= activeTaStartYear + 3; y++) {
    taOptions.push(`${y}/${y + 1}`);
  }

  // Load Dropdowns
  useEffect(() => {
    if (!isOpen) return;

    const fetchKelas = async () => {
      try {
        const { data, error } = await supabase
          .from('data_kelas')
          .select('nama_kelas')
          .order('nama_kelas');
        if (!error && data) {
          setKelasList(data);
        }
      } catch (err) {
        console.error("Gagal memuat kelas:", err);
      }
    };
    fetchKelas();
  }, [isOpen]);

  useEffect(() => {
    if (siswaData) {
      setFormData({
        ...siswaData,
        nik: siswaData.nik || '',
        nisn: siswaData.nisn || '',
        nama: siswaData.nama || '',
        tempat_lahir: siswaData.tempat_lahir || '',
        tanggal_lahir: siswaData.tanggal_lahir || '',
        jenis_kelamin: siswaData.jenis_kelamin || '',
        alamat_detail: siswaData.alamat_detail || '',
        rt: siswaData.rt || '',
        rw: siswaData.rw || '',
        desa: siswaData.desa || '',
        kecamatan: siswaData.kecamatan || '',
        kabupaten: siswaData.kabupaten || '',
        provinsi: siswaData.provinsi || '',
        wa_siswa: siswaData.wa_siswa || '',
        kelas: siswaData.kelas || '',
        angkatan: siswaData.angkatan || '',
        tahun_ajaran: siswaData.tahun_ajaran || '',
        tanggal_masuk: siswaData.tanggal_masuk || '',
        status_siswa: siswaData.status_siswa || 'Baru',
        sekolah_asal: siswaData.sekolah_asal || '',
        nama_ayah: siswaData.nama_ayah || '',
        nama_ibu: siswaData.nama_ibu || '',
        nama_wali: siswaData.nama_wali || '',
        wa_ortu: siswaData.wa_ortu || '',
        status_keaktifan: siswaData.status_keaktifan || 'Aktif',
        tanggal_non_aktif: siswaData.tanggal_non_aktif || ''
      });
      setFotoPreview(siswaData.foto_url || null);
      setFotoFile(null);
    } else {
      setFormData({
        nipd: '', nik: '', nisn: '', nama: '', tempat_lahir: '', tanggal_lahir: '',
        jenis_kelamin: '', alamat_detail: '', rt: '', rw: '', desa: '', kecamatan: '',
        kabupaten: '', provinsi: '', wa_siswa: '', kelas: '', angkatan: currentYear.toString(),
        tahun_ajaran: `${activeTaStartYear}/${activeTaStartYear + 1}`, tanggal_masuk: new Date().toISOString().split('T')[0], status_siswa: 'Baru', sekolah_asal: '',
        nama_ayah: '', nama_ibu: '', nama_wali: '', wa_ortu: '', foto_url: '',
        status_keaktifan: 'Aktif', tanggal_non_aktif: ''
      });
      setFotoPreview(null);
      setFotoFile(null);
    }
  }, [siswaData, isOpen]);

  const toProperCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (['nama', 'tempat_lahir', 'alamat_detail', 'desa', 'kecamatan', 'kabupaten', 'provinsi', 'sekolah_asal', 'nama_ayah', 'nama_ibu', 'nama_wali'].includes(name)) {
      finalValue = toProperCase(value);
    } else if (['nik', 'nisn'].includes(name)) {
      finalValue = value.replace(/[^0-9]/g, '');
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleFotoDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    processFotoFile(file);
  };

  const processFotoFile = (file) => {
    if (!file) return;
    if (!file.type.match('image/(jpeg|png)')) {
      Swal.fire('Format Salah!', 'Hanya file JPG/PNG yang diizinkan.', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Swal.fire('Terlalu Besar!', 'Ukuran foto maksimal 2MB.', 'warning');
      return;
    }
    
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setFotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const resetFoto = (e) => {
    if (e) e.stopPropagation();
    setFotoFile(null);
    setFotoPreview(null);
    setFormData(prev => ({ ...prev, foto_url: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let updated_foto_url = formData.foto_url;
      
      if (fotoFile) {
        const fileExt = fotoFile.name.split('.').pop().toLowerCase();
        const fileName = `siswa_${formData.nik}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('berkas_ppdb')
          .upload(`foto_siswa/${fileName}`, fotoFile, { cacheControl: '3600', upsert: false });
          
        if (uploadError) throw new Error('Gagal mengupload foto: ' + uploadError.message);
        
        const { data: pub } = supabase.storage.from('berkas_ppdb').getPublicUrl(`foto_siswa/${fileName}`);
        updated_foto_url = pub.publicUrl;
      } else if (!fotoPreview) {
        updated_foto_url = null; // Photo removed
      }

      const payload = { ...formData, foto_url: updated_foto_url };
      delete payload.id; // Jangan update ID
      delete payload.created_at;

      // Clean empty strings to null
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null;
      });

      if (siswaData && siswaData.id) {
        const { error } = await supabase
          .from('data_siswa')
          .update(payload)
          .eq('id', siswaData.id);

        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data siswa diperbarui!', timer: 1500, showConfirmButton: false });
      } else {
        const { error } = await supabase
          .from('data_siswa')
          .insert([payload]);

        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Siswa baru ditambahkan!', timer: 1500, showConfirmButton: false });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-t-4 border-[#85c226]">
        <div className="bg-[#2a2c87] p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <User size={20} /> {siswaData && siswaData.id ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
          <form id="siswaForm" onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            
            {/* A. IDENTITAS CALON SISWA */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">A</span>
                IDENTITAS SISWA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">NIK <span className="text-red-500">*</span></label>
                  <input type="text" name="nik" required value={formData.nik} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="16 digit NIK" maxLength="16" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">NISN</label>
                  <input type="text" name="nisn" value={formData.nisn || ''} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="10 digit NISN" maxLength="10" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">NIPD</label>
                  <input type="text" name="nipd" value={formData.nipd || ''} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="NIPD" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Lengkap <span className="text-red-500">*</span></label>
                  <input type="text" name="nama" required value={formData.nama} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="Sesuai Akta Kelahiran" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tempat Lahir <span className="text-red-500">*</span></label>
                  <input type="text" name="tempat_lahir" required value={formData.tempat_lahir} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tanggal Lahir <span className="text-red-500">*</span></label>
                  <input type="date" name="tanggal_lahir" required value={formData.tanggal_lahir} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Jenis Kelamin <span className="text-red-500">*</span></label>
                  <select name="jenis_kelamin" required value={formData.jenis_kelamin} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]">
                    <option value="">-- Pilih --</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                    <option value="L">Laki-laki (Sistem Lama L)</option>
                    <option value="P">Perempuan (Sistem Lama P)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* B. ALAMAT */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">B</span>
                ALAMAT TEMPAT TINGGAL
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-2">Dusun / Jalan / Gang <span className="text-red-500">*</span></label>
                  <input type="text" name="alamat_detail" required value={formData.alamat_detail} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="Contoh: Dsn. Sukaseneng, Gg. Yayasan" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">RT <span className="text-red-500">*</span></label>
                    <input type="number" min="1" name="rt" required value={formData.rt} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">RW <span className="text-red-500">*</span></label>
                    <input type="number" min="1" name="rw" required value={formData.rw} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Desa / Kelurahan <span className="text-red-500">*</span></label>
                  <input type="text" name="desa" required value={formData.desa} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Kecamatan <span className="text-red-500">*</span></label>
                  <input type="text" name="kecamatan" required value={formData.kecamatan} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Kabupaten / Kota <span className="text-red-500">*</span></label>
                  <input type="text" name="kabupaten" required value={formData.kabupaten} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Provinsi <span className="text-red-500">*</span></label>
                  <input type="text" name="provinsi" required value={formData.provinsi} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
              </div>
            </section>

            {/* C. KONTAK SISWA */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">C</span>
                KONTAK SISWA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">No. WhatsApp Siswa (Aktif)</label>
                  <input type="tel" name="wa_siswa" value={formData.wa_siswa || ''} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="08xxxxxxxxxx" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Status Keaktifan</label>
                  <select name="status_keaktifan" value={formData.status_keaktifan || 'Aktif'} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]">
                    <option value="Aktif">Aktif</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Pindah">Pindah</option>
                    <option value="Keluar">Keluar</option>
                    <option value="Tidak Aktif">Tidak Aktif</option>
                  </select>
                </div>
                {(formData.status_keaktifan && formData.status_keaktifan !== 'Aktif') && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">Tanggal Keluar/Pindah</label>
                    <input type="date" name="tanggal_non_aktif" value={formData.tanggal_non_aktif || ''} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                  </div>
                )}
              </div>
            </section>

            {/* D. DATA AKADEMIK */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">D</span>
                DATA AKADEMIK
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">Kelas Saat Ini <span className="text-red-500">*</span></label>
                  <select name="kelas" required value={formData.kelas} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]">
                    <option value="">-- Pilih Kelas --</option>
                    <option value="Lulus">Lulus</option>
                    {kelasList.map((k, i) => <option key={i} value={k.nama_kelas}>{k.nama_kelas}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Angkatan (Tahun Masuk)</label>
                  <select name="angkatan" value={formData.angkatan} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]">
                    {angkatanOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tahun Ajaran</label>
                  <select name="tahun_ajaran" value={formData.tahun_ajaran} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]">
                    {taOptions.map(ta => <option key={ta} value={ta}>{ta}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tanggal Masuk</label>
                  <input type="date" name="tanggal_masuk" value={formData.tanggal_masuk} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Status Siswa <span className="text-red-500">*</span></label>
                  <select name="status_siswa" required value={formData.status_siswa} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]">
                    <option value="Baru">Baru</option>
                    <option value="Pindahan">Pindahan</option>
                    <option value="Cabang">Cabang</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-2">Asal Sekolah (SD/MI) <span className="text-red-500">*</span></label>
                  <input type="text" name="sekolah_asal" required value={formData.sekolah_asal} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
              </div>
            </section>

            {/* E. IDENTITAS ORANG TUA */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">E</span>
                IDENTITAS ORANG TUA / WALI
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Ayah Kandung <span className="text-red-500">*</span></label>
                  <input type="text" name="nama_ayah" required value={formData.nama_ayah} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Ibu Kandung <span className="text-red-500">*</span></label>
                  <input type="text" name="nama_ibu" required value={formData.nama_ibu} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Wali (Jika ada)</label>
                  <input type="text" name="nama_wali" value={formData.nama_wali || ''} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                </div>
              </div>
            </section>

            {/* F. KONTAK ORANG TUA */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">F</span>
                KONTAK ORANG TUA
              </h3>
              <div>
                <label className="block text-sm font-semibold mb-2">No. WhatsApp Orang Tua / Wali (Aktif) <span className="text-red-500">*</span></label>
                <input type="tel" name="wa_ortu" required value={formData.wa_ortu} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="08xxxxxxxxxx" />
              </div>
            </section>

            {/* G. UPLOAD FOTO */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">G</span>
                FOTO DIRI
              </h3>
              <div 
                className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300 text-center cursor-pointer transition hover:border-[#85c226] hover:bg-[#85c226]/10 relative"
                onClick={() => document.getElementById('editFotoSiswaInput').click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFotoDrop}
              >
                <input type="file" id="editFotoSiswaInput" accept="image/jpeg,image/png" className="hidden" onChange={handleFotoDrop} />
                
                {!fotoPreview ? (
                  <div>
                    <Upload size={36} className="mx-auto text-gray-400 mb-2" />
                    <p className="font-semibold text-gray-600 text-sm">Klik atau seret foto baru ke sini</p>
                    <p className="text-xs text-gray-400 mt-1">Biarkan kosong jika tidak ingin mengubah foto (Format JPG/PNG, Max 2MB)</p>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col items-center">
                    <img src={fotoPreview} className="w-32 h-40 object-cover mx-auto rounded border shadow-sm" alt="Preview Foto" />
                    <p className="text-xs text-[#85c226] mt-2 font-semibold flex items-center justify-center gap-1">
                      <CheckCircle size={14} /> Foto siap digunakan
                    </p>
                    <button type="button" onClick={resetFoto} className="mt-2 text-xs text-red-500 hover:underline relative z-10">
                      Hapus foto
                    </button>
                  </div>
                )}
              </div>
            </section>

          </form>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 shadow-inner">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition">
            Batal
          </button>
          <button type="submit" form="siswaForm" disabled={isSaving} className="px-5 py-2.5 bg-[#85c226] text-white rounded-lg hover:bg-green-600 font-bold transition flex items-center gap-2 shadow-md">
            {isSaving ? 'Menyimpan...' : <><Save size={18} /> Simpan Perubahan</>}
          </button>
        </div>
      </div>
    </div>
  );
}
