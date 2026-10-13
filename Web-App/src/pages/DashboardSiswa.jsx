import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CalendarDays, Award, Megaphone, Wallet, ChevronRight, Laptop } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { getOperationalDayName } from '../utils/dateUtils';
import { isPengumumanVisibleForSiswa } from '../utils/pengumumanHelper';

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
      const targetNipd = user.nipd || user.nisn || user.nis;
      let kehadiranRate = 0;

      if (targetNipd) {
        let presensiQuery = supabase.from('presensi_siswa').select('status');
        if (user.nipd && user.nisn && user.nipd !== user.nisn) {
          presensiQuery = presensiQuery.or(`nipd.eq.${user.nipd},nipd.eq.${user.nisn}`);
        } else {
          presensiQuery = presensiQuery.eq('nipd', targetNipd);
        }

        const { data: presensi } = await presensiQuery;
        
        if (presensi && presensi.length > 0) {
          const hadir = presensi.filter(p => {
            const s = (p.status || '').toLowerCase();
            return s.includes('hadir') || s.includes('terlambat') || s.includes('dispensasi') || s === 'h' || s === 't';
          }).length;
          kehadiranRate = Math.round((hadir / presensi.length) * 100);
        }
      }
      
      // 3. Fetch Jadwal Hari Ini & Info Kelas (pergantian hari pukul 18.00 WIB)
      const today = getOperationalDayName();
      
      let jadwalHariIni = [];
      let tingkatSiswa = 7; // Default
      let kelasId = null;

      if (user.kelas) {
        // Fetch kelas_id dan tingkat dengan ilike (case-insensitive)
        const { data: dataKelasRes } = await supabase
          .from('data_kelas')
          .select('id, tingkat')
          .ilike('nama_kelas', user.kelas)
          .maybeSingle();

        if (dataKelasRes) {
          kelasId = dataKelasRes.id;
          if (dataKelasRes.tingkat) tingkatSiswa = dataKelasRes.tingkat;
        }

        // Fallback jika tingkat belum didapat dari data_kelas: ekstrak angka dari nama kelas (misal "9a" -> 9)
        if (!dataKelasRes?.tingkat) {
          const match = String(user.kelas).match(/\d+/);
          if (match) {
            tingkatSiswa = parseInt(match[0], 10);
          }
        }

        if (kelasId) {
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

      // 2. Kalkulasi Tagihan Aktif (Selaras Mobile App)
      let totalTagihan = 0;
      try {
        const semester = 'Tahunan';
        const now = new Date();
        const currentSchoolYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
        const defaultTahun = `${currentSchoolYear}/${currentSchoolYear + 1}`;
        const tahunPelajaran = user.tahun_ajaran || defaultTahun;

        // Tentukan Tipe Siswa berdasarkan status_siswa di data_siswa
        let tipeSiswa = 'Siswa Baru';
        if (user.status_siswa) {
          const statusLower = String(user.status_siswa).toLowerCase();
          if (statusLower === 'baru') {
            tipeSiswa = 'Siswa Baru';
          } else if (statusLower === 'pindahan') {
            // Hitung tingkat saat siswa MASUK berdasarkan selisih tahun
            const entryYear = parseInt((tahunPelajaran || '').split('/')[0]) || currentSchoolYear;
            const yearsPassed = Math.max(0, currentSchoolYear - entryYear);
            const entryTingkat = Math.max(7, tingkatSiswa - yearsPassed);
            tipeSiswa = `Pindahan Kelas ${entryTingkat}`;
          } else {
            tipeSiswa = user.status_siswa;
          }
        }

        // A. Total Biaya
        const { data: bpm } = await supabase
          .from('biaya_pengembangan_mutu')
          .select('data_anggaran')
          .eq('semester', semester)
          .eq('tipe_siswa', tipeSiswa)
          .eq('tahun_pelajaran', tahunPelajaran)
          .maybeSingle();

        let totalBiaya = 0;
        if (bpm && bpm.data_anggaran) {
          bpm.data_anggaran.forEach(item => {
            const cost = item[`tingkat${tingkatSiswa}`] || item[`kelas${tingkatSiswa}`] || 0;
            totalBiaya += Number(cost);
          });
        }

        // B. Total Pemasukan
        const { data: pemasukan } = await supabase
          .from('tb_pemasukan_siswa')
          .select('nominal')
          .eq('siswa_id', user.id)
          .eq('tahun_pelajaran', tahunPelajaran)
          .eq('semester', semester);

        const totalPemasukan = (pemasukan || []).reduce((sum, item) => sum + Number(item.nominal || 0), 0);

        // C. Saldo & Subsidi
        const { data: saldo } = await supabase
          .from('tb_saldo_siswa')
          .select('saldo_sebelumnya, subsidi_pip')
          .eq('siswa_id', user.id)
          .eq('tahun_pelajaran', tahunPelajaran)
          .eq('semester', semester)
          .maybeSingle();

        const saldoSblm = Number(saldo?.saldo_sebelumnya || 0);
        const subsidi = Number(saldo?.subsidi_pip || 0);

        // Rumus tagihan selaras Mobile App: totalBiaya + saldoSebelumnya - subsidi - totalPemasukan
        totalTagihan = totalBiaya + saldoSblm - subsidi - totalPemasukan;
        if (totalTagihan < 0) totalTagihan = 0;
      } catch (errTagihan) {
        console.error('Error calculating tagihan:', errTagihan);
      }


      // 4. Fetch Rata-rata Nilai
      const targetNilaiNipd = user.nipd || user.nisn || user.nis;
      let avgNilai = 0;
      if (targetNilaiNipd) {
        let nilaiQuery = supabase.from('nilai_siswa').select('nilai_siswa');
        if (user.nipd && user.nisn && user.nipd !== user.nisn) {
          nilaiQuery = nilaiQuery.or(`nipd.eq.${user.nipd},nipd.eq.${user.nisn}`);
        } else {
          nilaiQuery = nilaiQuery.eq('nipd', targetNilaiNipd);
        }
        const { data: nilaiSiswa } = await nilaiQuery;
        
        if (nilaiSiswa && nilaiSiswa.length > 0) {
          const total = nilaiSiswa.reduce((sum, item) => sum + (Number(item.nilai_siswa) || 0), 0);
          avgNilai = (total / nilaiSiswa.length).toFixed(1);
        }
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
          .order('created_at', { ascending: false });

        if (error) throw error;
        const filtered = (data || []).filter((item) => isPengumumanVisibleForSiswa(item.target, userData)).slice(0, 5);
        setPengumuman(filtered);
      } catch (err) {
        console.error('Gagal memuat pengumuman:', err);
      } finally {
        setIsLoadingPengumuman(false);
      }
    };
    fetchPengumuman();
  }, [userData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

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

        if (!dbCheckSiswa || (dbCheckSiswa.status_keaktifan || '').trim().toLowerCase() !== 'aktif') {
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
      {/* Header Utama Beranda Siswa (Diselaraskan dengan Mobile App) */}
      <div className="mb-6 bg-gradient-to-r from-[#1E257F] to-[#2a349c] rounded-2xl sm:rounded-3xl p-6 sm:p-7 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[#D0D6F9] text-sm font-medium">{getGreeting()},</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-0.5 tracking-tight">
              {userData?.nama || 'Siswa'}
            </h2>
            <p className="text-white/80 text-xs sm:text-sm mt-1">Selamat datang di Portal Siswa SIAKAD.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#84D43F]/20 text-[#84D43F] border border-[#84D43F]/40 shadow-sm backdrop-blur-sm">
              {userData?.kelas ? `Kelas ${userData.kelas}` : 'Siswa Aktif'}
            </span>
            {(userData?.nisn || userData?.nipd) && (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/15 text-[#E2E8F0] border border-white/20 shadow-sm backdrop-blur-sm">
                NISN: {userData?.nisn || userData?.nipd}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banner Notifikasi Ujian Aktif: HANYA MUNCUL pada hari dan jam jadwal ujian aktif (Selaras Mobile App) */}
      {activeExam && (
        <div className="mb-6 p-5 bg-[#FEF2F2] border-2 border-[#FCA5A5] rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in zoom-in-95">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
              <Laptop size={24} className="text-[#DC2626]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                </span>
                <span className="text-xs font-bold text-[#DC2626] uppercase tracking-wider">
                  Ujian CBT Sedang Berlangsung
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#991B1B] mt-1 leading-tight">
                {activeExam.data_mapel?.nama_mapel || activeExam.nama_ujian}
              </h3>
              <p className="text-xs text-[#B91C1C] mt-0.5">
                Pukul {activeExam.jam_mulai?.slice(0, 5)} - {activeExam.jam_selesai?.slice(0, 5)} WIB • Ruang: {activeExam.data_ruang?.nama_ruang || 'Lab CBT'}
              </p>
            </div>
          </div>

          <Link
            to={`/cbt/ujian/${activeExam.id}`}
            className="px-5 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs rounded-xl shadow transition shrink-0 flex items-center gap-2 self-end sm:self-auto"
          >
            <span>Masuk Ruang Ujian</span>
            <ChevronRight size={16} />
          </Link>
        </div>
      )}

      {/* Quick Access Jadwal & Ujian CBT (Selalu Muncul) */}
      <div className="mb-6 p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ECEEFF] text-[#1E257F] flex items-center justify-center shrink-0">
            <Laptop size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#1A1818]">Ujian Berbasis Komputer (CBT)</h4>
            <p className="text-xs text-[#6C757D]">Lihat jadwal ujian, alokasi ruang ujian, dan nomor meja Anda.</p>
          </div>
        </div>
        <Link
          to="/cbt/jadwal-siswa"
          className="px-4 py-2 bg-[#1E257F] hover:bg-[#1E257F]/90 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm shrink-0 self-end sm:self-auto"
        >
          <span>Buka Jadwal CBT</span>
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* 3 Kartu Metrik Utama Sesuai warna.json */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Card 1: Kehadiran (Brand Primary #1E257F) */}
        <div className="bg-gradient-to-br from-[#3740A1] to-[#1E257F] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <CalendarDays className="absolute right-[-10px] bottom-[-10px] text-white/15" size={100} />
          <div className="relative z-10">
            <h3 className="text-white/90 font-medium text-sm">Kehadiran Anda</h3>
            <div className="text-3xl font-bold mt-1">{metrics.kehadiran}%</div>
            <p className="text-xs text-white/75 mt-2">Sepanjang masa akademik</p>
          </div>
        </div>

        {/* Card 2: Tagihan Aktif (Brand Indigo / Primary Container Tone) */}
        <div className="bg-gradient-to-br from-[#7679FF] to-[#6266F8] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <Wallet className="absolute right-[-10px] bottom-[-10px] text-white/15" size={100} />
          <div className="relative z-10">
            <h3 className="text-white/90 font-medium text-sm">Tagihan Aktif</h3>
            <div className="text-3xl font-bold mt-1 truncate max-w-[200px]">{formatRupiah(metrics.tagihan)}</div>
            <p className="text-xs text-white/75 mt-2">Segera lakukan pembayaran</p>
          </div>
        </div>

        {/* Card 3: Rata-rata Nilai (Brand Secondary #84D43F) */}
        <div className="bg-gradient-to-br from-[#84D43F] to-[#6EB32B] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <Award className="absolute right-[-10px] bottom-[-10px] text-white/15" size={100} />
          <div className="relative z-10">
            <h3 className="text-white/90 font-medium text-sm">Rata-rata Nilai</h3>
            <div className="text-3xl font-bold mt-1">{metrics.rataRata}</div>
            <p className="text-xs text-white/75 mt-2">Dari semua mata pelajaran</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jadwal Kelas Hari Ini */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 flex flex-col h-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-[#E2E8F0] pb-3 gap-2 sm:gap-0">
            <h3 className="font-bold text-[#1A1818] flex items-center gap-2">
              <Clock size={18} className="text-[#1E257F] shrink-0" /> Jadwal Kelas Hari Ini
            </h3>
            <Link to="/jadwal-pelajaran-siswa" className="text-xs font-bold text-[#1E257F] hover:text-[#1E257F]/80 flex items-center gap-1 transition self-start sm:self-auto">
              Lihat Semua <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-3 flex-1">
            {metrics.jadwal.length === 0 ? (
              <div className="text-center text-[#ADB5BD] py-8 text-xs bg-[#F8F9FA] rounded-xl h-full flex items-center justify-center">
                Tidak ada jadwal pelajaran hari ini. Selamat beristirahat!
              </div>
            ) : (
              <ul className="space-y-3">
                {metrics.jadwal.map((j, idx) => (
                  <li key={idx} className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                    j.is_istirahat ? 'bg-[#FFF9EB] border-[#FFE8A3]' : 'bg-[#F8F9FA] border-[#E2E8F0]'
                  }`}>
                    <div className={`py-1.5 px-2 rounded-lg text-xs font-bold text-center w-28 shrink-0 ${
                      j.is_istirahat ? 'bg-[#FFE8A3] text-[#B45309]' : 'bg-[#ECEEFF] text-[#1E257F]'
                    }`}>
                      {j.waktu}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-bold truncate ${j.is_istirahat ? 'text-[#B45309]' : 'text-[#1A1818]'}`}>{j.mapel}</h4>
                      <p className="text-[11px] text-[#6C757D] truncate">{j.guru}</p>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      j.is_istirahat ? 'bg-[#FFE8A3] text-[#B45309]' : 'bg-[#F1F3F5] text-[#6C757D]'
                    }`}>
                      Ke-{j.jam_ke}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {/* Pengumuman Sekolah */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6">
          <h3 className="font-bold text-[#1A1818] mb-4 border-b border-[#E2E8F0] pb-3 flex items-center gap-2">
            <Megaphone size={18} className="text-[#1E257F]" /> Pengumuman Sekolah
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {isLoadingPengumuman ? (
              <div className="text-center text-[#ADB5BD] py-8 text-xs bg-[#F8F9FA] rounded-xl">Memuat pengumuman...</div>
            ) : pengumuman.length === 0 ? (
              <div className="text-center text-[#ADB5BD] py-8 text-xs bg-[#F8F9FA] rounded-xl">Belum ada pengumuman untuk Anda.</div>
            ) : (
              pengumuman.map((item) => (
                <div key={item.id} className="bg-[#F8F9FA] p-4 rounded-xl border border-[#E2E8F0] hover:border-[#CBD5E1] transition">
                  <div className="flex justify-between items-start mb-1 gap-2">
                     <h4 className="font-bold text-[#1E257F] text-xs leading-tight">{item.judul}</h4>
                     <span className="text-[9px] font-bold text-white bg-[#84D43F] px-2 py-0.5 rounded-full whitespace-nowrap">
                        {formatDate(item.created_at)}
                     </span>
                  </div>
                  <p className="text-xs text-[#6C757D] mt-2 whitespace-pre-line leading-relaxed">{item.isi}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
