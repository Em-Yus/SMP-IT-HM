import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { supabase } from '../services/supabaseClient';
import { Html5QrcodeScanner } from 'html5-qrcode';
import CryptoJS from 'crypto-js';
import { ScanLine, User } from 'lucide-react';

export default function LoginSiswa() {
  const [nisn, setNisn] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const navigate = useNavigate();

  const SECRET_KEY = import.meta.env.VITE_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

  useEffect(() => {
    let scanner = null;
    if (isScanning) {
      scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        async (decodedText) => {
          // Pause scanning while processing
          if (scanner) scanner.pause();
          
          try {
            const bytes = CryptoJS.AES.decrypt(decodedText, SECRET_KEY);
            const nipd = bytes.toString(CryptoJS.enc.Utf8);

            if (!nipd || nipd === "NO-DATA") {
              throw new Error("QR Code tidak valid atau kosong.");
            }

            // Verify and login
            Swal.fire({ title: 'Memproses...', text: 'Memverifikasi data kartu...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const { data: siswaData, error: siswaErr } = await supabase
              .from('data_siswa')
              .select('*')
              .eq('nipd', nipd)
              .maybeSingle();

            if (siswaErr || !siswaData) {
              Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Data siswa tidak ditemukan dari QR Code ini.' });
              if (scanner) scanner.resume();
            } else {
              if (scanner) scanner.clear();
              setIsScanning(false);
              localStorage.setItem('user_siswa', JSON.stringify(siswaData));
              Swal.close();
              successLogin(siswaData.nama);
            }
          } catch (err) {
            console.error("Scan error:", err);
            Swal.fire({ icon: 'error', title: 'QR Code Tidak Valid', text: 'Pastikan ini adalah QR Code Kartu Pelajar yang sah.' });
            if (scanner) scanner.resume();
          }
        },
        (errorMessage) => {
          // ignore scan failures (happens continuously until QR is found)
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [isScanning]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!nisn || !tanggalLahir) {
      Swal.fire({ icon: 'warning', title: 'Oops...', text: 'NISN dan Tanggal Lahir wajib diisi!' });
      setIsLoading(false);
      return;
    }

    try {
      // Menggunakan pendekatan Supabase Auth (NISN dikonversi menjadi email)
      const email = `${nisn}@smpithm.local`;

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: tanggalLahir
      });

      if (error || !authData.user) {
        // Fallback jika tidak menggunakan Auth, coba query langsung ke tabel
        const { data: siswaData, error: siswaErr } = await supabase
          .from('data_siswa')
          .select('*')
          .eq('nisn', nisn)
          .eq('tanggal_lahir', tanggalLahir)
          .maybeSingle();

        if (siswaErr || !siswaData) {
          Swal.fire({ icon: 'error', title: 'Login Gagal', text: 'NISN atau Tanggal Lahir salah!' });
        } else {
          localStorage.setItem('user_siswa', JSON.stringify(siswaData));
          successLogin(siswaData.nama);
        }
      } else {
        const userMeta = authData.user.user_metadata;
        localStorage.setItem('user_siswa', JSON.stringify(userMeta));
        successLogin(userMeta.nama || userMeta.nama_lengkap);
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Terjadi Kesalahan', text: 'Gagal terhubung ke server.' });
    } finally {
      setIsLoading(false);
    }
  };

  const successLogin = (nama) => {
    Swal.fire({
      icon: 'success',
      title: 'Login Berhasil',
      text: `Selamat datang, ${nama || 'Siswa'}!`,
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      navigate('/dashboard-siswa');
    });
  };

  return (
    <div className="min-h-screen bg-bgSoft flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl p-8 border-t-4 border-primary">
        <div className="flex mb-8 border-b border-gray-200">
          <Link to="/login-siswa" className="flex-1 text-center py-3 border-b-2 border-primary text-primary font-bold">
            Siswa
          </Link>
          <Link to="/login-guru" className="flex-1 text-center py-3 border-b-2 border-transparent text-gray-500 hover:text-primary transition font-medium">
            Pegawai / Guru
          </Link>
        </div>

        <div className="text-center mb-8">
          <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo" className="w-20 h-20 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary">Portal Siswa</h2>
          <p className="text-gray-500 text-sm mt-1">SIAKAD SMP IT Hidayatul Mubtadi-ien</p>
        </div>

        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
           <button 
             onClick={() => setIsScanning(false)} 
             className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-bold rounded-md transition ${!isScanning ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
           >
             <User size={16} /> Formulir
           </button>
           <button 
             onClick={() => setIsScanning(true)} 
             className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-bold rounded-md transition ${isScanning ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
           >
             <ScanLine size={16} /> Scan Kartu
           </button>
        </div>
        
        {isScanning ? (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-gray-50 p-2 rounded-xl overflow-hidden border border-gray-200">
              <div id="reader" className="w-full"></div>
            </div>
            <p className="text-center text-sm text-gray-500">
              Arahkan kamera ke QR Code pada Kartu Pelajar Anda.
            </p>
            <button 
              onClick={() => setIsScanning(false)}
              className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-bold hover:bg-gray-300 transition-colors"
            >
              Kembali ke Formulir
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in zoom-in duration-300">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">NISN</label>
              <input 
                type="text" 
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                placeholder="Masukkan Nomor Induk Siswa Nasional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Lahir</label>
              <input 
                type="date" 
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-primary text-white py-3 px-4 rounded-xl font-bold shadow-lg hover:bg-blue-900 transition-colors mt-6 flex justify-center items-center gap-2"
            >
              {isLoading ? 'Memproses...' : 'Masuk Sekarang'}
            </button>

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-600">Belum punya akun? </span>
              <Link to="/pendaftaran-siswa" className="text-primary hover:underline font-semibold">
                Daftar di sini
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
