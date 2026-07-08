import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { X, Save } from 'lucide-react';

export default function KelasFormModal({ isOpen, onClose, kelasData, onSuccess }) {
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [guruList, setGuruList] = useState([]);
  const [ruangList, setRuangList] = useState([]);

  useEffect(() => {
    const fetchMasterData = async () => {
      const [resGuru, resRuang] = await Promise.all([
        supabase.from('data_guru').select('nama').is('tanggal_keluar', null).order('nama'),
        supabase.from('data_ruang').select('id, nama_ruang').order('nama_ruang')
      ]);
      if (resGuru.data) setGuruList(resGuru.data);
      if (resRuang.data) setRuangList(resRuang.data);
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
      const pk = dataToSave.id || dataToSave.id_kelas || dataToSave.nama_kelas;
      delete dataToSave.id;
      delete dataToSave.id_kelas;
      
      // Pastikan tingkat adalah integer jika ada
      if (dataToSave.tingkat) {
        dataToSave.tingkat = parseInt(dataToSave.tingkat, 10);
      }

      // Hapus kolom yang tidak boleh di-update atau merupakan hasil join
      delete dataToSave.created_at;
      delete dataToSave.data_ruang;

      if (kelasData && pk) {
        let query = supabase.from('data_kelas').update(dataToSave);
        
        if (kelasData.id) query = query.eq('id', kelasData.id);
        else if (kelasData.id_kelas) query = query.eq('id_kelas', kelasData.id_kelas);
        else query = query.eq('nama_kelas', kelasData.nama_kelas);

        // Tambahkan .select() agar kita tahu apakah baris benar-benar di-update
        const { data, error } = await query.select();

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Izin akses ditolak oleh RLS Supabase. Pastikan Anda telah mengaktifkan kebijakan UPDATE di tabel data_kelas.");
        }
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data kelas diperbarui!', timer: 1500 });
      } else {
        const { data, error } = await supabase
          .from('data_kelas')
          .insert([dataToSave])
          .select();

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Izin akses ditolak oleh RLS Supabase. Pastikan Anda telah mengaktifkan kebijakan INSERT di tabel data_kelas.");
        }
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Kelas baru ditambahkan!', timer: 1500 });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-lg text-primary">{(kelasData && (kelasData.id || kelasData.id_kelas)) ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          <form id="kelasForm" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Nama Kelas <span className="text-red-500">*</span></label>
              <input required type="text" name="nama_kelas" value={formData.nama_kelas || ''} onChange={handleChange} placeholder="Contoh: VII-A" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Tingkat (Angka)</label>
              <input type="number" name="tingkat" value={formData.tingkat || ''} onChange={handleChange} placeholder="Contoh: 7, 8, 9" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Nama Wali Kelas</label>
              <select name="wali_kelas_nama" value={formData.wali_kelas_nama || ''} onChange={handleChange} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white">
                <option value="">-- Pilih Wali Kelas --</option>
                {guruList.map((guru, idx) => (
                  <option key={idx} value={guru.nama}>{guru.nama}</option>
                ))}
              </select>
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
          <button type="submit" form="kelasForm" disabled={isSaving} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-900 font-medium transition flex items-center gap-2">
            {isSaving ? 'Menyimpan...' : <><Save size={18} /> Simpan</>}
          </button>
        </div>
      </div>
    </div>
  );
}
