import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { X, Save, Search, Users } from 'lucide-react';

export default function AnggotaKelasMengajiModal({ isOpen, onClose, kelasData }) {
  const [dataSiswa, setDataSiswa] = useState([]);
  const [filteredSiswa, setFilteredSiswa] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State untuk melacak ID siswa yang dicentang
  const [checkedIds, setCheckedIds] = useState(new Set());
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [sortBy, setSortBy] = useState('nama-asc');

  useEffect(() => {
    if (!isOpen || !kelasData) return;
    
    const fetchSiswa = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('data_siswa')
          .select('id, nama, nipd, nisn, kelas_mengaji, status_keaktifan')
          .eq('status_keaktifan', 'Aktif')
          .neq('kelas', 'Calon Siswa')
          .order('nama', { ascending: true });

        if (error) throw error;
        
        setDataSiswa(data || []);
        
        // Tandai siswa yang kelasnya sama dengan kelas yang sedang dibuka
        const initialChecked = new Set();
        data?.forEach(siswa => {
          if (siswa.kelas_mengaji === kelasData.nama_kelas) {
            initialChecked.add(siswa.id);
          }
        });
        setCheckedIds(initialChecked);
        
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal', 'Gagal memuat data siswa.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSiswa();
    setSearchTerm('');
    setFilterKelas('Semua');
    setSortBy('nama-asc');
  }, [isOpen, kelasData]);

  // Derive kelas unik untuk dropdown filter
  const uniqueClasses = ['Semua', 'Belum ada kelas', ...new Set(dataSiswa.map(item => item.kelas_mengaji).filter(Boolean))].sort();

  // Efek untuk pencarian, filter, dan urutan
  useEffect(() => {
    if (!dataSiswa) return;
    const lowerKeyword = searchTerm.toLowerCase();
    
    // 1. Filter
    let filtered = dataSiswa.filter(s => {
      const matchSearch = (s.nama && s.nama.toLowerCase().includes(lowerKeyword)) ||
                          (s.nipd && s.nipd.toLowerCase().includes(lowerKeyword)) ||
                          (s.kelas_mengaji && s.kelas_mengaji.toLowerCase().includes(lowerKeyword));
                          
      let matchKelas = true;
      if (filterKelas === 'Belum ada kelas') {
        matchKelas = !s.kelas_mengaji;
      } else if (filterKelas !== 'Semua') {
        matchKelas = s.kelas_mengaji === filterKelas;
      }
      
      return matchSearch && matchKelas;
    });

    // 2. Sortir
    filtered = filtered.sort((a, b) => {
      if (sortBy === 'nama-asc') return (a.nama || '').localeCompare(b.nama || '');
      if (sortBy === 'nama-desc') return (b.nama || '').localeCompare(a.nama || '');
      if (sortBy === 'nipd-asc') return (a.nipd || '').localeCompare(b.nipd || '');
      if (sortBy === 'nipd-desc') return (b.nipd || '').localeCompare(a.nipd || '');
      if (sortBy === 'kelas-asc') return (a.kelas_mengaji || '').localeCompare(b.kelas_mengaji || '');
      if (sortBy === 'kelas-desc') return (b.kelas_mengaji || '').localeCompare(a.kelas_mengaji || '');
      return 0;
    });
    
    setFilteredSiswa(filtered);
  }, [searchTerm, filterKelas, sortBy, dataSiswa]);

  const handleCheckboxChange = (id) => {
    const newChecked = new Set(checkedIds);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedIds(newChecked);
  };

  const handleToggleAll = (checked) => {
    if (checked) {
      // Centang semua yang ada di hasil pencarian
      const newChecked = new Set(checkedIds);
      filteredSiswa.forEach(s => newChecked.add(s.id));
      setCheckedIds(newChecked);
    } else {
      // Hapus centang semua yang ada di hasil pencarian
      const newChecked = new Set(checkedIds);
      filteredSiswa.forEach(s => newChecked.delete(s.id));
      setCheckedIds(newChecked);
    }
  };

  const isAllFilteredChecked = filteredSiswa.length > 0 && filteredSiswa.every(s => checkedIds.has(s.id));

  const handleSubmit = async () => {
    setIsSaving(true);
    
    try {
      // Data lama vs Data baru (yang dicentang)
      const currentClassMembers = dataSiswa.filter(s => s.kelas_mengaji === kelasData.nama_kelas).map(s => s.id);
      
      const toAdd = Array.from(checkedIds).filter(id => !currentClassMembers.includes(id));
      const toRemove = currentClassMembers.filter(id => !checkedIds.has(id));

      const promises = [];

      // Update siswa yang baru dicentang (dimasukkan ke kelas ini)
      if (toAdd.length > 0) {
        promises.push(
          supabase
            .from('data_siswa')
            .update({ kelas_mengaji: kelasData.nama_kelas })
            .in('id', toAdd)
        );
      }

      // Update siswa yang dihilangkan centangnya (dikeluarkan dari kelas ini)
      if (toRemove.length > 0) {
        promises.push(
          supabase
            .from('data_siswa')
            .update({ kelas_mengaji: null }) // Atau '-' sesuai standar DB, kita pakai null
            .in('id', toRemove)
        );
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);
        // Cek error dari hasil
        for (const res of results) {
           if (res.error) throw res.error;
        }
      }

      Swal.fire('Berhasil', 'Anggota kelas mengaji berhasil diperbarui.', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire('Gagal', `Terjadi kesalahan saat memperbarui data: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-primary p-5 rounded-t-2xl flex justify-between items-center shrink-0">
          <div>
             <h3 className="text-lg font-bold text-white flex items-center gap-2">
               <Users size={20} /> Anggota Kelas Mengaji: {kelasData?.nama_kelas}
             </h3>
             <p className="text-blue-200 text-xs mt-1">Centang siswa untuk memasukkannya ke kelas mengaji ini.</p>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white transition focus:outline-none">
            <X size={24} />
          </button>
        </div>

        {/* Tools (Pencarian, Filter, Sortir, & Ringkasan) */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-3 justify-between items-center shrink-0">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari nama, NIPD, kelas mengaji..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)} className="w-full md:w-36 py-2 px-3 border border-gray-300 rounded-lg outline-none text-sm bg-white focus:ring-2 focus:ring-primary">
              {uniqueClasses.map(kls => (
                <option key={kls} value={kls}>{kls === 'Semua' ? 'Semua Kelas' : kls}</option>
              ))}
            </select>
            
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full md:w-36 py-2 px-3 border border-gray-300 rounded-lg outline-none text-sm bg-white focus:ring-2 focus:ring-primary">
              <option value="nama-asc">Nama (A-Z)</option>
              <option value="nama-desc">Nama (Z-A)</option>
              <option value="nipd-asc">NIPD (Min-Max)</option>
              <option value="nipd-desc">NIPD (Max-Min)</option>
              <option value="kelas-asc">Kelas Mengaji (A-Z)</option>
              <option value="kelas-desc">Kelas Mengaji (Z-A)</option>
            </select>
          </div>

          <div className="text-sm font-semibold text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm whitespace-nowrap">
             Dicentang: <span className="text-primary">{checkedIds.size}</span>
          </div>
        </div>

        {/* Tabel Siswa */}
        <div className="overflow-y-auto flex-1 bg-white p-0 relative">
          {isLoading ? (
            <div className="p-10 text-center text-gray-500 font-medium">Memuat data siswa...</div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 w-16 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 cursor-pointer text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary"
                      checked={isAllFilteredChecked}
                      onChange={(e) => handleToggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-6 py-3">Nama Lengkap</th>
                  <th className="px-6 py-3">NIPD</th>
                  <th className="px-6 py-3">Kelas Saat Ini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSiswa.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-10 text-center text-gray-400">Tidak ada siswa yang sesuai pencarian.</td>
                  </tr>
                ) : (
                  filteredSiswa.map(siswa => {
                    const isChecked = checkedIds.has(siswa.id);
                    // Menandai jika siswa ini sudah ada di kelas lain yang bukan kelas ini
                    const isDifferentClass = siswa.kelas_mengaji && siswa.kelas_mengaji !== kelasData.nama_kelas;
                    
                    return (
                      <tr key={siswa.id} className={`hover:bg-blue-50 transition cursor-pointer ${isChecked ? 'bg-blue-50/50' : ''}`} onClick={() => handleCheckboxChange(siswa.id)}>
                        <td className="px-6 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 cursor-pointer text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary"
                            checked={isChecked}
                            onChange={() => handleCheckboxChange(siswa.id)}
                          />
                        </td>
                        <td className="px-6 py-3 font-semibold text-gray-800">{siswa.nama}</td>
                        <td className="px-6 py-3 text-gray-600">{siswa.nipd || '-'}</td>
                        <td className="px-6 py-3">
                          {siswa.kelas_mengaji === kelasData.nama_kelas ? (
                            <span className="text-green-600 font-bold bg-green-100 px-2 py-1 rounded-md text-xs">{siswa.kelas_mengaji} (Ini)</span>
                          ) : isDifferentClass ? (
                            <span className="text-orange-600 font-bold bg-orange-100 px-2 py-1 rounded-md text-xs">{siswa.kelas_mengaji}</span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Belum ada</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition text-sm font-medium text-gray-700">
            Batal
          </button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={isSaving || isLoading} 
            className="px-5 py-2.5 rounded-lg bg-primary text-white hover:bg-blue-900 transition text-sm font-bold shadow-md flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Menyimpan...' : <><Save size={18} /> Simpan Perubahan</>}
          </button>
        </div>

      </div>
    </div>
  );
}
