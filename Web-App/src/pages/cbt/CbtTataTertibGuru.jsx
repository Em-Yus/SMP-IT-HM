import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import KopSurat from '../../components/KopSurat';
import { 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle,
  Clock,
  Award
} from 'lucide-react';

export default function CbtTataTertibGuru() {
  const navigate = useNavigate();

  const [dataLembaga, setDataLembaga] = useState(null);
  const [panitiaData, setPanitiaData] = useState(null);
  const [sopData, setSopData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTataTertib();
  }, []);

  const loadTataTertib = async () => {
    try {
      setLoading(true);
      // 1. Ambil Data Lembaga
      const { data: lembaga } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      setDataLembaga(lembaga);

      // 2. Ambil Ketua Panitia dari Data Pegawai (jabatan_guru)
      const { data: listGuruJabatan } = await supabase
        .from('jabatan_guru')
        .select('guru_id, jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3, guru:guru_id(id, nama, nip)');

      const foundKetua = (listGuruJabatan || []).find(jg => {
        const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
        return jRoles.some(r => (r || '').toLowerCase().includes('ketua panitia'));
      });

      if (foundKetua) {
        setPanitiaData({ ketua: foundKetua.guru });
      }

      // 3. Ambil Persetujuan Tata Tertib oleh Ketua Panitia
      const { data: sop } = await supabase
        .from('cbt_sop_persetujuan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSopData(sop);
    } catch (err) {
      console.error('Error load tata tertib:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateIndonesia = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const ketuaNama = panitiaData?.ketua?.nama || 'Ketua Panitia';
  const ketuaNip = panitiaData?.ketua?.nip ? `NIP. ${panitiaData.ketua.nip}` : '';
  const titimangsaTempat = sopData?.titimangsa_tempat || (dataLembaga?.kecamatan ? `Kec. ${dataLembaga.kecamatan}` : 'Compreng');
  const titimangsaTanggal = sopData?.titimangsa_tanggal || sopData?.tanggal_pelaksanaan_mulai;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Header Info Banner */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <FileText className="text-primary" /> Tata Tertib Ujian CBT
          </div>
          <p className="text-gray-500 text-xs mt-1">
            Harap membaca seluruh tata tertib pelaksanaan ujian sebelum melanjutkan ke lembar SOP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Disahkan Ketua Panitia
          </span>
        </div>
      </div>

      {/* Dokumen Resmi Kertas */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 sm:p-12 text-gray-800 font-serif leading-relaxed">
        {/* Kop Surat */}
        <KopSurat dataLembaga={dataLembaga} />

        {/* Judul Dokumen */}
        <div className="text-center my-6">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-black underline">
            TATA TERTIB PELAKSANAAN UJIAN BERBASIS KOMPUTER (CBT)
          </h2>
          <p className="text-xs sm:text-sm font-bold uppercase text-gray-700 mt-1">
            PENILAIAN {sopData?.jenis_ujian ? sopData.jenis_ujian.toUpperCase() : 'CBT'} TAHUN AJARAN {panitiaData?.tahun_ajaran || '2025/2026'}
          </p>
        </div>

        {/* Isi Tata Tertib */}
        <div className="space-y-4 text-xs sm:text-[13px] text-justify font-sans leading-relaxed text-gray-700">
          <div>
            <h4 className="font-bold text-gray-900 mb-1">A. KETENTUAN UMUM GURU MAPEL & PENGAWAS</h4>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Guru Pengampu Mata Pelajaran wajib memastikan Bank Soal telah diverifikasi dan siap sebelum jadwal ujian dimulai.</li>
              <li>Pengawas ruang wajib mengaktifkan sistem CBT dan memantau jalannya pengawasan real-time melalui Edge AI Proctoring.</li>
              <li>Pengawas wajib memastikan seluruh peserta memindai kartu ujian atau melakukan autentikasi wajah sebelum mengerjakan soal.</li>
              <li>Dilarang memberikan bantuan dalam bentuk jawaban soal kepada peserta ujian selama waktu ujian berlangsung.</li>
            </ol>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-1">B. KETENTUAN PESERTA UJIAN</h4>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Peserta hadir di ruang ujian tepat waktu sesuai jadwal yang telah ditentukan.</li>
              <li>Peserta wajib menjaga posisi wajah tetap terdeteksi oleh kamera depan (AI Face Tracking).</li>
              <li>Sistem AI akan mendeteksi pelanggaran berupa gerakan menengok (yaw &gt; 25°), menunduk/menengadah berlebih (pitch), atau berpindah aplikasi/tab.</li>
              <li>Pelanggaran berturut-turut akan memicu pembekuan atau pemblokiran sesi ujian oleh pengawas.</li>
            </ol>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-1">C. AKHIR PELAKSANAAN UJIAN</h4>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Pengawas memvalidasi kehadiran peserta pada sistem dan mencetak Daftar Hadir Peserta per mata pelajaran.</li>
              <li>Guru Mapel melakukan rekapitulasi nilai dan verifikasi soal esai atau isian otomatis dari AI.</li>
              <li>Pada akhir seluruh rangkaian hari ujian, Ketua Panitia bersama Kepala Sekolah mengesahkan Daftar Hadir Pengawas dan Berita Acara Ujian.</li>
            </ol>
          </div>
        </div>

        {/* Kolom Pengesahan TTD Ketua Panitia di Kanan Bawah */}
        <div className="mt-12 flex justify-end font-sans">
          <div className="text-center min-w-[240px]">
            <p className="text-xs text-gray-700">
              {titimangsaTempat}, {formatDateIndonesia(titimangsaTanggal) || formatDateIndonesia(new Date())}
            </p>
            <p className="text-xs font-bold text-gray-900 mt-1">
              Ketua Panitia Ujian,
            </p>

            <div className="h-28 flex items-center justify-center my-1">
              {sopData?.tanda_tangan_ketua ? (
                <img 
                  src={sopData.tanda_tangan_ketua} 
                  alt="Tanda Tangan Ketua Panitia" 
                  className="max-h-24 max-w-[200px] object-contain"
                />
              ) : (
                <div className="border border-dashed border-gray-300 rounded-lg p-3 text-[11px] text-gray-400">
                  Tanda Tangan Digital Disahkan
                </div>
              )}
            </div>

            <p className="text-xs font-bold text-gray-900 underline uppercase tracking-wide">
              {ketuaNama}
            </p>
            {ketuaNip && <p className="text-[11px] text-gray-600">{ketuaNip}</p>}
          </div>
        </div>
      </div>

      {/* Tombol Selanjutnya di Bagian Bawah */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={() => navigate('/cbt/sop-ujian')}
          className="flex items-center gap-2.5 px-8 py-3.5 bg-primary hover:bg-blue-900 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 text-sm"
        >
          <span>Selanjutnya: Menuju Halaman SOP Ujian</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
