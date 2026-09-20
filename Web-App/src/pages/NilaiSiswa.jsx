import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { FileText, Award, BookOpen, Search, BarChart3 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function NilaiSiswa() {
  const [dataNilai, setDataNilai] = useState([]);
  const [dataMapel, setDataMapel] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  
  const [filterTahun, setFilterTahun] = useState(defaultTahun);
  const [filterSemester, setFilterSemester] = useState('Ganjil');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Ambil daftar mapel sekali saja
    const fetchMapel = async () => {
      const { data } = await supabase.from('data_mapel').select('id, nama_mapel');
      if (data) {
        const mapelDict = {};
        data.forEach(m => {
          mapelDict[m.id] = m.nama_mapel;
        });
        setDataMapel(mapelDict);
      }
    };
    fetchMapel();
  }, []);

  useEffect(() => {
    const fetchNilai = async () => {
      setIsLoading(true);
      try {
        const session = localStorage.getItem('user_siswa');
        if (!session) throw new Error("Sesi tidak ditemukan. Silakan login kembali.");
        
        const parsed = JSON.parse(session);
        setUserData(parsed);

        const { data, error } = await supabase
          .from('nilai_siswa')
          .select('*')
          .eq('nipd', parsed.nipd)
          .eq('tahun_ajaran', filterTahun)
          .eq('semester', filterSemester);

        if (error) throw error;

        // Group data berdasarkan id_mapel
        const grouped = {};
        (data || []).forEach(row => {
          if (!grouped[row.id_mapel]) {
            grouped[row.id_mapel] = {
              id_mapel: row.id_mapel,
              tugas: 0,
              pts: 0,
              pas: 0,
            };
          }
          
          const val = parseFloat(row.nilai_siswa) || 0;
          if (row.jenis_nilai === 'Tugas') grouped[row.id_mapel].tugas = val;
          if (row.jenis_nilai === 'PTS') grouped[row.id_mapel].pts = val;
          if (row.jenis_nilai === 'PAS') grouped[row.id_mapel].pas = val;
        });

        setDataNilai(Object.values(grouped));
      } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data nilai.' });
      } finally {
        setIsLoading(false);
      }
    };

    if (Object.keys(dataMapel).length > 0) {
      fetchNilai();
    } else if (isLoading === false) {
      // fallback in case mapel fails to load first
      fetchNilai();
    }
  }, [filterTahun, filterSemester, dataMapel]);

  const getPredikat = (nilai) => {
    if (nilai >= 90) return { huruf: 'A', warna: 'text-green-600 bg-green-50 border-green-200' };
    if (nilai >= 80) return { huruf: 'B', warna: 'text-blue-600 bg-blue-50 border-blue-200' };
    if (nilai >= 70) return { huruf: 'C', warna: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    return { huruf: 'D', warna: 'text-red-600 bg-red-50 border-red-200' };
  };

  const filteredNilai = dataNilai.filter(item => {
    const mapelName = dataMapel[item.id_mapel] || 'Mapel Tidak Diketahui';
    return mapelName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Hitung Rata-rata Total
  let totalSemuaMapel = 0;
  let countMapel = 0;
  
  filteredNilai.forEach(item => {
    const avgMapel = (item.tugas + item.pts + item.pas) / 3;
    if (avgMapel > 0) {
      totalSemuaMapel += avgMapel;
      countMapel++;
    }
  });

  const rataRataKeseluruhan = countMapel > 0 ? (totalSemuaMapel / countMapel).toFixed(1) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -z-0"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-blue-600" /> Nilai Harian & Ujian
          </h2>
          <p className="text-gray-500 mt-1">Pantau perkembangan nilai akademik Anda per semester.</p>
        </div>
        
        <div className="grid grid-cols-2 w-full md:flex md:w-auto items-center gap-3 relative z-10 mt-4 md:mt-0">
          <select 
            value={filterSemester} 
            onChange={(e) => setFilterSemester(e.target.value)}
            className="w-full min-w-0 px-2 sm:px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold text-gray-700 text-ellipsis overflow-hidden"
          >
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
          </select>
          <select 
            value={filterTahun} 
            onChange={(e) => setFilterTahun(e.target.value)}
            className="w-full min-w-0 px-2 sm:px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold text-gray-700 text-ellipsis overflow-hidden"
          >
            <option value={`${currentYear - 1}/${currentYear}`}>{currentYear - 1}/{currentYear}</option>
            <option value={`${currentYear}/${currentYear + 1}`}>{currentYear}/{currentYear + 1}</option>
            <option value={`${currentYear + 1}/${currentYear + 2}`}>{currentYear + 1}/{currentYear + 2}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <BarChart3 className="absolute right-[-10px] bottom-[-10px] opacity-20" size={120} />
            <div className="relative z-10">
              <div className="text-blue-100 font-medium text-sm mb-1 uppercase tracking-wider">Rata-rata Semester Ini</div>
              <h3 className="text-5xl font-black mb-2">{rataRataKeseluruhan}</h3>
              <p className="text-sm text-blue-100">Dari {countMapel} mata pelajaran</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
              <Award size={18} className="text-yellow-500" /> Keterangan Predikat
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="font-medium text-gray-600">90 - 100</span>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-green-700 bg-green-100 border border-green-200">A</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-medium text-gray-600">80 - 89</span>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-blue-700 bg-blue-100 border border-blue-200">B</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-medium text-gray-600">70 - 79</span>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-yellow-700 bg-yellow-100 border border-yellow-200">C</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-medium text-gray-600">&lt; 70</span>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-red-700 bg-red-100 border border-red-200">D</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[600px] min-w-0">
          <div className="p-6 border-b border-gray-100 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <BookOpen className="text-blue-600" size={20} /> Daftar Nilai Mata Pelajaran
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="Cari mapel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-x-auto p-0 custom-scrollbar w-full">
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredNilai.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p>Belum ada nilai yang diinputkan untuk semester ini.</p>
              </div>
            ) : (
              <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold sticky top-0 z-10 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Mata Pelajaran</th>
                    <th className="px-4 py-4 text-center">Tugas/Harian</th>
                    <th className="px-4 py-4 text-center">PTS</th>
                    <th className="px-4 py-4 text-center">PAS</th>
                    <th className="px-6 py-4 text-center">Rata-rata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredNilai.map((item, idx) => {
                    const avg = ((item.tugas + item.pts + item.pas) / 3).toFixed(1);
                    const predikat = getPredikat(avg);
                    const mapelName = dataMapel[item.id_mapel] || 'Mapel Tidak Diketahui';
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-bold text-gray-800">
                          {mapelName}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-semibold text-gray-700">{item.tugas || '-'}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-semibold text-gray-700">{item.pts || '-'}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-semibold text-gray-700">{item.pas || '-'}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-bold text-lg">{avg}</span>
                            <span className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs border ${predikat.warna}`}>
                              {predikat.huruf}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
