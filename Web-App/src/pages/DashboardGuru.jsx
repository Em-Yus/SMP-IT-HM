import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, BookOpen, Clock, CalendarDays, Award, Building2, Users, School, Map, FileText, Megaphone } from 'lucide-react';

export default function DashboardGuru() {
  const [userData, setUserData] = useState(null);
  const [roles, setRoles] = useState([]);
  
  // Widget States
  const [operatorStats, setOperatorStats] = useState(null);
  const [waliKelasStats, setWaliKelasStats] = useState(null);
  const [mapelStats, setMapelStats] = useState(null);
  const [kesiswaanStats, setKesiswaanStats] = useState(null);
  const [classDetails, setClassDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [pengumuman, setPengumuman] = useState([]);
  const [isLoadingPengumuman, setIsLoadingPengumuman] = useState(true);

  useEffect(() => {
    const fetchPengumuman = async () => {
      try {
        const { data, error } = await supabase
          .from('cms_pengumuman')
          .select('*')
          .eq('status', 'Aktif')
          .in('target', ['Guru', 'Semua'])
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

  useEffect(() => {
    const session = localStorage.getItem('user_guru');
    if (session) {
      const parsed = JSON.parse(session);
      setUserData(parsed);
      fetchDashboardData(parsed);
    }
  }, []);

  const fetchDashboardData = async (user) => {
    setIsLoading(true);
    try {
      // 1. Fetch user roles
      const { data: jabatanGuru } = await supabase
        .from('jabatan_guru')
        .select('*')
        .eq('guru_id', user.id)
        .maybeSingle();

      let activeRoles = [];
      if (jabatanGuru) {
        activeRoles = [
          jabatanGuru.jabatan_utama,
          jabatanGuru.jabatan_lain_1,
          jabatanGuru.jabatan_lain_2,
          jabatanGuru.jabatan_lain_3
        ].filter(Boolean);
      }
      setRoles(activeRoles);

      // Check specific roles
      const isOperator = activeRoles.some(r => r.toLowerCase().includes('operator') || r.toLowerCase().includes('admin'));
      const isWaliKelas = activeRoles.some(r => r.toLowerCase().includes('wali kelas'));
      const isGuruMapel = activeRoles.some(r => r.toLowerCase().includes('guru mata pelajaran'));
      const isKesiswaan = activeRoles.some(r => r.toLowerCase().includes('kesiswaan'));

      // 2. Fetch Operator Data
      if (isOperator) {
        const [guruRes, siswaRes, kelasRes] = await Promise.all([
          supabase.from('data_guru').select('*', { count: 'exact', head: true }).is('tanggal_keluar', null),
          supabase.from('data_siswa').select('*', { count: 'exact', head: true }).eq('status_keaktifan', 'Aktif'),
          supabase.from('data_kelas').select('*', { count: 'exact', head: true })
        ]);
        setOperatorStats({
          guru: guruRes.count || 0,
          siswa: siswaRes.count || 0,
          kelas: kelasRes.count || 0
        });
      }

      // 3. Fetch Wali Kelas Data
      if (isWaliKelas) {
        // Find assigned classes
        const { data: classes } = await supabase
          .from('data_kelas')
          .select('*')
          .or(`wali_kelas_id.eq.${user.id},wali_kelas_nama.eq.${user.nama}`);
        
        let totalSiswa = 0;
        if (classes && classes.length > 0) {
          const classNames = classes.map(c => c.nama_kelas);
          const { count } = await supabase
            .from('data_siswa')
            .select('*', { count: 'exact', head: true })
            .in('kelas', classNames)
            .eq('status_keaktifan', 'Aktif');
          totalSiswa = count || 0;
        }
        setWaliKelasStats({
          classes: classes || [],
          totalSiswa
        });
      }

      // 4. Fetch Guru Mapel Data
      if (isGuruMapel) {
        const { data: pembelajaran } = await supabase
          .from('pembelajaran')
          .select('kelas_id, mapel_id')
          .eq('guru_id', user.id);
        
        const uniqueClasses = new Set();
        const uniqueMapels = new Set();
        
        if (pembelajaran) {
          pembelajaran.forEach(p => {
            if (p.kelas_id) uniqueClasses.add(p.kelas_id);
            if (p.mapel_id) uniqueMapels.add(p.mapel_id);
          });
        }
        
        setMapelStats({
          totalClasses: uniqueClasses.size,
          totalMapels: uniqueMapels.size
        });
      }

      // 5. Fetch Kesiswaan Data
      if (isKesiswaan) {
        const [lkRes, prRes] = await Promise.all([
          supabase.from('data_siswa').select('*', { count: 'exact', head: true }).eq('status_keaktifan', 'Aktif').ilike('jenis_kelamin', '%laki%'),
          supabase.from('data_siswa').select('*', { count: 'exact', head: true }).eq('status_keaktifan', 'Aktif').ilike('jenis_kelamin', '%perempuan%')
        ]);
        
        setKesiswaanStats({
          lakiLaki: lkRes.count || 0,
          perempuan: prRes.count || 0,
          total: (lkRes.count || 0) + (prRes.count || 0)
        });
      }

      // 6. Fetch Class Details (for Operator and Kesiswaan)
      if (isOperator || isKesiswaan) {
        const { data: allStudents } = await supabase
          .from('data_siswa')
          .select('kelas, jenis_kelamin')
          .eq('status_keaktifan', 'Aktif');

        const classDetailsMap = {};
        if (allStudents) {
          allStudents.forEach(s => {
            const className = s.kelas || 'Belum Ada Kelas';
            if (!classDetailsMap[className]) {
              classDetailsMap[className] = { total: 0, lk: 0, pr: 0 };
            }
            classDetailsMap[className].total += 1;
            if (s.jenis_kelamin && s.jenis_kelamin.toLowerCase().includes('laki')) {
              classDetailsMap[className].lk += 1;
            } else if (s.jenis_kelamin && s.jenis_kelamin.toLowerCase().includes('perempuan')) {
              classDetailsMap[className].pr += 1;
            }
          });
        }
        
        const classDetailsArray = Object.entries(classDetailsMap).map(([nama_kelas, counts]) => ({
          nama_kelas,
          ...counts
        })).sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas));

        setClassDetails(classDetailsArray);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          Dashboard Guru
        </h2>
        <p className="text-gray-500 mt-1">
          Selamat datang kembali, <span className="font-semibold text-primary">{userData?.nama || 'Guru'}</span>!
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.map((role, idx) => (
            <span key={idx} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-100">
              {role}
            </span>
          ))}
          {roles.length === 0 && (
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-semibold">
              Belum ada jabatan
            </span>
          )}
        </div>
      </div>

      {/* PENGUMUMAN WIDGET */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
          <Megaphone size={18} className="text-primary" /> Pengumuman Sekolah
        </h3>
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
          {isLoadingPengumuman ? (
            <div className="text-center text-gray-400 py-4 text-sm">Memuat pengumuman...</div>
          ) : pengumuman.length === 0 ? (
            <div className="text-center text-gray-400 py-6 text-sm bg-gray-50 rounded-lg">Belum ada pengumuman untuk Anda.</div>
          ) : (
            pengumuman.map((item) => (
              <div key={item.id} className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-1">
                   <h4 className="font-bold text-indigo-900 text-sm">{item.judul}</h4>
                   <span className="text-[10px] font-bold text-white bg-primary px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                      {formatDate(item.created_at)}
                   </span>
                </div>
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-line leading-relaxed">{item.isi}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* WIDGET OPERATOR / ADMIN */}
      {operatorStats && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <Building2 size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Statistik Sekolah</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center gap-3 text-blue-800 mb-2">
                <Users size={18} />
                <span className="font-semibold text-sm">Total Siswa Aktif</span>
              </div>
              <p className="text-3xl font-bold text-blue-900">{operatorStats.siswa}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-3 text-emerald-800 mb-2">
                <Users size={18} />
                <span className="font-semibold text-sm">Total Pegawai</span>
              </div>
              <p className="text-3xl font-bold text-emerald-900">{operatorStats.guru}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-100">
              <div className="flex items-center gap-3 text-amber-800 mb-2">
                <School size={18} />
                <span className="font-semibold text-sm">Total Kelas</span>
              </div>
              <p className="text-3xl font-bold text-amber-900">{operatorStats.kelas}</p>
            </div>
          </div>
        </div>
      )}

      {/* WIDGET WALI KELAS */}
      {waliKelasStats && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
              <Award size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Ringkasan Wali Kelas</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <p className="text-sm font-semibold text-purple-800 mb-1">Kelas Perwalian</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {waliKelasStats.classes.length > 0 ? (
                  waliKelasStats.classes.map(c => (
                    <span key={c.id} className="bg-white px-3 py-1 rounded-lg shadow-sm text-purple-900 font-bold border border-purple-200">
                      {c.nama_kelas}
                    </span>
                  ))
                ) : (
                  <span className="text-purple-600/70 text-sm italic">Belum ada kelas yang ditetapkan</span>
                )}
              </div>
            </div>
            <div className="bg-pink-50 p-4 rounded-xl border border-pink-100 flex flex-col justify-center">
              <p className="text-sm font-semibold text-pink-800 mb-1">Jumlah Anak Didik</p>
              <p className="text-3xl font-bold text-pink-900">{waliKelasStats.totalSiswa} <span className="text-sm font-normal text-pink-700">Siswa</span></p>
            </div>
          </div>
        </div>
      )}

      {/* WIDGET GURU MATA PELAJARAN */}
      {mapelStats && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-rose-100 p-2 rounded-lg text-rose-600">
              <BookOpen size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Beban Mengajar</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
              <div className="bg-white p-3 rounded-full shadow-sm text-rose-500">
                <School size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Total Kelas Diajar</p>
                <p className="text-2xl font-bold text-gray-800">{mapelStats.totalClasses}</p>
              </div>
            </div>
            <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
              <div className="bg-white p-3 rounded-full shadow-sm text-rose-500">
                <BookOpen size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Mata Pelajaran Diampu</p>
                <p className="text-2xl font-bold text-gray-800">{mapelStats.totalMapels}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WIDGET KESISWAAN */}
      {kesiswaanStats && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
              <Users size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Ringkasan Kesiswaan</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
              <p className="text-sm font-semibold text-blue-800 mb-1">Siswa Laki-Laki</p>
              <p className="text-3xl font-bold text-blue-900">{kesiswaanStats.lakiLaki}</p>
            </div>
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-center">
              <p className="text-sm font-semibold text-rose-800 mb-1">Siswi Perempuan</p>
              <p className="text-3xl font-bold text-rose-900">{kesiswaanStats.perempuan}</p>
            </div>
            <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 text-center">
              <p className="text-sm font-semibold text-teal-800 mb-1">Total Siswa Aktif</p>
              <p className="text-3xl font-bold text-teal-900">{kesiswaanStats.total}</p>
            </div>
          </div>
        </div>
      )}

      {/* RINCIAN PER KELAS (UMUM UNTUK OPERATOR & KESISWAAN) */}
      {classDetails && classDetails.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
              <School size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Rincian Siswa Per Kelas</h3>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3">Nama Kelas</th>
                  <th className="px-4 py-3 text-center">Laki-Laki</th>
                  <th className="px-4 py-3 text-center">Perempuan</th>
                  <th className="px-4 py-3 text-center">Total Siswa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {classDetails.map((cls, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-semibold text-gray-800">{cls.nama_kelas}</td>
                    <td className="px-4 py-3 text-center text-blue-700 font-medium">{cls.lk}</td>
                    <td className="px-4 py-3 text-center text-rose-700 font-medium">{cls.pr}</td>
                    <td className="px-4 py-3 text-center text-teal-700 font-bold">{cls.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WIDGET UMUM JIKA TIDAK ADA AKSES KHUSUS */}
      {!operatorStats && !waliKelasStats && !mapelStats && !kesiswaanStats && roles.length > 0 && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="inline-block bg-indigo-50 p-4 rounded-full text-indigo-500 mb-4">
            <CalendarDays size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Tidak Ada Ringkasan Khusus</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Jabatan Anda saat ini tidak memiliki ringkasan *Widget* di Dashboard. Gunakan menu di sidebar untuk menavigasi ke fitur-fitur yang tersedia.
          </p>
        </div>
      )}
    </div>
  );
}
