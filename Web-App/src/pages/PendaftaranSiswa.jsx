import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Upload } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { Turnstile } from '@marsidev/react-turnstile';

export default function PendaftaranSiswa() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Data Master
  const [kelasList, setKelasList] = useState([]);
  
  // Form State
  const [formData, setFormData] = useState({
    nipd: '',
    nik: '',
    nisn: '',
    nama: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    jenis_kelamin: '',
    alamat_detail: '',
    rt: '',
    rw: '',
    desa: '',
    kecamatan: '',
    kabupaten: '',
    provinsi: '',
    wa_siswa: '',
    kelas: '',
    angkatan: new Date().getFullYear().toString(),
    tahun_ajaran: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    tanggal_masuk: new Date().toISOString().split('T')[0],
    status_siswa: 'Baru',
    sekolah_asal: '',
    nama_ayah: '',
    nama_ibu: '',
    nama_wali: '',
    wa_ortu: ''
  });
  
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef();

  // Load Dropdowns
  useEffect(() => {
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
  }, []);

  // Live NIPD Generation Logic
  useEffect(() => {
    const generateNIPD = async () => {
      if (!formData.tahun_ajaran || !formData.kelas || !formData.angkatan) return;

      // 1. Ambil 4 digit pertama dari Tahun Ajaran (misal 2026/2027 -> 2627)
      let digit1_4 = '2526';
      if (formData.tahun_ajaran.includes('/')) {
        const splitTa = formData.tahun_ajaran.split('/');
        const tahun1 = splitTa[0].slice(-2);
        const tahun2 = splitTa[1].slice(-2);
        digit1_4 = tahun1 + tahun2;
      }

      // 2. Ambil 2 digit kode kelas (07, 08, 09)
      let digit5_6 = '07';
      const kelasStr = String(formData.kelas).toUpperCase();
      if (kelasStr.includes('VIII') || kelasStr.includes('8')) digit5_6 = '08';
      else if (kelasStr.includes('IX') || kelasStr.includes('9')) digit5_6 = '09';
      else if (kelasStr.includes('VII') || kelasStr.includes('7')) digit5_6 = '07';

      // 3. Ambil nomor urut dari database berdasarkan angkatan
      try {
        const { count, error } = await supabase
          .from('data_siswa')
          .select('id', { count: 'exact', head: true })
          .eq('angkatan', formData.angkatan);
          
        if (!error) {
          const nomorUrut = String(count + 1).padStart(3, '0');
          const autoNipd = digit1_4 + digit5_6 + nomorUrut;
          setFormData(prev => ({ ...prev, nipd: autoNipd }));
        }
      } catch (err) {
        console.error("Gagal generate NIPD", err);
      }
    };
    
    // Jangan spam request, tunggu sebentar
    const timer = setTimeout(() => {
      generateNIPD();
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.tahun_ajaran, formData.kelas, formData.angkatan]);

  const currentYear = new Date().getFullYear();
  const angkatanOptions = [];
  for (let y = currentYear - 3; y <= currentYear + 3; y++) {
    angkatanOptions.push(y);
  }

  const currentMonth = new Date().getMonth();
  let activeTaStartYear = (currentMonth < 6) ? currentYear - 1 : currentYear;
  const taOptions = [];
  for (let y = activeTaStartYear - 3; y <= activeTaStartYear + 3; y++) {
    taOptions.push(`${y}/${y + 1}`);
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setFotoPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const toProperCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!turnstileToken) {
      Swal.fire({
        icon: 'warning',
        title: 'Verifikasi CAPTCHA',
        text: 'Mohon selesaikan verifikasi CAPTCHA terlebih dahulu.'
      });
      return;
    }

    setLoading(true);
    try {
      let fotoUrl = null;

      // 1. Upload Foto
      if (fotoFile) {
        const fileExt = fotoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `foto_siswa/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('berkas_ppdb')
          .upload(filePath, fotoFile);

        if (uploadError) throw new Error('Gagal mengupload foto: ' + uploadError.message);

        const { data: publicUrlData } = supabase.storage
          .from('berkas_ppdb')
          .getPublicUrl(filePath);

        fotoUrl = publicUrlData.publicUrl;
      }

      // 2. Siapkan Payload
      const payload = {
        cf_turnstile_token: turnstileToken,
        nik: formData.nik,
        nisn: formData.nisn || null,
        nama: toProperCase(formData.nama),
        tempat_lahir: toProperCase(formData.tempat_lahir),
        tanggal_lahir: formData.tanggal_lahir,
        jenis_kelamin: formData.jenis_kelamin,
        alamat_detail: toProperCase(formData.alamat_detail),
        rt: formData.rt,
        rw: formData.rw,
        desa: toProperCase(formData.desa),
        kecamatan: toProperCase(formData.kecamatan),
        kabupaten: toProperCase(formData.kabupaten),
        provinsi: toProperCase(formData.provinsi),
        wa_siswa: formData.wa_siswa || null,
        kelas: formData.kelas,
        angkatan: formData.angkatan,
        tahun_ajaran: formData.tahun_ajaran,
        tanggal_masuk: formData.tanggal_masuk,
        status_siswa: formData.status_siswa,
        sekolah_asal: toProperCase(formData.sekolah_asal),
        nama_ayah: toProperCase(formData.nama_ayah),
        nama_ibu: toProperCase(formData.nama_ibu),
        nama_wali: formData.nama_wali ? toProperCase(formData.nama_wali) : null,
        wa_ortu: formData.wa_ortu,
        foto_url: fotoUrl
      };

      // 3. Kirim ke Backend
      const response = await fetch('/.netlify/functions/register-siswa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Terjadi kesalahan pada server.');
      }

      Swal.fire({
        icon: 'success',
        title: 'Alhamdulillah!',
        text: 'Data pendaftaran berhasil dikirim dan tersimpan di sistem.',
        confirmButtonColor: '#2a2c87'
      }).then(() => {
        navigate('/');
      });

    } catch (error) {
      console.error('Submit Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengirim',
        text: error.message || 'Terjadi kesalahan saat menyimpan data. Silakan coba lagi.',
      });
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 text-gray-800 font-sans min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#2a2c87] text-white py-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo" className="w-10 h-10 object-contain bg-white rounded-full p-1" />
            <div>
              <h1 className="font-bold text-lg leading-tight">PPDB ONLINE</h1>
              <p className="text-xs text-gray-300">SMP IT Hidayatul Mubtadi-ien</p>
            </div>
          </div>
          <Link to="/" className="text-sm font-medium hover:text-[#85c226] transition flex items-center gap-2">
            <ArrowLeft size={16} /> Kembali ke Beranda
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-10 max-w-4xl flex-grow">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-t-4 border-[#85c226]">
          <div className="p-8 text-center bg-blue-50">
            <h2 className="text-2xl font-bold text-[#2a2c87] mb-2">Formulir Pendaftaran Siswa Baru</h2>
            <p className="text-gray-600">Mohon isi data di bawah ini dengan benar dan lengkap sesuai dokumen asli.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-10">
            {/* A. IDENTITAS */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">A</span>
                IDENTITAS CALON SISWA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">NIK <span className="text-red-500">*</span></label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" name="nik" required value={formData.nik} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setFormData(prev => ({ ...prev, nik: val })); }} onKeyDown={(e) => { if(e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault(); }} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="16 digit NIK" maxLength="16" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">NISN</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" name="nisn" value={formData.nisn} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setFormData(prev => ({ ...prev, nisn: val })); }} onKeyDown={(e) => { if(e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault(); }} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="10 digit NISN" maxLength="10" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">NIPD (Dibuat Otomatis)</label>
                  <input type="text" readOnly value={formData.nipd} className="w-full px-4 py-2 border rounded-lg bg-gray-100 text-[#2a2c87] font-bold italic cursor-not-allowed" placeholder="Pilih Kelas & Tahun Ajaran..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Lengkap <span className="text-red-500">*</span></label>
                  <input type="text" name="nama" required value={formData.nama} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" placeholder="Sesuai Akta Kelahiran" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Tempat Lahir <span className="text-red-500">*</span></label>
                  <input type="text" name="tempat_lahir" required value={formData.tempat_lahir} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
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
                  <input type="text" name="alamat_detail" required value={formData.alamat_detail} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" placeholder="Contoh: Dsn. Sukaseneng, Gg. Yayasan" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">RT <span className="text-red-500">*</span></label>
                    <input type="number" min="1" name="rt" required value={formData.rt} onChange={(e) => { const val = e.target.value; if(val === '' || (parseInt(val) > 0)) { handleInputChange(e); } }} onKeyDown={(e) => { if(e.key === '-' || e.key === 'e' || e.key === '.' || e.key === ',') e.preventDefault(); }} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">RW <span className="text-red-500">*</span></label>
                    <input type="number" min="1" name="rw" required value={formData.rw} onChange={(e) => { const val = e.target.value; if(val === '' || (parseInt(val) > 0)) { handleInputChange(e); } }} onKeyDown={(e) => { if(e.key === '-' || e.key === 'e' || e.key === '.' || e.key === ',') e.preventDefault(); }} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Desa / Kelurahan <span className="text-red-500">*</span></label>
                  <input type="text" name="desa" required value={formData.desa} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Kecamatan <span className="text-red-500">*</span></label>
                  <input type="text" name="kecamatan" required value={formData.kecamatan} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Kabupaten / Kota <span className="text-red-500">*</span></label>
                  <input type="text" name="kabupaten" required value={formData.kabupaten} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Provinsi <span className="text-red-500">*</span></label>
                  <input type="text" name="provinsi" required value={formData.provinsi} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
                </div>
              </div>
            </section>

            {/* C. KONTAK SISWA */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">C</span>
                KONTAK SISWA
              </h3>
              <div>
                <label className="block text-sm font-semibold mb-2">No. WhatsApp Siswa (Aktif)</label>
                <input type="tel" name="wa_siswa" value={formData.wa_siswa} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="08xxxxxxxxxx" />
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
                  <label className="block text-sm font-semibold mb-2">Daftar Ke Kelas <span className="text-red-500">*</span></label>
                  <select name="kelas" required value={formData.kelas} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]">
                    <option value="">-- Pilih Kelas --</option>
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
                  <input type="text" name="sekolah_asal" required value={formData.sekolah_asal} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
                </div>
              </div>
            </section>

            {/* E. IDENTITAS ORANG TUA */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">E</span>
                IDENTITAS ORANG TUA / WALI
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Ayah Kandung <span className="text-red-500">*</span></label>
                  <input type="text" name="nama_ayah" required value={formData.nama_ayah} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Ibu Kandung <span className="text-red-500">*</span></label>
                  <input type="text" name="nama_ibu" required value={formData.nama_ibu} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Nama Wali (Jika ada)</label>
                  <input type="text" name="nama_wali" value={formData.nama_wali} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
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
                <input type="tel" name="wa_ortu" required value={formData.wa_ortu} onChange={handleInputChange} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="Misal: 62812... atau 6012..." />
                <p className="text-xs text-gray-500 mt-1">Gunakan kode negara (tanpa + atau 0 di awal). Contoh: 628123456789</p>
              </div>
            </section>

            {/* G. UPLOAD FOTO */}
            <section>
              <h3 className="flex items-center text-xl font-bold text-[#2a2c87] mb-6 border-b pb-2">
                <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">G</span>
                FOTO DIRI
              </h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-dashed border-gray-400 text-center">
                <label className="block text-sm font-semibold mb-4">Upload Pas Foto (Format JPG/PNG, Max 2MB)</label>
                <input type="file" accept="image/*" onChange={handleFotoChange} className="w-full max-w-xs text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#2a2c87] file:text-white hover:file:bg-blue-800" />
                {fotoPreview && (
                  <div className="mt-4">
                    <img src={fotoPreview} className="w-32 h-40 object-cover mx-auto rounded border shadow-sm" alt="Preview Foto" />
                  </div>
                )}
              </div>
            </section>

            {/* TOMBOL SUBMIT */}
            <div className="pt-6">
              <div className="mb-4 flex justify-center">
                <Turnstile
                  siteKey="0x4AAAAAADNI882pWId6yER0"
                  ref={turnstileRef}
                  onSuccess={(token) => setTurnstileToken(token)}
                  options={{ theme: 'light' }}
                />
              </div>

              <button type="submit" disabled={loading} className="w-full bg-[#85c226] hover:bg-green-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg transform transition hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (
                  <>Memvalidasi & Mengirim Data...</>
                ) : (
                  <><span>KIRIM FORMULIR</span><Send size={20} /></>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2a2c87] text-white py-6 text-center mt-auto">
        <p className="text-sm opacity-80">&copy; 2026 SMP IT Hidayatul Mubtadi-ien Compreng</p>
      </footer>
    </div>
  );
}
