import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { FileText, Award, BookOpen, Search, BarChart3, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

export default function NilaiSiswa() {
  const [dataNilai, setDataNilai] = useState([]);
  const [dataMapel, setDataMapel] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  
  const [availableTahun, setAvailableTahun] = useState([
    `${currentYear - 2}/${currentYear - 1}`,
    `${currentYear - 1}/${currentYear}`,
    `${currentYear}/${currentYear + 1}`,
    `${currentYear + 1}/${currentYear + 2}`
  ]);
  const [filterTahun, setFilterTahun] = useState('Semua');
  const [filterSemester, setFilterSemester] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Ambil daftar mapel
    const fetchMapel = async () => {
      const { data } = await supabase.from('data_mapel').select('id, nama_mapel, urutan').order('urutan', { ascending: true });
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

  const fetchNilai = async () => {
    setIsLoading(true);
    try {
      const session = localStorage.getItem('user_siswa');
      if (!session) throw new Error("Sesi tidak ditemukan. Silakan login kembali.");
      
      const parsed = JSON.parse(session);
      setUserData(parsed);
      const targetNipd = parsed.nipd || parsed.nisn || parsed.nis;

      if (!targetNipd) {
        setDataNilai([]);
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from('nilai_siswa')
        .select('*');

      if (parsed.nipd && parsed.nisn && parsed.nipd !== parsed.nisn) {
        query = query.or(`nipd.eq.${parsed.nipd},nipd.eq.${parsed.nisn}`);
      } else {
        query = query.eq('nipd', targetNipd);
      }

      if (filterTahun && filterTahun !== 'Semua') {
        query = query.eq('tahun_ajaran', filterTahun);
      }
      if (filterSemester && filterSemester !== 'Semua') {
        query = query.eq('semester', filterSemester);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Kumpulkan tahun_ajaran yang ada di database untuk opsi filter dinamis
      if (data && data.length > 0) {
        const yearsFromData = [...new Set(data.map(d => d.tahun_ajaran).filter(Boolean))];
        setAvailableTahun(prev => {
          const merged = [...new Set([...prev, ...yearsFromData])];
          return merged.sort();
        });
      }

      // Group data berdasarkan id_mapel
      const grouped = {};
      (data || []).forEach(row => {
        const mapelId = row.id_mapel;
        if (!grouped[mapelId]) {
          grouped[mapelId] = {
            id_mapel: mapelId,
            tugas1: null,
            tugas2: null,
            tugas3: null,
            tugas4: null,
            pts: null,
            pas: null,
            allScores: []
          };
        }
        
        const val = parseFloat(row.nilai_siswa);
        const numVal = isNaN(val) ? 0 : val;
        const jenis = (row.jenis_nilai || '').trim();

        grouped[mapelId].allScores.push({ jenis, val: numVal });

        // Map jenis_nilai
        if (jenis === 'Tugas 1') grouped[mapelId].tugas1 = numVal;
        else if (jenis === 'Tugas 2') grouped[mapelId].tugas2 = numVal;
        else if (jenis === 'Tugas 3') grouped[mapelId].tugas3 = numVal;
        else if (jenis === 'Tugas 4') grouped[mapelId].tugas4 = numVal;
        else if (jenis === 'PTS') grouped[mapelId].pts = numVal;
        else if (jenis === 'PAS' || jenis === 'PAT') grouped[mapelId].pas = numVal;
        else if (jenis.toLowerCase().includes('tugas') || jenis.toLowerCase().includes('harian') || jenis.toLowerCase().includes('ph')) {
          // Fallback generic tugas
          if (grouped[mapelId].tugas1 === null) grouped[mapelId].tugas1 = numVal;
          else if (grouped[mapelId].tugas2 === null) grouped[mapelId].tugas2 = numVal;
          else if (grouped[mapelId].tugas3 === null) grouped[mapelId].tugas3 = numVal;
          else if (grouped[mapelId].tugas4 === null) grouped[mapelId].tugas4 = numVal;
        }
      });

      setDataNilai(Object.values(grouped));
    } catch (err) {
      console.error('Error fetching nilai:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data nilai.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNilai();
  }, [filterTahun, filterSemester]);

  const getPredikat = (nilai) => {
    const num = parseFloat(nilai) || 0;
    if (num >= 90) return { huruf: 'A', warna: 'text-green-600 bg-green-50 border-green-200' };
    if (num >= 80) return { huruf: 'B', warna: 'text-blue-600 bg-blue-50 border-blue-200' };
    if (num >= 70) return { huruf: 'C', warna: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    return { huruf: 'D', warna: 'text-red-600 bg-red-50 border-red-200' };
  };

  const getMapelScores = (item) => {
    return [item.tugas1, item.tugas2, item.tugas3, item.tugas4, item.pts, item.pas].filter(
      v => v !== null && v !== undefined
    );
  };

  const filteredNilai = dataNilai.filter(item => {
    const mapelName = dataMapel[item.id_mapel] || `Mapel #${item.id_mapel}`;
    return mapelName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Hitung Rata-rata Total
  let totalSemuaMapel = 0;
  let countMapelWithScores = 0;
  
  filteredNilai.forEach(item => {
    const scores = getMapelScores(item);
    if (scores.length > 0) {
      const avg = scores.reduce((sum, val) => sum + val, 0) / scores.length;
      totalSemuaMapel += avg;
      countMapelWithScores++;
    }
  });

  const rataRataKeseluruhan = countMapelWithScores > 0 ? (totalSemuaMapel / countMapelWithScores).toFixed(1) : '0';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#1E257F]/5 rounded-bl-full -z-0"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-[#1E257F]" /> Nilai Harian & Ujian
          </h2>
          <p className="text-gray-500 mt-1">Pantau perkembangan nilai akademik Anda per semester.</p>
        </div>
        
        <div className="grid grid-cols-2 w-full md:flex md:w-auto items-center gap-3 relative z-10 mt-4 md:mt-0">
          <select 
            value={filterSemester} 
            onChange={(e) => setFilterSemester(e.target.value)}
            className="w-full min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E257F] outline-none text-sm font-semibold text-gray-700"
          >
            <option value="Semua">Semua Semester</option>
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
          </select>
          <select 
            value={filterTahun} 
            onChange={(e) => setFilterTahun(e.target.value)}
            className="w-full min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E257F] outline-none text-sm font-semibold text-gray-700"
          >
            <option value="Semua">Semua Tahun</option>
            {availableTahun.map(thn => (
              <option key={thn} value={thn}>{thn}</option>
            ))}
          </select>
          <button 
            onClick={fetchNilai} 
            disabled={isLoading}
            title="Segarkan data nilai"
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition flex items-center justify-center shrink-0"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kolom Kiri: Rata-rata & Keterangan Predikat */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-[#1E257F] to-[#2a349c] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <BarChart3 className="absolute right-[-10px] bottom-[-10px] opacity-20 text-white" size={120} />
            <div className="relative z-10">
              <div className="text-white/80 font-medium text-xs mb-1 uppercase tracking-wider">
                {filterSemester === 'Semua' ? 'Rata-rata Nilai Akademik' : `Rata-rata Semester ${filterSemester}`}
              </div>
              <h3 className="text-5xl font-black mb-2">{rataRataKeseluruhan}</h3>
              <p className="text-xs text-white/80">Dari {countMapelWithScores} mata pelajaran yang dinilai</p>
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

        {/* Kolom Kanan: Tabel Nilai Mata Pelajaran */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[600px] min-w-0">
          <div className="p-5 border-b border-gray-100 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
              <BookOpen className="text-[#1E257F]" size={18} /> Rincian Nilai Mata Pelajaran
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="Cari mapel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1E257F] outline-none text-sm bg-gray-50"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-x-auto p-0 custom-scrollbar w-full">
            {isLoading ? (
              <div className="flex flex-col justify-center items-center py-20 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E257F] mb-3"></div>
                <p className="text-xs">Memuat data nilai...</p>
              </div>
            ) : filteredNilai.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="font-semibold text-gray-700">Belum ada nilai yang diinputkan</p>
                <p className="text-xs text-gray-400 mt-1">Nilai Anda belum dimasukkan oleh guru untuk semester atau tahun ini.</p>
              </div>
            ) : (
              <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
                <thead className="bg-[#F8F9FA] text-[#1A1818] uppercase text-xs font-bold sticky top-0 z-10 border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-5 py-3.5">Mata Pelajaran</th>
                    <th className="px-3 py-3.5 text-center">Tugas 1</th>
                    <th className="px-3 py-3.5 text-center">Tugas 2</th>
                    <th className="px-3 py-3.5 text-center">Tugas 3</th>
                    <th className="px-3 py-3.5 text-center">Tugas 4</th>
                    <th className="px-3 py-3.5 text-center">PTS</th>
                    <th className="px-3 py-3.5 text-center">PAS</th>
                    <th className="px-5 py-3.5 text-center">Rata-rata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredNilai.map((item, idx) => {
                    const scores = getMapelScores(item);
                    const avg = scores.length > 0 ? (scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(1) : '-';
                    const predikat = scores.length > 0 ? getPredikat(avg) : null;
                    const mapelName = dataMapel[item.id_mapel] || `Mapel ID ${item.id_mapel}`;
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50/80 transition">
                        <td className="px-5 py-3.5 font-bold text-gray-800">
                          {mapelName}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={item.tugas1 !== null ? "font-semibold text-gray-800" : "text-gray-300"}>
                            {item.tugas1 !== null ? item.tugas1 : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={item.tugas2 !== null ? "font-semibold text-gray-800" : "text-gray-300"}>
                            {item.tugas2 !== null ? item.tugas2 : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={item.tugas3 !== null ? "font-semibold text-gray-800" : "text-gray-300"}>
                            {item.tugas3 !== null ? item.tugas3 : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={item.tugas4 !== null ? "font-semibold text-gray-800" : "text-gray-300"}>
                            {item.tugas4 !== null ? item.tugas4 : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={item.pts !== null ? "font-semibold text-gray-800" : "text-gray-300"}>
                            {item.pts !== null ? item.pts : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={item.pas !== null ? "font-semibold text-gray-800" : "text-gray-300"}>
                            {item.pas !== null ? item.pas : '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {predikat ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-bold text-sm text-[#1E257F]">{avg}</span>
                              <span className={`w-6 h-6 flex items-center justify-center rounded-md font-bold text-[11px] border ${predikat.warna}`}>
                                {predikat.huruf}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-300 font-medium">-</span>
                          )}
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
