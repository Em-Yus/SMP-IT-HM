import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';

export default function AdminPendaftaranSPMB() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [noReg, setNoReg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    nama: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    alamat_detail: '',
    sekolah_asal: '',
    nama_ayah: '',
    nama_ibu: '',
    wa_ortu: '',
    wa_siswa: ''
  });

  const generateNoRegString = async () => {
    const thn = new Date().getFullYear().toString().slice(-2);
    const prefix = `REG-${thn}-`;

    try {
      const { data, error } = await supabase
        .from('ppdb_pendaftar')
        .select('no_pendaftaran')
        .like('no_pendaftaran', `${prefix}%`);

      if (error) throw error;

      let maxUrut = 0;
      if (data && data.length > 0) {
        data.forEach(item => {
          if (item.no_pendaftaran) {
            const parts = item.no_pendaftaran.split('-');
            if (parts.length === 3) {
              const num = parseInt(parts[2], 10);
              if (!isNaN(num) && num > maxUrut) {
                maxUrut = num;
              }
            }
          }
        });
      }

      return prefix + (maxUrut + 1).toString().padStart(3, '0');
    } catch (err) {
      console.error("Gagal generate no registrasi", err);
      return 'REG-ERROR';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'wa_ortu' || name === 'wa_siswa') {
      const val = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, [name]: val }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const toProperCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const generatedNoReg = await generateNoRegString();
      setNoReg(generatedNoReg); // Update UI just in case it's needed

      // 1. Simpan ke ppdb_pendaftar
      const payloadSiswa = {
        no_pendaftaran: generatedNoReg,
        nama: toProperCase(formData.nama),
        tempat_lahir: toProperCase(formData.tempat_lahir),
        tanggal_lahir: formData.tanggal_lahir,
        alamat_detail: toProperCase(formData.alamat_detail),
        sekolah_asal: toProperCase(formData.sekolah_asal),
        nama_ayah: toProperCase(formData.nama_ayah),
        nama_ibu: toProperCase(formData.nama_ibu),
        wa_ortu: formData.wa_ortu,
        wa_siswa: formData.wa_siswa || null,
        status_siswa: 'Baru',
        kelas: 'Calon Siswa',
        status_berkas: 'Kurang'
      };

      const { error: errSiswa } = await supabase
        .from('ppdb_pendaftar')
        .insert([payloadSiswa]);

      if (errSiswa) throw errSiswa;

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Data calon siswa berhasil disimpan ke database.',
      }).then(() => {
        // Refresh page to generate next number
        window.location.reload();
      });

    } catch (error) {
      console.error('Error submitting form:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: error.message || 'Terjadi kesalahan jaringan.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#2a2c87] flex items-center gap-3">
              <FileText className="text-[#85c226]" size={32} />
              Pendaftaran SPMB Manual
            </h1>
            <p className="text-gray-500 mt-2">Gunakan formulir ini untuk pendaftaran calon siswa secara offline.</p>
          </div>
          <Link to="/" className="bg-white border text-gray-600 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2 font-medium transition">
            <ArrowLeft size={18} /> Kembali
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: BIODATA */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-[#2a2c87] mb-6 flex items-center border-b pb-3">
              <span className="bg-[#2a2c87] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">1</span>
              Biodata Calon Siswa
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2 text-gray-700">Nomor Registrasi <span className="text-sm font-normal text-[#85c226] italic">(Otomatis)</span></label>
                <input type="text" readOnly value={noReg} className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 font-mono font-bold text-[#2a2c87] focus:outline-none" placeholder="Memuat..." />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2 text-gray-700">Nama Lengkap Siswa <span className="text-red-500">*</span></label>
                <input type="text" name="nama" required value={formData.nama} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Tempat Lahir <span className="text-red-500">*</span></label>
                <input type="text" name="tempat_lahir" required value={formData.tempat_lahir} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Tanggal Lahir <span className="text-red-500">*</span></label>
                <input type="date" name="tanggal_lahir" required value={formData.tanggal_lahir} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2 text-gray-700">Alamat Lengkap <span className="text-red-500">*</span></label>
                <textarea name="alamat_detail" rows="3" required value={formData.alamat_detail} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" placeholder="Contoh: Ds. Sukaseneng RT 01 RW 02, Kec. Compreng"></textarea>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2 text-gray-700">Asal Sekolah (SD/MI) <span className="text-red-500">*</span></label>
                <input type="text" name="sekolah_asal" required value={formData.sekolah_asal} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" placeholder="Contoh: SDN 1 Compreng" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Nama Ayah <span className="text-red-500">*</span></label>
                <input type="text" name="nama_ayah" required value={formData.nama_ayah} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Nama Ibu <span className="text-red-500">*</span></label>
                <input type="text" name="nama_ibu" required value={formData.nama_ibu} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226] capitalize" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">Nomor Registrasi</label>
                <input 
                  type="text" 
                  value={noReg ? noReg : "Dibuat otomatis saat disimpan"} 
                  readOnly
                  className="w-full bg-gray-100 text-gray-500 rounded-lg p-3 outline-none border border-gray-200 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Nomor WA Orang Tua/Wali <span className="text-red-500">*</span></label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" name="wa_ortu" required value={formData.wa_ortu} onChange={handleInputChange} onKeyDown={(e) => { if(e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault(); }} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="Contoh: 6281234567890" maxLength="15" />
                <p className="text-xs text-gray-500 mt-1">Tanpa awalan 0 atau +, gunakan kode negara (misal 62)</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Nomor WA Siswa (Jika Ada)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" name="wa_siswa" value={formData.wa_siswa} onChange={handleInputChange} onKeyDown={(e) => { if(e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault(); }} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#85c226]" placeholder="Contoh: 6281234567890" maxLength="15" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[#2a2c87] hover:bg-blue-900 text-white font-bold py-4 rounded-xl text-lg shadow-lg transform transition hover:-translate-y-1 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
            {loading ? (
              <>Menyimpan Data...</>
            ) : (
              <><Save size={24} /> Simpan Data Pendaftar</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
