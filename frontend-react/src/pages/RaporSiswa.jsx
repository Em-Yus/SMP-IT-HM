import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Award, Eye, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

export default function RaporSiswa() {
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  
  const [filterTahun, setFilterTahun] = useState(defaultTahun);
  const [filterSemester, setFilterSemester] = useState('Ganjil');
  
  const [raporData, setRaporData] = useState(null);

  useEffect(() => {
    const session = localStorage.getItem('user_siswa');
    if (session) {
      setUserData(JSON.parse(session));
    }
  }, []);

  const fetchRapor = async () => {
    if (!userData) return;
    
    setIsLoading(true);
    setRaporData(null);
    try {
      const nipd = userData.nipd;
      const siswaId = userData.id;

      // 1. Fetch Data Siswa Terbaru
      const { data: siswa } = await supabase.from('data_siswa').select('*').eq('nipd', nipd).single();
      
      // 2. Fetch Lembaga
      const { data: lembagaData } = await supabase.from('data_lembaga').select('*').limit(1).single();
      
      // 3. Fetch Kelas & Wali Kelas
      const { data: kelasData } = await supabase.from('data_kelas').select('*').eq('nama_kelas', siswa.kelas).maybeSingle();
      
      // 4. Fetch Mapel
      const { data: mapelData } = await supabase.from('data_mapel').select('*').order('urutan', { ascending: true });
      
      // 5. Fetch Nilai
      const { data: nilaiData } = await supabase.from('nilai_siswa').select('*')
        .eq('nipd', nipd).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
        
      // 6. Fetch TP
      const tpIds = [];
      nilaiData?.forEach(n => {
        if (n.id_tujuan_pembelajaran) {
          try {
            const parsed = JSON.parse(n.id_tujuan_pembelajaran);
            const combined = [...(parsed.optimal || []), ...(parsed.peningkatan || [])];
            combined.forEach(id => tpIds.push(String(id)));
          } catch(e) {
            n.id_tujuan_pembelajaran.split(',').forEach(id => tpIds.push(id.trim()));
          }
        }
      });
      
      let tpData = [];
      if (tpIds.length > 0) {
        const { data } = await supabase.from('tujuan_pembelajaran').select('id, tujuan_pembelajaran').in('id', [...new Set(tpIds)]);
        tpData = data || [];
      }
      
      // 7. Fetch Ekskul, Koku, Presensi, Catatan
      const { data: ekskulData } = await supabase.from('anggota_ekskul')
        .select(`siswa_id, keterangan, data_ekskul ( nama_ekskul )`)
        .eq('siswa_id', siswaId).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
        
      const { data: kokuData } = await supabase.from('anggota_kokurikuler')
        .select(`siswa_id, data_kokurikuler ( nama_kegiatan )`)
        .eq('siswa_id', siswaId).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
        
      const { data: presensiData } = await supabase.from('presensi_siswa')
        .select('siswa_id, status')
        .eq('siswa_id', siswaId).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
        
      const { data: catatanData } = await supabase.from('catatan_wali')
        .select('*')
        .eq('nipd', nipd).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester).maybeSingle();

      // 8. Construct Print Data
      const pData = constructPrintData(
        siswa, lembagaData, kelasData, mapelData, nilaiData, 
        tpData, ekskulData, kokuData, presensiData, catatanData
      );

      setRaporData(pData);
      
      if (!nilaiData || nilaiData.length === 0) {
        Swal.fire('Info', 'Belum ada data nilai pada semester ini.', 'info');
      }

    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat data rapor. Pastikan koneksi stabil.' });
    } finally {
      setIsLoading(false);
    }
  };

  const constructPrintData = (siswa, lembagaData, kelasData, mapelData, nilaiData, tpData, ekskulData, kokuData, presensiData, catatanData) => {
    const nilaiSiswa = nilaiData || [];

    const mapelWithNilai = (mapelData || []).map(m => {
      const nilaiMapel = nilaiSiswa.filter(n => String(n.id_mapel) === String(m.id));
      let total = 0;
      let count = 0;
      let tpsOptimal = [];
      let tpsPeningkatan = [];

      ['Tugas', 'PTS', 'PAS'].forEach(jenis => {
        const n = nilaiMapel.find(x => x.jenis_nilai === jenis);
        if (n && n.nilai_siswa !== null) {
          total += Number(n.nilai_siswa);
          count++;
        }
        if (n && n.id_tujuan_pembelajaran) {
          try {
            const parsed = JSON.parse(n.id_tujuan_pembelajaran);
            (parsed.optimal || []).forEach(id => {
              const tpObj = tpData?.find(t => String(t.id) === String(id));
              if (tpObj && !tpsOptimal.includes(tpObj.tujuan_pembelajaran)) tpsOptimal.push(tpObj.tujuan_pembelajaran);
            });
            (parsed.peningkatan || []).forEach(id => {
              const tpObj = tpData?.find(t => String(t.id) === String(id));
              if (tpObj && !tpsPeningkatan.includes(tpObj.tujuan_pembelajaran)) tpsPeningkatan.push(tpObj.tujuan_pembelajaran);
            });
          } catch(e) {
            // fallback old comma separated
            const ids = n.id_tujuan_pembelajaran.split(',');
            ids.forEach(id => {
              const tpObj = tpData?.find(t => String(t.id) === String(id.trim()));
              if (tpObj && !tpsOptimal.includes(tpObj.tujuan_pembelajaran)) tpsOptimal.push(tpObj.tujuan_pembelajaran);
            });
          }
        }
      });

      const nilaiAkhir = count > 0 ? Math.round(total / count) : null;
      
      let capaian_kompetensi = '';
      if (tpsOptimal.length > 0) {
        capaian_kompetensi += `Mencapai Kompetensi dengan sangat baik dalam hal ${tpsOptimal.join(', ')}. `;
      }
      if (tpsPeningkatan.length > 0) {
        capaian_kompetensi += `Perlu peningkatan dalam hal ${tpsPeningkatan.join(', ')}.`;
      }

      return { ...m, nilai_akhir: nilaiAkhir, capaian_kompetensi: capaian_kompetensi.trim() || '-' };
    });

    const mapelWajib = mapelWithNilai.filter(m => m.kelompok?.toLowerCase().includes('wajib') || !m.kelompok || m.kelompok === 'A' || m.kelompok === 'B');
    const mapelPilihan = mapelWithNilai.filter(m => m.kelompok?.toLowerCase().includes('pilihan') || m.kelompok === 'C');

    const formatEkskul = (ekskulData || []).map(e => ({
      nama_ekskul: e.data_ekskul?.nama_ekskul,
      keterangan: e.keterangan
    }));

    const formatKoku = (kokuData || []).map(k => ({
      nama_kegiatan: k.data_kokurikuler?.nama_kegiatan
    }));

    const presensi = { sakit: 0, izin: 0, alpha: 0 };
    (presensiData || []).forEach(p => {
      if (p.status === 'Sakit') presensi.sakit++;
      if (p.status === 'Izin') presensi.izin++;
      if (p.status === 'Alpha') presensi.alpha++;
    });

    return {
      siswa,
      lembaga: lembagaData,
      kelas: kelasData,
      waliKelas: { nama: kelasData?.wali_kelas_nama },
      kepalaSekolah: { nama: lembagaData?.kepala_sekolah, nip: lembagaData?.nip_kepsek },
      tahunAjaran: filterTahun,
      semester: filterSemester,
      mapelWajib,
      mapelPilihan,
      ekskul: formatEkskul,
      kokurikuler: formatKoku,
      presensi,
      catatanWali: catatanData
    };
  };

  return (
    <>
      <div className="print:hidden max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
        
        {/* Header & Controls */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-bl-full -z-0"></div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Award className="text-orange-500" /> Rapor Digital
            </h2>
            <p className="text-gray-500 mt-1">Unduh Laporan Hasil Belajar (Rapor) per semester.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10 w-full md:w-auto mt-4 md:mt-0">
            <div className="grid grid-cols-2 w-full sm:flex sm:w-auto gap-3">
              <select 
                value={filterSemester} 
                onChange={(e) => {setFilterSemester(e.target.value); setRaporData(null);}}
                className="w-full min-w-0 px-2 sm:px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold text-gray-700 text-ellipsis overflow-hidden"
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
              <select 
                value={filterTahun} 
                onChange={(e) => {setFilterTahun(e.target.value); setRaporData(null);}}
                className="w-full min-w-0 px-2 sm:px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-semibold text-gray-700 text-ellipsis overflow-hidden"
              >
                <option value={`${currentYear - 1}/${currentYear}`}>{currentYear - 1}/{currentYear}</option>
                <option value={`${currentYear}/${currentYear + 1}`}>{currentYear}/{currentYear + 1}</option>
                <option value={`${currentYear + 1}/${currentYear + 2}`}>{currentYear + 1}/{currentYear + 2}</option>
              </select>
            </div>
            <button 
              onClick={fetchRapor} 
              disabled={isLoading}
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm shadow-md disabled:opacity-70"
            >
              {isLoading ? <span className="animate-spin text-xl leading-none">⟳</span> : <Eye size={16} />} 
              {isLoading ? 'Memuat...' : 'Tampilkan Rapor'}
            </button>
          </div>
        </div>

        {/* Digital Preview */}
        {raporData ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-orange-50/50">
               <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="text-orange-600" size={20} /> Preview Laporan Hasil Belajar
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Tahun Ajaran {filterTahun} - Semester {filterSemester}</p>
               </div>
             </div>
             
             <div className="p-8 bg-gray-50 flex justify-center custom-scrollbar">
                {/* Visual Representation of Rapor - Scaled down for preview */}
                <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200 max-w-4xl w-full">
                  <div className="text-center border-b-2 border-black pb-4 mb-6">
                    <h1 className="text-xl font-bold uppercase tracking-wider mb-1">LAPORAN HASIL BELAJAR</h1>
                    <p className="text-sm font-medium">Sekolah Menengah Pertama (SMP)</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-medium text-gray-700 mb-8 border-b pb-6">
                     <div>
                       <table className="w-full">
                         <tbody>
                           <tr><td className="w-32 py-1">Nama Murid</td><td>: {raporData.siswa?.nama}</td></tr>
                           <tr><td className="py-1">NIS/NISN</td><td>: {raporData.siswa?.nipd} / {raporData.siswa?.nisn}</td></tr>
                           <tr><td className="py-1">Sekolah</td><td>: {raporData.lembaga?.nama_lembaga}</td></tr>
                         </tbody>
                       </table>
                     </div>
                     <div>
                       <table className="w-full">
                         <tbody>
                           <tr><td className="w-32 py-1 sm:pl-4">Kelas</td><td>: {raporData.kelas?.nama_kelas || '-'}</td></tr>
                           <tr><td className="py-1 sm:pl-4">Fase</td><td>: D</td></tr>
                           <tr><td className="py-1 sm:pl-4">Semester</td><td>: {raporData.semester}</td></tr>
                           <tr><td className="py-1 sm:pl-4">Tahun Ajaran</td><td>: {raporData.tahunAjaran}</td></tr>
                         </tbody>
                       </table>
                     </div>
                  </div>

                  {/* Summary of Nilai */}
                  <h4 className="font-bold mb-3 border-l-4 border-orange-500 pl-3">Ringkasan Nilai Akhir</h4>
                  <div className="overflow-x-auto custom-scrollbar mb-8 w-full">
                    <table className="w-full min-w-max border-collapse border border-gray-300 text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 w-10 text-center">No</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Mata Pelajaran</th>
                        <th className="border border-gray-300 px-4 py-2 w-24 text-center">Nilai Akhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {raporData.mapelWajib?.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2 text-center">{i + 1}</td>
                          <td className="border border-gray-300 px-4 py-2 font-medium">{m.nama_mapel}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center font-bold text-orange-600">{m.nilai_akhir || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>

                  {/* Ketidakhadiran */}
                  <h4 className="font-bold mb-3 border-l-4 border-blue-500 pl-3">Ketidakhadiran</h4>
                  <div className="flex flex-col sm:flex-row gap-4 text-sm mb-8">
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex-1 flex justify-between">
                      <span className="font-medium text-blue-800">Sakit</span>
                      <span className="font-bold">{raporData.presensi?.sakit || 0} Hari</span>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg flex-1 flex justify-between">
                      <span className="font-medium text-yellow-800">Izin</span>
                      <span className="font-bold">{raporData.presensi?.izin || 0} Hari</span>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex-1 flex justify-between">
                      <span className="font-medium text-red-800">Tanpa Keterangan</span>
                      <span className="font-bold">{raporData.presensi?.alpha || 0} Hari</span>
                    </div>
                  </div>

                  {/* Catatan Wali */}
                  <h4 className="font-bold mb-3 border-l-4 border-green-500 pl-3">Catatan Wali Kelas</h4>
                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-sm italic mb-4">
                    "{raporData.catatanWali?.catatan || 'Belum ada catatan dari wali kelas.'}"
                  </div>
                  
                  <div className="text-center mt-10">
                     <p className="text-gray-500 text-sm mb-4">Laporan Hasil Belajar ini hanya dapat dilihat (dibaca). Untuk mendapatkan dokumen cetak resmi, silakan hubungi Wali Kelas Anda.</p>
                  </div>
                </div>
             </div>
          </div>
        ) : (
          !isLoading && (
            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center shadow-sm">
              <Award size={64} className="mx-auto text-gray-200 mb-4" />
              <h3 className="text-lg font-bold text-gray-700">Pilih Periode Rapor</h3>
              <p className="text-gray-500 mt-2 max-w-md mx-auto">Silakan pilih Tahun Pelajaran dan Semester, lalu klik tombol "Tampilkan Rapor" untuk melihat hasil evaluasi belajar Anda.</p>
            </div>
          )
        )}

      </div>
    </>
  );
}
