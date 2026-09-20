import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import Swal from 'sweetalert2';
import { 
  Settings, 
  X, 
  Check, 
  Clock, 
  Camera, 
  ShieldAlert, 
  Eye, 
  Award, 
  AlertTriangle, 
  Save,
  HelpCircle
} from 'lucide-react';

export default function CbtPengaturanUjianModal({ isOpen, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    id: null,
    waktu_fleksibel: false,
    hentikan_timer: false,
    tampilkan_kamera: true,
    durasi_blokir_menit: 5,
    tampilkan_hasil: false,
    tampilkan_ranking: false,
    tampilkan_kesalahan: false,
    blokir_menengok: true,
    blokir_tekan_tombol: true,
    blokir_keluar_browser: true,
    tampilkan_tombol_selesai_menit: 15,
  });

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cbt_pengaturan_ujian')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSettings({
          id: data.id,
          waktu_fleksibel: !!data.waktu_fleksibel,
          hentikan_timer: !!data.hentikan_timer,
          tampilkan_kamera: data.tampilkan_kamera !== false,
          durasi_blokir_menit: data.durasi_blokir_menit || 5,
          tampilkan_hasil: !!data.tampilkan_hasil,
          tampilkan_ranking: !!data.tampilkan_ranking,
          tampilkan_kesalahan: !!data.tampilkan_kesalahan,
          blokir_menengok: data.blokir_menengok !== false,
          blokir_tekan_tombol: data.blokir_tekan_tombol !== false,
          blokir_keluar_browser: data.blokir_keluar_browser !== false,
          tampilkan_tombol_selesai_menit: data.tampilkan_tombol_selesai_menit ?? 15,
        });
      }
    } catch (e) {
      console.error('Error load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        waktu_fleksibel: settings.waktu_fleksibel,
        hentikan_timer: settings.hentikan_timer,
        tampilkan_kamera: settings.tampilkan_kamera,
        durasi_blokir_menit: parseInt(settings.durasi_blokir_menit, 10) || 5,
        tampilkan_hasil: settings.tampilkan_hasil,
        tampilkan_ranking: settings.tampilkan_ranking,
        tampilkan_kesalahan: settings.tampilkan_kesalahan,
        blokir_menengok: settings.blokir_menengok,
        blokir_tekan_tombol: settings.blokir_tekan_tombol,
        blokir_keluar_browser: settings.blokir_keluar_browser,
        tampilkan_tombol_selesai_menit: parseInt(settings.tampilkan_tombol_selesai_menit, 10) || 0,
        updated_at: new Date().toISOString()
      };

      if (settings.id) {
        const { error } = await supabase
          .from('cbt_pengaturan_ujian')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cbt_pengaturan_ujian')
          .insert([payload]);
        if (error) throw error;
      }

      Swal.fire({
        icon: 'success',
        title: 'Pengaturan Disimpan',
        text: 'Konfigurasi ujian CBT berhasil diperbarui.',
        timer: 1500,
        showConfirmButton: false
      });

      if (onSaved) onSaved(settings);
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'Gagal menyimpan pengaturan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-6 animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="p-5 bg-gradient-to-r from-primary to-blue-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Settings size={22} className="text-secondary" />
            </div>
            <div>
              <h3 className="font-bold text-base">Pengaturan Sistem Ujian CBT</h3>
              <p className="text-xs text-blue-200">Konfigurasi keamanan, timer, dan kebijakan ujian</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Konten Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Kelompok 1: Pengaturan Timer & Kamera */}
          <div>
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3 flex items-center gap-2">
              <Clock size={14} className="text-primary" /> Timer & Tampilan Pengawasan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Waktu Fleksibel */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-primary/40 bg-gray-50/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.waktu_fleksibel}
                  onChange={(e) => setSettings({ ...settings, waktu_fleksibel: e.target.checked })}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div>
                  <div className="text-xs font-bold text-gray-800">Waktu Fleksibel</div>
                  <div className="text-[11px] text-gray-500">Siswa dapat mulai kapan saja selama hari pelaksanaan</div>
                </div>
              </label>

              {/* Hentikan Timer */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-primary/40 bg-gray-50/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.hentikan_timer}
                  onChange={(e) => setSettings({ ...settings, hentikan_timer: e.target.checked })}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div>
                  <div className="text-xs font-bold text-gray-800">Hentikan Timer Ujian</div>
                  <div className="text-[11px] text-gray-500">Jeda countdown serentak untuk seluruh siswa</div>
                </div>
              </label>

              {/* Tampilkan Kamera */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-primary/40 bg-gray-50/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.tampilkan_kamera}
                  onChange={(e) => setSettings({ ...settings, tampilkan_kamera: e.target.checked })}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div>
                  <div className="text-xs font-bold text-gray-800">Tampilkan Kamera (Floating)</div>
                  <div className="text-[11px] text-gray-500">Preview kamera AI detector muncul di layar siswa</div>
                </div>
              </label>

              {/* Durasi Blokir */}
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between">
                <div className="text-xs font-bold text-gray-800 mb-1">Durasi Blokir Otomatis</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.durasi_blokir_menit}
                    onChange={(e) => setSettings({ ...settings, durasi_blokir_menit: e.target.value })}
                    className="w-20 px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-xs text-gray-600">Menit pembekuan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Kelompok 2: Toggle Pemblokiran Checklist */}
          <div>
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3 flex items-center gap-2">
              <ShieldAlert size={14} className="text-red-500" /> Detektor Pelanggaran & Pemblokiran
            </h4>
            <div className="space-y-2.5 bg-red-50/40 p-4 rounded-xl border border-red-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.blokir_menengok}
                  onChange={(e) => setSettings({ ...settings, blokir_menengok: e.target.checked })}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <span className="text-xs font-medium text-gray-800">
                  <strong>Menengok / Wajah Hilang:</strong> Pemicu blokir jika berpaling &gt; 25° berturut-turut
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.blokir_tekan_tombol}
                  onChange={(e) => setSettings({ ...settings, blokir_tekan_tombol: e.target.checked })}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <span className="text-xs font-medium text-gray-800">
                  <strong>Tekan Tombol Luar Ujian / Navigasi:</strong> Blokir saat menekan home, recent apps, atau tombol sistem
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.blokir_keluar_browser}
                  onChange={(e) => setSettings({ ...settings, blokir_keluar_browser: e.target.checked })}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <span className="text-xs font-medium text-gray-800">
                  <strong>Membuka Tab Lain / Keluar Browser:</strong> Blokir saat kehilangan fokus layar ujian
                </span>
              </label>
            </div>
          </div>

          {/* Kelompok 3: Transparansi Hasil & Time Picker Tombol Selesai */}
          <div>
            <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3 flex items-center gap-2">
              <Eye size={14} className="text-primary" /> Pengaturan Hasil & Tombol Selesai
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 bg-gray-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.tampilkan_hasil}
                  onChange={(e) => setSettings({ ...settings, tampilkan_hasil: e.target.checked })}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div>
                  <div className="text-xs font-bold text-gray-800">Tampilkan Hasil</div>
                  <div className="text-[10px] text-gray-500">Nilai langsung muncul usai submit</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 bg-gray-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.tampilkan_ranking}
                  onChange={(e) => setSettings({ ...settings, tampilkan_ranking: e.target.checked })}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div>
                  <div className="text-xs font-bold text-gray-800">Tampilkan Ranking</div>
                  <div className="text-[10px] text-gray-500">Peringkat kelas terlihat siswa</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 bg-gray-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.tampilkan_kesalahan}
                  onChange={(e) => setSettings({ ...settings, tampilkan_kesalahan: e.target.checked })}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div>
                  <div className="text-xs font-bold text-gray-800">Tampilkan Kesalahan</div>
                  <div className="text-[10px] text-gray-500">Nomor butir salah diperlihatkan</div>
                </div>
              </label>
            </div>

            {/* Time Picker Waktu Kemunculan Tombol Selesai */}
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Clock size={15} /> Kemunculan Tombol "Selesai" (Time Picker)
                </div>
                <div className="text-[11px] text-gray-600 mt-0.5">
                  Tentukan berapa menit sebelum ujian berakhir tombol 'Selesai' diizinkan aktif
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={settings.tampilkan_tombol_selesai_menit}
                  onChange={(e) => setSettings({ ...settings, tampilkan_tombol_selesai_menit: e.target.value })}
                  className="w-20 px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-center outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-xs font-semibold text-gray-700">Menit Terakhir</span>
              </div>
            </div>
          </div>

          {/* Tombol Footer */}
          <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-semibold text-xs transition"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-blue-900 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50"
            >
              <Save size={15} />
              <span>{saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
