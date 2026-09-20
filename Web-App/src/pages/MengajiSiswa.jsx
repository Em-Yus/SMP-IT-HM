import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Book, Users, MapPin, UserCheck, Search, BookOpen } from 'lucide-react';
import Swal from 'sweetalert2';

export default function MengajiSiswa() {
  const [kelasMengaji, setKelasMengaji] = useState(null);
  const [temanSatuKelas, setTemanSatuKelas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchKelasMengaji = async () => {
      setIsLoading(true);
      try {
        const session = localStorage.getItem('user_siswa');
        if (!session) {
          throw new Error("Sesi tidak ditemukan. Silakan login kembali.");
        }
        const parsed = JSON.parse(session);
        setUserData(parsed);

        // 1. Dapatkan kelas_mengaji terbaru dari data siswa
        const { data: siswaData, error: errSiswa } = await supabase
          .from('data_siswa')
          .select('kelas_mengaji')
          .eq('nipd', parsed.nipd)
          .maybeSingle();

        if (errSiswa) throw errSiswa;

        if (siswaData && siswaData.kelas_mengaji) {
          // 2. Dapatkan detail kelas mengaji
          const { data: detailKelas, error: errKelas } = await supabase
            .from('data_kelas_mengaji')
            .select('*, data_ruang(nama_ruang)')
            .eq('nama_kelas', siswaData.kelas_mengaji)
            .maybeSingle();

          if (errKelas) throw errKelas;
          if (detailKelas) setKelasMengaji(detailKelas);

          // 3. Dapatkan daftar teman satu kelas mengaji
          const { data: temanData, error: errTeman } = await supabase
            .from('data_siswa')
            .select('id, nama, nipd, jenis_kelamin, kelas')
            .eq('kelas_mengaji', siswaData.kelas_mengaji)
            .eq('status_keaktifan', 'Aktif')
            .order('nama', { ascending: true });

          if (errTeman) throw errTeman;
          if (temanData) setTemanSatuKelas(temanData);
        }
      } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data kelas mengaji.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchKelasMengaji();
  }, []);

  const filteredTeman = temanSatuKelas.filter(t => 
    t.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.kelas && t.kelas.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full -z-0"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Book className="text-green-600" /> Kelas Mengaji
          </h2>
          <p className="text-gray-500 mt-1">Informasi rombongan belajar mengaji dan teman satu kelompok.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
        </div>
      ) : !kelasMengaji ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-700">Belum Ada Kelas Mengaji</h3>
          <p className="text-gray-500 max-w-md mx-auto mt-2">Anda belum dimasukkan ke dalam kelompok kelas mengaji. Silakan hubungi admin atau guru pengampu untuk pembagian kelas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card Info Kelas */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <Book className="absolute right-[-10px] bottom-[-10px] opacity-20" size={120} />
              <div className="relative z-10">
                <div className="text-green-100 font-medium text-sm mb-1 uppercase tracking-wider">Nama Kelas</div>
                <h3 className="text-3xl font-bold mb-6">{kelasMengaji.nama_kelas}</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <UserCheck size={18} />
                    </div>
                    <div>
                      <p className="text-xs text-green-100">Guru Pengajar</p>
                      <p className="font-bold">{kelasMengaji.guru_pengajar || 'Belum ditentukan'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-xs text-green-100">Ruang / Tempat</p>
                      <p className="font-bold">{kelasMengaji.data_ruang?.nama_ruang || 'Belum ditentukan'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center shrink-0">
                <Users size={28} />
              </div>
              <div>
                <h4 className="text-4xl font-black text-gray-800">{temanSatuKelas.length}</h4>
                <p className="text-sm font-bold text-gray-500 uppercase mt-1">Total Anggota Kelas</p>
              </div>
            </div>
          </div>

          {/* Daftar Teman */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[500px] lg:h-[600px]">
            <div className="p-6 border-b border-gray-100 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Users className="text-green-600" size={20} /> Teman Satu Kelompok
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  placeholder="Cari nama teman..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm bg-gray-50"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {filteredTeman.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  Tidak ada teman yang ditemukan.
                </div>
              ) : (
                filteredTeman.map((teman) => (
                  <div key={teman.id} className={`flex items-center gap-4 p-3 rounded-xl border ${teman.nipd === userData?.nipd ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-green-100 hover:bg-gray-50 transition'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${teman.jenis_kelamin === 'L' ? 'bg-blue-100 text-blue-700' : teman.jenis_kelamin === 'P' ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-700'}`}>
                      {teman.nama.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-800 truncate">{teman.nama} {teman.nipd === userData?.nipd && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full ml-2 align-middle">Anda</span>}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Kelas Reguler: {teman.kelas || 'Belum ada'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
