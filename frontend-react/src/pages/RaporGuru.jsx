import { useState, useEffect, useRef } from 'react';
import { Award, Printer, Search, FileText, X, Save, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import RaporPrintView from '../components/RaporPrintView';

export default function RaporGuru() {
  const [dataKelas, setDataKelas] = useState([]);
  const [selectedKelasObj, setSelectedKelasObj] = useState(null);
  
  const currentYear = new Date().getFullYear();
  const defaultTahun = new Date().getMonth() >= 6 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
  
  const [filterTahun, setFilterTahun] = useState(defaultTahun);
  const [filterSemester, setFilterSemester] = useState('Ganjil');
  
  const [dataSiswa, setDataSiswa] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Print state
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintingMassal, setIsPrintingMassal] = useState(false);
  const [printDataList, setPrintDataList] = useState([]); // Array to handle massal and single

  useEffect(() => {
    const fetchKelas = async () => {
      try {
        let { data } = await supabase.from('data_kelas').select('*').order('nama_kelas', { ascending: true });
        
        // Filter for Wali Kelas if login as guru
        const userSession = localStorage.getItem('user_guru');
        const userPerms = localStorage.getItem('user_permissions');
        let permissions = [];
        if (userPerms) {
          permissions = JSON.parse(userPerms);
        }

        if (userSession) {
          const userObj = JSON.parse(userSession);
          if (userObj && userObj.id) {
             const isAdmin = permissions.includes('*');
             if (!isAdmin) {
                data = data.filter(k => String(k.wali_kelas_id) === String(userObj.id));
             }
          }
        }
        setDataKelas(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchKelas();
  }, []);

  const handleFetchSiswa = async () => {
    if (!selectedKelasObj) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Pilih Kelas terlebih dahulu!' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_siswa')
        .select('*')
        .eq('kelas', selectedKelasObj.nama_kelas)
        .eq('status_keaktifan', 'Aktif')
        .order('nama', { ascending: true });

      if (error) throw error;
      setDataSiswa(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat data siswa', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const constructPrintData = (siswa, lembagaData, mapelData, nilaiData, tpData, ekskulData, kokuData, presensiData, catatanData) => {
    // Helper untuk merangkai satu object printData
    const nilaiSiswa = nilaiData?.filter(n => n.nipd === siswa.nipd) || [];
    const tpIds = [];
    nilaiSiswa.forEach(n => {
      if (n.id_tujuan_pembelajaran) {
        n.id_tujuan_pembelajaran.split(',').forEach(id => tpIds.push(id.trim()));
      }
    });

    const mapelWithNilai = (mapelData || []).map(m => {
      const nilaiMapel = nilaiSiswa.filter(n => String(n.id_mapel) === String(m.id));
      let total = 0;
      let count = 0;
      let tps = [];

      ['Tugas', 'PTS', 'PAS'].forEach(jenis => {
        const n = nilaiMapel.find(x => x.jenis_nilai === jenis);
        if (n && n.nilai_siswa !== null) {
          total += Number(n.nilai_siswa);
          count++;
        }
        if (n && n.id_tujuan_pembelajaran) {
          const ids = n.id_tujuan_pembelajaran.split(',');
          ids.forEach(id => {
            const tpObj = tpData?.find(t => String(t.id) === String(id.trim()));
            if (tpObj && !tps.includes(tpObj.tujuan_pembelajaran)) {
              tps.push(tpObj.tujuan_pembelajaran);
            }
          });
        }
      });

      const nilaiAkhir = count > 0 ? Math.round(total / count) : null;
      let capaian_kompetensi = null;
      if (tps.length > 0) {
        capaian_kompetensi = `Mencapai Kompetensi dengan sangat baik dalam hal ${tps.join(', ')}.`;
      }

      return { ...m, nilai_akhir: nilaiAkhir, capaian_kompetensi };
    });

    const mapelWajib = mapelWithNilai.filter(m => m.kelompok?.toLowerCase().includes('wajib') || !m.kelompok || m.kelompok === 'A' || m.kelompok === 'B');
    const mapelPilihan = mapelWithNilai.filter(m => m.kelompok?.toLowerCase().includes('pilihan') || m.kelompok === 'C');

    const ekskulSiswa = ekskulData?.filter(e => e.siswa_id === siswa.id) || [];
    const formatEkskul = ekskulSiswa.map(e => ({
      nama_ekskul: e.data_ekskul?.nama_ekskul,
      keterangan: e.keterangan
    }));

    const kokuSiswa = kokuData?.filter(k => k.siswa_id === siswa.id) || [];
    const formatKoku = kokuSiswa.map(k => ({
      nama_kegiatan: k.data_kokurikuler?.nama_kegiatan
    }));

    const presensiSiswa = presensiData?.filter(p => p.siswa_id === siswa.id) || [];
    const presensi = { sakit: 0, izin: 0, alpha: 0 };
    presensiSiswa.forEach(p => {
      if (p.status === 'Sakit') presensi.sakit++;
      if (p.status === 'Izin') presensi.izin++;
      if (p.status === 'Alpha') presensi.alpha++;
    });

    const catatanSiswa = catatanData?.find(c => c.nipd === siswa.nipd);

    return {
      siswa,
      lembaga: lembagaData,
      kelas: selectedKelasObj,
      waliKelas: { nama: selectedKelasObj?.wali_kelas_nama },
      kepalaSekolah: { nama: lembagaData?.kepala_sekolah, nip: lembagaData?.nip_kepsek },
      tahunAjaran: filterTahun,
      semester: filterSemester,
      mapelWajib,
      mapelPilihan,
      ekskul: formatEkskul,
      kokurikuler: formatKoku,
      presensi,
      catatanWali: catatanSiswa
    };
  };

  const fetchGlobalDataForPrint = async (targetNipds, targetSiswaIds) => {
    // 1. Fetch Lembaga
    const { data: lembagaData } = await supabase.from('data_lembaga').select('*').limit(1).single();
    // 2. Fetch Mapel
    const { data: mapelData } = await supabase.from('data_mapel').select('*').order('urutan', { ascending: true });
    // 3. Fetch Nilai
    const { data: nilaiData } = await supabase.from('nilai_siswa').select('*')
      .in('nipd', targetNipds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
    // 4. Fetch TP
    const tpIds = [];
    nilaiData?.forEach(n => {
      if (n.id_tujuan_pembelajaran) n.id_tujuan_pembelajaran.split(',').forEach(id => tpIds.push(id.trim()));
    });
    let tpData = [];
    if (tpIds.length > 0) {
      const { data } = await supabase.from('tujuan_pembelajaran').select('id, tujuan_pembelajaran').in('id', [...new Set(tpIds)]);
      tpData = data || [];
    }
    // 5. Fetch Ekskul & Kokurikuler
    const { data: ekskulData } = await supabase.from('anggota_ekskul')
      .select(`siswa_id, keterangan, data_ekskul ( nama_ekskul )`)
      .in('siswa_id', targetSiswaIds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
    const { data: kokuData } = await supabase.from('anggota_kokurikuler')
      .select(`siswa_id, data_kokurikuler ( nama_kegiatan )`)
      .in('siswa_id', targetSiswaIds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
    // 6. Fetch Presensi
    const { data: presensiData } = await supabase.from('presensi_siswa')
      .select('siswa_id, status')
      .in('siswa_id', targetSiswaIds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);
    // 7. Fetch Catatan Wali
    const { data: catatanData } = await supabase.from('catatan_wali')
      .select('*')
      .in('nipd', targetNipds).eq('tahun_ajaran', filterTahun).eq('semester', filterSemester);

    return { lembagaData, mapelData, nilaiData, tpData, ekskulData, kokuData, presensiData, catatanData };
  };

  const handleCetakRapor = async (siswa) => {
    setIsPrinting(true);
    try {
      const globals = await fetchGlobalDataForPrint([siswa.nipd], [siswa.id]);
      const pData = constructPrintData(
        siswa, globals.lembagaData, globals.mapelData, globals.nilaiData, 
        globals.tpData, globals.ekskulData, globals.kokuData, globals.presensiData, globals.catatanData
      );
      
      setPrintDataList([pData]);
      
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 500);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat data rapor lengkap', 'error');
      setIsPrinting(false);
    }
  };

  const handleCetakMassal = async () => {
    if (dataSiswa.length === 0) return;
    setIsPrintingMassal(true);
    
    // Kasih sedikit delay agar UI loading button terlihat
    await new Promise(r => setTimeout(r, 100));

    try {
      const targetNipds = dataSiswa.map(s => s.nipd);
      const targetSiswaIds = dataSiswa.map(s => s.id);
      
      const globals = await fetchGlobalDataForPrint(targetNipds, targetSiswaIds);
      
      const pDataList = dataSiswa.map(siswa => constructPrintData(
        siswa, globals.lembagaData, globals.mapelData, globals.nilaiData, 
        globals.tpData, globals.ekskulData, globals.kokuData, globals.presensiData, globals.catatanData
      ));
      
      setPrintDataList(pDataList);
      
      setTimeout(() => {
        window.print();
        setIsPrintingMassal(false);
      }, 1000); // 1 detik karena banyak DOM yang harus di-render
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal memuat data rapor massal', 'error');
      setIsPrintingMassal(false);
    }
  };

  return (
    <>
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
              <Award className="text-primary" /> Cetak Rapor Siswa
            </h2>
            <p className="text-gray-500 text-sm mt-1">Kelola catatan wali kelas dan cetak Laporan Hasil Belajar.</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 flex-wrap">
          <select 
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none font-semibold w-full md:w-auto"
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
          >
            <option value={`${currentYear-1}/${currentYear}`}>{`${currentYear-1}/${currentYear}`}</option>
            <option value={`${currentYear}/${currentYear+1}`}>{`${currentYear}/${currentYear+1}`}</option>
          </select>
          
          <select 
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none font-semibold w-full md:w-auto"
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
          >
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
          </select>

          <select 
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none font-semibold flex-1 min-w-[200px]"
            value={selectedKelasObj ? JSON.stringify(selectedKelasObj) : ''}
            onChange={(e) => setSelectedKelasObj(e.target.value ? JSON.parse(e.target.value) : null)}
          >
            <option value="">-- Pilih Kelas --</option>
            {dataKelas.map((k) => (
              <option key={k.id} value={JSON.stringify(k)}>Kelas {k.nama_kelas}</option>
            ))}
          </select>
          
          <button onClick={handleFetchSiswa} disabled={isLoading} className="bg-primary hover:bg-blue-900 text-white px-6 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 w-full md:w-auto shadow-md">
            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />} Tampilkan Siswa
          </button>
        </div>

        {dataSiswa.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-700">Daftar Siswa - Kelas {selectedKelasObj?.nama_kelas}</h3>
              <button 
                onClick={handleCetakMassal} 
                disabled={isPrintingMassal}
                className="bg-accent hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm w-full md:w-auto"
              >
                {isPrintingMassal ? <RefreshCw className="animate-spin" size={16} /> : <Printer size={16} />} 
                {isPrintingMassal ? 'Menyiapkan Cetak...' : 'Cetak Massal Rapor'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
                  <tr>
                    <th className="p-4 font-semibold text-center w-16">No</th>
                    <th className="p-4 font-semibold">Nama Siswa</th>
                    <th className="p-4 font-semibold">NIS/NISN</th>
                    <th className="p-4 font-semibold text-center w-80">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dataSiswa.map((siswa, idx) => (
                    <tr key={siswa.id} className="hover:bg-blue-50/50 transition">
                      <td className="p-4 text-center font-medium">{idx + 1}</td>
                      <td className="p-4 font-bold text-gray-800">{siswa.nama}</td>
                      <td className="p-4 text-gray-500">{siswa.nipd} / {siswa.nisn}</td>
                      <td className="p-4 text-center flex justify-center gap-2">
                        <button 
                          onClick={() => handleCetakRapor(siswa)} 
                          disabled={isPrinting}
                          className="bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1 border border-green-200"
                        >
                          {isPrinting ? <RefreshCw className="animate-spin" size={16} /> : <Printer size={16} />} Cetak
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Hidden container for print view, visible only when printing */}
      <div className="hidden print:block absolute inset-0 bg-white z-[200]">
        {printDataList.map((data, idx) => (
          <div key={idx} style={{ pageBreakBefore: idx > 0 ? 'always' : 'auto' }}>
            <RaporPrintView data={data} />
          </div>
        ))}
      </div>
    </>
  );
}
