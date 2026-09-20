import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CheckSquare, Calendar, Filter, Clock, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export default function PresensiSaya() {
  const [presensiData, setPresensiData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  
  // Filter States
  const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1);
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
  
  // Stats
  const [stats, setStats] = useState({
    hadir: 0,
    izinSakit: 0,
    terlambat: 0,
    bolos: 0,
    alpha: 0
  });

  useEffect(() => {
    const session = localStorage.getItem('user_siswa');
    if (session) {
      const parsed = JSON.parse(session);
      setUserData(parsed);
      fetchPresensi(parsed.nipd, filterBulan, filterTahun);
    } else {
      setIsLoading(false);
    }
  }, [filterBulan, filterTahun]);

  const fetchPresensi = async (nipd, bulan, tahun) => {
    setIsLoading(true);
    try {
      // Calculate start and end dates for the selected month/year
      const startDate = `${tahun}-${String(bulan).padStart(2, '0')}-01`;
      const lastDay = new Date(tahun, bulan, 0).getDate();
      const endDate = `${tahun}-${String(bulan).padStart(2, '0')}-${lastDay}`;

      const { data, error } = await supabase
        .from('presensi_siswa')
        .select('*')
        .eq('nipd', nipd)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      
      setPresensiData(data || []);
      
      // Calculate stats
      let hadir = 0, izinSakit = 0, terlambat = 0, bolos = 0, alpha = 0;
      (data || []).forEach(item => {
        const st = (item.status || '').toLowerCase();
        if (st.includes('hadir') && !st.includes('terlambat')) hadir++;
        if (st.includes('izin') || st.includes('sakit') || st.includes('dispensasi')) izinSakit++;
        if (st.includes('terlambat')) terlambat++;
        if (st.includes('bolos')) bolos++;
        if (st.includes('alpha') || st.includes('tanpa keterangan')) alpha++;
      });
      
      setStats({ hadir, izinSakit, terlambat, bolos, alpha });

    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data presensi.' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const st = (status || '').toLowerCase();
    if (st.includes('hadir')) return 'bg-green-100 text-green-700 border-green-200';
    if (st.includes('izin') || st.includes('sakit')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (st.includes('terlambat')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (st.includes('bolos') || st.includes('alpha')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const formatTanggal = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => currentYear - i);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-0"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CheckSquare className="text-primary" /> Presensi Saya
          </h2>
          <p className="text-gray-500 mt-1">Pantau riwayat kehadiran Anda di sekolah.</p>
        </div>

        <div className="flex w-full md:w-auto items-center gap-3 relative z-10">
          <div className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl flex-1 flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <select 
              value={filterBulan} 
              onChange={(e) => setFilterBulan(parseInt(e.target.value))}
              className="bg-transparent text-sm font-semibold text-gray-700 outline-none"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl flex-1 flex items-center gap-2">
            <select 
              value={filterTahun} 
              onChange={(e) => setFilterTahun(parseInt(e.target.value))}
              className="bg-transparent text-sm font-semibold text-gray-700 outline-none"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center">
           <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-3">
             <CheckSquare size={24} />
           </div>
           <h3 className="text-3xl font-bold text-gray-800">{stats.hadir}</h3>
           <p className="text-xs font-bold text-gray-500 uppercase mt-1">Hadir Tepat Waktu</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center">
           <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3">
             <AlertCircle size={24} />
           </div>
           <h3 className="text-3xl font-bold text-gray-800">{stats.izinSakit}</h3>
           <p className="text-xs font-bold text-gray-500 uppercase mt-1">Izin / Sakit</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center">
           <div className="w-12 h-12 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mb-3">
             <Clock size={24} />
           </div>
           <h3 className="text-3xl font-bold text-gray-800">{stats.terlambat}</h3>
           <p className="text-xs font-bold text-gray-500 uppercase mt-1">Terlambat</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center">
           <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mb-3">
             <Filter size={24} />
           </div>
           <h3 className="text-3xl font-bold text-gray-800">{stats.bolos}</h3>
           <p className="text-xs font-bold text-gray-500 uppercase mt-1">Bolos</p>
        </div>
        <div className="col-span-2 md:col-span-1 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center">
           <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-3">
             <AlertCircle size={24} />
           </div>
           <h3 className="text-3xl font-bold text-gray-800">{stats.alpha}</h3>
           <p className="text-xs font-bold text-gray-500 uppercase mt-1">Alpha</p>
        </div>
      </div>

      {/* Data Table / List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : presensiData.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-700">Tidak Ada Data Presensi</h3>
            <p className="text-gray-500 mt-1">Belum ada riwayat kehadiran pada bulan ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Waktu Masuk</th>
                  <th className="px-6 py-4">Waktu Pulang</th>
                  <th className="px-6 py-4">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {presensiData.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-gray-800">
                      {formatTanggal(item.tanggal)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${getStatusColor(item.status)}`}>
                        {item.status || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium flex items-center gap-1.5">
                      {item.waktu_masuk ? <><Clock size={14} className="text-gray-400" /> {item.waktu_masuk}</> : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium flex items-center gap-1.5">
                      {item.waktu_pulang ? <><Clock size={14} className="text-gray-400" /> {item.waktu_pulang}</> : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                      {item.alasan === '-' ? '' : item.alasan}
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
