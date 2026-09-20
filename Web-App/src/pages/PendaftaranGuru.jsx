import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Contact, User, Briefcase, Camera, Upload, CheckCircle, Loader2, Save } from 'lucide-react';

export default function PendaftaranGuru() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  const [formData, setFormData] = useState({
    nik: '',
    nama: '',
    nip: '',
    nuptk: '',
    niy: '',
    no_wa: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    nama_ibu: '',
    agama: 'Islam',
    status_perkawinan: 'Belum Kawin',
    pendidikan: '',
    alamat: '',
    status_pegawai: 'GTY/PTY',
    tanggal_masuk: new Date().toISOString().split('T')[0]
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Auto-formatting (uppercase for specific fields)
    let finalValue = value;
    if (['tempat_lahir', 'nama_ibu', 'alamat'].includes(name)) {
      finalValue = value.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    } else if (name === 'nama') {
      finalValue = value.toUpperCase();
    } else if (name === 'nik') {
      finalValue = value.replace(/[^0-9]/g, '');
    }

    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
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
    reader.onload = (e) => {
      setFotoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const resetFoto = (e) => {
    if (e) e.stopPropagation();
    setFotoFile(null);
    setFotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let foto_url = null;
      if (fotoFile) {
        const fileExt = fotoFile.name.split('.').pop().toLowerCase();
        const fileName = `guru_${formData.nik}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('foto_guru')
          .upload(fileName, fotoFile, { cacheControl: '3600', upsert: false });
          
        if (uploadError) throw new Error('Gagal mengupload foto: ' + uploadError.message);
        
        const { data: pub } = supabase.storage.from('foto_guru').getPublicUrl(fileName);
        foto_url = pub.publicUrl;
      }

      // Bersihkan field kosong menjadi null
      const dataToInsert = { ...formData, foto_url };
      Object.keys(dataToInsert).forEach(key => {
        if (dataToInsert[key] === '') dataToInsert[key] = null;
      });

      const { error } = await supabase.from('data_guru').insert([dataToInsert]);
      if (error) throw error;

      await Swal.fire({
        icon: 'success',
        title: 'Pendaftaran Berhasil!',
        text: 'Data Pegawai/Guru berhasil disimpan ke database.',
        confirmButtonColor: '#2a2c87'
      });
      
      navigate('/');
      
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: err.message || 'Terjadi kesalahan sistem. Silakan coba lagi.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen text-gray-800 font-sans">
      <header className="bg-primary text-white py-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo" className="w-10 h-10 object-contain bg-white rounded-full p-1" />
            <div>
              <h1 className="font-bold text-lg leading-tight">REKRUTMEN GURU & STAFF</h1>
              <p className="text-xs text-gray-300">SMP IT Hidayatul Mubtadi-ien</p>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="text-sm font-medium hover:text-blue-300 transition flex items-center gap-2">
            <ArrowLeft size={18} /> Kembali ke Beranda
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-t-4 border-green-500">
          <div className="p-8 text-center bg-blue-50">
            <h2 className="text-2xl font-bold text-primary mb-2">Formulir Data Guru & Tenaga Kependidikan</h2>
            <p className="text-gray-600">Mohon lengkapi data administrasi kepegawaian berikut ini.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            
            {/* IDENTITAS UTAMA */}
            <section>
              <h3 className="text-xl font-bold text-primary mb-6 border-b pb-2 flex items-center gap-2">
                <Contact size={24} /> Identitas Pegawai
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">NIK <span className="text-red-500">*</span></label>
                  <input type="text" name="nik" value={formData.nik} onChange={handleChange} required maxLength="16" minLength="16" pattern="[0-9]{16}" className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="16 digit NIK KTP" inputMode="numeric" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Lengkap (dengan Gelar) <span className="text-red-500">*</span></label>
                  <input type="text" name="nama" value={formData.nama} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">NIP (Jika Ada)</label>
                  <input type="text" name="nip" value={formData.nip} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="-" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">NUPTK (Jika Ada)</label>
                  <input type="text" name="nuptk" value={formData.nuptk} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="-" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">NIY (Nomor Induk Yayasan)</label>
                  <input type="text" name="niy" value={formData.niy} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="-" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nomor WhatsApp <span className="text-red-500">*</span></label>
                  <input type="tel" name="no_wa" value={formData.no_wa} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="08xxxxxxxxxx" />
                </div>
              </div>
            </section>

            {/* DATA PRIBADI */}
            <section>
              <h3 className="text-xl font-bold text-primary mb-6 border-b pb-2 flex items-center gap-2">
                <User size={24} /> Data Pribadi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">Tempat Lahir <span className="text-red-500">*</span></label>
                  <input type="text" name="tempat_lahir" value={formData.tempat_lahir} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 capitalize" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tanggal Lahir <span className="text-red-500">*</span></label>
                  <input type="date" name="tanggal_lahir" value={formData.tanggal_lahir} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Ibu Kandung <span className="text-red-500">*</span></label>
                  <input type="text" name="nama_ibu" value={formData.nama_ibu} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 capitalize" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Agama <span className="text-red-500">*</span></label>
                  <select name="agama" value={formData.agama} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="Islam">Islam</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Katolik">Katolik</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Konghucu">Konghucu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Status Perkawinan <span className="text-red-500">*</span></label>
                  <select name="status_perkawinan" value={formData.status_perkawinan} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="Belum Kawin">Belum Kawin</option>
                    <option value="Kawin">Kawin</option>
                    <option value="Cerai Hidup">Cerai Hidup</option>
                    <option value="Cerai Mati">Cerai Mati</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Pendidikan Terakhir <span className="text-red-500">*</span></label>
                  <select name="pendidikan" value={formData.pendidikan} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
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
                  <label className="block text-sm font-semibold mb-2">Alamat Lengkap <span className="text-red-500">*</span></label>
                  <textarea name="alamat" value={formData.alamat} onChange={handleChange} required rows="2" className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 capitalize" placeholder="Dusun, RT/RW, Desa, Kecamatan, Kab/Kota"></textarea>
                </div>
              </div>
            </section>

            {/* KEPEGAWAIAN */}
            <section>
              <h3 className="text-xl font-bold text-primary mb-6 border-b pb-2 flex items-center gap-2">
                <Briefcase size={24} /> Kepegawaian
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">Status Pegawai <span className="text-red-500">*</span></label>
                  <select name="status_pegawai" value={formData.status_pegawai} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="GTY/PTY">GTY / PTY (Tetap Yayasan)</option>
                    <option value="GTT/PTT">GTT / PTT (Tidak Tetap)</option>
                    <option value="Honor Daerah">Honor Daerah</option>
                    <option value="PNS">PNS DPK</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tanggal Masuk <span className="text-red-500">*</span></label>
                  <input type="date" name="tanggal_masuk" value={formData.tanggal_masuk} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                
              </div>
            </section>

            {/* FOTO */}
            <section>
              <h3 className="text-xl font-bold text-primary mb-6 border-b pb-2 flex items-center gap-2">
                <Camera size={24} /> Foto Profil
              </h3>
              <div 
                className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300 text-center cursor-pointer transition hover:border-green-400 hover:bg-green-50 relative"
                onClick={() => document.getElementById('fotoInput').click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFotoDrop}
              >
                <input type="file" id="fotoInput" accept="image/jpeg,image/png" className="hidden" onChange={handleFotoDrop} />
                
                {!fotoPreview ? (
                  <div>
                    <Upload size={48} className="mx-auto text-gray-400 mb-3" />
                    <p className="font-semibold text-gray-600">Klik atau seret foto ke sini</p>
                    <p className="text-xs text-gray-400 mt-1">JPG / PNG &bull; Maksimal 2MB &bull; Rasio 3:4</p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <img src={fotoPreview} className="w-32 h-40 object-cover mx-auto rounded-lg border-2 border-green-200 shadow-md" alt="Preview" />
                    <p className="text-xs text-green-600 mt-2 font-semibold flex items-center justify-center gap-1">
                      <CheckCircle size={14} /> Foto siap diupload
                    </p>
                    <button type="button" onClick={resetFoto} className="mt-2 text-xs text-red-500 hover:underline relative z-10">
                      Hapus foto
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* SUBMIT */}
            <div className="pt-6">
              <button type="submit" disabled={isLoading} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg transform transition hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed">
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={24} /> Menyimpan Data...
                  </>
                ) : (
                  <>
                    <span>SIMPAN DATA PEGAWAI</span>
                    <Save size={24} />
                  </>
                )}
              </button>
            </div>
            
          </form>
        </div>
      </main>

      <footer className="bg-primary text-white py-6 text-center mt-10">
        <p className="text-sm opacity-80">&copy; {new Date().getFullYear()} SMP IT Hidayatul Mubtadi-ien Compreng</p>
      </footer>
    </div>
  );
}
