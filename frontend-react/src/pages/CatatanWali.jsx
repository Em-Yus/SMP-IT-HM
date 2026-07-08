import { useState, useEffect } from 'react';
import { FileText, Search, Save, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';

export default function CatatanWali() {
  const [dataKelas, setDataKelas] = useState([]);
  const [selectedKelasObj, setSelectedKelasObj] = useState(null);
  
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  
  const [filterTahun, setFilterTahun] = useState(defaultTahun);
  const [filterSemester, setFilterSemester] = useState('Ganjil');
  
  const [dataSiswa, setDataSiswa] = useState([]);
  const [catatanData, setCatatanData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingCatatan, setIsSavingCatatan] = useState(false);

  useEffect(() => {
    const fetchKelas = async () => {
      try {
        let { data } = await supabase.from('data_kelas').select('*').order('nama_kelas', { ascending: true });
        
        const userSession = localStorage.getItem('user_guru');
        const userPerms = localStorage.getItem('user_permissions');
        let permissions = [];
        if (userPerms) {
          permissions = JSON.parse(userPerms);
        }

        if (userSession) {
          const userObj = JSON.parse(userSession);
          if (userObj && userObj.id) {
             const isAdmin = permissions.includes('*');
             if (!isAdmin) {
                data = data.filter(k => String(k.wali_kelas_id) === String(userObj.id));
             }
          }
        }
        setDataKelas(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchKelas();
  }, []);

  const handleFetchSiswa = async () => {
    if (!selectedKelasObj) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Kelas terlebih dahulu!' });
      return;
    }

    setIsLoading(true);
    try {
      const { data: siswaData, error } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('kelas', selectedKelasObj.nama_kelas)
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (error) throw error;
      
      const nipdList = (siswaData || []).map(s => s.nipd);
      
      // Fetch existing catatan
      const { data: catatanDb } = await supabase
        .from('catatan_wali')
        .select('*')
        .in('nipd', nipdList)
        .eq('tahun_ajaran', filterTahun)
        .eq('semester', filterSemester);
        
      const initialCatatan = {};
      (siswaData || []).forEach(s => {
         const existing = catatanDb?.find(c => c.nipd === s.nipd);
         initialCatatan[s.nipd] = {
            id: existing?.id || null,
            catatan: existing?.catatan || '',
            kenaikan_kelas: existing?.kenaikan_kelas || ''
         };
      });
      
      setCatatanData(initialCatatan);
      setDataSiswa(siswaData || []);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat data siswa', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCatatanChange = (nipd, field, value) => {
    setCatatanData(prev => ({
      ...prev,
      [nipd]: { ...prev[nipd], [field]: value }
    }));
  };

  const handleSaveAll = async () => {
    setIsSavingCatatan(true);
    try {
      const promises = dataSiswa.map(async (siswa) => {
        const cData = catatanData[siswa.nipd];
        const payload = {
          nipd: siswa.nipd,
          tahun_ajaran: filterTahun,
          semester: filterSemester,
          catatan: cData?.catatan || '',
          kenaikan_kelas: filterSemester === 'Genap' ? (cData?.kenaikan_kelas || '') : null
        };
        
        if (cData?.id) {
          return supabase.from('catatan_wali').update(payload).eq('id', cData.id);
        } else {
          if (payload.catatan || payload.kenaikan_kelas) {
            return supabase.from('catatan_wali').insert([payload]);
          }
        }
      });
      
      await Promise.all(promises);
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Semua catatan wali berhasil disimpan!', timer: 1500 });
      handleFetchSiswa(); // Refresh to get new IDs
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal menyimpan catatan wali', 'error');
    } finally {
      setIsSavingCatatan(false);
    }
  };

  return (
    <>
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
              <FileText className="text-primary" /> Input Catatan Wali Kelas
            </h2>
            <p className="text-gray-500 text-sm mt-1">Kelola catatan akademik, non-akademik, dan kenaikan kelas siswa secara langsung.</p>
          </div>
          {dataSiswa.length > 0 && (
            <button 
              onClick={handleSaveAll} 
              disabled={isSavingCatatan}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg font-semibold transition flex items-center gap-2 shadow-md"
            >
              {isSavingCatatan ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />} Simpan Semua Catatan
            </button>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 flex-wrap">
          <select 
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none font-semibold w-full md:w-auto"
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
          >
            <option value={`${currentYear-1}/${currentYear}`}>{`${currentYear-1}/${currentYear}`}</option>
            <option value={`${currentYear}/${currentYear+1}`}>{`${currentYear}/${currentYear+1}`}</option>
          </select>
          
          <select 
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none font-semibold w-full md:w-auto"
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
          >
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
          </select>

          <select 
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none font-semibold flex-1 min-w-[200px]"
            value={selectedKelasObj ? JSON.stringify(selectedKelasObj) : ''}
            onChange={(e) => setSelectedKelasObj(e.target.value ? JSON.parse(e.target.value) : null)}
          >
            <option value="">-- Pilih Kelas --</option>
            {dataKelas.map((k) => (
              <option key={k.id} value={JSON.stringify(k)}>Kelas {k.nama_kelas}</option>
            ))}
          </select>
          
          <button onClick={handleFetchSiswa} disabled={isLoading} className="bg-primary hover:bg-blue-900 text-white px-6 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 w-full md:w-auto shadow-md">
            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />} Tampilkan Siswa
          </button>
        </div>

        {dataSiswa.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-700">Daftar Siswa - Kelas {selectedKelasObj?.nama_kelas}</h3>
              <span className="text-sm text-gray-500 font-medium">Total: {dataSiswa.length} Siswa</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
                  <tr>
                    <th className="p-4 font-semibold text-center w-12">No</th>
                    <th className="p-4 font-semibold w-48">Siswa</th>
                    <th className="p-4 font-semibold min-w-[300px]">Catatan Wali Kelas</th>
                    {filterSemester === 'Genap' && (
                      <th className="p-4 font-semibold w-48 text-center">Status Kenaikan</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dataSiswa.map((siswa, idx) => (
                    <tr key={siswa.id} className="hover:bg-blue-50/50 transition">
                      <td className="p-4 text-center align-top font-medium pt-5">{idx + 1}</td>
                      <td className="p-4 align-top pt-5">
                        <div className="font-bold text-gray-800 mb-1">{siswa.nama}</div>
                        <div className="text-xs text-gray-500">{siswa.nipd} / {siswa.nisn}</div>
                      </td>
                      <td className="p-4 align-top">
                        <textarea 
                          value={catatanData[siswa.nipd]?.catatan || ''}
                          onChange={(e) => handleCatatanChange(siswa.nipd, 'catatan', e.target.value)}
                          rows="2"
                          placeholder="Tulis catatan di sini..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        ></textarea>
                      </td>
                      {filterSemester === 'Genap' && (
                        <td className="p-4 align-top">
                          <select 
                            value={catatanData[siswa.nipd]?.kenaikan_kelas || ''}
                            onChange={(e) => handleCatatanChange(siswa.nipd, 'kenaikan_kelas', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          >
                            <option value="">-- Pilih --</option>
                            <option value="Naik Kelas">Naik Kelas</option>
                            <option value="Naik Bersyarat">Naik Bersyarat</option>
                            <option value="Tidak Naik">Tidak Naik</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button 
                onClick={handleSaveAll} 
                disabled={isSavingCatatan}
                className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-lg font-bold transition flex items-center gap-2 shadow-md"
              >
                {isSavingCatatan ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />} Simpan Semua Catatan
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
