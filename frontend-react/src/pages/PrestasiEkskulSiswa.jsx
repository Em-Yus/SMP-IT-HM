import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, Medal, Star, Image as ImageIcon, Activity } from 'lucide-react';
import Swal from 'sweetalert2';

export default function PrestasiEkskulSiswa() {
  const [userData, setUserData] = useState(null);
  
  const [prestasiList, setPrestasiList] = useState([]);
  const [ekskulList, setEkskulList] = useState([]);
  const [kokuList, setKokuList] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  
  const [filterTahun, setFilterTahun] = useState(defaultTahun);
  const [filterSemester, setFilterSemester] = useState('Ganjil');

  useEffect(() => {
    const session = localStorage.getItem('user_siswa');
    if (session) {
      setUserData(JSON.parse(session));
    }
  }, []);

  useEffect(() => {
    if (userData) {
      fetchData();
    }
  }, [userData, filterTahun, filterSemester]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const nipd = userData.nipd;
      const siswaId = userData.id;

      // 1. Fetch Prestasi
      let { data: prestasiData, error: errPrestasi } = await supabase
        .from('prestasi_siswa')
        .select('*')
        .eq('nipd', nipd)
        .order('created_at', { ascending: false });

      if (errPrestasi) {
        // Fallback tabel lain
        const { data: data2 } = await supabase
          .from('prestasi-siswa')
          .select('*')
          .eq('nipd', nipd)
          .order('created_at', { ascending: false });
        prestasiData = data2;
      }
      setPrestasiList(prestasiData || []);

      // 2. Fetch Ekskul
      const { data: ekskulData } = await supabase
        .from('anggota_ekskul')
        .select(`keterangan, data_ekskul ( nama_ekskul, pembina )`)
        .eq('siswa_id', siswaId)
        .eq('tahun_ajaran', filterTahun)
        .eq('semester', filterSemester);
        
      setEkskulList(ekskulData || []);

      // 3. Fetch Kokurikuler (P5)
      const { data: kokuData } = await supabase
        .from('anggota_kokurikuler')
        .select(`data_kokurikuler ( nama_kegiatan, fasilitator )`)
        .eq('siswa_id', siswaId)
        .eq('tahun_ajaran', filterTahun)
        .eq('semester', filterSemester);

      setKokuList(kokuData || []);

    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data prestasi dan ekskul.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-300 pb-10">
      
      {/* Header & Filter */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-bl-full -z-0"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Trophy className="text-yellow-500" /> Prestasi & Kegiatan
          </h2>
          <p className="text-gray-500 mt-1">Daftar capaian prestasi dan keaktifan ekstrakurikuler & P5.</p>
        </div>

        <div className="grid grid-cols-2 w-full md:flex md:w-auto items-center gap-3 relative z-10 mt-4 md:mt-0">
          <select 
            value={filterSemester} 
            onChange={(e) => setFilterSemester(e.target.value)}
            className="w-full min-w-0 px-2 sm:px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-sm font-semibold text-gray-700 text-ellipsis overflow-hidden"
          >
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
          </select>
          <select 
            value={filterTahun} 
            onChange={(e) => setFilterTahun(e.target.value)}
            className="w-full min-w-0 px-2 sm:px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-sm font-semibold text-gray-700 text-ellipsis overflow-hidden"
          >
            <option value={`${currentYear - 1}/${currentYear}`}>{currentYear - 1}/{currentYear}</option>
            <option value={`${currentYear}/${currentYear + 1}`}>{currentYear}/{currentYear + 1}</option>
            <option value={`${currentYear + 1}/${currentYear + 2}`}>{currentYear + 1}/{currentYear + 2}</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
           <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500"></div>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* BAGIAN PRESTASI */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-amber-50/50 flex items-center gap-2">
               <Medal className="text-amber-600" size={22} />
               <div>
                 <h3 className="font-bold text-gray-800 text-lg">Catatan Prestasi</h3>
                 <p className="text-xs text-gray-500">Seluruh prestasi akademik & non-akademik yang pernah diraih (Semua Tahun).</p>
               </div>
            </div>

            <div className="p-6">
               {prestasiList.length === 0 ? (
                 <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                   <Trophy className="mx-auto text-gray-300 mb-3" size={40} />
                   <h4 className="text-gray-500 font-medium">Belum Ada Data Prestasi</h4>
                   <p className="text-gray-400 text-sm mt-1">Ayo terus semangat belajar dan berkarya untuk meraih prestasi!</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {prestasiList.map((item) => (
                     <div key={item.id} className="border border-gray-100 rounded-xl p-4 flex gap-4 hover:shadow-md transition bg-white group">
                       <div className="w-16 h-16 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 border border-amber-200 overflow-hidden relative">
                         {item.foto_bukti ? (
                           <img src={item.foto_bukti} alt="Bukti" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                         ) : (
                           <Trophy size={28} />
                         )}
                       </div>
                       <div className="flex-1">
                         <h4 className="font-bold text-gray-800 text-base leading-tight group-hover:text-amber-600 transition">{item.nama_prestasi}</h4>
                         <div className="flex flex-wrap gap-2 mt-2">
                           <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase">🏆 {item.peringkat}</span>
                           <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">{item.tingkat}</span>
                           <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 uppercase">{item.jenis_prestasi}</span>
                         </div>
                         <div className="mt-3 text-xs text-gray-500 grid grid-cols-2 gap-y-1">
                           <div><span className="font-semibold">Tahun:</span> {item.tahun}</div>
                           <div><span className="font-semibold">Penyelenggara:</span> {item.penyelenggara || '-'}</div>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* BAGIAN EKSKUL */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-blue-50/50 flex items-center gap-2">
                 <Activity className="text-blue-600" size={22} />
                 <div>
                   <h3 className="font-bold text-gray-800 text-lg">Keaktifan Ekstrakurikuler</h3>
                   <p className="text-xs text-gray-500">Tahun Ajaran {filterTahun} Semester {filterSemester}</p>
                 </div>
              </div>
              <div className="p-6">
                 {ekskulList.length === 0 ? (
                   <div className="text-center py-8 text-gray-500 text-sm italic">
                     Anda belum terdaftar di ekstrakurikuler manapun pada periode ini.
                   </div>
                 ) : (
                   <div className="space-y-3">
                     {ekskulList.map((eks, idx) => (
                       <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                         <div className="font-bold text-gray-800 text-base">{eks.data_ekskul?.nama_ekskul}</div>
                         <div className="text-sm text-gray-600 mt-1"><span className="font-semibold">Pembina:</span> {eks.data_ekskul?.pembina || '-'}</div>
                         <div className="text-sm text-gray-600 mt-1"><span className="font-semibold">Nilai/Keterangan:</span> {eks.keterangan || '-'}</div>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            </div>

            {/* BAGIAN KOKURIKULER (P5) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-emerald-50/50 flex items-center gap-2">
                 <Star className="text-emerald-600" size={22} />
                 <div>
                   <h3 className="font-bold text-gray-800 text-lg">Kokurikuler (Projek P5)</h3>
                   <p className="text-xs text-gray-500">Tahun Ajaran {filterTahun} Semester {filterSemester}</p>
                 </div>
              </div>
              <div className="p-6">
                 {kokuList.length === 0 ? (
                   <div className="text-center py-8 text-gray-500 text-sm italic">
                     Belum ada data kegiatan Projek P5 pada periode ini.
                   </div>
                 ) : (
                   <div className="space-y-3">
                     {kokuList.map((koku, idx) => (
                       <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                         <div className="font-bold text-gray-800 text-base">{koku.data_kokurikuler?.nama_kegiatan}</div>
                         <div className="text-sm text-gray-600 mt-1"><span className="font-semibold">Fasilitator:</span> {koku.data_kokurikuler?.fasilitator || '-'}</div>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
