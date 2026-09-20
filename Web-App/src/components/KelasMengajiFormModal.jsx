import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { X, Save } from 'lucide-react';

export default function KelasMengajiFormModal({ isOpen, onClose, kelasData, onSuccess }) {
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [ruangList, setRuangList] = useState([]);

  useEffect(() => {
    const fetchMasterData = async () => {
      const { data } = await supabase.from('data_ruang').select('id, nama_ruang').order('nama_ruang');
      if (data) setRuangList(data);
    };
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (kelasData) {
      setFormData({ ...kelasData });
    } else {
      setFormData({});
    }
  }, [kelasData, isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const dataToSave = { ...formData };
      const pk = dataToSave.id;
      delete dataToSave.id;
      
      // Pastikan tingkat adalah integer jika ada
      if (dataToSave.tingkat) {
        dataToSave.tingkat = parseInt(dataToSave.tingkat, 10);
      }

      // Hapus kolom yang tidak boleh di-update atau merupakan hasil join
      delete dataToSave.created_at;
      delete dataToSave.data_ruang;

      if (kelasData && pk) {
        let query = supabase.from('data_kelas_mengaji').update(dataToSave).eq('id', pk);
        const { error } = await query;
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data kelas mengaji berhasil diperbarui', timer: 1500, showConfirmButton: false });
      } else {
        const { error } = await supabase.from('data_kelas_mengaji').insert([dataToSave]);
        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Kelas mengaji baru berhasil ditambahkan', timer: 1500, showConfirmButton: false });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat menyimpan data.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-gray-800 text-lg">
            {kelasData ? 'Edit Kelas Mengaji' : 'Tambah Kelas Mengaji'}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          <form id="kelasMengajiForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Nama Kelas <span className="text-red-500">*</span></label>
              <input required type="text" name="nama_kelas" value={formData.nama_kelas || ''} onChange={handleChange} placeholder="Contoh: Tahsin A" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Tingkat (Angka)</label>
              <input type="number" name="tingkat" value={formData.tingkat || ''} onChange={handleChange} placeholder="Contoh: 1, 2, 3" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Nama Guru Pengajar</label>
              <input type="text" name="guru_pengajar" value={formData.guru_pengajar || ''} onChange={handleChange} placeholder="Contoh: Ustadz Ahmad" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Ruang Kelas</label>
              <select name="ruang_id" value={formData.ruang_id || ''} onChange={handleChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white">
                <option value="">-- Pilih Ruang --</option>
                {ruangList.map((ruang, idx) => (
                  <option key={idx} value={ruang.id}>{ruang.nama_ruang}</option>
                ))}
              </select>
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition">
            Batal
          </button>
          <button type="submit" form="kelasMengajiForm" disabled={isSaving} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-900 font-medium transition flex items-center gap-2">
            {isSaving ? 'Menyimpan...' : <><Save size={18} /> Simpan</>}
          </button>
        </div>
      </div>
    </div>
  );
}
