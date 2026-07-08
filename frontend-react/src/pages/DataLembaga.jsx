import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Building2, Save, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

export default function DataLembaga() {
  const [data, setData] = useState({
    id: null,
    nama_lembaga: '',
    npsn: '',
    alamat: '',
    kepala_sekolah: '',
    nip_kepsek: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: lembagaData, error } = await supabase
        .from('data_lembaga')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (lembagaData) {
        setData(lembagaData);
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data identitas lembaga' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (data.id) {
        // Update
        const { error } = await supabase
          .from('data_lembaga')
          .update({
            nama_lembaga: data.nama_lembaga,
            npsn: data.npsn,
            alamat: data.alamat,
            kepala_sekolah: data.kepala_sekolah,
            nip_kepsek: data.nip_kepsek
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        // Insert
        const { data: insertedData, error } = await supabase
          .from('data_lembaga')
          .insert([{
            nama_lembaga: data.nama_lembaga,
            npsn: data.npsn,
            alamat: data.alamat,
            kepala_sekolah: data.kepala_sekolah,
            nip_kepsek: data.nip_kepsek
          }])
          .select();
        if (error) throw error;
        if (insertedData && insertedData.length > 0) {
          setData(insertedData[0]);
        }
      }
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Data identitas lembaga berhasil disimpan', timer: 1500, showConfirmButton: false });
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menyimpan data lembaga' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Building2 className="text-primary" /> Identitas Lembaga
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola data profil, alamat, dan legalitas sekolah.</p>
        </div>
        <div>
          <button onClick={fetchData} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-50 transition flex items-center gap-2 text-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6 max-w-3xl">
        {isLoading ? (
          <div className="py-10 text-center text-gray-400">Memuat data...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nama Lembaga / Sekolah</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                placeholder="Misal: SMA Negeri 1 Jakarta"
                value={data.nama_lembaga}
                onChange={(e) => setData({...data, nama_lembaga: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">NPSN (Nomor Pokok Sekolah Nasional)</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                placeholder="Misal: 10123456"
                value={data.npsn}
                onChange={(e) => setData({...data, npsn: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Alamat Lengkap</label>
              <textarea 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                placeholder="Misal: Jl. Pendidikan No. 1, Jakarta Selatan..."
                rows="3"
                value={data.alamat}
                onChange={(e) => setData({...data, alamat: e.target.value})}
              ></textarea>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Nama Kepala Sekolah</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  placeholder="Misal: Budi Santoso, S.Pd., M.Pd."
                  value={data.kepala_sekolah}
                  onChange={(e) => setData({...data, kepala_sekolah: e.target.value})}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">NIP Kepala Sekolah</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  placeholder="Misal: 19800101 200501 1 001"
                  value={data.nip_kepsek}
                  onChange={(e) => setData({...data, nip_kepsek: e.target.value})}
                />
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-100 mt-6 flex justify-end">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-primary hover:bg-blue-900 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2 text-sm"
              >
                <Save size={16} /> {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
