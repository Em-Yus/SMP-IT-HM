import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import KopSurat from '../../components/KopSurat';
import SignatureCanvas from '../../components/cbt/SignatureCanvas';
import { 
  FileCheck, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  X, 
  ShieldCheck,
  AlertTriangle,
  Users,
  UserCheck,
  Building,
  Lock,
  ChevronDown,
  Printer
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function CbtSopUjian() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [dataLembaga, setDataLembaga] = useState(null);
  const [ketuaNama, setKetuaNama] = useState('Ketua Panitia Ujian');
  const [sopData, setSopData] = useState(null);
  const [guruPersetujuan, setGuruPersetujuan] = useState(null);
  const [isKetuaPanitia, setIsKetuaPanitia] = useState(false);
  const [jenisUjian, setJenisUjian] = useState('PSTS');

  // State Modal TTD & Tanggal (Khusus Ketua Panitia)
  const [showTtdModal, setShowTtdModal] = useState(false);
  const [tanggalPersetujuan, setTanggalPersetujuan] = useState(new Date().toISOString().split('T')[0]);
  const [tempTtd, setTempTtd] = useState('');

  // State Persetujuan
  const [isApprovedLocal, setIsApprovedLocal] = useState(false);
  const [userSignature, setUserSignature] = useState('');

  // Scroll to Bottom Detector State
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const bottomSentinelRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    initSopPage();
  }, []);

  const initSopPage = async () => {
    try {
      setLoading(true);
      const userSession = localStorage.getItem('user_guru');
      if (!userSession) {
        navigate('/login-guru');
        return;
      }
      const userObj = JSON.parse(userSession);
      setCurrentUser(userObj);

      // 1. Ambil Lembaga
      const { data: lembaga } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      setDataLembaga(lembaga);

      // 2. Ambil Ketua Panitia LANGSUNG dari Data Pegawai (jabatan_guru)
      let detectedKetuaId = null;
      let namaKetuaPanitia = 'Ketua Panitia Ujian';

      const { data: listGuruJabatan } = await supabase
        .from('jabatan_guru')
        .select('guru_id, jabatan_utama, jabatan_lain_1, jabatan_lain_2, jabatan_lain_3');

      const foundKetua = (listGuruJabatan || []).find(jg => {
        const jRoles = [jg.jabatan_utama, jg.jabatan_lain_1, jg.jabatan_lain_2, jg.jabatan_lain_3];
        return jRoles.some(r => (r || '').toLowerCase().includes('ketua panitia'));
      });

      if (foundKetua) {
        detectedKetuaId = foundKetua.guru_id;
        const { data: ketuaGuruData } = await supabase
          .from('data_guru')
          .select('nama')
          .eq('id', foundKetua.guru_id)
          .maybeSingle();
        if (ketuaGuruData?.nama) {
          namaKetuaPanitia = ketuaGuruData.nama;
        }
      }
      setKetuaNama(namaKetuaPanitia);

      // Cek apakah user saat ini adalah Ketua Panitia atau Admin
      let isKetua = false;
      if (userObj?.id && detectedKetuaId && Number(detectedKetuaId) === Number(userObj.id)) {
        isKetua = true;
      } else if (userObj?.role === 'admin') {
        isKetua = true;
      } else if (userObj?.id) {
        const userJabatanRow = (listGuruJabatan || []).find(jg => Number(jg.guru_id) === Number(userObj.id));
        if (userJabatanRow) {
          const uRoles = [userJabatanRow.jabatan_utama, userJabatanRow.jabatan_lain_1, userJabatanRow.jabatan_lain_2, userJabatanRow.jabatan_lain_3];
          if (uRoles.some(r => (r || '').toLowerCase().includes('ketua panitia'))) {
            isKetua = true;
          }
        }
      }
      setIsKetuaPanitia(isKetua);

      // 3. Ambil SOP Aktif
      const { data: sop } = await supabase
        .from('cbt_sop_persetujuan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSopData(sop);
      if (sop?.jenis_ujian) {
        setJenisUjian(sop.jenis_ujian);
      }

      // 4. Cek status persetujuan user saat ini
      const guruId = userObj?.id;
      if (isKetua && sop?.tanda_tangan_ketua) {
        setIsApprovedLocal(true);
        setUserSignature(sop.tanda_tangan_ketua);
        setHasReadToBottom(true);
        if (sop.titimangsa_tanggal) {
          setTanggalPersetujuan(sop.titimangsa_tanggal);
        }
      } else if (guruId && sop) {
        const { data: persetujuan } = await supabase
          .from('cbt_persetujuan_guru')
          .select('*')
          .eq('sop_id', sop.id)
          .eq('guru_id', guruId)
          .maybeSingle();

        if (persetujuan && persetujuan.is_paham_sop) {
          setGuruPersetujuan(persetujuan);
          setIsApprovedLocal(true);
          setHasReadToBottom(true);
        }
      }
    } catch (e) {
      console.error('Gagal memuat halaman SOP:', e);
    } finally {
      setLoading(false);
    }
  };

  // Deteksi Gulir / Scroll ke Paling Bawah
  useEffect(() => {
    if (loading) return;

    // 1. Menggunakan IntersectionObserver pada sentinel di bawah dokumen
    let observer = null;
    if (bottomSentinelRef.current && window.IntersectionObserver) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setHasReadToBottom(true);
            }
          });
        },
        { threshold: 0.1 }
      );
      observer.observe(bottomSentinelRef.current);
    }

    // 2. Fallback event listener pada elemen <main> dan window
    const handleScrollCheck = () => {
      const mainEl = document.querySelector('main');
      if (mainEl) {
        const isMainAtBottom = mainEl.scrollHeight - mainEl.scrollTop <= mainEl.clientHeight + 80;
        if (isMainAtBottom) {
          setHasReadToBottom(true);
        }
      }
      const isWinAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
      if (isWinAtBottom) {
        setHasReadToBottom(true);
      }
    };

    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScrollCheck, { passive: true });
    }
    window.addEventListener('scroll', handleScrollCheck, { passive: true });

    return () => {
      if (observer) observer.disconnect();
      if (mainEl) mainEl.removeEventListener('scroll', handleScrollCheck);
      window.removeEventListener('scroll', handleScrollCheck);
    };
  }, [loading]);

  const formatDateIndonesia = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const titimangsaTempat = sopData?.titimangsa_tempat || (dataLembaga?.kecamatan ? `Kec. ${dataLembaga.kecamatan}` : 'Compreng');
  const titimangsaTanggal = sopData?.titimangsa_tanggal || sopData?.tanggal_pelaksanaan_mulai;

  // Nama Jenis Ujian Dinamis (Tugas, PSTS, PSAS, PSAT, PSAJ)
  const jenisUjianRaw = (sopData?.jenis_ujian || jenisUjian || 'PSAJ').trim();
  const jenisUjianDisplay = jenisUjianRaw.toLowerCase() === 'tugas' ? 'Tugas' : jenisUjianRaw.toUpperCase();

  const handleOpenTtdModal = () => {
    setTempTtd('');
    setShowTtdModal(true);
  };

  // Simpan Pengesahan Ketua Panitia
  const handleConfirmTtd = async () => {
    if (!tempTtd) {
      Swal.fire('Tanda Tangan Kosong', 'Silakan goreskan tanda tangan Anda pada kanvas terlebih dahulu.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const guruId = currentUser?.id;
      let currentSopId = sopData?.id;
      const tempat = titimangsaTempat;

      const sopPayload = {
        jenis_ujian: jenisUjian || sopData?.jenis_ujian || 'PSAJ',
        tahun_ajaran: sopData?.tahun_ajaran || '2025/2026',
        semester: sopData?.semester || 'Genap',
        tanda_tangan_ketua: tempTtd,
        titimangsa_tempat: tempat,
        titimangsa_tanggal: tanggalPersetujuan,
        tanggal_pelaksanaan_mulai: tanggalPersetujuan,
        is_approved: true,
        is_tata_tertib_approved: true,
        approved_at: new Date().toISOString()
      };

      if (currentSopId) {
        const { data: updData, error: updErr } = await supabase
          .from('cbt_sop_persetujuan')
          .update(sopPayload)
          .eq('id', currentSopId)
          .select()
          .single();
        if (updErr) throw updErr;
        setSopData(updData);
      } else {
        const { data: insData, error: insErr } = await supabase
          .from('cbt_sop_persetujuan')
          .insert([sopPayload])
          .select()
          .single();
        if (insErr) throw insErr;
        currentSopId = insData.id;
        setSopData(insData);
      }

      // Catat juga di cbt_persetujuan_guru untuk Ketua Panitia
      if (guruId && currentSopId) {
        await supabase
          .from('cbt_persetujuan_guru')
          .upsert({
            sop_id: currentSopId,
            guru_id: guruId,
            tanda_tangan_guru: tempTtd,
            tanggal_persetujuan: tanggalPersetujuan,
            is_paham_sop: true,
            signed_at: new Date().toISOString()
          }, { onConflict: 'sop_id,guru_id' });

        localStorage.setItem(`cbt_sop_approved_${guruId}`, 'true');
      }

      setUserSignature(tempTtd);
      setIsApprovedLocal(true);
      setHasReadToBottom(true);
      setShowTtdModal(false);

      Swal.fire({
        icon: 'success',
        title: 'SOP Berhasil Disahkan!',
        text: `Dokumen SOP & Tata Tertib ${jenisUjianDisplay} telah disahkan secara resmi. Akses Jadwal Ujian dan Tombol Cetak kini telah terbuka.`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'Gagal mengesahkan SOP.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Klik tombol "Selanjutnya: Buka Jadwal Ujian"
  const handleSelanjutnya = async () => {
    // Validasi untuk guru biasa: SOP harus sudah disahkan oleh ketua panitia
    if (!isKetuaPanitia && !sopData?.tanda_tangan_ketua) {
      Swal.fire('Perhatian', 'SOP Ujian ini belum disahkan oleh Ketua Panitia Ujian.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const guruId = currentUser?.id;
      const currentSopId = sopData?.id;

      // Jika guru biasa, catat pemahaman membaca di database
      if (!isKetuaPanitia && guruId && currentSopId) {
        const todayStr = new Date().toISOString().split('T')[0];
        await supabase
          .from('cbt_persetujuan_guru')
          .upsert({
            sop_id: currentSopId,
            guru_id: guruId,
            is_paham_sop: true,
            tanggal_persetujuan: todayStr,
            signed_at: new Date().toISOString()
          }, { onConflict: 'sop_id,guru_id' });
      }

      if (guruId) {
        localStorage.setItem(`cbt_sop_approved_${guruId}`, 'true');
      }

      // Navigasi ke halaman Jadwal Ujian
      navigate('/cbt/jadwal');
    } catch (err) {
      console.error('Error saat menyelesaikan pemahaman SOP:', err);
      if (currentUser?.id) {
        localStorage.setItem(`cbt_sop_approved_${currentUser.id}`, 'true');
      }
      navigate('/cbt/jadwal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-xs text-gray-500 font-medium">Memuat Dokumen SOP Ujian...</p>
      </div>
    );
  }

  const isKetuaSigned = !!(sopData?.tanda_tangan_ketua || (isKetuaPanitia && userSignature));

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* CSS untuk mode cetak printer */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
          }
          aside, header, nav, .print\\:hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          #sop-document-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Header Info Banner */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-lg">
            <FileCheck className="text-primary" /> Standar Operasional Prosedur (SOP) & Tata Tertib {jenisUjianDisplay}
          </div>
          <p className="text-gray-500 text-xs mt-1">
            Pedoman Resmi Pelaksanaan {jenisUjianDisplay} CBT Tingkat Satuan Pendidikan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isKetuaSigned ? (
            <>
              <span className="px-3 py-1.5 bg-green-100 text-green-800 text-xs font-bold rounded-full flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Dokumen SOP Disahkan
              </span>

              {/* Tombol Cetak Dokumen di Header Banner */}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-900 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer"
                title="Cetak Lembar Dokumen SOP & Tata Tertib"
              >
                <Printer size={15} />
                <span>Cetak Dokumen</span>
              </button>
            </>
          ) : (
            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full flex items-center gap-1.5">
              <AlertTriangle size={14} /> Menunggu Pengesahan Ketua Panitia
            </span>
          )}
        </div>
      </div>

      {/* Notice Banner Khusus Ketua Panitia */}
      {isKetuaPanitia && !isKetuaSigned && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl mb-6 text-xs text-blue-900 flex items-center gap-3 shadow-sm print:hidden">
          <ShieldCheck size={24} className="text-primary shrink-0" />
          <div>
            <strong className="block text-sm font-bold text-primary">Akses Pengesahan: Ketua Panitia {jenisUjianDisplay}</strong>
            <span>
              Silakan periksa lembar SOP dan tata tertib {jenisUjianDisplay} berikut, lalu lakukan pengesahan digital melalui tombol di bagian bawah. Setelah disahkan, menu <strong>Jadwal Ujian</strong> serta tombol <strong>Cetak Dokumen</strong> akan terbuka untuk seluruh dewan guru.
            </span>
          </div>
        </div>
      )}

      {/* Notice Banner Guru Biasa jika belum disahkan */}
      {!isKetuaPanitia && !isKetuaSigned && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-6 text-xs text-amber-900 flex items-center gap-3 shadow-sm print:hidden">
          <AlertTriangle size={24} className="text-amber-600 shrink-0" />
          <div>
            <strong className="block text-sm font-bold text-amber-800">Menunggu Pengesahan Dokumen</strong>
            <span>
              SOP & Tata Tertib {jenisUjianDisplay} ini sedang menunggu pengesahan dan tanda tangan resmi dari Ketua Panitia (<strong>{ketuaNama}</strong>).
            </span>
          </div>
        </div>
      )}

      {/* Lembar Dokumen Resmi Kertas A4 */}
      <div 
        id="sop-document-container"
        className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 sm:p-14 text-gray-800 leading-relaxed font-serif"
      >
        {/* Kop Surat Sekolah */}
        <KopSurat dataLembaga={dataLembaga} />

        {/* Judul Dokumen */}
        <div className="text-center my-6 border-b border-gray-200 pb-4">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-black underline decoration-2">
            STANDAR OPERASIONAL PROSEDUR (SOP) & TATA TERTIB {jenisUjianDisplay}
          </h2>
          <p className="text-xs sm:text-sm font-bold uppercase text-gray-700 mt-1">
            PENILAIAN {jenisUjianDisplay} TAHUN AJARAN {sopData?.tahun_ajaran || '2025/2026'}
          </p>
        </div>

        {/* Konten Dokumen */}
        <div className="space-y-6 text-xs sm:text-[13px] text-justify font-sans leading-relaxed text-gray-700">

          {/* BAGIAN I: TATA TERTIB PENGAWAS RUANG */}
          <div className="border border-blue-100 bg-blue-50/20 p-5 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck size={18} className="text-primary shrink-0" />
              <h3 className="font-extrabold text-sm sm:text-base text-gray-900 uppercase">
                BAGIAN I: TATA TERTIB PENGAWAS RUANG {jenisUjianDisplay}
              </h3>
            </div>

            {/* A. DI RUANG SEKRETARIAT */}
            <div className="mb-4">
              <h4 className="font-bold text-gray-900 text-xs sm:text-sm mb-2 text-primary">
                A. DI RUANG SEKRETARIAT / PANITIA {jenisUjianDisplay}
              </h4>
              <ol className="list-decimal pl-5 space-y-1.5 marker:text-primary marker:font-semibold">
                <li>30 Menit sebelum {jenisUjianDisplay} dimulai, Pengawas Ruang telah hadir di ruang sekretariat panitia {jenisUjianDisplay}.</li>
                <li>Pengawas Ruang menerima penjelasan dan pengarahan teknis pelaksanaan {jenisUjianDisplay} dari Ketua Panitia {jenisUjianDisplay}.</li>
                <li>Pengawas Ruang mengisi dan menandatangani pakta integritas pelaksanaan {jenisUjianDisplay} di hadapan Ketua Panitia {jenisUjianDisplay}.</li>
                <li>Pengawas Ruang menerima bahan pelaksanaan {jenisUjianDisplay} berupa amplop/berkas yang berisi daftar hadir peserta, lembar berita acara pelaksanaan {jenisUjianDisplay}, serta informasi akses CBT.</li>
              </ol>
            </div>

            {/* B. DI RUANG UJIAN */}
            <div>
              <h4 className="font-bold text-gray-900 text-xs sm:text-sm mb-2 text-primary">
                B. DI RUANG {jenisUjianDisplay}
              </h4>
              <p className="mb-2 italic text-gray-600 text-[11px] sm:text-xs">
                Pengawas masuk ke dalam ruang {jenisUjianDisplay} 15 (lima belas) menit sebelum waktu pelaksanaan untuk melakukan tugas secara berurutan:
              </p>
              <ol className="list-decimal pl-5 space-y-2 marker:text-primary marker:font-semibold">
                <li>Memeriksa kesiapan fisik ruang {jenisUjianDisplay}, kebersihan, pencahayaan, serta kestabilan koneksi internet/jaringan;</li>
                <li>Memimpin Apel peserta {jenisUjianDisplay} dan memeriksa kerapihan serta kelengkapan seragam Peserta {jenisUjianDisplay};</li>
                <li>Meminta peserta {jenisUjianDisplay} untuk memasuki ruang dengan menunjukkan Kartu Peserta {jenisUjianDisplay}, meletakkan tas di bagian depan ruang ujian, serta menempati tempat duduk sesuai nomor yang telah ditentukan;</li>
                <li>Memeriksa dan memastikan setiap peserta {jenisUjianDisplay} hanya membawa 1 Smartphone, Kartu Peserta {jenisUjianDisplay}, dan 1 Ballpoint di tempat duduk masing-masing;</li>
                <li>Memeriksa dan memastikan aplikasi CBT / Link Soal {jenisUjianDisplay} telah siap diakses pada perangkat peserta;</li>
                <li>Membacakan tata tertib {jenisUjianDisplay} secara jelas di depan seluruh peserta;</li>
                <li>Memberikan kesempatan kepada peserta {jenisUjianDisplay} untuk mengecek kelengkapan soal dan tampilan pada aplikasi ujian;</li>
                <li>Mewajibkan peserta {jenisUjianDisplay} melengkapi isian identitas akun pada aplikasi CBT secara benar (dipandu langsung oleh pengawas ruang);</li>
                <li>Memastikan peserta {jenisUjianDisplay} telah mengisi identitas dengan benar sesuai kartu peserta {jenisUjianDisplay};</li>
                <li>Memastikan peserta {jenisUjianDisplay} menandatangani daftar hadir pelaksanaan {jenisUjianDisplay};</li>
                <li>Mengingatkan peserta agar terlebih dahulu membaca petunjuk cara menjawab soal {jenisUjianDisplay} dengan teliti;</li>
                <li>Memimpin doa bersama dan mengingatkan seluruh peserta untuk senantiasa bekerja secara mandiri dan jujur;</li>
                <li>Mempersilakan seluruh peserta {jenisUjianDisplay} untuk membuka menu Jadwal dan mulai mengerjakan soal;</li>
                <li>
                  Selama {jenisUjianDisplay} berlangsung, pengawas ruang {jenisUjianDisplay} wajib:
                  <ul className="list-[lower-alpha] pl-5 mt-1 space-y-1 text-gray-700">
                    <li>Menjaga ketertiban, ketenangan, dan kekhidmatan suasana ruang {jenisUjianDisplay};</li>
                    <li>Memantau jalannya {jenisUjianDisplay} serta pengawasan integritas siswa melalui aplikasi pengawas CBT;</li>
                    <li>Memberi peringatan dan sanksi tegas kepada peserta yang melakukan atau terindikasi berbuat curang;</li>
                    <li>Melarang orang yang tidak berwenang memasuki ruang {jenisUjianDisplay} selain peserta {jenisUjianDisplay} dan panitia resmi;</li>
                    <li>
                      Menaati larangan pengawas: <strong>DILARANG</strong> merokok di ruang ujian, mengobrol, membaca di luar keperluan pengawasan, tidur, bermain ponsel pribadi, memberi isyarat, memberi petunjuk, ataupun memberi bantuan dalam bentuk apapun kepada peserta berkaitan dengan jawaban soal {jenisUjianDisplay} yang diujikan;
                    </li>
                  </ul>
                </li>
                <li>10 (sepuluh) menit sebelum waktu {jenisUjianDisplay} selesai, pengawas ruang memberi peringatan kepada peserta bahwa waktu tersisa 10 menit;</li>
                <li>
                  Setelah waktu {jenisUjianDisplay} selesai, pengawas ruang:
                  <ul className="list-[lower-alpha] pl-5 mt-1 space-y-1 text-gray-700">
                    <li>Mempersilakan seluruh peserta {jenisUjianDisplay} untuk berhenti mengerjakan soal;</li>
                    <li>Mempersilakan peserta {jenisUjianDisplay} mengirimkan jawaban {jenisUjianDisplay} pada aplikasi CBT (menekan tombol Kirim / Selesai);</li>
                    <li>Menghitung dan memverifikasi jumlah data respon jawaban {jenisUjianDisplay} pada sistem pengawas telah sama dengan jumlah peserta {jenisUjianDisplay}. Bila sudah lengkap dan sinkron, mempersilakan peserta meninggalkan ruang ujian secara tertib;</li>
                    <li>Menyusun satu lembar daftar hadir peserta dan satu lembar berita acara pelaksanaan {jenisUjianDisplay} kemudian dimasukkan kembali ke dalam map berkas yang tersedia;</li>
                    <li>Menyerahkan map berkas yang berisi daftar hadir peserta dan berita acara pelaksanaan {jenisUjianDisplay} kepada panitia {jenisUjianDisplay} di ruang sekretariat.</li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>

          {/* BAGIAN II: TATA TERTIB PESERTA */}
          <div className="border border-emerald-100 bg-emerald-50/20 p-5 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Users size={18} className="text-emerald-700 shrink-0" />
              <h3 className="font-extrabold text-sm sm:text-base text-gray-900 uppercase">
                BAGIAN II: TATA TERTIB PESERTA {jenisUjianDisplay}
              </h3>
            </div>

            <ol className="list-decimal pl-5 space-y-2 marker:text-emerald-700 marker:font-semibold">
              <li>15 (lima belas) menit sebelum {jenisUjianDisplay} dimulai atau setelah tanda masuk dibunyikan, Peserta {jenisUjianDisplay} berbaris di depan ruangan untuk melaksanakan Apel.</li>
              <li>Peserta {jenisUjianDisplay} yang terlambat hadir hanya diperkenankan mengikuti {jenisUjianDisplay} setelah mendapat izin dari Penanggung Jawab / Ketua Panitia {jenisUjianDisplay}, tanpa diberikan perpanjangan waktu.</li>
              <li>Peserta {jenisUjianDisplay} hanya diperkenankan membawa 1 Smartphone, Kartu Peserta {jenisUjianDisplay}, dan 1 Ballpoint. Dilarang keras membawa alat-alat lain selain yang sudah disebutkan seperti kalkulator, tas, buku, dan catatan dalam bentuk apapun ke tempat duduk ruang {jenisUjianDisplay}.</li>
              <li>Jika terdapat kendala pada Smartphone atau aplikasi CBT saat {jenisUjianDisplay}, segera melaporkan secara tenang dan tertib kepada Pengawas Ruang atau Panitia {jenisUjianDisplay}.</li>
              <li>Peserta {jenisUjianDisplay} diharuskan mengisi Presensi / Daftar Hadir {jenisUjianDisplay} secara digital maupun lembar fisik yang disediakan oleh pengawas.</li>
              <li>Peserta {jenisUjianDisplay} mulai login ke aplikasi dan membuka soal setelah diperkenankan oleh Pengawas Ruang.</li>
              <li>Peserta {jenisUjianDisplay} yang memerlukan penjelasan teknis cara login atau mengalami kendala sistem untuk mengikuti {jenisUjianDisplay} dapat bertanya langsung kepada Pengawas Ruang.</li>
              <li>Selama {jenisUjianDisplay} berlangsung, peserta {jenisUjianDisplay} hanya dapat meninggalkan ruangan dengan izin dan pengawasan dari Pengawas Ruang {jenisUjianDisplay}, serta tidak melakukannya berulang kali.</li>
              <li>Peserta {jenisUjianDisplay} yang meninggalkan ruangan setelah membaca soal dan tidak kembali lagi sampai tanda selesai {jenisUjianDisplay} dibunyikan, dinyatakan telah selesai menempuh/mengikuti {jenisUjianDisplay} dan tidak mendapatkan nilai sama sekali (nilai 0) pada mata pelajaran yang terkait.</li>
              <li>Peserta {jenisUjianDisplay} yang telah selesai mengerjakan soal sebelum batas waktu {jenisUjianDisplay} berakhir tidak diperbolehkan meninggalkan ruangan hingga menekan tombol selesai dan mendapatkan izin dari pengawas ruang.</li>
              <li>Peserta {jenisUjianDisplay} wajib berhenti mengerjakan soal tepat setelah ada tanda berakhirnya waktu {jenisUjianDisplay}.</li>
              <li>
                Selama {jenisUjianDisplay} berlangsung, peserta {jenisUjianDisplay} dilarang keras:
                <ul className="list-[lower-alpha] pl-5 mt-1 space-y-1 text-gray-700">
                  <li>Menanyakan jawaban soal kepada siapa pun;</li>
                  <li>Bekerja sama, berdiskusi, atau berkomunikasi dengan peserta lain;</li>
                  <li>Memberi atau menerima bantuan dalam bentuk apapun dalam menjawab soal {jenisUjianDisplay};</li>
                  <li>Memperlihatkan pekerjaan sendiri kepada peserta lain atau melihat pekerjaan peserta lain;</li>
                  <li>Membuka tab/jendela browser lain, aplikasi lain, mencari contekan di internet, atau keluar dari layar aplikasi {jenisUjianDisplay};</li>
                  <li>Menukarkan Smartphone yang digunakan untuk mengerjakan soal {jenisUjianDisplay} dengan peserta lain atau siapa pun.</li>
                </ul>
              </li>
            </ol>
          </div>

        </div>

        {/* Kolom Pengesahan Tanda Tangan: HANYA KETUA PANITIA DI KANAN BAWAH */}
        <div className="mt-12 pt-6 border-t border-gray-100 flex justify-end font-sans">
          <div className="text-center min-w-[260px]">
            <p className="text-xs text-gray-700">
              {titimangsaTempat}, {formatDateIndonesia(titimangsaTanggal) || formatDateIndonesia(new Date())}
            </p>
            <p className="text-xs font-bold text-gray-900 mt-1">
              Mengetahui,<br />Ketua Panitia {jenisUjianDisplay},
            </p>

            <div className="h-28 flex items-center justify-center my-2">
              {isKetuaSigned ? (
                <img 
                  src={sopData?.tanda_tangan_ketua || userSignature} 
                  alt="Tanda Tangan Ketua Panitia" 
                  className="max-h-24 max-w-[200px] object-contain"
                />
              ) : (
                <div className="border border-dashed border-gray-300 rounded-xl px-4 py-6 text-xs text-gray-400 bg-gray-50 flex flex-col items-center gap-1">
                  <AlertTriangle size={18} className="text-amber-400" />
                  <span>Belum Disahkan</span>
                </div>
              )}
            </div>

            <p className="text-xs font-bold text-gray-900 underline uppercase tracking-wide">
              {ketuaNama}
            </p>
            <p className="text-[11px] text-gray-500 font-medium">Ketua Pelaksana {jenisUjianDisplay}</p>
          </div>
        </div>

        {/* Sentinel element to detect reaching the bottom of the document */}
        <div ref={bottomSentinelRef} className="h-2 w-full mt-4 pointer-events-none" />
      </div>

      {/* Bagian Bawah: Tombol Aksi Dinamis */}
      <div className="mt-8 flex flex-col items-end gap-3 print:hidden">
        {isKetuaPanitia && !isKetuaSigned ? (
          <button
            onClick={handleOpenTtdModal}
            disabled={saving}
            className="flex items-center gap-2.5 px-8 py-3.5 bg-primary hover:bg-blue-900 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 text-sm"
          >
            <CheckCircle2 size={18} />
            <span>Sahkan SOP & Tata Tertib {jenisUjianDisplay} (Ketua Panitia)</span>
          </button>
        ) : (
          <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
            {!hasReadToBottom && !isKetuaPanitia && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-sm animate-bounce">
                <ChevronDown size={16} className="text-amber-600 shrink-0" />
                <span>Gulir dokumen ke bawah hingga selesai membaca untuk mengaktifkan tombol.</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 w-full sm:w-auto">
              {/* Tombol Cetak Dokumen di Bagian Bawah (muncul setelah disahkan ketua) */}
              {isKetuaSigned && (
                <button
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-xl border border-gray-300 shadow-sm hover:shadow transition text-sm cursor-pointer"
                  title="Cetak Lembar SOP & Tata Tertib"
                >
                  <Printer size={18} className="text-primary" />
                  <span>Cetak Dokumen</span>
                </button>
              )}

              {/* Tombol Selanjutnya ke Jadwal */}
              <button
                onClick={handleSelanjutnya}
                disabled={
                  saving || 
                  (!isKetuaPanitia && !hasReadToBottom) || 
                  (!isKetuaPanitia && !isKetuaSigned)
                }
                className={`flex items-center justify-center gap-2.5 px-8 py-3.5 font-bold rounded-xl transition-all duration-200 text-sm w-full sm:w-auto ${
                  (!isKetuaPanitia && !hasReadToBottom) || (!isKetuaPanitia && !isKetuaSigned)
                    ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 cursor-pointer'
                }`}
              >
                {saving ? (
                  <span>Memproses...</span>
                ) : !isKetuaSigned && !isKetuaPanitia ? (
                  <>
                    <Lock size={16} />
                    <span>Menunggu Pengesahan Ketua Panitia</span>
                  </>
                ) : !hasReadToBottom && !isKetuaPanitia ? (
                  <>
                    <Lock size={16} />
                    <span>Gulir ke Bawah untuk Menyelesaikan Membaca</span>
                  </>
                ) : (
                  <>
                    <span>Selanjutnya: Buka Jadwal Ujian</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Pop-up: Pengesahan & Tanda Tangan Khusus Ketua Panitia */}
      {showTtdModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-primary text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <ShieldCheck size={20} /> Pengesahan SOP oleh Ketua Panitia
                </h3>
                <p className="text-blue-200 text-xs mt-0.5">
                  Validasi dan tanda tangan resmi pedoman ujian CBT
                </p>
              </div>
              <button 
                onClick={() => setShowTtdModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Opsi Jenis Ujian: Tugas, PSTS, PSAS, PSAT, PSAJ */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Pilih Jenis Penilaian / Ujian <span className="text-red-500">*</span>
                </label>
                <select
                  value={jenisUjian}
                  onChange={(e) => setJenisUjian(e.target.value)}
                  className="w-full text-xs font-semibold border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary text-gray-800"
                >
                  <option value="Tugas">Tugas (Tugas Mandiri / Terstruktur)</option>
                  <option value="PSTS">PSTS (Penilaian Sumatif Tengah Semester)</option>
                  <option value="PSAS">PSAS (Penilaian Sumatif Akhir Semester)</option>
                  <option value="PSAT">PSAT (Penilaian Sumatif Akhir Tahun)</option>
                  <option value="PSAJ">PSAJ (Penilaian Sumatif Akhir Jenjang)</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Seluruh teks pada dokumen SOP & Tata Tertib akan otomatis menggunakan nama jenis ujian yang Anda pilih.
                </p>
              </div>

              {/* Pilihan Tanggal Titimangsa */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tanggal Pengesahan Resmi <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2.5 bg-gray-50 focus-within:ring-2 focus-within:ring-primary focus-within:bg-white">
                  <Calendar size={18} className="text-gray-400" />
                  <input
                    type="date"
                    value={tanggalPersetujuan}
                    onChange={(e) => setTanggalPersetujuan(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-800 outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Kanvas Tanda Tangan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Goreskan Tanda Tangan Digital Ketua Panitia <span className="text-red-500">*</span>
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
                disabled={saving}
                className="px-6 py-2.5 bg-primary hover:bg-blue-900 text-white font-bold rounded-xl text-sm transition shadow disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan & Sahkan Dokumen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
