import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { X, Save, Search, Users } from 'lucide-react';

export default function AnggotaEkskulModal({ isOpen, onClose, ekskulData }) {
  const [dataSiswa, setDataSiswa] = useState([]);
  const [filteredSiswa, setFilteredSiswa] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // State for selections and inputs
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [deskripsiData, setDeskripsiData] = useState({}); // { [siswa_id]: { predikat, deskripsi } }
  const [initialCheckedIds, setInitialCheckedIds] = useState(new Set()); // To compare what was added/removed

  const [searchTerm, setSearchTerm] = useState('');
  const [filterKelas, setFilterKelas] = useState('Semua');

  useEffect(() => {
    if (!isOpen || !ekskulData) return;
    
    const fetchSiswaAndAnggota = async () => {
      setIsLoading(true);
      try {
        // Fetch all active students
        const resSiswa = await supabase
          .from('data_siswa')
          .select('id, nama, nipd, kelas')
          .eq('status_keaktifan', 'Aktif')
          .neq('kelas', 'Calon Siswa')
          .order('nama', { ascending: true });

        if (resSiswa.error) throw resSiswa.error;
        const siswaData = resSiswa.data || [];
        setDataSiswa(siswaData);

        // Fetch existing members of this ekskul
        const resAnggota = await supabase
          .from('anggota_ekskul')
          .select('id, siswa_id, predikat, deskripsi')
          .eq('ekskul_id', ekskulData.id);

        if (resAnggota.error) throw resAnggota.error;
        
        const initialChecked = new Set();
        const initialDeskripsi = {};
        
        resAnggota.data?.forEach(anggota => {
          initialChecked.add(anggota.siswa_id);
          initialDeskripsi[anggota.siswa_id] = {
            predikat: anggota.predikat || '',
            deskripsi: anggota.deskripsi || ''
          };
        });
        
        setCheckedIds(initialChecked);
        setInitialCheckedIds(new Set(initialChecked));
        setDeskripsiData(initialDeskripsi);
        
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal', 'Gagal memuat data anggota.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSiswaAndAnggota();
    setSearchTerm('');
    setFilterKelas('Semua');
  }, [isOpen, ekskulData]);

  const uniqueClasses = ['Semua', ...new Set(dataSiswa.map(item => item.kelas).filter(Boolean))].sort();

  useEffect(() => {
    if (!dataSiswa) return;
    const lowerKeyword = searchTerm.toLowerCase();
    
    let filtered = dataSiswa.filter(s => {
      const matchSearch = (s.nama && s.nama.toLowerCase().includes(lowerKeyword)) ||
                          (s.nipd && s.nipd.toLowerCase().includes(lowerKeyword));
      const matchKelas = filterKelas === 'Semua' ? true : s.kelas === filterKelas;
      return matchSearch && matchKelas;
    });
    
    setFilteredSiswa(filtered);
  }, [searchTerm, filterKelas, dataSiswa]);

  const handleCheckboxChange = (id) => {
    const newChecked = new Set(checkedIds);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
      // Initialize description data if not exists
      if (!deskripsiData[id]) {
        setDeskripsiData(prev => ({ ...prev, [id]: { predikat: '', deskripsi: '' } }));
      }
    }
    setCheckedIds(newChecked);
  };

  const handleToggleAll = (checked) => {
    const newChecked = new Set(checkedIds);
    const newDeskripsi = { ...deskripsiData };
    
    if (checked) {
      filteredSiswa.forEach(s => {
        newChecked.add(s.id);
        if (!newDeskripsi[s.id]) {
          newDeskripsi[s.id] = { predikat: '', deskripsi: '' };
        }
      });
    } else {
      filteredSiswa.forEach(s => newChecked.delete(s.id));
    }
    setCheckedIds(newChecked);
    setDeskripsiData(newDeskripsi);
  };

  const handleInputChange = (siswaId, field, value) => {
    setDeskripsiData(prev => ({
      ...prev,
      [siswaId]: {
        ...prev[siswaId],
        [field]: value
      }
    }));
  };

  const isAllFilteredChecked = filteredSiswa.length > 0 && filteredSiswa.every(s => checkedIds.has(s.id));

  const handleSubmit = async () => {
    setIsSaving(true);
    
    try {
      const toAdd = Array.from(checkedIds).filter(id => !initialCheckedIds.has(id));
      const toRemove = Array.from(initialCheckedIds).filter(id => !checkedIds.has(id));
      const toUpdate = Array.from(checkedIds).filter(id => initialCheckedIds.has(id));

      const promises = [];

      // Remove members
      if (toRemove.length > 0) {
        promises.push(
          supabase
            .from('anggota_ekskul')
            .delete()
            .eq('ekskul_id', ekskulData.id)
            .in('siswa_id', toRemove)
        );
      }

      // Add new members
      if (toAdd.length > 0) {
        const payloadAdd = toAdd.map(id => ({
          ekskul_id: ekskulData.id,
          siswa_id: id,
          predikat: deskripsiData[id]?.predikat || '',
          deskripsi: deskripsiData[id]?.deskripsi || ''
        }));
        promises.push(
          supabase
            .from('anggota_ekskul')
            .insert(payloadAdd)
        );
      }

      // Update existing members
      // Supabase js tak mendukung batch update dengan values beda-beda secara mudah via .update().in().
      // Kita harus menggunakan upsert (jika punya constraint unik) atau update satu per satu.
      // Karena kita punya UNIQUE(ekskul_id, siswa_id), kita bisa pakai upsert!
      if (toUpdate.length > 0) {
        const payloadUpdate = toUpdate.map(id => ({
          ekskul_id: ekskulData.id,
          siswa_id: id,
          predikat: deskripsiData[id]?.predikat || '',
          deskripsi: deskripsiData[id]?.deskripsi || ''
        }));
        promises.push(
          supabase
            .from('anggota_ekskul')
            .upsert(payloadUpdate, { onConflict: 'ekskul_id,siswa_id' })
        );
      }

      await Promise.all(promises);

      Swal.fire({
        icon: 'success',
        title: 'Tersimpan',
        text: 'Data anggota dan deskripsi berhasil diperbarui.',
        timer: 1500,
        showConfirmButton: false
      });
      
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan data anggota.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[#2a2c87] flex items-center gap-2">
              <Users className="text-[#85c226]" size={24} />
              Kelola Anggota Ekskul
            </h2>
            <p className="text-gray-500 text-sm mt-1 font-medium">
              Ekskul: <span className="font-bold text-[#2a2c87]">{ekskulData?.nama_ekskul}</span> 
              &nbsp;|&nbsp; TA: {ekskulData?.tahun_ajaran} ({ekskulData?.semester})
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-white border-b border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cari nama atau NIPD siswa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:outline-none text-sm"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:outline-none text-sm"
            >
              {uniqueClasses.map(k => (
                <option key={k} value={k}>{k === 'Semua' ? 'Semua Kelas' : `Kelas ${k}`}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto bg-gray-50/30">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredChecked}
                    onChange={(e) => handleToggleAll(e.target.checked)}
                    className="w-4 h-4 text-[#85c226] rounded focus:ring-[#85c226] cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Nama Siswa</th>
                <th className="px-4 py-3 w-28">Predikat</th>
                <th className="px-4 py-3">Deskripsi / Capaian Kompetensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#85c226] mb-3"></div>
                      Memuat data siswa...
                    </div>
                  </td>
                </tr>
              ) : filteredSiswa.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-12 text-gray-400 font-medium">
                    {searchTerm || filterKelas !== 'Semua' ? 'Siswa tidak ditemukan.' : 'Belum ada data siswa aktif.'}
                  </td>
                </tr>
              ) : (
                filteredSiswa.map((siswa) => {
                  const isChecked = checkedIds.has(siswa.id);
                  return (
                    <tr 
                      key={siswa.id} 
                      className={`hover:bg-blue-50/50 transition-colors ${isChecked ? 'bg-[#85c226]/5' : 'bg-white'}`}
                    >
                      <td className="px-4 py-3 text-center border-r border-gray-100">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxChange(siswa.id)}
                          className="w-4 h-4 text-[#85c226] rounded focus:ring-[#85c226] cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-800">{siswa.nama}</div>
                        <div className="text-xs text-gray-500 mt-0.5">NIPD: {siswa.nipd || '-'} | Kelas: <span className="font-semibold">{siswa.kelas || '-'}</span></div>
                      </td>
                      <td className="px-4 py-3">
                        {isChecked && (
                          <select 
                            value={deskripsiData[siswa.id]?.predikat || ''} 
                            onChange={(e) => handleInputChange(siswa.id, 'predikat', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226]"
                          >
                            <option value="">- Pilih -</option>
                            <option value="Sangat Baik">Sangat Baik (A)</option>
                            <option value="Baik">Baik (B)</option>
                            <option value="Cukup">Cukup (C)</option>
                            <option value="Kurang">Kurang (D)</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isChecked && (
                          <input 
                            type="text"
                            value={deskripsiData[siswa.id]?.deskripsi || ''} 
                            onChange={(e) => handleInputChange(siswa.id, 'deskripsi', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226]"
                            placeholder="Contoh: Menguasai teknik dasar kepramukaan dengan baik"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          <div className="text-sm font-medium text-gray-600">
            <span className="font-bold text-[#2a2c87]">{checkedIds.size}</span> siswa dipilih
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#2a2c87] text-white rounded-xl hover:bg-blue-900 font-bold transition-colors flex items-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {isSaving ? 'Menyimpan...' : 'Simpan Anggota'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
