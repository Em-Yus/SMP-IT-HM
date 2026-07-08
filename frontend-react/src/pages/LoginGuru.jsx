import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { supabase } from '../services/supabaseClient';

export default function LoginGuru() {
  const [nik, setNik] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!nik || !tanggalLahir) {
      Swal.fire({ icon: 'warning', title: 'Oops...', text: 'NIK/NIY dan Tanggal Lahir wajib diisi!' });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('data_guru')
        .select('*')
        .eq('nik', nik)
        .eq('tanggal_lahir', tanggalLahir)
        .maybeSingle();

      if (error) {
        Swal.fire({ icon: 'error', title: 'Error Query DB', text: error.message });
      } else if (!data) {
        Swal.fire({
          icon: 'error',
          title: 'Tidak Ditemukan',
          text: `Data dengan NIK ${nik} dan Tanggal Lahir ${tanggalLahir} tidak ditemukan di tabel data_guru. Mungkin karena format tanggal (di database beda) atau RLS (Row Level Security) yang memblokir akses sebelum login.`
        });
      } else {
        // Fetch jabatan_guru to get roles
        const { data: jabatanGuru } = await supabase
          .from('jabatan_guru')
          .select('*')
          .eq('guru_id', data.id)
          .maybeSingle();
          
        let userPermissions = [];
        
        if (jabatanGuru) {
          if (Array.isArray(jabatanGuru.hak_akses)) {
            userPermissions = [...jabatanGuru.hak_akses];
          }

          const roles = [
            jabatanGuru.jabatan_utama,
            jabatanGuru.jabatan_lain_1,
            jabatanGuru.jabatan_lain_2,
            jabatanGuru.jabatan_lain_3
          ].filter(Boolean); // Remove empty strings or nulls

          if (roles.length > 0) {
            const { data: listJabatan } = await supabase
              .from('data_jabatan')
              .select('hak_akses')
              .in('nama_jabatan', roles);
              
            if (listJabatan) {
              listJabatan.forEach(item => {
                if (Array.isArray(item.hak_akses)) {
                  userPermissions = [...userPermissions, ...item.hak_akses];
                }
              });
              // Remove duplicates
              userPermissions = [...new Set(userPermissions)];
            }
          }
        }
        
        // Save user data and permissions
        localStorage.setItem('user_guru', JSON.stringify(data));
        localStorage.setItem('user_permissions', JSON.stringify(userPermissions));
        
        Swal.fire({
          icon: 'success',
          title: 'Login Berhasil',
          text: `Selamat datang, ${data.nama}!`,
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          navigate('/dashboard-guru');
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Terjadi Kesalahan', text: 'Gagal terhubung ke server.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bgSoft flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl p-8 border-t-4 border-primary">
        <div className="flex mb-8 border-b border-gray-200">
          <Link to="/login-siswa" className="flex-1 text-center py-3 border-b-2 border-transparent text-gray-500 hover:text-primary transition font-medium">
            Siswa
          </Link>
          <Link to="/login-guru" className="flex-1 text-center py-3 border-b-2 border-primary text-primary font-bold">
            Pegawai / Guru
          </Link>
        </div>

        <div className="text-center mb-8">
          <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo" className="w-20 h-20 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary">Login SIAKAD</h2>
          <p className="text-gray-500 text-sm">Masuk untuk melanjutkan sebagai Pegawai/Guru</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">NIK / NIY</label>
            <input
              type="text"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent focus:border-accent outline-none transition"
              placeholder="Masukkan NIK/NIY Anda"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Lahir</label>
            <input
              type="date"
              value={tanggalLahir}
              onChange={(e) => setTanggalLahir(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent focus:border-accent outline-none transition"
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary text-white py-3 px-4 rounded-xl font-bold shadow-lg hover:bg-blue-900 transition-colors mt-6 flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isLoading ? 'Memproses...' : 'Masuk'}
          </button>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Belum punya akun? </span>
            <Link to="/pendaftaran-guru" className="text-primary hover:underline font-semibold">
              Daftar di sini
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
