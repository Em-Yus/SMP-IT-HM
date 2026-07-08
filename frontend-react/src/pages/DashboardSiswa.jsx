import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, BookOpen, Clock, CalendarDays, Award, Megaphone, Wallet, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export default function DashboardSiswa() {
  const [userData, setUserData] = useState(null);
  const [pengumuman, setPengumuman] = useState([]);
  const [isLoadingPengumuman, setIsLoadingPengumuman] = useState(true);
  
  // Dashboard Metrics
  const [metrics, setMetrics] = useState({
    kehadiran: 0,
    tagihan: 0,
    jadwal: [],
    rataRata: 0
  });

  useEffect(() => {
    const session = localStorage.getItem('user_siswa');
    if (session) {
      const parsed = JSON.parse(session);
      setUserData(parsed);
      fetchDashboardData(parsed);
    }
  }, []);

  const fetchDashboardData = async (user) => {
    try {
      // 1. Fetch Presensi
      const { data: presensi } = await supabase
        .from('presensi_siswa')
        .select('status')
        .eq('nipd', user.nipd);
      
      let kehadiranRate = 0;
      if (presensi && presensi.length > 0) {
        const hadir = presensi.filter(p => p.status === 'H').length;
        kehadiranRate = Math.round((hadir / presensi.length) * 100);
      }

      // 2. Fetch Saldo Tagihan (Sisa Tagihan)
      const { data: saldo } = await supabase
        .from('tb_saldo_siswa')
        .select('sisa_tagihan')
        .eq('siswa_id', user.id);
        
      let totalTagihan = 0;
      if (saldo && saldo.length > 0) {
        totalTagihan = saldo.reduce((sum, item) => sum + (Number(item.sisa_tagihan) || 0), 0);
      }

      // 3. Fetch Jadwal Hari Ini
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const today = days[new Date().getDay()];
      
      let jadwalHariIni = [];
      if (user.kelas) {
        // Fetch kelas_id first
        const { data: dataKelasRes } = await supabase
          .from('data_kelas')
          .select('id')
          .eq('nama_kelas', user.kelas)
          .maybeSingle();

        if (dataKelasRes) {
          const { data: jadwal } = await supabase
            .from('jadwal_pelajaran')
            .select('jam_ke, waktu, is_istirahat, data_mapel(nama_mapel), data_guru(nama)')
            .eq('hari', today)
            .or(`kelas_id.eq.${dataKelasRes.id},is_istirahat.eq.true`)
            .order('jam_ke', { ascending: true })
            .limit(5);
            
          if (jadwal) {
             jadwalHariIni = jadwal.map(j => ({
               jam_ke: j.jam_ke,
               waktu: j.waktu,
               mapel: j.is_istirahat ? 'ISTIRAHAT' : (j.data_mapel?.nama_mapel || '-'),
               guru: j.is_istirahat ? '-' : (j.data_guru?.nama || '-'),
               is_istirahat: j.is_istirahat
             }));
          }
        }
      }

      // 4. Fetch Rata-rata Nilai
      const { data: nilaiSiswa } = await supabase
        .from('nilai_siswa')
        .select('nilai_siswa')
        .eq('nipd', user.nipd);
      
      let avgNilai = 0;
      if (nilaiSiswa && nilaiSiswa.length > 0) {
        const total = nilaiSiswa.reduce((sum, item) => sum + (Number(item.nilai_siswa) || 0), 0);
        avgNilai = (total / nilaiSiswa.length).toFixed(1);
      }

      setMetrics({
        kehadiran: kehadiranRate,
        tagihan: totalTagihan,
        jadwal: jadwalHariIni,
        rataRata: avgNilai
      });
      
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  useEffect(() => {
    const fetchPengumuman = async () => {
      try {
        const { data, error } = await supabase
          .from('cms_pengumuman')
          .select('*')
          .eq('status', 'Aktif')
          .in('target', ['Siswa', 'Semua'])
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setPengumuman(data || []);
      } catch (err) {
        console.error('Gagal memuat pengumuman:', err);
      } finally {
        setIsLoadingPengumuman(false);
      }
    };
    fetchPengumuman();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };
  
  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number || 0);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Halo, {userData?.nama || 'Siswa'}! 👋</h2>
        <p className="text-gray-500 mt-1">Selamat datang di Portal Siswa SIAKAD.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-orange-500 to-accent rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
          <CalendarDays className="absolute right-[-10px] bottom-[-10px] opacity-20" size={100} />
          <div className="relative z-10">
            <h3 className="text-orange-100 font-medium text-sm">Kehadiran Anda</h3>
            <div className="text-3xl font-bold mt-1">{metrics.kehadiran}%</div>
            <p className="text-xs text-orange-100 mt-2">Sepanjang masa akademik</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
          <Wallet className="absolute right-[-10px] bottom-[-10px] opacity-20" size={100} />
          <div className="relative z-10">
            <h3 className="text-blue-100 font-medium text-sm">Tagihan Aktif</h3>
            <div className="text-3xl font-bold mt-1 truncate max-w-[200px]">{formatRupiah(metrics.tagihan)}</div>
            <p className="text-xs text-blue-100 mt-2">Segera lakukan pembayaran</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
          <Award className="absolute right-[-10px] bottom-[-10px] opacity-20" size={100} />
          <div className="relative z-10">
            <h3 className="text-green-100 font-medium text-sm">Rata-rata Nilai</h3>
            <div className="text-3xl font-bold mt-1">{metrics.rataRata}</div>
            <p className="text-xs text-green-100 mt-2">Dari semua mata pelajaran</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b pb-2 gap-2 sm:gap-0">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Clock size={18} className="text-blue-500 shrink-0" /> Jadwal Kelas Hari Ini
            </h3>
            <Link to="/jadwal-pelajaran-siswa" className="text-sm font-semibold text-primary hover:text-blue-800 flex items-center gap-1 transition self-start sm:self-auto">
              Lihat Semua <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-4 flex-1">
            {metrics.jadwal.length === 0 ? (
              <div className="text-center text-gray-400 py-6 text-sm bg-gray-50 rounded-lg h-full flex items-center justify-center">Tidak ada jadwal pelajaran hari ini. Selamat beristirahat!</div>
            ) : (
              <ul className="space-y-4">
                {metrics.jadwal.map((j, idx) => (
                  <li key={idx} className={`flex items-center gap-4 p-2 rounded-lg border ${j.is_istirahat ? 'bg-orange-50 border-orange-100' : 'bg-transparent border-transparent'}`}>
                    <div className={`p-2 rounded-lg text-sm font-bold text-center w-28 shrink-0 ${j.is_istirahat ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                      {j.waktu}
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-bold ${j.is_istirahat ? 'text-orange-600' : 'text-gray-800'}`}>{j.mapel}</h4>
                      <p className="text-sm text-gray-500">{j.guru}</p>
                    </div>
                    <div className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">Ke-{j.jam_ke}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
            <Megaphone size={18} className="text-accent" /> Pengumuman Sekolah
          </h3>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {isLoadingPengumuman ? (
              <div className="text-center text-gray-400 py-4 text-sm">Memuat pengumuman...</div>
            ) : pengumuman.length === 0 ? (
              <div className="text-center text-gray-400 py-6 text-sm bg-gray-50 rounded-lg">Belum ada pengumuman untuk Anda.</div>
            ) : (
              pengumuman.map((item) => (
                <div key={item.id} className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-1 gap-2">
                     <h4 className="font-bold text-[#2a2c87] text-sm leading-tight">{item.judul}</h4>
                     <span className="text-[10px] font-bold text-white bg-accent px-2 py-0.5 rounded-full whitespace-nowrap">
                        {formatDate(item.created_at)}
                     </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-line leading-relaxed">{item.isi}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
