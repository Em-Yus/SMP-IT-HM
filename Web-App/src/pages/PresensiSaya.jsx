import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  CheckSquare, Calendar, Filter, Clock, AlertCircle, Award, 
  ChevronLeft, ChevronRight, UserCheck, UserMinus, ShieldAlert,
  CalendarDays, RefreshCw
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function PresensiSaya() {
  const [presensiData, setPresensiData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  
  // Filter Rentang: 'harian' | 'mingguan' | 'bulanan' | 'semester'
  const nowMonth = new Date().getMonth() + 1;
  const nowYear = new Date().getFullYear();
  const [filterMode, setFilterMode] = useState('bulanan');
  const [filterTanggal, setFilterTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [filterWeekOffset, setFilterWeekOffset] = useState(0); // 0 = current week
  const [filterBulan, setFilterBulan] = useState(nowMonth);
  const [filterTahun, setFilterTahun] = useState(nowYear);
  const [filterSemester, setFilterSemester] = useState(nowMonth >= 7 ? 'ganjil' : 'genap');
  const [filterTahunSemester, setFilterTahunSemester] = useState(nowYear);
  
  // Filter Status: 'semua' | 'Hadir' | 'Dispensasi' | 'Izin' | 'Sakit' | 'Terlambat' | 'Bolos' | 'Alfa'
  const [filterStatus, setFilterStatus] = useState('semua');

  // Stats Presensi
  const [stats, setStats] = useState({
    hadir: 0,
    dispensasi: 0,
    izin: 0,
    sakit: 0,
    terlambat: 0,
    bolos: 0,
    alpha: 0
  });

  useEffect(() => {
    const session = localStorage.getItem('user_siswa');
    if (session) {
      const parsed = JSON.parse(session);
      setUserData(parsed);
      fetchPresensi(parsed.nipd || parsed.nisn || parsed.nis);
    } else {
      setIsLoading(false);
    }
  }, [filterMode, filterTanggal, filterWeekOffset, filterBulan, filterTahun, filterSemester, filterTahunSemester]);

  // Hitung rentang tanggal berdasarkan mode filter
  const dateRange = useMemo(() => {
    if (filterMode === 'harian') {
      return {
        startDate: filterTanggal,
        endDate: filterTanggal,
        label: new Date(filterTanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      };
    } else if (filterMode === 'mingguan') {
      const now = new Date();
      now.setDate(now.getDate() + filterWeekOffset * 7);
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const startDate = monday.toISOString().split('T')[0];
      const endDate = sunday.toISOString().split('T')[0];
      const label = `${monday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      return { startDate, endDate, label };
    } else if (filterMode === 'semester') {
      let startDate, endDate, label;
      if (filterSemester === 'ganjil') {
        startDate = `${filterTahunSemester}-07-01`;
        endDate = `${filterTahunSemester}-12-31`;
        label = `Semester Ganjil ${filterTahunSemester}/${filterTahunSemester + 1}`;
      } else {
        startDate = `${filterTahunSemester}-01-01`;
        endDate = `${filterTahunSemester}-06-30`;
        label = `Semester Genap ${filterTahunSemester - 1}/${filterTahunSemester}`;
      }
      return { startDate, endDate, label };
    } else {
      const startDate = `${filterTahun}-${String(filterBulan).padStart(2, '0')}-01`;
      const lastDay = new Date(filterTahun, filterBulan, 0).getDate();
      const endDate = `${filterTahun}-${String(filterBulan).padStart(2, '0')}-${lastDay}`;
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const label = `${monthNames[filterBulan - 1]} ${filterTahun}`;
      return { startDate, endDate, label };
    }
  }, [filterMode, filterTanggal, filterWeekOffset, filterBulan, filterTahun, filterSemester, filterTahunSemester]);

  const fetchPresensi = async (nipd) => {
    if (!nipd) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('presensi_siswa')
        .select('*')
        .eq('nipd', nipd)
        .gte('tanggal', dateRange.startDate)
        .lte('tanggal', dateRange.endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      
      setPresensiData(data || []);
      
      // Hitung statistik
      let hadir = 0, dispensasi = 0, izin = 0, sakit = 0, terlambat = 0, bolos = 0, alpha = 0;
      (data || []).forEach(item => {
        const st = (item.status || '').toLowerCase();
        if (st.includes('dispensasi')) {
          dispensasi++;
        } else if (st.includes('hadir') && !st.includes('terlambat')) {
          hadir++;
        } else if (st.includes('izin')) {
          izin++;
        } else if (st.includes('sakit')) {
          sakit++;
        } else if (st.includes('terlambat')) {
          terlambat++;
        } else if (st.includes('bolos')) {
          bolos++;
        } else if (st.includes('alpha') || st.includes('alfa') || st.includes('tanpa keterangan')) {
          alpha++;
        } else {
          alpha++;
        }
      });
      
      setStats({ hadir, dispensasi, izin, sakit, terlambat, bolos, alpha });

    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data presensi.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter data sesuai status dropdown
  const filteredData = useMemo(() => {
    if (filterStatus === 'semua') return presensiData;
    return presensiData.filter(item => {
      const st = (item.status || '').toLowerCase();
      if (filterStatus === 'Hadir') return st.includes('hadir') && !st.includes('terlambat');
      if (filterStatus === 'Dispensasi') return st.includes('dispensasi');
      if (filterStatus === 'Izin') return st.includes('izin');
      if (filterStatus === 'Sakit') return st.includes('sakit');
      if (filterStatus === 'Terlambat') return st.includes('terlambat');
      if (filterStatus === 'Bolos') return st.includes('bolos');
      if (filterStatus === 'Alfa') return st.includes('alpha') || st.includes('alfa') || st.includes('tanpa keterangan');
      return true;
    });
  }, [presensiData, filterStatus]);

  const getStatusColor = (status) => {
    const st = (status || '').toLowerCase();
    if (st.includes('dispensasi')) return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (st.includes('hadir') && !st.includes('terlambat')) return 'bg-green-100 text-green-700 border-green-200';
    if (st.includes('izin')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (st.includes('sakit')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (st.includes('terlambat')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (st.includes('bolos')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (st.includes('alpha') || st.includes('alfa')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const formatTanggal = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
    { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
      {/* 1. INFORMASI PADA BAGIAN PALING ATAS HALAMAN (KARTU STATISTIK + DISPENSASI) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Hadir */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center transition hover:shadow-md">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-2">
            <CheckSquare size={20} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.hadir}</h3>
          <p className="text-[11px] font-bold text-gray-500 uppercase mt-0.5">Hadir</p>
        </div>

        {/* Dispensasi (BARU) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-cyan-100 text-center flex flex-col items-center justify-center transition hover:shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-500"></div>
          <div className="w-10 h-10 bg-cyan-50 text-cyan-600 rounded-full flex items-center justify-center mb-2">
            <Award size={20} />
          </div>
          <h3 className="text-2xl font-bold text-cyan-700">{stats.dispensasi}</h3>
          <p className="text-[11px] font-bold text-cyan-600 uppercase mt-0.5">Dispensasi</p>
        </div>

        {/* Izin */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center transition hover:shadow-md">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-2">
            <UserMinus size={20} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.izin}</h3>
          <p className="text-[11px] font-bold text-gray-500 uppercase mt-0.5">Izin</p>
        </div>

        {/* Sakit */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center transition hover:shadow-md">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-2">
            <AlertCircle size={20} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.sakit}</h3>
          <p className="text-[11px] font-bold text-gray-500 uppercase mt-0.5">Sakit</p>
        </div>

        {/* Terlambat */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center transition hover:shadow-md">
          <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mb-2">
            <Clock size={20} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.terlambat}</h3>
          <p className="text-[11px] font-bold text-gray-500 uppercase mt-0.5">Terlambat</p>
        </div>

        {/* Bolos */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center transition hover:shadow-md">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-2">
            <ShieldAlert size={20} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.bolos}</h3>
          <p className="text-[11px] font-bold text-gray-500 uppercase mt-0.5">Bolos</p>
        </div>

        {/* Alfa */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center transition hover:shadow-md">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-2">
            <AlertCircle size={20} />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{stats.alpha}</h3>
          <p className="text-[11px] font-bold text-gray-500 uppercase mt-0.5">Alfa</p>
        </div>
      </div>

      {/* HEADER HALAMAN */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-0"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <CheckSquare className="text-primary" /> Presensi Saya
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Riwayat kehadiran Anda • Periode: <span className="font-semibold text-primary">{dateRange.label}</span>
            </p>
          </div>

          <button
            onClick={() => fetchPresensi(userData?.nipd || userData?.nisn || userData?.nis)}
            disabled={isLoading}
            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-xl text-xs flex items-center gap-2 transition"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* 2. BAGIAN BAWAH HEADER: FILTER [HARIAN, MINGGUAN, BULANAN] & STATUS DROPDOWN */}
        <div className="mt-5 pt-5 border-t border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Tombol Tab Filter Rentang [Harian, Mingguan, Bulanan] */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterMode('harian')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterMode === 'harian' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Harian
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('mingguan')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterMode === 'mingguan' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mingguan
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('bulanan')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterMode === 'bulanan' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Bulanan
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('semester')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterMode === 'semester' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Semester
              </button>
            </div>

            {/* Sub-selector sesuai filterMode */}
            {filterMode === 'harian' && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                <Calendar size={14} className="text-gray-500" />
                <input
                  type="date"
                  value={filterTanggal}
                  onChange={(e) => setFilterTanggal(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-700 outline-none"
                />
              </div>
            )}

            {filterMode === 'mingguan' && (
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterWeekOffset(prev => prev - 1)}
                  className="p-1 hover:bg-gray-200 rounded-lg text-gray-600 transition"
                  title="Minggu Sebelumnya"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-semibold px-2 text-gray-700">
                  {filterWeekOffset === 0 ? 'Minggu Ini' : filterWeekOffset === -1 ? '1 Minggu Lalu' : `${Math.abs(filterWeekOffset)} Mgg Lalu`}
                </span>
                <button
                  type="button"
                  onClick={() => setFilterWeekOffset(prev => prev + 1)}
                  disabled={filterWeekOffset >= 0}
                  className={`p-1 rounded-lg text-gray-600 transition ${filterWeekOffset >= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-200'}`}
                  title="Minggu Berikutnya"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {filterMode === 'bulanan' && (
              <div className="flex items-center gap-2">
                <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  <select 
                    value={filterBulan} 
                    onChange={(e) => setFilterBulan(parseInt(e.target.value))}
                    className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                  >
                    {months.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                  <select 
                    value={filterTahun} 
                    onChange={(e) => setFilterTahun(parseInt(e.target.value))}
                    className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {filterMode === 'semester' && (
              <div className="flex items-center gap-2">
                <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <select 
                    value={filterSemester} 
                    onChange={(e) => setFilterSemester(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                  >
                    <option value="ganjil">Semester Ganjil (Jul - Des)</option>
                    <option value="genap">Semester Genap (Jan - Jun)</option>
                  </select>
                </div>
                <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
                  <select 
                    value={filterTahunSemester} 
                    onChange={(e) => setFilterTahunSemester(parseInt(e.target.value))}
                    className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Filter Status Dalam Bentuk Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
              <Filter size={14} /> Status:
            </span>
            <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl flex-1 md:flex-initial">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer min-w-[130px]"
              >
                <option value="semua">Semua Status</option>
                <option value="Hadir">Hadir</option>
                <option value="Dispensasi">Dispensasi</option>
                <option value="Izin">Izin</option>
                <option value="Sakit">Sakit</option>
                <option value="Terlambat">Terlambat</option>
                <option value="Bolos">Bolos</option>
                <option value="Alfa">Alfa</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TABEL RIWAYAT PRESENSI */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-20 gap-2">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary"></div>
            <p className="text-xs text-gray-500 font-medium">Memuat data presensi...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-700">Tidak Ada Data Presensi</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {filterStatus !== 'semua' 
                ? `Tidak ditemukan data dengan status "${filterStatus}" pada periode ini.`
                : 'Belum ada catatan presensi pada periode yang dipilih.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Waktu Masuk</th>
                  <th className="px-6 py-4">Waktu Pulang</th>
                  <th className="px-6 py-4">Keterangan / Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredData.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      {formatTanggal(item.tanggal)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${getStatusColor(item.status)}`}>
                        {item.status || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {item.waktu_masuk ? (
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} className="text-gray-400" /> {item.waktu_masuk}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {item.waktu_pulang ? (
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} className="text-gray-400" /> {item.waktu_pulang}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                      {item.alasan === '-' || !item.alasan ? '-' : item.alasan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
