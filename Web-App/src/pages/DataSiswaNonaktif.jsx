import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, RefreshCw, UserMinus, FileDown, Filter, SortAsc } from 'lucide-react';
import Swal from 'sweetalert2';
import SiswaFormModal from '../components/SiswaFormModal';
import ExportModal from '../components/ExportModal';

export default function DataSiswaNonaktif() {
  const [dataSiswa, setDataSiswa] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSiswa, setSelectedSiswa] = useState(null);

  const [filterStatus, setFilterStatus] = useState('Semua');
  const [sortBy, setSortBy] = useState('nama-asc');
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('*')
        .neq('status_keaktifan', 'Aktif')
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
      title: 'Detail Siswa Nonaktif',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <table class="w-full">
            <tr><td class="font-bold py-1 w-1/3">Nama Lengkap</td><td>: ${siswa.nama}</td></tr>
            <tr><td class="font-bold py-1">NISN / NIPD</td><td>: ${siswa.nisn || '-'} / ${siswa.nipd || '-'}</td></tr>
            <tr><td class="font-bold py-1">Status Keaktifan</td><td>: <strong class="text-red-600">${siswa.status_keaktifan || '-'}</strong></td></tr>
            <tr><td class="font-bold py-1">Kelas Terakhir</td><td>: ${siswa.kelas || '-'}</td></tr>
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

  // Derive unique statuses (e.g. Keluar, Pindah, Tidak Aktif)
  const uniqueStatuses = ['Semua', ...new Set(dataSiswa.map(item => item.status_keaktifan).filter(Boolean))].sort();

  const filteredData = dataSiswa.filter(item => {
    const keyword = searchTerm.toLowerCase();
    const matchName = (item.nama || '').toLowerCase().includes(keyword);
    const matchNisn = (item.nisn || '').toLowerCase().includes(keyword);
    
    const matchSearch = matchName || matchNisn;
    const matchStatusFilter = filterStatus === 'Semua' || item.status_keaktifan === filterStatus;

    return matchSearch && matchStatusFilter;
  }).sort((a, b) => {
    if (sortBy === 'nama-asc') return (a.nama || '').localeCompare(b.nama || '');
    if (sortBy === 'nama-desc') return (b.nama || '').localeCompare(a.nama || '');
    if (sortBy === 'nipd-asc') return (a.nipd || '').localeCompare(b.nipd || '');
    if (sortBy === 'nipd-desc') return (b.nipd || '').localeCompare(a.nipd || '');
    if (sortBy === 'status-asc') return (a.status_keaktifan || '').localeCompare(b.status_keaktifan || '');
    if (sortBy === 'status-desc') return (b.status_keaktifan || '').localeCompare(a.status_keaktifan || '');
    return 0;
  });

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-red-600 flex items-center gap-2">
            <UserMinus className="text-red-600" /> Data Siswa Nonaktif
          </h2>
          <p className="text-gray-500 text-sm mt-1">Arsip data siswa yang telah keluar, pindah, atau tidak aktif.</p>
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
            placeholder="Cari nama atau NISN..." 
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-400 focus:bg-white outline-none text-sm font-medium transition text-red-600"
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 md:flex-none">
            <Filter size={16} className="text-gray-500" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none w-full md:w-36 cursor-pointer">
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status === 'Semua' ? 'Semua Status' : status}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 md:flex-none">
            <SortAsc size={16} className="text-gray-500" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent text-sm text-gray-700 outline-none w-full md:w-44 cursor-pointer">
              <option value="nama-asc">Nama (A-Z)</option>
              <option value="nama-desc">Nama (Z-A)</option>
              <option value="nipd-asc">NIPD (Kecil-Besar)</option>
              <option value="nipd-desc">NIPD (Besar-Kecil)</option>
              <option value="status-asc">Status (A-Z)</option>
              <option value="status-desc">Status (Z-A)</option>
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
                <th className="px-6 py-4">Kelas Terakhir</th>
                <th className="px-6 py-4">Jenis Kelamin</th>
                <th className="px-6 py-4">Status Keaktifan</th>
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
                    Tidak ada data siswa nonaktif.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-red-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{item.nama}</div>
                      <div className="text-xs text-gray-500">NIPD: {item.nipd || '-'} | NISN: {item.nisn || '-'}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-600">{item.kelas || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{item.jenis_kelamin || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">
                        {item.status_keaktifan || 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleDetail(item)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded">Detail</button>
                        <button onClick={() => handleEdit(item)} className="text-yellow-600 hover:text-yellow-700 bg-yellow-50 p-1.5 rounded" title="Edit untuk mengembalikan ke Aktif">Edit</button>
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
        selectedClass="Siswa Nonaktif"
      />
    </div>
  );
}
