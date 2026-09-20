import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Printer, DoorOpen, LogIn, LogOut, BookOpen, School, Filter, Download, ShieldAlert, DollarSign } from 'lucide-react';
import Swal from 'sweetalert2';

export default function CetakQrPresensiGuru() {
  const navigate = useNavigate();
  const [kelasList, setKelasList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(null);
  const [activeTab, setActiveTab] = useState('semua'); // 'semua' | 'kehadiran' | 'kbm'
  const [dataLembaga, setDataLembaga] = useState(null);

  useEffect(() => {
    checkRoleAndFetch();
  }, []);

  const checkRoleAndFetch = async () => {
    setIsLoading(true);
    const userSession = localStorage.getItem('user_guru');
    if (!userSession) {
      navigate('/login-guru');
      return;
    }

    try {
      const userObj = JSON.parse(userSession);
      let allowed = userObj?.role === 'admin';

      if (!allowed && userObj?.id) {
        const { data: jData } = await supabase.from('jabatan_guru').select('*').eq('guru_id', userObj.id).maybeSingle();
        if (jData) {
          const roles = [jData.jabatan_utama, jData.jabatan_lain_1, jData.jabatan_lain_2, jData.jabatan_lain_3].filter(Boolean);
          allowed = roles.some(r => {
            const lower = (r || '').toLowerCase();
            return lower.includes('kepala sekolah') || lower.includes('kepsek') || lower.includes('bendahara') || lower.includes('waka') || lower.includes('kurikulum') || lower.includes('operator') || lower.includes('admin');
          });
        }
      }

      setIsAuthorized(allowed);

      if (!allowed) {
        Swal.fire({
          icon: 'warning',
          title: 'Akses Dibatasi',
          text: 'Menu Cetak QR Code hanya dapat diakses oleh Kepala Sekolah, Bendahara, dan Waka. Kurikulum.',
          confirmButtonColor: '#1e3a8a',
          confirmButtonText: 'Buka Halaman Honor'
        }).then(() => {
          navigate('/rekap-honor-guru');
        });
        setIsLoading(false);
        return;
      }

      // If authorized, fetch data
      const { data: lembaga } = await supabase.from('data_lembaga').select('*').limit(1).maybeSingle();
      if (lembaga) setDataLembaga(lembaga);

      const { data: kelas, error } = await supabase
        .from('data_kelas')
        .select('*')
        .order('nama_kelas', { ascending: true });

      if (error) throw error;
      setKelasList(kelas || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data kelas.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate All QR Item definitions
  const qrKehadiranMasuk = {
    id: 'kehadiran-masuk',
    title: 'ABSEN KEHADIRAN: MASUK',
    posisi: 'Ditempel di LUAR PINTU Gerbang / Kantor',
    deskripsi: 'Scan saat baru tiba di sekolah untuk mendapatkan honor kehadiran Rp 5.000 (Wajib s/d 08:00)',
    type: 'GURU_KEHADIRAN',
    action: 'MASUK',
    color: '#1e3a8a',
    payload: JSON.stringify({
      app: 'SMPITHM',
      type: 'GURU_KEHADIRAN',
      action: 'MASUK',
      label: 'Pintu Masuk Sekolah'
    })
  };

  const qrKehadiranPulang = {
    id: 'kehadiran-pulang',
    title: 'ABSEN KEHADIRAN: PULANG',
    posisi: 'Ditempel di DALAM Ruang Guru / Kantor',
    deskripsi: 'Scan saat selesai jam kerja sebelum meninggalkan sekolah (Wajib mulai 13:00)',
    type: 'GURU_KEHADIRAN',
    action: 'PULANG',
    color: '#047857',
    payload: JSON.stringify({
      app: 'SMPITHM',
      type: 'GURU_KEHADIRAN',
      action: 'PULANG',
      label: 'Pintu Keluar / Ruang Guru'
    })
  };

  const qrKbmList = kelasList.flatMap((k) => [
    {
      id: `kbm-masuk-${k.id}`,
      title: `KBM MASUK: KELAS ${k.nama_kelas}`,
      posisi: `Ditempel di LUAR PINTU Kelas ${k.nama_kelas}`,
      deskripsi: `Scan oleh Guru Mapel / Guru Pengganti saat MASUK memulai jam pelajaran (${k.nama_kelas})`,
      type: 'GURU_KBM',
      action: 'MASUK',
      kelas_id: k.id,
      nama_kelas: k.nama_kelas,
      color: '#d97706',
      payload: JSON.stringify({
        app: 'SMPITHM',
        type: 'GURU_KBM',
        action: 'MASUK',
        kelas_id: k.id,
        nama_kelas: k.nama_kelas,
        posisi: `Luar Pintu Kelas ${k.nama_kelas}`
      })
    },
    {
      id: `kbm-keluar-${k.id}`,
      title: `KBM KELUAR: KELAS ${k.nama_kelas}`,
      posisi: `Ditempel di DALAM RUANG Kelas ${k.nama_kelas}`,
      deskripsi: `Scan oleh Guru Mapel / Pengganti saat SELESAI mengajar sebelum keluar dari kelas (${k.nama_kelas})`,
      type: 'GURU_KBM',
      action: 'KELUAR',
      kelas_id: k.id,
      nama_kelas: k.nama_kelas,
      color: '#7c3aed',
      payload: JSON.stringify({
        app: 'SMPITHM',
        type: 'GURU_KBM',
        action: 'KELUAR',
        kelas_id: k.id,
        nama_kelas: k.nama_kelas,
        posisi: `Dalam Ruang Kelas ${k.nama_kelas}`
      })
    }
  ]);

  let displayedQrs = [];
  if (activeTab === 'semua') {
    displayedQrs = [qrKehadiranMasuk, qrKehadiranPulang, ...qrKbmList];
  } else if (activeTab === 'kehadiran') {
    displayedQrs = [qrKehadiranMasuk, qrKehadiranPulang];
  } else if (activeTab === 'kbm') {
    displayedQrs = qrKbmList;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Memeriksa hak akses & data...</p>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-3xl border border-red-100 shadow-sm text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">Akses Dibatasi</h3>
        <p className="text-sm text-gray-600 mb-6">
          Halaman Cetak QR Code hanya dapat diakses oleh Kepala Sekolah, Bendahara, dan Waka. Kurikulum.
        </p>
        <button
          onClick={() => navigate('/rekap-honor-guru')}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition shadow"
        >
          <DollarSign size={18} /> Buka Rekap Honor Saya
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header (Hidden on Print) */}
      <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <QrCode className="text-primary" /> Generator & Cetak QR Code Absensi Guru
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Cetak stiker QR Code resmi untuk ditempel di pintu gerbang/kantor (Kehadiran) dan di setiap pintu kelas (KBM Mengajar).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition"
          >
            <Printer size={18} /> Cetak Semua QR (Print A4)
          </button>
        </div>
      </div>

      {/* Tabs Filter (Hidden on Print) */}
      <div className="print:hidden flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setActiveTab('semua')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'semua' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Semua QR ({2 + qrKbmList.length})
        </button>
        <button
          onClick={() => setActiveTab('kehadiran')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'kehadiran' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          QR Kehadiran Sekolah (2)
        </button>
        <button
          onClick={() => setActiveTab('kbm')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'kbm' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          QR KBM Kelas ({qrKbmList.length})
        </button>
      </div>

      {/* Info Petunjuk (Hidden on Print) */}
      <div className="print:hidden bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
        <School size={20} className="text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm mb-1">Panduan Penempatan QR Code:</p>
          <ul className="list-disc pl-4 space-y-1 text-gray-700">
            <li><b>Luar Pintu Gerbang / Kantor:</b> Tempel QR <i>Kehadiran Masuk</i> untuk scan kehadiran pagi.</li>
            <li><b>Dalam Ruang Guru / Kantor:</b> Tempel QR <i>Kehadiran Keluar</i> untuk scan kepulangan siang.</li>
            <li><b>Luar Pintu Setiap Kelas:</b> Tempel QR <i>KBM Masuk</i> agar guru scan saat masuk mengajar.</li>
            <li><b>Dalam Dinding Setiap Kelas:</b> Tempel QR <i>KBM Keluar</i> agar guru scan sebelum selesai mengajar.</li>
          </ul>
        </div>
      </div>

      {/* QR Code Cards Grid (Designed for Screen & Print) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:m-0">
        {displayedQrs.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl border-2 border-gray-800 p-6 flex flex-col items-center text-center shadow-md print:shadow-none print:rounded-2xl print:border-2 print:border-black print:p-4 print:break-inside-avoid relative overflow-hidden"
          >
            {/* Header Badge */}
            <div className="flex items-center gap-2 mb-3">
              {dataLembaga?.logo_url && (
                <img
                  src={dataLembaga.logo_url}
                  alt="Logo"
                  className="w-8 h-8 object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div>
                <h4 className="text-xs font-black tracking-wider uppercase text-gray-900">{dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}</h4>
                <p className="text-[9px] text-gray-500 font-medium">Sistem Presensi Digital Guru</p>
              </div>
            </div>

            {/* Title Banner */}
            <div
              className="w-full py-2 px-3 rounded-xl font-black text-xs text-white uppercase tracking-wider mb-4 shadow-sm"
              style={{ backgroundColor: item.color }}
            >
              {item.title}
            </div>

            {/* QR Code SVG */}
            <div className="p-3 bg-white border-2 border-gray-200 rounded-2xl shadow-inner mb-4 flex items-center justify-center">
              <QRCodeSVG
                value={item.payload}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Posisi & Petunjuk */}
            <div className="w-full bg-gray-50 rounded-xl p-2.5 border border-gray-200 mb-3 text-left">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Lokasi Penempelan:</p>
              <p className="text-xs font-black text-gray-800">{item.posisi}</p>
            </div>

            <p className="text-[10px] text-gray-500 leading-tight">
              {item.deskripsi}
            </p>

            <div className="w-full border-t border-dashed border-gray-300 mt-4 pt-2 flex justify-between items-center text-[9px] text-gray-400 font-mono">
              <span>SCAN DENGAN APLIKASI SIAKAD MOBILE</span>
              <span>KODE: {item.action}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
