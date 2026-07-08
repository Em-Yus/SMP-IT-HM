import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Clock, Search, QrCode, CheckCircle, AlertCircle, Calendar, Edit3, XCircle, FileText, PieChart, Filter } from 'lucide-react';
import Swal from 'sweetalert2';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats, Html5Qrcode } from 'html5-qrcode';
import CryptoJS from 'crypto-js';

export default function PresensiSiswa() {
  const [currentTab, setCurrentTab] = useState('scan'); // 'scan' | 'manual'
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);

  // Settings Kedisiplinan
  const [tipeHari, setTipeHari] = useState('reguler');
  const [jamMasuk, setJamMasuk] = useState('07:00');
  const [jamPulang, setJamPulang] = useState('13:00');

  // Manual Mode State
  const [siswaList, setSiswaList] = useState([]);
  const [isManualLoading, setIsManualLoading] = useState(false);

  // Bulk Izin State
  const [manualKelas, setManualKelas] = useState('');
  const [manualStatus, setManualStatus] = useState('Sakit');
  const [manualAlasan, setManualAlasan] = useState('');
  const [selectedSiswaIds, setSelectedSiswaIds] = useState([]);
  const [availableKelas, setAvailableKelas] = useState([]);

  // Rekap State
  const [rekapPeriod, setRekapPeriod] = useState('hari_ini');
  const [rekapData, setRekapData] = useState([]);
  const [isRekapLoading, setIsRekapLoading] = useState(false);
  const [rekapStats, setRekapStats] = useState({ hadir: 0, izin: 0, terlambat: 0, bolos: 0 });

  useEffect(() => {
    if (currentTab === 'manual') {
      fetchSiswaData();
    } else if (currentTab === 'rekap') {
      fetchRekapData();
    }
  }, [currentTab, rekapPeriod, tanggal]);

  // One-time effect untuk merestore kolom kelas pada siswa yang Lulus menjadi 'IX'
  useEffect(() => {
    const restoreKelasLulus = async () => {
      try {
        await supabase
          .from('data_siswa')
          .update({ kelas: 'IX' })
          .ilike('status_keaktifan', 'lulus')
          .is('kelas', null);
      } catch (e) {
        console.error(e);
      }
    };
    restoreKelasLulus();
  }, []);

  const sendWhatsAppNotification = (nama, kelas, wa_ortu, status, waktu) => {
    try {
      console.log("Fonnte: Mulai mengirim WA untuk", nama);
      const token = import.meta.env.VITE_FONNTE_TOKEN;
      console.log("Fonnte Token loaded:", token ? "YES" : "NO");
      
      if (!token) return; // Jika belum disetting di .env, lewati saja

      // Bersihkan karakter selain angka (menghapus spasi, strip, tanda plus, dll)
      let noWa = (wa_ortu || '').toString().replace(/\D/g, '');
      console.log("Fonnte: Nomor raw dari DB:", wa_ortu, "-> Bersih:", noWa);
      
      // (Opsional) Jika Fonnte butuh format 62, ubah awalan 0 menjadi 62
      if (noWa.startsWith('0')) {
        noWa = '62' + noWa.substring(1);
      }

      console.log("Fonnte: Nomor final dikirim:", noWa);
      if (!noWa || noWa.length < 9) {
         console.log("Fonnte: Batal kirim, nomor tidak valid");
         return;
      }

      // Generate Random ID untuk variasi pesan agar tidak terdeteksi spam/pesan berulang
      const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const pesan = `*NOTIFIKASI ABSENSI SMP IT HM*\n\nYth. Bapak/Ibu Wali Murid,\nMemberitahukan bahwa ananda:\n\nNama: *${nama}*\nKelas: *${kelas}*\nStatus: *${status}*\nWaktu: *${waktu}*\n\nTerima kasih.\n\n_Ref: ${uniqueId}_`;

      const data = new URLSearchParams();
      data.append('target', noWa);
      data.append('message', pesan);
      
      // Mengatur delay Fonnte antara 15 hingga 30 detik untuk menghindari blokir
      const randomDelay = Math.floor(Math.random() * (30 - 15 + 1)) + 15;
      data.append('delay', randomDelay.toString());

      fetch('/api/fonnte/send', {
        method: 'POST',
        headers: {
          'Authorization': token
        },
        body: data
      })
      .then(res => res.json())
      .then(res => {
         console.log("Fonnte Response:", res);
      })
      .catch(err => console.error('Fonnte fetch error:', err));
    } catch (e) {
      console.error('Gagal menyiapkan kirim WA:', e);
    }
  };

  const fetchRekapData = async () => {
    setIsRekapLoading(true);
    try {
      const today = new Date();
      let startDateStr = '';
      let endDateStr = '';

      if (rekapPeriod === 'hari_ini') {
        const d = today.toISOString().split('T')[0];
        startDateStr = d;
        endDateStr = d;
      } else if (rekapPeriod === 'minggu_ini') {
        const dayOfWeek = today.getDay() || 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek + 1);
        startDateStr = monday.toISOString().split('T')[0];
        endDateStr = today.toISOString().split('T')[0];
      } else if (rekapPeriod === 'bulan_ini') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        startDateStr = firstDay.toISOString().split('T')[0];
        endDateStr = lastDay.toISOString().split('T')[0];
      } else if (rekapPeriod === 'semester_ini') {
        const m = today.getMonth();
        const y = today.getFullYear();
        if (m >= 6) {
          startDateStr = `${y}-07-01`;
          endDateStr = `${y}-12-31`;
        } else {
          startDateStr = `${y}-01-01`;
          endDateStr = `${y}-06-30`;
        }
      }

      let query = supabase
        .from('presensi_siswa')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('waktu_masuk', { ascending: false });

      if (rekapPeriod !== 'semua') {
        query = query.gte('tanggal', startDateStr).lte('tanggal', endDateStr);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Ambil NIPD unik dari data rekap
      const uniqueNipds = [...new Set((data || []).map(d => d.nipd).filter(Boolean))];
      
      // Fetch nama dan kelas dari data_siswa untuk NIPD tersebut
      let siswaMap = {};
      if (uniqueNipds.length > 0) {
        const { data: siswaData } = await supabase
          .from('data_siswa')
          .select('nipd, nama, kelas')
          .in('nipd', uniqueNipds);
          
        if (siswaData) {
          siswaData.forEach(s => {
            siswaMap[s.nipd] = { nama: s.nama, kelas: s.kelas };
          });
        }
      }

      // Gabungkan data agar tersinkron dengan data_siswa terbaru
      const finalData = (data || []).map(d => ({
        ...d,
        nama: siswaMap[d.nipd]?.nama || d.nama || 'Siswa Tidak Ditemukan',
        kelas: siswaMap[d.nipd]?.kelas || d.kelas || '-'
      }));

      setRekapData(finalData);

      let hadir = 0, izin = 0, terlambat = 0, bolos = 0;
      finalData.forEach(d => {
        const st = d.status || '';
        if (st.includes('Hadir')) hadir++;
        if (st.includes('Izin') || st.includes('Sakit') || st.includes('Dispensasi')) izin++;
        if (st.includes('Terlambat')) terlambat++;
        if (st.includes('Bolos')) bolos++;
      });
      setRekapStats({ hadir, izin, terlambat, bolos });

    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal memuat data rekap.', 'error');
    } finally {
      setIsRekapLoading(false);
    }
  };

  const fetchSiswaData = async () => {
    setIsManualLoading(true);
    try {
      // Fetch Siswa
      const { data: dataSiswa, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('id, nipd, nama, kelas, status_keaktifan, wa_ortu')
        .ilike('status_keaktifan', 'aktif')
        .order('nama');

      if (errSiswa) throw errSiswa;

      // Fetch Presensi Hari Ini
      const { data: dataAbsen, error: errAbsen } = await supabase
        .from('presensi_siswa')
        .select('nipd')
        .eq('tanggal', tanggal);

      if (errAbsen) throw errAbsen;

      // Filter: Hanya siswa yang BELUM ada di tabel presensi_siswa pada tanggal ini
      const absenNipds = (dataAbsen || []).map(a => a.nipd);
      const siswaBelumAbsen = (dataSiswa || []).filter(s => !absenNipds.includes(s.nipd));

      setSiswaList(siswaBelumAbsen);

      // Fetch Kelas dari Supabase
      const { data: dataKelas, error: errKelas } = await supabase
        .from('data_kelas')
        .select('nama_kelas')
        .order('nama_kelas');

      if (!errKelas && dataKelas) {
        setAvailableKelas(dataKelas.map(k => k.nama_kelas));
      } else if (dataSiswa) {
        // Fallback jika gagal fetch kelas
        setAvailableKelas([...new Set(dataSiswa.map(s => s.kelas).filter(Boolean))].sort());
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal memuat data siswa/kelas.', 'error');
    } finally {
      setIsManualLoading(false);
    }
  };

  // Fungsi helper Tahun Ajaran & Semester
  const getTahunAjaranSemester = () => {
    const d = new Date(tanggal);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const semester = m >= 7 ? 'Ganjil' : 'Genap';
    const tahun_ajaran = m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
    return { tahun_ajaran, semester };
  };

  const filteredSiswa = manualKelas ? siswaList.filter(s => {
    if (!s.kelas) return false;
    return String(s.kelas).trim().toLowerCase() === String(manualKelas).trim().toLowerCase();
  }) : [];

  const toggleSiswaSelection = (nipd) => {
    setSelectedSiswaIds(prev =>
      prev.includes(nipd) ? prev.filter(id => id !== nipd) : [...prev, nipd]
    );
  };

  const handleSelectAll = () => {
    if (selectedSiswaIds.length === filteredSiswa.length && filteredSiswa.length > 0) {
      setSelectedSiswaIds([]);
    } else {
      setSelectedSiswaIds(filteredSiswa.map(s => s.nipd));
    }
  };

  const submitBulkManual = async () => {
    if (isProcessingRef.current) return;

    if (selectedSiswaIds.length === 0) {
      return Swal.fire('Peringatan', 'Belum ada siswa yang dipilih!', 'warning');
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    try {
      const { tahun_ajaran, semester } = getTahunAjaranSemester();
      const now = new Date();
      const jamSekarang = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const selectedSiswaList = filteredSiswa.filter(s => selectedSiswaIds.includes(s.nipd));

      const payloadArray = selectedSiswaList.map(siswa => ({
        nipd: siswa.nipd,
        nama: siswa.nama,
        kelas: siswa.kelas,
        tanggal: tanggal,
        waktu_masuk: jamSekarang,
        status: manualStatus,
        alasan: manualAlasan || '-',
        tahun_ajaran,
        semester
      }));

      // Lakukan pengecekan apakah mereka sudah ada absensinya hari ini
      // (Untuk Upsert Bulk di Supabase, kita gunakan upsert dengan onConflict)
      const { error } = await supabase
        .from('presensi_siswa')
        .upsert(payloadArray, { onConflict: 'nipd,tanggal' });

      if (error) throw error;

      Swal.fire('Berhasil!', `Presensi ${manualStatus} untuk ${payloadArray.length} siswa berhasil disimpan.`, 'success');
      
      // Kirim Notifikasi WA ke masing-masing siswa yang dipilih secara background dengan JEDA (Anti-Spam)
      let currentDelayMs = 0;
      selectedSiswaList.forEach((siswa, index) => {
        // Tambahkan delay acak antara 15000ms hingga 30000ms untuk tiap pengiriman berikutnya
        const randomMs = Math.floor(Math.random() * (30000 - 15000 + 1)) + 15000;
        currentDelayMs += (index === 0 ? 0 : randomMs);
        
        setTimeout(() => {
          sendWhatsAppNotification(siswa.nama, siswa.kelas, siswa.wa_ortu, manualStatus, jamSekarang);
        }, currentDelayMs);
      });

      // Reset form selection
      setSelectedSiswaIds([]);
      setManualAlasan('');

      // Refresh list agar yang barusan disubmit hilang dari layar
      fetchSiswaData();
    } catch (e) {
      console.error(e);
      const errorMsg = e.message || (typeof e === 'string' ? e : JSON.stringify(e));
      Swal.fire('Error', `Gagal memproses presensi: ${errorMsg}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const SECRET_KEY = import.meta.env.VITE_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
  };

  const changeTipeHari = (tipe) => {
    setTipeHari(tipe);
    if (tipe === 'reguler') {
      setJamMasuk('07:00');
      setJamPulang('12:40');
    } else if (tipe === 'ramadhan') {
      setJamMasuk('21:00');
      setJamPulang('22:00');
    } else if (tipe === 'spesial') {
      setJamMasuk('08:00');
      setJamPulang('10:00');
    }
  };

  const processScanResult = async (decodedText) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    let nipd = '';
    try {
      const bytes = CryptoJS.AES.decrypt(decodedText, SECRET_KEY);
      nipd = bytes.toString(CryptoJS.enc.Utf8).trim();

      if (!nipd) {
        throw new Error('Hasil dekripsi kosong');
      }
    } catch (e) {
      console.error("Gagal mendeskripsi QR:", e);
      Swal.fire('Tidak Valid', 'QR Code tidak dikenali atau bukan format resmi.', 'error');

      // Delay to avoid spam
      setTimeout(() => setIsProcessing(false), 3000);
      return;
    }

    try {
      // 1. Cari data siswa berdasarkan NIPD
      const { data: dataSiswa, error: errSiswa } = await supabase
        .from('data_siswa')
        .select('nipd, nama, kelas, wa_ortu')
        .eq('nipd', nipd)
        .maybeSingle();

      if (errSiswa) throw errSiswa;
      if (!dataSiswa) {
        Swal.fire('Tidak Ditemukan', `Siswa dengan NIPD ${nipd} tidak ditemukan.`, 'warning');
        setIsProcessing(false);
        return;
      }

      // 2. Cek apakah sudah absen masuk/pulang hari ini
      const { data: existingDataList, error: errCheck } = await supabase
        .from('presensi_siswa')
        .select('*')
        .eq('nipd', nipd)
        .eq('tanggal', tanggal)
        .order('created_at', { ascending: false })
        .limit(1);

      if (errCheck) throw errCheck;

      const existingData = existingDataList && existingDataList.length > 0 ? existingDataList[0] : null;

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const jM = timeToMinutes(jamMasuk);
      const jP = timeToMinutes(jamPulang);

      if (!existingData) {
        // Belum absen masuk
        let actStatus = 'Hadir (Blm Pulang)';
        if (timeToMinutes(currentTime) > jM) {
          actStatus = 'Terlambat';
        }

        const { tahun_ajaran, semester } = getTahunAjaranSemester();

        const payload = {
          nipd: dataSiswa.nipd,
          nama: dataSiswa.nama,
          kelas: dataSiswa.kelas,
          tanggal: tanggal,
          waktu_masuk: currentTime,
          status: actStatus,
          alasan: '-',
          tahun_ajaran,
          semester
        };
        const { error: errInsert } = await supabase.from('presensi_siswa').insert(payload);
        if (errInsert) throw errInsert;

        Swal.fire({
          icon: 'success',
          title: 'TAP MASUK BERHASIL',
          html: `<b class="text-xl">${dataSiswa.nama}</b><br><span class="text-primary font-bold">Waktu: ${currentTime}</span>`,
          timer: 2000,
          showConfirmButton: false
        });

        // Kirim Notifikasi WA Masuk/Terlambat
        sendWhatsAppNotification(dataSiswa.nama, dataSiswa.kelas, dataSiswa.wa_ortu, actStatus, currentTime);

      } else {
        // Sudah ada data presensi hari ini
        if (existingData.status.includes('Izin') || existingData.status.includes('Sakit') || existingData.status.includes('Dispensasi')) {
          Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'Siswa Berstatus Izin/Sakit!', showConfirmButton: false, timer: 2000 });
          return;
        }

        if (existingData.waktu_masuk && existingData.waktu_pulang) {
          Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'Sudah Absen Pulang!', showConfirmButton: false, timer: 2000 });
          return;
        }

        if (existingData.waktu_masuk) {
          const diffMins = timeToMinutes(currentTime) - timeToMinutes(existingData.waktu_masuk);
          if (diffMins < 5) {
            Swal.fire({ toast: true, position: 'top', icon: 'warning', title: 'Tap Terlalu Cepat!', showConfirmButton: false, timer: 2000 });
            return;
          }

          // Absen pulang
          let actStatus = 'Hadir';
          const wMasuk = existingData.waktu_masuk;

          if (timeToMinutes(wMasuk) > jM) {
            actStatus = 'Terlambat';
          } else if (timeToMinutes(currentTime) < jP) {
            actStatus = 'Bolos';
          }

          const payload = {
            waktu_pulang: currentTime,
            status: actStatus
          };
          const { error: errUpdate } = await supabase
            .from('presensi_siswa')
            .update(payload)
            .eq('id', existingData.id);

          if (errUpdate) throw errUpdate;

          Swal.fire({
            icon: 'success',
            title: 'TAP PULANG BERHASIL',
            html: `<b class="text-xl">${dataSiswa.nama}</b><br><span class="text-primary font-bold">Waktu: ${currentTime}</span>`,
            timer: 2000,
            showConfirmButton: false
          });

          // Kirim Notifikasi WA Pulang/Bolos
          sendWhatsAppNotification(dataSiswa.nama, dataSiswa.kelas, dataSiswa.wa_ortu, actStatus, currentTime);
        }
      }
    } catch (e) {
      console.error("Gagal mencatat presensi:", e);
      const errorMsg = e.message || (typeof e === 'string' ? e : JSON.stringify(e));
      Swal.fire('Error', `Gagal memproses presensi: ${errorMsg}`, 'error');
    } finally {
      // Beri delay sedikit sebelum bisa scan lagi untuk menghindari spam
      setTimeout(() => {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }, 3000);
    }
  };

  const handleManualAction = async (siswa, status, keterangan) => {
    Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
    try {
      // Cek data existing
      const { data: existingDataList, error: errCheck } = await supabase
        .from('presensi_siswa')
        .select('id')
        .eq('nipd', siswa.nipd)
        .eq('tanggal', tanggal)
        .order('created_at', { ascending: false })
        .limit(1);

      const existingData = existingDataList && existingDataList.length > 0 ? existingDataList[0] : null;

      const payload = {
        nipd: siswa.nipd,
        nama: siswa.nama,
        kelas: siswa.kelas,
        tanggal: tanggal,
        status: status,
        alasan: keterangan || '-'
      };

      if (status === 'Hadir') {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        payload.waktu_masuk = currentTime;
      }

      let error = null;
      if (existingData) {
        const { error: errUpdate } = await supabase.from('presensi_siswa').update(payload).eq('id', existingData.id);
        error = errUpdate;
      } else {
        const { error: errInsert } = await supabase.from('presensi_siswa').insert(payload);
        error = errInsert;
      }

      if (error) throw error;

      Swal.fire('Berhasil!', `Status ${siswa.nama} berhasil diubah menjadi ${status}.`, 'success');
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Gagal menyimpan presensi.', 'error');
    }
  };

  const openManualForm = (siswa) => {
    Swal.fire({
      title: `Input Presensi: ${siswa.nama}`,
      html: `
        <select id="swal-status" class="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4">
          <option value="Izin">Izin</option>
          <option value="Sakit">Sakit</option>
          <option value="Dispensasi">Dispensasi</option>
          <option value="Hadir">Hadir (Manual)</option>
        </select>
        <textarea id="swal-alasan" rows="3" placeholder="Keterangan / Alasan (Opsional)" class="w-full px-4 py-3 border border-gray-200 rounded-xl"></textarea>
      `,
      showCancelButton: true,
      confirmButtonText: 'Simpan',
      cancelButtonText: 'Batal',
      preConfirm: () => {
        const status = document.getElementById('swal-status').value;
        const alasan = document.getElementById('swal-alasan').value;
        return { status, alasan };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        handleManualAction(siswa, result.value.status, result.value.alasan);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Clock className="text-primary" /> Presensi Siswa
          </h2>
          <p className="text-gray-500 text-sm mt-1">Sistem presensi QR Code dan input manual.</p>
        </div>
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => setCurrentTab('scan')}
            className={`px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors ${currentTab === 'scan' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <QrCode size={16} /> Scan QR
          </button>
          <button
            onClick={() => setCurrentTab('manual')}
            className={`px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors border-l border-gray-100 ${currentTab === 'manual' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Edit3 size={16} /> Input Manual
          </button>
          <button
            onClick={() => setCurrentTab('rekap')}
            className={`px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors border-l border-gray-100 ${currentTab === 'rekap' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <FileText size={16} /> Rekap Data
          </button>
        </div>
      </div>

      {currentTab !== 'rekap' && (
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-gray-700">Tanggal Aktif:</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="date"
                value={tanggal}
                onChange={e => setTanggal(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50 font-bold"
              />
            </div>
          </div>

          {currentTab === 'scan' && (
            <>
              <div className="w-px h-8 bg-gray-200 hidden md:block"></div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">Tipe Hari:</label>
                <select
                  value={tipeHari}
                  onChange={(e) => changeTipeHari(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50 font-bold"
                >
                  <option value="reguler">Hari Reguler</option>
                  <option value="ramadhan">Bulan Ramadhan</option>
                  <option value="spesial">Hari Spesial/Event</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">Jam Masuk:</label>
                <input
                  type="time"
                  value={jamMasuk}
                  onChange={(e) => setJamMasuk(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50 font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">Jam Pulang:</label>
                <input
                  type="time"
                  value={jamPulang}
                  onChange={(e) => setJamPulang(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50 font-bold"
                />
              </div>
            </>
          )}
        </div>
      )}

      {currentTab === 'scan' && (
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-gray-100 max-w-3xl mx-auto w-full text-center">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Scanner QR Code</h3>
          <p className="text-gray-500 mb-8">Arahkan QR Code Kartu Pelajar ke kamera untuk presensi.</p>

          <div className="mx-auto overflow-hidden rounded-2xl border-4 border-dashed border-gray-200 p-2 max-w-md bg-gray-50 relative">
            <QrScanner onScan={processScanResult} isProcessing={isProcessing} />
            {isProcessing && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl z-10">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p className="font-bold text-primary">Memproses...</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-center gap-8">
            <div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 px-4 py-2 rounded-xl">
              <CheckCircle size={20} /> <span className="text-sm">Scan Masuk</span>
            </div>
            <div className="flex items-center gap-2 text-blue-600 font-medium bg-blue-50 px-4 py-2 rounded-xl">
              <CheckCircle size={20} /> <span className="text-sm">Scan Pulang</span>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'manual' && (
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 max-w-4xl mx-auto">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Edit3 className="text-primary" /> Input Izin / Sakit Massal Siswa
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Kelas</label>
              <select
                value={manualKelas}
                onChange={e => {
                  setManualKelas(e.target.value);
                  setSelectedSiswaIds([]);
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary font-semibold text-primary outline-none bg-gray-50"
              >
                <option value="">-- Silahkan Pilih Kelas --</option>
                {availableKelas.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Status Keterangan</label>
              <select
                value={manualStatus}
                onChange={e => setManualStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary font-semibold text-orange-600 outline-none bg-gray-50"
              >
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin / Acara Keluarga</option>
                <option value="Dispensasi">Dispensasi Sekolah</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Keterangan Tambahan (Opsional)</label>
            <input
              type="text"
              value={manualAlasan}
              onChange={e => setManualAlasan(e.target.value)}
              placeholder="Contoh: Sakit demam, lomba antar sekolah, dll"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-gray-50"
            />
          </div>

          {manualKelas && (
            <div className="border-t border-gray-100 pt-6">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-primary">Daftar Siswa Kelas {manualKelas} (Centang yang Izin)</label>
                <button
                  onClick={handleSelectAll}
                  className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-lg font-bold text-gray-700 transition"
                >
                  {selectedSiswaIds.length === filteredSiswa.length && filteredSiswa.length > 0 ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 max-h-72 overflow-y-auto">
                {isManualLoading ? (
                  <p className="text-center text-gray-400 py-4">Memuat data siswa...</p>
                ) : filteredSiswa.length === 0 ? (
                  <p className="text-center text-gray-400 py-4">Tidak ada siswa di kelas ini.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredSiswa.map(siswa => (
                      <label
                        key={siswa.id}
                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition ${selectedSiswaIds.includes(siswa.nipd) ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100 hover:border-orange-100'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSiswaIds.includes(siswa.nipd)}
                          onChange={() => toggleSiswaSelection(siswa.nipd)}
                          className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-800">{siswa.nama}</span>
                          <span className="text-xs text-gray-500 font-mono">{siswa.nipd}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={submitBulkManual}
                  disabled={selectedSiswaIds.length === 0 || isProcessing}
                  className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${selectedSiswaIds.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20'}`}
                >
                  {isProcessing ? (
                    <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</>
                  ) : (
                    <><Edit3 size={18} /> Simpan Presensi {manualStatus} untuk {selectedSiswaIds.length} Siswa</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentTab === 'rekap' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <PieChart className="text-primary" size={20} /> Analitik Kehadiran
            </h3>
            <div className="flex items-center gap-2 w-full md:w-auto bg-gray-50 p-2 rounded-xl border border-gray-200">
              <Filter size={16} className="text-gray-400 ml-2" />
              <select
                value={rekapPeriod}
                onChange={e => setRekapPeriod(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-primary outline-none py-1 pr-6 cursor-pointer"
              >
                <option value="hari_ini">Hari Ini</option>
                <option value="minggu_ini">Minggu Ini</option>
                <option value="bulan_ini">Bulan Ini</option>
                <option value="semester_ini">Semester Ini</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-2xl p-5 border border-green-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-green-600 uppercase mb-1">Hadir</p>
                <h4 className="text-3xl font-bold text-gray-800">{rekapStats.hadir}</h4>
              </div>
              <CheckCircle size={36} className="text-green-200" />
            </div>
            <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-orange-600 uppercase mb-1">Izin/Sakit</p>
                <h4 className="text-3xl font-bold text-gray-800">{rekapStats.izin}</h4>
              </div>
              <AlertCircle size={36} className="text-orange-200" />
            </div>
            <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-yellow-600 uppercase mb-1">Terlambat</p>
                <h4 className="text-3xl font-bold text-gray-800">{rekapStats.terlambat}</h4>
              </div>
              <Clock size={36} className="text-yellow-200" />
            </div>
            <div className="bg-red-50 rounded-2xl p-5 border border-red-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-red-600 uppercase mb-1">Bolos</p>
                <h4 className="text-3xl font-bold text-gray-800">{rekapStats.bolos}</h4>
              </div>
              <XCircle size={36} className="text-red-200" />
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Daftar Presensi {rekapPeriod.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Siswa</th>
                    <th className="px-6 py-4">Masuk</th>
                    <th className="px-6 py-4">Pulang</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {isRekapLoading ? (
                    <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">Memuat data rekap...</td></tr>
                  ) : rekapData.length === 0 ? (
                    <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">Belum ada data presensi pada periode ini.</td></tr>
                  ) : (
                    rekapData.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-gray-600 font-bold">{log.tanggal}</td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-800">{log.nama}</p>
                          <p className="text-[11px] text-gray-500 font-mono">{log.nipd} • Kls {log.kelas}</p>
                        </td>
                        <td className="px-6 py-4 font-mono text-primary font-bold">{log.waktu_masuk || '-'}</td>
                        <td className="px-6 py-4 font-mono text-red-500 font-bold">{log.waktu_pulang || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${log.status.includes('Terlambat') ? 'bg-yellow-100 text-yellow-700' :
                            log.status.includes('Bolos') ? 'bg-red-100 text-red-700' :
                              (log.status.includes('Izin') || log.status.includes('Sakit')) ? 'bg-orange-100 text-orange-700' :
                                'bg-green-100 text-green-700'
                            }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for QR Scanner
function QrScanner({ onScan, isProcessing }) {
  const qrCodeId = useRef(`qr-reader-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
  const html5QrCode = useRef(null);
  const onScanRef = useRef(onScan);
  const isProcessingRef = useRef(isProcessing);
  const startPromiseRef = useRef(null);

  // Selalu update referensi agar tidak terjadi "stale closure"
  useEffect(() => {
    onScanRef.current = onScan;
    isProcessingRef.current = isProcessing;
  }, [onScan, isProcessing]);

  useEffect(() => {
    // Gunakan variabel lokal agar cleanup function merujuk pada instance yang tepat
    // (Mencegah bug kamera bocor akibat React Strict Mode yang memanggil ulang useEffect)
    const scannerInstance = new Html5Qrcode(qrCodeId.current);

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    };

    // Mulai kamera dan simpan promisenya
    const startPromise = scannerInstance.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        if (!isProcessingRef.current) {
          onScanRef.current(decodedText);
        }
      },
      (errorMessage) => {
        // Abaikan error parse saat tidak mendeteksi QR code
      }
    );

    startPromise.catch(err => {
      console.warn("Kamera dibatalkan atau gagal dimulai:", err);
    });

    return () => {
      // Fungsi untuk menghentikan kamera dengan aman untuk instance spesifik ini
      const stopAndClear = () => {
        try {
          if (scannerInstance.isScanning || scannerInstance.getState() === 2 /* SCANNING */) {
            scannerInstance.stop().then(() => {
              scannerInstance.clear();
            }).catch(console.error);
          } else {
            scannerInstance.clear();
          }
        } catch (e) {
          console.error("Gagal saat mencoba stop kamera:", e);
        }
      };

      // Jika start() masih berjalan saat unmount, tunggu sampai selesai lalu segera matikan
      if (startPromise) {
        startPromise
          .then(() => stopAndClear())
          .catch(() => stopAndClear());
      } else {
        stopAndClear();
      }
    };
  }, []);

  return (
    <div id={qrCodeId.current} className="w-full min-h-[300px] bg-black rounded-xl overflow-hidden flex items-center justify-center relative z-0">
      {/* Container video stream Html5Qrcode */}
    </div>
  );
}
