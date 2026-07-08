import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CreditCard, Calculator, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function KeuanganSiswa() {
  const [userData, setUserData] = useState(null);
  const [dataSiswa, setDataSiswa] = useState(null);

  // Filters
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  
  const [tahunPelajaran, setTahunPelajaran] = useState(defaultTahun);
  const [semester, setSemester] = useState('Tahunan'); // Biasanya tagihan tahunan

  // Data State
  const [biayaItems, setBiayaItems] = useState([]);
  const [pemasukanList, setPemasukanList] = useState([]);
  const [saldo, setSaldo] = useState(0);
  const [subsidi, setSubsidi] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem('user_siswa');
    if (session) {
      setUserData(JSON.parse(session));
    }
  }, []);

  useEffect(() => {
    const fetchSiswaAndLedger = async () => {
      if (!userData) return;
      setIsLoading(true);
      try {
        // 1. Fetch data siswa lengkap (karena di storage mungkin kurang lengkap spt status_siswa)
        const { data: siswaObj, error: errSiswa } = await supabase
          .from('data_siswa')
          .select('*')
          .eq('nipd', userData.nipd)
          .single();

        if (errSiswa) throw errSiswa;
        setDataSiswa(siswaObj);

        // 2. Tentukan Tingkat
        let tingkatSiswa = 7;
        if (siswaObj.kelas) {
          const { data: kelasData } = await supabase
            .from('data_kelas')
            .select('id, tingkat')
            .eq('nama_kelas', siswaObj.kelas)
            .maybeSingle();

          if (kelasData && kelasData.tingkat) {
            tingkatSiswa = kelasData.tingkat;
          }
        }

        // 3. Tentukan Tipe Siswa
        let tipeSiswa = 'Siswa Baru';
        if (siswaObj.status_siswa) {
          const statusLower = siswaObj.status_siswa.toLowerCase();
          if (statusLower === 'baru') {
            tipeSiswa = 'Siswa Baru';
          } else if (statusLower === 'pindahan') {
            if (tingkatSiswa === 8) tipeSiswa = 'Pindahan Kelas 8';
            else if (tingkatSiswa === 9) tipeSiswa = 'Pindahan Kelas 9';
            else tipeSiswa = 'Siswa Baru'; 
          } else {
            tipeSiswa = siswaObj.status_siswa;
          }
        }

        // 4. Fetch Biaya Pengembangan Mutu
        const { data: configData } = await supabase
          .from('biaya_pengembangan_mutu')
          .select('data_anggaran')
          .eq('tahun_pelajaran', tahunPelajaran)
          .eq('semester', semester)
          .eq('tipe_siswa', tipeSiswa)
          .maybeSingle();

        let extractedItems = [];
        if (configData && configData.data_anggaran) {
          configData.data_anggaran.forEach(item => {
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

        // 5. Fetch Riwayat Pemasukan
        const { data: pemasukanData } = await supabase
          .from('tb_pemasukan_siswa')
          .select('*')
          .eq('siswa_id', siswaObj.id)
          .eq('tahun_pelajaran', tahunPelajaran)
          .eq('semester', semester)
          .order('tanggal', { ascending: true })
          .order('created_at', { ascending: true });

        setPemasukanList(pemasukanData || []);

        // 6. Fetch Saldo & Subsidi
        const { data: saldoData } = await supabase
          .from('tb_saldo_siswa')
          .select('*')
          .eq('siswa_id', siswaObj.id)
          .eq('tahun_pelajaran', tahunPelajaran)
          .eq('semester', semester)
          .maybeSingle();

        if (saldoData) {
          setSaldo(saldoData.saldo_sebelumnya || 0);
          setSubsidi(saldoData.subsidi_pip || 0);
        } else {
          setSaldo(0);
          setSubsidi(0);
        }

      } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memuat rincian tagihan.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSiswaAndLedger();
  }, [userData, tahunPelajaran, semester]);

  // Perhitungan
  const totalHarusDibayar = biayaItems.reduce((sum, item) => sum + item.biaya, 0);
  const totalPemasukan = pemasukanList.reduce((sum, item) => sum + item.nominal, 0);
  const totalSudahBayar = totalPemasukan + saldo + subsidi;
  const selisih = totalHarusDibayar - totalSudahBayar;
  
  const isLunas = selisih === 0;
  const isLebih = selisih < 0;
  const isKurang = selisih > 0;
  
  const kembalian = isLebih ? Math.abs(selisih) : 0;
  const kurang = isKurang ? selisih : 0;

  // Alokasi Pembayaran (Waterfall)
  let remainingAlloc = totalSudahBayar;
  const allocatedItems = biayaItems.map(item => {
    let statusText = '';
    let statusColor = '';

    if (remainingAlloc >= item.biaya) {
      statusText = 'Lunas';
      statusColor = 'bg-green-50 text-green-700 font-bold';
      remainingAlloc -= item.biaya;
    } else if (remainingAlloc > 0) {
      statusText = `Kurang Rp ${(item.biaya - remainingAlloc).toLocaleString('id-ID')}`;
      statusColor = 'bg-red-50 text-red-600 font-bold'; 
      remainingAlloc = 0;
    } else {
      statusText = `Belum Dibayar (Rp ${item.biaya.toLocaleString('id-ID')})`;
      statusColor = 'bg-red-50 text-red-600 font-bold';
    }

    return { ...item, statusText, statusColor };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300 pb-10">
      
      {/* Header & Filter */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -z-0"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CreditCard className="text-indigo-600" /> Tagihan & Pembayaran
          </h2>
          <p className="text-gray-500 mt-1">Pantau rincian biaya, tagihan, dan histori setoran Anda.</p>
        </div>

        <div className="grid grid-cols-2 w-full md:flex md:w-auto items-center gap-3 relative z-10 mt-4 md:mt-0">
          <select 
            value={semester} 
            onChange={(e) => setSemester(e.target.value)}
            className="w-full min-w-0 px-2 sm:px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold text-gray-700 text-ellipsis overflow-hidden"
          >
            <option value="Tahunan">Tahunan</option>
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
          </select>
          <select 
            value={tahunPelajaran} 
            onChange={(e) => setTahunPelajaran(e.target.value)}
            className="w-full min-w-0 px-2 sm:px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold text-gray-700 text-ellipsis overflow-hidden"
          >
            <option value="2023/2024">2023/2024</option>
            <option value="2024/2025">2024/2025</option>
            <option value="2025/2026">2025/2026</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
           <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* KIRI: Ringkasan Tagihan & Histori Pemasukan */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Card Ringkasan */}
            <div className={`rounded-2xl p-6 text-white shadow-lg relative overflow-hidden ${isLunas ? 'bg-gradient-to-br from-green-600 to-emerald-700' : isKurang ? 'bg-gradient-to-br from-red-600 to-rose-700' : 'bg-gradient-to-br from-indigo-600 to-blue-700'}`}>
              <Calculator className="absolute right-[-10px] bottom-[-10px] opacity-20" size={120} />
              <div className="relative z-10">
                <div className="text-white/80 font-medium text-sm mb-1 uppercase tracking-wider">Total Tagihan</div>
                <h3 className="text-3xl font-black mb-4">Rp {totalHarusDibayar.toLocaleString('id-ID')}</h3>
                
                <div className="space-y-2 mt-4 pt-4 border-t border-white/20">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/80">Sudah Dibayar</span>
                    <span className="font-bold">Rp {totalSudahBayar.toLocaleString('id-ID')}</span>
                  </div>
                  {saldo > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">↳ Saldo Kelas Sebelumnya</span>
                      <span className="text-white/90">Rp {saldo.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {subsidi > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">↳ Subsidi (PIP dsb)</span>
                      <span className="text-white/90">Rp {subsidi.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-2">
                    <span className="text-white/80 font-semibold">{isLunas ? 'Status' : isLebih ? 'Kelebihan / Kembali' : 'Sisa Kekurangan'}</span>
                    <span className="font-bold text-lg">
                      {isLunas ? (
                         <span className="flex items-center gap-1"><CheckCircle2 size={16}/> LUNAS</span>
                      ) : isLebih ? `Rp ${kembalian.toLocaleString('id-ID')}` : `Rp ${kurang.toLocaleString('id-ID')}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Riwayat Pembayaran */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                 <FileText className="text-gray-500" size={18} />
                 <h3 className="font-bold text-gray-800">Histori Pembayaran</h3>
               </div>
               <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                 {pemasukanList.length === 0 ? (
                    <div className="text-center py-8 px-4 text-gray-500 text-sm italic">
                      Belum ada riwayat pembayaran pada periode ini.
                    </div>
                 ) : (
                    <div className="divide-y divide-gray-100">
                      {pemasukanList.map((item, idx) => (
                        <div key={item.id} className="p-4 hover:bg-gray-50 transition flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">Pembayaran Ke-{idx + 1}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{new Date(item.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          </div>
                          <div className="font-bold text-indigo-600 text-sm">
                            + Rp {item.nominal.toLocaleString('id-ID')}
                          </div>
                        </div>
                      ))}
                    </div>
                 )}
               </div>
            </div>

          </div>

          {/* KANAN: Rincian Tagihan */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-w-0">
            <div className="p-6 border-b border-gray-100">
               <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                 <AlertCircle className="text-indigo-600" size={20} /> Rincian Tagihan dan Alokasi
               </h3>
               <p className="text-sm text-gray-500 mt-1">Sistem secara otomatis mengalokasikan pembayaran Anda ke tagihan berdasarkan urutan prioritas di bawah ini.</p>
            </div>

            <div className="overflow-x-auto custom-scrollbar w-full">
               <table className="w-full min-w-max text-left border-collapse whitespace-nowrap">
                 <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold border-b border-gray-100">
                   <tr>
                     <th className="px-6 py-4 w-12 text-center">No</th>
                     <th className="px-6 py-4">Jenis Iuran / Tagihan</th>
                     <th className="px-6 py-4 text-right">Biaya (Rp)</th>
                     <th className="px-6 py-4 text-right">Status / Alokasi</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 text-sm">
                   {allocatedItems.length === 0 ? (
                     <tr>
                       <td colSpan="4" className="px-6 py-10 text-center text-gray-400 italic">
                         Tidak ada rincian tagihan yang terdata.
                       </td>
                     </tr>
                   ) : (
                     allocatedItems.map((item, idx) => (
                       <tr key={item.id} className="hover:bg-gray-50 transition">
                         <td className="px-6 py-4 text-center font-medium text-gray-500">{idx + 1}</td>
                         <td className="px-6 py-4 font-semibold text-gray-800">{item.uraian}</td>
                         <td className="px-6 py-4 text-right text-gray-600 font-medium">{item.biaya.toLocaleString('id-ID')}</td>
                         <td className={`px-6 py-4 text-right border-l border-white ${item.statusColor}`}>
                           {item.statusText}
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 text-sm text-gray-500 text-center italic">
              Untuk melakukan pembayaran atau konfirmasi, silakan hubungi bagian administrasi sekolah (Bendahara).
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
