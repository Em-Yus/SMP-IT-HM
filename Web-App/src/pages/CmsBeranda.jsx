import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Settings, Save, Image as ImageIcon, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';

export default function CmsBeranda() {
  const [formData, setFormData] = useState({
    tagline: '',
    sejarah_1: '',
    sejarah_2: ''
  });
  
  const [heroImgUrl, setHeroImgUrl] = useState('');
  const [profilImgUrl, setProfilImgUrl] = useState('');
  
  const [heroFile, setHeroFile] = useState(null);
  const [profilFile, setProfilFile] = useState(null);
  
  const [heroPreview, setHeroPreview] = useState(null);
  const [profilPreview, setProfilPreview] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCmsData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cms_beranda')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows returned

      if (data) {
        setFormData({
          tagline: data.tagline || '',
          sejarah_1: data.sejarah_1 || '',
          sejarah_2: data.sejarah_2 || ''
        });
        setHeroImgUrl(data.hero_img || '');
        setProfilImgUrl(data.profil_img || '');
        setHeroPreview(data.hero_img || '');
        setProfilPreview(data.profil_img || '');
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengambil data pengaturan beranda' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCmsData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        Swal.fire({ icon: 'warning', title: 'File Terlalu Besar', text: 'Maksimal ukuran foto adalah 2MB' });
        e.target.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'hero') {
          setHeroFile(file);
          setHeroPreview(reader.result);
        } else {
          setProfilFile(file);
          setProfilPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file, prefix) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `cms_${prefix}_${Date.now()}.${fileExt}`;
    const filePath = `cms/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('berkas_ppdb')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('berkas_ppdb')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    Swal.fire({ title: 'Menyimpan Perubahan...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      let finalHeroUrl = heroImgUrl;
      let finalProfilUrl = profilImgUrl;

      // Jika ada file baru yang diunggah
      if (heroFile) {
        finalHeroUrl = await uploadImage(heroFile, 'hero');
      }
      if (profilFile) {
        finalProfilUrl = await uploadImage(profilFile, 'profil');
      }

      const payload = {
        tagline: formData.tagline,
        sejarah_1: formData.sejarah_1,
        sejarah_2: formData.sejarah_2,
        hero_img: finalHeroUrl,
        profil_img: finalProfilUrl,
        updated_at: new Date()
      };

      // Upsert data dengan id 1
      const { error } = await supabase
        .from('cms_beranda')
        .upsert({ id: 1, ...payload });

      if (error) throw error;

      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengaturan beranda telah diperbarui.' });
      
      // Update state dengan url yang baru
      setHeroImgUrl(finalHeroUrl);
      setProfilImgUrl(finalProfilUrl);
      setHeroFile(null);
      setProfilFile(null);
      
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <RefreshCw className="animate-spin text-[#85c226] mb-4" size={32} />
          <p className="text-gray-500 font-medium">Memuat Pengaturan Beranda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#2a2c87] flex items-center gap-2">
          <Settings className="text-[#85c226]" /> Pengaturan Beranda (Landing Page)
        </h2>
        <p className="text-gray-500 text-sm mt-1">Ubah tampilan halaman utama website pendaftaran sekolah di sini.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Foto Hero */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
            <ImageIcon size={18} className="text-[#85c226]" /> Latar Belakang Utama (Hero Image)
          </h3>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Gambar ini akan menjadi latar belakang penuh di bagian teratas website. Disarankan menggunakan resolusi landscape (misal: 1920x1080) agar tidak pecah di layar komputer.
              </p>
              <input 
                type="file" 
                accept="image/jpeg,image/png,image/webp" 
                onChange={(e) => handleFileChange(e, 'hero')}
                className="block w-full overflow-hidden text-ellipsis text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
            <div className="bg-gray-100 rounded-xl aspect-video flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 relative">
               {heroPreview ? (
                 <img src={heroPreview} alt="Preview Hero" className="w-full h-full object-cover" />
               ) : (
                 <span className="text-gray-400 text-sm">Belum ada gambar</span>
               )}
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Tagline / Slogan Sekolah</h3>
           <input 
              type="text" 
              name="tagline" 
              value={formData.tagline} 
              onChange={handleInputChange} 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226]" 
              placeholder="Contoh: Mengaji - Berprestasi - Berakhlaq Terpuji"
           />
        </div>

        {/* Profil dan Sejarah */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Bagian Profil Sekolah</h3>
          <div className="grid md:grid-cols-12 gap-8">
            <div className="md:col-span-4">
               <label className="block text-sm font-bold text-gray-700 mb-2">Foto Profil Sekolah</label>
               <div className="bg-gray-100 rounded-xl aspect-square flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 mb-3 relative">
                  {profilPreview ? (
                    <img src={profilPreview} alt="Preview Profil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-sm">Belum ada gambar</span>
                  )}
               </div>
               <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  onChange={(e) => handleFileChange(e, 'profil')}
                  className="block w-full overflow-hidden text-ellipsis text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
               />
            </div>
            <div className="md:col-span-8 space-y-4">
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1.5">Paragraf Sejarah 1</label>
                 <textarea 
                    name="sejarah_1" 
                    rows="4" 
                    value={formData.sejarah_1} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" 
                    placeholder="Tuliskan sejarah berdirinya sekolah..."
                 ></textarea>
               </div>
               <div>
                 <label className="block text-sm font-bold text-gray-700 mb-1.5">Paragraf Sejarah 2 (Lanjutan)</label>
                 <textarea 
                    name="sejarah_2" 
                    rows="4" 
                    value={formData.sejarah_2} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#85c226] focus:border-[#85c226] text-sm" 
                    placeholder="Tuliskan fokus pendidikan atau informasi tambahan..."
                 ></textarea>
               </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4 pb-10">
           <button 
             type="submit" 
             disabled={isSaving} 
             className="w-full md:w-auto px-8 py-3 bg-[#2a2c87] text-white rounded-xl font-bold hover:bg-blue-900 transition shadow-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
           >
             <Save size={20} />
             {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
           </button>
        </div>

      </form>
    </div>
  );
}
