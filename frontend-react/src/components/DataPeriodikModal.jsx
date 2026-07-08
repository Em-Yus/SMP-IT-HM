import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { X, Save } from 'lucide-react';

export default function DataPeriodikModal({ isOpen, onClose, periodikData, siswaId, namaSiswa, tahunAjaran, semester, onSuccess }) {
  const [formData, setFormData] = useState({
    tinggi_badan: '',
    berat_badan: '',
    kondisi_mata: '',
    kondisi_telinga: '',
    gigi: '',
    kecakapan: '',
    lain_lain: '',
    catatan: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (periodikData) {
      setFormData({ 
        tinggi_badan: periodikData.tinggi_badan || '',
        berat_badan: periodikData.berat_badan || '',
        kondisi_mata: periodikData.kondisi_mata || '',
        kondisi_telinga: periodikData.kondisi_telinga || '',
        gigi: periodikData.gigi || '',
        kecakapan: periodikData.kecakapan || '',
        lain_lain: periodikData.lain_lain || ''
      });
    } else {
      setFormData({
        tinggi_badan: '',
        berat_badan: '',
        kondisi_mata: '',
        kondisi_telinga: '',
        gigi: '',
        kecakapan: '',
        lain_lain: ''
      });
    }
  }, [periodikData, isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const dataToSave = { 
        id_siswa: siswaId,
        tahun_ajaran: tahunAjaran,
        semester: semester,
        tinggi_badan: formData.tinggi_badan ? parseFloat(formData.tinggi_badan) : null,
        berat_badan: formData.berat_badan ? parseFloat(formData.berat_badan) : null,
        kondisi_mata: formData.kondisi_mata,
        kondisi_telinga: formData.kondisi_telinga,
        gigi: formData.gigi,
        kecakapan: formData.kecakapan,
        lain_lain: formData.lain_lain
      };

      if (periodikData && periodikData.id) {
        const { error } = await supabase
          .from('data_periodik')
          .update(dataToSave)
          .eq('id', periodikData.id);

        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data periodik diperbarui!', timer: 1500 });
      } else {
        const { error } = await supabase
          .from('data_periodik')
          .insert([dataToSave]);

        if (error) throw error;
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data periodik ditambahkan!', timer: 1500 });
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-primary">Data Periodik Siswa</h3>
            <p className="text-xs text-gray-500">{namaSiswa} • {tahunAjaran} • {semester}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          <form id="periodikForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tinggi Badan (cm)</label>
                <input type="number" step="0.1" name="tinggi_badan" value={formData.tinggi_badan} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none" placeholder="Misal: 150.5" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Berat Badan (kg)</label>
                <input type="number" step="0.1" name="berat_badan" value={formData.berat_badan} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none" placeholder="Misal: 45.2" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kondisi Mata</label>
                <select name="kondisi_mata" value={formData.kondisi_mata} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none">
                  <option value="">-- Pilih --</option>
                  <option value="Normal">Normal</option>
                  <option value="Minus">Minus</option>
                  <option value="Plus">Plus</option>
                  <option value="Silinder">Silinder</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kondisi Telinga</label>
                <select name="kondisi_telinga" value={formData.kondisi_telinga} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none">
                  <option value="">-- Pilih --</option>
                  <option value="Normal / Bersih">Normal / Bersih</option>
                  <option value="Gangguan Pendengaran">Gangguan Pendengaran</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kesehatan Gigi</label>
                <select name="gigi" value={formData.gigi} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none">
                  <option value="">-- Pilih --</option>
                  <option value="Normal / Bersih">Normal / Bersih</option>
                  <option value="Berlubang">Berlubang</option>
                  <option value="Karang Gigi">Karang Gigi</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kecakapan Jasmani</label>
                <select name="kecakapan" value={formData.kecakapan} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none">
                  <option value="">-- Pilih --</option>
                  <option value="Sangat Baik">Sangat Baik</option>
                  <option value="Baik">Baik</option>
                  <option value="Cukup">Cukup</option>
                  <option value="Kurang">Kurang</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Kekebalan Tubuh</label>
                <select name="lain_lain" value={formData.lain_lain} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none">
                  <option value="">-- Pilih --</option>
                  <option value="Sangat Baik">Sangat Baik</option>
                  <option value="Baik">Baik</option>
                  <option value="Cukup">Cukup</option>
                  <option value="Rentan Sakit">Rentan Sakit</option>
                </select>
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium text-sm">
            Batal
          </button>
          <button 
            type="submit" 
            form="periodikForm" 
            disabled={isSaving}
            className="bg-primary hover:bg-blue-900 text-white px-5 py-2 rounded-lg font-medium transition flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan...' : <><Save size={16} /> Simpan Data</>}
          </button>
        </div>
      </div>
    </div>
  );
}
