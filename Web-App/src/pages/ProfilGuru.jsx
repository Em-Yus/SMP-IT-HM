import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Phone, MapPin, Briefcase, GraduationCap, Calendar, Save, RefreshCw, Mail, Shield, CheckCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export default function ProfilGuru() {
  const [guru, setGuru] = useState(null);
  const [jabatan, setJabatan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchProfil();
  }, []);

  const fetchProfil = async () => {
    setIsLoading(true);
    try {
      const storedUser = localStorage.getItem('user_guru');
      if (!storedUser) {
        Swal.fire('Error', 'Sesi login tidak ditemukan', 'error');
        setIsLoading(false);
        return;
      }

      const userData = JSON.parse(storedUser);
      const guruId = userData.id;

      // Ambil data guru
      const { data: dataGuru, error: errorGuru } = await supabase
        .from('data_guru')
        .select('*')
        .eq('id', guruId)
        .single();

      if (errorGuru) throw errorGuru;
      
      setGuru(dataGuru);
      setFormData(dataGuru);

      // Ambil data jabatan
      const { data: dataJabatan, error: errorJabatan } = await supabase
        .from('jabatan_guru')
        .select('*')
        .eq('guru_id', guruId)
        .maybeSingle();

      if (errorJabatan) {
        console.warn('Error fetching jabatan:', errorJabatan);
      } else {
        setJabatan(dataJabatan);
      }
      
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat profil', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('data_guru')
        .update({
          no_wa: formData.no_wa,
          tempat_lahir: formData.tempat_lahir,
          tanggal_lahir: formData.tanggal_lahir,
          agama: formData.agama,
          status_perkawinan: formData.status_perkawinan,
          pendidikan: formData.pendidikan,
          alamat: formData.alamat,
          nama_ibu: formData.nama_ibu
        })
        .eq('id', guru.id);

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Profil berhasil diperbarui',
        timer: 1500,
        showConfirmButton: false
      });
      
      // Update local storage jika nama atau nik berubah (di sini kita update semua data yang mungkin tersimpan)
      const storedUser = JSON.parse(localStorage.getItem('user_guru') || '{}');
      const updatedUser = { ...storedUser, ...formData };
      localStorage.setItem('user_guru', JSON.stringify(updatedUser));
      
      setGuru(formData);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal menyimpan profil', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center text-primary">
        <RefreshCw size={40} className="animate-spin mb-4" />
        <p className="font-semibold text-lg animate-pulse">Memuat Profil Anda...</p>
      </div>
    );
  }

  if (!guru) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-10">
        <Shield size={60} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-500">Data Profil Tidak Ditemukan</h2>
      </div>
    );
  }

  // Helper untuk generate initial
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const allRoles = [];
  if (jabatan) {
    if (jabatan.jabatan_utama) allRoles.push(jabatan.jabatan_utama);
    if (jabatan.jabatan_lain_1) allRoles.push(jabatan.jabatan_lain_1);
    if (jabatan.jabatan_lain_2) allRoles.push(jabatan.jabatan_lain_2);
    if (jabatan.jabatan_lain_3) allRoles.push(jabatan.jabatan_lain_3);
  }

  return (
    <div className="flex flex-col min-h-screen bg-bgSoft p-2 lg:p-6 pb-20 font-sans">
      
      {/* Header Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-primary to-blue-400"></div>
        
        <div className="relative pt-6 flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
          <div className="w-32 h-32 rounded-full bg-white p-1.5 shadow-lg relative z-10 shrink-0">
             {guru.foto_url ? (
               <img src={guru.foto_url} alt={guru.nama} className="w-full h-full rounded-full object-cover" />
             ) : (
               <div className="w-full h-full rounded-full bg-blue-100 flex items-center justify-center text-primary font-black text-4xl shadow-inner">
                 {getInitials(guru.nama)}
               </div>
             )}
          </div>
          <div className="flex-1 pb-2">
             <h1 className="text-3xl font-black text-gray-800 leading-tight flex items-center justify-center md:justify-start gap-2">
               {guru.nama} 
               {guru.status_pegawai === 'Aktif' && <CheckCircle size={22} className="text-green-500 shrink-0" title="Pegawai Aktif" />}
             </h1>
             <p className="text-gray-500 font-medium mt-1">NIK: <span className="font-mono text-gray-700">{guru.nik || '-'}</span></p>
          </div>
          <div className="pb-2">
             <button 
               onClick={() => {
                 if (isEditing) {
                   setFormData(guru); // cancel edits
                   setIsEditing(false);
                 } else {
                   setIsEditing(true);
                 }
               }}
               className={`px-6 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2 w-full md:w-auto shadow-sm
                 ${isEditing ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-primary text-white hover:bg-blue-800'}`}
             >
               {isEditing ? 'Batal Edit' : 'Edit Profil'}
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
              <User className="text-primary" size={20} />
              <h2 className="font-bold text-gray-800 text-lg">Data Pribadi</h2>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Field: Nama (Readonly) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
                <input type="text" value={guru.nama || ''} readOnly className="w-full bg-gray-100 border border-gray-200 text-gray-700 text-sm rounded-lg p-2.5 outline-none font-bold cursor-not-allowed" />
                <p className="text-[10px] text-gray-400 mt-1">*Nama hanya dapat diubah oleh Administrator</p>
              </div>

              {/* Field: Tempat Lahir */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tempat Lahir</label>
                <input 
                  type="text" 
                  name="tempat_lahir"
                  value={formData.tempat_lahir || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full text-sm rounded-lg p-2.5 outline-none font-medium transition
                    ${isEditing ? 'bg-white border-2 border-primary/20 focus:border-primary text-gray-900' : 'bg-gray-50 border border-gray-200 text-gray-600'}`} 
                />
              </div>

              {/* Field: Tanggal Lahir */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tanggal Lahir</label>
                <input 
                  type="date" 
                  name="tanggal_lahir"
                  value={formData.tanggal_lahir || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full text-sm rounded-lg p-2.5 outline-none font-medium transition
                    ${isEditing ? 'bg-white border-2 border-primary/20 focus:border-primary text-gray-900' : 'bg-gray-50 border border-gray-200 text-gray-600'}`} 
                />
              </div>

              {/* Field: Agama */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Agama</label>
                <select 
                  name="agama"
                  value={formData.agama || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full text-sm rounded-lg p-2.5 outline-none font-medium transition
                    ${isEditing ? 'bg-white border-2 border-primary/20 focus:border-primary text-gray-900' : 'bg-gray-50 border border-gray-200 text-gray-600'}`} 
                >
                  <option value="">- Pilih Agama -</option>
                  <option value="Islam">Islam</option>
                  <option value="Kristen">Kristen</option>
                  <option value="Katolik">Katolik</option>
                  <option value="Hindu">Hindu</option>
                  <option value="Buddha">Buddha</option>
                  <option value="Konghucu">Konghucu</option>
                </select>
              </div>

              {/* Field: Pendidikan */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pendidikan Terakhir</label>
                <input 
                  type="text" 
                  name="pendidikan"
                  value={formData.pendidikan || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  placeholder="Contoh: S1 Pendidikan Agama Islam"
                  className={`w-full text-sm rounded-lg p-2.5 outline-none font-medium transition
                    ${isEditing ? 'bg-white border-2 border-primary/20 focus:border-primary text-gray-900' : 'bg-gray-50 border border-gray-200 text-gray-600'}`} 
                />
              </div>

              {/* Field: No WA */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">No WhatsApp</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone size={16} className={isEditing ? 'text-primary' : 'text-gray-400'} />
                  </div>
                  <input 
                    type="tel" 
                    name="no_wa"
                    value={formData.no_wa || ''} 
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    placeholder="Contoh: 081234567890"
                    className={`w-full text-sm rounded-lg pl-9 p-2.5 outline-none font-medium transition
                      ${isEditing ? 'bg-white border-2 border-primary/20 focus:border-primary text-gray-900' : 'bg-gray-50 border border-gray-200 text-gray-600'}`} 
                  />
                </div>
              </div>

              {/* Field: Status Perkawinan */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status Perkawinan</label>
                <select 
                  name="status_perkawinan"
                  value={formData.status_perkawinan || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full text-sm rounded-lg p-2.5 outline-none font-medium transition
                    ${isEditing ? 'bg-white border-2 border-primary/20 focus:border-primary text-gray-900' : 'bg-gray-50 border border-gray-200 text-gray-600'}`} 
                >
                  <option value="">- Pilih Status -</option>
                  <option value="Belum Kawin">Belum Kawin</option>
                  <option value="Kawin">Kawin</option>
                  <option value="Cerai Hidup">Cerai Hidup</option>
                  <option value="Cerai Mati">Cerai Mati</option>
                </select>
              </div>

              {/* Field: Nama Ibu */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Ibu Kandung</label>
                <input 
                  type="text" 
                  name="nama_ibu"
                  value={formData.nama_ibu || ''} 
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className={`w-full text-sm rounded-lg p-2.5 outline-none font-medium transition
                    ${isEditing ? 'bg-white border-2 border-primary/20 focus:border-primary text-gray-900' : 'bg-gray-50 border border-gray-200 text-gray-600'}`} 
                />
              </div>

              {/* Field: Alamat */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat Lengkap</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                    <MapPin size={16} className={isEditing ? 'text-primary' : 'text-gray-400'} />
                  </div>
                  <textarea 
                    name="alamat"
                    value={formData.alamat || ''} 
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    rows="3"
                    className={`w-full text-sm rounded-lg pl-9 p-2.5 outline-none font-medium transition resize-none
                      ${isEditing ? 'bg-white border-2 border-primary/20 focus:border-primary text-gray-900' : 'bg-gray-50 border border-gray-200 text-gray-600'}`} 
                  ></textarea>
                </div>
              </div>
              
            </div>

            {/* Save Button */}
            {isEditing && (
              <div className="p-5 border-t border-gray-100 bg-blue-50/30 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-primary hover:bg-blue-800 text-white font-bold py-2.5 px-8 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                  Simpan Perubahan
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Column - Status & Kepegawaian */}
        <div className="space-y-6">
          
          {/* Kepegawaian */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
               <Briefcase className="text-blue-500" size={18} />
               <h3 className="font-bold text-gray-800 text-sm">Data Kepegawaian</h3>
             </div>
             <div className="p-5 space-y-4">
               <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">NIP (Nomor Induk Pegawai)</p>
                  <p className="font-mono text-gray-800 font-semibold">{guru.nip || '-'}</p>
               </div>
               <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">NUPTK</p>
                  <p className="font-mono text-gray-800 font-semibold">{guru.nuptk || '-'}</p>
               </div>
               <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">NIY (Nomor Induk Yayasan)</p>
                  <p className="font-mono text-gray-800 font-semibold">{guru.niy || '-'}</p>
               </div>
               <div className="pt-3 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Calendar size={12}/> Tanggal Masuk</p>
                  <p className="text-sm text-gray-800 font-semibold mt-0.5">
                    {guru.tanggal_masuk ? new Date(guru.tanggal_masuk).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}
                  </p>
               </div>
             </div>
          </div>

          {/* Jabatan / Roles */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
               <Shield className="text-purple-500" size={18} />
               <h3 className="font-bold text-gray-800 text-sm">Jabatan & Akses</h3>
             </div>
             <div className="p-5">
               {allRoles.length === 0 ? (
                 <p className="text-sm text-gray-500 italic text-center py-2">Belum ada jabatan yang ditetapkan.</p>
               ) : (
                 <div className="flex flex-col gap-2">
                   {allRoles.map((role, idx) => (
                     <div key={idx} className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                        <span className="font-bold text-purple-900 text-sm">{role}</span>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>

        </div>
      </div>

    </div>
  );
}
