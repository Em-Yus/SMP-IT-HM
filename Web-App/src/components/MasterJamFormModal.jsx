import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';

export default function MasterJamFormModal({ isOpen, onClose, data, onSuccess }) {
  const [formData, setFormData] = useState({
    nama_jam: '',
    waktu_mulai: '',
    waktu_selesai: '',
    urutan: '',
    is_istirahat: false
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (data) {
        setFormData({
          nama_jam: data.nama_jam || '',
          waktu_mulai: (data.waktu_mulai || '').substring(0, 5),
          waktu_selesai: (data.waktu_selesai || '').substring(0, 5),
          urutan: data.urutan || '',
          is_istirahat: data.is_istirahat || false
        });
      } else {
        setFormData({ nama_jam: '', waktu_mulai: '', waktu_selesai: '', urutan: '', is_istirahat: false });
      }
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nama_jam || !formData.waktu_mulai || !formData.waktu_selesai || formData.urutan === '') {
      Swal.fire('Error', 'Semua kolom wajib diisi.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nama_jam: formData.nama_jam,
        waktu_mulai: formData.waktu_mulai + ':00',
        waktu_selesai: formData.waktu_selesai + ':00',
        urutan: parseInt(formData.urutan),
        is_istirahat: formData.is_istirahat
      };

      if (data && data.id) {
        const { error } = await supabase.from('master_jam').update(payload).eq('id', data.id);
        if (error) throw error;

        // Sinkronisasi otomatis ke jadwal_pelajaran yang menggunakan master_jam ini
        await supabase.from('jadwal_pelajaran').update({
          jam_ke: formData.nama_jam,
          waktu: `${formData.waktu_mulai} - ${formData.waktu_selesai}`,
          is_istirahat: formData.is_istirahat
        }).eq('master_jam_id', data.id);

        Swal.fire('Berhasil', 'Data jam dan jadwal terkait berhasil diperbarui', 'success');
      } else {
        const { error } = await supabase.from('master_jam').insert([payload]);
        if (error) throw error;
        Swal.fire('Berhasil', 'Data jam berhasil ditambahkan', 'success');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire('Gagal', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="bg-primary px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">{data ? 'Edit Jam' : 'Tambah Jam Baru'}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nama Jam <span className="text-red-500">*</span></label>
              <input type="text" value={formData.nama_jam} onChange={e => setFormData({...formData, nama_jam: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226]" placeholder="Contoh: Ke-1 / Istirahat 1" required />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Waktu Mulai <span className="text-red-500">*</span></label>
                <input type="time" value={formData.waktu_mulai} onChange={e => setFormData({...formData, waktu_mulai: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226]" required />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Waktu Selesai <span className="text-red-500">*</span></label>
                <input type="time" value={formData.waktu_selesai} onChange={e => setFormData({...formData, waktu_selesai: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226]" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Urutan Tampil (Angka) <span className="text-red-500">*</span></label>
              <input type="number" value={formData.urutan} onChange={e => setFormData({...formData, urutan: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226]" placeholder="Contoh: 1, 2, 3..." required />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="is_istirahat" checked={formData.is_istirahat} onChange={e => setFormData({...formData, is_istirahat: e.target.checked})} className="w-5 h-5 text-[#85c226] rounded border-gray-300 focus:ring-[#85c226]" />
              <label htmlFor="is_istirahat" className="font-bold text-gray-700">Tandai sebagai Waktu Istirahat</label>
            </div>
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Batal</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-blue-900 rounded-xl">{isSaving ? 'Menyimpan...' : 'Simpan Data'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
