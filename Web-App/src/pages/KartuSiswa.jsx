import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import CryptoJS from 'crypto-js';
import { 
  Users, Search, Printer, Palette, Image as ImageIcon, 
  Trash2, X, Plus, Minus, Save, ArrowLeft, Sun, Moon,
  CheckSquare, Square, LayoutTemplate
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function KartuSiswa() {
  const location = useLocation();
  const navigate = useNavigate();
  const preselectId = location.state?.preselectId;

  const [allSiswa, setAllSiswa] = useState([]);
  const [selectedSiswaIds, setSelectedSiswaIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);

  // Settings State
  const [settings, setSettings] = useState({
    orientation: 'landscape',
    themeColor: '#2a2c87',
    warnaNama: '#000000',
    warnaIdentitas: '#374151',
    warnaTtd: '#000000',
    warnaJudul: '#2a2c87',
    mirrorPVC: false,
    cardTheme: 'light',
    scale: 1,
    showFields: {
      photo: true,
      qrcode: true,
      schoolLogo: true,
      signature: true
    },
    bgImage: null,
    bgImageBack: null,
    bgDepanPath: null,
    bgBelakangPath: null,
    savedDesignId: null
  });

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryList, setGalleryList] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dataLembaga, setDataLembaga] = useState(null);

  const SECRET_KEY = import.meta.env.VITE_KARTU_SISWA_SECRET || "KARTU_SISWA_SECRET";

  useEffect(() => {
    fetchSiswa();
    loadSavedBackgrounds();
    fetchLembaga();
  }, []);

  const fetchLembaga = async () => {
    try {
      const { data, error } = await supabase
        .from('data_lembaga')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setDataLembaga(data);
      }
    } catch (error) {
      console.error("Error fetching lembaga:", error);
    }
  };

  useEffect(() => {
    if (preselectId && allSiswa.length > 0) {
      if (!selectedSiswaIds.includes(preselectId)) {
        setSelectedSiswaIds(prev => [...prev, preselectId]);
      }
    }
  }, [preselectId, allSiswa]);

  const fetchSiswa = async () => {
    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('id, nama, nisn, nipd, foto_url, kelas, tempat_lahir, tanggal_lahir, alamat_detail, desa, kecamatan, kabupaten')
        .neq('kelas', 'Calon Siswa')
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (error) throw error;
      
      const processedData = (data || []).map(s => ({
        ...s,
        encryptedNipd: CryptoJS.AES.encrypt(s.nipd || "NO-DATA", SECRET_KEY).toString()
      }));
      setAllSiswa(processedData);
    } catch (err) {
      console.error("Error fetching siswa:", err);
      Swal.fire('Gagal', 'Gagal memuat data siswa', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedBackgrounds = async () => {
    try {
      const { data, error } = await supabase
        .from('id_card_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      setSettings(prev => ({
        ...prev,
        savedDesignId: data.id,
        orientation: data.orientasi || 'landscape',
        themeColor: data.warna_tema || '#2a2c87',
        warnaNama: data.warna_nama || '#000000',
        warnaIdentitas: data.warna_identitas || '#374151',
        warnaTtd: data.warna_ttd || '#000000',
        warnaJudul: data.warna_judul || data.warna_tema || '#2a2c87',
        mirrorPVC: data.mirror_pvc ?? false,
        cardTheme: data.tema_kartu || 'light',
        scale: parseFloat(data.zoom_scale) || 1.0,
        showFields: {
          photo: data.tampil_foto ?? true,
          qrcode: data.tampil_qr ?? true,
          schoolLogo: data.tampil_logo ?? true,
          signature: data.tampil_ttd ?? true
        },
        bgImage: data.bg_depan || null,
        bgImageBack: data.bg_belakang || null,
        bgDepanPath: data.bg_depan_path || null,
        bgBelakangPath: data.bg_belakang_path || null
      }));
    } catch (e) {
      console.warn('Gagal load saved settings:', e);
    }
  };

  const saveCurrentSettings = async () => {
    Swal.fire({ title: 'Menyimpan...', text: 'Menyimpan pengaturan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      const timestamp = Date.now();
      let bgDepanUrl = settings.bgImage;
      let bgDepanPath = settings.bgDepanPath;
      let bgBelakangUrl = settings.bgImageBack;
      let bgBelakangPath = settings.bgBelakangPath;

      // Handle Base64 uploads (omitted full logic for brevity, assuming standard supabase storage upload logic)
      if (settings.bgImage && settings.bgImage.startsWith('data:')) {
        const file = dataURLtoFile(settings.bgImage, `bg_depan_${timestamp}.jpg`);
        if (settings.bgDepanPath) await supabase.storage.from('id-card-backgrounds').remove([settings.bgDepanPath]);
        const { error } = await supabase.storage.from('id-card-backgrounds').upload(file.name, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('id-card-backgrounds').getPublicUrl(file.name);
        bgDepanUrl = urlData.publicUrl;
        bgDepanPath = file.name;
      }

      if (settings.bgImageBack && settings.bgImageBack.startsWith('data:')) {
        const file = dataURLtoFile(settings.bgImageBack, `bg_belakang_${timestamp}.jpg`);
        if (settings.bgBelakangPath) await supabase.storage.from('id-card-backgrounds').remove([settings.bgBelakangPath]);
        const { error } = await supabase.storage.from('id-card-backgrounds').upload(file.name, file, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('id-card-backgrounds').getPublicUrl(file.name);
        bgBelakangUrl = urlData.publicUrl;
        bgBelakangPath = file.name;
      }

      const payload = {
        orientasi: settings.orientation,
        warna_tema: settings.themeColor,
        warna_nama: settings.warnaNama,
        warna_identitas: settings.warnaIdentitas,
        warna_ttd: settings.warnaTtd,
        warna_judul: settings.warnaJudul,
        bg_depan: bgDepanUrl,
        bg_depan_path: bgDepanPath,
        bg_belakang: bgBelakangUrl,
        bg_belakang_path: bgBelakangPath,
        mirror_pvc: settings.mirrorPVC,
        tema_kartu: settings.cardTheme,
        tampil_foto: settings.showFields.photo,
        tampil_qr: settings.showFields.qrcode,
        tampil_logo: settings.showFields.schoolLogo,
        tampil_ttd: settings.showFields.signature,
        zoom_scale: settings.scale
      };

      let newDesignId = settings.savedDesignId;
      if (settings.savedDesignId) {
        const { error } = await supabase.from('id_card_settings').update(payload).eq('id', settings.savedDesignId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('id_card_settings').insert([payload]).select().single();
        if (error) throw error;
        newDesignId = data.id;
      }

      setSettings(prev => ({
        ...prev,
        bgImage: bgDepanUrl,
        bgDepanPath: bgDepanPath,
        bgImageBack: bgBelakangUrl,
        bgBelakangPath: bgBelakangPath,
        savedDesignId: newDesignId
      }));

      Swal.fire({ title: 'Tersimpan!', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (error) {
      console.error(error);
      Swal.fire('Gagal!', 'Gagal menyimpan pengaturan', 'error');
    }
  };

  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, {type:mime});
  }

  const handleBgUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (type === 'front') {
          setSettings(prev => ({ ...prev, bgImage: event.target.result }));
        } else {
          setSettings(prev => ({ ...prev, bgImageBack: event.target.result }));
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeBgImage = (type) => {
    if (type === 'front') setSettings(prev => ({ ...prev, bgImage: null }));
    else setSettings(prev => ({ ...prev, bgImageBack: null }));
  };

  const toggleSiswa = (id) => {
    setSelectedSiswaIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const toggleAllSiswa = (check) => {
    if (check) setSelectedSiswaIds(allSiswa.map(s => s.id));
    else setSelectedSiswaIds([]);
  };

  const uniqueKelas = [...new Set(allSiswa.map(s => s.kelas).filter(Boolean))].sort();

  const filteredSiswa = allSiswa.filter(s => 
    (s.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.nipd || '').toLowerCase().includes(searchQuery.toLowerCase())) &&
    (selectedKelas ? s.kelas === selectedKelas : true)
  );

  const selectedStudents = allSiswa.filter(s => selectedSiswaIds.includes(s.id));
  const studentsPerPage = 5; // 5 students per A4 (front and back = 10 cards total)
  
  const pages = [];
  for (let i = 0; i < selectedStudents.length; i += studentsPerPage) {
    pages.push(selectedStudents.slice(i, i + studentsPerPage));
  }

  const renderCard = (siswa, isBack = false) => {
    const isPortrait = settings.orientation === 'portrait';
    const isDark = settings.cardTheme === 'dark';
    const bgColor = settings.themeColor;
    const bgUrl = isBack ? settings.bgImageBack : settings.bgImage;
    const encryptedNIPD = siswa.encryptedNipd;
    const addressDetails = [siswa.alamat_detail, siswa.desa, siswa.kecamatan, siswa.kabupaten].filter(Boolean).join(' - ').toLowerCase();
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return isNaN(d) ? dateStr : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    
    // Dynamic styles based on theme
    const containerClasses = `relative overflow-hidden border border-gray-100 shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`;
    const textColorMain = isDark ? 'text-gray-100' : 'text-gray-800';
    const textColorSub = isDark ? 'text-gray-300' : 'text-gray-600';
    const textColorMuted = isDark ? 'text-gray-400' : 'text-gray-500';

    const cardContent = isPortrait ? (
      <div className={`${containerClasses} ${isBack ? 'print-rotate-minus-90' : 'print-rotate-90'}`} style={{ transform: isBack ? 'rotate(-90deg)' : 'rotate(90deg)', width: '56mm', height: '87.6mm', transformOrigin: 'center', flexShrink: 0 }}>
         <div className="absolute inset-0 z-0 print:hidden" style={{ backgroundImage: bgUrl ? `url(${bgUrl})` : 'none', backgroundSize: '56mm 87.6mm', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', backgroundColor: `${bgColor}10` }}></div>
         <div className="absolute top-0 left-0 w-full h-1.5 z-10" style={{ backgroundColor: bgColor }}></div>
         
         {!isBack ? (
            <div className="flex flex-col h-full w-full p-3 pt-4 z-0 relative">
                <div className="flex items-center justify-start gap-1.5 w-full mb-2 shrink-0">
                   {settings.showFields.schoolLogo && (
                     <img 
                       src={dataLembaga?.logo_url || "https://www.e-ujian.com/smpithm/logo"} 
                       className="w-7 h-7 object-contain shrink-0" 
                       onError={(e) => { e.target.style.display = 'none'; }}
                     />
                   )}
                   <div className="flex flex-col text-left border-b-[1.5px] pb-0.5 w-full" style={{ borderColor: bgColor }}>
                      <span className="text-[7.5px] font-extrabold uppercase leading-tight" style={{ color: settings.warnaJudul }}>
                        {dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}
                      </span>
                      <span className={`text-[5px] font-medium leading-tight mt-[1px]`} style={{ color: settings.warnaIdentitas }}>
                        {dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}
                      </span>
                   </div>
                </div>
               
               <div className="flex flex-col items-center flex-1 w-full">
                  <div className={`w-[23mm] h-[29mm] rounded-lg border-2 ${isDark ? 'border-gray-600' : 'border-white'} shadow-md overflow-hidden bg-gray-100 flex items-center justify-center mb-1.5 shrink-0 mx-auto`}>
                     {settings.showFields.photo && siswa.foto_url ? <img src={siswa.foto_url} className="w-full h-full object-cover" /> : <div className="text-gray-400 text-[8px]">No Photo</div>}
                  </div>
                  <h3 className={`text-[11.5px] font-bold text-center uppercase leading-snug line-clamp-2 w-full px-1`} style={{ color: settings.warnaNama }}>{siswa.nama}</h3>
                  <p className={`text-[7px] font-bold tracking-wider mt-0.5 border-b ${isDark ? 'border-gray-600' : 'border-gray-200'} pb-0.5 mb-1 text-center mx-auto w-2/3`} style={{ color: settings.warnaIdentitas }}>PESERTA DIDIK</p>
                  
                  <table className={`text-[6.5px] w-full leading-tight mt-1`} style={{ color: settings.warnaIdentitas }}>
                     <tbody>
                     <tr><td className="w-[12mm] font-bold align-top">NIPD</td><td className="w-[2mm] align-top">:</td><td className="align-top font-bold" style={{ color: settings.warnaIdentitas }}>{siswa.nipd || '-'}</td></tr>
                     <tr><td className="font-bold align-top">NISN</td><td className="align-top">:</td><td className="align-top">{siswa.nisn || '-'}</td></tr>
                     <tr><td className="font-bold align-top">TTL</td><td className="align-top">:</td><td className="align-top capitalize">{`${(siswa.tempat_lahir || '-').toLowerCase()}, ${formatDate(siswa.tanggal_lahir)}`}</td></tr>
                     <tr><td className="font-bold align-top">Alamat</td><td className="align-top">:</td><td className="align-top capitalize line-clamp-2">{addressDetails || '-'}</td></tr>
                     </tbody>
                  </table>

                  {settings.showFields.signature && (
                    <div className="mt-auto w-full flex justify-end items-end mb-1 shrink-0 px-2">
                        <div className="flex flex-col items-center text-center">
                            <p className={`text-[5.5px]`} style={{ color: settings.warnaTtd }}>Kepala Sekolah,</p>
                            <div className="w-[24mm] h-[10mm] flex items-center justify-center my-0.5 relative opacity-80">
                                <div className="italic text-[6px] font-serif border-b border-gray-400" style={{ color: settings.warnaTtd }}>{dataLembaga?.kepala_sekolah || 'Kepala Sekolah'}</div>
                            </div>
                        </div>
                    </div>
                  )}
               </div>
            </div>
         ) : (
            <div className="flex flex-col h-full w-full p-4 pt-5 z-0 relative text-center">
               <div className="mb-4 shrink-0">
                  <h3 className="text-[10px] font-bold uppercase mb-2 border-b border-gray-300 pb-1 inline-block" style={{ color: bgColor }}>Ketentuan Kartu</h3>
                  <ul className={`text-[7.5px] space-y-1.5 text-left w-full list-decimal pl-4 pr-1 leading-relaxed`} style={{ color: settings.warnaIdentitas }}>
                     <li>Kartu ini adalah identitas resmi peserta didik.</li>
                     <li>Wajib dibawa dan dipakai selama berada di sekolah.</li>
                     <li>Digunakan untuk presensi kehadiran & administrasi.</li>
                     <li>Apabila hilang/rusak, segera melapor.</li>
                  </ul>
               </div>
               
               <div className="mt-auto flex flex-col items-center mb-2 shrink-0">
                  {settings.showFields.qrcode && (
                    <div className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-200 flex items-center justify-center w-[22mm] h-[22mm]">
                      <QRCodeSVG value={encryptedNIPD} size={70} />
                    </div>
                  )}
                  <p className={`text-[6px] ${textColorSub} mt-1.5 text-center font-bold`}>Scan QR Presensi</p>
               </div>
               <p className={`text-[5.5px] ${textColorMuted} italic mt-1 font-medium w-full text-center`}>** Berlaku selama menjadi siswa **</p>
            </div>
         )}
      </div>
    ) : (
      // Landscape Layout
      <div className={`${containerClasses} flex ${isBack ? 'flex-row-reverse' : 'flex-col'}`} style={{ width: '87.6mm', height: '56mm' }}>
         <div className="absolute inset-0 z-0 print:hidden" style={{ backgroundImage: bgUrl ? `url(${bgUrl})` : 'none', backgroundSize: '87.6mm 56mm', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', backgroundColor: `${bgColor}10` }}></div>
         <div className={`absolute top-0 h-full w-1.5 z-10 ${isBack ? 'right-0' : 'left-0'}`} style={{ backgroundColor: bgColor }}></div>
         
         {!isBack ? (
            <div className="flex flex-col h-full w-full p-3 pl-4 z-0 relative">
                <div className={`flex items-center justify-start gap-2 w-full mb-1 shrink-0 border-b-[4px] pb-1 border-opacity-40`} style={{ borderBottomColor: bgColor }}>
                   {settings.showFields.schoolLogo && (
                     <img 
                       src={dataLembaga?.logo_url || "https://www.e-ujian.com/smpithm/logo"} 
                       className="w-8 h-8 object-contain shrink-0" 
                       onError={(e) => { e.target.style.display = 'none'; }}
                     />
                   )}
                   <div className="flex flex-col text-left w-full">
                      <span className="text-[10px] font-extrabold uppercase leading-tight" style={{ color: settings.warnaJudul }}>
                        {dataLembaga?.nama_lembaga || 'SMP IT HIDAYATUL MUBTADI-IEN'}
                      </span>
                      <span className={`text-[6.5px] font-medium leading-tight mt-[1px]`} style={{ color: settings.warnaIdentitas }}>
                        {dataLembaga?.alamat || 'Sukaseneng - Compreng - Subang'}
                      </span>
                   </div>
                </div>

               <div className="flex flex-1 gap-4 items-center mt-1">
                  <div className="flex flex-col items-center shrink-0">
                     <div className={`w-[22mm] h-[28mm] rounded-xl border-2 ${isDark ? 'border-gray-600' : 'border-white'} shadow-md overflow-hidden bg-gray-100 flex items-center justify-center`}>
                        {settings.showFields.photo && siswa.foto_url ? <img src={siswa.foto_url} className="w-full h-full object-cover" /> : <div className="text-gray-400 text-[8px]">No Photo</div>}
                     </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col h-full justify-start py-1">
                     <h3 className={`text-[12.5px] font-extrabold uppercase leading-snug line-clamp-1 border-b ${isDark ? 'border-gray-600' : 'border-gray-200'} pb-0.5 mb-1`} style={{ color: settings.warnaNama }}>{siswa.nama}</h3>
                     
                     <table className={`text-[7px] w-full leading-tight mt-0.5`} style={{ color: settings.warnaIdentitas }}>
                        <tbody>
                        <tr><td className="w-[12mm] font-bold align-top">NIPD</td><td className="w-[2mm] align-top">:</td><td className="align-top font-bold" style={{ color: settings.warnaIdentitas }}>{siswa.nipd || '-'}</td></tr>
                        <tr><td className="font-bold align-top">NISN</td><td className="align-top">:</td><td className="align-top">{siswa.nisn || '-'}</td></tr>
                        <tr><td className="font-bold align-top">TTL</td><td className="align-top">:</td><td className="align-top capitalize">{`${(siswa.tempat_lahir || '-').toLowerCase()}, ${formatDate(siswa.tanggal_lahir)}`}</td></tr>
                        <tr><td className="font-bold align-top">Alamat</td><td className="align-top">:</td><td className="align-top capitalize line-clamp-2">{addressDetails || '-'}</td></tr>
                        </tbody>
                     </table>
                     
                     {settings.showFields.signature && (
                        <div className="mt-auto flex justify-end w-full pr-2 shrink-0">
                           <div className="flex flex-col items-center text-center">
                              <p className={`text-[5.5px]`} style={{ color: settings.warnaTtd }}>Kepala Sekolah,</p>
                              <div className="w-[24mm] h-[10mm] flex items-center justify-center my-0.5 relative">
                                 <div className="italic text-[6px] font-serif border-b border-gray-400 mt-2" style={{ color: settings.warnaTtd }}>{dataLembaga?.kepala_sekolah || 'Kepala Sekolah'}</div>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         ) : (
            <div className="flex items-center h-full w-full p-3 gap-2 z-0 relative">
               <div className="flex-1 flex flex-col justify-center pl-2">
                  <h3 className="text-[10.5px] font-bold uppercase mb-2 border-b border-gray-300 pb-1 w-max" style={{ color: bgColor }}>Ketentuan Kartu</h3>
                  <ul className={`text-[7.5px] space-y-1.5 list-decimal pl-4 pr-1 leading-relaxed`} style={{ color: settings.warnaIdentitas }}>
                     <li>Kartu ini adalah identitas resmi peserta didik.</li>
                     <li>Wajib dibawa dan dipakai selama berada di sekolah.</li>
                     <li>Digunakan untuk presensi kehadiran & administrasi.</li>
                     <li>Apabila hilang atau rusak, melapor kepada pihak sekolah.</li>
                  </ul>
                  <p className={`text-[6px] italic mt-3 font-medium`} style={{ color: settings.warnaIdentitas }}>** Berlaku selama menjadi siswa **</p>
               </div>
               <div className={`flex flex-col items-center justify-center shrink-0 border-l ${isDark ? 'border-gray-600' : 'border-gray-200'} pl-4 pr-2 min-w-[26mm]`}>
                  {settings.showFields.qrcode && (
                    <div className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-200 flex items-center justify-center w-[22mm] h-[22mm]">
                      <QRCodeSVG value={encryptedNIPD} size={70} />
                    </div>
                  )}
                  <p className={`text-[6px] ${textColorSub} mt-1.5 text-center font-bold`}>Scan QR Presensi</p>
               </div>
            </div>
         )}
      </div>
    );

    return (
      <div 
        className="flex items-center justify-center shrink-0 relative"
        style={{ width: '87.6mm', height: '56mm', ...(settings.mirrorPVC ? { transform: 'scaleX(-1)' } : {}) }}
      >
        {cardContent}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full font-sans">
      
      {/* Header Halaman (di luar layout panel) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Users className="text-primary" /> Cetak Kartu Siswa
          </h2>
          <p className="text-gray-500 text-sm mt-1">Kelola dan cetak ID Card siswa.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button onClick={saveCurrentSettings} className="flex-1 md:flex-none justify-center px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shadow-md hover:bg-blue-800 transition-colors flex items-center gap-2">
              <Save size={18} /> Simpan
            </button>
            <button 
              onClick={() => window.print()}
              disabled={selectedSiswaIds.length === 0}
              className={`flex-1 md:flex-none justify-center px-4 py-2.5 text-sm font-bold rounded-xl shadow-md flex items-center gap-2 transition-all ${selectedSiswaIds.length > 0 ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              <Printer size={18} /> Cetak
            </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 pb-10 overflow-y-auto lg:overflow-hidden print:overflow-visible">
        
        {/* Left Control Panel */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 print:hidden h-auto lg:overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Settings Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
             <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2 border-b pb-2">
                <Palette className="text-primary" size={20} /> Pengaturan Kartu
             </h3>
             
             {/* Orientasi & Tema (Grid 2 kolom) */}
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Orientasi</label>
                  <div className="flex p-1 bg-gray-100 rounded-lg h-9 items-center border border-gray-200">
                    <button onClick={() => setSettings(s => ({...s, orientation: 'landscape'}))} className={`px-2 h-full text-xs font-bold rounded-md transition-all flex-1 ${settings.orientation === 'landscape' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Landscape</button>
                    <button onClick={() => setSettings(s => ({...s, orientation: 'portrait'}))} className={`px-2 h-full text-xs font-bold rounded-md transition-all flex-1 ${settings.orientation === 'portrait' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}>Portrait</button>
                  </div>
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Tema Warna Aksen</label>
                  <div className="flex items-center gap-2 h-9">
                    <input type="color" value={settings.themeColor} onChange={e => setSettings(s => ({...s, themeColor: e.target.value}))} className="w-9 h-9 p-0.5 border border-gray-200 rounded cursor-pointer flex-1" title="Warna Tema" />
                    <button onClick={() => setSettings(s => ({...s, cardTheme: s.cardTheme === 'dark' ? 'light' : 'dark'}))} className="w-9 h-9 border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">
                      {settings.cardTheme === 'dark' ? <Moon size={16} className="text-indigo-600" /> : <Sun size={16} className="text-yellow-500" />}
                    </button>
                  </div>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Warna Judul</label>
                  <input type="color" value={settings.warnaJudul} onChange={e => setSettings(s => ({...s, warnaJudul: e.target.value}))} className="w-full h-9 p-0.5 border border-gray-200 rounded cursor-pointer" title="Warna Judul" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Warna Nama</label>
                  <input type="color" value={settings.warnaNama} onChange={e => setSettings(s => ({...s, warnaNama: e.target.value}))} className="w-full h-9 p-0.5 border border-gray-200 rounded cursor-pointer" title="Warna Nama" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Warna Identitas</label>
                  <input type="color" value={settings.warnaIdentitas} onChange={e => setSettings(s => ({...s, warnaIdentitas: e.target.value}))} className="w-full h-9 p-0.5 border border-gray-200 rounded cursor-pointer" title="Warna Identitas" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Warna TTD</label>
                  <input type="color" value={settings.warnaTtd} onChange={e => setSettings(s => ({...s, warnaTtd: e.target.value}))} className="w-full h-9 p-0.5 border border-gray-200 rounded cursor-pointer" title="Warna TTD" />
                </div>
              </div>

             {/* Backgrounds */}
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">BG Depan</label>
                  <div className="flex items-center gap-1 h-9">
                    <label className="flex-1 h-full flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleBgUpload(e, 'front')} />
                      <ImageIcon size={14} className="text-primary" /> <span className="text-xs font-bold text-gray-600">Unggah</span>
                    </label>
                    {settings.bgImage && <button onClick={() => removeBgImage('front')} className="w-9 h-full flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={14} /></button>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">BG Belakang</label>
                  <div className="flex items-center gap-1 h-9">
                    <label className="flex-1 h-full flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleBgUpload(e, 'back')} />
                      <ImageIcon size={14} className="text-primary" /> <span className="text-xs font-bold text-gray-600">Unggah</span>
                    </label>
                    {settings.bgImageBack && <button onClick={() => removeBgImage('back')} className="w-9 h-full flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={14} /></button>}
                  </div>
                </div>
             </div>

             {/* Tampilan Field */}
             <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Tampilan Elemen</label>
                <div className="flex flex-wrap items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                  {Object.entries({photo: 'Foto', qrcode: 'QR', schoolLogo: 'Logo', signature: 'TTD'}).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={settings.showFields[key]} onChange={e => setSettings(s => ({...s, showFields: {...s.showFields, [key]: e.target.checked}}))} className="w-3.5 h-3.5 accent-primary" />
                      <span className="text-xs font-medium text-gray-600">{label}</span>
                    </label>
                  ))}
                </div>
             </div>

             {/* Scale & Mirror */}
             <div className="flex flex-col xl:flex-row items-center justify-between gap-4 border-t pt-3 mt-1">
                <div className="flex flex-col gap-1 w-full xl:w-1/2">
                   <label className="text-[10px] font-bold text-gray-500 uppercase">Zoom Preview</label>
                   <div className="flex items-center justify-between h-8 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
                      <button onClick={() => setSettings(s => ({...s, scale: Math.max(0.5, s.scale - 0.1)}))} className="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-white rounded hover:shadow-sm"><Minus size={14}/></button>
                      <span className="text-xs font-bold text-gray-700 w-12 text-center">{Math.round(settings.scale * 100)}%</span>
                      <button onClick={() => setSettings(s => ({...s, scale: Math.min(1.5, s.scale + 0.1)}))} className="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-white rounded hover:shadow-sm"><Plus size={14}/></button>
                   </div>
                </div>
                <div className="flex flex-col gap-1 w-full xl:w-1/2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Material Cetak</label>
                  <label className="flex items-center justify-center gap-2 h-8 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100">
                    <input type="checkbox" checked={settings.mirrorPVC} onChange={e => setSettings(s => ({...s, mirrorPVC: e.target.checked}))} className="w-3.5 h-3.5 accent-orange-500" />
                    <span className="text-xs font-bold text-orange-800">Mirror PVC</span>
                  </label>
                </div>
             </div>
          </div>

          {/* Student Selection Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col flex-1 min-h-[300px] lg:min-h-[400px]">
             <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 border-b pb-2">
                <Users className="text-primary" size={20} /> Pilih Siswa ({selectedSiswaIds.length})
             </h3>
             <div className="relative mb-3">
               <input 
                 type="text" 
                 placeholder="Cari nama atau NIPD..." 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
               />
               <Search className="absolute left-3 top-3 text-gray-400" size={16} />
             </div>

             {/* Filter Kelas */}
             <div className="mb-3">
               <select
                 value={selectedKelas}
                 onChange={e => {
                   setSelectedKelas(e.target.value);
                   // Kosongkan pilihan jika filter berubah agar tidak bingung
                   // setSelectedSiswaIds([]); 
                 }}
                 className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow text-gray-700"
               >
                 <option value="">Semua Kelas</option>
                 {uniqueKelas.map(k => (
                   <option key={k} value={k}>{k}</option>
                 ))}
               </select>
             </div>

             <div className="flex justify-between items-center mb-2 px-1">
               <button onClick={() => toggleAllSiswa(true)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"><CheckSquare size={14}/> Pilih Semua</button>
               <button onClick={() => toggleAllSiswa(false)} className="text-xs font-bold text-gray-400 hover:underline flex items-center gap-1.5"><Square size={14}/> Kosongkan</button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
               {isLoading ? (
                 <div className="py-10 text-center text-sm text-gray-400">Memuat data...</div>
               ) : filteredSiswa.length === 0 ? (
                 <div className="py-10 text-center text-sm text-gray-400">Tidak ada siswa ditemukan</div>
               ) : (
                 filteredSiswa.map(siswa => (
                   <div 
                     key={siswa.id} 
                     onClick={() => toggleSiswa(siswa.id)}
                     className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedSiswaIds.includes(siswa.id) ? 'bg-primary/5 border border-primary/20' : 'hover:bg-gray-50 border border-transparent'}`}
                   >
                     <input 
                       type="checkbox" 
                       checked={selectedSiswaIds.includes(siswa.id)}
                       readOnly
                       className="w-4 h-4 rounded text-primary focus:ring-primary/20 accent-primary"
                     />
                     <div className="flex-1">
                       <p className="text-sm font-bold text-gray-800 leading-tight">{siswa.nama}</p>
                       <p className="text-xs text-gray-500 mt-0.5">{siswa.nipd || 'NIPD Kosong'}</p>
                     </div>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>

        {/* Right Preview Panel */}
        <div className="w-full lg:flex-1 h-[600px] lg:h-auto overflow-auto bg-gray-200 p-4 lg:p-8 rounded-2xl border-4 border-dashed border-gray-300 flex flex-col items-start lg:items-center custom-scrollbar print:border-none print:bg-white print:p-0 print:overflow-visible relative print:static">
          {selectedSiswaIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center opacity-50 no-print w-full h-full min-h-[300px] absolute inset-0">
               <div className="w-32 h-32 bg-gray-300 rounded-full flex items-center justify-center mb-6 shrink-0">
                  <LayoutTemplate size={48} className="text-gray-500" />
               </div>
               <h3 className="text-xl font-bold text-gray-600">Belum Ada Kartu Terpilih</h3>
               <p className="text-sm text-gray-500 max-w-sm mt-2">Centang nama siswa pada panel di sebelah kiri untuk melihat preview dan mulai mencetak ID Card.</p>
            </div>
          ) : (
            <div 
              id="printSheets" 
              className="flex flex-col gap-10 items-start lg:items-center transition-transform duration-200 ease-out origin-top-left lg:origin-top"
              style={{ transform: `scale(${settings.scale})` }}
            >
              {pages.map((pageStudents, pageIndex) => (
                <div key={pageIndex} className="a4-sheet bg-white shadow-xl relative" style={{
                  width: '210mm',
                  height: '297mm',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingTop: '4.5mm',
                  boxSizing: 'border-box'
                }}>
                  {pageStudents.map((siswa, i) => (
                    <div key={siswa.id} className="flex justify-center w-full" style={{ gap: '8mm', breakInside: 'avoid', pageBreakInside: 'avoid', marginBottom: i === pageStudents.length - 1 ? '0' : '2mm' }}>
                      {renderCard(siswa, false)}
                      {renderCard(siswa, true)}
                    </div>
                  ))}
                  
                  {/* Decorative badge for page number in preview */}
                  <div className="absolute -right-12 top-0 bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-r-lg no-print">
                    Hal {pageIndex + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        
        @media print {
            @page { size: A4 portrait; margin: 0; }
            body * { visibility: hidden; }
            body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print, .no-print * { display: none !important; }
            #printSheets, #printSheets * { visibility: visible; }
            #printSheets {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                right: 0 !important;
                transform: none !important; /* Override inline scale */
                display: block !important;
                margin: 0 auto !important;
                padding: 0 !important;
                width: 100% !important;
            .print-rotate-90 {
                transform: rotate(90deg) !important;
            }
            .print-rotate-minus-90 {
                transform: rotate(-90deg) !important;
            }
            .a4-sheet {
                page-break-after: always !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                box-shadow: none !important;
                margin: 0 auto !important;
                padding-top: 4.5mm !important;
                border: none !important;
                background: white !important;
            }
        }
      `}</style>
    </div>
  );
}
