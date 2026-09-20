import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import { FileCheck, ShieldCheck, UserCheck, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import SignatureCanvas from './SignatureCanvas';

export default function CbtSopModal({ isOpen, onClose, onApproved, currentRole = 'guru' }) {
  const [loading, setLoading] = useState(false);
  const [guruList, setGuruList] = useState([]);
  const [dataLembaga, setDataLembaga] = useState(null);

  const [formData, setFormData] = useState({
    jenis_ujian: 'PSTS',
    tahun_ajaran: '2025/2026',
    semester: 'Ganjil',
    ketua_panitia_guru_id: '',
    sekretaris_guru_id: '',
    bendahara_guru_id: '',
    titimangsa_tempat: 'Compreng - Subang',
    titimangsa_tanggal: new Date().toISOString().split('T')[0],
    is_paham_sop: false,
  });

  const [signatureData, setSignatureData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
    }
  }, [isOpen]);

  const fetchInitialData = async () => {
    try {
      const [guruRes, lembagaRes, periodikRes] = await Promise.all([
        supabase.from('data_guru').select('id, nama').order('nama'),
        supabase.from('data_lembaga').select('*').limit(1).maybeSingle(),
        supabase.from('data_periodik').select('*').limit(1).maybeSingle(),
      ]);

      if (guruRes.data) setGuruList(guruRes.data);
      if (lembagaRes.data) {
        setDataLembaga(lembagaRes.data);
        if (lembagaRes.data.kecamatan && lembagaRes.data.kabupaten) {
          setFormData((prev) => ({
            ...prev,
            titimangsa_tempat: `${lembagaRes.data.kecamatan} - ${lembagaRes.data.kabupaten}`,
          }));
        }
      }
      if (periodikRes.data) {
        setFormData((prev) => ({
          ...prev,
          tahun_ajaran: periodikRes.data.tahun_ajaran || '2025/2026',
          semester: periodikRes.data.semester || 'Ganjil',
        }));
      }
    } catch (err) {
      console.error('Error loading initial SOP data:', err);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(formData.titimangsa_tanggal));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!signatureData) {
      Swal.fire('Tanda Tangan Diperlukan', 'Silakan goreskan tanda tangan digital Ketua Panitia / Penanggung Jawab.', 'warning');
      return;
    }
    if (!formData.is_paham_sop) {
      Swal.fire('Persetujuan Diperlukan', 'Anda harus mencentang persetujuan pemahaman SOP Ujian.', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Simpan SOP Persetujuan
      const { data: sop, error: sopErr } = await supabase
        .from('cbt_sop_persetujuan')
        .insert([
          {
            jenis_ujian: formData.jenis_ujian,
            tahun_ajaran: formData.tahun_ajaran,
            semester: formData.semester,
            tanda_tangan_ketua: signatureData,
            titimangsa_tempat: formData.titimangsa_tempat,
            titimangsa_tanggal: formData.titimangsa_tanggal,
            is_approved: true,
            approved_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (sopErr) throw sopErr;

      Swal.fire({
        icon: 'success',
        title: 'SOP & Tata Tertib Disetujui!',
        text: `Pelaksanaan ${formData.jenis_ujian} Tahun Ajaran ${formData.tahun_ajaran} resmi diaktifkan. Menu Penjadwalan & Pengawasan kini terbuka.`,
        confirmButtonColor: '#2a2c87',
      });

      if (onApproved) onApproved(sop);
      onClose();
    } catch (err) {
      console.error('Gagal menyimpan SOP:', err);
      Swal.fire('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2a2c87] to-[#1e1f5e] p-6 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
              <ShieldCheck className="w-8 h-8 text-[#85c226]" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Aktivasi SOP & Tata Tertib CBT</h3>
              <p className="text-xs text-blue-200 mt-1">
                Verifikasi digital kepanitiaan ujian SMP IT Hidayatul Mubtadi-ien
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Info Banner */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <strong>Perhatian Panitia:</strong> Sebelum jadwal dan pelaksanaan ujian dapat dimulai,
              Ketua Panitia Ujian wajib menentukan jenis ujian dan menandatangani SOP serta Tata Tertib
              Pelaksanaan Ujian CBT secara digital.
            </div>
          </div>

          {/* Konfigurasi Jenis Ujian */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Jenis Ujian</label>
              <select
                value={formData.jenis_ujian}
                onChange={(e) => setFormData({ ...formData, jenis_ujian: e.target.value })}
                className="w-full text-sm font-semibold border border-gray-300 rounded-xl p-2.5 bg-gray-50 focus:ring-2 focus:ring-[#2a2c87] focus:bg-white outline-none transition"
              >
                <option value="Tugas 1">Tugas 1</option>
                <option value="Tugas 2">Tugas 2</option>
                <option value="Tugas 3">Tugas 3</option>
                <option value="Tugas 4">Tugas 4</option>
                <option value="PSTS">PSTS (Sumatif Tengah Semester)</option>
                <option value="PSAS">PSAS (Sumatif Akhir Semester)</option>
                <option value="PSAT">PSAT (Sumatif Akhir Tahun)</option>
                <option value="PSAJ">PSAJ (Sumatif Akhir Jenjang)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Tahun Ajaran</label>
              <input
                type="text"
                value={formData.tahun_ajaran}
                onChange={(e) => setFormData({ ...formData, tahun_ajaran: e.target.value })}
                className="w-full text-sm font-semibold border border-gray-300 rounded-xl p-2.5 bg-gray-50 focus:ring-2 focus:ring-[#2a2c87] focus:bg-white outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full text-sm font-semibold border border-gray-300 rounded-xl p-2.5 bg-gray-50 focus:ring-2 focus:ring-[#2a2c87] focus:bg-white outline-none transition"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
          </div>

          {/* Susunan Panitia */}
          <div className="border border-gray-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={16} className="text-[#2a2c87]" /> Struktur Panitia Ujian
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Ketua Panitia *
                </label>
                <select
                  value={formData.ketua_panitia_guru_id}
                  onChange={(e) => setFormData({ ...formData, ketua_panitia_guru_id: e.target.value })}
                  className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2 bg-white"
                  required
                >
                  <option value="">-- Pilih Guru --</option>
                  {guruList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama || g.nama_guru}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Sekretaris
                </label>
                <select
                  value={formData.sekretaris_guru_id}
                  onChange={(e) => setFormData({ ...formData, sekretaris_guru_id: e.target.value })}
                  className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2 bg-white"
                >
                  <option value="">-- Pilih Guru --</option>
                  {guruList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama || g.nama_guru}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Bendahara
                </label>
                <select
                  value={formData.bendahara_guru_id}
                  onChange={(e) => setFormData({ ...formData, bendahara_guru_id: e.target.value })}
                  className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2 bg-white"
                >
                  <option value="">-- Pilih Guru --</option>
                  {guruList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama || g.nama_guru}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Ringkasan Tata Tertib & SOP Ujian */}
          <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <FileCheck size={16} className="text-[#85c226]" /> Ketentuan & Tata Tertib Ujian CBT
            </h4>
            <div className="text-xs text-gray-600 space-y-1.5 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p>1. Siswa wajib memindai QR Kartu Peserta dan mengaktifkan kamera depan untuk pengawasan Edge AI.</p>
              <p>2. Selama ujian berlangsung, pergerakan kepala (Yaw & Pitch) dan deteksi wajah dipantau secara otomatis oleh sistem.</p>
              <p>3. Peserta dilarang membuka tab lain, meminimalkan aplikasi, atau melakukan kecurangan dalam bentuk apapun.</p>
              <p>4. Pengawas berhak memberikan peringatan, menambah waktu teknis, atau memblokir sesi ujian yang melanggar SOP.</p>
              <p>5. Tombol selesai hanya dapat diaktifkan paling cepat 15 menit sebelum waktu ujian berakhir.</p>
            </div>
          </div>

          {/* Tanda Tangan Kanvas & Titimangsa */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-700">
                Tanda Tangan Digital Ketua Panitia / Penanggung Jawab *
              </label>
              <span className="text-[11px] text-gray-500 font-medium">
                {formData.titimangsa_tempat}, {formattedDate}
              </span>
            </div>
            <SignatureCanvas onSave={(data) => setSignatureData(data)} height={160} />
          </div>

          {/* Checkbox Konfirmasi SOP */}
          <label className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100/60 transition">
            <input
              type="checkbox"
              checked={formData.is_paham_sop}
              onChange={(e) => setFormData({ ...formData, is_paham_sop: e.target.checked })}
              className="mt-0.5 w-4 h-4 text-[#2a2c87] rounded border-gray-300 focus:ring-[#2a2c87]"
            />
            <span className="text-xs text-blue-950 font-semibold leading-normal">
              Saya memahami dan menyetujui seluruh SOP serta Tata Tertib Ujian CBT ini, serta bertanggung jawab penuh atas pelaksanaan ujian sesuai ketentuan sekolah.
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !formData.is_paham_sop || !signatureData}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#2a2c87] to-[#1e1f5e] hover:from-[#1e1f5e] hover:to-[#141544] text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <CheckCircle2 size={18} />
              {loading ? 'Menyimpan...' : 'Saya Memahami & Aktifkan Ujian'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
