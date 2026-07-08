import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ZoomIn, X, Folder, Calendar } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

export default function GaleriPage() {
  const [albums, setAlbums] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('cms_galeri')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
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
        setError("Terjadi kesalahan koneksi. Pastikan internet lancar.");
      } finally {
        setLoading(false);
      }
    };
    fetchGallery();
  }, []);

  const sortedAlbumKeys = Object.keys(albums).sort((a, b) => {
    const dateA = new Date(albums[a].date);
    const dateB = new Date(albums[b].date);
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans flex flex-col text-gray-800">
      {/* Header */}
      <header className="bg-[#2a2c87] text-white py-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="https://www.e-ujian.com/smpithm/logo" alt="Logo" className="w-10 h-10 object-contain bg-white rounded-full p-1" />
            <div>
              <h1 className="font-bold text-lg leading-tight">GALERI SEKOLAH</h1>
              <p className="text-xs text-gray-300">SMP IT Hidayatul Mubtadi-ien</p>
            </div>
          </div>
          <Link to="/" className="text-sm font-medium hover:text-[#85c226] transition flex items-center gap-2">
            <ArrowLeft size={16} /> Kembali ke Beranda
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 flex-grow">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#2a2c87] mb-4">Dokumentasi Kegiatan</h2>
          <div className="w-24 h-1 bg-[#85c226] mx-auto rounded"></div>
          <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
            Kumpulan momen berharga dan kegiatan siswa-siswi SMP IT Hidayatul Mubtadi-ien Compreng.
          </p>
        </div>

        {/* Filter / Sort Bar */}
        {!loading && !error && Object.keys(albums).length > 0 && (
          <div className="flex justify-end mb-8 max-w-6xl mx-auto">
            <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-xl shadow-sm border border-gray-200">
              <label htmlFor="sortOrder" className="text-sm font-semibold text-gray-600">Urutkan Album:</label>
              <select 
                id="sortOrder" 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value)}
                className="bg-transparent text-sm font-bold text-[#2a2c87] focus:outline-none cursor-pointer"
              >
                <option value="desc">Terbaru (Berdasarkan Tanggal)</option>
                <option value="asc">Terlama (Berdasarkan Tanggal)</option>
              </select>
            </div>
          </div>
        )}

        {/* Container untuk Galeri Dinamis */}
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="mb-12">
              <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse mb-6"></div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse border border-gray-100"></div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 inline-block shadow-sm">
                <p className="font-semibold">{error}</p>
                <button onClick={() => window.location.reload()} className="mt-4 text-sm font-bold underline hover:text-red-800">Coba Lagi</button>
              </div>
            </div>
          ) : sortedAlbumKeys.length === 0 ? (
            <div className="text-center text-gray-400 py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
               <Folder size={64} className="mx-auto mb-4 opacity-30 text-[#2a2c87]" />
               <p className="text-xl font-bold text-gray-600">Belum ada album kegiatan.</p>
               <p className="text-sm mt-1 text-gray-400">Dokumentasi akan segera ditambahkan.</p>
            </div>
          ) : (
            sortedAlbumKeys.map((albumName, albumIdx) => (
              <div key={albumIdx} className="mb-16 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                     <h3 className="text-2xl font-bold text-[#2a2c87] border-l-4 border-[#85c226] pl-4">
                       {albumName}
                     </h3>
                     <p className="text-gray-500 font-medium flex items-center gap-1.5 mt-2 pl-5">
                        <Calendar size={16} className="text-[#85c226]" /> {formatDate(albums[albumName].date)}
                     </p>
                  </div>
                  <span className="text-sm font-bold text-gray-400 bg-gray-100 px-4 py-2 rounded-xl self-start md:self-auto">
                     {albums[albumName].images.length} Foto
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {albums[albumName].images.map((img) => (
                    <div 
                      key={img.id} 
                      className="relative group overflow-hidden rounded-xl shadow-sm cursor-pointer aspect-square bg-gray-200 border border-gray-100"
                      onClick={() => setLightboxImg(img.url)}
                    >
                      <img 
                        src={img.url} 
                        className="w-full h-full object-cover transition duration-500 group-hover:scale-110" 
                        alt="Foto Kegiatan" 
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/400?text=Gambar+Rusak' }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition duration-300 flex items-center justify-center">
                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 text-3xl transition duration-300 transform scale-50 group-hover:scale-100 drop-shadow-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2a2c87] text-white py-6 text-center mt-auto border-t border-white/10">
        <p className="text-sm opacity-80">&copy; {new Date().getFullYear()} SMP IT Hidayatul Mubtadi-ien Compreng</p>
      </footer>

      {/* Modal Lightbox */}
      {lightboxImg && (
        <div 
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity"
          onClick={() => setLightboxImg(null)}
        >
          <img 
            src={lightboxImg} 
            className="max-h-[90vh] max-w-full rounded-lg shadow-2xl transition-transform duration-300 transform scale-100 border border-white/10" 
            alt="Zoom" 
            referrerPolicy="no-referrer"
          />
          <button 
            className="absolute top-4 right-4 text-white hover:text-[#85c226] bg-black/50 p-2 rounded-full transition"
            onClick={(e) => { e.stopPropagation(); setLightboxImg(null); }}
          >
            <X size={32} />
          </button>
        </div>
      )}
    </div>
  );
}
