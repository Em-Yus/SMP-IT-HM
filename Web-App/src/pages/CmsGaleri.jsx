import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Image as ImageIcon, Trash2, Upload, RefreshCw, Folder, Calendar } from 'lucide-react';
import Swal from 'sweetalert2';

export default function CmsGaleri() {
  const [albums, setAlbums] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  const [albumNameInput, setAlbumNameInput] = useState('');
  const [albumDateInput, setAlbumDateInput] = useState(new Date().toISOString().split('T')[0]);

  const fetchGaleri = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cms_galeri')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Group by album_name
      const grouped = {};
      (data || []).forEach(item => {
         const album = item.album_name || 'Kegiatan Umum';
         if (!grouped[album]) {
            grouped[album] = {
               date: item.album_date || item.created_at.split('T')[0],
               images: []
            };
         }
         grouped[album].images.push(item);
      });
      
      setAlbums(grouped);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data galeri.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGaleri();
  }, []);

  const handleFileUpload = async (e) => {
    if (!albumNameInput.trim()) {
       Swal.fire('Perhatian', 'Silakan ketikkan Nama Kegiatan / Album terlebih dahulu sebelum memilih foto.', 'info');
       e.target.value = '';
       return;
    }

    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const validFiles = files;

    setIsUploading(true);
    Swal.fire({ title: `Mengunggah ${validFiles.length} foto...`, allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      const uploadPromises = validFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `galeri_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `galeri/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('berkas_ppdb')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('berkas_ppdb')
          .getPublicUrl(filePath);

        return urlData.publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      // Simpan URL, nama album, dan tanggal ke tabel
      const dbPayload = uploadedUrls.map(url => ({ 
         url: url,
         album_name: albumNameInput.trim(),
         album_date: albumDateInput || new Date().toISOString().split('T')[0]
      }));
      const { error: dbError } = await supabase.from('cms_galeri').insert(dbPayload);
      
      if (dbError) throw dbError;

      Swal.fire({ icon: 'success', title: 'Berhasil', text: `${uploadedUrls.length} foto berhasil ditambahkan ke album "${albumNameInput}".` });
      setAlbumNameInput('');
      setAlbumDateInput(new Date().toISOString().split('T')[0]);
      fetchGaleri();
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Mengunggah', text: err.message });
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Hapus Foto?',
      text: "Foto ini akan dihapus dari sistem dan tidak muncul lagi di halaman depan.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });

    if (result.isConfirmed) {
      Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
      try {
        const { error } = await supabase.from('cms_galeri').delete().eq('id', id);
        if (error) throw error;
        
        Swal.fire('Terhapus!', 'Foto berhasil dihapus.', 'success');
        fetchGaleri();
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus foto.', 'error');
      }
    }
  };

  const handleDeleteAlbum = async (albumName, albumImages) => {
    const result = await Swal.fire({
      title: `Hapus Album "${albumName}"?`,
      text: `Ini akan menghapus seluruh ${albumImages.length} foto di dalam album ini dari sistem.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus Semua!'
    });

    if (result.isConfirmed) {
      Swal.fire({ title: 'Menghapus Album...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
      try {
        const idsToDelete = albumImages.map(img => img.id);
        const { error } = await supabase.from('cms_galeri').delete().in('id', idsToDelete);
        if (error) throw error;
        
        Swal.fire('Terhapus!', 'Album berhasil dihapus.', 'success');
        fetchGaleri();
      } catch (err) {
        console.error(err);
        Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus album.', 'error');
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#2a2c87] flex items-center gap-2">
            <ImageIcon className="text-[#85c226]" /> Pengaturan Galeri (Berdasarkan Album & Tanggal)
          </h2>
          <p className="text-gray-500 text-sm mt-1">Buat album kegiatan baru, lengkapi tanggalnya, dan kelola foto-foto di dalamnya.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={fetchGaleri} className="flex flex-1 md:flex-none items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-bold text-sm shadow-sm">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Form Upload */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
         <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Nama Kegiatan / Album Baru</label>
               <input 
                  type="text" 
                  placeholder="Contoh: Perkemahan Jumat Sabtu"
                  value={albumNameInput}
                  onChange={(e) => setAlbumNameInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226]"
               />
            </div>
            <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">Tanggal Pelaksanaan</label>
               <input 
                  type="date" 
                  value={albumDateInput}
                  onChange={(e) => setAlbumDateInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226]"
               />
            </div>
         </div>
         <div className="w-full lg:w-auto">
            <label className={`w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-sm transition cursor-pointer ${isUploading || !albumNameInput.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#85c226] hover:bg-green-600'}`}>
              <Upload size={18} /> {isUploading ? 'Mengunggah...' : 'Pilih Foto & Upload'}
              <input 
                type="file" 
                multiple 
                accept="image/jpeg,image/png,image/webp" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isUploading || !albumNameInput.trim()}
              />
            </label>
         </div>
      </div>

      {/* Galeri Grid per Album */}
      <div className="space-y-8">
         {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-gray-100">
              <RefreshCw className="animate-spin text-[#85c226] mb-4" size={32} />
              <p className="text-gray-500 font-medium">Memuat Album Galeri...</p>
            </div>
         ) : Object.keys(albums).length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
               <Folder size={64} className="mx-auto mb-4 text-gray-300" />
               <p className="text-lg font-bold text-gray-600">Belum ada album kegiatan.</p>
               <p className="text-sm text-gray-400 mt-1">Ketikkan nama album di atas beserta tanggalnya, lalu unggah foto pertama Anda.</p>
            </div>
         ) : (
            // Urutkan album berdasarkan tanggal (terbaru dulu)
            Object.keys(albums).sort((a, b) => new Date(albums[b].date) - new Date(albums[a].date)).map((albumName, idx) => (
               <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                     <div className="w-full">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                           <Folder className="text-[#2a2c87] shrink-0" size={24} /> <span className="break-words">{albumName}</span>
                           <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full font-semibold">
                              {albums[albumName].images.length} Foto
                           </span>
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-2 font-medium">
                           <Calendar size={14} className="text-[#85c226]" /> {formatDate(albums[albumName].date)}
                        </p>
                     </div>
                     <div className="flex items-center gap-2 w-full sm:w-auto border-t border-gray-100 sm:border-0 pt-4 sm:pt-0">
                        <button 
                           onClick={async () => {
                              const { value: newAlbumName } = await Swal.fire({
                                 title: 'Edit Nama Album',
                                 input: 'text',
                                 inputLabel: 'Nama Kegiatan / Album Baru',
                                 inputValue: albumName,
                                 showCancelButton: true,
                                 confirmButtonText: 'Simpan',
                                 cancelButtonText: 'Batal',
                                 inputValidator: (value) => {
                                    if (!value || !value.trim()) {
                                       return 'Nama album tidak boleh kosong!'
                                    }
                                 }
                              });

                              if (newAlbumName && newAlbumName.trim() !== albumName) {
                                 Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
                                 try {
                                    const { error } = await supabase
                                       .from('cms_galeri')
                                       .update({ album_name: newAlbumName.trim() })
                                       .eq('album_name', albumName);
                                    
                                    if (error) throw error;
                                    
                                    Swal.fire('Berhasil!', 'Nama album telah diperbarui.', 'success');
                                    fetchGaleri();
                                 } catch (err) {
                                    console.error(err);
                                    Swal.fire('Gagal', 'Terjadi kesalahan saat mengedit nama album.', 'error');
                                 }
                              }
                           }}
                           className="flex-1 sm:flex-none justify-center text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition text-sm font-bold flex items-center gap-1.5 border border-transparent hover:border-blue-100"
                        >
                           Edit Nama
                        </button>
                        <button 
                           onClick={() => handleDeleteAlbum(albumName, albums[albumName].images)}
                           className="flex-1 sm:flex-none justify-center text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition text-sm font-bold flex items-center gap-1.5 border border-transparent hover:border-red-100"
                        >
                           <Trash2 size={16} /> Hapus
                        </button>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                     {albums[albumName].images.map((item) => (
                       <div key={item.id} className="relative group overflow-hidden aspect-square bg-gray-100 rounded-xl border border-gray-200">
                         <img src={item.url} alt="Galeri" className="w-full h-full object-cover transition duration-300 group-hover:scale-110" loading="lazy" />
                         
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition duration-300"
                              title="Hapus Foto"
                            >
                              <Trash2 size={20} />
                            </button>
                         </div>
                       </div>
                     ))}
                  </div>
               </div>
            ))
         )}
      </div>
    </div>
  );
}
