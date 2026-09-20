import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import KopSurat from '../../components/KopSurat';
import SignatureCanvas from '../../components/cbt/SignatureCanvas';
import { 
  ShieldCheck, 
  Calendar, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  X, 
  Check, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import Swal from 'sweetalert2';

const JENIS_UJIAN_OPTIONS = [
  'Tugas 1', 'Tugas 2', 'Tugas 3', 'Tugas 4', 
  'PSTS', 'PSAS', 'PSAT', 'PSAJ'
];

export default function CbtTataTertibPengawas() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [dataLembaga, setDataLembaga] = useState(null);
  const [panitiaData, setPanitiaData] = useState(null);
  const [sopData, setSopData] = useState(null);

  // Alur Pemilihan Jenis Ujian
  const [showJenisModal, setShowJenisModal] = useState(false);
  const [jenisUjian, setJenisUjian] = useState('');

  // Alur Penandatanganan
  const [showTtdModal, setShowTtdModal] = useState(false);
  const [tanggalUjian, setTanggalUjian] = useState(new Date().toISOString().split('T')[0]);
  const [tempTtd, setTempTtd] = useState('');
  
  // Status Setelah Klik Oke
  const [isApprovedLocal, setIsApprovedLocal] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [titimangsaStr, setTitimangsaStr] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    try {
      setLoading(true);
      const userSession = localStorage.getItem('user_guru');
      if (!userSession) {
        navigate('/login-guru');
        return;
      }
      const userObj = JSON.parse(userSession);
      setCurrentUser(userObj);

      // 1. Ambil Data Lembaga untuk Kop & Titimangsa
      const { data: lembaga } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      setDataLembaga(lembaga);

      // 2. Cek Ketua Panitia LANGSUNG dari Data Pegawai (jabatan_guru)
      const { data: listGuruJabatan } = await supabase
        .from('jabatan_guru')
        .select('guru_id, jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3, guru:guru_id(id, nama)');

      const foundKetua = (listGuruJabatan || []).find(jg => {
        const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
        return jRoles.some(r => (r || '').toLowerCase().includes('ketua panitia'));
      });

      if (foundKetua) {
        setPanitiaData({ ketua: foundKetua.guru });
      }

      // 3. Cek apakah sudah ada draft / sop di database
      const { data: existingSop } = await supabase
        .from('cbt_sop_persetujuan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSop) {
        setSopData(existingSop);
        if (existingSop.jenis_ujian) {
          setJenisUjian(existingSop.jenis_ujian);
        }
        if (existingSop.is_tata_tertib_approved || existingSop.tanda_tangan_ketua) {
          setIsApprovedLocal(true);
          setSignatureData(existingSop.tanda_tangan_ketua);
          setTitimangsaStr(`${existingSop.titimangsa_tempat || (lembaga?.kecamatan || 'Compreng')}, ${formatDateIndonesia(existingSop.titimangsa_tanggal || existingSop.tanggal_pelaksanaan_mulai)}`);
        } else {
          setShowJenisModal(true);
        }
      } else {
        setShowJenisModal(true);
      }
    } catch (e) {
      console.error(e);
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

  const handleSelectJenis = () => {
    if (!jenisUjian) {
      Swal.fire('Peringatan', 'Silakan pilih Jenis Ujian terlebih dahulu.', 'warning');
      return;
    }
    setShowJenisModal(false);
  };

  const handleConfirmTtd = () => {
    if (!tempTtd) {
      Swal.fire('Peringatan', 'Silakan goreskan tanda tangan Anda pada kanvas.', 'warning');
      return;
    }
    if (!tanggalUjian) {
      Swal.fire('Peringatan', 'Silakan pilih tanggal pertama pelaksanaan ujian.', 'warning');
      return;
    }

    const tempat = dataLembaga?.kecamatan ? `Kec. ${dataLembaga.kecamatan}` : 'Compreng';
    const formattedDate = formatDateIndonesia(tanggalUjian);
    
    setSignatureData(tempTtd);
    setTitimangsaStr(`${tempat}, ${formattedDate}`);
    setIsApprovedLocal(true);
    setShowTtdModal(false);

    Swal.fire({
      icon: 'success',
      title: 'Disetujui',
      text: 'Tata Tertib Pengawas telah disetujui. Klik tombol "Selanjutnya" untuk melanjutkan ke tahap SOP.',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const handleSelanjutnya = async () => {
    setSaving(true);
    try {
      const tempat = dataLembaga?.kecamatan ? `Kec. ${dataLembaga.kecamatan}` : 'Compreng';
      const payload = {
        jenis_ujian: jenisUjian,
        tahun_ajaran: sopData?.tahun_ajaran || '2025/2026',
        semester: sopData?.semester || 'Genap',
        tanda_tangan_ketua: signatureData,
        titimangsa_tempat: tempat,
        titimangsa_tanggal: tanggalUjian,
        tanggal_pelaksanaan_mulai: tanggalUjian,
        is_tata_tertib_approved: true,
        is_approved: true,
        approved_at: new Date().toISOString()
      };

      if (sopData?.id) {
        await supabase.from('cbt_sop_persetujuan').update(payload).eq('id', sopData.id);
      } else {
        await supabase.from('cbt_sop_persetujuan').insert([payload]);
      }

      // Berhasil, arahkan Ketua Panitia langsung ke halaman SOP Ujian
      navigate('/cbt/sop-ujian');
    } catch (e) {
      console.error(e);
      Swal.fire('Error', e.message || 'Gagal menyimpan persetujuan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const ketuaName = panitiaData?.ketua?.nama || currentUser?.nama || 'Ketua Panitia';

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Header Info Banner */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <ShieldCheck className="text-primary" /> Pengesahan Tata Tertib Pengawas CBT
          </div>
          <p className="text-gray-500 text-xs mt-1">
            Tahap 1 dari Alur Ujian: Wajib disetujui dan ditandatangani oleh Ketua Panitia Ujian.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full uppercase tracking-wider">
            {jenisUjian || 'Pilih Jenis Ujian'}
          </span>
          <button 
            onClick={() => setShowJenisModal(true)}
            className="text-xs text-primary underline font-medium hover:text-blue-900"
          >
            Ubah Jenis
          </button>
        </div>
      </div>

      {/* Lembar Dokumen Resmi Kertas A4 */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 sm:p-12 text-gray-800 font-serif leading-relaxed">
        {/* Kop Surat Sekolah */}
        <KopSurat dataLembaga={dataLembaga} />

        {/* Judul Dokumen */}
        <div className="text-center my-6">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-black underline">
            TATA TERTIB PENGAWAS RUANG UJIAN
          </h2>
          <p className="text-xs sm:text-sm font-bold uppercase text-gray-700 mt-1">
            PENILAIAN {jenisUjian ? jenisUjian.toUpperCase() : 'CBT'} TAHUN AJARAN {panitiaData?.tahun_ajaran || '2025/2026'}
          </p>
        </div>

        {/* Isi Tata Tertib */}
        <div className="space-y-4 text-xs sm:text-[13px] text-justify font-sans leading-relaxed text-gray-700">
          <div>
            <h4 className="font-bold text-gray-900 mb-1">A. PERSIAPAN RUANG & PENGAWAS</h4>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Pengawas ruang telah hadir di lokasi ujian atau ruang kontrol proctoring 20 menit sebelum ujian dimulai.</li>
              <li>Pengawas menerima daftar hadir peserta, berita acara, dan kode aktivasi sesi ujian.</li>
              <li>Memastikan ruangan ujian dalam kondisi tenang, tertib, dan bebas dari alat bantu yang tidak diperkenankan.</li>
            </ol>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-1">B. PELAKSANAAN UJIAN BERBASIS KOMPUTER (CBT)</h4>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Menginstruksikan peserta untuk memindai kartu ujian atau login ke sistem CBT dengan kamera depan aktif.</li>
              <li>Memantau pergerakan peserta secara langsung dan melalui monitor Grid Pengawasan (AI Edge Proctoring).</li>
              <li>Memberikan peringatan bertahap kepada peserta jika sistem AI mendeteksi anomali (wajah hilang, menengok, membuka aplikasi lain).</li>
              <li>Berhak melakukan tindakan remote: <em>Jeda Ujian</em>, <em>Tambah Waktu</em> untuk kendala teknis, atau <em>Blokir Sesi</em> bagi pelanggaran berat.</li>
            </ol>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-1">C. AKHIR PELAKSANAAN UJIAN</h4>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Memastikan seluruh lembar jawaban peserta telah terserahkan dan tersinkronisasi 100% ke server database.</li>
              <li>Menandatangani Berita Acara Pelaksanaan Ujian dan Daftar Hadir Peserta secara digital.</li>
            </ol>
          </div>
        </div>

        {/* Area Tanda Tangan & Titimangsa */}
        <div className="mt-12 flex justify-end">
          <div className="text-center w-64 font-sans text-xs">
            <p className="text-gray-700 mb-1">
              {titimangsaStr || `Compreng, ${formatDateIndonesia(tanggalUjian)}`}
            </p>
            <p className="font-bold text-gray-900 mb-2">Ketua Panitia Pelaksana,</p>

            <div className="h-24 flex items-center justify-center border border-dashed border-gray-300 rounded-xl my-1 bg-gray-50/50">
              {signatureData ? (
                <img src={signatureData} alt="TTD Ketua Panitia" className="max-h-20 object-contain mx-auto" />
              ) : (
                <span className="text-[11px] text-gray-400 italic">Belum ditandatangani</span>
              )}
            </div>

            <p className="font-bold text-gray-900 underline mt-2 text-sm">{ketuaName}</p>
            <p className="text-gray-500 text-[11px]">NIP/NUPTK: -</p>
          </div>
        </div>
      </div>

      {/* Tombol Aksi Bawah */}
      <div className="mt-6 flex justify-end gap-3">
        {!isApprovedLocal ? (
          <button
            onClick={() => setShowTtdModal(true)}
            className="px-6 py-3 bg-primary hover:bg-blue-900 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center gap-2"
          >
            <CheckCircle2 size={18} /> Setujui Tata Tertib
          </button>
        ) : (
          <button
            onClick={handleSelanjutnya}
            disabled={saving}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center gap-2 animate-bounce-short"
          >
            {saving ? 'Menyimpan...' : (
              <>
                Selanjutnya (Buka SOP Ujian) <ArrowRight size={18} />
              </>
            )}
          </button>
        )}
      </div>

      {/* MODAL 1: Pilihan Jenis Ujian Pop-up */}
      {showJenisModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <FileText size={24} />
              </div>
              <h3 className="font-bold text-lg text-gray-900">Pilih Jenis Ujian CBT</h3>
              <p className="text-gray-500 text-xs mt-1">
                Tentukan paket ujian yang akan disahkan Tata Tertib dan jadwal pelaksanaannya.
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {JENIS_UJIAN_OPTIONS.map((opt) => {
                const isSelected = jenisUjian === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setJenisUjian(opt)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition flex items-center justify-between ${
                      isSelected 
                        ? 'border-primary bg-primary/5 text-primary' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span>{opt}</span>
                    {isSelected && <Check size={18} className="text-primary" />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSelectJenis}
              className="w-full py-3 bg-primary hover:bg-blue-900 text-white font-bold rounded-xl text-sm transition shadow-sm"
            >
              Lanjutkan ke Lembar Tata Tertib
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: TTD & Tanggal Pelaksanaan Pop-up */}
      {showTtdModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-primary text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <CheckCircle2 size={18} /> Pengesahan & Tanda Tangan
                </h3>
                <p className="text-blue-200 text-xs mt-0.5">Ketua Panitia Pelaksana Ujian CBT</p>
              </div>
              <button 
                onClick={() => setShowTtdModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tanggal Pertama Ujian */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tanggal Pertama Pelaksanaan Ujian <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:ring-2 focus-within:ring-primary focus-within:bg-white">
                  <Calendar size={18} className="text-gray-400" />
                  <input
                    type="date"
                    value={tanggalUjian}
                    onChange={(e) => setTanggalUjian(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-800 outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Kanvas Tanda Tangan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Goreskan Tanda Tangan Digital <span className="text-red-500">*</span>
                </label>
                <SignatureCanvas
                  height={170}
                  onSave={(base64) => setTempTtd(base64)}
                  onClear={() => setTempTtd('')}
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTtdModal(false)}
                className="px-4 py-2.5 text-gray-600 hover:bg-gray-200 rounded-xl font-medium text-sm transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmTtd}
                className="px-6 py-2.5 bg-primary hover:bg-blue-900 text-white font-bold rounded-xl text-sm transition shadow-sm"
              >
                Oke, Terapkan Pengesahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
