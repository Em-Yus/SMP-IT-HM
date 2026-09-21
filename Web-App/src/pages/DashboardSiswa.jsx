import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, BookOpen, Clock, CalendarDays, Award, Megaphone, Wallet, ChevronRight, Laptop } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { getOperationalDayName } from '../utils/dateUtils';

export default function DashboardSiswa() {
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

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
    const sessionStr = localStorage.getItem('user_siswa');
    if (sessionStr) {
      const parsed = JSON.parse(sessionStr);
      setUserData(parsed);
      fetchFreshUserData(parsed);
    }
  }, []);

  const fetchFreshUserData = async (sessionData) => {
    try {
      if (!sessionData) return;
      
      let query = supabase.from('data_siswa').select('*');
      if (sessionData.nipd) query = query.eq('nipd', sessionData.nipd);
      else if (sessionData.nisn) query = query.eq('nisn', sessionData.nisn);
      else if (sessionData.nama) query = query.eq('nama', sessionData.nama);
      else {
        fetchDashboardData(sessionData);
        return;
      }
      
      const { data } = await query.maybeSingle();
      
      if (data) {
        setUserData(data);
        localStorage.setItem('user_siswa', JSON.stringify(data)); // Save full data to fix missing fields like tahun_ajaran
        fetchDashboardData(data);
      } else {
        fetchDashboardData(sessionData);
      }
    } catch (err) {
      console.error(err);
      fetchDashboardData(sessionData); // Fallback
    }
  };

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
      
      // 3. Fetch Jadwal Hari Ini & Info Kelas (pergantian hari pukul 18.00 WIB)
      const today = getOperationalDayName();
      
      let jadwalHariIni = [];
      let tingkatSiswa = 7; // Default
      let kelasId = null;

      if (user.kelas) {
        // Fetch kelas_id dan tingkat
        const { data: dataKelasRes } = await supabase
          .from('data_kelas')
          .select('id, tingkat')
          .eq('nama_kelas', user.kelas)
          .maybeSingle();

        if (dataKelasRes) {
          kelasId = dataKelasRes.id;
          if (dataKelasRes.tingkat) tingkatSiswa = dataKelasRes.tingkat;

          const { data: jadwal } = await supabase
            .from('jadwal_pelajaran')
            .select('jam_ke, waktu, is_istirahat, data_mapel(nama_mapel), data_guru(nama), master_jam(urutan, waktu_mulai, waktu_selesai)')
            .eq('hari', today)
            .or(`kelas_id.eq.${kelasId},is_istirahat.eq.true`);
            
          if (jadwal) {
             jadwal.sort((a,b) => (a.master_jam?.urutan || 999) - (b.master_jam?.urutan || 999));
             const top5 = jadwal.slice(0, 5);
             jadwalHariIni = top5.map(j => ({
               jam_ke: j.jam_ke,
               waktu: j.master_jam?.waktu_mulai 
                 ? `${j.master_jam.waktu_mulai.substring(0, 5)} - ${j.master_jam.waktu_selesai?.substring(0, 5)}`
                 : j.waktu,
               mapel: j.is_istirahat ? 'ISTIRAHAT' : (j.data_mapel?.nama_mapel || '-'),
               guru: j.is_istirahat ? '-' : (j.data_guru?.nama || '-'),
               is_istirahat: j.is_istirahat
             }));
          }
        }
      }

      // 2. Kalkulasi Tagihan Aktif
      let totalTagihan = 0;
      try {
        // Pakai tahun_ajaran dari data_siswa untuk SEMUA query
        const tahunPelajaran = user.tahun_ajaran;

        // Tentukan Tipe Siswa berdasarkan status_siswa di data_siswa
        let tipeSiswa = 'Siswa Baru';
        if (user.status_siswa) {
          const statusLower = user.status_siswa.toLowerCase();
          if (statusLower === 'baru') {
            tipeSiswa = 'Siswa Baru';
          } else if (statusLower === 'pindahan') {
            // Hitung tingkat saat siswa MASUK berdasarkan selisih tahun
            const now = new Date();
            const currentSchoolYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
            const entryYear = parseInt((tahunPelajaran || '').split('/')[0]) || currentSchoolYear;
            const yearsPassed = Math.max(0, currentSchoolYear - entryYear);
            const entryTingkat = Math.max(7, tingkatSiswa - yearsPassed);
            tipeSiswa = `Pindahan Kelas ${entryTingkat}`;
          } else {
            tipeSiswa = user.status_siswa;
          }
        }

        console.log('[DEBUG TAGIHAN]', {
          nipd: user.nipd,
          nama: user.nama,
          tahun_ajaran: tahunPelajaran,
          kelas: user.kelas,
          tingkatSiswa,
          tipeSiswa
        });
        if (!tahunPelajaran) throw new Error('Tahun ajaran tidak ditemukan');

        const { data: bpm } = await supabase
          .from('biaya_pengembangan_mutu')
          .select('data_anggaran, tahun_pelajaran')
          .eq('semester', 'Tahunan')
          .eq('tipe_siswa', tipeSiswa)
          .eq('tahun_pelajaran', tahunPelajaran)
          .maybeSingle();

        console.log('[DEBUG BPM]', { bpm });
          
        let totalBiaya = 0;
        if (bpm && bpm.data_anggaran) {
          bpm.data_anggaran.forEach(item => {
            const cost = item[`tingkat${tingkatSiswa}`] || item[`kelas${tingkatSiswa}`] || 0;
            console.log('[DEBUG ITEM]', item.uraian, `tingkat${tingkatSiswa}=`, cost);
            totalBiaya += Number(cost);
          });
        }

        const { data: pemasukan } = await supabase
          .from('tb_pemasukan_siswa')
          .select('nominal')
          .eq('siswa_id', user.id)
          .eq('tahun_pelajaran', tahunPelajaran)
          .eq('semester', 'Tahunan');

        console.log('[DEBUG PEMASUKAN]', pemasukan);
          
        const totalPemasukan = (pemasukan || []).reduce((sum, item) => sum + Number(item.nominal || 0), 0);

        const { data: saldo } = await supabase
          .from('tb_saldo_siswa')
          .select('saldo_sebelumnya, subsidi_pip')
          .eq('siswa_id', user.id)
          .eq('tahun_pelajaran', tahunPelajaran)
          .eq('semester', 'Tahunan')
          .maybeSingle();

        const totalSudahBayar = totalPemasukan + Number(saldo?.saldo_sebelumnya || 0) + Number(saldo?.subsidi_pip || 0);
        totalTagihan = totalBiaya > totalSudahBayar ? totalBiaya - totalSudahBayar : 0;
        console.log('[DEBUG FINAL]', { totalBiaya, totalPemasukan, totalSudahBayar, totalTagihan });
      } catch (errTagihan) {
        console.error('Error calculating tagihan:', errTagihan);
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

  const [activeExam, setActiveExam] = useState(null);

  useEffect(() => {
    const checkActiveCbt = async () => {
      try {
        const sessionStr = localStorage.getItem('user_siswa');
        if (!sessionStr) return;
        const u = JSON.parse(sessionStr);

        // Validasi status keaktifan: Hanya siswa Aktif yang berhak melihat dan mengakses ujian aktif
        const { data: dbCheckSiswa } = await supabase
          .from('data_siswa')
          .select('status_keaktifan')
          .eq('id', u.id)
          .maybeSingle();

        if (dbCheckSiswa?.status_keaktifan && dbCheckSiswa.status_keaktifan.toLowerCase() !== 'aktif') {
          setActiveExam(null);
          return;
        }

        let kelasId = u.kelas_id;
        let tingkatSiswa = null;
        if (u.kelas) {
          const { data: kData } = await supabase.from('data_kelas').select('id, tingkat').ilike('nama_kelas', u.kelas).maybeSingle();
          if (kData) {
            kelasId = kData.id;
            if (kData.tingkat) tingkatSiswa = String(kData.tingkat);
          }
        }

        if (!tingkatSiswa && u.kelas) {
          const upper = u.kelas.toUpperCase().trim();
          if (upper.includes('VII') && !upper.includes('VIII')) tingkatSiswa = '7';
          else if (upper.includes('VIII')) tingkatSiswa = '8';
          else if (upper.includes('IX')) tingkatSiswa = '9';
          else {
            const m = upper.match(/\b([789])\b/);
            if (m) tingkatSiswa = m[1];
          }
        }

        // Cek alokasi ruangan siswa di cbt_peserta_ruang
        let allocatedJadwalIds = [];
        if (u.id) {
          const { data: pRuangData } = await supabase
            .from('cbt_peserta_ruang')
            .select('jadwal_id')
            .eq('siswa_id', u.id);
          if (pRuangData && pRuangData.length > 0) {
            allocatedJadwalIds = pRuangData.map(p => Number(p.jadwal_id)).filter(Boolean);
          }
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        let cbtQuery = supabase
          .from('cbt_jadwal_ujian')
          .select(`
            *,
            data_mapel(nama_mapel),
            data_ruang(nama_ruang),
            cbt_bank_soal(id, tingkat_kelas)
          `);

        if (allocatedJadwalIds.length > 0) {
          cbtQuery = cbtQuery.or(`id.in.(${allocatedJadwalIds.join(',')}),tanggal_ujian.eq.${todayStr}`);
        } else {
          cbtQuery = cbtQuery.eq('tanggal_ujian', todayStr);
          if (kelasId) {
            cbtQuery = cbtQuery.or(`kelas_id.eq.${kelasId},kelas_id.is.null`);
          } else {
            cbtQuery = cbtQuery.is('kelas_id', null);
          }
        }

        const { data: jadwals } = await cbtQuery;

        if (jadwals && jadwals.length > 0) {
          const active = jadwals.find(j => {
            const isAllocated = allocatedJadwalIds.includes(Number(j.id));
            const isToday = j.tanggal_ujian === todayStr;
            const mulai = j.jam_mulai?.slice(0, 5) || '00:00';
            const selesai = j.jam_selesai?.slice(0, 5) || '23:59';
            const inTime = isToday && (currentTime >= mulai && currentTime <= selesai);
            const isStatusActive = j.status === 'aktif' || j.status === 'berlangsung';

            if (!inTime && !isStatusActive) return false;

            if (isAllocated) return true;

            const bTingkat = j.cbt_bank_soal?.tingkat_kelas;
            if (!bTingkat || bTingkat === 'Semua' || bTingkat === tingkatSiswa) return true;

            return false;
          });
          setActiveExam(active || null);
        } else {
          setActiveExam(null);
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkActiveCbt();
  }, [userData]);

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Halo, {userData?.nama || 'Siswa'}! 👋</h2>
          <p className="text-gray-500 mt-1">Selamat datang di Portal Siswa SIAKAD.</p>
        </div>
      </div>

      {/* Banner Notifikasi Ujian Aktif: HANYA MUNCUL pada hari dan jam jadwal ujian aktif */}
      {activeExam && (
        <div className="mb-8 p-5 bg-gradient-to-r from-red-600 via-rose-600 to-primary text-white rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in zoom-in-95">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-white/20 rounded-2xl backdrop-blur-md animate-pulse shrink-0">
              <BookOpen size={28} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-white text-red-600 text-[10px] font-black uppercase rounded-full tracking-wider">
                  UJIAN CBT AKTIF HARI INI
                </span>
                <span className="text-xs text-red-100 font-mono">
                  {activeExam.jam_mulai?.slice(0, 5)} - {activeExam.jam_selesai?.slice(0, 5)} WIB
                </span>
              </div>
              <h3 className="text-lg font-black mt-1 leading-tight">{activeExam.nama_ujian}</h3>
              <p className="text-xs text-red-100 mt-0.5">
                Mapel: {activeExam.data_mapel?.nama_mapel} • Ruang: {activeExam.data_ruang?.nama_ruang || 'Lab CBT'}
              </p>
            </div>
          </div>

          <Link
            to={`/cbt/ujian/${activeExam.id}`}
            className="px-6 py-3 bg-white text-red-600 hover:bg-red-50 font-black text-xs rounded-2xl shadow-lg transition transform hover:-translate-y-0.5 shrink-0 flex items-center gap-2"
          >
            <span>Masuk Ruang Ujian (Scan Kartu)</span>
            <ChevronRight size={16} />
          </Link>
        </div>
      )}

      {/* Quick Access Jadwal & Ujian CBT (Selalu Muncul) */}
      <div className="mb-6 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-primary flex items-center justify-center shrink-0">
            <Laptop size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800">Ujian Berbasis Komputer (CBT)</h4>
            <p className="text-xs text-gray-500">Lihat jadwal ujian, alokasi ruang ujian, dan nomor meja Anda.</p>
          </div>
        </div>
        <Link
          to="/cbt/jadwal-siswa"
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm shrink-0 self-end sm:self-auto"
        >
          <span>Buka Jadwal CBT</span>
          <ChevronRight size={14} />
        </Link>
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
