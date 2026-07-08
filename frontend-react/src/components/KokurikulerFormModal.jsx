import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { X, Save, BookOpen } from 'lucide-react';
import Swal from 'sweetalert2';

export default function KokurikulerFormModal({ isOpen, onClose, onSuccess, initialData }) {
  const [formData, setFormData] = useState({
    nama_projek: '',
    tema: 'Gaya Hidup Berkelanjutan',
    koordinator_nama: '',
    deskripsi_projek: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          nama_projek: initialData.nama_projek || '',
          tema: initialData.tema || 'Gaya Hidup Berkelanjutan',
          koordinator_nama: initialData.koordinator_nama || '',
          deskripsi_projek: initialData.deskripsi_projek || ''
        });
      } else {
        setFormData({
          nama_projek: '',
          tema: 'Gaya Hidup Berkelanjutan',
          koordinator_nama: '',
          deskripsi_projek: ''
        });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const toProperCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (['nama_projek', 'koordinator_nama', 'deskripsi_projek'].includes(name)) {
      setFormData({ ...formData, [name]: toProperCase(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      // Dapatkan tahun ajaran dan semester aktif saat ini
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      let ta = currentMonth >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
      let sem = currentMonth >= 7 ? 'Ganjil' : 'Genap';

      const payload = {
        nama_projek: formData.nama_projek,
        tema: formData.tema,
        koordinator_nama: formData.koordinator_nama,
        deskripsi_projek: formData.deskripsi_projek,
        tahun_ajaran: initialData ? initialData.tahun_ajaran : ta,
        semester: initialData ? initialData.semester : sem
      };

      if (initialData) {
        const { error } = await supabase.from('data_kokurikuler').update(payload).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('data_kokurikuler').insert([payload]);
        if (error) throw error;
      }

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data projek kokurikuler disimpan.' });
      onSuccess();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold text-[#2a2c87] flex items-center gap-2">
            <BookOpen className="text-[#85c226]" size={24} />
            {initialData ? 'Edit Projek P5' : 'Tambah Projek P5'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Nama Projek <span className="text-red-500">*</span></label>
            <input type="text" name="nama_projek" required value={formData.nama_projek} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="Contoh: Membuat Kompos Organik" />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Tema Projek (P5) <span className="text-red-500">*</span></label>
            <select name="tema" required value={formData.tema} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm">
              <option value="Gaya Hidup Berkelanjutan">Gaya Hidup Berkelanjutan</option>
              <option value="Kearifan Lokal">Kearifan Lokal</option>
              <option value="Bhinneka Tunggal Ika">Bhinneka Tunggal Ika</option>
              <option value="Bangunlah Jiwa dan Raganya">Bangunlah Jiwa dan Raganya</option>
              <option value="Suara Demokrasi">Suara Demokrasi</option>
              <option value="Berekayasa dan Berteknologi untuk Membangun NKRI">Berekayasa dan Berteknologi untuk Membangun NKRI</option>
              <option value="Kewirausahaan">Kewirausahaan</option>
              <option value="Kebekerjaan">Kebekerjaan</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Koordinator Fasilitator</label>
            <input type="text" name="koordinator_nama" value={formData.koordinator_nama} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="Nama Guru Koordinator" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Deskripsi / Tujuan Projek</label>
            <textarea name="deskripsi_projek" rows="3" value={formData.deskripsi_projek} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" placeholder="Deskripsi singkat tentang projek ini..."></textarea>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#2a2c87] hover:bg-blue-900 shadow-lg flex items-center gap-2 transition disabled:opacity-70">
              <Save size={18} /> Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
