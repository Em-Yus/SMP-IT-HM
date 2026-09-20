import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, Activity, Filter, Edit, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';
import DataPeriodikModal from '../components/DataPeriodikModal';

export default function DataPeriodik() {
  const [dataSiswa, setDataSiswa] = useState([]);
  const [dataPeriodik, setDataPeriodik] = useState({});
  const [kelasOptions, setKelasOptions] = useState([]);
  
  const [filterKelas, setFilterKelas] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
  const [semester, setSemester] = useState('Ganjil');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSiswa, setSelectedSiswa] = useState(null);

  useEffect(() => {
    fetchKelasOptions();
  }, []);

  useEffect(() => {
    if (filterKelas) {
      fetchData();
    }
  }, [filterKelas, tahunAjaran, semester]);

  const fetchKelasOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('data_kelas')
        .select('nama_kelas')
        .order('nama_kelas', { ascending: true });
      if (error) throw error;
      
      const options = data.map(k => k.nama_kelas);
      setKelasOptions(options);
      if (options.length > 0 && !filterKelas) {
        setFilterKelas(options[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Active Students in selected Class
      const { data: siswa, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('id, nama, nisn, nipd, jenis_kelamin')
        .eq('kelas', filterKelas)
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (errSiswa) throw errSiswa;
      setDataSiswa(siswa || []);

      if (siswa && siswa.length > 0) {
        const siswaIds = siswa.map(s => s.id);
        
        // 2. Fetch Periodic Data for those students in selected TA & Semester
        const { data: periodik, error: errPeriodik } = await supabase
          .from('data_periodik')
          .select('*')
          .in('id_siswa', siswaIds)
          .eq('tahun_ajaran', tahunAjaran)
          .eq('semester', semester);
          
        if (errPeriodik) throw errPeriodik;

        const periodikMap = {};
        periodik.forEach(p => {
          periodikMap[p.id_siswa] = p;
        });
        setDataPeriodik(periodikMap);
      } else {
        setDataPeriodik({});
      }

    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data' });
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (siswa) => {
    setSelectedSiswa(siswa);
    setIsModalOpen(true);
  };

  const filteredSiswa = dataSiswa.filter(s => 
    s.nama?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.nisn?.includes(searchTerm)
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Activity className="text-primary" /> Data Periodik Siswa
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola data tinggi, berat badan, dan kesehatan fisik per semester.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col lg:flex-row gap-4 justify-between items-center">
        <div className="flex-1 w-full lg:w-auto relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama atau NISN..." 
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:bg-white outline-none text-sm font-medium transition text-primary"
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 md:flex-none">
            <Filter size={16} className="text-gray-500" />
            <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none w-full md:w-36 cursor-pointer">
              <option value="">-- Pilih Kelas --</option>
              {kelasOptions.map(kls => (
                <option key={kls} value={kls}>{kls}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 md:flex-none">
            <select value={tahunAjaran} onChange={e => setTahunAjaran(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none w-full md:w-32 cursor-pointer">
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
              <option value="2027/2028">2027/2028</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 md:flex-none">
            <select value={semester} onChange={e => setSemester(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none w-full md:w-28 cursor-pointer">
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Nama Siswa</th>
                <th className="px-6 py-4 text-center">Tinggi (cm)</th>
                <th className="px-6 py-4 text-center">Berat (kg)</th>
                <th className="px-6 py-4">Kondisi Mata</th>
                <th className="px-6 py-4">Kondisi Telinga</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredSiswa.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-gray-400">
                    {filterKelas ? 'Tidak ada siswa di kelas ini.' : 'Silakan pilih kelas terlebih dahulu.'}
                  </td>
                </tr>
              ) : (
                filteredSiswa.map((siswa, idx) => {
                  const periodik = dataPeriodik[siswa.id];
                  const hasData = !!periodik;

                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">{siswa.nama}</div>
                        <div className="text-xs text-gray-500">NISN: {siswa.nisn || '-'} • L/P: {siswa.jenis_kelamin || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium">{periodik?.tinggi_badan || '-'}</td>
                      <td className="px-6 py-4 text-center font-medium">{periodik?.berat_badan || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{periodik?.kondisi_mata || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{periodik?.kondisi_telinga || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        {hasData ? (
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-700">Sudah Diisi</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700">Belum Diisi</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <button onClick={() => openModal(siswa)} className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition flex items-center gap-1 text-xs">
                            <Edit size={14} /> {hasData ? 'Edit Data' : 'Isi Data'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DataPeriodikModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        periodikData={selectedSiswa ? dataPeriodik[selectedSiswa.id] : null}
        siswaId={selectedSiswa?.id}
        namaSiswa={selectedSiswa?.nama}
        tahunAjaran={tahunAjaran}
        semester={semester}
        onSuccess={fetchData}
      />
    </div>
  );
}
