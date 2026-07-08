import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Printer, QrCode, Trash2, RefreshCw, Calculator, User, Search, Save, AlertCircle, Camera, X, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import CryptoJS from 'crypto-js';
import { Html5QrcodeScanner } from 'html5-qrcode';

const SECRET_KEY = import.meta.env.VITE_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

export default function TagihanSiswa() {
  // Config Filters
  const [tahunPelajaran, setTahunPelajaran] = useState('2025/2026');
  const [semester, setSemester] = useState('Tahunan');

  // Scanner State
  const [scannerInput, setScannerInput] = useState('');
  const scannerInputRef = useRef(null);

  // Data State
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [biayaItems, setBiayaItems] = useState([]);
  const [pemasukanList, setPemasukanList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form Pemasukan
  const [inputTanggal, setInputTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [inputNominal, setInputNominal] = useState('');

  // Saldo & Subsidi
  const [saldo, setSaldo] = useState(0);
  const [subsidi, setSubsidi] = useState(0);
  const [isSavingSaldo, setIsSavingSaldo] = useState(false);

  // Camera Scanner State
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Search State
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Pastikan input scanner selalu fokus jika tidak sedang mengetik di tempat lain (Opsional, untuk physical scanner)
  useEffect(() => {
    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, []);

  // Reload data if config changes but we have a student selected
  useEffect(() => {
    if (selectedSiswa) {
      loadLedger(selectedSiswa);
    }
  }, [tahunPelajaran, semester]);

  // Auto-complete Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchInput.trim().length >= 2) {
        setIsSearching(true);
        try {
          const { data, error } = await supabase
            .from('data_siswa')
            .select('*')
            .ilike('nama', `%${searchInput}%`)
            .limit(10);
            
          if (error) throw error;
          setSearchResults(data || []);
          setShowDropdown(true);
        } catch (err) {
          console.error('Error searching siswa:', err);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  useEffect(() => {
    let scanner = null;
    if (isCameraOpen) {
      scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render(
        (decodedText) => {
          // On success
          if (scanner) {
            scanner.clear().catch(e => console.warn(e));
          }
          setIsCameraOpen(false);
          processScanText(decodedText);
        },
        (errorMessage) => {
          // Ignore general read errors (it throws constantly when finding nothing)
        }
      );
    }
    return () => {
      if (scanner) {
        scanner.clear().catch(e => console.error(e));
      }
    };
  }, [isCameraOpen]);

  const decryptNIPD = (encryptedText) => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || encryptedText;
    } catch (e) {
      return encryptedText;
    }
  };

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    if (!scannerInput.trim()) return;
    const nipdToSearch = scannerInput.trim();
    setScannerInput('');
    await processScanText(nipdToSearch);
  };

  const handleSelectSiswa = async (siswa) => {
    setShowDropdown(false);
    setSearchInput('');
    setSelectedSiswa(siswa);
    await loadLedger(siswa);
  };

  const processScanText = async (scannedText) => {
    setIsLoading(true);
    const nipdToSearch = decryptNIPD(scannedText);

    if (scannerInputRef.current) scannerInputRef.current.focus();

    try {
      // 1. Cari siswa berdasarkan NIPD
      const { data: siswaData, error: siswaError } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('nipd', nipdToSearch)
        .maybeSingle();

      if (siswaError) throw siswaError;

      if (!siswaData) {
        Swal.fire('Tidak Ditemukan', `Siswa dengan NIPD: ${nipdToSearch} tidak ditemukan di database.`, 'error');
        setIsLoading(false);
        return;
      }

      // 2. Cek Cabang
      if (siswaData.status_siswa && siswaData.status_siswa.toLowerCase() === 'cabang') {
        Swal.fire({
          icon: 'warning',
          title: 'Siswa Cabang',
          text: 'Urusan pembayaran siswa ini pada SMP IT Assalam Kebondanas.'
        });
        setIsLoading(false);
        return;
      }

      // 3. Set Siswa dan Load Data Ledger
      setSelectedSiswa(siswaData);
      loadLedger(siswaData);

    } catch (err) {
      console.error(err);
      Swal.fire('Gagal', 'Terjadi kesalahan saat memproses data scan.', 'error');
      setIsLoading(false);
    }
  };

  const loadLedger = async (siswa) => {
    setIsLoading(true);
    try {
      // Ambil tingkat/ID kelas dari tabel data_kelas berdasarkan nama kelas siswa
      let tingkatSiswa = 7;
      if (siswa.kelas) {
        const { data: kelasData } = await supabase
          .from('data_kelas')
          .select('id, tingkat')
          .eq('nama_kelas', siswa.kelas)
          .maybeSingle();

        if (kelasData && kelasData.tingkat) {
          tingkatSiswa = kelasData.tingkat;
        }
      }

      // Pemetaan Tipe Siswa dari database (Baru / Pindahan) ke format Pengembangan Mutu
      let tipeSiswa = 'Siswa Baru';
      if (siswa.status_siswa) {
        const statusLower = siswa.status_siswa.toLowerCase();
        if (statusLower === 'baru') {
          tipeSiswa = 'Siswa Baru';
        } else if (statusLower === 'pindahan') {
          if (tingkatSiswa === 8) tipeSiswa = 'Pindahan Kelas 8';
          else if (tingkatSiswa === 9) tipeSiswa = 'Pindahan Kelas 9';
          else tipeSiswa = 'Siswa Baru'; // fallback
        } else {
          tipeSiswa = siswa.status_siswa;
        }
      }

      // A. Load Rincian Biaya dari Pengembangan Mutu
      const { data: configData, error: configError } = await supabase
        .from('biaya_pengembangan_mutu')
        .select('data_anggaran')
        .eq('tahun_pelajaran', tahunPelajaran)
        .eq('semester', semester)
        .eq('tipe_siswa', tipeSiswa)
        .maybeSingle();

      if (configError) throw configError;

      let extractedItems = [];
      if (configData && configData.data_anggaran) {
        configData.data_anggaran.forEach(item => {
          // Cari kolom tingkatX (format baru) atau kelasX (format lama)
          const cost = item[`tingkat${tingkatSiswa}`] || item[`kelas${tingkatSiswa}`] || 0;
          if (cost > 0) {
            extractedItems.push({
              id: item.id,
              uraian: item.uraian,
              biaya: cost
            });
          }
        });
      }
      setBiayaItems(extractedItems);

      // B. Load Riwayat Pemasukan
      const { data: pemasukanData, error: pemasukanError } = await supabase
        .from('tb_pemasukan_siswa')
        .select('*')
        .eq('siswa_id', siswa.id)
        .eq('tahun_pelajaran', tahunPelajaran)
        .eq('semester', semester)
        .order('tanggal', { ascending: true })
        .order('created_at', { ascending: true });

      if (pemasukanError) throw pemasukanError;
      setPemasukanList(pemasukanData || []);

      // C. Load Saldo & Subsidi
      const { data: saldoData, error: saldoError } = await supabase
        .from('tb_saldo_siswa')
        .select('*')
        .eq('siswa_id', siswa.id)
        .eq('tahun_pelajaran', tahunPelajaran)
        .eq('semester', semester)
        .maybeSingle();

      if (saldoError) throw saldoError;

      if (saldoData) {
        setSaldo(saldoData.saldo_sebelumnya || 0);
        setSubsidi(saldoData.subsidi_pip || 0);
      } else {
        setSaldo(0);
        setSubsidi(0);
      }

    } catch (err) {
      console.error(err);
      Swal.fire('Peringatan', 'Terjadi kendala saat memuat ledger. Pastikan konfigurasi Pengembangan Mutu sudah tersedia.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSaldo = async () => {
    if (!selectedSiswa) return;
    setIsSavingSaldo(true);
    try {
      const payload = {
        siswa_id: selectedSiswa.id,
        tahun_pelajaran: tahunPelajaran,
        semester: semester,
        saldo_sebelumnya: saldo,
        subsidi_pip: subsidi,
        updated_at: new Date().toISOString()
      };

      // Check if exists
      const { data: existData } = await supabase
        .from('tb_saldo_siswa')
        .select('id')
        .eq('siswa_id', selectedSiswa.id)
        .eq('tahun_pelajaran', tahunPelajaran)
        .eq('semester', semester)
        .maybeSingle();

      let error;
      if (existData) {
        const res = await supabase.from('tb_saldo_siswa').update(payload).eq('id', existData.id);
        error = res.error;
      } else {
        const res = await supabase.from('tb_saldo_siswa').insert([payload]);
        error = res.error;
      }

      if (error) throw error;
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Data saldo dan subsidi berhasil diperbarui.', timer: 1500, showConfirmButton: false });
    } catch (err) {
      console.error(err);
      Swal.fire('Gagal', 'Gagal menyimpan saldo.', 'error');
    } finally {
      setIsSavingSaldo(false);
    }
  };

  const handleAddPemasukan = async () => {
    if (!selectedSiswa) {
      Swal.fire('Peringatan', 'Silakan scan kartu siswa terlebih dahulu.', 'warning');
      return;
    }
    if (!inputTanggal || !inputNominal) return;

    const nominalInt = parseInt(inputNominal.replace(/[^0-9]/g, ''), 10);
    if (!nominalInt || nominalInt <= 0) return;

    setIsLoading(true);
    try {
      const payload = {
        siswa_id: selectedSiswa.id,
        tahun_pelajaran: tahunPelajaran,
        semester: semester,
        tanggal: inputTanggal,
        nominal: nominalInt
      };

      const { error } = await supabase.from('tb_pemasukan_siswa').insert([payload]);
      if (error) throw error;

      setInputNominal('');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pemasukan ditambahkan!', timer: 1000, showConfirmButton: false });
      loadLedger(selectedSiswa);
    } catch (err) {
      console.error(err);
      Swal.fire('Gagal', 'Gagal menambahkan pemasukan.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePemasukan = (id) => {
    Swal.fire({
      title: 'Hapus Pemasukan?',
      text: "Data setoran ini akan dihapus permanen!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, hapus!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsLoading(true);
        try {
          const { error } = await supabase.from('tb_pemasukan_siswa').delete().eq('id', id);
          if (error) throw error;
          loadLedger(selectedSiswa);
        } catch (err) {
          console.error(err);
          Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus data.', 'error');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const totalHarusDibayar = biayaItems.reduce((sum, item) => sum + item.biaya, 0);
  const totalPemasukan = pemasukanList.reduce((sum, item) => sum + item.nominal, 0);
  const totalSudahBayar = totalPemasukan + saldo + subsidi;
  const selisih = totalHarusDibayar - totalSudahBayar;
  
  const isLunas = selisih === 0;
  const isLebih = selisih < 0;
  const isKurang = selisih > 0;
  
  const kembalian = isLebih ? Math.abs(selisih) : 0;
  const kurang = isKurang ? selisih : 0;

  // Waterfall Allocation Logic
  let remainingAlloc = totalSudahBayar;
  const allocatedItems = biayaItems.map(item => {
    let statusText = '';
    let statusColor = '';

    if (remainingAlloc >= item.biaya) {
      statusText = 'Lunas';
      statusColor = 'bg-green-100 text-green-700 border-green-200';
      remainingAlloc -= item.biaya;
    } else if (remainingAlloc > 0) {
      statusText = `Rp ${(item.biaya - remainingAlloc).toLocaleString('id-ID')}`;
      statusColor = 'bg-red-50 text-red-600 border-red-100'; // Partially paid shows remaining red
      remainingAlloc = 0;
    } else {
      statusText = `Rp ${item.biaya.toLocaleString('id-ID')}`;
      statusColor = 'bg-red-50 text-red-600 border-red-100';
    }

    return { ...item, statusText, statusColor };
  });

  return (
    <div className="flex flex-col h-full bg-bgSoft text-gray-800 font-sans min-h-screen pb-10 print:bg-white print:p-0">

      {/* SCANNER & SEARCH BAR (Non-Printable) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 print:hidden">
        
        {/* SCANNER QR */}
        <div className="bg-primary px-6 py-4 rounded-xl shadow-lg flex flex-col md:flex-row items-center gap-4 relative">
          <div className="flex items-center gap-3 text-white w-full md:w-auto">
            <QrCode size={28} className="shrink-0" />
            <div className="whitespace-nowrap">
              <h3 className="font-bold">Scan Kartu</h3>
              <p className="text-xs text-blue-200">Webcam / Scanner Fisik</p>
            </div>
          </div>
          <div className="flex-1 flex gap-2 w-full">
            <form onSubmit={handleScanSubmit} className="flex-1 relative min-w-0">
              <input
                ref={scannerInputRef}
                type="text"
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                placeholder="Ketik/Tembak..."
                className="w-full bg-white/10 border-2 border-white/20 text-white placeholder:text-white/50 px-3 py-2.5 rounded-lg focus:outline-none focus:border-white focus:bg-white/20 transition text-center uppercase font-mono text-sm"
              />
              <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white text-primary px-2.5 py-1 rounded-md font-bold text-xs hover:bg-blue-50 transition">
                PROSES
              </button>
            </form>
            <button
              onClick={() => setIsCameraOpen(true)}
              className="bg-white/10 border-2 border-white/20 text-white hover:bg-white/20 hover:border-white px-3 py-2.5 rounded-lg flex items-center justify-center transition shrink-0"
              title="Kamera Web"
            >
              <Camera size={20} />
            </button>
          </div>
          {isLoading && <RefreshCw className="absolute top-4 right-4 animate-spin text-white" size={20} />}
        </div>

        {/* SEARCH MANUAL */}
        <div className="bg-primary px-6 py-4 rounded-xl shadow-lg flex flex-col md:flex-row items-center gap-4 relative z-20">
          <div className="flex items-center gap-3 text-white w-full md:w-auto">
             <Search size={28} className="shrink-0" />
             <div className="whitespace-nowrap">
               <h3 className="font-bold">Cari Manual</h3>
               <p className="text-xs text-blue-200">Cari berdasarkan nama</p>
             </div>
          </div>
          <div className="flex-1 w-full relative min-w-0">
             <input 
               type="text"
               value={searchInput}
               onChange={(e) => setSearchInput(e.target.value)}
               onFocus={() => { if(searchResults.length > 0) setShowDropdown(true); }}
               placeholder="Ketik nama siswa..."
               className="w-full bg-white/10 border-2 border-white/20 text-white placeholder:text-white/50 px-3 py-2.5 rounded-lg focus:outline-none focus:border-white focus:bg-white/20 transition text-sm"
             />
             {isSearching && <RefreshCw size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/70" />}
          </div>
          
          {/* Dropdown Hasil Pencarian */}
          {showDropdown && searchResults.length > 0 && (
             <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white rounded-lg shadow-xl border border-gray-100 max-h-60 overflow-y-auto">
                {searchResults.map(s => (
                   <div key={s.id} onClick={() => handleSelectSiswa(s)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center transition">
                      <div>
                         <div className="font-bold text-gray-800 text-sm">{s.nama}</div>
                         <div className="text-xs text-gray-500 mt-0.5">NIPD: {s.nipd} • Kelas: {s.kelas || '-'}</div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shrink-0 ${s.status_keaktifan === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                         {s.status_keaktifan || 'Nonaktif'}
                      </span>
                   </div>
                ))}
             </div>
          )}
          
          {showDropdown && searchResults.length === 0 && searchInput.trim().length >= 2 && !isSearching && (
             <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white rounded-lg shadow-xl border border-gray-100 p-4 text-center text-gray-500 text-sm">
               Siswa tidak ditemukan.
             </div>
          )}
        </div>

      </div>

      {/* Modal Web Camera */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-primary p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg flex items-center gap-2"><Camera size={20} /> Arahkan Kartu ke Kamera</h3>
              <button onClick={() => setIsCameraOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition"><X size={20} /></button>
            </div>
            <div className="p-4 bg-black flex justify-center items-center min-h-[300px]">
              <div id="reader" className="w-full max-w-sm rounded-lg overflow-hidden border-2 border-primary"></div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-center">
              <p className="text-sm text-gray-500 font-medium text-center">Pastikan QR Code terlihat jelas dan berada di dalam bingkai kotak.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Action Bar (Non-Printable) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="text-gray-600" /> Buku Pembayaran & Ledger
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center">
            <select value={tahunPelajaran} onChange={(e) => setTahunPelajaran(e.target.value)} className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium outline-none shadow-sm">
              <option value="2023/2024">2023/2024</option>
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
            </select>
          </div>
          <button
            onClick={handlePrint}
            disabled={!selectedSiswa}
            className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2 rounded-lg shadow-sm transition flex items-center gap-2 font-medium disabled:opacity-50 flex-1 md:flex-none justify-center"
          >
            <Printer size={18} /> Cetak
          </button>
        </div>
      </div>

      {!selectedSiswa ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 flex flex-col items-center justify-center text-center print:hidden">
          <QrCode size={64} className="text-gray-200 mb-4" />
          <h2 className="text-xl font-bold text-gray-400 mb-2">Menunggu Scan Kartu Siswa...</h2>
          <p className="text-gray-400 max-w-md">Pastikan kursor berada di kotak input warna biru di atas, lalu gunakan alat scanner QR Code pada kartu siswa untuk memuat data tagihan secara instan.</p>
        </div>
      ) : (
        /* Main Ledger Card */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 print:shadow-none print:border-none print:p-0 animate-in fade-in zoom-in-95 duration-300">

          {/* Print Header */}
          <div className="flex items-center gap-6 border-b-2 border-gray-800 pb-4 mb-6">
            <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo Sekolah" className="w-20 h-20 object-contain" />
            <div>
              <h1 className="text-xl font-bold tracking-wider text-gray-900">BUKTI PEMBAYARAN</h1>
              <h2 className="text-2xl font-black text-gray-900 mt-1 uppercase">SMP IT HIDAYATUL MUBTADI-IEN</h2>
              <p className="text-gray-700 font-medium">TAHUN PELAJARAN {tahunPelajaran} (Semester {semester})</p>
              <p className="text-sm text-gray-500">Sukasenen - Compreng - Subang</p>
            </div>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 mb-8 bg-blue-50/50 p-4 rounded-xl border border-blue-100 print:bg-transparent print:border-none print:p-0">
            <div className="flex items-center gap-4">
              <label className="w-28 text-gray-600 font-semibold text-sm">Tipe Siswa</label>
              <span className="font-medium text-gray-900">: {selectedSiswa.status_siswa || 'Reguler'}</span>
            </div>
            <div className="flex items-center gap-4">
              <label className="w-28 text-gray-600 font-semibold text-sm">Nama</label>
              <span className="font-bold text-primary uppercase text-lg">: {selectedSiswa.nama}</span>
            </div>
            <div className="flex items-center gap-4">
              <label className="w-28 text-gray-600 font-semibold text-sm">Kelas</label>
              <span className="font-medium text-gray-900">: {selectedSiswa.kelas || '-'}</span>
            </div>
            <div className="flex items-center gap-4">
              <label className="w-28 text-gray-600 font-semibold text-sm">NIPD</label>
              <span className="font-medium text-gray-900">: {selectedSiswa.nipd || '-'}</span>
            </div>
          </div>

          {/* 2 Column Ledger Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* LEFT: Tabel Pemasukan */}
            <div className="lg:col-span-5 space-y-6">

              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 text-center font-bold text-gray-800 text-sm border-b border-gray-300 tracking-wide uppercase">
                  TABEL PEMASUKAN
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-r border-gray-300 px-3 py-2 text-center w-12">NO</th>
                      <th className="border-b border-r border-gray-300 px-3 py-2 text-center w-28">TANGGAL</th>
                      <th className="border-b border-gray-300 px-3 py-2 text-center">PEMASUKAN</th>
                      <th className="border-b border-l border-gray-300 px-3 py-2 text-center w-12 print:hidden">X</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pemasukanList.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-6 text-gray-400 italic">Belum ada histori pemasukan.</td>
                      </tr>
                    ) : (
                      pemasukanList.map((item, idx) => (
                        <tr key={item.id} className="bg-blue-50/30">
                          <td className="px-3 py-2 border-r border-gray-300 text-center font-medium">{idx + 1}</td>
                          <td className="px-3 py-2 border-r border-gray-300 text-center">{new Date(item.tanggal).toLocaleDateString('id-ID')}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-800">Rp {item.nominal.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2 border-l border-gray-300 text-center print:hidden">
                            <button onClick={() => handleDeletePemasukan(item.id)} className="text-red-400 hover:text-red-600 transition"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      ))
                    )}
                    {/* Empty rows to mimic excel look */}
                    {[...Array(Math.max(0, 8 - pemasukanList.length))].map((_, i) => (
                      <tr key={`empty-${i}`} className="bg-blue-50/10">
                        <td className="px-3 py-4 border-r border-gray-300"></td>
                        <td className="px-3 py-4 border-r border-gray-300"></td>
                        <td className="px-3 py-4"></td>
                        <td className="px-3 py-4 border-l border-gray-300 print:hidden"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                {/* Add Input Form - Hidden in Print */}
                <div className="bg-gray-50 p-3 border-t border-gray-300 flex items-center gap-2 print:hidden">
                  <input
                    type="date"
                    value={inputTanggal}
                    onChange={(e) => setInputTanggal(e.target.value)}
                    className="w-32 px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-primary font-medium"
                  />
                  <input
                    type="text"
                    value={inputNominal}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setInputNominal(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                    }}
                    placeholder="Nominal..."
                    className="flex-1 px-3 py-2 text-sm text-right font-bold text-gray-900 border border-gray-300 rounded focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleAddPemasukan}
                    className="bg-primary hover:bg-blue-800 text-white px-4 py-2 rounded font-bold transition flex gap-1"
                  >
                    <Plus size={18} /> BAYAR
                  </button>
                </div>
              </div>

              {/* Summary Left */}
              <div className="space-y-4">
                <div className="border border-gray-300 rounded-lg overflow-hidden text-sm">
                  <div className="flex border-b border-gray-300 bg-blue-50/30 items-center">
                    <div className="w-1/2 px-4 py-2 border-r border-gray-300 text-gray-700">Saldo Kls Sebelum :</div>
                    <div className="w-1/2 px-4 py-1.5 flex gap-2 group">
                      <span className="pt-1">Rp</span>
                      <input
                        type="number"
                        value={saldo}
                        onChange={(e) => setSaldo(parseInt(e.target.value || 0))}
                        className="w-full bg-transparent font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary rounded px-1 -ml-1 print:appearance-none print:p-0 print:border-none"
                      />
                    </div>
                  </div>
                  <div className="flex bg-blue-50/30 items-center border-b border-gray-300">
                    <div className="w-1/2 px-4 py-2 border-r border-gray-300 text-gray-700">Subsidi PIP :</div>
                    <div className="w-1/2 px-4 py-1.5 flex gap-2">
                      <span className="pt-1">Rp</span>
                      <input
                        type="number"
                        value={subsidi}
                        onChange={(e) => setSubsidi(parseInt(e.target.value || 0))}
                        className="w-full bg-transparent font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary rounded px-1 -ml-1 print:appearance-none print:p-0 print:border-none"
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50 px-2 py-2 flex justify-end print:hidden">
                    <button onClick={handleSaveSaldo} disabled={isSavingSaldo} className="text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded flex items-center gap-1 transition">
                      {isSavingSaldo ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Simpan PIP & Saldo
                    </button>
                  </div>
                </div>

                <div className="border border-gray-300 rounded-lg overflow-hidden text-sm font-semibold">
                  <div className="flex border-b border-gray-300 bg-gray-50">
                    <div className="w-1/2 px-4 py-2.5 border-r border-gray-300 text-gray-700">Total harus dibayar :</div>
                    <div className="w-1/2 px-4 py-2.5 text-right text-gray-900">Rp {totalHarusDibayar.toLocaleString('id-ID')}</div>
                  </div>
                  <div className="flex border-b border-gray-300 bg-blue-50">
                    <div className="w-1/2 px-4 py-2.5 border-r border-gray-300 text-gray-700">Sudah Bayar :</div>
                    <div className="w-1/2 px-4 py-2.5 text-right text-primary">{totalSudahBayar === 0 ? 'Belum bayar sama sekali' : `Rp ${totalSudahBayar.toLocaleString('id-ID')}`}</div>
                  </div>
                  <div className={`flex ${isLunas ? 'bg-green-100' : isLebih ? 'bg-indigo-100' : 'bg-yellow-50'}`}>
                    <div className={`w-1/2 px-4 py-2.5 border-r border-gray-300 font-bold ${isLunas ? 'text-green-800' : isLebih ? 'text-indigo-800' : 'text-yellow-800'}`}>
                      {isLunas ? 'Pas / Lunas' : isLebih ? 'Lebih / Kembali' : 'Kurang'} :
                    </div>
                    <div className={`w-1/2 px-4 py-2.5 text-right font-bold ${isLunas ? 'text-green-800' : isLebih ? 'text-indigo-800' : 'text-yellow-800'}`}>
                      {isLunas ? '-' : isLebih ? `Rp ${kembalian.toLocaleString('id-ID')}` : `Rp ${kurang.toLocaleString('id-ID')}`}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT: Tabel Rincian dan Pelunasan */}
            <div className="lg:col-span-7">
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 text-center font-bold text-gray-800 text-sm border-b border-gray-300 tracking-wide uppercase">
                  TABEL RINCIAN DAN PELUNASAN
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-r border-gray-300 px-3 py-2 text-center w-10">No</th>
                      <th className="border-b border-r border-gray-300 px-3 py-2 text-left">JENIS IURAN</th>
                      <th className="border-b border-r border-gray-300 px-3 py-2 text-center w-28">BIAYA</th>
                      <th className="border-b border-gray-300 px-3 py-2 text-center w-36">PELUNASAN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allocatedItems.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-10 text-gray-400 italic">
                          <AlertCircle className="mx-auto mb-2 opacity-50" />
                          Tidak ada biaya yang di-setting untuk Tipe Siswa & Kelas ini pada Pengembangan Mutu.
                        </td>
                      </tr>
                    ) : (
                      allocatedItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 border-r border-gray-300 text-center font-medium text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-1.5 border-r border-gray-300 font-medium text-gray-800">{item.uraian}</td>
                          <td className="px-3 py-1.5 border-r border-gray-300 text-right">Rp {item.biaya.toLocaleString('id-ID')}</td>
                          <td className={`px-3 py-1.5 text-right font-medium border-l border-b-0 ${item.statusColor}`}>
                            {item.statusText}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Print Signatures */}
              <div className="hidden print:flex flex-col items-end mt-10 pr-12 space-y-20">
                <div className="text-center text-sm font-medium text-gray-800">
                  <p>Compreng, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p>Bendahara SMP IT HM</p>
                </div>
                <div className="w-48 text-center font-bold border-b-2 border-gray-800 pb-1">
                  ( ......................................... )
                </div>
              </div>
            </div>
          </div>

          {/* Print Footer */}
          <div className="hidden print:flex justify-between items-end mt-8 pt-3 border-t border-gray-300 text-[10px] text-gray-500 italic">
            <span>- Bukti Pembayaran ini jangan sampai hilang - Ter-generate oleh SIAKAD SMP IT HM</span>
            <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

        </div>
      )}
    </div>
  );
}
