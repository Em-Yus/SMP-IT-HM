import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, Plus, RefreshCw, Users, FileDown, Upload, Filter, SortAsc } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import SiswaFormModal from '../components/SiswaFormModal';
import ExportModal from '../components/ExportModal';

export default function DataSiswa() {
  const navigate = useNavigate();
  const [dataSiswa, setDataSiswa] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSiswa, setSelectedSiswa] = useState(null);

  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterGender, setFilterGender] = useState('Semua');
  const [sortBy, setSortBy] = useState('nama-asc');
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('status_keaktifan', 'Aktif')
        .neq('kelas', 'Calon Siswa')
        .order('nama', { ascending: true });

      if (error) throw error;
      setDataSiswa(data || []);
    } catch (err) {
      console.error('SupaError:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: `Gagal mengambil data: ${err.message || JSON.stringify(err)}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDetail = (siswa) => {
    Swal.fire({
      title: 'Detail Siswa',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <table class="w-full">
            <tr><td class="font-bold py-1 w-1/3">Nama Lengkap</td><td>: ${siswa.nama}</td></tr>
            <tr><td class="font-bold py-1">NISN / NIPD</td><td>: ${siswa.nisn || '-'} / ${siswa.nipd || '-'}</td></tr>
            <tr><td class="font-bold py-1">Kelas</td><td>: ${siswa.kelas || '-'}</td></tr>
            <tr><td class="font-bold py-1">Jenis Kelamin</td><td>: ${siswa.jenis_kelamin === 'L' ? 'Laki-laki' : siswa.jenis_kelamin === 'P' ? 'Perempuan' : siswa.jenis_kelamin || '-'}</td></tr>
            <tr><td class="font-bold py-1">Tempat, Tgl Lahir</td><td>: ${siswa.tempat_lahir || '-'}, ${siswa.tanggal_lahir || '-'}</td></tr>
            <tr><td class="font-bold py-1">No. WhatsApp</td><td>: ${siswa.wa_siswa || '-'}</td></tr>
          </table>
        </div>
      `,
      confirmButtonText: 'Tutup',
      confirmButtonColor: '#2a2c87'
    });
  };

  const handleEdit = (siswa) => {
    setSelectedSiswa(siswa);
    setIsEditModalOpen(true);
  };

  const handleUpdateStatusDirect = (siswa, newStatus) => {
    if (!newStatus) return;

    if (newStatus === 'Pindah') {
      navigate('/surat-kesiswaan', { state: { type: 'pindah', siswa } });
      return;
    }

    Swal.fire({
      title: 'Konfirmasi',
      text: `Ubah status ${siswa.nama} menjadi ${newStatus}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Ubah',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2a2c87',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          Swal.fire({title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => {Swal.showLoading()}});
          
          const { error } = await supabase
            .from('data_siswa')
            .update({ status_keaktifan: newStatus })
            .eq('id', siswa.id);
            
          if (error) throw error;
          
          Swal.fire({ icon: 'success', title: 'Berhasil', text: `Status berhasil diubah menjadi ${newStatus}`, timer: 1500 });
          fetchData();
        } catch (err) {
          console.error(err);
          Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
        }
      }
    });
  };

  const uniqueClasses = ['Semua', ...new Set(dataSiswa.map(item => item.kelas).filter(Boolean))].sort();

  const filteredData = dataSiswa.filter(item => {
    const keyword = searchTerm.toLowerCase();
    const matchName = (item.nama || '').toLowerCase().includes(keyword);
    const matchNisn = (item.nisn || '').toLowerCase().includes(keyword);
    const matchKelasSearch = (item.kelas || '').toLowerCase().includes(keyword);
    
    const matchSearch = matchName || matchNisn || matchKelasSearch;
    const matchKelasFilter = filterKelas === 'Semua' || item.kelas === filterKelas;
    
    let matchGenderFilter = true;
    if (filterGender === 'Laki-laki') {
      matchGenderFilter = item.jenis_kelamin === 'L' || (item.jenis_kelamin || '').toLowerCase().includes('laki');
    } else if (filterGender === 'Perempuan') {
      matchGenderFilter = item.jenis_kelamin === 'P' || (item.jenis_kelamin || '').toLowerCase().includes('perempuan');
    }

    return matchSearch && matchKelasFilter && matchGenderFilter;
  }).sort((a, b) => {
    if (sortBy === 'nama-asc') return (a.nama || '').localeCompare(b.nama || '');
    if (sortBy === 'nama-desc') return (b.nama || '').localeCompare(a.nama || '');
    if (sortBy === 'nipd-asc') return (a.nipd || '').localeCompare(b.nipd || '');
    if (sortBy === 'nipd-desc') return (b.nipd || '').localeCompare(a.nipd || '');
    if (sortBy === 'kelas-asc') return (a.kelas || '').localeCompare(b.kelas || '');
    if (sortBy === 'kelas-desc') return (b.kelas || '').localeCompare(a.kelas || '');
    return 0;
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Users className="text-primary" /> Data Siswa Aktif
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola data seluruh siswa aktif di sekolah.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setIsExportModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition flex items-center justify-center gap-2 text-sm w-full md:w-auto">
            <FileDown size={18} /> <span className="hidden sm:inline">Export Excel</span>
          </button>
          
          <button onClick={fetchData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
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
            placeholder="Cari nama, NISN, atau kelas..." 
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:bg-white outline-none text-sm font-medium transition text-primary"
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 md:flex-none">
            <Filter size={16} className="text-gray-500" />
            <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none w-full md:w-36 cursor-pointer">
              {uniqueClasses.map(kls => (
                <option key={kls} value={kls}>{kls === 'Semua' ? 'Semua Kelas' : kls}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 md:flex-none">
            <Users size={16} className="text-gray-500" />
            <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none w-full md:w-36 cursor-pointer">
              <option value="Semua">Semua Kelamin</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 md:flex-none">
            <SortAsc size={16} className="text-gray-500" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none w-full md:w-44 cursor-pointer">
              <option value="nama-asc">Nama (A-Z)</option>
              <option value="nama-desc">Nama (Z-A)</option>
              <option value="nipd-asc">NIPD (Kecil-Besar)</option>
              <option value="nipd-desc">NIPD (Besar-Kecil)</option>
              <option value="kelas-asc">Kelas (A-Z)</option>
              <option value="kelas-desc">Kelas (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Nama, NIPD & NISN</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4">Jenis Kelamin</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                    Memuat data...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                    Tidak ada data siswa.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{item.nama}</div>
                      <div className="text-xs text-gray-500">NIPD: {item.nipd || '-'} | NISN: {item.nisn || '-'}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-primary">{item.kelas || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{item.jenis_kelamin || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-green-50 text-green-600 text-xs font-medium rounded-full border border-green-200">
                        {item.status_keaktifan || 'Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleDetail(item)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded">Detail</button>
                        <button onClick={() => navigate(`/kartu-siswa`, { state: { preselectId: item.id } })} className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 p-1.5 rounded">Kartu</button>
                        <button onClick={() => handleEdit(item)} className="text-yellow-600 hover:text-yellow-700 bg-yellow-50 p-1.5 rounded">Edit</button>
                        <select 
                          value="" 
                          onChange={(e) => handleUpdateStatusDirect(item, e.target.value)} 
                          className="text-red-600 bg-red-50 p-1 rounded outline-none cursor-pointer hover:bg-red-100 transition border border-transparent focus:border-red-300"
                        >
                          <option value="" disabled>Nonaktifkan</option>
                          <option value="Keluar">Keluar</option>
                          <option value="Pindah">Pindah</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <SiswaFormModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        siswaData={selectedSiswa} 
        onSuccess={fetchData} 
      />

      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        dataToExport={filteredData}
        selectedClass={filterKelas}
      />
    </div>
  );
}
