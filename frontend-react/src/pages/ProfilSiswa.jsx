import { useState, useEffect } from 'react';
import { User, Phone, MapPin, Edit3, Camera } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../services/supabaseClient';

export default function ProfilSiswa() {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('user_siswa');
    if (session) {
      setUserData(JSON.parse(session));
    }
  }, []);

  const handleUpdate = (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulasi update data
    setTimeout(() => {
      setIsLoading(false);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Profil berhasil diperbarui (Simulasi)',
        timer: 1500,
        showConfirmButton: false
      });
    }, 800);
  };

  if (!userData) return <div className="p-8 text-center">Memuat data profil...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Profil Saya</h2>
          <p className="text-gray-500 mt-1">Kelola informasi pribadi dan data akademik Anda.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kolom Kiri: Foto dan Info Singkat */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
            <div className="relative inline-block mb-4">
              <div className="w-32 h-32 bg-gray-200 rounded-full mx-auto overflow-hidden border-4 border-white shadow-lg">
                {userData.foto_url ? (
                  <img src={userData.foto_url} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <User size={64} className="text-gray-400 mt-6 mx-auto" />
                )}
              </div>
              <button className="absolute bottom-0 right-0 bg-accent text-white p-2 rounded-full shadow hover:bg-orange-600 transition">
                <Camera size={16} />
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-gray-800">{userData.nama || userData.nama_lengkap}</h3>
            <p className="text-sm text-gray-500 mb-4">{userData.nisn || 'NISN Belum Diatur'}</p>
            
            <div className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-3 py-1 rounded-full text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Siswa Aktif
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h4 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wider">Kontak Cepat</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-orange-50 text-accent p-2 rounded-lg"><Phone size={16} /></div>
                <div>
                  <p className="text-xs text-gray-500">No. WhatsApp</p>
                  <p className="text-sm font-medium text-gray-800">{userData.no_wa || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><MapPin size={16} /></div>
                <div>
                  <p className="text-xs text-gray-500">Alamat</p>
                  <p className="text-sm font-medium text-gray-800">{userData.alamat || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Form Edit Data */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <h3 className="font-bold text-gray-800">Data Pribadi</h3>
              <button className="text-accent text-sm font-medium flex items-center gap-1 hover:underline">
                <Edit3 size={16} /> Edit Data
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nama Lengkap</label>
                  <input type="text" defaultValue={userData.nama || userData.nama_lengkap} disabled className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">NISN</label>
                  <input type="text" defaultValue={userData.nisn} disabled className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tempat Lahir</label>
                  <input type="text" defaultValue={userData.tempat_lahir} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Lahir</label>
                  <input type="date" defaultValue={userData.tanggal_lahir} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Jenis Kelamin</label>
                  <select defaultValue={userData.jenis_kelamin || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent outline-none">
                    <option value="">Pilih...</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Agama</label>
                  <input type="text" defaultValue={userData.agama || 'Islam'} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent outline-none" />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <button type="submit" disabled={isLoading} className="w-full md:w-auto bg-accent hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition shadow flex items-center justify-center">
                  {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
