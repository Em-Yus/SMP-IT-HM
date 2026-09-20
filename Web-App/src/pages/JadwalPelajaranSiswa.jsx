import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CalendarDays, Clock, MapPin, User, BookOpen } from 'lucide-react';
import Swal from 'sweetalert2';

export default function JadwalPelajaranSiswa() {
  const [jadwal, setJadwal] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userKelas, setUserKelas] = useState('');
  const [kelasData, setKelasData] = useState(null);

  const hariUrutan = {
    'Senin': 1,
    'Selasa': 2,
    'Rabu': 3,
    'Kamis': 4,
    'Jumat': 5,
    'Sabtu': 6,
    'Minggu': 7
  };

  useEffect(() => {
    const fetchJadwal = async () => {
      setIsLoading(true);
      try {
        const storedUser = localStorage.getItem('user_siswa');
        if (!storedUser) {
          throw new Error("Sesi tidak ditemukan. Silakan login kembali.");
        }
        
        const userData = JSON.parse(storedUser);
        setUserKelas(userData.kelas || 'Belum ada kelas');

        if (!userData.kelas) {
          setIsLoading(false);
          return;
        }

        // Cari ID Kelas berdasarkan nama kelas dari user
        const { data: dataKelasRes, error: errKelas } = await supabase
          .from('data_kelas')
          .select('id, nama_kelas, ruang_id, data_ruang(nama_ruang)')
          .eq('nama_kelas', userData.kelas)
          .maybeSingle();

        if (errKelas) throw errKelas;

        if (dataKelasRes) {
          setKelasData(dataKelasRes);
          // Ambil jadwal untuk kelas ini atau yang sifatnya istirahat (jika istirahat berlaku global atau perlu di-filter)
          const { data: jadwalRes, error: errJadwal } = await supabase
            .from('jadwal_pelajaran')
            .select('*, data_kelas(nama_kelas, data_ruang(nama_ruang)), data_mapel(nama_mapel), data_guru(nama), master_jam(urutan, waktu_mulai, waktu_selesai)')
            .or(`kelas_id.eq.${dataKelasRes.id},is_istirahat.eq.true`);

          if (errJadwal) throw errJadwal;
          
          if (jadwalRes) {
            // Filter out istirahat from other classes if any (if they have kelas_id but are not ours)
            // But usually is_istirahat has kelas_id = null
            const filteredJadwal = jadwalRes
              .filter(j => j.kelas_id === dataKelasRes.id || (j.is_istirahat && !j.kelas_id))
              .map(j => ({
                ...j,
                waktuDisplay: j.master_jam?.waktu_mulai 
                  ? `${j.master_jam.waktu_mulai.substring(0, 5)} - ${j.master_jam.waktu_selesai?.substring(0, 5)}`
                  : j.waktu
              }));
            
            // Urutkan berdasarkan hari dan jam
            filteredJadwal.sort((a, b) => {
              const hariDiff = (hariUrutan[a.hari] || 99) - (hariUrutan[b.hari] || 99);
              if (hariDiff !== 0) return hariDiff;
              const urutanA = a.master_jam?.urutan || 999;
              const urutanB = b.master_jam?.urutan || 999;
              return urutanA - urutanB;
            });

            setJadwal(filteredJadwal);
          }
        }
      } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Terjadi kesalahan saat memuat jadwal.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchJadwal();
  }, []);

  // Grouping jadwal by Hari
  const groupedJadwal = jadwal.reduce((acc, curr) => {
    if (!acc[curr.hari]) {
      acc[curr.hari] = [];
    }
    acc[curr.hari].push(curr);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-0"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarDays className="text-primary" /> Jadwal Pelajaran
          </h2>
          <p className="text-gray-500 mt-1">Jadwal pelajaran mingguan Anda untuk kelas <span className="font-bold text-primary">{userKelas}</span>.</p>
        </div>
        {kelasData && (
          <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 relative z-10 flex items-center gap-2 w-full md:w-auto">
             <MapPin size={18} className="text-blue-600 shrink-0" />
             <div className="text-sm">
                <span className="text-blue-600/80 block text-xs font-bold uppercase tracking-wide">Ruang Kelas</span>
                <span className="font-bold text-blue-900">{kelasData.data_ruang?.nama_ruang || 'Belum ditentukan'}</span>
             </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      ) : Object.keys(groupedJadwal).length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
          <CalendarDays size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-700">Belum Ada Jadwal</h3>
          <p className="text-gray-500">Jadwal pelajaran untuk kelas Anda belum tersedia saat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.keys(hariUrutan)
            .filter(hari => groupedJadwal[hari])
            .map(hari => (
            <div key={hari} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full hover:shadow-md transition">
              <div className="bg-primary px-4 py-3 border-b border-gray-100 shrink-0">
                <h3 className="font-bold text-white text-lg">{hari}</h3>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3">
                {groupedJadwal[hari].map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-xl border flex gap-3 ${item.is_istirahat ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}
                  >
                    <div className={`shrink-0 w-12 h-12 rounded-lg flex flex-col justify-center items-center font-bold text-xs ${item.is_istirahat ? 'bg-orange-100 text-orange-600' : 'bg-white text-primary shadow-sm'}`}>
                      <Clock size={14} className="mb-0.5 opacity-70" />
                      {item.jam_ke}
                    </div>
                    
                    <div className="flex-1">
                      {item.is_istirahat ? (
                        <div className="h-full flex flex-col justify-center">
                          <span className="font-bold text-orange-600 uppercase tracking-wide">Istirahat</span>
                          <span className="text-xs text-orange-500 font-medium">{item.waktuDisplay || item.waktu}</span>
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{item.data_mapel?.nama_mapel || 'Mapel tidak diketahui'}</h4>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                             <Clock size={12} /> {item.waktuDisplay || item.waktu}
                          </div>
                          <div className="text-xs text-gray-600 mt-1.5 flex items-center gap-1.5 font-medium bg-gray-200/50 w-fit px-2 py-0.5 rounded-md">
                             <User size={12} className="text-gray-500" /> {item.data_guru?.nama || 'Guru belum ditentukan'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
