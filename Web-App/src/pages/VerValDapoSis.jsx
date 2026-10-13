import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { 
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, 
  Filter, ArrowUpDown, Search, SlidersHorizontal, RefreshCw, 
  Download, Eye, ArrowRight, ShieldCheck, Database, Layers, 
  ChevronLeft, ChevronRight, FileUp, Sparkles, Check, Info,
  UserPlus, HelpCircle
} from 'lucide-react';
import { FIELD_DEFINITIONS, generateTemplateWorkbook, autoMatchColumns } from '../utils/vervalComparator';
import { useVervalFilterSort } from '../hooks/useVervalFilterSort';
import VervalMappingModal from '../components/verval/VervalMappingModal';
import VervalSideBySideModal from '../components/verval/VervalSideBySideModal';

export default function VerValDapoSis() {
  // State Data SIAKAD dari Supabase
  const [dataSiswa, setDataSiswa] = useState([]);
  const [isLoadingSiswa, setIsLoadingSiswa] = useState(true);

  // State File Dapodik
  const [dapodikFile, setDapodikFile] = useState(null);
  const [dapodikRows, setDapodikRows] = useState([]);
  const [detectedHeaders, setDetectedHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // State Modals
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [isSideBySideModalOpen, setIsSideBySideModalOpen] = useState(false);
  const [activeValidationIndex, setActiveValidationIndex] = useState(null);

  const fileInputRef = useRef(null);

  // 1. Fetch data_siswa aktif dari Supabase
  const fetchSiswa = async () => {
    setIsLoadingSiswa(true);
    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('status_keaktifan', 'Aktif')
        .neq('kelas', 'Calon Siswa')
        .order('nama', { ascending: true });

      if (error) throw error;
      setDataSiswa(data || []);
    } catch (err) {
      console.error('Gagal mengambil data siswa:', err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memuat Data',
        text: err.message || 'Terjadi kesalahan saat memuat data siswa dari Supabase.'
      });
    } finally {
      setIsLoadingSiswa(false);
    }
  };

  useEffect(() => {
    fetchSiswa();
  }, []);

  // 2. Gunakan Custom Hook untuk filter, sorting, dan komparasi (Full Outer Join)
  const {
    filterStatus,
    setFilterStatus,
    filterSource,
    setFilterSource,
    filterKelas,
    setFilterKelas,
    sortBy,
    sortOrder,
    handleSetSort,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    summary,
    availableClasses,
    filteredAndSortedList,
    paginatedList,
    totalFilteredCount
  } = useVervalFilterSort({
    dataSiswa,
    dapodikRows,
    columnMapping,
    definitions: FIELD_DEFINITIONS,
    initialFilterStatus: 'invalid', // Default fokus utama perbaikan
    initialFilterSource: 'all',
    initialSortBy: 'status',
    initialSortOrder: 'asc' // Belum valid teratas
  });

  // 3. Parser File XLSX / CSV Dapodik
  const handleProcessFile = (file) => {
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExt)) {
      Swal.fire({
        icon: 'warning',
        title: 'Format File Tidak Didukung',
        text: 'Silakan unggah file berformat Excel (.xlsx, .xls) atau .csv dari Dapodik.'
      });
      return;
    }

    setIsParsingFile(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('File Dapodik kosong atau tidak memiliki data baris.');
        }

        const headers = Object.keys(rawJson[0]);
        setDetectedHeaders(headers);
        setDapodikRows(rawJson);
        setDapodikFile({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          rowsCount: rawJson.length,
          uploadedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        });

        // Auto-matching kolom
        const initialMapping = autoMatchColumns(headers, FIELD_DEFINITIONS);
        setColumnMapping(initialMapping);

        // Buka otomatis modal pemetaan kolom
        setIsMappingModalOpen(true);

        Swal.fire({
          icon: 'success',
          title: 'File Berhasil Dibaca',
          text: `Terdeteksi ${rawJson.length} baris data Dapodik dan ${headers.length} kolom. Sinkronisasi data dimulai!`,
          timer: 2000,
          showConfirmButton: false
        });
      } catch (err) {
        console.error('Error membaca file:', err);
        Swal.fire({
          icon: 'error',
          title: 'Gagal Membaca File',
          text: err.message || 'Pastikan format file Dapodik valid dan tidak terenkripsi password.'
        });
      } finally {
        setIsParsingFile(false);
      }
    };

    reader.onerror = () => {
      setIsParsingFile(false);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Membaca File',
        text: 'Terjadi kesalahan sistem saat membaca file.'
      });
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDownloadTemplate = () => {
    try {
      const wb = generateTemplateWorkbook();
      XLSX.writeFile(wb, 'Format_Template_Dapodik_SIAKAD.xlsx');
      Swal.fire({
        icon: 'success',
        title: 'Template Diunduh',
        text: 'File template Excel Dapodik berhasil disimpan.',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Modal Side-by-Side Handlers
  const handleOpenValidationModal = (validationItem, indexInFiltered) => {
    setActiveValidationIndex(indexInFiltered);
    setIsSideBySideModalOpen(true);
  };

  const activeValidationItem = activeValidationIndex !== null && filteredAndSortedList[activeValidationIndex]
    ? filteredAndSortedList[activeValidationIndex]
    : null;

  const handleNavigateModal = (direction) => {
    if (activeValidationIndex === null) return;
    const nextIndex = activeValidationIndex + direction;
    if (nextIndex >= 0 && nextIndex < filteredAndSortedList.length) {
      setActiveValidationIndex(nextIndex);
    }
  };

  // Reaktif update saat siswa disimpan/didaftarkan di modal side-by-side
  const handleSiswaSaved = (savedSiswa, actionType) => {
    if (actionType === 'insert') {
      // Siswa baru dari Dapodik masuk ke SIAKAD
      setDataSiswa(prev => [...prev, savedSiswa]);
    } else {
      // Siswa SIAKAD diupdate
      setDataSiswa(prev => prev.map(s => s.id === savedSiswa.id ? { ...s, ...savedSiswa } : s));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* 1. Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#2a2c87] text-white shadow-md shadow-indigo-950/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                VerVal DapoSis
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Verifikasi, Validasi & Sinkronisasi Komparatif Siswa SIAKAD vs Database Dapodik
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition text-xs sm:text-sm font-semibold shadow-2xs"
            title="Unduh contoh template format Excel Dapodik"
          >
            <Download className="w-4 h-4 text-[#2a2c87]" />
            Unduh Contoh Template
          </button>

          <button
            type="button"
            onClick={fetchSiswa}
            disabled={isLoadingSiswa}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition text-xs sm:text-sm font-semibold shadow-2xs disabled:opacity-50"
            title="Muat ulang data dari Supabase"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoadingSiswa ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* 2. Upload File Dropzone Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {!dapodikFile ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`p-6 sm:p-8 text-center transition cursor-pointer border-2 border-dashed ${
              isDragOver 
                ? 'border-[#2a2c87] bg-indigo-50/50' 
                : 'border-slate-300 hover:border-[#2a2c87]/60 hover:bg-slate-50/60'
            } rounded-2xl m-3`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-50 text-[#2a2c87] flex items-center justify-center shadow-xs">
              <Upload className="w-7 h-7" />
            </div>
            
            <h3 className="text-base font-bold text-slate-800 mb-1">
              {isParsingFile ? 'Sedang Membaca dan Memvalidasi File...' : 'Unggah File Database Dapodik (XLSX / CSV)'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
              Tarik & lepas file unduhan Dapodik ke area ini, atau klik tombol di bawah untuk memilih file dari komputer Anda.
            </p>

            <button
              type="button"
              disabled={isParsingFile}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2a2c87] text-white font-semibold hover:bg-[#20226b] transition text-xs sm:text-sm shadow-md shadow-indigo-900/15 disabled:opacity-50"
            >
              <FileUp className="w-4 h-4" />
              Pilih File Dapodik (.xlsx / .csv)
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm sm:text-base font-bold text-slate-800">
                    {dapodikFile.name}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Aktif Terhubung
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {dapodikFile.rowsCount} Baris Siswa &bull; {dapodikFile.size} &bull; Diunggah Pukul {dapodikFile.uploadedAt}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsMappingModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-semibold text-xs sm:text-sm transition shadow-2xs flex-1 sm:flex-initial"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#2a2c87]" />
                Atur Pemetaan Kolom
              </button>

              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 font-medium text-xs sm:text-sm transition"
              >
                Ganti File
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleProcessFile(e.target.files[0]);
                  }
                }}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Panel Ringkasan Counter / Metrics (Full Outer Join) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Data Gabungan */}
        <div 
          onClick={() => { setFilterStatus('all'); setFilterSource('all'); }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs cursor-pointer transition relative overflow-hidden ${
            filterStatus === 'all' && filterSource === 'all' ? 'border-[#2a2c87] ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Siswa
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
            {summary.totalSiswa}
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block truncate">
            SIAKAD + Data Dapodik
          </span>
        </div>

        {/* Sudah Valid */}
        <div 
          onClick={() => { setFilterStatus('valid'); setFilterSource('all'); }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs cursor-pointer transition relative overflow-hidden ${
            filterStatus === 'valid' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Sudah Valid
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
              {summary.totalValid}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {summary.validPercentage}%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block truncate">
            Cocok di kedua database
          </span>
        </div>

        {/* Belum Valid */}
        <div 
          onClick={() => { setFilterStatus('invalid'); setFilterSource('all'); }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs cursor-pointer transition relative overflow-hidden ${
            filterStatus === 'invalid' && filterSource === 'all' ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50/20' : 'border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              Belum Valid
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-extrabold uppercase">
                Fokus
              </span>
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight">
            {summary.totalInvalid}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block truncate">
            Selisih / Belum Singkron
          </span>
        </div>

        {/* Hanya di Dapodik (Belum ada di SIAKAD) */}
        <div 
          onClick={() => { setFilterStatus('all'); setFilterSource('only_dapodik'); }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs cursor-pointer transition relative overflow-hidden ${
            filterSource === 'only_dapodik' ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/20' : 'border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              Hanya di Dapodik
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tight">
            {summary.totalOnlyDapodik}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block truncate">
            Belum masuk ke SIAKAD
          </span>
        </div>

        {/* Hanya di SIAKAD (Belum ada di Dapodik) */}
        <div 
          onClick={() => { setFilterStatus('all'); setFilterSource('only_siakad'); }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs cursor-pointer transition relative overflow-hidden ${
            filterSource === 'only_siakad' ? 'border-amber-500 ring-2 ring-amber-200 bg-amber-50/20' : 'border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Hanya di SIAKAD
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
            {summary.totalOnlySiakad}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block truncate">
            Tidak ada di file Dapodik
          </span>
        </div>
      </div>

      {/* 4. Toolbar Kontrol: Filter Status, Sumber Data, Sorting, dan Live Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        
        {/* Baris Atas Toolbar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Tab Filter Status & Sumber Data */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'all'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({summary.totalSiswa})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('invalid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  filterStatus === 'invalid'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                Belum Valid ({summary.totalInvalid})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('valid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  filterStatus === 'valid'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sudah Valid ({summary.totalValid})
              </button>
            </div>

            {/* Selector Filter Sumber Data */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterSource('all')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterSource === 'all' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Sumber
              </button>
              <button
                type="button"
                onClick={() => setFilterSource('both')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterSource === 'both' ? 'bg-[#2a2c87] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ada di SIAKAD & Dapodik"
              >
                Ada di Keduanya ({summary.totalBoth})
              </button>
              <button
                type="button"
                onClick={() => setFilterSource('only_dapodik')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterSource === 'only_dapodik' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 hover:bg-blue-50'
                }`}
                title="Hanya ada di Dapodik"
              >
                Hanya di Dapodik ({summary.totalOnlyDapodik})
              </button>
              <button
                type="button"
                onClick={() => setFilterSource('only_siakad')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterSource === 'only_siakad' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-50'
                }`}
                title="Hanya ada di SIAKAD"
              >
                Hanya di SIAKAD ({summary.totalOnlySiakad})
              </button>
            </div>
          </div>

          {/* Pencarian Live */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama, NISN, atau NIK..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2a2c87]/20 focus:border-[#2a2c87] transition bg-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Baris Bawah Toolbar: Filter Kelas & Pengurutan */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter Kelas:
            </span>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#2a2c87]"
            >
              <option value="all">Semua Rombel/Kelas</option>
              {availableClasses.map(k => (
                <option key={k} value={k}>Kelas {k}</option>
              ))}
            </select>
          </div>

          {/* Opsi Pengurutan */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan:
            </span>
            
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-');
                handleSetSort(newSortBy, newSortOrder);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#2a2c87]"
            >
              <option value="status-asc">Status: Belum Valid Teratas (Prioritas)</option>
              <option value="status-desc">Status: Sudah Valid Teratas</option>
              <option value="name-asc">Nama Siswa: A ke Z</option>
              <option value="name-desc">Nama Siswa: Z ke A</option>
              <option value="nisn-asc">NISN: Terkecil ke Terbesar</option>
              <option value="nisn-desc">NISN: Terbesar ke Terkecil</option>
            </select>

            <span className="text-slate-400 hidden md:inline">|</span>
            <span className="text-slate-500">
              Menampilkan <strong className="text-slate-800">{paginatedList.length}</strong> dari <strong className="text-slate-800">{totalFilteredCount}</strong> data
            </span>
          </div>

        </div>

      </div>

      {/* 5. Tabel Ringkasan Status Siswa (Full Outer Join) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoadingSiswa ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 text-[#2a2c87] animate-spin" />
            <p className="text-sm font-semibold">Memuat data siswa dari Supabase...</p>
          </div>
        ) : paginatedList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-700">Tidak ada data siswa ditemukan</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchTerm 
                ? `Tidak ditemukan hasil yang cocok dengan kata kunci "${searchTerm}". Coba ubah pencarian Anda.`
                : 'Belum ada data siswa yang sesuai dengan filter yang aktif.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">NISN</th>
                  <th className="py-3.5 px-4">Nama Lengkap</th>
                  <th className="py-3.5 px-4">Rombel/Kelas</th>
                  <th className="py-3.5 px-3 text-center w-28">Di Dapodik</th>
                  <th className="py-3.5 px-3 text-center w-28">Di SIAKAD</th>
                  <th className="py-3.5 px-4">Status & Sumber Data</th>
                  <th className="py-3.5 px-4 text-center w-40">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedList.map((item, index) => {
                  const itemNumber = (currentPage - 1) * pageSize + index + 1;
                  const originalIndex = filteredAndSortedList.indexOf(item);
                  const isValid = item.isValid;
                  const sourceType = item.sourceType;

                  // Penentuan warna border & latar baris
                  let rowStyle = 'bg-rose-50/50 hover:bg-rose-50/80 border-l-4 border-l-rose-500';
                  if (isValid) {
                    rowStyle = 'bg-emerald-50/50 hover:bg-emerald-50/80 border-l-4 border-l-emerald-500';
                  } else if (sourceType === 'only_dapodik') {
                    rowStyle = 'bg-blue-50/50 hover:bg-blue-50/80 border-l-4 border-l-blue-500';
                  } else if (sourceType === 'only_siakad') {
                    rowStyle = 'bg-amber-50/50 hover:bg-amber-50/80 border-l-4 border-l-amber-500';
                  }

                  return (
                    <tr 
                      key={item.id}
                      className={`transition ${rowStyle}`}
                    >
                      {/* No */}
                      <td className="py-3 px-4 text-center text-xs font-mono text-slate-500">
                        {itemNumber}
                      </td>

                      {/* NISN */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {item.displayNisn || <span className="text-slate-400 italic font-sans">Belum ada</span>}
                        </span>
                        {(item.siswa?.nik || (columnMapping.nik && item.dapodikRow?.[columnMapping.nik])) && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            NIK: {item.siswa?.nik || item.dapodikRow[columnMapping.nik]}
                          </div>
                        )}
                      </td>

                      {/* Nama Lengkap */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          {item.displayName}
                          {sourceType === 'only_dapodik' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                              Dapodik Baru
                            </span>
                          )}
                          {sourceType === 'only_siakad' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700">
                              SIAKAD Saja
                            </span>
                          )}
                          {item.matchedBy && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200" title={`Dicocokkan berdasarkan ${item.matchedBy}`}>
                              via {item.matchedBy}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {item.siswa ? (
                            <>
                              {item.siswa.tempat_lahir || '-'}, {item.siswa.tanggal_lahir || '-'} &bull; Ibu: {item.siswa.nama_ibu || '-'}
                            </>
                          ) : (
                            <>
                              {columnMapping.tempat_lahir ? item.dapodikRow?.[columnMapping.tempat_lahir] || '-' : '-'}, {columnMapping.tanggal_lahir ? item.dapodikRow?.[columnMapping.tanggal_lahir] || '-' : '-'} &bull; Ibu: {columnMapping.nama_ibu ? item.dapodikRow?.[columnMapping.nama_ibu] || '-' : '-'}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Rombel / Kelas */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.displayKelas || '-'}
                        </span>
                      </td>

                      {/* Ada di Dapodik */}
                      <td className="py-3 px-3 text-center">
                        {item.isMatchedInDapodik ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs" 
                            title="Siswa ditemukan di file ekspor Dapodik"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ada</span>
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs" 
                            title="Siswa tidak ditemukan di file Dapodik"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Tidak</span>
                          </span>
                        )}
                      </td>

                      {/* Ada di SIAKAD */}
                      <td className="py-3 px-3 text-center">
                        {item.isMatchedInSiakad ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs" 
                            title="Siswa terdaftar di database SIAKAD"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ada</span>
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs" 
                            title="Siswa belum terdaftar di database SIAKAD"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Tidak</span>
                          </span>
                        )}
                      </td>

                      {/* Status Validasi & Sumber Data */}
                      <td className="py-3 px-4">
                        {isValid ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Valid
                            </span>
                            <div className="text-[11px] text-emerald-700 font-medium">
                              Identik di SIAKAD & Dapodik
                            </div>
                          </div>
                        ) : sourceType === 'only_dapodik' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                              Hanya di Dapodik
                            </span>
                            <div className="text-[11px] text-blue-700 font-medium">
                              Belum terdaftar di SIAKAD
                            </div>
                          </div>
                        ) : sourceType === 'only_siakad' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Hanya di SIAKAD
                            </span>
                            <div className="text-[11px] text-amber-700 font-medium">
                              Tidak ada di file Dapodik
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              Belum Valid
                            </span>
                            <div className="text-[11px] text-rose-700 font-medium">
                              {item.mismatchedFieldsCount} field berbeda ({item.mismatchedFieldNames.slice(0, 2).join(', ')}{item.mismatchedFieldNames.length > 2 ? '...' : ''})
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Kolom Aksi */}
                      <td className="py-3 px-4 text-center">
                        {sourceType === 'only_dapodik' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenValidationModal(item, originalIndex)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition text-xs font-semibold shadow-xs"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Tambah ke SIAKAD
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenValidationModal(item, originalIndex)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2a2c87] text-white hover:bg-[#20226b] transition text-xs font-semibold shadow-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Validasi Data
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              Halaman <strong className="text-slate-800">{currentPage}</strong> dari <strong className="text-slate-800">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  p = currentPage - 3 + i;
                  if (p > totalPages) p = totalPages - 4 + i;
                }
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                      currentPage === p 
                        ? 'bg-[#2a2c87] text-white shadow-2xs' 
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Modal Pemetaan Kolom */}
      <VervalMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        detectedHeaders={detectedHeaders}
        sampleRows={dapodikRows}
        currentMapping={columnMapping}
        onConfirmMapping={(newMapping) => {
          setColumnMapping(newMapping);
          Swal.fire({
            icon: 'success',
            title: 'Pemetaan Kolom Disimpan',
            text: 'Data perbandingan siswa telah diperbarui berdasarkan pemetaan kolom yang baru.',
            timer: 1800,
            showConfirmButton: false
          });
        }}
      />

      {/* 7. Modal Side-by-Side Perbandingan & Perbaikan Langsung */}
      <VervalSideBySideModal
        isOpen={isSideBySideModalOpen}
        onClose={() => setIsSideBySideModalOpen(false)}
        siswaValidationData={activeValidationItem}
        columnMapping={columnMapping}
        onSaveSuccess={handleSiswaSaved}
        onNavigatePrev={() => handleNavigateModal(-1)}
        onNavigateNext={() => handleNavigateModal(1)}
        hasPrev={activeValidationIndex !== null && activeValidationIndex > 0}
        hasNext={activeValidationIndex !== null && activeValidationIndex < filteredAndSortedList.length - 1}
      />

    </div>
  );
}
