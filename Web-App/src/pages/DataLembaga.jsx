import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Building2, Save, RefreshCw, ShieldCheck, Landmark, UploadCloud, 
  Eye, Trash2, Download, ExternalLink, FileText, FileCheck, 
  AlertCircle, MapPin, Phone, Mail, Globe, Plus, X, Image as ImageIcon, 
  CheckCircle2, File, Sparkles
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function DataLembaga() {
  const [currentTab, setCurrentTab] = useState('identitas'); // 'identitas' | 'legalitas_lembaga' | 'legalitas_yayasan'
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);

  // Modal Preview State
  const [previewDoc, setPreviewDoc] = useState(null); // { url, title, type }

  // Form State
  const [data, setData] = useState({
    id: null,
    nama_lembaga: 'SMP IT Hidayatul Mubtadi-ien',
    npsn: '70004822',
    bentuk_pendidikan: 'SMP',
    status_sekolah: 'Swasta',
    akreditasi: 'A',
    kurikulum: 'Kurikulum Merdeka',
    telepon: '',
    email: '',
    website: '',
    logo_url: '',
    kepala_sekolah: 'ABDUL MANAF, S.Pd',
    nip_kepsek: '-',
    alamat: 'Dusun Sukaseneng RT 025 RW 010 Desa Compreng Kec. Compreng Kab. Subang',
    rt: '025',
    rw: '010',
    dusun: 'Dusun Sukaseneng',
    desa: 'Compreng',
    kecamatan: 'Compreng',
    kabupaten: 'Subang',
    provinsi: 'Jawa Barat',
    kode_pos: '41258',
    nama_yayasan: 'Yayasan Hidayatul Mubtadi-ien',
    ketua_yayasan: '',
    legalitas_lembaga: {
      sk_pendirian: { nomor: '', tanggal: '', penerbit: '', file_url: '', file_name: '', file_type: '' },
      sk_operasional: { nomor: '', tanggal: '', masa_berlaku: '', penerbit: '', file_url: '', file_name: '', file_type: '' },
      akreditasi: { nomor: '', peringkat: 'A', berlaku_sampai: '', file_url: '', file_name: '', file_type: '' },
      npwp: { nomor: '', nama: '', file_url: '', file_name: '', file_type: '' },
      piagam_npsn: { nomor: '', tanggal: '', file_url: '', file_name: '', file_type: '' }
    },
    legalitas_yayasan: {
      alamat_yayasan: '',
      kontak_yayasan: '',
      akta_pendirian: { nomor: '', notaris: '', tanggal: '', file_url: '', file_name: '', file_type: '' },
      sk_kemenkumham: { nomor: '', tanggal: '', file_url: '', file_name: '', file_type: '' },
      akta_perubahan: { nomor: '', notaris: '', tanggal: '', file_url: '', file_name: '', file_type: '' },
      npwp: { nomor: '', nama: '', file_url: '', file_name: '', file_type: '' },
      tanah: { jenis: 'Wakaf', nomor: '', luas: '', atas_nama: '', file_url: '', file_name: '', file_type: '' }
    },
    dokumen_tambahan_lembaga: [],
    dokumen_tambahan_yayasan: []
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: lembagaData, error } = await supabase
        .from('data_lembaga')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (lembagaData) {
        setData(prev => ({
          ...prev,
          ...lembagaData,
          legalitas_lembaga: {
            ...prev.legalitas_lembaga,
            ...(lembagaData.legalitas_lembaga || {})
          },
          legalitas_yayasan: {
            ...prev.legalitas_yayasan,
            ...(lembagaData.legalitas_yayasan || {})
          },
          dokumen_tambahan_lembaga: Array.isArray(lembagaData.dokumen_tambahan_lembaga) 
            ? lembagaData.dokumen_tambahan_lembaga 
            : [],
          dokumen_tambahan_yayasan: Array.isArray(lembagaData.dokumen_tambahan_yayasan) 
            ? lembagaData.dokumen_tambahan_yayasan 
            : []
        }));
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data identitas lembaga' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Upload handler for Supabase Storage
  const handleUploadFile = async (file, pathPrefix, onSuccess) => {
    if (!file) return;

    // Validate size (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'Ukuran Terlalu Besar', text: 'Maksimal ukuran berkas adalah 15MB' });
      return;
    }

    const fileExt = file.name.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt);
    const isPdf = fileExt === 'pdf';

    if (!isImage && !isPdf) {
      Swal.fire({
        icon: 'warning',
        title: 'Format Tidak Didukung',
        text: 'Hanya file gambar (JPG, PNG, WEBP) dan dokumen PDF yang diperbolehkan.'
      });
      return;
    }

    const cleanPrefix = pathPrefix.replace(/[^a-zA-Z0-9_]/g, '_');
    const safeName = `${cleanPrefix}_${Date.now()}.${fileExt}`;
    const filePath = `${safeName}`;

    setUploadingField(pathPrefix);
    try {
      const { error: uploadError } = await supabase.storage
        .from('dokumen_lembaga')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('dokumen_lembaga')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      onSuccess({
        file_url: publicUrl,
        file_name: file.name,
        file_type: isPdf ? 'pdf' : 'image',
        file_path: filePath
      });

      Swal.fire({
        icon: 'success',
        title: 'Berkas Terunggah',
        text: `${file.name} berhasil diunggah.`,
        timer: 1400,
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Upload error:', err);
      Swal.fire({ icon: 'error', title: 'Gagal Unggah', text: err.message || 'Terjadi kesalahan saat mengunggah berkas' });
    } finally {
      setUploadingField(null);
    }
  };

  // Save handler to database
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        nama_lembaga: data.nama_lembaga,
        npsn: data.npsn,
        bentuk_pendidikan: data.bentuk_pendidikan,
        status_sekolah: data.status_sekolah,
        akreditasi: data.akreditasi,
        kurikulum: data.kurikulum,
        telepon: data.telepon,
        email: data.email,
        website: data.website,
        logo_url: data.logo_url,
        kepala_sekolah: data.kepala_sekolah,
        nip_kepsek: data.nip_kepsek,
        alamat: data.alamat,
        rt: data.rt,
        rw: data.rw,
        dusun: data.dusun,
        desa: data.desa,
        kecamatan: data.kecamatan,
        kabupaten: data.kabupaten,
        provinsi: data.provinsi,
        kode_pos: data.kode_pos,
        nama_yayasan: data.nama_yayasan,
        ketua_yayasan: data.ketua_yayasan,
        legalitas_lembaga: data.legalitas_lembaga,
        legalitas_yayasan: data.legalitas_yayasan,
        dokumen_tambahan_lembaga: data.dokumen_tambahan_lembaga,
        dokumen_tambahan_yayasan: data.dokumen_tambahan_yayasan
      };

      if (data.id) {
        const { error } = await supabase
          .from('data_lembaga')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { data: insertedData, error } = await supabase
          .from('data_lembaga')
          .insert([payload])
          .select();
        if (error) throw error;
        if (insertedData && insertedData.length > 0) {
          setData(prev => ({ ...prev, id: insertedData[0].id }));
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Berhasil Disimpan!',
        text: 'Data identitas dan legalitas berhasil disimpan ke sistem.',
        timer: 1600,
        showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.message || 'Gagal menyimpan data lembaga' });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to update nested legalitas lembaga
  const updateLegalitasLembaga = (section, field, value) => {
    setData(prev => ({
      ...prev,
      legalitas_lembaga: {
        ...prev.legalitas_lembaga,
        [section]: {
          ...(prev.legalitas_lembaga[section] || {}),
          [field]: value
        }
      }
    }));
  };

  // Helper to update nested legalitas yayasan
  const updateLegalitasYayasan = (section, field, value) => {
    setData(prev => ({
      ...prev,
      legalitas_yayasan: {
        ...prev.legalitas_yayasan,
        [section]: {
          ...(prev.legalitas_yayasan[section] || {}),
          [field]: value
        }
      }
    }));
  };

  // Add custom document to Lembaga
  const handleAddDokumenLembaga = () => {
    const newDoc = {
      id: `lembaga_${Date.now()}`,
      judul: '',
      nomor: '',
      tanggal: '',
      keterangan: '',
      file_url: '',
      file_name: '',
      file_type: ''
    };
    setData(prev => ({
      ...prev,
      dokumen_tambahan_lembaga: [...prev.dokumen_tambahan_lembaga, newDoc]
    }));
  };

  const handleUpdateDokumenLembaga = (index, field, value) => {
    setData(prev => {
      const updated = [...prev.dokumen_tambahan_lembaga];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, dokumen_tambahan_lembaga: updated };
    });
  };

  const handleRemoveDokumenLembaga = (index) => {
    Swal.fire({
      title: 'Hapus Dokumen?',
      text: 'Dokumen ini akan dihapus dari daftar',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    }).then(res => {
      if (res.isConfirmed) {
        setData(prev => {
          const updated = [...prev.dokumen_tambahan_lembaga];
          updated.splice(index, 1);
          return { ...prev, dokumen_tambahan_lembaga: updated };
        });
      }
    });
  };

  // Add custom document to Yayasan
  const handleAddDokumenYayasan = () => {
    const newDoc = {
      id: `yayasan_${Date.now()}`,
      judul: '',
      nomor: '',
      tanggal: '',
      keterangan: '',
      file_url: '',
      file_name: '',
      file_type: ''
    };
    setData(prev => ({
      ...prev,
      dokumen_tambahan_yayasan: [...prev.dokumen_tambahan_yayasan, newDoc]
    }));
  };

  const handleUpdateDokumenYayasan = (index, field, value) => {
    setData(prev => {
      const updated = [...prev.dokumen_tambahan_yayasan];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, dokumen_tambahan_yayasan: updated };
    });
  };

  const handleRemoveDokumenYayasan = (index) => {
    Swal.fire({
      title: 'Hapus Dokumen?',
      text: 'Dokumen ini akan dihapus dari daftar yayasan',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    }).then(res => {
      if (res.isConfirmed) {
        setData(prev => {
          const updated = [...prev.dokumen_tambahan_yayasan];
          updated.splice(index, 1);
          return { ...prev, dokumen_tambahan_yayasan: updated };
        });
      }
    });
  };

  // Reusable File Upload / Preview Box Component
  const FileUploadBox = ({ title, docData, fieldKey, onFileUploaded, onFileRemoved }) => {
    const fileInputRef = useRef(null);
    const isThisUploading = uploadingField === fieldKey;
    const hasFile = !!docData?.file_url;
    const isPdf = docData?.file_type === 'pdf' || (docData?.file_url && docData?.file_url.toLowerCase().endsWith('.pdf'));

    return (
      <div className="border border-dashed border-gray-200 bg-gray-50/60 rounded-xl p-3.5 hover:bg-gray-50 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
            {isPdf ? <FileText size={14} className="text-red-500" /> : <ImageIcon size={14} className="text-blue-500" />}
            {title || 'Berkas Lampiran'}
          </span>
          {hasFile && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Tersedia
            </span>
          )}
        </div>

        {hasFile ? (
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-2.5 gap-2 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-800 truncate" title={docData.file_name || 'Berkas Dokumen'}>
                  {docData.file_name || (isPdf ? 'Dokumen_Legalitas.pdf' : 'Berkas_Foto.jpg')}
                </p>
                <p className="text-[11px] text-gray-400">
                  {isPdf ? 'Dokumen PDF' : 'Berkas Gambar'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewDoc({ url: docData.file_url, title: title || docData.file_name, type: isPdf ? 'pdf' : 'image' })}
                className="p-1.5 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-md transition"
                title="Pratinjau Berkas"
              >
                <Eye size={16} />
              </button>
              <a
                href={docData.file_url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-1.5 text-gray-600 hover:text-emerald-600 hover:bg-gray-100 rounded-md transition"
                title="Buka / Download"
              >
                <Download size={16} />
              </a>
              <button
                type="button"
                onClick={onFileRemoved}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                title="Hapus Berkas"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file, fieldKey, onFileUploaded);
              }}
            />
            <button
              type="button"
              disabled={isThisUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-3 border border-dashed border-gray-300 rounded-lg bg-white hover:bg-blue-50/50 hover:border-primary/50 text-gray-600 hover:text-primary transition flex items-center justify-center gap-2 text-xs font-semibold disabled:opacity-50"
            >
              {isThisUploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-primary" />
                  <span>Mengunggah Berkas...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={16} className="text-primary" />
                  <span>Upload Foto / Dokumen PDF</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-1">
              Format: .PDF, .JPG, .PNG (Maks 15MB)
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header & Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2.5">
            <Building2 className="text-primary" /> Identitas & Legalitas Lembaga
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Kelola profil lengkap sekolah, perizinan institusi, dan legalitas badan yayasan penyelenggara.
          </p>
        </div>

        {/* Tab Switcher - Styled exactly like Presensi Siswa */}
        <div className="flex flex-wrap bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setCurrentTab('identitas')}
            className={`px-4 md:px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors ${
              currentTab === 'identitas' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Building2 size={16} /> Identitas Sekolah
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('legalitas_lembaga')}
            className={`px-4 md:px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors border-l border-gray-100 ${
              currentTab === 'legalitas_lembaga' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ShieldCheck size={16} /> Legalitas Lembaga
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('legalitas_yayasan')}
            className={`px-4 md:px-5 py-2.5 text-sm font-bold flex items-center gap-2 transition-colors border-l border-gray-100 ${
              currentTab === 'legalitas_yayasan' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Landmark size={16} /> Legalitas Yayasan
          </button>
        </div>
      </div>

      {/* Floating / Sticky Save Bar Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary font-black">
            {currentTab === 'identitas' ? '1' : currentTab === 'legalitas_lembaga' ? '2' : '3'}
          </div>
          <div>
            <h4 className="text-sm font-black text-gray-800">
              {currentTab === 'identitas' && 'Tab 1: Profil Pokok, Kontak & Alamat Sekolah'}
              {currentTab === 'legalitas_lembaga' && 'Tab 2: Dokumen Legalitas & Perizinan Sekolah'}
              {currentTab === 'legalitas_yayasan' && 'Tab 3: Akta & Dokumen Legalitas Yayasan'}
            </h4>
            <p className="text-xs text-gray-400">
              Perubahan pada tab ini disimpan secara menyeluruh ke basis data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            type="button"
            onClick={fetchData} 
            disabled={isLoading}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl font-semibold shadow-xs hover:bg-gray-50 transition flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin text-primary" : ""} /> 
            <span>Segarkan</span>
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="bg-primary hover:bg-blue-900 text-white px-6 py-2 rounded-xl font-bold shadow-sm transition flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={32} className="animate-spin text-primary" />
          <p className="text-sm font-bold text-gray-600">Memuat Data Lembaga...</p>
        </div>
      ) : (
        <div>
          {/* ========================================================================= */}
          {/* TAB 1: IDENTITAS SEKOLAH */}
          {/* ========================================================================= */}
          {currentTab === 'identitas' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Logo & Main Profile */}
              <div className="space-y-6">
                {/* School Logo Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-4 self-start flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" /> Logo Resmi Lembaga
                  </h3>

                  <div className="relative group mb-4">
                    <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shadow-inner">
                      {data.logo_url ? (
                        <img 
                          src={data.logo_url} 
                          alt="Logo Lembaga" 
                          className="w-full h-full object-contain p-2" 
                        />
                      ) : (
                        <Building2 size={54} className="text-gray-300" />
                      )}
                    </div>
                  </div>

                  <div className="w-full">
                    <FileUploadBox 
                      title="Upload Logo Sekolah"
                      docData={{ file_url: data.logo_url, file_name: 'Logo_Sekolah.png', file_type: 'image' }}
                      fieldKey="logo_sekolah"
                      onFileUploaded={(res) => setData(prev => ({ ...prev, logo_url: res.file_url }))}
                      onFileRemoved={() => setData(prev => ({ ...prev, logo_url: '' }))}
                    />
                  </div>
                </div>

                {/* Status & Akreditasi Badge Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" /> Klasifikasi Sekolah
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Bentuk Pendidikan</label>
                      <select 
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-sm focus:ring-2 focus:ring-primary focus:bg-white outline-none transition"
                        value={data.bentuk_pendidikan || 'SMP'}
                        onChange={(e) => setData({ ...data, bentuk_pendidikan: e.target.value })}
                      >
                        <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                        <option value="MTs">MTs (Madrasah Tsanawiyah)</option>
                        <option value="SMA">SMA (Sekolah Menengah Atas)</option>
                        <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
                        <option value="MA">MA (Madrasah Aliyah)</option>
                        <option value="SD">SD (Sekolah Dasar)</option>
                        <option value="MI">MI (Madrasah Ibtidaiyah)</option>
                        <option value="PKBM">PKBM / Pondok Pesantren</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Status Sekolah</label>
                      <select 
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-sm focus:ring-2 focus:ring-primary focus:bg-white outline-none transition"
                        value={data.status_sekolah || 'Swasta'}
                        onChange={(e) => setData({ ...data, status_sekolah: e.target.value })}
                      >
                        <option value="Swasta">Swasta</option>
                        <option value="Negeri">Negeri</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Peringkat Akreditasi</label>
                      <select 
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-sm focus:ring-2 focus:ring-primary focus:bg-white outline-none transition"
                        value={data.akreditasi || 'A'}
                        onChange={(e) => setData({ ...data, akreditasi: e.target.value })}
                      >
                        <option value="A">A (Unggul / Amat Baik)</option>
                        <option value="B">B (Baik)</option>
                        <option value="C">C (Cukup)</option>
                        <option value="Belum Terakreditasi">Belum Terakreditasi</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Kurikulum Digunakan</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:bg-white outline-none transition font-medium"
                        placeholder="Misal: Kurikulum Merdeka"
                        value={data.kurikulum || ''}
                        onChange={(e) => setData({ ...data, kurikulum: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Columns: Data Pokok, Pimpinan, Kontak & Alamat */}
              <div className="lg:col-span-2 space-y-6">
                {/* Informasi Pokok & Kepala Sekolah */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Building2 size={16} className="text-primary" /> Data Pokok & Pimpinan
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Nama Yayasan Penyelenggara <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-bold text-gray-800 transition"
                        placeholder="Misal: Yayasan Hidayatul Mubtadi-ien"
                        value={data.nama_yayasan || ''}
                        onChange={(e) => setData({...data, nama_yayasan: e.target.value})}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Nama Resmi Sekolah / Lembaga <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-bold text-gray-800 transition"
                        placeholder="Misal: SMP IT Hidayatul Mubtadi-ien"
                        value={data.nama_lembaga || ''}
                        onChange={(e) => setData({...data, nama_lembaga: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        NPSN (Nomor Pokok Sekolah Nasional) <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-semibold text-gray-800 transition"
                        placeholder="Misal: 70004822"
                        value={data.npsn || ''}
                        onChange={(e) => setData({...data, npsn: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Nama Kepala Sekolah
                      </label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-semibold text-gray-800 transition"
                        placeholder="Misal: Abdul Manaf, S.Pd"
                        value={data.kepala_sekolah || ''}
                        onChange={(e) => setData({...data, kepala_sekolah: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        NIP / NIY Kepala Sekolah
                      </label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-medium text-gray-800 transition"
                        placeholder="Misal: 19800101 200501 1 001 atau -"
                        value={data.nip_kepsek || ''}
                        onChange={(e) => setData({...data, nip_kepsek: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Kontak & Media Resmi */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-100">
                    <Phone size={16} className="text-emerald-500" /> Kontak & Saluran Informasi
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                        <Phone size={13} className="text-gray-400" /> Nomor Telepon / WA
                      </label>
                      <input 
                        type="text" 
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                        placeholder="0812-xxxx-xxxx"
                        value={data.telepon || ''}
                        onChange={(e) => setData({...data, telepon: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                        <Mail size={13} className="text-gray-400" /> Email Resmi
                      </label>
                      <input 
                        type="email" 
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                        placeholder="smpit.hm@gmail.com"
                        value={data.email || ''}
                        onChange={(e) => setData({...data, email: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                        <Globe size={13} className="text-gray-400" /> Website / Portal
                      </label>
                      <input 
                        type="text" 
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none transition"
                        placeholder="https://smpithm.sch.id"
                        value={data.website || ''}
                        onChange={(e) => setData({...data, website: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Alamat Lengkap & Wilayah */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-100">
                    <MapPin size={16} className="text-red-500" /> Alamat & Domisili Lembaga
                  </h3>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Alamat Jalan / Kompleks Utama <span className="text-red-500">*</span>
                    </label>
                    <textarea 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm font-medium"
                      placeholder="Misal: Dusun Sukaseneng RT 025 RW 010 Desa Compreng..."
                      rows="2"
                      value={data.alamat || ''}
                      onChange={(e) => setData({...data, alamat: e.target.value})}
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">RT</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        placeholder="025"
                        value={data.rt || ''}
                        onChange={(e) => setData({...data, rt: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">RW</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        placeholder="010"
                        value={data.rw || ''}
                        onChange={(e) => setData({...data, rw: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Dusun</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        placeholder="Sukaseneng"
                        value={data.dusun || ''}
                        onChange={(e) => setData({...data, dusun: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Desa / Kelurahan</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        placeholder="Compreng"
                        value={data.desa || ''}
                        onChange={(e) => setData({...data, desa: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Kecamatan</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        placeholder="Compreng"
                        value={data.kecamatan || ''}
                        onChange={(e) => setData({...data, kecamatan: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Kabupaten / Kota</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        placeholder="Subang"
                        value={data.kabupaten || ''}
                        onChange={(e) => setData({...data, kabupaten: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Provinsi</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        placeholder="Jawa Barat"
                        value={data.provinsi || ''}
                        onChange={(e) => setData({...data, provinsi: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Kode Pos</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        placeholder="41258"
                        value={data.kode_pos || ''}
                        onChange={(e) => setData({...data, kode_pos: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: LEGALITAS LEMBAGA */}
          {/* ========================================================================= */}
          {currentTab === 'legalitas_lembaga' && (
            <div className="space-y-6">
              {/* Grid 5 Dokumen Pokok Sekolah */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. SK Pendirian Sekolah */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">SK Pendirian Sekolah</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-primary border border-blue-100">
                      Wajib
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nomor SK Pendirian</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Misal: 421.3/Kep.123-Disdik/2021"
                        value={data.legalitas_lembaga?.sk_pendirian?.nomor || ''}
                        onChange={(e) => updateLegalitasLembaga('sk_pendirian', 'nomor', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal SK</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          value={data.legalitas_lembaga?.sk_pendirian?.tanggal || ''}
                          onChange={(e) => updateLegalitasLembaga('sk_pendirian', 'tanggal', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Penerbit SK</label>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          placeholder="Dinas Pendidikan"
                          value={data.legalitas_lembaga?.sk_pendirian?.penerbit || ''}
                          onChange={(e) => updateLegalitasLembaga('sk_pendirian', 'penerbit', e.target.value)}
                        />
                      </div>
                    </div>

                    <FileUploadBox 
                      title="Berkas SK Pendirian (Gambar/PDF)"
                      docData={data.legalitas_lembaga?.sk_pendirian}
                      fieldKey="sk_pendirian"
                      onFileUploaded={(res) => {
                        updateLegalitasLembaga('sk_pendirian', 'file_url', res.file_url);
                        updateLegalitasLembaga('sk_pendirian', 'file_name', res.file_name);
                        updateLegalitasLembaga('sk_pendirian', 'file_type', res.file_type);
                      }}
                      onFileRemoved={() => {
                        updateLegalitasLembaga('sk_pendirian', 'file_url', '');
                        updateLegalitasLembaga('sk_pendirian', 'file_name', '');
                        updateLegalitasLembaga('sk_pendirian', 'file_type', '');
                      }}
                    />
                  </div>
                </div>

                {/* 2. SK Izin Operasional */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">SK Izin Operasional</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Wajib
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nomor Izin Operasional</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Misal: 503/012/DPMPTSP/2022"
                        value={data.legalitas_lembaga?.sk_operasional?.nomor || ''}
                        onChange={(e) => updateLegalitasLembaga('sk_operasional', 'nomor', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal Terbit</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          value={data.legalitas_lembaga?.sk_operasional?.tanggal || ''}
                          onChange={(e) => updateLegalitasLembaga('sk_operasional', 'tanggal', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Masa Berlaku</label>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          placeholder="Misal: Berlaku Selamanya"
                          value={data.legalitas_lembaga?.sk_operasional?.masa_berlaku || ''}
                          onChange={(e) => updateLegalitasLembaga('sk_operasional', 'masa_berlaku', e.target.value)}
                        />
                      </div>
                    </div>

                    <FileUploadBox 
                      title="Berkas SK Operasional (Gambar/PDF)"
                      docData={data.legalitas_lembaga?.sk_operasional}
                      fieldKey="sk_operasional"
                      onFileUploaded={(res) => {
                        updateLegalitasLembaga('sk_operasional', 'file_url', res.file_url);
                        updateLegalitasLembaga('sk_operasional', 'file_name', res.file_name);
                        updateLegalitasLembaga('sk_operasional', 'file_type', res.file_type);
                      }}
                      onFileRemoved={() => {
                        updateLegalitasLembaga('sk_operasional', 'file_url', '');
                        updateLegalitasLembaga('sk_operasional', 'file_name', '');
                        updateLegalitasLembaga('sk_operasional', 'file_type', '');
                      }}
                    />
                  </div>
                </div>

                {/* 3. Sertifikat Akreditasi (BAN-S/M) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">Sertifikat Akreditasi (BAN-S/M)</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                      Akreditasi
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nomor Sertifikat Akreditasi</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Misal: 123/BAN-SM/SK/2023"
                        value={data.legalitas_lembaga?.akreditasi?.nomor || ''}
                        onChange={(e) => updateLegalitasLembaga('akreditasi', 'nomor', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Nilai / Peringkat</label>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          placeholder="Nilai: 92 (Peringkat A)"
                          value={data.legalitas_lembaga?.akreditasi?.peringkat || ''}
                          onChange={(e) => updateLegalitasLembaga('akreditasi', 'peringkat', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Berlaku Sampai</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          value={data.legalitas_lembaga?.akreditasi?.berlaku_sampai || ''}
                          onChange={(e) => updateLegalitasLembaga('akreditasi', 'berlaku_sampai', e.target.value)}
                        />
                      </div>
                    </div>

                    <FileUploadBox 
                      title="Berkas Sertifikat Akreditasi (Gambar/PDF)"
                      docData={data.legalitas_lembaga?.akreditasi}
                      fieldKey="sertifikat_akreditasi"
                      onFileUploaded={(res) => {
                        updateLegalitasLembaga('akreditasi', 'file_url', res.file_url);
                        updateLegalitasLembaga('akreditasi', 'file_name', res.file_name);
                        updateLegalitasLembaga('akreditasi', 'file_type', res.file_type);
                      }}
                      onFileRemoved={() => {
                        updateLegalitasLembaga('akreditasi', 'file_url', '');
                        updateLegalitasLembaga('akreditasi', 'file_name', '');
                        updateLegalitasLembaga('akreditasi', 'file_type', '');
                      }}
                    />
                  </div>
                </div>

                {/* 4. NPWP Sekolah / Lembaga */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                        4
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">NPWP Sekolah / Lembaga</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                      Pajak
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nomor NPWP</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Misal: 00.000.000.0-000.000"
                        value={data.legalitas_lembaga?.npwp?.nomor || ''}
                        onChange={(e) => updateLegalitasLembaga('npwp', 'nomor', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nama Wajib Pajak di NPWP</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Misal: SMP IT HIDAYATUL MUBTADI-IEN"
                        value={data.legalitas_lembaga?.npwp?.nama || ''}
                        onChange={(e) => updateLegalitasLembaga('npwp', 'nama', e.target.value)}
                      />
                    </div>

                    <FileUploadBox 
                      title="Kartu / Berkas NPWP (Gambar/PDF)"
                      docData={data.legalitas_lembaga?.npwp}
                      fieldKey="npwp_sekolah"
                      onFileUploaded={(res) => {
                        updateLegalitasLembaga('npwp', 'file_url', res.file_url);
                        updateLegalitasLembaga('npwp', 'file_name', res.file_name);
                        updateLegalitasLembaga('npwp', 'file_type', res.file_type);
                      }}
                      onFileRemoved={() => {
                        updateLegalitasLembaga('npwp', 'file_url', '');
                        updateLegalitasLembaga('npwp', 'file_name', '');
                        updateLegalitasLembaga('npwp', 'file_type', '');
                      }}
                    />
                  </div>
                </div>

                {/* 5. Piagam / Sertifikat NPSN (Full width on medium) */}
                <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-sm">
                        5
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">Piagam / Sertifikat NPSN Kemendikbudristek</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-100">
                      NPSN: {data.npsn || '-'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Nomor Piagam NPSN</label>
                        <input 
                          type="text"
                          className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                          placeholder="Nomor Piagam atau Registrasi NPSN"
                          value={data.legalitas_lembaga?.piagam_npsn?.nomor || ''}
                          onChange={(e) => updateLegalitasLembaga('piagam_npsn', 'nomor', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal Terbit</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          value={data.legalitas_lembaga?.piagam_npsn?.tanggal || ''}
                          onChange={(e) => updateLegalitasLembaga('piagam_npsn', 'tanggal', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <FileUploadBox 
                        title="Berkas Piagam NPSN (Gambar/PDF)"
                        docData={data.legalitas_lembaga?.piagam_npsn}
                        fieldKey="piagam_npsn"
                        onFileUploaded={(res) => {
                          updateLegalitasLembaga('piagam_npsn', 'file_url', res.file_url);
                          updateLegalitasLembaga('piagam_npsn', 'file_name', res.file_name);
                          updateLegalitasLembaga('piagam_npsn', 'file_type', res.file_type);
                        }}
                        onFileRemoved={() => {
                          updateLegalitasLembaga('piagam_npsn', 'file_url', '');
                          updateLegalitasLembaga('piagam_npsn', 'file_name', '');
                          updateLegalitasLembaga('piagam_npsn', 'file_type', '');
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Tambahan Dokumen Legalitas Lembaga */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                      <FileCheck size={16} className="text-primary" /> Dokumen Perizinan & Surat Keputusan Tambahan Lainnya
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Unggah berkas lain seperti IMB Sekolah, SK Kemenag, Rekomendasi Camat, Izin Lingkungan, dll.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDokumenLembaga}
                    className="bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto"
                  >
                    <Plus size={15} /> Tambah Dokumen Baru
                  </button>
                </div>

                {data.dokumen_tambahan_lembaga.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs font-semibold text-gray-500">Belum ada dokumen legalitas tambahan.</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Klik tombol di atas untuk menambahkan dokumen perizinan sekolah lainnya.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.dokumen_tambahan_lembaga.map((doc, idx) => (
                      <div key={doc.id || idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50/40 relative space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-gray-700 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            {doc.judul || `Dokumen Tambahan #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDokumenLembaga(idx)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded-md transition"
                            title="Hapus Dokumen"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Judul / Nama Dokumen</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                              placeholder="Misal: Sertifikat Laik Fungsi"
                              value={doc.judul || ''}
                              onChange={(e) => handleUpdateDokumenLembaga(idx, 'judul', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Nomor Dokumen</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                              placeholder="Nomor Surat / SK"
                              value={doc.nomor || ''}
                              onChange={(e) => handleUpdateDokumenLembaga(idx, 'nomor', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Tanggal Terbit</label>
                            <input 
                              type="date"
                              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                              value={doc.tanggal || ''}
                              onChange={(e) => handleUpdateDokumenLembaga(idx, 'tanggal', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Keterangan Tambahan</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                              placeholder="Keterangan singkat instansi/masa berlaku"
                              value={doc.keterangan || ''}
                              onChange={(e) => handleUpdateDokumenLembaga(idx, 'keterangan', e.target.value)}
                            />
                          </div>
                          <div>
                            <FileUploadBox 
                              title={`Berkas ${doc.judul || 'Dokumen'}`}
                              docData={doc}
                              fieldKey={`dokumen_lembaga_extra_${idx}`}
                              onFileUploaded={(res) => {
                                handleUpdateDokumenLembaga(idx, 'file_url', res.file_url);
                                handleUpdateDokumenLembaga(idx, 'file_name', res.file_name);
                                handleUpdateDokumenLembaga(idx, 'file_type', res.file_type);
                              }}
                              onFileRemoved={() => {
                                handleUpdateDokumenLembaga(idx, 'file_url', '');
                                handleUpdateDokumenLembaga(idx, 'file_name', '');
                                handleUpdateDokumenLembaga(idx, 'file_type', '');
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: LEGALITAS YAYASAN */}
          {/* ========================================================================= */}
          {currentTab === 'legalitas_yayasan' && (
            <div className="space-y-6">
              {/* Profil Singkat Yayasan */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-100">
                  <Landmark size={16} className="text-primary" /> Profil Yayasan Penyelenggara
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Nama Yayasan Penyelenggara <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-gray-800 transition"
                      placeholder="Misal: Yayasan Hidayatul Mubtadi-ien"
                      value={data.nama_yayasan || ''}
                      onChange={(e) => setData({...data, nama_yayasan: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Ketua Yayasan / Pembina
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-semibold text-gray-800 transition"
                      placeholder="Nama Ketua Yayasan Lengkap"
                      value={data.ketua_yayasan || ''}
                      onChange={(e) => setData({...data, ketua_yayasan: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Alamat Kantor Sekretariat Yayasan
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-gray-800 transition text-sm"
                      placeholder="Alamat kantor yayasan..."
                      value={data.legalitas_yayasan?.alamat_yayasan || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        legalitas_yayasan: { ...prev.legalitas_yayasan, alamat_yayasan: e.target.value }
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Kontak Telepon / WA Yayasan
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-gray-800 transition text-sm"
                      placeholder="0812-xxxx-xxxx"
                      value={data.legalitas_yayasan?.kontak_yayasan || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        legalitas_yayasan: { ...prev.legalitas_yayasan, kontak_yayasan: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </div>

              {/* Grid 5 Dokumen Pokok Yayasan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Akta Pendirian Yayasan */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">Akta Pendirian Notaris Yayasan</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Notaris
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nomor Akta Notaris</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Misal: Nomor 08 Tanggal 12 Mei 2010"
                        value={data.legalitas_yayasan?.akta_pendirian?.nomor || ''}
                        onChange={(e) => updateLegalitasYayasan('akta_pendirian', 'nomor', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Nama Notaris</label>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          placeholder="Nama Notaris, S.H., M.Kn."
                          value={data.legalitas_yayasan?.akta_pendirian?.notaris || ''}
                          onChange={(e) => updateLegalitasYayasan('akta_pendirian', 'notaris', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal Akta</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          value={data.legalitas_yayasan?.akta_pendirian?.tanggal || ''}
                          onChange={(e) => updateLegalitasYayasan('akta_pendirian', 'tanggal', e.target.value)}
                        />
                      </div>
                    </div>

                    <FileUploadBox 
                      title="Berkas Akta Pendirian (Gambar/PDF)"
                      docData={data.legalitas_yayasan?.akta_pendirian}
                      fieldKey="akta_pendirian_yayasan"
                      onFileUploaded={(res) => {
                        updateLegalitasYayasan('akta_pendirian', 'file_url', res.file_url);
                        updateLegalitasYayasan('akta_pendirian', 'file_name', res.file_name);
                        updateLegalitasYayasan('akta_pendirian', 'file_type', res.file_type);
                      }}
                      onFileRemoved={() => {
                        updateLegalitasYayasan('akta_pendirian', 'file_url', '');
                        updateLegalitasYayasan('akta_pendirian', 'file_name', '');
                        updateLegalitasYayasan('akta_pendirian', 'file_type', '');
                      }}
                    />
                  </div>
                </div>

                {/* 2. SK Pengesahan Kemenkumham */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">SK Kemenkumham RI</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">
                      Pengesahan
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nomor SK Kemenkumham</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Misal: AHU-0012345.AH.01.04.Tahun 2015"
                        value={data.legalitas_yayasan?.sk_kemenkumham?.nomor || ''}
                        onChange={(e) => updateLegalitasYayasan('sk_kemenkumham', 'nomor', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal SK Kemenkumham</label>
                      <input 
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                        value={data.legalitas_yayasan?.sk_kemenkumham?.tanggal || ''}
                        onChange={(e) => updateLegalitasYayasan('sk_kemenkumham', 'tanggal', e.target.value)}
                      />
                    </div>

                    <FileUploadBox 
                      title="Berkas SK Kemenkumham (Gambar/PDF)"
                      docData={data.legalitas_yayasan?.sk_kemenkumham}
                      fieldKey="sk_kemenkumham_yayasan"
                      onFileUploaded={(res) => {
                        updateLegalitasYayasan('sk_kemenkumham', 'file_url', res.file_url);
                        updateLegalitasYayasan('sk_kemenkumham', 'file_name', res.file_name);
                        updateLegalitasYayasan('sk_kemenkumham', 'file_type', res.file_type);
                      }}
                      onFileRemoved={() => {
                        updateLegalitasYayasan('sk_kemenkumham', 'file_url', '');
                        updateLegalitasYayasan('sk_kemenkumham', 'file_name', '');
                        updateLegalitasYayasan('sk_kemenkumham', 'file_type', '');
                      }}
                    />
                  </div>
                </div>

                {/* 3. Akta Perubahan Yayasan Terakhir (Opsional) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">Akta Perubahan Yayasan (Jika Ada)</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      Opsional
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nomor Akta Perubahan</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Nomor Akta Perubahan Notaris"
                        value={data.legalitas_yayasan?.akta_perubahan?.nomor || ''}
                        onChange={(e) => updateLegalitasYayasan('akta_perubahan', 'nomor', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Nama Notaris</label>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          placeholder="Nama Notaris"
                          value={data.legalitas_yayasan?.akta_perubahan?.notaris || ''}
                          onChange={(e) => updateLegalitasYayasan('akta_perubahan', 'notaris', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal Akta</label>
                        <input 
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                          value={data.legalitas_yayasan?.akta_perubahan?.tanggal || ''}
                          onChange={(e) => updateLegalitasYayasan('akta_perubahan', 'tanggal', e.target.value)}
                        />
                      </div>
                    </div>

                    <FileUploadBox 
                      title="Berkas Akta Perubahan (Gambar/PDF)"
                      docData={data.legalitas_yayasan?.akta_perubahan}
                      fieldKey="akta_perubahan_yayasan"
                      onFileUploaded={(res) => {
                        updateLegalitasYayasan('akta_perubahan', 'file_url', res.file_url);
                        updateLegalitasYayasan('akta_perubahan', 'file_name', res.file_name);
                        updateLegalitasYayasan('akta_perubahan', 'file_type', res.file_type);
                      }}
                      onFileRemoved={() => {
                        updateLegalitasYayasan('akta_perubahan', 'file_url', '');
                        updateLegalitasYayasan('akta_perubahan', 'file_name', '');
                        updateLegalitasYayasan('akta_perubahan', 'file_type', '');
                      }}
                    />
                  </div>
                </div>

                {/* 4. NPWP Yayasan */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                        4
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">NPWP Yayasan</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                      Pajak
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nomor NPWP Yayasan</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Misal: 01.234.567.8-901.000"
                        value={data.legalitas_yayasan?.npwp?.nomor || ''}
                        onChange={(e) => updateLegalitasYayasan('npwp', 'nomor', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Nama Wajib Pajak di NPWP</label>
                      <input 
                        type="text"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Nama Yayasan tertera di NPWP"
                        value={data.legalitas_yayasan?.npwp?.nama || ''}
                        onChange={(e) => updateLegalitasYayasan('npwp', 'nama', e.target.value)}
                      />
                    </div>

                    <FileUploadBox 
                      title="Berkas NPWP Yayasan (Gambar/PDF)"
                      docData={data.legalitas_yayasan?.npwp}
                      fieldKey="npwp_yayasan"
                      onFileUploaded={(res) => {
                        updateLegalitasYayasan('npwp', 'file_url', res.file_url);
                        updateLegalitasYayasan('npwp', 'file_name', res.file_name);
                        updateLegalitasYayasan('npwp', 'file_type', res.file_type);
                      }}
                      onFileRemoved={() => {
                        updateLegalitasYayasan('npwp', 'file_url', '');
                        updateLegalitasYayasan('npwp', 'file_name', '');
                        updateLegalitasYayasan('npwp', 'file_type', '');
                      }}
                    />
                  </div>
                </div>

                {/* 5. Legalitas Tanah / Wakaf (Full width on medium) */}
                <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        5
                      </div>
                      <h4 className="font-bold text-gray-800 text-sm">Status Kepemilikan Lahan / Sertifikat Tanah / Akta Wakaf</h4>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Lahan & Properti
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Status Kepemilikan</label>
                          <select 
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold"
                            value={data.legalitas_yayasan?.tanah?.jenis || 'Wakaf'}
                            onChange={(e) => updateLegalitasYayasan('tanah', 'jenis', e.target.value)}
                          >
                            <option value="Wakaf">Wakaf</option>
                            <option value="Hak Milik (SHM)">Hak Milik (SHM)</option>
                            <option value="Hak Guna Bangunan (HGB)">Hak Guna Bangunan (HGB)</option>
                            <option value="Hibah">Hibah</option>
                            <option value="Pinjam Pakai">Pinjam Pakai</option>
                            <option value="Sewa">Sewa Kontrak</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Luas Lahan (m²)</label>
                          <input 
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                            placeholder="Misal: 2500"
                            value={data.legalitas_yayasan?.tanah?.luas || ''}
                            onChange={(e) => updateLegalitasYayasan('tanah', 'luas', e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Nomor Sertifikat / Akta Ikrar Wakaf (AIW)</label>
                        <input 
                          type="text"
                          className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                          placeholder="Nomor Sertifikat Hak Milik atau AIW KUA"
                          value={data.legalitas_yayasan?.tanah?.nomor || ''}
                          onChange={(e) => updateLegalitasYayasan('tanah', 'nomor', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Atas Nama / Nama Wakif</label>
                        <input 
                          type="text"
                          className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                          placeholder="Atas nama tertera di sertifikat"
                          value={data.legalitas_yayasan?.tanah?.atas_nama || ''}
                          onChange={(e) => updateLegalitasYayasan('tanah', 'atas_nama', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <FileUploadBox 
                        title="Berkas Sertifikat Tanah / Akta Wakaf (Gambar/PDF)"
                        docData={data.legalitas_yayasan?.tanah}
                        fieldKey="tanah_yayasan"
                        onFileUploaded={(res) => {
                          updateLegalitasYayasan('tanah', 'file_url', res.file_url);
                          updateLegalitasYayasan('tanah', 'file_name', res.file_name);
                          updateLegalitasYayasan('tanah', 'file_type', res.file_type);
                        }}
                        onFileRemoved={() => {
                          updateLegalitasYayasan('tanah', 'file_url', '');
                          updateLegalitasYayasan('tanah', 'file_name', '');
                          updateLegalitasYayasan('tanah', 'file_type', '');
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Tambahan Dokumen Legalitas Yayasan */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                      <FileCheck size={16} className="text-primary" /> Dokumen & SK Yayasan Tambahan Lainnya
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Unggah berkas lain seperti SK Pengangkatan Pengurus, Berita Acara Rapat Pembina, Rekening Yayasan, dll.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDokumenYayasan}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto"
                  >
                    <Plus size={15} /> Tambah Dokumen Yayasan
                  </button>
                </div>

                {data.dokumen_tambahan_yayasan.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs font-semibold text-gray-500">Belum ada dokumen legalitas yayasan tambahan.</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Klik tombol di atas untuk menambahkan berkas yayasan lainnya.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.dokumen_tambahan_yayasan.map((doc, idx) => (
                      <div key={doc.id || idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50/40 relative space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-gray-700 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            {doc.judul || `Dokumen Yayasan #${idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDokumenYayasan(idx)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded-md transition"
                            title="Hapus Dokumen"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Judul Dokumen</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                              placeholder="Misal: SK Pengurus Yayasan"
                              value={doc.judul || ''}
                              onChange={(e) => handleUpdateDokumenYayasan(idx, 'judul', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Nomor Dokumen</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                              placeholder="Nomor Surat"
                              value={doc.nomor || ''}
                              onChange={(e) => handleUpdateDokumenYayasan(idx, 'nomor', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Tanggal</label>
                            <input 
                              type="date"
                              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                              value={doc.tanggal || ''}
                              onChange={(e) => handleUpdateDokumenYayasan(idx, 'tanggal', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Keterangan Dokumen</label>
                            <input 
                              type="text"
                              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                              placeholder="Keterangan singkat..."
                              value={doc.keterangan || ''}
                              onChange={(e) => handleUpdateDokumenYayasan(idx, 'keterangan', e.target.value)}
                            />
                          </div>
                          <div>
                            <FileUploadBox 
                              title={`Berkas ${doc.judul || 'Dokumen'}`}
                              docData={doc}
                              fieldKey={`dokumen_yayasan_extra_${idx}`}
                              onFileUploaded={(res) => {
                                handleUpdateDokumenYayasan(idx, 'file_url', res.file_url);
                                handleUpdateDokumenYayasan(idx, 'file_name', res.file_name);
                                handleUpdateDokumenYayasan(idx, 'file_type', res.file_type);
                              }}
                              onFileRemoved={() => {
                                handleUpdateDokumenYayasan(idx, 'file_url', '');
                                handleUpdateDokumenYayasan(idx, 'file_name', '');
                                handleUpdateDokumenYayasan(idx, 'file_type', '');
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Preview Berkas (Gambar / PDF) */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-xl ${previewDoc.type === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-primary'}`}>
                  {previewDoc.type === 'pdf' ? <FileText size={20} /> : <ImageIcon size={20} />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-800 truncate">
                    {previewDoc.title || 'Pratinjau Dokumen'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {previewDoc.type === 'pdf' ? 'Dokumen Format PDF' : 'Berkas Format Gambar'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a 
                  href={previewDoc.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg flex items-center gap-1.5 transition"
                >
                  <ExternalLink size={14} /> Buka Tab Baru
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center min-h-[400px]">
              {previewDoc.type === 'pdf' ? (
                <iframe 
                  src={previewDoc.url} 
                  title={previewDoc.title || 'PDF Preview'} 
                  className="w-full h-[70vh] rounded-xl border border-gray-300 bg-white shadow-xs"
                />
              ) : (
                <img 
                  src={previewDoc.url} 
                  alt={previewDoc.title || 'Preview'} 
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-md bg-white p-1"
                />
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
